import type { Guide } from './types'
import { dubaiSchoolFees } from './content/dubai-school-fees'
import { trueCostUaeSchoolYear } from './content/true-cost-uae-school-year'
import { khdaRatingsExplained } from './content/khda-ratings-explained'
import { adekRatingsExplained } from './content/adek-ratings-explained'
import { choosingBritishSchoolDubai } from './content/choosing-british-school-dubai'
import { abuDhabiSchoolFeesRatings } from './content/abu-dhabi-school-fees-ratings'
import { britishCurriculumExplained } from './content/british-curriculum-explained'
import { gcseInUae } from './content/gcse-in-uae'
import { schoolYearGroupsAgesUae } from './content/school-year-groups-ages-uae'
import { uaeTermDates202627 } from './content/uae-term-dates-2026-27'
import { movingToUaeSchoolAdmissions } from './content/moving-to-uae-school-admissions'
import { satsAndPrimaryAssessments } from './content/sats-and-primary-assessments'
import { cat4ExplainedUae } from './content/cat4-explained-uae'
import { cat4ScoresExplained } from './content/cat4-scores-explained'
import { iqTestsForChildren } from './content/iq-tests-for-children'
import { elevenPlusNonVerbalReasoning } from './content/11-plus-non-verbal-reasoning'

// Ordered registry of published guides. Add new guides here after authoring
// the content file under lib/guides/content/. Order controls the hub page
// listing within each category.
const GUIDES: Guide[] = [
  dubaiSchoolFees,
  trueCostUaeSchoolYear,
  khdaRatingsExplained,
  choosingBritishSchoolDubai,
  abuDhabiSchoolFeesRatings,
  adekRatingsExplained,
  britishCurriculumExplained,
  cat4ExplainedUae,
  cat4ScoresExplained,
  elevenPlusNonVerbalReasoning,
  iqTestsForChildren,
  satsAndPrimaryAssessments,
  schoolYearGroupsAgesUae,
  gcseInUae,
  uaeTermDates202627,
  movingToUaeSchoolAdmissions,
]

export function getAllGuides(): Guide[] {
  return GUIDES
}

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug)
}
