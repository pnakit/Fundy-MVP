import { describe, it, expect } from 'vitest';
import { addInvestmentActions, removeInvestmentActions } from './actionItems';

let nextId = 1;
function makeId() {
  return nextId++;
}

const evalAction = {
  id: 50,
  title: 'Eval Action',
  sourceType: 'evaluation',
  sourceId: null,
  dimensionId: 'legal_compliance',
  status: 'pending',
  files: [],
  inputs: {},
};

const rawActions = [
  { title: 'Pitch Deck', description: 'Create pitch deck', priority: 'high' },
  { title: 'Financial Model', description: 'Build model', priority: 'medium' },
];

describe('addInvestmentActions', () => {
  it('appends enriched actions to existing array', () => {
    const result = addInvestmentActions([evalAction], 'seed', rawActions, makeId);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(evalAction);
  });

  it('sets correct metadata on each new action', () => {
    const result = addInvestmentActions([], 'series_a', rawActions, makeId);
    for (const action of result) {
      expect(action.sourceType).toBe('investment');
      expect(action.sourceId).toBe('series_a');
      expect(action.dimensionId).toBeNull();
      expect(action.status).toBe('pending');
      expect(action.files).toEqual([]);
      expect(action.inputs).toEqual({});
      expect(typeof action.id).toBe('number');
    }
  });

  it('preserves original action fields (title, description, priority)', () => {
    const result = addInvestmentActions([], 'seed', rawActions, makeId);
    expect(result[0].title).toBe('Pitch Deck');
    expect(result[0].description).toBe('Create pitch deck');
    expect(result[0].priority).toBe('high');
    expect(result[1].title).toBe('Financial Model');
  });

  it('assigns unique ids via generateId', () => {
    let counter = 500;
    const idFn = () => counter++;
    const result = addInvestmentActions([], 'seed', rawActions, idFn);
    expect(result[0].id).toBe(500);
    expect(result[1].id).toBe(501);
  });

  it('handles empty rawActions array', () => {
    const result = addInvestmentActions([evalAction], 'seed', [], makeId);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(evalAction);
  });

  it('does not mutate the input array', () => {
    const original = [evalAction];
    const result = addInvestmentActions(original, 'seed', rawActions, makeId);
    expect(original).toHaveLength(1);
    expect(result).not.toBe(original);
  });
});

describe('removeInvestmentActions', () => {
  it('removes actions matching the investment id', () => {
    const actions = [
      evalAction,
      { id: 100, sourceType: 'investment', sourceId: 'seed', title: 'A' },
      { id: 101, sourceType: 'investment', sourceId: 'seed', title: 'B' },
    ];
    const result = removeInvestmentActions(actions, 'seed');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(evalAction);
  });

  it('keeps actions from other investments', () => {
    const actions = [
      { id: 100, sourceType: 'investment', sourceId: 'seed', title: 'A' },
      { id: 101, sourceType: 'investment', sourceId: 'grants', title: 'B' },
    ];
    const result = removeInvestmentActions(actions, 'seed');
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).toBe('grants');
  });

  it('keeps evaluation-sourced actions untouched', () => {
    const actions = [
      evalAction,
      { id: 100, sourceType: 'investment', sourceId: 'seed', title: 'A' },
    ];
    const result = removeInvestmentActions(actions, 'seed');
    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBe('evaluation');
  });

  it('handles empty array', () => {
    const result = removeInvestmentActions([], 'seed');
    expect(result).toEqual([]);
  });

  it('returns same items when investment id has no matches', () => {
    const actions = [evalAction];
    const result = removeInvestmentActions(actions, 'nonexistent');
    expect(result).toHaveLength(1);
  });

  it('does not mutate the input array', () => {
    const actions = [
      evalAction,
      { id: 100, sourceType: 'investment', sourceId: 'seed', title: 'A' },
    ];
    const original = [...actions];
    removeInvestmentActions(actions, 'seed');
    expect(actions).toHaveLength(2);
    expect(actions).toEqual(original);
  });
});
