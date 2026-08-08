import { useState, useEffect, useCallback } from 'react'
import { UserPlus, Trash2, Shield, User as UserIcon, X, Crown } from 'lucide-react'
import { api } from '../api.js'

export default function AdminPanel({ onClose, currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newIsAdmin, setNewIsAdmin] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.adminListUsers()
      setUsers(data.users || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      await api.adminCreateUser(newUsername, newPassword, newIsAdmin)
      setNewUsername('')
      setNewPassword('')
      setNewIsAdmin(false)
      setShowForm(false)
      await loadUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (userId, username) => {
    if (!confirm(`¿Eliminar el usuario "${username}"? Se borrarán todas sus conversaciones.`)) return
    try {
      await api.adminDeleteUser(userId)
      await loadUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  const formatDate = (ts) => {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-300/20 bg-surface-50/30">
        <div className="p-2 rounded-xl bg-brand-600/20">
          <Shield size={18} className="text-brand-300" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-gray-100">Panel de administración</h2>
          <p className="text-[10px] text-gray-500">Gestionar usuarios del sistema</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-surface-300/50 rounded-xl text-gray-500 hover:text-gray-300 transition"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-3xl mx-auto space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Create user button / form */}
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-brand-600/80 to-brand-500/80 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-medium transition-all shadow-lg shadow-brand-600/10 active:scale-[0.98]"
            >
              <UserPlus size={16} /> Crear nuevo usuario
            </button>
          ) : (
            <form onSubmit={handleCreate} className="glass rounded-2xl p-5 border border-surface-300/30 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-200">Nuevo usuario</h3>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError('') }}
                  className="p-1.5 hover:bg-surface-300/50 rounded-lg text-gray-500 hover:text-gray-300 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Usuario</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Nombre de usuario"
                  required
                  minLength={2}
                  autoFocus
                  className="w-full bg-surface-200/80 border border-surface-400/30 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  required
                  minLength={4}
                  className="w-full bg-surface-200/80 border border-surface-400/30 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsAdmin}
                  onChange={(e) => setNewIsAdmin(e.target.checked)}
                  className="w-4 h-4 rounded accent-brand-500"
                />
                <span className="text-sm text-gray-300 flex items-center gap-1.5">
                  <Shield size={13} className="text-brand-400" />
                  Administrador (puede gestionar usuarios)
                </span>
              </label>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-medium text-sm hover:from-brand-500 hover:to-brand-400 transition-all shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creando...' : 'Crear usuario'}
              </button>
            </form>
          )}

          {/* Users list */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold px-1">
              Usuarios ({users.length})
            </div>

            {loading ? (
              <div className="text-center py-8 text-sm text-gray-500">Cargando usuarios...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-600">No hay usuarios</div>
            ) : (
              users.map(user => (
                <div
                  key={user.id}
                  className="glass rounded-xl px-4 py-3 border border-surface-300/20 flex items-center gap-3 group hover:border-surface-300/40 transition"
                >
                  <div className={`p-2 rounded-lg ${user.is_owner ? 'bg-yellow-500/15' : user.is_admin ? 'bg-brand-600/20' : 'bg-surface-200/50'}`}>
                    {user.is_owner ? (
                      <Crown size={15} className="text-yellow-400" />
                    ) : user.is_admin ? (
                      <Shield size={15} className="text-brand-300" />
                    ) : (
                      <UserIcon size={15} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200 truncate">{user.username}</span>
                      {user.is_owner && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 font-medium">
                          Owner
                        </span>
                      )}
                      {user.is_admin && !user.is_owner && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/20 font-medium">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      Creado: {formatDate(user.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(user.id, user.username)}
                    disabled={user.is_owner}
                    className={`p-2 rounded-lg transition ${
                      user.is_owner
                        ? 'opacity-30 cursor-not-allowed text-gray-700'
                        : user.is_admin && !currentUser?.is_owner
                        ? 'opacity-30 cursor-not-allowed text-gray-700'
                        : 'opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-gray-600 hover:text-red-400'
                    }`}
                    title={
                      user.is_owner
                        ? 'No se puede eliminar al owner'
                        : user.is_admin && !currentUser?.is_owner
                        ? 'Solo el owner puede eliminar administradores'
                        : 'Eliminar usuario'
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
