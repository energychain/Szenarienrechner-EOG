import { describe, expect, test } from 'vitest';
import { calcPortfolio, params } from '../src/engine.js';
import { buildAiPrompt, defaultAiPromptOptions, redactModelForPrompt } from '../src/ai-prompt-generator.js';
import { normalizeSidecar, sidecarSummary } from '../src/sidecar.js';

const baseInputs = {
  sector: 'gas',
  baseYear: 2027,
  baseEog: 24570,
  rab: 60000,
  returnRate: 4.1,
  financingRate: 4,
  horizon: 8,
  discountRate: 4,
  kanuEndYear: 2045,
  degressiveRate: 10,
  taxFactor: 0,
  portfolioAttribution: 0,
  qDelta: 0,
  eDelta: 0,
};

function modelWithSidecar(sidecar) {
  return {
    inputs: baseInputs,
    measures: [{
      id: 'm1',
      name: 'Rückbaupfad prüfen',
      active: true,
      cost: 100,
      year: 2027,
      life: 20,
      secure: 70,
      uncertain: 30,
      probability: 50,
      opexRecognition: 70,
      riskAvoided: 0,
    }],
    sidecar,
  };
}

describe('sidecar bridge logic', () => {
  test('normalizes sidecar type, activation status and bridge logic without default calculation impact', () => {
    const sidecar = normalizeSidecar({
      objects: [{
        id: 'bridge_1',
        sidecarType: 'economic_bridge',
        title: 'Rückbaukosten-Brücke',
        activationStatus: 'candidate',
        calculationImpact: 'scenario_only',
        bridgeLogic: {
          description: 'Rückbaukosten können Cashflow-Sicht beeinflussen.',
          economicRelation: 'avoided_cost',
          direction: 'positive',
          quantificationStatus: 'working_value',
          amount: 25,
          amountUnit: 'TEUR/a',
          timeHorizon: '2027-2030',
          sourceRefs: ['src_rueckbau'],
          assumptions: ['nur Arbeitswert'],
          openQuestions: ['Bilanzierung prüfen'],
        },
      }, {
        id: 'ctx_1',
        title: 'Nur Kontext',
      }],
    });

    expect(sidecar.objects[0]).toMatchObject({
      sidecarType: 'economic_bridge',
      activationStatus: 'candidate',
      calculationImpact: 'scenario_only',
      bridgeLogic: {
        economicRelation: 'avoided_cost',
        quantificationStatus: 'working_value',
        amount: 25,
        amountUnit: 'TEUR/a',
      },
    });
    expect(sidecar.objects[1]).toMatchObject({
      sidecarType: 'context',
      activationStatus: 'not_activated',
      calculationImpact: 'none',
    });
  });

  test('summarizes open bridge logic and activated sidecars separately from plain context', () => {
    const summary = sidecarSummary({
      objects: [{
        id: 'ctx', title: 'Kontext', sidecarType: 'context', calculationImpact: 'none', activationStatus: 'not_activated',
      }, {
        id: 'open', title: 'Wirkbeziehung offen', sidecarType: 'effect_assumption', calculationImpact: 'indirect', activationStatus: 'candidate', bridgeLogic: { economicRelation: 'risk_effect', quantificationStatus: 'open' },
      }, {
        id: 'quantified', title: 'Quantifiziert nicht aktiv', sidecarType: 'economic_bridge', calculationImpact: 'scenario_only', activationStatus: 'candidate', bridgeLogic: { economicRelation: 'opex_effect', quantificationStatus: 'working_value', amount: 5, amountUnit: 'TEUR/a' },
      }, {
        id: 'active', title: 'Aktiv markiert', sidecarType: 'economic_bridge', calculationImpact: 'active', activationStatus: 'activated', bridgeLogic: { economicRelation: 'timing_effect', quantificationStatus: 'validated', amount: 3, amountUnit: 'TEUR/a' },
      }],
    });

    expect(summary.bySidecarType).toMatchObject({ context: 1, effect_assumption: 1, economic_bridge: 2 });
    expect(summary.withoutCalculationImpact).toBe(1);
    expect(summary.openBridgeLogic).toBe(1);
    expect(summary.quantifiedNotActivated).toBe(1);
    expect(summary.activated).toBe(1);
  });

  test('even activated bridge sidecars do not change portfolio KPIs without explicit mapping logic', () => {
    const model = modelWithSidecar({
      objects: [{
        id: 'active_bridge',
        title: 'Aktive Brücke',
        sidecarType: 'economic_bridge',
        calculationImpact: 'active',
        activationStatus: 'activated',
        bridgeLogic: { economicRelation: 'revenue_effect', quantificationStatus: 'validated', amount: 9999, amountUnit: 'TEUR/a' },
      }],
    });
    const p = params(baseInputs);
    const baseline = calcPortfolio({ ...model, sidecar: null }, p);
    const withSidecar = calcPortfolio(model, p);

    expect(withSidecar.invest).toBeCloseTo(baseline.invest, 6);
    expect(withSidecar.npv).toBeCloseTo(baseline.npv, 6);
    expect(withSidecar.yearly[0].regulatoryEogEffect).toBeCloseTo(baseline.yearly[0].regulatoryEogEffect, 6);
  });

  test('prompt exposes bridge logic as prüfpflichtig and not as automatic KPI mapping', () => {
    const sidecar = {
      objects: [{
        id: 'bridge_prompt',
        title: 'Wärmewende-Rückbauwirkung',
        sidecarType: 'economic_bridge',
        division: 'gas',
        calculationImpact: 'scenario_only',
        activationStatus: 'candidate',
        bridgeLogic: {
          economicRelation: 'avoided_cost',
          quantificationStatus: 'working_value',
          amount: 12,
          amountUnit: 'TEUR/a',
          openQuestions: ['Rückstellungsfähigkeit prüfen'],
        },
      }],
    };
    const promptOptions = { ...defaultAiPromptOptions, omitNotes: true };
    const snapshot = redactModelForPrompt(modelWithSidecar(sidecar), promptOptions);

    expect(snapshot.sidecar.summary.openBridgeLogic).toBe(0);
    expect(snapshot.sidecar.summary.quantifiedNotActivated).toBe(1);
    expect(snapshot.sidecar.objects[0].bridgeLogic).toMatchObject({ economicRelation: 'avoided_cost', quantificationStatus: 'working_value' });

    const prompt = buildAiPrompt(modelWithSidecar(sidecar), promptOptions);
    expect(prompt).toContain('Brückenlogik');
    expect(prompt).toContain('Wärmewende-Rückbauwirkung');
    expect(prompt).toContain('keine automatische KPI-Wirkung');
  });
});
