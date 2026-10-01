import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // Performance: split the vendor code out of the app bundle.
    // Everything used to ship as one 570KB file, so a visitor paid for the
    // Monaco-sized editor and every icon on the first paint. Splitting the
    // long-lived libraries into cacheable chunks lets the browser reuse them
    // across deploys and lets the heavy modals load only when they open.
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Only split modules that actually exist in this dependency graph.
            // Naming a package that is not imported produces an empty chunk, and
            // several tools treat an empty chunk as a build error.
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react-dom') || id.includes('react\\') || id.includes('/react/')) {
              return 'react';
            }
            if (id.includes('lucide-react')) return 'icons';
            // JSZip is only needed once the visitor opens the export dialog, so
            // it gets its own chunk instead of blocking the first paint.
            if (id.includes('jszip')) return 'zip';
            if (id.includes('@google/genai')) return 'genai';
            if (id.includes('qrcode.react')) return 'qrcode';
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
