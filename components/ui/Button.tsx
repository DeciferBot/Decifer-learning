'use client'

// The button.
//
// Until now there wasn't one. 211 buttons were typed out by hand across the
// product, each picking its own corner size, its own shadow, often its own raw
// colour, and none of them using the motion curves in styles/tokens.css. That
// is why the interface reads as flat paperwork: there was no single place to
// make a button feel pressable, so nobody ever did.
//
// Shape and motion both come from the tokens. Ember, Indigo and Geist are
// untouched. This adds depth and response, not a repaint.
//
// Press behaviour follows two rules that matter more than they look:
//   - the press is felt in 80ms (--duration-instant), because feedback slower
//     than about 100ms stops feeling like a response to the finger;
//   - the release settles on --ease-out, a real curve, so the button lands
//     rather than snapping.

import { forwardRef } from 'react'
import Link from 'next/link'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

// Body colour, text colour, and the darker slab beneath it that gives the
// button a physical edge to sink onto.
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white border-brand-700 hover:bg-brand',
  secondary: 'bg-surface text-ink border-black/12 hover:bg-black/[0.03]',
  quiet: 'bg-transparent text-ink border-transparent shadow-none hover:bg-black/[0.04]',
  danger: 'bg-incorrect text-white border-incorrect-700 hover:brightness-105',
}

// Every size clears 48px, the project's tap-target floor for children.
const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-[48px] px-4 text-sm gap-1.5',
  md: 'min-h-[52px] px-6 text-base gap-2',
  lg: 'min-h-[60px] px-8 text-lg gap-2.5',
}

const BASE = [
  'inline-flex items-center justify-center',
  // border-b-4 is the slab; the press swaps it for border-b-1 and moves the
  // button down by the same 3px, so the button sinks onto its own base rather
  // than the whole thing sliding down the page.
  'rounded-md border-2 border-b-4',
  'font-semibold tracking-[-0.01em] text-center',
  'shadow-clay-sm',
  'transition-[transform,box-shadow,background-color,border-color]',
  'duration-fast ease-out',
  'active:translate-y-[3px] active:border-b-2 active:shadow-clay-pressed active:duration-instant',
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/35',
  'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none',
  // A child tapping fast must not select the label text.
  'select-none cursor-pointer touch-manipulation',
  // Hover belongs to mice. On a tablet it fires on tap and sticks.
  '[@media(hover:none)]:hover:bg-inherit',
  // Someone who has asked their device to stop moving things gets colour
  // feedback only, never movement.
  'motion-reduce:transition-none motion-reduce:active:translate-y-0',
].join(' ')

type Shared = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Stretch to the width of the parent. Common on phones. */
  block?: boolean
  className?: string
  children: React.ReactNode
}

type ButtonProps = Shared &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    /** Shows a spinner, blocks input, and keeps the label so width never jumps. */
    loading?: boolean
  }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, loading, disabled, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
})

type ButtonLinkProps = Shared & Omit<React.ComponentProps<typeof Link>, 'className' | 'children'>

/** The same object, when it is really a link. Keeps the two visually identical. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  block,
  className = '',
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Link>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 flex-none animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
