import { createProviderRegistry } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Add provider imports here as needed:
// import { createAnthropic } from '@ai-sdk/anthropic';

const registry = createProviderRegistry({
  openai: createOpenAI(), // reads OPENAI_API_KEY from env automatically
  // anthropic: createAnthropic(), // reads ANTHROPIC_API_KEY from env
});

/**
 * Get a language model from the provider registry.
 * @param {string} envVar - Environment variable name (e.g., 'LLM_CHAT_MODEL')
 * @returns {LanguageModelV1} AI SDK model instance
 * @throws {Error} if the env var is not set
 */
export function getModel(envVar) {
  const spec = process.env[envVar];
  if (!spec) throw new Error(`${envVar} not configured`);
  return registry.languageModel(spec);
}
