import { describe, expect, it } from 'vitest';
import {
  measureBridgeClarificationItems,
  measureBridgeSummary,
  normalizeMeasureBridge,
} from '../src/measure-bridge.js';
import { calcPortfolio, params } from '../src/engine.js';
import { buildAiPrompt, defaultAiPromptOptions, redactModelForPrompt } from '../src/ai-prompt-generator.js';
import { spreadsheetTables } from '../src/spreadsheet-export.js';

const baseInputs = {
  sector: 'strom',
  baseYear: '2027',
  baseEog: '12000',
  rab: '30000',
  returnRate: '5',
  financingRate: '5',
  discountRate: '5',
  horizon: '20',
  kanuEndYear: '2045',
  degressiveRate: '8',
  portfolioAttribution: '100',
  capexLagYears: '0',
  opexLagYears: '3',
  qeLagYears: '2',
  qDelta: '0',
  eDelta: '0',
};

const baseMeasure = {
  id: 'm-bridge-1',
  name: 'Demo Maßnahme Brücke',
  active: true,
  type: 'noRegret',
  year: 2027,
  cost: 100,
  secure: 80,
  uncertain: 10,
  probability: 50,
  life: 30,
  riskAvoided: 0,
};

function modelWith(measure) {
  return {
    appVersion: '0.4.0-test',
    inputs: baseInputs,
    measures: [measure],
    projectPlan: { milestones: [] },
  };
}

describe('measure bridge layer', () => {
  it('normalizes missing bridge fields to KPI-neutral defaults', () => {
    expect(normalizeMeasureBridge()).toEqual(expect.objectContaining({
      calculationImpact: 'none',
      numberType: 'not_assessed',
      budgetProcessStatus: 'not_assessed',
      capexOpexTreatment: 'unclear',
      activationStatus: 'not_applicable',
      regulatoryEffect: 'requires_regulatory_review',
      bridgeStatus: 'not_assessed',
      openBridgeQuestions: [],
    }));
  });

  it('does not change portfolio KPIs when bridge fields describe urgency or budget blockers', () => {
    const p = params(baseInputs);
    const baseline = calcPortfolio({ measures: [baseMeasure] }, p);
    const withBridge = calcPortfolio({
      measures: [{
        ...baseMeasure,
        measureBridge: {
          numberType: 'approved_budget',
          budgetProcessStatus: 'posting_blocked',
          operationalCriticality: 'safety',
          regulatoryEffect: 'direct_revenue_base_effect_expected',
          effectYear: '',
          returnTiming: 'unknown',
          bridgeStatus: 'regulatory_return_missing',
          calculationImpact: 'none',
          openBridgeQuestions: ['Return Timing mit Regulierungsmanagement klären'],
        },
      }],
    }, p);

    expect(withBridge.invest).toBe(baseline.invest);
    expect(withBridge.npv).toBe(baseline.npv);
    expect(withBridge.irr).toBe(baseline.irr);
    expect(withBridge.riskPa).toBe(baseline.riskPa);
    expect(withBridge.yearly[0].regulatoryEogEffect).toBe(baseline.yearly[0].regulatoryEogEffect);
  });

  it('creates deterministic clarification items for incomplete budget, accounting, posting and return bridges', () => {
    const measure = {
      ...baseMeasure,
      measureBridge: {
        budgetProcessStatus: 'posting_blocked',
        capexOpexTreatment: 'unclear',
        activationStatus: 'requires_accounting_review',
        regulatoryEffect: 'direct_revenue_base_effect_expected',
        returnTiming: 'unknown',
        bridgeStatus: 'owner_missing',
        openBridgeQuestions: ['Budgetpfad und Buchungslogik klären'],
      },
    };

    const items = measureBridgeClarificationItems(measure);
    expect(items.map(item => item.title)).toEqual(expect.arrayContaining([
      'Budgetpfad klären',
      'Buchungs-/Rückspielweg klären',
      'CAPEX/OPEX- und Aktivierungsbehandlung klären',
      'regulatorische/wirtschaftliche Wirkung und Timing klären',
      'Validierungsverantwortung benennen',
      'offene Brückenfragen bearbeiten',
    ]));
    expect(new Set(items.map(item => item.column))).toEqual(new Set(['evidence', 'documentation']));
  });

  it('exports bridge context to prompt and spreadsheet without implying calculation impact', () => {
    const measure = {
      ...baseMeasure,
      measureBridge: {
        numberType: 'forecast',
        budgetProcessStatus: 'budget_release_required',
        budgetYear: 2028,
        budgetBucket: 'Erneuerung',
        capexOpexTreatment: 'mixed',
        activationStatus: 'requires_accounting_review',
        regulatoryEffect: 'requires_regulatory_review',
        returnTiming: 'unknown',
        operationalCriticality: 'asset_health',
        deferrability: 'path_dependent',
        bridgeStatus: 'accounting_bridge_missing',
        ownerRole: 'controlling',
        openBridgeQuestions: ['CAPEX/OPEX-Abgrenzung prüfen'],
      },
    };
    const model = modelWith(measure);

    const redacted = redactModelForPrompt(model, {
      ...defaultAiPromptOptions,
      roleId: 'controlling',
      dataScope: 'standard',
      omitNotes: true,
    });
    const prompt = buildAiPrompt(model, {
      ...defaultAiPromptOptions,
      roleId: 'controlling',
      dataScope: 'standard',
      omitNotes: true,
    });
    const tables = spreadsheetTables(model);
    const bridgeTable = tables.find(table => table.name === 'Massnahmen_Bruecke');

    expect(redacted.measureBridge.open).toBe(1);
    expect(redacted.measures[0].measureBridge.calculationImpact).toBe('none');
    expect(prompt).toContain('Budget-, Accounting- und Ausführungsreife');
    expect(prompt).toContain('CAPEX/OPEX-Abgrenzung prüfen');
    expect(bridgeTable?.rows[0]).toContain('calculationImpact');
    expect(bridgeTable?.rows.flat()).toContain('none');
    expect(bridgeTable?.rows.flat()).toContain('CAPEX/OPEX-Abgrenzung prüfen');
  });

  it('summarizes complete and open bridge records separately', () => {
    const summary = measureBridgeSummary([
      { ...baseMeasure, measureBridge: { bridgeStatus: 'complete' } },
      { ...baseMeasure, id: 'm2', measureBridge: { bridgeStatus: 'budget_bridge_missing' } },
      { ...baseMeasure, id: 'm3' },
    ]);

    expect(summary.total).toBe(2);
    expect(summary.complete).toBe(1);
    expect(summary.open).toBe(1);
    expect(summary.missingByStatus.budget_bridge_missing).toBe(1);
  });
});
