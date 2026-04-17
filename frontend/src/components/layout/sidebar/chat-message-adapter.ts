import { parseThinking } from '@/features/workflow/utils/parse-thinking';
import type {
  ChatEntry,
  ChatSegment,
  ChatSummaryChange,
} from '@/stores/chat/use-conversation-store';

const SUGGEST_MODE_RE = /\[SUGGEST_MODE:([a-zA-Z0-9_-]+)\]/i;
const SUGGEST_MODE_MARKER_RE = /\[SUGGEST_MODE:[a-zA-Z0-9_-]+\]/gi;

export interface ChatMessageRenderModel {
  segments: ChatSegment[];
  summary?: ChatSummaryChange[];
  suggestMode: string | null;
  hasPlan: boolean;
  rawPlanContent: string;
}

export function extractSuggestMode(text: string): string | null {
  return text.match(SUGGEST_MODE_RE)?.[1]?.toLowerCase() ?? null;
}

export function stripSuggestModeMarker(text: string): string {
  return text.replace(SUGGEST_MODE_MARKER_RE, '').trim();
}

function isTextSegment(seg: ChatSegment): seg is Extract<ChatSegment, { text: string }> {
  return 'text' in seg;
}

function segmentText(seg: ChatSegment): string {
  return isTextSegment(seg) ? seg.text : '';
}

function collectText(segments: ChatSegment[]): string {
  return segments.map(segmentText).filter(Boolean).join('\n');
}

function hasPlanSegment(segments: ChatSegment[]): boolean {
  return segments.some((seg) => typeof seg.kind === 'string' && seg.kind.startsWith('plan'));
}

function legacySegments(entry: ChatEntry): { segments: ChatSegment[]; answer: string } {
  const parsed = parseThinking(entry.content);
  const segments: ChatSegment[] = [];
  if (parsed.hasThinking) {
    segments.push({
      id: `${entry.id}-thinking`,
      kind: 'thinking',
      text: parsed.thinking,
    });
  }
  if (parsed.answer.trim()) {
    segments.push({
      id: `${entry.id}-answer`,
      kind: 'answer',
      text: parsed.answer,
    });
  }
  return { segments, answer: parsed.answer };
}

export function adaptChatMessage(entry: ChatEntry): ChatMessageRenderModel {
  if (Array.isArray(entry.segments) && entry.segments.length > 0) {
    const text = collectText(entry.segments);
    return {
      segments: entry.segments,
      summary: entry.summary,
      suggestMode: extractSuggestMode(text),
      hasPlan: hasPlanSegment(entry.segments),
      rawPlanContent: '',
    };
  }

  const { segments, answer } = legacySegments(entry);
  const hasPlan = answer.includes('<plan>');
  return {
    segments,
    summary: entry.summary,
    suggestMode: extractSuggestMode(answer),
    hasPlan,
    rawPlanContent: hasPlan ? answer : '',
  };
}
