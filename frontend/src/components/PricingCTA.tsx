import { TryItButton } from './TryItButton';

export function PricingCTA() {
  return (
    <section id="contact" className="cta-block" aria-labelledby="cta-heading">
      <div className="cta-block__inner cell">
        <p className="mono-label mono-label--muted">Ready when you are</p>
        <h2 id="cta-heading" className="cta-block__title">
          See it answer real questions
        </h2>
        <p className="cta-block__text">
          See how Civic Core answers questions about permits, meetings, and
          services — trained on a live county site. Custom pricing for your
          municipality?{' '}
          <a href="mailto:hello@civiccore.ai?subject=Pricing%20inquiry">
            Get in touch
          </a>
          .
        </p>
        <TryItButton large />
      </div>
    </section>
  );
}
