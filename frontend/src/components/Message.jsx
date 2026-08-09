import React, { memo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { User, Cpu, Copy, Check, Terminal, Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react'

import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx'
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java'
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c'
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp'
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp'
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go'
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php'
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown'
import docker from 'react-syntax-highlighter/dist/esm/languages/prism/docker'
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin'
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift'
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby'
import scala from 'react-syntax-highlighter/dist/esm/languages/prism/scala'
import dart from 'react-syntax-highlighter/dist/esm/languages/prism/dart'
import lua from 'react-syntax-highlighter/dist/esm/languages/prism/lua'
import perl from 'react-syntax-highlighter/dist/esm/languages/prism/perl'
import r from 'react-syntax-highlighter/dist/esm/languages/prism/r'
import haskell from 'react-syntax-highlighter/dist/esm/languages/prism/haskell'
import elixir from 'react-syntax-highlighter/dist/esm/languages/prism/elixir'
import clojure from 'react-syntax-highlighter/dist/esm/languages/prism/clojure'
import groovy from 'react-syntax-highlighter/dist/esm/languages/prism/groovy'
import powershell from 'react-syntax-highlighter/dist/esm/languages/prism/powershell'
import graphql from 'react-syntax-highlighter/dist/esm/languages/prism/graphql'
import solidity from 'react-syntax-highlighter/dist/esm/languages/prism/solidity'
import toml from 'react-syntax-highlighter/dist/esm/languages/prism/toml'
import ini from 'react-syntax-highlighter/dist/esm/languages/prism/ini'
import makefile from 'react-syntax-highlighter/dist/esm/languages/prism/makefile'
import cmake from 'react-syntax-highlighter/dist/esm/languages/prism/cmake'
import nginx from 'react-syntax-highlighter/dist/esm/languages/prism/nginx'
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff'

SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('jsx', jsx)
SyntaxHighlighter.registerLanguage('tsx', tsx)
SyntaxHighlighter.registerLanguage('java', java)
SyntaxHighlighter.registerLanguage('c', c)
SyntaxHighlighter.registerLanguage('cpp', cpp)
SyntaxHighlighter.registerLanguage('csharp', csharp)
SyntaxHighlighter.registerLanguage('go', go)
SyntaxHighlighter.registerLanguage('rust', rust)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('php', php)
SyntaxHighlighter.registerLanguage('markup', markup)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('yaml', yaml)
SyntaxHighlighter.registerLanguage('markdown', markdown)
SyntaxHighlighter.registerLanguage('docker', docker)
SyntaxHighlighter.registerLanguage('kotlin', kotlin)
SyntaxHighlighter.registerLanguage('swift', swift)
SyntaxHighlighter.registerLanguage('ruby', ruby)
SyntaxHighlighter.registerLanguage('scala', scala)
SyntaxHighlighter.registerLanguage('dart', dart)
SyntaxHighlighter.registerLanguage('lua', lua)
SyntaxHighlighter.registerLanguage('perl', perl)
SyntaxHighlighter.registerLanguage('r', r)
SyntaxHighlighter.registerLanguage('haskell', haskell)
SyntaxHighlighter.registerLanguage('elixir', elixir)
SyntaxHighlighter.registerLanguage('clojure', clojure)
SyntaxHighlighter.registerLanguage('groovy', groovy)
SyntaxHighlighter.registerLanguage('powershell', powershell)
SyntaxHighlighter.registerLanguage('graphql', graphql)
SyntaxHighlighter.registerLanguage('solidity', solidity)
SyntaxHighlighter.registerLanguage('toml', toml)
SyntaxHighlighter.registerLanguage('ini', ini)
SyntaxHighlighter.registerLanguage('makefile', makefile)
SyntaxHighlighter.registerLanguage('cmake', cmake)
SyntaxHighlighter.registerLanguage('nginx', nginx)
SyntaxHighlighter.registerLanguage('diff', diff)

function Message({ message, isStreaming }) {
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
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    const lang = match ? match[1] : 'text'
                    const codeText = String(children).replace(/\n$/, '')

                    if (!inline && match) {
                      return (
                        <CodeBlock language={lang} code={codeText} />
                      )
                    }

                    // Inline code
                    return (
                      <code className="px-1.5 py-0.5 rounded-md bg-surface-900/80 text-brand-300 text-[13px] font-mono border border-surface-400/20" {...props}>
                        {children}
                      </code>
                    )
                  },
                  // Style regular code blocks without language too
                  pre({ children }) {
                    return <>{children}</>
                  },
                }}
              >
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

export default memo(Message)

