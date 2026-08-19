'use client'

import { useState } from 'react'

// Confirms the delete, then reports what actually happened.
//
// Three outcomes, all told plainly: deleted, nothing to delete (already gone, or
// this attempt never had an email against it), or the request failed. Saying
// "done" in the second case would be a lie a parent cannot check.

type Props = {
  token: string
  action: (token: string) => Promise<boolean>
}

type State = 'idle' | 'busy' | 'deleted' | 'nothing' | 'error'

export function ForgetButton({ token, action }: Props) {
  const [state, setState] = useState<State>('idle')

  async function run() {
    setState('busy')
    try {
      const deleted = await action(token)
      setState(deleted ? 'deleted' : 'nothing')
    } catch {
      setState('error')
    }
  }

  if (state === 'deleted') {
    return (
      <p role="status" className="rounded-2xl border border-success/30 bg-success/10 p-5 text-[15px] text-ink">
        Done. Your email address has been removed and you will get no further emails about this
        check.
      </p>
    )
  }

  if (state === 'nothing') {
    return (
      <p role="status" className="rounded-2xl border border-black/5 bg-surface p-5 text-[15px] text-ink-2">
        There was nothing to delete. Either this was already done, or no email address was ever
        saved against this result.
      </p>
    )
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-5">
      <button
        type="button"
        onClick={run}
        disabled={state === 'busy'}
        className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-error px-6 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {state === 'busy' ? 'Deleting…' : 'Delete my email address'}
      </button>
      {state === 'error' && (
        <p role="alert" className="mt-3 text-sm font-medium text-error">
          That did not work. Please try again, or reply to the report email and we will do it by
          hand.
        </p>
      )}
    </div>
  )
}
