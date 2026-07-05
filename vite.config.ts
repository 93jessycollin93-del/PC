import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      build: {
        // Compression foundation: split heavy vendor libs into their own
        // cached chunks so the desktop shell stays small as apps are added.
        rollupOptions: {
          output: {
            manualChunks(id: string) {
              if (!id.includes('node_modules')) return undefined;
              if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react';
              if (id.includes('@google/genai')) return 'vendor-genai';
              if (id.includes('firebase') || id.includes('@firebase')) return 'vendor-firebase';
              if (id.includes('lucide-react')) return 'vendor-icons';
              return 'vendor';
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
