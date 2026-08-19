// GET /api/cron/skills-check-reminder
//
// Vercel Cron. Sends the six-week retest reminder the result page and the report
// email both promise. Until this existed the promise was empty, which is worse
// than not making it.
//
// Exactly one reminder per lead, ever. `reminder_sent_at` is stamped on the way
// out, and a lead is only picked up when that column is null.
//
// Secured by CRON_SECRET, same as every other cron route here.

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendSkillsCheckReminder } from '@/lib/skills-check/email'
import type { CheckResult } from '@/lib/skills-check/score'
import { buildTeaser } from '@/lib/skills-check/score'
import { prettyYear, prettySubject } from '@/lib/skills-check/server'

/** How long after the report before the reminder goes out. */
const REMINDER_AFTER_DAYS = 42

/**
 * Most reminders to send in one run.
 *
 * A cap, not a target. It keeps one run bounded whatever the backlog looks like,
 * and the next day's run picks up the rest because nothing is stamped until it
 * is sent.
 */
const MAX_PER_RUN = 100

async function handler(req: Request) {
  const secret =
    req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 })
  }

  const cutoff = new Date(Date.now() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000)

  const due = await prisma.skillCheckLead.findMany({
    where: {
      reminder_sent_at: null,
      // A parent who used the delete link is never emailed again. That is what
      // the tombstone is for.
      deleted_at: null,
      parent_email: { not: '' },
      consented_at: { lte: cutoff },
    },
    orderBy: { consented_at: 'asc' },
    take: MAX_PER_RUN,
    select: {
      id: true,
      parent_email: true,
      attempt: {
        select: {
          token: true,
          raw_score: true,
          total_items: true,
          working_level: true,
          strand_results: true,
          check: {
            select: {
              subject: { select: { name: true, slug: true } },
              year_group: { select: { label: true } },
            },
          },
        },
      },
    },
  })

  let sent = 0
  let failed = 0

  for (const lead of due) {
    const a = lead.attempt
    const subjectName = a.check.subject.name
    const yearLabel = a.check.year_group.label

    // Rebuild the headline from the stored result rather than storing a second
    // copy of it. One source of truth for the wording.
    const result: CheckResult = {
      strands: (a.strand_results as unknown as CheckResult['strands']) ?? [],
      workingLevel: a.working_level ?? 'towards_year',
      rawScore: a.raw_score ?? 0,
      totalItems: a.total_items ?? 0,
      bandAccuracy: { below: null, at: null, above: null },
    }
    const teaser = buildTeaser(result, prettyYear(yearLabel), prettySubject(subjectName))

    const ok = await sendSkillsCheckReminder({
      to: lead.parent_email,
      token: a.token,
      subjectName,
      subjectSlug: a.check.subject.slug ?? subjectName.toLowerCase(),
      yearLabel,
      previousHeadline: teaser.headline,
    })

    if (ok) {
      // Stamped only on success, so a mail outage means a retry tomorrow rather
      // than a parent silently losing the reminder they were promised.
      await prisma.skillCheckLead.update({
        where: { id: lead.id },
        data: { reminder_sent_at: new Date() },
      })
      sent += 1
    } else {
      failed += 1
    }
  }

  return NextResponse.json({ due: due.length, sent, failed })
}

export const GET = handler
export const POST = handler
