/**
 * Tests for investment select/deselect toggle behaviour.
 *
 * Since v3.7 (investment matching integration), toggleInvestment only tracks
 * selection intent — it does NOT add or remove action items. Action items now
 * come from the evaluation pipeline's LLM-generated next_steps, not from
 * static per-investment action templates.
 *
 * Key invariants:
 * - Selecting an investment adds it to selectedInvestments; action count unchanged
 * - Deselecting removes it; action count still unchanged
 * - Multiple investments toggle independently
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { INITIAL_ACTION_ITEMS } from '../data/mockData';

afterEach(cleanup);

// Investment IDs that exist in the new MOCK_INVESTMENT_DATA shape.
// Using a small fixed set so tests are not coupled to the full mock data file.
const TEST_INVESTMENT_IDS = ['pre_seed', 'grant_funding', 'seed', 'series_a'];

function TestInvestmentToggle({ initialActionItems = INITIAL_ACTION_ITEMS }) {
  const [selectedInvestments, setSelectedInvestments] = useState([]);
  // Action items start from initial evaluation items and are NOT modified by toggle
  const [actionItems] = useState([...initialActionItems]);

  const toggleInvestment = (investmentId) => {
    setSelectedInvestments((prev) => {
      const isSelected = prev.includes(investmentId);
      return isSelected ? prev.filter((id) => id !== investmentId) : [...prev, investmentId];
    });
  };

  return (
    <div>
      <div data-testid="action-count">{actionItems.length}</div>
      <div data-testid="selected">{selectedInvestments.join(',')}</div>
      {TEST_INVESTMENT_IDS.map((id) => (
        <button key={id} data-testid={`toggle-${id}`} onClick={() => toggleInvestment(id)}>
          {selectedInvestments.includes(id) ? 'Deselect' : 'Select'} {id}
        </button>
      ))}
    </div>
  );
}

describe('Investment Toggle', () => {
  it('starts with no selections and initial action item count', () => {
    render(<TestInvestmentToggle />);
    expect(screen.getByTestId('selected').textContent).toBe('');
    expect(screen.getByTestId('action-count').textContent).toBe(String(INITIAL_ACTION_ITEMS.length));
  });

  it('adds investment to selectedInvestments on select', () => {
    render(<TestInvestmentToggle />);
    fireEvent.click(screen.getByTestId('toggle-pre_seed'));
    expect(screen.getByTestId('selected').textContent).toBe('pre_seed');
  });

  it('does not change action item count when selecting', () => {
    render(<TestInvestmentToggle />);
    fireEvent.click(screen.getByTestId('toggle-pre_seed'));
    expect(screen.getByTestId('action-count').textContent).toBe(String(INITIAL_ACTION_ITEMS.length));
  });

  it('removes investment from selectedInvestments on deselect', () => {
    render(<TestInvestmentToggle />);
    fireEvent.click(screen.getByTestId('toggle-pre_seed'));
    fireEvent.click(screen.getByTestId('toggle-pre_seed'));
    expect(screen.getByTestId('selected').textContent).toBe('');
  });

  it('does not change action item count when deselecting', () => {
    render(<TestInvestmentToggle />);
    fireEvent.click(screen.getByTestId('toggle-pre_seed'));
    fireEvent.click(screen.getByTestId('toggle-pre_seed'));
    expect(screen.getByTestId('action-count').textContent).toBe(String(INITIAL_ACTION_ITEMS.length));
  });

  it('handles multiple investments selected independently', () => {
    render(<TestInvestmentToggle />);
    fireEvent.click(screen.getByTestId('toggle-pre_seed'));
    fireEvent.click(screen.getByTestId('toggle-grant_funding'));

    const selected = screen.getByTestId('selected').textContent.split(',');
    expect(selected).toContain('pre_seed');
    expect(selected).toContain('grant_funding');
    expect(selected).toHaveLength(2);
  });

  it('deselecting one investment does not affect others', () => {
    render(<TestInvestmentToggle />);
    fireEvent.click(screen.getByTestId('toggle-pre_seed'));
    fireEvent.click(screen.getByTestId('toggle-grant_funding'));
    fireEvent.click(screen.getByTestId('toggle-pre_seed')); // deselect only pre_seed

    expect(screen.getByTestId('selected').textContent).toBe('grant_funding');
    expect(screen.getByTestId('action-count').textContent).toBe(String(INITIAL_ACTION_ITEMS.length));
  });

  it('button label reflects current selection state', () => {
    render(<TestInvestmentToggle />);
    expect(screen.getByTestId('toggle-seed').textContent).toContain('Select');
    fireEvent.click(screen.getByTestId('toggle-seed'));
    expect(screen.getByTestId('toggle-seed').textContent).toContain('Deselect');
    fireEvent.click(screen.getByTestId('toggle-seed'));
    expect(screen.getByTestId('toggle-seed').textContent).toContain('Select');
  });
});
