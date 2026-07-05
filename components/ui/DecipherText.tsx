'use client'

import { useEffect, useRef } from 'react'

// The decifer-resolve motion: text settles from a scramble into clarity, the
// same idea the brand is named after. It renders the final text on the server
// and during hydration (so there is no layout shift, and it degrades to plain
// text with no JS), then decodes on the client after mount. Respects
// prefers-reduced-motion by leaving the final text in place.
//
// The brand mark is a locked SVG (DeciferMark) and must never be built from
// text characters. This component is only for words, never for the mark.

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
function randGlyph(): string {
  return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length))
}

type DecipherTextProps = {
  text: string
  className?: string
  as?: 'span' | 'div'
  /** ms between each character locking in; defaults to a length-aware value */
  perChar?: number
}

export function DecipherText({ text, className, as = 'span', perChar }: DecipherTextProps) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const host = ref.current
    if (!host) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return // leave the final text exactly as it rendered

    // Build fixed-width character cells inside per-word wrappers, so scrambling
    // glyphs never shift their neighbours and words never break mid-character.
    const cells: { el: HTMLSpanElement; ch: string }[] = []
    host.textContent = ''
    const words = text.split(' ')
    words.forEach((word, wi) => {
      const wrap = document.createElement('span')
      wrap.style.display = 'inline-block'
      wrap.style.whiteSpace = 'nowrap'
      for (const ch of word) {
        const cell = document.createElement('span')
        cell.style.display = 'inline-block'
        cell.style.textAlign = 'center'
        cell.textContent = ch
        wrap.appendChild(cell)
        cells.push({ el: cell, ch })
      }
      host.appendChild(wrap)
      if (wi < words.length - 1) {
        const space = document.createElement('span')
        space.style.whiteSpace = 'pre'
        space.textContent = ' '
        host.appendChild(space)
      }
    })
    // Lock each cell to its resolved width so the layout can never jitter.
    cells.forEach((c) => {
      c.el.style.minWidth = `${c.el.offsetWidth}px`
    })

    const NOISE = 'var(--text-muted, #796C5F)'
    const per = perChar ?? Math.max(30, Math.min(78, Math.round(760 / Math.max(cells.length, 1))))
    const cycle = 50 // ms between glyph swaps — calm, reads as decoding not error
    const locked = new Array(cells.length).fill(false)

    let raf = 0
    let start: number | null = null
    let lastSwap = 0

    function frame(t: number) {
      if (start === null) {
        start = t
        lastSwap = t - cycle
      }
      const elapsed = t - start
      const swap = t - lastSwap >= cycle
      if (swap) lastSwap = t
      let allLocked = true
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i]
        const lockAt = 120 + i * per
        if (elapsed >= lockAt) {
          if (!locked[i]) {
            locked[i] = true
            c.el.textContent = c.ch
            c.el.style.transition = 'color .22s ease'
            c.el.style.color = '' // settle to the inherited (final) colour
          }
        } else {
          allLocked = false
          if (swap) {
            c.el.textContent = randGlyph()
            c.el.style.color = NOISE
          }
        }
      }
      if (allLocked) return
      raf = requestAnimationFrame(frame)
    }

    // Play once, when the text scrolls into view.
    let io: IntersectionObserver | null = null
    const play = () => {
      raf = requestAnimationFrame(frame)
    }
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries, obs) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              play()
              obs.disconnect()
              break
            }
          }
        },
        { threshold: 0.4 },
      )
      io.observe(host)
    } else {
      play()
    }

    return () => {
      cancelAnimationFrame(raf)
      io?.disconnect()
      // Restore the clean final text if we unmount mid-animation.
      host.textContent = text
    }
  }, [text, perChar])

  const Tag = as as 'span'
  return (
    <Tag ref={ref as React.Ref<HTMLSpanElement>} className={className} aria-label={text}>
      {text}
    </Tag>
  )
}
