import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');

describe('Akte top navigation layout', () => {
  it('uses user-intent navigation instead of internal module tabs', () => {
    expect(html).toContain('class="view-tabs akte-nav product-nav"');
    expect(html).toContain('aria-label="Akte-Arbeitsfluss"');
    expect(html).toContain('data-view="akte"');
    expect(html).toContain('Akte</span>');
    expect(html).toContain('Grundlagen</span>');
    expect(html).toContain('Bearbeiten</span>');
    expect(html).toContain('Evidenz & Systeme</span>');
    expect(html).toContain('Prüfen & Klären</span>');
    expect(html).toContain('Präsentation</span>');
    expect(html).toContain('Export</span>');
  });

  it('keeps secondary tools reachable as work areas, not as a competing nav level', () => {
    expect(html).not.toContain('class="support-tabs"');
    expect(html).not.toContain('Detailwerkzeuge</summary>');
    expect(html).toContain('data-view-panel="measureWorkspace"');
    expect(html).toContain('data-jump-view="projectPlan"');
    expect(html).toContain('data-jump-view="results"');
    expect(html).toContain('id="expertModeToggle"');
  });

  it('keeps the header visually calm with one primary action group and collapsed workstand context', () => {
    expect(html).toContain('class="product-kicker">Digitale Akte</p>');
    expect(html).toContain('class="process-notice compact-process-notice"');
    expect(html).toContain('<span class="process-summary-label">Arbeitsstand</span>');
    expect(html).toContain('id="clarificationCounter" class="context-chip context-link"');
    expect(html).toContain('<button type="button" id="exportModel">Daten herunterladen</button>');
    expect(html).toContain('<button type="button" id="printReport">Report drucken</button>');
    expect(css).toContain('.compact-process-notice:not([open]) .process-notice-body');
    expect(css).toContain('grid-template-columns: repeat(6, minmax(48px, 1fr));');
    expect(css).toContain('.phase-stepper b {');
    expect(ui).toContain('function phaseStepperLabel');
    expect(ui).toContain("entscheidungsvorlage: 'Vorlage'");
    expect(ui).toContain('const compactStatus = `Stand: ${phase} · ${maturity.score} % Entscheidungsreife · ${openCount} Klärpunkte offen`;');
    expect(ui).not.toContain('maturityScore()} % Entscheidungsreife');
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
