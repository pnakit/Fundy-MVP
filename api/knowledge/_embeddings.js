/**
 * OpenAI embedding client for text-embedding-3-small.
 * Used by the knowledge base layer and evaluation context builder.
 */

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const DEFAULT_MODEL = 'text-embedding-3-small';

/**
 * Generate embeddings for multiple texts in a single batch call.
 *
 * @param {string[]} texts - Array of text strings to embed
 * @param {string} [model] - Embedding model (defaults to text-embedding-3-small)
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export async function generateEmbeddings(texts, model = DEFAULT_MODEL) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  if (!texts || texts.length === 0) {
    return [];
  }

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: texts }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI embedding error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.data.map((d) => d.embedding);
}

/**
 * Generate an embedding for a single text string.
 *
 * @param {string} text - Text to embed
 * @param {string} [model] - Embedding model
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateEmbedding(text, model = DEFAULT_MODEL) {
  const [embedding] = await generateEmbeddings([text], model);
  return embedding;
}
