import type { Guide } from '../types'

export const dubaiSchoolFeeRules: Guide = {
  slug: 'dubai-school-fee-rules',
  title: 'Dubai School Fees: Deposits, Refunds and Unpaid Fees',
  h1: 'What your school can charge, keep, and do about unpaid fees',
  description:
    'KHDA caps what a Dubai private school may charge you up front, sets the deadlines that decide whether a deposit comes back, and limits what a school may do when fees go unpaid. Most of it is written down in one policy that almost no parent has read.',
  metaDescription:
    'KHDA’s rules on Dubai school deposits, refunds and unpaid fees: the caps, the 60-day deadline, and the limits on what a school may do about arrears.',
  keyAnswer:
    'A Dubai school may charge up to AED 500 to process an application, a registration deposit of up to 10% of annual tuition, and a re-registration deposit of up to 5% of annual tuition or AED 500, whichever is higher. Deposits are refundable only if you give formal notice at least 60 calendar days before the start date. On unpaid fees, a school may take no formal action until at least 30 calendar days after the due date and only after completing six documented steps, and it may suspend a child for a maximum of three consecutive school days per term.',
  category: 'schools-and-fees',
  datePublished: '2026-08-21',
  dateModified: '2026-08-21',
  blocks: [
    {
      kind: 'p',
      html: 'Most fee disputes between parents and Dubai schools are not really disputes about money. They are disputes about a rule one side knows and the other does not. KHDA publishes a <strong>Registration and Refund Policy for all Dubai Private Schools</strong>, most recently issued in May 2026, and it settles far more of these arguments than parents realise. This guide is what it says, in plain English, with the parts that matter most to you first.',
    },
    {
      kind: 'p',
      html: 'One boundary before we start: this is Dubai and KHDA only. Abu Dhabi private schools are regulated by ADEK under different rules, and nothing below can be relied on there.',
    },

    { kind: 'h2', id: 'the-caps', text: 'What a school may charge before your child starts' },
    {
      kind: 'p',
      html: 'Three separate payments can land before a child sits in a classroom, and each has its own cap. They are not interchangeable, and two of the three are advance payments against tuition rather than extra cost.',
    },
    {
      kind: 'table',
      caption: 'KHDA caps on up-front charges, Dubai private schools',
      headers: ['Charge', 'Maximum', 'Comes off your tuition?'],
      rows: [
        ['Application fee', 'AED 500', 'No. Explicitly not deductible'],
        ['Registration deposit', '10% of annual tuition', 'Yes, against the term of enrolment'],
        ['Re-registration deposit', '5% of annual tuition or AED 500, whichever is higher', 'Yes, against the following year'],
      ],
    },
    {
      kind: 'callout',
      title: 'The re-registration cap is widely reported backwards',
      html: 'Several UAE news write-ups state the re-registration deposit is capped at 5% of tuition or AED 500, <em>whichever is lower</em>. It is <strong>whichever is higher</strong>, in both KHDA’s policy document and its parent FAQ. The difference is not academic: at a school charging AED 60,000, the cap is AED 3,000, not AED 500. If you are checking a figure against a news article, check it against KHDA instead.',
    },
    {
      kind: 'list',
      items: [
        'The application fee covers assessment and admin. It is refundable if your child is not offered a place after assessment, or if the school took it without first telling you no place was available or that your child would be waitlisted. It is not refundable if the school makes a formal offer and you turn it down.',
        'A registration deposit may only be requested <strong>after</strong> a formal offer has been issued and you have accepted it. A school asking for a deposit before it has offered your child a place is not following the policy.',
        'Beyond the registration or re-registration deposit, a school cannot ask for any additional payment to secure or hold a place.',
      ],
    },

    { kind: 'h2', id: 'sixty-days', text: 'The 60-day rule that decides whether a deposit comes back' },
    {
      kind: 'p',
      html: 'This is the single most expensive detail on the page. Both the registration and the re-registration deposit are refundable <strong>only if you formally notify the school at least 60 calendar days before the start date</strong>. Give notice on day 59 and the deposit is gone. Calendar days, not school days, and the clock runs to the start of the academic year in question.',
    },
    {
      kind: 'p',
      html: 'Two timing rules sit alongside it. Schools starting in September may only collect the re-registration deposit after the spring break, with a deadline no earlier than 1 May. Schools starting in April may only collect after the winter break, with a deadline no earlier than 1 February. And if you simply do not pay it by the deadline and your child does not enrol the following year, <strong>the school cannot come after you for that deposit later</strong>. It loses the right to it, though it also stops guaranteeing the place.',
    },
    {
      kind: 'p',
      html: 'A school also needs KHDA approval before it may refuse to re-register a student. That is not a decision it can make alone.',
    },

    { kind: 'h2', id: 'refunds', text: 'Leaving mid-year: how the refund is actually calculated' },
    {
      kind: 'p',
      html: 'Refunds are worked out term by term, from the withdrawal date recorded on the Withdrawal Certificate, which is the date you specified in your withdrawal request. The tiers are blunt:',
    },
    {
      kind: 'table',
      caption: 'Tuition refund on withdrawal, by time enrolled in the term',
      headers: ['Time enrolled in that term', 'What the school keeps'],
      rows: [
        ['Withdrew before the academic year began', 'Nothing, apart from the deposit if you gave less than 60 days’ notice'],
        ['Two weeks or less', 'One month’s fees'],
        ['More than two weeks, up to one month', 'Two months’ fees'],
        ['More than one month', 'The full term’s fees'],
      ],
    },
    {
      kind: 'callout',
      title: 'Absence is not withdrawal, and this catches families out',
      html: 'Being on the school register counts as active enrolment <strong>regardless of whether your child attends</strong>. If you leave the country in November and submit the withdrawal request in February, the refund is calculated to February. Stopping attendance does nothing. Submit the withdrawal request the moment you know, because the request date is what counts and it cannot be backdated.',
    },
    {
      kind: 'p',
      html: 'On the extras: mandatory service fees paid before the year starts are refundable. Optional services such as transport, trips and activities follow the terms you agreed at the time, and are refundable before the year starts provided no binding third-party contract is in place. Book fees are refundable only if your child leaves before the academic year begins.',
    },
    {
      kind: 'p',
      html: 'One more constraint worth knowing when you budget: tuition can be collected in no more than three termly instalments, and the first cannot exceed 40% of the annual fee, with the second and third capped at 30% each. Schools may instead offer ten equal monthly instalments. For what all of this adds up to across a year, see <a href="/guides/true-cost-uae-school-year">what a UAE school year actually costs</a>.',
    },

    { kind: 'h2', id: 'unpaid-fees', text: 'If you fall behind: what a school may and may not do' },
    {
      kind: 'p',
      html: 'This is the half of the policy that is almost never written about, and it is the half that matters most if money gets tight. The short version: a school cannot move quickly, cannot do more than one thing to you, and cannot involve your child.',
    },
    {
      kind: 'p',
      html: '<strong>No formal consequence may be applied until at least 30 calendar days have passed from the original due date</strong>, and only after the school has completed and documented all six of these steps:',
    },
    {
      kind: 'list',
      ordered: true,
      items: [
        'A first written reminder after the due date has passed.',
        'A second written reminder if payment is still outstanding.',
        'Direct follow-up contact by phone or another agreed channel.',
        'An offer to meet the school to discuss the outstanding fees.',
        'Where you cannot pay in full immediately, consideration of a reasonable written payment plan setting out the amount, the dates, and what happens if it is not followed.',
        'A final written notice before any consequence is applied.',
      ],
    },
    {
      kind: 'p',
      html: 'That final notice must state the amount outstanding, what the school has already done, the proposed next step, the date it may take effect, and your option to contact the school or refer the matter to KHDA. A notice missing those elements has not met the requirement.',
    },
    { kind: 'h3', text: 'The limits on what can then happen' },
    {
      kind: 'list',
      items: [
        '<strong>Only one formal consequence</strong> may be applied, and it must already be stated in your Parent-School Contract. The options are withholding the Withdrawal or Transfer Certificate, not re-registering your child for the following year, or temporary suspension from learning.',
        '<strong>Refusing to re-register requires KHDA approval.</strong> A school cannot simply decide it.',
        '<strong>Suspension is a last resort and capped at three consecutive school days per term</strong>, excluding examination days, and only after final written notice.',
        '<strong>If a payment plan is agreed and you are keeping to it, no consequence may be applied at all</strong>, suspension included. Getting a plan in writing is the strongest protective step available to you.',
        'Throughout the process your child <strong>must continue to access learning as normal</strong>, and must not be refused entry, removed from class, isolated, embarrassed or treated differently.',
        'All fee communication must go to the parent or guardian <strong>only</strong>. Not through the student, not in front of the student or the class.',
      ],
    },
    {
      kind: 'p',
      html: 'The genuine leverage a school holds is the Transfer Certificate. It may be withheld until approved fees are paid in full, and without it your child cannot register at another private school anywhere in the UAE, not just in Dubai. Reports and certificates may also be withheld where fees are unpaid at the end of a term or year, again unless an agreed payment plan is being followed.',
    },

    { kind: 'h2', id: 'escalating', text: 'Escalating a dispute to KHDA' },
    {
      kind: 'p',
      html: 'KHDA will not take a case that has not been through the school first. The policy requires that <strong>all internal resolution steps are completed and documented</strong> before a matter is referred. Once the school’s internal process is exhausted, either side may refer it, and KHDA may ask both parties for documentary evidence.',
    },
    {
      kind: 'p',
      html: 'Practically, that means keeping everything in writing from the first conversation. Email rather than phone, ask for decisions in writing, and keep the school’s reminders and notices. If you reach KHDA with a folder and the school reaches it with a recollection, that asymmetry works in your favour.',
    },
    {
      kind: 'callout',
      title: 'How to reach KHDA',
      html: 'Complaints go through KHDA’s <a href="https://web.khda.gov.ae/en/khdafeedback" rel="nofollow">e-feedback service</a>. The toll-free line is 800 KHDA (800 5432) and general enquiries go to info@khda.gov.ae. Your Parent-School Contract, which every Dubai school must have you sign, is the document a review will be measured against, so read it before you write.',
    },
    {
      kind: 'p',
      html: 'One thing not to expect: fees stay payable while a complaint is being reviewed. Withholding payment to force the issue weakens your position rather than strengthening it. The same applies to distance learning, where schools delivering an approved programme are not required to discount tuition, and choosing not to take part is not grounds for non-payment.',
    },

    { kind: 'h2', id: 'closure', text: 'When the school cannot deliver at all' },
    {
      kind: 'p',
      html: 'If a school suspends services for reasons within its own control, tuition remains payable for any period it did deliver, including by approved distance learning, and it must compensate you for the period it did not, by fee credit, replacement sessions or a prorated refund, agreed in writing.',
    },
    {
      kind: 'p',
      html: 'Under a government-enforced closure the principle is the same: fees are payable for each day the service was available and delivered, and from the day the school cannot deliver, they are not. The remedy is a credit note, a transfer of the credit to a sibling at the same school, or a full refund. Which of the three is used has to be agreed in writing, not simply chosen by the school.',
    },

    { kind: 'cta' },

    {
      kind: 'faq',
      items: [
        {
          q: 'How much can a Dubai school charge as a registration deposit?',
          a: 'Up to 10% of the annual tuition fee, and only after it has made a formal offer that you have accepted. It is deducted from tuition for the term of enrolment, so it is an advance payment rather than an extra charge.',
        },
        {
          q: 'Is my school deposit refundable if I change my mind?',
          a: 'Yes, if you formally notify the school at least 60 calendar days before the start date. Less than 60 calendar days and both the registration and re-registration deposits are non-refundable.',
        },
        {
          q: 'Can my child be suspended for unpaid school fees in Dubai?',
          a: 'Only as a last resort, only after at least 30 calendar days from the due date and six documented steps including a final written notice, and only for a maximum of three consecutive school days per term, excluding exam days. If you have an agreed payment plan and are keeping to it, your child cannot be suspended at all.',
        },
        {
          q: 'Can a school refuse to release my child’s transfer certificate?',
          a: 'Yes, until all outstanding approved fees are paid in full. This is the school’s strongest sanction, because the certificate is required to register at any other private school in Dubai or elsewhere in the UAE.',
        },
        {
          q: 'I stopped sending my child in. Does that stop the fees?',
          a: 'No. Being on the register counts as enrolment regardless of attendance, and the refund is calculated from the withdrawal date on the Withdrawal Certificate. Submit a formal withdrawal request as early as possible, because it cannot be backdated.',
        },
        {
          q: 'Do these rules apply in Abu Dhabi?',
          a: 'No. This is KHDA policy and covers Dubai private schools only. Abu Dhabi schools are regulated by ADEK, which sets its own fee and refund rules.',
        },
      ],
    },
  ],
  sources: [
    {
      label: 'KHDA: Registration and Refund Policy for all Dubai Private Schools (issued May 2026)',
      url: 'https://web.khda.gov.ae/KHDA/media/KHDA/Registration_and_Refund_Policy_for_all_Dubai_Private_Schools_EN_2.pdf',
    },
    {
      label: 'KHDA: School Registration and Refund Policy, parent FAQs',
      url: 'https://web.khda.gov.ae/KHDA/media/KHDA/School-FAQ-s.pdf',
    },
    {
      label: 'KHDA: contact and e-feedback channels',
      url: 'https://web.khda.gov.ae/en/Contact-Us',
    },
    {
      label: 'KHDA Education Directory (search a school for its Fees Fact Sheet)',
      url: 'https://web.khda.gov.ae/en/Education-Directory',
    },
  ],
  related: ['true-cost-uae-school-year', 'dubai-school-fees', 'moving-to-uae-school-admissions', 'khda-ratings-explained'],
}
