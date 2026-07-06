import { openWidget } from '../lib/openWidget';

export function Footer() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer__brand cell">
        <span className="site-footer__name">Civic Core</span>
        <span className="mono-label mono-label--muted">AI for cities &amp; counties</span>
      </div>
      <div className="site-footer__links cell">
        <a href="mailto:hello@civiccore.ai" className="mono-label">
          hello@civiccore.ai
        </a>
        <button type="button" className="site-footer__try mono-label" onClick={openWidget}>
          Try it now ↗
        </button>
      </div>
    </footer>
  );
}
