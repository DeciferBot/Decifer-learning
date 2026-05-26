/**
 * seed-chunks-english-y7-supplement.ts
 *
 * Supplementary curriculum_chunks for Year 7 English — targeted fix for two
 * pipeline-blocked topics:
 *
 * 1. y7-english-vocabulary-word-families
 *    The original seed had only 2 usable chunks, both anchoring on the same
 *    "act"/"aud" roots, causing the LLM to lock on "inaudible"/"telecommunications"
 *    and producing nothing but dedup-rejected near-duplicates.
 *    Fix: 10 new chunks across distinct Latin/Greek roots + suffix/prefix families.
 *
 * 2. y7-english-literature-character
 *    The original seed had only analysis frameworks; the LLM invented fictional
 *    passages that scored ~28 (staged). Questions cannot be grounded without
 *    real textual source material.
 *    Fix: 10 extracts from KS3 set texts (public domain): R.L. Stevenson's
 *    "Strange Case of Dr Jekyll and Mr Hyde" (1886) and H.G. Wells's
 *    "The War of the Worlds" (1898), annotated for character analysis use.
 *
 * Idempotent: skips chunks that already exist.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-chunks-english-y7-supplement.ts
 * Then: python3 services/content-pipeline/embed_chunks.py (on DO droplet)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT = 'English'
const YEAR_GROUP = 'year-7'
const SOURCE_VOCAB = 'NC 2014 English KS3 — Word Families and Etymology (supplementary)'
const SOURCE_LIT   = 'KS3 Set Texts — Character Analysis (public domain extracts)'

// ── 1. Word families / etymology chunks ───────────────────────────────────────
// Each chunk covers a distinct root family so the pipeline can generate
// varied questions without dedup collision.

const VOCAB_CHUNKS: string[] = [
  // Root: scrib / script
  `Latin root "scrib/script" means "to write." Words derived from this root: scribe (a person who copies written material), inscribe (to write or carve into a surface), inscription (words carved or written on a monument), describe (to write out in detail, creating a word-picture), description (noun form), prescribe (to write a doctor's instructions), prescription (a written medical instruction), manuscript (a hand-written document; manus = hand), subscribe (to sign below), transcript (a written copy of spoken words). Recognising "scrib/script" helps decode any unfamiliar word containing these letters.`,

  // Root: spec / spect / spic
  `Latin root "spec/spect/spic" means "to look or see." Derived words: inspect (to look carefully at), inspection (the act of looking carefully), spectator (someone who watches), spectacle (something worth looking at), spectacular (remarkably impressive to see), perspective (a way of seeing or viewpoint), retrospect (looking back at the past), introspect (looking inward at one's own thoughts), prospect (what one can see ahead; future possibilities), suspect (to look at with doubt). The root also appears in "species" (a distinct group, identifiable by looking).`,

  // Root: dict
  `Latin root "dict" means "to say or declare." Derived words: dictate (to say aloud for someone to write down), dictation (the act of dictating), dictionary (a book that declares the meanings of words), diction (a person's manner of speaking), predict (to say beforehand what will happen), prediction (noun form), contradict (to say the opposite), contradiction (noun form), verdict (a formal declaration of judgment; ver = true), edict (an official public declaration). The root also appears in "indicate" (to point out and declare).`,

  // Root: duct / duc
  `Latin root "duct/duc" means "to lead." Derived words: conduct (to lead or manage), conductor (one who leads), educate (to lead out knowledge; e- = out), education (the process of being led to knowledge), introduce (to lead into), introduction (noun form), produce (to lead forth; bring forward), production (noun form), reduce (to lead back; make smaller), reduction (noun form), deduce (to lead away a conclusion from evidence), abduct (to lead away; to kidnap), aqueduct (a channel that leads water). Knowing this root helps understand dozens of formal English words.`,

  // Root: port
  `Latin root "port" means "to carry." Derived words: transport (to carry across), transportation (noun form), portable (able to be carried), import (to carry into a country), export (to carry out of a country), report (to carry back information), support (to carry from below; to hold up), deportation (carrying someone out of a country), portfolio (a case for carrying papers; from "foglio" = leaf/sheet), porter (a person who carries luggage), comport (to carry oneself; to behave). This root is extremely common in formal and academic English.`,

  // Root: mit / mis
  `Latin root "mit/mis" means "to send." Derived words: mission (a task someone is sent to do), missionary (a person sent to spread beliefs), emit (to send out, as in light or sound), emission (noun form), transmit (to send across), transmission (noun form), submit (to send under; to yield), submission (noun form), commit (to send together; to carry out), commission (noun form; an instruction to carry out), admit (to send in; to allow entry), admission (noun form), permit (to send through; to allow), permission (noun form), dismiss (to send away). The root changes form slightly between Latin-derived words.`,

  // Root: vis / vid
  `Latin root "vis/vid" means "to see." Derived words: visible (able to be seen), invisible (not able to be seen), vision (the ability to see; also a mental image), visualise (to form a mental picture), supervise (to oversee; super = above), supervision (noun form), provide (to see ahead and prepare; pro = forward), provision (what has been provided), evidence (that which is clearly seen; e = out), evident (clearly visible), video (Latin: "I see"), revise (to see again; to review). This root often appears in academic and formal contexts.`,

  // Greek root: phon
  `Greek root "phon" means "sound or voice." Derived words: phonics (the study of the sounds of language), phoneme (a single unit of sound), telephone (sound from far away; tele = far), microphone (a device for capturing small sounds; micro = small), symphony (sounds together in harmony; sym = together), euphony (pleasing sound; eu = good), cacophony (harsh, unpleasant sound; caco = bad), megaphone (device to amplify voice; mega = large), phonograph (a device that writes/records sound), homophone (a word that sounds the same as another; homo = same). The root "phon" is central to the study of English language itself.`,

  // Greek root: log / logy
  `Greek root "log/logy" means "word, reason, or study of." Derived words: biology (study of life; bio = life), geology (study of the earth; geo = earth), psychology (study of the mind; psycho = mind/soul), ecology (study of habitats; eco = house/environment), catalogue (a list of words/items; kata = down), dialogue (a conversation between two; di = two), monologue (a speech by one person; mono = one), prologue (words before the main text; pro = before), epilogue (words after the main text; epi = after), analogy (a comparison that explains by reasoning), logic (the science of correct reasoning). The root appears in almost every academic subject name.`,

  // Suffix families
  `Suffix families help build vocabulary systematically. The suffix "-tion/-sion" turns verbs into nouns meaning "the act of": educate → education, transmit → transmission, construct → construction, decide → decision. The suffix "-ity" creates nouns of state or condition: active → activity, equal → equality, curious → curiosity, possible → possibility. The suffix "-ous/-ious" creates adjectives meaning "having the quality of": glory → glorious, mystery → mysterious, danger → dangerous. The suffix "-ment" indicates an action or result: develop → development, achieve → achievement. Recognising these suffixes allows readers to work out the meaning and word class of unfamiliar words.`,
]

// ── 2. Literature — character analysis extracts ───────────────────────────────
// Real public-domain text extracts from KS3 set texts, annotated for use
// in character analysis question generation. The LLM is grounded in actual
// text rather than inventing fictional passages.

const LITERATURE_CHUNKS: string[] = [
  // Jekyll and Hyde — Hyde's first description
  `From "Strange Case of Dr Jekyll and Mr Hyde" (R.L. Stevenson, 1886) — Chapter 1: "Mr Hyde": "He is not easy to describe. There is something wrong with his appearance; something displeasing, something downright detestable. I never saw a man I so disliked, and yet I scarce know why. He must be deformed somewhere; he gives a strong feeling of deformity, although I couldn't specify the point... He had a displeasing smile... and he spoke with a husky, whispering and somewhat broken voice." The narrator, Enfield, struggles to explain his deep aversion to Hyde — his appearance seems deformed yet no specific fault can be named, suggesting something indefinably corrupt or sinister about his nature.`,

  // Jekyll and Hyde — Hyde's actions (trampling scene)
  `From "Strange Case of Dr Jekyll and Mr Hyde" (R.L. Stevenson, 1886) — Chapter 1: The Trampling: "The man trampled calmly over the child's body and left her screaming on the ground. It sounds nothing to hear, but it was hellish to see. It wasn't like a man; it was like some damned Juggernaut." Enfield describes how Hyde walked straight into a young girl and "trampled calmly" over her — the word "calmly" emphasises the chilling absence of emotion. The simile comparing Hyde to a "Juggernaut" (an unstoppable crushing force) reinforces the idea that Hyde is less than human: an elemental, destructive power.`,

  // Jekyll and Hyde — Jekyll's description of his own duality
  `From "Strange Case of Dr Jekyll and Mr Hyde" (R.L. Stevenson, 1886) — Chapter 10, Jekyll's Full Statement: "I had learned to dwell with pleasure, as a beloved day-dream, on the thought of the separation of these elements. If each, I told myself, could but be housed in separate identities, life would be relieved of all that was unbearable... Both sides of me were in dead earnest; I was no more myself when I laid aside restraint and plunged in shame, than when I laboured, in the eye of day, at the furtherance of knowledge or the relief of sorrow and suffering." Jekyll admits that both his virtuous and corrupt sides felt equally authentic — he experienced his good deeds and his wickedness with the same sincerity.`,

  // Jekyll and Hyde — Utterson's character
  `From "Strange Case of Dr Jekyll and Mr Hyde" (R.L. Stevenson, 1886) — Chapter 1, introducing Utterson: "Mr Utterson the lawyer was a man of a rugged countenance that was never lighted by a smile; cold, scanty and embarrassed in discourse; backward in sentiment; lean, long, dusty, dreary and yet somehow lovable. At friendly meetings, and when the wine was to his taste, something eminently human beaconed from his eye; something of a kindly, even warm, though it was a cold, austere personage who embodied this quality." Stevenson introduces Utterson through direct characterisation: though outwardly cold and reserved, something warmly human still shows in him — he is a moral anchor in a story about human duality.`,

  // War of the Worlds — Martian description
  `From "The War of the Worlds" (H.G. Wells, 1898) — Book 1, Chapter 4: "A big greyish rounded bulk, the size, perhaps, of a bear, was rising slowly and painfully out of the cylinder. As it bulged up and caught the light, it glistened like wet leather. Two large dark-coloured eyes were regarding me steadfastly... There was a mouth under the eyes, the lipless brim of which quivered and panted, and dropped saliva." The narrator encounters the first Martian emerging from the cylinder. Wells uses extended description to create the creature's alien otherness: the simile "like wet leather" and the detail of quivering, drooling lips make it simultaneously animal-like and deeply unnatural.`,

  // War of the Worlds — narrator's panic and character
  `From "The War of the Worlds" (H.G. Wells, 1898) — Book 1, Chapter 7: "I was, I now realise, in a state of dull stupefaction... There was no dominant terror — only a vague incomprehension, a helpless bewilderment... the idea of flight flashed into my mind. But I did not act — I simply stood, unable to think or move." The narrator reveals himself to be an ordinary man — not heroic but paralysed by incomprehension. His inability to act is presented as entirely human. Wells uses first-person narration to create intimacy and vulnerability, inviting the reader to see the Martian invasion through the eyes of an overwhelmed everyman rather than a brave protagonist.`,

  // War of the Worlds — the artilleryman (character study)
  `From "The War of the Worlds" (H.G. Wells, 1898) — Book 2, Chapter 7: "He had a great idea — to stop and rebuild humanity underground, a new, hard society, taking the best of humanity and letting the rest perish. 'Life is real again, and the useless and cumbersome and mischievous have to die. They ought to die. They have been living on borrowed time already.' ... I found him in the afternoon, making plans for a billiard room." Wells uses the artilleryman to explore the dark side of survival instinct: his grand speech about rebuilding humanity sounds visionary, but the irony is that he himself is doing nothing — just talking while playing billiards. This reveals him as a self-deluding dreamer rather than the leader he imagines himself to be.`,

  // Jekyll and Hyde — Hyde at the end
  `From "Strange Case of Dr Jekyll and Mr Hyde" (R.L. Stevenson, 1886) — Poole's account to Utterson: "I saw it go by at the end of a corridor... It went so quick, and the creature was so doubled up, that I could hardly swear to that. But if it was the master, why had it a mask upon its face?... the thing that came out was Mr Hyde." By the novel's climax, those close to Jekyll cannot tell if they are seeing Hyde or their employer — the boundaries between the two personalities have dissolved completely. Stevenson uses the motif of doubling and disguise throughout: Jekyll's house has two entrances, his respectable front and his hidden back — just as his personality does.`,

  // Character analysis method — applied to set text context
  `KS3 character analysis — how to write about characters in literary texts: (1) Select a quotation that reveals something about the character's personality, motivation, or role. (2) Identify the technique: direct characterisation, action, dialogue, imagery, symbolism, or the reactions of other characters. (3) Analyse specific word choices and their connotations. (4) Explain what this reveals about the character's inner life, values, or purpose in the text. (5) Consider the context: why might the writer want to present this character in this way? What themes does this character represent? Example: Stevenson's Hyde represents the repressed dark side of respectable Victorian society — the part that acts on impulse without moral restraint.`,

  // Literary context for Jekyll and Hyde
  `Literary and historical context for "Strange Case of Dr Jekyll and Mr Hyde" (1886): Stevenson wrote the novella in Victorian England, a society deeply concerned with respectability, morality, and scientific progress. Darwin's theory of evolution (1859) had raised questions about whether humans were truly separate from animals. The story explores the idea that beneath every respectable person's surface lies a more primitive, uncontrollable self. Hyde is described in terms that suggest evolutionary regression — smaller, more ape-like, less evolved. The setting of foggy, gaslit London emphasises hidden secrets. Jekyll's experiment can be read as a warning about the dangers of separating reason from emotion, or of using science without ethical restraint. The novella is an example of Gothic literature.`,
]

async function seedChunks(chunks: string[], source: string, label: string) {
  console.log(`\nSeeding ${label}...`)
  let inserted = 0
  let skipped = 0

  for (const chunk_text of chunks) {
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
        source_name: source,
        chunk_text,
      },
    })
    inserted++
  }

  console.log(`  ✅ Inserted: ${inserted}  Skipped (already exists): ${skipped}`)
}

async function main() {
  console.log('━━━ Y7 English supplementary chunk seed ━━━')
  console.log('Fixing pipeline-blocked topics:')
  console.log('  • y7-english-vocabulary-word-families (10 new root/suffix chunks)')
  console.log('  • y7-english-literature-character     (10 public-domain extracts)\n')

  await seedChunks(VOCAB_CHUNKS,      SOURCE_VOCAB, 'vocabulary/word-families chunks')
  await seedChunks(LITERATURE_CHUNKS, SOURCE_LIT,   'literature/character extracts')

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⚠  Embeddings are NULL — run on DO droplet:')
  console.log('   python3 services/content-pipeline/embed_chunks.py')
  console.log('   (filters to rows WHERE embedding IS NULL)\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
