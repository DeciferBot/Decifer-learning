import { prisma } from '@/lib/prisma'

// The Zone Guardian is the payoff for finishing a zone: a Legendary card and the
// Guardian Slayer badge. The world map only offers the "Battle Guardian" link
// once every published topic in the zone is complete
// (app/(child)/world-map/page.tsx → allCompleted), but the link was the only
// thing standing in the way. /guardian/<zoneId> was reachable by URL and the
// submit route awarded the rewards to anyone who posted to it, so the boss could
// be taken without earning it.
//
// This is the one definition of "zone complete", shared by the page and the API.
// Keep it in step with the world map: a zone is complete when the child has a
// completed topic_progress row for every published topic in it.

export type GuardianGate = {
  unlocked: boolean
  completedTopics: number
  totalTopics: number
}

export async function getGuardianGate(
  profileId: string,
  zoneId: string,
): Promise<GuardianGate> {
  const topics = await prisma.topic.findMany({
    where: { zone_id: zoneId, is_published: true },
    select: { id: true },
  })

  // A zone with no published topics has nothing to finish, so nothing to unlock.
  if (topics.length === 0) return { unlocked: false, completedTopics: 0, totalTopics: 0 }

  const completedTopics = await prisma.topicProgress.count({
    where: {
      profile_id: profileId,
      topic_id: { in: topics.map((t) => t.id) },
      status: 'completed',
    },
  })

  return {
    unlocked: completedTopics === topics.length,
    completedTopics,
    totalTopics: topics.length,
  }
}
