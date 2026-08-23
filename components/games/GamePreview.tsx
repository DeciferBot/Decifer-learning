/**
 * Miniature board art for the game pickers.
 *
 * These replace the 🔴 / 📝 / 🔤 emoji the pickers used to lead with. An
 * emoji tells a child nothing about what they are about to play — Connect 4
 * and Checkers both showed a red circle. A slice of the real board, in the
 * real colours from tokens.css §14, shows the game itself.
 *
 * Deliberately server-rendered plain elements: no client JS, no images, no
 * network. They cost nothing on a page the search engines also read.
 */

import type { GameId } from '@/lib/games/catalogue'
import { ChessPieceArt, type PieceType } from '@/components/games/ChessPieceArt'

export type { GameId }

export function GamePreview({ game, className = '' }: { game: GameId; className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-xl ${className}`}
      style={{ boxShadow: 'var(--game-inset)' }}
    >
      {game === 'chess' && <ChessPreview />}
      {game === 'checkers' && <CheckersPreview />}
      {game === 'connect-4' && <Connect4Preview />}
      {game === 'crossword' && <CrosswordPreview />}
      {game === 'word-tiles' && <WordTilesPreview />}
    </div>
  )
}

/** A 4x4 corner of the real board, with the pieces that open a game — the
 *  same Staunton artwork the board itself uses (ChessPieceArt has no client
 *  JS, so it keeps this file's server-rendered promise). */
function ChessPreview() {
  const pieces: Record<string, { type: PieceType; light: boolean }> = {
    '0-1': { type: 'r', light: false },
    '0-4': { type: 'q', light: false },
    '1-6': { type: 'b', light: false },
    '2-0': { type: 'p', light: true },
    '2-3': { type: 'n', light: true },
    '2-7': { type: 'k', light: true },
  }
  return (
    <div className="grid aspect-[8/3] grid-cols-8 grid-rows-3">
      {Array.from({ length: 24 }, (_, i) => {
        const r = Math.floor(i / 8)
        const c = i % 8
        const dark = (r + c) % 2 === 1
        const piece = pieces[`${r}-${c}`]
        return (
          <span
            key={i}
            className="flex items-center justify-center"
            style={{ background: dark ? 'var(--game-sq-dark)' : 'var(--game-sq-light)' }}
          >
            {piece && (
              <ChessPieceArt
                colour={piece.light ? 'w' : 'b'}
                type={piece.type}
                className="h-full w-full"
              />
            )}
          </span>
        )
      })}
    </div>
  )
}

function CheckersPreview() {
  const discs: Record<string, 'red' | 'black'> = {
    '0-1': 'black', '0-5': 'black', '1-2': 'black',
    '1-6': 'red', '2-1': 'red', '2-5': 'red', '2-7': 'red',
  }
  return (
    <div className="grid aspect-[8/3] grid-cols-8 grid-rows-3">
      {Array.from({ length: 24 }, (_, i) => {
        const r = Math.floor(i / 8)
        const c = i % 8
        const dark = (r + c) % 2 === 1
        const disc = discs[`${r}-${c}`]
        return (
          <span
            key={i}
            className="flex items-center justify-center"
            style={{ background: dark ? 'var(--game-sq-dark)' : 'var(--game-sq-light)' }}
          >
            {disc && (
              <span
                className="h-[70%] w-[70%] rounded-full"
                style={{
                  background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,.30) 0%, rgba(255,255,255,0) 55%), ${
                    disc === 'red' ? 'var(--game-piece-red)' : 'var(--game-piece-dark)'
                  }`,
                  boxShadow: `inset 0 0 0 1.5px ${
                    disc === 'red' ? 'var(--game-piece-red-rim)' : 'var(--game-piece-dark-rim)'
                  }, var(--game-piece-shadow)`,
                }}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}

function Connect4Preview() {
  // A near-win: three red in a row with one slot left, which is the moment
  // the game is actually about.
  const filled: Record<string, 'red' | 'yellow'> = {
    '2-1': 'red', '2-2': 'red', '2-3': 'red',
    '2-4': 'yellow', '2-6': 'yellow', '1-2': 'yellow', '1-3': 'red',
  }
  return (
    <div
      className="grid aspect-[7/3] grid-cols-7 grid-rows-3 gap-[4px] p-[5px]"
      style={{ background: 'linear-gradient(180deg, var(--game-c4-cabinet) 0%, var(--game-c4-cabinet-deep) 120%)' }}
    >
      {Array.from({ length: 21 }, (_, i) => {
        const r = Math.floor(i / 7)
        const c = i % 7
        const disc = filled[`${r}-${c}`]
        return (
          <span
            key={i}
            className="rounded-full"
            style={
              disc
                ? {
                    background: `radial-gradient(circle at 33% 27%, rgba(255,255,255,.42) 0%, rgba(255,255,255,0) 58%), ${
                      disc === 'red' ? 'var(--game-c4-red)' : 'var(--game-c4-yellow)'
                    }`,
                    boxShadow: 'inset 0 -3px 5px rgba(20,12,6,.32), inset 0 0 0 1px rgba(20,12,6,.30)',
                  }
                : {
                    background: 'var(--game-c4-cabinet-deep)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,.55)',
                  }
            }
          />
        )
      })}
    </div>
  )
}

function CrosswordPreview() {
  // CAT crossing COW on a shared C.
  const grid: (string | null)[][] = [
    [null, 'P', null, null, 'S', null, null, null],
    ['O', 'L', 'D', null, 'U', null, null, null],
    [null, 'A', null, null, 'N', 'E', 'W', null],
  ]
  return (
    <div className="grid aspect-[8/3] grid-cols-8 grid-rows-3 p-[5px]" style={{ background: 'var(--game-paper)' }}>
      {grid.flatMap((row, r) =>
        row.map((letter, c) => (
          <span
            key={`${r}-${c}`}
            className="flex items-center justify-center text-[clamp(12px,4vw,19px)] font-bold uppercase leading-none text-ink"
            style={
              letter
                ? { boxShadow: 'inset 0 0 0 1px var(--game-paper-rule)', background: r === 1 ? 'var(--game-active-word)' : 'var(--game-paper)' }
                : undefined
            }
          >
            {letter}
          </span>
        )),
      )}
    </div>
  )
}

function WordTilesPreview() {
  const tiles = ['W', 'O', 'R', 'D', 'S']
  return (
    <div
      className="flex aspect-[8/3] items-center justify-center gap-[5px] p-2"
      style={{ background: 'linear-gradient(180deg, var(--game-bezel-lip) 0%, var(--game-bezel) 100%)' }}
    >
      {tiles.map((t, i) => (
        <span
          key={t}
          className="flex aspect-square w-[11.5%] items-center justify-center rounded-[4px] text-[clamp(13px,4.4vw,20px)] font-bold uppercase leading-none text-ink"
          style={{
            background: 'linear-gradient(180deg, var(--game-tile-lit) 0%, var(--game-tile) 62%, var(--game-tile-edge) 100%)',
            boxShadow: 'inset 0 0 0 1px var(--game-tile-edge), 0 1px 2px rgba(20,12,6,.35)',
            transform: i % 2 ? 'translateY(2px)' : 'translateY(-2px)',
          }}
        >
          {t}
        </span>
      ))}
    </div>
  )
}
