import { describe, it, expect } from 'vitest';
import {
  COLORS,
  getSuitabilityColor,
  getStatusColor,
  getPriorityColor,
  getCategoryStatusColor,
  getMaturityColor,
  getPerformanceColor,
  getPerformanceLabel,
  getMaturityLabel,
} from './colors';

describe('getSuitabilityColor', () => {
  it('returns success for scores >= 75', () => {
    expect(getSuitabilityColor(75)).toBe(COLORS.success);
    expect(getSuitabilityColor(100)).toBe(COLORS.success);
  });

  it('returns warning for scores >= 50 and < 75', () => {
    expect(getSuitabilityColor(50)).toBe(COLORS.warning);
    expect(getSuitabilityColor(74)).toBe(COLORS.warning);
  });

  it('returns danger for scores < 50', () => {
    expect(getSuitabilityColor(49)).toBe(COLORS.danger);
    expect(getSuitabilityColor(0)).toBe(COLORS.danger);
  });
});

describe('getStatusColor', () => {
  it('maps status strings to correct colors', () => {
    expect(getStatusColor('strong_match')).toBe(COLORS.success);
    expect(getStatusColor('moderate_match')).toBe(COLORS.warning);
    expect(getStatusColor('partial_match')).toBe(COLORS.primary);
    expect(getStatusColor('weak_match')).toBe(COLORS.danger);
    expect(getStatusColor('unknown')).toBe(COLORS.danger);
  });
});

describe('getPriorityColor', () => {
  it('maps priority strings to correct colors', () => {
    expect(getPriorityColor('critical')).toBe(COLORS.danger);
    expect(getPriorityColor('high')).toBe(COLORS.warning);
    expect(getPriorityColor('medium')).toBe(COLORS.primary);
    expect(getPriorityColor('low')).toBe(COLORS.muted);
    expect(getPriorityColor('unknown')).toBe(COLORS.muted);
  });
});

describe('getCategoryStatusColor', () => {
  it('maps category status strings to correct colors', () => {
    expect(getCategoryStatusColor('complete')).toBe(COLORS.success);
    expect(getCategoryStatusColor('needs_attention')).toBe(COLORS.warning);
    expect(getCategoryStatusColor('incomplete')).toBe(COLORS.danger);
    expect(getCategoryStatusColor('unknown')).toBe(COLORS.muted);
  });
});

describe('getMaturityColor', () => {
  it('returns purple for level 5 (Leader)', () => {
    expect(getMaturityColor(5)).toBe('#8b5cf6');
  });

  it('returns success for level 4 (Scaling)', () => {
    expect(getMaturityColor(4)).toBe(COLORS.success);
  });

  it('returns primary for level 3 (Validated)', () => {
    expect(getMaturityColor(3)).toBe(COLORS.primary);
  });

  it('returns warning for level 2 (Early)', () => {
    expect(getMaturityColor(2)).toBe(COLORS.warning);
  });

  it('returns danger for level 1 (Concept)', () => {
    expect(getMaturityColor(1)).toBe(COLORS.danger);
  });
});

describe('getPerformanceColor', () => {
  it('returns purple for score 5 (Exceptional)', () => {
    expect(getPerformanceColor(5)).toBe('#8b5cf6');
  });

  it('returns success for score 4 (Good)', () => {
    expect(getPerformanceColor(4)).toBe(COLORS.success);
  });

  it('returns primary for score 3 (Average)', () => {
    expect(getPerformanceColor(3)).toBe(COLORS.primary);
  });

  it('returns warning for score 2 (Fair)', () => {
    expect(getPerformanceColor(2)).toBe(COLORS.warning);
  });

  it('returns danger for score 1 (Poor)', () => {
    expect(getPerformanceColor(1)).toBe(COLORS.danger);
  });
});

describe('getPerformanceLabel', () => {
  it('maps scores to correct labels', () => {
    expect(getPerformanceLabel(1)).toBe('Poor');
    expect(getPerformanceLabel(2)).toBe('Fair');
    expect(getPerformanceLabel(3)).toBe('Average');
    expect(getPerformanceLabel(4)).toBe('Good');
    expect(getPerformanceLabel(5)).toBe('Exceptional');
  });

  it('rounds fractional scores to nearest integer', () => {
    expect(getPerformanceLabel(3.2)).toBe('Average');
    expect(getPerformanceLabel(3.7)).toBe('Good');
    expect(getPerformanceLabel(4.5)).toBe('Exceptional');
  });

  it('returns N/A for out-of-range values', () => {
    expect(getPerformanceLabel(0)).toBe('N/A');
    expect(getPerformanceLabel(6)).toBe('N/A');
  });
});

describe('getMaturityLabel', () => {
  it('maps levels to correct labels', () => {
    expect(getMaturityLabel(1)).toBe('Concept');
    expect(getMaturityLabel(2)).toBe('Early');
    expect(getMaturityLabel(3)).toBe('Validated');
    expect(getMaturityLabel(4)).toBe('Scaling');
    expect(getMaturityLabel(5)).toBe('Leader');
  });

  it('returns N/A for out-of-range values', () => {
    expect(getMaturityLabel(0)).toBe('N/A');
    expect(getMaturityLabel(6)).toBe('N/A');
  });
});
