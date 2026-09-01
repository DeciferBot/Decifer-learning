'use client'

// Card and Masonry: the two missing pieces of furniture.
//
// The card shape was typed out by hand 271 times across the product, each copy
// choosing its own corner and its own faint shadow. That is why nothing on
// screen looks like an object you could pick up.
//
// Masonry is here rather than a plain grid on purpose. A grid of identical
// boxes is the thing that makes a child's home screen read as a spreadsheet:
// every item claims the same importance, so none of them pull. Letting cards
// keep their natural height, and letting a few be deliberately bigger, is what
// creates somewhere for the eye to land first.

import Link from 'next/link'

export type CardTone = 'plain' | 'brand' | 'success' | 'warning'
export type CardLift = 'flat' | 'raised' | 'floating'

const TONE: Record<CardTone, string> = {
  plain: 'bg-surface border-black/8',
  brand: 'bg-brand/5 border-brand/25',
  success: 'bg-correct/8 border-correct/30',
  warning: 'bg-points-gold/10 border-points-gold/35',
}

const LIFT: Record<CardLift, string> = {
  flat: 'shadow-none',
  raised: 'shadow-clay-sm',
  floating: 'shadow-clay',
}

const CARD_BASE = 'rounded-lg border-2 p-5 break-inside-avoid'

type CardProps = {
  tone?: CardTone
  lift?: CardLift
  className?: string
  children: React.ReactNode
}

export function Card({ tone = 'plain', lift = 'raised', className = '', children }: CardProps) {
  return (
    <div className={`${CARD_BASE} ${TONE[tone]} ${LIFT[lift]} ${className}`}>{children}</div>
  )
}

type CardLinkProps = CardProps & Omit<React.ComponentProps<typeof Link>, 'className' | 'children'>

/**
 * A card that is the tap target. Rises slightly under a mouse and sinks under
 * a finger, so a child can tell the whole thing is pressable, not just a link
 * buried inside it.
 */
export function CardLink({
  tone = 'plain',
  lift = 'raised',
  className = '',
  children,
  ...rest
}: CardLinkProps) {
  return (
    <Link
      className={[
        CARD_BASE,
        TONE[tone],
        LIFT[lift],
        'block select-none touch-manipulation',
        'transition-[transform,box-shadow] duration-fast ease-out',
        '[@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-clay',
        'active:translate-y-[2px] active:shadow-clay-pressed active:duration-instant',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/35',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </Link>
  )
}

/**
 * Stacked columns that keep each card's natural height.
 *
 * Uses CSS columns rather than a grid, so there are no breakpoint gymnastics
 * and no measuring in JavaScript: the browser balances the columns itself and
 * it works with the page turned off. Children need `break-inside-avoid`, which
 * Card already carries.
 *
 * One column on a phone, because a 375px screen has no room for two and a
 * child scrolling one clear list beats hunting across a wall.
 */
export function Masonry({
  columns = 3,
  className = '',
  children,
}: {
  /** Columns at the widest size. Phones are always 1, tablets always 2. */
  columns?: 2 | 3 | 4
  className?: string
  children: React.ReactNode
}) {
  const widest = { 2: 'lg:columns-2', 3: 'lg:columns-3', 4: 'lg:columns-4' }[columns]
  return (
    <div className={`columns-1 gap-4 sm:columns-2 sm:gap-5 ${widest} ${className}`}>
      {children}
    </div>
  )
}

/**
 * Vertical spacing between stacked cards. Kept as its own piece because CSS
 * columns space horizontally, not vertically: every card in a stack needs its
 * own bottom margin or they touch.
 */
export function MasonryItem({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`mb-4 break-inside-avoid sm:mb-5 ${className}`}>{children}</div>
}
