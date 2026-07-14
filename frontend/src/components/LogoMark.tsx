type LogoMarkProps = {
  className?: string;
  size?: number;
};

/** Civic Core mark: sourced reply — answer block + citation tick in a blueprint cell. */
export function LogoMark({ className, size = 28 }: LogoMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="25"
        height="25"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <rect x="6" y="7" width="16" height="11" stroke="currentColor" strokeWidth="1" />
      <line x1="9" y1="11" x2="19" y2="11" stroke="var(--accent)" strokeWidth="1.75" />
      <line x1="9" y1="15" x2="15" y2="15" stroke="var(--accent)" strokeWidth="1.75" />
      <path
        d="M18.5 20.5 L20.2 22.2 L24 17.5"
        stroke="var(--accent)"
        strokeWidth="1.75"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
