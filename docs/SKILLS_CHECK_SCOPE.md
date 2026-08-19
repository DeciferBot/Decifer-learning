# Decifer Skills Check — scope

Status: proposed, nothing built yet. Written 2026-08-19.

A free, no-login check a parent can give their child in about 10 minutes, which
returns a structured report on where the child actually is against the UK
National Curriculum, and which we use to collect parent emails, registrations
and organic search traffic.

---

## 1. What it is, and what it is not

**It is** a curriculum-referenced diagnostic. It answers one question: *is this
child secure, developing, or behind on the things the National Curriculum says
they should know by now, and what should they do next?*

**It is not** an IQ test, an intelligence score, a percentile, a "gifted"
screen, or a standardised score on the 100-average scale. We will not print a
number that ranks a child against other children.

That last line is a hard product rule, not caution for its own sake. A
standardised score of the kind schools use has a mean of 100 and a standard
deviation of 15, and it only means anything because the test was given to a
large representative sample first. We have no such sample. Printing a
100-scale number without one would be a made-up number dressed as science.

What we can honestly say, and what schools themselves say, is whether a child
is working at the expected standard for their year. That is the same
criterion-referenced logic the DfE uses.

---

## 2. Evidence base

Every design choice below traces to one of these.

| Source | What we take from it |
|---|---|
| KS2 scaled scores (DfE) | The idea of a fixed "expected standard" for a year group, reported as met or not met. Scale runs 80 to 120, 100 is the expected standard, 110 is the higher standard. |
| Multiplication Tables Check (DfE, Year 4) | The shape of our timed tables check: 25 questions, 6 seconds per question, 3 practice questions first, about 5 minutes total, tables up to 12. |
| Phonics screening check (DfE, Year 1) | The shape of a short pass or not-yet check with a published threshold. 40 words, 20 real and 20 made-up, threshold mark 32. Used as a model only. Our version is deferred, it needs audio. |
| Commission on Assessment Without Levels (DfE, 2015) | Assessment must be fit for the purpose intended, and formative assessment exists to tell you what to do next. Our report is formative first. |
| EEF guidance on diagnostic assessment and mastery learning | Low-stakes diagnostic quizzes are the recommended way to find gaps and misconceptions, and gaps should drive what is taught next. |
| NFER / GL standardised scores | Reference for what we deliberately do **not** claim. Mean 100, SD 15, two thirds of children between 85 and 115. |

Sources are listed in full at the bottom.

---

## 3. What we already have (verified against production, 2026-08-19)

| Fact | Number |
|---|---|
| Published questions | 8,277 |
| Year groups covered | Year 1 to Year 11 |
| Subjects | Maths, English, Science, History, Geography |
| Topics per year and subject | 4 to 12 |
| Year 4 Maths published items by tier | 203 sprout, 102 explorer, 68 lightning |
| Quiz answers ever recorded | 1,084 |
| Questions with a calibrated IRT difficulty | 0 |
| Child profiles | 18 |

Two things follow from this.

**Good news.** The item bank is deep enough to build checks for Maths and
English from Year 1 to Year 9 today, with a real difficulty axis (`tier`) and a
real strand axis (`topics`). No new content generation is needed for v1.

**Constraint.** `lib/irt.ts` is written and unit-tested but has never had data.
Zero items are calibrated and there are only 1,084 answers in the product's
whole history. So the check cannot be adaptive in the IRT sense at launch, and
it cannot be norm-referenced. It is a fixed-form, criterion-referenced check.
Once the check itself starts collecting answers at volume, it becomes the thing
that finally calibrates the bank. That is a bonus, not the goal.

**Do not use `curriculum_outcomes` as the reporting spine.** It has 85 rows in
total, almost all Year 3 English and Science, and Maths is only the one
multiplication and division domain. The spine is `topics`, which has full
coverage.

---

## 4. The checks

Three formats. Ship the first two.

### 4a. Subject Skills Check (the main one)

