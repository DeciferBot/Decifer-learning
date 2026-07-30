// Guest nickname cleaning + safety filtering for Decifer Blitz.
//
// A guest nickname is user-generated content: it is saved as
// live_game_players.display_name and broadcast to every other player in the
// game (lib/live/broadcast.ts). Blitz is joinable by anyone holding a PIN, with
// no account (app/join/page.tsx), and the players are children. So the nickname
// has to be filtered SERVER-SIDE — the client is never trusted. Both
// app/api/live/join and app/api/live/create run every nickname through
// cleanNickname() before it touches the database.
//
// Deliberate stance: this is a children's product, so the filter errs towards
// over-blocking. A child who has to pick a second nickname is a smaller harm
// than a child seeing a slur on the leaderboard. Known innocent words that
// contain a blocked substring (Scunthorpe, homework, document…) are allow-listed
// below, but the list cannot be exhaustive — some real names will be refused.
//
// This file contains a profanity and slur blocklist. It is a filter list.

export const NICKNAME_MAX_LENGTH = 20

// The nickname box holds 20 characters, so anything past this is either junk or
// an attempt to make the matching below expensive. The blocklist patterns use
// adjacent look-alike character classes, which backtrack polynomially on a long
// run of the same letter — capping the input (and collapsing runs, see
// looseForm) keeps that cost flat. This route is unauthenticated, so it matters.
const MAX_INPUT_LENGTH = 60

// ---------------------------------------------------------------------------
// Blocklists
// ---------------------------------------------------------------------------

// Matched anywhere inside the whole name once separators are removed, so
// "f u c k", "f-u-c-k" and "xXfuckXx" are all caught. Only put terms here that
// do not appear inside ordinary English words — anything that does goes in
// MILD_TERMS (whole-word only) or gets an ALLOWED_WORDS entry.
const SEVERE_TERMS = [
  'fuck', 'fuk', 'fock', 'shit', 'cunt', 'kunt', 'bitch', 'biatch', 'bastard',
  'whore', 'slut', 'wank',
  'bollock', 'asshole', 'arsehole', 'dickhead', 'cocksucker', 'motherfucker',
  'twat', 'anus', 'clit', 'dildo', 'blowjob', 'handjob', 'cumshot', 'jizz',
  'penis', 'vagina', 'boner', 'horny', 'orgasm', 'masturbat', 'porn', 'hentai',
  'nutsack', 'ballsack', 'scrotum', 'testicle', 'pussy', 'sex',
  'rape', 'rapist', 'molest', 'incest', 'paedo', 'pedo', 'milf',
  // Slurs.
  'nigger', 'nigga', 'chink', 'gook', 'kike', 'spic', 'wetback', 'faggot',
  'fag', 'tranny', 'retard', 'spastic', 'homo',
  // Hate references.
  'nazi', 'hitler', 'kkk',
  // Self-harm. Severe rather than mild so the spaced-out "k y s" is caught too.
  'killyourself', 'suicide', 'kys',
] as const

// Matched only as a whole word, because each of these sits inside perfectly
// innocent words (assassin, title, competition, peacock, Hancock, Annalise,
// Cumbria…). Short terms belong here even when they are crude on their own —
// a three-letter substring rule refuses too many real names to be worth it.
const MILD_TERMS = [
  'ass', 'arse', 'bum', 'butt', 'poo', 'poop', 'pee', 'piss', 'fart', 'crap',
  'turd', 'tit', 'tits', 'boob', 'boobs', 'knob', 'cock', 'dick', 'prick',
  'willy', 'wang', 'minge', 'fanny', 'dyke', 'damn', 'hell', 'bloody', 'bugger',
  'git', 'anal', 'cum',
] as const

// Contact-sharing: a nickname is broadcast to strangers, so a handle or
// platform name in it is an attempt to move a child off-platform.
const CONTACT_TERMS = [
  'whatsapp', 'snapchat', 'instagram', 'telegram', 'tiktok', 'discord', 'kik',
] as const

