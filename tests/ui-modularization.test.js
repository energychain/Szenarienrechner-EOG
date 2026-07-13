import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

describe('incremental UI modularization', () => {
  it('keeps formatting and export helpers outside the main UI module', () => {
    const ui = read('src/ui.js');
    expect(ui).toContain("from './render-utils.js'");
    expect(ui).toContain("from './export-utils.js'");
    expect(ui).not.toMatch(/function fmtTeur\(/);
    expect(ui).not.toMatch(/function esc\(/);
    expect(ui).not.toMatch(/function downloadBlob\(/);
    expect(ui).not.toMatch(/function htmlWithEmbeddedModelState\(/);
  });

  it('has dedicated modules for already extracted UI-adjacent concerns', () => {
    const ui = read('src/ui.js');
    for (const modulePath of [
      './demo-data.js',
      './project-plan.js',
      './release-awareness.js',
      './story-navigation.js',
      './render-utils.js',
      './export-utils.js'
    ]) {
      expect(ui).toContain(`from '${modulePath}'`);
    }
  });
});
