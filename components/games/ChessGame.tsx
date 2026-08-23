'use client'

import { useCallback, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { fireFeedback } from '@/lib/feedback'
import { pickComputerMove, type ChessDifficulty } from '@/lib/games/chess-ai'
import { capturedMaterial } from '@/lib/games/chess-material'
import { ChessPieceArt, type PieceType } from '@/components/games/ChessPieceArt'
import { useBoardGame } from '@/lib/downtime/useBoardGame'
import { OnlineLobby } from '@/components/games/OnlineLobby'
import { WaitingRoom, TurnBanner, PlayAFriendDivider } from '@/components/games/OnlineBoardStatus'
import {
  GameShell, GameBackLink, GameToolbar, GameMessage, GameMenu, GameCrest,
  BoardFrame, PlayerStrip, GameEndCard,
  menuHeadingLevel,
} from '@/components/games/GameChrome'

const PIECE_NAME: Record<string, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', blurb: 'A relaxed opponent, good for learning the moves' },
  { id: 'medium', label: 'Medium', blurb: 'Plays sensibly, still beatable' },
  { id: 'hard', label: 'Hard', blurb: 'Thinks ahead. Your best game.' },
]

type EndState = 'win' | 'loss' | 'draw' | null
type Screen = 'difficulty' | 'online-lobby'

/**
 * Chess — against the computer, or against a friend via invite code. In
 * computer mode the child always plays White; the AI (lib/games/chess-ai.ts)
 * plays Black. Online, the host plays White and the guest plays Black.
 * Computer mode is the default landing screen; "play a friend" is a
 * secondary option. Pawns always promote to a queen — choosing an
 * under-promotion is a real (if rare) part of chess, but the choice-of-piece
 * modal it needs is cut from this first pass; queen is what almost every
 * promotion wants anyway.
 */
