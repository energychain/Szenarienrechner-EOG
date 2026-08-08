// Diagrammmodell für die "digitale Akte" (Visualisierungs-Spezifikation
// Abschnitt 8). DOM-frei, headless testbar: nimmt Modell, Parameter und
// Portfolio-Ergebnis entgegen und liefert je Diagramm eine Datenstruktur
// (Achsen, Skalen, Ticks, Elemente mit x/y/size/objectType/objectId/
// valueState/label) — keine SVG-Strings, keine Farben, keine Pixelmaße
// jenseits der Zielgröße. Rendering (SVG-Markup) lebt ausschließlich in der
// UI-Schicht (main-akte.js), nicht hier.
import { riskExpectedValue, impactAssumptionsFor, portfolioWaterfallFor, portfolioSensitivityTornadoFor, calcMeasure, portfolioEffectFor } from './engine.js';
import { viabilityOverviewFor, VIABILITY_CATEGORIES } from './viability-classification.js';
import { valueState, evidenceGapFor } from './value-state.js';

// ---------------------------------------------------------------------------
// Skalen (Abschnitt 8, 9.2)
// ---------------------------------------------------------------------------

export function linearScale(domainMin, domainMax, rangeMin, rangeMax) {
  const domainSpan = domainMax - domainMin;
  return value => {
    if (!Number.isFinite(value)) return rangeMin;
    if (!domainSpan) return rangeMin;
    const clamped = Math.min(domainMax, Math.max(domainMin, value));
    return rangeMin + (clamped - domainMin) / domainSpan * (rangeMax - rangeMin);
  };
}

function niceStep(roughStep) {
  if (!Number.isFinite(roughStep) || roughStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const fraction = roughStep / magnitude;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * magnitude;
}

// "Lesbare" Achsenticks (1/2/5/10er-Schritte), inklusive Start- und Endwert.
export function niceTicks(min, max, targetCount = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [Number.isFinite(min) ? min : 0];
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const step = niceStep((hi - lo) / Math.max(1, targetCount));
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let value = start; value <= end + step * 0.001; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6);
  }
  return ticks;
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const idx = (sortedValues.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
}

// Ausreißerbehandlung (Abschnitt 9.2): Werte werden nicht abgeschnitten,
// sondern jenseits eines Schwellwerts (Perzentil) in eine gestauchte
// Achsenzone am Ende des Zielbereichs geführt. isOutlier(value) markiert
// Elemente, deren echter Wert im <title> genannt werden muss (Abschnitt 7.3).
export function outlierAwareScale(values, rangeMin, rangeMax, options = {}) {
  const outlierZoneFraction = options.outlierZoneFraction ?? 0.15;
  const percentileThreshold = options.percentileThreshold ?? 0.9;
  const finite = values.filter(Number.isFinite);
  if (!finite.length) {
    return { scale: () => rangeMin, hasOutliers: false, isOutlier: () => false, min: 0, max: 0, threshold: 0 };
  }
  const sorted = [...finite].sort((a, b) => a - b);
  const min = Math.min(0, sorted[0]);
  const max = sorted[sorted.length - 1];
  const threshold = percentile(sorted, percentileThreshold);
  const hasOutliers = max > threshold && threshold > min;
  const normalRangeMax = hasOutliers ? rangeMin + (rangeMax - rangeMin) * (1 - outlierZoneFraction) : rangeMax;
  const normalScale = linearScale(min, hasOutliers ? threshold : (max || 1), rangeMin, normalRangeMax);
  const outlierScale = hasOutliers ? linearScale(threshold, max, normalRangeMax, rangeMax) : null;
  const scale = value => {
    if (!Number.isFinite(value)) return rangeMin;
    if (hasOutliers && value > threshold) return outlierScale(value);
    return normalScale(value);
  };
  return { scale, hasOutliers, isOutlier: value => hasOutliers && Number.isFinite(value) && value > threshold, min, max, threshold };
}

// Skalierung > 60 Elemente (Abschnitt 9.2): die 60 größten (nach |sizeKey|)
// bleiben Einzelelemente, der Rest wird zu einem Sammelelement.
export function capToSixty(elements, sizeKey = 'size') {
  if (elements.length <= 60) return { elements, collapsedCount: 0, collapsedValue: 0 };
  const sorted = [...elements].sort((a, b) => Math.abs(b[sizeKey] || 0) - Math.abs(a[sizeKey] || 0));
  const kept = sorted.slice(0, 60);
  const collapsed = sorted.slice(60);
  return {
    elements: kept,
    collapsedCount: collapsed.length,
    collapsedValue: collapsed.reduce((sum, element) => sum + (element[sizeKey] || 0), 0)
  };
}

