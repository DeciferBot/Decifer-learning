# Writing and Designing for Children by Age Band — Standards for the Copy Audit

> Compiled 2026-08-18 from public sources (URLs at end). Raw research input for
> `docs/PRODUCT_ROADMAP_2026.md` and the copy-audit rubric. Items that could not
> be traced to a published source are marked [unverified] or [derived].
> Scope note: UK Year = US grade + 1 (US 5th grade ≈ UK Year 6) — this mapping
> matters when using US readability formulas and US research.

## 1. Reading ability by UK school year

**Expected reading ages.** UK children reading within ~1 year of chronological age are "on track": Year 2 ≈ reading age 6.5–7.5; Year 3 ≈ 7.5–8.5; Year 6 ≈ 10.5–11.5. A struggling Year 3 child may still read at a Year 2 level — **audit floors should assume the bottom of each band.**

**KS1 / phonics.** By end of Year 1 children are assessed via the Phonics Screening Check: 40 words (including pseudo-words) of 3–6 letters, testing pure decoding through Phase 5 phonics. "Common exception words" (the, said, once…) are taught by sight in Y1–Y2. Implication: a Year 2 child can independently read short, phonically regular words plus a taught sight-word list — not arbitrary vocabulary. Year 2 target book bands are Oxford Levels 7–9 (Turquoise/Purple/Gold): ~24–32 pages, roughly one short paragraph per page, sentences getting longer but still simple. Year 3 moves to Levels 10–11+ (White/Lime): early chapter books, varied vocabulary, growing inference.

**The Year 3–4 shift.** Chall's "fourth-grade slump" research: through ~UK Y2–4 children are *learning to read* (decoding); from ~UK Year 4–5 they must *read to learn*. Children with weaker vocabulary visibly fall behind at this point. Implication: below ~Year 4, on-screen text is itself a decoding task; every extra word has cost.

**Readability measures usable in code** (all in the Python `textstat` package):
- **Flesch-Kincaid Grade** = 0.39 × (words/sentences) + 11.8 × (syllables/words) − 15.59. Returns a US grade; **add 1 for UK year**. Best for KS2 upwards.
- **Spache** (revised) = 0.121 × avg sentence length + 0.082 × % unfamiliar words + 0.659 — designed for primary-grade material (US grades ~1–3 ≈ Y2–Y4), scored against a familiar-word list. **Use Spache, not FK, for Y2–Y4 copy.**
- Caveat [derived]: both average over sentences, so single short UI strings produce unstable scores. Audit copy in pooled batches per screen/feature, plus hard per-string rules (sentence length, syllable count) for microcopy.

**Benchmark from GOV.UK content design:** they target reading age 9 *for adults*, cap sentences at 25 words, and cite comprehension of >90% at 14-word average sentences falling to <10% at 43 words. If government services for adults write for a 9-year-old, an app *for* 9-year-olds must sit below that.

## 2. Nielsen Norman Group children's and teen research

NN/g (UX Design for Children, 4th ed., 156 guidelines) insists on **narrow bands**: 3–5 (pre-readers), 6–8 (beginner readers), 9–12 (moderately skilled readers).

- **Children reject mis-pitched content:** users "reacted negatively to content designed for children even one school grade below or above their own level." Patronising down is as bad as pitching too high.
- **6–8 (≈ Y2–Y4):** beginner readers; minimal text, instructions read aloud where possible, icons paired with labels; motor control still developing. Two 7-year-olds could not hit a 5 mm close button.
- **9–12 (≈ Y5–Y7):** can read to learn and handle denser navigation, but want clear, specific instructions stating the goal *and* how to achieve it; physical-space metaphors (maps, doors) work well — Decifer's world map fits this.
- **Search/typing:** ages 5–11 rely on autocorrect; in-product search must support spelling correction and partial matching.
- **Teens (13–17, ≈ KS3–KS4):** read *worse* than adults and give up faster; write at **6th-grade level (≈ UK Year 7) or lower**, short sentences, bullets. Avoid anything condescending or babyish; **the word "kid" is a teen repellent**; ease off heavy animation and garish colour; teens hate tiny fonts and slow interfaces; peer-created content and real examples resonate.

