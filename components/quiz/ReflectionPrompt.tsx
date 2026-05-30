'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

type Props = {
  topicId: string
  topicTitle: string
  onDone: () => void
}

// OIT Reflection Prompt — "What did you figure out today?"
//
// Organismic Integration Theory (Self-Determination Theory):
// This prompt helps children internalise the value of learning itself,
// not just enjoy the app session. No edtech competitor does this.
// Research: Alberts, Lyngs & Lukoff 2024 (Oxford Academic).
//
// Design principles:
// - Voluntary (child can skip)
// - Open-ended (no right answer)
// - Encouraging, never evaluative
// - Saved privately; visible to parent dashboard

export function ReflectionPrompt({ topicId, topicTitle, onDone }: Props) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    if (!text.trim() || saving) return
    setSaving(true)
    try {
      await fetch('/api/quiz/reflection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topicId, text }),
      })
      setSaved(true)
      setTimeout(onDone, 900)
    } catch {
      // Fail silently — reflection is non-critical
      onDone()
    }
  }

  if (saved) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-science/30 bg-science/5 p-6 text-center"
      >
        <p className="text-2xl">✨</p>
        <p className="mt-1 font-heading font-bold text-ink">Saved!</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-science/30 bg-science/5 p-5"
    >
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-science">
        One more thing ✨
      </p>
      <p className="mb-3 font-heading text-base font-bold text-ink">
        What&apos;s one thing you figured out in {topicTitle}?
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. I worked out that multiplying by 10 just moves the digits one place…"
        maxLength={500}
        rows={3}
        className="w-full resize-none rounded-xl border border-black/10 bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-science/40"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={!text.trim() || saving}
          className="min-h-[44px] flex-1 rounded-xl bg-science px-4 py-2 font-heading font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save my thought'}
        </button>
        <button
          onClick={onDone}
          className="min-h-[44px] rounded-xl border border-black/10 px-4 py-2 text-sm text-muted transition-colors hover:bg-black/5"
        >
          Skip
        </button>
      </div>
    </motion.div>
  )
}
