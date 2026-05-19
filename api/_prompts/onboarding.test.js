import { describe, it, expect } from 'vitest';
import { ONBOARDING_SYSTEM_PROMPT, buildOnboardingMessages } from './onboarding.js';

describe('onboarding prompt', () => {
  it('system prompt contains all 10 category names', () => {
    const categories = [
      'Product & Technology', 'Market Traction', 'Business Model', 'Team',
      'Go-to-Market', 'Financial Health', 'Fundraising', 'Competitive Position',
      'Operations', 'Legal',
    ];
    for (const cat of categories) {
      expect(ONBOARDING_SYSTEM_PROMPT).toContain(cat);
    }
  });

  it('system prompt contains summary generation instructions', () => {
    expect(ONBOARDING_SYSTEM_PROMPT).toContain('[ONBOARDING_SUMMARY]');
    expect(ONBOARDING_SYSTEM_PROMPT).toContain('[/ONBOARDING_SUMMARY]');
  });

  it('system prompt contains adaptive escalation rules', () => {
    expect(ONBOARDING_SYSTEM_PROMPT.toLowerCase()).toContain('concept');
    expect(ONBOARDING_SYSTEM_PROMPT.toLowerCase()).toContain('validated');
  });

  it('buildOnboardingMessages returns system + conversation messages', () => {
    const history = [
      { role: 'user', content: 'We are a fintech startup' },
      { role: 'assistant', content: 'Tell me more about your product' },
    ];
    const messages = buildOnboardingMessages(history);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe(ONBOARDING_SYSTEM_PROMPT);
    expect(messages.slice(1)).toEqual(history);
  });

  it('buildOnboardingMessages works with empty history', () => {
    const messages = buildOnboardingMessages([]);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('system');
  });
});
