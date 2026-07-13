// Rechenkern fuer den Szenario-Rechner regulierte Sparten.
// Dieses Modul ist bewusst DOM-frei: Modellzustand und Parameter rein, Ergebnisobjekt raus.

import { regulatoryParameterSet } from './rulesets/index.js';

export { regulatoryParameterSet };

export const defaultEffectLags = regulatoryParameterSet.defaultEffectLags;
export const defaultCapitalCostSettings = regulatoryParameterSet.capitalCostDefaults;

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

function impactActiveInYear(impact, year, lagYears = 0) {
  const lag = Math.max(0, Math.round(finiteNumber(lagYears)));
  return year >= impact.startYear + lag && (impact.endYear === null || year <= impact.endYear + lag);
}

export function impactEffectsForMeasure(measure, p, year, lagYears = 0) {
  const assumptions = impactAssumptionsFor(measure);
  return assumptions.reduce((effects, impact) => {
    const included = impactIncludedInScenario(impact, p);
    const annual = included && impactActiveInYear(impact, year, lagYears) ? impact.amount * impact.attribution : 0;
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

export function cashflowSignChanges(flows) {
  return flows
    .map(value => finiteNumber(value))
    .filter(value => Math.abs(value) > 0.000001)
    .reduce((changes, value, index, materialFlows) => {
      if (index === 0) return 0;
      return Math.sign(value) !== Math.sign(materialFlows[index - 1]) ? changes + 1 : changes;
    }, 0);
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

export function mirr(flows, financeRate = 0, reinvestRate = 0) {
  const n = flows.length - 1;
  if (n <= 0) return NaN;
  const positiveFutureValue = flows.reduce((sum, flow, index) => {
    const value = finiteNumber(flow);
    return value > 0 ? sum + value * Math.pow(1 + reinvestRate, n - index) : sum;
  }, 0);
  const negativePresentValue = flows.reduce((sum, flow, index) => {
    const value = finiteNumber(flow);
    return value < 0 ? sum + value / Math.pow(1 + financeRate, index) : sum;
  }, 0);
  if (positiveFutureValue <= 0 || negativePresentValue >= 0) return NaN;
  return Math.pow(positiveFutureValue / Math.abs(negativePresentValue), 1 / n) - 1;
}

export function returnMetricFor(flows, financeRate = 0, reinvestRate = 0) {
  const signChanges = cashflowSignChanges(flows);
  if (signChanges === 1) {
    return {
      kind: 'irr',
      label: 'IRR',
      value: irr(flows),
      signChanges,
      note: 'Eindeutige IRR bei genau einem Vorzeichenwechsel.'
    };
  }
  if (signChanges > 1) {
    return {
      kind: 'mirr',
      label: 'MIRR',
      value: mirr(flows, financeRate, reinvestRate),
      signChanges,
      note: 'Mehrere Vorzeichenwechsel: IRR ist mehrdeutig, daher wird MIRR mit Finanzierungs- und Reinvestitionssatz gezeigt.'
    };
  }
  return {
    kind: 'none',
    label: 'IRR',
    value: NaN,
    signChanges,
    note: 'Keine Renditekennzahl berechenbar, weil keine belastbare Zahlungsstromumkehr vorliegt.'
  };
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
    capitalCost: capitalCostSettingsFor(inputs),
    attribution: clamp(finiteNumber(inputs.portfolioAttribution), 0, 100) / 100,
    qDelta,
    eDelta,
    annualEnergyGwh: finiteNumber(inputs.annualEnergyGwh, NaN),
    householdConsumptionKwh: finiteNumber(inputs.householdConsumptionKwh, sector === 'gas' ? 15000 : 2900),
    assumptionMode: 'basis',
    effectLags: {
      capex: Math.max(0, Math.round(finiteNumber(inputs.capexLagYears, defaultEffectLags.capex))),
      opex: Math.max(0, Math.round(finiteNumber(inputs.opexLagYears, defaultEffectLags.opex))),
      qe: Math.max(0, Math.round(finiteNumber(inputs.qeLagYears, defaultEffectLags.qe)))
    },
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

export function activationSplitHelper(measure = {}) {
  const active = expectedActivated(measure);
  const opexRecognitionShare = clamp(finiteNumber(measure.opexRecognition), 0, 100) / 100;
  const firstYearOpexRecognition = active.nonActivated * opexRecognitionShare;
  return {
    activated: active.activated,
    nonActivated: active.nonActivated,
    activatedShare: active.share,
    rawActivatedShare: active.rawShare,
    firstYearOpexRecognition,
    note: `Aktivierbarkeit: ${Math.round(active.share * 100)} % erwartbar kapitalwirksam; ${Math.round((1 - active.share) * 100)} % bleiben als nicht aktivierter Anteil zu prüfen.`,
    clarification: 'HGB-, Anlagenbuchhaltungs- und regulatorische Sicht können auseinanderlaufen; Quelle und Freigabe dokumentieren.'
  };
}

export function riskHelper({ probabilityBefore = 0, probabilityAfter = 0, impact = 0 } = {}) {
  const before = clamp(finiteNumber(probabilityBefore), 0, 100);
  const after = clamp(finiteNumber(probabilityAfter), 0, 100);
  const riskImpact = finiteNumber(impact);
  const delta = Math.max(0, before - after);
  const expectedAvoidedPa = delta / 100 * riskImpact;
  return {
    probabilityBefore: before,
    probabilityAfter: after,
    probabilityDelta: delta,
    impact: riskImpact,
    expectedAvoidedPa,
    chain: `Risikowert = max(0, ${before} % - ${after} %) × ${riskImpact} TEUR = ${expectedAvoidedPa.toFixed(1)} TEUR p.a.`,
    governance: 'Risikowert bleibt prüfpflichtig, bis Eintrittswahrscheinlichkeit, Schadenshöhe und Attribution fachlich belegt sind.'
  };
}

function hasDirectQeEffect(measure, p) {
  if (finiteNumber(measure.qDirect) !== 0 || finiteNumber(measure.eDirect) !== 0) return true;
  return impactAssumptionsFor(measure).some(impact => {
    if (impact.area !== 'qElement' && impact.area !== 'efficiency') return false;
    return impactIncludedInScenario(impact, p) && finiteNumber(impact.amount) !== 0;
  });
}

export function doubleCountingWarningsFor(measure, p, portfolioEffectPa = portfolioEffectFor(measure, p)) {
  const portfolioShare = clamp(finiteNumber(measure.portfolioShare), 0, 100);
  const hasPortfolioQe = portfolioShare > 0 && Math.abs(portfolioEffectPa) > 0.000001 && (p.qDelta !== 0 || p.eDelta !== 0);
  if (!hasPortfolioQe || !hasDirectQeEffect(measure, p)) return [];
  return [{
    type: 'possible_double_counting',
    key: `double-counting:${measure.id}:qe`,
    area: 'Q/Effizienz',
    targetPhase: 'massnahmenbewertung',
    measureId: measure.id,
    measure: measure.name || 'Maßnahme',
    title: 'Mögliche Doppelzählung Q/Effizienz',
    detail: 'Für diese Maßnahme sind pauschaler Portfolio-Q/Effekt und direkte Q-/Effizienzwirkungen gleichzeitig angesetzt. Attribution und Wirkungskette prüfen; keine automatische Kürzung.'
  }];
}

export function capitalCostSettingsFor(inputs = {}, parameterSet = regulatoryParameterSet) {
  const defaults = parameterSet.capitalCostDefaults || {};
  const mode = inputs.capitalCostMode === 'advanced' ? 'advanced' : 'simple';
  const defaultEquityShare = defaults['equityShare'] ?? 40;
  const defaultDebtShare = defaults['debtShare'] ?? (100 - defaultEquityShare);
  const equityShare = clamp(finiteNumber(inputs.equityShare, defaultEquityShare), 0, 100) / 100;
  const debtShare = clamp(finiteNumber(inputs.debtShare, defaultDebtShare), 0, 100) / 100;
  return {
    mode,
    equityShare,
    debtShare,
    equityReturnRate: finiteNumber(inputs.equityReturnRate, defaults['equityReturnRate'] ?? finiteNumber(inputs.returnRate)) / 100,
    debtReturnRate: finiteNumber(inputs.debtReturnRate, defaults['debtReturnRate'] ?? finiteNumber(inputs.financingRate)) / 100,
    deductionCapital: Math.max(0, finiteNumber(inputs.deductionCapital, defaults['deductionCapital'] ?? 0))
  };
}

export function capitalCostRateFor(settings, simpleReturnRate, taxFactor = 0) {
  if (!settings || settings.mode !== 'advanced') return simpleReturnRate * (1 + taxFactor);
  const totalShare = settings.equityShare + settings.debtShare;
  const equityWeight = totalShare > 0 ? settings.equityShare / totalShare : 0;
  const debtWeight = totalShare > 0 ? settings.debtShare / totalShare : 0;
  return equityWeight * settings.equityReturnRate * (1 + taxFactor) + debtWeight * settings.debtReturnRate;
}

export function eligibleCapitalFor(avgCapital, p) {
  if (p.capitalCost?.mode !== 'advanced') return avgCapital;
  const deductionShare = p.rab > 0 ? clamp(p.capitalCost.deductionCapital / p.rab, 0, 1) : 0;
  return Math.max(0, avgCapital * (1 - deductionShare));
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
  const reinvestMode = measure.reinvestMode === 'assetAddition' ? 'assetAddition' : 'oneOff';
  const reinvestLife = Math.max(1, Math.round(finiteNumber(measure.reinvestLife, measure.life)));
  const decommissionCost = finiteNumber(measure.decommissionCost);
  const hgbLife = Math.max(1, Math.round(finiteNumber(measure.hgbLife, measure.life)));
  const defaultDecommissionYear = p.sector === 'gas'
    ? p.kanuEndYear
    : start + Math.max(1, Math.round(finiteNumber(measure.life))) - 1;
  const decommissionYear = Math.round(finiteNumber(measure.decommissionYear, defaultDecommissionYear));
  const reinvestYear = start + Math.max(1, Math.round(finiteNumber(measure.life)));
  let rest = active.activated;
  const reinvestAnnualDepreciation = reinvestLife > 0 ? reinvestCost / reinvestLife : 0;
  const effectLags = { capex: 0, opex: 0, qe: 0, ...(p.effectLags || {}) };
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
    const eligibleCapital = eligibleCapitalFor(avgCapital, p);
    const capitalReturn = eligibleCapital * capitalCostRateFor(p.capitalCost, p.returnRate, p.taxFactor);
    const capexEffective = year >= start + effectLags.capex;
    const qeEffective = year >= start + effectLags.qe;
    const firstYearOpex = year === start + effectLags.opex ? opex : 0;
    const impactEffects = year >= start ? impactEffectsForMeasure(measure, p, year, effectLags.qe) : { qAndE: 0, risk: 0, included: [], sensitivity: [] };
    const yearlyQE = qeEffective ? qAndE + impactEffects.qAndE : 0;
    const yearlyRisk = year >= start ? risk + impactEffects.risk : 0;
    const economicOpex = year >= start ? -opexPa + opexDeltaPa : 0;
    const reinvest = year === reinvestYear ? -reinvestCost : 0;
    const decommission = year === decommissionYear ? -decommissionCost : 0;
    const reinvestAssetAge = year - reinvestYear;
    const reinvestAssetOpening = reinvestMode === 'assetAddition' && reinvestCost > 0 && reinvestAssetAge >= 0
      ? Math.max(0, reinvestCost - Math.min(reinvestAssetAge, reinvestLife) * reinvestAnnualDepreciation)
      : 0;
    const reinvestDepreciationRaw = reinvestAssetOpening > 0.000001 ? Math.min(reinvestAssetOpening, reinvestAnnualDepreciation) : 0;
    const reinvestCapitalReturnRaw = reinvestAssetOpening > 0.000001
      ? eligibleCapitalFor(Math.max(0, reinvestAssetOpening - reinvestDepreciationRaw / 2), p) * capitalCostRateFor(p.capitalCost, p.returnRate, p.taxFactor)
      : 0;
    const reinvestAssetEffective = reinvestMode === 'assetAddition' && year >= reinvestYear + effectLags.capex;
    const reinvestDepreciation = reinvestAssetEffective ? reinvestDepreciationRaw : 0;
    const reinvestCapitalReturn = reinvestAssetEffective ? reinvestCapitalReturnRaw : 0;
    const reinvestAssetEffect = reinvestDepreciation + reinvestCapitalReturn;
    const reinvestDecommission = reinvest + decommission;
    const regulatoryCapexEffect = capexEffective ? depreciation + capitalReturn : 0;
    const regulatoryEogEffect = regulatoryCapexEffect + reinvestAssetEffect + firstYearOpex + yearlyQE + yearlyRisk;
    const indicativeCashflow = regulatoryEogEffect + economicOpex + reinvestDecommission;
    const eog = indicativeCashflow;
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
      eligibleCapital,
      regulatoryCapexEffect,
      reinvestDepreciation,
      reinvestCapitalReturn,
      reinvestAssetEffect,
      reinvestmentTreatment: reinvestMode,
      qAndE: yearlyQE,
      opex: economicOpex,
      economicOpex,
      firstYearOpex,
      regulatoryEogEffect,
      indicativeCashflow,
      risk: yearlyRisk,
      opexRisk: firstYearOpex + yearlyRisk,
      reinvestDecommission,
      hgbDepreciation,
      ebit,
      bridge,
      eog
    });
  }

  const flows = [-finiteNumber(measure.cost), ...rows.map(row => row.indicativeCashflow)];
  const returnMetric = returnMetricFor(flows, p.financingRate, p.discountRate);
  const measureIrr = returnMetric.value;
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
    returnMetric,
    rateMetricLabel: returnMetric.label,
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
  const results = activeMeasures.map(measure => {
    const portfolioEffect = portfolioEffectFor(measure, p);
    const result = calcMeasure(measure, p, portfolioEffect);
    return {
      ...result,
      warnings: doubleCountingWarningsFor(measure, p, portfolioEffect)
    };
  });
  const yearly = Array.from({ length: p.horizon }, (_, i) => ({
    year: p.baseYear + i,
    regulatoryPeriod: null,
    depreciation: 0,
    capitalReturn: 0,
    eligibleCapital: 0,
    regulatoryCapexEffect: 0,
    reinvestDepreciation: 0,
    reinvestCapitalReturn: 0,
    reinvestAssetEffect: 0,
    firstYearOpex: 0,
    regulatoryEogEffect: 0,
    indicativeCashflow: 0,
    economicOpex: 0,
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
      yearly[i].eligibleCapital += row.eligibleCapital || 0;
      yearly[i].regulatoryCapexEffect += row.regulatoryCapexEffect;
      yearly[i].reinvestDepreciation += row.reinvestDepreciation;
      yearly[i].reinvestCapitalReturn += row.reinvestCapitalReturn;
      yearly[i].reinvestAssetEffect += row.reinvestAssetEffect;
      yearly[i].firstYearOpex += row.firstYearOpex;
      yearly[i].regulatoryEogEffect += row.regulatoryEogEffect;
      yearly[i].indicativeCashflow += row.indicativeCashflow;
      yearly[i].economicOpex += row.economicOpex;
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
  const flows = [-invest, ...yearly.map(row => row.indicativeCashflow)];
  const returnMetric = invest > 0
    ? returnMetricFor(flows, p.financingRate, p.discountRate)
    : returnMetricFor([]);
  const resultIrr = returnMetric.value;
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
    returnMetric,
    rateMetricLabel: returnMetric.label,
    irr: resultIrr,
    npv: resultNpv,
    qePa,
    impactPa,
    riskPa,
    totex,
    warnings: results.flatMap(result => result.warnings || []),
    tariffImpact: tariffImpactFor(yearly[0]?.regulatoryEogEffect || 0, p)
  };
}

function recurringValue(yearly, key) {
  const firstRecurringRow = yearly.slice(1).find(row => Math.abs(row.reinvestDecommission || 0) < 0.000001);
  return firstRecurringRow?.[key] ?? yearly[1]?.[key] ?? yearly[0]?.[key] ?? 0;
}

function decisionSnapshot(result) {
  const spread = Number.isFinite(result.irr) ? result.irr - result.p.financingRate : NaN;
  const carries = Number.isFinite(spread) && spread >= 0.01 && result.npv > 0;
  return {
    irr: result.irr,
    rateMetricKind: result.returnMetric?.kind || 'irr',
    rateMetricLabel: result.rateMetricLabel || 'IRR',
    rateMetricNote: result.returnMetric?.note || '',
    rateMetricSignChanges: result.returnMetric?.signChanges ?? 0,
    npv: result.npv,
    spread,
    impactPa: result.impactPa,
    investment: result.invest,
    activeMeasureCount: result.activeMeasures.length,
    yearOneRegulatoryEog: result.yearly[0]?.regulatoryEogEffect || 0,
    recurringRegulatoryEog: recurringValue(result.yearly, 'regulatoryEogEffect'),
    yearOneIndicativeCashflow: result.yearly[0]?.indicativeCashflow || 0,
    recurringIndicativeCashflow: recurringValue(result.yearly, 'indicativeCashflow'),
    yearOneOneOff: result.yearly[0]?.firstYearOpex || 0,
    carries,
    verdictClass: carries ? 'good' : 'bad'
  };
}

function governanceDecisionFor(basis, conservative) {
  if (basis.activeMeasureCount === 0 || basis.investment <= 0 || !Number.isFinite(basis.irr)) {
    return {
      status: 'nicht_entscheidungsreif',
      cls: 'neutral',
      title: 'Nicht entscheidungsreif',
      text: 'Die Datenlage reicht noch nicht für eine Ampelentscheidung. Es fehlen aktive Maßnahmen oder belastbare Cashflow-Kennzahlen.',
      recommendation: 'Maßnahmen, Kosten, Inbetriebnahme, Nutzungsdauer und Aktivierungsannahmen ergänzen, bevor eine Entscheidungstendenz genutzt wird.'
    };
  }
  if (!basis.carries) {
    return {
      status: 'nicht_tragfaehig',
      cls: 'bad',
      title: 'Nicht tragfähig im Basiscase',
      text: 'Die Maßnahme erreicht bereits unter Basisannahmen keine ausreichende wirtschaftliche Tragfähigkeit gegen die Finanzierungsschwelle.',
      recommendation: 'Zurückstellen, umplanen oder mit Pflicht-, Risiko- oder Strategiegründen außerhalb der Wirtschaftlichkeitslogik entscheiden.'
    };
  }
  if (conservative && !conservative.carries) {
    return {
      status: 'auflage',
      cls: 'warn',
      title: 'Tragfähig mit Auflage',
      text: 'Der Basiscase ist positiv, kippt jedoch ohne prüfpflichtige Wirkannahmen bzw. unter konservativer Bewertung.',
      recommendation: 'Nicht als unbedingte Freigabe lesen. Vor Beschluss sind die werttragenden Annahmen zu bestätigen, zu reduzieren oder als bewusstes Entscheidungsrisiko zu dokumentieren.'
    };
  }
  return {
    status: 'robust',
    cls: 'good',
    title: 'Robust tragfähig',
    text: 'Die Maßnahme trägt sowohl im Basiscase als auch ohne prüfpflichtige Wirkannahmen bzw. unter konservativer Bewertung.',
    recommendation: 'Zur Entscheidung geeignet; Attribution, Datenstand und regulatorische Grenzen trotzdem dokumentieren.'
  };
}

export function portfolioDecisionMetrics(result, conservativeResult = null) {
  const basis = decisionSnapshot(result);
  const conservative = conservativeResult ? decisionSnapshot(conservativeResult) : null;
  const governanceDecision = governanceDecisionFor(basis, conservative);
  const conservativeGate = conservative
    ? governanceDecision.status === 'auflage'
      ? 'auflage'
      : governanceDecision.status === 'robust'
        ? 'tragfaehig'
        : 'nicht_tragfaehig'
    : 'nicht_geprueft';
  return {
    ...basis,
    basis,
    conservative,
    conservativeGate,
    governanceDecision,
    cashflowBasis: 'IRR und Kapitalwert nutzen den indikativen Cashflow aus modellierter EOG-Wirkung abzüglich wirtschaftlicher OPEX-/Rückbau-/Reinvestitionsannahmen; keine garantierten Zahlungsströme.'
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
