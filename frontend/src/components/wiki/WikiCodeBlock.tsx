'use client';

import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki/bundle/web';

interface WikiCodeBlockProps {
  code: string;
  lang?: string;
}

export default function WikiCodeBlock({ code, lang = 'text' }: WikiCodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    codeToHtml(code, {
      lang,
      themes: { light: 'github-light', dark: 'github-dark' },
    })
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (!html) {
    return (
      <pre className="overflow-x-auto rounded-xl border border-blue-100 bg-slate-50 p-5 text-sm text-slate-950">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-slate-200 text-sm [&_pre]:p-5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
