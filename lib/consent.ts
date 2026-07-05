// Analytics consent — single source of truth for the cookie banner and the
// consent-gated Google Analytics tag.
//
// Privacy-by-default posture (UK Children's Code / GDPR / UAE PDPL best practice):
// analytics only runs after an explicit opt-in. Google Analytics is NOT loaded
// until readConsent() === 'accepted'.
//
// The storage key is versioned (`_v2`). Earlier builds stored 'accepted' under a
// banner that said "no tracking cookies" — that consent is not valid for
// analytics, so the new key forces everyone to choose again under honest copy.
export const CONSENT_STORAGE_KEY = 'decifer_consent_v2'
export const CONSENT_CHANGED_EVENT = 'decifer-consent-changed'

export type ConsentValue = 'accepted' | 'declined'

export function readConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    return v === 'accepted' || v === 'declined' ? v : null
  } catch {
    return null
  }
}

export function setConsent(value: ConsentValue): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value)
  } catch {
    // localStorage unavailable — nothing more we can do; treat as no consent.
  }
  // Notify same-tab listeners (the 'storage' event only fires cross-tab).
  try {
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT))
  } catch {
    // ignore
  }
}

export function hasAnalyticsConsent(): boolean {
  return readConsent() === 'accepted'
}
