'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { fireFeedback } from '@/lib/feedback'
import {
  createEmptyBoard, dropPiece, landingRow, legalColumns, isBoardFull, winnerAt,
  pickComputerColumn, type Board, type Connect4Difficulty,
} from '@/lib/games/connect4-ai'
import { useBoardGame } from '@/lib/downtime/useBoardGame'
import { OnlineLobby } from '@/components/games/OnlineLobby'
import { WaitingRoom, TurnBanner, PlayAFriendDivider } from '@/components/games/OnlineBoardStatus'
import { ChevronDown } from '@/components/ui/icons'
import {
  GameShell, GameBackLink, GameToolbar, GameMessage, GameMenu, GameCrest,
  PlayerStrip, GameEndCard,
  menuHeadingLevel,
} from '@/components/games/GameChrome'

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', blurb: 'Good for a first game' },
  { id: 'medium', label: 'Medium', blurb: 'Plays sensibly, still beatable' },
  { id: 'hard', label: 'Hard', blurb: 'Spots your traps, and sets its own' },
]

const ROWS = 6
const COLS = 7

type EndState = 'win' | 'loss' | 'draw' | null
type Screen = 'difficulty' | 'online-lobby'

/** Connect 4 — against the computer, or against a friend via invite code.
 *  In both modes the child is always Red and drops first. Computer mode is
 *  the default landing screen; "play a friend" is a secondary option. */
export function Connect4Game({ backHref = '/downtime' }: { backHref?: string }) {
  const [screen, setScreen] = useState<Screen>('difficulty')
  const [difficulty, setDifficulty] = useState<Connect4Difficulty | null>(null)
  const [onlineGameId, setOnlineGameId] = useState<string | null>(null)

  const boardRef = useRef<Board>(createEmptyBoard())
  const [, forceRender] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [end, setEnd] = useState<EndState>(null)
  const [lastDrop, setLastDrop] = useState<{ row: number; col: number } | null>(null)
  const [winLine, setWinLine] = useState<Set<string>>(new Set())

  const board = boardRef.current

  const finishIfOver = useCallback((b: Board, row: number, col: number) => {
    const winner = winnerAt(b, row, col)
    if (winner) {
      setEnd(winner === 'red' ? 'win' : 'loss')
      setWinLine(findWinLine(b, row, col))
      fireFeedback(winner === 'red' ? 'roundComplete' : 'incorrect')
      return true
    }
    if (isBoardFull(b)) {
      setEnd('draw')
      return true
    }
    return false
  }, [])

  const playComputerMove = useCallback(() => {
    setThinking(true)
    setTimeout(() => {
      const col = pickComputerColumn(boardRef.current, 'yellow', difficulty ?? 'medium')
      if (col !== null) {
        const result = dropPiece(boardRef.current, col, 'yellow')
        if (result) {
          boardRef.current = result.board
          setLastDrop({ row: result.row, col })
          forceRender((n) => n + 1)
          setThinking(false)
          finishIfOver(result.board, result.row, col)
          return
        }
      }
      setThinking(false)
    }, 400)
  }, [difficulty, finishIfOver])

  function drop(col: number) {
    if (thinking || end) return
    if (!legalColumns(boardRef.current).includes(col)) return
    const result = dropPiece(boardRef.current, col, 'red')
    if (!result) return
    boardRef.current = result.board
    setLastDrop({ row: result.row, col })
    forceRender((n) => n + 1)
    fireFeedback('correct')
    const over = finishIfOver(result.board, result.row, col)
    if (!over) playComputerMove()
  }

  function restart() {
    boardRef.current = createEmptyBoard()
    forceRender((n) => n + 1)
    setThinking(false)
    setEnd(null)
    setLastDrop(null)
    setWinLine(new Set())
  }

  function exitToMenu() {
    setScreen('difficulty')
    setDifficulty(null)
    setOnlineGameId(null)
    restart()
  }

  if (onlineGameId) {
    return <Connect4OnlineGame gameId={onlineGameId} backHref={backHref} onExit={exitToMenu} />
  }

  if (screen === 'online-lobby') {
    return (
      <GameShell>
        <GameBackLink href={backHref} />
        <OnlineLobby gameType="connect4" onReady={setOnlineGameId} onBack={() => setScreen('difficulty')} />
      </GameShell>
    )
  }

  if (!difficulty) {
    return (
      <GameShell>
        <GameBackLink href={backHref} />
        <GameMenu
          headingLevel={menuHeadingLevel(backHref)}
          crest={<GameCrest tone="indigo" glyph={<Disc colour="red" size={42} />} />}
          title="Connect 4"
          blurb="Line up four in a row before your opponent does. Play the computer, or a friend."
          options={DIFFICULTIES}
          onPick={(id) => setDifficulty(id as Connect4Difficulty)}
          footer={<PlayAFriendDivider onClick={() => setScreen('online-lobby')} />}
        />
      </GameShell>
    )
  }

  const legal = legalColumns(board)

  return (
    <GameShell>
      <GameToolbar backHref={backHref} onReset={restart} />

      <PlayerStrip
        you={{ name: 'You', swatch: 'var(--game-c4-red)', active: !thinking && !end }}
        them={{ name: 'Computer', swatch: 'var(--game-c4-yellow)', active: thinking }}
        status={thinking ? { text: 'Thinking…', tone: 'neutral' } : null}
      />

      <Connect4Grid
        board={board}
        legal={legal}
        onDrop={drop}
        disabled={thinking || !!end}
        lastDrop={lastDrop}
        winLine={winLine}
      />

      <AnimatePresence>
        {end && (
          <GameEndCard
            outcome={end === 'win' ? 'win' : end === 'draw' ? 'draw' : 'loss'}
            title={end === 'win' ? 'Four in a row. You won!' : end === 'draw' ? "It's a draw" : 'Good game!'}
            detail={
              end === 'win'
                ? 'Nicely spotted.'
                : end === 'draw'
                  ? 'The board filled up with nobody connecting four.'
                  : 'The computer connected four first. Have another go.'
            }
            actionLabel="Play again"
            onAction={restart}
          />
        )}
      </AnimatePresence>
    </GameShell>
  )
}

