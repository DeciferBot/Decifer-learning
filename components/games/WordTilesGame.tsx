'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fireFeedback } from '@/lib/feedback'
import {
  BOARD_SIZE, PREMIUM_LAYOUT, createTileBag, drawTiles, type Premium,
} from '@/lib/games/scrabble-board'
import type { ScrabbleBoard } from '@/lib/games/scrabble-engine'
import { useBoardGame } from '@/lib/downtime/useBoardGame'
import type { GameResultInput } from '@/lib/games/results'
import { useGameResult, GameResultNote } from '@/components/games/GameResultNote'
import { OnlineLobby } from '@/components/games/OnlineLobby'
import { WaitingRoom, PlayAFriendDivider } from '@/components/games/OnlineBoardStatus'
import { RefreshCw, Star, X as ClearIcon } from '@/components/ui/icons'
import {
  GameShell, GameColumns, GameBackLink, GameToolbar, GameMessage, GameMenu, GameCrest, GameEndCard,
  menuHeadingLevel,
} from '@/components/games/GameChrome'

type Coord = { row: number; col: number }
type Pending = { row: number; col: number; rackIndex: number; letter: string; isBlank: boolean }

type WordTilesDifficulty = 'easy' | 'medium' | 'hard'

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', blurb: 'Short, simple words' },
  { id: 'medium', label: 'Medium', blurb: 'Solid words, still beatable' },
  { id: 'hard', label: 'Hard', blurb: 'Hunts down the big-point words' },
]

const PREMIUM_LABEL: Record<Exclude<Premium, null>, string> = { TW: 'TW', DW: 'DW', TL: 'TL', DL: 'DL' }
// Tints drawn from the brand families (ember, rose, indigo, azure) rather
// than four unrelated pastels. Every one measures ≥11.7:1 against --tw-ink,
// so the TW/DW/TL/DL label stays readable at 10px. See tokens.css §14.
const PREMIUM_COLOR: Record<Exclude<Premium, null>, string> = {
  TW: 'var(--game-prem-tw)',
  DW: 'var(--game-prem-dw)',
  TL: 'var(--game-prem-tl)',
  DL: 'var(--game-prem-dl)',
}

const KEYBOARD_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const

type MoveSummary = { by: 'host' | 'guest'; type: 'place' | 'pass' | 'exchange'; words: string[]; points: number } | null

type ScrabblePublicState = {
  board: ScrabbleBoard
  bagCount: number
  hostScore: number
  guestScore: number
  consecutivePasses: number
  lastMove: MoveSummary
}

/** The move shapes both modes send: to /api/downtime/games/[id]/move online,
 *  to /api/downtime/word-tiles/computer against the computer. Both routes
 *  re-validate everything server-side with the same engine + dictionary. */
type OutgoingMove =
  | { type: 'place'; tiles: { row: number; col: number; letter: string; isBlank: boolean }[] }
  | { type: 'pass' }
  | { type: 'exchange'; tiles: string[] }

type Screen = 'menu' | 'online-lobby'

/** Word Tiles — the classic tile-and-board word game. Play the computer on
 *  three difficulty levels (the opponent's moves come from the server, where
 *  the dictionary lives — see lib/games/scrabble-ai.ts), or a friend via
 *  invite code. */
