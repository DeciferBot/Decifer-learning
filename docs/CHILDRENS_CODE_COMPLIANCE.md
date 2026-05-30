# UK Children's Code Compliance Audit
## Age Appropriate Design Code (ICO, September 2021)

Last reviewed: 2026-05-30  
Status: **Pre-community-rollout audit — family pilot only**

---

## Overview

The UK Age Appropriate Design Code (Children's Code) applies to any online service
"likely to be accessed by children under 18". Decifer Learning is explicitly designed
for children aged 7–12. All 15 standards must be met before community rollout.

---

## Standard-by-standard assessment

| # | Standard | Status | Notes |
|---|---|---|---|
| 1 | **Best interests of the child** | ✅ Pass | Learning-first design. No dark patterns. Gamification validated against research (shields, opt-in leaderboards). |
| 2 | **Data protection impact assessment** | ⚠️ Pending | DPIA must be documented before community rollout. |
| 3 | **Age appropriate application** | ✅ Pass | Year 3 (age 7–8) and Year 7 (age 11–12) explicitly targeted. Age-appropriate language throughout. |
| 4 | **Transparency** | ✅ Pass | Privacy policy exists. Children's privacy notice at `/legal/privacy`. Age-appropriate version needed — see §Action. |
| 5 | **Detrimental use of data** | ✅ Pass | No profiling for commercial purposes. No advertising. No data sold. |
| 6 | **Policies and community standards** | ✅ Pass | Terms of service exist. No UGC or community features in MVP. |
| 7 | **Default settings** | ✅ Pass | Leaderboard opt-in via `parent_controls.leaderboard_visible`. Social features opt-in. No sharing defaults on. |
| 8 | **Data minimisation** | ✅ Pass | Profiles collect: display_name, year_group, role, avatar_config, theme, study_buddy. No address, phone, or sensitive data. |
| 9 | **Data sharing** | ✅ Pass | No third-party data sharing. Google Analytics removed (2026-05-30). Vercel Analytics is first-party, cookie-free. |
| 10 | **Geolocation** | ✅ Pass | No geolocation used anywhere in the codebase. |
| 11 | **Parental controls** | ✅ Pass | `parent_controls` table: daily_time_limit_minutes, allowed_time_start/end, leaderboard_visible, social_features_enabled. |
| 12 | **Profiling** | ✅ Pass | SM-2 spaced repetition adapts content per child but does not create commercial profiles. No inference about protected characteristics. |
| 13 | **Nudge techniques** | ✅ Pass | No dark patterns. Streaks include shields to prevent punishment. Hint delay is pedagogical, not addictive. No infinite scroll. |
| 14 | **Connected toys and devices** | ✅ N/A | PWA only. No IoT/connected devices. |
| 15 | **Online tools** | ✅ Pass | No messaging between children. No UGC. No social graph visible to children. |

---

## Actions before community rollout

1. **DPIA (Standard 2)** — Document a Data Protection Impact Assessment covering:
   - Categories of data collected
   - Purpose and legal basis for each
   - Risk assessment
   - Mitigation measures
   - Review schedule

2. **Child-friendly privacy notice** — Add `/legal/privacy-for-kids` with plain English
   explanation of what data is collected, why, and children's rights. Link from onboarding.

3. **ICO registration** — Confirm registration as a data controller with the ICO
   (required for any UK business processing personal data).

---

## What was fixed in this audit (2026-05-30)

- **Google Analytics removed** from `app/layout.tsx`. GA requires cookie consent
  which conflicts with "privacy by default" for children. Replaced by Vercel Analytics
  (first-party, no cookies, no cross-site tracking, no individual identification).

---

## Ongoing compliance

- Review this document before every major feature release
- Any new data collection must update Standard 8 above and the DPIA
- Any new third-party integration must pass Standards 5, 9, and 13 before shipping
