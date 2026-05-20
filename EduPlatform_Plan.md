# EduPlatform — Full Product & Technical Plan

**Version:** 1.1 — MVP (Family Pilot) — Updated May 2026
**Target Users:** KS2 (Year 3) and KS3 (Year 7) — UK National Curriculum
**Subjects:** Maths, English, Science

---

## 1. Vision & Phases

### Phase 1 — Family Pilot
A private, invite-only web app for two children. Focus on learning content quality, game mechanics, and the quiz/hint/points system. No payment required.

### Phase 2 — Community Rollout
Open registration for other families in the community, covering all UK year groups (Y1–Y11). Subscription billing added. Teacher/tutor accounts introduced.

### Phase 3 — Scale
Full UK curriculum coverage, mobile apps, class analytics dashboards for schools, and a content creator (teacher) portal.

---

## 2. User Roles

| Role | Description |
|---|---|
| **Child** | Learns, plays games, takes quizzes, earns points |
| **Parent** | Creates child accounts, monitors progress, sets goals |
| **Admin** | Manages content, year groups, and subscriptions (you, initially) |
| **Teacher** *(Phase 2+)* | Assigns topics to groups of pupils, views class progress |

---

## 3. Core User Flow

```
LANDING PAGE
    │
    ▼
LOGIN / REGISTER
    │
    ├── Child Login ──────────────────────────────────────────────────────►
    │                                                                       │
    │   CHILD DASHBOARD                                                    │
    │   - Avatar, total points, current streak                             │
    │   - Choose SUBJECT (Maths / English / Science)                       │
    │       │                                                              │
    │       ▼                                                              │
    │   TOPIC LIST  (aligned to their year group)                          │
    │   - Each topic shows: locked / in-progress / completed               │
    │       │                                                              │
    │       ▼                                                              │
    │   TOPIC HOME                                                         │
    │   ┌─────────────────────────────────────────────────────┐           │
    │   │  Step 1 — LEARN                                      │           │
    │   │  • Plain-English explanation of the concept          │           │
    │   │  • 2-3 worked examples with step-by-step breakdown   │           │
    │   │  • "Did you know?" fun fact                          │           │
    │   ├─────────────────────────────────────────────────────┤           │
    │   │  Step 2 — PRACTISE (Game)                            │           │
    │   │  • Interactive mini-game to practise the skill       │           │
    │   │  • Earn up to 100 bonus points                       │           │
    │   │  • Unlimited attempts — low pressure                 │           │
    │   ├─────────────────────────────────────────────────────┤           │
    │   │  Step 3 — TEST (Quiz)                                │           │
    │   │  • 10 questions, multiple choice or short answer     │           │
    │   │  • Each correct answer = 10 points                   │           │
    │   │  • Hint button costs 3 points (up to 3 hints/question│           │
    │   │  • Score tracked; pass threshold = 70%               │           │
    │   │  • On pass → topic marked complete, badge awarded    │           │
    │   │  • On fail → review weak areas, retry allowed        │           │
    │   └─────────────────────────────────────────────────────┘           │
    │       │                                                              │
    │       ▼                                                              │
    │   LEADERBOARD (weekly reset, all-time)                               │
    │                                                                      │
    ├── Parent Login ─────────────────────────────────────────────────────►
    │   PARENT DASHBOARD                                                   │
    │   - Overview of each child's progress                                │
    │   - Points history, topics completed, quiz scores                    │
    │   - Ability to add/manage child accounts                             │
    └──────────────────────────────────────────────────────────────────────
```

---

## 4. Gamification Design

### Points System

| Action | Points |
|---|---|
| Complete Learn section | +5 |
| Complete Practice game (basic) | +10–50 (scaled by score) |
| Answer quiz question correctly (no hints) | +10 |
| Answer correctly after 1 hint | +7 |
| Answer correctly after 2 hints | +4 |
| Answer correctly after 3 hints | +1 |
| Complete a full topic (pass quiz) | +25 bonus |
| 3-day learning streak | +15 bonus |
| 7-day learning streak | +50 bonus |

### Hints
- Up to 3 hints per quiz question
- Hint 1: Nudge ("Think about what X means...")
- Hint 2: Worked partial example or formula
- Hint 3: Near-answer ("The answer starts with...")
- Points deducted per hint used (see above)

