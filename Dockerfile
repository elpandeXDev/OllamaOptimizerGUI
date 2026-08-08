# ─── Stage 1: Build frontend ─────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install

COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Python backend (production) ────────────────────────────────────
FROM python:3.12-slim AS backend

WORKDIR /app

# Install system dependencies (curl for healthcheck, gcc for psutil)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create non-root user for security
RUN useradd -m -u 1000 oog && chown -R oog:oog /app
USER oog

# Environment variables (defaults, override in docker-compose/env)
ENV OOG_HOST=0.0.0.0 \
    OOG_PORT=8000 \
    OOG_WORKERS=4 \
    OOG_LOG_LEVEL=info \
    OOG_CORS_ORIGINS=* \
    OOG_API_KEY= \
    OOG_RATE_LIMIT=0 \
    OLLAMA_HOST=http://ollama:11434

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Production: gunicorn with uvicorn workers
# OOG_WORKERS controls the number of worker processes
CMD ["sh", "-c", "gunicorn app.main:app \
    --workers ${OOG_WORKERS} \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:${OOG_PORT} \
    --timeout 300 \
    --keep-alive 5 \
    --log-level ${OOG_LOG_LEVEL} \
    --access-logfile - \
    --error-logfile -"]
