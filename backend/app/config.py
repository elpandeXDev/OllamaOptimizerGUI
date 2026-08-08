"""Configuration settings for OllamaOptimizerGUI backend.

All settings can be overridden via environment variables with the OOG_ prefix.
For production deployments, set OOG_CORS_ORIGINS to your domain(s).
"""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Ollama connection
    ollama_host: str = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

    # Server
    host: str = os.environ.get("OOG_HOST", "0.0.0.0")
    port: int = int(os.environ.get("OOG_PORT", "8000"))
    workers: int = int(os.environ.get("OOG_WORKERS", "1"))
    log_level: str = os.environ.get("OOG_LOG_LEVEL", "info")

    # Security
    cors_origins_str: str = os.environ.get("OOG_CORS_ORIGINS", "*")
    api_key: str = os.environ.get("OOG_API_KEY", "")
    max_request_size: int = int(os.environ.get("OOG_MAX_REQUEST_SIZE", str(10 * 1024 * 1024)))

    # Rate limiting (requests per minute per IP)
    rate_limit: int = int(os.environ.get("OOG_RATE_LIMIT", "0"))  # 0 = disabled

    # Base path for serving the app (e.g., "/oog" to serve at /oog/)
    base_path: str = os.environ.get("OOG_BASE_PATH", "/oog")

    # Ollama client
    ollama_timeout: float = float(os.environ.get("OOG_OLLAMA_TIMEOUT", "300.0"))

    class Config:
        env_prefix = "OOG_"

    @property
    def cors_origins(self) -> list[str]:
        if self.cors_origins_str == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins_str.split(",") if o.strip()]


settings = Settings()