### Badges
| Badge | Trigger |
|---|---|
| Topic Star | Complete any topic |
| Subject Champion | Complete all topics in a subject |
| Perfect Score | 100% on a quiz, no hints |
| Speed Runner | Complete a quiz in under 3 minutes with 80%+ |
| Streak 7 | 7-day consecutive login |
| Top of the Class | Reach #1 on the weekly leaderboard |

### Leaderboard
- Weekly (resets Monday) and All-Time tabs
- Shows: avatar, name, year group, points
- Filtered view: "My Year Group Only" toggle
- In Phase 2, visible only to users in the same subscription group (school/family)

---

## 5. Content Structure (UK National Curriculum)

Each topic follows the same structure: **Learn → Practise → Test**

### Year 3 (KS2) — Maths Sample Topics
- Place value (hundreds, tens, ones)
- Addition and subtraction (up to 1000)
- Multiplication tables (3, 4, 8)
- Fractions (½, ⅓, ¼, unit fractions)
- Measurement (length, mass, capacity)
- Geometry (2D and 3D shapes)
- Statistics (bar charts, pictograms)

### Year 3 (KS2) — English Sample Topics
- Prefixes and suffixes
- Conjunctions and connectives
- Punctuation: inverted commas (speech marks)
- Paragraph writing
- Reading comprehension (inference and retrieval)
- Poetry and rhyme

### Year 3 (KS2) — Science Sample Topics
- Plants (structure, life cycle)
- Animals including humans (nutrition, skeleton)
- Rocks (types, fossils)
- Light (sources, shadows)
- Forces and magnets

### Year 7 (KS3) — Maths Sample Topics
- Algebra: forming and solving equations
- Ratio and proportion
- Percentages (increase, decrease, reverse)
- Angles (parallel lines, triangles)
- Area and perimeter (compound shapes)
- Statistics: mean, median, mode, range
- Probability (basic)

### Year 7 (KS3) — English Sample Topics
- Analytical writing (PEE paragraphs)
- Shakespeare introduction (key themes and language)
- Persuasive writing techniques
- Reading non-fiction: fact vs. opinion
- Vocabulary in context
- Spelling patterns and etymology

### Year 7 (KS3) — Science Sample Topics
- Cells (plant vs. animal, specialised cells)
- Particle model of matter
- Elements, compounds, mixtures
- Forces (balanced/unbalanced, gravity)
- Electricity (circuits, current, voltage)
- Space (Solar System, seasons, moon phases)

---

## 6. Database Schema (Core Tables)

```sql
-- Users
users (id, email, password_hash, role, created_at)

-- Profiles (one per child or parent)
profiles (id, user_id, display_name, avatar_url, year_group, total_points, streak_days, last_active)

-- Parent–Child Links
family_links (parent_user_id, child_user_id)

-- Curriculum
subjects (id, name)                                  -- Maths, English, Science
year_groups (id, label)                              -- Year 1 through Year 11
topics (id, subject_id, year_group_id, title, order_index, is_published)

-- Content
learn_content (id, topic_id, body_html, examples_json)
practice_game (id, topic_id, game_type, config_json)
quiz_questions (id, topic_id, question_text, question_type, options_json, correct_answer, hint_1, hint_2, hint_3)

-- Progress
topic_progress (id, profile_id, topic_id, status [not_started/in_progress/completed], last_score, completed_at)
quiz_attempts (id, profile_id, topic_id, score, hints_used, time_taken_seconds, created_at)

-- Points & Badges
point_events (id, profile_id, amount, reason, created_at)
badges (id, name, icon_url, description, trigger_rule)
profile_badges (profile_id, badge_id, awarded_at)

-- Subscriptions (Phase 2)
subscriptions (id, user_id, plan, status, stripe_customer_id, current_period_end)
```

---

## 7. Recommended Tech Stack

### Frontend
**Next.js 14 (React)** — The best choice for this project.
- File-based routing works great for the learn/practise/test page structure
- Server-side rendering helps with SEO when you go public in Phase 2
- Easy to deploy to Vercel for free in Phase 1
- Large ecosystem of UI libraries suited to kids' games

**Tailwind CSS** — Fast, clean styling. Easy to build bright, kid-friendly UIs.

**Framer Motion** — Smooth animations for badge awards, correct answer celebrations, and transitions. Makes the app feel polished and fun.

### Backend
**Next.js API Routes** (Phase 1) — Keep everything in one codebase initially. API routes handle auth, quiz scoring, points logic, and leaderboard.