// Innocent words that contain a SEVERE_TERMS substring. Removed from the name
// before the severe scan runs, so "Scunthorpe" is fine but "Scunthorpefuck" is
// still caught. Each entry names the term it protects.
const ALLOWED_WORDS = [
  'scunthorpe', // cunt
  'penistone', // penis
  'clitheroe', // clit
  'shiitake', // shit
  'pussycat', // pussy
  'despicable', // spic
  'spice', 'spicy', // spic
  'uranus', 'manuscript', 'janus', // anus
  'pedometer', // pedo
  'grape', 'grapes', 'grapefruit', 'scrape', 'scraped', 'drape', 'trapeze',
  'therapist', 'therapy', // rape
  'sussex', 'essex', 'middlesex', 'sexton', // sex
  'homework', 'homogeneous', 'homophone', 'homograph', 'homosapien', // homo
  'skyscraper', 'skys', // kys
] as const

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

// Common look-alikes per letter, used to build the match patterns. Covers
// leetspeak (4 → a, 3 → e, $ → s) and the ambiguous i/l/1 family.
const LOOKALIKES: Record<string, string> = {
  a: 'a4@', b: 'b8', c: 'c(<[{', d: 'd', e: 'e3', f: 'f', g: 'g69', h: 'h',
  i: 'i1!|l', j: 'j', k: 'k', l: 'l1|i', m: 'm', n: 'n', o: 'o0', p: 'p',
  q: 'q', r: 'r', s: 's5$', t: 't7+', u: 'uv', v: 'v', w: 'w', x: 'x', y: 'y',
  z: 'z2',
}

// Non-ASCII characters that render like Latin ones and survive NFKD. Not
// exhaustive — it covers the substitutions that are easy to type, not every
// homoglyph in Unicode.
const HOMOGLYPHS: Record<string, string> = {
  // Cyrillic
  а: 'a', в: 'b', с: 'c', ԁ: 'd', е: 'e', ѕ: 's', і: 'i', ј: 'j', к: 'k',
  м: 'm', н: 'h', о: 'o', р: 'p', т: 't', у: 'y', х: 'x', г: 'r', п: 'n',
  // Greek
  α: 'a', β: 'b', ε: 'e', ι: 'i', κ: 'k', ο: 'o', ρ: 'p', τ: 't', υ: 'u',
  χ: 'x', ν: 'v',
  // Latin letters with no compatibility decomposition
  ƒ: 'f', ı: 'i', ł: 'l', ø: 'o', đ: 'd', ŧ: 't', ð: 'd', þ: 'p', ſ: 's',
  ß: 'ss', æ: 'ae', œ: 'oe',
}

function escapeForClass(chars: string): string {
  return chars.replace(/[\]\\^-]/g, '\\$&')
}

// "fuck" → /f+[uv]+[c(<[{]+k+/ — tolerant of look-alikes and repeated letters
// ("fuuuck", "fvck", "f4g"), but never of extra letters in between.
function termPattern(term: string): string {
  return term
    .split('')
    .map((ch) => {
      const set = LOOKALIKES[ch]
      return set ? `[${escapeForClass(set)}]+` : `${ch}+`
    })
    .join('')
}

const SEVERE_PATTERNS = SEVERE_TERMS.map((t) => new RegExp(termPattern(t)))
const CONTACT_PATTERNS = CONTACT_TERMS.map((t) => new RegExp(termPattern(t)))
// Whole word, with a tolerated plural ending.
const MILD_PATTERNS = MILD_TERMS.map((t) => new RegExp(`^${termPattern(t)}(?:s|es|z)?$`))

// Strip a name down to the form the blocklist is matched against: accents
// removed, homoglyphs folded to Latin, lowercased, and every separator or
// decoration dropped so spacing tricks don't hide anything. Look-alike symbols
// ($ @ ! | + …) are deliberately KEPT — the patterns above match them.
function looseForm(input: string): string {
  const folded = input
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '') // drop combining accents: "fück" → "fuck"
    .toLowerCase()
    .replace(/[^\p{ASCII}]/gu, (ch) => HOMOGLYPHS[ch] ?? ch)
  return (
    folded
      // Keep letters, digits and the look-alike symbols; bin everything else.
      .replace(/[^\p{L}\p{N}@$()[\]{}<>+|!]/gu, '')
      // Cap repeats at three. The patterns match repeated letters anyway
      // ("fuuuck"), and no blocked term has more than three of the same letter
      // in a row ("kkk"), so this changes no verdict — it just stops a long run
      // from making the matcher backtrack.
      .replace(/(.)\1{3,}/gu, '$1$1$1')
  )
}

