import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Zap, Gauge, Sparkles } from 'lucide-react'
import { api } from '../api.js'
import Message from './Message.jsx'

export default function ChatView({
  models, selectedModel, setSelectedModel,
  activeConv, activeConvMessages, updateActiveMessages, saveMessage, updateConvTitle,
  newConversation,
  qualityMode, setQualityMode, useOptimization, setUseOptimization,
}) {
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  const messages = activeConvMessages || []

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(scrollToBottom, [messages])

  const handleSend = useCallback(async () => {
    if (!input.trim() || streaming || !selectedModel) return

    const displayInput = input.trim()
    const userMsg = { role: 'user', content: displayInput }
    setInput('')
    setError('')
    setStreaming(true)

    let convId = activeConv?.id

    if (!convId) {
      try {
        const conv = await api.createConversation(displayInput.slice(0, 40), selectedModel)
        convId = conv.id
        updateActiveMessages(() => [userMsg])
      } catch (err) {
        setError('No se pudo crear la conversación: ' + err.message)
        setStreaming(false)
        return
      }
    } else {
      updateActiveMessages(prev => [...prev, userMsg])
    }

    await saveMessage(convId, 'user', displayInput)

    if (activeConv && activeConv.title === 'Nueva conversación') {
      updateConvTitle(convId, displayInput.slice(0, 40))
    }

    const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    const assistantMsg = { role: 'assistant', content: '', timing: null }
    updateActiveMessages(prev => [...prev, assistantMsg])

    try {
      let fullContent = ''
      let timing = null

      for await (const chunk of api.chatStream({
        model: selectedModel,
        messages: apiMessages,
        use_optimization: useOptimization,
        quality_mode: qualityMode,
      })) {
        if (chunk.error) {
          setError(chunk.error)
          break
        }
        if (chunk.message?.content) {
          fullContent += chunk.message.content
          updateActiveMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent }
            return updated
          })
        }
        if (chunk.done && chunk.timing) {
          timing = chunk.timing
        }
      }

      updateActiveMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent, timing }
        return updated
      })

      await saveMessage(convId, 'assistant', fullContent, timing ? JSON.stringify(timing) : null)
    } catch (e) {
      setError(e.message)
      updateActiveMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: `Error: ${e.message}` }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }, [input, streaming, selectedModel, activeConv, activeConvMessages, updateActiveMessages, saveMessage, updateConvTitle, useOptimization, qualityMode, messages])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  if (models.length === 0) {
    return (
      <div className="flex items-center justify-center h-full animate-fade-in">
        <div className="text-center max-w-md px-6">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="OllamaOptimizerGUI" className="w-20 h-20 rounded-2xl object-cover mx-auto mb-6 glow" />
          <h2 className="text-2xl font-bold text-gray-200 mb-3">Sin modelos disponibles</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Asegúrate de que Ollama esté en ejecución y descarga un modelo
            desde la pestaña <span className="text-brand-400 font-medium">"Modelos"</span>.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200/50 border border-surface-300/30 text-xs text-gray-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Esperando conexión con Ollama...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat controls bar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-surface-300/20 bg-surface-50/30">
        {/* Model selector */}
        <div className="relative">
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            className="bg-surface-200/80 border border-surface-400/30 rounded-lg pl-3 pr-8 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition appearance-none cursor-pointer"
          >
            {models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>

        <div className="flex-1" />

        {/* Optimization toggle */}
        <button
          onClick={() => setUseOptimization(!useOptimization)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            useOptimization
              ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20 glow'
              : 'bg-surface-200/50 text-gray-500 hover:text-gray-300 border border-surface-300/30'
          }`}
          title="Activar/desactivar optimización automática"
        >
          <Zap size={13} className={useOptimization ? 'text-brand-400' : ''} />
          Optimización
        </button>

        {/* Quality mode */}
        <div className="relative">
          <select
            value={qualityMode}
            onChange={e => setQualityMode(e.target.value)}
            className="bg-surface-200/80 border border-surface-400/30 rounded-lg pl-3 pr-8 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition appearance-none cursor-pointer"
            title="Modo de calidad/velocidad"
          >
            <option value="speed">⚡ Velocidad</option>
            <option value="balanced">⚖️ Equilibrado</option>
            <option value="quality">✨ Calidad</option>
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-24 animate-fade-in">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="OllamaOptimizerGUI" className="w-24 h-24 rounded-3xl object-cover mx-auto mb-6 glow-strong" />
              <h2 className="text-2xl font-bold gradient-text mb-3">Optimiza y chatea</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
                OllamaOptimizerGUI ajusta automáticamente los parámetros del modelo según tu hardware
                <span className="text-gray-400"> (SSD/HDD, RAM, CPU, GPU)</span> para máxima velocidad y fluidez.
              </p>
              <div className="flex items-center justify-center gap-2 mt-8">
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${useOptimization ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20' : 'bg-surface-200/50 text-gray-500 border border-surface-300/30'}`}>
                  <Zap size={11} className="inline mr-1" />
                  {useOptimization ? 'Optimización activa' : 'Optimización desactivada'}
                </div>
                <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-200/50 text-gray-400 border border-surface-300/30">
                  Modo {qualityMode === 'speed' ? 'velocidad' : qualityMode === 'balanced' ? 'equilibrado' : 'calidad'}
                </div>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <Message
              key={i}
              message={msg}
              isStreaming={streaming && i === messages.length - 1 && msg.role === 'assistant'}
            />
          ))}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm animate-slide-up">
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-surface-300/20 bg-surface-50/40 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2.5">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje...  (Enter para enviar · Shift+Enter para nueva línea)"
                rows={1}
                className="w-full bg-surface-200/60 border border-surface-400/30 rounded-2xl px-4 py-3.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/30 resize-none transition-all duration-200"
                disabled={streaming}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || streaming || !selectedModel}
              className="btn-primary !rounded-2xl !p-3.5"
            >
              <Send size={20} />
            </button>
          </div>
          {useOptimization && (
            <div className="flex items-center gap-2 mt-2.5 text-xs text-gray-600">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                <Gauge size={12} className="text-brand-400" />
                <span>Optimización activa — modo {qualityMode === 'speed' ? 'velocidad' : qualityMode === 'balanced' ? 'equilibrado' : 'calidad'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
