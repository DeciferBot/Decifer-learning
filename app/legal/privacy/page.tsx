import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How DECIFER Learning collects, uses, and protects your personal data under UAE Federal Decree-Law No. 45 of 2021.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-10">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/"
          className="mb-4 inline-block text-sm font-semibold text-brand hover:underline"
        >
          ← Back to home
        </Link>
        <h1 className="font-heading text-3xl font-bold text-ink">Privacy Policy</h1>
        <div className="mt-3 space-y-0.5 text-xs text-muted">
          <p>Effective date: 25 May 2026</p>
          <p>Last reviewed: 25 May 2026</p>
          <p>Governing framework: UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (UAE PDPL)</p>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          DECIFER Learning is operated by DECIFER, based in Dubai, United Arab Emirates.
          This policy explains what personal data we collect when you use{' '}
          <span className="font-medium text-ink">www.deciferlearning.com</span>, why
          we collect it, who we share it with, and the rights you have under UAE law.
        </p>
        <p className="mt-3 rounded-xl border border-brand/20 bg-brand-50 px-4 py-3 text-sm text-muted">
          Questions? Contact us at{' '}
          <a
            href="mailto:legal@deciferlearning.com"
            className="font-semibold text-brand hover:underline"
          >
            legal@deciferlearning.com
          </a>
          {' '}before using the service if anything here is unclear.
        </p>
      </div>

      {/* ── Section 1 ───────────────────────────────────────────────── */}
      <section aria-labelledby="s1">
        <h2 id="s1" className="font-heading text-lg font-bold text-ink">1. Who We Are</h2>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          <p>
            <span className="font-semibold text-ink">Data Controller:</span>{' '}
            DECIFER
          </p>
          <p>
            <span className="font-semibold text-ink">Product:</span>{' '}
            DECIFER Learning (www.deciferlearning.com)
          </p>
          <p>
            <span className="font-semibold text-ink">Registered location:</span>{' '}
            Dubai, United Arab Emirates
          </p>
          <p>
            <span className="font-semibold text-ink">Contact for privacy matters:</span>{' '}
            <a
              href="mailto:legal@deciferlearning.com"
              className="text-brand hover:underline"
            >
              legal@deciferlearning.com
            </a>
          </p>
          <p>
            As Data Controller, DECIFER determines the purposes and means of processing
            your personal data. Where we use third-party services to process data on
            our behalf, those services act as Data Processors under our instruction.
          </p>
        </div>
      </section>

      {/* ── Section 2 ───────────────────────────────────────────────── */}
      <section aria-labelledby="s2">
        <h2 id="s2" className="font-heading text-lg font-bold text-ink">2. What Personal Data We Collect</h2>
        <div className="mt-3 space-y-5 text-sm leading-relaxed text-muted">

          <div>
            <p className="font-semibold text-ink">Parent and guardian account data</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Email address</li>
              <li>Display name</li>
              <li>Password (stored as a one-way cryptographic hash; we never store or see your plain-text password)</li>
              <li>Role selection (parent or guardian)</li>
              <li>Account creation date and last login date</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-ink">Child profile data</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Display name (a chosen nickname, not a legal name)</li>
              <li>Year group (Year 3 or Year 7)</li>
              <li>Avatar configuration (cosmetic choices only; no photographs)</li>
              <li>Theme and study buddy preferences</li>
              <li>Accessibility settings</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-ink">Learning activity data</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Topics studied and lesson pages visited</li>
              <li>Practice exercise sessions completed</li>
              <li>Quiz attempt records: scores, individual answers, hints used, time taken</li>
              <li>Topic completion status and mastery level</li>
              <li>Daily login dates and streak length</li>
              <li>XP points earned, badges awarded, and Discovery Cards collected</li>
              <li>Spaced-repetition review schedule</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-ink">Technical and device data</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>IP address (collected by our hosting provider; used for security)</li>
              <li>Browser type and version</li>
              <li>Device type (desktop, tablet, or phone)</li>
              <li>Session identifiers and authentication tokens</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-ink">Analytics data (where enabled)</p>
            <p className="mt-1">
              If Google Analytics is active for your session, anonymised usage patterns
              (pages visited, session duration) are collected by Google LLC. We use this
              only to understand how the platform is used in aggregate. You can prevent
              this via your browser settings or an ad blocker.
            </p>
          </div>

        </div>
      </section>

      {/* ── Section 3 ───────────────────────────────────────────────── */}
      <section aria-labelledby="s3">
        <h2 id="s3" className="font-heading text-lg font-bold text-ink">3. Why We Collect It and Our Legal Basis</h2>
        <div className="mt-3 space-y-4 text-sm leading-relaxed text-muted">
          <p>
            Under Article 4 of the UAE PDPL, we process personal data only where we
            have a recognised lawful basis. The bases we rely on are set out below.
          </p>

          <div>
            <p className="font-semibold text-ink">Performance of a contract</p>
            <p className="mt-1">
              We need certain data to provide the service you have registered for:
              creating and managing accounts, linking parent accounts to child profiles,
              delivering lessons and quizzes, recording progress so parents can view it,
              and operating the rewards system.
            </p>
          </div>

          <div>
            <p className="font-semibold text-ink">Legitimate interest</p>
            <p className="mt-1">
              We use aggregated, de-identified learning data to improve the quality and
              relevance of our educational content. We also process technical data to
              detect and prevent fraudulent or abusive access to the platform and to
              maintain the security and stability of the service.
            </p>
          </div>

          <div>
            <p className="font-semibold text-ink">Legal obligation</p>
            <p className="mt-1">
              We may process and retain data where required by UAE federal law, including
              anti-fraud, record-keeping, and child safety obligations.
            </p>
          </div>

          <div>
            <p className="font-semibold text-ink">Consent</p>
            <p className="mt-1">
              Where we send service announcements or product updates by email, we do so
              on the basis of your consent given during registration. You may withdraw
              consent at any time by contacting us at legal@deciferlearning.com.
              Withdrawing consent does not affect the lawfulness of any processing
              carried out before withdrawal.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 4 ───────────────────────────────────────────────── */}
      <section aria-labelledby="s4">
        <h2 id="s4" className="font-heading text-lg font-bold text-ink">4. Children&apos;s Privacy</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            DECIFER Learning is designed for children aged 7 to 13 studying the UK
            National Curriculum at Year 3 or Year 7 level. Children do not register
            directly. Parents and guardians create the parent account, then enrol their
            child by creating a linked child profile.
          </p>
          <p>
            Under Article 8 of the UAE PDPL, processing personal data relating to a
            person under 18 years of age requires the consent of a parent or legal
            guardian. By creating a child profile on DECIFER Learning, you confirm that
            you are the parent or legal guardian of that child and you give your explicit
            consent to the collection and use of that child&apos;s data as described in
            this policy.
          </p>
          <p>
            We apply data minimisation to child profiles. We do not collect:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Real photographs or biometric data of children</li>
            <li>Full legal names (a display name or nickname is sufficient)</li>
            <li>Medical, health, or diagnostic information</li>
            <li>Social media usernames, phone numbers, or contact details for children</li>
            <li>Location data beyond country-level (inferred from IP for fraud prevention)</li>
          </ul>
          <p>
            If you believe a child account has been created without proper parental
            consent, contact us immediately at legal@deciferlearning.com and we will
            delete the profile.
          </p>
        </div>
      </section>

      {/* ── Section 5 ───────────────────────────────────────────────── */}
      <section aria-labelledby="s5">
        <h2 id="s5" className="font-heading text-lg font-bold text-ink">5. How Long We Keep Your Data</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-medium text-ink">Active accounts:</span>{' '}
              personal data is retained while the account remains active.
            </li>
            <li>
              <span className="font-medium text-ink">Deleted accounts:</span>{' '}
              all personal data associated with a deleted account is permanently removed
              within 30 calendar days of a verified deletion request, except where
              retention is required by UAE law (for example, transaction records if
              applicable).
            </li>
            <li>
              <span className="font-medium text-ink">Anonymised aggregate statistics:</span>{' '}
              usage data that has been fully de-identified (no link back to any individual)
              may be retained indefinitely for product research and improvement.
            </li>
          </ul>
        </div>
      </section>

      {/* ── Section 6 ───────────────────────────────────────────────── */}
      <section aria-labelledby="s6">
        <h2 id="s6" className="font-heading text-lg font-bold text-ink">6. Who We Share Data With</h2>
        <div className="mt-3 space-y-4 text-sm leading-relaxed text-muted">
          <p>
            We do not sell personal data. We do not share personal data with advertisers
            or data brokers. We share data only with the following service providers
            acting as Data Processors under our written instruction:
          </p>

          <div className="space-y-4">
            <div className="rounded-xl border border-black/5 bg-surface p-4">
              <p className="font-semibold text-ink">Supabase (database and authentication)</p>
              <p className="mt-1 text-xs text-muted">
                Supabase, Inc. operates our database and authentication infrastructure on
                Amazon Web Services. All account data, child profiles, and learning
                activity records are stored in Supabase databases. Supabase processes
                your data only to provide and maintain the platform.
              </p>
            </div>

            <div className="rounded-xl border border-black/5 bg-surface p-4">
              <p className="font-semibold text-ink">Vercel (web hosting and delivery)</p>
              <p className="mt-1 text-xs text-muted">
                Vercel, Inc. serves the DECIFER Learning web application globally.
                Vercel may process technical request data (IP address, browser
                information) as part of normal web hosting operations and DDoS protection.
              </p>
            </div>

            <div className="rounded-xl border border-black/5 bg-surface p-4">
              <p className="font-semibold text-ink">Google Analytics (optional, anonymised)</p>
              <p className="mt-1 text-xs text-muted">
                Where Google Analytics is active for your session, Google LLC may
                process anonymised usage data. We use this only for aggregate product
                analytics. No personally identifiable information is sent to Google
                Analytics. You can opt out via your browser settings or a browser
                extension.
              </p>
            </div>

            <div className="rounded-xl border border-black/5 bg-surface p-4">
              <p className="font-semibold text-ink">Anthropic and OpenAI (content pipeline only)</p>
              <p className="mt-1 text-xs text-muted">
                These providers are used exclusively by our automated content generation
                pipeline to create and verify educational content. They do not receive
                personal data about individual users, child profiles, or learning
                activity records. User data and content generation are strictly
                separated systems.
              </p>
            </div>
          </div>

          <p>
            We require all processors to maintain appropriate technical and
            organisational security measures and to process personal data only as
            instructed and in accordance with applicable law.
          </p>
        </div>
      </section>

      {/* ── Section 7 ───────────────────────────────────────────────── */}
      <section aria-labelledby="s7">
        <h2 id="s7" className="font-heading text-lg font-bold text-ink">7. International Data Transfers</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            DECIFER is based in the United Arab Emirates. Our service providers
            (Supabase and Vercel) operate infrastructure primarily in the United States
            and European Union. When your personal data is transferred outside the UAE,
            we ensure appropriate protections are in place under Article 22 of the UAE
            PDPL through:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Data processing agreements with our processors that incorporate appropriate contractual safeguards</li>
            <li>Your informed consent, provided when you register for DECIFER Learning and accept this policy</li>
          </ul>
          <p>
            If you would like more detail about the safeguards in place for a specific
            transfer, contact us at legal@deciferlearning.com.
          </p>
        </div>
      </section>

      {/* ── Section 8 ───────────────────────────────────────────────── */}
      <section aria-labelledby="s8">
        <h2 id="s8" className="font-heading text-lg font-bold text-ink">8. Your Rights Under the UAE PDPL</h2>
        <div className="mt-3 space-y-4 text-sm leading-relaxed text-muted">
          <p>
            Under Articles 14 to 20 of the UAE Federal Decree-Law No. 45 of 2021, you
            have the following rights regarding your personal data and the personal data
            of any child you have registered:
          </p>
          <div className="space-y-3">
            {[
              {
                right: 'Right to access',
                desc: 'Request a copy of the personal data we hold about you or your child, including a description of how it is used.',
              },
              {
                right: 'Right to rectification',
                desc: 'Request that we correct any personal data that is inaccurate, incomplete, or out of date.',
              },
              {
                right: 'Right to erasure',
                desc: 'Request that we delete your account and all associated personal data. We will action this within 30 days, subject to any retention required by UAE law.',
              },
              {
                right: 'Right to data portability',
                desc: 'Request a copy of your learning data in a structured, commonly used electronic format so you can transfer it if you choose.',
              },
              {
                right: 'Right to restrict processing',
                desc: 'Request that we limit how we use your data in circumstances where you contest its accuracy or object to our processing.',
              },
              {
                right: 'Right to object',
                desc: 'Object to processing based on our legitimate interest. We will stop unless we can demonstrate compelling grounds that override your interests.',
              },
              {
                right: 'Right to withdraw consent',
                desc: 'Where processing is based on your consent (such as marketing emails), you may withdraw at any time without affecting the lawfulness of prior processing.',
              },
            ].map((item) => (
              <div key={item.right} className="rounded-xl border border-black/5 bg-surface px-4 py-3">
                <p className="font-semibold text-ink">{item.right}</p>
                <p className="mt-0.5 text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
          <p>
            To exercise any of these rights, email us at{' '}
            <a href="mailto:legal@deciferlearning.com" className="text-brand hover:underline">
              legal@deciferlearning.com
            </a>{' '}
            with the subject line &quot;Data rights request&quot;. We will respond within
            30 calendar days. We may need to verify your identity before actioning
            the request.
          </p>
        </div>
      </section>

      {/* ── Section 9 ───────────────────────────────────────────────── */}
      <section aria-labelledby="s9">
        <h2 id="s9" className="font-heading text-lg font-bold text-ink">9. Cookies</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>We use cookies and similar technologies in the following categories:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="font-medium text-ink">Essential session cookies:</span>{' '}
              required to keep you signed in and to maintain your session securely.
              These cannot be disabled while you are using the service.
            </li>
            <li>
              <span className="font-medium text-ink">Preference cookies:</span>{' '}
              used to remember your theme, language, and accessibility settings
              across sessions.
            </li>
            <li>
              <span className="font-medium text-ink">Analytics cookies (optional):</span>{' '}
              set by Google Analytics if enabled. You can prevent these by adjusting
              your browser cookie settings or using a browser extension.
            </li>
          </ul>
        </div>
      </section>

      {/* ── Section 10 ──────────────────────────────────────────────── */}
      <section aria-labelledby="s10">
        <h2 id="s10" className="font-heading text-lg font-bold text-ink">10. Security</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            We implement technical and organisational measures to protect personal data,
            proportionate to the sensitivity of the information and the risks involved.
            These include:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Encrypted transmission of all data using HTTPS and TLS</li>
            <li>One-way password hashing using industry-standard algorithms</li>
            <li>Role-based access controls limiting which systems and personnel can access personal data</li>
            <li>Regular reviews of our infrastructure security posture</li>
            <li>Separation between user data and AI content generation pipelines</li>
          </ul>
          <p>
            No internet-based service can guarantee absolute security. If you believe
            your account has been compromised or you suspect a security incident, contact
            us immediately at{' '}
            <a href="mailto:legal@deciferlearning.com" className="text-brand hover:underline">
              legal@deciferlearning.com
            </a>.
          </p>
          <p>
            In the event of a personal data breach that is likely to result in risk to
            your rights and interests, we will notify the relevant UAE supervisory
            authority and, where required, affected individuals in accordance with
            Article 28 of the UAE PDPL.
          </p>
        </div>
      </section>

      {/* ── Section 11 ──────────────────────────────────────────────── */}
      <section aria-labelledby="s11">
        <h2 id="s11" className="font-heading text-lg font-bold text-ink">11. Changes to This Policy</h2>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          <p>
            We may update this policy from time to time to reflect changes in the
            service, applicable law, or our data practices. When we make a material
            change, we will notify you by email (to the address on your account) or by
            a prominent notice on the platform at least 14 days before the change takes
            effect. The &quot;Last reviewed&quot; date at the top of this page will always show
            when the policy was most recently updated.
          </p>
          <p>
            Continued use of DECIFER Learning after the effective date of any updated
            policy constitutes your acceptance of the revised terms.
          </p>
        </div>
      </section>

      {/* ── Section 12 ──────────────────────────────────────────────── */}
      <section aria-labelledby="s12">
        <h2 id="s12" className="font-heading text-lg font-bold text-ink">12. Complaints and Supervisory Authority</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            If you believe we have handled your personal data in a way that is
            inconsistent with this policy or with applicable law, please contact us
            first at{' '}
            <a href="mailto:legal@deciferlearning.com" className="text-brand hover:underline">
              legal@deciferlearning.com
            </a>.
            We will do our best to resolve the matter promptly.
          </p>
          <p>
            You also have the right to file a complaint with the UAE Data Protection
            Office (under the Ministry of Digital Economy and Remote Work) if you believe
            your rights under the UAE PDPL have not been upheld after contacting us.
          </p>
        </div>
      </section>

      {/* ── Contact box ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-brand/20 bg-brand-50 px-5 py-5">
        <p className="font-heading font-semibold text-ink">Contact us about this policy</p>
        <p className="mt-1 text-sm text-muted">
          Email:{' '}
          <a
            href="mailto:legal@deciferlearning.com"
            className="font-semibold text-brand hover:underline"
          >
            legal@deciferlearning.com
          </a>
        </p>
        <p className="mt-0.5 text-sm text-muted">
          Address: DECIFER, Dubai, United Arab Emirates
        </p>
        <p className="mt-3 text-xs text-muted">
          Also see our{' '}
          <Link href="/legal/terms" className="text-brand hover:underline">Terms of Service</Link>
          {' '}and our{' '}
          <Link href="/help" className="text-brand hover:underline">Help guides</Link>.
        </p>
      </div>

    </div>
  )
}
