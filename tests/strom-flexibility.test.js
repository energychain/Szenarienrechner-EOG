import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildAiPrompt, defaultAiPromptOptions, redactModelForPrompt } from '../src/ai-prompt-generator.js';
import {
  calcPortfolio,
  flexibilityHelper,
  params
} from '../src/engine.js';

const baseInputs = {
  sector: 'strom',
  baseYear: 2027,
  baseEog: 48000,
  rab: 77000,
  returnRate: 4.1,
  financingRate: 4,
  horizon: 8,
  discountRate: 4,
  kanuEndYear: 2045,
  degressiveRate: 10,
  taxFactor: 0,
  portfolioAttribution: 25,
  qDelta: 0,
  eDelta: 0,
  regulationProcedure: 'standard',
  annualEnergyGwh: 465,
  householdConsumptionKwh: 2900,
  capexLagYears: 0,
  opexLagYears: 3,
  qeLagYears: 2
};

function flexMeasure(overrides = {}) {
  return {
    id: 'flex-1',
    active: true,
    name: 'Flexibilitaet Netzfahrplan Demo',
    type: 'wahl',
    effectType: 'flexibility',
    flexibilityUseCase: 'netzfahrplan',
    flexibilityStatus: 'active',
    regulatoryTreatment: 'mixed',
    networkScheduleRequired: true,
    networkScheduleStatus: 'validated',
    networkConstraintRef: 'Engpass Demo MS-01',
    affectedNetworkLevel: 'MS',
    activationWindow: 'Winterabendspitze',
    dispatchLogic: 'fahrplanbasierter Abruf',
    avoidedCapexTeur: 500,
    avoidedCapexConfidence: 'medium',
    deferredCapexTeur: 300,
    deferredCapexFromYear: 2027,
    deferredCapexToYear: 2031,
    capexAvoidanceEvidenceRef: 'Netzfahrplan Demo',
    flexOpexPaTeur: 45,
    flexOpexStartYear: 2027,
    flexOpexDurationYears: 4,
    opexRecognitionStatus: 'pruefpflichtig',
    opexEvidenceRef: 'Flex-Abrufkosten Demo',
    agnesRelevant: true,
    agnesRole: 'Netzfahrplan',
    agnesIntegrationStatus: 'required',
    agnesDataNeeded: ['Netzfahrplan', 'Abruflogik', 'Nachweisführung'],
    cost: 0,
    year: 2027,
    secure: 0,
    uncertain: 0,
    probability: 0,
    opexRecognition: 0,
    life: 1,
    hgbLife: 1,
    depr: 'normal',
    qDirect: 0,
    eDirect: 0,
    riskAvoided: 0,
    portfolioShare: 0,
    impactAssumptions: [],
    note: '',
    ...overrides
  };
}

describe('Strom flexibility / Netzfahrplan / AGNeS', () => {
  it('structures flexibility as a Strom-only helper without treating it as normal CAPEX', () => {
    const helper = flexibilityHelper(flexMeasure(), params(baseInputs));
    expect(helper.applicable).toBe(true);
    expect(helper.effectType).toBe('flexibility');
    expect(helper.summary).toContain('Flexibilität / Netzfahrplan');
    expect(helper.summary).toContain('AGNeS');
    expect(helper.netPresentValueTeur).toBeGreaterThan(0);
    expect(helper.governance).toContain('keine klassische CAPEX-Maßnahme');

    const gasHelper = flexibilityHelper(flexMeasure(), params({ ...baseInputs, sector: 'gas' }));
    expect(gasHelper.applicable).toBe(false);
    expect(gasHelper.summary).toContain('nur für Strom');
  });

  it('does not make flexibility result-effective without a validated network schedule', () => {
    const p = params(baseInputs);
    const missingSchedule = calcPortfolio({ measures: [flexMeasure({ networkScheduleStatus: 'missing' })] }, p);
    expect(missingSchedule.warnings.some(warning => warning.type === 'strom_flexibility_review')).toBe(true);
    expect(missingSchedule.yearly.every(row => row.indicativeCashflow === 0)).toBe(true);

    const active = calcPortfolio({ measures: [flexMeasure()] }, p);
    expect(active.flexibilitySummary.activeCount).toBe(1);
    expect(active.flexibilitySummary.avoidedCapexTeur).toBe(500);
    expect(active.flexibilitySummary.flexOpexPaTeur).toBe(45);
    expect(active.yearly.some(row => row.flexibilityNetEffect !== 0)).toBe(true);
  });

  it('keeps regular Strom CAPEX measures unchanged when no flexibility effect type is set', () => {
    const regular = {
      ...flexMeasure({ effectType: '', cost: 100, secure: 100, life: 20, flexibilityStatus: 'active' })
    };
    const result = calcPortfolio({ measures: [regular] }, params(baseInputs));
    expect(result.flexibilitySummary.totalCount).toBe(0);
    expect(result.warnings.some(warning => String(warning.type).startsWith('strom_flexibility'))).toBe(false);
    expect(result.invest).toBe(100);
  });

  it('adds flexibility context to AI prompts without mixing it with classic CAPEX', () => {
    const model = { inputs: baseInputs, measures: [flexMeasure()], scenario: 'basis', process: { phase: 'massnahmenbewertung' } };
    const redacted = redactModelForPrompt(model, { ...defaultAiPromptOptions, dataScope: 'standard' });
    expect(redacted.flexibility).toMatchObject({ activeCount: 1, avoidedCapexTeur: 500, flexOpexPaTeur: 45 });
    const prompt = buildAiPrompt(model, { ...defaultAiPromptOptions, roleId: 'challenge', dataScope: 'standard' });
    expect(prompt).toContain('Flexibilitätsobjekte sind nicht als klassische CAPEX-Maßnahmen zu interpretieren');
    expect(prompt).toContain('Netzfahrplan');
    expect(prompt).toContain('AGNeS');
  });

  it('documents UI fields for Strom flexibility while keeping gas-specific paths separate', () => {
    const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const uiJs = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
    expect(indexHtml).toContain('Flexibilität / Netzfahrplan');
    expect(indexHtml).toContain('mEffectType');
    expect(indexHtml).toContain('mNetworkScheduleStatus');
    expect(indexHtml).toContain('mAgnesIntegrationStatus');
    expect(indexHtml).toContain('strom-only');
    expect(uiJs).toContain('renderFlexibilityLayer(measure)');
    expect(uiJs).toContain('flexibilityHelper');
  });
});
