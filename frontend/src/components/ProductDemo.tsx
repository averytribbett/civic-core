export function ProductDemo() {
  return (
    <section className="product" aria-labelledby="product-heading">
      <div className="product__inner">
        <h2 id="product-heading" className="product__heading">
          One script. Your content. Instant answers.
        </h2>
        <div className="product__grid">
          <div className="product__item animate-on-scroll">
            <span className="product__num">01</span>
            <h3 className="product__title">Trained on your site</h3>
            <p className="product__desc">
              We index your public pages. The AI answers from your actual
              content—permits, FAQs, meeting schedules.
            </p>
          </div>
          <div className="product__item animate-on-scroll">
            <span className="product__num">02</span>
            <h3 className="product__title">Accessible by design</h3>
            <p className="product__desc">
              Multi-language support. Screen-reader friendly. Built so all
              residents can get the answers they need.
            </p>
          </div>
          <div className="product__item animate-on-scroll">
            <span className="product__num">03</span>
            <h3 className="product__title">Always available</h3>
            <p className="product__desc">
              Residents get answers 24/7. Fewer calls to staff, less time
              digging through pages.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
