// Rechenkern fuer den Szenario-Rechner regulierte Sparten.
// Dieses Modul ist bewusst DOM-frei: Modellzustand und Parameter rein, Ergebnisobjekt raus.

export const regulatoryParameterSet = {
  id: 'regulatory-parameters-2026-07',
  effectiveMonth: '2026-07',
  source: 'BNetzA-Anreizregulierung / NEST-Rahmenfestlegung, Arbeitsstand fuer Produktisierung',
  futurePeriodLengthYears: 5,
  regulatoryPeriodsBySector: {
    gas: [
      { number: 4, id: 'RP4', label: '4. Regulierungsperiode', start: 2023, end: 2027, costBaseYear: 2020, known: true },
      { number: 5, id: 'RP5', label: '5. Regulierungsperiode', start: 2028, end: 2032, costBaseYear: 2025, known: true }
    ],
    strom: [
      { number: 4, id: 'RP4', label: '4. Regulierungsperiode', start: 2024, end: 2028, costBaseYear: 2021, known: true },
      { number: 5, id: 'RP5', label: '5. Regulierungsperiode', start: 2029, end: 2033, costBaseYear: 2026, known: true }
    ]
  }
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

const impactAreas = new Set(['qElement', 'efficiency', 'costBase', 'risk', 'portfolio']);
const impactConfidences = new Set(['proven', 'assumption', 'review']);
const impactGovernanceStates = new Set(['basis', 'sensitivity', 'excluded']);
const evidenceTypes = new Set(['measurement', 'operations', 'expert', 'study', 'open']);

export function riskExpectedValue(impact = {}) {
  if (impact.area !== 'risk' || impact.legacyFlat) return finiteNumber(impact.amount);
  const before = clamp(finiteNumber(impact.riskProbabilityBefore), 0, 100) / 100;
  const after = clamp(finiteNumber(impact.riskProbabilityAfter), 0, 100) / 100;
  return Math.max(0, before - after) * finiteNumber(impact.riskImpact);
}

export function normalizeImpactAssumption(impact = {}, index = 0, measure = {}) {
  const area = impactAreas.has(impact.area) ? impact.area : 'efficiency';
  const confidence = impactConfidences.has(impact.confidence) ? impact.confidence : 'review';
  const governance = impactGovernanceStates.has(impact.governance) ? impact.governance : confidence === 'review' ? 'sensitivity' : 'basis';
  const startYear = Math.round(finiteNumber(impact.startYear, measure.year));
  const endYearRaw = impact.endYear === '' || impact.endYear === null || impact.endYear === undefined
    ? NaN
    : finiteNumber(impact.endYear, NaN);
  const endYear = Number.isFinite(endYearRaw) ? Math.round(endYearRaw) : null;
  return {
    id: String(impact.id || 'impact_' + index),
    area,
    title: String(impact.title || 'Wirkannahme'),
    amount: area === 'risk' && !impact.legacyFlat ? riskExpectedValue({ ...impact, area }) : finiteNumber(impact.amount),
    confidence,
    governance,
    startYear,
    endYear,
    attribution: clamp(finiteNumber(impact.attribution, 100), 0, 100) / 100,
    chain: String(impact.chain || ''),
    evidence: String(impact.evidence || ''),
    evidenceType: evidenceTypes.has(impact.evidenceType) ? impact.evidenceType : 'open',
    legacyFlat: Boolean(impact.legacyFlat),
    riskProbabilityBefore: clamp(finiteNumber(impact.riskProbabilityBefore), 0, 100),
    riskProbabilityAfter: clamp(finiteNumber(impact.riskProbabilityAfter), 0, 100),
    riskImpact: finiteNumber(impact.riskImpact),
    note: String(impact.note || '')
  };
}

export function impactAssumptionsFor(measure = {}) {
  const assumptions = Array.isArray(measure.impactAssumptions) ? measure.impactAssumptions : [];
  return assumptions.map((impact, index) => normalizeImpactAssumption(impact, index, measure));
}

function impactIncludedInScenario(impact, p) {
  if (impact.governance === 'excluded') return false;
  if (p.regulationProcedure === 'simplified' && (impact.area === 'qElement' || impact.area === 'efficiency')) return false;
  if (p.assumptionMode === 'approvedOnly') return impact.confidence === 'proven' && impact.governance === 'basis';
  if (p.assumptionMode === 'includeReview') return impact.governance !== 'excluded';
  return impact.governance === 'basis' && impact.confidence !== 'review';
}

function impactActiveInYear(impact, year) {
  return year >= impact.startYear && (impact.endYear === null || year <= impact.endYear);
}

export function impactEffectsForMeasure(measure, p, year) {
  const assumptions = impactAssumptionsFor(measure);
  return assumptions.reduce((effects, impact) => {
    const included = impactIncludedInScenario(impact, p);
    const annual = included && impactActiveInYear(impact, year) ? impact.amount * impact.attribution : 0;
    if (impact.area === 'risk') {
      effects.risk += annual;
    } else {
      effects.qAndE += annual;
    }
    if (included) effects.included.push(impact);
    if (!included && impact.governance !== 'excluded') effects.sensitivity.push(impact);
    return effects;
  }, { qAndE: 0, risk: 0, included: [], sensitivity: [] });
}

export function regulatoryPeriodFor(sector, year, parameterSet = regulatoryParameterSet) {
  const periods = parameterSet.regulatoryPeriodsBySector[sector] || parameterSet.regulatoryPeriodsBySector.gas;
  const numericYear = Math.round(finiteNumber(year));
  const direct = periods.find(period => numericYear >= period.start && numericYear <= period.end);
  if (direct) return direct;
  const first = periods[0];
  if (numericYear < first.start) return first;
  const last = periods[periods.length - 1];
  const periodLength = parameterSet.futurePeriodLengthYears;
  const offset = Math.floor((numericYear - last.end - 1) / periodLength) + 1;
  const start = last.end + 1 + (offset - 1) * periodLength;
  const end = start + periodLength - 1;
  const number = last.number + offset;
  return {
    number,
    id: 'RP' + number,
    label: number + '. Regulierungsperiode',
    start,
    end,
    costBaseYear: start - 3,
    known: false
  };
}

export function npv(rate, flows) {
  return flows.reduce((sum, flow, i) => sum + flow / Math.pow(1 + rate, i), 0);
}

export function irr(flows) {
  let low = -0.95;
  let high = 1.5;
  let npvLow = npv(low, flows);
  const npvHigh = npv(high, flows);
  if (npvLow * npvHigh > 0) return NaN;
  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    const val = npv(mid, flows);
    if (Math.abs(val) < 0.00001) return mid;
    if (npvLow * val <= 0) {
      high = mid;
    } else {
      low = mid;
      npvLow = val;
    }
  }
  return (low + high) / 2;
}

