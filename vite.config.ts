import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = dirname(fileURLToPath(import.meta.url));

const sourceDir = resolve(rootDir, 'src');

const projectInputs = Object.fromEntries(
  readdirSync(resolve(sourceDir, 'projects'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [entry.name, resolve(sourceDir, `projects/${entry.name}/index.html`)]),
);

export default defineConfig({
  root: sourceDir,
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
    },
    hmr: {
      host: 'localhost',
      clientPort: 8081,
    },
  },
  build: {
    outDir: resolve(rootDir, 'site'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(sourceDir, 'index.html'),
        portfolioDocument: resolve(sourceDir, 'documents/portfolio/index.html'),
        resumeDocument: resolve(sourceDir, 'documents/resume/index.html'),
        ...projectInputs,
      },
    },
  },
});
