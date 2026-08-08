import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Separate, minimal Vite entry point for the second UI ("digitale Akte"),
// kept deliberately apart from vite.config.js so the existing build:release
// pipeline (index.html -> app.html/szenarienrechner-eog.html, homepage
// overwrite, release manifest) stays untouched. Emits its own self-contained
// dist/akte.html next to the existing deliverable (Spezifikation Abschnitt 8).
function gitValue(command, fallback) {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback;
  } catch (_error) {
    return fallback;
  }
}

const buildCommit = process.env.VITE_BUILD_COMMIT || gitValue('git rev-parse --short=12 HEAD', 'unknown');
const buildTime = process.env.VITE_BUILD_TIME || new Date().toISOString();

export default defineConfig({
  plugins: [viteSingleFile()],
  define: {
    'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(buildCommit),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime)
  },
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    modulePreload: false,
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'akte.html'),
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
