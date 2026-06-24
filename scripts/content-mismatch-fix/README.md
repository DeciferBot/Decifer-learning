# Content-mismatch fix (2026-06)

Tooling used to fix a catalogue-wide content mis-seeding: the LLM-assisted Oak
matcher (`build-oak-topic-map.py` / `oak-topic-map.json`) attached the wrong Oak
lesson unit to many topics, because Oak groups units by *Oak's* year while our
topics are NC period-buckets. ~33 topics showed the wrong subject (e.g. "World
War One" showing English Civil War) and several were empty.

These scripts run on the DO droplet (`/root/decifer-learning`, `/root/pipeline-venv`).
They write to the production Supabase DB; all create snapshot backup tables before
mutating, and re-ingest content deterministically from Oak / verified sources.

## Re-ingest correct Oak units (chapters + Learn)
- `fix-mismatched-content.py` — round 1, per-topic transaction (map: `correction-map.json`)
- `fix-mismatched-content-2.py` — round 2, ONE atomic transaction (all deletes before all
  inserts) to resolve `curriculum_units.oak_unit_slug` UNIQUE conflicts where the correct
  unit was already held by another topic. Maps: `correction-map-2/3/4.json`.
  Key gotchas: oak_unit_slug is globally unique; Oak lists a lesson once per exam board
  (must dedupe full slug); the chapter renderer only shows Oak-shape fields.

## Quiz regeneration (grounded)
- `gen_topic_quiz.py <topic_id> "<source_name>"` — flags old published Qs, deletes staged
  junk, regenerates 3 tiers via `pipeline.run_for_topic(..., restrict_source=<source>)` so
  RAG grounding is scoped to one source (the `restrict_source` patch — see commit history).

## Bespoke rebuilds (topics with no Oak unit, built from licensed sources)
- `extract_poems.py` — extract + VERIFY verbatim public-domain poems from Gutenberg's
  Golden Treasury (checks first/last line, line count, author) → `poems.json`.
- `build_poetry.py` — 19th-C Poetry Y9 from the verified poems (Gutenberg, public domain).
- `build_weather.py` — Storms & Drought Y8 from Met Office facts (OGL v3.0).
- `build_grammar.py` — Grammar/Punctuation Y10 from DfE NC English Appendix 2 (Crown/OGL).

Each bespoke build creates chapters + learn_content + curriculum_chunks under a unique
`source_name`, then the quiz is generated with `gen_topic_quiz.py` scoped to that source.
Topics with no verifiable/age-appropriate source (phonics → needs audio-first Foundation
Mode; population/crime; redundant persuasive) were left unpublished, not auto-generated.
