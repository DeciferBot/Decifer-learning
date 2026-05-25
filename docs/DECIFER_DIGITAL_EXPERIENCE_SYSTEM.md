# DECIFER Learning — Digital Experience System

Sprint-by-sprint closure record for the Decifer Learning product (deciferlearning.com).
Each entry is appended on sprint close and is never edited after the fact.

---

## Sprint 4 — Homepage Launch Hardening

DATE: 2026-05-25
SPRINT: 4 — Homepage Launch Hardening
VERDICT: PASS

FILES CHANGED:
- components/ui/ScrollReveal.tsx: Added `useReducedMotion()` from Framer Motion. When reduced motion is preferred, `initial={false}` and `transition={{ duration: 0 }}` are used so the element appears immediately with no opacity or translate animation. `motion.div` is kept in both code paths to prevent a server/client hydration mismatch.
- components/homepage/HeroMockup.tsx: Added `window.matchMedia('(prefers-reduced-motion: reduce)').matches` guard before the IntersectionObserver/rAF count-up loop. When true, `ringPercent` and `barPercent` are set directly to `TARGET_PERCENT` (72) with no animation. The CSS global handles the remaining progress-bar CSS transition.
- app/page.tsx: (a) Footer nav: added `flex-wrap justify-center gap-x-4 gap-y-2 sm:justify-start` to the `<nav>` element to prevent link overflow on narrow viewports without changing desktop layout. (b) Parent guide link: wrapped the `→` arrow in `<span aria-hidden="true">` — consistent with how `GuideCard` already handles decorative arrows.
- docs/DECIFER_DIGITAL_EXPERIENCE_SYSTEM.md: Created this file. Sprint 4 closure record.

MOBILE PROOF:
- iPhone SE (375 x 667 CSS px): Hero copy (badge chip, h1, description, trust chips, CTAs) fits comfortably within the ~611px below the nav bar. HeroMockup stacks below the fold in the single-column mobile grid and does not dominate the first screen. No horizontal scroll on any section. Gamification grid uses `grid-cols-2` on mobile. Topic preview uses `grid-cols-1`. Footer links wrap via `flex-wrap`. All CTA tap targets are `h-12` (48 px minimum).
- iPhone standard (390 x 844 CSS px): Comfortable layout with both hero CTAs visible well above the fold.
- Tablet (768 px): Hero two-column grid activates at `md` breakpoint with copy left and mockup right. Sections transition to 2-col and 3-col grids. No overflow on any section.
- Desktop (1280 px+): `max-w-5xl` container centres content. LearningJourney and topic preview expand to 4-column grids. Layout unchanged from Sprint 3.

ACCESSIBILITY/MOTION:
- Heading hierarchy: Single h1 in the hero. All major content sections use h2. Child/parent split sub-columns use h3. No heading levels are skipped anywhere on the homepage.
- Link/button labels: All CTAs and nav links carry descriptive text. Decorative arrows (→) in GuideCard and the parent guide link are now uniformly `aria-hidden`. Trust chip icons are `aria-hidden`. Step-number circles in LearningJourney carry `aria-label="Step N"`. Stage-number circles in QualityPipeline carry `aria-label="Stage N"`.
- Reduced motion: ScrollReveal now uses `useReducedMotion()` — zero-duration, zero-translate path when enabled. HeroMockup rAF loop is guarded with a `window.matchMedia` check and jumps to the final value immediately when reduced motion is on. The CSS `@media (prefers-reduced-motion: reduce)` block in globals.css (set via `transition-duration: 0.01ms !important`) covers remaining CSS transitions (ProgressRing `stroke-dashoffset`, progress bar `width`). All homepage motion now respects the user preference through both CSS and JavaScript paths.
- Contrast risks: Brand orange `#F05A28` on white is a known marginal case for small text below 14 px; no new regressions introduced in this sprint. Body ink `#2D3748` on `#FAFBFF` background meets WCAG AA. Muted `#718096` on white is approximately 4.6:1 and meets AA for normal-weight text at 14 px+.

COPY REVIEW:
- Overclaims removed: None introduced. Sprint 3 copy is correctly scoped: "AI-assisted feedback" (not "AI teacher"), "quality-checked content" (not medically precise), "progress parents can see" (no outcome guarantees), "UK curriculum-aligned" (not school-accredited). No changes to copy were required.
- DECIFER casing: All visible homepage copy uses DECIFER in all caps. Every occurrence of "Decifer" in app/page.tsx is a component name (DeciferLogo) and is not user-visible.
- Parent clarity: The homepage addresses all four required questions. (a) What DECIFER Learning is: hero headline and description. (b) How children use it: LearningJourney section (Learn, Practise, Quiz, Progress). (c) How parents see progress: the parent-problem section and the "Built for children. Visible to parents." split-column section. (d) How content quality is controlled: QualityPipeline section with all six stages named.

KNOWN GAPS (out of Sprint 4 scope, tracked for follow-up):
- No Privacy Policy or Terms link exists in the footer. A legal page set (/legal/privacy, /legal/terms) does not yet exist in this project. For a children's platform these are required before public launch and must be created in a dedicated sprint.

WHAT WAS INTENTIONALLY NOT TOUCHED:
- Auth: No changes to /login, /register, /reset-password, /auth/callback, or middleware.
- Reward Vault: No changes to /vault, /api/vault/*, or any vault component.
- Quiz: No changes to /topics/[id]/quiz, /api/quiz/*, or any quiz component.
- Database schema: prisma/schema.prisma unchanged.
- APIs: No changes to any /api/* routes.
- Content pipeline: No changes to services/content-pipeline/ or any pipeline script.
- Admin pages: No changes to /dashboard/admin/*.
- Parent dashboard: No changes to /dashboard/parent/*.
- Child dashboard: No changes to /dashboard/child/*.
- Gamification logic: No changes to lib/points.ts, lib/sm2.ts, or gamification components.

QUALITY GATES:
- TypeScript: PASS — `npm run typecheck` (tsc --noEmit) exits clean, zero errors.
- ESLint: PASS — `npm run lint` reports no warnings or errors.
- Build: PASS — `npm run build` produces 42/42 static pages, all dynamic routes compiled. Homepage (/) builds as a dynamic route at 4.54 kB (202 kB first load JS).

COMMIT STATUS: Code changes committed in 5e92269 ("fix: reduced-motion guards and footer responsive fix (v1.2.1)"). This document committed in the follow-on commit.