/** The four cells that actually won, so the end screen isn't the first time
 *  a child learns where the line was. Mirrors winnerAt's direction set. */
function findWinLine(board: Board, row: number, col: number): Set<string> {
  const colour = board[row][col]
  if (!colour) return new Set()
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]]
  for (const [dr, dc] of dirs) {
    const line = [`${row},${col}`]
    for (const sign of [1, -1]) {
      for (let step = 1; step < 4; step++) {
        const r = row + dr * step * sign
        const c = col + dc * step * sign
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break
        if (board[r][c] !== colour) break
        line.push(`${r},${c}`)
      }
    }
    if (line.length >= 4) return new Set(line)
  }
  return new Set()
}

/**
 * One disc, moulded rather than flat: a highlight top-left, a darkened
 * bottom edge, and a rim.
 *
 * Red and yellow sit at 2.4:1 against each other, which is not enough on its
 * own for a child with red/green or full colour-vision deficiency. So the
 * two sides also differ in FORM: your disc has a solid centre, the
 * opponent's has a ring. That difference survives greyscale.
 */
function Disc({
  colour, size, dimmed,
}: {
  colour: 'red' | 'yellow'
  size?: number
  dimmed?: boolean
}) {
  const red = colour === 'red'
  const fill = red ? 'var(--game-c4-red)' : 'var(--game-c4-yellow)'
  return (
    <span
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: size ?? '100%',
        height: size ?? '100%',
        background: `radial-gradient(circle at 33% 27%, rgba(255,255,255,.42) 0%, rgba(255,255,255,0) 58%), ${fill}`,
        boxShadow: 'inset 0 -4px 7px rgba(20,12,6,.32), inset 0 0 0 1.5px rgba(20,12,6,.30), 0 1px 2px rgba(20,12,6,.35)',
        opacity: dimmed ? 0.45 : 1,
      }}
      aria-hidden
    >
      <span
        className="absolute rounded-full"
        style={
          red
            ? { inset: '32%', background: 'rgba(20,12,6,.22)' }
            : { inset: '28%', boxShadow: 'inset 0 0 0 2.5px rgba(20,12,6,.28)' }
        }
      />
    </span>
  )
}

/** The 7x6 grid + column drop targets, shared between computer and online
 *  modes — only the data source and the drop handler differ. */
