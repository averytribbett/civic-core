import type { ReactNode } from 'react';

type FeatureRowProps = {
  num: string;
  eyebrow: string;
  title: string;
  desc: string;
  reversed?: boolean;
  children: ReactNode;
};

export function FeatureRow({
  num,
  eyebrow,
  title,
  desc,
  reversed = false,
  children,
}: FeatureRowProps) {
  return (
    <article
      className={`feature-row cell ${reversed ? 'feature-row--reversed' : ''}`}
    >
      <div className="feature-row__copy">
        <p className="mono-label mono-label--muted">
          <span className="mono-label--accent">{num}</span> {eyebrow}
        </p>
        <h3 className="feature-row__title">{title}</h3>
        <p className="feature-row__desc">{desc}</p>
      </div>
      <div className="feature-row__viz">{children}</div>
    </article>
  );
}

function TerminalPanel({
  label,
  lines,
}: {
  label: string;
  lines: { time: string; key: string; value?: string; status?: string }[];
}) {
  return (
    <div className="mini-terminal" aria-hidden="true">
      <div className="mini-terminal__header">
        <span className="mono-label">{label}</span>
        <span className="mini-terminal__status">live</span>
      </div>
      <div className="mini-terminal__body">
        {lines.map((line) => (
          <div key={line.key} className="mini-terminal__line">
            <span className="mini-terminal__time">{line.time}</span>
            <span className="mini-terminal__dots">...</span>
            <span className="mini-terminal__key">{line.key}</span>
            {line.value && (
              <span className="mini-terminal__value">{line.value}</span>
            )}
            {line.status && (
              <span className={`mini-terminal__badge mini-terminal__badge--${line.status}`}>
                {line.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SourcedAnswersViz() {
  return (
    <TerminalPanel
      label="Source citation >>>"
      lines={[
        { time: '[14:02:11]', key: 'query', value: 'permit hours?' },
        { time: '[14:02:12]', key: 'match', value: 'ch.4 §12' },
        {
          time: '[14:02:13]',
          key: 'cited',
          status: 'verified',
        },
      ]}
    />
  );
}

export function AutoRefreshViz() {
  return (
    <TerminalPanel
      label="Content sync >>>"
      lines={[
        { time: '[03:00:01]', key: 'crawl_started', status: 'done' },
        { time: '[03:04:18]', key: 'pages_updated', value: '12' },
        { time: '[03:04:22]', key: 'index', status: 'ready' },
      ]}
    />
  );
}
