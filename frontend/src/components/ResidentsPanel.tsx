import { useTypewriter } from '../hooks/useTypewriter';

const GREETINGS = [
  { code: 'EN', text: 'How can we help you today?' },
  { code: 'ES', text: '¿Cómo podemos ayudarte hoy?' },
  { code: 'FR', text: 'Comment pouvons-nous vous aider aujourd\u2019hui ?' },
  { code: 'DE', text: 'Wie können wir Ihnen heute helfen?' },
  { code: 'ZH', text: '今天有什么可以帮您的？' },
  { code: 'JA', text: '本日はどのようなご用件でしょうか？' },
  { code: 'PT', text: 'Como podemos ajudá-lo hoje?' },
  { code: 'AR', text: 'كيف يمكننا مساعدتك اليوم؟' },
  { code: 'KO', text: '오늘 무엇을 도와드릴까요?' },
];

const GREETING_TEXTS = GREETINGS.map((g) => g.text);

export function ResidentsPanel() {
  const typedGreeting = useTypewriter(GREETING_TEXTS, {
    typeMs: 45,
    deleteMs: 28,
    pauseMs: 2400,
  });
  const active = typedGreeting
    ? (GREETINGS.find((g) => g.text.startsWith(typedGreeting)) ?? GREETINGS[0])
    : GREETINGS[0];

  return (
    <div className="residents-panel" aria-labelledby="residents-heading">
      <div className="residents-panel__copy cell">
        <p className="mono-label mono-label--muted">
          <span className="mono-label--accent">&gt;&gt;&gt;</span> For every resident
        </p>
        <h3 id="residents-heading" className="residents-panel__title">
          Serving all residents
        </h3>
        <p className="residents-panel__desc">
          The widget detects each visitor&apos;s language automatically and lets
          them switch anytime in chat. Multiple languages are supported — so more of
          your community can get answers in the language they&apos;re most
          comfortable with.
        </p>
        <ul className="residents-panel__list mono-label">
          {GREETINGS.map((g) => (
            <li
              key={g.code}
              className={
                g.code === active.code
                  ? 'residents-panel__lang residents-panel__lang--active'
                  : 'residents-panel__lang'
              }
            >
              {g.code}
            </li>
          ))}
        </ul>
      </div>

      <div className="residents-panel__demo cell" aria-live="polite" aria-atomic="true">
        <span className="mono-label mono-label--muted">Welcome message</span>
        <p className="residents-panel__typed">
          <span className="residents-panel__code">{active.code}</span>
          {typedGreeting}
          <span className="hero-block__cursor" aria-hidden="true">
            |
          </span>
        </p>
      </div>
    </div>
  );
}
