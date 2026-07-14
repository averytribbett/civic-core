import { DEMO_BOOKING_URL } from '../lib/siteConfig';

type TryItButtonProps = {
  className?: string;
  large?: boolean;
};

export function TryItButton({ className = '', large = false }: TryItButtonProps) {
  return (
    <a
      href={DEMO_BOOKING_URL || '#'}
      className={`btn-primary ${large ? 'btn-primary--large' : ''} ${className}`.trim()}
      {...(DEMO_BOOKING_URL
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : undefined)}
    >
      Book a demo
    </a>
  );
}
