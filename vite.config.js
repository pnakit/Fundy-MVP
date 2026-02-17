import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/chat': {
          target: env.DIFY_BASE_URL || 'https://api.dify.ai/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/chat/, '/chat-messages'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.DIFY_API_KEY}`);
            });
          },
        },
        '/api/upload': {
          target: env.DIFY_BASE_URL || 'https://api.dify.ai/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/upload/, '/files/upload'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.DIFY_API_KEY}`);
            });
          },
        },
      },
    },
  };
});
