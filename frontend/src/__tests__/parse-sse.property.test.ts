/**
 * Property tests for parse-sse.ts — SSE buffer parsing.
 */
import { describe, it, expect } from 'vitest';
import { extractSseEvents } from '@/features/workflow/utils/parse-sse';

describe('extractSseEvents', () => {
  it('parses a single complete event', () => {
    const buffer = 'event: node_status\ndata: {"node_id":"n1"}\n\n';
    const { events, remainder } = extractSseEvents(buffer);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('node_status');
    expect(events[0].data).toBe('{"node_id":"n1"}');
    expect(remainder).toBe('');
  });

  it('returns remainder for incomplete event', () => {
    const buffer = 'event: node_status\ndata: {"node_id":"n1"}';
    const { events, remainder } = extractSseEvents(buffer);
    expect(events).toHaveLength(0);
    expect(remainder).toContain('node_status');
  });

  it('parses multiple events', () => {
    const buffer =
      'event: a\ndata: 1\n\nevent: b\ndata: 2\n\n';
    const { events, remainder } = extractSseEvents(buffer);
    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('a');
    expect(events[1].event).toBe('b');
    expect(remainder).toBe('');
  });

  it('handles \\r\\n line endings', () => {
    const buffer = 'event: test\r\ndata: ok\r\n\r\n';
    const { events } = extractSseEvents(buffer);
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('ok');
  });

  it('defaults event to message when no event field', () => {
    const buffer = 'data: hello\n\n';
    const { events } = extractSseEvents(buffer);
    expect(events[0].event).toBe('message');
  });

  it('ignores comment lines', () => {
    const buffer = ': comment\ndata: real\n\n';
    const { events } = extractSseEvents(buffer);
    expect(events).toHaveLength(1);
    expect(events[0].data).toBe('real');
  });

  it('joins multi-line data', () => {
    const buffer = 'data: line1\ndata: line2\n\n';
    const { events } = extractSseEvents(buffer);
    expect(events[0].data).toBe('line1\nline2');
  });

  it('skips segments with no data', () => {
    const buffer = 'event: empty\n\n';
    const { events } = extractSseEvents(buffer);
    expect(events).toHaveLength(0);
  });

  it('handles empty buffer', () => {
    const { events, remainder } = extractSseEvents('');
    expect(events).toHaveLength(0);
    expect(remainder).toBe('');
  });

  it('handles mixed complete and incomplete', () => {
    const buffer = 'event: a\ndata: 1\n\nevent: b\ndata: partial';
    const { events, remainder } = extractSseEvents(buffer);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('a');
    expect(remainder).toContain('partial');
  });
});
