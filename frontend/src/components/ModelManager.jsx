import { useState } from 'react'
import { Box, Download, Trash2, Play, Square, HardDrive, Clock, RefreshCw, CheckCircle, Loader } from 'lucide-react'
import { api } from '../api.js'

function formatSize(bytes) {
  if (!bytes) return '—'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  const mb = bytes / (1024 ** 2)
  return `${mb.toFixed(0)} MB`
}

function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ModelManager({ models, refreshModels }) {
  const [pullName, setPullName] = useState('')
  const [pulling, setPulling] = useState(false)
  const [pullProgress, setPullProgress] = useState(null)
  const [runningModels, setRunningModels] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const refreshRunning = async () => {
    try {
      const data = await api.runningModels()
      setRunningModels(data.models || [])
    } catch { /* ignore */ }
  }

  useState(() => {
    refreshRunning()
  }, [])

  const handlePull = async () => {
    if (!pullName.trim()) return
    setPulling(true)
    setPullProgress({ status: 'Iniciando descarga...' })
    setMessage('')
    try {
      for await (const chunk of api.pullModelStream(pullName.trim())) {
        if (chunk.error) {
          setMessage(`Error: ${chunk.error}`)
          break
        }
        if (chunk.status) {
          const pct = chunk.total ? Math.round((chunk.completed / chunk.total) * 100) : null
          setPullProgress({
            status: chunk.status,
            percent: pct,
            completed: chunk.completed ? formatSize(chunk.completed) : null,
            total: chunk.total ? formatSize(chunk.total) : null,
          })
        }
      }
      setMessage('Modelo descargado correctamente')
      setPullName('')
      refreshModels()
    } catch (e) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setPulling(false)
      setPullProgress(null)
    }
  }

  const handleDelete = async (name) => {
    if (!confirm(`¿Eliminar el modelo "${name}"?`)) return
    setLoading(true)
    try {
      await api.deleteModel(name)
      setMessage(`Modelo "${name}" eliminado`)
      refreshModels()
    } catch (e) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleLoad = async (name) => {
    setLoading(true)
    try {
      await api.loadModel(name, '10m')
      setMessage(`Modelo "${name}" cargado en memoria`)
      refreshRunning()
    } catch (e) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUnload = async (name) => {
    setLoading(true)
    try {
      await api.unloadModel(name)
      setMessage(`Modelo "${name}" descargado de memoria`)
      refreshRunning()
    } catch (e) {
      setMessage(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const runningNames = new Set(runningModels.map(m => m.name))

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <Box size={22} className="text-brand-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-100">Gestión de modelos</h2>
              <p className="text-xs text-gray-500">Descarga, carga y administra modelos IA</p>
            </div>
          </div>
          <button onClick={() => { refreshModels(); refreshRunning() }} className="btn-secondary !py-1.5">
            <RefreshCw size={16} className={`inline mr-1 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>

        {message && (
          <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl px-4 py-2.5 text-brand-300 text-sm animate-slide-up">
            {message}
          </div>
        )}

        {/* Pull new model */}
        <div className="card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-200">
            <Download size={18} className="text-brand-400" /> Descargar modelo
          </h3>
          <div className="flex gap-2">
            <input
              value={pullName}
              onChange={e => setPullName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !pulling && handlePull()}
              placeholder="ej: llama3.2, mistral, phi3:mini..."
              className="input-field"
              disabled={pulling}
            />
            <button onClick={handlePull} disabled={pulling || !pullName.trim()} className="btn-primary whitespace-nowrap">
              {pulling ? <Loader size={16} className="animate-spin inline mr-1" /> : <Download size={16} className="inline mr-1" />}
              {pulling ? 'Descargando...' : 'Descargar'}
            </button>
          </div>
          {pullProgress && (
            <div className="mt-3">
              <div className="flex justify-between text-sm text-gray-400 mb-1.5">
                <span>{pullProgress.status}</span>
                {pullProgress.percent != null && <span className="text-brand-400 font-medium">{pullProgress.percent}%</span>}
              </div>
              {pullProgress.percent != null && (
                <div className="w-full bg-surface-300/50 rounded-full h-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-brand-600 to-brand-400 h-full transition-all duration-300 rounded-full" style={{ width: `${pullProgress.percent}%` }} />
                </div>
              )}
              {pullProgress.completed && pullProgress.total && (
                <p className="text-xs text-gray-600 mt-1.5">{pullProgress.completed} / {pullProgress.total}</p>
              )}
            </div>
          )}
          <p className="text-xs text-gray-600 mt-2.5">
            Visita <a href="https://ollama.com/library" target="_blank" className="text-brand-400 hover:text-brand-300 hover:underline transition">ollama.com/library</a> para ver modelos disponibles.
          </p>
        </div>

        {/* Running models */}
        {runningModels.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-200">
              <Play size={18} className="text-green-400" /> Modelos en memoria ({runningModels.length})
            </h3>
            <div className="space-y-2">
              {runningModels.map(m => (
                <div key={m.name} className="flex items-center gap-3 bg-surface-200/40 rounded-xl px-3 py-2.5 border border-surface-300/20">
                  <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                  <span className="flex-1 text-sm text-gray-200">{m.name}</span>
                  <span className="text-xs text-gray-500">{formatSize(m.size)}</span>
                  <button onClick={() => handleUnload(m.name)} disabled={loading} className="text-gray-400 hover:text-red-400 transition p-1.5 rounded-lg hover:bg-red-500/10">
                    <Square size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All models */}
        <div className="card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-200">
            <HardDrive size={18} className="text-brand-400" /> Modelos instalados ({models.length})
          </h3>
          {models.length === 0 ? (
            <p className="text-gray-600 text-sm py-8 text-center">No hay modelos instalados. Descarga uno arriba.</p>
          ) : (
            <div className="space-y-2">
              {models.map(m => (
                <div key={m.name} className="flex items-center gap-3 bg-surface-200/40 rounded-xl px-3 py-3 hover:bg-surface-200/70 transition-all duration-150 border border-surface-300/20">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-200 truncate">{m.name}</span>
                      {runningNames.has(m.name) && (
                        <span className="badge bg-green-500/15 text-green-400 border border-green-500/20">en memoria</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                      <span className="flex items-center gap-1"><HardDrive size={11} /> {formatSize(m.size)}</span>
                      <span className="flex items-center gap-1"><Clock size={11} /> {formatDate(m.modified_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => runningNames.has(m.name) ? handleUnload(m.name) : handleLoad(m.name)}
                      disabled={loading}
                      className={`p-2 rounded-lg transition ${runningNames.has(m.name) ? 'text-orange-400 hover:bg-orange-500/10' : 'text-green-400 hover:bg-green-500/10'}`}
                      title={runningNames.has(m.name) ? 'Descargar de memoria' : 'Cargar en memoria'}
                    >
                      {runningNames.has(m.name) ? <Square size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      onClick={() => handleDelete(m.name)}
                      disabled={loading}
                      className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition"
                      title="Eliminar modelo"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
