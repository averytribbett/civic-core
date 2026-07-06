import type { MouseEvent, ReactNode } from 'react';
import { scrollToSection } from '../lib/scrollToSection';

type NavLinkProps = {
  sectionId: string;
  className?: string;
  children: ReactNode;
};

export function NavLink({ sectionId, className, children }: NavLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    scrollToSection(sectionId);
    window.history.replaceState(null, '', `#${sectionId}`);
  };

  return (
    <a href={`#${sectionId}`} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
