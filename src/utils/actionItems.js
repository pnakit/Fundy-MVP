/**
 * Action item manipulation utilities.
 *
 * These pure functions encapsulate the logic for adding and removing
 * investment-sourced action items, so the same logic can be shared
 * between App.jsx and tests without duplicating the implementation.
 */

/**
 * Add investment actions to an existing action items array.
 *
 * @param {Array} currentActions - current action items
 * @param {string} investmentId - investment being selected
 * @param {Array} rawActions - action templates from INVESTMENT_ACTIONS[investmentId]
 * @param {Function} generateId - function that returns a unique numeric id
 * @returns {Array} new action items array with investment actions appended
 */
export function addInvestmentActions(currentActions, investmentId, rawActions, generateId) {
  const enriched = rawActions.map((action) => ({
    ...action,
    id: generateId(),
    status: 'pending',
    files: [],
    inputs: {},
    sourceType: 'investment',
    sourceId: investmentId,
    dimensionId: null,
  }));
  return [...currentActions, ...enriched];
}

/**
 * Remove all action items associated with a given investment.
 *
 * @param {Array} currentActions - current action items
 * @param {string} investmentId - investment being deselected
 * @returns {Array} action items with that investment's actions removed
 */
export function removeInvestmentActions(currentActions, investmentId) {
  return currentActions.filter((a) => !(a.sourceType === 'investment' && a.sourceId === investmentId));
}
