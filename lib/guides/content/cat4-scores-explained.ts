import type { Guide } from '../types'

export const cat4ScoresExplained: Guide = {
  slug: 'cat4-scores-explained',
  title: 'CAT4 Scores Explained: SAS, Stanines and Percentiles',
  h1: 'CAT4 scores explained: what 100 and 115 actually mean',
  description:
    'Your child’s CAT4 report has a Standard Age Score, a stanine and a national percentile rank on it. Here is what each number means, why the average is always 100, how much a score can move between sittings, and why our own free checks do not give you a number like this.',
  metaDescription:
    'What a CAT4 Standard Age Score of 100 or 115 means, plus stanines and national percentile rank, explained for parents in plain English.',
  keyAnswer:
    'A CAT4 Standard Age Score, or SAS, compares your child with other children of the same age. The average is set at 100 and the standard deviation is 15. That means roughly two thirds of children score between 85 and 115, and roughly 19 in 20 score between 70 and 130. An SAS of 100 is dead average for the age. An SAS of 115 is one standard deviation above it, which is around the top 15 per cent.',
  category: 'curriculum-explained',
  datePublished: '2026-08-19',
  dateModified: '2026-08-19',
  blocks: [
    {
      kind: 'p',
      html: 'A CAT4 report arrives with a small grid of numbers and almost no explanation. Parents reasonably want to know one thing: is this good? This guide answers that, and then explains the more useful question underneath it, which is how much any single number should change what you do.',
    },
    { kind: 'h2', id: 'sas', text: 'The Standard Age Score' },
    {
      kind: 'p',
      html: 'The Standard Age Score, written SAS, is the number that matters most. GL Education describes it as the student’s raw score adjusted for age and placed on a scale that compares them with a representative UK sample of students of the same age. The average is set at 100.',
    },
    {
      kind: 'p',
      html: 'The age adjustment is doing real work. Within one Year 6 class there can be nearly a year between the oldest and the youngest child, and at that age a year is a lot. The SAS strips that out, so a summer-born child is compared with other summer-born children rather than with classmates who are eleven months older.',
    },
    {
      kind: 'p',
      html: 'The second number behind the scale is the standard deviation, which is 15. Standard deviation is a measure of how spread out the scores are. Setting it at 15 is what makes 100 and 115 mean the same thing on every GL test and in every year group.',
    },
    {
      kind: 'table',
      caption:
        'How scores spread out on a scale with a mean of 100 and a standard deviation of 15 (source: GL Education)',
      headers: ['Score band', 'Share of children', 'In plain words'],
      rows: [
        ['Below 70', 'About 2 in 100', 'Well below the age average'],
        ['70 to 85', 'About 14 in 100', 'Below the age average'],
        ['85 to 100', 'About 34 in 100', 'Just below the middle'],
        ['100 to 115', 'About 34 in 100', 'Just above the middle'],
        ['115 to 130', 'About 14 in 100', 'Above the age average'],
        ['Above 130', 'About 2 in 100', 'Well above the age average'],
      ],
    },
    {
      kind: 'p',
      html: 'Read the two middle rows together and you get the single most useful fact about these scores. <strong>Around two thirds of all children score somewhere between 85 and 115.</strong> Add the next two rows out and, on GL’s own rounded figures, about 96 in 100 sit between 70 and 130. So a score of 104 and a score of 96 are not describing two different children. They are both describing an ordinary child in the middle of the pack.',
    },
    {
      kind: 'callout',
      title: 'What an SAS of 115 means',
      html: 'It is exactly one standard deviation above the average, which puts a child at roughly the 84th percentile. About one child in six scores 115 or higher. It is a genuinely strong score. It is not a rare one.',
    },
    { kind: 'h2', id: 'stanines', text: 'Stanines' },
    {
      kind: 'p',
      html: 'A stanine is a way of squashing the whole scale into nine bands, numbered 1 to 9. GL describes it as placing the SAS on a scale of 1 low to 9 high, to give a broad overview. Nobody outside schools uses the word, so here is the translation.',
    },
    {
      kind: 'table',
      caption: 'Stanines and the labels GL puts on them (source: GL Education)',
      headers: ['Stanine', 'GL’s description'],
      rows: [
        ['1', 'Very low'],
        ['2 and 3', 'Below average'],
        ['4, 5 and 6', 'Average'],
        ['7 and 8', 'Above average'],
        ['9', 'Very high'],
      ],
    },
    {
      kind: 'p',
      html: 'Stanine 5 is the middle band and holds the largest group of children. The value of a stanine is that it is deliberately blunt. It stops a school reading meaning into the gap between an SAS of 103 and an SAS of 107, because both land in the same band.',
    },
    { kind: 'h2', id: 'npr', text: 'National percentile rank' },
    {
      kind: 'p',
      html: 'The national percentile rank, written NPR, is the most intuitive of the three. GL explains it like this: an NPR of 50 is average, an NPR of 5 means the score is within the lowest 5 per cent of the standardisation sample, and an NPR of 95 means it is within the highest 5 per cent.',
    },
    {
      kind: 'p',
      html: 'One thing catches people out. Percentile ranks are not evenly spaced against SAS points. Near the middle of the scale a few SAS points move the percentile a long way, because most children are bunched there. Out at the ends, a few points barely move it at all. A jump from an SAS of 100 to 105 is a bigger move in percentile terms than a jump from 130 to 135.',
    },
    { kind: 'h2', id: 'how-much-to-read', text: 'How much to read into one score' },
    {
      kind: 'p',
      html: 'Less than the report’s confidence suggests. Every test carries measurement error, so a score is best read as the middle of a range rather than as a fixed point. A child who is tired, unwell, unfamiliar with the format or sitting the test in a second language can land several points away from where they would land on a better morning.',
    },
    {
      kind: 'p',
      html: 'The pattern across the four batteries is usually more useful than any single figure. A child whose verbal score sits well below their non-verbal, quantitative and spatial scores is telling you something specific about English rather than about reasoning, and that is a solvable problem. Our <a href="/guides/cat4-explained-uae">guide to CAT4 for UAE parents</a> covers what each battery tests and when children sit it here, and our <a href="/guides/11-plus-non-verbal-reasoning">guide to non-verbal reasoning question types</a> shows what the non-verbal questions actually look like.',
    },
    { kind: 'h2', id: 'our-checks', text: 'Why our free checks do not give you a score like this' },
    {
      kind: 'p',
      html: 'This is the part we want to be straight about, because plenty of free online tests are not.',
    },
    {
      kind: 'p',
      html: 'A standardised score only means something because of the work done before anyone takes the test. The publisher gives the test to a large sample of children chosen to represent the whole population, records how that sample performed, and builds the scale from those results. GL calls this standardisation, and the sample it produces is called the norm group. Everything you read on a CAT4 report, the SAS, the stanine and the percentile, is a statement about where your child sits against that group.',
    },
    {
      kind: 'p',
      html: '<strong>We have not done that, so we do not publish numbers that pretend we have.</strong> Our free <a href="/skills-check">Skills Check</a> gives you a different kind of answer, and one we can actually stand behind. It compares your child’s answers with the UK National Curriculum for their school year and reports, strand by strand, whether they look secure, developing, or in need of work. That is a criterion-referenced result. It measures against a published standard rather than against other children.',
    },
    {
      kind: 'table',
      caption: 'Two different kinds of result',
      headers: ['', 'CAT4 SAS', 'Our Skills Check'],
      rows: [
        ['Compares against', 'Other children of the same age', 'The National Curriculum for that year'],
        ['Needs a norm sample', 'Yes', 'No'],
        ['Gives a number out of 100', 'Yes, an SAS', 'No'],
        ['Tells you what to do next', 'Indirectly', 'Directly, by topic'],
      ],
    },
    {
      kind: 'p',
      html: 'If you ever see a free online test hand your child an IQ number, a percentile, or a score on a 100 scale, that is the question to ask: standardised against whom? A number produced without a norm group is decoration.',
    },
    { kind: 'cta' },
    {
      kind: 'faq',
      items: [
        {
          q: 'What is a good CAT4 score?',
          a: 'The average is 100 by design. Roughly two thirds of children score between 85 and 115, so anything in that band is ordinary. An SAS of 115 puts a child around the top 15 per cent, and 130 or above is roughly the top 2 per cent.',
        },
        {
          q: 'Is an SAS of 100 average or below average?',
          a: 'It is exactly average for a child of that age. The scale is built so that 100 is the mean, so a score of 100 means your child performed like a typical child born around the same time.',
        },
        {
          q: 'What is a stanine in CAT4?',
          a: 'It is the SAS placed on a nine-point scale, 1 for low and 9 for high. GL labels stanine 1 as very low, 2 and 3 as below average, 4 to 6 as average, 7 and 8 as above average, and 9 as very high.',
        },
        {
          q: 'What does a national percentile rank of 75 mean?',
          a: 'It means the score sits within the top quarter of the standardisation sample. An NPR of 50 is average, 5 is within the lowest 5 per cent, and 95 is within the highest 5 per cent.',
        },
        {
          q: 'Can a CAT4 score go down?',
          a: 'Yes, and it often moves a little in both directions between sittings. Every test has measurement error, so treat a score as the middle of a range. A large drop is worth a conversation with the school rather than an assumption about your child.',
        },
        {
          q: 'Does Decifer Learning give my child a standardised score or an IQ score?',
          a: 'No. We have not standardised our checks on a representative national sample, so publishing a score on that kind of scale would be inventing a number. Our Skills Check reports against the National Curriculum for your child’s year instead, strand by strand.',
        },
      ],
    },
  ],
  sources: [
    {
      label: 'GL Education: CAT4 Quick Start Guide (SAS, stanine, NPR and the distribution chart)',
      url: 'https://support.gl-education.com/media/1781/gl2732-cat4-quick-start-guide-2020.pdf',
    },
    {
      label: 'GL Education: understanding your CAT4 data',
      url: 'https://support.gl-education.com/knowledge-base/assessments/cat4-support/after-the-test/understanding-your-data',
    },
    {
      label: 'GL Education: standardisation and norms',
      url: 'https://support.gl-education.com/knowledge-base/assessments/exact-support/introduction/standardisation-and-norms',
    },
    {
      label: 'GL Education: types of scores (mean 100, standard deviation 15)',
      url: 'https://support.gl-education.com/knowledge-base/assessments/exact-support/understanding-results/types-of-scores',
    },
    {
      label: 'NFER: an introduction to standardised scores',
      url: 'https://www.nfer.ac.uk/assessment-hub/an-introduction-to-standardised-scores/',
    },
  ],
  related: ['cat4-explained-uae', '11-plus-non-verbal-reasoning', 'iq-tests-for-children'],
}
