import { describe, expect, it } from 'vitest';
import {
  calcMeasure,
  calcPortfolio,
  impactAssumptionsFor,
  irr,
  npv,
  params,
  portfolioDecisionMetrics,
  regulatoryParameterSet,
  regulatoryPeriodFor,
  scenarioParams
} from '../src/engine.js';

const baseInputs = {
  sector: 'gas',
  baseYear: 2028,
  baseEog: 10000,
  rab: 50000,
  returnRate: 5,
  financingRate: 5,
  horizon: 3,
  discountRate: 5,
  kanuEndYear: 2030,
  degressiveRate: 10,
  taxFactor: 0,
  portfolioAttribution: 25,
  qDelta: 0,
  eDelta: 0,
  regulationProcedure: 'standard',
  annualEnergyGwh: '',
  householdConsumptionKwh: ''
};

function baseMeasure(overrides = {}) {
  return {
    id: 'm1',
    active: true,
    name: 'Testmassnahme',
    type: 'wahl',
    cost: 1000,
    year: 2028,
    secure: 100,
    uncertain: 0,
    probability: 0,
    opexRecognition: 0,
    life: 10,
    depr: 'normal',
    qDirect: 0,
    eDirect: 0,
    riskAvoided: 0,
    portfolioShare: 100,
    note: '',
    ...overrides
  };
}

describe('financial helpers', () => {
  it('calculates npv against a known cash-flow series', () => {
    expect(npv(0.1, [-100, 60, 60])).toBeCloseTo(4.1322, 4);
  });

  it('calculates irr against a known cash-flow series', () => {
    expect(irr([-100, 60, 60])).toBeCloseTo(0.13066, 4);
  });
});

describe('regulatoryPeriodFor', () => {
  it('documents the public regulatory parameter set and source boundary', () => {
    expect(regulatoryParameterSet.id).toBe('regulatory-parameters-2026-07');
    expect(regulatoryParameterSet.scope).toContain('keine Rechts- oder Regulierungsberatung');
    expect(regulatoryParameterSet.sources).toEqual(expect.arrayContaining([
      expect.stringContaining('ARegV'),
      expect.stringContaining('KANU'),
      expect.stringContaining('NEST/RAMEN')
    ]));
  });

  it('handles gas period boundaries and 5-year future periods', () => {
    expect(regulatoryPeriodFor('gas', 2022)).toMatchObject({ id: 'RP4', start: 2023, end: 2027 });
    expect(regulatoryPeriodFor('gas', 2027)).toMatchObject({ id: 'RP4', start: 2023, end: 2027 });
    expect(regulatoryPeriodFor('gas', 2028)).toMatchObject({ id: 'RP5', start: 2028, end: 2032 });
    expect(regulatoryPeriodFor('gas', 2033)).toMatchObject({ id: 'RP6', start: 2033, end: 2037, known: false });
    expect(regulatoryPeriodFor('gas', 2038)).toMatchObject({ id: 'RP7', start: 2038, end: 2042, known: false });
  });

  it('handles strom period boundaries and 5-year future periods', () => {
    expect(regulatoryPeriodFor('strom', 2023)).toMatchObject({ id: 'RP4', start: 2024, end: 2028 });
    expect(regulatoryPeriodFor('strom', 2028)).toMatchObject({ id: 'RP4', start: 2024, end: 2028 });
    expect(regulatoryPeriodFor('strom', 2029)).toMatchObject({ id: 'RP5', start: 2029, end: 2033 });
    expect(regulatoryPeriodFor('strom', 2034)).toMatchObject({ id: 'RP6', start: 2034, end: 2038, known: false });
  });
});

