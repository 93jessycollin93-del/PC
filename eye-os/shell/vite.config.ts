import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs: the built shell is served from a directory root by
  // busybox httpd on the image, and from a file path during local review.
  // Absolute /assets/ URLs break the second case.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The kiosk loads this off local disk, so one request per app chunk costs
    // nothing — keep the code-splitting that the lazy registry sets up.
    target: 'es2022',
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: {
      // During `npm run dev` the host agent runs separately; forward the VFS
      // API to it so the dev server behaves like the booted image.
      '/api': {
        target: 'http://127.0.0.1:7788',
        changeOrigin: false,
      },
    },
  },
});
