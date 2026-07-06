import { useEffect, useRef, useState } from 'react';
import { openWidget } from '../lib/openWidget';
import { WIDGET_ACCENT } from '../lib/widgetConfig';
import './HeroChatPreview.css';

const SPRINGFIELD = 'springfield.gov';

type Turn =
  | { role: 'user'; text: string }
  | { role: 'agent'; text: string; source?: string };

type Conversation = {
  turns: Turn[];
};

type VisibleMessage = {
  id: string;
  role: 'user' | 'agent';
  text: string;
  source?: string;
};

function getNextWeekday(day: number): Date {
  const result = new Date();
  result.setHours(0, 0, 0, 0);
  const daysUntil = (day - result.getDay() + 7) % 7 || 7;
  result.setDate(result.getDate() + daysUntil);
  return result;
}

function getLastWeekday(day: number): Date {
  const result = new Date();
  result.setHours(0, 0, 0, 0);
  const daysSince = (result.getDay() - day + 7) % 7 || 7;
  result.setDate(result.getDate() - daysSince);
  return result;
}

function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function getNextTaxDueDate(): Date {
  const now = new Date();
  let year = now.getFullYear();
  let due = new Date(year, 10, 15);
  if (due <= now) {
    due = new Date(year + 1, 10, 15);
  }
  return due;
}

function buildConversations(): Conversation[] {
  const nextCouncil = getNextWeekday(3);
  const lastCouncil = getLastWeekday(3);
  const taxDue = getNextTaxDueDate();
  const nextCouncilLabel = formatLongDate(nextCouncil);
  const lastCouncilLabel = formatLongDate(lastCouncil);
  const taxDueLabel = formatLongDate(taxDue);

  return [
    {
      turns: [
        {
          role: 'user',
          text: 'When is the next city council meeting?',
        },
        {
          role: 'agent',
          text: `The next City Council meeting is ${nextCouncilLabel} at 7:00 PM in Council Chambers, 123 Main Street.`,
          source: `${SPRINGFIELD}/council/meetings`,
        },
        {
          role: 'user',
          text: 'Can I read the minutes from the last meeting?',
        },
        {
          role: 'agent',
          text: `Yes — approved minutes from the ${lastCouncilLabel} meeting are posted on the city website.`,
          source: `${SPRINGFIELD}/council/minutes`,
        },
      ],
    },
    {
      turns: [
        {
          role: 'user',
          text: 'How do I apply for a building permit?',
        },
        {
          role: 'agent',
          text: 'You can submit a permit application online or in person at the Planning Department. Most residential projects are reviewed within 10 business days.',
          source: `${SPRINGFIELD}/permits/building`,
        },
        {
          role: 'user',
          text: 'Do I need plans for a deck?',
        },
        {
          role: 'agent',
          text: 'Yes — structural plans are required for any deck over 30 inches above grade. You can upload them with your online application.',
          source: `${SPRINGFIELD}/permits/deck-requirements`,
        },
      ],
    },
    {
      turns: [
        {
          role: 'user',
          text: 'When is the deadline to pay property taxes?',
        },
        {
          role: 'agent',
          text: `The next property tax installment is due ${taxDueLabel}. You can pay online, by mail, or in person at the Treasurer's office.`,
          source: `${SPRINGFIELD}/treasurer/property-tax`,
        },
        {
          role: 'user',
          text: 'Is there a late fee if I miss the deadline?',
        },
        {
          role: 'agent',
          text: 'A 2% penalty applies after the due date, with additional interest accruing each month until the balance is paid.',
          source: `${SPRINGFIELD}/treasurer/penalties`,
        },
      ],
    },
  ];
}

const THUMBS_UP_ICON = (
  <svg
    className="vote-icon"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);

function VoteActions() {
  return (
    <div className="message-actions" aria-hidden="true">
      <span className="vote-btn vote-up">{THUMBS_UP_ICON}</span>
      <span className="vote-btn vote-down">
        <span className="vote-icon-wrap vote-icon-down">{THUMBS_UP_ICON}</span>
      </span>
    </div>
  );
}

const widgetTheme = {
  '--chat-primary': WIDGET_ACCENT,
  '--chat-primary-hover': '#d96f10',
  '--chat-primary-rgb': '240, 128, 26',
} as React.CSSProperties;

