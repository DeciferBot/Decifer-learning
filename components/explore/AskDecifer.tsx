'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  aid: string
  initialContext?: string
  yearGroup?: string
  onAskCountChange?: (count: number) => void
}

export function AskDecifer({ aid, initialContext, yearGroup, onAskCountChange }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState(initialContext ?? '')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const askCountRef = useRef(0)

  // When the parent triggers a new context (user tapped "Ask Decifer about X"),
  // open the panel and inject a context-aware greeting or transition message.
  useEffect(() => {
    if (!initialContext) return
    setContext(initialContext)
    setOpen(true)
    setMessages(prev => {
      const greeting = prev.length === 0
        ? `Hi! I'm Decifer 👋 I can see you're looking at ${initialContext}. What would you like to know?`
        : `Sure! Switching to ${initialContext}. What do you want to know?`
      return [...prev, { role: 'assistant', content: greeting }]
    })
  }, [initialContext]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [open, messages])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    askCountRef.current += 1
    onAskCountChange?.(askCountRef.current)

    try {
      const res = await fetch('/api/explore/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          aid,
          context,
          yearGroup,
          // Send state BEFORE the new user message — API appends it separately.
          // Slice from `messages` (pre-send state), not `newMessages`.
          history: messages.slice(-6),
        }),
      })

      if (!res.ok || !res.body) throw new Error('Failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let reply = ''

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        reply += decoder.decode(value, { stream: true })
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: reply },
        ])
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
      // Flush any remaining bytes buffered inside the decoder
      const tail = decoder.decode()
      if (tail) {
        reply += tail
        setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: reply }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Oops, something went wrong. Try again?' }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, aid, context, yearGroup, onAskCountChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 400, delay: 0.5 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #6C9EFF 0%, #a78bfa 100%)',
              boxShadow: '0 4px 20px rgba(108,158,255,0.5)',
            }}
            aria-label="Ask Decifer"
          >
            <span className="text-2xl">🔭</span>
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-400 border-2 border-white" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 z-50 flex flex-col rounded-t-3xl shadow-2xl"
            style={{
              // Anchor above the fixed bottom tab bar (+ iOS home indicator) so
              // the input row is always visible and tappable, never hidden
              // behind the nav. See --bottom-nav-clearance in tokens.css.
              bottom: 'var(--bottom-nav-clearance)',
              height: '65vh',
              background: 'linear-gradient(160deg, #1a1a3e 0%, #0d0d20 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-lg"
                  style={{ background: 'linear-gradient(135deg, #6C9EFF, #a78bfa)' }}
                >
                  🔭
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Ask Decifer</p>
                  <p className="text-[10px] text-white/40">Your curious guide</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-full bg-surface/10 flex items-center justify-center text-white/50 hover:bg-surface/20"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-3xl mb-3">🔭</p>
                  <p className="text-sm text-white/50">
                    Ask me anything about what you&apos;re exploring!
                  </p>
                  <div className="mt-4 space-y-2">
                    {getSuggestions(aid, context).map((s) => (
                      <button
                        key={s}
                        onClick={() => { setInput(s); inputRef.current?.focus() }}
                        className="block w-full text-left rounded-xl px-3 py-2 text-sm text-white/70 hover:text-white transition-colors"
                        style={{ background: 'rgba(255,255,255,0.06)' }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <span className="mr-2 mt-1 text-base flex-none">🔭</span>
                  )}
                  <div
                    className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                    style={{
                      background: m.role === 'user'
                        ? 'linear-gradient(135deg, #6C9EFF, #a78bfa)'
                        : 'rgba(255,255,255,0.08)',
                      color: 'white',
                    }}
                  >
                    {m.content || <span className="opacity-50">Thinking…</span>}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 pb-6 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2 rounded-2xl px-4 py-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything…"
                  className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
                  disabled={loading}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  className="flex-none h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-all disabled:opacity-30"
                  style={{ background: 'linear-gradient(135deg, #6C9EFF, #a78bfa)' }}
                >
                  →
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function getSuggestions(aid: string, context: string): string[] {
  if (context) {
    const name = context.replace('the planet ', '').replace('the ', '')
    return [
      `Why is ${name} that colour?`,
      `Could humans ever visit ${name}?`,
      `How was ${name} discovered?`,
    ]
  }
  const suggestions: Record<string, string[]> = {
    'solar-system': [
      'Which planet would be the best to live on?',
      'How was the Solar System formed?',
      'What\'s the hottest planet?',
    ],
    'world-atlas': [
      'Which is the largest country?',
      'How many countries are there?',
      'Which country has the most languages?',
    ],
    default: [
      'Tell me something amazing!',
      'What\'s the most surprising fact here?',
      'How does this connect to what I learn in school?',
    ],
  }
  return suggestions[aid] ?? suggestions.default
}
