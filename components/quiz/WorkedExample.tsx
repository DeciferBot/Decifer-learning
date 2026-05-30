'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Props = {
  example: string
}

export function WorkedExample({ example }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-bold text-explorer underline-offset-2 hover:underline"
      >
        <span>{open ? '▾' : '▸'}</span>
        {open ? 'Hide worked example' : 'Show me how →'}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="worked"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-explorer/30 bg-explorer/5 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-explorer">
                📖 Worked Example
              </p>
              {/* Render newlines as paragraphs for step-by-step readability */}
              <div className="space-y-1.5">
                {example.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink">
                    {line}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                Now try the question yourself — your question uses different numbers.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
