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
    rulesetId: regulatoryParameterSet.id,
    rulesetConfidence: regulatoryParameterSet.confidence,
    rulesetSourceRef: regulatoryParameterSet.sourceRef,
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

export function qImpactHelper({
  metric = 'SAIDI',
  interruptionBefore = 0,
  interruptionAfter = 0,
  affectedCustomers = 0,
  monetizationPerCustomerMinute = 0,
  attribution = 100,
  evidence = ''
} = {}) {
  const normalizedMetric = String(metric || 'SAIDI').toUpperCase();
  const before = Math.max(0, finiteNumber(interruptionBefore));
  const after = Math.max(0, finiteNumber(interruptionAfter));
  const delta = Math.max(0, before - after);
  const customers = Math.max(0, finiteNumber(affectedCustomers));
  const monetization = Math.max(0, finiteNumber(monetizationPerCustomerMinute));
  const attributionShare = clamp(finiteNumber(attribution, 100), 0, 100) / 100;
  const annualImpactTeur = delta * customers * monetization * attributionShare / 1000;
  const confidence = String(evidence || '').trim() ? 'assumption' : 'review';
  return {
    metric: normalizedMetric,
    interruptionBefore: before,
    interruptionAfter: after,
    interruptionDelta: delta,
    affectedCustomers: customers,
    monetizationPerCustomerMinute: monetization,
    attribution: attributionShare,
    annualImpactTeur,
    confidence,
    chain: `${normalizedMetric}: max(0, ${before} - ${after}) Minuten × ${customers} Kunden × ${monetization} EUR/Kundenminute × ${Math.round(attributionShare * 100)} % Attribution = ${annualImpactTeur.toFixed(1)} TEUR p.a.`,
    governance: 'Q-Element-Wirkung bleibt prüfpflichtig, bis Datenbasis, Monetarisierungssatz und Attribution fachlich belegt sind.'
  };
}

const depreciationLifeDefaults = {
  station: { label: 'Station / Umspann- oder Trafotechnik', life: 30, hgbLife: 25, depr: 'normal' },
  cable: { label: 'Kabel / Leitung Strom', life: 40, hgbLife: 35, depr: 'normal' },
  gasPipe: { label: 'Gasleitung / Gasnetz', life: 35, hgbLife: 30, depr: 'kanuLinear' },
  digitalControl: { label: 'Digitalisierung / Fernwirk- und Steuertechnik', life: 10, hgbLife: 8, depr: 'normal' },
  civilWorks: { label: 'Tiefbau / bauliche Anlage', life: 45, hgbLife: 40, depr: 'normal' }
};

export function depreciationLifeHelper({ assetClass = 'station', sector = 'strom', kanuContext = false } = {}) {
  const defaults = depreciationLifeDefaults[assetClass] || depreciationLifeDefaults.station;
  const gasKanu = sector === 'gas' && (kanuContext || defaults.depr.startsWith('kanu'));
  const depr = gasKanu ? defaults.depr : 'normal';
  return {
    assetClass,
    label: defaults.label,
    life: defaults.life,
    hgbLife: defaults.hgbLife,
    depr,
    confidence: 'review',
    note: `${defaults.label}: regulatorische ND ${defaults.life} Jahre, HGB-ND ${defaults.hgbLife} Jahre als Startpunkt. Anlagenklasse, KANU-Kontext und lokale AfA-Vorgaben fachlich prüfen.`,
    governance: 'Nutzungsdauer-/AfA-Vorschläge sind Orientierung, keine automatische Freigabe.'
  };
}

export function financingSpreadHelper({
  returnMetricRate = NaN,
  financingRate = 0,
  invest = 0,
  activated = 0,
  regulatoryReturnRate = 0,
  qAndEEffectPa = 0,
  riskEffectPa = 0
} = {}) {
  const metricRate = finiteNumber(returnMetricRate, NaN);
  const financing = finiteNumber(financingRate);
  const spreadPp = Number.isFinite(metricRate) ? (metricRate - financing) * 100 : NaN;
  const activatedCapital = Math.max(0, finiteNumber(activated));
  const baseReturnSpreadTeur = activatedCapital * (finiteNumber(regulatoryReturnRate) - financing);
  const qeRiskContributionTeur = finiteNumber(qAndEEffectPa) + finiteNumber(riskEffectPa);
  const investment = Math.max(0, finiteNumber(invest));
  return {
    spreadPp,
    baseReturnSpreadTeur,
    qeRiskContributionTeur,
    qAndEEffectPa: finiteNumber(qAndEEffectPa),
    riskEffectPa: finiteNumber(riskEffectPa),
    invest: investment,
    explanation: `Spread-Treiber: regulatorischer Zinsspread ${baseReturnSpreadTeur.toFixed(1)} TEUR p.a.; Q/E + Risiko ${qeRiskContributionTeur.toFixed(1)} TEUR p.a.`,
    warning: 'IRR/MIRR-Spread ist keine Marktrendite; positive Differenzen können wesentlich aus prüfpflichtigen Q/E- und Risikoannahmen stammen.'
  };
}

const gasTransformationPathLabels = {
  continueOperation: 'Weiterbetrieb',
  shutdownOnly: 'Stilllegung ohne physischen Rückbau',
  physicalDismantling: 'Physischer Rückbau',
  reinvestment: 'Reinvestition / Erneuerung',
  h2Option: 'H2-/Umwidmungsoption',
  tolerateInGround: 'Belassen/Duldung im Boden',
  unclear: 'offen / zu klären'
};

const gasAssetScopeLabels = {
  unclear: 'Objektart offen / zu klären',
  connectionLine: 'Gasnetzanschlussleitung / Hausanschluss',
  distributionLine: 'allgemeines Gasverteilnetz',
  station: 'Station / Anlage',
  h2Candidate: 'potenzielle Wasserstoffleitung',
  other: 'sonstige Gas-Anlage'
};

