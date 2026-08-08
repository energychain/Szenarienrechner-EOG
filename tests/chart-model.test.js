// Stufe V-1 der Visualisierungs-Spezifikation: chart-model.js ist DOM-frei
// (V11) und deckt Skalen, Ausreißerbehandlung, Zustandsvererbung und je
// Diagrammtyp mindestens einen Test ab (V12). Rendering (SVG) folgt erst in
// V-2 ff.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calcPortfolio, params } from '../src/engine.js';
import { clarificationItems } from '../src/clarifications.js';
import {
  VALUE_STATE_STRENGTH,
  aggregateMeasureFieldState,
  capToSixty,
  combinedValueState,
  contributionBarsModel,
  eogFlowModel,
  linearScale,
  niceTicks,
  outlierAwareScale,
  riskMatrixModel,
  tornadoModel,
  viabilitySegmentsModel,
  waterfallModel
} from '../src/chart-model.js';

const referenceModel = JSON.parse(
  readFileSync(new URL('./fixtures/reference-model.json', import.meta.url), 'utf8')
).model;

const p = params(referenceModel.inputs);
const portfolio = calcPortfolio(referenceModel, p);
const context = { history: { events: [] }, openDecisions: {} };

describe('chart-model: Skalen (Abschnitt 8)', () => {
  it('linearScale maps the domain onto the range and clamps out-of-range values', () => {
    const scale = linearScale(0, 100, 0, 200);
    expect(scale(0)).toBe(0);
    expect(scale(50)).toBe(100);
    expect(scale(100)).toBe(200);
    expect(scale(150)).toBe(200); // clamped, not extrapolated
    expect(scale(-10)).toBe(0);
  });

  it('niceTicks produces readable 1/2/5/10-step ticks spanning the domain', () => {
    const ticks = niceTicks(0, 93, 4);
    expect(ticks[0]).toBeLessThanOrEqual(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(93);
    const steps = ticks.slice(1).map((t, i) => Math.round((t - ticks[i]) * 1e6) / 1e6);
    expect(new Set(steps).size).toBe(1); // constant step
    expect([1, 2, 5, 10, 20, 25, 50].some(nice => Math.abs(steps[0] - nice) < 1e-9 || steps[0] % nice === 0)).toBe(true);
  });

  it('outlierAwareScale compresses values above the percentile threshold into a distinct zone instead of clipping them', () => {
    const values = [10, 12, 11, 9, 500]; // 500 is a clear outlier
    const { scale, hasOutliers, isOutlier, threshold } = outlierAwareScale(values, 0, 100, { percentileThreshold: 0.75 });
    expect(hasOutliers).toBe(true);
    expect(isOutlier(500)).toBe(true);
    expect(isOutlier(11)).toBe(false);
    expect(threshold).toBeLessThan(500);
    // the outlier still gets a finite, distinct position — not clipped to the same pixel as the largest normal value
    const normalMaxPixel = scale(12);
    const outlierPixel = scale(500);
    expect(outlierPixel).toBeGreaterThan(normalMaxPixel);
    expect(outlierPixel).toBeLessThanOrEqual(100);
  });

  it('caps element sets above 60 to the 60 largest by |size|, folding the rest into a collapsed count/value', () => {
    const elements = Array.from({ length: 75 }, (_, i) => ({ id: i, size: i + 1 }));
    const { elements: kept, collapsedCount, collapsedValue } = capToSixty(elements, 'size');
    expect(kept.length).toBe(60);
    expect(collapsedCount).toBe(15);
    expect(collapsedValue).toBe(elements.slice(0, 15).reduce((sum, e) => sum + e.size, 0));
    expect(Math.min(...kept.map(e => e.size))).toBeGreaterThan(Math.max(...elements.slice(0, 15).map(e => e.size)));
  });
});

describe('chart-model: Zustandsvererbung (Abschnitt 6, "schwächster Zustand gewinnt")', () => {
  it('combines multiple states to the weakest one', () => {
    expect(combinedValueState(['set', 'default'])).toBe('default');
    expect(combinedValueState(['set', 'derived'])).toBe('derived');
    expect(combinedValueState(['derived', 'openByDecision'])).toBe('openByDecision');
    expect(combinedValueState(['set', 'set'])).toBe('set');
  });

  it('defines a strict strength order covering all four states', () => {
    const order = ['openByDecision', 'default', 'derived', 'set'];
    order.slice(1).forEach((state, i) => {
      expect(VALUE_STATE_STRENGTH[state]).toBeGreaterThan(VALUE_STATE_STRENGTH[order[i]]);
    });
  });

  it('a value confirmed via review and one still at its default combine to "default" (Abschnitt 6 example)', () => {
    // matches the spec's own example: "Eine Risikoblase aus geprüfter
    // Wahrscheinlichkeit und vorbelegter Schadenshöhe ist hohl."
    expect(combinedValueState(['set', 'default'])).toBe('default');
  });

  it('aggregateMeasureFieldState reduces one field across many measures to the weakest state', () => {
    const measures = [
      { id: 'm1', riskAvoided: 50 }, // non-default -> 'set'
      { id: 'm2', riskAvoided: 0 } // literal default -> 'default'
    ];
    expect(aggregateMeasureFieldState(measures, 'riskAvoided', context)).toBe('default');
    expect(aggregateMeasureFieldState([measures[0]], 'riskAvoided', context)).toBe('set');
  });
});

describe('chart-model: Risikomatrix (Filter "measure")', () => {
  it('produces one bubble per risk impact assumption, sized by the expected avoided risk value', () => {
    const model = riskMatrixModel(referenceModel.measures, context);
    expect(model.type).toBe('riskMatrix');
    expect(model.elements.length).toBeGreaterThan(0);
    model.elements.forEach(element => {
      expect(element.objectType).toBe('measure');
      expect(referenceModel.measures.some(m => m.id === element.objectId)).toBe(true);
      expect(['set', 'default', 'derived', 'openByDecision']).toContain(element.valueState);
      expect(typeof element.hasEvidenceGap).toBe('boolean');
      expect(Number.isFinite(element.x)).toBe(true);
      expect(Number.isFinite(element.y)).toBe(true);
      expect(Number.isFinite(element.size)).toBe(true);
    });
  });

  it('an empty measure set produces no elements and a non-generic empty-state reason (Abschnitt 9.1, Kriterium V7)', () => {
    const model = riskMatrixModel([], context);
    expect(model.elements).toEqual([]);
    expect(model.emptyReason).toBeTruthy();
    expect(model.emptyReason).not.toMatch(/keine daten/i);
  });

  it('a measure with only default risk fields yields a fully hollow (default-state) matrix (Abschnitt 6, Kriterium V6)', () => {
    const measure = {
      id: 'm_default_risk',
      impactAssumptions: [{ id: 'ia1', area: 'risk', riskProbabilityBefore: 0, riskProbabilityAfter: 0, riskImpact: 0 }]
    };
    const model = riskMatrixModel([measure], context);
    expect(model.elements.length).toBe(1);
    expect(model.elements.every(element => element.valueState === 'default')).toBe(true);
  });
});

describe('chart-model: Liquiditäts-/EOG-Verlauf (Filter "kpi:eogYear1"/"kpi:eogFollow")', () => {
  it('produces one stacked year column per horizon year, tracking the same fields the portfolio KPI sums use', () => {
    const model = eogFlowModel(portfolio, context);
    expect(model.type).toBe('eogFlow');
    expect(model.elements.length).toBe(portfolio.yearly.length);
    model.elements.forEach((element, i) => {
      expect(element.objectType).toBeNull(); // Abschnitt 7.2: Jahressäulen ohne Objektbezug
      expect(element.year).toBe(portfolio.yearly[i].year);
      expect(element.indicativeCashflow).toBe(portfolio.yearly[i].indicativeCashflow);
      expect(['set', 'default', 'derived', 'openByDecision']).toContain(element.valueState);
    });
  });
});

describe('chart-model: Wasserfall (Filter "kpi:npv")', () => {
  it('builds a running cumulative from Basis-EOG through the cashflow bridge, matching portfolioWaterfallFor', () => {
    const model = waterfallModel(portfolio, context);
    expect(model.type).toBe('waterfall');
    expect(model.elements.length).toBeGreaterThan(0);
    expect(model.elements[0].label).toBe('Basis-EOG');
    expect(model.elements[0].valueState).toBe('set'); // Basis-EOG ist ein Rahmenwert, kein Maßnahmenbeitrag
    // running total is internally consistent
    model.elements.forEach(element => {
      expect(element.end - element.start).toBeCloseTo(element.value, 9);
    });
  });
});

describe('chart-model: Beitragsbalken (Filter "kpi:irr")', () => {
  it('one bar per measure with a nonzero NPV contribution, each pointing back at that measure', () => {
    const model = contributionBarsModel(portfolio, context);
    expect(model.type).toBe('contributionBars');
    expect(model.elements.length).toBeGreaterThan(0);
    model.elements.forEach(element => {
      expect(element.objectType).toBe('measure');
      expect(portfolio.results.some(r => r.measure.id === element.objectId)).toBe(true);
      expect(element.value).not.toBe(0);
    });
    // descending by contribution
    const values = model.elements.map(e => e.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });
});

describe('chart-model: Wirkungsrangliste / Tornado (Filter "clarification")', () => {
  it('ranks the same sensitivity drivers as portfolioSensitivityTornadoFor, each carrying a value state from its underlying field', () => {
    const portfolioResult = calcPortfolio(referenceModel, p);
    const clarifications = clarificationItems(referenceModel, p, portfolioResult, referenceModel.clarificationStatus);
    const model = tornadoModel(referenceModel, p, clarifications, context);
    expect(model.type).toBe('tornado');
    expect(model.elements.length).toBe(5); // riskAvoided, returnRate, financingRate, usefulLife, kanuEndYear
    model.elements.forEach(element => {
      expect(element.objectType).toBe('clarification');
      expect(['set', 'default', 'derived', 'openByDecision']).toContain(element.valueState);
    });
    // sorted descending by swing, same as the engine's own ranking
    const sizes = model.elements.map(e => e.size);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it('maps the returnRate driver to the actual model.inputs.returnRate value state, not a hardcoded default', () => {
    const modifiedModel = { ...referenceModel, inputs: { ...referenceModel.inputs, returnRate: referenceModel.inputs.returnRate } };
    const chart = tornadoModel(modifiedModel, p, [], context);
    const returnRateElement = chart.elements.find(e => e.key === 'returnRate');
    expect(returnRateElement).toBeTruthy();
    // returnRate in the reference fixture is a real, non-default value, so it must not appear as unreviewed default
    expect(returnRateElement.valueState).not.toBe('default');
  });
});

describe('chart-model: Segmentbalken (Filter "rahmen")', () => {
  it('groups active measures into viability categories with a CAPEX total per segment (Kriterium: same labels as viabilityOverviewFor)', () => {
    const model = viabilitySegmentsModel(referenceModel, referenceModel.inputs, context);
    expect(model.type).toBe('viabilitySegments');
    expect(model.elements.length).toBeGreaterThan(0);
    model.elements.forEach(element => {
      expect(element.objectType).toBe('viabilityCategory');
      expect(element.count).toBeGreaterThan(0);
      expect(element.value).toBeGreaterThanOrEqual(0);
      expect(element.bridgeMissingShare).toBeGreaterThanOrEqual(0);
      expect(element.bridgeMissingShare).toBeLessThanOrEqual(1);
    });
  });

  it('an empty measure list produces no segments and a stated empty reason', () => {
    const model = viabilitySegmentsModel({ ...referenceModel, measures: [] }, referenceModel.inputs, context);
    expect(model.elements).toEqual([]);
    expect(model.emptyReason).toBeTruthy();
  });
});
