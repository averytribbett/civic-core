import { useEffect, useState } from 'react';

const DEFAULTS = {
  typeMs: 55,
  deleteMs: 35,
  pauseMs: 2200,
};

export function useTypewriter(
  phrases: string[],
  { typeMs = DEFAULTS.typeMs, deleteMs = DEFAULTS.deleteMs, pauseMs = DEFAULTS.pauseMs } = {}
) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setText(phrases[0] ?? '');
      return;
    }

    const current = phrases[index] ?? '';
    let delay = deleting ? deleteMs : typeMs;

    if (!deleting && text === current) {
      delay = pauseMs;
    }

    const timer = window.setTimeout(() => {
      if (!deleting && text === current) {
        setDeleting(true);
        return;
      }

      if (deleting) {
        if (text.length === 0) {
          setDeleting(false);
          setIndex((i) => (i + 1) % phrases.length);
          return;
        }
        setText(current.slice(0, text.length - 1));
        return;
      }

      setText(current.slice(0, text.length + 1));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [text, deleting, index, phrases, typeMs, deleteMs, pauseMs]);

  return text;
}
