import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const uiJs = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
const engineJs = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');

describe('gas transformation UI', () => {
  it('adds a gas-specific transformation layer without making it a Strom input path', () => {
    expect(indexHtml).toContain('Gas-Transformationspfad');
    expect(indexHtml).toContain('mGasTransformationPath');
    expect(indexHtml).toContain('mGasEternityAssumption');
    expect(indexHtml).toContain('Wegfall der Ewigkeitsvermutung');
    expect(indexHtml).toContain('mGasRegulatoryTreatment');
    expect(indexHtml).toContain('mGasProvisionAssessment');
    expect(indexHtml).toContain('helperGasTransformation');
    expect(uiJs).toContain('gasTransformationHelper');
    expect(uiJs).toContain("document.body.classList.toggle('sector-gas'");
    expect(uiJs).toContain("document.body.classList.toggle('sector-strom'");
    expect(uiJs).toContain('renderGasTransformationLayer(measure)');
  });

  it('persists gas transformation fields with measures and renders a prüfpflichtig helper', () => {
    expect(uiJs).toContain('gasTransformationPath: el.mGasTransformationPath.value');
    expect(uiJs).toContain('gasAssetScope: el.mGasAssetScope.value');
    expect(uiJs).toContain('gasEternityAssumption: el.mGasEternityAssumption.value');
    expect(uiJs).toContain('gasProvisionAssessment: el.mGasProvisionAssessment.value');
    expect(uiJs).toContain('gasRegulatoryTreatment: el.mGasRegulatoryTreatment.value');
    expect(uiJs).toContain('Rückstellung prüfen');
    expect(uiJs).toContain('keine automatische Entscheidung');
    expect(uiJs).toContain('Nutzungsdauer-Entscheid erforderlich');
  });

  it('keeps unknown gas object scope explicitly open instead of defaulting to distribution grid', () => {
    expect(indexHtml).toContain('<option value="unclear">Objektart offen / zu klären</option>');
    expect(uiJs).toContain("el.mGasAssetScope.value = measure.gasAssetScope || 'unclear'");
    expect(uiJs).not.toContain("measure.gasAssetScope || 'distributionLine'");
  });

  it('shows cautious scenario and decision wording in report views', () => {
    expect(uiJs).toContain('Basis- und Konservativ-Szenario sind identisch');
    expect(engineJs).toContain('prüfpflichtigen Arbeitsstand');
    expect(uiJs).toContain('metrics.governanceDecision.recommendation');
  });
});
