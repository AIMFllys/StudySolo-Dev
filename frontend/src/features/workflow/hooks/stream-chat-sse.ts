export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onToken: (t: string) => void,
): Promise<{ fullText: string; intent: string }> {
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let intent = 'CHAT';

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
      if (raw === '[DONE]') { await reader.cancel(); return { fullText, intent }; }

      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed.intent) intent = parsed.intent as string;

        if (parsed.done && (intent === 'MODIFY' || intent === 'BUILD')) {
          fullText = JSON.stringify(parsed);
          await reader.cancel();
          return { fullText, intent };
        }

        if (parsed.token) {
          const token = parsed.token as string;
          fullText += token;
          onToken(token);
        }

        if (parsed.done) { await reader.cancel(); return { fullText, intent }; }
      } catch { /* partial JSON, skip */ }
    }
  }

  return { fullText, intent };
}