**Node.js + Express** (Phase 2 migration) — As complexity grows, split into a dedicated API service.

### Database
**PostgreSQL via Supabase** — Strongly recommended.
- Free tier is generous enough for Phase 1 (family pilot)
- Supabase gives you a managed Postgres DB, built-in authentication, row-level security, and a real-time API out of the box
- You can query it directly from Next.js API routes
- Easy to migrate to a dedicated database later

**Prisma ORM** — Type-safe database queries from your Next.js code. Prevents bugs, great developer experience.

### Authentication
**Supabase Auth** — Handles email/password login, sessions, and JWT tokens. Has parent/child account support through row-level security policies. In Phase 2, add Google OAuth for quick sign-in.

### File & Image Storage
**Supabase Storage** — For avatar images, badge icons, game assets. Free tier included.

### Game Layer
**Phaser.js** — Industry-standard HTML5 game framework. Lightweight, runs in the browser. Use it for mini-games embedded within the practise steps. Alternatively, for simpler interactions (drag-and-drop, matching, fill-in-the-blank), plain React with animations is sufficient and easier to maintain.

### Hosting & Deployment
**Vercel** (Frontend + API) — Zero-config deployment for Next.js. Free tier handles Phase 1 easily. Scales automatically.
**Supabase** (Database + Auth + Storage) — Free tier for Phase 1. Pro tier is ~$25/month when you go public.

### Subscriptions (Phase 2)
**Stripe** — Standard for SaaS subscriptions. Handles recurring billing, trial periods, cancellations, and family plan pricing. Integrate via Stripe Checkout to avoid building your own payment form.

### Content Management (Phase 2)
**Sanity.io** or **Contentful** — A headless CMS so you (or a content editor) can add and edit topics, learn content, quiz questions, and game configs without touching code. Both have free tiers.

---

## 8. Project Structure (File Layout)

```
edu-platform/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (child)/
│   │   ├── dashboard/
│   │   ├── subjects/[subject]/
│   │   ├── topics/[topicId]/
│   │   │   ├── learn/
│   │   │   ├── practise/
│   │   │   └── test/
│   │   └── leaderboard/
│   ├── (parent)/
│   │   ├── dashboard/
│   │   └── children/
│   └── api/
│       ├── quiz/
│       ├── points/
│       ├── progress/
│       └── leaderboard/
├── components/
│   ├── ui/                     # Buttons, cards, modals
│   ├── quiz/                   # QuizQuestion, HintButton, ScoreDisplay
│   ├── games/                  # Mini-game components
│   ├── leaderboard/
│   └── progress/               # Topic cards, progress bars
├── lib/
│   ├── supabase.ts
│   ├── prisma.ts
│   └── points.ts               # Points calculation logic
├── prisma/
│   └── schema.prisma
└── public/
    ├── avatars/
    ├── badges/
    └── game-assets/
```

---

## 9. Mini-Game Ideas by Type

| Game Type | Example Use | Mechanic |
|---|---|---|
| **Drag & Drop** | Match fractions to images | Drag tile onto correct target |
| **Fill-in-the-blank** | Complete a sentence with correct punctuation | Click to insert missing word |
| **Speed Round** | Times tables drill | Answer as many as possible in 60 seconds |
| **Word Scramble** | English vocabulary | Unscramble letters to form the correct word |
| **Label the Diagram** | Science (cells, skeleton) | Drag labels onto a diagram image |
| **Sort & Classify** | Elements vs. compounds | Drag items into two buckets |
| **Builder** | Algebra (balance the equation) | Drag blocks to balance a visual equation |

---

## 10. Phase 2 Subscription Model

### Suggested Pricing (Community Rollout)
| Plan | Price | Includes |
|---|---|---|
| Family Starter | £4.99/month | 2 child accounts, all subjects, Y1–Y11 |
| Family Plus | £7.99/month | Up to 4 children + parent progress reports |
| School/Tutor | £29.99/month | Up to 30 pupils + class dashboard + assignments |
| Annual (any plan) | 20% discount | Billed yearly |

### Gating Strategy
- Free: First 2 topics per subject unlocked forever (good for discovery)
- Paid: All topics, leaderboard, badges, streak bonuses, parent dashboard

---

## 11. MVP Build Order (Recommended Sequence)

