"""Main FastAPI application for OllamaOptimizerGUI."""
import json
import time
import logging
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Depends, Security
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from pathlib import Path

from app.config import settings
from app.ollama_client import ollama_client
from app.optimizer import (
    get_system_info,
    compute_optimization,
    profile_to_options,
    system_info_dict,
    optimization_dict,
)
from app.database import (
    init_db,
    create_conversation,
    get_conversations,
    get_conversation,
    update_conversation,
    delete_conversation,
    add_message,
    get_messages,
)
from app.auth import register_user, login_user, get_user_from_token

logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger(__name__)

# ─── Rate limiter (in-memory, per-worker) ────────────────────────────────────

_rate_limiter_store: dict[str, deque] = defaultdict(deque)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter. OOG_RATE_LIMIT=0 disables it."""

    async def dispatch(self, request: Request, call_next):
        if settings.rate_limit <= 0:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = 60.0  # 1 minute window

        reqs = _rate_limiter_store[client_ip]
        while reqs and reqs[0] < now - window:
            reqs.popleft()

        if len(reqs) >= settings.rate_limit:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again in a minute."},
            )

        reqs.append(now)
        return await call_next(request)


# ─── API Key auth (optional) ─────────────────────────────────────────────────

async def verify_api_key(request: Request):
    """If OOG_API_KEY is set, require it in Authorization header or ?api_key= query param."""
    if not settings.api_key:
        return

    auth_header = request.headers.get("Authorization", "")
    query_key = request.query_params.get("api_key", "")

    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    elif query_key:
        token = query_key

    if token != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting OllamaOptimizerGUI backend...")
    await init_db()
    logger.info("Database initialized")
    yield
    await ollama_client.close()


# ─── Sub-application (mounted at base_path) ──────────────────────────────────
# All API routes and static files live under the base_path (e.g., /oog/)

sub_app = FastAPI(
    title="OllamaOptimizerGUI API",
    version="1.0.0",
    lifespan=lifespan,
)

sub_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
sub_app.add_middleware(RateLimitMiddleware)

# Trusted host (only in production with specific CORS)
if settings.cors_origins != ["*"]:
    trusted_hosts = [h.replace("https://", "").replace("http://", "") for h in settings.cors_origins]
    sub_app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts + ["localhost", "127.0.0.1"])


# ─── Auth dependency ─────────────────────────────────────────────────────────

async def get_current_user(request: Request):
    """Extract and verify JWT token from Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    user = await get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


# ─── Auth endpoints ───────────────────────────────────────────────────────────

@sub_app.post("/api/auth/register")
async def api_register(body: dict):
    username = body.get("username", "").strip()
    password = body.get("password", "")
    try:
        result = await register_user(username, password)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@sub_app.post("/api/auth/login")
async def api_login(body: dict):
    username = body.get("username", "").strip()
    password = body.get("password", "")
    try:
        result = await login_user(username, password)
        return result
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@sub_app.get("/api/auth/me")
async def api_me(user: dict = Depends(get_current_user)):
    return {"user": user}


# ─── Conversation endpoints ───────────────────────────────────────────────────

