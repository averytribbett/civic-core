export function PricingCTA() {
  return (
    <section id="contact" className="cta" aria-labelledby="cta-heading">
      <div className="cta__inner">
        <h2 id="cta-heading" className="cta__heading">
          Custom pricing
        </h2>
        <p className="cta__text">
          We tailor pricing to your municipality. Contact us for a quote.
        </p>
        <a
          href="mailto:hello@civiccore.ai?subject=Pricing%20inquiry"
          className="cta__button"
        >
          Contact
        </a>
      </div>
    </section>
  );
}
