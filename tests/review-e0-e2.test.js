import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  calcPortfolio,
  cashflowSignChanges,
  mirr,
  params,
  portfolioDecisionMetrics
} from '../src/engine.js';

const uiSource = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const baseInputs = {
  sector: 'strom',
  baseYear: 2027,
  baseEog: 20000,
  rab: 85000,
  returnRate: 5,
  financingRate: 5,
  horizon: 4,
  discountRate: 5,
  kanuEndYear: 2045,
  degressiveRate: 8,
  taxFactor: 0,
  portfolioAttribution: 100,
  qDelta: 1,
  eDelta: 0,
  regulationProcedure: 'standard',
  annualEnergyGwh: 52,
  householdConsumptionKwh: 2900
};

function measure(overrides = {}) {
  return {
    id: 'm1',
    active: true,
    name: 'Testmaßnahme',
    type: 'wahl',
    cost: 1000,
    year: 2027,
    secure: 100,
    uncertain: 0,
    probability: 0,
    opexRecognition: 0,
    life: 2,
    hgbLife: 2,
    depr: 'normal',
    qDirect: 0,
    eDirect: 0,
    riskAvoided: 0,
    portfolioShare: 0,
    opexPa: 0,
    opexDeltaPa: 0,
    reinvestCost: 0,
    decommissionCost: 0,
    impactAssumptions: [],
    note: '',
    ...overrides
  };
}

describe('review E-0 build provenance', () => {
  it('declares build commit and build time meta fields in the HTML shell', () => {
    expect(indexHtml).toContain('name="build-commit"');
    expect(indexHtml).toContain('name="build-time"');
  });

  it('includes build metadata in JSON and self-contained HTML exports', () => {
    expect(uiSource).toContain('buildInfo');
    expect(uiSource).toContain('buildCommit');
    expect(uiSource).toContain('buildTime');
    expect(uiSource).toContain('meta[name="build-commit"]');
    expect(uiSource).toContain('meta[name="build-time"]');
  });
});

describe('review E-1 MIRR fallback', () => {
  it('counts material sign changes in cashflow vectors', () => {
    expect(cashflowSignChanges([-1000, 700, 700])).toBe(1);
    expect(cashflowSignChanges([-1000, 1800, -950, 500])).toBe(3);
    expect(cashflowSignChanges([-1000, 0, 0])).toBe(0);
  });

  it('calculates MIRR for non-normal cashflows with multiple sign changes', () => {
    const value = mirr([-1000, 1800, -950, 500], 0.05, 0.05);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(0.2);
  });

  it('uses MIRR instead of ambiguous IRR when portfolio cashflows have multiple sign changes', () => {
    const p = params({ ...baseInputs, horizon: 4, returnRate: 2, financingRate: 5, discountRate: 5 });
    const result = calcPortfolio({ measures: [measure({
      cost: 1000,
      life: 1,
      qDirect: 1400,
      decommissionCost: 2200,
      decommissionYear: 2028,
      reinvestCost: 0
    })] }, p);

    expect(result.returnMetric.kind).toBe('mirr');
    expect(result.rateMetricLabel).toBe('MIRR');
    expect(result.returnMetric.signChanges).toBeGreaterThan(1);
    expect(Number.isFinite(result.irr)).toBe(true);
    expect(portfolioDecisionMetrics(result).rateMetricLabel).toBe('MIRR');
  });
});

describe('review E-2 double counting guard', () => {
  it('emits exactly one clarification warning when portfolio Q/E effect and direct Q/E assumptions overlap', () => {
    const p = params({ ...baseInputs, qDelta: 1, eDelta: 0.5, portfolioAttribution: 50 });
    const result = calcPortfolio({ measures: [measure({
      portfolioShare: 35,
      qDirect: 12,
      impactAssumptions: [
        { id: 'impact-q', area: 'qElement', title: 'Direkte Q-Wirkung', amount: 8, confidence: 'assumption', governance: 'basis', startYear: 2027, attribution: 100 }
      ]
    })] }, p);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({
      type: 'possible_double_counting',
      area: 'Q/Effizienz',
      measureId: 'm1'
    });
    expect(result.warnings[0].title).toContain('Doppelzählung');
  });

  it('does not warn when portfolio attribution is absent or the direct effect is risk-only', () => {
    const p = params({ ...baseInputs, qDelta: 1, eDelta: 0.5, portfolioAttribution: 50 });
    const noPortfolio = calcPortfolio({ measures: [measure({ qDirect: 12, portfolioShare: 0 })] }, p);
    const riskOnly = calcPortfolio({ measures: [measure({
      portfolioShare: 35,
      impactAssumptions: [
        { id: 'risk', area: 'risk', confidence: 'assumption', governance: 'basis', startYear: 2027, riskProbabilityBefore: 5, riskProbabilityAfter: 3, riskImpact: 100 }
      ]
    })] }, p);

    expect(noPortfolio.warnings).toEqual([]);
    expect(riskOnly.warnings).toEqual([]);
  });

  it('surfaces engine double-counting warnings as UI clarification items', () => {
    expect(uiSource).toContain('result.warnings');
    expect(uiSource).toContain('possible_double_counting');
    expect(uiSource).toContain('mögliche Doppelzählung');
  });
});
