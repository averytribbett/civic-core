import type { MouseEvent, ReactNode } from 'react';
import { scrollToSection } from '../lib/scrollToSection';

type NavLinkProps = {
  sectionId: string;
  className?: string;
  children: ReactNode;
};

function isMarketingHome() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return path === '/';
}

export function NavLink({ sectionId, className, children }: NavLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isMarketingHome()) return;

    event.preventDefault();
    scrollToSection(sectionId);
    window.history.replaceState(null, '', `#${sectionId}`);
  };

  return (
    <a href={`/#${sectionId}`} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
