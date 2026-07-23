import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const browserSmoke = readFileSync(new URL('../scripts/browser-smoke.mjs', import.meta.url), 'utf8');

describe('hidden file input controls', () => {
  it('keeps every programmatic file picker visually hidden', () => {
    expect(indexHtml).toContain('id="importFile" class="hidden-file" type="file"');
    expect(indexHtml).toContain('id="bulkImportFile" class="hidden-file" type="file"');
    expect(indexHtml).not.toContain('id="bulkImportFile" class="hidden" type="file"');
    expect(stylesCss).toMatch(/\.hidden-file\s*\{\s*display:\s*none;\s*\}/);
  });

  it('guards the built app against visible native file pickers in the browser smoke test', () => {
    expect(browserSmoke).toContain("input[type=\"file\"]");
    expect(browserSmoke).toContain('fileInputsHidden');
  });
});
