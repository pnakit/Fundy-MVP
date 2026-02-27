import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { MOCK_INVESTMENT_DATA, INVESTMENT_ACTIONS, INITIAL_ACTION_ITEMS } from '../data/mockData';
import { addInvestmentActions, removeInvestmentActions } from '../utils/actionItems';

afterEach(cleanup);

// Test harness that uses the same utility functions as App.jsx
let nextId = 1000;
function generateTestId() {
  return nextId++;
}

function TestInvestmentToggle() {
  const [selectedInvestments, setSelectedInvestments] = useState([]);
  const [actionItems, setActionItems] = useState([...INITIAL_ACTION_ITEMS]);

  const toggleInvestment = (investmentId) => {
    setSelectedInvestments((prev) => {
      const isSelected = prev.includes(investmentId);
      if (isSelected) {
        setActionItems((prevActions) => removeInvestmentActions(prevActions, investmentId));
        return prev.filter((id) => id !== investmentId);
      } else {
        const rawActions = INVESTMENT_ACTIONS[investmentId] || [];
        setActionItems((prevActions) => addInvestmentActions(prevActions, investmentId, rawActions, generateTestId));
        return [...prev, investmentId];
      }
    });
  };

  const investmentActions = actionItems.filter((a) => a.sourceType === 'investment');

  return (
    <div>
      <div data-testid="action-count">{actionItems.length}</div>
      <div data-testid="investment-action-sources">
        {investmentActions.map((a) => a.sourceId).join(',')}
      </div>
      <div data-testid="selected">{selectedInvestments.join(',')}</div>
      {MOCK_INVESTMENT_DATA.investments.map((inv) => (
        <button key={inv.id} data-testid={`toggle-${inv.id}`} onClick={() => toggleInvestment(inv.id)}>
          {selectedInvestments.includes(inv.id) ? 'Deselect' : 'Select'} {inv.type}
        </button>
      ))}
    </div>
  );
}

describe('Investment Toggle', () => {
  it('starts with only initial action items', () => {
    render(<TestInvestmentToggle />);
    expect(screen.getByTestId('action-count').textContent).toBe(String(INITIAL_ACTION_ITEMS.length));
    expect(screen.getByTestId('investment-action-sources').textContent).toBe('');
    expect(screen.getByTestId('selected').textContent).toBe('');
  });

  it('adds actions when selecting an investment', () => {
    render(<TestInvestmentToggle />);

    fireEvent.click(screen.getByTestId('toggle-series_a'));

    const expectedCount = INITIAL_ACTION_ITEMS.length + INVESTMENT_ACTIONS.series_a.length;
    expect(screen.getByTestId('action-count').textContent).toBe(String(expectedCount));
    expect(screen.getByTestId('selected').textContent).toBe('series_a');
    expect(screen.getByTestId('investment-action-sources').textContent).toContain('series_a');
  });

  it('removes actions when deselecting an investment', () => {
    render(<TestInvestmentToggle />);

    fireEvent.click(screen.getByTestId('toggle-series_a'));
    fireEvent.click(screen.getByTestId('toggle-series_a'));

    expect(screen.getByTestId('action-count').textContent).toBe(String(INITIAL_ACTION_ITEMS.length));
    expect(screen.getByTestId('investment-action-sources').textContent).toBe('');
    expect(screen.getByTestId('selected').textContent).toBe('');
  });

  it('handles multiple investments independently', () => {
    render(<TestInvestmentToggle />);

    fireEvent.click(screen.getByTestId('toggle-seed'));
    fireEvent.click(screen.getByTestId('toggle-grants'));

    const expectedCount =
      INITIAL_ACTION_ITEMS.length + INVESTMENT_ACTIONS.seed.length + INVESTMENT_ACTIONS.grants.length;
    expect(screen.getByTestId('action-count').textContent).toBe(String(expectedCount));

    // Deselect only seed — grants actions should remain
    fireEvent.click(screen.getByTestId('toggle-seed'));

    const afterDeselectCount = INITIAL_ACTION_ITEMS.length + INVESTMENT_ACTIONS.grants.length;
    expect(screen.getByTestId('action-count').textContent).toBe(String(afterDeselectCount));
    // All remaining sourced actions should be from grants only
    const sources = screen
      .getByTestId('investment-action-sources')
      .textContent.split(',')
      .filter(Boolean);
    expect(sources.every((s) => s === 'grants')).toBe(true);
    expect(sources.length).toBe(INVESTMENT_ACTIONS.grants.length);
  });

  it('does not remove evaluation action items on deselect', () => {
    render(<TestInvestmentToggle />);

    fireEvent.click(screen.getByTestId('toggle-seed'));
    fireEvent.click(screen.getByTestId('toggle-seed'));

    // All initial (evaluation-sourced) items should survive
    expect(screen.getByTestId('action-count').textContent).toBe(String(INITIAL_ACTION_ITEMS.length));
  });

  it('investment actions have correct metadata fields', () => {
    render(<TestInvestmentToggle />);

    fireEvent.click(screen.getByTestId('toggle-seed'));

    // Verify the sources contain proper sourceId values
    const sources = screen.getByTestId('investment-action-sources').textContent.split(',');
    expect(sources.every((s) => s === 'seed')).toBe(true);
    expect(sources.length).toBe(INVESTMENT_ACTIONS.seed.length);
  });
});
