"""Configuration settings for OllamaOptimizerGUI backend.

All settings can be overridden via environment variables with the OOG_ prefix.
For production deployments, set OOG_CORS_ORIGINS to your domain(s).
"""
import os
from pydantic_settings import BaseSettings


def _parse_cors() -> list[str]:
    raw = os.environ.get("OOG_CORS_ORIGINS", "*")
    if raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


class Settings(BaseSettings):
    # Ollama connection
    ollama_host: str = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

    # Server
    host: str = os.environ.get("OOG_HOST", "0.0.0.0")
    port: int = int(os.environ.get("OOG_PORT", "8000"))
    workers: int = int(os.environ.get("OOG_WORKERS", "1"))
    log_level: str = os.environ.get("OOG_LOG_LEVEL", "info")

    # Security
    cors_origins: list[str] = _parse_cors()
    api_key: str = os.environ.get("OOG_API_KEY", "")
    max_request_size: int = int(os.environ.get("OOG_MAX_REQUEST_SIZE", str(10 * 1024 * 1024)))

    # Rate limiting (requests per minute per IP)
    rate_limit: int = int(os.environ.get("OOG_RATE_LIMIT", "0"))  # 0 = disabled

    # Ollama client
    ollama_timeout: float = float(os.environ.get("OOG_OLLAMA_TIMEOUT", "300.0"))

    class Config:
        env_prefix = "OOG_"


settings = Settings()
