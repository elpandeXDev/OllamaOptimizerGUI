import { MessageSquare, Box, Gauge, Cpu, Plus, Trash2, ChevronRight, Zap, LogOut, User, Shield } from 'lucide-react'

export default function Sidebar({
  view, setView, VIEWS,
  connected, models, selectedModel, setSelectedModel,
  conversations, activeConvId, setActiveConvId,
  newConversation, deleteConversation, onClose,
  currentUser, onLogout,
}) {
  const navItems = [
    { id: VIEWS.chat, label: 'Chat', icon: MessageSquare, desc: 'Conversar con modelos' },
    { id: VIEWS.models, label: 'Modelos', icon: Box, desc: 'Gestionar modelos IA' },
  ]

  if (currentUser?.is_admin) {
    navItems.push(
      { id: VIEWS.optimize, label: 'Optimización', icon: Gauge, desc: 'Ajustar rendimiento' },
      { id: VIEWS.system, label: 'Sistema', icon: Cpu, desc: 'Hardware y recursos' },
    )
  }

  if (currentUser?.is_admin) {
    navItems.push({ id: VIEWS.admin, label: 'Admin', icon: Shield, desc: 'Gestionar usuarios' })
  }

  return (
    <aside className="w-80 flex flex-col border-r border-surface-300/30 bg-surface-50/80 backdrop-blur-xl flex-shrink-0 animate-slide-in">
      {/* Logo header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-surface-300/20">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-10 h-10 rounded-xl object-cover glow" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-gray-100 truncate">OllamaOptimizer</h2>
          <p className="text-[10px] text-gray-500 truncate">GUI v1.0</p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-surface-300/50 rounded-lg text-gray-500 hover:text-gray-300 transition">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="p-3 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                active
                  ? 'bg-gradient-to-r from-brand-600/20 to-brand-500/5 text-brand-300 border border-brand-500/20'
                  : 'text-gray-400 hover:bg-surface-200/50 hover:text-gray-200 border border-transparent'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition ${active ? 'bg-brand-500/20' : 'bg-surface-200/50 group-hover:bg-surface-300/50'}`}>
                <Icon size={16} className={active ? 'text-brand-300' : ''} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-[10px] text-gray-600">{item.desc}</div>
              </div>
            </button>
          )
        })}
      </nav>

      {/* Model selector */}
      <div className="px-3 pb-3">
        <label className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-1.5 block">Modelo activo</label>
        <div className="relative">
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            className="w-full bg-surface-200/80 border border-surface-400/30 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition appearance-none cursor-pointer"
          >
            {models.length === 0 && <option value="">Sin modelos</option>}
            {models.map(m => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-surface-300/20 space-y-2">
        <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] text-gray-600">
          <Zap size={12} className={connected ? 'text-green-400' : 'text-gray-700'} />
          <span>{connected ? 'Optimización activa' : 'Esperando conexión...'}</span>
        </div>
        {currentUser && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-surface-200/50">
            <div className="p-1.5 rounded-lg bg-brand-600/20">
              <User size={14} className="text-brand-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-200 truncate">{currentUser.username}</div>
              <div className="text-[10px] text-gray-600">Sesión iniciada</div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 hover:bg-red-500/10 rounded-lg text-gray-600 hover:text-red-400 transition"
              title="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