export function ChessGame({ backHref = '/downtime' }: { backHref?: string }) {
  const [screen, setScreen] = useState<Screen>('difficulty')
  const [difficulty, setDifficulty] = useState<ChessDifficulty | null>(null)
  const [onlineGameId, setOnlineGameId] = useState<string | null>(null)

  const gameRef = useRef(new Chess())
  // Bumped on every restart. A computer move is scheduled on a timer, and a
  // "New game" tapped during that think used to leave the timer alive: it
  // then fired against the FRESH board — where it is White's turn — and
  // pickComputerMove plays whichever side is to move, so the computer made a
  // move with the child's own White pieces and the game soft-locked on
  // Black's turn. The epoch check discards any move scheduled before a reset.
  const epochRef = useRef(0)
  const [fen, setFen] = useState(() => gameRef.current.fen())
  const [selected, setSelected] = useState<Square | null>(null)
  const [thinking, setThinking] = useState(false)
  const [end, setEnd] = useState<EndState>(null)
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)

  const game = gameRef.current

  const legalTargets = selected
    ? game.moves({ square: selected, verbose: true }).map((m) => m.to)
    : []

  const checkEnd = useCallback((g: Chess) => {
    if (!g.isGameOver()) return
    if (g.isCheckmate()) {
      setEnd(g.turn() === 'w' ? 'loss' : 'win')
      fireFeedback(g.turn() === 'w' ? 'incorrect' : 'roundComplete')
    } else {
      setEnd('draw')
    }
  }, [])

  const playComputerMove = useCallback(() => {
    setThinking(true)
    const epoch = epochRef.current
    setTimeout(() => {
      if (epoch !== epochRef.current) return // reset while thinking — stale move
      const g = gameRef.current
      // The computer plays Black, only ever Black. pickComputerMove itself
      // moves whichever side the FEN says is up, so this guard is what keeps
      // it off the child's pieces if a code path ever gets the turn wrong.
      if (g.turn() === 'b') {
        const move = pickComputerMove(g.fen(), difficulty ?? 'medium')
        if (move) {
          const applied = g.move(move)
          if (applied) setLastMove({ from: applied.from, to: applied.to })
        }
        setFen(g.fen())
      }
      setThinking(false)
      checkEnd(g)
    }, 350)
  }, [difficulty, checkEnd])

  function tapSquare(square: Square) {
    if (thinking || end) return
    const g = gameRef.current

    if (selected) {
      if (legalTargets.includes(square)) {
        const candidates = g.moves({ square: selected, verbose: true })
          .filter((m) => m.to === square)
        const chosen = candidates.find((m) => m.promotion === 'q') ?? candidates[0]
        const applied = chosen
          ? g.move({ from: chosen.from, to: chosen.to, promotion: chosen.promotion })
          : null
        setSelected(null)
        if (applied) {
          fireFeedback('correct')
          setLastMove({ from: applied.from, to: applied.to })
          setFen(g.fen())
          if (g.isGameOver()) {
            checkEnd(g)
          } else {
            playComputerMove()
          }
          return
        }
      }
      const piece = g.get(square)
      if (piece && piece.color === g.turn()) {
        setSelected(square)
        return
      }
      setSelected(null)
      return
    }

    const piece = g.get(square)
    if (piece && piece.color === g.turn() && g.turn() === 'w') {
      setSelected(square)
    }
  }

  function restart() {
    epochRef.current += 1 // invalidate any computer move still on a timer
    gameRef.current = new Chess()
    setFen(gameRef.current.fen())
    setSelected(null)
    setThinking(false)
    setEnd(null)
    setLastMove(null)
  }

  function exitToMenu() {
    setScreen('difficulty')
    setDifficulty(null)
    setOnlineGameId(null)
    restart()
  }

  if (onlineGameId) {
    return <ChessOnlineGame gameId={onlineGameId} backHref={backHref} onExit={exitToMenu} />
  }

  if (screen === 'online-lobby') {
    return (
      <GameShell>
        <GameBackLink href={backHref} />
        <OnlineLobby gameType="chess" onReady={setOnlineGameId} onBack={() => setScreen('difficulty')} />
      </GameShell>
    )
  }

  if (!difficulty) {
    return (
      <GameShell>
        <GameBackLink href={backHref} />
        <GameMenu
          headingLevel={menuHeadingLevel(backHref)}
          crest={<GameCrest glyph={<ChessPieceArt colour="b" type="n" className="h-12 w-12" />} />}
          title="Chess"
          blurb="Play the computer at three levels, or share a code and play a friend."
          options={DIFFICULTIES}
          onPick={(id) => setDifficulty(id as ChessDifficulty)}
          footer={<PlayAFriendDivider onClick={() => setScreen('online-lobby')} />}
        />
      </GameShell>
    )
  }

  const inCheck = game.inCheck() && !end
  const checkedKing = inCheck ? findKing(game, game.turn()) : null

  return (
    <GameShell>
      <GameToolbar backHref={backHref} onReset={restart} />

      <PlayerStrip
        you={{ name: 'You', swatch: 'var(--game-piece-light)', active: !thinking && !end }}
        them={{ name: 'Computer', swatch: 'var(--game-piece-dark)', active: thinking }}
        status={
          thinking
            ? { text: 'Thinking…', tone: 'neutral' }
            : inCheck
              ? { text: 'Check!', tone: 'alert' }
              : null
        }
      />

      <ChessBoardGrid
        fen={fen}
        selected={selected}
        legalTargets={legalTargets}
        lastMove={lastMove}
        checkedKing={checkedKing}
        onTap={tapSquare}
        disabled={!!end}
      />

      <CapturedStrip fen={fen} />

      <AnimatePresence>
        {end && (
          <GameEndCard
            outcome={end === 'win' ? 'win' : end === 'draw' ? 'draw' : 'loss'}
            title={end === 'win' ? 'Checkmate. You won!' : end === 'draw' ? "It's a draw" : 'Good game!'}
            detail={
              end === 'win'
                ? 'Nicely played.'
                : end === 'draw'
                  ? 'Neither side could break through.'
                  : 'The computer got you this time. Have another go.'
            }
            actionLabel="Play again"
            onAction={restart}
          />
        )}
      </AnimatePresence>
    </GameShell>
  )
}

function findKing(game: Chess, colour: 'w' | 'b'): Square | null {
  for (const rank of RANKS) {
    for (const file of FILES) {
      const sq = `${file}${rank}` as Square
      const p = game.get(sq)
      if (p && p.type === 'k' && p.color === colour) return sq
    }
  }
  return null
}

/**
 * One piece: the Staunton artwork from ChessPieceArt.tsx, which keeps the
 * rule the old glyph rendering established — each side's shape filled in its
 * own tone and ringed in the opposite one, because no single fill clears 3:1
 * against both a maple and a walnut square. See tokens.css §14.
 */
function ChessPiece({ colour, type }: { colour: 'w' | 'b'; type: string }) {
  return (
    <ChessPieceArt
      colour={colour}
      type={type as PieceType}
      // `relative` is load-bearing: the tint overlays on this square
      // (last-move, selection) are absolutely positioned, and CSS paints
      // positioned elements above in-flow content regardless of DOM order —
      // so a static piece got washed gold on the last-move square, muddying
      // exactly the light/dark distinction the fill exists to carry. Making
      // the piece positioned too restores DOM order: overlays first, piece
      // on top. (CheckerDisc in CheckersGame.tsx already does the same.)
      className="pointer-events-none relative h-full w-full select-none"
      // A soft cast shadow so the piece sits ON the board rather than being
      // painted into it — drop-shadow hugs the artwork's outline, where a
      // box-shadow would draw a floating rectangle.
      style={{ filter: 'drop-shadow(0 2px 2px rgba(20,12,6,.38))' }}
    />
  )
}

