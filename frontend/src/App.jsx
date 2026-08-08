import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Plus, Trash2, ChevronLeft } from 'lucide-react'
import { api, isAuthenticated, getUser, clearAuth } from './api.js'
import LoginScreen from './components/LoginScreen.jsx'
import Sidebar from './components/Sidebar.jsx'
import ChatView from './components/ChatView.jsx'
import ModelManager from './components/ModelManager.jsx'
import OptimizationPanel from './components/OptimizationPanel.jsx'
import SystemInfo from './components/SystemInfo.jsx'
import AdminPanel from './components/AdminPanel.jsx'

const VIEWS = {
  chat: 'chat',
  models: 'models',
  optimize: 'optimize',
  system: 'system',
  admin: 'admin',
}

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated())
  const [currentUser, setCurrentUser] = useState(getUser())
  const [view, setView] = useState(VIEWS.chat)
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [connected, setConnected] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [activeConvMessages, setActiveConvMessages] = useState([])
  const [qualityMode, setQualityMode] = useState(() => localStorage.getItem('oog_quality_mode') || 'balanced')
  const [useOptimization, setUseOptimization] = useState(() => localStorage.getItem('oog_use_optimization') !== 'false')
  const [optModelSize, setOptModelSize] = useState(() => parseFloat(localStorage.getItem('oog_opt_model_size') || '4.7'))
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(true)
  const pollRef = useRef(null)

  const saveOptimizationSettings = useCallback(() => {
    localStorage.setItem('oog_quality_mode', qualityMode)
    localStorage.setItem('oog_use_optimization', String(useOptimization))
    localStorage.setItem('oog_opt_model_size', String(optModelSize))
  }, [qualityMode, useOptimization, optModelSize])

  const handleLogout = () => {
    clearAuth()
    setAuthed(false)
    setCurrentUser(null)
    setConversations([])
    setActiveConvId(null)
  }

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.listConversations()
      setConversations(data.conversations || [])
    } catch {
      setConversations([])
    }
  }, [])

  const refreshModels = useCallback(async () => {
    try {
      const data = await api.listModels()
      setModels(data.models || [])
      setConnected(true)
      if (!selectedModel && (data.models || []).length > 0) {
        setSelectedModel(data.models[0].name)
      }
    } catch {
      setConnected(false)
    }
  }, [selectedModel])

  useEffect(() => {
    if (!authed) return
    loadConversations()
    const poll = async () => {
      try {
        const h = await api.health()
        setConnected(h.ollama === 'connected')
        if (h.ollama === 'connected') await refreshModels()
      } catch {
        setConnected(false)
      }
    }
    poll()
    pollRef.current = setInterval(poll, 10000)
    return () => clearInterval(pollRef.current)
  }, [authed, refreshModels, loadConversations])

  const newConversation = async () => {
    try {
      const conv = await api.createConversation('Nueva conversación', selectedModel)
      setConversations([conv, ...conversations])
      setActiveConvId(conv.id)
      setActiveConvMessages([])
      setView(VIEWS.chat)
    } catch (err) {
      console.error('Failed to create conversation:', err)
    }
  }

  const deleteConversation = async (id) => {
    try {
      await api.deleteConversation(id)
      setConversations(conversations.filter(c => c.id !== id))
      if (activeConvId === id) {
        setActiveConvId(null)
        setActiveConvMessages([])
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
    }
  }

  const selectConversation = async (id) => {
    try {
      const data = await api.getConversation(id)
      setActiveConvId(id)
      setActiveConvMessages(data.messages || [])
      if (data.conversation?.model) setSelectedModel(data.conversation.model)
      setView(VIEWS.chat)
    } catch (err) {
      console.error('Failed to load conversation:', err)
    }
  }

  const activeConv = conversations.find(c => c.id === activeConvId)

  const updateActiveMessages = (updater) => {
    setActiveConvMessages(prev => updater(prev))
  }

  const saveMessage = async (convId, role, content, timingJson) => {
    try {
      return await api.addMessage(convId, role, content, timingJson)
    } catch (err) {
      console.error('Failed to save message:', err)
    }
  }

  const updateConvTitle = async (id, title) => {
    try {
      await api.updateConversation(id, { title })
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
    } catch (err) {
      console.error('Failed to update title:', err)
    }
  }

  if (!authed) {
    return <LoginScreen onAuth={(user) => { setAuthed(true); setCurrentUser(user) }} />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      {sidebarOpen && (
        <Sidebar
          view={view}
          setView={setView}
          VIEWS={VIEWS}
          connected={connected}
          models={models}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          conversations={conversations}
          activeConvId={activeConvId}
          setActiveConvId={selectConversation}
          newConversation={newConversation}
          deleteConversation={deleteConversation}
          onClose={() => setSidebarOpen(false)}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar — glassmorphism */}
        <header className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-300/30 glass">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-surface-300/50 rounded-xl transition text-gray-400 hover:text-gray-200">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="OllamaOptimizerGUI" className="w-9 h-9 rounded-xl object-cover glow" />
            <div>
              <h1 className="text-base font-bold text-gray-100 leading-tight">OllamaOptimizerGUI</h1>
              <p className="text-[10px] text-gray-500 leading-tight">Panel de optimización IA</p>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            {/* History toggle */}
            {view === VIEWS.chat && (
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className={`p-2 rounded-xl transition text-gray-400 hover:text-gray-200 hover:bg-surface-300/50 ${historyOpen ? 'bg-surface-200/50' : ''}`}
                title="Historial de chats"
              >
                <MessageSquare size={18} />
              </button>
            )}
            {/* Status pill */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              connected
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              <span className={`relative flex h-2 w-2`}>
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              </span>
              {connected ? 'Conectado' : 'Desconectado'}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          {view === VIEWS.chat && (
            <ChatView
              models={models}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              activeConv={activeConv}
              activeConvMessages={activeConvMessages}
              updateActiveMessages={updateActiveMessages}
              saveMessage={saveMessage}
              updateConvTitle={updateConvTitle}
              newConversation={newConversation}
              qualityMode={qualityMode}
              setQualityMode={setQualityMode}
              useOptimization={useOptimization}
              setUseOptimization={setUseOptimization}
            />
          )}
          {view === VIEWS.models && <ModelManager models={models} refreshModels={refreshModels} />}
          {view === VIEWS.optimize && <OptimizationPanel qualityMode={qualityMode} setQualityMode={setQualityMode} optModelSize={optModelSize} setOptModelSize={setOptModelSize} onSaveSettings={saveOptimizationSettings} />}
          {view === VIEWS.system && <SystemInfo />}
          {view === VIEWS.admin && <AdminPanel onClose={() => setView(VIEWS.chat)} currentUser={currentUser} />}
        </main>
      </div>

      {/* Right-side chat history panel */}
      {historyOpen && view === VIEWS.chat && (
        <aside className="w-72 flex flex-col border-l border-surface-300/30 bg-surface-50/80 backdrop-blur-xl flex-shrink-0 animate-slide-in">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-300/20">
            <h3 className="text-sm font-bold text-gray-200">Historial</h3>
            <button onClick={() => setHistoryOpen(false)} className="p-1.5 hover:bg-surface-300/50 rounded-lg text-gray-500 hover:text-gray-300 transition">
              <ChevronLeft size={16} />
            </button>
          </div>
          <div className="p-3">
            <button
              onClick={newConversation}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-brand-600/80 to-brand-500/80 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-brand-600/10 active:scale-[0.97]"
            >
              <Plus size={16} /> Nueva conversación
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
            {conversations.length === 0 && (
              <p className="text-sm text-gray-600 px-3 py-6 text-center">Sin conversaciones aún</p>
            )}
            {conversations.map(conv => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                  activeConvId === conv.id
                    ? 'bg-brand-600/15 text-gray-100 border border-brand-500/20'
                    : 'text-gray-400 hover:bg-surface-200/50 hover:text-gray-200 border border-transparent'
                }`}
                onClick={() => selectConversation(conv.id)}
              >
                <MessageSquare size={16} className={`flex-shrink-0 ${activeConvId === conv.id ? 'text-brand-400' : 'opacity-50'}`} />
                <span className="flex-1 truncate text-sm font-medium">{conv.title}</span>
                <button
                  onClick={e => { e.stopPropagation(); deleteConversation(conv.id) }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  )
}
