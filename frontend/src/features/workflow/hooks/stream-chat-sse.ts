/**
 * Parser for the unified `/api/ai/chat-stream` SSE protocol.
 *
 * Two protocols are supported:
 *  1. Legacy "token-only" stream (used by BUILD/ACTION/LEGACY fallback):
 *     `{ token, intent, done, full, actions }`
 *  2. Agent-loop XML protocol (current default):
 *     - `{ event: "agent_start" | "round_start" | ... }`
 *     - `{ event: "segment_start" | "segment_delta" | "segment_end", tag, delta }`
 *     - `{ event: "tool_call" | "tool_result" }`
 *     - `{ event: "canvas_mutation", workflow_id, nodes, edges }`
 *     - `{ event: "ui_effect", type, url }`
 *     - `{ event: "agent_end", done }`
 *
 * Callers pass in an `onEvent` callback to react in real time; at the end,
 * the parser returns the raw concatenated `<answer>` text plus a list of
 * segments for display so the assistant message can be persisted.
 */

export type AgentSegmentKind =
  | 'thinking'
  | 'answer'
  | 'summary'
  | 'plan'
  | 'plan.analysis'
  | 'plan.recommendations'
  | 'plan.response'
  | 'plan.step'
  | 'tool_call'
  | 'warning';

export interface ToolCallSegment {
  id: string;
  kind: 'tool_call';
  tool: string;
  params: unknown;
  status: 'running' | 'ok' | 'error';
  result?: unknown;
  error?: string;
}

export interface TextSegment {
  id: string;
  kind: Exclude<AgentSegmentKind, 'tool_call'>;
  text: string;
  attrs?: Record<string, string>;
}

export type AgentSegment = TextSegment | ToolCallSegment;

export interface SummaryChange {
  text: string;
}

export interface AgentStreamEvent {
  type:
    | 'agent_start'
    | 'segment_start'
    | 'segment_delta'
    | 'segment_end'
    | 'tool_call'
    | 'tool_result'
    | 'canvas_mutation'
    | 'ui_effect'
    | 'warning'
    | 'agent_end'
    | 'token'
    | 'legacy_done';
  payload: Record<string, unknown>;
}

export interface ParseSSEOutput {
  fullText: string;
  intent: string;
  segments: AgentSegment[];
  summary: SummaryChange[];
}

export interface SSEStreamHandlers {
  onToken: (token: string) => void;
  onEvent?: (event: AgentStreamEvent) => void;
  /** Called whenever the accumulated segment list changes. */
  onSegments?: (segments: AgentSegment[]) => void;
  onSummary?: (summary: SummaryChange[]) => void;
}

type EventCallback = (event: AgentStreamEvent) => void;

function newId() {
  return `seg-${Math.random().toString(36).slice(2, 10)}`;
}

