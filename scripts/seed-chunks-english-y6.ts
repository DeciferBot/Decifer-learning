/**
 * Seed curriculum_chunks for Year 6 English (KS2).
 *
 * These chunks form the RAG knowledge base for Stage 1 of the content pipeline.
 * Text is derived from NC 2014 English KS2 Year 6 statutory programme of study.
 *
 * Idempotent: skips existing chunks.
 * NOTE: After seeding, run embed_chunks.py on the DO droplet.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-english-y6.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT = 'English'
const YEAR_GROUP = 'year-6'
const SOURCE = 'NC 2014 English KS2 Year 6 Programme of Study'

const CHUNKS: string[] = [
  // Grammar — subjunctive mood
  `The subjunctive mood in Year 6: The subjunctive is a verb form used to express wishes, hypothetical situations, recommendations, or things that are contrary to fact. It differs from the indicative (normal) form. Key pattern: use "were" instead of "was" in hypothetical "if" and "wish" constructions. Examples: "If I were a doctor, I would help everyone." (not "was" — this is hypothetical). "I wish she were here." "Were he to arrive late, the meeting would start without him." The subjunctive is also used after verbs like "suggest", "recommend", "demand" — "She suggested that he be given more time." "The teacher insisted that every pupil hand in their work."`,

  `The passive voice in Year 6: In an active sentence, the subject performs the action: "The chef cooked the meal." In a passive sentence, the subject receives the action: "The meal was cooked by the chef." The passive is formed with the verb "to be" + past participle. Passive tenses: present passive — "The car is repaired"; past passive — "The car was repaired"; perfect passive — "The car has been repaired"; future passive — "The car will be repaired." The agent (the doer) is introduced with "by" and can be omitted if unknown or unimportant: "The window was broken." Uses: passive is preferred in formal and scientific writing to focus on the action rather than the actor; "Oxygen is produced by plants" (not "Plants produce oxygen").`,

  `Formal and informal register in Year 6: Register is the level of formality in language. Formal register: used in official letters, reports, and academic writing. Features include — full forms not contractions (I am rather than I'm), passive voice, impersonal constructions ("It has been decided..."), Latinate vocabulary ("commence" not "start", "request" not "ask"), complex sentences, no slang or colloquial phrases. Informal register: used in conversation, texts, and informal emails. Features include — contractions, colloquial vocabulary, first and second person ("I", "you"), shorter sentences, exclamations. Pupils must choose register appropriate to audience and purpose. A letter of complaint to a company uses formal register; a message to a friend uses informal.`,

  // Punctuation — colons, semi-colons, dashes
  `The colon (:) in Year 6: A colon introduces something that follows logically or explains what came before. Three main uses: (1) To introduce a list — "You will need the following: a pen, a ruler, and a calculator." The clause before the colon must be a complete sentence. (2) To introduce an explanation or elaboration — "There was only one problem: she had forgotten her key." (3) To introduce a quotation or speech — "He said only one word: 'No.'" The colon signals "that is to say" or "here is what I mean." It is stronger than a comma and weaker than a full stop. Do NOT use a colon after a verb or preposition: incorrect — "I enjoy: reading and swimming."`,

  `The semi-colon (;) in Year 6: A semi-colon has two main uses. (1) To join two closely related independent clauses (complete sentences) that are too closely linked in meaning to be separated by a full stop: "The sun was setting; the air grew cold." Each side of the semi-colon could stand alone as a sentence. The semi-colon signals that the two ideas are connected. (2) To separate items in a complex list where the items themselves contain commas: "The committee included Dr Singh, the headteacher; Ms Carter, the deputy; and Mr Davies, the caretaker." Semi-colons are a mark of sophistication in Year 6 writing — they show the writer can balance and connect ideas without using a conjunction.`,

  `Dashes, hyphens, and ellipsis in Year 6: The dash (—) has two uses. (1) A pair of dashes adds a parenthetical aside — information that interrupts the main clause — and can be removed without breaking the sentence: "The dog — a large, muddy labrador — bounded into the kitchen." (2) A single dash at the end of a clause creates emphasis or a dramatic pause: "She opened the door — and screamed." The hyphen (-) joins compound modifiers before a noun: "a well-known author", "a five-year-old child". The ellipsis (...) indicates an omission or a trailing thought, creating suspense or implying more could be said: "She waited... and waited... and waited." Three dots only — never two or four.`,

  // Vocabulary — synonyms, antonyms, etymology
  `Synonyms and antonyms in Year 6: Synonyms are words with similar meanings. Choosing precise synonyms improves writing by avoiding repetition and adding nuance. Example synonyms for "said": whispered (quietly), announced (formally), muttered (unclearly), exclaimed (with excitement). Not all synonyms are interchangeable — "thin" and "slender" are near-synonyms but carry different connotations ("slender" is more positive). Antonyms are words with opposite meanings: hot/cold, generous/mean, construct/destroy. Some antonyms are formed by adding prefixes: happy/unhappy, legal/illegal, possible/impossible, regular/irregular, moral/amoral. Knowing antonyms helps writers create contrast and tension.`,

  `Etymology and word roots in Year 6: Etymology is the study of the origin and history of words. Many English words are built from Latin and Greek roots, prefixes, and suffixes. Key Latin roots: "aud" (hear) — audible, audience, auditorium; "port" (carry) — transport, import, export, portable; "dict" (say) — dictate, predict, contradict; "scrib/script" (write) — describe, script, inscription; "vis/vid" (see) — visible, vision, video, provide; "rupt" (break) — interrupt, erupt, rupture. Key Greek roots: "graph" (write) — autograph, photograph, paragraph; "phon" (sound) — telephone, microphone, symphony; "bio" (life) — biology, biography; "geo" (earth) — geography, geology; "therm" (heat) — thermometer, thermal. Understanding roots helps pupils decode unfamiliar words and spell correctly.`,

  `Word families, morphology, and vocabulary in Year 6: Morphology is the study of word structure. A root word is the base; prefixes are added to the beginning to change meaning; suffixes are added to the end to change meaning or word class. Example word family from "decide": decide (verb), decision (noun — change -de to -sion), decisive (adjective — add -ive), decisively (adverb — add -ly), indecisive (adjective — add prefix in-). Prefixes and their meanings: pre- (before), re- (again), mis- (wrongly), anti- (against), inter- (between), over- (too much), sub- (under), trans- (across). Suffixes that change word class: -tion/-sion (verb → noun), -ous/-ious (noun → adjective), -ify (noun/adjective → verb), -ly (adjective → adverb).`,

  // Reading — inference and authorial intent
  `Inference in reading at Year 6: Inference means reading beyond what is explicitly stated to understand implied meanings, character feelings, motivations, and themes. Evidence-based inference: always support an inference with a quotation or specific reference from the text. The Point-Evidence-Explain (PEE) structure: make a Point (the inference), give Evidence (a quotation), then Explain how the evidence supports the point. Example — Point: "The character is nervous." Evidence: "Her hands shook as she reached for the door handle." Explain: "The detail of shaking hands is a physical sign of anxiety — the author shows rather than tells us she is frightened." Pupils distinguish between what is stated (explicit) and what is implied (implicit).`,

  `Authorial intent in Year 6: Authors make deliberate choices about language, structure, and form to create effects. Pupils ask: why did the author choose this word, this structure, this perspective? Language choices: emotive language creates empathy; sensory details (sight, sound, smell, taste, touch) make descriptions vivid; metaphors and similes create comparisons. Structure choices: starting in medias res (in the middle of the action) creates immediate tension; chronological structure is easy to follow; non-chronological structure (flashbacks) can reveal information selectively. Viewpoint: first person ("I") creates intimacy and unreliability; third person omniscient gives the author freedom to reveal any character's thoughts. Pupils analyse how these choices shape the reader's response.`,

  `Skimming, scanning, and evaluating evidence in Year 6: Skimming means reading quickly to get the general idea of a text — read the first and last sentence of each paragraph, headings, and key words. Scanning means searching rapidly for a specific piece of information — run your eye down the page looking for key words, dates, or names. Close reading is reading carefully for detail, making inferences, and analysing language. Evaluating evidence: not all statements in a text are equally supported. Pupils assess: Is this a fact (verifiable) or opinion (subjective)? Is the evidence specific and detailed, or vague? Does the author have a bias? Pupils use evidence to justify their own interpretations and challenge alternative views.`,

  // Writing — narrative techniques
  `Narrative techniques at Year 6: Varied sentence length for effect — short sentences create pace and tension: "She ran. The door was locked. She screamed." Long, complex sentences slow the pace and create atmosphere: "The old house, its windows dark and its garden overgrown with weeds that curled around the rusted gate, stood silent at the end of the lane." Show don't tell means conveying a character's emotion through actions, dialogue, and physical description rather than naming the emotion directly. Instead of "He was angry", write: "He slammed the door so hard the windowpanes rattled; his jaw was clenched, his fists white." Flashback: a section set in an earlier time, often introduced with a change in tense or a trigger (a smell, a sound) that transports the character (and reader) to the past.`,

  `Foreshadowing, atmosphere, and figurative language in Year 6: Foreshadowing hints at events to come, creating suspense and encouraging re-reading. Example: early mention of a locked door or a strange sound that is later explained. Pathetic fallacy uses weather and setting to mirror or contrast the mood: a storm mirrors conflict; bright sunshine can ironically contrast with sad events. Figurative language: simile — comparing using "like" or "as" ("Her voice was as cold as ice"); metaphor — stating something IS something else ("The classroom was a zoo"); personification — giving human qualities to non-human things ("The wind howled"); alliteration — repeated initial consonant sounds for effect ("the dark, damp, dangerous dungeon"). Pupils select figurative language consciously to create specific effects, not simply as decoration.`,

  `Story structure — Freytag's Pyramid at Year 6: Gustav Freytag's model describes five stages of narrative structure: (1) Exposition — introduces the setting, characters, and normal world before the story's problem begins. (2) Rising Action — a series of events that build tension as the protagonist faces obstacles and complications. (3) Climax — the turning point; the moment of highest tension where the central conflict reaches its peak. (4) Falling Action — the aftermath of the climax; loose ends begin to be resolved. (5) Resolution (Denouement) — the conflict is resolved; the new normal is established. Strong Year 6 narratives do not follow this in a strictly linear way — they may begin at the climax (in medias res) and use flashback to fill in the rising action. Pupils use this framework to plan and evaluate their own writing.`,

  `Descriptive and persuasive writing techniques for Year 6: Descriptive writing: use the five senses to create vivid imagery; vary sentence structure (single-word sentences, minor sentences, embedded clauses); deploy precise, specific nouns and strong verbs rather than adverbs ("she sprinted" rather than "she ran quickly"); use a consistent viewpoint and tense. Persuasive writing techniques (AFOREST): Anecdote (personal story to engage), Facts and statistics (to appear credible), Opinion stated as fact ("It is clear that..."), Rhetorical questions ("Surely no one would disagree?"), Emotive language (to manipulate feelings), Statistics, Tricolon / rule of three ("We will fight on the beaches, on the landing grounds, in the fields"). Pupils distinguish between tone, audience, and purpose when choosing techniques.`,
]

async function main() {
  console.log('Seeding Year 6 English curriculum chunks...\n')

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