export function params(inputs, overrides = {}) {
  const sector = String(inputs.sector || 'gas');
  const baseYear = Math.round(finiteNumber(inputs.baseYear));
  const regulationProcedure = inputs.regulationProcedure === 'simplified' ? 'simplified' : 'standard';
  const qDelta = regulationProcedure === 'simplified' ? 0 : finiteNumber(inputs.qDelta) / 100;
  const eDelta = regulationProcedure === 'simplified' ? 0 : finiteNumber(inputs.eDelta) / 100;
  return {
    sector,
    regulationProcedure,
    baseYear,
    regulatoryPeriod: regulatoryPeriodFor(sector, baseYear),
    baseEog: finiteNumber(inputs.baseEog),
    rab: finiteNumber(inputs.rab),
    returnRate: finiteNumber(inputs.returnRate) / 100,
    financingRate: finiteNumber(inputs.financingRate) / 100,
    horizon: Math.max(1, Math.round(finiteNumber(inputs.horizon))),
    discountRate: finiteNumber(inputs.discountRate) / 100,
    kanuEndYear: Math.round(finiteNumber(inputs.kanuEndYear)),
    degressiveRate: clamp(finiteNumber(inputs.degressiveRate), 0, 12) / 100,
    taxFactor: finiteNumber(inputs.taxFactor) / 100,
    attribution: clamp(finiteNumber(inputs.portfolioAttribution), 0, 100) / 100,
    qDelta,
    eDelta,
    annualEnergyGwh: finiteNumber(inputs.annualEnergyGwh, NaN),
    householdConsumptionKwh: finiteNumber(inputs.householdConsumptionKwh, sector === 'gas' ? 15000 : 2900),
    assumptionMode: 'basis',
    ...overrides
  };
}

export function expectedActivated(measure) {
  const secure = clamp(finiteNumber(measure.secure), 0, 100) / 100;
  const uncertain = clamp(finiteNumber(measure.uncertain), 0, 100) / 100;
  const probability = clamp(finiteNumber(measure.probability), 0, 100) / 100;
  const rawShare = secure + uncertain * probability;
  const share = Math.min(1, rawShare);
  return {
    share,
    rawShare,
    activated: finiteNumber(measure.cost) * share,
    nonActivated: Math.max(0, finiteNumber(measure.cost) * (1 - share))
  };
}

