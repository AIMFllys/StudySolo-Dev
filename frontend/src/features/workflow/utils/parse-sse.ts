export interface ParsedSseEvent {
  event: string;
  data: string;
}

export function extractSseEvents(buffer: string): {
  events: ParsedSseEvent[];
  remainder: string;
} {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const segments = normalized.split('\n\n');
  const remainder = segments.pop() ?? '';
  const events = segments
    .map((segment) => parseSseSegment(segment))
    .filter((event): event is ParsedSseEvent => event !== null);

  return { events, remainder };
}

function parseSseSegment(segment: string): ParsedSseEvent | null {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of segment.split('\n')) {
    if (!line || line.startsWith(':')) {
      continue;
    }

    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join('\n'),
  };
}
