const BASE_URL = import.meta.env.BASE_URL
const API_BASE = `${BASE_URL}api`

// ─── Token management ──────────────────────────────────────────────────────────

const TOKEN_KEY = 'oog_token'
const USER_KEY = 'oog_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function isAuthenticated() {
  return !!getToken()
}

function authHeaders() {
  const token = getToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchJSON(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── API ───────────────────────────────────────────────────────────────────────

export const api = {
  // Auth
  register: (username, password) => fetchJSON('/auth/register', {
    method: 'POST', body: JSON.stringify({ username, password }),
  }),
  login: (username, password) => fetchJSON('/auth/login', {
    method: 'POST', body: JSON.stringify({ username, password }),
  }),
  me: () => fetchJSON('/auth/me'),

  // Admin
  adminListUsers: () => fetchJSON('/admin/users'),
  adminCreateUser: (username, password, isAdmin) => fetchJSON('/admin/users', {
    method: 'POST', body: JSON.stringify({ username, password, is_admin: isAdmin }),
  }),
  adminDeleteUser: (userId) => fetchJSON(`/admin/users/${userId}`, { method: 'DELETE' }),

  // Conversations
  listConversations: () => fetchJSON('/conversations'),
  createConversation: (title, model) => fetchJSON('/conversations', {
    method: 'POST', body: JSON.stringify({ title, model }),
  }),
  getConversation: (id) => fetchJSON(`/conversations/${id}`),
  updateConversation: (id, data) => fetchJSON(`/conversations/${id}`, {
    method: 'PATCH', body: JSON.stringify(data),
  }),
  deleteConversation: (id) => fetchJSON(`/conversations/${id}`, { method: 'DELETE' }),
  addMessage: (convId, role, content, timingJson) => fetchJSON(`/conversations/${convId}/messages`, {
    method: 'POST', body: JSON.stringify({ role, content, timing_json: timingJson }),
  }),

  // Health & system
  health: () => fetchJSON('/health'),
  getSystem: () => fetchJSON('/system'),
  getOptimization: (params) => {
    const qs = new URLSearchParams(params).toString()
    return fetchJSON(`/optimize?${qs}`)
  },
  postOptimization: (body) => fetchJSON('/optimize', { method: 'POST', body: JSON.stringify(body) }),

  // Models
  listModels: () => fetchJSON('/models'),
  runningModels: () => fetchJSON('/models/running'),
  modelInfo: (name) => fetchJSON(`/models/${encodeURIComponent(name)}`),
  deleteModel: (name) => fetchJSON(`/models/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  loadModel: (name, keepAlive) => fetchJSON(`/models/${encodeURIComponent(name)}/load`, {
    method: 'POST', body: JSON.stringify({ keep_alive: keepAlive }),
  }),
  unloadModel: (name) => fetchJSON(`/models/${encodeURIComponent(name)}/unload`, { method: 'POST' }),

  // Chat streaming
  chatStream: async function* (body) {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
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

  // Model pull streaming
  pullModelStream: async function* (name) {
    const res = await fetch(`${API_BASE}/models/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
