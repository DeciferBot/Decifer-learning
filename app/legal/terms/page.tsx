import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms and conditions governing your use of DECIFER Learning, governed by the laws of the United Arab Emirates.',
}

export default function TermsOfServicePage() {
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
        <h1 className="font-heading text-3xl font-bold text-ink">Terms of Service</h1>
        <div className="mt-3 space-y-0.5 text-xs text-muted">
          <p>Effective date: 25 May 2026</p>
          <p>Governing law: Laws of the United Arab Emirates</p>
          <p>Jurisdiction: Courts of Dubai, UAE</p>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          These Terms of Service govern your use of DECIFER Learning, operated by
          DECIFER from Dubai, United Arab Emirates. By creating an account or using
          the service, you agree to these terms in full. If you do not agree, do not
          register or use DECIFER Learning.
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
      <section aria-labelledby="t1">
        <h2 id="t1" className="font-heading text-lg font-bold text-ink">1. Who Can Use DECIFER Learning</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            DECIFER Learning is an educational platform designed for children aged 7
            to 13 who are studying the UK National Curriculum at Year 3 or Year 7 level.
          </p>
          <p>
            To create an account you must be at least 18 years of age and be a parent
            or legal guardian of the child you are enrolling. Children may not register
            independently. By completing registration you confirm that:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>You are 18 years of age or older</li>
            <li>You are the parent or legal guardian of the child whose profile you are creating</li>
            <li>You have the legal authority to accept these terms on behalf of yourself and your child</li>
            <li>All registration information you provide is accurate and current</li>
          </ul>
        </div>
      </section>

      {/* ── Section 2 ───────────────────────────────────────────────── */}
      <section aria-labelledby="t2">
        <h2 id="t2" className="font-heading text-lg font-bold text-ink">2. Account Registration and Security</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            You are responsible for keeping your account credentials confidential. You
            must not share your password with anyone outside your immediate family
            household. Notify us immediately at{' '}
            <a href="mailto:legal@deciferlearning.com" className="text-brand hover:underline">
              legal@deciferlearning.com
            </a>{' '}
            if you suspect any unauthorised access to your account.
          </p>
          <p>
            One parent account may be linked to multiple children within the same family.
            Each family must create its own account. Account sharing between unrelated
            families is not permitted.
          </p>
          <p>
            You are responsible for all activity that takes place under your account,
            including activity by any child using the service through their linked profile.
          </p>
        </div>
      </section>

      {/* ── Section 3 ───────────────────────────────────────────────── */}
      <section aria-labelledby="t3">
        <h2 id="t3" className="font-heading text-lg font-bold text-ink">3. What the Service Provides</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>DECIFER Learning provides:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Guided lessons aligned to the UK National Curriculum for Year 3 and Year 7</li>
            <li>Practice exercises with up to three progressive hint levels and immediate feedback</li>
            <li>Quiz assessments with scoring, accuracy analysis, and mistake review</li>
            <li>A progress dashboard visible to the linked parent or guardian account</li>
            <li>An educational rewards system including XP points, badges, streaks, and Discovery Cards</li>
            <li>AI-assisted content generation and feedback, verified through a six-stage quality pipeline</li>
          </ul>
          <p>
            We reserve the right to update, improve, modify, or remove content and
            features at any time. Where changes are material, we will give advance notice
            as described in Section 14.
          </p>
        </div>
      </section>

      {/* ── Section 4 ───────────────────────────────────────────────── */}
      <section aria-labelledby="t4">
        <h2 id="t4" className="font-heading text-lg font-bold text-ink">4. What DECIFER Learning Is Not</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p className="rounded-xl border border-black/10 bg-surface px-4 py-3 font-medium text-ink">
            Please read this section carefully before enrolling your child.
          </p>
          <p>
            DECIFER Learning is a learning support tool. It is not a school, an
            accredited educational institution, or a substitute for a qualified teacher
            or tutor.
          </p>
          <p>
            We do not issue qualifications, certificates, or grades recognised by
            schools, awarding bodies, examination boards, or any national education
            authority in the UAE, the UK, or elsewhere.
          </p>
          <p>
            We make no guarantee, promise, or representation that use of DECIFER
            Learning will improve your child&apos;s school performance, examination
            results, grades, or any other measured educational outcome. Learning results
            depend on many individual factors beyond our control, including the child&apos;s
            circumstances, the time and consistency of use, and the support provided at
            home and at school.
          </p>
          <p>
            Our content is generated by AI and verified through our automated quality
            pipeline. While we take rigorous steps to ensure accuracy and age
            appropriateness, no automated system is infallible. If you or your child
            find an error in our content, please report it through the Help section
            and we will review it promptly.
          </p>
          <p>
            DECIFER Learning is not a medical, therapeutic, diagnostic, or psychological
            service. It does not assess, identify, screen, or treat any learning
            difficulty, developmental condition, or disability.
          </p>
        </div>
      </section>

      {/* ── Section 5 ───────────────────────────────────────────────── */}
      <section aria-labelledby="t5">
        <h2 id="t5" className="font-heading text-lg font-bold text-ink">5. Parent and Guardian Responsibilities</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>As the adult responsible for the account, you agree to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Supervise your child&apos;s use of the platform in a manner appropriate to their age, maturity, and individual needs</li>
            <li>Ensure your child uses the service in accordance with these terms and the Acceptable Use policy in Section 6</li>
            <li>Keep your registered email address current so we can contact you with important account or safety notices</li>
            <li>Set appropriate time boundaries for your child&apos;s use of the platform, using the parental controls provided</li>
            <li>Review your child&apos;s progress dashboard periodically and engage with their learning where possible</li>
          </ul>
        </div>
      </section>

      {/* ── Section 6 ───────────────────────────────────────────────── */}
      <section aria-labelledby="t6">
        <h2 id="t6" className="font-heading text-lg font-bold text-ink">6. Acceptable Use</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>You and any child using your account must not:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Attempt to gain unauthorised access to any part of the platform, its servers, or its infrastructure</li>
            <li>Probe, scan, or test the security or vulnerability of the service</li>
            <li>Reverse-engineer, decompile, or attempt to extract the source code of the application</li>
            <li>Use automated tools, scripts, or bots to interact with the platform in a way not intended for ordinary users</li>
            <li>Share account credentials with anyone outside your immediate family household</li>
            <li>Interfere with the learning experience of other users</li>
            <li>Use the service in any way that violates applicable UAE federal law or the law of your country of residence</li>
          </ul>
          <p>
            We reserve the right to suspend or terminate any account that violates
            these rules without prior notice where the violation is serious.
          </p>
        </div>
      </section>

      {/* ── Section 7 ───────────────────────────────────────────────── */}
      <section aria-labelledby="t7">
        <h2 id="t7" className="font-heading text-lg font-bold text-ink">7. Intellectual Property</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            All content on DECIFER Learning, including but not limited to lessons,
            questions, explanations, worked examples, visual assets, brand marks, logos,
            software code, and the platform interface, is owned by DECIFER or licensed
            to DECIFER. All rights are reserved.
          </p>
          <p>
            You may not reproduce, copy, distribute, transmit, modify, adapt, or create
            derivative works from our content without our prior written permission.
          </p>
          <p>
            You retain ownership of any data you provide (such as display names and
            customisation choices). By using the service, you grant DECIFER a limited,
            non-exclusive, royalty-free licence to use that data solely to provide,
            operate, and improve the service, consistent with our{' '}
            <Link href="/legal/privacy" className="text-brand hover:underline">
              Privacy Policy
            </Link>.
          </p>
        </div>
      </section>

      {/* ── Section 8 ───────────────────────────────────────────────── */}
      <section aria-labelledby="t8">
        <h2 id="t8" className="font-heading text-lg font-bold text-ink">8. Content Generated by AI</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            Educational content on DECIFER Learning is generated by AI and verified
            through our six-stage automated quality pipeline, which includes
            mathematical verification by code, independent consensus checks, and
            constitutional review for age-appropriateness.
          </p>
          <p>
            While we invest significant effort in quality assurance, AI-generated
            content may occasionally contain errors. We treat the accuracy and safety
            of content seriously and actively monitor for problems. If you or your
            child identifies an error, please use the &quot;Report a problem&quot; feature or
            contact us at{' '}
            <a href="mailto:legal@deciferlearning.com" className="text-brand hover:underline">
              legal@deciferlearning.com
            </a>.
          </p>
        </div>
      </section>

      {/* ── Section 9 ───────────────────────────────────────────────── */}
      <section aria-labelledby="t9">
        <h2 id="t9" className="font-heading text-lg font-bold text-ink">9. Fees and Access</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            DECIFER Learning is currently available to approved users at no charge
            during the beta period. We may introduce paid subscription plans in the
            future. Before any charge applies to your account, we will give you clear
            advance notice and the opportunity to choose whether to continue or cancel
            your account without charge.
          </p>
          <p>
            No payment information is collected at this time. If and when paid plans
            are introduced, payment terms will be set out in a separate fee schedule
            that will form part of these terms at that time.
          </p>
        </div>
      </section>

      {/* ── Section 10 ──────────────────────────────────────────────── */}
      <section aria-labelledby="t10">
        <h2 id="t10" className="font-heading text-lg font-bold text-ink">10. Service Availability</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            We aim to keep DECIFER Learning available continuously, but we do not
            guarantee uninterrupted access. The service may be temporarily unavailable
            due to scheduled maintenance, unplanned outages, or circumstances outside
            our control (including failures of third-party infrastructure providers).
          </p>
          <p>
            Where possible, we will provide advance notice of planned maintenance via
            the platform or by email.
          </p>
        </div>
      </section>

      {/* ── Section 11 ──────────────────────────────────────────────── */}
      <section aria-labelledby="t11">
        <h2 id="t11" className="font-heading text-lg font-bold text-ink">11. Suspension and Termination</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            You may delete your account at any time. Upon deletion, we will remove your
            personal data in accordance with our{' '}
            <Link href="/legal/privacy" className="text-brand hover:underline">
              Privacy Policy
            </Link>.
          </p>
          <p>
            We may suspend or terminate your account if you breach these terms, misuse
            the platform in a way that is harmful to other users or to the service, or
            use the service in violation of applicable UAE law. We will provide notice
            where reasonably practicable before suspending an account, except where
            immediate action is necessary to protect the safety of other users or the
            integrity of the service.
          </p>
        </div>
      </section>

      {/* ── Section 12 ──────────────────────────────────────────────── */}
      <section aria-labelledby="t12">
        <h2 id="t12" className="font-heading text-lg font-bold text-ink">12. Disclaimer of Warranties</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            To the fullest extent permitted by UAE Federal Law No. 15 of 2020 on
            Consumer Protection and other applicable UAE law, DECIFER Learning is
            provided on an &quot;as available&quot; basis. We do not warrant that:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>The service will meet your specific educational requirements</li>
            <li>Content will be completely free from errors at all times</li>
            <li>The service will be uninterrupted, secure, or error-free</li>
            <li>Use of the service will achieve any particular educational outcome for your child</li>
          </ul>
          <p>
            Nothing in this section affects your statutory rights under UAE consumer
            protection law, which cannot be excluded or limited by contract.
          </p>
        </div>
      </section>

      {/* ── Section 13 ──────────────────────────────────────────────── */}
      <section aria-labelledby="t13">
        <h2 id="t13" className="font-heading text-lg font-bold text-ink">13. Limitation of Liability</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            To the fullest extent permitted by applicable UAE law, DECIFER&apos;s total
            liability to you for any claim arising from these terms or from your use of
            the service is limited to the total amount you have paid to DECIFER in the
            12 months preceding the claim. If you have not made any payment, our
            liability is limited to AED 200.
          </p>
          <p>
            We are not liable to you for any indirect, incidental, or consequential
            loss or damage, including but not limited to loss of data, loss of
            educational progress records, or any failure by your child to achieve
            particular academic results.
          </p>
          <p>
            Nothing in these terms limits or excludes our liability for:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Death or personal injury caused by our negligence</li>
            <li>Fraud or fraudulent misrepresentation by DECIFER</li>
            <li>Any liability that cannot be lawfully limited or excluded under UAE law</li>
          </ul>
        </div>
      </section>

      {/* ── Section 14 ──────────────────────────────────────────────── */}
      <section aria-labelledby="t14">
        <h2 id="t14" className="font-heading text-lg font-bold text-ink">14. Governing Law and Dispute Resolution</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            These terms are governed by the federal laws of the United Arab Emirates,
            as applicable in the Emirate of Dubai. Any dispute arising out of or in
            connection with these terms or your use of DECIFER Learning that cannot
            be resolved by direct negotiation with us shall be submitted to the
            exclusive jurisdiction of the competent courts of Dubai, UAE.
          </p>
          <p>
            Before initiating any formal legal proceeding, we encourage you to contact
            us at{' '}
            <a href="mailto:legal@deciferlearning.com" className="text-brand hover:underline">
              legal@deciferlearning.com
            </a>{' '}
            so we can attempt to resolve the matter informally. Most concerns can be
            addressed quickly and without formal proceedings.
          </p>
        </div>
      </section>

      {/* ── Section 15 ──────────────────────────────────────────────── */}
      <section aria-labelledby="t15">
        <h2 id="t15" className="font-heading text-lg font-bold text-ink">15. Language</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            These terms are provided in English. Where required by applicable UAE law
            in a specific context, an Arabic version will be made available on request.
            In the event of any conflict between the English and Arabic texts, the
            Arabic text will prevail to the extent required by UAE law.
          </p>
        </div>
      </section>

      {/* ── Section 16 ──────────────────────────────────────────────── */}
      <section aria-labelledby="t16">
        <h2 id="t16" className="font-heading text-lg font-bold text-ink">16. Changes to These Terms</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            We may update these terms from time to time. When we make a material change,
            we will notify you by email or by a notice on the platform at least 14 days
            before the change takes effect. Your continued use of DECIFER Learning after
            that date means you accept the revised terms.
          </p>
          <p>
            If you do not accept a revised version of the terms, you must stop using
            the service before the change takes effect and may delete your account
            without charge.
          </p>
        </div>
      </section>

      {/* ── Section 17 ──────────────────────────────────────────────── */}
      <section aria-labelledby="t17">
        <h2 id="t17" className="font-heading text-lg font-bold text-ink">17. Contact Us</h2>
        <div className="mt-3 text-sm leading-relaxed text-muted">
          <p>For questions about these terms or how we operate the service:</p>
          <ul className="mt-2 space-y-1 pl-1">
            <li>
              <span className="font-medium text-ink">Email:</span>{' '}
              <a href="mailto:legal@deciferlearning.com" className="text-brand hover:underline">
                legal@deciferlearning.com
              </a>
            </li>
            <li>
              <span className="font-medium text-ink">Website:</span>{' '}
              www.deciferlearning.com
            </li>
            <li>
              <span className="font-medium text-ink">Address:</span>{' '}
              DECIFER, Dubai, United Arab Emirates
            </li>
          </ul>
        </div>
      </section>

      {/* ── Cross-links box ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-brand/20 bg-brand-50 px-5 py-5">
        <p className="font-heading font-semibold text-ink">Related documents</p>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>
            <Link href="/legal/privacy" className="text-brand hover:underline">
              Privacy Policy
            </Link>
            {': '}how we collect and protect your personal data under UAE PDPL
          </li>
          <li>
            <Link href="/help/content-quality" className="text-brand hover:underline">
              Content Quality
            </Link>
            {': '}how every question is verified before your child sees it
          </li>
          <li>
            <Link href="/help/parent-guide" className="text-brand hover:underline">
              Parent Guide
            </Link>
            {': '}how to set up and use the platform for your family
          </li>
        </ul>
      </div>

    </div>
  )
}
