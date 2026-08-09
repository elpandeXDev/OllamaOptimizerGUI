import httpx
from bs4 import BeautifulSoup
import logging
import re
import json
import hashlib
import time

logger = logging.getLogger(__name__)

DUCKDUCKGO_HTML_URL = "https://html.duckduckgo.com/html/"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Topics that should NOT trigger a web search (the AI already knows these well)
_NO_SEARCH_PATTERNS = [
    # Pure code writing / syntax
    r'\b(escribe|crea|haz|hacer|genera|generar)\b.*\b(funci[oó]n|clase|m[eé]todo|script|c[oó]digo)\b',
    r'\b(refactor|optimiza|corrige|arregla|debug)\b',
    # Greetings / conversational
    r'^(hola|buenos|buenas|hey|qu[eé]\s+tal|gracias|ok|vale|entendido)\b',
    # Math / logic
    r'^\d+\s*[\+\-\*/\=]',
    # Translation
    r'\btraduce|traducir\b',
]

# Topics that SHOULD trigger a web search
_SEARCH_TRIGGER_PATTERNS = [
    r'\b([uú]ltim[oa]|recent|nuev[oa]|actual|latest|versi[oó]n\s+\d|2024|2025|2026)\b',
    r'\b(notici[ae]s?|news|actualidad|sucedi[oó]|pas[oó]|ocurri[oó])\b',
    r'\b(c[oó]mo\s+(est[aá]|va|funciona)\s+(el|la|en))\b',
    r'\b(qui[eé]n\s+(es|fue|gan[oó]))\b',
    r'\b(d[oó]nde\s+(est[aá]|qued[aá]|puedo))\b',
    r'\b(cu[aá]ndo\s+(se|va|saldr[aá]|se\s+lanza))\b',
    r'\b(precio|coste|cu[aá]nto\s+cuesta|d[oó]nde\s+comprar)\b',
    r'\b(api|sdk|librer[ií]a|framework|tool|herramienta)\s+(de|para|en)\s+\w+',
    r'\b(documentaci[oó]n|docs|tutorial|gu[ií]a)\b',
    r'\b(spigot|papermc|bukkit|minecraft.*plugin|discord.*api)\b',
    r'\b(error|bug|issue|problem|problema)\s+\w+\s+(con|en|de)\b',
    r'\b(compar[ao]|vs|versus|mejor\s+que)\b',
    r'\b(instal[ao]r|configur[ao]r|setup|deploy)\b.*\b(en|con|para)\b',
    r'\b(release|changelog|patch\s+notes|update)\b',
]

# Keywords used to search the knowledge cache for related past results
_KNOWLEDGE_KEYWORDS_EXTRACTORS = [
    r'\b(python|javascript|typescript|java|kotlin|rust|go\b|c\+\+|c#|ruby|php|swift|dart|lua)\b',
    r'\b(spigot|papermc|bukkit|minecraft|plugin|disc[oó]rd|bot)\b',
    r'\b(docker|kubernetes|nginx|apache|redis|postgres|mysql|sqlite|mongodb)\b',
    r'\b(react|vue|svelte|angular|next\.?js|node\.?js|express|fastapi|flask|django)\b',
    r'\b(api|rest|graphql|websocket|webhook|oauth|jwt|auth)\b',
]


def should_search(user_message: str) -> bool:
    """Determine if a web search would be helpful for this message."""
    msg_lower = user_message.lower().strip()
    if len(msg_lower) < 5:
        return False

    # Check no-search patterns first
    for pattern in _NO_SEARCH_PATTERNS:
        if re.search(pattern, msg_lower, re.IGNORECASE):
            return False

    # Check trigger patterns
    for pattern in _SEARCH_TRIGGER_PATTERNS:
        if re.search(pattern, msg_lower, re.IGNORECASE):
            return True


