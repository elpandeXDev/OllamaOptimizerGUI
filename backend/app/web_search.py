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


CODE_SYSTEM_PROMPT = """Eres un asistente IA experto. Escribe código completo y funcional (sin "..." ni placeholders). Incluye imports, manejo de errores, y bloques markdown con el lenguaje correcto. Si no conoces una API, indícalo. Sé conciso en respuestas no técnicas."""

CODE_LANG_HINTS = {
    "python": "Python: type hints, PEP 8, f-strings, logging, except específico.",
    "javascript": "JS: const/let (no var), async/await, template literals, optional chaining.",
    "typescript": "TS: interfaces/types, const/let, async/await, strict typing.",
    "react": "React: functional components+hooks, keys únicas en listas, estados carga/error.",
    "java": "Java: try-with-resources, PascalCase clases, camelCase métodos, Optional.",
    "c++": "C++: includes completos, verificar NULL, liberar memoria, snprintf.",
    "c#": "C#: using statements, PascalCase, async/await, LINQ.",
    "go": "Go: if err!=nil, defer, mayúscula export, goroutines seguras.",
    "rust": "Rust: Result<T,E>, ?, ownership, #[derive(Debug,Clone)], /// docs.",
    "sql": "SQL: mayúsculas keywords, sin SELECT*, JOINs explícitos.",
    "bash": "Bash: set -eu, entrecomillar variables, [[ ]], shebang.",
    "php": "PHP: tipos declarativos, try/catch, namespaces, PSR-4.",
    "html": "HTML: semántico, accesible, validado.",
    "css": "CSS: BEM o utility-first, responsive, variables CSS.",
}

import re as _re

def get_system_prompt(user_message: str = "") -> str:
    """Return base prompt + language-specific hints if code is detected."""
    msg_lower = user_message.lower()
    detected = []
    for lang in CODE_LANG_HINTS:
        if lang in msg_lower:
            detected.append(CODE_LANG_HINTS[lang])
    # Also detect code blocks or common code keywords
    code_keywords = ["código", "codigo", "code", "función", "function", "programa", "script", "bug", "error", "clase", "class", "api"]
    has_code_intent = any(kw in msg_lower for kw in code_keywords) or "```" in user_message
    
    if detected:
        return CODE_SYSTEM_PROMPT + "\n\n" + " ".join(detected)
    elif has_code_intent:
        return CODE_SYSTEM_PROMPT
    else:
        return "Eres un asistente IA útil. Responde de forma concisa, directa y estructurada."