// ---------------------------------------------------------------------------
// Zustandsvererbung (Abschnitt 6): "Ein Diagramm ist keine Ansicht, sondern
// die Bildform einer Objektmenge" — jedes Element erbt den Wertzustand der
// Werte, aus denen es entsteht. Bei mehreren Werten gilt der schwächste.
// ---------------------------------------------------------------------------

export const VALUE_STATE_STRENGTH = { set: 3, derived: 2, default: 1, openByDecision: 0 };

export function combinedValueState(states) {
  const list = states.length ? states : ['default'];
  return list.reduce((weakest, state) => {
    const strength = VALUE_STATE_STRENGTH[state] ?? VALUE_STATE_STRENGTH.default;
    const weakestStrength = VALUE_STATE_STRENGTH[weakest] ?? VALUE_STATE_STRENGTH.default;
    return strength < weakestStrength ? state : weakest;
  }, list[0]);
}

function fieldStates(objectType, object, objectId, keys, context) {
  return keys.map(key => valueState(objectType, key, object?.[key], { object, objectId, ...context }).state);
}

function hasFieldEvidenceGap(objectType, object, keys) {
  return keys.some(key => evidenceGapFor(objectType, key, object));
}

// Aggregierter Wertzustand eines Maßnahmenfelds über mehrere Maßnahmen
// (für Diagramme, deren Element kein einzelnes Objekt ist, z. B. eine
// Jahressäule oder ein Sensitivitätstreiber) — schwächster Zustand gewinnt.
export function aggregateMeasureFieldState(measures, key, context) {
  const states = measures.map(measure => valueState('measure', key, measure?.[key], { object: measure, objectId: measure.id, ...context }).state);
  return combinedValueState(states);
}

// ---------------------------------------------------------------------------
// 1. Risikomatrix (Filter "measure") — Abschnitt 5
// ---------------------------------------------------------------------------

export function riskMatrixModel(measures, context = {}) {
  const elements = [];
  measures.forEach(measure => {
    impactAssumptionsFor(measure).filter(impact => impact.area === 'risk').forEach(impact => {
      const objectId = `${measure.id}:${impact.id}`;
      const states = fieldStates('impactAssumption', impact, objectId, ['riskProbabilityBefore', 'riskProbabilityAfter', 'riskImpact'], context);
      elements.push({
        objectType: 'measure',
        objectId: measure.id,
        label: measure.name || measure.id,
        xBefore: impact.riskProbabilityBefore,
        xAfter: impact.riskProbabilityAfter,
        x: impact.riskProbabilityAfter,
        y: impact.riskImpact,
        size: riskExpectedValue(impact),
        valueState: combinedValueState(states),
        hasEvidenceGap: hasFieldEvidenceGap('impactAssumption', impact, ['evidence'])
      });
    });
  });
  const xAxis = { label: 'Eintrittswahrscheinlichkeit (%)', min: 0, max: 100, ticks: niceTicks(0, 100, 5) };
  const yValues = elements.map(element => element.y);
  const yMax = yValues.length ? Math.max(...yValues) : 0;
  const yAxis = { label: 'Schadenshöhe (TEUR)', min: 0, max: yMax, ticks: niceTicks(0, yMax || 1, 4) };
  return {
    type: 'riskMatrix',
    xAxis,
    yAxis,
    ...capToSixty(elements, 'size'),
    emptyReason: elements.length ? null : 'Noch keine Risikoannahmen mit Eintrittswahrscheinlichkeit und Schadenshöhe erfasst.'
  };
}

// ---------------------------------------------------------------------------
// 2. Liquiditäts-/EOG-Verlauf (Filter "kpi:eogYear1", "kpi:eogFollow")
// ---------------------------------------------------------------------------

const eogFlowStackKeys = ['depreciation', 'capitalReturn', 'qAndE', 'risk', 'firstYearOpex'];

