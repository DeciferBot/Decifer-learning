'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { WinBurst } from '@/components/quiz/WinBurst'
import { ChevronLeft, RefreshCw, Trophy, Scale } from '@/components/ui/icons'

/**
 * Shared chrome for the five board games.
 *
 * Chess, Checkers, Connect 4, Crossword and Word Tiles each used to carry
 * their own copy of the back link, the "pick a difficulty" card, the player
 * strip and the end screen — five near-identical versions that had already
 * drifted apart (different paddings, different heading sizes, a "Back to
 * Downtime" button on a page whose back link said "Games"). One set of
 * primitives here means a change lands on every game at once, and a child
 * moving between games meets the same shapes each time.
 *
 * Every surface below reads its colour from styles/tokens.css §14. No raw
 * hex in this file, or in any game that uses it.
 */

/* ── Page scaffolding ──────────────────────────────────────────────── */

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' } as const

export function GameShell({
  width = 'sm',
  children,
}: {
  width?: keyof typeof WIDTHS
  children: ReactNode
}) {
  return <div className={`mx-auto w-full ${WIDTHS[width]} space-y-4`}>{children}</div>
}

/**
 * The wide layout a board game gets once there is room for it: the page's
 * heading block down the left, the board in the middle, the controls on the
 * right. Below `lg` it collapses to the single stacked column the games have
 * always had on a phone.
 *
 * Stacked on a phone the order is intro, BOARD, then the controls. The board
 * comes second on purpose: this is a page about a board, and burying it under
 * a heading block and three buttons meant a phone showed no game at all until
 * you scrolled. `order` handles the phone; the explicit column and row
 * placement takes over at `lg`, where order has no effect.
 *
 * `topBar` spans the full width above the columns, so the back link stays at
 * the top of a phone screen instead of travelling under the board with the
 * rest of the controls.
 *
 * Both `intro` and `board` are optional, and the column count follows. Inside
 * the child app the game IS the page, so there is no heading block and no
 * left column. Word Tiles and the Crossword have nothing to show before you
 * have picked a puzzle, so on their opening screen there is no middle column
 * either and the layout is simply text beside choices.
 */
export function GameColumns({
  intro,
  side,
  board,
  topBar,
}: {
  intro?: ReactNode
  side: ReactNode
  board?: ReactNode
  topBar?: ReactNode
}) {
  const columns = board
    ? intro
      ? 'lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,19rem)]'
      : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]'
    : intro
      ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]'
      : ''
  const sideColumn = board ? (intro ? 'lg:col-start-3' : 'lg:col-start-2') : intro ? 'lg:col-start-2' : ''
  return (
    <div className="w-full space-y-4">
      {topBar}
      <div className={`grid w-full grid-cols-1 gap-6 lg:items-start lg:gap-8 ${columns}`}>
        {intro && <div className="order-1 lg:col-start-1 lg:row-start-1">{intro}</div>}
        <div className={`order-3 mx-auto w-full max-w-[30rem] space-y-4 lg:row-start-1 lg:max-w-none ${sideColumn}`}>
          {side}
        </div>
        {/* Capped and centred while the page is one column: on a tablet the
            board would otherwise stretch to the full 700-odd pixels of text
            measure, which is a bigger chessboard than anyone wants and pushes
            everything else off the screen. The cap is lifted at `lg`, where
            the middle column already bounds it. */}
        {board && (
          <div
            className={`order-2 mx-auto w-full max-w-[30rem] space-y-3 lg:row-start-1 lg:max-w-none ${
              intro ? 'lg:col-start-2' : 'lg:col-start-1'
            }`}
          >
            {board}
          </div>
        )}
      </div>
    </div>
  )
}

export function GameBackLink({ href, onClick }: { href: string; onClick?: () => void }) {
  // The same components render inside the logged-in Downtime section and on
  // the public, no-login /games/* pages — the label follows whichever one
  // this instance actually links back to.
  const label = href === '/downtime' ? 'Downtime' : 'Games'
  return (
    <Link
      href={href}
      onClick={onClick}
      className="inline-flex min-h-[48px] items-center gap-1 rounded-xl px-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-black/5"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden /> {label}
    </Link>
  )
}

/** Back link on the left, "new game" on the right. */
export function GameToolbar({
  backHref,
  onBack,
  resetLabel,
  onReset,
}: {
  backHref: string
  onBack?: () => void
  resetLabel?: string
  onReset?: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <GameBackLink href={backHref} onClick={onBack} />
      {onReset && (
        <button
          onClick={onReset}
          className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-2 transition-colors hover:bg-black/5"
        >
          <RefreshCw className="h-4 w-4" aria-hidden /> {resetLabel ?? 'New game'}
        </button>
      )}
    </div>
  )
}

