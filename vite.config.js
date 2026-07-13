import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

function gitValue(command, fallback) {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback;
  } catch (_error) {
    return fallback;
  }
}

const buildCommit = process.env.VITE_BUILD_COMMIT || gitValue('git rev-parse --short=12 HEAD', 'unknown');
const buildTime = process.env.VITE_BUILD_TIME || new Date().toISOString();

process.env.VITE_BUILD_COMMIT = buildCommit;
process.env.VITE_BUILD_TIME = buildTime;

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
    emptyOutDir: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