describe('calcMeasure depreciation scenarios', () => {
  it('calculates normal linear depreciation', () => {
    const result = calcMeasure(baseMeasure(), params(baseInputs));
    expect(result.rows[0].depreciation).toBeCloseTo(100, 4);
    expect(result.rows[0].capitalReturn).toBeCloseTo(47.5, 4);
    expect(result.rows[0].eog).toBeCloseTo(147.5, 4);
    expect(result.totex.nominal).toBeCloseTo(1000, 4);
  });

  it('calculates KANU linear depreciation for gas', () => {
    const result = calcMeasure(baseMeasure({ depr: 'kanuLinear' }), params(baseInputs));
    expect(result.rows[0].depreciation).toBeCloseTo(333.3333, 4);
    expect(result.rows[0].capitalReturn).toBeCloseTo(41.6667, 4);
    expect(result.rows[0].eog).toBeCloseTo(375, 4);
  });

  it('calculates KANU degressive depreciation for gas', () => {
    const p = params({ ...baseInputs, kanuEndYear: 2037, degressiveRate: 12 });
    const result = calcMeasure(baseMeasure({ depr: 'kanuDegressive' }), p);
    expect(result.rows[0].depreciation).toBeCloseTo(120, 4);
    expect(result.rows[0].capitalReturn).toBeCloseTo(47, 4);
    expect(result.rows[0].eog).toBeCloseTo(167, 4);
  });

  it('adds lifecycle cash flows and TOTEX without changing defaults', () => {
    const p = params({ ...baseInputs, horizon: 4 });
    const result = calcMeasure(baseMeasure({
      opexPa: 20,
      opexDeltaPa: 5,
      reinvestCost: 100,
      decommissionCost: 50,
      decommissionYear: 2030,
      life: 2
    }), p);

    expect(result.rows[0].opex).toBeCloseTo(-15, 4);
    expect(result.rows[0].eog).toBeCloseTo(522.5, 4);
    expect(result.rows[2].reinvestDecommission).toBeCloseTo(-150, 4);
    expect(result.totex.nominal).toBeCloseTo(1210, 4);
    expect(result.totex.discounted).toBeGreaterThan(1000);
  });

  it('calculates an indicative HGB result bridge in parallel to the regulatory path', () => {
    const p = params({ ...baseInputs, horizon: 20 });
    const result = calcMeasure(baseMeasure({ life: 10, hgbLife: 20 }), p);

    expect(result.rows[0].hgbDepreciation).toBeCloseTo(50, 4);
    expect(result.rows[0].bridge).toBeCloseTo(50, 4);
    expect(result.rows.reduce((sum, row) => sum + row.bridge, 0)).toBeCloseTo(0, 4);
  });
});

