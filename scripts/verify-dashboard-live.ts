import { getProgressBySubject, getStrongestTopics, getChildWeakAreas } from '../lib/parent-dashboard'
import { getSignalsForChild } from '../lib/learning-signals-runner'

const PROFILE = '94397204-eb84-4257-9c9e-9729a10babbc'

async function main() {
  const [subj, strong, weak, signals] = await Promise.all([
    getProgressBySubject(PROFILE),
    getStrongestTopics(PROFILE, 5),
    getChildWeakAreas(PROFILE),
    getSignalsForChild(PROFILE),
  ])

  console.log('--- Progress by subject ---')
  for (const s of subj) {
    console.log(`  ${s.subjectName} | started: ${s.topicsStarted} | completed: ${s.topicsCompleted} | avgScore: ${s.averageScore !== null ? Math.round(s.averageScore * 100) + '%' : 'n/a'}`)
  }

  console.log('\n--- Strongest topics (Doing well) ---')
  for (const t of strong) {
    console.log(`  ${t.topicTitle} | score: ${Math.round(t.lastScore * 100)}% | signal: ${t.signal} | repetitions: ${t.repetitions}`)
  }

  console.log('\n--- Weak areas (Needs support) ---')
  for (const w of weak) {
    console.log(`  ${w.topicTitle} | errorRate: ${Math.round(w.errorRate * 100)}% | answered: ${w.totalAnswered} | signal: ${w.signal}`)
  }

  console.log('\n--- Learning patterns (signals) ---')
  for (const s of signals) {
    console.log(`  ${s.signalType} [${s.confidence}] | evidence: ${s.evidenceCount} | ${s.title}`)
  }

  console.log('\n=== SECTIONS THAT WOULD RENDER ===')
  console.log(`  Progress by subject: ${subj.length > 0 ? `YES (${subj.length} subject${subj.length > 1 ? 's' : ''})` : 'EMPTY STATE — "Subject progress will appear after..."'}`)
  console.log(`  Doing well so far:   ${strong.length > 0 ? `YES (${strong.length} topic${strong.length > 1 ? 's' : ''})` : 'HIDDEN (no data)'}`)
  console.log(`  Needs support:       ${weak.length > 0 ? `YES (${weak.length} topic${weak.length > 1 ? 's' : ''})` : 'HIDDEN or clean-slate message'}`)
  console.log(`  Learning patterns:   ${signals.length > 0 ? `YES (${Math.min(signals.length, 5)} signal${signals.length > 1 ? 's' : ''})` : 'HIDDEN (no signals)'}`)
  console.log(`  Disclaimer shown:    ${signals.length > 0 ? 'YES' : 'NOT SHOWN (no signals to disclaim)'}`)

  console.log('\n=== EMPTY STATE FOR NEW CHILD (simulation) ===')
  console.log('  If subjectProgress = []: renders "Subject progress will appear after [name] completes topics."')
  console.log('  If strongTopics   = []: section hidden entirely (no false positive "doing well")')
  console.log('  If weakAreas      = [] and quizAttempts > 0: shows "No topics with lower accuracy detected yet."')
  console.log('  If signals        = []: learning patterns section hidden entirely')
}

main().catch(console.error)