export function eogFlowModel(portfolio, context = {}) {
  const yearly = Array.isArray(portfolio?.yearly) ? portfolio.yearly : [];
  const measures = Array.isArray(portfolio?.activeMeasures) ? portfolio.activeMeasures : [];
  // Abschnitt 7.2: Jahressäulen gehören zu keinem einzelnen Objekt — ihr
  // Wertzustand ist trotzdem geschuldet (Kriterium V5): schwächster Zustand
  // über die wirkungsrelevanten Felder (Gruppe "wirkung") aller aktiven
  // Maßnahmen, da eine Jahressäule aus allen Maßnahmen zusammen entsteht.
  const wirkungFieldKeys = ['qDirect', 'eDirect', 'riskAvoided', 'portfolioShare'];
  const yearState = combinedValueState(measures.length
    ? wirkungFieldKeys.map(key => aggregateMeasureFieldState(measures, key, context))
    : ['default']);
  const elements = yearly.map(row => ({
    objectType: null,
    objectId: null,
    year: row.year,
    x: row.year,
    stack: Object.fromEntries(eogFlowStackKeys.map(key => [key, row[key] || 0])),
    indicativeCashflow: row.indicativeCashflow || 0,
    bridgeCumulative: row.bridgeCumulative || 0,
    valueState: yearState,
    hasEvidenceGap: measures.some(measure => hasFieldEvidenceGap('measure', measure, ['riskAvoided']))
  }));
  const stackTotals = elements.map(element => eogFlowStackKeys.reduce((sum, key) => sum + element.stack[key], 0));
  const lineValues = [...elements.map(e => e.indicativeCashflow), ...elements.map(e => e.bridgeCumulative)];
  const yMax = Math.max(0, ...stackTotals, ...lineValues);
  const yMin = Math.min(0, ...stackTotals, ...lineValues);
  return {
    type: 'eogFlow',
    xAxis: { label: 'Jahr', min: yearly[0]?.year ?? 0, max: yearly[yearly.length - 1]?.year ?? 0, ticks: yearly.map(row => row.year) },
    yAxis: { label: 'TEUR', min: yMin, max: yMax, ticks: niceTicks(yMin, yMax || 1, 4) },
    elements,
    collapsedCount: 0,
    collapsedValue: 0,
    emptyReason: elements.length ? null : 'Noch kein Planungshorizont berechnet — Rahmendaten (Startjahr, Horizont) prüfen.'
  };
}

// ---------------------------------------------------------------------------
// 3. Wasserfall (Filter "kpi:npv")
// ---------------------------------------------------------------------------

export function waterfallModel(portfolio, context = {}) {
  const waterfall = portfolioWaterfallFor(portfolio);
  const measures = Array.isArray(portfolio?.activeMeasures) ? portfolio.activeMeasures : [];
  const wirkungState = measures.length
    ? combinedValueState(['qDirect', 'eDirect', 'riskAvoided', 'portfolioShare'].map(key => aggregateMeasureFieldState(measures, key, context)))
    : 'default';
  // "Balken → beitragende Maßnahme, wo eindeutig" (Diagrammkatalog Abschnitt
  // 5): jeder Schritt außer Basis-EOG ist eine Portfoliosumme über alle
  // aktiven Maßnahmen — nur bei genau einer aktiven Maßnahme ist das
  // eindeutig dieser einen Maßnahme zurechenbar.
  const soleMeasure = measures.length === 1 ? measures[0] : null;
  const steps = [...waterfall.baseEogWaterfall, ...waterfall.cashflowBridge];
  let cumulative = 0;
  const elements = steps.map((step, index) => {
    const start = cumulative;
    cumulative += step.valueTeur;
    return {
      objectType: index > 0 && soleMeasure ? 'measure' : null,
      objectId: index > 0 && soleMeasure ? soleMeasure.id : null,
      key: step.key,
      label: step.label,
      x: index,
      start,
      end: cumulative,
      value: step.valueTeur,
      valueState: index === 0 ? 'set' : wirkungState,
      hasEvidenceGap: measures.some(measure => hasFieldEvidenceGap('measure', measure, ['riskAvoided']))
    };
  });
  const bounds = elements.flatMap(element => [element.start, element.end]);
  const yMax = bounds.length ? Math.max(...bounds) : 0;
  const yMin = bounds.length ? Math.min(...bounds) : 0;
  return {
    type: 'waterfall',
    xAxis: { label: '', min: 0, max: Math.max(0, elements.length - 1), ticks: elements.map((element, index) => index) },
    yAxis: { label: 'TEUR', min: yMin, max: yMax, ticks: niceTicks(yMin, yMax || 1, 4) },
    elements,
    collapsedCount: 0,
    collapsedValue: 0,
    waterfall,
    emptyReason: elements.every(element => !element.value) ? 'Noch keine Basis-EOG oder Maßnahmenwirkung berechnet.' : null
  };
}

