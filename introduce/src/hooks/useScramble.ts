import { useState, useEffect, useCallback } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&';

export function useScramble(text: string, trigger: boolean, speed = 40) {
  const [display, setDisplay] = useState(text);

  const scramble = useCallback(() => {
    let iteration = 0;
    const maxIterations = text.length * 3;
    const interval = setInterval(() => {
      setDisplay(
        text
          .split('')
          .map((char, i) => {
            if (char === ' ') return ' ';
            if (i < Math.floor(iteration / 3)) return text[i];
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join('')
      );
      iteration++;
      if (iteration > maxIterations) {
        clearInterval(interval);
        setDisplay(text);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  useEffect(() => {
    if (trigger) {
      setDisplay(text);
      const cleanup = scramble();
      return cleanup;
    }
  }, [trigger, scramble, text]);

  return display;
}