## 3. UX writing for children — practice guidance

- **BBC GEL "How to Design for Children"** exists (bbc.co.uk/gel; summarised at childrensdesignguide.org); the BBC publishes a children's games starter pack with GEL games framework + accessibility guidelines on GitHub. Specific BBC rule wording [unverified — pages egress-blocked during research].
- **Sesame Workshop, "Best Practices: Designing Touch Tablet Experiences for Preschoolers"** (50+ touchscreen studies): hotspots large and well isolated; simple tap is the most intuitive gesture; after spoken instructions, make the tappable thing **glow/sparkle** as a time-out affordance; **immediate audio feedback on every touch**; celebratory sound payoffs; avoid interactive icons along the bottom edge where resting palms cause accidental taps.
- **Khan Academy Kids:** pairs audio narration with visual cues to cut cognitive load; word-by-word highlighting during read-aloud; characters model thinking aloud and cheer effort.
- **Google "Building for kids":** avoid **text-only buttons** for non-readers; use familiar icons; only essential sounds and visuals; language, vocabulary and voiceover must match the target age; **design for the youngest likely user.**
- **Apple Kids Category:** bands are 5-and-under, 6–8, 9–11; external links and commerce must sit behind a **parental gate**; no third-party data transmission.
- **Instruction-writing pattern:** imperative verb first, one action per sentence, concrete nouns, no idioms/jargon ("Tap the star", "Drag the number").
- **Praise research:**
  - **Dweck/Mueller (process vs person praise):** children praised for intelligence ("You're so smart") subsequently avoided challenge and performed ~20% worse; children praised for effort/process ("You worked hard on that") sought harder tasks and improved ~30%.
  - **Brummelman (inflated praise):** intensifiers ("incredibly good!", "perfect!") backfire for low-self-esteem children — exactly the children a learning app must serve — making them avoid challenge.
  - Varying praise strings to avoid habituation is widely advised in practitioner guidance but no controlled study found [unverified]; the safe, sourced rule: **specific + process-focused + non-inflated.**

## 4. Interaction standards for children

- **Tap targets:** WCAG 2.2 SC 2.5.8 (AA) floor is 24×24 CSS px, but that is for adults. Children 7–10 miss 7 mm targets ~30% of the time; children's finger contact patch is about adult-sized because they have less motor control. Research-backed comfortable minimum ~9.6 mm (~48 px) — Decifer's existing 48×48 px rule is the right floor; primary actions for Y2–Y4 should be larger and well separated [derived].
- **Audio for pre-/early readers:** every instruction audible (recorded or TTS), word highlighting during read-aloud, sound effects confirming input registration immediately.
- **Feedback timing:** children expect immediate feedback from touch; frequent small rewards suit short attention spans (8–10 min at ages 4–6); errors should "gently reset" — playful bounce-back plus soft sound, never punitive.
- **Sound design:** purposeful sounds only, never sound-only meaning; ~1 in 20 children have sensory processing issues, so sounds must be mutable and non-startling.
- **Motion/accessibility:** WCAG 2.3.3 (AAA) — interaction-triggered motion must be disableable; honour `prefers-reduced-motion`; no content flashing >3×/second (SC 2.3.1).

## 5. Motivation research relevant to copy

