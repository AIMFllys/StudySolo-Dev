'use client';

import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki/bundle/web';

interface ShikiCodeBlockProps {
  code: string;
  lang: string;
}

/**
 * Code block with shiki syntax highlighting.
 * Uses dual themes (github-light / github-dark) and falls back to plain <pre> on failure.
 */
export default function ShikiCodeBlock({ code, lang }: ShikiCodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    codeToHtml(code, {
      lang: lang || 'text',
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
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-md text-xs [&_pre]:p-3"
      // Safe here because html comes only from shiki's codeToHtml output for plain code text.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
