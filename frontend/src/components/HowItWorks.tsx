export function HowItWorks() {
  return (
    <section className="process" aria-labelledby="process-heading">
      <div className="process__inner">
        <h2 id="process-heading" className="process__heading">
          Simple implementation
        </h2>
        <div className="process__steps">
          <div className="process__step animate-on-scroll">
            <span className="process__label">We crawl your site</span>
            <p className="process__text">
              Public pages only. We build a searchable knowledge base.
            </p>
          </div>
          <div className="process__divider" aria-hidden="true" />
          <div className="process__step animate-on-scroll">
            <span className="process__label">You add one line</span>
            <p className="process__text">
              A single script tag. The chatbot appears on your site.
            </p>
          </div>
          <div className="process__divider" aria-hidden="true" />
          <div className="process__step animate-on-scroll">
            <span className="process__label">Residents ask questions</span>
            <p className="process__text">
              Plain language. Instant, sourced answers.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