@sub_app.get("/api/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    convs = await get_conversations(user["id"])
    return {"conversations": convs}


@sub_app.post("/api/conversations")
async def create_conv(body: dict, user: dict = Depends(get_current_user)):
    title = body.get("title", "Nueva conversación")
    model = body.get("model", "")
    conv = await create_conversation(user["id"], title, model)
    return conv


@sub_app.get("/api/conversations/{conv_id}")
async def get_conv(conv_id: int, user: dict = Depends(get_current_user)):
    conv = await get_conversation(user["id"], conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = await get_messages(conv_id)
    return {"conversation": conv, "messages": msgs}


@sub_app.patch("/api/conversations/{conv_id}")
async def update_conv(conv_id: int, body: dict, user: dict = Depends(get_current_user)):
    title = body.get("title")
    model = body.get("model")
    conv = await update_conversation(user["id"], conv_id, title, model)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@sub_app.delete("/api/conversations/{conv_id}")
async def delete_conv(conv_id: int, user: dict = Depends(get_current_user)):
    deleted = await delete_conversation(user["id"], conv_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True}


@sub_app.post("/api/conversations/{conv_id}/messages")
async def add_msg(conv_id: int, body: dict, user: dict = Depends(get_current_user)):
    conv = await get_conversation(user["id"], conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    role = body.get("role", "user")
    content = body.get("content", "")
    timing_json = body.get("timing_json")
    msg = await add_message(conv_id, role, content, timing_json)
    return msg


# ─── Health ──────────────────────────────────────────────────────────────────

@sub_app.get("/api/health")
async def health():
    try:
        models = await ollama_client.list_models()
        ollama_status = "connected"
        model_count = len(models.get("models", []))
    except Exception:
        ollama_status = "disconnected"
        model_count = 0

    return {
        "status": "ok",
        "ollama": ollama_status,
        "model_count": model_count,
        "ollama_host": settings.ollama_host,
    }


# ─── System Info & Optimization ──────────────────────────────────────────────

@sub_app.get("/api/system")
async def get_system():
    info = get_system_info()
    return system_info_dict(info)


@sub_app.get("/api/optimize")
async def get_optimization(
    model_size_gb: float = 4.0,
    quality_mode: str = "balanced",
):
    """Get recommended optimization parameters for the current system."""
    info = get_system_info()
    profile = compute_optimization(info, model_size_gb, quality_mode)
    return {
        "system": system_info_dict(info),
        "optimization": optimization_dict(profile),
        "options": profile_to_options(profile),
    }


@sub_app.post("/api/optimize")
async def compute_optimization_post(body: dict):
    """Compute optimization with custom parameters."""
    model_size_gb = body.get("model_size_gb", 4.0)
    quality_mode = body.get("quality_mode", "balanced")
    info = get_system_info()
    profile = compute_optimization(info, model_size_gb, quality_mode)
    return {
        "system": system_info_dict(info),
        "optimization": optimization_dict(profile),
        "options": profile_to_options(profile),
    }


# ─── Models ──────────────────────────────────────────────────────────────────

@sub_app.get("/api/models")
async def list_models():
    return await ollama_client.list_models()


@sub_app.get("/api/models/running")
async def running_models():
    return await ollama_client.get_running_models()


@sub_app.get("/api/models/{model_name}")
async def model_info(model_name: str):
    try:
        return await ollama_client.get_model_info(model_name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Model not found: {model_name}")


@sub_app.delete("/api/models/{model_name}")
async def delete_model(model_name: str):
    try:
        return await ollama_client.delete_model(model_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@sub_app.post("/api/models/{model_name}/load")
async def load_model(model_name: str, body: dict = None):
    keep_alive = (body or {}).get("keep_alive", "5m")
    try:
        return await ollama_client.load_model(model_name, keep_alive)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@sub_app.post("/api/models/{model_name}/unload")
async def unload_model(model_name: str):
    try:
        return await ollama_client.unload_model(model_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Model Pull (streaming) ──────────────────────────────────────────────────

@sub_app.post("/api/models/pull")
async def pull_model(request: Request):
    body = await request.json()
    model_name = body.get("name", "")
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name required")

    async def stream():
        try:
            async for line in ollama_client.pull_model(model_name):
                yield f"data: {line}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


# ─── Chat (streaming) ────────────────────────────────────────────────────────

@sub_app.post("/api/chat")
async def chat(request: Request):
    """Streaming chat endpoint with optimization support."""
    body = await request.json()
    model = body.get("model", "")
    messages = body.get("messages", [])
    use_optimization = body.get("use_optimization", True)
    quality_mode = body.get("quality_mode", "balanced")
    model_size_gb = body.get("model_size_gb", 4.0)
    custom_options = body.get("options", {})

    if not model:
        raise HTTPException(status_code=400, detail="Model name required")

    options = custom_options
    if use_optimization and not custom_options:
        info = get_system_info()
        profile = compute_optimization(info, model_size_gb, quality_mode)
        options = profile_to_options(profile)

    async def stream():
        start_time = time.time()
        first_token_time = None
        token_count = 0

        try:
            async for line in ollama_client.chat_stream(model, messages, options):
                data = json.loads(line)
                if first_token_time is None and data.get("message", {}).get("content"):
                    first_token_time = time.time()

                if data.get("message", {}).get("content"):
                    token_count += 1

                # Inject timing metadata in final chunk
                if data.get("done"):
                    total_time = time.time() - start_time
                    ttft = (first_token_time - start_time) if first_token_time else 0
                    data["timing"] = {
                        "total_seconds": round(total_time, 3),
                        "ttft_seconds": round(ttft, 3),
                        "tokens": token_count,
                        "tokens_per_second": round(token_count / total_time, 2) if total_time > 0 else 0,
                    }

                yield f"data: {json.dumps(data)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


# ─── Serve Frontend (production) ─────────────────────────────────────────────

frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    sub_app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
else:
    @sub_app.get("/")
    async def root():
        return JSONResponse({
            "message": "OllamaOptimizerGUI API",
            "frontend": "Run 'npm run build' in frontend/ to serve the UI",
            "docs": f"{settings.base_path}/docs",
        })


# ─── Main app: mounts sub_app at base_path ───────────────────────────────────

app = FastAPI()

base = settings.base_path.rstrip("/")

if base:
    app.mount(base, sub_app)

    @app.get("/")
    async def root_redirect():
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=f"{base}/")
else:
    app = sub_app
