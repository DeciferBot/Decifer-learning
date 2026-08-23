'use client'

import { useCallback, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fireFeedback } from '@/lib/feedback'
import {
  createInitialBoard, legalMoves, applyMove, determineOutcome, pickComputerMove,
  type Board, type CheckersColor, type CheckersDifficulty, type Move,
} from '@/lib/games/checkers-ai'
import { useBoardGame } from '@/lib/downtime/useBoardGame'
import type { GameResultInput } from '@/lib/games/results'
import { useGameResult, GameResultNote } from '@/components/games/GameResultNote'
import { OnlineLobby } from '@/components/games/OnlineLobby'
import { WaitingRoom, TurnBanner, PlayAFriendDivider } from '@/components/games/OnlineBoardStatus'
import { Crown } from '@/components/ui/icons'
import {
  GameShell, GameBackLink, GameToolbar, GameMessage, GameMenu, GameCrest,
  BoardFrame, PlayerStrip, GameEndCard,
  menuHeadingLevel,
} from '@/components/games/GameChrome'

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', blurb: 'Good for a first game' },
  { id: 'medium', label: 'Medium', blurb: 'Plays sensibly, still beatable' },
  { id: 'hard', label: 'Hard', blurb: 'Never misses a forced capture' },
]

type Coord = [number, number]
type EndState = 'win' | 'loss' | null
type Screen = 'difficulty' | 'online-lobby'

/** Checkers — against the computer, or against a friend via invite code.
 *  The host/child always plays Red and moves first, from the bottom of the
 *  board upward. Captures are mandatory, per standard American rules — see
 *  lib/games/checkers-ai.ts. Computer mode is the default landing screen;
 *  "play a friend" is a secondary option. */
export function CheckersGame({ backHref = '/downtime' }: { backHref?: string }) {
  const [screen, setScreen] = useState<Screen>('difficulty')
  const [difficulty, setDifficulty] = useState<CheckersDifficulty | null>(null)
  const [onlineGameId, setOnlineGameId] = useState<string | null>(null)

  const [board, setBoard] = useState<Board>(() => createInitialBoard())
  const [selected, setSelected] = useState<Coord | null>(null)
  const [thinking, setThinking] = useState(false)
  const [end, setEnd] = useState<EndState>(null)
  const [lastMove, setLastMove] = useState<{ from: Coord; to: Coord } | null>(null)

  // Report the finished game to the player's history (guests get the
  // register invitation instead — see GameResultNote).
  const result = useMemo<GameResultInput | null>(
    () => (end ? { gameType: 'checkers', mode: 'computer', outcome: end, difficulty: difficulty ?? 'medium' } : null),
    [end, difficulty],
  )
  const saveStatus = useGameResult(result)

  const redMoves = legalMoves(board, 'red')
  const movableFrom = new Set(redMoves.map((m) => m.from.join(',')))
  const mustCapture = redMoves.length > 0 && redMoves[0].captures.length > 0
  const targets = selected
    ? redMoves.filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1])
    : []

  const finishIfOver = useCallback((b: Board, mover: CheckersColor) => {
    const winner = determineOutcome(b, mover)
    if (winner) {
      setEnd(winner === 'red' ? 'win' : 'loss')
      fireFeedback(winner === 'red' ? 'roundComplete' : 'incorrect')
      return true
    }
    return false
  }, [])

  const playComputerMove = useCallback((currentBoard: Board) => {
    setThinking(true)
    setTimeout(() => {
      const move = pickComputerMove(currentBoard, 'black', difficulty ?? 'medium')
      if (move) {
        const next = applyMove(currentBoard, move, 'black')
        setBoard(next)
        setLastMove({ from: move.from, to: move.to })
        setThinking(false)
        finishIfOver(next, 'black')
        return
      }
      setThinking(false)
    }, 400)
  }, [difficulty, finishIfOver])

  function tapSquare(r: number, c: number) {
    if (thinking || end) return
    if (selected) {
      const move = targets.find((m) => m.to[0] === r && m.to[1] === c)
      if (move) {
        const next = applyMove(board, move, 'red')
        setBoard(next)
        setSelected(null)
        setLastMove({ from: move.from, to: move.to })
        fireFeedback('correct')
        const over = finishIfOver(next, 'red')
        if (!over) playComputerMove(next)
        return
      }
      if (movableFrom.has(`${r},${c}`)) {
        setSelected([r, c])
        return
      }
      setSelected(null)
      return
    }
    if (movableFrom.has(`${r},${c}`)) setSelected([r, c])
  }

  function restart() {
    setBoard(createInitialBoard())
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
    return <CheckersOnlineGame gameId={onlineGameId} backHref={backHref} onExit={exitToMenu} />
  }

  if (screen === 'online-lobby') {
    return (
      <GameShell>
        <GameBackLink href={backHref} />
        <OnlineLobby gameType="checkers" onReady={setOnlineGameId} onBack={() => setScreen('difficulty')} />
      </GameShell>
    )
  }

  if (!difficulty) {
    return (
      <GameShell>
        <GameBackLink href={backHref} />
        <GameMenu
          headingLevel={menuHeadingLevel(backHref)}
          crest={<GameCrest glyph={<CheckerDisc colour="red" size={44} />} />}
          title="Checkers"
          blurb="Jump across the board and crown some kings. Play the computer, or a friend."
          options={DIFFICULTIES}
          onPick={(id) => setDifficulty(id as CheckersDifficulty)}
          footer={<PlayAFriendDivider onClick={() => setScreen('online-lobby')} />}
        />
      </GameShell>
    )
  }

  return (
    <GameShell>
      <GameToolbar backHref={backHref} onReset={restart} />

      <PlayerStrip
        you={{ name: 'You', swatch: 'var(--game-piece-red)', active: !thinking && !end }}
        them={{ name: 'Computer', swatch: 'var(--game-piece-dark)', active: thinking }}
        status={
          thinking
            ? { text: 'Thinking…', tone: 'neutral' }
            : mustCapture && !end
              ? { text: 'You must capture!', tone: 'alert' }
              : null
        }
      />

      <CheckersGrid
        board={board}
        targets={targets}
        movableFrom={movableFrom}
        selected={selected}
        lastMove={lastMove}
        onTap={tapSquare}
        disabled={!!end}
      />

      <AnimatePresence>
        {end && (
          <GameEndCard
            outcome={end === 'win' ? 'win' : 'loss'}
            title={end === 'win' ? 'You won!' : 'Good game!'}
            detail={
              end === 'win'
                ? 'You captured every piece, or the computer had nowhere left to move.'
                : 'The computer got you this time. Have another go.'
            }
            actionLabel="Play again"
            onAction={restart}
            secondary={saveStatus ? <GameResultNote status={saveStatus} /> : undefined}
          />
        )}
      </AnimatePresence>
    </GameShell>
  )
}

