import { useEffect, useState } from 'react';
import { LogoMark } from './LogoMark';
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
        <LogoMark className="site-header__logo" />
        <a href="/" className="site-header__name">
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
        <a href="/voice" className="site-header__nav-link">
          <span className="nav-num">03</span> Voice
        </a>
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
