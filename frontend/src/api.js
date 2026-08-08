const BASE_URL = import.meta.env.BASE_URL
const API_BASE = `${BASE_URL}api`

async function fetchJSON(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  health: () => fetchJSON('/health'),
  getSystem: () => fetchJSON('/system'),
  getOptimization: (params) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJSON(`/optimize?${qs}`)
  },
  postOptimization: (body) => fetchJSON('/optimize', { method: 'POST', body: JSON.stringify(body) }),
  listModels: () => fetchJSON('/models'),
  runningModels: () => fetchJSON('/models/running'),
  modelInfo: (name) => fetchJSON(`/models/${encodeURIComponent(name)}`),
  deleteModel: (name) => fetchJSON(`/models/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  loadModel: (name, keepAlive) => fetchJSON(`/models/${encodeURIComponent(name)}/load`, {
    method: 'POST', body: JSON.stringify({ keep_alive: keepAlive }),
  }),
  unloadModel: (name) => fetchJSON(`/models/${encodeURIComponent(name)}/unload`, { method: 'POST' }),

  chatStream: async function* (body) {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            yield JSON.parse(line.slice(6))
          } catch { /* skip incomplete */ }
        }
      }
    }
  },

  pullModelStream: async function* (name) {
    const res = await fetch(`${API_BASE}/models/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            yield JSON.parse(line.slice(6))
          } catch { /* skip */ }
        }
      }
    }
  },
}
