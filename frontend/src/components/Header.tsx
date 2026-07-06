import { useEffect, useState } from 'react';
import { NavLink } from './NavLink';
import { TryItButton } from './TryItButton';

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`site-header ${scrolled ? 'site-header--scrolled' : ''}`}
      role="banner"
    >
      <div className="site-header__brand">
        <svg
          className="site-header__logo"
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
        >
          <rect x="1" y="1" width="26" height="26" stroke="currentColor" strokeWidth="1" />
          <line x1="7" y1="10" x2="21" y2="10" stroke="var(--accent)" strokeWidth="2" />
          <line x1="7" y1="14" x2="21" y2="14" stroke="var(--accent)" strokeWidth="2" />
          <line x1="7" y1="18" x2="17" y2="18" stroke="var(--accent)" strokeWidth="2" />
        </svg>
        <a href="#" className="site-header__name">
          Civic Core
        </a>
      </div>

      <nav className="site-header__nav" aria-label="Primary">
        <NavLink sectionId="how-it-works" className="site-header__nav-link">
          <span className="nav-num">01</span> How it works
        </NavLink>
        <NavLink sectionId="features" className="site-header__nav-link">
          <span className="nav-num">02</span> Features
        </NavLink>
      </nav>

      <div className="site-header__actions">
        <TryItButton className="site-header__try" />
        <a href="mailto:hello@civiccore.ai" className="site-header__contact">
          Contact
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M2 10L10 2M10 2H4M10 2V8"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </a>
      </div>
    </header>
  );
}
