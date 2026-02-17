import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const WORKFLOW_KEYS = {
    onboarding: env.DIFY_ONBOARDING_API_KEY,
    deepdive: env.DIFY_DEEPDIVE_API_KEY,
  };

  // Resolve API key with fallback to onboarding
  const resolveKey = (workflow) => WORKFLOW_KEYS[workflow] || WORKFLOW_KEYS.onboarding || '';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/chat': {
          target: env.DIFY_BASE_URL || 'https://api.dify.ai/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/chat/, '/chat-messages'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              // Default to onboarding key; the serverless function handles
              // workflow routing in production. In dev, we use onboarding key
              // as the proxy can't easily parse the request body for workflow.
              proxyReq.setHeader('Authorization', `Bearer ${resolveKey('onboarding')}`);
            });
          },
        },
        '/api/upload': {
          target: env.DIFY_BASE_URL || 'https://api.dify.ai/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/upload.*/, '/files/upload'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const url = new URL(req.url, 'http://localhost');
              const workflow = url.searchParams.get('workflow') || 'onboarding';
              proxyReq.setHeader('Authorization', `Bearer ${resolveKey(workflow)}`);
            });
          },
        },
      },
    },
  };
});