- **Self-determination theory in edtech:** gamification works when it feeds autonomy (real choices), competence (informational feedback on progress) and relatedness. A 2023 meta-analysis found gamification improves perceived autonomy and relatedness but has *minimal impact on competence* — and points/badges used as controlling levers can undermine intrinsic motivation. Copy implication: frame rewards as **information about mastery** ("You've mastered fractions — Zone 2 is open") rather than as the reason to act ("Do this to get 50 points").
- **Loss vs gain framing:** loss aversion is measurable in children as young as 5; young children are risk-seeking under loss frames. Loss-framed streak mechanics ("Don't lose your streak!") demonstrably create evening anxiety in children (documented Duolingo "streak fever" accounts).
- **Regulatory/wellbeing pressure:** the ICO **Children's Code, Standard 13 (nudge techniques)** prohibits using children's data for engagement-extending "sticky features" (reward loops, notifications pressuring return); the 5Rights *Disrupted Childhood* report documents developmental harm from persuasive design. A UK-targeted service is directly in scope. Practical rule: **streaks may exist, but copy must gain-frame them, Streak Shields should be surfaced as anxiety relief, and no under-9 copy should threaten loss.**

## 6. Per-age-band writing rules

Sentence-length caps are [derived] syntheses of the reading-band data (Oxford levels, GOV.UK comprehension curve, NN/g); other columns sourced per sections 1–5.

| | **Year 2** (6–7) | **Year 3–4** (7–9) | **Year 5–6** (9–11) | **KS3 / Y7–9** (11–14) | **KS4 / Y10–11** (14–16) |
|---|---|---|---|---|---|
| Reading stage | Beginner; phonics Phase 5 + exception words | Decoding consolidating; early chapter books | "Reading to learn"; ~5,000-word sight vocabulary | Fluent but below adult; low patience | Near-adult fluency; zero tolerance for being talked down to |
| Readability gate (code) | Spache ≤ 2.0 | Spache ≤ 3.0 / FK ≤ 2 | FK ≤ 4 | FK ≤ 6 | FK ≤ 7 (subject terms exempt) |
| Max sentence length | 8 words, one clause | 10 words, one clause | 12 words | 15 words | 20 words (25 absolute) |
| Vocabulary | Decodable + taught exception words; concrete nouns only | Common words; new word only if it is the curriculum term being taught | Common words; define subject terms on first use | Everyday teen register; no babyish words, never "kids" | Plain English + proper GCSE terminology |
| Instructions | Imperative first, 1 action, always with icon + audio | Imperative first, 1 action per sentence | Imperative first, ≤2 steps visible | Goal + method stated; bullets for multi-step | Concise; assume competence |
| Tone | Warm, playful, literal — no idioms/sarcasm | Playful, literal | Adventurous, humorous; light irony OK | Respectful, peer-like, not "fun-ified" | Straightforward, exam-aware, respectful |
| Audio | All instructions + feedback audible; word highlighting | Audio on request for Learn text | TTS optional (SEND support) | Optional accessibility feature | Optional accessibility feature |
| Praise | Process praise, specific, immediate, not inflated | Process praise naming the strategy | Process praise + progress data | Progress/mastery data, understated | Data-led ("87% — 3 marks off a grade 7") |
| Framing | Gain-only; no loss threats, no timers in copy | Gain-only | Gain-framed streaks; shields as safety net | Gain-framed; loss mention only factual | Gain-framed; deadlines factual not pressuring |

## 7. Copy audit rubric (testable rules)