describe('scenario and portfolio parameters', () => {
  it('applies conservative and value scenario overrides', () => {
    const base = params({ ...baseInputs, portfolioAttribution: 25, qDelta: 0.6, eDelta: 0.2 });
    expect(scenarioParams(base, 'konservativ')).toMatchObject({
      attribution: 0.1,
      qDelta: 0.003,
      eDelta: 0.001
    });
    expect(scenarioParams(base, 'wert')).toMatchObject({
      attribution: 0.5,
      qDelta: 0.006,
      eDelta: 0.002
    });
  });

  it('calculates portfolio attribution at 0 and 100 percent boundaries', () => {
    const model = { measures: [baseMeasure()] };
    const noAttribution = calcPortfolio(model, params({ ...baseInputs, qDelta: 1, portfolioAttribution: 0 }));
    const fullAttribution = calcPortfolio(model, params({ ...baseInputs, qDelta: 1, portfolioAttribution: 100 }));
    expect(noAttribution.qePa).toBeCloseTo(0, 4);
    expect(fullAttribution.qePa).toBeCloseTo(100, 4);
    expect(fullAttribution.yearly[0].qAndE).toBeCloseTo(100, 4);
  });

  it('neutralizes q and efficiency effects in simplified regulation procedure without dropping other effects', () => {
    const model = {
      measures: [baseMeasure({
        impactAssumptions: [
          { id: 'q', area: 'qElement', amount: 25, confidence: 'assumption', governance: 'basis', startYear: 2028, attribution: 100 },
          { id: 'e', area: 'efficiency', amount: 15, confidence: 'assumption', governance: 'basis', startYear: 2028, attribution: 100 },
          { id: 'r', area: 'risk', riskProbabilityBefore: 10, riskProbabilityAfter: 5, riskImpact: 200, confidence: 'assumption', governance: 'basis', startYear: 2028, attribution: 100 }
        ]
      })]
    };
    const standard = calcPortfolio(model, params({ ...baseInputs, qDelta: 1, portfolioAttribution: 100 }));
    const simplified = calcPortfolio(model, params({ ...baseInputs, qDelta: 1, portfolioAttribution: 100, regulationProcedure: 'simplified' }));

    expect(standard.yearly[0].qAndE).toBeCloseTo(140, 4);
    expect(simplified.yearly[0].qAndE).toBeCloseTo(0, 4);
    expect(simplified.yearly[0].risk).toBeCloseTo(10, 4);
  });

  it('calculates indicative tariff impact when annual energy is available', () => {
    const model = { measures: [baseMeasure()] };
    const result = calcPortfolio(model, params({ ...baseInputs, annualEnergyGwh: 50, householdConsumptionKwh: 3000 }));

    expect(result.tariffImpact.available).toBe(true);
    expect(result.tariffImpact.ctPerKwh).toBeCloseTo(result.yearly[0].regulatoryEogEffect * 100000 / 50000000, 6);
    expect(result.tariffImpact.householdEurPerYear).toBeCloseTo(result.tariffImpact.ctPerKwh * 30, 6);
  });

  it('separates regulatory EOG effect from indicative cash-flow and one-off effects', () => {
    const p = params({ ...baseInputs, horizon: 4 });
    const model = { measures: [baseMeasure({ secure: 50, uncertain: 0, opexRecognition: 100, opexPa: 20, opexDeltaPa: 5 })] };
    const result = calcPortfolio(model, p);
    const metrics = portfolioDecisionMetrics(result);

    expect(result.yearly[0].regulatoryEogEffect).toBeCloseTo(573.75, 4);
    expect(result.yearly[0].indicativeCashflow).toBeCloseTo(result.yearly[0].eog, 4);
    expect(result.yearly[0].economicOpex).toBeCloseTo(-15, 4);
    expect(metrics.yearOneRegulatoryEog).toBeCloseTo(573.75, 4);
    expect(metrics.recurringRegulatoryEog).toBeCloseTo(result.yearly[1].regulatoryEogEffect, 4);
    expect(metrics.yearOneOneOff).toBeCloseTo(500, 4);
    expect(metrics.cashflowBasis).toContain('indikativ');
  });

  it('exposes conservative decision metrics without review-marked assumptions', () => {
    const measure = baseMeasure({
      cost: 1000,
      qDirect: 0,
      eDirect: 0,
      riskAvoided: 0,
      impactAssumptions: [
        { id: 'review-q', area: 'qElement', title: 'Prüfpflichtiger Q-Wert', amount: 180, confidence: 'review', governance: 'sensitivity', startYear: 2028, attribution: 100 }
      ]
    });
    const base = params({ ...baseInputs, returnRate: 5, financingRate: 5, discountRate: 5, horizon: 10 });
    const basis = calcPortfolio({ measures: [measure] }, scenarioParams(base, 'wert'));
    const conservative = calcPortfolio({ measures: [measure] }, scenarioParams(base, 'konservativ'));
    const metrics = portfolioDecisionMetrics(basis, conservative);

    expect(metrics.basis.irr).toBeGreaterThan(base.financingRate);
    expect(metrics.conservative.impactPa).toBe(0);
    expect(metrics.conservative.irr).toBeLessThan(base.financingRate);
    expect(metrics.conservativeGate).toBe('auflage');
    expect(metrics.governanceDecision).toMatchObject({
      status: 'auflage',
      cls: 'warn',
      title: 'Tragfähig mit Auflage'
    });
    expect(metrics.governanceDecision.text).toContain('prüfpflichtige Wirkannahmen');
    expect(metrics.governanceDecision.recommendation).toContain('Nicht als unbedingte Freigabe lesen');
  });

  it('marks the case robust only when basis and conservative scenarios both carry', () => {
    const measure = baseMeasure({ cost: 1000, qDirect: 0, eDirect: 0, riskAvoided: 0 });
    const base = params({ ...baseInputs, returnRate: 8, financingRate: 5, discountRate: 5, horizon: 10 });
    const basis = calcPortfolio({ measures: [measure] }, base);
    const conservative = calcPortfolio({ measures: [measure] }, scenarioParams(base, 'konservativ'));
    const metrics = portfolioDecisionMetrics(basis, conservative);

    expect(metrics.basis.verdictClass).toBe('good');
    expect(metrics.conservative.verdictClass).toBe('good');
    expect(metrics.governanceDecision).toMatchObject({
      status: 'robust',
      cls: 'good',
      title: 'Robust tragfähig'
    });
  });

  it('marks a negative basis case as not carrying regardless of conservative scenario', () => {
    const measure = baseMeasure({ cost: 1000, qDirect: 0, eDirect: 0, riskAvoided: 0 });
    const base = params({ ...baseInputs, returnRate: 2, financingRate: 5, discountRate: 5, horizon: 10 });
    const basis = calcPortfolio({ measures: [measure] }, base);
    const conservative = calcPortfolio({ measures: [measure] }, scenarioParams(base, 'konservativ'));
    const metrics = portfolioDecisionMetrics(basis, conservative);

    expect(metrics.basis.verdictClass).toBe('bad');
    expect(metrics.governanceDecision).toMatchObject({
      status: 'nicht_tragfaehig',
      cls: 'bad',
      title: 'Nicht tragfähig im Basiscase'
    });
  });

  it('marks missing active measures as not decision-ready', () => {
    const base = params({ ...baseInputs, horizon: 10 });
    const basis = calcPortfolio({ measures: [] }, base);
    const conservative = calcPortfolio({ measures: [] }, scenarioParams(base, 'konservativ'));
    const metrics = portfolioDecisionMetrics(basis, conservative);

    expect(metrics.governanceDecision).toMatchObject({
      status: 'nicht_entscheidungsreif',
      cls: 'neutral',
      title: 'Nicht entscheidungsreif'
    });
  });

  it('keeps tariff impact unavailable without annual energy', () => {
    const model = { measures: [baseMeasure()] };
    const result = calcPortfolio(model, params({ ...baseInputs, annualEnergyGwh: '' }));

    expect(result.tariffImpact.available).toBe(false);
  });

  it('keeps regulatory effect lags at zero by default for import compatibility', () => {
    const p = params(baseInputs);
    expect(p.effectLags).toMatchObject({ capex: 0, opex: 0, qe: 0 });
  });

  it('can shift CAPEX, OPEX recognition and Q/E effects separately without moving the capital commitment', () => {
    const lagged = params({ ...baseInputs, horizon: 4, capexLagYears: 1, opexLagYears: 2, qeLagYears: 1 });
    const result = calcMeasure(baseMeasure({
      secure: 50,
      uncertain: 0,
      opexRecognition: 100,
      qDirect: 10,
      impactAssumptions: [
        { id: 'q', area: 'qElement', amount: 20, confidence: 'assumption', governance: 'basis', startYear: 2028, attribution: 100 }
      ]
    }), lagged);

    expect(result.rows[0].depreciation).toBeGreaterThan(0);
    expect(result.rows[0].capitalReturn).toBeGreaterThan(0);
    expect(result.rows[0].regulatoryCapexEffect).toBeCloseTo(0, 4);
    expect(result.rows[0].firstYearOpex).toBeCloseTo(0, 4);
    expect(result.rows[0].qAndE).toBeCloseTo(0, 4);
    expect(result.rows[1].regulatoryCapexEffect).toBeGreaterThan(0);
    expect(result.rows[1].qAndE).toBeCloseTo(30, 4);
    expect(result.rows[2].firstYearOpex).toBeCloseTo(500, 4);
  });

  it('keeps simplified one-off reinvestment treatment as the default', () => {
    const p = params({ ...baseInputs, horizon: 4 });
    const result = calcMeasure(baseMeasure({ life: 1, reinvestCost: 100 }), p);

    expect(result.measure.reinvestMode).toBeUndefined();
    expect(result.rows[1].reinvestmentTreatment).toBe('oneOff');
    expect(result.rows[1].reinvestDecommission).toBeCloseTo(-100, 4);
    expect(result.rows[1].reinvestAssetEffect).toBeCloseTo(0, 4);
  });

  it('optionally models reinvestment as a new activated asset with its own AfA and return chain', () => {
    const p = params({ ...baseInputs, horizon: 4, returnRate: 5, capexLagYears: 0 });
    const oneOff = calcMeasure(baseMeasure({ life: 1, reinvestCost: 100 }), p);
    const assetAddition = calcMeasure(baseMeasure({
      life: 1,
      reinvestCost: 100,
      reinvestMode: 'assetAddition',
      reinvestLife: 2
    }), p);

    expect(assetAddition.rows[1].reinvestmentTreatment).toBe('assetAddition');
    expect(assetAddition.rows[1].reinvestDecommission).toBeCloseTo(-100, 4);
    expect(assetAddition.rows[1].reinvestDepreciation).toBeCloseTo(50, 4);
    expect(assetAddition.rows[1].reinvestCapitalReturn).toBeCloseTo(3.75, 4);
    expect(assetAddition.rows[1].reinvestAssetEffect).toBeCloseTo(53.75, 4);
    expect(assetAddition.rows[1].regulatoryEogEffect - oneOff.rows[1].regulatoryEogEffect).toBeCloseTo(53.75, 4);
  });
});

