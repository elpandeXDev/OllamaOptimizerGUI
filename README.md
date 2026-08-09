# OllamaOptimizerGUI

Un panel web tipo Open WebUI para Ollama con **optimización automática de rendimiento**.
Ajusta los parámetros del modelo según tu hardware (SSD/HDD, RAM, CPU, GPU) para
maximizar la velocidad y fluidez de las respuestas — sin atascos ni rayadas.

## Características

- **Chat con streaming** en tiempo real, con renderizado Markdown
- **Optimización automática** — detecta tu hardware y ajusta parámetros de Ollama:
  - Detección de almacenamiento **SSD vs HDD** con parámetros diferenciados
  - Ajuste de `num_ctx`, `num_batch`, `num_thread`, `num_gpu`, `keep_alive`
  - Activación inteligente de `mmap`, `mlock`, `f16_kv` según recursos
- **3 modos de optimización**: Velocidad, Equilibrado, Calidad
- **Gestión de modelos**: descargar, cargar/descargar de memoria, eliminar
- **Panel de sistema**: monitor de CPU, RAM, almacenamiento y GPU en vivo
- **Métricas de rendimiento**: tokens/segundo, TTFT (time to first token)
- **Conversaciones persistentes** guardadas en el navegador
- **100% Docker** — despliegue con un solo comando
- **Listo para producción**: Caddy con SSL automático (Let's Encrypt), múltiples workers, API key, rate limiting, security headers

## Despliegue rápido (local / desarrollo)

```bash
git clone https://github.com/TU_USUARIO/OllamaOptimizerGUI.git
cd OllamaOptimizerGUI
docker compose -f docker-compose.dev.yml up -d --build
```

Abre **http://localhost:8080** en tu navegador.

> Ollama se ejecuta automáticamente en el contenedor `ollama-server`.
> Descarga modelos desde la pestaña "Modelos" en la interfaz.

## Despliegue en servidor (producción con SSL)

### 1. Preparar el servidor

Requisitos en el servidor:
- Docker + Docker Compose
- Un dominio apuntando al servidor (registros A/AAAA)
- Puertos 80 y 443 abiertos en el firewall

```bash
# En el servidor:
git clone https://github.com/TU_USUARIO/OllamaOptimizerGUI.git
cd OllamaOptimizerGUI

# Copiar configuración y editar
cp .env.example .env
nano .env
```

### 2. Configurar `.env`

```env
# Tu dominio real (Caddy auto-provisiona SSL con Let's Encrypt)
OOG_DOMAIN=oog.tudominio.com

# API key para proteger el acceso (recomendado)
OOG_API_KEY=tu-clave-secreta-aqui

# CORS — tu dominio con https
OOG_CORS_ORIGINS=https://oog.tudominio.com

# Workers según CPUs del servidor
OOG_WORKERS=4

# Rate limit (opcional, 60 req/min por IP)
OOG_RATE_LIMIT=60
```

### 3. Iniciar

```bash
docker compose up -d --build
```

Caddy obtendrá automáticamente el certificado SSL de Let's Encrypt y la aplicación
estará disponible en **https://oog.tudominio.com**

### Con GPU (NVIDIA)

Descomenta las líneas `deploy.resources` en `docker-compose.yml` y asegúrate de tener
[nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) instalado.

### Detrás de un reverse proxy existente (nginx, Traefik, Cloudflare)

Si ya tienes un reverse proxy que maneja SSL, usa el compose de desarrollo:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Y configura tu reverse proxy para pasar tráfico al puerto `8080`.

### Actualizar a nueva versión

```bash
git pull
docker compose up -d --build
```

### Ver logs

```bash
# Todos los servicios
docker compose logs -f

# Solo la app
docker compose logs -f oog

# Solo Caddy (SSL/acceso)
docker compose logs -f caddy
```

### Backup de modelos

Los modelos de Ollama se guardan en un volumen Docker. Para hacer backup:

```bash
# Ver nombre del volumen
docker volume ls | grep ollama

# Backup a tar.gz
docker run --rm -v ollama-models:/data -v $(pwd):/backup alpine \
  tar czf /backup/ollama-models-backup.tar.gz -C /data .
```

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `OOG_DOMAIN` | `localhost` | Dominio para SSL automático |
| `OOG_API_KEY` | (vacío) | API key para proteger acceso |
| `OOG_CORS_ORIGINS` | `*` | Orígenes CORS permitidos (coma-separado) |
| `OOG_RATE_LIMIT` | `0` | Max requests/min por IP (0 = desactivado) |
| `OOG_WORKERS` | `4` | Workers de Gunicorn |
| `OOG_LOG_LEVEL` | `info` | Nivel de log (debug/info/warning/error) |
| `OLLAMA_HOST` | `http://ollama:11434` | URL de Ollama |

## Uso sin Docker (desarrollo)

### Backend (Python 3.12+)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend (Node 20+)

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173**

## Cómo funciona la optimización

El motor de optimización analiza:

| Parámetro | SSD | HDD |
|-----------|-----|-----|
| `num_batch` | 512 (acceso aleatorio rápido) | 256 (reduce I/O stalls) |
| `keep_alive` | 10m (mantener en memoria) | 5m (liberar más rápido) |
| `use_mlock` | Sí (si RAM suficiente) | No (evitar presión de memoria) |
| `use_mmap` | Sí | Sí |

Además ajusta dinámicamente:
- **`num_gpu`**: offload total si hay GPU, parcial si VRAM es limitada
- **`num_thread`**: optimizado al número de cores físicos
- **`num_ctx`**: reducido si RAM < 8GB, ampliado en modo calidad
- **`f16_kv`**: desactivado en modo velocidad para ahorrar memoria

## Estructura del proyecto

```
OllamaOptimizerGUI/
├── backend/
│   ├── app/
│   │   ├── config.py          # Configuración (env vars, seguridad)
│   │   ├── ollama_client.py   # Cliente Ollama API
│   │   ├── optimizer.py       # Motor de optimización
│   │   └── main.py            # Servidor FastAPI (auth, rate limit)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── ChatView.jsx
│   │   │   ├── Message.jsx
│   │   │   ├── ModelManager.jsx
│   │   │   ├── OptimizationPanel.jsx
│   │   │   └── SystemInfo.jsx
│   │   ├── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── Caddyfile                    # Reverse proxy + SSL automático
├── Dockerfile                   # Multi-stage (frontend build + backend)
├── docker-compose.yml           # Producción (Caddy + Ollama + App)
├── docker-compose.dev.yml       # Desarrollo (sin SSL, puerto 8080)
├── .env.example                 # Template de configuración
└── README.md
```

## Creditos ELP STUDIOS x elpandeXDev