// ---------------------------------------------------------------------------
// 4. Beitragsbalken (Filter "kpi:irr") — Kapitalwertbeitrag je Maßnahme
// ---------------------------------------------------------------------------

export function contributionBarsModel(portfolio, context = {}) {
  const results = Array.isArray(portfolio?.results) ? portfolio.results : [];
  const wirkungKeys = ['qDirect', 'eDirect', 'riskAvoided', 'portfolioShare'];
  const raw = results
    .filter(result => Number.isFinite(result.npv) && result.npv !== 0)
    .map(result => {
      const measure = result.measure;
      return {
        objectType: 'measure',
        objectId: measure.id,
        label: measure.name || measure.id,
        value: result.npv,
        size: Math.abs(result.npv),
        valueState: combinedValueState(fieldStates('measure', measure, measure.id, wirkungKeys, context)),
        hasEvidenceGap: hasFieldEvidenceGap('measure', measure, ['riskAvoided'])
      };
    })
    .sort((a, b) => b.value - a.value);
  const capped = capToSixty(raw, 'size');
  const values = capped.elements.map(element => element.value);
  const yMax = values.length ? Math.max(0, ...values) : 0;
  const yMin = values.length ? Math.min(0, ...values) : 0;
  return {
    type: 'contributionBars',
    xAxis: { label: 'Maßnahme', min: 0, max: Math.max(0, capped.elements.length - 1), ticks: [] },
    yAxis: { label: 'Kapitalwertbeitrag (TEUR)', min: yMin, max: yMax, ticks: niceTicks(yMin, yMax || 1, 4) },
    ...capped,
    emptyReason: capped.elements.length ? null : 'Noch keine Maßnahme mit Kapitalwertbeitrag ungleich null.'
  };
}

// ---------------------------------------------------------------------------
// 5. Wirkungsrangliste / Tornado (Filter "clarification")
// ---------------------------------------------------------------------------

// Grobe Zuordnung Sensitivitätstreiber -> Klärpunkt-Textmuster, damit ein
// Balken (soweit vorhanden) denselben Klärpunkt trifft wie eine echte
// Klärpunktzeile — kein Objektbezug ist zulässig (Abschnitt 7.2), wenn keiner
// existiert.
const driverKeywordPattern = {
  riskAvoided: /risiko|risk/i,
  returnRate: /verzinsung|zins/i,
  financingRate: /finanzierung|fk-zins|zins/i,
  usefulLife: /nutzungsdauer|life/i,
  kanuEndYear: /kanu|transformation|horizont/i
};

const driverFieldMapping = {
  riskAvoided: { objectType: 'measure', key: 'riskAvoided' },
  returnRate: { objectType: 'input', key: 'returnRate' },
  financingRate: { objectType: 'input', key: 'financingRate' },
  usefulLife: { objectType: 'measure', key: 'life' },
  kanuEndYear: { objectType: 'input', key: 'kanuEndYear' }
};

function matchingClarificationKey(driverKey, clarificationItems) {
  const pattern = driverKeywordPattern[driverKey];
  if (!pattern) return null;
  const match = clarificationItems.find(item => pattern.test([item.title, item.area, item.detail].filter(Boolean).join(' ')));
  return match ? match.key : null;
}