export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onTokenOrHandlers: ((t: string) => void) | SSEStreamHandlers,
  onEventLegacy?: EventCallback,
): Promise<ParseSSEOutput> {
  const handlers: SSEStreamHandlers =
    typeof onTokenOrHandlers === 'function'
      ? { onToken: onTokenOrHandlers, onEvent: onEventLegacy }
      : onTokenOrHandlers;
  const onToken = handlers.onToken;
  const onEvent = handlers.onEvent;
  const onSegments = handlers.onSegments;
  const onSummary = handlers.onSummary;
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let intent = 'CHAT';

  const segments: AgentSegment[] = [];
  const segmentByTag = new Map<string, TextSegment>();
  const toolCallById = new Map<string, ToolCallSegment>();
  const summary: SummaryChange[] = [];

  let segmentsDirty = false;
  let summaryDirty = false;
  const flushSnapshots = () => {
    if (segmentsDirty && onSegments) {
      onSegments([...segments]);
      segmentsDirty = false;
    }
    if (summaryDirty && onSummary) {
      onSummary([...summary]);
      summaryDirty = false;
    }
  };

  const upsertTextSegment = (
    tag: AgentSegmentKind,
    attrs: Record<string, string> | undefined,
    delta: string,
  ) => {
    if (tag === 'tool_call') return;
    let seg = segmentByTag.get(tag);
    if (!seg) {
      seg = { id: newId(), kind: tag, text: delta, attrs };
      segmentByTag.set(tag, seg);
      segments.push(seg);
    } else {
      seg.text += delta;
    }
    segmentsDirty = true;
    return seg;
  };

  const finishTextSegment = (tag: AgentSegmentKind) => {
    if (tag === 'tool_call') return;
    const seg = segmentByTag.get(tag);
    if (seg && tag === 'summary') {
      // Parse <change>...</change> entries out of the completed block.
      const raw = seg.text;
      const matches = raw.matchAll(/<change>([\s\S]*?)<\/change>/g);
      summary.length = 0;
      for (const m of matches) {
        if (m[1]) summary.push({ text: m[1].trim() });
      }
      summaryDirty = true;
    }
    segmentByTag.delete(tag);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const raw = trimmed.slice(5).trim();
      if (raw === '[DONE]') {
        await reader.cancel();
        return { fullText, intent, segments, summary };
      }

      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const evtType = parsed.event as string | undefined;

        if (evtType) {
          switch (evtType) {
            case 'agent_start': {
              intent = 'AGENT';
              onEvent?.({ type: 'agent_start', payload: parsed });
              break;
            }
            case 'segment_start': {
              const tag = parsed.tag as AgentSegmentKind;
              const attrs = parsed.attrs as Record<string, string> | undefined;
              upsertTextSegment(tag, attrs, '');
              onEvent?.({ type: 'segment_start', payload: parsed });
              break;
            }
            case 'segment_delta': {
              const tag = parsed.tag as AgentSegmentKind;
              const delta = (parsed.delta as string) ?? '';
              upsertTextSegment(tag, undefined, delta);
              if (tag === 'answer') {
                fullText += delta;
                onToken(delta);
              }
              onEvent?.({ type: 'segment_delta', payload: parsed });
              break;
            }
            case 'segment_end': {
              const tag = parsed.tag as AgentSegmentKind;
              finishTextSegment(tag);
              onEvent?.({ type: 'segment_end', payload: parsed });
              break;
            }
            case 'tool_call': {
              const callId = (parsed.call_id as string) ?? newId();
              const seg: ToolCallSegment = {
                id: callId,
                kind: 'tool_call',
                tool: (parsed.tool as string) ?? '',
                params: parsed.params,
                status: 'running',
              };
              toolCallById.set(callId, seg);
              segments.push(seg);
              segmentsDirty = true;
              onEvent?.({ type: 'tool_call', payload: parsed });
              break;
            }
            case 'tool_result': {
              const callId = (parsed.call_id as string) ?? '';
              const seg = toolCallById.get(callId);
              const ok = parsed.ok as boolean;
              if (seg) {
                seg.status = ok ? 'ok' : 'error';
                seg.result = parsed.data;
                seg.error = parsed.error as string | undefined;
                segmentsDirty = true;
              }
              onEvent?.({ type: 'tool_result', payload: parsed });
              break;
            }
            case 'canvas_mutation': {
              onEvent?.({ type: 'canvas_mutation', payload: parsed });
              break;
            }
            case 'ui_effect': {
              onEvent?.({ type: 'ui_effect', payload: parsed });
              break;
            }
            case 'warning': {
              onEvent?.({ type: 'warning', payload: parsed });
              break;
            }
            case 'agent_end':
            case 'llm_done_tag': {
              onEvent?.({ type: 'agent_end', payload: parsed });
              break;
            }
            case 'round_start':
            default:
              // Informational; ignore.
              break;
          }
          continue;
        }

        // ── Legacy protocol branch ─────────────────────────────
        if (parsed.intent) intent = parsed.intent as string;

        if (parsed.done && (intent === 'MODIFY' || intent === 'BUILD')) {
          fullText = JSON.stringify(parsed);
          onEvent?.({ type: 'legacy_done', payload: parsed });
          await reader.cancel();
          return { fullText, intent, segments, summary };
        }

        if (parsed.token) {
          const token = parsed.token as string;
          fullText += token;
          onToken(token);
          onEvent?.({ type: 'token', payload: { token } });
        }

        if (parsed.done) {
          onEvent?.({ type: 'legacy_done', payload: parsed });
          await reader.cancel();
          return { fullText, intent, segments, summary };
        }
      } catch {
        // partial JSON, skip
      }
    }
    flushSnapshots();
  }

  flushSnapshots();
  return { fullText, intent, segments, summary };
}
