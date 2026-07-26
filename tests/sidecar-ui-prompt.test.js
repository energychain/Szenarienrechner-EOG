import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildAiPrompt, defaultAiPromptOptions, redactModelForPrompt } from '../src/ai-prompt-generator.js';

const indexHtml = readFileSync('index.html', 'utf8');
const uiJs = readFileSync('src/ui.js', 'utf8');

function baseModel(sidecar) {
  return {
    inputs: { sector: 'strom', baseYear: 2027, baseEog: 10000, rab: 50000, returnRate: 5, financingRate: 4, horizon: 10, discountRate: 5 },
    measures: [{ id: 'm1', name: 'Netzmaßnahme', active: true, cost: 100, year: 2027, life: 20, secure: 100, uncertain: 0, probability: 0 }],
    process: { phase: 'massnahmenbewertung', resume: { nextStep: 'Sidecar prüfen' } },
    projectPlan: null,
    sidecar,
  };
}

describe('sidecar UI and prompt integration', () => {
  test('adds Kontext & Evidenz as separate app view, not as measure table', () => {
    expect(indexHtml).toContain('data-view="sidecar"');
    expect(indexHtml).toContain('Kontext & Evidenz');
    expect(indexHtml).toContain('id="sidecarBody"');
    expect(indexHtml).toContain('id="addSidecarObject"');
    expect(uiJs).toContain('renderSidecar');
    expect(uiJs).toContain('normalizeSidecar');
  });

  test('sidecar editor fields expose contextual info help affordances', () => {
    expect(uiJs).toContain('data-help-id="sidecarTitle"');
    expect(uiJs).toContain('data-help-id="sidecarEvidenceStatus"');
    expect(uiJs).toContain('data-help-id="sidecarCalculationImpact"');
    expect(uiJs).toContain('data-help-id="sidecarExportStatus"');
    expect(uiJs).toContain('data-help-id="sidecarLinkedMeasures"');
    expect(uiJs).toContain('querySelectorAll(\'label[for], label[data-help-id]\')');
  });

  test('prompt exports sidecar as aggregated context, not KPI measure', () => {
    const sidecar = {
      objects: [{
        id: 'ctx_load',
        type: 'load_request',
        division: 'strom',
        title: 'Großanschlussanfrage 2030',
        summary: 'Interner Detailtext',
        evidenceStatus: 'source_available',
        calculationImpact: 'indirect',
        sensitivity: 'private',
        exportStatus: 'sanitized_only',
        openQuestions: ['Netzbereich nachführen'],
      }],
      sources: [{ id: 'src_load', title: 'Interne Lastplanung', sensitivity: 'private', exportStatus: 'sanitized_only' }],
    };
    const promptOptions = { ...defaultAiPromptOptions, dataScope: defaultAiPromptOptions.dataScope, omitNotes: true };
    const snapshot = redactModelForPrompt(baseModel(sidecar), promptOptions);
    expect(snapshot.sidecar.summary.total).toBe(1);
    expect(snapshot.sidecar.objects[0].summary).toContain('sanitisiert');
    expect(snapshot.measures).toHaveLength(1);
    expect(snapshot.measures[0].name).toBe('Netzmaßnahme');
    expect(snapshot.measures.some(measure => measure.name === 'Großanschlussanfrage 2030')).toBe(false);

    const prompt = buildAiPrompt(baseModel(sidecar), promptOptions);
    expect(prompt).toContain('## Kontext & Evidenz / Sidecar');
    expect(prompt).toContain('Sidecar-Objekte sind standardmäßig nicht KPI-wirksam');
    expect(prompt).toContain('Großanschlussanfrage 2030');
  });
});
