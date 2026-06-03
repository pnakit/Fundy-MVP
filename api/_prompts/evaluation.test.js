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
    expect(system).toContain('NOT_APPLICABLE');
    expect(user).toContain('Some context about the product');
  });

  it('buildEvalPrompt appends documentContext when provided', () => {
    const { user } = buildEvalPrompt('product_technology', 'onboarding ctx', 'raw pdf text here');
    expect(user).toContain('onboarding ctx');
    expect(user).toContain('Supporting Document Content');
    expect(user).toContain('raw pdf text here');
  });

  it('buildEvalPrompt omits document section when documentContext is empty', () => {
    const { user } = buildEvalPrompt('product_technology', 'ctx', '');
    expect(user).not.toContain('Supporting Document Content');
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
        perItemAssessment: [
          { item: 'item1', status: 'PROVEN' },
          { item: 'item2', status: 'PARTIAL' },
          { item: 'item3', status: 'NOT_APPLICABLE' },
        ],
        provenCount: 12,
        partialCount: 5,
        unprovenCount: 3,
        notApplicableCount: 0,
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
      keyMetrics: { perItemAssessment: [], provenCount: 0, partialCount: 0, unprovenCount: 0, notApplicableCount: 0 },
      deepDivePrompt: 'test',
    };
    expect(() => EvalCategorySchema.parse(invalid)).toThrow();
  });
});
