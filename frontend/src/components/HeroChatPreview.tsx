import { useEffect, useRef, useState } from 'react';
import {
  buildDemoConversations,
  type Conversation,
} from '../lib/demoConversations';
import { DEMO_BOOKING_URL } from '../lib/siteConfig';
import { chunkTextForStream } from '../lib/streamChunks';
import { WIDGET_ACCENT } from '../lib/widgetConfig';
import './HeroChatPreview.css';

type VisibleMessage = {
  id: string;
  role: 'user' | 'agent';
  text: string;
  source?: string;
  streaming?: boolean;
};

type StatusPhase = 'thinking' | 'searching' | null;

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

function ChatStatus({ phase }: { phase: 'thinking' | 'searching' }) {
  return (
    <div className="chat-status" role="status" aria-live="polite">
      <span className="chat-status-label">
        {phase === 'thinking' ? 'Thinking' : 'Searching'}
      </span>
      <span className="chat-status-ellipsis" aria-hidden="true" />
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
const STATUS_SEARCH_DELAY_MS = 1100;
const PRE_STREAM_DELAY = 550;
const TOKEN_DELAY_MS = 28;
const AGENT_DELAY = 950;
const END_PAUSE = 3000;
const FADE_DELAY = 520;

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

export function HeroChatPreview() {
  const conversations = useRef(buildDemoConversations());
  const [messages, setMessages] = useState<VisibleMessage[]>([]);
  const [status, setStatus] = useState<StatusPhase>(null);
  const [fading, setFading] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    const reduced = prefersReducedMotion();

    if (reduced) {
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

    const streamAgentReply = async (
      convIndex: number,
      turnIndex: number,
      text: string,
      source?: string
    ) => {
      setStatus('thinking');
      await wait(STATUS_SEARCH_DELAY_MS);
      if (!isActive()) return;

      setStatus('searching');
      await wait(PRE_STREAM_DELAY);
      if (!isActive()) return;

      setStatus(null);
      const id = `${convIndex}-a-${turnIndex}`;
      setMessages((prev) => [
        ...prev,
        { id, role: 'agent', text: '', streaming: true },
      ]);

      const chunks = chunkTextForStream(text);
      let accumulated = '';
      for (const chunk of chunks) {
        if (!isActive()) return;
        accumulated += chunk;
        const next = accumulated;
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text: next } : m))
        );
        await wait(TOKEN_DELAY_MS);
      }

      if (!isActive()) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, text, source, streaming: false } : m
        )
      );
      await wait(AGENT_DELAY);
    };

    const playConversation = async (convIndex: number) => {
      if (!isActive()) return;

      setFading(false);
      setMessages([]);
      setStatus(null);

      await wait(400);
      if (!isActive()) return;

      const conv: Conversation = conversations.current[convIndex];

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
          await streamAgentReply(convIndex, i, turn.text, turn.source);
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
            <AnimatedMessage
              key={msg.id}
              role={msg.role}
              className={msg.streaming ? 'message--streaming' : ''}
            >
              {msg.role === 'agent' ? (
                <>
                  <div className="message-body">
                    <p>{msg.text}</p>
                    {!msg.streaming && msg.source && (
                      <p className="message-source">{msg.source}</p>
                    )}
                  </div>
                  {!msg.streaming && <VoteActions />}
                </>
              ) : (
                <div className="message-body">
                  <p>{msg.text}</p>
                </div>
              )}
            </AnimatedMessage>
          ))}

          {status && <ChatStatus phase={status} />}
        </div>
      </div>

      <div className="hero-chat__footer">
        <p className="hero-chat__note mono-label">
          <span className="mono-label--accent">&gt;&gt;&gt;</span> Live widget preview
        </p>
        <a
          href={DEMO_BOOKING_URL || '#'}
          className="hero-chat__try mono-label"
          {...(DEMO_BOOKING_URL
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : undefined)}
        >
          Book a demo ↗
        </a>
      </div>
    </div>
  );
}
