import { DEMO_BOOKING_URL } from '../lib/siteConfig';

export function Footer() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer__brand cell">
        <span className="site-footer__name">Civic Core</span>
        <span className="mono-label mono-label--muted">AI for cities &amp; counties</span>
      </div>
      <div className="site-footer__links cell">
        <nav aria-label="Site">
          <a href="/voice" className="mono-label">
            Voice
          </a>
        </nav>
        <a
          href={DEMO_BOOKING_URL || '#'}
          className="site-footer__try mono-label"
          {...(DEMO_BOOKING_URL
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : undefined)}
        >
          Book a demo ↗
        </a>
      </div>
    </footer>
  );
}
