import { ProgressRing } from '@/components/ui/ProgressRing'
import { Check, Flame } from '@/components/ui/icons'
import { PushNotificationButton } from '@/components/ui/PushNotificationButton'

/**
 * Today's goal is one round, not one topic.
 *
 * The implicit bar used to be a whole topic quiz: ten questions, roughly four
 * minutes, with a 39% chance of ending in a pass. The longest streak anyone has
 * ever reached on this product is 4 days. One five-question round is about
 * ninety seconds and is the thing that keeps the streak alive.
 *
 * The notification prompt lives here, and only appears once the child has
 * actually finished a round. It used to be gated on `streak >= 2`, which meant a
 * child needed a streak before being offered the thing that protects a streak;
 * `push_subscriptions` had zero rows, so the nightly streak nudge had nobody to
 * send to.
 */
export function DailyGoalRing({ done, streak }: { done: boolean; streak: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm">
      <ProgressRing
        percent={done ? 100 : 0}
        size={40}
        strokeWidth={4}
        color={done ? 'var(--correct)' : 'var(--points-gold)'}
      >
        {done ? (
          <Check className="w-4 h-4 text-correct" aria-hidden />
        ) : (
          <span className="text-[10px] font-bold tabular-nums text-muted" aria-hidden>0/1</span>
        )}
      </ProgressRing>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">
          {done ? "Today's goal done" : "Today's goal"}
        </p>
        <p className="text-xs text-muted">
          {done
            ? streak > 0
              ? `Your ${streak} day streak is safe.`
              : 'Your streak starts today.'
            : 'One round keeps your streak alive. About 2 minutes.'}
        </p>
      </div>

      {done && (
        <span className="flex-none">
          <Flame className="w-5 h-5 text-points-gold-700" aria-hidden />
        </span>
      )}
    </div>
  )
}

/**
 * Streak reminders opt-in. Split out so the home screen can place it directly
 * under the goal once the child has finished their first round.
 */
export function StreakReminderPrompt() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-surface px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">Streak reminders</p>
        <p className="text-xs text-muted">Get a nudge if your streak is about to break</p>
      </div>
      <PushNotificationButton />
    </div>
  )
}
