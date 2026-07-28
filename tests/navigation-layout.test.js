import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');

describe('Akte top navigation layout', () => {
  it('uses user-intent navigation instead of internal module tabs', () => {
    expect(html).toContain('class="view-tabs akte-nav"');
    expect(html).toContain('aria-label="Akte-Arbeitsfluss"');
    expect(html).toContain('data-view="akte"');
    expect(html).toContain('Akte</span>');
    expect(html).toContain('Bearbeiten</span>');
    expect(html).toContain('Evidenz & Systeme</span>');
    expect(html).toContain('Prüfen & Klären</span>');
    expect(html).toContain('Präsentation</span>');
    expect(html).toContain('Export</span>');
  });

  it('keeps secondary tools reachable without dominating the main path', () => {
    expect(html).toContain('class="support-tabs"');
    expect(html).toContain('aria-label="Werkzeuge und Detailpflege"');
    expect(html).toContain('class="support-tabs-label">Werkzeuge</span>');
    expect(html).toContain('data-view="basis"');
    expect(html).toContain('data-view="results"');
    expect(html).toContain('data-view="projectPlan"');
    expect(html).toContain('id="expertModeToggle"');
  });

  it('adds semantic colors, no-page-scroll workspaces and subtle motion', () => {
    expect(css).toContain('--akte-blue');
    expect(css).toContain('--akte-violet');
    expect(css).toContain('body {');
    expect(css).toContain('overflow: hidden;');
    expect(css).toContain('.akte-cockpit');
    expect(css).toContain('.presentation-view');
    expect(css).toContain('@keyframes viewIn');
  });
});
