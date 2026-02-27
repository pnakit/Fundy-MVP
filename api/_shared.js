const WORKFLOW_KEYS = {
  onboarding: () => process.env.DIFY_ONBOARDING_API_KEY,
  deepdive: () => process.env.DIFY_DEEPDIVE_API_KEY,
};

export function resolveApiKey(workflow) {
  const getter = WORKFLOW_KEYS[workflow];
  const requestedKey = getter ? getter() : undefined;
  const fallbackKey = WORKFLOW_KEYS.onboarding();
  const apiKey = requestedKey || fallbackKey;
  const usingFallback = !requestedKey && workflow !== 'onboarding';
  return { apiKey, usingFallback };
}

export function getDifyBaseUrl() {
  return process.env.DIFY_BASE_URL || 'https://api.dify.ai/v1';
}
