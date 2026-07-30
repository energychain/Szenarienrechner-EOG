import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');
const concept = readFileSync('docs/UX_PRODUCT_STRUCTURE_2026-07-30.md', 'utf8');

describe('UX review product structure', () => {
  it('documents the target concept and four implementation phases', () => {
    expect(concept).toContain('Digitale Akte: Zielstruktur nach Usability-Review');
    expect(concept).toContain('Phase 1: Eine Navigationsebene');
    expect(concept).toContain('Phase 2: Statusanzeigen deduplizieren');
    expect(concept).toContain('Phase 3: Sicheres Bearbeiten und Undo');
    expect(concept).toContain('Phase 4: Hilfe, Tastatur und Barrierefreiheit');
  });

  it('uses one primary navigation level and promotes Grundlagen to the main workflow', () => {
    expect(html).toContain('class="view-tabs akte-nav product-nav"');
    expect(html).toContain('data-view="basis"');
    expect(html).toContain('Grundlagen</span>');
    expect(html).not.toContain('class="support-tabs"');
    expect(html).not.toContain('Detailwerkzeuge</summary>');
    expect(css).toContain('.product-nav .workflow-tabs');
  });

  it('moves phase editing out of the header popover into Grundlagen', () => {
    expect(html).toContain('id="phaseEditorPanel"');
    expect(html).toContain('Arbeitsstand & Phase pflegen');
    expect(html).toContain('Phase ändern');
    expect(html).not.toContain('compact-popover-body">\n              <div id="phaseStepper" class="phase-stepper" aria-label="Phasenfortschritt"></div>\n              <div class="process-controls">');
  });

  it('deduplicates high-level status and replaces cryptic badges with purpose labels', () => {
    expect(ui).toContain('const navStatusLabels =');
    expect(ui).toContain("status-results");
    expect(html).toContain('Akte / Entscheidung im Detail');
    expect(html).toContain('Akte / Projektplan');
    expect(ui).not.toContain('`${maturity.score} % Reife`');
    expect(ui).not.toContain('`${maturity.blockers} offen`');
    expect(html).toContain('Einschätzung</div>');
    expect(html).not.toContain('<div class="label">Verdict</div>');
    expect(css).toContain('body:not([data-view="results"]):not([data-view="report"]) .sticky-kpis');
  });

  it('groups the more menu and marks destructive actions with consequences', () => {
    expect(html).toContain('menu-section-title">Export');
    expect(html).toContain('menu-section-title">Hilfe & Kontext');
    expect(html).not.toContain('menu-section-title">Unterstützung');
    expect(html).toContain('menu-section-title danger">Arbeitsstand ersetzen oder löschen');
    expect(html).toContain('data-confirm-action="resetModel"');
    expect(html).toContain('data-confirm-action="clearBrowserData"');
    expect(ui).toContain('function confirmDangerousAction');
    expect(ui).toContain('Diese Aktion verändert oder löscht den lokalen Arbeitsstand.');
  });

  it('adds visible feedback and an undo affordance for bulk edits', () => {
    expect(html).toContain('id="appToast"');
    expect(html).toContain('id="undoLastBulkAction"');
    expect(ui).toContain('let lastUndoSnapshot = null;');
    expect(ui).toContain('function captureUndoSnapshot');
    expect(ui).toContain('function restoreLastUndoSnapshot');
    expect(ui).toContain("showToast('Bulk-Aktion angewendet. Rückgängig ist kurzzeitig möglich.'");
    expect(ui).toContain("node.textContent = 'Lokaler Arbeitsstand im Browser aktiv.'");
  });

  it('removes the placeholder measure workspace until a real full-page editor exists', () => {
    expect(html).not.toContain('data-view-panel="measureWorkspace"');
    expect(html).not.toContain('Maßnahmen-Workspace');
    expect(ui).not.toContain('function openMeasureWorkspace');
    expect(html).not.toContain('Maßnahme im Workspace öffnen');
  });

  it('adds keyboard and visible help affordances without relying only on hover titles', () => {
    expect(ui).toContain("event.key === 'ArrowRight'");
    expect(ui).toContain("event.key === 'ArrowLeft'");
    expect(html).toContain('inline-help-panel');
    expect(css).toContain('.inline-help-panel');
  });
});