export function tornadoModel(model, p, clarificationItems = [], context = {}) {
  const tornado = portfolioSensitivityTornadoFor(model, p);
  const measures = Array.isArray(model?.measures) ? model.measures.filter(measure => measure.active) : [];
  const elements = tornado.drivers.map(driver => {
    const mapping = driverFieldMapping[driver.key];
    let driverState = 'default';
    if (mapping?.objectType === 'input') {
      driverState = valueState('input', mapping.key, model.inputs?.[mapping.key], { object: model.inputs, objectId: 'inputs', ...context }).state;
    } else if (mapping?.objectType === 'measure' && measures.length) {
      driverState = aggregateMeasureFieldState(measures, mapping.key, context);
    }
    return {
      objectType: 'clarification',
      objectId: matchingClarificationKey(driver.key, clarificationItems),
      key: driver.key,
      label: driver.label,
      low: driver.lowDeltaNpv,
      high: driver.highDeltaNpv,
      value: driver.swingTeur,
      size: driver.swingTeur,
      valueState: driverState,
      hasEvidenceGap: driver.key === 'riskAvoided' && measures.some(measure => hasFieldEvidenceGap('measure', measure, ['riskAvoided']))
    };
  });
  const bounds = elements.flatMap(element => [element.low, element.high]);
  const xMax = bounds.length ? Math.max(...bounds) : 0;
  const xMin = bounds.length ? Math.min(...bounds) : 0;
  return {
    type: 'tornado',
    xAxis: { label: 'Δ Kapitalwert (TEUR)', min: xMin, max: xMax, ticks: niceTicks(xMin, xMax || 1, 4) },
    yAxis: { label: '', min: 0, max: Math.max(0, elements.length - 1), ticks: [] },
    elements,
    collapsedCount: 0,
    collapsedValue: 0,
    emptyReason: elements.length ? null : 'Noch keine Sensitivitätstreiber berechenbar.'
  };
}

// ---------------------------------------------------------------------------
// 6. Segmentbalken (Filter "rahmen") — Tragfähigkeitskategorien
// ---------------------------------------------------------------------------

export function viabilitySegmentsModel(model, inputs, context = {}) {
  const overview = viabilityOverviewFor(model, inputs);
  const elements = VIABILITY_CATEGORIES.map(category => {
    const bucket = overview.categories[category.id];
    const measuresInBucket = (bucket?.measures || [])
      .map(classification => (model.measures || []).find(measure => measure.id === classification.measureId))
      .filter(Boolean);
    const states = measuresInBucket.length
      ? measuresInBucket.map(measure => valueState('measure', 'viabilityCategory', measure.viabilityCategory, { object: measure, objectId: measure.id, ...context }).state)
      : ['default'];
    return {
      objectType: 'viabilityCategory',
      objectId: category.id,
      label: category.shortLabel,
      value: bucket?.capexTeur || 0,
      size: bucket?.capexTeur || 0,
      count: bucket?.count || 0,
      bridgeMissingShare: bucket?.count ? bucket.bridgeMissing / bucket.count : 0,
      valueState: combinedValueState(states),
      hasEvidenceGap: Boolean(bucket?.bridgeMissing)
    };
  }).filter(element => element.count > 0);
  const values = elements.map(element => element.value);
  const yMax = values.length ? Math.max(...values) : 0;
  return {
    type: 'viabilitySegments',
    xAxis: { label: 'Tragfähigkeitskategorie', min: 0, max: Math.max(0, elements.length - 1), ticks: [] },
    yAxis: { label: 'CAPEX (TEUR)', min: 0, max: yMax, ticks: niceTicks(0, yMax || 1, 4) },
    elements,
    collapsedCount: 0,
    collapsedValue: 0,
    emptyReason: elements.length ? null : 'Noch keine Maßnahme einer Tragfähigkeitskategorie zugeordnet.'
  };
}

// ---------------------------------------------------------------------------
// 7. Mikro-Verlauf (Kontextspalte, Abschnitt 4.1) — AfA, Verzinsung,
// regulatorische EOG-Wirkung und indikativer Cashflow einer einzelnen
// Maßnahme über ihren Horizont. Bewusst ohne valueState/objectId: die
// Mikrografik hat laut Spezifikation "keine Interaktion, kein Klickziel" und
// keine eigene Beschriftung — nur eine Form, kein Objektbezug wie bei den
// übrigen Diagrammen.
// ---------------------------------------------------------------------------

export function measureMicroFlowModel(measure, p) {
  const result = calcMeasure(measure, p, portfolioEffectFor(measure, p));
  const rows = (result.rows || []).map(row => ({
    year: row.year,
    depreciation: row.depreciation || 0,
    capitalReturn: row.capitalReturn || 0,
    regulatoryEogEffect: row.regulatoryEogEffect || 0,
    indicativeCashflow: row.indicativeCashflow || 0
  }));
  return { type: 'measureMicroFlow', rows };
}
