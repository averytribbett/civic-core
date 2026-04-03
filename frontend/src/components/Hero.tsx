export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero__inner">
        <p className="hero__label">AI for local government</p>
        <h1 id="hero-heading" className="hero__title">
          Your website, answered.
        </h1>
        <p className="hero__subtitle">
          We train an AI on your city or county site. Residents get accurate
          answers about permits, meetings, and services without calling or searching.
        </p>
        <a href="#contact" className="hero__cta">
          Get in touch
        </a>
      </div>
    </section>
  );
}
