import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');
const clarifications = readFileSync('src/clarifications.js', 'utf8');

describe('presentation focus window and clarification kanban', () => {
  it('renders presentation as a closeable focused meeting window', () => {
    expect(html).toContain('class="presentation-close" data-jump-view="akte"');
    expect(html).toContain('Schließen</button>');
    expect(html).toContain('<h2>Präsentation</h2>');
    expect(ui).toContain('presentation-slide-content');
    expect(ui).toContain('presentation-body');
    expect(ui).toContain("title: `${sectorLabel}-Planungsakte`");
    expect(ui).toContain('Arbeitsstand-Score');
    expect(ui).toContain('von 100 Entscheidungsreife');
    expect(ui).toContain('presentation-title-grid');
    expect(ui).toContain('presentation-maturity-callout');
    expect(css).toContain('body[data-view="presentation"] .compact-akte-nav');
    expect(css).toContain('body[data-view="presentation"] .sticky-kpis');
    expect(css).toContain('body[data-view="presentation"] footer');
    expect(css).toContain('body[data-view="presentation"] main');
    expect(css).toContain('presentation-slide-actions');
    expect(css).toContain('.presentation-title-grid');
    expect(css).toContain('.presentation-maturity-callout');
    expect(css).toContain('-webkit-line-clamp: 3;');
  });

  it('shows Prüfen & Klären as an actual kanban board instead of a long homogeneous list', () => {
    expect(html).toContain('Klärpunkt-Kanban');
    expect(clarifications).toContain('function workItemColumn');
    expect(ui).toContain('function renderWorkItemCard');
    expect(ui).toContain('work-kanban-board');
    expect(ui).toContain('Hohe Steuerungswirkung');
    expect(ui).toContain('Evidenz / Systeme');
    expect(ui).toContain('Dokumentation');
    expect(ui).toContain('Geklärt');
    expect(css).toContain('.work-kanban-board');
    expect(css).toContain('height: 100%;');
    expect(css).toContain('[data-view-panel="expertWork"]');
    expect(css).toContain('overflow: hidden !important;');
    expect(css).toContain('.work-kanban-column.high');
    expect(css).toContain('.work-kanban-card');
    const titleIndex = ui.indexOf('<strong>${esc(item.title)}</strong>');
    const actionIndex = ui.indexOf('work-card-primary-action');
    const measureIndex = ui.indexOf('<p>${esc(item.measure)}</p>');
    expect(titleIndex).toBeGreaterThan(-1);
    expect(actionIndex).toBeGreaterThan(titleIndex);
    expect(actionIndex).toBeLessThan(measureIndex);
  });

  it('derives deterministic evidence and documentation cards from measures and sidecars', () => {
    expect(clarifications).toContain('const impactItems = reviewRequiredImpacts(measures, true).map');
    expect(clarifications).toContain('const noteItems = measures');
    expect(clarifications).toContain("title: 'Maßnahmennotiz klären'");
    expect(clarifications).toContain("warning.type === 'possible_double_counting'");
    expect(clarifications).toContain('function measureEvidenceItems(');
    expect(clarifications).toContain("title: 'Systemreferenz / Rückspielweg ergänzen'");
    expect(clarifications).toContain("title: 'Störungs-/Risikowirkung belegen'");
    expect(clarifications).toContain("title: 'Ziel-Zuordnung dokumentieren'");
    expect(clarifications).toContain('function sidecarClarificationItems(');
    expect(clarifications).toContain("title: 'Evidenz-/Kontextobjekt-Klärpunkt klären'");
    expect(clarifications).toContain("if (['high', 'evidence', 'normal'].includes(item.column)) return item.column;");
    expect(ui).toContain('openSidecarWorkItem');
  });
});
