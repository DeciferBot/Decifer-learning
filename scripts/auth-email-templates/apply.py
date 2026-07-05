#!/usr/bin/env python3
"""Apply Decifer Learning's branded auth email templates via the Supabase
Management API. Invoked by apply.sh; see that file's header for context.

Switches reset / magic-link / signup / email-change emails to the cross-browser
token_hash flow that lands on /auth/confirm (see lib/auth/verify-email-link.ts).

Uses only the Python standard library — no jq, curl, or third-party deps.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "dgghipmzvqipssavdvbq")  # Decifer Learning (prod)

# api.supabase.com sits behind Cloudflare bot management, which blocks the
# default "Python-urllib/x.y" user-agent with HTTP 403 (error 1010). Send a
# curl-style UA so the request is allowed through.
USER_AGENT = "curl/8.4.0"

# (template file, subject field, content field, subject line)
TEMPLATES = [
    ("recovery.html",     "mailer_subjects_recovery",     "mailer_templates_recovery_content",     "Reset your Decifer Learning password"),
    ("magic_link.html",   "mailer_subjects_magic_link",   "mailer_templates_magic_link_content",   "Your Decifer Learning sign-in link"),
    ("confirmation.html", "mailer_subjects_confirmation", "mailer_templates_confirmation_content", "Confirm your email for Decifer Learning"),
    ("email_change.html", "mailer_subjects_email_change", "mailer_templates_email_change_content", "Confirm your new email for Decifer Learning"),
]


def build_payload() -> dict:
    payload: dict[str, str] = {}
    for filename, subject_key, content_key, subject in TEMPLATES:
        path = os.path.join(DIR, filename)
        try:
            with open(path, encoding="utf-8") as fh:
                html = fh.read()
        except FileNotFoundError:
            sys.exit(f"Missing template file: {path}")
        if "{{ .TokenHash }}" not in html or "/auth/confirm" not in html:
            sys.exit(f"Template {filename} is missing the token_hash /auth/confirm link — refusing to apply.")
        payload[subject_key] = subject
        payload[content_key] = html
    return payload


def main() -> None:
    dry_run = "--dry-run" in sys.argv[1:]
    payload = build_payload()

    if dry_run:
        print(json.dumps(payload, indent=2))
        print("\n(dry run — nothing sent)", file=sys.stderr)
        return

    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        sys.exit(
            "Set SUPABASE_ACCESS_TOKEN (Personal Access Token, sbp_...) first.\n"
            "Create one at https://supabase.com/dashboard/account/tokens"
        )

    url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="PATCH",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
    )

    print(f"→ Applying auth email templates to project {PROJECT_REF} ...")
    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")
        sys.exit(f"✗ Management API returned HTTP {err.code}:\n{detail}")
    except urllib.error.URLError as err:
        sys.exit(f"✗ Could not reach the Management API: {err.reason}")

    print("✓ Updated. Subjects now set:")
    for _, subject_key, _, _ in TEMPLATES:
        print(f"    {subject_key}: {body.get(subject_key)!r}")

    print(
        "\nStill confirm in the Dashboard (Authentication → URL Configuration):\n"
        "  • Site URL       = https://www.deciferlearning.com\n"
        "  • Redirect URLs   include https://www.deciferlearning.com/auth/confirm\n"
        "Recommended (Authentication → Emails):\n"
        "  • Custom SMTP     → Resend, to escape the built-in send rate limit."
    )


if __name__ == "__main__":
    main()
