import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');

describe('CR-01 navigation and orientation', () => {
  it('exposes deep views and provides a local command palette', () => {
    expect(html).toContain('id="globalSearch"');
    expect(html).toContain('id="commandPalette"');
    expect(html).toContain('data-view="results"');
    expect(html).toContain('data-view="projectPlan"');
    expect(ui).toContain('function openCommandPalette');
    expect(ui).toContain('Ctrl/Cmd+K');
    expect(ui).toContain('focusSearchResultTarget');
    expect(css).toContain('.sticky-kpis.compact');
    expect(css).toContain('@media (max-height: 850px)');
  });
});

describe('CR-02 accessible info popovers', () => {
  it('does not rely on title attributes for info dots', () => {
    expect(ui).toContain('aria-expanded');
    expect(ui).toContain('aria-controls');
    expect(ui).toContain('toggleFieldHelp');
    expect(ui).toContain('hideFieldHelp();');
    expect(ui).not.toContain('button.title = help');
  });
});

describe('CR-03 keyboard and accessibility basics', () => {
  it('adds skip link, dialog helpers, labels, scope and media preferences', () => {
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('<main id="mainContent"');
    expect(ui).toContain('function openModal');
    expect(ui).toContain('function trapModalFocus');
    expect(ui).toContain("event.key === 'Escape'");
    expect(ui).toContain("event.key === 'Enter' || event.key === ' '");
    expect(ui).toContain('enhanceTableScopes');
    expect(ui).toContain('ensureAccessibleLabels');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain(':focus-visible');
  });
});

describe('CR-04 error tolerance', () => {
  it('adds undo snapshots, formatted amounts, validation and danger-zone typed confirmation', () => {
    expect(ui).toContain('captureUndoSnapshot');
    expect(ui).toContain('showUndoToast');
    expect(ui).toContain('formatNumericFields');
    expect(ui).toContain('parseLocalizedNumber');
    expect(ui).toContain('renderPlausibilityWarnings');
    expect(ui).toContain('openDangerZoneModal');
    expect(html).toContain('id="dangerZoneModal"');
    expect(html).toContain('LÖSCHEN');
    expect(html).toContain('inputmode="numeric"');
    expect(css).toContain('.field-warning');
    expect(css).toContain('.input-with-unit');
  });
});
