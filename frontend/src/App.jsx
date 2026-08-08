import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from './api.js'
import Sidebar from './components/Sidebar.jsx'
import ChatView from './components/ChatView.jsx'
import ModelManager from './components/ModelManager.jsx'
import OptimizationPanel from './components/OptimizationPanel.jsx'
import SystemInfo from './components/SystemInfo.jsx'

const VIEWS = {
  chat: 'chat',
  models: 'models',
  optimize: 'optimize',
  system: 'system',
}

export default function App() {
  const [view, setView] = useState(VIEWS.chat)
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [connected, setConnected] = useState(false)
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem('oog_conversations')
    return saved ? JSON.parse(saved) : []
  })
  const [activeConvId, setActiveConvId] = useState(null)
  const [qualityMode, setQualityMode] = useState('balanced')
  const [useOptimization, setUseOptimization] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pollRef = useRef(null)

  // Save conversations
  useEffect(() => {
    localStorage.setItem('oog_conversations', JSON.stringify(conversations))
  }, [conversations])

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

  // Poll health
  useEffect(() => {
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
  }, [refreshModels])

  const newConversation = () => {
    const conv = {
      id: Date.now().toString(),
      title: 'Nueva conversación',
      messages: [],
      model: selectedModel,
      createdAt: Date.now(),
    }
    setConversations([conv, ...conversations])
    setActiveConvId(conv.id)
  }

  const deleteConversation = (id) => {
    setConversations(conversations.filter(c => c.id !== id))
    if (activeConvId === id) setActiveConvId(null)
  }

  const updateConversation = (id, updater) => {
    setConversations(prev => prev.map(c => c.id === id ? updater(c) : c))
  }

  const activeConv = conversations.find(c => c.id === activeConvId)

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
          setActiveConvId={setActiveConvId}
          newConversation={newConversation}
          deleteConversation={deleteConversation}
          onClose={() => setSidebarOpen(false)}
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
            <img src="/logo.png" alt="OllamaOptimizerGUI" className="w-9 h-9 rounded-xl object-cover glow" />
            <div>
              <h1 className="text-base font-bold text-gray-100 leading-tight">OllamaOptimizerGUI</h1>
              <p className="text-[10px] text-gray-500 leading-tight">Panel de optimización IA</p>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
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
              updateConversation={updateConversation}
              newConversation={newConversation}
              qualityMode={qualityMode}
              setQualityMode={setQualityMode}
              useOptimization={useOptimization}
              setUseOptimization={setUseOptimization}
            />
          )}
          {view === VIEWS.models && <ModelManager models={models} refreshModels={refreshModels} />}
          {view === VIEWS.optimize && <OptimizationPanel qualityMode={qualityMode} setQualityMode={setQualityMode} />}
          {view === VIEWS.system && <SystemInfo />}
        </main>
      </div>
    </div>
  )
}