- 20 questions, about 8 to 10 minutes.
- Structure: 4 strands x 5 questions. Strands are the 4 topics in that year and
  subject with the deepest published pool.
- Within each strand: 1 question from the year below, 3 at year, 1 from the
  year above.
- No timer. No hearts. No points. This is a check, not a game.
- Multiple choice only, so it marks itself and needs no typing.

Coverage at launch: Maths and English, Year 1 to Year 9. Year 1 has no year
below, so it uses 4 at-year plus 1 above.

### 4b. Times Tables Check

- Copies the DfE Multiplication Tables Check shape: 3 practice questions, then
  25 questions, 6 seconds each, about 5 minutes.
- Tables up to 12.
- Output is a raw score out of 25 plus the list of facts the child was slow or
  wrong on. That list is the whole value to a parent.
- Aimed at Years 3 to 6.

This one is worth building for search demand alone. "multiplication tables
check practice" is a query UK and UAE parents type every spring.

### 4c. Reading Check — deferred

The phonics screening check needs a child to read words aloud to an adult, or
needs speech recognition. Neither fits a self-serve web flow yet. Not in v1.

---

## 5. Scoring

All scoring lives in a pure, unit-tested module (`lib/skills-check/score.ts`),
no DB and no LLM, same discipline as `lib/sm2.ts` and `lib/irt.ts`.

**Per strand**, out of 5:

| Correct | Verdict |
|---|---|
| 5 or 4 | Secure |
| 3 | Developing |
| 2 or fewer | Needs work |

**Overall working level**, from the 20 answers split by band:

| Pattern | Reported as |
|---|---|
| Year-below items below 60% correct | Working below Year N. Start at Year N-1. |
| Year-below secure, at-year below 50% | Working towards Year N. |
| At-year 50% to 79% | Working within Year N. |
| At-year 80%+ and year-above below 50% | Secure at Year N. |
| At-year 80%+ and year-above 50%+ | Secure at Year N and ready to stretch. |

Thresholds are constants in one file so they can be tuned in one place, and
every row above gets a unit test.

**We report only the 4 strands we tested**, and the report says so in plain
words. No silent inference about strands we did not ask about.

---

## 6. The parent report

One page, mobile first at 375px, printable, and emailable as a link.

Free, before the email (the teaser):

1. **Headline.** "Secure at Year 3 maths, ready to stretch." One sentence.
2. **Two lines of summary.** Strongest strand by name, and how many strands need
   work. Not which ones.

Behind the email gate (the report):

3. **Strand table.** The 4 strands, each Secure / Developing / Needs work, with
   the actual topic names the child saw.
4. **Three next steps.** One per weakest strand, each a link to the free lesson
   for that topic. This is the formative half, and it is the half that converts.
5. **What this does and does not tell you.** A short honest box. Names the
   sample size (20 questions), says it is not a standardised test, says one bad
   morning moves the result.
6. **Retest in 6 weeks** call to action.

The gate copy must say plainly what is behind it, so a parent is trading an
email for a known thing. No fake progress bars, no "calculating your child's
score" theatre.

---

## 7. The funnel

A teaser, then the email. In order:

1. `/skills-check` landing. Parent picks subject and year group. No account, no
   personal data.