export function GameMessage({ backHref, text }: { backHref: string; text: string }) {
  return (
    <GameShell>
      <GameBackLink href={backHref} />
      <p className="rounded-2xl border border-black/5 bg-surface p-6 text-center text-sm text-ink-2 shadow-sm">
        {text}
      </p>
    </GameShell>
  )
}

/* ── The menu every game opens on ──────────────────────────────────── */

export type GameOption = {
  id: string
  label: string
  blurb?: string
  /** Rendered ahead of the label. A crossword theme's emoji, say. */
  glyph?: ReactNode
}

/**
 * The landing card: title, one line of orientation, then the choices.
 *
 * The old version nested bordered buttons inside a bordered card and leaned
 * on a 48px emoji for identity. This one drops the outer card so the options
 * are the only boxes on screen, and gives the game its identity through the
 * crest — a real object, lit from above, instead of an emoji.
 *
 * On the public /games/<slug> routes the header is suppressed entirely: that
 * page already renders an h1, the rules line and the mode chips above this
 * component, so a crest plus "Chess" plus "Play the computer…" underneath
 * "Play Chess Online Free" was the same thing said twice.
 *
 * The options carry NO entrance animation on purpose. They used to fade in
 * from opacity 0, which meant any renderer that does not run rAF — a
 * background tab, a headless screenshot, a browser that fails to hydrate —
 * showed an empty gap where the difficulty choices should be. A menu is not
 * worth gating behind JavaScript.
 */
export function GameMenu({
  crest,
  title,
  blurb,
  options,
  onPick,
  footer,
  headingLevel = 1,
}: {
  crest: ReactNode
  title: string
  blurb: string
  options: GameOption[]
  onPick: (id: string) => void
  footer?: ReactNode
  /** See `menuHeadingLevel` below. */
  headingLevel?: 1 | 2
}) {
  return (
    <div className="space-y-5">
      {headingLevel === 1 && (
        <header className="flex flex-col items-center text-center">
          <div className="mb-3">{crest}</div>
          <h1 className="font-heading text-2xl font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
          <p className="mt-1 max-w-[36ch] text-pretty text-sm text-ink-2">{blurb}</p>
        </header>
      )}

      <div className="space-y-2.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className="group flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-black/[0.07] bg-surface px-4 py-3 text-left shadow-sm transition-[background-color,border-color,transform] duration-150 hover:border-brand/40 hover:bg-brand/[0.04] active:scale-[0.99]"
          >
            {o.glyph && <span className="text-2xl leading-none" aria-hidden>{o.glyph}</span>}
            <span className="min-w-0 flex-1">
              <span className="block font-heading font-bold text-ink">{o.label}</span>
              {o.blurb && <span className="block text-xs text-ink-2">{o.blurb}</span>}
            </span>
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full bg-black/10 transition-colors group-hover:bg-brand"
            />
          </button>
        ))}
      </div>

      {footer}
    </div>
  )
}

/**
 * Which heading level a game's own menu title should use.
 *
 * Inside the child app (/downtime/chess) the game IS the page, so its title
 * is the h1. On the public pages (/games/chess) the route already renders an
 * h1 carrying the search-facing title, so the menu drops to h2. Both surfaces
 * used to emit an h1, which meant every public game page shipped two.
 *
 * `backHref` is the existing signal for "which surface am I on" — GameBackLink
 * already derives its label from it — so nothing new has to be threaded down.
 */
export function menuHeadingLevel(backHref: string): 1 | 2 {
  return backHref === '/downtime' ? 1 : 2
}

/**
 * A game's crest: the piece that says which game you are in. A wooden disc
 * with the game's glyph pressed into it, matched to the board it opens.
 */
export function GameCrest({ glyph, tone = 'wood' }: { glyph: ReactNode; tone?: 'wood' | 'indigo' | 'paper' }) {
  const surface =
    tone === 'indigo'
      ? 'linear-gradient(160deg, var(--game-c4-cabinet) 0%, var(--game-c4-cabinet-deep) 100%)'
      : tone === 'paper'
        ? 'linear-gradient(160deg, var(--game-tile) 0%, var(--game-tile-edge) 100%)'
        : 'linear-gradient(160deg, var(--game-sq-light) 0%, var(--game-sq-dark) 100%)'
  const ink = tone === 'indigo' ? 'var(--game-piece-light)' : 'var(--game-piece-dark)'
  return (
    <span
      aria-hidden
      className="flex h-20 w-20 items-center justify-center rounded-full text-4xl leading-none"
      style={{
        background: surface,
        color: ink,
        boxShadow: 'var(--game-lift), inset 0 -3px 0 rgba(20,12,6,.22), inset 0 2px 0 rgba(255,245,230,.35)',
      }}
    >
      {glyph}
    </span>
  )
}

