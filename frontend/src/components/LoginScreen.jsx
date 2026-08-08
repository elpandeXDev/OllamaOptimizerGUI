import React, { useState } from 'react'
import { api, setToken, setUser } from '../api'

export default function LoginScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = mode === 'login' ? api.login : api.register
      const result = await fn(username, password)
      setToken(result.token)
      setUser(result.user)
      onAuth(result.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 via-surface-100 to-surface-200 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="glass rounded-3xl p-8 border border-surface-300/30 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="OllamaOptimizerGUI"
              className="w-20 h-20 rounded-2xl object-cover glow mb-4"
            />
            <h1 className="text-2xl font-bold gradient-text">OllamaOptimizerGUI</h1>
            <p className="text-sm text-gray-500 mt-1">Panel de optimización IA</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-surface-200/50 rounded-xl mb-6">
            <button
              onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'login'
                  ? 'bg-brand-600/30 text-brand-300 border border-brand-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => { setMode('register'); setError('') }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'register'
                  ? 'bg-brand-600/30 text-brand-300 border border-brand-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Registrarse
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu nombre de usuario"
                autoFocus
                required
                minLength={2}
                className="w-full bg-surface-200/80 border border-surface-400/30 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={4}
                className="w-full bg-surface-200/80 border border-surface-400/30 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-medium text-sm hover:from-brand-500 hover:to-brand-400 transition-all shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-6">
            {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              className="text-brand-400 hover:text-brand-300 font-medium transition"
            >
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
