import { describe, it, expect } from 'vitest';
import { EVALUATION_SCORECARDS, buildEvalPrompt, EvalCategorySchema } from './evaluation.js';

describe('evaluation prompts', () => {
  const VALID_IDS = [
    'product_technology',
    'market_traction',
    'business_model',
    'team_organization',
    'go_to_market',
    'financial_health',
    'fundraising_capital',
    'competitive_position',
    'operations',
    'legal_compliance',
  ];

  it('has scorecards for all 10 categories', () => {
    expect(Object.keys(EVALUATION_SCORECARDS)).toHaveLength(10);
    for (const id of VALID_IDS) {
      expect(EVALUATION_SCORECARDS[id]).toBeDefined();
      expect(EVALUATION_SCORECARDS[id]).toContain('PROVEN');
    }
  });

  it('buildEvalPrompt returns system + user messages for a valid category', () => {
    const { system, user } = buildEvalPrompt('product_technology', 'Some context about the product');
    expect(system).toContain('Product & Technology');
    expect(system).toContain('PROVEN');
    expect(system).toContain('PARTIAL');
    expect(system).toContain('UNPROVEN');
    expect(user).toContain('Some context about the product');
  });

  it('buildEvalPrompt throws for unknown category', () => {
    expect(() => buildEvalPrompt('nonexistent', 'ctx')).toThrow();
  });

  it('EvalCategorySchema validates a correct output', () => {
    const valid = {
      category_id: 'product_technology',
      category_title: 'Product & Technology',
      summary: 'Strong technical foundation.',
      completeness: 75,
      status: 'complete',
      highlights: ['ML pipeline'],
      gaps: [{ action: 'File patents', type: 'stretch', evidence_items: [15, 16] }],
      keyMetrics: {
        perItemAssessment: { item1: 'PROVEN', item2: 'PARTIAL' },
        provenCount: 12,
        partialCount: 5,
        unprovenCount: 3,
      },
      deepDivePrompt: 'Let us explore your technical architecture.',
    };
    expect(() => EvalCategorySchema.parse(valid)).not.toThrow();
  });

  it('EvalCategorySchema rejects invalid completeness', () => {
    const invalid = {
      category_id: 'product_technology',
      category_title: 'Product & Technology',
      summary: 'test',
      completeness: 150,
      status: 'complete',
      highlights: [],
      gaps: [],
      keyMetrics: { perItemAssessment: {}, provenCount: 0, partialCount: 0, unprovenCount: 0 },
      deepDivePrompt: 'test',
    };
    expect(() => EvalCategorySchema.parse(invalid)).toThrow();
  });
});
