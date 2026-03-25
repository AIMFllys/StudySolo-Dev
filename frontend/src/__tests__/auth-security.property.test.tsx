import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import {
  clearRememberedCredentials,
  loadRememberedCredentials,
  saveRememberedCredentials,
} from '@/services/auth-credentials.service';

const STORAGE_KEY = 'studysolo:remembered-credentials';

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe('auth security hardening', () => {
  const originalWindow = globalThis.window;
  const localStorage = createLocalStorageMock();

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });
    localStorage.clear();
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window');
      return;
    }

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  it('remember me only persists email and remember flag', () => {
    saveRememberedCredentials('safe@example.com');

    const saved = loadRememberedCredentials();
    const raw = globalThis.window.localStorage.getItem(STORAGE_KEY);

    expect(saved).toMatchObject({
      email: 'safe@example.com',
      remember: true,
    });
    expect(raw).toContain('"email":"safe@example.com"');
    expect(raw).not.toContain('password');
  });

  it('legacy remembered password payload is cleared instead of reused', () => {
    globalThis.window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        email: 'legacy@example.com',
        password: 'plaintext-password',
        remember: true,
        updatedAt: Date.now(),
      }),
    );

    expect(loadRememberedCredentials()).toBeNull();
    expect(globalThis.window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('markdown rendering escapes raw html while preserving markdown and math', () => {
    const html = renderToStaticMarkup(
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {'# Title\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n**bold** $E=mc^2$'}
      </ReactMarkdown>,
    );

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('katex');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('clearRememberedCredentials removes saved data completely', () => {
    saveRememberedCredentials('safe@example.com');
    clearRememberedCredentials();
    expect(globalThis.window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