const USER_DELAY = 850;
const FOLLOW_UP_USER_DELAY = 1600;
const LOADING_DELAY = 1200;
const AGENT_DELAY = 950;
const END_PAUSE = 3000;
const FADE_DELAY = 520;
const MESSAGE_EXIT_MS = 420;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useMessageEnter() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.classList.add('message--enter');
    if (prefersReducedMotion()) {
      el.classList.add('message--visible');
      return;
    }

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.add('message--visible');
      });
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return ref;
}

function AnimatedMessage({
  role,
  children,
  className = '',
}: {
  role: 'user' | 'agent';
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useMessageEnter();

  return (
    <div ref={ref} className={`message ${role} ${className}`.trim()}>
      {children}
    </div>
  );
}

function AnimatedLoading({ exiting }: { exiting: boolean }) {
  const ref = useMessageEnter();

  useEffect(() => {
    const el = ref.current;
    if (!el || !exiting || prefersReducedMotion()) return;

    el.classList.remove('message--visible');
    el.classList.add('message--exit');
  }, [exiting, ref]);

  return (
    <div
      ref={ref}
      className="message agent loading-indicator"
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </div>
  );
}

export function HeroChatPreview() {
  const conversations = useRef(buildConversations());
  const [messages, setMessages] = useState<VisibleMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingExiting, setLoadingExiting] = useState(false);
  const [fading, setFading] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      const conv = conversations.current[0];
      setMessages(
        conv.turns.map((turn, i) => ({
          id: `static-${i}`,
          role: turn.role,
          text: turn.text,
          source: turn.role === 'agent' ? turn.source : undefined,
        }))
      );
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        schedule(resolve, ms);
      });

    const currentRun = ++runId.current;
    const isActive = () => currentRun === runId.current;

    const playConversation = async (convIndex: number) => {
      if (!isActive()) return;

      setFading(false);
      setMessages([]);
      setLoading(false);
      setLoadingExiting(false);

      await wait(400);
      if (!isActive()) return;

      const conv = conversations.current[convIndex];

      for (let i = 0; i < conv.turns.length; i++) {
        const turn = conv.turns[i];
        if (!isActive()) return;

        if (turn.role === 'user') {
          if (i > 0) {
            await wait(FOLLOW_UP_USER_DELAY);
            if (!isActive()) return;
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `${convIndex}-u-${i}`,
              role: 'user',
              text: turn.text,
            },
          ]);
          await wait(USER_DELAY);
        } else {
          setLoadingExiting(false);
          setLoading(true);
          await wait(LOADING_DELAY);
          if (!isActive()) return;
          setLoadingExiting(true);
          await wait(MESSAGE_EXIT_MS);
          if (!isActive()) return;
          setLoading(false);
          setLoadingExiting(false);
          setMessages((prev) => [
            ...prev,
            {
              id: `${convIndex}-a-${i}`,
              role: 'agent',
              text: turn.text,
              source: turn.source,
            },
          ]);
          await wait(AGENT_DELAY);
        }
      }

      await wait(END_PAUSE);
      if (!isActive()) return;

      setFading(true);
      await wait(FADE_DELAY);
    };

    const loop = async () => {
      let index = 0;
      while (isActive()) {
        await playConversation(index);
        if (!isActive()) return;
        index = (index + 1) % conversations.current.length;
      }
    };

    loop();

    return () => {
      runId.current += 1;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <div className="hero-chat">
      <div className="hero-widget-preview" style={widgetTheme}>
        <div
          className={`messages hero-widget-preview__messages ${fading ? 'hero-widget-preview__messages--fading' : ''}`}
          aria-live="polite"
        >
          {messages.map((msg) => (
            <AnimatedMessage key={msg.id} role={msg.role}>
              {msg.role === 'agent' ? (
                <>
                  <div className="message-body">
                    <p>{msg.text}</p>
                    {msg.source && (
                      <p className="message-source">{msg.source}</p>
                    )}
                  </div>
                  <VoteActions />
                </>
              ) : (
                <div className="message-body">
                  <p>{msg.text}</p>
                </div>
              )}
            </AnimatedMessage>
          ))}

          {loading && (
            <AnimatedLoading exiting={loadingExiting} />
          )}
        </div>
      </div>

      <div className="hero-chat__footer">
        <p className="hero-chat__note mono-label">
          <span className="mono-label--accent">&gt;&gt;&gt;</span> Live widget preview
        </p>
        <button type="button" className="hero-chat__try mono-label" onClick={openWidget}>
          Try it live ↗
        </button>
      </div>
    </div>
  );
}
