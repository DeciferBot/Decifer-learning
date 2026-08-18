// Word banks for Downtime's Crossword. Just-for-fun content, not curriculum
// content — same reasoning as Chess/Checkers/Connect 4's hand-written rules
// (see CLAUDE.md §4: "no hardcoded content" governs the pipeline-driven
// curriculum, not these standalone games). Every word is a single token,
// uppercase A-Z only — the grid generator relies on that.

export type CrosswordEntry = { word: string; clue: string }

export type CrosswordTheme = {
  id: string
  label: string
  emoji: string
  entries: CrosswordEntry[]
}

export const CROSSWORD_THEMES: CrosswordTheme[] = [
  {
    id: 'animals',
    label: 'Animals',
    emoji: '🦁',
    entries: [
      { word: 'LION', clue: 'King of the jungle' },
      { word: 'TIGER', clue: 'Big cat with orange and black stripes' },
      { word: 'ZEBRA', clue: 'Striped relative of the horse' },
      { word: 'GIRAFFE', clue: 'Tallest land animal' },
      { word: 'MONKEY', clue: 'Swings through trees and loves bananas' },
      { word: 'PANDA', clue: 'Black and white bear that eats bamboo' },
      { word: 'KOALA', clue: 'Sleepy Australian animal that eats eucalyptus' },
      { word: 'RABBIT', clue: 'Long-eared animal that hops' },
      { word: 'SNAKE', clue: 'Legless reptile that slithers' },
      { word: 'ELEPHANT', clue: 'Huge animal with a long trunk' },
      { word: 'PENGUIN', clue: 'Black and white bird that cannot fly but can swim' },
      { word: 'KANGAROO', clue: 'Australian animal that hops and carries its baby in a pouch' },
      { word: 'OWL', clue: 'Bird that hunts at night and says "hoo"' },
      { word: 'FOX', clue: 'Orange, bushy-tailed woodland animal' },
      { word: 'BEAR', clue: 'Large, furry forest animal that loves honey' },
    ],
  },
  {
    id: 'space',
    label: 'Space',
    emoji: '🚀',
    entries: [
      { word: 'PLANET', clue: 'A world that orbits a star' },
      { word: 'MOON', clue: 'Orbits the Earth and controls the tides' },
      { word: 'STAR', clue: 'A giant ball of burning gas in the night sky' },
      { word: 'ROCKET', clue: 'Vehicle that blasts off into space' },
      { word: 'EARTH', clue: 'The planet we live on' },
      { word: 'MARS', clue: 'The red planet' },
      { word: 'SUN', clue: 'The star at the centre of our solar system' },
      { word: 'COMET', clue: 'Icy space object with a glowing tail' },
      { word: 'ORBIT', clue: 'The path a planet takes around a star' },
      { word: 'GALAXY', clue: 'A huge collection of stars — ours is the Milky Way' },
      { word: 'ASTRONAUT', clue: 'A person who travels into space' },
      { word: 'SATURN', clue: 'The planet famous for its rings' },
      { word: 'JUPITER', clue: 'The biggest planet in our solar system' },
      { word: 'METEOR', clue: 'A shooting star burning up in the sky' },
      { word: 'TELESCOPE', clue: 'Instrument used to see far-away stars and planets' },
    ],
  },
  {
    id: 'ocean',
    label: 'Under the Sea',
    emoji: '🐙',
    entries: [
      { word: 'OCTOPUS', clue: 'Sea creature with eight arms' },
      { word: 'SHARK', clue: 'Sharp-toothed ocean predator' },
      { word: 'WHALE', clue: 'The largest animal in the ocean' },
      { word: 'CORAL', clue: 'Colourful underwater structure built by tiny animals' },
      { word: 'STARFISH', clue: 'Star-shaped creature found on the seabed' },
      { word: 'DOLPHIN', clue: 'Clever, friendly sea mammal that clicks and whistles' },
      { word: 'CRAB', clue: 'Sideways-walking creature with pincers' },
      { word: 'JELLYFISH', clue: 'See-through sea creature with a sting' },
      { word: 'SEAHORSE', clue: 'Tiny fish shaped like a horse' },
      { word: 'TURTLE', clue: 'Sea reptile that carries its home on its back' },
      { word: 'EEL', clue: 'Long, snake-like fish' },
      { word: 'CLAM', clue: 'Shellfish that can close its shell tight' },
      { word: 'SQUID', clue: 'Ocean creature that squirts ink to escape' },
      { word: 'REEF', clue: 'An underwater ridge often made of coral' },
      { word: 'TIDE', clue: 'The rise and fall of the sea' },
    ],
  },
  {
    id: 'uk',
    label: 'UK Geography',
    emoji: '🗺️',
    entries: [
      { word: 'LONDON', clue: "The UK's capital city" },
      { word: 'SCOTLAND', clue: 'Home to Edinburgh and the Highlands' },
      { word: 'WALES', clue: 'Home to Cardiff and Mount Snowdon' },
      { word: 'THAMES', clue: 'The river that flows through London' },
      { word: 'ENGLAND', clue: 'The largest country in the UK' },
      { word: 'BRISTOL', clue: 'City famous for its suspension bridge' },
      { word: 'BELFAST', clue: 'Capital of Northern Ireland' },
      { word: 'EDINBURGH', clue: "Scotland's capital city" },
      { word: 'CARDIFF', clue: "Wales's capital city" },
      { word: 'MANCHESTER', clue: 'Northern English city famous for football' },
      { word: 'SNOWDON', clue: 'The highest mountain in Wales' },
      { word: 'SEVERN', clue: 'The longest river in the UK' },
      { word: 'ISLAND', clue: 'Land completely surrounded by water — the UK is made of these' },
      { word: 'CASTLE', clue: 'Old fortified building — the UK has hundreds' },
      { word: 'COAST', clue: 'Where the land meets the sea' },
    ],
  },
]

export function findTheme(id: string): CrosswordTheme | undefined {
  return CROSSWORD_THEMES.find((t) => t.id === id)
}