1. **Week 1–2:** Supabase setup, auth (login + child/parent accounts), basic routing
2. **Week 3–4:** Year 3 Maths — 3 topics fully built (Learn + simple game + quiz with hints)
3. **Week 5:** Points engine, streak tracking, basic leaderboard
4. **Week 6:** Year 7 Maths — 3 topics. Add badge system.
5. **Week 7:** English topics for both year groups (2 each)
6. **Week 8:** Science topics for both year groups (2 each)
7. **Week 9:** Parent dashboard (progress overview per child)
8. **Week 10:** Polish — animations, avatar selection, mobile responsiveness
9. **Pilot:** Let your two kids use it. Gather feedback for 2–4 weeks.
10. **Phase 2 prep:** Stripe integration, full curriculum content expansion, community launch

---

## 12. Key Design Principles

**For children:**
- Large, clear fonts; bright but not overwhelming colours
- Immediate feedback on every answer (correct/incorrect celebration or gentle correction)
- No dead ends — always a "try again" or "get a hint" path
- Progress is always visible (topic map, points total, streak)
- Avatars and badges create identity and ownership

**For parents:**
- One-screen summary of what each child has done this week
- No marketing noise — clean, trustworthy interface
- Ability to set a daily time limit or suggested topics

**For scale:**
- All content stored in the database, not hardcoded — easy to add new year groups, topics, and questions without code changes
- Quiz questions can be randomised from a pool so children can retry without seeing the same questions
- Internationalisation-ready structure (even if not needed now)

---

---

## 13. Difficulty Levels — Fun Naming System

Every topic has three difficulty tiers. The naming should feel like a journey or adventure, not like school grades. Each tier unlocks after the previous one is passed.

| Tier | Fun Name | Colour | Icon | Description shown to child |
|---|---|---|---|---|
| Beginner | 🌱 **Sprout** | Mint green `#A8E6CF` | Seedling | "Just starting out — let's explore!" |
| Intermediate | 🚀 **Explorer** | Sky blue `#74C0FC` | Rocket | "Getting the hang of it — blast off!" |
| Advanced | ⚡ **Lightning** | Sunshine yellow `#FFD43B` | Bolt | "You're on fire — bring the challenge!" |

### How Levels Work
- Each topic has three separate sets of content: Sprout / Explorer / Lightning
- **Sprout** unlocks immediately when a child opens a topic
- **Explorer** unlocks after passing the Sprout quiz at 70%+
- **Lightning** unlocks after passing the Explorer quiz at 70%+
- Points multipliers: Sprout = ×1, Explorer = ×1.5, Lightning = ×2
- Separate badges for completing all three tiers of a topic ("Topic Mastered" badge)
- The leaderboard shows which tier each player is working at

### Content Differences by Level (example: Year 3 Fractions)
| Section | Sprout | Explorer | Lightning |
|---|---|---|---|
| Learn | What is a fraction? Simple diagrams | Equivalent fractions, comparing fractions | Mixed numbers, fractions of amounts |
| Game | Colour the fraction of a pizza | Match equivalent fractions pairs | Order fractions on a number line |
| Quiz | "What is ½ of 8?" | "Which is bigger: ¾ or ⅔?" | "Write ¾ as an equivalent fraction with 12 as the denominator" |

---

## 14. Colour Scheme & Visual Design

### Design Philosophy
Light, airy, and energetic — not dark or intense. The app should feel like a playground, not a classroom. White backgrounds with splashes of colour. Rounded corners everywhere. Friendly illustrations.

### Colour Palette

| Token | Hex | Use |
|---|---|---|
| Background | `#FAFBFF` | Main page background — near-white with a cool tint |
| Surface | `#FFFFFF` | Cards, modals, panels |
| Primary (Maths) | `#6C9EFF` | Maths subject card, headers |
| Primary (English) | `#FF8FAB` | English subject card, headers |
| Primary (Science) | `#52D9A0` | Science subject card, headers |
| Sprout green | `#A8E6CF` | Beginner level accents |
| Explorer blue | `#74C0FC` | Intermediate level accents |
| Lightning yellow | `#FFD43B` | Advanced level accents |
| Points gold | `#FFC107` | Stars, points display |
| Correct | `#40C057` | Answer correct feedback |
| Incorrect | `#FF6B6B` | Answer incorrect feedback |
| Neutral text | `#2D3748` | Body copy |
| Muted text | `#718096` | Labels, secondary info |