/**
 * One disc: a moulded piece with a rim, a ring groove and a cast shadow.
 *
 * The rim is load-bearing, not decoration. A red disc on a walnut square is
 * 1.3:1 on fill alone, so the light rim is what tells you a piece is there.
 * Kings carry a crown, which also means "king" survives greyscale.
 */
function CheckerDisc({
  colour, king, size,
}: {
  colour: CheckersColor
  king?: boolean
  size?: number
}) {
  const red = colour === 'red'
  const fill = red ? 'var(--game-piece-red)' : 'var(--game-piece-dark)'
  const rim = red ? 'var(--game-piece-red-rim)' : 'var(--game-piece-dark-rim)'
  return (
    <span
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: size ?? '74%',
        height: size ?? '74%',
        background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,.30) 0%, rgba(255,255,255,0) 55%), ${fill}`,
        boxShadow: `inset 0 0 0 2px ${rim}, inset 0 -3px 5px rgba(20,12,6,.35), var(--game-piece-shadow)`,
      }}
    >
      {/* The groove a moulded checker has. Kept faint on purpose: at full
          strength it competes with the outer rim and the disc starts reading
          as a doughnut rather than a piece. */}
      <span
        aria-hidden
        className="absolute inset-[22%] rounded-full"
        style={{ boxShadow: `inset 0 0 0 1px ${rim}`, opacity: 0.22 }}
      />
      {king && <Crown className="relative h-[52%] w-[52%] text-points-gold" aria-hidden />}
    </span>
  )
}

/** The 8x8 board, shared between computer and online modes — only the data
 *  source and tap handler differ. */
function CheckersGrid({
  board, targets, movableFrom, selected, lastMove, onTap, disabled,
}: {
  board: Board
  targets: Move[]
  movableFrom: Set<string>
  selected: Coord | null
  lastMove: { from: Coord; to: Coord } | null
  onTap: (r: number, c: number) => void
  disabled: boolean
}) {
  return (
    <BoardFrame>
      <div className="grid aspect-square w-full grid-cols-8" role="group" aria-label="Checkers board">
        {Array.from({ length: 8 }, (_, rowFromTop) => {
          const row = 7 - rowFromTop
          return Array.from({ length: 8 }, (_, col) => {
            const piece = board[row][col]
            const dark = (row + col) % 2 === 1
            const isSelected = !!selected && selected[0] === row && selected[1] === col
            const isTarget = targets.some((m) => m.to[0] === row && m.to[1] === col)
            const isLastMove = !!lastMove
              && ((lastMove.from[0] === row && lastMove.from[1] === col)
                || (lastMove.to[0] === row && lastMove.to[1] === col))
            const canMove = dark && movableFrom.has(`${row},${col}`)
            const canTap = dark && (isTarget || canMove)
            return (
              <button
                key={`${row}-${col}`}
                onClick={() => onTap(row, col)}
                disabled={disabled || !canTap}
                aria-pressed={isSelected}
                aria-label={
                  piece
                    ? `${row + 1},${col + 1}, ${piece.color}${piece.king ? ' king' : ''}${canMove ? ', can move' : ''}`
                    : `${row + 1},${col + 1}${isTarget ? ', can move here' : ''}`
                }
                className="relative flex aspect-square items-center justify-center transition-[background-color] duration-150 disabled:cursor-default"
                style={{ backgroundColor: dark ? 'var(--game-sq-dark)' : 'var(--game-sq-light)' }}
              >
                {isLastMove && (
                  <>
                    <span className="absolute inset-0" style={{ background: 'var(--game-last)' }} aria-hidden />
                    <span
                      className="absolute left-0 top-0 h-1.5 w-1.5"
                      style={{ background: 'var(--game-last-ring)' }}
                      aria-hidden
                    />
                  </>
                )}

                {isSelected && (
                  <span
                    className="absolute inset-0"
                    style={{ background: 'var(--game-sel)', boxShadow: 'inset 0 0 0 3px var(--game-sel-ring)' }}
                    aria-hidden
                  />
                )}

                {/* A piece you can move gets a corner tick, so "movable" is
                    legible before you have tapped anything. */}
                {canMove && !isSelected && (
                  <span
                    className="absolute right-[6%] top-[6%] h-1.5 w-1.5 rounded-full opacity-80"
                    style={{ background: 'var(--game-sel-ring)', boxShadow: '0 0 0 1.5px rgba(255,245,230,.55)' }}
                    aria-hidden
                  />
                )}

                {piece && <CheckerDisc colour={piece.color} king={piece.king} />}

                {isTarget && !piece && (
                  <span
                    className="absolute h-[26%] w-[26%] rounded-full"
                    style={{ background: 'var(--game-hint)', opacity: 0.8 }}
                    aria-hidden
                  />
                )}
              </button>
            )
          })
        })}
      </div>
    </BoardFrame>
  )
}

/** Online mode: board comes from useBoardGame, moves go through sendMove.
 *  Legal-move highlighting is still computed locally (checkers-ai.ts is
 *  pure and safe to call client-side) — the server independently
 *  re-validates every move regardless, this is purely for the UI. */
function CheckersOnlineGame({
  gameId, backHref, onExit,
}: {
  gameId: string
  backHref: string
  onExit: () => void
}) {
  const { game, side, inviteCode, ready, notFound, sendMove } = useBoardGame(gameId)
  const [selected, setSelected] = useState<Coord | null>(null)

  // Hooks must run before the early returns below, so the finished-game
  // report reads the winner straight off the (possibly absent) game.
  const winner = game?.winner ?? null
  const result = useMemo<GameResultInput | null>(() => {
    if (!winner || !side) return null
    return { gameType: 'checkers', mode: 'friend', outcome: winner === side ? 'win' : winner === 'draw' ? 'draw' : 'loss' }
  }, [winner, side])
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

  const boardState = game.state as { board: Board }
  const board = boardState.board
  const myColor: CheckersColor = side === 'host' ? 'red' : 'black'
  const myTurn = game.status === 'active' && game.turn === side
  const myMoves = myTurn ? legalMoves(board, myColor) : []
  const movableFrom = new Set(myMoves.map((m) => m.from.join(',')))
  const targets = selected
    ? myMoves.filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1])
    : []
  const won = game.winner
  const iWon = won === side

  function handleTap(r: number, c: number) {
    if (!myTurn) return
    if (selected) {
      const move = targets.find((m) => m.to[0] === r && m.to[1] === c)
      if (move) {
        fireFeedback('correct')
        setSelected(null)
        sendMove({ from: move.from, to: move.to })
        return
      }
      if (movableFrom.has(`${r},${c}`)) {
        setSelected([r, c])
        return
      }
      setSelected(null)
      return
    }
    if (movableFrom.has(`${r},${c}`)) setSelected([r, c])
  }

  return (
    <GameShell>
      <GameBackLink href={backHref} onClick={onExit} />

      <PlayerStrip
        you={{
          name: side === 'host' ? 'You' : game.host_display_name,
          swatch: 'var(--game-piece-red)',
          active: myTurn && side === 'host',
        }}
        them={{
          name: side === 'guest' ? 'You' : (game.guest_display_name ?? 'Friend'),
          swatch: 'var(--game-piece-dark)',
          active: myTurn && side === 'guest',
        }}
      />

      <TurnBanner game={game} side={side} />

      <CheckersGrid
        board={board}
        targets={targets}
        movableFrom={movableFrom}
        selected={selected}
        lastMove={null}
        onTap={handleTap}
        disabled={!myTurn || !!won}
      />

      <AnimatePresence>
        {won && (
          <GameEndCard
            outcome={iWon ? 'win' : 'loss'}
            title={iWon ? 'You won!' : 'Good game!'}
            actionLabel={backHref === '/downtime' ? 'Back to Downtime' : 'Back to Games'}
            onAction={onExit}
            secondary={saveStatus ? <GameResultNote status={saveStatus} /> : undefined}
          />
        )}
      </AnimatePresence>
    </GameShell>
  )
}