# Patterns that indicate the AI doesn't know or is uncertain
_KNOWLEDGE_GAP_PATTERNS = [
    r'\bno\s+(s[eé]|conozco|tengo\s+(informaci[oó]n|conocimiento|acceso|datos))\b',
    r'\bno\s+(estoy\s+seguro|puedo\s+(ayudar|proporcionar|asegurar|confirmar))\b',
    r'\bno\s+(tengo\s+)?(acceso\s+)?a\s+(internet|datos\s+actualizados|informaci[oó]n\s+en\s+tiempo\s+real)\b',
    r'\b(i\s+don'?t\s+know|not\s+sure|unable\s+to|cannot\s+provide|no\s+information)\b',
    r'\bno\s+(puedo\s+)?garantizar\b',
    r'\bpuede\s+(que\s+)?(est[eé]\s+)?(desactualizado|incorrecto|equivocado)\b',
    r'\bte\s+recomiendo\s+(buscar|consultar|verificar)\b',
    r'\bno\s+estoy\s+(al\s+tanto|actualizado)\b',
    r'\bno\s+tengo\s+(forma\s+de\s+)?(saber|verificar|confirmar)\b',
    r'\bcomo\s+(ia|modelo|asistente)\s+(no\s+)?puedo\b',
    r'\bno\s+puedo\s+(acceder\s+a\s+)?(internet|la\s+web|enlaces)\b',
    r'\bmi\s+(conocimiento|informaci[oó]n)\s+(se\s+)?(corta|limita|queda)\b',
    r'\bhasta\s+(donde\s+)?(s[eé]|tengo\s+conocimiento)\b',
    r'\bno\s+estoy\s+familiarizado\s+con\b',
    r'\bno\s+(reconozco|identifico)\s+(ese|este|eso|esto)\b',
]


def detect_knowledge_gap(ai_response: str) -> bool:
    """Check if the AI response indicates it doesn't know or is uncertain.
    Returns True if a fallback web search should be performed.
    """
    if not ai_response or len(ai_response) < 10:
        return False
    resp_lower = ai_response.lower()
    for pattern in _KNOWLEDGE_GAP_PATTERNS:
        if re.search(pattern, resp_lower, re.IGNORECASE):
            return True
    return False

    # If the message looks like a question about facts/events, search
    if any(w in msg_lower for w in ['qué es', 'que es', 'qué son', 'que son', 'quién', 'quien', 'cuál', 'cual', 'cómo funciona', 'como funciona']):
        return True

    return False


def generate_search_query(user_message: str) -> str:
    """Extract a clean search query from the user message."""
    # Remove common conversational prefixes
    msg = re.sub(r'^(por\s+favor\s+|podr[ií]as\s+|puedes\s+|me\s+puedes\s+|ayuda\s+con\s+|necesito\s+|quiero\s+|busca\s+|buscar\s+|search\s+)', '', user_message, flags=re.IGNORECASE)
    # Remove question words that aren't useful for search
    msg = re.sub(r'^(qué\s+es\s+|que\s+es\s+|qué\s+son\s+|que\s+son\s+|quién\s+es\s+|quien\s+es\s+|cuál\s+es\s+|cual\s+es\s+|cómo\s+|como\s+|dónde\s+|donde\s+|cuándo\s+|cuando\s+)', '', msg, flags=re.IGNORECASE)
    # Trim and limit
    msg = msg.strip()[:200]
    return msg if msg else user_message.strip()[:200]


def extract_knowledge_keywords(user_message: str) -> list[str]:
    """Extract keywords from the message to find related cached knowledge."""
    msg_lower = user_message.lower()
    keywords = []
    for pattern in _KNOWLEDGE_KEYWORDS_EXTRACTORS:
        matches = re.findall(pattern, msg_lower, re.IGNORECASE)
        keywords.extend(matches)
    return list(set(keywords))[:10]


def make_query_key(query: str) -> str:
    """Create a stable hash key for a search query."""
    normalized = re.sub(r'\s+', ' ', query.lower().strip())
    return hashlib.md5(normalized.encode()).hexdigest()


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


