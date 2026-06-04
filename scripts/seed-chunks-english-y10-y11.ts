/**
 * Seed curriculum_chunks for Year 10 and Year 11 English (KS4/GCSE).
 *
 * Covers all 14 topics seeded for Y10/Y11 English.
 * Texts focus on AQA GCSE English Literature and Language specifications.
 *
 * Idempotent: skips existing chunks.
 * After seeding, run embed_chunks.py on the DO droplet.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-english-y10-y11.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SOURCE = 'AQA GCSE English Language and Literature Specification'

const CHUNKS: Array<{ subject: string; year_group: string; chunk_text: string }> = [
  // ── Year 10 ──────────────────────────────────────────────────────────────

  // Analysing Language and Structure
  { subject: 'English', year_group: 'year-10', chunk_text: `Analysing language at GCSE: identify specific techniques and explain their effect. Key language techniques: metaphor (saying something IS something else), simile (comparison using 'like' or 'as'), personification (giving non-human things human qualities), alliteration (repetition of initial consonant sounds), sibilance (repeated 's' or 'sh' sounds), onomatopoeia (words that sound like what they describe), hyperbole (extreme exaggeration). Always embed quotations and analyse word-level choices. The word '[word]' suggests/implies/conveys [effect] because [reason].` },
  { subject: 'English', year_group: 'year-10', chunk_text: `Analysing structure: structure refers to how a text is organised and how the writer controls the reader's journey. Techniques include: non-linear narrative (events out of chronological order), in medias res (starting in the middle of action), flashback/flashforward, first vs third person narration, shift in focus (zooming in or out), cyclical structure (ending echoing the beginning), cliffhangers, and use of tense shifts. For GCSE, describe what the writer does, then explain the effect on the reader. Consider: how does the structure develop the reader's understanding or build tension?` },

  // Comparing Texts
  { subject: 'English', year_group: 'year-10', chunk_text: `Comparing texts: AQA Paper 2 Q4 asks you to compare writers' attitudes in two non-fiction texts. Key comparison words: similarly, in contrast, whereas, however, on the other hand, both writers, unlike, equally, conversely. Structure comparisons: point (what each writer thinks/does) → evidence (quote from each) → analysis (language technique and effect) → link (explicit comparison word). Compare attitudes, perspectives, methods, and tone. Consider: purpose (to persuade, inform, entertain), audience, context (when was it written?), and register (formal or informal).` },

  // Descriptive and Narrative Writing
  { subject: 'English', year_group: 'year-10', chunk_text: `Descriptive writing (AQA Paper 1 Q5 option): aim to create a vivid picture in the reader's mind. Use all five senses (sight, sound, smell, touch, taste). Vary sentence structure: short sentences for impact, long sentences for flow or listing details. Use a clear structural technique: zoom in from wide to close-up, use a turning point, or build atmosphere. Avoid clichés. Powerful verbs and precise adjectives are more effective than piling up adverbs. Include figurative language (metaphors, similes, personification) to make descriptions original and evocative.` },
  { subject: 'English', year_group: 'year-10', chunk_text: `Narrative writing: a story or account with characters, setting, conflict, and resolution. Techniques: establish character voice (first person 'I' or close third person 'he/she'), build tension through pacing (shorter sentences = faster pace), use dialogue to reveal character and move plot forward, foreshadow later events with early details. Structure: exposition (introduce characters/setting), rising action (conflict develops), climax (turning point), falling action, resolution. GCSE marking rewards: compelling characters, convincing dialogue, varied vocabulary, structural choices, accurate grammar and punctuation.` },

  // Persuasive and Argumentative Writing
  { subject: 'English', year_group: 'year-10', chunk_text: `Persuasive and argumentative writing (AQA Paper 2 Q5): written to influence the reader's opinion. Techniques (AFOREST or DAFOREST): Anecdote, Facts, Opinions, Rhetorical questions, Emotive language, Statistics, Triples (rule of three). Other techniques: direct address ('you'), inclusive language ('we'), counter-argument followed by rebuttal, expert opinion, hyperbole for emphasis, repetition of key ideas. Structure: clear introduction with a stance, developed paragraphs each with one argument, counter-argument addressed, powerful conclusion. Register and tone should match audience (formal for broadsheet editorial, more conversational for magazine column).` },

  // A Christmas Carol
  { subject: 'English', year_group: 'year-10', chunk_text: `A Christmas Carol by Charles Dickens (1843): set in Victorian London. Key themes: redemption and transformation (Scrooge's journey from miser to generous man), poverty and social responsibility (Dickens criticising Victorian neglect of the poor), Christmas spirit and generosity, the supernatural, family. Key characters: Ebenezer Scrooge (protagonist, miserly then redeemed), Bob Cratchit (poor but kind employee), Tiny Tim (symbol of innocence and vulnerability), The Ghost of Christmas Past/Present/Yet to Come. Dickens uses a circular structure — Scrooge wakes up on Christmas morning transformed. Context: Dickens wanted to highlight plight of the Victorian poor.` },
  { subject: 'English', year_group: 'year-10', chunk_text: `A Christmas Carol — key quotations and analysis: "Bah, humbug!" — Scrooge dismisses Christmas and generosity. "Are there no prisons?" — Scrooge's callous dismissal of the poor echoes Malthusian attitudes Dickens opposed. "As solitary as an oyster" — simile showing Scrooge's isolation is self-chosen. "God bless us, every one!" — Tiny Tim's benediction represents universal human goodwill. The Ghost of Christmas Present has 'more than eighteen hundred brothers' — suggests the spirit of generosity is everywhere. The Ghost of Christmas Yet to Come never speaks — symbolises the unknown future and death. Scrooge's transformation is complete when he sends a prize turkey to the Cratchits.` },

  // Jekyll and Hyde
  { subject: 'English', year_group: 'year-10', chunk_text: `Strange Case of Dr Jekyll and Mr Hyde by Robert Louis Stevenson (1886): a novella in Gothic and mystery tradition. Key themes: duality of human nature (good vs evil existing in the same person), reputation and respectability (Victorian obsession with public image), science and morality (dangers of transgressing boundaries), secrecy and repression. Key characters: Dr Henry Jekyll (respected scientist who creates Hyde), Mr Edward Hyde (Jekyll's alter-ego, described as deformed and dwarfish), Mr Utterson (lawyer, narrator of investigation), Dr Lanyon (foil to Jekyll, represents orthodox science). Setting: London fog = concealment and moral murkiness.` },
  { subject: 'English', year_group: 'year-10', chunk_text: `Jekyll and Hyde — key quotations: "Man is not truly one, but truly two" — Jekyll acknowledges the duality of human nature. Hyde is described as having 'a kind of black sneering coolness' and giving an 'impression of deformity without any nameable malformation' — suggests Hyde represents repressed desires made physical. "The large handsome face of Dr Jekyll grew pale to the very lips" — physical horror mirroring moral crisis. Stevenson structures the novella so Hyde's true identity is hidden until the final chapters — epistolary structure (letters from Lanyon and Jekyll) reveals the truth. Context: Stevenson wrote during a period of scientific excitement (evolution) and social anxiety about respectability.` },

  // AQA Power and Conflict Poetry
  { subject: 'English', year_group: 'year-10', chunk_text: `AQA Power and Conflict Poetry cluster (15 poems): key poems include Ozymandias (Shelley — power crumbles over time), London (Blake — oppressive society), The Prelude: Stealing the Boat (Wordsworth — nature's power over humans), My Last Duchess (Browning — male power and control), Charge of the Light Brigade (Tennyson — military glory and futility), Exposure (Owen — futility of war, nature as enemy), Storm on the Island (Heaney — nature's power), Bayonet Charge (Hughes — chaos of war), Remains (Armitage — psychological trauma of soldiers), Poppies (Weir — personal loss in war), War Photographer (Duffy — moral responsibility in conflict), Tissue (Dharker — fragility of human constructs), The Emigrée (Rumens — power of memory), Kamikaze (Garland — conflict between duty and survival), Checking Out Me History (Agard — colonialism and cultural identity).` },
  { subject: 'English', year_group: 'year-10', chunk_text: `Comparing Power and Conflict poems: when comparing, focus on theme, form, structure, language. Ozymandias vs London: both explore abuses of power; Shelley uses an extended metaphor of ruined statue; Blake uses repeated imagery of 'charter'd' (controlled) to show oppression. War poems: contrast Tennyson's romanticised view of war (Light Brigade) with Owen's brutal realism (Exposure). For unseen poetry, use SMILE: Structure, Meaning/Message, Imagery, Language techniques, Effect on reader. Annotate: rhyme scheme, rhythm, enjambment (line running on — suggests lack of control), caesura (pause mid-line — shock or hesitation), volta (turning point in the poem).` },

  // Grammar, Punctuation and Vocabulary
  { subject: 'English', year_group: 'year-10', chunk_text: `GCSE English grammar: sentence types: simple (one main clause), compound (two main clauses joined by coordinating conjunction — FANBOYS: for, and, nor, but, or, yet, so), complex (main clause + subordinate clause joined by subordinating conjunction: because, although, when, if, unless). Subordinate clause can begin the sentence for effect. Punctuation: comma (separate clauses, list items), semi-colon (join closely related independent clauses), colon (introduce a list or explanation), apostrophe (possession or contraction), dash (aside or emphasis), ellipsis (...) for trailing off or tension. Active vs passive voice: 'The dog bit the boy' (active) vs 'The boy was bitten' (passive — often used in formal writing to remove agency).` },

  // ── Year 11 ──────────────────────────────────────────────────────────────

  // Macbeth
  { subject: 'English', year_group: 'year-11', chunk_text: `Macbeth by William Shakespeare (c.1606): a tragedy. Key themes: ambition and its consequences (Macbeth's ambition leads to tyranny and downfall), appearance vs reality ('Fair is foul and foul is fair'), the corrupting influence of power, guilt and psychological disintegration (Lady Macbeth's sleepwalking), fate vs free will (the witches' prophecies), masculinity and gender (Lady Macbeth challenges gender norms). Key characters: Macbeth (tragic hero, brave then murderous), Lady Macbeth (manipulative, then guilt-ridden), The Three Witches (ambiguous — agents of fate or temptation?), Banquo (moral foil to Macbeth), Macduff (nemesis). Context: written for James I, who believed in divine right of kings and was fascinated by witchcraft.` },
  { subject: 'English', year_group: 'year-11', chunk_text: `Macbeth — key quotations: "Stars, hide your fires; / Let not light see my black and deep desires" — Macbeth reveals his ambition and desire for concealment. "Come, you spirits / That tend on mortal thoughts, unsex me here" — Lady Macbeth invokes dark forces, challenging gender norms. "Is this a dagger which I see before me?" — Macbeth's hallucinations signal his guilt. "Out, damned spot! Out, I say!" — Lady Macbeth's sleepwalking reveals repressed guilt. "Tomorrow, and tomorrow, and tomorrow" — nihilistic soliloquy after Lady Macbeth's death; use of repetition creates relentless despair. Blood imagery runs throughout — represents guilt that cannot be washed away.` },

  // Romeo and Juliet
  { subject: 'English', year_group: 'year-11', chunk_text: `Romeo and Juliet by Shakespeare (c.1597): a tragedy of young love. Key themes: love and hate (coexist throughout — the feud vs the love), fate and free will (the lovers are 'star-cross'd'), youth vs age, impulsive action vs prudence. Key characters: Romeo (impulsive, romantic), Juliet (more mature and practical than Romeo), Friar Lawrence (well-intentioned but causes harm), The Nurse (comic relief, Juliet's confidante), Mercutio (witty, killed by Tybalt — catalyst for tragedy), Tybalt (hot-headed, represents the feud). Structure: builds from comic love at first sight to tragic deaths across five acts. Language: oxymorons ('loving hate', 'cold fire') mirror the contradictions of the play. Prologue reveals the ending — fate is established from the beginning.` },

  // An Inspector Calls
  { subject: 'English', year_group: 'year-11', chunk_text: `An Inspector Calls by J.B. Priestley (written 1945, set 1912): a play with a social message. Key themes: social responsibility ('We are all members of one body'), class and inequality (the Birlings exploit Eva Smith/Daisy Renton), age and morality (younger generation more willing to change), collective vs individual guilt. Key characters: Inspector Goole (moral voice; name suggests 'ghoul' — supernatural quality; could represent conscience), Arthur Birling (capitalist, pompous, wrong in his predictions), Sybil Birling (snobbish, unrepentant), Sheila (learns from experience, symbol of hope for change), Eric (flawed but accepts responsibility), Gerald Croft (middle position). Time period paradox: play written after WWII set before WWI — dramatic irony throughout (Birling's optimistic predictions are all wrong).` },
  { subject: 'English', year_group: 'year-11', chunk_text: `An Inspector Calls — key quotations: "We are responsible for each other" — Inspector Goole's central socialist message, contrasting with Birling's capitalist view. "If we were all responsible for everything that happened to everybody we'd had anything to do with, it would be very awkward" — Birling dismisses collective responsibility. "You'll be hearing from me shortly" — Inspector's parting threat; suggests future consequences. "Fire and blood and anguish" — prophecy of the coming World Wars; dramatic irony since the play was written after them. Priestley uses the dramatic device of an 'inspector' to force the Birlings to confront how their selfish actions contributed to Eva's death.` },

  // Unseen Poetry
  { subject: 'English', year_group: 'year-11', chunk_text: `Approaching unseen poetry (AQA Paper 2): for a single unseen poem, you are asked to analyse language, form and structure and their effects. Use SMILE: Structure (how is the poem organised? Regular stanzas = control; irregular = chaos), Meaning (what is the literal and deeper meaning?), Imagery (metaphors, similes, personification), Language techniques (alliteration, sibilance, repetition, word choice), Effect on reader. For comparing two unseen poems: identify the shared theme, then compare how poets use form/language differently. Useful terms: volta (turn in argument), enjambment (line runs on — mirrors relentless feeling), caesura (mid-line pause — shock), tone (angry, melancholic, hopeful, ironic).` },

  // Paper 1: Creative Reading and Writing
  { subject: 'English', year_group: 'year-11', chunk_text: `AQA Paper 1 — Explorations in Creative Reading and Writing: Section A (Reading): Q1 list 4 things (4 marks); Q2 language analysis (8 marks — language choices and effects); Q3 structural analysis (8 marks — how does structure engage reader?); Q4 evaluation (20 marks — agree/disagree with a statement, reference the text). Section B (Writing): Q5 (40 marks) — descriptive or narrative writing prompted by an image or title. Mark scheme priorities: Content and Organisation (24 marks): ideas, structure, engaging the reader; Technical Accuracy (16 marks): vocabulary, sentence forms, spelling, punctuation. Spend approximately 45 minutes on reading, 45 minutes on writing. In Q4, use 'I agree/disagree that...' to give a clear personal stance.` },

  // Paper 2: Writers' Viewpoints and Perspectives
  { subject: 'English', year_group: 'year-11', chunk_text: `AQA Paper 2 — Writers' Viewpoints and Perspectives: two non-fiction texts (one 19th century, one modern). Section A: Q1 true/false statements (4 marks); Q2 summary of differences (8 marks — find and synthesise); Q3 language analysis of one text (12 marks); Q4 comparison of attitudes in both texts (16 marks — explicit comparison). Section B Q5 (40 marks): persuasive or argumentative writing on a similar theme. For Q2, focus on differences not just facts. For Q3, zoom in on individual word choices and their connotations. For Q4, use comparison connectives throughout. Non-fiction features: headline, sub-heading, rhetorical questions, statistics, anecdotes, direct address, expert quotes, lists.` },
]

async function main() {
  console.log(`Seeding Year 10 & 11 English curriculum chunks (${CHUNKS.length} chunks)...\n`)

  let inserted = 0
  let skipped = 0

  for (const chunk of CHUNKS) {
    const key = chunk.chunk_text.slice(0, 120)
    const existing = await prisma.curriculumChunk.findFirst({
      where: {
        subject: chunk.subject,
        year_group: chunk.year_group,
        chunk_text: { startsWith: key },
      },
      select: { id: true },
    })

    if (existing) {
      skipped++
      continue
    }

    await prisma.curriculumChunk.create({
      data: {
        subject: chunk.subject,
        year_group: chunk.year_group,
        source_name: SOURCE,
        chunk_text: chunk.chunk_text,
      },
    })
    inserted++
  }

  console.log(`Done. Inserted: ${inserted}, Skipped (already exist): ${skipped}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
