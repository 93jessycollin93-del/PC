import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5000,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      plugins: [react()],
      build: {
        chunkSizeWarningLimit: 1600,
        rollupOptions: {
          output: {
            // Split the biggest self-contained vendors out of the main bundle
            // so app-code changes don't invalidate the whole download.
            manualChunks(id: string) {
              if (!id.includes('node_modules')) return undefined;
              if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
              if (id.includes('node_modules/@firebase') || id.includes('node_modules/firebase')) return 'vendor-firebase';
              if (id.includes('node_modules/@google/genai')) return 'vendor-genai';
              if (id.includes('node_modules/chess.js') || id.includes('node_modules/react-chessboard')) return 'vendor-chess';
              if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
              return undefined;
            },
          },
        },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
