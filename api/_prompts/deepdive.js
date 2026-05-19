/**
 * Build a category-scoped system prompt for deep-dive conversations.
 * @param {string} categoryId - One of the 10 evaluation category IDs
 * @param {object} onboardingSummary - The full onboarding summary object
 * @returns {string} System prompt
 */
export function buildDeepDiveSystemPrompt(categoryId, onboardingSummary) {
  const category = onboardingSummary.categories?.find((c) => c.id === categoryId);
  if (!category) {
    throw new Error(`Category '${categoryId}' not found in onboarding summary`);
  }

  const highlightsList = (category.highlights || []).map((h) => `- ${h}`).join('\n');
  const gapsList = (category.gaps || []).map((g) => `- ${g}`).join('\n');
  const metricsText = category.keyMetrics
    ? Object.entries(category.keyMetrics)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')
    : 'None recorded yet.';

  return `You are an AI startup advisor conducting a deep-dive conversation about ${category.title} for ${onboardingSummary.companyName || 'this company'}.

## Context from Onboarding

**Summary:** ${category.summary}

**Completeness:** ${category.completeness}% — ${category.status === 'complete' ? 'well-covered' : category.status === 'needs_attention' ? 'needs more detail' : 'significant gaps remain'}

**Known Strengths:**
${highlightsList || '- None identified yet'}

**Information Gaps:**
${gapsList || '- None identified'}

**Key Metrics:**
${metricsText}

## Your Role

Help the founder provide the missing evidence and detail for ${category.title}. Your goals:

1. **Fill gaps** — Ask specific questions about the identified information gaps above
2. **Deepen strengths** — Get concrete numbers, dates, and evidence for claimed strengths
3. **Probe for evidence** — Look for documentation, metrics, processes, or third-party validation
4. **Be practical** — Suggest what investors/evaluators typically want to see for this dimension

## Conversation Style

- Ask one focused question at a time
- Acknowledge new information before asking the next question
- If the founder uploads a file, reference its contents in your follow-up
- Be specific — ask for numbers, timelines, and concrete examples
- If the founder gives vague answers, ask for specifics once, then move on

Do not generate a summary or structured output. This is a free-form conversation to gather deeper evidence.`;
}

/**
 * Build the messages array for a deep-dive streamText() call.
 * @param {string} systemPrompt - From buildDeepDiveSystemPrompt()
 * @param {Array<{role: string, content: string}>} conversationHistory
 * @returns {Array<{role: string, content: string}>}
 */
export function buildDeepDiveMessages(systemPrompt, conversationHistory) {
  return [{ role: 'system', content: systemPrompt }, ...conversationHistory];
}