describe('documented impact assumptions', () => {
  const documentedImpacts = [
    {
      id: 'q1',
      area: 'qElement',
      title: 'Q-Wirkung aus Störungsreduktion',
      amount: 12,
      confidence: 'assumption',
      governance: 'basis',
      startYear: 2028,
      endYear: '',
      attribution: 50,
      chain: 'Weniger Unterbrechungsminuten',
      evidence: 'Betriebsschätzung'
    },
    {
      id: 'r1',
      area: 'risk',
      title: 'Prüfpflichtiger Risikowert',
      amount: 30,
      legacyFlat: true,
      confidence: 'review',
      governance: 'sensitivity',
      startYear: 2028,
      attribution: 100
    },
    {
      id: 'r2',
      area: 'risk',
      title: 'Risiko aus Eintrittswahrscheinlichkeit mal Schaden',
      riskProbabilityBefore: 12,
      riskProbabilityAfter: 2,
      riskImpact: 200,
      confidence: 'assumption',
      governance: 'basis',
      evidenceType: 'operations',
      startYear: 2028,
      attribution: 100
    }
  ];

  it('normalizes VNB-specific impact assumptions for calculation and documentation', () => {
    const impacts = impactAssumptionsFor(baseMeasure({ impactAssumptions: documentedImpacts }));
    expect(impacts[0]).toMatchObject({
      area: 'qElement',
      confidence: 'assumption',
      governance: 'basis',
      amount: 12,
      attribution: 0.5,
      endYear: null
    });
    expect(impacts[2]).toMatchObject({
      area: 'risk',
      amount: 20,
      evidenceType: 'operations',
      riskProbabilityBefore: 12,
      riskProbabilityAfter: 2,
      riskImpact: 200
    });
  });

  it('includes basis assumptions and keeps review items for value sensitivity', () => {
    const model = { measures: [baseMeasure({ impactAssumptions: documentedImpacts })] };
    const basis = calcPortfolio(model, params(baseInputs));
    const conservative = calcPortfolio(model, scenarioParams(params(baseInputs), 'konservativ'));
    const value = calcPortfolio(model, scenarioParams(params(baseInputs), 'wert'));

    expect(basis.impactPa).toBeCloseTo(26, 4);
    expect(basis.yearly[0].qAndE).toBeCloseTo(6, 4);
    expect(basis.yearly[0].risk).toBeCloseTo(20, 4);
    expect(basis.yearly[0].opexRisk).toBeCloseTo(20, 4);
    expect(basis.riskPa).toBeCloseTo(20, 4);
    expect(conservative.impactPa).toBeCloseTo(0, 4);
    expect(value.impactPa).toBeCloseTo(56, 4);
    expect(value.yearly[0].opexRisk).toBeCloseTo(50, 4);
  });
});
