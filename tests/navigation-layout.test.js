import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');

describe('top navigation layout', () => {
  it('separates the core workflow from supporting workstand tools', () => {
    expect(html).toContain('class="workflow-tabs"');
    expect(html).toContain('aria-label="Kernprozess"');
    expect(html).toContain('class="support-tabs"');
    expect(html).toContain('aria-label="Arbeitsstand und Werkzeuge"');
    expect(html).toContain('class="support-tabs-label">Arbeitsstand</span>');
    expect(html).toContain('class="view-tab support-tab" data-view="sidecar"');
    expect(html).toContain('class="view-tab support-tab" data-view="projectPlan"');
  });

  it('keeps the four primary steps as equal-width cards and renders support tabs compactly', () => {
    expect(css).toContain('.workflow-tabs');
    expect(css).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
    expect(css).toContain('.support-tabs');
    expect(css).toContain('.view-tabs .support-tab');
    expect(css).toContain('min-height: 42px;');
    expect(css).toContain('border-style: dashed;');
  });
});
