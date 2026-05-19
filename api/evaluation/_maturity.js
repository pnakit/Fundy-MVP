/**
 * Maturity calculation and investment matrix scoring.
 * Ported from Dify `calculate_maturity` and `generate_matrix` Code nodes.
 *
 * Pure deterministic functions — no LLM calls.
 */

const MATURITY_STAGES = [
  { level: 1, name: 'Concept', minScore: 0 },
  { level: 2, name: 'Early', minScore: 200 },
  { level: 3, name: 'Validated', minScore: 400 },
  { level: 4, name: 'Scaling', minScore: 650 },
  { level: 5, name: 'Leader', minScore: 850 },
];

const PERFORMANCE_LABELS = [
  { min: 0, max: 1.5, label: 'Poor' },
  { min: 1.5, max: 2.5, label: 'Fair' },
  { min: 2.5, max: 3.5, label: 'Average' },
  { min: 3.5, max: 4.5, label: 'Good' },
  { min: 4.5, max: 5.1, label: 'Exceptional' },
];

const INVESTMENT_TYPES = ['pre_seed', 'seed', 'series_a', 'venture_debt', 'grants', 'crowdfunding'];

/**
 * Calculate overall maturity stage from 10 category evaluation results.
 *
 * @param {Object} categoryResults - Map of categoryId -> { completeness, keyMetrics: { provenCount, partialCount, unprovenCount } }
 * @returns {{ level: number, name: string, score: number, performance: { score: number, label: string } }}
 */
export function calculateMaturity(categoryResults) {
  const categories = Object.values(categoryResults);
  if (categories.length === 0) {
    return { level: 1, name: 'Concept', score: 0, performance: { score: 1, label: 'Poor' } };
  }

  // Weighted score: completeness contributes to a 0-1000 scale
  const totalCompleteness = categories.reduce((sum, c) => sum + (c.completeness || 0), 0);
  const score = Math.round((totalCompleteness / categories.length) * 10);

  // Derive maturity level from score thresholds
  let stage = MATURITY_STAGES[0];
  for (const s of MATURITY_STAGES) {
    if (score >= s.minScore) stage = s;
  }

  // Performance: average completeness mapped to 1-5 scale
  const avgCompleteness = totalCompleteness / categories.length;
  const performanceScore = Math.round(((avgCompleteness / 100) * 4 + 1) * 10) / 10; // 1.0 - 5.0
  const perfLabel =
    PERFORMANCE_LABELS.find((p) => performanceScore >= p.min && performanceScore < p.max)?.label || 'Average';

  return {
    level: stage.level,
    name: stage.name,
    score,
    performance: { score: performanceScore, label: perfLabel },
  };
}

/**
 * Score each investment type against the evaluation dimensions.
 *
 * @param {Object} categoryResults - Same as calculateMaturity input
 * @param {{ level: number, name: string, score: number }} maturity
 * @returns {Object} Map of investmentType -> suitabilityScore (0-100)
 */
export function generateInvestmentMatrix(categoryResults, maturity) {
  const keys = Object.keys(categoryResults);
  const avgCompleteness =
    keys.length > 0
      ? Object.values(categoryResults).reduce((sum, c) => sum + (c.completeness || 0), 0) / keys.length
      : 0;

  const matrix = {};
  for (const type of INVESTMENT_TYPES) {
    let score;
    switch (type) {
      case 'pre_seed':
        score = Math.min(100, avgCompleteness * 1.2);
        break;
      case 'seed':
        score = maturity.level >= 2 ? Math.min(100, avgCompleteness * 1.1) : avgCompleteness * 0.5;
        break;
      case 'series_a':
        score = maturity.level >= 3 ? Math.min(100, avgCompleteness * 1.0) : avgCompleteness * 0.3;
        break;
      case 'venture_debt':
        score = maturity.level >= 3 ? Math.min(100, avgCompleteness * 0.9) : avgCompleteness * 0.2;
        break;
      case 'grants':
        score = Math.min(100, avgCompleteness * 0.8 + 20);
        break;
      case 'crowdfunding':
        score = Math.min(100, avgCompleteness * 0.7 + 15);
        break;
      default:
        score = avgCompleteness * 0.5;
    }
    matrix[type] = Math.round(score);
  }

  return matrix;
}