async def auto_search_with_cache(user_message: str) -> dict:
    """Auto-detect if search is needed, check cache, search fresh if needed, store results.
    Returns dict with: 'context' (str for LLM), 'searched' (bool), 'from_cache' (bool), 'query' (str).
    """
    result = {"context": "", "searched": False, "from_cache": False, "query": ""}

    # 1. Check if this message needs a web search
    if not should_search(user_message):
        return result

    query = generate_search_query(user_message)
    result["query"] = query
    qkey = make_query_key(query)

    # 2. Check cache first (fresh results within 7 days)
    try:
        from app.database import get_knowledge, save_knowledge, search_knowledge_by_keywords
        cached = await get_knowledge(qkey)
        if cached:
            result["context"] = cached
            result["searched"] = True
            result["from_cache"] = True
            return result
    except Exception as e:
        logger.warning(f"Knowledge cache read failed: {e}")

    # 3. Search fresh
    try:
        results = await web_search(query)
        if results:
            context = format_search_context(results)
            result["context"] = context
            result["searched"] = True
            result["from_cache"] = False
            # 4. Store in cache for future chats
            try:
                from app.database import save_knowledge as _save
                await _save(qkey, query, json.dumps(results))
            except Exception as e:
                logger.warning(f"Knowledge cache save failed: {e}")
            return result
    except Exception as e:
        logger.warning(f"Web search failed: {e}")

    # 5. Try to find related knowledge from past searches by keywords
    try:
        from app.database import search_knowledge_by_keywords
        keywords = extract_knowledge_keywords(user_message)
        if keywords:
            related = await search_knowledge_by_keywords(keywords, limit=3)
            if related:
                combined = "\n\n".join(related)
                result["context"] = f"Información relevante de búsquedas anteriores:\n{combined}"
                result["searched"] = True
                result["from_cache"] = True
    except Exception as e:
        logger.warning(f"Knowledge keyword search failed: {e}")

    return result


CODE_SYSTEM_PROMPT = """Eres un asistente IA experto. No saludes, no te presentes, no digas 'claro' ni 'por supuesto'. Responde directamente al punto.

Para código: escribe código completo y funcional (sin '...' ni placeholders). Incluye imports, manejo de errores, y bloques markdown con el lenguaje correcto. Si no conoces una API, indícalo. Verifica nombres de clases, métodos y paquetes antes de usarlos.

Para respuestas complejas: piensa paso a paso antes de responder. Estructura tu respuesta con headings, listas, y ejemplos. Prioriza precisión sobre velocidad.
Para respuestas simples: sé conciso, 1-3 líneas máximo."""

