/**
 * SSE Streaming Proxy for Workflow Execution — Next.js App Router API Route.
 *
 * WHY: Next.js `rewrites()` in dev mode (Turbopack) uses an HTTP proxy that
 * buffers the entire response body before forwarding. This kills SSE streaming.
 *
 * This route.ts creates a native Web Streams proxy that passes through SSE
 * events byte-by-byte from the FastAPI backend to the browser, with zero buffering.
 *
 * App Router route files take priority over rewrites, so this file intercepts
 * /api/workflow/{id}/execute while everything else continues through rewrites.
 *
 * Same pattern as /api/ai/chat-stream/route.ts — see that file for context.
 */

import { type NextRequest } from 'next/server';

const BACKEND_URL = (
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://127.0.0.1:2038'
).replace(/\/+$/, '');

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> },
) {
  const { workflowId } = await params;
  const body = await req.text();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const cookie = req.headers.get('cookie');
  if (cookie) headers['Cookie'] = cookie;

  const auth = req.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;

  try {
    const backendRes = await fetch(
      `${BACKEND_URL}/api/workflow/${workflowId}/execute`,
      {
        method: 'POST',
        headers,
        body,
        signal: req.signal,
      },
    );

    if (!backendRes.ok || !backendRes.body) {
      const errorBody = await backendRes.text();
      return new Response(errorBody, {
        status: backendRes.status,
        headers: {
          'Content-Type':
            backendRes.headers.get('Content-Type') || 'application/json',
        },
      });
    }

    // Stream the SSE response through without buffering
    return new Response(backendRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }
    console.error('[Workflow SSE Proxy] Backend unreachable:', err);
    return new Response(
      JSON.stringify({ detail: '后端服务不可达' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