export function WordTilesGame({
  backHref = '/downtime',
  intro,
}: {
  backHref?: string
  /** The public page's heading block. Used on the opening screen, where it
   *  becomes the left column beside the choices. Word Tiles has no board to
   *  show until a game exists, so there is no middle column here — see
   *  GameColumns. Once a game is running the board takes the full width. */
  intro?: ReactNode
}) {
  const [screen, setScreen] = useState<Screen>('menu')
  const [difficulty, setDifficulty] = useState<WordTilesDifficulty | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)

  function exitToMenu() {
    setScreen('menu')
    setDifficulty(null)
    setGameId(null)
  }

  if (gameId) {
    return <WordTilesOnlineGame gameId={gameId} backHref={backHref} onExit={exitToMenu} />
  }

  if (difficulty) {
    return <WordTilesComputerGame difficulty={difficulty} backHref={backHref} onExit={exitToMenu} />
  }

  if (screen === 'online-lobby') {
    return (
      <GameShell>
        <GameBackLink href={backHref} />
        <OnlineLobby gameType="scrabble" onReady={setGameId} onBack={() => setScreen('menu')} />
      </GameShell>
    )
  }

  return (
    <GameColumns
      intro={intro}
      topBar={<GameBackLink href={backHref} />}
      side={
        <GameMenu
          headingLevel={menuHeadingLevel(backHref)}
          crest={<GameCrest tone="paper" glyph={<LetterTile letter="W" size={44} />} />}
          title="Word Tiles"
          blurb="Build words on a shared board. Most points wins. Play the computer, or a friend."
          options={DIFFICULTIES}
          onPick={(id) => setDifficulty(id as WordTilesDifficulty)}
          footer={<PlayAFriendDivider onClick={() => setScreen('online-lobby')} />}
        />
      }
    />
  )
}

/**
 * A letter tile: ivory, bevelled, with a darker bottom edge so it reads as a
 * physical piece sitting on the board rather than a coloured square.
 */
function LetterTile({
  letter, size, state = 'placed',
}: {
  letter: string
  size?: number
  state?: 'placed' | 'pending' | 'selected' | 'swapping'
}) {
  const ring =
    state === 'pending'
      ? 'inset 0 0 0 2px var(--game-sel-ring)'
      : state === 'selected'
        ? 'inset 0 0 0 3px var(--game-sel-ring)'
        : state === 'swapping'
          ? 'inset 0 0 0 3px var(--game-danger)'
          : 'inset 0 0 0 1px var(--game-tile-edge)'
  return (
    <span
      className="flex items-center justify-center rounded-[5px] font-bold uppercase leading-none text-ink"
      style={{
        width: size ?? '100%',
        height: size ?? '100%',
        fontSize: size ? size * 0.55 : undefined,
        background: 'linear-gradient(180deg, var(--game-tile-lit) 0%, var(--game-tile) 62%, var(--game-tile-edge) 100%)',
        boxShadow: `${ring}, 0 1px 2px rgba(20,12,6,.30)`,
      }}
    >
      {letter}
    </span>
  )
}

/* ── The table both modes play on ──────────────────────────────────── */

/**
 * The board, the rack, and the move controls — everything between the score
 * strip and the end card. Both modes render this; only where a submitted
 * move goes differs (the online game record, or the vs-computer referee
 * route). It owns the tentative-placement state, so a "Play again" just
 * remounts it with a fresh key.
 */