1. **Readability gate [all]:** pooled copy per feature passes the band's Spache/FK ceiling via `textstat`; Spache for Y2–Y4, FK for Y5+.
2. **Sentence cap [all]:** no sentence exceeds the band cap; nothing anywhere exceeds 25 words.
3. **One action per sentence [Y2–Y6]:** every instruction = imperative verb first + one action + concrete object. Fail if two actions share a sentence.
4. **No text-only buttons [Y2–Y4]:** every actionable control pairs text with an icon; Y2 controls also have audio.
5. **Audio parity [Y2, lower Y3]:** every instruction and feedback message audible without reading; tappable targets glow after audio finishes.
6. **Decodable vocabulary [Y2]:** words phonically decodable or on the Y1/Y2 common-exception lists, except the curriculum term being taught.
7. **No idioms, sarcasm or figurative instructions [Y2–Y6]:** literal language only.
8. **Process praise only [all]:** praise names what the child did — never person praise.
9. **No inflated praise [all]:** ban default intensifiers; reserve superlatives for genuinely rare events.
10. **Blame-free errors [Y2–Y6]:** wrong-answer copy never says "wrong/failed/no"; states what happened + one next step. Playful reset for Y2–4.
11. **No loss-framed copy [Y2–Y6, soft rule KS3–4]:** ban "Don't lose…", "…will disappear", "Last chance!" — reframe as gain.
12. **No return-pressure copy [all]:** no message engineered to make a child feel bad for being away (Children's Code Standard 13).
13. **Teen register [KS3–KS4]:** no "kids", no exclamation-mark pileups, no baby mascot voice in Y7+ surfaces; passes a "would a 14-year-old cringe?" review.
14. **Age-band isolation [all]:** no copy pitched more than one year band above or below the reader; shared screens written for the youngest eligible reader.
15. **Sensory safety [all]:** no meaning carried by sound alone; sounds mutable; animations honour reduced-motion and never flash >3×/s.

## 8. Sources

- https://readingchest.co.uk/advice/reading-levels-uk/ · https://readingchest.co.uk/book-bands/
- https://home.oxfordowl.co.uk/reading/reading-schemes-oxford-levels/oxford-reading-tree-levels/ · https://home.oxfordowl.co.uk/year-1-phonics-screening-check/
- Chall & Jacobs: https://www.aft.org/ae/spring2003/chall_jacobs
- https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests · https://en.wikipedia.org/wiki/Spache_readability_formula · https://github.com/textstat/textstat
- https://insidegovuk.blog.gov.uk/2014/08/04/sentence-length-why-25-words-is-our-limit/
- NN/g: https://www.nngroup.com/articles/childrens-websites-usability-issues/ · https://www.nngroup.com/articles/kids-cognition/ · https://www.nngroup.com/articles/children-ux-physical-development/ · https://www.nngroup.com/reports/children-on-the-web/ · https://www.nngroup.com/articles/usability-of-websites-for-teenagers/
- BBC GEL (summary): https://childrensdesignguide.org/how-to-design-for-children-by-bbc-gel/ · https://github.com/bbc/childrens-games-starter-pack/blob/master/docs/gel-guidelines.md
- Sesame Workshop: https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf
- Google: https://developers.google.com/building-for-kids/designing-engaging-apps · Apple: https://developer.apple.com/app-store/review/guidelines/
- Dweck/Mueller: https://bingschool.stanford.edu/news/praising-intelligence-costs-childrens-self-esteem-and-motivation · http://parentingscience.com/praise-and-intelligence/
- Brummelman: https://pubmed.ncbi.nlm.nih.gov/24434235/ · https://onlinelibrary.wiley.com/doi/abs/10.1111/cdev.12936
- Touch targets: https://www.smashingmagazine.com/2012/02/finger-friendly-design-ideal-mobile-touchscreen-target-sizes/ · https://www.nngroup.com/articles/touch-target-size/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/ · https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- SDT meta-analysis: https://link.springer.com/article/10.1007/s11423-023-10337-7
- Loss aversion in children: https://www.ucl.ac.uk/pals/sites/pals/files/20_2005_SJP.pdf · https://onlinelibrary.wiley.com/doi/abs/10.1111/cdev.13297
- 5Rights: https://5rightsfoundation.com/wp-content/uploads/2024/08/5rights_DisruptedChildhood_G.pdf
- ICO Children's Code Standard 13: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/13-nudge-techniques/
- Duolingo streak anxiety: https://screenwiseapp.com/guides/duolingo-streaks-and-anxiety-in-kids
- Kids sound/sensory design: https://www.aufaitux.com/blog/ui-ux-designing-for-children/ · https://gapsystudio.com/blog/ux-design-for-kids/
