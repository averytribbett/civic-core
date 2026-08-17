import { DEMO_BOOKING_URL } from '../lib/siteConfig';

export function Footer() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer__brand cell">
        <span className="site-footer__name">Civic Core</span>
        <span className="mono-label mono-label--muted">AI for cities &amp; counties</span>
      </div>
      <div className="site-footer__links cell">
        <nav className="site-footer__legal" aria-label="Legal">
          <a href="/privacy" className="mono-label">
            Privacy
          </a>
          <a href="/terms" className="mono-label">
            Terms
          </a>
        </nav>
        <a href="mailto:hello@civiccore.ai" className="mono-label">
          hello@civiccore.ai
        </a>
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
