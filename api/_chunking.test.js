import { describe, it, expect } from 'vitest';
import { chunkConversation, chunkSummary, chunkFileText } from './_chunking.js';

describe('chunkConversation', () => {
  it('returns empty array for empty messages', () => {
    expect(chunkConversation([], { workflow: 'onboarding' })).toEqual([]);
    expect(chunkConversation(null, { workflow: 'onboarding' })).toEqual([]);
  });

  it('handles a single user message (no assistant reply)', () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    const chunks = chunkConversation(messages, { workflow: 'onboarding' });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('User: Hello');
    expect(chunks[0].chunk_index).toBe(0);
    expect(chunks[0].metadata.workflow).toBe('onboarding');
    expect(chunks[0].metadata.message_range).toEqual([0, 0]);
  });

  it('chunks a user+assistant pair', () => {
    const messages = [
      { role: 'user', content: 'What is your product?' },
      { role: 'assistant', content: 'We build AI tools.' },
    ];
    const chunks = chunkConversation(messages, { workflow: 'onboarding' });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('User: What is your product?');
    expect(chunks[0].content).toContain('Assistant: We build AI tools.');
    expect(chunks[0].metadata.message_range).toEqual([0, 1]);
  });

  it('adds overlap from previous assistant message', () => {
    const messages = [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
      { role: 'user', content: 'Second question' },
      { role: 'assistant', content: 'Second answer' },
    ];
    const chunks = chunkConversation(messages, { workflow: 'deepdive', category_id: 'product_technology' });
    expect(chunks).toHaveLength(2);

    // First chunk has no overlap
    expect(chunks[0].content).not.toContain('[Previous context]');

    // Second chunk has overlap from first assistant message
    expect(chunks[1].content).toContain('[Previous context]');
    expect(chunks[1].content).toContain('First answer');
    expect(chunks[1].metadata.category_id).toBe('product_technology');
    expect(chunks[1].metadata.message_range).toEqual([2, 3]);
  });

  it('truncates long overlap context', () => {
    const longContent = 'A'.repeat(500);
    const messages = [
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: longContent },
      { role: 'user', content: 'Q2' },
      { role: 'assistant', content: 'A2' },
    ];
    const chunks = chunkConversation(messages, { workflow: 'onboarding' });
    // Overlap should be truncated to ~200 chars + "..."
    const overlapPart = chunks[1].content.split('\n\n')[0];
    expect(overlapPart.length).toBeLessThan(250);
    expect(overlapPart).toContain('...');
  });

  it('sets null category_id for onboarding conversations', () => {
    const messages = [{ role: 'user', content: 'Hi' }];
    const chunks = chunkConversation(messages, { workflow: 'onboarding' });
    expect(chunks[0].metadata.category_id).toBeNull();
  });
});

describe('chunkSummary', () => {
  it('returns empty array for null/missing summary', () => {
    expect(chunkSummary(null)).toEqual([]);
    expect(chunkSummary({})).toEqual([]);
    expect(chunkSummary({ categories: null })).toEqual([]);
  });

  it('creates one chunk per category', () => {
    const summary = {
      categories: [
        {
          id: 'product_technology',
          title: 'Product & Technology',
          summary: 'Strong tech foundation.',
          completeness: 85,
          highlights: ['ML pipeline', 'API-first'],
          gaps: ['No patents'],
          keyMetrics: { techStackMaturity: 'Advanced' },
        },
        {
          id: 'market_traction',
          title: 'Market Traction',
          summary: 'Growing MRR.',
          completeness: 72,
          highlights: ['$45K MRR'],
          gaps: ['TAM incomplete'],
          keyMetrics: { mrr: '$45K' },
        },
      ],
    };

    const chunks = chunkSummary(summary);
    expect(chunks).toHaveLength(2);

    // First chunk
    expect(chunks[0].content).toContain('Category: Product & Technology');
    expect(chunks[0].content).toContain('Completeness: 85%');
    expect(chunks[0].content).toContain('Highlights: ML pipeline; API-first');
    expect(chunks[0].content).toContain('Gaps: No patents');
    expect(chunks[0].content).toContain('Key Metrics: techStackMaturity=Advanced');
    expect(chunks[0].chunk_index).toBe(0);
    expect(chunks[0].metadata.category_id).toBe('product_technology');
    expect(chunks[0].metadata.completeness).toBe(85);

    // Second chunk
    expect(chunks[1].chunk_index).toBe(1);
    expect(chunks[1].metadata.category_id).toBe('market_traction');
  });

  it('handles categories with missing optional fields', () => {
    const summary = {
      categories: [
        {
          id: 'operations',
          title: 'Operations',
          summary: 'Lean ops.',
          completeness: 40,
          highlights: [],
          gaps: [],
          keyMetrics: {},
        },
      ],
    };

    const chunks = chunkSummary(summary);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).not.toContain('Highlights');
    expect(chunks[0].content).not.toContain('Gaps');
    expect(chunks[0].content).not.toContain('Key Metrics');
  });
});

describe('chunkFileText', () => {
  it('returns empty array for empty/null text', () => {
    expect(chunkFileText('', { file_name: 'test.pdf' })).toEqual([]);
    expect(chunkFileText(null, { file_name: 'test.pdf' })).toEqual([]);
    expect(chunkFileText('   ', { file_name: 'test.pdf' })).toEqual([]);
  });

  it('creates single chunk for short text', () => {
    const text = 'Short document content.';
    const chunks = chunkFileText(text, { file_name: 'doc.pdf' });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('Short document content.');
    expect(chunks[0].chunk_index).toBe(0);
    expect(chunks[0].metadata.file_name).toBe('doc.pdf');
  });

  it('creates overlapping chunks for long text', () => {
    // 5000 chars → should produce ~3 chunks (2000 window, 400 overlap, 1600 step)
    const text = 'A'.repeat(5000);
    const chunks = chunkFileText(text, { file_name: 'long.pdf' });
    expect(chunks.length).toBeGreaterThan(1);

    // Each chunk (except possibly last) should be ~2000 chars
    expect(chunks[0].content.length).toBe(2000);

    // Verify overlap: chunk 1 starts at 1600, chunk 0 covers 0-2000
    // So chars 1600-2000 should appear in both
    expect(chunks[0].metadata.char_range[1]).toBeGreaterThan(chunks[1].metadata.char_range[0]);

    // Chunk indices are sequential
    chunks.forEach((chunk, i) => {
      expect(chunk.chunk_index).toBe(i);
    });
  });

  it('avoids creating tiny final chunks', () => {
    // Text that would leave a very small remainder
    const text = 'B'.repeat(2200); // 2200 chars: first chunk 0-2000, remainder 200 < overlap 400
    const chunks = chunkFileText(text, { file_name: 'edge.pdf' });
    // Should produce 2 chunks (the second includes the small tail), not 3
    expect(chunks.length).toBeLessThanOrEqual(2);
  });
});
