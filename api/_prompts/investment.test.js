import { describe, it, expect } from 'vitest';
import { buildInvestmentPrompt, InvestmentOutputSchema } from './investment.js';

describe('investment prompt', () => {
  it('builds a prompt with evaluation results and matrix', () => {
    const evalResults = { product_technology: { completeness: 75, summary: 'Strong' } };
    const maturity = { level: 3, name: 'Validated', score: 500, performance: { score: 3.5, label: 'Good' } };
    const matrix = { pre_seed: 80, seed: 60, series_a: 30 };
    const { system, user } = buildInvestmentPrompt(evalResults, maturity, matrix);
    expect(system).toContain('investment');
    expect(user).toContain('Validated');
    expect(user).toContain('pre_seed');
  });

  it('InvestmentOutputSchema validates a correct output', () => {
    const valid = {
      investment_readiness_summary: { assessment: 'test', primary_recommendation: 'seed', readiness_score: 'Moderate' },
      recommended_funding: [{ investment_type: 'pre_seed', rating: 'strong_fit', fit_explanation: 'test' }],
      conditional_options: [],
      improvement_roadmap: [],
      not_recommended: [{ investment_type: 'series_a', reason: 'Too early' }],
      next_steps: [{ priority: 1, action: 'Do X', timeline: '2 weeks', expected_outcome: 'Y' }],
    };
    expect(() => InvestmentOutputSchema.parse(valid)).not.toThrow();
  });
});
