import { LEGAL_ENTITY, LEGAL_LAST_UPDATED } from './company'
import type { LegalDocument } from './types'

export const websiteTerms: LegalDocument = {
  title: 'Terms of Service',
  subtitle: `Last updated ${LEGAL_LAST_UPDATED}. Applies to ${LEGAL_ENTITY.website} (the “Site”).`,
  sections: [
    {
      title: 'Agreement',
      paragraphs: [
        `These Terms of Service (“Terms”) are a legal agreement between you and ${LEGAL_ENTITY.name} (“Civic Core,” “we,” “us”) governing your use of our marketing website at ${LEGAL_ENTITY.website}.`,
        'By accessing or using the Site, you agree to these Terms. If you do not agree, do not use the Site.',
      ],
    },
    {
      title: 'What the Site is',
      paragraphs: [
        'The Site provides general information about Civic Core’s AI assistant for cities and counties, including product descriptions, illustrations, and ways to contact us or request a demo.',
        'Interactive previews on the Site are demonstrations only. They are not connected to a live government deployment unless clearly stated.',
        'Use of the Civic Core chat widget on a government website is governed by separate widget terms and privacy notice, not these Site Terms.',
      ],
    },
    {
      title: 'Acceptable use',
      paragraphs: ['You agree not to:'],
      list: [
        'Use the Site in violation of applicable law.',
        'Attempt to gain unauthorized access to our systems or interfere with the Site’s operation.',
        'Scrape, reverse engineer, or misuse the Site except as permitted by law.',
        'Misrepresent your affiliation with Civic Core or any government entity.',
      ],
    },
    {
      title: 'Intellectual property',
      paragraphs: [
        'The Site and its content (text, graphics, logos, and software) are owned by Civic Core or our licensors and are protected by intellectual property laws.',
        'You may view and share links to the Site for personal or internal business evaluation. You may not copy, modify, or distribute Site content for commercial purposes without our written permission.',
      ],
    },
    {
      title: 'Third-party links and services',
      paragraphs: [
        'The Site may link to third-party sites or tools (for example, email clients or demo scheduling services). We are not responsible for third-party sites or their practices.',
      ],
    },
    {
      title: 'Disclaimers',
      paragraphs: [
        'THE SITE AND ITS CONTENT ARE PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
        'Information on the Site is for general marketing purposes and does not constitute legal, government, or professional advice.',
      ],
    },
    {
      title: 'Limitation of liability',
      paragraphs: [
        'TO THE MAXIMUM EXTENT PERMITTED BY LAW, CIVIC CORE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SITE.',
        'OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SITE WILL NOT EXCEED ONE HUNDRED U.S. DOLLARS (US $100).',
      ],
    },
    {
      title: 'Indemnity',
      paragraphs: [
        'You agree to indemnify and hold harmless Civic Core from claims arising out of your misuse of the Site or violation of these Terms.',
      ],
    },
    {
      title: 'Changes',
      paragraphs: [
        'We may modify these Terms at any time by posting an updated version on the Site. Material changes will be reflected in the “Last updated” date. Continued use after changes means you accept the revised Terms.',
      ],
    },
    {
      title: 'Governing law',
      paragraphs: [
        `These Terms are governed by the laws of the State of ${LEGAL_ENTITY.state}, without regard to conflict-of-law rules. Exclusive venue for disputes relating to these Terms shall be in courts located in ${LEGAL_ENTITY.state}, unless applicable law requires otherwise.`,
      ],
    },
    {
      title: 'Contact',
      paragraphs: [
        `Questions about these Terms: ${LEGAL_ENTITY.email}`,
        `${LEGAL_ENTITY.name}, ${LEGAL_ENTITY.addressLine1}, ${LEGAL_ENTITY.city}, ${LEGAL_ENTITY.state} ${LEGAL_ENTITY.postalCode}`,
      ],
    },
  ],
}