export function calcMeasure(measure, p, portfolioEffectPa = 0) {
  const active = expectedActivated(measure);
  const opex = active.nonActivated * clamp(finiteNumber(measure.opexRecognition), 0, 100) / 100;
  const start = Math.round(finiteNumber(measure.year));
  const qAndE = finiteNumber(measure.qDirect) + finiteNumber(measure.eDirect) + portfolioEffectPa;
  const risk = finiteNumber(measure.riskAvoided);
  const opexPa = finiteNumber(measure.opexPa);
  const opexDeltaPa = finiteNumber(measure.opexDeltaPa);
  const reinvestCost = finiteNumber(measure.reinvestCost);
  const decommissionCost = finiteNumber(measure.decommissionCost);
  const hgbLife = Math.max(1, Math.round(finiteNumber(measure.hgbLife, measure.life)));
  const defaultDecommissionYear = p.sector === 'gas'
    ? p.kanuEndYear
    : start + Math.max(1, Math.round(finiteNumber(measure.life))) - 1;
  const decommissionYear = Math.round(finiteNumber(measure.decommissionYear, defaultDecommissionYear));
  const reinvestYear = start + Math.max(1, Math.round(finiteNumber(measure.life)));
  let rest = active.activated;
  const rows = [];

  for (let i = 0; i < p.horizon; i++) {
    const year = p.baseYear + i;
    const opening = year >= start ? rest : 0;
    let depreciation = 0;

    if (opening > 0.000001) {
      if (measure.depr === 'normal' || p.sector === 'strom') {
        depreciation = Math.min(opening, active.activated / Math.max(1, finiteNumber(measure.life)));
      } else if (measure.depr === 'kanuLinear') {
        const remainingYears = Math.max(1, p.kanuEndYear - year + 1);
        depreciation = Math.min(opening, opening / remainingYears);
      } else {
        const remainingYears = Math.max(1, p.kanuEndYear - year + 1);
        const linearFloor = opening / remainingYears;
        depreciation = Math.min(opening, Math.max(opening * p.degressiveRate, linearFloor));
      }
    }

    const avgCapital = Math.max(0, opening - depreciation / 2);
    const capitalReturn = avgCapital * p.returnRate * (1 + p.taxFactor);
    const firstYearOpex = year === start ? opex : 0;
    const impactEffects = year >= start ? impactEffectsForMeasure(measure, p, year) : { qAndE: 0, risk: 0, included: [], sensitivity: [] };
    const yearlyQE = year >= start ? qAndE + impactEffects.qAndE : 0;
    const yearlyRisk = year >= start ? risk + impactEffects.risk : 0;
    const lifecycleOpex = year >= start ? -opexPa + opexDeltaPa : 0;
    const reinvest = year === reinvestYear ? -reinvestCost : 0;
    const decommission = year === decommissionYear ? -decommissionCost : 0;
    const reinvestDecommission = reinvest + decommission;
    const eog = depreciation + capitalReturn + firstYearOpex + yearlyQE + yearlyRisk + lifecycleOpex + reinvestDecommission;
    const hgbDepreciation = year >= start && year < start + hgbLife
      ? Math.min(active.activated / hgbLife, active.activated)
      : 0;
    const ebit = eog - hgbDepreciation - (year >= start ? opexPa : 0) + (year >= start ? opexDeltaPa : 0);
    const bridge = depreciation - hgbDepreciation;

    if (year >= start) rest = Math.max(0, rest - depreciation);
    rows.push({
      year,
      depreciation,
      capitalReturn,
      qAndE: yearlyQE,
      opex: lifecycleOpex,
      risk: yearlyRisk,
      opexRisk: firstYearOpex + yearlyRisk,
      reinvestDecommission,
      hgbDepreciation,
      ebit,
      bridge,
      eog
    });
  }

  const flows = [-finiteNumber(measure.cost), ...rows.map(row => row.eog)];
  const measureIrr = irr(flows);
  const measureNpv = npv(p.discountRate, flows);
  const impactSummary = impactEffectsForMeasure(measure, p, start);
  const futureGrossCosts = rows.map(row => Math.max(0, -row.opex) + Math.max(0, -row.reinvestDecommission));
  const totexNominal = finiteNumber(measure.cost) + futureGrossCosts.reduce((sum, value) => sum + value, 0);
  const totexDiscounted = finiteNumber(measure.cost) + futureGrossCosts.reduce((sum, value, index) => sum + value / Math.pow(1 + p.discountRate, index + 1), 0);
  return {
    measure,
    activated: active.activated,
    activeShare: active.share,
    rows,
    irr: measureIrr,
    npv: measureNpv,
    impactSummary,
    totex: { nominal: totexNominal, discounted: totexDiscounted },
    riskReductionPa: impactSummary.risk + risk
  };
}

export function portfolioEffectFor(measure, p) {
  const globalEffect = p.baseEog * (p.qDelta + p.eDelta) * p.attribution;
  return globalEffect * clamp(finiteNumber(measure.portfolioShare), 0, 100) / 100;
}

