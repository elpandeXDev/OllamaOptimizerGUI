import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Cpu, Copy, Check } from 'lucide-react'
import { useState } from 'react'

export default function Message({ message, isStreaming }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  const copyContent = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex gap-3 animate-slide-up ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
        isUser
          ? 'bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-600/20'
          : 'bg-gradient-to-br from-surface-300 to-surface-400 border border-surface-400/50'
      }`}>
        {isUser ? <User size={16} className="text-white" /> : <Cpu size={16} className="text-brand-300" />}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'flex flex-col items-end' : ''}`}>
        <div className={`inline-block max-w-full rounded-2xl px-4 py-3.5 ${
          isUser
            ? 'bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-600/15'
            : 'bg-surface-200/60 text-gray-100 border border-surface-300/30'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{message.content}</p>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || (isStreaming ? '...' : '')}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-brand-400 animate-blink ml-0.5 rounded-sm align-text-bottom" />
              )}
            </div>
          )}
        </div>

        {/* Footer: timing + copy */}
        {!isUser && message.content && !isStreaming && (
          <div className="flex items-center gap-3 mt-1.5 px-2 text-xs text-gray-600">
            {message.timing && (
              <span className="flex items-center gap-1.5">
                <span className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-brand-400" />
                  {message.timing.tokens} tokens
                </span>
                <span className="text-gray-700">·</span>
                <span className="text-brand-400 font-medium">{message.timing.tokens_per_second} tok/s</span>
                <span className="text-gray-700">·</span>
                <span>TTFT {message.timing.ttft_seconds}s</span>
              </span>
            )}
            <button onClick={copyContent} className="hover:text-gray-400 transition flex items-center gap-1">
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
