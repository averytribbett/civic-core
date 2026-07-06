import { HeroChatPreview } from './HeroChatPreview';
import { NavLink } from './NavLink';
import { TryItButton } from './TryItButton';
import { useTypewriter } from '../hooks/useTypewriter';

const TOPICS = [
  'building permits',
  'trash & recycling',
  'city council meetings',
  'property taxes',
  'zoning questions',
  'public records',
];

export function Hero() {
  const typedTopic = useTypewriter(TOPICS);

  return (
    <section className="hero-block" aria-labelledby="hero-heading">
      <div className="hero-block__copy">
        <h1 id="hero-heading" className="hero-block__title">
          Answers in seconds, not hold times
        </h1>

        <p className="hero-block__tagline" aria-live="polite" aria-atomic="true">
          <span className="mono-label mono-label--accent">&gt;&gt;&gt;</span>{' '}
          <span className="hero-block__tagline-text">
            answering {typedTopic}
          </span>
          <span className="hero-block__cursor" aria-hidden="true">
            |
          </span>
        </p>

        <p className="hero-block__desc">
          An AI assistant trained on your municipality&apos;s public website.
          Residents get sourced answers about permits, meetings, and services —
          without calling or digging through pages.
        </p>

        <NavLink sectionId="how-it-works" className="hero-block__link mono-label">
          See how it works ↗
        </NavLink>

        <TryItButton />
      </div>

      <div className="hero-block__viz">
        <HeroChatPreview />
      </div>
    </section>
  );
}
