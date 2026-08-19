import { describe, it, expect } from 'vitest'
import { cleanNickname, NICKNAME_MAX_LENGTH } from '@/lib/live/nickname'

// Guest nicknames in Decifer Blitz are broadcast to every other player, and the
// players are children. These tests pin the filter's behaviour on both sides:
// what must get through, and what must not.

describe('cleanNickname — shape and bounds', () => {
  it('accepts an ordinary nickname unchanged', () => {
    expect(cleanNickname('Zara')).toBe('Zara')
  })

  it('rejects non-strings', () => {
    expect(cleanNickname(undefined)).toBeNull()
    expect(cleanNickname(null)).toBeNull()
    expect(cleanNickname(42)).toBeNull()
    expect(cleanNickname({ nickname: 'Zara' })).toBeNull()
  })

  it('trims and collapses whitespace', () => {
    expect(cleanNickname('  Zara   the   Brave ')).toBe('Zara the Brave')
  })

  it('rejects an empty or whitespace-only name', () => {
    expect(cleanNickname('')).toBeNull()
    expect(cleanNickname('   ')).toBeNull()
    expect(cleanNickname('\t\n')).toBeNull()
  })

  it('truncates to the maximum length', () => {
    const long = 'Abcdefghijklmnopqrstuvwxyz'
    const out = cleanNickname(long)
    expect(out).toBe(long.slice(0, NICKNAME_MAX_LENGTH))
    expect(out!.length).toBe(NICKNAME_MAX_LENGTH)
  })

  it('rejects a name with no letters or digits', () => {
    expect(cleanNickname('!!!')).toBeNull()
    expect(cleanNickname('🎉🎉')).toBeNull()
    expect(cleanNickname('***')).toBeNull()
  })

  it('keeps accented names intact', () => {
    expect(cleanNickname('José')).toBe('José')
    expect(cleanNickname('Zoë')).toBe('Zoë')
  })
})

describe('cleanNickname — invisible and layout-breaking characters', () => {
  it('strips zero-width characters', () => {
    expect(cleanNickname('Za​ra')).toBe('Zara')
  })

  it('strips bidi override characters', () => {
    expect(cleanNickname('‮Zara‬')).toBe('Zara')
  })

  it('flattens Zalgo combining-mark stacks to one mark', () => {
    const zalgo = 'Ź́́́ä̈ra'
    const out = cleanNickname(zalgo)!
    // No character is left carrying more than one combining mark.
    expect(/\p{M}\p{M}/u.test(out)).toBe(false)
    expect(out).toMatch(/ra$/)
  })

  it('rejects a name that is only invisible characters', () => {
    expect(cleanNickname('​​')).toBeNull()
  })
})

describe('cleanNickname — profanity', () => {
  it('rejects plain profanity', () => {
    expect(cleanNickname('fuck')).toBeNull()
    expect(cleanNickname('shit')).toBeNull()
    expect(cleanNickname('bitch')).toBeNull()
  })

  it('rejects profanity embedded in a longer name', () => {
    expect(cleanNickname('xXfuckXx')).toBeNull()
    expect(cleanNickname('Team Bitch 99')).toBeNull()
  })

  it('rejects profanity spaced or punctuated out', () => {
    expect(cleanNickname('f u c k')).toBeNull()
    expect(cleanNickname('f.u.c.k')).toBeNull()
    expect(cleanNickname('s-h-i-t')).toBeNull()
  })

  it('rejects leetspeak substitutions', () => {
    expect(cleanNickname('fvck')).toBeNull()
    expect(cleanNickname('$h1t')).toBeNull()
    expect(cleanNickname('b17ch')).toBeNull()
    expect(cleanNickname('f4g')).toBeNull()
  })

  it('rejects repeated-letter padding', () => {
    expect(cleanNickname('fuuuuck')).toBeNull()
    expect(cleanNickname('shhhiiit')).toBeNull()
  })

  it('rejects the ph-for-f swap', () => {
    expect(cleanNickname('phuck')).toBeNull()
  })

  it('rejects accented and homoglyph spellings', () => {
    expect(cleanNickname('fück')).toBeNull()
    expect(cleanNickname('shіt')).toBeNull() // Cyrillic і
  })

  it('rejects slurs', () => {
    expect(cleanNickname('n1gger')).toBeNull()
    expect(cleanNickname('retard')).toBeNull()
    expect(cleanNickname('Team Nazi')).toBeNull()
  })

  it('rejects self-harm references', () => {
    expect(cleanNickname('kill yourself')).toBeNull()
    expect(cleanNickname('kys')).toBeNull()
  })

  it('rejects mild rude words used as whole words', () => {
    expect(cleanNickname('Big Ass')).toBeNull()
    expect(cleanNickname('poop')).toBeNull()
    expect(cleanNickname('Tits')).toBeNull()
  })

  it('rejects a name that is only clean because it was truncated', () => {
    expect(cleanNickname('Perfectly fine namefuck')).toBeNull()
  })
})