function PlaySurface({
  board, rack, myTurn, onMove,
}: {
  board: ScrabbleBoard
  rack: string[] | null
  myTurn: boolean
  onMove: (move: OutgoingMove) => Promise<boolean>
}) {
  const [pending, setPending] = useState<Pending[]>([])
  const [selectedRackIndex, setSelectedRackIndex] = useState<number | null>(null)
  const [blankPromptFor, setBlankPromptFor] = useState<Coord | null>(null)
  const [exchangeMode, setExchangeMode] = useState(false)
  const [exchangeSelection, setExchangeSelection] = useState<Set<number>>(new Set())
  // Guards Play word / Pass / Swap against a double-tap firing two in-flight
  // requests — the server independently rejects a losing race as a
  // 'conflict' (see the move route), this just makes it rare in practice.
  const [submitting, setSubmitting] = useState(false)

  const pendingByCell = new Map(pending.map((p) => [`${p.row},${p.col}`, p]))
  const hiddenRackIndices = new Set(pending.map((p) => p.rackIndex))

  function pickRackTile(index: number) {
    if (!myTurn || hiddenRackIndices.has(index) || !rack) return
    if (exchangeMode) {
      setExchangeSelection((prev) => {
        const next = new Set(prev)
        if (next.has(index)) next.delete(index)
        else next.add(index)
        return next
      })
      return
    }
    setSelectedRackIndex(index === selectedRackIndex ? null : index)
  }

  function placeAt(row: number, col: number) {
    if (!myTurn || !rack || selectedRackIndex === null) return
    if (board[row][col] || pendingByCell.has(`${row},${col}`)) return
    const symbol = rack[selectedRackIndex]
    if (symbol === '_') {
      setBlankPromptFor({ row, col })
      return
    }
    setPending((prev) => [...prev, { row, col, rackIndex: selectedRackIndex, letter: symbol, isBlank: false }])
    setSelectedRackIndex(null)
    fireFeedback('correct')
  }

  function chooseBlankLetter(letter: string) {
    if (!blankPromptFor || selectedRackIndex === null) return
    setPending((prev) => [...prev, { ...blankPromptFor, rackIndex: selectedRackIndex, letter, isBlank: true }])
    setBlankPromptFor(null)
    setSelectedRackIndex(null)
    fireFeedback('correct')
  }

  function pickUpPending(row: number, col: number) {
    if (!myTurn) return
    setPending((prev) => prev.filter((p) => !(p.row === row && p.col === col)))
  }

  async function submitPlacement() {
    if (pending.length === 0 || submitting) return
    setSubmitting(true)
    const ok = await onMove({
      type: 'place',
      tiles: pending.map((p) => ({ row: p.row, col: p.col, letter: p.letter, isBlank: p.isBlank })),
    })
    setSubmitting(false)
    if (ok) {
      setPending([])
      fireFeedback('roundComplete')
    } else {
      fireFeedback('incorrect')
    }
  }

  async function submitPass() {
    if (submitting) return
    setSubmitting(true)
    const ok = await onMove({ type: 'pass' })
    setSubmitting(false)
    if (ok) setPending([])
  }

  async function submitExchange() {
    if (!rack || exchangeSelection.size === 0 || submitting) return
    setSubmitting(true)
    const tiles = [...exchangeSelection].map((i) => rack[i])
    const ok = await onMove({ type: 'exchange', tiles })
    setSubmitting(false)
    if (ok) {
      setExchangeMode(false)
      setExchangeSelection(new Set())
    }
  }

  // The board used to be pinned at 26px a cell, which overflowed a 375px
  // phone and never grew on a tablet. It now fills whatever width it gets,
  // down to a 20px floor.
  const cell = `clamp(20px, calc((min(100vw, 32rem) - 2.5rem) / ${BOARD_SIZE}), 34px)`
  const centre = Math.floor(BOARD_SIZE / 2)

  return (
    <>
      <div
        className="mx-auto w-fit max-w-full overflow-auto rounded-2xl p-2"
        style={{
          background: 'linear-gradient(180deg, var(--game-bezel-lip) 0%, var(--game-bezel) 55%, var(--game-table) 100%)',
          boxShadow: 'var(--game-lift)',
        }}
      >
        <div
          className="inline-grid overflow-hidden rounded-[6px]"
          style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cell})`, boxShadow: 'var(--game-inset)' }}
          role="group"
          aria-label="Word Tiles board"
        >
          {Array.from({ length: BOARD_SIZE }, (_, r) => (
            Array.from({ length: BOARD_SIZE }, (_, c) => {
              const committed = board[r][c]
              const pendingTile = pendingByCell.get(`${r},${c}`)
              const premium = PREMIUM_LAYOUT[r][c]
              const tile = committed ?? pendingTile
              const isCentre = r === centre && c === centre
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => (pendingTile ? pickUpPending(r, c) : placeAt(r, c))}
                  disabled={!myTurn || !!committed || (!pendingTile && selectedRackIndex === null)}
                  aria-label={
                    tile
                      ? `Row ${r + 1}, column ${c + 1}, ${tile.letter}`
                      : `Row ${r + 1}, column ${c + 1}${premium ? `, ${PREMIUM_LABEL[premium]}` : ''}`
                  }
                  className="relative flex items-center justify-center p-[1px] text-[9px] font-bold uppercase leading-none text-ink"
                  style={{
                    width: cell,
                    height: cell,
                    background: premium ? PREMIUM_COLOR[premium] : 'var(--game-paper)',
                    boxShadow: 'inset 0 0 0 0.5px rgb(var(--tw-ink) / 0.14)',
                  }}
                >
                  {tile ? (
                    <LetterTile letter={tile.letter} state={pendingTile ? 'pending' : 'placed'} />
                  ) : isCentre ? (
                    <Star className="h-3 w-3 text-ink-2" aria-hidden />
                  ) : premium ? (
                    PREMIUM_LABEL[premium]
                  ) : null}
                  {(committed?.isBlank || pendingTile?.isBlank) && (
                    <span
                      className="absolute bottom-[2px] right-[2px] h-1 w-1 rounded-full"
                      style={{ background: 'var(--game-sel-ring)' }}
                      aria-hidden
                    />
                  )}
                </button>
              )
            })
          ))}
        </div>
      </div>

      <PremiumKey />

      {rack && (
        <div
          className="rounded-2xl p-2.5"
          style={{
            background: 'linear-gradient(180deg, var(--game-bezel-lip) 0%, var(--game-bezel) 100%)',
            boxShadow: 'var(--game-lift)',
          }}
        >
          <div className="flex flex-wrap justify-center gap-2">
            {rack.map((symbol, i) => {
              const swapping = exchangeMode && exchangeSelection.has(i)
              const chosen = !exchangeMode && selectedRackIndex === i
              return (
                <button
                  key={i}
                  onClick={() => pickRackTile(i)}
                  disabled={!myTurn || hiddenRackIndices.has(i)}
                  aria-pressed={chosen || swapping}
                  aria-label={symbol === '_' ? 'Blank tile' : `Tile ${symbol}`}
                  className="transition-transform duration-150 disabled:opacity-25"
                  style={{ transform: chosen ? 'translateY(-6px)' : undefined }}
                >
                  <LetterTile
                    letter={symbol === '_' ? '?' : symbol}
                    size={42}
                    state={swapping ? 'swapping' : chosen ? 'selected' : 'placed'}
                  />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {myTurn && !exchangeMode && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={submitPlacement}
            disabled={pending.length === 0 || submitting}
            className="min-h-[48px] flex-1 rounded-xl bg-brand-600 px-4 font-heading text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:bg-black/10 disabled:text-muted"
          >
            Play word
          </button>
          <button
            onClick={() => setPending([])}
            disabled={pending.length === 0 || submitting}
            className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-black/10 bg-surface px-3 text-sm font-semibold text-ink-2 shadow-sm transition-colors hover:border-brand/40 disabled:opacity-40"
          >
            <ClearIcon className="h-4 w-4" aria-hidden /> Clear
          </button>
          <button
            onClick={() => setExchangeMode(true)}
            disabled={pending.length > 0 || submitting}
            className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-black/10 bg-surface px-3 text-sm font-semibold text-ink-2 shadow-sm transition-colors hover:border-brand/40 disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Swap
          </button>
          <button
            onClick={submitPass}
            disabled={pending.length > 0 || submitting}
            className="inline-flex min-h-[48px] items-center rounded-xl border border-black/10 bg-surface px-3 text-sm font-semibold text-ink-2 shadow-sm transition-colors hover:border-brand/40 disabled:opacity-40"
          >
            Pass
          </button>
        </div>
      )}

      {myTurn && exchangeMode && (
        <div className="flex gap-2">
          <button
            onClick={submitExchange}
            disabled={exchangeSelection.size === 0 || submitting}
            className="min-h-[48px] flex-1 rounded-xl bg-brand-600 px-4 font-heading text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:bg-black/10 disabled:text-muted"
          >
            Swap {exchangeSelection.size || ''} tile{exchangeSelection.size === 1 ? '' : 's'}
          </button>
          <button
            onClick={() => { setExchangeMode(false); setExchangeSelection(new Set()) }}
            disabled={submitting}
            className="inline-flex min-h-[48px] items-center rounded-xl border border-black/10 bg-surface px-4 text-sm font-semibold text-ink-2 shadow-sm disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      )}

      <AnimatePresence>
        {blankPromptFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={() => setBlankPromptFor(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Choose a letter for the blank tile"
              initial={{ y: 24 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm space-y-1.5 rounded-2xl bg-surface p-4 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-3 text-center text-sm font-bold text-ink">Blank tile. Which letter?</p>
              {KEYBOARD_ROWS.map((row) => (
                <div key={row} className="flex justify-center gap-1.5">
                  {row.split('').map((l) => (
                    <button
                      key={l}
                      onClick={() => chooseBlankLetter(l)}
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-background text-sm font-bold text-ink transition-colors hover:bg-brand/10 active:bg-brand/20"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ── Vs the computer ───────────────────────────────────────────────── */

type SoloState = {
  board: ScrabbleBoard
  playerRack: string[]
  aiRack: string[]
  bag: string[]
  playerScore: number
  aiScore: number
  consecutivePasses: number
}

function newSoloState(): SoloState {
  const bag = createTileBag()
  const playerRack = drawTiles(bag, 7)
  const aiRack = drawTiles(bag, 7)
  const board: ScrabbleBoard = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null))
  return { board, playerRack, aiRack, bag, playerScore: 0, aiScore: 0, consecutivePasses: 0 }
}

/** One line of "who just played what" — the vs-computer game shows the
 *  child's confirmed move and the computer's reply together, since both
 *  arrive in the same response. */
function moveLine(summary: MoveSummary, who: string): string | null {
  if (!summary) return null
  if (summary.type === 'pass') return `${who} passed`
  if (summary.type === 'exchange') return `${who} swapped tiles`
  return `${who} played ${summary.words.join(', ')} for ${summary.points} points`
}

/**
 * Local game against the computer. The client holds the whole game
 * (board, both racks, bag) and every "Play word" round-trips it to
 * /api/downtime/word-tiles/computer, which validates the child's move
 * against the real dictionary and answers with the computer's reply —
 * the word list never ships to the browser.
 */
function WordTilesComputerGame({
  difficulty, backHref, onExit,
}: {
  difficulty: WordTilesDifficulty
  backHref: string
  onExit: () => void
}) {
  const [state, setState] = useState<SoloState>(newSoloState)
  const [thinking, setThinking] = useState(false)
  const [playerMove, setPlayerMove] = useState<MoveSummary>(null)
  const [aiMove, setAiMove] = useState<MoveSummary>(null)
  const [errorKind, setErrorKind] = useState<'rejected' | 'network' | null>(null)
  const [end, setEnd] = useState<'win' | 'loss' | 'draw' | null>(null)
  // Bumped on every restart, so a response still in flight when "Play
  // again" is tapped gets discarded instead of landing on the fresh board.
  const epochRef = useRef(0)
  const [round, setRound] = useState(0)

  const result = useMemo<GameResultInput | null>(() => {
    if (!end) return null
    // The end-of-game rack adjustment can push a score below zero;
    // downtime_results only stores 0+.
    return { gameType: 'word-tiles', mode: 'computer', outcome: end, difficulty, score: Math.max(0, state.playerScore) }
  }, [end, difficulty, state.playerScore])
  const saveStatus = useGameResult(result)

  async function submitMove(move: OutgoingMove): Promise<boolean> {
    if (thinking || end) return false
    setThinking(true)
    setErrorKind(null)
    const epoch = epochRef.current
    try {
      const res = await fetch('/api/downtime/word-tiles/computer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...state, move, difficulty }),
      })
      if (epoch !== epochRef.current) return false
      if (!res.ok) {
        setErrorKind(res.status === 422 ? 'rejected' : 'network')
        return false
      }
      const data = await res.json() as SoloState & {
        playerMove: MoveSummary
        aiMove: MoveSummary
        winner: 'you' | 'computer' | 'draw' | null
      }
      if (epoch !== epochRef.current) return false
      setState({
        board: data.board,
        playerRack: data.playerRack,
        aiRack: data.aiRack,
        bag: data.bag,
        playerScore: data.playerScore,
        aiScore: data.aiScore,
        consecutivePasses: data.consecutivePasses,
      })
      setPlayerMove(data.playerMove)
      setAiMove(data.aiMove)
      if (data.winner) setEnd(data.winner === 'you' ? 'win' : data.winner === 'draw' ? 'draw' : 'loss')
      return true
    } catch {
      if (epoch === epochRef.current) setErrorKind('network')
      return false
    } finally {
      if (epoch === epochRef.current) setThinking(false)
    }
  }

  function restart() {
    epochRef.current += 1
    setState(newSoloState())
    setThinking(false)
    setPlayerMove(null)
    setAiMove(null)
    setErrorKind(null)
    setEnd(null)
    setRound((r) => r + 1)
  }

  const myTurn = !thinking && !end
  const playerLine = moveLine(playerMove, 'You')
  const aiLine = moveLine(aiMove, 'Computer')

  return (
    <GameShell width="lg">
      <GameToolbar backHref={backHref} onBack={onExit} onReset={restart} />

      <ScoreBar
        myScore={state.playerScore}
        opponentName="Computer"
        opponentScore={state.aiScore}
        bagCount={state.bag.length}
        myTurn={myTurn}
        finished={!!end}
        waitingText="Computer is thinking…"
      />

      {(playerLine || aiLine) && !errorKind && (
        <p className="text-center text-xs text-ink-2">
          {playerLine}
          {playerLine && aiLine && <span aria-hidden> · </span>}
          {aiLine && <span className="font-semibold text-ink">{aiLine}</span>}
        </p>
      )}
      {errorKind && (
        <p role="alert" className="text-center text-xs font-semibold text-[color:var(--game-danger)]">
          {errorKind === 'rejected'
            ? "That move isn't allowed. Try again."
            : "Couldn't reach the game. Check your connection and try again."}
        </p>
      )}

      <PlaySurface key={round} board={state.board} rack={state.playerRack} myTurn={myTurn} onMove={submitMove} />

      <AnimatePresence>
        {end && (
          <GameEndCard
            outcome={end}
            title={end === 'win' ? 'You won!' : end === 'draw' ? "It's a draw" : 'Good game!'}
            detail={`Final score. You: ${state.playerScore}, Computer: ${state.aiScore}`}
            actionLabel="Play again"
            onAction={restart}
            secondary={saveStatus ? <GameResultNote status={saveStatus} /> : undefined}
          />
        )}
      </AnimatePresence>
    </GameShell>
  )
}

/* ── Online, with a friend ─────────────────────────────────────────── */

function WordTilesOnlineGame({ gameId, backHref, onExit }: { gameId: string; backHref: string; onExit: () => void }) {
  const { game, side, inviteCode, rack, ready, notFound, moveError, sendMove } = useBoardGame(gameId)

  // Hooks must run before the early returns below. A finished game goes into
  // the player's history with their final score; guests get the register
  // invitation instead (see GameResultNote).
  const winner = game?.winner ?? null
  const finalScore = useMemo(() => {
    if (!game || !side) return null
    const s = game.state as ScrabblePublicState | null
    if (!s) return null
    return side === 'host' ? s.hostScore : s.guestScore
  }, [game, side])
  const result = useMemo<GameResultInput | null>(() => {
    if (!winner || !side) return null
    return {
      gameType: 'word-tiles',
      mode: 'friend',
      outcome: winner === side ? 'win' : winner === 'draw' ? 'draw' : 'loss',
      // The end-of-game rack adjustment can push a score below zero;
      // downtime_results only stores 0+.
      score: finalScore != null ? Math.max(0, finalScore) : undefined,
    }
  }, [winner, side, finalScore])
  const saveStatus = useGameResult(result)

  if (!ready) return <GameMessage backHref={backHref} text="Loading…" />
  if (notFound) return <GameMessage backHref={backHref} text="That game couldn't be found." />
  if (!side || !game) return <GameMessage backHref={backHref} text="This game isn't yours." />

  if (game.status === 'waiting') {
    return (
      <GameShell>
        <GameBackLink href={backHref} onClick={onExit} />
        <WaitingRoom inviteCode={inviteCode} onCancel={onExit} />
      </GameShell>
    )
  }

  const state = game.state as ScrabblePublicState
  const myTurn = game.status === 'active' && game.turn === side
  const won = game.winner
  const myScore = side === 'host' ? state.hostScore : state.guestScore
  const opponentScore = side === 'host' ? state.guestScore : state.hostScore
  const opponentName = side === 'host' ? (game.guest_display_name ?? 'Friend') : game.host_display_name

  return (
    <GameShell width="lg">
      <GameBackLink href={backHref} onClick={onExit} />

      <ScoreBar
        myScore={myScore}
        opponentName={opponentName}
        opponentScore={opponentScore}
        bagCount={state.bagCount}
        myTurn={myTurn}
        finished={!!won}
      />

      {state.lastMove?.type === 'place' && (
        <p className="text-center text-xs text-ink-2">
          {state.lastMove.by === side ? 'You' : opponentName} played{' '}
          <span className="font-semibold text-ink">{state.lastMove.words.join(', ')}</span> for {state.lastMove.points} points
        </p>
      )}
      {moveError && (
        <p role="alert" className="text-center text-xs font-semibold text-[color:var(--game-danger)]">
          That move isn&apos;t allowed. Try again.
        </p>
      )}

      <PlaySurface board={state.board} rack={rack} myTurn={myTurn && !won} onMove={(move) => sendMove(move)} />

      <AnimatePresence>
        {won && (
          <GameEndCard
            outcome={won === side ? 'win' : won === 'draw' ? 'draw' : 'loss'}
            title={won === side ? 'You won!' : won === 'draw' ? "It's a draw" : 'Good game!'}
            detail={`Final score. You: ${myScore}, ${opponentName}: ${opponentScore}`}
            actionLabel={backHref === '/downtime' ? 'Back to Downtime' : 'Back to Games'}
            onAction={onExit}
            secondary={saveStatus ? <GameResultNote status={saveStatus} /> : undefined}
          />
        )}
      </AnimatePresence>
    </GameShell>
  )
}

/** Scores, tiles left, and whose turn it is, in one strip. Whose turn it is
 *  is the thing a player checks most, so it gets the emphasis. */
function ScoreBar({
  myScore, opponentName, opponentScore, bagCount, myTurn, finished, waitingText,
}: {
  myScore: number
  opponentName: string
  opponentScore: number
  bagCount: number
  myTurn: boolean
  finished: boolean
  waitingText?: string
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-surface shadow-sm">
      <div className="flex items-stretch">
        <Score name="You" score={myScore} active={myTurn && !finished} />
        <div className="flex w-20 shrink-0 flex-col items-center justify-center border-x border-black/[0.07] px-1 py-2">
          <span className="font-mono text-sm font-bold tabular-nums text-ink">{bagCount}</span>
          <span className="text-[10px] text-muted">in the bag</span>
        </div>
        <Score name={opponentName} score={opponentScore} active={!myTurn && !finished} align="right" />
      </div>
      {!finished && (
        <p
          aria-live="polite"
          className={`px-3 py-1.5 text-center text-xs font-bold ${myTurn ? 'bg-brand/10 text-brand-700' : 'bg-black/[0.03] text-ink-2'}`}
        >
          {myTurn ? 'Your turn' : (waitingText ?? `Waiting for ${opponentName}…`)}
        </p>
      )}
    </div>
  )
}

function Score({
  name, score, active, align = 'left',
}: {
  name: string
  score: number
  active: boolean
  align?: 'left' | 'right'
}) {
  return (
    <div className={`min-w-0 flex-1 px-3 py-2 ${align === 'right' ? 'text-right' : ''} ${active ? 'bg-brand/[0.06]' : ''}`}>
      <p className="truncate text-xs text-muted">{name}</p>
      <p className="font-mono text-xl font-bold tabular-nums text-ink">{score}</p>
    </div>
  )
}

/** What TW/DW/TL/DL mean. The board is unreadable to a first-time player
 *  without it, and every physical set prints the same legend on the box. */
function PremiumKey() {
  const keys: [Exclude<Premium, null>, string][] = [
    ['TW', 'Triple word'],
    ['DW', 'Double word'],
    ['TL', 'Triple letter'],
    ['DL', 'Double letter'],
  ]
  return (
    <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[11px] text-ink-2">
      {keys.map(([k, label]) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="flex h-4 w-4 items-center justify-center rounded-[3px] text-[8px] font-bold text-ink"
            style={{ background: PREMIUM_COLOR[k], boxShadow: 'inset 0 0 0 0.5px rgb(var(--tw-ink) / 0.20)' }}
          >
            {k}
          </span>
          {label}
        </li>
      ))}
    </ul>
  )
}
