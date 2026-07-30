import type { Guide } from '../types'

export const schoolYearGroupsAgesUae: Guide = {
  slug: 'school-year-groups-ages-uae',
  title: 'School Year Groups and Ages in the UAE: FS1 to Year 13 Conversion Table',
  h1: 'Year groups and ages in the UAE: the full conversion table',
  description:
    'Which year group your child belongs in under UAE rules: the official age table from FS1 to Year 13, British years versus American grades versus IB, and the new 31 December cut-off explained.',
  keyAnswer:
    'From 2026-27 the UAE school entry cut-off is 31 December. A child joins the year group matching the age they reach by 31 December that year: 3 for FS1, 4 for FS2, 5 for Year 1 and 6 for Year 2. April-start schools keep a 31 March cut-off.',
  category: 'curriculum-explained',
  datePublished: '2026-07-30',
  dateModified: '2026-07-30',
  blocks: [
    {
      kind: 'p',
      html: 'Year 4 or Grade 3? FS2 or KG1? Every family that moves between school systems hits this question, and the UAE just changed the rule that decides it. This guide has the official conversion table and the new cut-off dates, so you can work out exactly where your child fits.',
    },
    { kind: 'h2', id: 'new-cutoff', text: 'The big change: the cut-off moved to 31 December' },
    {
      kind: 'p',
      html: 'From the 2026-27 academic year, the UAE moved the school entry cut-off from 31 August to <strong>31 December</strong> for September-start schools. The rule now works like this: your child joins the year group matching the age they reach by 31 December of the admission year. So for entry in September 2026, a child who turns 4 by 31 December 2026 joins FS2, and a child who turns 5 by then joins Year 1. April-start schools (Indian, Pakistani and Bangladeshi curricula) keep 31 March as their cut-off.',
    },
    {
      kind: 'list',
      items: [
        '<strong>FS1:</strong> turns 3 by 31 December of the admission year',
        '<strong>FS2 (Reception):</strong> turns 4 by 31 December',
        '<strong>Year 1:</strong> turns 5 by 31 December',
        '<strong>Year 2:</strong> turns 6 by 31 December',
      ],
    },
    {
      kind: 'callout',
      title: 'Transition rules for 2026-27',
      html: 'The new cut-off applies to children registering in Dubai’s school system for the first time; children already enrolled simply continue with their current cohort. As a one-time flexibility, children born between 1 September and 31 December 2022 who have never been enrolled may start in either FS1 or FS2 in 2026-27, decided jointly by the school and parents. From 2027-28 the cut-off applies strictly.',
    },
    { kind: 'h2', id: 'conversion-table', text: 'The conversion table: UK, UAE MOE, IB and US' },
    {
      kind: 'p',
      html: 'This mapping comes from KHDA’s official student placement guidelines. Age means the age reached by 31 December for September-start schools.',
    },
    {
      kind: 'table',
      caption: 'Year group equivalence by age (source: KHDA student placement guidelines)',
      headers: ['Age', 'UK (British)', 'UAE MOE', 'IB', 'US'],
      rows: [
        ['3', 'FS1', 'Pre-KG', 'PYP Early Years', 'Pre-K'],
        ['4', 'FS2 / Reception', 'KG1', 'PYP Early Years', 'KG1'],
        ['5', 'Year 1', 'KG2', 'PYP Early Years', 'KG2'],
        ['6', 'Year 2', 'Grade 1', 'PYP Year 1', 'Grade 1'],
        ['7', 'Year 3', 'Grade 2', 'PYP Year 2', 'Grade 2'],
        ['8', 'Year 4', 'Grade 3', 'PYP Year 3', 'Grade 3'],
        ['9', 'Year 5', 'Grade 4', 'PYP Year 4', 'Grade 4'],
        ['10', 'Year 6', 'Grade 5', 'PYP Year 5', 'Grade 5'],
        ['11', 'Year 7', 'Grade 6', 'MYP Year 1', 'Grade 6'],
        ['12', 'Year 8', 'Grade 7', 'MYP Year 2', 'Grade 7'],
        ['13', 'Year 9', 'Grade 8', 'MYP Year 3', 'Grade 8'],
        ['14', 'Year 10', 'Grade 9', 'MYP Year 4', 'Grade 9 (Freshman)'],
        ['15', 'Year 11', 'Grade 10', 'MYP Year 5', 'Grade 10 (Sophomore)'],
        ['16', 'Year 12', 'Grade 11', 'DP Year 1', 'Grade 11 (Junior)'],
        ['17', 'Year 13', 'Grade 12', 'DP Year 2', 'Grade 12 (Senior)'],
      ],
    },
    { kind: 'h2', id: 'how-placement-works', text: 'How placement actually gets decided' },
    {
      kind: 'p',
      html: 'For the early years (FS1 to Year 1), age is the overriding rule regardless of any previous schooling. From Year 2 upwards, the transfer certificate from the previous school becomes the primary reference, and if it disagrees with the age table the school must refer the case to KHDA before confirming a place. Once enrolled, a child moves up with their age group, and skipping a year or repeating one needs formal regulator approval. UK curriculum schools have one extra flexibility at FS1 entry, where documented readiness assessments can adjust placement.',
    },
    { kind: 'h2', id: 'switching', text: 'Switching systems without losing ground' },
    {
      kind: 'p',
      html: 'A child moving from an American school to a British one lands in a year group by age, and the two systems sequence topics differently, so gaps are normal and rarely a sign of a problem. The fastest way to find and close them is targeted practice against the British curriculum for their year. Decifer Learning covers Years 1 to 11 topic by topic against the National Curriculum, shows you a learning map of what is secure and what is missing, and is free while in beta.',
    },
    { kind: 'cta' },
    {
      kind: 'faq',
      items: [
        {
          q: 'What age is Year 1 in the UAE?',
          a: 'A child joins Year 1 in the September of the school year in which they turn 5 by 31 December. Under the new cut-off, some children start Year 1 aged 4 and turn 5 during the autumn term.',
        },
        {
          q: 'What is FS2 the same as?',
          a: 'FS2 is Reception in England, KG1 in the UAE Ministry system, and KG1 in American-curriculum UAE schools. It is the year a child turns 4 by 31 December.',
        },
        {
          q: 'Can my child skip a year group?',
          a: 'Only with formal approval. Placement follows age (early years) or the transfer certificate (Year 2 and up), and any move outside the standard progression needs the regulator to sign off on an exceptional placement.',
        },
        {
          q: 'My child was born in October. Which year group are they in?',
          a: 'Under the 31 December cut-off, an October-born child joins the year group matching the age they turn that calendar year. For example, a child born in October 2021 turns 5 in 2026 and would join Year 1 in September 2026.',
        },
      ],
    },
  ],
  sources: [
    {
      label: 'UAE Ministry of Education: updated age cut-off for KG and Grade 1 admissions from 2026-27',
      url: 'https://www.moe.gov.ae/En/MediaCenter/News/Pages/UAE-announces-updated-age-cut-off-date-for-KG-Grade-1-admissions-starting-AY-2026-2027.aspx',
    },
    {
      label: 'KHDA: student placement guidelines, parent FAQ (PDF)',
      url: 'https://web.khda.gov.ae/KHDA/media/KHDA/FAQs-Parent_SPG.pdf',
    },
    {
      label: 'Khaleej Times: UAE updates FS1 and FS2 admission rules under the new age cut-off (February 2026)',
      url: 'https://www.khaleejtimes.com/uae/explained-uae-updates-fs1-fs2-school-admission-rules-under-new-age-cut-off',
    },
    {
      label: 'Gulf News: Dubai school admissions 2026-27, is your child eligible for KG1/FS2 (February 2026)',
      url: 'https://gulfnews.com/living-in-uae/education/dubai-school-admissions-202627-is-your-child-eligible-for-kg1fs2-1.500431269',
    },
  ],
  related: ['british-curriculum-explained', 'moving-to-uae-school-admissions', 'uae-term-dates-2026-27'],
}