CODE_LANG_HINTS = {
    "python": "Python: type hints, PEP 8, f-strings, logging, except específico. discord.py para bots: Bot(command_prefix=), @bot.command(), await ctx.send(), intents.",
    "javascript": "JS: const/let (no var), async/await, template literals, optional chaining. discord.js: Client with intents, client.on('messageCreate'), interaction.reply().",
    "typescript": "TS: interfaces/types, const/let, async/await, strict typing. discord.js con TS: Client<true>, Events enum, SlashCommandBuilder.",
    "react": "React: functional components+hooks, keys únicas en listas, estados carga/error.",
    "java": "Java: try-with-resources, PascalCase clases, camelCase métodos, Optional. Para Minecraft plugins: extends JavaPlugin, implements Listener, @EventHandler, Bukkit.getPluginManager().registerEvents().",
    "c++": "C++: includes completos, verificar NULL, liberar memoria, snprintf.",
    "c#": "C#: using statements, PascalCase, async/await, LINQ.",
    "go": "Go: if err!=nil, defer, mayúscula export, goroutines seguras.",
    "rust": "Rust: Result<T,E>, ?, ownership, #[derive(Debug,Clone)], /// docs.",
    "sql": "SQL: mayúsculas keywords, sin SELECT*, JOINs explícitos.",
    "bash": "Bash: set -eu, entrecomillar variables, [[ ]], shebang.",
    "php": "PHP: tipos declarativos, try/catch, namespaces, PSR-4.",
    "html": "HTML: semántico, accesible, validado.",
    "css": "CSS: BEM o utility-first, responsive, variables CSS.",
    "kotlin": "Kotlin: data class, suspend fun, coroutineScope, ?.let, val por defecto.",
    "swift": "Swift: let/var, guard let, optional chaining, Codable, async/await.",
    "ruby": "Ruby: snake_case, do/end, begin/rescue, frozen_string_literal, symbols.",
    "scala": "Scala: case class, Option/Some/None, pattern matching, immutable por defecto.",
    "dart": "Dart: var/final/const, null safety, async/await, Future, Stream.",
    "lua": "Lua: local siempre, functions first-class, pcall para errores, ipairs/pairs.",
    "perl": "Perl: use strict, use warnings, my, scalar/array/hash context.",
    "r": "R: <- para asignación, vectorized ops, dplyr pipes, NA handling.",
    "haskell": "Haskell: type signatures, pattern matching, Monad do-notation, fmap/>>=.",
    "elixir": "Elixir: |>, defmodule, def/defp, {:ok, val}/{:error, reason}, GenServer.",
    "clojure": "Clojure: (defn), immutabilidad, map/reduce/filter, (:key map), let.",
    "groovy": "Groovy: def, closures {}, GStrings, null-safe ?., @CompileStatic.",
    "powershell": "PowerShell: $vars, cmdlets Verb-Noun, pipeline $_, try/catch, [Parameter()].",
    "vue": "Vue: <template>/<script setup>, ref/reactive, computed, v-for :key.",
    "svelte": "Svelte: $: reactive, export let props, {#each}, stores writable.",
    "angular": "Angular: @Component decorator, services injectables, RxJS observables, ngOnInit.",
    "solidity": "Solidity: pragma solidity, contract, mapping, require, modifier, events.",
    "xml": "XML: namespaces declarados, atributos entrecomillados, well-formed.",
    "toml": "TOML: secciones [table], key = 'value', arrays, inline tables.",
    "ini": "INI: [sección], key=value, comentarios con ;",
    "graphql": "GraphQL: type Query/Mutation, inputs, resolvers, schema-first.",
    "protobuf": "Protobuf: syntax = 'proto3', message, repeated, reserved, enum.",
    "makefile": "Makefile: tabs no espacios, .PHONY, $@/$<, variables = y :=.",
    "cmake": "CMake: cmake_minimum_required, project(), add_executable, target_link_libraries.",
    "nginx": "Nginx: server { location }, proxy_pass, try_files, upstream.",
    "apache": "Apache: <VirtualHost>, RewriteEngine, Directory, AllowOverride.",
    "diff": "Diff: + añadido, - eliminado, @@ hunks, contexto.",
    "log": "Log: timestamps ISO8601, severity levels, structured JSON.",
}

import re as _re

MC_PLUGIN_KNOWLEDGE = """Conocimiento sobre plugins de Minecraft (Spigot/Paper/Bukkit):
- Paper API: io.papermc.paper:paper-api, repo https://repo.papermc.io/repository/maven-public/
- Clase principal: extends JavaPlugin, implements Listener para eventos, @EventHandler en métodos
- Registrar eventos: Bukkit.getPluginManager().registerEvents(this, this) en onEnable()
- plugin.yml: name, version, main (ruta completa), api-version, commands, permissions, depend, softdepend
- Eventos comunes: PlayerJoinEvent, PlayerQuitEvent, PlayerInteractEvent, BlockBreakEvent, EntityDamageEvent, AsyncPlayerChatEvent
- Comandos: implementar CommandExecutor o usar Brigadier API (Paper), registrar en plugin.yml
- Component API (Paper): net.kyori.adventure.text.Component, Component.text("msg"), event.getPlayer().sendMessage(Component.text(...))
- Scheduler: Bukkit.getScheduler().runTaskLater(this, runnable, ticks), 20 ticks = 1 segundo
- PersistentDataContainer: para guardar datos entre reinicios
- Configuración: getConfig(), plugin.yml en resources/, config.yml
- Permisos: Bukkit.getPermission(), PermissionAttachment, permission nodes en plugin.yml
- Inventario: InventoryHolder, ItemStack, Material enum, inventarios custom con Inventory createInventory()
- Folia: usar RegionScheduler para multithreading, no Bukkit.getScheduler() directamente
- Gradle: compileOnly("io.papermc.paper:paper-api:VERSION") con maven repo papermc
- Maven: <dependency> groupId io.papermc.paper, artifactId paper-api, scope provided
- No usar NMS/craftbukkit directamente, usar Paper API. Si necesario, usar paperweight-userdev.
- Spigot vs Paper: Paper es fork de Spigot con mejor rendimiento y API adicional. Usar Paper API cuando sea posible."""

