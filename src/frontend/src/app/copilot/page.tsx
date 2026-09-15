'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { apiClient, type CopilotResponse } from '@/lib/api'
import { Sparkles, Send, RefreshCw, AlertTriangle, Loader2, User, Bot } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  model?: string
  configured?: boolean
  fallback?: boolean
  ts: number
}

const SUGGESTED_QUESTIONS = [
  'How many shipments are currently disrupted?',
  'Which cold-chain shipments are in excursion?',
  'What is the fleet utilisation breakdown?',
  'What is the financial impact of the Mumbai port closure?',
  'Which P1 shipments are at highest risk right now?',
  'What recovery options are available for disrupted cargo?',
]

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; model: string; provider: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    apiClient.getAIStatus()
      .then(r => setAiStatus(r.data as any))
      .catch(() => setAiStatus({ configured: false, model: 'gemini-3.6-flash', provider: 'Google Gemini' }))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (question: string) => {
    const q = question.trim()
    if (!q || loading) return

    const userMsg: Message = { role: 'user', content: q, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const r = await apiClient.copilot(q)
      const data = r.data
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.answer,
        model: data.model,
        configured: data.configured,
        fallback: data.fallback,
        ts: Date.now(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (e: any) {
      setError(e?.message || 'Failed to get a response from the copilot')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [loading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const clearConversation = () => {
    setMessages([])
    setError(null)
    inputRef.current?.focus()
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: 20, gap: 12 }}
      className="fade-in">

      {/* Header */}
      <div className="flex items-center justify-between" style={{ flexShrink: 0 }}>
        <div>
          <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
            <Sparkles size={14} style={{ color: '#a78bfa' }} />
            <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              AI COPILOT
            </h1>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Supply-chain Q&A grounded in live backend data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* AI status badge */}
          {aiStatus && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px',
              background: aiStatus.configured ? 'rgba(139,92,246,0.1)' : 'var(--bg-elevated)',
              border: `1px solid ${aiStatus.configured ? 'rgba(139,92,246,0.35)' : 'var(--border-default)'}`,
              borderRadius: 5,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: aiStatus.configured ? '#a78bfa' : 'var(--text-faint)',
              }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: aiStatus.configured ? '#a78bfa' : 'var(--text-muted)', letterSpacing: '0.04em' }}>
                {aiStatus.configured ? `GEMINI LIVE · ${aiStatus.model}` : 'RULE-BASED · add GEMINI_API_KEY'}
              </span>
            </div>
          )}
          {messages.length > 0 && (
            <button onClick={clearConversation} className="btn-ghost" title="Clear conversation">
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {messages.length === 0 && !loading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              {/* Welcome */}
              <div style={{ textAlign: 'center', maxWidth: 420 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, margin: '0 auto 12px',
                  background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={22} style={{ color: '#a78bfa' }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Clutch Nexus AI Copilot
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Ask anything about the current supply-chain operations. The copilot uses live backend data — disruptions, shipments, fleet utilisation, cold-chain status — to answer your questions.
                </p>
                {!aiStatus?.configured && (
                  <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 6 }}>
                    <p style={{ fontSize: 11, color: 'var(--amber)', lineHeight: 1.5 }}>
                      Running in rule-based mode. Set <span className="mono">GEMINI_API_KEY</span> in <span className="mono">backend/.env</span> to enable live Gemini AI.
                    </p>
                  </div>
                )}
              </div>

              {/* Suggested questions */}
              <div style={{ width: '100%', maxWidth: 520 }}>
                <p className="section-label" style={{ marginBottom: 8, textAlign: 'center' }}>Suggested questions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      style={{
                        textAlign: 'left', padding: '8px 12px',
                        background: 'var(--bg-base)', border: '1px solid var(--border-default)',
                        borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(139,92,246,0.4)'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.04)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-base)'
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div style={{ maxWidth: '80%', display: 'flex', gap: 8, alignItems: 'flex-start',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                {/* Avatar */}
                <div style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: msg.role === 'user' ? 'var(--accent-glow)' : 'rgba(139,92,246,0.15)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(30,126,248,0.3)' : 'rgba(139,92,246,0.25)'}`,
                  marginTop: 2,
                }}>
                  {msg.role === 'user'
                    ? <User size={11} style={{ color: 'var(--accent)' }} />
                    : <Sparkles size={11} style={{ color: '#a78bfa' }} />
                  }
                </div>

                {/* Bubble */}
                <div style={{
                  padding: '9px 12px',
                  borderRadius: msg.role === 'user' ? '10px 4px 10px 10px' : '4px 10px 10px 10px',
                  background: msg.role === 'user' ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(30,126,248,0.25)' : 'var(--border-default)'}`,
                }}>
                  <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </p>
                  {msg.role === 'assistant' && (
                    <p style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 5, letterSpacing: '0.04em' }}>
                      {msg.configured ? `Gemini · ${msg.model}` : `Rule-based fallback · ${msg.model}`}
                      {msg.fallback && !msg.configured && ' · add GEMINI_API_KEY to enable live AI'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)',
                }}>
                  <Sparkles size={11} style={{ color: '#a78bfa' }} />
                </div>
                <div style={{
                  padding: '10px 14px', background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)', borderRadius: '4px 10px 10px 10px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Loader2 size={12} className="animate-spin" style={{ color: '#a78bfa' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {aiStatus?.configured ? 'Gemini is thinking…' : 'Preparing answer…'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 12px', background: 'var(--red-dim)', border: '1px solid var(--red-border)', borderRadius: 6 }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} style={{ color: 'var(--red)', flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: 'var(--red)' }}>{error}</p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about disruptions, shipments, fleet, cold chain…"
              className="input-field"
              style={{ flex: 1 }}
              disabled={loading}
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-primary"
              style={{
                flexShrink: 0,
                background: 'rgba(139,92,246,0.8)',
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}
            >
              {loading
                ? <Loader2 size={13} className="animate-spin" />
                : <Send size={13} />
              }
            </button>
          </form>
          <p style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 6, textAlign: 'center' }}>
            Copilot answers are grounded in live backend data. Risk scores and optimisation use deterministic engines.
          </p>
        </div>
      </div>
    </div>
  )
}
