'use client';

import { useEffect } from 'react';
import { Zap, RefreshCcw } from 'lucide-react';
import Link from 'next/link';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center bg-background overflow-hidden">
      {/* Background decorative */}
      <div className="absolute top-1/3 left-1/4 w-[350px] h-[350px] rounded-full bg-destructive/5 blur-[120px] pointer-events-none" />

      {/* Logo */}
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-5 h-5 text-primary fill-primary/20" />
        <span className="text-base font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          StudySolo
        </span>
      </div>

      {/* Error icon + message */}
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
        <span className="text-3xl" aria-hidden="true">⚠️</span>
      </div>

      <h2 className="text-xl font-bold text-foreground">出了点问题</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {error.message || '发生了未知错误，请稍后重试。'}
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 shadow-glow transition-all active:scale-[0.98]"
        >
          <RefreshCcw className="w-4 h-4" />
          重试
        </button>
        <Link
          href="/"
          className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