2. The child does the 20 questions.
3. **Result page shows the teaser only.** Free, no email:
   - the headline working level, one sentence ("Secure at Year 3 maths, ready
     to stretch"),
   - two lines of summary: the strongest strand named, and the number of strands
     that need work but **not which ones** ("Strongest: Fractions. Two of the
     four strands need work.").
   That is enough to be true and to make the gap itch. It is not enough to act
   on, which is the point.
4. **The email gate holds the report**: which strands, each verdict, the three
   next steps, the printable version, and the 6-week retest reminder. Parent
   email only.
5. Report email arrives via Resend, using the existing sender setup.
6. That email and the report page both push the same next action: create a free
   account and put the child on the weak strand.

Decided 2026-08-19 by Amit. The cost is that the result page is thin for search
and earns few links, so the **landing pages** in §8 carry the organic job, not
the result page. The result page is `noindex` anyway.

### Data and legal rules (non-negotiable)

Driven by the ICO Children's Code, UAE Child Digital Safety Law 26/2025 and the
existing `lib/parental-consent.ts` posture.

- Collect the **parent's** email. Never the child's name, date of birth, school
  or photo.
- Year group is a band, never a birth date.
- The landing page and the email gate are addressed to parents, in adult
  language. We do not market this test to children.
- The attempt row is keyed by a random token in a first-party cookie. It becomes
  a lead only when a parent types an email.
- No analytics fires before consent. Reuse `lib/consent.ts` as is.
- Every report email carries a one-click "delete this report" link.
- Retention: delete anonymous attempts with no email after 90 days, on the
  existing cron.

---

## 8. SEO

The recorded constraint still holds: roughly 3 pages of 374 are indexed and
there are no external links. Thin pages will not fix that. These pages are
different because each one is a free tool with a reason to be linked to.

**Page architecture**

| Route | Purpose |
|---|---|
| `/skills-check` | Hub. Explains the method, links every check. |
| `/skills-check/maths/year-4` | One landing page per subject and year. 18 pages at launch (Maths and English, Y1 to Y9). |
| `/skills-check/times-tables` | The MTC-shaped check. Highest search demand. |
| `/skills-check/r/[token]` | A result page. `noindex`. |

**Supporting guides**, written into the existing `lib/guides/content/` system,
which already ranks structurally and has a sources block:

- What the multiplication tables check is, and how to practise for it
- KS2 scaled scores explained, what 100 and 110 mean
- What "working at the expected standard" actually means

Each guide links to the matching check, and each check links back.

**Mechanics**

- Add the checks to `app/sitemap.ts`.
- Link from every `/curriculum/[subject]/[year]` page to its matching check.
- Reuse the existing `WebPage` and `BreadcrumbList` JSON-LD from `lib/json-ld.ts`.
  Do not add Quiz structured data without first checking it is still supported.
- **Build trap already recorded:** never query per page at build time. Take one
  memoised snapshot for all check pages, the same fix used for the 364-URL
  curriculum sitemap.

---

## 9. Data model

New tables. Names follow the existing convention.

```sql
skill_checks (id, slug, subject_id, year_group_id, format, item_count,
              seconds_per_item, is_published)

-- points at published quiz_questions, so the "no hardcoded content" rule holds
skill_check_items (id, check_id, question_id, position, band, strand_topic_id)
                  -- band: 'below' | 'at' | 'above'

skill_check_attempts (id, token, check_id, started_at, finished_at,
                      raw_score, working_level, strand_results JSONB,
                      profile_id NULL)

skill_check_leads (id, attempt_id, parent_email, consented_at, verified_at,
                   source, utm JSONB)
```

RLS: `skill_check_attempts` and `skill_check_leads` are service-role only.
Everything goes through API routes, no client-side table reads. Same lockdown as
`board_games`.

---

## 10. Build order and gates

**Phase A — engine.** Data model, migration, `lib/skills-check/score.ts`, item
selection from published content only, one check seeded (Year 4 Maths).
*Gate:* unit tests cover every scoring row in §5; selection provably filters
`status='published'`; no route exposed yet.

**Phase B — one check, end to end.** `/skills-check/maths/year-4`, the quiz
shell, the result page, the email gate, the Resend report email, an admin view
of attempts and leads.
*Gate:* a full run with no login on a 375px screen; the email arrives; the
database holds no child personal data; deletion link works.

**Phase C — breadth and search.** Maths and English, Year 1 to Year 9. Hub page,
18 landing pages, sitemap, internal links from `/curriculum`, three guides.
*Gate:* build does not open a DB connection per page; all pages render with no
horizontal scroll; every check has a full item pool.

**Phase D — times tables check.** MTC-shaped timed format, slow-facts output,
6-week retest reminder email on the existing cron.
*Gate:* timing is accurate on a real iPad; the check works offline-tolerantly or
fails cleanly.

---

## 11. The content-quality risk, stated plainly

The August audit measured a 10% hard-defect rate on LLM-generated questions and
72% clean overall. A public, unauthenticated test is the single worst place for a
broken question, because a parent who spots one will not come back.

So: **every item in a published check is hand-checked once before that check
goes live.** 20 items per check, 18 checks, about 360 items. That is a one-time
spot check of a seed batch, which is explicitly allowed under the no-moderation
rule. It is not an ongoing queue.

Prefer Oak-sourced items where they exist, they measured at 1.1% defective
against 10.3% for the June LLM batch.

**Two defects showed up in the very first live plan** (Year 4 Maths, 2026-08-19),
and both are now handled in code rather than left to the human pass:

1. **War and slavery as arithmetic dressing.** The first plan pulled in "Nazi
   Germany invaded the Soviet Union … how far were they pushed back" as a
   stretch item for a nine-year-old. `isSuitableForPublicCheck()` in
   `lib/skills-check/plan.ts` now screens a narrow whole-word list out of the
   pool. It is a stopgap. The durable fix is retiring those questions.
2. **Deep pool is not the same as important strand.** Ranking on pool depth put
   "Geometry: Position and Direction" (74 published questions, no Year 3
   counterpart) into the check ahead of Number and Place Value. Strands are now
   ranked by whether the curriculum carries them into the neighbouring years
   first, and by depth only as a tiebreak. The Year 4 check now picks
   Multiplication and Division, Addition and Subtraction, Fractions and
   Decimals, and Measurement.

---

## 12. Not in scope

- Any IQ, intelligence, percentile, or "gifted" claim or number.
- A standardised score on the 100-mean scale.
- Science, History, Geography checks in v1.
- The phonics or reading-aloud check.
- Adaptive item selection driven by IRT (no calibration data exists).
- Writing check results into `topic_progress` for logged-in children.
- Comparing one child to another child, anywhere in the product.

---

## 13. Decisions needed before Phase A

1. ~~Email gate position.~~ **Decided 2026-08-19.** Headline plus two lines of
   summary free, the whole report behind the email. See §7.
2. **Subjects at launch.** Recommended: Maths and English only.
3. **Do logged-in children get it too?** Recommended: no in v1. It muddies the
   funnel and the progress data.

---

## Sources

- [Understanding scaled scores at key stage 2, GOV.UK](https://www.gov.uk/guidance/understanding-scaled-scores-at-key-stage-2)
- [Key stage 2 tests: 2026 scaled scores, GOV.UK](https://www.gov.uk/government/publications/key-stage-2-tests-2026-scaled-scores)
- [Multiplication tables check: administration guidance, GOV.UK](https://www.gov.uk/government/publications/multiplication-tables-check-administration-guidance/multiplication-tables-check-administration-guidance)
- [Multiplication tables check assessment framework, GOV.UK](https://www.gov.uk/government/publications/multiplication-tables-check-assessment-framework)
- [2026 phonics screening check assessment and reporting arrangements, GOV.UK](https://www.gov.uk/government/publications/phonics-screening-check-assessment-and-reporting-arrangements-ara/2025-phonics-screening-check-assessment-and-reporting-arrangements)
- [Commission on Assessment Without Levels: final report, GOV.UK](https://www.gov.uk/government/publications/commission-on-assessment-without-levels-final-report)
- [Making effective use of diagnostic assessment, EEF](https://educationendowmentfoundation.org.uk/news/eef-blog-new-case-studies-making-effective-use-of-diagnostic-assessment)
- [Mastery learning, EEF Teaching and Learning Toolkit](https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/mastery-learning)
- [An introduction to standardised scores, NFER](https://www.nfer.ac.uk/assessment-hub/an-introduction-to-standardised-scores/)
- [How do I interpret standardised scores, NFER](https://www.nfer.ac.uk/assessment-hub/how-do-i-interpret-standardised-scores/)
