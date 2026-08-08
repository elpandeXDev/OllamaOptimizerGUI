import { MessageSquare, Box, Gauge, Cpu, Plus, Trash2, ChevronRight, Zap } from 'lucide-react'

export default function Sidebar({
  view, setView, VIEWS,
  connected, models, selectedModel, setSelectedModel,
  conversations, activeConvId, setActiveConvId,
  newConversation, deleteConversation, onClose,
}) {
  const navItems = [
    { id: VIEWS.chat, label: 'Chat', icon: MessageSquare, desc: 'Conversar con modelos' },
    { id: VIEWS.models, label: 'Modelos', icon: Box, desc: 'Gestionar modelos IA' },
    { id: VIEWS.optimize, label: 'Optimización', icon: Gauge, desc: 'Ajustar rendimiento' },
    { id: VIEWS.system, label: 'Sistema', icon: Cpu, desc: 'Hardware y recursos' },
  ]

  return (
    <aside className="w-72 flex flex-col border-r border-surface-300/30 bg-surface-50/80 backdrop-blur-xl flex-shrink-0 animate-slide-in">
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

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-3">
        <button
          onClick={newConversation}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 mb-3 rounded-xl bg-gradient-to-r from-brand-600/80 to-brand-500/80 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-brand-600/10 active:scale-[0.97]"
        >
          <Plus size={16} /> Nueva conversación
        </button>

        <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-2 px-1">Historial</div>
        <div className="space-y-0.5">
          {conversations.length === 0 && (
            <p className="text-xs text-gray-600 px-3 py-4 text-center">Sin conversaciones aún</p>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
                activeConvId === conv.id
                  ? 'bg-surface-200/80 text-gray-100'
                  : 'text-gray-500 hover:bg-surface-200/40 hover:text-gray-300'
              }`}
              onClick={() => { setActiveConvId(conv.id); setView(VIEWS.chat) }}
            >
              <MessageSquare size={13} className="flex-shrink-0 opacity-50" />
              <span className="flex-1 truncate text-xs">{conv.title}</span>
              <button
                onClick={e => { e.stopPropagation(); deleteConversation(conv.id) }}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-surface-300/20">
        <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] text-gray-600">
          <Zap size={12} className={connected ? 'text-green-400' : 'text-gray-700'} />
          <span>{connected ? 'Optimización activa' : 'Esperando conexión...'}</span>
        </div>
      </div>
    </aside>
  )
}
