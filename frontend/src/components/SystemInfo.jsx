import { useState, useEffect } from 'react'
import { Cpu, MemoryStick, HardDrive, Activity, Server, Monitor, RefreshCw } from 'lucide-react'
import { api } from '../api.js'

export default function SystemInfo() {
  const [sys, setSys] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [s, h] = await Promise.all([api.getSystem(), api.health()])
      setSys(s)
      setHealth(h)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    const interval = setInterval(fetchAll, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !sys) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw size={28} className="animate-spin text-brand-400" />
      </div>
    )
  }

  if (!sys) {
    return <div className="h-full flex items-center justify-center text-red-400">Error al cargar información del sistema</div>
  }

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <Monitor size={22} className="text-brand-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-100">Información del sistema</h2>
              <p className="text-xs text-gray-500">Hardware y recursos en tiempo real</p>
            </div>
          </div>
          <button onClick={fetchAll} className="btn-secondary !py-1.5">
            <RefreshCw size={16} className="inline mr-1" /> Actualizar
          </button>
        </div>

        {/* Connection status */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-200">
            <Server size={18} className="text-brand-400" /> Conexión Ollama
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-200/40 rounded-xl p-3.5 border border-surface-300/20">
              <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Estado</div>
              <div className={`font-bold mt-0.5 ${health?.ollama === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                {health?.ollama === 'connected' ? 'Conectado' : 'Desconectado'}
              </div>
            </div>
            <div className="bg-surface-200/40 rounded-xl p-3.5 border border-surface-300/20">
              <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Host</div>
              <div className="font-mono text-sm text-gray-300 truncate mt-0.5">{health?.ollama_host}</div>
            </div>
            <div className="bg-surface-200/40 rounded-xl p-3.5 border border-surface-300/20">
              <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Modelos instalados</div>
              <div className="font-bold text-brand-400 mt-0.5">{health?.model_count ?? 0}</div>
            </div>
            <div className="bg-surface-200/40 rounded-xl p-3.5 border border-surface-300/20">
              <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">API</div>
              <div className="font-mono text-sm text-gray-300 mt-0.5">v1.0.0</div>
            </div>
          </div>
        </div>

        {/* CPU */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-200">
            <Cpu size={18} className="text-brand-400" /> CPU
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface-200/40 rounded-xl p-3.5 border border-surface-300/20">
              <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Hilos lógicos</div>
              <div className="text-2xl font-bold text-gray-100 mt-0.5">{sys.cpu_count}</div>
            </div>
            <div className="bg-surface-200/40 rounded-xl p-3.5 border border-surface-300/20">
              <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Frecuencia</div>
              <div className="text-2xl font-bold text-gray-100 mt-0.5">{sys.cpu_freq_mhz.toFixed(0)} <span className="text-sm text-gray-500">MHz</span></div>
            </div>
            <div className="bg-surface-200/40 rounded-xl p-3.5 border border-surface-300/20">
              <div className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">Sistema</div>
              <div className="text-lg font-bold text-gray-100 mt-0.5">{sys.os_name}</div>
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-200">
            <MemoryStick size={18} className="text-brand-400" /> Memoria RAM
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">RAM disponible</span>
              <span className="font-bold text-gray-200">{sys.available_ram_gb} GB <span className="text-gray-600 font-normal">/ {sys.total_ram_gb} GB</span></span>
            </div>
            <div className="w-full bg-surface-300/50 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-brand-600 to-brand-400 h-full transition-all duration-500 rounded-full"
                style={{ width: `${(sys.available_ram_gb / sys.total_ram_gb) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Disponible: {sys.available_ram_gb} GB</span>
              <span>En uso: {(sys.total_ram_gb - sys.available_ram_gb).toFixed(2)} GB</span>
            </div>
          </div>
        </div>

        {/* Storage */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-200">
            <HardDrive size={18} className="text-brand-400" /> Almacenamiento
          </h3>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              sys.storage_type === 'SSD' ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'
            }`}>
              <HardDrive size={28} className={sys.storage_type === 'SSD' ? 'text-green-400' : 'text-yellow-400'} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-100">{sys.storage_type}</div>
              <div className="text-sm text-gray-500 mt-0.5">
                {sys.storage_type === 'SSD'
                  ? 'Acceso aleatorio rápido — óptimo para Ollama'
                  : 'Acceso mecánico — optimización HDD activa para reducir latencia'}
              </div>
            </div>
          </div>
        </div>

        {/* GPU */}
        <div className="card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-200">
            <Activity size={18} className="text-brand-400" /> GPU
          </h3>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              sys.gpu_available ? 'bg-green-500/10 border border-green-500/20' : 'bg-surface-200/40 border border-surface-300/20'
            }`}>
              <Activity size={28} className={sys.gpu_available ? 'text-green-400' : 'text-gray-700'} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-100">{sys.gpu_available ? 'Disponible' : 'No detectada'}</div>
              <div className="text-sm text-gray-500 mt-0.5">{sys.gpu_name || 'Ejecución en CPU'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