export function gasTransformationHelper({
  sector = 'gas',
  path = 'unclear',
  assetScope = 'unclear',
  obligationBasis = 'unclear',
  eternityAssumption = 'unclear',
  provisionAssessment = 'unclear',
  regulatoryTreatment = 'unclear',
  plannedYear = '',
  costEstimate = 0,
  evidence = '',
  life = '',
  kanuEndYear = ''
} = {}) {
  if (sector !== 'gas') {
    return {
      applicable: false,
      summary: 'Gas-Transformationspfad ist nur für Gas-Maßnahmen aktiv; Strom bleibt unberührt.',
      hgbChecklist: [],
      regulatoryChecklist: [],
      governance: 'Keine Wirkung auf Strom-Maßnahmen.'
    };
  }
  const normalizedPath = gasTransformationPathLabels[path] ? path : 'unclear';
  const normalizedScope = gasAssetScopeLabels[assetScope] ? assetScope : 'unclear';
  const cost = Math.max(0, finiteNumber(costEstimate));
  const year = plannedYear === '' || plannedYear === null || plannedYear === undefined ? null : Math.round(finiteNumber(plannedYear));
  const usefulLife = life === '' || life === null || life === undefined ? null : Math.max(1, Math.round(finiteNumber(life)));
  const kanuHorizon = kanuEndYear === '' || kanuEndYear === null || kanuEndYear === undefined ? null : Math.round(finiteNumber(kanuEndYear));
  const lifeEndYear = year !== null && usefulLife !== null ? year + usefulLife : null;
  const eternityRemoved = eternityAssumption === 'removed';
  const obligationConcrete = obligationBasis === 'legalOrContractual' || obligationBasis === 'concession' || obligationBasis === 'customerContract';
  const dismantlingLike = normalizedPath === 'physicalDismantling' || normalizedPath === 'shutdownOnly' || normalizedPath === 'tolerateInGround';
  const lifeHorizonConflict = Boolean(eternityRemoved && lifeEndYear !== null && kanuHorizon !== null && lifeEndYear > kanuHorizon);
  const shouldCheckProvision = provisionAssessment === 'checkProvision' || (eternityRemoved && dismantlingLike && (obligationConcrete || cost > 0));
  const confidence = 'review';
  const recommendedQuestion = lifeHorizonConflict
    ? 'Nutzungsdauer-Entscheid erforderlich'
    : shouldCheckProvision
      ? 'Rückstellung prüfen'
      : normalizedPath === 'h2Option'
        ? 'H2-/KANU-Ausnahme prüfen'
        : 'Klärpunkt dokumentieren';
  return {
    applicable: true,
    path: normalizedPath,
    pathLabel: gasTransformationPathLabels[normalizedPath],
    assetScope: normalizedScope,
    assetScopeLabel: gasAssetScopeLabels[normalizedScope],
    obligationBasis,
    eternityAssumption,
    provisionAssessment,
    regulatoryTreatment,
    plannedYear: year,
    costEstimate: cost,
    life: usefulLife,
    lifeEndYear,
    kanuEndYear: kanuHorizon,
    lifeHorizonConflict: {
      conflict: lifeHorizonConflict,
      lifeYears: usefulLife,
      lifeEndYear,
      kanuEndYear: kanuHorizon,
      reason: lifeHorizonConflict
        ? `Nutzungsdauer ${usefulLife} Jahre bis ${lifeEndYear} kollidiert mit Wegfall der Ewigkeitsvermutung und KANU-/Transformationshorizont ${kanuHorizon}.`
        : ''
    },
    evidence: String(evidence || '').trim(),
    confidence,
    recommendedQuestion,
    summary: `${gasTransformationPathLabels[normalizedPath]} · ${gasAssetScopeLabels[normalizedScope]} · ${recommendedQuestion}`,
    hgbChecklist: [
      ...(lifeHorizonConflict ? [
        `Nutzerentscheid erforderlich: Nutzungsdauer ${usefulLife} Jahre (${year} bis ${lifeEndYear}) gegen KANU-/Transformationshorizont ${kanuHorizon}, kommunale Wärmeplanung und Wegfall der Ewigkeitsvermutung spiegeln.`,
        'Entscheidungsoption dokumentieren: Nutzungsdauer verkürzen, H2-/Umwidmungsoption belegen, dauerhaften Weiterbetrieb ausdrücklich begründen oder Widerspruch als Klärpunkt führen.'
      ] : []),
      'Wegfall der Ewigkeitsvermutung als Option dokumentieren: dauerhafter Weiterbetrieb nicht ungeprüft unterstellen.',
      'konkrete Verpflichtung prüfen: gesetzlich, vertraglich, Konzession, Kunden-/Anschlussverhältnis oder faktische Verpflichtung.',
      'Stilllegungskosten und physische Rückbaukosten getrennt schätzen und zeitlich einordnen.',
      'Kostenhöhe, Erfüllungszeitpunkt und Wahrscheinlichkeit als Rückstellungs-Voraussetzungen belegen.'
    ],
    regulatoryChecklist: [
      'Regulatorische Behandlung als KAnEu, Ist-Kosten oder ungeklärte Kostenposition nur als prüfpflichtige Herleitung führen.',
      'BRÜCKEN-/NEST-/Ruleset-Stand, Quelle und Konfidenz für Stilllegung, Rückbau und Rückstellungen dokumentieren.',
      'Auswirkung auf Erlösobergrenzen, Netzentgelte und Kostenpfad nicht als Anerkennungszusage darstellen.',
      'H2-/KANU-Ausnahmeabgrenzung separat prüfen, wenn Umwidmung oder potenzielle Wasserstoffleitung betroffen ist.'
    ],
    governance: lifeHorizonConflict
      ? `Nutzerentscheid erforderlich: Die App trifft keine Entscheidung, ob ${usefulLife} Jahre Nutzungsdauer bis ${lifeEndYear} fachlich vertretbar sind. Nutzungsdauer, KANU-/Transformationshorizont, kommunale Wärmeplanung und Wegfall der Ewigkeitsvermutung müssen vor Nutzung der Kennzahlen bewusst freigegeben oder als Klärpunkt geführt werden.`
      : 'Der Gas-Transformationspfad strukturiert prüfpflichtige Herleitungen; er trifft keine automatische Entscheidung zu Rückstellung, Rückbaupflicht oder regulatorischer Anerkennung.'
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

export function gasTransformationInputForMeasure(measure = {}, p = {}) {
  return {
    sector: p.sector || 'gas',
    path: measure.gasTransformationPath || 'unclear',
    assetScope: measure.gasAssetScope || 'unclear',
    obligationBasis: measure.gasObligationBasis || 'unclear',
    eternityAssumption: measure.gasEternityAssumption || 'unclear',
    provisionAssessment: measure.gasProvisionAssessment || 'unclear',
    regulatoryTreatment: measure.gasRegulatoryTreatment || 'unclear',
    plannedYear: measure.decommissionYear || measure.year || '',
    costEstimate: measure.decommissionCost || 0,
    evidence: measure.gasTransformationEvidence || '',
    life: measure.life || '',
    kanuEndYear: p.kanuEndYear || ''
  };
}

export function gasTransformationWarningsFor(measure, p) {
  if (p.sector !== 'gas' || !measure?.active) return [];
  const helper = gasTransformationHelper(gasTransformationInputForMeasure(measure, p));
  if (!helper.applicable) return [];
  const needsReview = helper.recommendedQuestion !== 'Klärpunkt dokumentieren'
    || helper.path !== 'unclear'
    || helper.eternityAssumption === 'removed'
    || helper.regulatoryTreatment !== 'unclear';
  if (!needsReview) return [];
  const baseWarning = {
    type: helper.lifeHorizonConflict?.conflict ? 'gas_life_horizon_conflict' : 'gas_transformation_review',
    key: helper.lifeHorizonConflict?.conflict ? `gas-life-horizon:${measure.id}` : `gas-transformation:${measure.id}`,
    area: 'Gas-Transformationspfad',
    targetPhase: 'massnahmenbewertung',
    measureId: measure.id,
    measure: measure.name || 'Maßnahme',
    title: helper.recommendedQuestion,
    detail: `${helper.summary}. ${helper.lifeHorizonConflict?.reason ? helper.lifeHorizonConflict.reason + ' ' : ''}${helper.governance}`
  };
  return [baseWarning];
}

const flexibilityStatusLabels = {
  context: 'Kontextobjekt',
  pruefpflichtig: 'prüfpflichtig',
  quantified: 'quantifiziert, nicht rechenwirksam',
  active: 'aktiv rechenwirksam'
};

function isStromFlexibilityMeasure(measure = {}, p = {}) {
  return p.sector === 'strom' && measure.effectType === 'flexibility';
}

function normalizedFlexibilityStatus(value) {
  return flexibilityStatusLabels[value] ? value : 'context';
}

export function flexibilityHelper(measure = {}, p = {}) {
  if (p.sector !== 'strom') {
    return {
      applicable: false,
      summary: 'Flexibilitäts-/Netzfahrplan-Logik ist nur für Strom aktiv; Gas-Transformationspfad bleibt getrennt.',
      warnings: [],
      governance: 'Keine Wirkung auf Gas-Maßnahmen.'
    };
  }
  if (measure.effectType !== 'flexibility') {
    return {
      applicable: false,
      summary: 'Keine Flexibilitätsobjektklasse gesetzt.',
      warnings: [],
      governance: 'Klassische CAPEX-Maßnahme bleibt unverändert.'
    };
  }
  const status = normalizedFlexibilityStatus(measure.flexibilityStatus);
  const scheduleRequired = measure.networkScheduleRequired !== false;
  const scheduleStatus = measure.networkScheduleStatus || 'missing';
  const hasValidatedSchedule = !scheduleRequired || scheduleStatus === 'validated';
  const avoidedCapex = Math.max(0, finiteNumber(measure.avoidedCapexTeur));
  const deferredCapex = Math.max(0, finiteNumber(measure.deferredCapexTeur));
  const flexOpex = Math.max(0, finiteNumber(measure.flexOpexPaTeur));
  const duration = Math.max(0, Math.round(finiteNumber(measure.flexOpexDurationYears)));
  const agnesRelevant = Boolean(measure.agnesRelevant);
  const active = status === 'active' && hasValidatedSchedule && (avoidedCapex > 0 || deferredCapex > 0 || flexOpex > 0);
  const warnings = [];
  if (scheduleRequired && scheduleStatus !== 'validated') warnings.push('Flexibilitätswirkung nicht rechenwirksam: Netzfahrplan fehlt oder ist nicht validiert.');
  if ((status === 'active' || status === 'quantified') && avoidedCapex <= 0 && deferredCapex <= 0) warnings.push('Vermiedene oder verschobene CAPEX sind nicht belastbar quantifiziert.');
  if ((status === 'active' || status === 'quantified') && flexOpex <= 0) warnings.push('Jährliche Flex-OPEX sind nicht belastbar quantifiziert.');
  if (agnesRelevant && (!measure.agnesIntegrationStatus || measure.agnesIntegrationStatus === 'not_assessed')) warnings.push('AGNeS-Bezug prüfpflichtig: Steuerungs-, Abruf-, Prognose- oder Nachweislogik ist zu klären.');
  const discount = 1 + finiteNumber(p.discountRate);
  const deferredFromOffset = Math.max(0, Math.round(finiteNumber(measure.deferredCapexFromYear, p.baseYear)) - p.baseYear);
  const netPresentValueTeur = active
    ? avoidedCapex + deferredCapex / Math.pow(discount, deferredFromOffset) - (duration || p.horizon) * flexOpex / Math.pow(discount, 1)
    : 0;
  return {
    applicable: true,
    effectType: 'flexibility',
    status,
    statusLabel: flexibilityStatusLabels[status],
    useCase: measure.flexibilityUseCase || 'netzfahrplan',
    regulatoryTreatment: measure.regulatoryTreatment || 'unknown',
    networkScheduleRequired: scheduleRequired,
    networkScheduleStatus: scheduleStatus,
    networkConstraintRef: String(measure.networkConstraintRef || ''),
    affectedNetworkLevel: String(measure.affectedNetworkLevel || ''),
    activationWindow: String(measure.activationWindow || ''),
    dispatchLogic: String(measure.dispatchLogic || ''),
    avoidedCapexTeur: avoidedCapex,
    avoidedCapexConfidence: measure.avoidedCapexConfidence || 'none',
    deferredCapexTeur: deferredCapex,
    deferredCapexFromYear: finiteNumber(measure.deferredCapexFromYear, null),
    deferredCapexToYear: finiteNumber(measure.deferredCapexToYear, null),
    flexOpexPaTeur: flexOpex,
    flexOpexStartYear: finiteNumber(measure.flexOpexStartYear, p.baseYear),
    flexOpexDurationYears: duration,
    opexRecognitionStatus: measure.opexRecognitionStatus || 'unknown',
    agnesRelevant,
    agnesRole: measure.agnesRole || 'offen',
    agnesIntegrationStatus: measure.agnesIntegrationStatus || 'not_assessed',
    agnesDataNeeded: Array.isArray(measure.agnesDataNeeded) ? measure.agnesDataNeeded : [],
    active,
    netPresentValueTeur,
    warnings,
    summary: `Flexibilität / Netzfahrplan · ${flexibilityStatusLabels[status]} · ${agnesRelevant ? 'AGNeS-Bezug prüfpflichtig' : 'AGNeS nicht gesetzt'}`,
    governance: 'Flexibilitätsobjekte sind keine klassische CAPEX-Maßnahme. Sie strukturieren OPEX-gegen-CAPEX-Substitution; Ergebniswirkung erst bei validiertem Netzfahrplan, quantifizierter CAPEX-Vermeidung und Flex-OPEX.'
  };
}

export function flexibilityWarningsFor(measure, p) {
  if (!measure?.active || !isStromFlexibilityMeasure(measure, p)) return [];
  const helper = flexibilityHelper(measure, p);
  if (!helper.applicable || (!helper.warnings.length && helper.status === 'active')) return [];
  return [{
    type: 'strom_flexibility_review',
    key: `strom-flexibility:${measure.id}`,
    area: 'Flexibilität / Netzfahrplan',
    targetPhase: 'massnahmenbewertung',
    measureId: measure.id,
    measure: measure.name || 'Maßnahme',
    title: helper.active ? 'Flexibilitätswirkung aktiv, Herleitung prüfen' : 'Flexibilitätswirkung nicht rechenwirksam',
    detail: `${helper.summary}. ${helper.warnings.join(' ')} ${helper.governance}`
  }];
}

function flexibilityRowsForMeasure(measure, p) {
  const helper = flexibilityHelper(measure, p);
  const rows = Array.from({ length: p.horizon }, (_, i) => ({
    year: p.baseYear + i,
    flexibilityAvoidedCapexEffect: 0,
    flexibilityDeferredCapexEffect: 0,
    flexibilityOpexEffect: 0,
    flexibilityNetEffect: 0
  }));
  if (!helper.active) return { helper, rows };
  const startYear = Math.round(finiteNumber(measure.flexOpexStartYear, p.baseYear));
  const duration = helper.flexOpexDurationYears || p.horizon;
  rows.forEach(row => {
    if (row.year === p.baseYear) row.flexibilityAvoidedCapexEffect = helper.avoidedCapexTeur;
    if (helper.deferredCapexTeur > 0 && row.year === Math.round(finiteNumber(measure.deferredCapexFromYear, p.baseYear))) row.flexibilityDeferredCapexEffect += helper.deferredCapexTeur;
    if (helper.deferredCapexTeur > 0 && row.year === Math.round(finiteNumber(measure.deferredCapexToYear, p.baseYear))) row.flexibilityDeferredCapexEffect -= helper.deferredCapexTeur;
    if (row.year >= startYear && row.year < startYear + duration) row.flexibilityOpexEffect = -helper.flexOpexPaTeur;
    row.flexibilityNetEffect = row.flexibilityAvoidedCapexEffect + row.flexibilityDeferredCapexEffect + row.flexibilityOpexEffect;
  });
  return { helper, rows };
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

/** @returns {any} */
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

  if (isStromFlexibilityMeasure(measure, p)) {
    const { helper, rows: flexibilityRows } = flexibilityRowsForMeasure(measure, p);
    const flexRows = flexibilityRows.map(row => ({
      year: row.year,
      depreciation: 0,
      capitalReturn: 0,
      eligibleCapital: 0,
      regulatoryCapexEffect: 0,
      reinvestDepreciation: 0,
      reinvestCapitalReturn: 0,
      reinvestAssetEffect: 0,
      reinvestmentTreatment: 'none',
      qAndE: 0,
      opex: row.flexibilityOpexEffect,
      economicOpex: row.flexibilityOpexEffect,
      firstYearOpex: 0,
      regulatoryEogEffect: 0,
      indicativeCashflow: row.flexibilityNetEffect,
      risk: 0,
      opexRisk: 0,
      reinvestDecommission: 0,
      hgbDepreciation: 0,
      ebit: row.flexibilityNetEffect,
      bridge: 0,
      eog: 0,
      flexibilityAvoidedCapexEffect: row.flexibilityAvoidedCapexEffect,
      flexibilityDeferredCapexEffect: row.flexibilityDeferredCapexEffect,
      flexibilityOpexEffect: row.flexibilityOpexEffect,
      flexibilityNetEffect: row.flexibilityNetEffect
    }));
    const flows = [0, ...flexRows.map(row => row.indicativeCashflow)];
    const returnMetric = returnMetricFor(flows);
    return {
      measure,
      activated: 0,
      activeShare: 0,
      rows: flexRows,
      returnMetric,
      rateMetricLabel: returnMetric.label,
      irr: returnMetric.value,
      npv: npv(p.discountRate, flows),
      impactSummary: { qAndE: 0, risk: 0, included: [], sensitivity: [] },
      totex: { nominal: helper.flexOpexPaTeur * (helper.flexOpexDurationYears || p.horizon), discounted: 0 },
      riskReductionPa: 0,
      flexibility: helper
    };
  }

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
    const eog = regulatoryEogEffect;
    const hgbDepreciation = year >= start && year < start + hgbLife
      ? Math.min(active.activated / hgbLife, active.activated)
      : 0;
    const ebit = eog + economicOpex - hgbDepreciation;
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

export function measureDrilldownFor(measure, p, portfolioEffectPa = portfolioEffectFor(measure, p)) {
  const result = calcMeasure(measure, p, portfolioEffectPa);
  const firstRow = result.rows[0] || {};
  const followRow = result.rows[1] || firstRow || {};
  const active = expectedActivated(measure);
  const returnLabel = result.rateMetricLabel || result.returnMetric?.label || 'IRR';
  return {
    measureId: measure.id || '',
    measureName: measure.name || 'Maßnahme',
    capexTeur: finiteNumber(measure.cost),
    activatedTeur: result.activated,
    activeSharePct: active.share * 100,
    startYear: Math.round(finiteNumber(measure.year, p.baseYear)),
    depreciationMode: p.sector === 'strom' ? 'linear' : (measure.depr || 'normal'),
    usefulLifeYears: finiteNumber(measure.life),
    hgbLifeYears: finiteNumber(measure.hgbLife, measure.life),
    returnMetricLabel: returnLabel,
    returnMetricValue: result.irr,
    npvTeur: result.npv,
    steps: [
      { key: 'capex', label: 'CAPEX', valueTeur: finiteNumber(measure.cost), note: 'Ausgangsinvestition der Maßnahme.' },
      { key: 'activation', label: 'Aktivierte Basis', valueTeur: result.activated, note: `Aktivierungsanteil ${Math.round(active.share * 1000) / 10} % aus sicherem und erwarteten unsicheren Anteil.` },
      { key: 'depreciation', label: 'AfA/KANU regulatorisch', valueTeur: firstRow.depreciation || 0, note: `Startjahr ${firstRow.year || p.baseYear}; Modus ${p.sector === 'strom' ? 'linear' : (measure.depr || 'normal')}.` },
      { key: 'capital_return', label: 'Verzinsung', valueTeur: firstRow.capitalReturn || 0, note: 'Kalkulatorische Verzinsung auf durchschnittlich gebundene Kapitalbasis.' },
      { key: 'regulatory_eog', label: 'regulatorische EOG-Wirkung', valueTeur: firstRow.regulatoryEogEffect || 0, note: 'Summe aus AfA/KANU, Verzinsung, Reinvest-Asset, Q/E, Risiko und Einmal-OPEX.' },
      { key: 'cashflow', label: 'indikative Cashflow-Basis', valueTeur: firstRow.indicativeCashflow || 0, note: 'Regulatorische EOG-Wirkung plus wirtschaftliche OPEX-/Rückbau-/Reinvest-Brücke.' },
      { key: 'return_metric', label: returnLabel, valuePct: Number.isFinite(result.irr) ? result.irr * 100 : null, valueTeur: result.npv, note: `${returnLabel} und Kapitalwert nutzen die indikative Cashflow-Basis; kein garantierter EOG-Cashflow.` }
    ],
    rows: [firstRow, followRow].filter(Boolean).map(row => ({
      year: row.year,
      depreciation: row.depreciation || 0,
      capitalReturn: row.capitalReturn || 0,
      reinvestAssetEffect: row.reinvestAssetEffect || 0,
      qAndE: row.qAndE || 0,
      risk: row.risk || 0,
      firstYearOpex: row.firstYearOpex || 0,
      regulatoryEogEffect: row.regulatoryEogEffect || 0,
      economicBridge: (row.economicOpex || 0) + (row.reinvestDecommission || 0),
      indicativeCashflow: row.indicativeCashflow || 0
    }))
  };
}

export function portfolioWaterfallFor(result) {
  const first = result.yearly?.[0] || {};
  const follow = result.yearly?.[1] || first || {};
  const baseEog = result.p?.baseEog || 0;
  const yearOneEog = first.regulatoryEogEffect || 0;
  const followEog = follow.regulatoryEogEffect || 0;
  const economicBridge = (follow.economicOpex || 0) + (follow.reinvestDecommission || 0);
  const ratio = baseEog ? yearOneEog / baseEog * 100 : 0;
  return {
    baseEogTeur: baseEog,
    baseToYearOneRatioPct: ratio,
    startYear: first.year || result.p?.baseYear,
    followYear: follow.year || ((first.year || result.p?.baseYear || 0) + 1),
    yearOne: {
      regulatoryEogEffect: yearOneEog,
      indicativeCashflow: first.indicativeCashflow || 0,
      economicBridge: (first.economicOpex || 0) + (first.reinvestDecommission || 0)
    },
    firstFollowYear: {
      regulatoryEogEffect: followEog,
      indicativeCashflow: follow.indicativeCashflow || 0,
      economicBridge
    },
    baseEogWaterfall: [
      { key: 'base_eog', label: 'Basis-EOG', valueTeur: baseEog, cumulativeTeur: baseEog },
      { key: 'measure_effect', label: 'Maßnahmenwirkung Startjahr', valueTeur: yearOneEog, cumulativeTeur: baseEog + yearOneEog }
    ],
    cashflowBridge: [
      { key: 'regulatory_eog', label: 'EOG-Wirkung erstes Folgejahr', valueTeur: followEog },
      { key: 'economic_bridge', label: 'wirtschaftliche Brücke', valueTeur: economicBridge },
      { key: 'indicative_cashflow', label: 'indikative Cashflow-Basis', valueTeur: follow.indicativeCashflow || 0 }
    ]
  };
}

function cloneForSensitivity(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function scaleMeasureField(model, field, factor) {
  const copy = cloneForSensitivity(model);
  copy.measures = (copy.measures || []).map(measure => ({
    ...measure,
    [field]: Math.max(0, finiteNumber(measure[field]) * factor)
  }));
  return copy;
}

function scaleLife(model, factor) {
  const copy = cloneForSensitivity(model);
  copy.measures = (copy.measures || []).map(measure => ({
    ...measure,
    life: Math.max(1, Math.round(finiteNumber(measure.life, 1) * factor)),
    hgbLife: Math.max(1, Math.round(finiteNumber(measure.hgbLife, measure.life || 1) * factor))
  }));
  return copy;
}

export function portfolioSensitivityTornadoFor(model, p) {
  const base = calcPortfolio(model, p);
  const metricFor = (variantModel, variantParams) => {
    const result = calcPortfolio(variantModel || model, variantParams || p);
    return { npv: result.npv, irr: result.irr, deltaNpv: result.npv - base.npv, deltaIrr: result.irr - base.irr };
  };
  const drivers = [
    {
      key: 'riskAvoided',
      label: 'RiskAvoided ±25 %',
      low: metricFor(scaleMeasureField(model, 'riskAvoided', 0.75), p),
      high: metricFor(scaleMeasureField(model, 'riskAvoided', 1.25), p)
    },
    {
      key: 'returnRate',
      label: 'Regulatorische Verzinsung ±1 pp',
      low: metricFor(model, { ...p, returnRate: Math.max(0, p.returnRate - 0.01) }),
      high: metricFor(model, { ...p, returnRate: p.returnRate + 0.01 })
    },
    {
      key: 'financingRate',
      label: 'FK-Zins ±1 pp',
      low: metricFor(model, { ...p, financingRate: Math.max(0, p.financingRate - 0.01) }),
      high: metricFor(model, { ...p, financingRate: p.financingRate + 0.01 })
    },
    {
      key: 'usefulLife',
      label: 'Nutzungsdauer ±20 %',
      low: metricFor(scaleLife(model, 0.8), p),
      high: metricFor(scaleLife(model, 1.2), p)
    },
    {
      key: 'kanuEndYear',
      label: p.sector === 'gas' ? 'KANU-Endjahr ±5 Jahre' : 'Transformations-/Horizontjahr ±5 Jahre',
      low: metricFor(model, { ...p, kanuEndYear: p.kanuEndYear - 5 }),
      high: metricFor(model, { ...p, kanuEndYear: p.kanuEndYear + 5 })
    }
  ].map(driver => ({
    ...driver,
    lowDeltaNpv: driver.low.deltaNpv,
    highDeltaNpv: driver.high.deltaNpv,
    swingTeur: Math.abs(driver.high.deltaNpv - driver.low.deltaNpv)
  })).sort((a, b) => b.swingTeur - a.swingTeur);
  return {
    base: { npv: base.npv, irr: base.irr, rateMetricLabel: base.rateMetricLabel || 'IRR' },
    drivers,
    caveat: 'Sensitivitäten sind rechnerische Arbeitsvarianten. Sie ersetzen keine fachliche Parametrisierung des konservativen Szenarios.'
  };
}

export function portfolioEffectFor(measure, p) {
  const globalEffect = p.baseEog * (p.qDelta + p.eDelta) * p.attribution;
  return globalEffect * clamp(finiteNumber(measure.portfolioShare), 0, 100) / 100;
}


const stromPortfolioClasses = {
  core_portfolio: 'corePortfolio',
  scope_candidate: 'scopeCandidate',
  option_sensitive: 'optionSensitive',
  context_only: 'contextObject',
  flexibility: 'flexibilityObject',
  excluded: 'excluded'
};

function normalizedPortfolioClassification(measure = {}) {
  const importStatus = String(measure.importStatus || '').toLowerCase();
  const decisionStatus = String(measure.investmentDecisionStatus || '').toLowerCase();
  const reportingStatus = String(measure.reportingStatus || '').toLowerCase();
  const orgUnit = String(measure.orgUnit || '').toLowerCase();
  const type = String(measure.type || '').toLowerCase();
  const raw = String(measure.portfolioClassification || measure.portfolioClass || measure.strategyType || '').trim();

  if (measure.effectType === 'flexibility' || importStatus === 'flexibility_review') return 'flexibility';
  if (importStatus === 'context_only' || importStatus === 'context' || type === 'context_only') return 'context_only';
  if (measure.active === false) return 'excluded';
  if (
    importStatus.includes('strategic_scope_candidate')
    || importStatus.includes('scope_candidate')
    || decisionStatus.includes('scope-kandidat')
    || decisionStatus.includes('scope kandidat')
    || reportingStatus.includes('strategischer arbeitsstand')
    || orgUnit.includes('zielnetzplanung')
    || orgUnit.includes('strategische infrastruktur')
    || type === 'scope_candidate'
    || measure.importStatus === 'unconfirmed'
  ) return 'scope_candidate';
  if (type === 'option_sensitive' || type === 'wahl' || importStatus.includes('option') || importStatus.includes('sensitivity')) return 'option_sensitive';
  if (stromPortfolioClasses[raw]) return raw;
  return 'core_portfolio';
}

function emptySegmentationBucket() {
  return { count: 0, invest: 0, npv: 0, yearOneRegulatoryEog: 0, recurringRegulatoryEog: 0 };
}

function emptySegmentation() {
  return {
    corePortfolio: emptySegmentationBucket(),
    scopeCandidate: emptySegmentationBucket(),
    optionSensitive: emptySegmentationBucket(),
    contextObject: emptySegmentationBucket(),
    flexibilityObject: emptySegmentationBucket(),
    excluded: emptySegmentationBucket(),
    mappingNote: 'Segmentierung basiert auf importStatus, investmentDecisionStatus, reportingStatus, effectType und orgUnit; Statusfelder haben Vorrang vor Kostenhöhe oder bloßer Aktivität.'
  };
}

export function portfolioSegmentationFor(results = [], p = {}, allMeasures = []) {
  const buckets = emptySegmentation();
  const seen = new Set();
  results.forEach(result => {
    const measure = result.measure || {};
    const id = String(measure.id || '');
    if (id) seen.add(id);
    const key = stromPortfolioClasses[normalizedPortfolioClassification(measure)] || 'corePortfolio';
    const bucket = buckets[key];
    bucket.count += 1;
    bucket.invest += isStromFlexibilityMeasure(measure, p) ? 0 : finiteNumber(measure.cost);
    bucket.npv += Number.isFinite(result.npv) ? result.npv : 0;
    bucket.yearOneRegulatoryEog += result.rows?.[0]?.regulatoryEogEffect || 0;
    bucket.recurringRegulatoryEog += recurringValue(result.rows || [], 'regulatoryEogEffect');
  });
  allMeasures.forEach(measure => {
    const id = String(measure?.id || '');
    if (id && seen.has(id)) return;
    const key = stromPortfolioClasses[normalizedPortfolioClassification(measure)] || 'corePortfolio';
    if (!['contextObject', 'flexibilityObject', 'excluded', 'scopeCandidate', 'optionSensitive'].includes(key)) return;
    const bucket = buckets[key];
    bucket.count += 1;
    bucket.invest += isStromFlexibilityMeasure(measure, p) ? 0 : finiteNumber(measure.cost);
  });
  return buckets;
}

function hasRiskEvidence(measure = {}) {
  const status = measure.riskEvidenceStatus || measure.riskAvoidedEvidenceStatus || '';
  return ['documented', 'estimated', 'benannt', 'source_available', 'validated'].includes(status) || (Array.isArray(measure.impactAssumptions) && measure.impactAssumptions.some(impact => impact.area === 'risk' && (impact.evidence || impact.evidenceType !== 'open')));
}

function hasSystemReference(measure = {}) {
  return Boolean(
    String(measure.sourceSystem || '').trim()
    && (String(measure.sourceRecordId || '').trim() || String(measure.externalId || '').trim())
  );
}

function hasRiskMapping(measure = {}) {
  if (finiteNumber(measure.riskAvoided) <= 0) return true;
  const status = String(measure.riskEvidenceStatus || measure.riskAvoidedEvidenceStatus || '').trim();
  const meaningfulStatus = status && !['missing', 'not_assessed', 'open', 'offen'].includes(status);
  return Boolean(
    String(measure.riskDbRef || '').trim()
    || meaningfulStatus
    || Array.isArray(measure.impactAssumptions) && measure.impactAssumptions.some(impact => impact.area === 'risk' && (impact.evidence || impact.chain || impact.riskImpact))
  );
}

function usefulLifeRangeFor(assetType = '') {
  const type = String(assetType || '').toLowerCase();
  if (['digitalization', 'control', 'communication', 'it'].includes(type)) return [3, 15];
  if (['transformer', 'substation'].includes(type)) return [20, 45];
  if (['cable', 'line', 'civil_works'].includes(type)) return [25, 60];
  return [1, 60];
}

function inferredStromAssetType(measure = {}) {
  const explicit = String(measure.assetType || measure.measureAssetType || '').trim();
  if (explicit) return explicit;
  const text = [measure.name, measure.type, measure.monitoringCategory, measure.tags?.join(' ')].filter(Boolean).join(' ').toLowerCase();
  if (/digital|it|software|kommunikation|communication|steuer|control|fernwirk|leittechnik|netzleitsystem|messtechnik|smart|imsys|smgw|cls/.test(text)) return 'communication';
  if (/trafo|transformator|station|umspann/.test(text)) return 'transformer';
  if (/kabel|leitung|trasse|tiefbau/.test(text)) return 'cable';
  return '';
}

function stromMeasurePlausibilityWarningsFor(measure = {}, p = {}) {
  if (p.sector !== 'strom' || !measure.active || isStromFlexibilityMeasure(measure, p)) return [];
  const warnings = [];
  const risk = finiteNumber(measure.riskAvoided);
  if (risk > 0 && !hasRiskEvidence(measure)) {
    warnings.push({ type: 'risk_avoidance_evidence_missing', key: `risk-evidence:${measure.id}`, area: 'RiskAvoided-Evidenz', targetPhase: 'massnahmenbewertung', measureId: measure.id, measure: measure.name || 'Maßnahme', title: 'RiskAvoided-Herleitung offen', detail: 'Risikovermeidungswerte werden weiter gerechnet, sind aber ohne Evidenzstatus/Wirkungskette als prüfpflichtiger Werttreiber zu lesen.' });
  }
  if (risk > Math.max(0.000001, finiteNumber(measure.cost))) {
    warnings.push({ type: 'risk_avoidance_outlier_review', key: `risk-outlier:${measure.id}`, area: 'RiskAvoided-Evidenz', targetPhase: 'massnahmenbewertung', measureId: measure.id, measure: measure.name || 'Maßnahme', title: 'RiskAvoided-Ausreißer prüfen', detail: 'Der jährliche Risikovermeidungswert liegt über der Investition; bitte Methode, Zeitraum und Evidenz prüfen.' });
  }
  const inferredAssetType = inferredStromAssetType(measure);
  const [minLife, maxLife] = usefulLifeRangeFor(inferredAssetType);
  const life = finiteNumber(measure.life);
  const lifeStatus = measure.usefulLifeEvidenceStatus || 'not_assessed';
  const missingExplicitAssetType = inferredAssetType && !(measure.assetType || measure.measureAssetType);
  if (inferredAssetType && (missingExplicitAssetType || life < minLife || life > maxLife || ['default', 'not_assessed'].includes(lifeStatus))) {
    warnings.push({ type: 'useful_life_plausibility_review', key: `useful-life:${measure.id}`, area: 'Nutzungsdauer-Plausibilisierung', targetPhase: 'massnahmenbewertung', measureId: measure.id, measure: measure.name || 'Maßnahme', title: 'Nutzungsdauer nach Maßnahmentyp prüfen', detail: `Die angesetzte Nutzungsdauer (${life || 0} Jahre) ist für ${inferredAssetType} prüfpflichtig; assetType-Mapping, technische/wirtschaftliche Nutzungsdauer und Reinvestitionszyklen prüfen.` });
  }
  return warnings;
}

function repeatedValueCount(measures, key) {
  const counts = new Map();
  measures.forEach(measure => counts.set(measure[key], (counts.get(measure[key]) || 0) + 1));
  return Math.max(0, ...counts.values());
}

function stromPortfolioPlausibilityWarningsFor(activeMeasures = [], p = {}, results = []) {
  if (p.sector !== 'strom') return [];
  const classic = activeMeasures.filter(measure => !isStromFlexibilityMeasure(measure, p));
  const warnings = [];
  if (classic.length >= 3 && (p.rulesetConfidence !== 'enacted' || regulatoryParameterSet.confidence !== 'enacted')) {
    warnings.push({ type: 'strom_regulatory_framework_review', key: 'strom-regulatory-framework-review', area: 'Regulatorischer Sensitivitätsrahmen Strom / NEST', targetPhase: 'konsolidierung', title: 'Regulatorischer Sensitivitätsrahmen offen', detail: 'Der regulatorische Parameterstand ist prüfpflichtig; mögliche Auswirkungen von NEST/Reformrahmen auf CAPEX-/OPEX-Behandlung, Flexibilitätslogik und EOG-Wirkung als Sensitivität nachführen.' });
  }
  if (classic.length >= 3 && (repeatedValueCount(classic, 'secure') >= 3 || repeatedValueCount(classic, 'probability') >= 3 || repeatedValueCount(classic, 'life') >= 3)) {
    warnings.push({ type: 'strom_default_assumptions_review', key: 'strom-default-assumptions-review', area: 'Defaultannahmen', targetPhase: 'massnahmenbewertung', title: 'Defaultannahmen erkannt', detail: 'Mehrere Maßnahmen verwenden identische Aktivierungsquoten, Wahrscheinlichkeiten oder Nutzungsdauern. Bitte prüfen, ob echte Einzelbewertungen oder Import-/Modell-Defaults vorliegen.' });
  }
  const noRegretCount = classic.filter(measure => ['noRegret', 'no_regret_working_assumption', 'no_regret_confirmed'].includes(measure.type)).length;
  if (classic.length >= 3 && noRegretCount / classic.length >= 0.8) {
    warnings.push({ type: 'no_regret_overuse_review', key: 'no-regret-overuse-review', area: 'No-Regret-Klassifikation', targetPhase: 'massnahmenbewertung', title: 'No-Regret-Kategorie überdehnt', detail: 'Die No-Regret-Kategorie ist derzeit nicht ausreichend differenzierend. Pflichtmaßnahmen, Kernportfolio, Scope-Kandidaten und Optionen getrennt klassifizieren.' });
  }
  const segmentation = portfolioSegmentationFor(results, p);
  if (segmentation.scopeCandidate.count > 0) {
    warnings.push({ type: 'scope_candidate_separation_review', key: 'scope-candidate-separation-review', area: 'Kernportfolio vs. Scope-Kandidaten', targetPhase: 'konsolidierung', title: 'Scope-Kandidaten getrennt betrachten', detail: `Das Gesamtergebnis enthält ${segmentation.scopeCandidate.count} aktive Scope-Kandidaten; Kernportfolio und Optionen getrennt ausweisen.` });
  }
  return warnings;
}

function hasMeasureTargetAssignment(measure = {}) {
  return Array.isArray(measure.objectiveIds) && measure.objectiveIds.filter(Boolean).length > 0;
}

function isNoRegretType(measure = {}) {
  return ['noRegret', 'no_regret_working_assumption', 'no_regret_confirmed'].includes(measure.type);
}

function isOpenClassification(measure = {}) {
  const classification = String(measure.portfolioClassification || measure.investmentDecisionStatus || measure.reportingStatus || '').toLowerCase();
  return !classification || /offen|prüf|pruef|arbeitsstand|geplant|candidate|kandidat/.test(classification);
}

function sidecarReliabilitySummary(sidecar = {}) {
  const objects = Array.isArray(sidecar.objects) ? sidecar.objects : [];
  const weakEvidence = objects.filter(object => ['missing', 'stated', 'conflicting', 'stale'].includes(object.evidenceStatus || 'missing')).length;
  const openQuestions = objects.reduce((sum, object) => sum + (Array.isArray(object.openQuestions) ? object.openQuestions.length : 0), 0);
  const dataQualityOpen = objects.filter(object => object.type === 'data_quality' && object.status !== 'archived' && object.evidenceStatus !== 'validated').length;
  return { total: objects.length, weakEvidence, openQuestions, dataQualityOpen };
}

export function workstandReliabilityFor(model = {}, result = null) {
  const activeMeasures = Array.isArray(result?.activeMeasures)
    ? result.activeMeasures
    : (Array.isArray(model?.measures) ? model.measures.filter(measure => measure.active) : []);
  const classicMeasures = activeMeasures.filter(measure => !(result?.p && isStromFlexibilityMeasure(measure, result.p)));
  const riskMeasures = classicMeasures.filter(measure => finiteNumber(measure.riskAvoided) > 0);
  const riskMissingEvidence = riskMeasures.filter(measure => !hasRiskEvidence(measure));
  const withoutTargets = activeMeasures.filter(measure => !hasMeasureTargetAssignment(measure));
  const noRegretMeasures = classicMeasures.filter(isNoRegretType);
  const noRegretOpen = noRegretMeasures.filter(isOpenClassification);
  const sidecar = sidecarReliabilitySummary(model.sidecar || {});
  const systemReferenceIncomplete = activeMeasures.filter(measure => !hasSystemReference(measure));
  const riskMappingIncomplete = riskMeasures.filter(measure => !hasRiskMapping(measure));
  const items = [];

  if (activeMeasures.length) items.push({
    key: 'system-references',
    label: 'Systemreferenzen je Maßnahme',
    value: `${systemReferenceIncomplete.length} von ${activeMeasures.length}`,
    severity: systemReferenceIncomplete.length ? 'warn' : 'good',
    detail: 'Für Rückspielweg und Audit sollten Quellsystem plus Datensatz-/PSP-/Objektreferenz benannt sein.'
  });
  if (riskMeasures.length) items.push({
    key: 'risk-mapping',
    label: 'Risiko-Mapping',
    value: `${riskMappingIncomplete.length} von ${riskMeasures.length}`,
    severity: riskMappingIncomplete.length ? 'warn' : 'good',
    detail: 'Risikowerte mit Datenbankbezug, Evidenzstatus, Verantwortung oder strukturierter Wirkungskette verbinden.'
  });

  if (riskMeasures.length) items.push({
    key: 'risk-evidence',
    label: 'RiskAvoided-Werte unbelegt',
    value: `${riskMissingEvidence.length} von ${riskMeasures.length}`,
    severity: riskMissingEvidence.length ? 'warn' : 'good',
    detail: 'Risikowerte bleiben prüfpflichtige Arbeitswerte, bis Evidenzstatus oder Wirkungskette dokumentiert sind.'
  });
  if (activeMeasures.length) items.push({
    key: 'target-mapping',
    label: 'Maßnahmen ohne Ziel-Zuordnung',
    value: `${withoutTargets.length} von ${activeMeasures.length}`,
    severity: withoutTargets.length ? 'warn' : 'good',
    detail: 'Ziel-Zuordnung macht sichtbar, worauf Budget und Maßnahmen einzahlen.'
  });
  if (classicMeasures.length) items.push({
    key: 'no-regret-default',
    label: 'No-Regret-Typisierung',
    value: `${noRegretMeasures.length} von ${classicMeasures.length}`,
    severity: noRegretMeasures.length / Math.max(1, classicMeasures.length) >= 0.8 || noRegretOpen.length ? 'warn' : 'good',
    detail: `${noRegretOpen.length} No-Regret-Einstufung(en) sind noch Arbeits-/Prüfannahmen oder nicht differenziert.`
  });
  items.push({
    key: 'sidecar-evidence',
    label: 'Sidecar-/Evidenzlage',
    value: sidecar.total ? `${sidecar.weakEvidence} von ${sidecar.total}` : '0 Objekte',
    severity: sidecar.weakEvidence || sidecar.openQuestions || sidecar.dataQualityOpen ? 'warn' : 'good',
    detail: sidecar.total
      ? `${sidecar.openQuestions} offene Sidecar-Prüffrage(n), ${sidecar.dataQualityOpen} Datenqualitätsobjekt(e) offen.`
      : 'Noch keine Kontext-/Evidenzobjekte erfasst.'
  });

  const warnCount = items.filter(item => item.severity === 'warn').length;
  return {
    title: 'Belastbarkeit des Arbeitsstands',
    verdict: warnCount ? 'prüfpflichtig' : 'belastbar dokumentiert',
    caveat: warnCount
      ? 'Diese Kachel operationalisiert Nicht-Aussagen: positive KPIs bleiben als Arbeitsstand zu lesen, solange Evidenz, Zielbezug, Typisierung oder Sidecar-Prüfpunkte offen sind.'
      : 'Keine aggregierten Belastbarkeitswarnungen in den geprüften Feldern.',
    systemReferences: { totalActive: activeMeasures.length, incomplete: systemReferenceIncomplete.length },
    riskMapping: { riskMeasures: riskMeasures.length, incomplete: riskMappingIncomplete.length },
    riskAvoided: { totalWithValue: riskMeasures.length, missingEvidence: riskMissingEvidence.length },
    targetMapping: { totalActive: activeMeasures.length, withoutTargets: withoutTargets.length },
    noRegret: { noRegretCount: noRegretMeasures.length, activeClassicCount: classicMeasures.length, openClassification: noRegretOpen.length },
    sidecar,
    items
  };
}

export function calcPortfolio(model, p) {
  const measures = Array.isArray(model?.measures) ? model.measures : [];
  const activeMeasures = measures.filter(measure => measure.active);
  const results = activeMeasures.map(measure => {
    const portfolioEffect = portfolioEffectFor(measure, p);
    const result = calcMeasure(measure, p, portfolioEffect);
    return {
      ...result,
      warnings: [
        ...doubleCountingWarningsFor(measure, p, portfolioEffect),
        ...gasTransformationWarningsFor(measure, p),
        ...flexibilityWarningsFor(measure, p),
        ...stromMeasurePlausibilityWarningsFor(measure, p)
      ]
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
    eog: 0,
    flexibilityAvoidedCapexEffect: 0,
    flexibilityDeferredCapexEffect: 0,
    flexibilityOpexEffect: 0,
    flexibilityNetEffect: 0
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
      yearly[i].flexibilityAvoidedCapexEffect += row.flexibilityAvoidedCapexEffect || 0;
      yearly[i].flexibilityDeferredCapexEffect += row.flexibilityDeferredCapexEffect || 0;
      yearly[i].flexibilityOpexEffect += row.flexibilityOpexEffect || 0;
      yearly[i].flexibilityNetEffect += row.flexibilityNetEffect || 0;
    });
  });

  const invest = activeMeasures.reduce((sum, measure) => sum + (isStromFlexibilityMeasure(measure, p) ? 0 : finiteNumber(measure.cost)), 0);
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
  const flexHelpers = results.map(result => result.flexibility).filter(Boolean);
  const portfolioSegmentation = portfolioSegmentationFor(results, p, measures);
  const portfolioWarnings = stromPortfolioPlausibilityWarningsFor(activeMeasures, p, results);
  const flexibilitySummary = {
    totalCount: activeMeasures.filter(measure => isStromFlexibilityMeasure(measure, p)).length,
    activeCount: flexHelpers.filter(helper => helper.active).length,
    contextCount: flexHelpers.filter(helper => helper.status === 'context').length,
    reviewCount: flexHelpers.filter(helper => helper.status === 'pruefpflichtig' || helper.warnings?.length).length,
    quantifiedCount: flexHelpers.filter(helper => helper.status === 'quantified').length,
    avoidedCapexTeur: flexHelpers.reduce((sum, helper) => sum + helper.avoidedCapexTeur, 0),
    deferredCapexTeur: flexHelpers.reduce((sum, helper) => sum + helper.deferredCapexTeur, 0),
    flexOpexPaTeur: flexHelpers.reduce((sum, helper) => sum + helper.flexOpexPaTeur, 0),
    netPresentValueTeur: flexHelpers.reduce((sum, helper) => sum + helper.netPresentValueTeur, 0)
  };
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
    flexibilitySummary,
    portfolioSegmentation,
    warnings: [...results.flatMap(result => result.warnings || []), ...portfolioWarnings],
    tariffImpact: tariffImpactFor(recurringValue(yearly, 'regulatoryEogEffect'), p),
    yearOneTariffImpact: tariffImpactFor(yearly[0]?.regulatoryEogEffect || 0, p)
  };
}

function recurringValue(yearly, key) {
  const firstRecurringRow = yearly.slice(1).find(row => Math.abs(row.reinvestDecommission || 0) < 0.000001);
  return firstRecurringRow?.[key] ?? yearly[1]?.[key] ?? yearly[0]?.[key] ?? 0;
}

function decisionSnapshot(result) {
  const spread = Number.isFinite(result.irr) ? result.irr - result.p.financingRate : NaN;
  const carries = Number.isFinite(spread) && spread >= 0.01 && result.npv > 0;
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
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
    warningCount: warnings.length,
    gasTransformationWarningCount: warnings.filter(warning => String(warning.type || '').startsWith('gas_')).length,
    rulesetConfidence: result.p?.rulesetConfidence || regulatoryParameterSet.confidence,
    rulesetId: result.p?.rulesetId || regulatoryParameterSet.id,
    sector: result.p?.sector || '',
    carries,
    verdictClass: carries ? 'good' : 'bad'
  };
}

function decisionReservationsFor(basis, scenarioComparison) {
  const reservations = [];
  if (basis.rulesetConfidence && basis.rulesetConfidence !== 'enacted') {
    reservations.push(`Regulierungsstand ${basis.rulesetId} ist ${basis.rulesetConfidence} und damit ein prüfpflichtiger Arbeitsstand.`);
  }
  if (basis.warningCount > 0) {
    reservations.push(`${basis.warningCount} offene Prüf-/Klärhinweise vor Beschluss bearbeiten.`);
  }
  if (basis.gasTransformationWarningCount > 0) {
    reservations.push('Gas-Transformations-, Stilllegungs-, Rückbau- oder Rückstellungsfragen ausdrücklich fachlich freigeben oder als Klärpunkt führen.');
  }
  if (scenarioComparison?.identicalBasisConservative) {
    reservations.push('Basis- und Konservativ-Szenario sind identisch; das konservative Urteil ist kein zusätzlicher Stresstest.');
  }
  return reservations;
}

function governanceDecisionFor(basis, conservative, scenarioComparison = null) {
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
  if (!conservative || scenarioComparison?.identicalBasisConservative) {
    const reservations = decisionReservationsFor(basis, scenarioComparison).filter(
      reservation => !reservation.includes('kein zusätzlicher Stresstest')
    );
    const baseRecommendation = 'Konservatives Szenario parametrisieren oder als Klärpunkt conservative_case_missing führen, bevor Robustheit behauptet wird.';
    return {
      status: 'stresstest_offen',
      cls: 'warn',
      title: 'Basiscase tragfähig, Stresstest offen',
      text: conservative
        ? 'Das konservative Szenario weicht derzeit nicht vom Basisszenario ab. Die ausgewiesene Tragfähigkeit ist daher als Basiscase-Ergebnis zu lesen; ein eigenständiger Stresstest liegt noch nicht vor.'
        : 'Es wurde kein konservatives Szenario geprüft. Die ausgewiesene Tragfähigkeit ist daher als Basiscase-Ergebnis zu lesen; ein eigenständiger Stresstest liegt noch nicht vor.',
      recommendation: reservations.length
        ? `${baseRecommendation} Weitere Prüfvorbehalte: ${reservations.join(' ')}`
        : baseRecommendation
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
  const reservations = decisionReservationsFor(basis, scenarioComparison);
  return {
    status: 'robust',
    cls: 'good',
    title: 'Robust tragfähig',
    text: 'Die Maßnahme trägt sowohl im Basiscase als auch ohne prüfpflichtige Wirkannahmen bzw. unter konservativer Bewertung.',
    recommendation: reservations.length
      ? `Als prüfpflichtigen Arbeitsstand nutzen; vor Beschluss ${reservations.join(' ')}`
      : 'Robust tragfähig; Attribution, Datenstand und regulatorische Grenzen trotzdem dokumentieren.'
  };
}

function metricDelta(a, b, tolerance = 0.000001) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return !Number.isFinite(a) && !Number.isFinite(b);
  return Math.abs(a - b) <= tolerance;
}

function scenarioComparisonFor(basis, conservative) {
  if (!conservative) {
    return {
      identicalBasisConservative: false,
      note: 'Konservatives Szenario nicht geprüft.'
    };
  }
  const identicalBasisConservative = [
    metricDelta(basis.irr, conservative.irr),
    metricDelta(basis.npv, conservative.npv),
    metricDelta(basis.yearOneRegulatoryEog, conservative.yearOneRegulatoryEog),
    metricDelta(basis.recurringRegulatoryEog, conservative.recurringRegulatoryEog),
    metricDelta(basis.yearOneIndicativeCashflow, conservative.yearOneIndicativeCashflow),
    metricDelta(basis.recurringIndicativeCashflow, conservative.recurringIndicativeCashflow)
  ].every(Boolean);
  return {
    identicalBasisConservative,
    note: identicalBasisConservative
      ? 'Basis- und Konservativ-Szenario sind identisch; das konservative Urteil liefert keine zusätzliche Stressprüfung.'
      : 'Basis- und Konservativ-Szenario unterscheiden sich; konservatives Urteil als Sensitivität lesen.'
  };
}

export function portfolioDecisionMetrics(result, conservativeResult = null) {
  const basis = decisionSnapshot(result);
  const conservative = conservativeResult ? decisionSnapshot(conservativeResult) : null;
  const scenarioComparison = scenarioComparisonFor(basis, conservative);
  const governanceDecision = governanceDecisionFor(basis, conservative, scenarioComparison);
  const interpretationWarnings = scenarioComparison.identicalBasisConservative ? [{
    type: 'conservative_case_missing',
    title: 'Konservatives Szenario nicht parametrisiert',
    detail: 'Das konservative Szenario weicht derzeit nicht vom Basisszenario ab; ein eigenständiger Stresstest liegt noch nicht vor.'
  }] : [];
  const conservativeGate = conservative
    ? scenarioComparison.identicalBasisConservative
      ? 'stresstest_ausstehend'
      : governanceDecision.status === 'auflage'
        ? 'auflage'
        : governanceDecision.status === 'robust'
          ? 'tragfaehig'
          : 'nicht_tragfaehig'
    : 'nicht_geprueft';
  return {
    ...basis,
    basis,
    conservative,
    scenarioComparison,
    interpretationWarnings,
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
