import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/** Construit le processus de rappels (Node) en un seul fichier : dist-worker/reminder-worker.mjs */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    ssr: 'scripts/reminder-worker.ts',
    outDir: 'dist-worker',
    emptyOutDir: true,
    copyPublicDir: false,
    target: 'node20',
    rollupOptions: { output: { entryFileNames: 'reminder-worker.mjs', format: 'es' } },
  },
  ssr: { noExternal: [] },
});
