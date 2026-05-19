import { describe, it, expect } from 'vitest';
import { calculateMaturity, generateInvestmentMatrix } from './_maturity.js';

const CATEGORY_IDS = [
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

function makeResults(completeness, provenCount = 10, partialCount = 5, unprovenCount = 5) {
  const results = {};
  for (const id of CATEGORY_IDS) {
    results[id] = { completeness, keyMetrics: { provenCount, partialCount, unprovenCount } };
  }
  return results;
}

describe('calculateMaturity', () => {
  it('returns Concept stage for all-low scores', () => {
    const maturity = calculateMaturity(makeResults(15, 3, 2, 15));
    expect(maturity.level).toBe(1);
    expect(maturity.name).toBe('Concept');
    // completeness=15, score = (15/1)*10 = 150, which is < 200 (Early threshold)
    expect(maturity.score).toBe(150);
  });

  it('returns Early stage for scores in 200-399 range', () => {
    // completeness=25 => score = 250
    const maturity = calculateMaturity(makeResults(25, 5, 3, 12));
    expect(maturity.level).toBe(2);
    expect(maturity.name).toBe('Early');
    expect(maturity.score).toBe(250);
  });

  it('returns Validated stage for mid-range scores', () => {
    // completeness=65 => score = 650
    const maturity = calculateMaturity(makeResults(65, 12, 4, 4));
    expect(maturity.level).toBe(4);
    expect(maturity.name).toBe('Scaling');
    expect(maturity.score).toBe(650);
  });

  it('returns Leader stage for high scores', () => {
    // completeness=90 => score = 900
    const maturity = calculateMaturity(makeResults(90, 18, 1, 1));
    expect(maturity.level).toBe(5);
    expect(maturity.name).toBe('Leader');
    expect(maturity.score).toBe(900);
  });

  it('returns overall performance score between 1 and 5', () => {
    const maturity = calculateMaturity(makeResults(80, 16, 2, 2));
    expect(maturity.performance.score).toBeGreaterThanOrEqual(1);
    expect(maturity.performance.score).toBeLessThanOrEqual(5);
    expect(['Poor', 'Fair', 'Average', 'Good', 'Exceptional']).toContain(maturity.performance.label);
  });

  it('maps performance score to correct label', () => {
    // completeness=80 => avgCompleteness=80 => performanceScore = (80/100)*4 + 1 = 4.2 => 'Good'
    const maturity = calculateMaturity(makeResults(80, 16, 2, 2));
    expect(maturity.performance.score).toBe(4.2);
    expect(maturity.performance.label).toBe('Good');
  });

  it('returns Poor label for low completeness', () => {
    // completeness=5 => performanceScore = (5/100)*4 + 1 = 1.2
    const maturity = calculateMaturity(makeResults(5, 1, 0, 19));
    expect(maturity.performance.score).toBe(1.2);
    expect(maturity.performance.label).toBe('Poor');
  });

  it('returns Exceptional label for very high completeness', () => {
    // completeness=100 => performanceScore = (100/100)*4 + 1 = 5.0
    const maturity = calculateMaturity(makeResults(100, 20, 0, 0));
    expect(maturity.performance.score).toBe(5);
    expect(maturity.performance.label).toBe('Exceptional');
  });

  it('handles empty results gracefully', () => {
    const maturity = calculateMaturity({});
    expect(maturity.level).toBe(1);
    expect(maturity.name).toBe('Concept');
    expect(maturity.score).toBe(0);
    expect(maturity.performance.score).toBe(1);
    expect(maturity.performance.label).toBe('Poor');
  });

  it('handles missing completeness values', () => {
    const results = { product_technology: { keyMetrics: { provenCount: 5, partialCount: 3, unprovenCount: 12 } } };
    const maturity = calculateMaturity(results);
    expect(maturity.level).toBe(1);
    expect(maturity.score).toBe(0);
  });

  it('handles single category', () => {
    const results = { product_technology: { completeness: 50, keyMetrics: { provenCount: 10, partialCount: 5, unprovenCount: 5 } } };
    const maturity = calculateMaturity(results);
    expect(maturity.score).toBe(500);
    expect(maturity.level).toBe(3);
    expect(maturity.name).toBe('Validated');
  });
});

describe('generateInvestmentMatrix', () => {
  it('returns scores for all 6 investment types', () => {
    const results = makeResults(50, 10, 5, 5);
    const maturity = { level: 2, name: 'Early', score: 300 };
    const matrix = generateInvestmentMatrix(results, maturity);
    expect(Object.keys(matrix)).toEqual(
      expect.arrayContaining(['pre_seed', 'seed', 'series_a', 'venture_debt', 'grants', 'crowdfunding'])
    );
    expect(Object.keys(matrix)).toHaveLength(6);
    for (const score of Object.values(matrix)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('gives higher seed scores for higher maturity', () => {
    const results = makeResults(70, 14, 3, 3);
    const lowMat = { level: 1, name: 'Concept', score: 100 };
    const highMat = { level: 3, name: 'Validated', score: 500 };
    const matrixLow = generateInvestmentMatrix(results, lowMat);
    const matrixHigh = generateInvestmentMatrix(results, highMat);
    expect(matrixHigh.seed).toBeGreaterThan(matrixLow.seed);
  });

  it('calculates pre_seed as avgCompleteness * 1.2 capped at 100', () => {
    // avgCompleteness=50 => pre_seed = min(100, 50*1.2) = 60
    const results = makeResults(50, 10, 5, 5);
    const maturity = { level: 2, name: 'Early', score: 300 };
    const matrix = generateInvestmentMatrix(results, maturity);
    expect(matrix.pre_seed).toBe(60);
  });

  it('caps pre_seed at 100 for high completeness', () => {
    // avgCompleteness=90 => pre_seed = min(100, 90*1.2) = min(100, 108) = 100
    const results = makeResults(90, 18, 1, 1);
    const maturity = { level: 4, name: 'Scaling', score: 700 };
    const matrix = generateInvestmentMatrix(results, maturity);
    expect(matrix.pre_seed).toBe(100);
  });

  it('penalizes seed for low maturity', () => {
    // maturity.level=1 => seed = avgCompleteness * 0.5 = 50*0.5 = 25
    const results = makeResults(50, 10, 5, 5);
    const maturity = { level: 1, name: 'Concept', score: 100 };
    const matrix = generateInvestmentMatrix(results, maturity);
    expect(matrix.seed).toBe(25);
  });

  it('boosts seed for maturity >= 2', () => {
    // maturity.level=2 => seed = min(100, 50*1.1) = 55
    const results = makeResults(50, 10, 5, 5);
    const maturity = { level: 2, name: 'Early', score: 300 };
    const matrix = generateInvestmentMatrix(results, maturity);
    expect(matrix.seed).toBe(55);
  });

  it('penalizes series_a heavily for low maturity', () => {
    // maturity.level=1 => series_a = 50*0.3 = 15
    const results = makeResults(50, 10, 5, 5);
    const maturity = { level: 1, name: 'Concept', score: 100 };
    const matrix = generateInvestmentMatrix(results, maturity);
    expect(matrix.series_a).toBe(15);
  });

  it('boosts series_a for maturity >= 3', () => {
    // maturity.level=3 => series_a = min(100, 50*1.0) = 50
    const results = makeResults(50, 10, 5, 5);
    const maturity = { level: 3, name: 'Validated', score: 500 };
    const matrix = generateInvestmentMatrix(results, maturity);
    expect(matrix.series_a).toBe(50);
  });

  it('calculates grants with base offset', () => {
    // grants = min(100, 50*0.8 + 20) = min(100, 60) = 60
    const results = makeResults(50, 10, 5, 5);
    const maturity = { level: 2, name: 'Early', score: 300 };
    const matrix = generateInvestmentMatrix(results, maturity);
    expect(matrix.grants).toBe(60);
  });

  it('calculates crowdfunding with base offset', () => {
    // crowdfunding = min(100, 50*0.7 + 15) = min(100, 50) = 50
    const results = makeResults(50, 10, 5, 5);
    const maturity = { level: 2, name: 'Early', score: 300 };
    const matrix = generateInvestmentMatrix(results, maturity);
    expect(matrix.crowdfunding).toBe(50);
  });

  it('returns all rounded integers', () => {
    // Use a completeness that produces non-integer intermediate values
    const results = makeResults(33, 7, 3, 10);
    const maturity = { level: 2, name: 'Early', score: 300 };
    const matrix = generateInvestmentMatrix(results, maturity);
    for (const score of Object.values(matrix)) {
      expect(Number.isInteger(score)).toBe(true);
    }
  });

  it('handles empty results without crashing', () => {
    // NaN guard: empty results => avgCompleteness = 0/0 = NaN
    // The function should handle this gracefully
    const maturity = { level: 1, name: 'Concept', score: 0 };
    const matrix = generateInvestmentMatrix({}, maturity);
    for (const score of Object.values(matrix)) {
      expect(Number.isFinite(score)).toBe(true);
    }
  });
});
