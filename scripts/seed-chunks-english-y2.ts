/**
 * Seed curriculum_chunks for Year 2 English (KS1).
 *
 * These chunks form the RAG knowledge base for Stage 1 of the content pipeline.
 * Text is derived from NC 2014 English KS1 Year 2 statutory programme of study.
 *
 * Idempotent: skips existing chunks.
 * NOTE: After seeding, run embed_chunks.py on the DO droplet.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-english-y2.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT = 'English'
const YEAR_GROUP = 'year-2'
const SOURCE = 'NC 2014 English KS1 Year 2 Programme of Study'

const CHUNKS: string[] = [
  // Phonics — common phonemes and digraphs
  `A digraph is two letters that together make one sound. Consonant digraphs: "ch" (chair, chip), "sh" (shop, fish), "th" (this, think — can be voiced or unvoiced), "wh" (when, wheel), "ph" (phone, photo), "ng" (ring, sing), "ck" (duck, clock). Vowel digraphs: "ai" (rain, tail), "ee" (feet, tree), "oa" (boat, coat), "oo" (moon, food; also as in "book"), "ue" (blue, clue), "ow" (snow, slow; also as in "cow"), "ou" (cloud, mouse).`,

  `Split digraphs (also called "magic e"): a vowel-consonant-e pattern where the final 'e' is silent but changes the sound of the vowel before the consonant. Examples: a-e (cape, gate, late), i-e (time, bike, smile), o-e (home, bone, note), u-e (cube, tune, cute), e-e (these, delete). Without the 'e': cap, gat, tim, bik, hom. The 'e' "magic" makes the vowel say its letter name (long vowel sound).`,

  `Year 2 phonic patterns: Pupils in Year 2 learn to read and spell words using more complex phonics. Suffix -ing: running (double consonant: run→running), swimming, hopping. Suffix -ed: jumped (no change), hummed (double), smiled (drop e). Suffix -er, -est (for comparisons): big → bigger → biggest, nice → nicer → nicest, happy → happier → happiest (change y to i). Prefix un- makes an opposite: unhappy, undo, unlike.`,

  // Spelling — common exception words
  `Year 2 common exception words (tricky words) — these do not follow regular phonics patterns and must be learnt by sight: door, floor, poor, because, find, kind, mind, behind, child, children, wild, climb, most, only, both, old, cold, gold, hold, told, every, everybody, even, great, break, steak, pretty, beautiful, after, fast, last, past, father, class, grass, pass, plant, path, bath, hour, move, prove, improve, sure, sugar.`,

  `Spelling rules for Year 2: Adding suffixes to words ending in 'y': if a word ends in a consonant + y, change y to i before adding -es, -ed, -er, -est: cry → cries, tried, cried; happy → happier, happiest. But keep the y before -ing: crying, trying. Homophones (words that sound the same but are spelled differently and mean different things): there/their/they're, hear/here, see/sea, bare/bear, be/bee, blue/blew, night/knight, write/right.`,

  // Grammar — word classes
  `Nouns are naming words — they name people, places, things, and ideas. Common nouns: dog, table, city, happiness. Proper nouns name specific people, places, or things and always start with a capital letter: London, Monday, Emma, Christmas. Adjectives are describing words that give more information about a noun. They can describe colour, size, shape, or feeling: a tiny, round, red button. Expanded noun phrases add one or more adjectives: "the old wooden door" tells us more than just "the door".`,

  `Verbs are action or doing words: run, jump, eat, think, is, are. Every sentence needs a verb. Verb tenses: present tense (happening now) — "I run", "she runs", "they are running". Past tense (happened before) — "I ran", "she ran", "they were running". Future tense (will happen) — "I will run". Adverbs modify (add information to) verbs. Many adverbs end in -ly: quickly, slowly, happily, quietly. They tell us how something is done.`,

  // Grammar — sentences and punctuation
  `A sentence is a group of words that makes complete sense. It must have a subject (who or what the sentence is about) and a verb. Every sentence starts with a capital letter and ends with a full stop (.), question mark (?), or exclamation mark (!). A statement gives information: "The cat sat on the mat." A question asks something and ends with ?: "Where is the cat?" An exclamation shows strong feeling and ends with !: "What a beautiful day!" A command tells someone to do something: "Sit down."`,

  `Punctuation in Year 2: A capital letter is used at the start of every sentence and for proper nouns (names of people, places, days, months). A full stop (.) ends a statement. A question mark (?) ends a question. An exclamation mark (!) ends an exclamation or command. A comma (,) separates items in a list: "I bought apples, oranges, bananas, and grapes." (Note: no comma before "and" in simple lists at KS1.) An apostrophe shows possession: "the cat's basket" (one cat). It also shows where letters are missing in contractions: can't (cannot), I'm (I am), don't (do not).`,

  // Reading — comprehension
  `Reading comprehension skills for Year 2: Pupils learn to understand and explain what they have read. Key skills: retrieval — finding information that is stated directly in the text ("According to the passage, where did...?"); sequencing — putting events in the order they happened; inference — working out something that is not directly stated ("How do you think the character feels? What clues tell you this?"); prediction — using what you know from the text to predict what might happen next.`,

  `Features of different text types: Fiction (stories) uses characters, setting, plot, dialogue, and description. Non-fiction includes information texts (facts, headings, subheadings, diagrams), instructions (numbered steps, imperative verbs like "First, take..."), recounts (written in past tense, time connectives: "First, then, after that, finally"), and persuasive texts (opinions presented as facts, rhetorical questions). Pupils learn to identify text type from its features and purpose.`,
]

async function main() {
  console.log('Seeding Year 2 English curriculum chunks...\n')

  let inserted = 0
  let skipped = 0

  for (const chunk_text of CHUNKS) {
    const existing = await prisma.curriculumChunk.findFirst({
      where: { subject: SUBJECT, year_group: YEAR_GROUP, chunk_text },
    })
    if (existing) {
      skipped++
      continue
    }
    try {
      await prisma.curriculumChunk.create({
        data: { subject: SUBJECT, year_group: YEAR_GROUP, source_name: SOURCE, chunk_text },
      })
      inserted++
    } catch (err) {
      console.error(`  ❌ Failed to insert chunk: ${err}`)
    }
  }

  console.log(`  Inserted: ${inserted}, Skipped: ${skipped}`)
  console.log('\n  ⚠  Embeddings are NULL — run embed_chunks.py on the DO droplet.\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
