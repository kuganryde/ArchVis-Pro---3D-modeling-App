/**
 * Legal content for the in-app Legal Center (Terms, Privacy, Acceptable Use,
 * Refunds & Billing, Cookies). Edit LEGAL below to set your operating entity,
 * contact address, effective date and governing-law jurisdiction.
 *
 * NOTE: These are good-faith, plain-language templates that reflect how the app
 * actually handles data. They are not legal advice — have them reviewed by
 * qualified counsel and complete the [bracketed] fields before you rely on them.
 */
export const LEGAL = {
  product: 'ArchViz Pro',
  company: 'RYDETECH GLOBAL ENTERPRISE',
  contact: 'rydetechwizsolutions@gmail.com',
  effectiveDate: '28 July 2026',
  jurisdiction: '[your governing-law jurisdiction]',
};

export interface LegalSection {
  heading: string;
  body?: string;
  bullets?: string[];
}

export interface Policy {
  id: string;
  title: string;
  intro?: string;
  sections: LegalSection[];
}

const P = LEGAL.product;
const C = LEGAL.company;

export const POLICIES: Policy[] = [
  // ---------------------------------------------------------------- Terms
  {
    id: 'terms',
    title: 'Terms of Service',
    intro: `These Terms of Service ("Terms") govern your access to and use of ${P} (the "Service"), operated by ${C} ("we", "us", "our"). By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.`,
    sections: [
      {
        heading: '1. The Service',
        body: `${P} is a browser-based 3D digital-twin platform for planning office floor plans and low-current (network / audio-visual) infrastructure, including optional AI-assisted blueprint digitization, reporting, bill-of-materials, and collaborative workspaces. Features vary by plan and may change over time.`,
      },
      {
        heading: '2. Eligibility & Accounts',
        body: 'You must be at least 16 years old and able to form a binding contract. You are responsible for the accuracy of your registration details, for keeping your credentials secure, and for all activity under your account. Notify us promptly of any unauthorized use.',
      },
      {
        heading: '3. Workspaces, Roles & Collaboration',
        body: 'Content is organized into workspaces. Workspace owners and admins may invite members, assign roles, and remove members. If you invite others or accept an invitation, you are responsible for ensuring appropriate authority to share the relevant content within that workspace.',
      },
      {
        heading: '4. Acceptable Use',
        body: 'You agree to use the Service only for lawful purposes and in accordance with our Acceptable Use Policy. We may suspend or terminate access for violations.',
      },
      {
        heading: '5. Subscriptions, Billing & Renewal',
        body: 'Paid plans are billed in advance on a recurring basis through our payment processor, Stripe. Subscriptions renew automatically until cancelled. You can manage or cancel your subscription at any time via the in-app billing portal; cancellation takes effect at the end of the current billing period. Fees are exclusive of taxes unless stated. See the Refunds & Billing Policy for details.',
      },
      {
        heading: '6. AI Features',
        body: 'Some features use third-party AI models (Google Gemini) to generate suggested layouts, assets, and estimates. AI output is probabilistic and provided for convenience only — it may be inaccurate or incomplete and must be independently verified. Where you supply your own API key ("BYOK"), you are responsible for that key and any usage billed to your provider account. Hosted AI usage is metered against your plan allowance.',
      },
      {
        heading: '7. Your Content',
        body: 'You retain all rights to the designs, blueprints, specifications and other content you create or upload ("Your Content"). You grant us a limited, non-exclusive license to host, store, process and display Your Content solely to operate and improve the Service and to provide it to the collaborators you authorize. You represent that you have the rights necessary to upload Your Content.',
      },
      {
        heading: '8. Intellectual Property',
        body: `The Service, including its software, design, branding and the ${P} name and logo, is owned by ${C} and protected by intellectual-property laws. Except for the rights expressly granted to you, no rights are transferred. You may not copy, modify, resell, reverse-engineer or create derivative works of the Service except as permitted by law.`,
      },
      {
        heading: '9. Third-Party Services',
        body: 'The Service integrates third-party providers, including Supabase (authentication, database, storage), Stripe (payments), Google Gemini (AI), and — where enabled — Google Analytics. Your use of those features may be subject to the third parties’ own terms and privacy policies.',
      },
      {
        heading: '10. Disclaimers',
        body: `THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED. ${P} is a planning and visualization aid. It is NOT a substitute for professional architectural, engineering, structural, electrical, network, or safety design, certification, or advice. Coverage heatmaps, occupancy figures, cabling routes, cost estimates and bills of materials are indicative only. You are solely responsible for verifying all outputs with qualified professionals before relying on them.`,
      },
      {
        heading: '11. Limitation of Liability',
        body: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${C} AND ITS SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, GOODWILL OR BUSINESS. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF THE AMOUNTS YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM OR USD 100.`,
      },
      {
        heading: '12. Indemnification',
        body: 'You agree to indemnify and hold harmless ' + C + ' from any claims, damages and expenses arising out of Your Content, your use of the Service, or your violation of these Terms or applicable law.',
      },
      {
        heading: '13. Termination',
        body: 'You may stop using the Service at any time. We may suspend or terminate access if you breach these Terms or to protect the Service or other users. On termination, your right to use the Service ends; you may request an export of Your Content within a reasonable period, after which it may be deleted.',
      },
      {
        heading: '14. Changes to the Service or Terms',
        body: 'We may modify the Service or these Terms. Material changes will be notified in-app or by email. Continued use after changes take effect constitutes acceptance.',
      },
      {
        heading: '15. Governing Law',
        body: `These Terms are governed by the laws of ${LEGAL.jurisdiction}, without regard to conflict-of-laws rules. The courts of that jurisdiction will have exclusive jurisdiction, subject to any mandatory consumer protections available to you.`,
      },
      {
        heading: '16. Contact',
        body: `Questions about these Terms: ${LEGAL.contact}.`,
      },
    ],
  },

  // -------------------------------------------------------------- Privacy
  {
    id: 'privacy',
    title: 'Privacy Policy',
    intro: `This Privacy Policy explains how ${C} collects, uses and shares personal data when you use ${P}. We aim to collect only what we need to run the Service.`,
    sections: [
      {
        heading: '1. Data We Collect',
        bullets: [
          'Account data: your email address and display name, provided at sign-up.',
          'Design data: the projects, rooms, assets, specifications and blueprint images you create or upload.',
          'Usage & metering: AI-generation counts, plan/subscription status, and basic operational logs.',
          'Payment data: handled by Stripe. We receive limited billing metadata (e.g. subscription status) but never your full card number.',
          'Analytics: if enabled by the operator, aggregate usage events via Google Analytics.',
          'API keys (BYOK): if you provide your own Gemini key, it is stored only in your browser session and is not saved on our servers.',
        ],
      },
      {
        heading: '2. How We Use Data',
        bullets: [
          'To provide, secure and operate the Service and your workspaces.',
          'To process subscriptions and prevent abuse (usage metering, rate limits).',
          'To run AI features you invoke (see “AI & Blueprint Data”).',
          'To communicate service and account notices.',
          'To improve reliability and, where analytics are enabled, understand aggregate usage.',
        ],
      },
      {
        heading: '3. AI & Blueprint Data',
        body: 'When you use AI digitization or prompt-to-layout, the relevant input (a blueprint image or a text prompt) is sent to Google Gemini to generate a suggested layout. If you use your own API key, this call is made directly from your browser to Google and is billed to your account. If you use hosted AI, the call is made from our server using our key and is metered against your plan. To reduce cost and repeat processing, results may be cached against a hash of the input within your workspace.',
      },
      {
        heading: '4. Storage & Sub-processors',
        body: 'Your account and design data are stored with Supabase (Postgres database and object storage). Blueprint images are stored as private files accessible only to your workspace. Payments are processed by Stripe. AI processing is performed by Google (Gemini). Optional analytics use Google Analytics. These providers process data on our behalf under their own terms and security programs.',
      },
      {
        heading: '5. Cookies & Local Storage',
        body: 'The app uses browser storage rather than tracking cookies for its core function: sessionStorage holds a BYOK API key for your session, and localStorage holds your working design in single-user (local) mode. If analytics are enabled by the operator, Google Analytics may set cookies. See the Cookies & Storage notice for details.',
      },
      {
        heading: '6. Data Retention & Deletion',
        body: 'We retain account and design data for as long as your account is active or as needed to provide the Service. You can delete projects and blueprints in-app. To delete your account and associated data, contact us at ' + LEGAL.contact + '. Some records may be retained where required by law (e.g. billing records).',
      },
      {
        heading: '7. Your Rights',
        body: 'Depending on your location, you may have rights to access, correct, export, or delete your personal data, and to object to or restrict certain processing. You can export your designs at any time from the app. To exercise other rights, contact us; we will respond within the timeframe required by applicable law.',
      },
      {
        heading: '8. Security',
        body: 'We use industry-standard measures including encryption in transit, workspace-scoped access controls (row-level security), and restricted server-side keys. No method of transmission or storage is completely secure; we cannot guarantee absolute security.',
      },
      {
        heading: '9. International Transfers',
        body: 'Our providers may process data in countries other than yours. Where required, appropriate safeguards are used for such transfers.',
      },
      {
        heading: '10. Children',
        body: 'The Service is not directed to children under 16, and we do not knowingly collect their personal data.',
      },
      {
        heading: '11. Changes & Contact',
        body: `We may update this Policy; material changes will be notified in-app or by email. Effective date: ${LEGAL.effectiveDate}. Privacy questions: ${LEGAL.contact}.`,
      },
    ],
  },

  // --------------------------------------------------------- Acceptable Use
  {
    id: 'aup',
    title: 'Acceptable Use',
    intro: 'To keep the Service safe and reliable for everyone, you agree not to misuse it.',
    sections: [
      {
        heading: 'Prohibited Conduct',
        bullets: [
          'Violating any law or the rights (including IP and privacy rights) of others.',
          'Uploading content you are not authorized to share, or that is unlawful, infringing, or harmful.',
          'Attempting to access accounts, workspaces or data that are not yours.',
          'Probing, scanning, or breaching security or authentication measures.',
          'Reverse-engineering, scraping, or overloading the Service, or circumventing usage limits, metering, or plan restrictions.',
          'Using the Service to build a competing product, or reselling access without authorization.',
          'Introducing malware, or interfering with the integrity or performance of the Service or its third-party providers.',
          'Abusing AI features to generate unlawful, infringing, or deceptive content.',
        ],
      },
      {
        heading: 'Enforcement',
        body: 'We may investigate suspected violations and may suspend or terminate access, remove content, or take other action we consider appropriate, with or without notice where necessary to protect the Service or others.',
      },
    ],
  },

  // ----------------------------------------------------- Refunds & Billing
  {
    id: 'billing',
    title: 'Refunds & Billing',
    intro: 'This policy explains how paid subscriptions work.',
    sections: [
      {
        heading: 'Plans & Payment',
        body: 'Paid plans (e.g. Pro, Team) are billed in advance through Stripe on a recurring monthly basis in the currency shown at checkout. By subscribing, you authorize recurring charges until you cancel.',
      },
      {
        heading: 'Auto-Renewal & Cancellation',
        body: 'Subscriptions renew automatically at the end of each billing period. You may cancel at any time via the in-app billing portal (Plans & Billing → Manage). Cancellation stops future renewals; your plan remains active until the end of the paid period. We do not provide automatic pro-rated refunds for partial periods except where required by law.',
      },
      {
        heading: 'Refunds',
        body: `Except where required by applicable consumer law, fees are non-refundable. If you believe you were charged in error, contact ${LEGAL.contact} within 14 days and we will review your request in good faith.`,
      },
      {
        heading: 'Price Changes',
        body: 'We may change plan pricing or features. Changes apply to the next billing period after reasonable notice; you may cancel before they take effect.',
      },
      {
        heading: 'Failed Payments',
        body: 'If a charge fails, we may retry and may downgrade or suspend paid features until payment succeeds.',
      },
      {
        heading: 'AI Usage',
        body: 'Hosted AI generations are metered against your plan allowance and do not carry over between periods. Bring-your-own-key usage is billed to you by your AI provider and is outside our billing.',
      },
    ],
  },

  // -------------------------------------------------------- Cookies/Storage
  {
    id: 'cookies',
    title: 'Cookies & Storage',
    intro: 'How the app uses your browser’s storage.',
    sections: [
      {
        heading: 'Essential Local Storage',
        bullets: [
          'sessionStorage — temporarily holds a Gemini API key you enter (BYOK) for the current tab; cleared when the tab closes.',
          'localStorage — in single-user (local) mode, autosaves your working design so a refresh does not lose it.',
          'Authentication — in SaaS mode, your session token is stored by the authentication provider (Supabase) to keep you signed in.',
        ],
      },
      {
        heading: 'Analytics (Optional)',
        body: 'If the operator enables Google Analytics, it may set cookies to measure aggregate, non-identifying usage. Analytics are disabled unless a measurement ID is configured.',
      },
      {
        heading: 'Managing Storage',
        body: 'You can clear this data at any time through your browser settings. Clearing it will sign you out and, in local mode, remove your unsaved local design.',
      },
    ],
  },
];
