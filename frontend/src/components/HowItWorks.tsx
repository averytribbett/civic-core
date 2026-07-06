import { TryItButton } from './TryItButton';

const STEPS = [
  {
    num: '01',
    title: 'We scan your public website',
    text: 'We crawl and index every public page and PDF — building a knowledge base from the content you already publish.',
  },
  {
    num: '02',
    title: 'You set your look and feel',
    text: 'Send us your logo and brand colors. We configure the widget so it feels native to your municipality\u2019s site.',
  },
  {
    num: '03',
    title: 'One snippet on your site',
    text: 'We add a single line of code to your website. That\u2019s it — the chat launcher goes live for residents.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="steps-block" aria-labelledby="steps-heading">
      <div className="steps-block__header cell">
        <p className="mono-label mono-label--muted">
          <span className="mono-label--accent">&gt;&gt;&gt;</span> Implementation
        </p>
        <h2 id="steps-heading" className="steps-block__title">
          Live in three steps
        </h2>
        <p className="steps-block__intro">
          Most municipalities are answering resident questions the same day we
          deploy. No new portal, no content migration — just your existing site,
          made searchable.
        </p>
      </div>

      <div className="steps-block__grid">
        {STEPS.map((step) => (
          <article key={step.num} className="step-card cell">
            <span className="step-card__num">{step.num}</span>
            <h3 className="step-card__title">{step.title}</h3>
            <p className="step-card__text">{step.text}</p>
          </article>
        ))}
      </div>

      <div className="steps-block__cta cell">
        <TryItButton large />
      </div>
    </section>
  );
}