function Connect4Grid({
  board, legal, onDrop, disabled, lastDrop, winLine, ghostColour = 'red',
}: {
  board: Board
  legal: number[]
  onDrop: (col: number) => void
  disabled: boolean
  lastDrop: { row: number; col: number } | null
  winLine?: Set<string>
  /** Colour of the "would land here" preview — the player's own colour. */
  ghostColour?: 'red' | 'yellow'
}) {
  const [hoverCol, setHoverCol] = useState<number | null>(null)
  // globals.css only silences CSS animation, so the Framer drop and the
  // forever-pulsing winning line have to be switched off explicitly. Both
  // still change state, they just stop moving.
  const reduceMotion = useReducedMotion()

  return (
    <div className="space-y-1.5">
      {/* Drop rail. Sits above the cabinet, the way your hand does. */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: COLS }, (_, col) => {
          const open = legal.includes(col) && !disabled
          return (
            <button
              key={col}
              onClick={() => onDrop(col)}
              onPointerEnter={() => setHoverCol(col)}
              onPointerLeave={() => setHoverCol((c) => (c === col ? null : c))}
              onFocus={() => setHoverCol(col)}
              onBlur={() => setHoverCol((c) => (c === col ? null : c))}
              disabled={!open}
              aria-label={`Drop in column ${col + 1}`}
              className="flex min-h-[48px] items-center justify-center rounded-xl transition-colors duration-150 disabled:opacity-25"
              style={{ background: open && hoverCol === col ? 'rgb(var(--tw-ember) / 0.14)' : 'transparent' }}
            >
              <ChevronDown
                className="h-5 w-5"
                style={{ color: open ? `var(--game-c4-${ghostColour})` : 'rgb(var(--tw-muted))' }}
                aria-hidden
              />
            </button>
          )
        })}
      </div>

      {/* The cabinet: a solid indigo block with holes bored through it. */}
      <div
        className="rounded-[20px] p-2"
        style={{
          background: 'linear-gradient(180deg, var(--game-c4-cabinet) 0%, var(--game-c4-cabinet-deep) 130%)',
          boxShadow: 'var(--game-lift), inset 0 2px 0 rgba(255,255,255,.14), inset 0 -3px 0 rgba(0,0,0,.28)',
        }}
      >
        <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Connect 4 board">
          {Array.from({ length: ROWS }, (_, rowFromTop) => {
            const row = ROWS - 1 - rowFromTop
            return Array.from({ length: COLS }, (_, col) => {
              const cell = board[row][col]
              const isLast = !!lastDrop && lastDrop.row === row && lastDrop.col === col
              const inWin = winLine?.has(`${row},${col}`)
              const open = legal.includes(col) && !disabled
              return (
                <button
                  key={`${row}-${col}`}
                  onClick={() => onDrop(col)}
                  onPointerEnter={() => setHoverCol(col)}
                  onPointerLeave={() => setHoverCol((c) => (c === col ? null : c))}
                  disabled={!open}
                  aria-label={cell ? `Column ${col + 1}, row ${row + 1}, ${cell}` : `Drop in column ${col + 1}`}
                  className="relative flex aspect-square items-center justify-center rounded-full"
                  style={{
                    // The empty hole: the dark inside of the cabinet, with a
                    // lip shadow so it reads as bored through, not painted on.
                    background: 'var(--game-c4-cabinet-deep)',
                    boxShadow: 'inset 0 3px 5px rgba(0,0,0,.55), inset 0 -1px 0 rgba(255,255,255,.10)',
                  }}
                >
                  {/* Ghost of where your disc would land. */}
                  {!cell && open && hoverCol === col && landingRow(board, col) === row && (
                    <Disc colour={ghostColour} dimmed />
                  )}

                  <AnimatePresence>
                    {cell && (
                      <motion.span
                        key="disc"
                        className="absolute inset-0"
                        // Falls from above the cabinet, then settles. Only the
                        // disc just played animates; the rest are already home.
                        initial={isLast && !reduceMotion ? { y: `-${(row + 1) * 118}%` } : false}
                        animate={{ y: 0 }}
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { type: 'spring', stiffness: 320, damping: 26, mass: 0.9 }
                        }
                      >
                        <Disc colour={cell} />
                        {inWin && (
                          <motion.span
                            className="absolute inset-0 rounded-full"
                            style={{ boxShadow: '0 0 0 3px rgb(var(--tw-points-gold))' }}
                            animate={reduceMotion ? { opacity: 1 } : { opacity: [0.4, 1, 0.4] }}
                            transition={
                              reduceMotion
                                ? { duration: 0 }
                                : { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                            }
                            aria-hidden
                          />
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              )
            })
          })}
        </div>
      </div>
    </div>
  )
}

/** Online mode: board comes from useBoardGame, moves go through sendMove. */
function Connect4OnlineGame({
  gameId, backHref, onExit,
}: {
  gameId: string
  backHref: string
  onExit: () => void
}) {
  const { game, side, inviteCode, ready, notFound, sendMove } = useBoardGame(gameId)

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

  const boardState = game.state as { board: Board }
  const board = boardState.board
  const myColor = side === 'host' ? 'red' : 'yellow'
  const myTurn = game.status === 'active' && game.turn === side
  const legal = myTurn ? legalColumns(board) : []

  function handleDrop(col: number) {
    if (!myTurn) return
    fireFeedback('correct')
    sendMove({ col })
  }

  const won = game.winner
  const iWon = won === side
  const isDraw = won === 'draw'

  return (
    <GameShell>
      <GameBackLink href={backHref} onClick={onExit} />

      <PlayerStrip
        you={{
          name: side === 'host' ? 'You' : game.host_display_name,
          swatch: 'var(--game-c4-red)',
          active: myTurn && side === 'host',
        }}
        them={{
          name: side === 'guest' ? 'You' : (game.guest_display_name ?? 'Friend'),
          swatch: 'var(--game-c4-yellow)',
          active: myTurn && side === 'guest',
        }}
        status={
          myColor === 'yellow' && !won && game.status === 'active'
            ? { text: "You're yellow", tone: 'neutral' }
            : null
        }
      />

      <TurnBanner game={game} side={side} />

      <Connect4Grid
        board={board}
        legal={legal}
        onDrop={handleDrop}
        disabled={!myTurn || !!won}
        lastDrop={null}
        ghostColour={myColor}
      />

      <AnimatePresence>
        {won && (
          <GameEndCard
            outcome={iWon ? 'win' : isDraw ? 'draw' : 'loss'}
            title={iWon ? 'Four in a row. You won!' : isDraw ? "It's a draw" : 'Good game!'}
            actionLabel={backHref === '/downtime' ? 'Back to Downtime' : 'Back to Games'}
            onAction={onExit}
          />
        )}
      </AnimatePresence>
    </GameShell>
  )
}