### Typography
- **Headings:** Nunito (rounded, friendly, readable for children)
- **Body text:** Inter or system font (clean, legible at all sizes)
- **Min font sizes:** 16px body, 20px headings on mobile

### Visual Feedback Moments
| Trigger | Animation |
|---|---|
| Correct answer | Green burst + star sparkle + "+10 pts" floats up |
| Wrong answer | Gentle red shake + encouraging message ("Nearly! Try the hint") |
| Quiz passed | Confetti shower + badge pop-up + points summary |
| Quiz failed | Soft fade + "You got X/10 — want to try again?" + weak areas highlighted |
| Streak milestone | Flame animation + "X day streak!" banner |
| Badge earned | Badge flips in with glow effect + sound chime |
| Level unlocked | Rocket/lightning bolt animation + "Explorer unlocked!" |
| Hint used | Hint card slides in from the side, points counter ticks down |

---

## 15. Child Customisation System

Children should be able to make the platform feel personal. This creates emotional ownership and increases return visits.

### Avatar Builder
- Choose a base character (kid, robot, animal, or space explorer)
- Customise: skin/colour tone, hair, accessories, outfit colour
- New avatar items unlocked by earning badges or reaching point milestones
- Avatar shown on: dashboard, leaderboard, quiz results

### Theme Selector
Children can choose their personal colour theme (does not affect content, only their own UI chrome):

| Theme Name | Primary Colour | Feel |
|---|---|---|
| Sunshine | Yellow + Orange | Warm and bright |
| Ocean | Blue + Teal | Cool and calm |
| Berry | Purple + Pink | Playful and bold |
| Forest | Green + Mint | Fresh and natural |
| Midnight | Navy + Lavender | Darker, for older kids |

### Personal Dashboard Widgets
Kids can pin/unpin widgets on their dashboard:
- Current streak counter
- "My best subject" card
- Last badge earned
- Leaderboard rank
- Suggested next topic

### Custom Study Buddy
A small animated character that sits in the corner of the screen, reacts to performance, and delivers hint prompts and encouragement. Child picks their buddy at onboarding (e.g., a fox, a robot, an owl, or a narwhal). Buddy unlocks new "moods" or outfits as the child progresses.

### Customisation Database Fields
```sql
-- Add to profiles table:
avatar_config       JSONB    -- stores builder selections
theme_name          TEXT     -- selected colour theme
dashboard_widgets   JSONB    -- array of pinned widget IDs
study_buddy         TEXT     -- chosen character slug
study_buddy_skin    TEXT     -- unlocked skin/outfit
```

---

## 16. Mobile & Tablet (iPad) Support

### Approach: Progressive Web App (PWA)
Rather than building separate iOS/Android apps (expensive and requires App Store approval), the web app is built as a PWA. This means:
- It works in Safari/Chrome on iPhone and iPad
- Children can "Add to Home Screen" — it looks and feels like an app
- Works offline for Learn and Practice sections (quiz requires a connection for scoring)
- Push notifications for streak reminders (e.g., "You haven't practised today yet!")
- No App Store needed, no subscription fees to Apple/Google

### Responsive Breakpoints
| Device | Layout change |
|---|---|
| iPhone (375px+) | Single column, large tap targets (min 48px), bottom nav bar |
| iPad (768px+) | Two-column topic list, sidebar nav |
| Desktop (1024px+) | Full layout with sidebar, wider content cards |

### Touch-Friendly Game Design
- All drag-and-drop games work with touch (not just mouse)
- Tap targets never smaller than 48×48px
- No hover-only interactions — everything accessible by tap
- Games tested on both iPad landscape and portrait orientations

### Technical PWA Setup (Next.js)
Add `next-pwa` package. Configure `manifest.json` with app name, icons, and theme colour. Enable service worker for offline caching of Learn content.

---

## 17. Hosting & Domain — What to Buy

### Domain Name (~£10–15/year)
**Register at:** Namecheap (namecheap.com) — cheapest and reliable.
Suggested domain ideas: `learnsprout.co.uk`, `sparklearn.co.uk`, `sproutschool.co.uk`, `quizquest.co.uk`
- Search for a `.co.uk` (feels local and trusted by UK parents) and `.com` of the same name
- Buy both if available (~£25/year combined) to protect the brand

