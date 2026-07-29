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
    expect(ui).not.toContain('Felder, Maßnahmenbezug und Brückenlogik öffnen</small>');
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

  it('lets users edit a clarification source before writing the closing note and returns to the kanban', () => {
    expect(ui).toContain('Nächster Schritt: Ursache bearbeiten, danach Klärnotiz speichern.');
    expect(ui).toContain('Klärung speichern');
    expect(ui).toContain('Empfohlener Ablauf: erst Datenstelle bearbeiten, dann mit kurzer Notiz auditierbar abschließen.');
    expect(ui).toContain("measureEditReturnView = 'expertWork'");
    expect(ui).toContain("openClarificationMeasure(openButton.dataset.measureId, openButton.dataset.clarificationKey || '')");
    expect(ui).not.toContain('const note = clarificationAuditNoteOrError();\n  if (!note) return;\n  const item = pendingClarificationAudit.item;');
  });

  it('renders report sidecars as styled cards instead of an unformatted bullet dump', () => {
    expect(ui).toContain('report-sidecar-list');
    expect(ui).toContain('report-sidecar-item');
    expect(css).toContain('.report-sidecar-list');
    expect(css).toContain('.report-sidecar-item');
  });
});
