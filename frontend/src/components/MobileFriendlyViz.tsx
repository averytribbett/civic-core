import { useEffect, useRef, useState } from 'react';
import { buildDemoConversations } from '../lib/demoConversations';
import { chunkTextForStream } from '../lib/streamChunks';
import { WIDGET_ACCENT } from '../lib/widgetConfig';
import './HeroChatPreview.css';
import './MobileFriendlyViz.css';

type VisibleMessage = {
  id: string;
  role: 'user' | 'agent';
  text: string;
  source?: string;
  streaming?: boolean;
};

type StatusPhase = 'thinking' | 'searching' | null;

const widgetTheme = {
  '--chat-primary': WIDGET_ACCENT,
  '--chat-primary-hover': '#d96f10',
  '--chat-primary-rgb': '240, 128, 26',
} as React.CSSProperties;

const FOLLOW_UP_USER_DELAY = 1600;
const STATUS_SEARCH_DELAY_MS = 1100;
const PRE_STREAM_DELAY = 550;
const TOKEN_DELAY_MS = 28;
const AGENT_DELAY = 950;
const END_PAUSE = 3000;
const FADE_DELAY = 520;
const TYPE_MS = 38;
const SEND_PAUSE = 420;
const POST_SEND_DELAY = 650;

const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'delete'],
  ['123', 'space', 'return'],
];

const VOTE_ICON = (
  <svg
    className="vote-icon"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);

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

function ChatStatus({ phase }: { phase: 'thinking' | 'searching' }) {
  return (
    <div className="chat-status" role="status">
      <span className="chat-status-label">
        {phase === 'thinking' ? 'Thinking' : 'Searching'}
      </span>
      <span className="chat-status-ellipsis" aria-hidden="true" />
    </div>
  );
}

function IphoneKeyboard({
  activeKey,
  shift,
}: {
  activeKey: string | null;
  shift: boolean;
}) {
  return (
    <div className="iphone-keyboard" aria-hidden="true">
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="iphone-keyboard__row">
          {row.map((key) => {
            const display =
              key.length === 1 ? (shift ? key.toUpperCase() : key) : key;
            const isActive =
              (key === 'shift' && shift && !activeKey) ||
              (activeKey !== null &&
                (key === activeKey ||
                  (key.length === 1 &&
                    key.toLowerCase() === activeKey.toLowerCase()) ||
                  (key === 'space' && activeKey === ' ') ||
                  (key === 'return' && activeKey === 'return')));

            return (
              <span
                key={key}
                className={[
                  'iphone-keyboard__key',
                  key.length > 1 ? `iphone-keyboard__key--${key}` : '',
                  isActive ? 'iphone-keyboard__key--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {key === 'space'
                  ? 'space'
                  : key === 'delete'
                    ? '⌫'
                    : key === 'shift'
                      ? '⇧'
                      : key === 'return'
                        ? 'return'
                        : display}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function keyForChar(char: string): string {
  if (char === ' ') return ' ';
  return char.toLowerCase();
}

export function MobileFriendlyViz() {
  const conversations = useRef(buildDemoConversations());
  const [messages, setMessages] = useState<VisibleMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [shift, setShift] = useState(true);
  const [status, setStatus] = useState<StatusPhase>(null);
  const [fading, setFading] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const runId = useRef(0);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, status, draft]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      const conv = conversations.current[0];
      setMessages(
        conv.turns.map((turn, i) => ({
          id: `static-${i}`,
          role: turn.role,
          text: turn.text,
          source: turn.role === 'agent' ? turn.source : undefined,
        }))
      );
      setDraft('');
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

    const typeQuestion = async (text: string) => {
      setDraft('');
      setShift(true);

      for (let i = 0; i < text.length; i++) {
        if (!isActive()) return;
        const char = text[i];
        const key = keyForChar(char);
        setActiveKey(key === ' ' ? ' ' : key);
        setDraft(text.slice(0, i + 1));
        if (i === 0) setShift(false);
        await wait(TYPE_MS);
        if (!isActive()) return;
        setActiveKey(null);
        await wait(18);
      }

      setActiveKey('return');
      await wait(SEND_PAUSE);
      if (!isActive()) return;
      setActiveKey(null);
      setDraft('');
    };

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
      setDraft('');
      setActiveKey(null);
      setShift(true);
      setStatus(null);

      await wait(500);
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

          await typeQuestion(turn.text);
          if (!isActive()) return;

          setMessages((prev) => [
            ...prev,
            {
              id: `${convIndex}-u-${i}`,
              role: 'user',
              text: turn.text,
            },
          ]);
          await wait(POST_SEND_DELAY);
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

  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());

  return (
    <div className="mobile-friendly-viz" aria-hidden="true">
      <div className="iphone">
        <div className="iphone__frame">
          <div className="iphone__island" />
          <div className="iphone__screen" style={widgetTheme}>
            <div className="iphone__status">
              <span className="iphone__time">{timeLabel}</span>
              <span className="iphone__status-icons">
                <span className="iphone__signal" />
                <span className="iphone__battery" />
              </span>
            </div>

            <div className="hero-widget-preview iphone__chat">
              <div
                ref={messagesRef}
                className={`messages hero-widget-preview__messages ${fading ? 'hero-widget-preview__messages--fading' : ''}`}
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
                        {!msg.streaming && (
                          <div className="message-actions">
                            <span className="vote-btn vote-up">{VOTE_ICON}</span>
                            <span className="vote-btn vote-down">
                              <span className="vote-icon-wrap vote-icon-down">
                                {VOTE_ICON}
                              </span>
                            </span>
                          </div>
                        )}
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

            <div className="iphone__composer">
              <div className="iphone__input">
                {draft ? (
                  <>
                    {draft}
                    <span className="iphone__caret" />
                  </>
                ) : (
                  <span className="iphone__placeholder">Message</span>
                )}
              </div>
              <span
                className={`iphone__send ${draft ? 'iphone__send--ready' : ''}`}
              >
                ↑
              </span>
            </div>

            <IphoneKeyboard activeKey={activeKey} shift={shift} />
            <div className="iphone__home" />
          </div>
        </div>
      </div>
    </div>
  );
}
