import { LEGAL_ENTITY, LEGAL_LAST_UPDATED } from './company'
import type { LegalDocument } from './types'

export const websitePrivacy: LegalDocument = {
  title: 'Privacy Policy',
  subtitle: `Last updated ${LEGAL_LAST_UPDATED}. Applies to ${LEGAL_ENTITY.website} (the “Site”).`,
  sections: [
    {
      title: 'Scope',
      paragraphs: [
        `This Privacy Policy describes how ${LEGAL_ENTITY.name} (“Civic Core,” “we,” “us”) handles information when you visit our marketing website at ${LEGAL_ENTITY.website}.`,
        `It does not cover the Civic Core chat widget embedded on city or county websites. That product has a separate Chat Privacy Notice hosted at ${LEGAL_ENTITY.widgetOrigin}/app/privacy.html.`,
        'The Site may describe Civic Core Voice, a future AI phone line for municipalities. That product is not generally available yet. When Voice launches, call audio and transcripts will be covered by a separate product privacy notice — not this Site policy.',
      ],
    },
    {
      title: 'Information we collect',
      paragraphs: ['We collect limited information depending on how you interact with the Site.'],
      list: [
        'Information you provide voluntarily, such as your name, email address, organization, or message content if you contact us by email or schedule a demo through a third-party booking link.',
        'Basic technical information that web hosting services may log automatically, such as IP address, browser type, referring URL, and pages viewed. We use this for security and to operate the Site.',
        'When you load the Site, Google Fonts may receive your IP address to deliver font files. See Google’s privacy policy for how Google processes that data.',
      ],
    },
    {
      title: 'Information we do not collect on the Site',
      paragraphs: [
        'The marketing Site does not offer user accounts, checkout, or a live chat product.',
        'We do not use advertising cookies or third-party analytics trackers on the Site today.',
        'We do not knowingly collect sensitive personal information through the Site.',
      ],
    },
    {
      title: 'How we use information',
      paragraphs: ['We use the information described above to:'],
      list: [
        'Respond to inquiries and demo requests.',
        'Operate, maintain, and secure the Site.',
        'Understand aggregate interest in our services.',
        'Comply with law and enforce our Terms of Service.',
      ],
    },
    {
      title: 'How we share information',
      paragraphs: [
        'We do not sell your personal information. We may share information with:',
      ],
      list: [
        'Service providers that help us host the Site (for example, Firebase / Google Cloud), deliver email, or schedule demos.',
        'Professional advisers or authorities when required by law or to protect rights and safety.',
        'A successor entity if Civic Core is involved in a merger, acquisition, or asset sale.',
      ],
    },
    {
      title: 'Retention',
      paragraphs: [
        'We keep information only as long as needed for the purposes described above, unless a longer period is required by law.',
      ],
    },
    {
      title: 'Security',
      paragraphs: [
        'We use reasonable technical and organizational measures to protect information. No method of transmission or storage is completely secure.',
      ],
    },
    {
      title: 'Your choices and rights',
      paragraphs: [
        'Depending on where you live, you may have rights to access, correct, or delete personal information we hold about you, or to object to certain processing.',
        `To make a request, email ${LEGAL_ENTITY.privacyEmail}. We may need to verify your identity before responding.`,
        'Residents of certain U.S. states may have additional privacy rights under applicable state law.',
      ],
    },
    {
      title: 'Children',
      paragraphs: [
        'The Site is intended for business and government audiences and is not directed to children under 18. We do not knowingly collect personal information from children.',
      ],
    },
    {
      title: 'Changes',
      paragraphs: [
        'We may update this Privacy Policy from time to time. The “Last updated” date at the top will change when we do. Continued use of the Site after an update means you accept the revised policy.',
      ],
    },
    {
      title: 'Contact us',
      paragraphs: [
        `${LEGAL_ENTITY.name}`,
        `${LEGAL_ENTITY.addressLine1}`,
        `${LEGAL_ENTITY.city}, ${LEGAL_ENTITY.state} ${LEGAL_ENTITY.postalCode}`,
        LEGAL_ENTITY.country,
        `Email: ${LEGAL_ENTITY.privacyEmail}`,
      ],
    },
  ],
}
