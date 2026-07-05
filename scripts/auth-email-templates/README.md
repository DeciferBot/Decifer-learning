# Auth email templates

Branded Supabase auth emails for Decifer Learning, on the cross-browser-safe
**token_hash** flow. Each template links to
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next=<path>`,
which `app/auth/confirm/route.ts` verifies with `verifyOtp` — independent of the
PKCE `code_verifier` cookie, so links work from any browser, device, or in-app
webview. This is what fixes reset/magic links reading "expired on first click".
See [`lib/auth/verify-email-link.ts`](../../lib/auth/verify-email-link.ts).

| File | Supabase template | `type` |
|---|---|---|
| `recovery.html` | Reset Password | `recovery` |
| `magic_link.html` | Magic Link | `magiclink` |
| `confirmation.html` | Confirm signup | `signup` |
| `email_change.html` | Change Email Address | `email_change` |

## Apply

```bash
export SUPABASE_ACCESS_TOKEN=sbp_xxx   # https://supabase.com/dashboard/account/tokens
./apply.sh                             # or: ./apply.sh --dry-run
```

`apply.sh` (→ `apply.py`, stdlib only — no jq/curl) PATCHes the four templates +
subjects onto the project via the Management API. Idempotent.

## Also required (Dashboard → Authentication)

- **URL Configuration** → Site URL = `https://www.deciferlearning.com`; Redirect
  URLs include `https://www.deciferlearning.com/auth/confirm`.
- **Emails** → wire custom SMTP to **Resend** to escape the built-in send rate limit.

## Editing

Edit the `.html` files (plain HTML, inline styles — email clients strip `<style>`
and block web fonts). Keep the `{{ .SiteURL }}` / `{{ .TokenHash }}` Go-template
tokens and the `&` (not `&amp;`) query separators, matching Supabase's docs.
Then re-run `apply.sh`.
