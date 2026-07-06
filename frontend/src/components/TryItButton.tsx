import { openWidget } from '../lib/openWidget';

type TryItButtonProps = {
  className?: string;
  large?: boolean;
};

export function TryItButton({ className = '', large = false }: TryItButtonProps) {
  return (
    <button
      type="button"
      className={`btn-primary ${large ? 'btn-primary--large' : ''} ${className}`.trim()}
      onClick={openWidget}
    >
      Try it now
    </button>
  );
}
