import { z } from 'zod';

export const InvestmentOutputSchema = z.object({
  investment_readiness_summary: z.object({
    assessment: z.string(),
    primary_recommendation: z.string(),
    readiness_score: z.enum(['Low', 'Moderate', 'High']),
  }),
  recommended_funding: z.array(
    z.object({
      investment_type: z.string(),
      rating: z.enum(['ideal', 'strong_fit', 'acceptable']),
      fit_explanation: z.string(),
    }),
  ),
  conditional_options: z.array(
    z.object({
      investment_type: z.string(),
      conditions_for_fit: z.string(),
      improvements_needed: z.array(
        z.object({
          category: z.string(),
          current_state: z.string(),
          target_state: z.string(),
          actions: z.array(z.string()),
        }),
      ),
    }),
  ),
  improvement_roadmap: z.array(
    z.object({
      priority: z.number(),
      category: z.string(),
      current_score: z.number(),
      target_score: z.number(),
      unlocks: z.array(z.string()),
      specific_actions: z.array(z.string()),
      timeline: z.string(),
    }),
  ),
  not_recommended: z.array(
    z.object({
      investment_type: z.string(),
      reason: z.string(),
    }),
  ),
  next_steps: z.array(
    z.object({
      priority: z.number(),
      action: z.string(),
      timeline: z.string(),
      expected_outcome: z.string(),
    }),
  ),
});

const INVESTMENT_SYSTEM_PROMPT = `You are a startup investment advisor. Based on a company's evaluation results across 10 dimensions, generate investment recommendations.

## Investment Types
- pre_seed: Pre-seed funding ($50K-$500K, idea to early product)
- seed: Seed funding ($500K-$3M, product-market fit validation)
- series_a: Series A ($3M-$15M, proven growth, scaling)
- venture_debt: Venture debt (non-dilutive, requires existing equity/revenue)
- grants: Government/research grants (non-dilutive, innovation-focused)
- crowdfunding: Equity crowdfunding (community-driven, consumer products)

## Rating Scale
- ideal: Perfect match for current stage
- strong_fit: Well-suited with minor gaps
- acceptable: Viable but not optimal
- conditional: Possible if specific milestones are met
- not_suitable: Not appropriate for current stage

## Rules
- recommended_funding: Only investment types rated ideal, strong_fit, or acceptable
- conditional_options: Types that could work with specific improvements
- not_recommended: Types that are clearly inappropriate with concise reasons
- improvement_roadmap: Prioritized actions to unlock higher-tier funding
- next_steps: 3-5 immediate actionable items with timelines

Respond with ONLY valid JSON matching the required schema.`;

/**
 * Build prompts for the investment recommendation LLM call.
 * @param {Object} evaluationResults - Map of categoryId → evaluation output
 * @param {{ level: number, name: string, score: number, performance: { score: number, label: string } }} maturityData
 * @param {Object} investmentMatrix - Map of investmentType → suitabilityScore (0-100)
 * @returns {{ system: string, user: string }}
 */
export function buildInvestmentPrompt(evaluationResults, maturityData, investmentMatrix) {
  const categorySummaries = Object.entries(evaluationResults)
    .map(
      ([id, data]) =>
        `- ${id}: completeness=${data.completeness}%, status=${data.status}, summary="${data.summary || ''}"`,
    )
    .join('\n');

  const matrixSummary = Object.entries(investmentMatrix)
    .map(([type, score]) => `- ${type}: suitability=${score}/100`)
    .join('\n');

  const user = `## Company Evaluation Summary

**Maturity Stage:** ${maturityData.name} (Level ${maturityData.level}/5)
**Overall Score:** ${maturityData.score}/1000
**Performance:** ${maturityData.performance.score}/5.0 (${maturityData.performance.label})

## Dimension Results
${categorySummaries}

## Investment Suitability Matrix
${matrixSummary}

Based on these results, generate comprehensive investment recommendations.`;

  return { system: INVESTMENT_SYSTEM_PROMPT, user };
}
