# Product

## Register

product

## Users

- **Children (primary)**: Year 3 (age 7–8) and Year 7 (age 11–12) pupils on iPads/iPhones via the installed PWA, plus Y2 and Y10/Y11 cohorts post-expansion. They are mid-task learners: fighting a Zone Guardian, finishing a quiz, collecting a Discovery Card. Developing fine motor control, emergent readers at the younger end.
- **Parents (secondary)**: UK/UAE families monitoring progress, weak areas, and screen time from the parent dashboard.
- **Admin (internal)**: family-pilot operators monitoring the content pipeline.

## Product Purpose

A guided learning companion for the UK National Curriculum. Children move through a Learn → Practise → Quiz loop on a gamified world map (zones, topic nodes, guardians, points, hearts, streaks, Discovery Cards); parents get visibility and controls. Success = a child finishes a session feeling more capable than when they started, and comes back tomorrow.

## Brand Personality

Warm, encouraging, capable. "Learning should feel like a conversation — not a test, a quiz database, or a reward machine." Decifer is the guide in that conversation (the offset `< >` dialogue brackets are the mark). Voice is friendly and direct, never babyish, never corporate.

## Anti-references

- Corporate EdTech dashboards (cold, dense, gray).
- Flashcard/quiz-database apps (transactional, joyless).
- Hyper-casual mobile-game patterns: dark patterns, loot-box pressure, countdown anxiety.
- Anything that punishes failure (retries are always free; no persistent penalties).

## Design Principles

1. **A 7-year-old must never be confused.** Labels readable, never meaning-destroying truncation; icons paired with words; one clear next action per screen.
2. **Mobile-first at 375px.** No horizontal scroll; every tap target ≥ 48×48px (children's motor accuracy is the floor, not WCAG's).
3. **Encourage, never punish.** Feedback celebrates progress; wrong answers teach (hints, explanations); state changes are gentle.
4. **The system is the source of truth.** Tokens from `tokens.css` / `tailwind.config.ts` and components from DESIGN_SYSTEM.md — no hard-coded hex in components.
5. **Motion conveys state and joy in moments, not constant choreography.** Always honour `prefers-reduced-motion`.

## Accessibility & Inclusion

- WCAG 2.1 AA basics for MVP (alt text, keyboard nav, `prefers-reduced-motion`); full audit deferred.
- Body/label contrast ≥ 4.5:1 — children with low vision and colour-vision deficiency are explicit users; never encode pass/fail in colour alone.
- Tap targets ≥ 48×48px everywhere (project rule, stricter than WCAG AA).
- Reduced-motion alternatives for all celebratory/infinite animations (vestibular and autistic-sensory needs).
