/**
 * The one description of each Downtime game.
 *
 * /games (public, no login) and /downtime (inside the child app) used to keep
 * separate hardcoded arrays, so the same game was "Four in a row wins." on one
 * page and "Line up four in a row before your opponent does." on the other,
 * with different emoji. One list, two routes.
 *
 * `slug` differs between the two surfaces for Connect 4 — the public URL is
 * /games/connect-4 (hyphenated, which is what it was indexed as) and the
 * in-app one is /downtime/connect4. Both are kept rather than redirected so
 * no existing link breaks.
 */
/** The games this product ships. Drives both the pickers and the board art. */
export type GameId = 'chess' | 'checkers' | 'connect-4' | 'crossword' | 'word-tiles'

export type GameEntry = {
  id: GameId
  name: string
  /** Public route segment under /games. */
  publicSlug: string
  /** In-app route segment under /downtime. */
  appSlug: string
  /** What the game is, in one line. */
  blurb: string
  /** How a turn actually works — the thing a first-time player needs. */
  howToPlay: string
  /**
   * The thinking the game asks for. This is the parent-facing half of the
   * card: it is what makes handing over the tablet an easy decision. Kept
   * deliberately modest and specific, because a vague claim about "cognitive
   * development" is worth less than naming the one skill the game drills.
   */
  builds: string
  /** Who you can play. Order matters: the default mode comes first. */
  modes: ('computer' | 'friend' | 'solo')[]
  /** Rough length, so a child can pick something that fits the time they have. */
  minutes: string
}

export const GAME_CATALOGUE: GameEntry[] = [
  {
    id: 'chess',
    name: 'Chess',
    publicSlug: 'chess',
    appSlug: 'chess',
    blurb: 'The classic strategy game. Trap the other king and you win.',
    howToPlay: 'Tap a piece to see everywhere it can go, then tap where you want it.',
    builds: 'Planning several moves ahead, and living with the ones already made.',
    modes: ['computer', 'friend'],
    minutes: '10 to 30 min',
  },
  {
    id: 'checkers',
    name: 'Checkers',
    publicSlug: 'checkers',
    appSlug: 'checkers',
    blurb: 'Jump over your opponent to capture. Reach the far side to crown a king.',
    howToPlay: 'Move diagonally one square. If a jump is on offer, you have to take it.',
    builds: 'Reading a trade before you take it, and counting the cost.',
    modes: ['computer', 'friend'],
    minutes: '5 to 15 min',
  },
  {
    id: 'connect-4',
    name: 'Connect 4',
    publicSlug: 'connect-4',
    appSlug: 'connect4',
    blurb: 'Drop discs down the board and get four in a row before the other player.',
    howToPlay: 'Pick a column. Your disc falls to the bottom. Four in any direction wins.',
    builds: 'Spotting a threat two moves before it arrives.',
    modes: ['computer', 'friend'],
    minutes: '3 to 8 min',
  },
  {
    id: 'crossword',
    name: 'Crossword',
    publicSlug: 'crossword',
    appSlug: 'crossword',
    blurb: 'Pick a theme and fill in a puzzle that is built fresh every single time.',
    howToPlay: 'Tap a square, read its clue, type the answer. Check or reveal whenever you like.',
    builds: 'Vocabulary and spelling, with no worksheet anywhere in sight.',
    modes: ['solo'],
    minutes: '5 to 10 min',
  },
  {
    id: 'word-tiles',
    name: 'Word Tiles',
    publicSlug: 'word-tiles',
    appSlug: 'word-tiles',
    blurb: 'Build words from lettered tiles on a shared board. Most points wins.',
    howToPlay: 'Place tiles to make a word that touches one already there. Land on a coloured square for more points.',
    builds: 'Spelling, word-building, and a bit of arithmetic on every turn.',
    modes: ['friend'],
    minutes: '15 to 25 min',
  },
]

export const MODE_LABEL: Record<GameEntry['modes'][number], string> = {
  computer: 'vs computer',
  friend: 'with a friend',
  solo: 'on your own',
}
