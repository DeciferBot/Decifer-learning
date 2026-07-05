#!/usr/bin/env bash
#
# Applies Decifer Learning's branded auth email templates to Supabase via the
# Management API. These switch the reset / magic-link / signup / email-change
# emails from the PKCE {{ .ConfirmationURL }} flow (which only works in the same
# browser that requested the link — the "expired on first click" bug) to the
# cross-browser-safe token_hash flow that lands on /auth/confirm.
# See lib/auth/verify-email-link.ts for the full rationale.
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_xxx     # Personal Access Token — create at
#                                            # https://supabase.com/dashboard/account/tokens
#   ./scripts/auth-email-templates/apply.sh              # apply
#   ./scripts/auth-email-templates/apply.sh --dry-run    # print payload, don't send
#
# Optional overrides:
#   SUPABASE_PROJECT_REF   defaults to the Decifer Learning project ref below.
#
# Requires: python3 (bundled on macOS; no jq/curl needed). Idempotent.

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$DIR/apply.py" "$@"
