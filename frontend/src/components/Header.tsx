import { useEffect, useState } from 'react';

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`header ${scrolled ? 'header--scrolled' : ''}`}
      role="banner"
    >
      <a href="#" className="header__brand">
        Civic Core
      </a>
      <a href="#contact" className="header__link">
        Contact
      </a>
    </header>
  );
}