describe('cleanNickname — personal details', () => {
  it('rejects email addresses', () => {
    expect(cleanNickname('zara@gmail.com')).toBeNull()
    expect(cleanNickname('a@b.co')).toBeNull()
  })

  it('rejects obfuscated email addresses', () => {
    expect(cleanNickname('zara at gmail dot com')).toBeNull()
    expect(cleanNickname('zara hotmail')).toBeNull()
  })

  it('rejects phone numbers, however they are punctuated', () => {
    expect(cleanNickname('07700900123')).toBeNull()
    expect(cleanNickname('0770 090 0123')).toBeNull()
    expect(cleanNickname('+44 7700 900123')).toBeNull()
    expect(cleanNickname('(077) 009-00123')).toBeNull()
  })

  it('still allows a short number in a name', () => {
    expect(cleanNickname('Zara2010')).toBe('Zara2010')
    expect(cleanNickname('Player 7')).toBe('Player 7')
  })

  it('rejects contact-platform handles', () => {
    expect(cleanNickname('add me snapchat')).toBeNull()
    expect(cleanNickname('Zara TikTok')).toBeNull()
  })
})

describe('cleanNickname — URLs', () => {
  it('strips a full URL and keeps the rest of the name', () => {
    expect(cleanNickname('Zara https://evil.example')).toBe('Zara')
  })

  it('strips a www address', () => {
    expect(cleanNickname('Zara www.bad.site')).toBe('Zara')
  })

  it('strips a bare domain', () => {
    expect(cleanNickname('Zara bad.com/x')).toBe('Zara')
  })

  it('rejects a name that is nothing but a URL', () => {
    expect(cleanNickname('https://evil.example/join')).toBeNull()
    expect(cleanNickname('bit.ly/abc')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Sweeps. These are the two failure modes that matter, checked in bulk:
// blocking a real child's name, and letting an insult onto the leaderboard.
// Both assert against an empty array so a regression names the offenders.
// ---------------------------------------------------------------------------

// The Scunthorpe problem. Real first names, place names, school words and
// ordinary kid nicknames that contain a blocked substring.
const MUST_ALLOW = [
  'Oliver', 'Amelia', 'Muhammad', 'Aisha', 'Noah', 'Isla', 'Ravi', 'Priya',
  'Zainab', 'Yusuf', 'Charlie', 'Freya', 'Harper', 'Theo', 'Ada', 'Kai', 'Mia',
  'Alexis', 'Alexander', 'Cassandra', 'Cassie', 'Grace', 'Constance', 'Titus',
  'Titania', 'Dickson', 'Bassett', 'Analiese', 'Annalise', 'Anastasia',
  'Sebastian', 'Basil', 'Basildon', 'Bastion', 'Bastille',
  'Scunthorpe', 'Sussex Sam', 'Essex Kid', 'Sexton', 'Cockburn', 'Cumbria',
  'Cumberland', 'Amsterdam', 'Rotterdam', 'Niger', 'Nigel', 'Nigella',
  'Homer', 'Homework', 'Homophone', 'Peacock', 'Woodcock', 'Cocker',
  'Cocktail', 'Cockpit', 'Cockroach', 'Assassin', 'Assam Tea', 'Bass Player',
  'Class 6B', 'Glasses', 'Passport', 'Compass', 'Harass', 'Klass',
  'Analysis', 'Analyst', 'Analogue', 'Anagram', 'Canal Boat', 'Banana',
  'Circumference', 'Accumulator', 'Document', 'Cucumber', 'Uranus',
  'Manuscript', 'Pedometer', 'Spice Girl', 'Spicy', 'Shiitake', 'Pussycat',
  'Grapefruit', 'Therapy Dog', 'Trapeze Kid', 'Drapes', 'Scraper', 'Scrapbook',
  'Butterfly', 'Buttercup', 'Button', 'Debut', 'Tribute', 'Attribute',
  'Titchmarsh', 'Multitude', 'Attitude', 'Institute', 'Competition',
  'Petunia', 'Peanut', 'Peace', 'Speed', 'Popcorn', 'Poppy', 'Spoon',
  'Fartlek', 'Farther', 'Father', 'Farmer', 'Comfort', 'Cracker', 'Scrap',
  'Aircraft', 'Handicraft', 'Saturday', 'Sturdy', 'Absurd', 'Knobbly',
  'Knowledge', 'Bumble Bee', 'Bumper', 'Number 1', 'Willow', 'William',
  'Willie', 'Wangari', 'Prickly Pear', 'Trickster', 'Quick Sam',
  'Hellen', 'Helen', 'Michelle', 'Rochelle', 'Damian', 'Adam', 'Madame',
  'Gitanjali', 'Digit', 'Legit', 'Phoebe', 'Philip', 'Stephen', 'Elephant',
  'Graphite', 'Physics Fan', 'Snickers', 'Knickers', 'Slither',
  'MathsWiz', 'Speedy Sam', 'Dragon99', 'Team Rocket', 'Captain Cool',
  'Mega Brain', 'Star Girl', 'Blue Falcon', 'QuizKing', 'Minecraft',
  'Roblox Pro', 'Football', 'Netball', 'Basketball', 'Cricket',
]

describe('cleanNickname — sweep: names that must get through', () => {
  it('lets every ordinary name through unchanged', () => {
    const refused = MUST_ALLOW.filter((name) => cleanNickname(name) !== name)
    expect(refused).toEqual([])
  })
})

// Insults, slurs, evasions and contact details that must never be broadcast.
const MUST_BLOCK = [
  'fuck', 'Fuck you', 'FUCK', 'fuuuck', 'f u c k', 'f*u*c*k', 'ph uck', 'fvck',
  'f0ck', 'fuk', 'shit', 'sh1t', '$hit', 'shitter', 'bullshit', 'shite', '5h1t',
  'cunt', 'c u n t', 'cvnt', 'kunt', 'bitch', 'b!tch', 'biatch', 'bastard',
  'nigger', 'n1gger', 'n i g g e r', 'nigga', 'n1gg4', 'faggot', 'f4gg0t',
  'fag', 'fa9', 'retard', 'r3tard', 'spastic', 'tranny', 'chink', 'kike',
  'wetback', 'gook', 'spic', 'rape', 'r4pe', 'rapist', 'paedo', 'p4edo',
  'pedo', 'molest', 'incest', 'penis', 'p3nis', 'pen1s', 'vagina', 'dildo',
  'blowjob', 'cumshot', 'jizz', 'porn', 'p0rn', 'anal', 'Anal', 'ANAL', 'cum',
  'anus', 'scrotum', 'pussy', 'pu55y', 'slut', '5lut', 'whore', 'sex', 's3x',
  'sexy', 'sexual', 'hentai', 'milf', 'horny', 'h0rny', 'boner', 'orgasm',
  'nazi', 'n4zi', 'hitler', 'h1tler', 'kkk', 'kill yourself', 'killyourself',
  'k y s', 'kys', 'suicide', 'su1cide',
  'ass', 'Ass', 'A55', 'arse', 'tits', 't1ts', 'boobs', 'b00bs', 'wank',
  'w4nk', 'twat', 'tw4t', 'poo', 'poop', 'piss', 'p1ss', 'fart', 'crap',
  'turd', 'knob', 'cock', 'c0ck', 'dick', 'd1ck', 'asshole', 'a$$hole',
  'arsehole', 'dickhead', 'cocksucker', 'motherfucker', 'bollocks',
  // Allow-listed words used as cover for a real term.
  'scunthorpefuck', 'graperape', 'homework fuck', 'uranusfuck',
  // Homoglyphs, accents and fullwidth forms.
  'ƒuck', 'shіt', 'fück', 'ｆｕｃｋ',
  // Contact details and off-platform handles.
  'zara@gmail.com', '07700900123', '+447700900123', 'www.evil.com',
  'https://evil.com', 'snapchat me', 'add my kik', 'discord gg abc',
  'my whatsapp',
]

describe('cleanNickname — sweep: names that must be refused', () => {
  it('refuses every one', () => {
    const admitted = MUST_BLOCK.filter((name) => cleanNickname(name) !== null)
    expect(admitted).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Cost. /api/live/join is unauthenticated, so a nickname must never be able to
// buy more than a trivial amount of CPU. The blocklist patterns put look-alike
// character classes next to each other ([i1!|l][l1|i]), which backtracks badly
// on a long run of the same letter — before the input cap and the run collapse
// in looseForm, 'ki' + 'l'.repeat(1000) ran for over five minutes.
// ---------------------------------------------------------------------------

describe('cleanNickname — cost', () => {
  const PATHOLOGICAL = [
    'k' + 'l'.repeat(59),
    'ki' + 'l'.repeat(57) + '!',
    'ki' + '1l'.repeat(28) + '!',
    'ki' + 'l1'.repeat(28) + 'y',
    'killyourse' + 'l'.repeat(45),
    'f' + 'uv'.repeat(28) + 'c',
    '$'.repeat(59),
    '1l'.repeat(30),
  ]

  // Measured against a benign nickname rather than a fixed millisecond budget.
  // The old 150ms-per-50-calls budget was measuring machine load, not the
  // matcher: it failed the suite at 152ms, 1.3% over.
  //
  // Be clear about what this test is and is not. Every input below sits under
  // MAX_INPUT_LENGTH, and at that length the matcher does not blow up even
  // with the run-collapse in looseForm disabled (checked directly). So this is
  // a smoke check on the shape of the cost curve, not the ReDoS guard.
  //
  // The actual guard is the length cap, and the two tests below it are the
  // ones with teeth: remove `raw.length > MAX_INPUT_LENGTH` and both fail,
  // because they feed 50,000 characters and allow 50ms. That is a margin of
  // roughly a thousand times, so they do not flake.
  const time = (input: string) => {
    const started = performance.now()
    for (let i = 0; i < 50; i++) cleanNickname(input)
    return performance.now() - started
  }

  it('stays fast on input built to make the matcher backtrack', () => {
    // A benign nickname of the same length is the control.
    const baseline = Math.max(time('Annalise' + 'a'.repeat(51)), 1)
    const slow: string[] = []
    for (const evil of PATHOLOGICAL) {
      const ratio = time(evil) / baseline
      if (ratio > 50) slow.push(`${evil.slice(0, 12)}… ${ratio.toFixed(0)}x a normal nickname`)
    }
    expect(slow).toEqual([])
  })

  it('refuses over-long input outright, without scanning it', () => {
    const started = Date.now()
    expect(cleanNickname('ki' + 'l'.repeat(50_000) + '!')).toBeNull()
    expect(Date.now() - started).toBeLessThan(50)
  })

  it('refuses anything longer than a nickname box could hold', () => {
    expect(cleanNickname('Zara'.repeat(20))).toBeNull()
  })
})