### Hosting Stack — Phase 1 (Free / Near-Free)
| Service | What it does | Cost |
|---|---|---|
| **Vercel** | Hosts the Next.js app, CDN, auto-deploys from GitHub | Free (Hobby plan) |
| **Supabase** | PostgreSQL database + Auth + File storage | Free (500MB DB, 1GB storage) |
| **Namecheap** | Domain name | ~£12/year |
| **Total Phase 1** | | ~£12/year |

### Hosting Stack — Phase 2 (Community Launch)
| Service | Cost | When to upgrade |
|---|---|---|
| Vercel Pro | $20/month | When you need custom domains on multiple environments or >100GB bandwidth |
| Supabase Pro | $25/month | When DB exceeds 500MB or you need daily backups + more connections |
| Stripe | 1.4% + 20p per transaction | When subscriptions go live |
| **Total Phase 2** | ~£40–50/month | At community launch |

### Setup Steps (in order)
1. Register domain on Namecheap
2. Create a free Vercel account (vercel.com) — connect to your GitHub repo
3. Create a free Supabase project (supabase.com) — copy the connection string
4. In Vercel, add your Namecheap domain under "Domains" settings
5. Namecheap: update nameservers to point to Vercel (Vercel gives you the values)
6. Done — your app is live at your domain within minutes

---

## 18. Handing Off to Claude Code

### What Claude Code Is
Claude Code is Anthropic's command-line coding tool. You run it in your Terminal on your Mac, point it at your project folder, and it reads, writes, and edits code files directly — building features, fixing bugs, and running tests on your behalf.

### Why It's the Right Tool for Building This
Cowork (what you're using now) is great for planning, documents, and research. Claude Code is where the actual code gets written. It can scaffold the entire Next.js project, write the database schema, build components, and wire up Supabase — all from your terminal.

### How to Hand Off — Step by Step
```
Step 1: Install Claude Code
  Open Terminal on your Mac and run:
  npm install -g @anthropic-ai/claude-code

Step 2: Create your project folder
  mkdir edu-platform
  cd edu-platform

Step 3: Start Claude Code
  claude

Step 4: Paste this prompt to get started:

"Build a Next.js 14 educational web app for UK primary and secondary school children.
Use Supabase for the database and auth, Tailwind CSS for styling, and Prisma as the ORM.
The app should have:
- Child and parent user roles with Supabase Auth
- A curriculum structured as: Year Group > Subject > Topic > (Learn / Practise / Quiz)
- Three difficulty tiers per topic: Sprout (beginner), Explorer (intermediate), Lightning (advanced)
- A points system where quiz answers earn points and hints cost points
- Badge awards and a leaderboard
- A child customisation system: avatar builder, colour theme selector, study buddy character
- Mobile-first responsive layout with PWA support
- Light colour scheme using: background #FAFBFF, Maths #6C9EFF, English #FF8FAB, Science #52D9A0
- Nunito font for headings, Inter for body text

Start by scaffolding the project structure, installing dependencies, and creating the Prisma schema."
```

### What to Expect
Claude Code will scaffold the entire project in one session — folder structure, dependencies, database schema, and core pages. You then work with it iteratively: "now build the quiz component", "add the hint system", "make the leaderboard page", and so on. Each session picks up where the last left off.

---

## 19. Updated Build Order (with new features)

1. **Week 1:** Domain + hosting setup. GitHub repo. Claude Code scaffolds Next.js + Supabase + Prisma.
2. **Week 2:** Auth flows (child + parent login), year group selection, basic routing.
3. **Week 3:** Customisation system — avatar builder, theme selector, study buddy picker (onboarding flow).
4. **Week 4:** Year 3 Maths — 3 topics, all 3 difficulty tiers (Sprout/Explorer/Lightning), Learn sections.
5. **Week 5:** Practice games for Week 4 topics. Points engine.
6. **Week 6:** Quiz system with hints, scoring, tier unlocking logic, visual feedback animations.
7. **Week 7:** Badges, leaderboard, streak system.
8. **Week 8:** Year 7 topics (3 Maths). English topics for both year groups (2 each).
9. **Week 9:** Science topics. Parent dashboard.
10. **Week 10:** PWA setup, mobile testing on iPhone and iPad, polish.
11. **Pilot:** Both kids use it for 3–4 weeks. Collect feedback.
12. **Phase 2 prep:** Stripe subscriptions, full curriculum content, community launch.

---

*Document updated May 2026 — v1.1. Review and update after Phase 1 pilot.*
