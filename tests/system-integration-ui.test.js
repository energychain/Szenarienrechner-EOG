import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');
const engine = readFileSync('src/engine.js', 'utf8');
const spreadsheet = readFileSync('src/spreadsheet-export.js', 'utf8');
const clarifications = readFileSync('src/clarifications.js', 'utf8');
const modelNormalize = readFileSync('src/model-normalize.js', 'utf8');

describe('system integration UI', () => {
  it('adds an audit-friendly system reference block to the measure modal', () => {
    expect(html).toContain('Systemreferenzen / Rückspielweg');
    expect(html).toContain('id="mSourceSystem"');
    expect(html).toContain('id="mSourceRecordId"');
    expect(html).toContain('id="mScoringRef"');
    expect(html).toContain('id="mAssetSystemRef"');
    expect(html).toContain('id="mErpRef"');
    expect(html).toContain('id="mRiskDbRef"');
    expect(html).toContain('id="mSourceStatus"');
    expect(modelNormalize).toContain('sourceSystem: String(measure.sourceSystem ||');
    expect(modelNormalize).toContain('sourceRecordId: String(measure.sourceRecordId ||');
  });

  it('adds a structured risk mapping block without changing KPI formulas', () => {
    expect(html).toContain('Risiko-Mapping / Datenbankbezug');
    expect(html).toContain('id="mRiskEvidenceStatus"');
    expect(html).toContain('id="mRiskOwnerRole"');
    expect(html).toContain('id="mRiskAssessmentStatus"');
    expect(engine).toContain('Risiko-Mapping');
    expect(spreadsheet).toContain('Risiko_Mapping');
  });

  it('renders prioritization signals for clarifications and the report', () => {
    expect(clarifications).toContain('clarificationPriorityFor');
    expect(ui).toContain('priority-badge');
    expect(ui).toContain('Arbeitsakte ersetzt kein führendes System');
    expect(ui).toContain('systemIntegrationReportHtml');
    expect(spreadsheet).toContain('Klaerpunkte_Priorisiert');
  });
});
