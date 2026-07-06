import { ResidentsPanel } from './ResidentsPanel';
import {
  AutoRefreshViz,
  FeatureRow,
  SourcedAnswersViz,
} from './FeatureRow';

export function Features() {
  return (
    <section id="features" className="features-block" aria-label="Features">
      <ResidentsPanel />

      <FeatureRow
        num=">>>"
        eyebrow="Trust"
        title="Every answer cites your site"
        desc="Residents don't get generic AI guesses. Each response links back to the specific page on your website where the answer came from."
        reversed
      >
        <SourcedAnswersViz />
      </FeatureRow>

      <FeatureRow
        num=">>>"
        eyebrow="Freshness"
        title="Your content, kept current"
        desc="We re-crawl your public site on a schedule so answers reflect what's actually published today — not a stale snapshot from months ago."
      >
        <AutoRefreshViz />
      </FeatureRow>
    </section>
  );
}
