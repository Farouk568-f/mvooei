import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_TRANSLATION_API_URL': JSON.stringify(env.VITE_TRANSLATION_API_URL || 'https://6c853744b20c.ngrok-free.app')
      },
      server: {
        proxy: {
          '/proxy': {
            target: 'https://prox-q3zt.onrender.com',
            changeOrigin: true,
            secure: true,
            configure: (proxy) => {
              proxy.on('proxyRes', (proxyRes) => {
                try {
                  // Ensure CORS for dev
                  proxyRes.headers['access-control-allow-origin'] = '*';
                  proxyRes.headers['access-control-allow-headers'] = '*';
                  proxyRes.headers['access-control-allow-methods'] = 'GET,HEAD,OPTIONS';
                } catch {}
              });
            }
          }
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
