"""Ollama API client wrapper with async support."""
import httpx
from typing import AsyncGenerator
from app.config import settings


class OllamaClient:
    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or settings.ollama_host
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(base_url=self.base_url, timeout=300.0)
        return self._client

    async def list_models(self) -> dict:
        r = await self.client.get("/api/tags")
        r.raise_for_status()
        return r.json()

    async def get_model_info(self, model: str) -> dict:
        r = await self.client.post("/api/show", json={"name": model})
        r.raise_for_status()
        return r.json()

    async def pull_model(self, model: str) -> AsyncGenerator[str, None]:
        async with self.client.stream("POST", "/api/pull", json={"name": model}) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                yield line

    async def delete_model(self, model: str) -> dict:
        r = await self.client.request("DELETE", "/api/delete", json={"name": model})
        r.raise_for_status()
        return {"status": "deleted", "model": model}

    async def chat_stream(
        self,
        model: str,
        messages: list[dict],
        options: dict | None = None,
    ) -> AsyncGenerator[str, None]:
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
        }
        if options:
            payload["options"] = options

        async with self.client.stream("POST", "/api/chat", json=payload) as r:
            r.raise_for_status()
            async for line in r.aiter_lines():
                yield line

    async def generate(
        self,
        model: str,
        prompt: str,
        options: dict | None = None,
    ) -> dict:
        payload = {"model": model, "prompt": prompt, "stream": False}
        if options:
            payload["options"] = options
        r = await self.client.post("/api/generate", json=payload)
        r.raise_for_status()
        return r.json()

    async def get_running_models(self) -> dict:
        r = await self.client.get("/api/ps")
        r.raise_for_status()
        return r.json()

    async def unload_model(self, model: str) -> dict:
        r = await self.client.post("/api/generate", json={
            "model": model,
            "keep_alive": 0,
        })
        r.raise_for_status()
        return {"status": "unloaded", "model": model}

    async def load_model(self, model: str, keep_alive: str = "5m") -> dict:
        r = await self.client.post("/api/generate", json={
            "model": model,
            "keep_alive": keep_alive,
        })
        r.raise_for_status()
        return {"status": "loaded", "model": model}

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


ollama_client = OllamaClient()
