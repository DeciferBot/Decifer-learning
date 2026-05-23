/**
 * Seed curriculum_chunks for Year 3 English.
 *
 * These chunks form the RAG knowledge base used by Stage 1 of the content pipeline.
 * Text is derived from statutory NC 2014 guidance and plain-language summaries
 * suitable for KS2 content generation grounding.
 *
 * Idempotent: chunks are skipped if an identical chunk_text already exists.
 *
 * NOTE: After seeding, run the /ingest endpoint to compute embeddings.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-english-y3.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT = 'English'
const YEAR_GROUP = 'year-3'
const SOURCE = 'NC 2014 English KS2 Year 3/4 Programme of Study'

const CHUNKS: string[] = [
  // Grammar — conjunctions
  `Year 3 pupils learn to extend sentences using conjunctions. Key conjunctions include: when, if, because, although, while, until, before, after. A conjunction joins two clauses in a sentence. For example: "I went inside because it was raining." The word "because" is a subordinating conjunction that introduces the reason clause.`,

  // Grammar — clauses
  `A clause contains a subject and a verb. A main clause makes sense on its own. A subordinate clause does not make complete sense alone and depends on the main clause. Example: "Although it was cold [subordinate], we went outside [main]."`,

  // Grammar — present perfect
  `The present perfect tense describes an action that has happened at some point in the past and may still be relevant now. It is formed using "have" or "has" plus the past participle. Examples: "I have eaten my lunch." "She has finished her homework." This is different from the simple past tense: "I ate my lunch."`,

  // Grammar — pronouns
  `Pronouns replace nouns to avoid repetition. Personal pronouns include: I, you, he, she, it, we, they. Possessive pronouns: mine, yours, his, hers, its, ours, theirs. Example: Instead of "Tom went to Tom's room and Tom picked up Tom's bag", we write "Tom went to his room and he picked up his bag."`,

  // Grammar — fronted adverbials
  `Adverbials tell us when, where, how or why something happens. A fronted adverbial appears at the start of a sentence and is followed by a comma. Examples: "Nervously, she opened the door." "In the morning, we always have breakfast." "Because he was late, Tom ran to school."`,

  // Grammar — apostrophes
  `A possessive apostrophe shows ownership. For singular nouns: add apostrophe-s (e.g., the dog's bone). For plural nouns ending in s: add just an apostrophe (e.g., the dogs' bones). For irregular plurals not ending in s: add apostrophe-s (e.g., the children's playground).`,

  // Grammar — direct speech
  `Direct speech is the exact words spoken by someone, shown in inverted commas (speech marks). Punctuation goes inside the speech marks. A new speaker starts a new line. Example: "I'm hungry," said Mia. Tom replied, "Let's find some food."`,

  // Spelling — statutory word list part 1
  `Year 3 and 4 statutory spelling word list (first part): accident, actual, address, answer, appear, arrive, believe, bicycle, breath, breathe, build, busy, business, calendar, caught, centre, century, certain, circle, complete, consider, continue, decide, describe, different, difficult, disappear, early, earth, eight, enough, exercise, experience, experiment, extreme.`,

  // Spelling — statutory word list part 2
  `Year 3 and 4 statutory spelling words (continued): famous, favourite, February, forward, fruit, grammar, group, guard, guide, heard, heart, height, history, imagine, important, increase, island, knowledge, learn, length, library, material, medicine, mention, minute, natural, naughty, notice, occasion, often, opposite, ordinary, particular, peculiar, perhaps, popular, position, possess, possession, possible.`,

  // Spelling — statutory word list part 3
  `Year 3 and 4 statutory spelling words (further): potatoes, pressure, probably, promise, purpose, quarter, question, recent, regular, reign, remember, sentence, separate, special, straight, strange, strength, suppose, surprise, therefore, though, through, various, weight, woman, women.`,

  // Spelling — prefixes
  `Prefixes change the meaning of a word. Common prefixes at Year 3: un- (not: unhappy), re- (again: rewrite), pre- (before: prehistoric), dis- (opposite: disappear), mis- (wrongly: misunderstand), inter- (between: international), super- (above: supermarket), anti- (against: antibiotic), auto- (self: autobiography).`,

  // Spelling — suffixes
  `Suffixes are added to the end of a word to change its meaning or word class. Common suffixes: -tion or -sion (makes nouns: celebration, tension), -ly (makes adverbs: quickly), -ment (makes nouns: excitement), -ness (makes nouns: sadness), -ful (full of: hopeful), -less (without: careless), -ous (full of: dangerous).`,

  // Spelling — homophones
  `Homophones are words that sound the same but have different spellings and meanings. Year 3 and 4 examples: there / their / they're, to / too / two, hear / here, wear / where / ware, son / sun, weather / whether, which / witch, peace / piece, main / mane, plain / plane, scene / seen, grown / groan, knot / not, night / knight.`,

  // Reading — comprehension skills
  `Reading comprehension skills for Year 3 include: identifying the main idea of a text or paragraph; summarising what has been read; using clues in the text to make inferences (working out what is implied but not directly stated); predicting what might happen next based on what has been read; and asking questions to deepen understanding.`,

  // Reading — vocabulary in context
  `Vocabulary in context: Year 3 pupils learn to use the surrounding text to work out the meaning of unfamiliar words. They also learn to use dictionaries and thesauruses. Understanding word families helps pupils see connections between words that share the same root (for example: sign, signal, signature, significant).`,

  // Reading — text structure
  `Text structure and presentation: Non-fiction texts use headings, subheadings, bullet points, captions, diagrams and indexes to organise information. Fiction uses chapters, paragraphs, dialogue and description. Understanding how a text is organised helps readers find information and understand the author's purpose.`,

  // Reading — literary features
  `Literary features Year 3 pupils identify: similes (comparing using "like" or "as": "as cold as ice"), metaphors (saying something IS something else: "the classroom was a zoo"), alliteration (repeating initial consonant sounds: "Peter Piper picked"), onomatopoeia (words that sound like what they describe: bang, hiss, crash), personification (giving objects human qualities: "the wind howled").`,
]

async function main() {
  console.log('Seeding Year 3 English curriculum chunks...\n')

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

    await prisma.curriculumChunk.create({
      data: {
        subject: SUBJECT,
        year_group: YEAR_GROUP,
        source_name: SOURCE,
        chunk_text,
      },
    })
    inserted++
  }

  console.log(`  ✅ Inserted: ${inserted} chunks`)
  console.log(`  ⏭  Skipped: ${skipped} (already exist)`)
  console.log('\n  NOTE: Run the pipeline /ingest endpoint or seed-knowledge-base.py to compute embeddings.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