DISCORD_API_KNOWLEDGE = """Conocimiento sobre Discord API:
- discord.py (Python): bot = commands.Bot(command_prefix='!', intents=intents), @bot.command(), @bot.event, await ctx.send()
  - Intents: discord.Intents.default(), intents.message_content = True, intents.members = True
  - Cog: class MyCog(commands.Cog), await bot.add_cog(MyCog(bot))
  - Slash commands: @bot.tree.command(), await interaction.response.send_message()
- discord.js (Node.js): const { Client, GatewayIntentBits } = require('discord.js')
  - client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })
  - client.on('messageCreate', async msg => {}), client.on('interactionCreate', async i => {})
  - Slash: new SlashCommandBuilder().setName('cmd').setDescription('desc'), await interaction.reply()
  - Embeds: new EmbedBuilder().setTitle().setColor().addFields()
  - Buttons: new ButtonBuilder().setCustomId().setLabel().setStyle()
- JDA (Java): JDABuilder.createDefault(token), addEventListener, @Override onMessageReceived
- Rate limits: Discord impone rate limits, usar buckets, respetar X-RateLimit-Reset
- Permisos: Permission bits, Guild.getMember().hasPermission(), bot necesita intents y permisos
- Gateway: WebSocket connection, heartbeat, resume sessions, identify op 2
- REST API: base https://discord.com/api/v10, Authorization: Bot TOKEN, endpoints /channels/{id}/messages
- Webhooks: más ligeros que bots, POST a webhook URL con JSON payload"""

import re as _re

def get_system_prompt(user_message: str = "") -> str:
    """Return base prompt + language/domain-specific hints if detected."""
    msg_lower = user_message.lower()
    detected = []
    for lang in CODE_LANG_HINTS:
        if lang in msg_lower:
            detected.append(CODE_LANG_HINTS[lang])

    # Detect Minecraft plugin context
    mc_keywords = ["minecraft", "spigot", "papermc", "paper", "bukkit", "plugin", "servidor minecraft", "plugin.yml", "javaplugin", "bukkit.", "spigot."]
    has_mc = any(kw in msg_lower for kw in mc_keywords)

    # Detect Discord API context
    discord_keywords = ["discord", "bot discord", "discord.js", "discord.py", "jda", "slash command", "guild", "webhook discord"]
    has_discord = any(kw in msg_lower for kw in discord_keywords)

    # Also detect code blocks or common code keywords
    code_keywords = ["código", "codigo", "code", "función", "function", "programa", "script", "bug", "error", "clase", "class", "api"]
    has_code_intent = any(kw in msg_lower for kw in code_keywords) or "```" in user_message

    parts = []
    if detected or has_code_intent:
        parts.append(CODE_SYSTEM_PROMPT)
    if detected:
        parts.append(" ".join(detected))
    if has_mc:
        parts.append(MC_PLUGIN_KNOWLEDGE)
    if has_discord:
        parts.append(DISCORD_API_KNOWLEDGE)

    if parts:
        return "\n\n".join(parts)
    else:
        return "Eres un asistente IA útil. No saludes ni te presentes. Responde directamente al punto. Para preguntas simples sé conciso (1-3 líneas). Para preguntas complejas, piensa paso a paso y estructura la respuesta con headings y ejemplos."