/** The 8x8 board, shared between computer and online modes — takes a FEN
 *  rather than a Chess instance so callers never need to share a ref. */
function ChessBoardGrid({
  fen, selected, legalTargets, lastMove, checkedKing, onTap, disabled,
}: {
  fen: string
  selected: Square | null
  legalTargets: Square[]
  lastMove: { from: Square; to: Square } | null
  checkedKing?: Square | null
  onTap: (square: Square) => void
  disabled: boolean
}) {
  const board = new Chess(fen)
  const reduceMotion = useReducedMotion()
  return (
    <BoardFrame>
      <div className="grid aspect-square w-full grid-cols-8" role="group" aria-label="Chess board">
        {RANKS.flatMap((rank) =>
          FILES.map((file) => {
            const square = `${file}${rank}` as Square
            const piece = board.get(square)
            const isDark = (FILES.indexOf(file) + rank) % 2 === 0
            const isSelected = selected === square
            const isTarget = legalTargets.includes(square)
            const isLastMove = !!lastMove && (lastMove.from === square || lastMove.to === square)
            const isCheck = checkedKing === square
            return (
              <button
                key={square}
                onClick={() => onTap(square)}
                disabled={disabled}
                aria-label={
                  piece
                    ? `${square}, ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAME[piece.type]}${isTarget ? ', can capture' : ''}`
                    : `${square}${isTarget ? ', can move here' : ''}`
                }
                aria-pressed={isSelected}
                className="relative flex aspect-square items-center justify-center transition-[background-color] duration-150"
                style={{
                  backgroundColor: isDark ? 'var(--game-sq-dark)' : 'var(--game-sq-light)',
                }}
              >
                {/* Previous move: a tint plus two corner notches, so the
                    square is still identifiable without colour vision. */}
                {isLastMove && (
                  <>
                    <span className="absolute inset-0" style={{ background: 'var(--game-last)' }} aria-hidden />
                    <span
                      className="absolute left-0 top-0 h-1.5 w-1.5"
                      style={{ background: 'var(--game-last-ring)' }}
                      aria-hidden
                    />
                    <span
                      className="absolute bottom-0 right-0 h-1.5 w-1.5"
                      style={{ background: 'var(--game-last-ring)' }}
                      aria-hidden
                    />
                  </>
                )}

                {/* Selection: an inset ring, not just a wash. */}
                {isSelected && (
                  <span
                    className="absolute inset-0"
                    style={{
                      background: 'var(--game-sel)',
                      boxShadow: 'inset 0 0 0 3px var(--game-sel-ring)',
                    }}
                    aria-hidden
                  />
                )}

                {/* Check: a ring on the king's square, pulsing to draw the
                    eye. The global prefers-reduced-motion rule in globals.css
                    only stops CSS animation, so a Framer loop has to be
                    switched off here by hand — it would otherwise pulse
                    forever for exactly the users who asked it not to. The
                    ring itself stays; only the movement goes. */}
                {isCheck && (
                  <motion.span
                    className="absolute inset-0"
                    style={{ boxShadow: 'inset 0 0 0 3px var(--game-danger)' }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 0.35, 1] }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    aria-hidden
                  />
                )}

                {/* Coordinates, printed into the board the way a real one is. */}
                {file === 'a' && (
                  <span
                    className="pointer-events-none absolute left-[3px] top-[1px] text-[9px] font-bold leading-none"
                    style={{ color: isDark ? 'var(--game-coord-dark)' : 'var(--game-coord-light)' }}
                    aria-hidden
                  >
                    {rank}
                  </span>
                )}
                {rank === 1 && (
                  <span
                    className="pointer-events-none absolute bottom-[1px] right-[3px] text-[9px] font-bold leading-none"
                    style={{ color: isDark ? 'var(--game-coord-dark)' : 'var(--game-coord-light)' }}
                    aria-hidden
                  >
                    {file}
                  </span>
                )}

                {piece && <ChessPiece colour={piece.color} type={piece.type} />}

                {/* Legal move: a dot on an empty square, a ring around a
                    capture. Both are shapes; neither relies on hue. */}
                {isTarget && !piece && (
                  <span
                    className="absolute h-[24%] w-[24%] rounded-full"
                    style={{ background: 'var(--game-hint)', opacity: 0.75 }}
                    aria-hidden
                  />
                )}
                {isTarget && piece && (
                  <span
                    className="absolute inset-[6%] rounded-full"
                    style={{ boxShadow: 'inset 0 0 0 3px var(--game-hint)' }}
                    aria-hidden
                  />
                )}
              </button>
            )
          }),
        )}
      </div>
    </BoardFrame>
  )
}

