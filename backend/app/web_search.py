import httpx
from bs4 import BeautifulSoup
import logging
import re

logger = logging.getLogger(__name__)

DUCKDUCKGO_HTML_URL = "https://html.duckduckgo.com/html/"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


async def web_search(query: str, max_results: int = 5) -> list[dict]:
    """Search the web using DuckDuckGo HTML endpoint (no API key needed)."""
    results = []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                DUCKDUCKGO_HTML_URL,
                data={"q": query, "b": "" },
                headers={"User-Agent": USER_AGENT},
                follow_redirects=True,
            )
            if resp.status_code != 200:
                logger.warning(f"DuckDuckGo returned {resp.status_code}")
                return results

            soup = BeautifulSoup(resp.text, "lxml")
            for item in soup.select(".result"):
                title_el = item.select_one(".result__title a")
                snippet_el = item.select_one(".result__snippet")
                if not title_el:
                    continue
                title = title_el.get_text(strip=True)
                href = title_el.get("href", "")
                # DuckDuckGo wraps URLs in a redirect
                if "uddg=" in href:
                    from urllib.parse import parse_qs, urlparse
                    parsed = urlparse(href)
                    qs = parse_qs(parsed.query)
                    href = qs.get("uddg", [href])[0]
                snippet = snippet_el.get_text(strip=True) if snippet_el else ""
                if title and href:
                    results.append({"title": title, "url": href, "snippet": snippet})
                if len(results) >= max_results:
                    break
    except Exception as e:
        logger.error(f"Web search error: {e}")

    return results


def format_search_context(results: list[dict]) -> str:
    """Format search results into a context string for the LLM."""
    if not results:
        return ""
    lines = ["Resultados de búsqueda web relevantes:"]
    for i, r in enumerate(results, 1):
        lines.append(f"\n[{i}] {r['title']}")
        lines.append(f"URL: {r['url']}")
        if r['snippet']:
            lines.append(f"Resumen: {r['snippet']}")
    lines.append("\nUsa esta información para responder con datos actualizados. Cita las fuentes cuando sea relevante.")
    return "\n".join(lines)


CODE_SYSTEM_PROMPT = """Eres un asistente IA experto en programación. Sigue estas reglas al generar código:

1. SIEMPRE escribe código completo y funcional, nunca uses comentarios como "// resto del código" o "...".
2. Verifica que todos los imports necesarios estén incluidos.
3. Usa nombres de variables descriptivos y sigue las mejores prácticas del lenguaje.
4. Incluye manejo de errores apropiado (try/catch, validaciones).
5. Si no estás seguro de una API o función, indica tu incertidumbre en lugar de inventar.
6. Proporciona el código en bloques markdown con el lenguaje correcto especificado.
7. Después del código, explica brevemente cómo funciona y qué hacer si hay errores.
8. Si el usuario pide algo que requiere una librería específica, menciona qué instalar.

Cuando respondas preguntas generales, sé conciso y directo."""