export function calcPortfolio(model, p) {
  const measures = Array.isArray(model?.measures) ? model.measures : [];
  const activeMeasures = measures.filter(measure => measure.active);
  const results = activeMeasures.map(measure => calcMeasure(measure, p, portfolioEffectFor(measure, p)));
  const yearly = Array.from({ length: p.horizon }, (_, i) => ({
    year: p.baseYear + i,
    regulatoryPeriod: null,
    depreciation: 0,
    capitalReturn: 0,
    qAndE: 0,
    opex: 0,
    risk: 0,
    opexRisk: 0,
    reinvestDecommission: 0,
    hgbDepreciation: 0,
    ebit: 0,
    bridge: 0,
    bridgeCumulative: 0,
    eog: 0
  }));

  results.forEach(result => {
    result.rows.forEach((row, i) => {
      yearly[i].depreciation += row.depreciation;
      yearly[i].capitalReturn += row.capitalReturn;
      yearly[i].qAndE += row.qAndE;
      yearly[i].opex += row.opex;
      yearly[i].risk += row.risk;
      yearly[i].opexRisk += row.opexRisk;
      yearly[i].reinvestDecommission += row.reinvestDecommission;
      yearly[i].hgbDepreciation += row.hgbDepreciation;
      yearly[i].ebit += row.ebit;
      yearly[i].bridge += row.bridge;
      yearly[i].eog += row.eog;
    });
  });

  const invest = activeMeasures.reduce((sum, measure) => sum + finiteNumber(measure.cost), 0);
  const activated = results.reduce((sum, result) => sum + result.activated, 0);
  const flows = [-invest, ...yearly.map(row => row.eog)];
  const resultIrr = invest > 0 ? irr(flows) : NaN;
  const resultNpv = invest > 0 ? npv(p.discountRate, flows) : 0;
  const qePa = activeMeasures.reduce((sum, measure) => sum + portfolioEffectFor(measure, p), 0);
  const impactPa = results.reduce((sum, result) => sum + result.impactSummary.qAndE + result.impactSummary.risk, 0);
  const riskPa = results.reduce((sum, result) => sum + result.riskReductionPa, 0);
  const totex = results.reduce((sum, result) => ({
    nominal: sum.nominal + result.totex.nominal,
    discounted: sum.discounted + result.totex.discounted
  }), { nominal: 0, discounted: 0 });
  let bridgeCumulative = 0;
  yearly.forEach(row => {
    row.regulatoryPeriod = regulatoryPeriodFor(p.sector, row.year);
    bridgeCumulative += row.bridge;
    row.bridgeCumulative = bridgeCumulative;
  });

  return {
    p,
    activeMeasures,
    results,
    yearly,
    invest,
    activated,
    irr: resultIrr,
    npv: resultNpv,
    qePa,
    impactPa,
    riskPa,
    totex,
    tariffImpact: tariffImpactFor(yearly[0]?.eog || 0, p)
  };
}

export function tariffImpactFor(eogTeur, p) {
  const annualEnergyGwh = finiteNumber(p.annualEnergyGwh, NaN);
  const householdConsumptionKwh = finiteNumber(p.householdConsumptionKwh, p.sector === 'gas' ? 15000 : 2900);
  if (!Number.isFinite(annualEnergyGwh) || annualEnergyGwh <= 0) {
    return {
      available: false,
      ctPerKwh: NaN,
      householdEurPerYear: NaN,
      caveat: 'Indikativ. Die tatsächliche Wälzung folgt der Entgeltsystematik (Kundengruppen, Leistungspreise, Periodenlogik) und kann deutlich abweichen.'
    };
  }
  const ctPerKwh = finiteNumber(eogTeur) * 100000 / (annualEnergyGwh * 1000000);
  return {
    available: true,
    ctPerKwh,
    householdEurPerYear: ctPerKwh * householdConsumptionKwh / 100,
    caveat: 'Indikativ. Die tatsächliche Wälzung folgt der Entgeltsystematik (Kundengruppen, Leistungspreise, Periodenlogik) und kann deutlich abweichen.'
  };
}

export function scenarioParams(baseParams, name) {
  if (name === 'konservativ') {
    return {
      ...baseParams,
      attribution: Math.min(baseParams.attribution, 0.1),
      qDelta: baseParams.qDelta * 0.5,
      eDelta: baseParams.eDelta * 0.5,
      discountRate: Math.max(baseParams.discountRate, baseParams.financingRate),
      assumptionMode: 'approvedOnly'
    };
  }
  if (name === 'wert') {
    return {
      ...baseParams,
      attribution: Math.max(baseParams.attribution, 0.5),
      qDelta: baseParams.qDelta || 0.006,
      eDelta: baseParams.eDelta || 0.002,
      assumptionMode: 'includeReview'
    };
  }
  return baseParams;
}
