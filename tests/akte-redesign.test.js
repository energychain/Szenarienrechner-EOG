import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');
const inventory = readFileSync('docs/UX_ELEMENT_INVENTORY.md', 'utf8');
const design = readFileSync('docs/UX_AKTE_REDESIGN.md', 'utf8');

describe('Akte redesign inventory coverage', () => {
  it('documents the current inventory and redesign quality gate', () => {
    expect(inventory).toContain('View-Panels');
    expect(inventory).toContain('Navigation und Orientierung');
    expect(inventory).toContain('Regressions-Checkliste');
    expect(inventory).toContain('Globale Suche im Header');
    expect(inventory).toContain('Glossar-Modal');
    expect(inventory).toContain('Danger-Zone-Dialog mit „LÖSCHEN“-Bestätigung');
    expect(design).toContain('digitale, präsentier- und auditierbare Akte');
    expect(design).toContain('Keine View soll im Normalzustand die gesamte Seite scrollen lassen');
  });

  it('keeps all pre-existing view panels reachable and adds Akte plus presentation', () => {
    ['basis', 'measures', 'expertWork', 'results', 'report', 'sidecar', 'projectPlan', 'akte', 'presentation'].forEach(view => {
      expect(html).toContain(`data-view-panel="${view}"`);
    });
    ['akte', 'measures', 'sidecar', 'expertWork', 'presentation', 'report', 'basis'].forEach(view => {
      expect(html).toContain(`data-view="${view}"`);
    });
    expect(html).toContain('data-jump-view="results"');
    expect(html).toContain('data-jump-view="projectPlan"');
  });

  it('keeps central global actions and advanced dialogs present', () => {
    [
      'importModel', 'exportModel', 'exportSelfContainedHtml', 'printReport', 'openHelp', 'checkReleaseAwareness',
      'openAiPromptGenerator', 'exportSpreadsheetXlsx', 'exportSpreadsheetCsvZip', 'exportSupportPackage',
      'loadDemoModel', 'resetModel', 'clearBrowserData', 'clarificationCounter', 'wizardModal', 'bulkImportModal',
      'clarificationAuditModal', 'measureEditModal', 'aiPromptModal', 'helpModal'
    ].forEach(id => {
      expect(html).toContain(`id="${id}"`);
    });
  });

  it('keeps the cockpit cards compact and opens details through card clicks', () => {
    ['akteDecisionCard', 'akteClarificationsCard', 'akteEvidenceCard', 'akteReliabilityCard', 'akteFlowDiagram', 'akteNextStepCard'].forEach(id => {
      expect(html).toContain(`id="${id}"`);
      expect(html).toMatch(new RegExp(`id="${id}"[^>]+role="button"[^>]+data-jump-view=`));
    });
    expect(ui).toContain('card-link-hint');
    expect(ui).not.toContain('data-clarification-jump="${esc(item.key)}"');
    expect(css).toContain('.akte-lower-grid {\n  display: none;');
    expect(css).toContain('body[data-view="akte"] .sticky-kpis');
    expect(css).toContain('@media (max-height: 700px) and (min-width: 1181px)');
    expect(css).toContain('.akte-card:hover');
    expect(css).toContain('-webkit-line-clamp: 2;');
  });

  it('renders the new guided cockpit and presentation mode from the existing model state', () => {
    expect(ui).toContain('function renderAkteCockpit');
    expect(ui).toContain('function renderPresentation');
    expect(ui).toContain('function presentationSlides');
    expect(ui).toContain('workstandReliabilityFor(currentModelData(), result)');
    expect(ui).toContain('sidecarSummary(normalizeSidecar(sidecar))');
    expect(ui).toContain('data-jump-view');
  });
});
