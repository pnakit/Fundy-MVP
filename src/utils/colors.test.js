import { describe, it, expect } from 'vitest';
import { COLORS, getSuitabilityColor, getStatusColor, getPriorityColor, getCategoryStatusColor } from './colors';

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
