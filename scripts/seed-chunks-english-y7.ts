/**
 * Seed curriculum_chunks for Year 7 English (KS3).
 *
 * These chunks form the RAG knowledge base used by Stage 1 of the content pipeline.
 * Text is derived from NC 2014 English KS3 statutory guidance and plain-language
 * summaries appropriate for KS3 Year 7 content generation grounding.
 *
 * Idempotent: chunks are skipped if an identical chunk_text already exists.
 *
 * NOTE: After seeding, run embed_chunks.py on the DO droplet to compute embeddings.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-english-y7.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT = 'English'
const YEAR_GROUP = 'year-7'
const SOURCE = 'NC 2014 English KS3 Programme of Study'

const CHUNKS: string[] = [
  // Grammar — sentence types
  `There are four main sentence types in English. A simple sentence contains one main clause with a subject and verb: "The dog barked." A compound sentence joins two main clauses with a coordinating conjunction (FANBOYS: for, and, nor, but, or, yet, so): "The dog barked and the cat ran away." A complex sentence has a main clause and at least one subordinate clause: "Although it was raining, we went outside." A compound-complex sentence combines both compound and complex elements.`,

  `A clause is a group of words that contains a subject and a verb. A main clause (also called an independent clause) makes complete sense on its own: "She reads books every day." A subordinate clause (dependent clause) does not make complete sense alone and is introduced by a subordinating conjunction (because, although, when, if, since, unless, until, whereas, while): "because she loves stories." Relative clauses are introduced by relative pronouns: who, which, that, whose.`,

  `Phrases are groups of words without a subject-verb combination. A noun phrase is built around a noun: "the old stone bridge." A verb phrase includes the main verb and any auxiliaries: "has been running." An adverbial phrase modifies a verb: "with great enthusiasm." Expanded noun phrases add detail: "the ancient, crumbling castle on the cliff" — using pre-modifiers (adjectives before the noun) and post-modifiers (phrases after the noun).`,

  // Grammar — punctuation for effect
  `Punctuation for effect in KS3 writing: A colon (:) introduces a list, explanation, or quotation: "There was one problem: he had forgotten the key." A semicolon (;) links two closely related main clauses without a conjunction: "The door was locked; the window was shut." A dash (—) creates emphasis or an aside: "She ran — faster than ever before — towards the finish line." Ellipsis (...) creates suspense or trails off: "He opened the box and found..."`,

  `Brackets, dashes, and commas all indicate parenthesis — an aside that adds information without changing the main meaning. Example with brackets: "The prime minister (who had only recently taken office) announced the decision." Example with dashes: "The film — the best one this year — won five awards." Example with commas: "My sister, who lives in Leeds, visited us last weekend." In each case, the sentence still makes sense if the parenthesis is removed.`,

  `Inverted commas (speech marks) are used in two ways: (1) for direct speech — the exact words spoken: "I'll be home by six," she promised. Note: the punctuation goes inside the closing speech mark. A new speaker starts a new paragraph. (2) For indicating titles of shorter works, or to show a word is being used in a particular sense: The poem 'Ozymandias' was written by Shelley. "He said the homework was 'easy'."`,

  // Grammar — Standard/Non-Standard English
  `Standard English refers to the variety of English used in formal writing and speaking, characterised by conventional grammar and vocabulary that is understood nationwide. Non-standard English includes dialect words, regional grammar forms, and informal constructions. Examples: Standard — "We were going to the shops." Non-standard (regional dialect) — "We was going to the shops." Standard English does not mean 'correct' in all contexts; non-standard forms are valid in informal speech and creative writing to show character voice.`,

  `Formal and informal register: Register is the style of language appropriate to the context. Formal register uses Standard English, avoids contractions and colloquialisms, uses complex sentences, and employs precise vocabulary. Informal register uses contractions (can't, won't), colloquialisms (loads of, brilliant), simpler sentence structures, and everyday vocabulary. Writers choose register to suit audience and purpose: a letter to a headteacher uses formal register; a text to a friend uses informal.`,

  // Vocabulary — word families and etymology
  `Etymology is the study of the origin and history of words. Many English words come from Latin and Ancient Greek, particularly in academic, scientific, and formal vocabulary. Knowing word roots helps readers decode unfamiliar words. Latin roots: "aud" (hear) → audio, auditorium, audible. "port" (carry) → transport, portable, export. Greek roots: "bio" (life) → biology, biography. "graph" (write) → photograph, autograph, paragraph. "tele" (far) → telephone, television.`,

  `Word families share the same root and are grammatically related. For example: the root "act" produces act (verb/noun), action (noun), active (adjective), actively (adverb), activate (verb), activity (noun), actor (noun), reaction (noun). Recognising word families helps with spelling and understanding. Prefix knowledge: "pre-" (before), "re-" (again), "un-" (not/opposite), "dis-" (opposite), "mis-" (wrongly), "over-" (too much), "under-" (too little), "inter-" (between), "trans-" (across).`,

  `Synonyms, antonyms and connotations: Synonyms are words with similar meanings (happy/joyful/content/elated) but with different connotations — the feelings or associations attached to a word beyond its literal meaning. "Slim" and "scrawny" both mean thin, but "slim" has positive connotations while "scrawny" suggests unhealthy thinness. Writers choose words deliberately for their connotations. Antonyms are words with opposite meanings: brave/cowardly, hot/cold, success/failure.`,

  // Reading — inference and textual evidence
  `Making inferences means drawing conclusions that the writer implies but does not state directly. To infer, readers must read 'between the lines' using clues in the text, prior knowledge, and logical reasoning. For example, if a character's hands are shaking and they keep checking the door, a reader can infer they are nervous or afraid, even if the word "nervous" is not used. Inference questions often ask: "What does this suggest about...?" or "How does the reader know that...?"`,

  `When answering reading comprehension questions, it is important to use evidence from the text to support your points. Quote directly when possible, using inverted commas. A P-E-E structure helps: Point (your main idea), Evidence (a quote from the text), Explanation (how the evidence supports your point). Example: "The character is frightened. The writer describes how 'her breath came in short gasps.' This suggests she is in a state of panic because rapid breathing is a physical response to fear."`,

  `Structural features of texts: writers make deliberate choices about how to organise a text. These include: how a text begins (an opening that hooks the reader, establishes setting, or introduces character); how events are sequenced (chronologically, using flashbacks, or starting in medias res — in the middle of events); how paragraphs are linked (using topic sentences and connectives); how a text ends (resolution, twist, circular structure returning to the opening). Understanding structure helps readers analyse authorial intent.`,

  // Reading — language and structure analysis
  `Figurative language devices and their effects: Metaphor describes something as something it is not ("The world is a stage"), suggesting a direct comparison. Simile compares using "like" or "as" ("brave as a lion"). Personification gives human qualities to non-human things ("the wind whispered"). Alliteration repeats initial consonant sounds for emphasis or effect. Sibilance uses repeated "s" sounds, often creating a soft, hissing, sinister or soothing effect. Hyperbole uses extreme exaggeration: "I've told you a million times."`,

  `When analysing language in a text, students should identify the technique used, quote the relevant words or phrase, and explain the effect created. Consider: the connotations of specific word choices; the rhythm or sound effects of language (e.g. short sentences create tension); how the language positions the reader (e.g. does it make you sympathise with or dislike a character?). Ask: Why did the writer choose these words rather than others? What feelings does this create in the reader?`,

  // Writing — persuasive techniques
  `Persuasive writing aims to convince the reader to agree with a point of view or take action. Key techniques include: Rhetorical questions (engage the reader and make them consider an idea: "Isn't it time we acted?"); Rule of three (three words or phrases grouped together for emphasis: "We need action, commitment, and change."); Anecdote (a short personal story that makes the argument feel real); Statistics (facts and figures to support claims); Direct address ("You" language makes the reader feel personally involved); Emotive language (words that trigger an emotional response: "devastating," "urgent," "heartbreaking").`,

  `The structure of persuasive writing: An effective persuasive text typically follows this pattern. Introduction: state your position clearly and engage the reader. Paragraphs: each main argument in a separate paragraph, starting with a topic sentence, supported by evidence, example, or statistic. Counter-argument: acknowledge the opposing view, then refute it — this shows confidence and strengthens your argument. Conclusion: summarise your key points and end with a powerful call to action or memorable statement.`,

  // Literature — character and motivation
  `When analysing characters in literature, consider: what the character does (actions), what they say (dialogue), what they think (if the narrator reveals thoughts), how other characters react to them, and how the writer uses language to describe them. Motivation refers to what drives a character's behaviour — their goals, fears, desires, or values. Characters are often more interesting when their motivations are complex or conflicted. Ask: What does this character want? What do they fear? What are they willing to do to get what they want?`,

  `Methods of characterisation: Direct characterisation — the writer tells us directly about a character's personality: "She was a fierce, determined woman." Indirect characterisation — the writer shows us through action, speech, and detail, allowing the reader to draw conclusions. Writers may also use foil characters — characters who contrast with the protagonist to highlight their qualities. For example, in many stories, a calm, logical character is paired with an impulsive, emotional one to highlight both.`,
]

async function main() {
  console.log('Seeding Year 7 English curriculum chunks...\n')

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
        data: {
          subject: SUBJECT,
          year_group: YEAR_GROUP,
          source_name: SOURCE,
          chunk_text,
          // embedding is null — will be computed by embed_chunks.py on the droplet
        },
      })
      inserted++
    } catch (err) {
      console.error(`  ❌ Failed to insert chunk: ${err}`)
    }
  }

  console.log(`  Inserted: ${inserted}, Skipped (already exists): ${skipped}`)
  console.log(`  Total chunks: ${inserted + skipped}`)
  console.log('\n  ⚠  Embeddings are NULL — run embed_chunks.py on the DO droplet to compute them.')
  console.log('  python3 /tmp/embed_chunks.py  (after syncing updated pipeline)\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
