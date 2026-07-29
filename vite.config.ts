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
        // Emit .vite/manifest.json so the service worker can precache the lazy
        // route chunks. Apps are code-split (see APP_REGISTRY) and those chunks
        // are NOT referenced by index.html, so without this list an app the
        // user never opened while online cannot be opened off-grid — the one
        // moment it matters.
        manifest: true,
        rollupOptions: {
          output: {
            // Split the biggest self-contained vendors out of the main bundle
            // so app-code changes don't invalidate the whole download, and
            // keep the desktop shell small as apps are added.
            //
            // Matches are anchored to node_modules/<pkg>/ rather than a bare
            // substring: an unanchored 'react-dom' or 'firebase' also catches
            // packages that merely mention them in a path, which lands them in
            // the wrong chunk.
            manualChunks(id: string) {
              if (!id.includes('node_modules')) return undefined;
              if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
              if (id.includes('node_modules/@firebase') || id.includes('node_modules/firebase')) return 'vendor-firebase';
              if (id.includes('node_modules/@google/genai')) return 'vendor-genai';
              if (id.includes('node_modules/chess.js') || id.includes('node_modules/react-chessboard')) return 'vendor-chess';
              if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
              // Everything else in node_modules goes to a shared vendor chunk
              // instead of being inlined into whichever app imported it first.
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
