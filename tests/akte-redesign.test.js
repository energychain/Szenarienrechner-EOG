import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');
const inventory = readFileSync('docs/UX_ELEMENT_INVENTORY.md', 'utf8');
const design = readFileSync('docs/UX_AKTE_REDESIGN.md', 'utf8');

describe('Akte redesign inventory coverage', () => {
  it('documents the pre-redesign inventory and redesign quality gate', () => {
    expect(inventory).toContain('Vorhandene Views');
    expect(inventory).toContain('Globale Aktionen');
    expect(inventory).toContain('Redesign-Erweiterungen');
    expect(design).toContain('digitale, präsentier- und auditierbare Akte');
    expect(design).toContain('Keine View soll im Normalzustand die gesamte Seite scrollen lassen');
  });

  it('keeps all pre-existing view panels reachable and adds Akte plus presentation', () => {
    ['basis', 'measures', 'expertWork', 'results', 'report', 'sidecar', 'projectPlan', 'akte', 'presentation'].forEach(view => {
      expect(html).toContain(`data-view-panel="${view}"`);
    });
    ['akte', 'measures', 'sidecar', 'expertWork', 'presentation', 'report', 'basis', 'results', 'projectPlan'].forEach(view => {
      expect(html).toContain(`data-view="${view}"`);
    });
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

  it('renders the new guided cockpit and presentation mode from the existing model state', () => {
    expect(ui).toContain('function renderAkteCockpit');
    expect(ui).toContain('function renderPresentation');
    expect(ui).toContain('function presentationSlides');
    expect(ui).toContain('workstandReliabilityFor(currentModelData(), result)');
    expect(ui).toContain('sidecarSummary(normalizeSidecar(sidecar))');
    expect(ui).toContain('data-jump-view');
  });
});
