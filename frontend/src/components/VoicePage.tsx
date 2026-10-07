import { Header } from './Header';
import { Footer } from './Footer';
import { DEMO_BOOKING_URL } from '../lib/siteConfig';
import './VoicePage.css';

const VALUE_PROPS = [
  {
    num: '01',
    title: 'Same knowledge base',
    text: 'Answers come from the same crawled website and PDFs that power your Civic Core chat widget — one source of truth.',
  },
  {
    num: '02',
    title: '24/7 without hold times',
    text: 'Residents call a dedicated number and get sourced answers any time — permits, meetings, services, and more.',
  },
  {
    num: '03',
    title: 'Flat annual pricing',
    text: 'One predictable contract based on estimated call volume — no per-minute surprises or usage invoices.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Resident calls your number',
    text: 'A dedicated inbound line routes to Civic Core Voice — no new portal for staff to manage.',
  },
  {
    num: '02',
    title: 'AI searches your public site',
    text: 'The assistant retrieves facts from your indexed website content before answering, just like the chat widget.',
  },
  {
    num: '03',
    title: 'Natural spoken answers',
    text: 'Callers get concise, professional responses — with honest limits when information is not on the site.',
  },
];

export function VoicePage() {
  const demoHref = DEMO_BOOKING_URL || '/#contact';
  const demoExternal = Boolean(DEMO_BOOKING_URL);

  return (
    <div className="page">
      <Header />
      <main className="page__main voice-page">
        <section className="voice-hero cell" aria-labelledby="voice-heading">
          <div className="voice-hero__inner">
            <p className="mono-label mono-label--accent voice-hero__badge">
              Coming soon
            </p>
            <h1 id="voice-heading" className="voice-hero__title">
              Call in. Get sourced answers.
            </h1>
            <p className="voice-hero__desc">
              An AI phone line for cities and counties — trained on your public
              website, available around the clock. Same knowledge base as Civic
              Core chat, built for natural conversation over the phone.
            </p>
            <div className="voice-hero__actions">
              <a
                href={demoHref}
                className="btn-primary btn-primary--large"
                {...(demoExternal
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : undefined)}
              >
                Book a demo
              </a>
              <a
                href="/#contact"
                className="voice-hero__secondary mono-label"
              >
                Join the waitlist ↗
              </a>
            </div>
          </div>
          <aside className="voice-hero__aside" aria-label="Pricing preview">
            <p className="mono-label mono-label--muted">Planning figure</p>
            <p className="voice-hero__stat">
              ~62% savings vs. typical $4/call human handling
            </p>
            <p className="voice-hero__stat-detail">
              Flat annual contracts priced from estimated call volume — no usage
              billing. Early access for pilot counties.
            </p>
          </aside>
        </section>

        <section className="voice-props" aria-labelledby="voice-props-heading">
          <div className="voice-props__header cell">
            <p className="mono-label mono-label--muted">
              <span className="mono-label--accent">&gt;&gt;&gt;</span> Why Voice
            </p>
            <h2 id="voice-props-heading" className="voice-props__title">
              Chat intelligence, on the phone
            </h2>
          </div>
          <div className="voice-props__grid">
            {VALUE_PROPS.map((item) => (
              <article key={item.num} className="step-card cell">
                <span className="step-card__num">{item.num}</span>
                <h3 className="step-card__title">{item.title}</h3>
                <p className="step-card__text">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="voice-steps" aria-labelledby="voice-steps-heading">
          <div className="voice-steps__header cell">
            <p className="mono-label mono-label--muted">
              <span className="mono-label--accent">&gt;&gt;&gt;</span> How it
              will work
            </p>
            <h2 id="voice-steps-heading" className="voice-steps__title">
              From ring to answer
            </h2>
          </div>
          <div className="voice-steps__grid">
            {STEPS.map((step) => (
              <article key={step.num} className="step-card cell">
                <span className="step-card__num">{step.num}</span>
                <h3 className="step-card__title">{step.title}</h3>
                <p className="step-card__text">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="cta-block" aria-labelledby="voice-cta-heading">
          <div className="cta-block__inner cell">
            <p className="mono-label mono-label--muted">Early access</p>
            <h2 id="voice-cta-heading" className="cta-block__title">
              Be first in line
            </h2>
            <p className="cta-block__text">
              Civic Core Voice is in development. Book a demo to see the chat
              product today and get on the list for phone-line pilots.
            </p>
            <a
              href={demoHref}
              className="btn-primary btn-primary--large"
              {...(demoExternal
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : undefined)}
            >
              Book a demo
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