// Remove the known-innocent words before the severe scan, so Scunthorpe and
// homework survive.
function stripAllowedWords(loose: string): string {
  let out = loose
  for (const word of ALLOWED_WORDS) out = out.split(word).join('')
  return out
}

function hasBlockedTerm(name: string): boolean {
  const loose = looseForm(name)

  // Severe + contact terms: substring match on the whole name.
  const scanned = stripAllowedWords(loose)
  // "ph" is the standard way round an "f" filter ("phuck").
  const variants = [scanned, scanned.replace(/ph/g, 'f')]
  for (const re of [...SEVERE_PATTERNS, ...CONTACT_PATTERNS]) {
    if (variants.some((v) => re.test(v))) return true
  }

  // Mild terms: whole word only, so "assassin" and "Hancock" are fine.
  const tokens = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  for (const token of tokens) {
    const t = looseForm(token)
    if (MILD_PATTERNS.some((re) => re.test(t))) return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Contact details
// ---------------------------------------------------------------------------

const EMAIL_RE = /[^\s@]+@[^\s@]+/
const OBFUSCATED_EMAIL_RE = /\bat\b.{0,12}\bdot\b/i
const MAIL_PROVIDER_RE = /gmail|hotmail|yahoo|outlook|icloud|protonmail/i

// The provider check is deliberately blunt: "zara hotmail" is an address being
// handed out even without the @, and no child needs "yahoo" in their nickname.
function looksLikeEmail(raw: string): boolean {
  return EMAIL_RE.test(raw) || OBFUSCATED_EMAIL_RE.test(raw) || MAIL_PROVIDER_RE.test(raw)
}

// Seven or more digits once the usual phone punctuation is removed. UK mobiles
// are 11 digits; 7 is short enough to catch a landline fragment and long enough
// not to trip on "player2010".
function looksLikePhone(raw: string): boolean {
  return /\d{7,}/.test(raw.replace(/[\s().+\-/]/g, ''))
}

const URL_RE = /(?:https?:\/\/|www\.)\S+/gi
const BARE_DOMAIN_RE =
  /\b[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.(?:com|net|org|io|co|uk|gg|tv|me|xyz|app|dev|info|biz|ru|link|live|shop|site|online|to|ly)\b(?:\/\S*)?/giu

function stripUrls(input: string): string {
  return input.replace(URL_RE, ' ').replace(BARE_DOMAIN_RE, ' ')
}

// Invisible and layout-breaking characters: control codes, zero-width joiners,
// bidi overrides, and Zalgo stacks of combining marks. Accents are preserved —
// only runs of more than one mark on the same base are trimmed.
function sanitiseDisplay(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/(\p{M})\p{M}+/gu, '$1')
    .trim()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Trim, sanitise, bound and content-filter a guest nickname. Returns null if
// the name can't be made safe; app/api/live/join turns that into a 400 on the
// same path as a missing nickname.
export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (raw.length > MAX_INPUT_LENGTH) return null

  // Contact details are checked on the raw input, before truncation, so a long
  // phone number can't be sliced down into something that looks harmless.
  if (looksLikeEmail(raw) || looksLikePhone(raw)) return null

  const stripped = sanitiseDisplay(stripUrls(sanitiseDisplay(raw)))
  if (!stripped) return null

  const name = stripped.slice(0, NICKNAME_MAX_LENGTH).trim()
  if (!name) return null

  // Must contain something readable — not just punctuation or emoji.
  if (!/[\p{L}\p{N}]/u.test(name)) return null

  // Check both what will be shown and the full pre-truncation string: a name
  // that is only clean because it got cut short is not a clean name.
  if (hasBlockedTerm(name) || hasBlockedTerm(stripped)) return null

  return name
}
