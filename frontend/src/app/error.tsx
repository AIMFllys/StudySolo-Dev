'use client';

import { useEffect } from 'react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-4xl" aria-hidden="true">⚠️</span>
      <h2 className="text-lg font-semibold">出了点问题</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {error.message || '发生了未知错误，请稍后重试。'}
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        重试
      </button>
    </div>
  );
}