const LANG_LABELS = {
  python: 'Python', javascript: 'JavaScript', js: 'JavaScript', typescript: 'TypeScript',
  ts: 'TypeScript', jsx: 'React JSX', tsx: 'React TSX', react: 'React',
  java: 'Java', c: 'C', cpp: 'C++', 'c++': 'C++', csharp: 'C#', 'c#': 'C#',
  go: 'Go', rust: 'Rust', sql: 'SQL', bash: 'Bash', shell: 'Shell', sh: 'Shell',
  php: 'PHP', html: 'HTML', css: 'CSS', json: 'JSON', yaml: 'YAML', xml: 'XML',
  markdown: 'Markdown', md: 'Markdown', dockerfile: 'Dockerfile', text: 'Text',
  kotlin: 'Kotlin', swift: 'Swift', ruby: 'Ruby', scala: 'Scala', dart: 'Dart',
  lua: 'Lua', perl: 'Perl', r: 'R', haskell: 'Haskell', elixir: 'Elixir',
  clojure: 'Clojure', groovy: 'Groovy', powershell: 'PowerShell', ps1: 'PowerShell',
  graphql: 'GraphQL', solidity: 'Solidity', toml: 'TOML', ini: 'INI',
  makefile: 'Makefile', cmake: 'CMake', nginx: 'Nginx', diff: 'Diff',
  vue: 'Vue', svelte: 'Svelte', angular: 'Angular', protobuf: 'Protobuf',
}

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const label = LANG_LABELS[language] || language.toUpperCase()

  // Map aliases to registered languages
  const langMap = { js: 'javascript', ts: 'typescript', html: 'markup', sh: 'bash', shell: 'bash', 'c++': 'cpp', 'c#': 'csharp', md: 'markdown', dockerfile: 'docker', ps1: 'powershell', vue: 'markup', svelte: 'markup', angular: 'typescript', protobuf: 'ini' }
  const hlLang = langMap[language] || language

  // Count lines to decide if collapse makes sense
  const lineCount = code.split('\n').length
  const canCollapse = lineCount > 15

  const copyCode = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleExpand = () => setExpanded(e => !e)
  const toggleFullscreen = () => setFullscreen(f => !f)

  const syntaxHighlighter = (
    <SyntaxHighlighter
      language={hlLang}
      style={vscDarkPlus}
      customStyle={{
        margin: 0,
        padding: '16px',
        background: 'transparent',
        fontSize: '13px',
        fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace",
      }}
      codeTagProps={{
        style: {
          fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace",
        }
      }}
      showLineNumbers
      lineNumberStyle={{ color: '#4a4a4a', fontSize: '11px', paddingRight: '16px' }}
    >
      {code}
    </SyntaxHighlighter>
  )

  return (
    <>
      <div className="my-3 rounded-xl overflow-hidden border border-surface-400/30 shadow-lg bg-[#1e1e1e]">
        {/* Terminal header bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-surface-400/20">
          <div className="flex items-center gap-2">
            {/* CMD traffic lights */}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
            </div>
            <div className="flex items-center gap-1.5 ml-2 text-gray-400">
              <Terminal size={13} className="text-brand-400" />
              <span className="text-xs font-mono font-medium">{label}</span>
              {canCollapse && (
                <span className="text-[10px] text-gray-600 ml-1">({lineCount} líneas)</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {canCollapse && (
              <button
                onClick={toggleExpand}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition px-2 py-1 rounded-md hover:bg-surface-400/20"
                title={expanded ? 'Contraer' : 'Expandir'}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition px-2 py-1 rounded-md hover:bg-surface-400/20"
              title="Pantalla completa"
            >
              <Maximize2 size={12} />
            </button>
            <button
              onClick={copyCode}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition px-2 py-1 rounded-md hover:bg-surface-400/20"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
        {/* Code with syntax highlighting */}
        {expanded ? (
          <div className="overflow-x-auto text-[13px] leading-relaxed">
            {syntaxHighlighter}
          </div>
        ) : (
          <div className="px-4 py-2 text-xs text-gray-500 font-mono cursor-pointer hover:bg-surface-400/10 transition" onClick={toggleExpand}>
            Código contraído — click para expandir ({lineCount} líneas)
          </div>
        )}
      </div>

      {/* Fullscreen modal */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={toggleFullscreen}
        >
          <div
            className="bg-[#1e1e1e] rounded-xl border border-surface-400/30 shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Fullscreen header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#2d2d2d] border-b border-surface-400/20 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                  <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                  <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
                </div>
                <div className="flex items-center gap-1.5 ml-2 text-gray-400">
                  <Terminal size={13} className="text-brand-400" />
                  <span className="text-xs font-mono font-medium">{label}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={copyCode}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition px-2 py-1 rounded-md hover:bg-surface-400/20"
                >
                  {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition px-2 py-1 rounded-md hover:bg-surface-400/20"
                  title="Cerrar"
                >
                  <Minimize2 size={14} />
                </button>
              </div>
            </div>
            {/* Fullscreen code */}
            <div className="overflow-auto flex-1 text-[14px] leading-relaxed">
              <SyntaxHighlighter
                language={hlLang}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: '24px',
                  background: 'transparent',
                  fontSize: '14px',
                  fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace",
                }}
                codeTagProps={{
                  style: {
                    fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace",
                  }
                }}
                showLineNumbers
                lineNumberStyle={{ color: '#4a4a4a', fontSize: '12px', paddingRight: '20px' }}
              >
                {code}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
