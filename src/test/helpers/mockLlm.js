import { vi } from 'vitest';

/**
 * Create a mock for the 'ai' module's generateObject function.
 * Returns predetermined responses based on category ID.
 *
 * Usage in tests:
 *   vi.mock('ai', () => createMockAI(fixtureData));
 */
export function createMockAI(categoryOutputs = {}, investmentOutput = null) {
  return {
    generateObject: vi.fn(async ({ messages }) => {
      // Detect which category is being evaluated from the user message
      const userMsg = messages.find((m) => m.role === 'user')?.content || '';
      for (const [catId, output] of Object.entries(categoryOutputs)) {
        if (userMsg.includes(catId)) {
          return { object: output };
        }
      }
      // Investment call (no category ID in message)
      if (investmentOutput && userMsg.includes('Investment Suitability Matrix')) {
        return { object: investmentOutput };
      }
      return { object: {} };
    }),
    streamText: vi.fn(() => ({
      textStream: (async function* () {
        yield 'Mock streaming response';
      })(),
    })),
  };
}

/**
 * Load a golden fixture and extract its category outputs for mocking.
 */
export function loadFixtureForMock(fixturePath) {
  // Dynamic import to avoid bundling fs in non-test environments
  const { readFileSync } = require('fs');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  return {
    categoryOutputs: fixture.difyBaseline?.evaluation?.categoryOutputs || {},
    investmentOutput: fixture.difyBaseline?.investment?.recommendations || null,
  };
}