/**
 * Captured material, read straight off the FEN rather than tracked in state
 * — anything missing from a full set has been taken. It answers the question
 * a child actually asks mid-game ("am I ahead?") without a points system.
 *
 * The count is clamped at zero because promotion can put MORE of a piece on
 * the board than the set started with, and this game always promotes to a
 * queen. Without the clamp a promoted pawn gave 1 - 2 = -1 queens captured,
 * and `Array(-1)` throws RangeError, taking the whole board down with it.
 */
function CapturedStrip({ fen }: { fen: string }) {
  const { white, black } = capturedMaterial(fen)
  const byYou = black   // black pieces you have captured
  const byThem = white
  if (byYou.length === 0 && byThem.length === 0) return null

  const count = (n: number) => `${n} ${n === 1 ? 'piece' : 'pieces'}`

  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <p className="flex min-h-[22px] flex-1 flex-wrap gap-0.5" aria-label={`You have captured ${count(byYou.length)}`}>
        {byYou.map((t, i) => (
          <ChessPieceArt key={i} colour="b" type={t as PieceType} className="h-[22px] w-[22px]" />
        ))}
      </p>
      <p
        className="flex min-h-[22px] flex-1 flex-wrap justify-end gap-0.5"
        aria-label={`Your opponent has captured ${count(byThem.length)}`}
      >
        {byThem.map((t, i) => (
          <ChessPieceArt key={i} colour="w" type={t as PieceType} className="h-[22px] w-[22px]" />
        ))}
      </p>
    </div>
  )
}

/** Online mode: FEN comes from useBoardGame, moves go through sendMove. */
function ChessOnlineGame({
  gameId, backHref, onExit,
}: {
  gameId: string
  backHref: string
  onExit: () => void
}) {
  const { game, side, inviteCode, ready, notFound, sendMove } = useBoardGame(gameId)
  const [selected, setSelected] = useState<Square | null>(null)

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

  const fen = (game.state as { fen: string }).fen
  const chess = new Chess(fen)
  const myColor = side === 'host' ? 'w' : 'b'
  const myTurn = game.status === 'active' && game.turn === side
  const legalTargets = selected && myTurn
    ? chess.moves({ square: selected, verbose: true }).map((m) => m.to)
    : []
  const inCheck = chess.inCheck() && !game.winner
  const won = game.winner
  const iWon = won === side
  const isDraw = won === 'draw'

  function handleTap(square: Square) {
    if (!myTurn) return
    if (selected) {
      if (legalTargets.includes(square)) {
        setSelected(null)
        fireFeedback('correct')
        sendMove({ from: selected, to: square, promotion: 'q' })
        return
      }
      const piece = chess.get(square)
      if (piece && piece.color === myColor) {
        setSelected(square)
        return
      }
      setSelected(null)
      return
    }
    const piece = chess.get(square)
    if (piece && piece.color === myColor) setSelected(square)
  }

  return (
    <GameShell>
      <GameBackLink href={backHref} onClick={onExit} />

      <PlayerStrip
        you={{
          name: side === 'host' ? 'You' : game.host_display_name,
          swatch: 'var(--game-piece-light)',
          active: myTurn && side === 'host',
        }}
        them={{
          name: side === 'guest' ? 'You' : (game.guest_display_name ?? 'Friend'),
          swatch: 'var(--game-piece-dark)',
          active: myTurn && side === 'guest',
        }}
        status={inCheck ? { text: 'Check!', tone: 'alert' } : null}
      />

      <TurnBanner game={game} side={side} />

      <ChessBoardGrid
        fen={fen}
        selected={selected}
        legalTargets={legalTargets}
        lastMove={null}
        checkedKing={inCheck ? findKing(chess, chess.turn()) : null}
        onTap={handleTap}
        disabled={!myTurn || !!won}
      />

      <CapturedStrip fen={fen} />

      <AnimatePresence>
        {won && (
          <GameEndCard
            outcome={iWon ? 'win' : isDraw ? 'draw' : 'loss'}
            title={iWon ? 'Checkmate. You won!' : isDraw ? "It's a draw" : 'Good game!'}
            actionLabel={backHref === '/downtime' ? 'Back to Downtime' : 'Back to Games'}
            onAction={onExit}
          />
        )}
      </AnimatePresence>
    </GameShell>
  )
}
