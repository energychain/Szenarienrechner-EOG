import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');

describe('workflow density and clarification UX fixes', () => {
  it('keeps sidecar summary counters actionable and uses one clear edit action', () => {
    expect(ui).toContain('data-sidecar-summary-filter="open_questions"');
    expect(html).toContain('<option value="open_questions">offene Prüfpunkte</option>');
    expect(ui).toContain('sidecarModeFilter = button.dataset.sidecarSummaryFilter');
    expect(ui).toContain('Bearbeiten/Verknüpfen');
    expect(ui).not.toContain('Felder, Maßnahmenbezug und Überleitungslogik öffnen</small>');
    expect(css).toContain('.summary-card-button');
    expect(css).toContain('.sidecar-edit-action span');
  });

  it('collapses secondary measure tools so the measure list gets the primary space', () => {
    expect(html).toContain('catalog-secondary-tools');
    expect(html).toContain('<summary><strong id="catalogQuickTitle">Schnelllisten</strong>');
    expect(html).toContain('<summary><strong id="catalogBulkTitle">Auswahl bearbeiten</strong>');
    expect(css).toContain('body[data-view="measures"] [data-view-panel="measures"]');
    expect(css).toContain('grid-template-rows: auto auto minmax(0, 1fr);');
    expect(css).toContain('body[data-view="measures"] [data-view-panel="measures"] > .table-wrap');
  });

  it('lets users edit data and audit note in one clarification workbench and returns to the kanban', () => {
    expect(ui).toContain('Aufgabe: ${esc(target.task)}');
    expect(ui).toContain('Daten & Notiz bearbeiten');
    expect(ui).toContain('Datenänderung & Klärung speichern');
    expect(ui).toContain('ensureClarificationProjectTask(item');
    expect(ui).toContain('projectTaskIdForClarification');
    expect(ui).toContain("measureEditReturnView = 'expertWork'");
    expect(ui).toContain('saveMeasureClarificationFromWorkbench');
    expect(ui).not.toContain('Nächster Schritt: Ursache bearbeiten, danach Klärnotiz speichern.');
    expect(html).not.toContain('Datenstelle bearbeiten');
  });

  it('renders report sidecars as styled cards instead of an unformatted bullet dump', () => {
    expect(ui).toContain('report-sidecar-list');
    expect(ui).toContain('report-sidecar-item');
    expect(css).toContain('.report-sidecar-list');
    expect(css).toContain('.report-sidecar-item');
  });
});
