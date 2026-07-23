import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ui = fs.readFileSync(path.join(root, 'src/ui.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');

describe('management report strategy contribution table', () => {
  it('renders measure names as wrapping list items instead of one nowrap comma-separated line', () => {
    expect(ui).toContain('function strategyMeasureNamesCell');
    expect(ui).toContain('strategy-measure-list');
    expect(ui).toContain('strategy-measures-cell');
    expect(ui).toContain('table class="strategy-contribution-table"');
    expect(ui).not.toContain("unassigned.map(item => item.measure.name).join(', ')");
  });

  it('overrides global table nowrap rules for the strategy measure column', () => {
    expect(css).toContain('.report-section {');
    expect(css).toContain('min-width: 0;');
    expect(css).toContain('.strategy-contribution-table');
    expect(css).toContain('table-layout: fixed;');
    expect(css).toContain('.strategy-measures-cell');
    expect(css).toContain('white-space: normal;');
    expect(css).toContain('overflow-wrap: anywhere;');
    expect(css).toContain('.strategy-measure-list li');
  });
});
