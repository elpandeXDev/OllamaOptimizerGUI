import { useState, useEffect } from 'react'
import { Gauge, Zap, Sparkles, HardDrive, Cpu, MemoryStick, RefreshCw, Check, AlertTriangle, Save } from 'lucide-react'
import { api } from '../api.js'

export default function OptimizationPanel({ qualityMode, setQualityMode, optModelSize, setOptModelSize, onSaveSettings }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const modelSize = optModelSize

  const fetchOptimization = async () => {
    setLoading(true)
    try {
      const result = await api.getOptimization({
        model_size_gb: modelSize,
        quality_mode: qualityMode,
      })
      setData(result)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOptimization()
  }, [qualityMode, modelSize])

  const sys = data?.system
  const opt = data?.optimization

  const modeInfo = {
    speed: { icon: Zap, label: 'Velocidad', color: 'text-yellow-400', desc: 'Máxima velocidad de respuesta' },
    balanced: { icon: Gauge, label: 'Equilibrado', color: 'text-brand-400', desc: 'Balance entre velocidad y calidad' },
    quality: { icon: Sparkles, label: 'Calidad', color: 'text-purple-400', desc: 'Máxima precisión y contexto' },
  }

  const ModeIcon = modeInfo[qualityMode]?.icon || Gauge

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <Gauge size={22} className="text-brand-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-100">Panel de optimización</h2>
              <p className="text-xs text-gray-500">Ajusta rendimiento según tu hardware</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchOptimization} disabled={loading} className="btn-secondary !py-1.5">
              <RefreshCw size={16} className={`inline mr-1 ${loading ? 'animate-spin' : ''}`} /> Recalcular
            </button>
            <button
              onClick={() => {
                onSaveSettings()
                setSaved(true)
                setTimeout(() => setSaved(false), 2000)
              }}
              className="btn-primary !py-1.5"
            >
              {saved ? <Check size={16} className="inline mr-1" /> : <Save size={16} className="inline mr-1" />}
              {saved ? 'Guardado' : 'Guardar'}
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="card p-12 text-center text-gray-500">
            <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-brand-400" />
            <p className="text-sm">Analizando hardware...</p>
          </div>
        ) : data ? (
          <>
            {/* System info summary */}
            <div className="card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-200">
                <Cpu size={18} className="text-brand-400" /> Hardware detectado
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoCard icon={Cpu} label="CPU" value={`${sys.cpu_count} hilos`} sub={`${sys.cpu_freq_mhz.toFixed(0)} MHz`} />
                <InfoCard icon={MemoryStick} label="RAM total" value={`${sys.total_ram_gb} GB`} sub={`${sys.available_ram_gb} GB libres`} />
                <InfoCard
                  icon={HardDrive}
                  label="Almacenamiento"
                  value={sys.storage_type}
                  sub={sys.storage_type === 'SSD' ? 'Acceso rápido' : 'Acceso mecánico'}
                  highlight={sys.storage_type === 'SSD' ? 'green' : 'yellow'}
                />
                <InfoCard
                  icon={Sparkles}
                  label="GPU"
                  value={sys.gpu_available ? 'Sí' : 'No'}
                  sub={sys.gpu_name || 'Solo CPU'}
                  highlight={sys.gpu_available ? 'green' : 'gray'}
                />
              </div>
            </div>

            {/* Quality mode selector */}
            <div className="card p-5">
              <h3 className="font-semibold mb-4 text-gray-200">Modo de optimización</h3>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(modeInfo).map(([key, info]) => {
                  const Icon = info.icon
                  return (
                    <button
                      key={key}
                      onClick={() => setQualityMode(key)}
                      className={`p-4 rounded-2xl border transition-all duration-200 text-center ${
                        qualityMode === key
                          ? 'border-brand-500/40 bg-brand-500/10 glow'
                          : 'border-surface-300/30 bg-surface-200/30 hover:border-surface-400/50 hover:bg-surface-200/50'
                      }`}
                    >
                      <Icon size={24} className={`mx-auto mb-2 transition ${qualityMode === key ? info.color : 'text-gray-600'}`} />
                      <div className="font-medium text-sm text-gray-200">{info.label}</div>
                      <div className="text-xs text-gray-600 mt-1">{info.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Model size selector with presets */}
            <div className="card p-5">
              <h3 className="font-semibold mb-3 text-gray-200">Tamaño del modelo</h3>

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { label: '3B', size: 2.0 },
                  { label: '7B', size: 4.7 },
                  { label: '8B', size: 4.9 },
                  { label: '11B', size: 6.5 },
                  { label: '14B', size: 9.0 },
                  { label: '20B', size: 13.0 },
                  { label: '27B', size: 16.0 },
                  { label: '32B', size: 19.0 },
                ].map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => setOptModelSize(preset.size)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      modelSize === preset.size
                        ? 'bg-brand-600/30 text-brand-300 border border-brand-500/30'
                        : 'bg-surface-200/50 text-gray-500 border border-surface-300/20 hover:bg-surface-200/80 hover:text-gray-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Slider */}
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="22"
                  step="0.5"
                  value={modelSize}
                  onChange={e => setOptModelSize(parseFloat(e.target.value))}
                  className="flex-1 accent-brand-500"
                />
                <span className="text-lg font-bold gradient-text min-w-[80px] text-right">{modelSize} GB</span>
              </div>

              {/* RAM fit indicator */}
              {sys && (() => {
                const ramNeeded = modelSize * 1.5
                const fits = sys.available_ram_gb >= ramNeeded
                return (
                  <div className={`mt-3 flex items-center gap-2 text-xs ${fits ? 'text-green-400' : 'text-yellow-400'}`}>
                    {fits ? <Check size={14} /> : <AlertTriangle size={14} />}
                    <span>
                      {fits
                        ? `✓ RAM suficiente — necesita ~${ramNeeded.toFixed(1)}GB, tienes ${sys.available_ram_gb}GB libres`
                        : `⚠️ RAM ajustada — necesita ~${ramNeeded.toFixed(1)}GB, solo ${sys.available_ram_gb}GB libres (usará swap)`
                      }
                    </span>
                  </div>
                )
              })()}
            </div>

            {/* Optimization results */}
            <div className="card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-200">
                <ModeIcon size={18} className={modeInfo[qualityMode].color} />
                Parámetros optimizados
              </h3>
              <p className="text-sm text-gray-500 mb-4">{opt.description}</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <ParamCard label="Contexto (num_ctx)" value={opt.num_ctx} hint="Tokens de contexto" />
                <ParamCard label="Capas GPU (num_gpu)" value={opt.num_gpu === 99 ? 'Todas' : opt.num_gpu} hint="Offload a GPU" />
                <ParamCard label="Hilos (num_thread)" value={opt.num_thread} hint="Hilos de CPU" />
                <ParamCard label="Batch (num_batch)" value={opt.num_batch} hint={opt.num_batch >= 512 ? 'Optimizado SSD' : 'Optimizado HDD'} />
                <ParamCard label="Keep alive" value={opt.keep_alive} hint="Tiempo en memoria" />
                <ParamCard label="Predict (num_predict)" value={opt.num_predict === -1 ? 'Ilimitado' : opt.num_predict} hint="Máx tokens respuesta" />
                <ParamCard label="Keep tokens (num_keep)" value={opt.num_keep} hint="Prompt caching" />
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                <ToggleCard label="f16_kv" enabled={opt.f16_kv} hint="Precisión KV cache" />
                <ToggleCard label="use_mmap" enabled={opt.use_mmap} hint="Memory-mapped I/O" />
                <ToggleCard label="use_mlock" enabled={opt.use_mlock} hint="Bloquear en RAM" />
                <ToggleCard label="low_vram" enabled={opt.low_vram} hint="VRAM limitada" />
                <ToggleCard label="flash_attn" enabled={opt.flash_attention} hint="Flash Attention" />
              </div>
            </div>

            {/* HDD/SSD specific advice */}
            <div className={`card p-5 border-l-4 ${sys.storage_type === 'HDD' ? 'border-l-yellow-500' : 'border-l-green-500'}`}>
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-gray-200">
                {sys.storage_type === 'HDD' ? <AlertTriangle size={18} className="text-yellow-400" /> : <Check size={18} className="text-green-400" />}
                Recomendaciones para {sys.storage_type}
              </h3>
              {sys.storage_type === 'HDD' ? (
                <ul className="text-sm text-gray-500 space-y-1.5 list-disc pl-5">
                  <li>Batch size reducido ({opt.num_batch}) para minimizar esperas de I/O secuenciales</li>
                  <li>Keep alive más corto ({opt.keep_alive}) para liberar memoria entre sesiones</li>
                  <li>mmap activado pero sin mlock para evitar saturar RAM</li>
                  <li>Considera mantener los modelos más usados en memoria con keep_alive más largo</li>
                  <li>Para mejor rendimiento, mueve los modelos a un SSD si es posible</li>
                </ul>
              ) : (
                <ul className="text-sm text-gray-500 space-y-1.5 list-disc pl-5">
                  <li>Batch size amplio ({opt.num_batch}) para aprovechar acceso aleatorio rápido</li>
                  <li>Keep alive extendido ({opt.keep_alive}) para respuestas instantáneas</li>
                  <li>mmap + mlock activados para máxima velocidad de carga</li>
                  <li>Acceso aleatorio optimizado para carga parcial de modelos</li>
                </ul>
              )}
            </div>

            {/* Raw options JSON */}
            <div className="card p-5">
              <h3 className="font-semibold mb-3 text-gray-200">Configuración Ollama (JSON)</h3>
              <pre className="bg-surface-0/80 rounded-xl p-4 text-sm text-gray-300 overflow-x-auto border border-surface-300/20 font-mono">
{JSON.stringify(data.options, null, 2)}
              </pre>
              <p className="text-xs text-gray-600 mt-2">
                Estos parámetros se aplican automáticamente en cada chat cuando la optimización está activa.
              </p>
            </div>
          </>
        ) : (
          <div className="card p-12 text-center text-red-400 animate-fade-in">
            Error al conectar con el backend. Asegúrate de que el servidor esté en ejecución.
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ icon: Icon, label, value, sub, highlight }) {
  const colors = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    gray: 'text-gray-400',
  }
  return (
    <div className="bg-surface-200/40 rounded-xl p-3.5 border border-surface-300/20">
      <Icon size={16} className="text-gray-600 mb-1.5" />
      <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">{label}</div>
      <div className={`font-bold text-base ${colors[highlight] || 'text-gray-100'}`}>{value}</div>
      <div className="text-xs text-gray-600 mt-0.5">{sub}</div>
    </div>
  )
}

function ParamCard({ label, value, hint }) {
  return (
    <div className="bg-surface-200/40 rounded-xl p-3.5 border border-surface-300/20">
      <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">{label}</div>
      <div className="text-lg font-bold text-brand-400 mt-0.5">{value}</div>
      <div className="text-xs text-gray-600 mt-0.5">{hint}</div>
    </div>
  )
}

function ToggleCard({ label, enabled, hint }) {
  return (
    <div className={`rounded-xl p-3.5 border transition ${enabled ? 'bg-green-500/10 border-green-500/20' : 'bg-surface-200/30 border-surface-300/20'}`}>
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full transition ${enabled ? 'bg-green-400 shadow-sm shadow-green-400/50' : 'bg-gray-700'}`} />
        <span className="text-xs font-mono text-gray-300">{label}</span>
      </div>
      <div className="text-xs mt-1.5" style={{color: enabled ? '#4ade80' : '#666'}}>{enabled ? 'Activado' : 'Desactivado'}</div>
      <div className="text-xs text-gray-700 mt-0.5">{hint}</div>
    </div>
  )
}
