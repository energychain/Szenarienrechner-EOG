import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { demoClarificationStatus, demoMeasures, demoSidecar, initialMeasures } from '../src/demo-data.js';

describe('synthetic demo data module', () => {
  it('keeps demo fixtures outside the UI module', () => {
    expect(Array.isArray(initialMeasures)).toBe(true);
    expect(Array.isArray(demoMeasures)).toBe(true);
    expect(demoMeasures.length).toBeGreaterThan(0);

    const ui = readFileSync('src/ui.js', 'utf8');
    expect(ui).toContain("from './demo-data.js'");
    expect(ui).toContain('demoSidecar');
    expect(ui).toContain('demoClarificationStatus');
    expect(ui).not.toContain('const demoMeasures = [');
  });

  it('marks examples as synthetic and avoids real-operator references', () => {
    const demoSource = readFileSync('src/demo-data.js', 'utf8');
    expect(demoSource).toContain('Synthetic demo fixtures only');
    expect(demoSource).toMatch(/synthetisch|Synthetisch/);
    const privateTerms = ['T' + 'WL', ['HERMES', 'BRIEFING'].join('_'), 'Snake', 'snake', ['LI', 'DS'].join(''), ['S', 'AP'].join('')];
    for (const term of privateTerms) {
      expect(demoSource).not.toContain(term);
    }
  });

  it('uses generic ERP-PSP examples for leading-system identifiers', () => {
    expect(demoMeasures.some(measure => String(measure.externalId || '').startsWith('ERP-PSP-'))).toBe(true);
    expect(demoMeasures.every(measure => !String(measure.externalId || '').includes(['S', 'AP'].join('')))).toBe(true);
    expect(demoMeasures.every(measure => !String(measure.externalId || '').includes(['LI', 'DS'].join('')))).toBe(true);
  });

  it('includes synthetic gas transformation examples for the Gas-only review path', () => {
    const gasExamples = demoMeasures.filter(measure => measure.orgUnit === 'Netze Gas');

    expect(gasExamples.length).toBeGreaterThan(0);
    expect(gasExamples.some(measure => measure.gasTransformationPath === 'physicalDismantling')).toBe(true);
    expect(gasExamples.some(measure => measure.gasEternityAssumption === 'removed')).toBe(true);
    expect(gasExamples.some(measure => measure.gasProvisionAssessment === 'checkProvision')).toBe(true);
    expect(gasExamples.some(measure => measure.gasRegulatoryTreatment === 'kaneuIstCostsReview')).toBe(true);
    expect(gasExamples.every(measure => String(measure.gasTransformationEvidence || '').includes('Synthetisch'))).toBe(true);
  });

  it('covers current workbench features with deterministic synthetic demo data', () => {
    expect(demoSidecar.objects.length).toBeGreaterThanOrEqual(3);
    expect(demoSidecar.objects.some(object => object.openQuestions?.length > 0)).toBe(true);
    expect(demoSidecar.objects.some(object => object.type === 'data_quality')).toBe(true);
    expect(demoSidecar.objects.some(object => object.sidecarType === 'effect_assumption')).toBe(true);

    expect(demoMeasures.some(measure => measure.effectType === 'flexibility' && measure.agnesRelevant)).toBe(true);
    expect(demoMeasures.some(measure => measure.active && measure.riskAvoided > 0 && !measure.riskDbRef)).toBe(true);
    expect(demoMeasures.some(measure => measure.active && measure.objectiveIds?.length === 0)).toBe(true);
    expect(demoMeasures.some(measure => measure.active && !String(measure.note || '').trim())).toBe(true);
    expect(Object.keys(demoClarificationStatus).some(key => key.startsWith('risk-evidence:'))).toBe(true);
  });
});