/* ── The board's frame ─────────────────────────────────────────────── */

/**
 * The wooden frame a chess or checkers board sits recessed inside, the way a
 * real one does. This is the whole immersion move: without it a board is a
 * flat rectangle of coloured divs floating on a white card.
 *
 * Only the two 8x8 boards use it. Connect 4's cabinet and Word Tiles' rack
 * are built where they are used, because both need structure this cannot
 * give them — bored holes with a gap grid in one case, a scrolling 15x15
 * surface in the other. A `tone` prop covering all three looked tidier and
 * was three code paths where two of them never ran.
 */
export function BoardFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[20px] p-[7px] ${className}`}
      style={{
        background:
          'linear-gradient(180deg, var(--game-bezel-lip) 0%, var(--game-bezel) 45%, var(--game-table) 100%)',
        boxShadow: 'var(--game-lift)',
      }}
    >
      <div className="overflow-hidden rounded-[13px]" style={{ boxShadow: 'var(--game-inset)' }}>
        {children}
      </div>
    </div>
  )
}

/* ── Who is playing, and what is happening ─────────────────────────── */

/**
 * The strip above the board. A dot the colour of your pieces, your name, and
 * a live status in the middle. The status is `aria-live` so a screen reader
 * hears "Computer is thinking" and "Check!" without hunting for it.
 */
export function PlayerStrip({
  you,
  them,
  status,
}: {
  you: { name: string; swatch: string; active?: boolean }
  them: { name: string; swatch: string; active?: boolean }
  status?: { text: string; tone: 'neutral' | 'alert' } | null
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 text-sm">
      <Seat {...you} />
      <p
        aria-live="polite"
        className={`min-w-0 flex-1 truncate text-center text-xs font-bold ${
          status?.tone === 'alert' ? 'text-[color:var(--game-danger)]' : 'text-ink-2'
        }`}
      >
        {status?.text ?? ''}
      </p>
      <Seat {...them} align="right" />
    </div>
  )
}

function Seat({
  name,
  swatch,
  active,
  align = 'left',
}: {
  name: string
  swatch: string
  active?: boolean
  align?: 'left' | 'right'
}) {
  const dot = (
    <span
      aria-hidden
      className="h-3.5 w-3.5 shrink-0 rounded-full"
      style={{ background: swatch, boxShadow: 'inset 0 0 0 1.5px rgba(20,12,6,.28)' }}
    />
  )
  return (
    <span
      className={`inline-flex max-w-[38%] items-center gap-1.5 rounded-full px-2 py-1 font-semibold transition-colors ${
        active ? 'bg-brand/10 text-ink' : 'text-ink-2'
      }`}
    >
      {align === 'left' && dot}
      <span className="truncate">{name}</span>
      {align === 'right' && dot}
    </span>
  )
}

/* ── How a game ends ───────────────────────────────────────────────── */

export type GameOutcome = 'win' | 'draw' | 'loss'

/**
 * One end screen for all five games. The caller supplies its own
 * actionLabel/onAction, so a game can offer "Play again" or "Back to Games"
 * as it needs while everything around it stays identical. The five games used
 * to carry eight hand-written copies of this card between them, which is how
 * one of them ended up offering "Back to Downtime" on a page whose back link
 * said "Games".
 */
export function GameEndCard({
  outcome,
  title,
  detail,
  actionLabel,
  onAction,
  secondary,
}: {
  outcome: GameOutcome
  title: string
  detail?: string
  actionLabel: string
  onAction: () => void
  secondary?: ReactNode
}) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-black/[0.07] bg-surface p-6 text-center shadow-sm"
    >
      {outcome === 'win' && <WinBurst />}
      <div className="relative mb-3 flex justify-center">
        {outcome === 'win' ? (
          <Trophy className="h-11 w-11 text-points-gold" aria-hidden />
        ) : outcome === 'draw' ? (
          <Scale className="h-11 w-11 text-ink-2" aria-hidden />
        ) : (
          <RefreshCw className="h-11 w-11 text-ink-2" aria-hidden />
        )}
      </div>
      <h2 className="relative font-heading text-xl font-extrabold tracking-[-0.02em] text-ink">{title}</h2>
      {detail && <p className="relative mx-auto mt-1 max-w-[34ch] text-pretty text-sm text-ink-2">{detail}</p>}
      <button
        onClick={onAction}
        className="relative mt-5 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-6 font-heading font-bold text-white transition-colors hover:bg-brand-700"
      >
        {actionLabel}
      </button>
      {secondary && <div className="relative mt-3">{secondary}</div>}
    </motion.div>
  )
}
