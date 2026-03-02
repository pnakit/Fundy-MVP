/**
 * Text chunking utilities for converting stored data into embeddable chunks.
 * Used by the embedding ingestion pipeline and seed script.
 */

/**
 * Chunk conversation messages into embedding-ready text blocks.
 * Strategy: message-pair windows (user + assistant), with 1-message overlap for context.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {{workflow: string, category_id?: string}} conversation
 * @returns {Array<{content: string, chunk_index: number, metadata: object}>}
 */
export function chunkConversation(messages, conversation) {
  if (!messages || messages.length === 0) return [];

  const chunks = [];
  let chunkIndex = 0;

  for (let i = 0; i < messages.length; i += 2) {
    const userMsg = messages[i];
    const assistantMsg = messages[i + 1];

    let content = '';

    // Add overlap from previous assistant message for context
    if (i > 0 && messages[i - 1]) {
      content += `[Previous context] Assistant: ${truncate(messages[i - 1].content, 200)}\n\n`;
    }

    content += `User: ${userMsg.content}`;
    if (assistantMsg) {
      content += `\nAssistant: ${assistantMsg.content}`;
    }

    chunks.push({
      content,
      chunk_index: chunkIndex,
      metadata: {
        workflow: conversation.workflow,
        category_id: conversation.category_id || null,
        message_range: [i, assistantMsg ? i + 1 : i],
      },
    });
    chunkIndex++;
  }

  return chunks;
}

/**
 * Chunk an onboarding summary into per-category embedding text.
 * Strategy: one chunk per category (10 chunks for a full summary).
 *
 * @param {object} summaryData - The summary_data JSONB from onboarding_summaries
 * @returns {Array<{content: string, chunk_index: number, metadata: object}>}
 */
export function chunkSummary(summaryData) {
  if (!summaryData?.categories) return [];

  return summaryData.categories.map((cat, index) => {
    const lines = [
      `Category: ${cat.title}`,
      `Completeness: ${cat.completeness}%`,
      `Summary: ${cat.summary}`,
    ];

    if (cat.highlights?.length) {
      lines.push(`Highlights: ${cat.highlights.join('; ')}`);
    }
    if (cat.gaps?.length) {
      lines.push(`Gaps: ${cat.gaps.join('; ')}`);
    }
    if (cat.keyMetrics && Object.keys(cat.keyMetrics).length > 0) {
      const metrics = Object.entries(cat.keyMetrics)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      lines.push(`Key Metrics: ${metrics}`);
    }

    return {
      content: lines.join('\n'),
      chunk_index: index,
      metadata: {
        category_id: cat.id,
        completeness: cat.completeness,
      },
    };
  });
}

/**
 * Chunk file text into fixed-size windows with overlap.
 * Strategy: ~2000 character windows with ~400 character overlap.
 *
 * @param {string} text - The extracted text content
 * @param {{file_name: string}} fileMeta - File metadata
 * @returns {Array<{content: string, chunk_index: number, metadata: object}>}
 */
export function chunkFileText(text, fileMeta) {
  if (!text || text.trim().length === 0) return [];

  const WINDOW_SIZE = 2000;
  const OVERLAP = 400;
  const STEP = WINDOW_SIZE - OVERLAP;

  const chunks = [];
  let chunkIndex = 0;
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + WINDOW_SIZE, text.length);
    const content = text.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push({
        content,
        chunk_index: chunkIndex,
        metadata: {
          file_name: fileMeta.file_name,
          char_range: [start, end],
        },
      });
      chunkIndex++;
    }

    start += STEP;

    // Avoid creating a tiny final chunk
    if (start < text.length && text.length - start < OVERLAP) {
      break;
    }
  }

  return chunks;
}

function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '';
  return text.slice(0, maxLen) + '...';
}
