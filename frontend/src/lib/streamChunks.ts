/**
 * Split answer text into token-like pieces for marketing demos,
 * approximating LLM SSE deltas the live widget consumes.
 */
export function chunkTextForStream(text: string): string[] {
  const pieces = text.match(/\s+|\S+/g);
  if (!pieces) return text ? [text] : [];

  const chunks: string[] = [];
  let buffer = '';

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    buffer += piece;

    const trimmed = buffer.trim();
    const next = pieces[i + 1];
    const nextIsSpace = next !== undefined && /^\s+$/.test(next);
    const isPunctuation = /^[.,;:!?)]$/.test(piece);
    const longEnough = trimmed.length >= 4;
    const veryLongWord = piece.length > 10;

    if (veryLongWord) {
      // Break long tokens into smaller deltas (closer to model tokens)
      const content = buffer;
      buffer = '';
      for (let j = 0; j < content.length; ) {
        const size = Math.min(3 + (j % 4), content.length - j);
        chunks.push(content.slice(j, j + size));
        j += size;
      }
      continue;
    }

    if (
      !nextIsSpace &&
      (longEnough || isPunctuation || trimmed.split(/\s+/).length >= 2)
    ) {
      chunks.push(buffer);
      buffer = '';
    }
  }

  if (buffer) chunks.push(buffer);
  return chunks.length > 0 ? chunks : [text];
}
