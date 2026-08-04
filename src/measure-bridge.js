const BRIDGE_DEFAULTS = Object.freeze({
  numberType: 'not_assessed',
  budgetProcessStatus: 'not_assessed',
  budgetYear: '',
  budgetBucket: '',
  budgetOwner: '',
  capexOpexTreatment: 'unclear',
  activationStatus: 'not_applicable',
  regulatoryEffect: 'requires_regulatory_review',
  returnTiming: 'unknown',
  operationalCriticality: 'not_assessed',
  deferrability: 'not_assessed',
  bridgeStatus: 'not_assessed',
  ownerRole: '',
  calculationImpact: 'none',
  openBridgeQuestions: [],
});

export const measureBridgeLabels = Object.freeze({
  numberType: {
    not_assessed: 'nicht bewertet',
    rough_estimate: 'grobe Schätzung',
    forecast: 'Plan-/Forecast-Wert',
    requested_budget: 'Budgetanmeldung',
    approved_budget: 'freigegebenes Budget',
    actual: 'Ist-Wert',
  },
  budgetProcessStatus: {
    not_assessed: 'nicht bewertet',
    idea: 'Idee / Vorprüfung',
    requested: 'angemeldet',
    budget_release_required: 'Budgetfreigabe erforderlich',
    approved: 'Budget freigegeben',
    posting_blocked: 'Buchung/Rückspielweg blockiert',
    closed: 'abgeschlossen',
  },
  capexOpexTreatment: {
    unclear: 'offen',
    capex: 'CAPEX',
    opex: 'OPEX',
    mixed: 'gemischt',
    not_applicable: 'nicht einschlägig',
  },
  activationStatus: {
    not_applicable: 'nicht einschlägig',
    not_assessed: 'nicht bewertet',
    expected: 'Aktivierung erwartet',
    requires_accounting_review: 'Bilanzierung prüfen',
    not_activatable: 'nicht aktivierbar',
    activated: 'aktiviert / gebucht',
  },
  regulatoryEffect: {
    requires_regulatory_review: 'regulatorisch zu prüfen',
    no_direct_effect: 'keine direkte Wirkung erwartet',
    direct_revenue_base_effect_expected: 'direkte Erlös-/RAB-Wirkung erwartet',
    indirect_effect_expected: 'indirekte Wirkung erwartet',
    already_reflected: 'bereits berücksichtigt',
  },
  returnTiming: {
    unknown: 'offen',
    year_one: 'Startjahr',
    following_year: 'erstes Folgejahr',
    next_regulatory_period: 'nächste Regulierungsperiode',
    multi_year: 'mehrjährig',
    not_applicable: 'nicht einschlägig',
  },
  operationalCriticality: {
    not_assessed: 'nicht bewertet',
    low: 'niedrig',
    asset_health: 'Asset-Zustand',
    safety: 'Sicherheit / Pflicht',
    supply_security: 'Versorgungssicherheit',
    customer_commitment: 'Kunden-/Vertragsbezug',
  },
  deferrability: {
    not_assessed: 'nicht bewertet',
    deferrable: 'verschiebbar',
    path_dependent: 'pfadabhängig',
    time_critical: 'zeitkritisch',
    not_deferrable: 'nicht verschiebbar',
  },
  bridgeStatus: {
    not_assessed: 'nicht bewertet',
    complete: 'vollständig dokumentiert',
    budget_bridge_missing: 'Budgetbrücke offen',
    accounting_bridge_missing: 'Accounting-/Buchungsbrücke offen',
    regulatory_return_missing: 'regulatorische/wirtschaftliche Wirkung offen',
    owner_missing: 'Verantwortung offen',
  },
  calculationImpact: {
    none: 'keine automatische KPI-Wirkung',
  },
});

const TEXT_FIELDS = new Set(['budgetBucket', 'budgetOwner', 'ownerRole']);
const INT_FIELDS = new Set(['budgetYear']);

function text(value) {
  return String(value ?? '').trim();
}

function enumValue(group, value, fallback) {
  const raw = text(value);
  return Object.prototype.hasOwnProperty.call(measureBridgeLabels[group] || {}, raw) ? raw : fallback;
}

function parseQuestions(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const raw = text(value);
  if (!raw) return [];
  return raw.split(/[;\n]/).map(text).filter(Boolean);
}

export function normalizeMeasureBridge(input = {}) {
  const source = /** @type {Record<string, any>} */ (input && typeof input === 'object' ? input : {});
  return {
    numberType: enumValue('numberType', source.numberType, BRIDGE_DEFAULTS.numberType),
    budgetProcessStatus: enumValue('budgetProcessStatus', source.budgetProcessStatus, BRIDGE_DEFAULTS.budgetProcessStatus),
    budgetYear: Number.isFinite(Number(source.budgetYear)) && Number(source.budgetYear) > 0 ? Math.round(Number(source.budgetYear)) : '',
    budgetBucket: text(source.budgetBucket),
    budgetOwner: text(source.budgetOwner),
    capexOpexTreatment: enumValue('capexOpexTreatment', source.capexOpexTreatment, BRIDGE_DEFAULTS.capexOpexTreatment),
    activationStatus: enumValue('activationStatus', source.activationStatus, BRIDGE_DEFAULTS.activationStatus),
    regulatoryEffect: enumValue('regulatoryEffect', source.regulatoryEffect, BRIDGE_DEFAULTS.regulatoryEffect),
    returnTiming: enumValue('returnTiming', source.returnTiming, BRIDGE_DEFAULTS.returnTiming),
    operationalCriticality: enumValue('operationalCriticality', source.operationalCriticality, BRIDGE_DEFAULTS.operationalCriticality),
    deferrability: enumValue('deferrability', source.deferrability, BRIDGE_DEFAULTS.deferrability),
    bridgeStatus: enumValue('bridgeStatus', source.bridgeStatus, BRIDGE_DEFAULTS.bridgeStatus),
    ownerRole: text(source.ownerRole),
    calculationImpact: 'none',
    openBridgeQuestions: parseQuestions(source.openBridgeQuestions),
  };
}

export function hasMeasureBridge(input = {}) {
  const bridge = normalizeMeasureBridge(input);
  return Object.entries(bridge).some(([key, value]) => {
    if (key === 'calculationImpact') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (TEXT_FIELDS.has(key) || INT_FIELDS.has(key)) return Boolean(value);
    return value !== BRIDGE_DEFAULTS[key];
  });
}

export function measureBridgeLabel(group, value) {
  return measureBridgeLabels[group]?.[value] || value || '';
}

export function measureBridgeOpenStatus(bridgeInput = {}) {
  const bridge = normalizeMeasureBridge(bridgeInput);
  const open = [];
  if (['budget_release_required', 'posting_blocked'].includes(bridge.budgetProcessStatus)) {
    open.push('budget');
  }
  if (bridge.capexOpexTreatment === 'unclear' || bridge.activationStatus === 'requires_accounting_review') {
    open.push('accounting');
  }
  if (bridge.regulatoryEffect === 'requires_regulatory_review' || bridge.returnTiming === 'unknown') {
    open.push('regulatory_return');
  }
  if (bridge.bridgeStatus !== 'complete' && bridge.bridgeStatus !== 'not_assessed') {
    open.push(bridge.bridgeStatus);
  }
  if (!bridge.ownerRole && bridge.bridgeStatus === 'owner_missing') open.push('owner');
  if (bridge.openBridgeQuestions.length) open.push('questions');
  return [...new Set(open)];
}

export function measureBridgeSummary(measures = []) {
  const initialized = measures
    .map(measure => ({ measure, bridge: normalizeMeasureBridge(measure?.measureBridge) }))
    .filter(({ measure }) => hasMeasureBridge(measure?.measureBridge));
  const missingByStatus = {};
  initialized.forEach(({ bridge }) => {
    if (bridge.bridgeStatus !== 'complete') missingByStatus[bridge.bridgeStatus] = (missingByStatus[bridge.bridgeStatus] || 0) + 1;
  });
  const complete = initialized.filter(({ bridge }) => bridge.bridgeStatus === 'complete').length;
  const open = initialized.length - complete;
  return {
    total: initialized.length,
    complete,
    open,
    missingByStatus,
    caveat: 'Maßnahmen-Brücken dokumentieren Budget-, Accounting- und Ausführungsreife. Sie sind KPI-neutral und ändern keine EOG-, RAB-, Risiko-, IRR-/NPV- oder Szenariowerte.',
  };
}

export function measureBridgeClarificationItems(measure = {}) {
  const bridge = normalizeMeasureBridge(measure.measureBridge);
  if (!hasMeasureBridge(measure.measureBridge)) return [];
  const id = String(measure.id || measure.name || 'measure');
  const measureName = measure.name || measure.id || 'Maßnahme';
  const items = [];
  const add = (suffix, title, detail, column = 'evidence') => items.push({
    key: `${id}:measure_bridge:${suffix}`,
    measureId: measure.id,
    measure: measureName,
    area: column === 'documentation' ? 'Dokumentation' : 'Evidenz',
    column,
    type: 'measure_bridge',
    title,
    detail,
    targetPhase: 'konsolidierung',
  });

  if (['budget_release_required', 'posting_blocked'].includes(bridge.budgetProcessStatus)) {
    add('budget', 'Budgetpfad klären', `Status: ${measureBridgeLabel('budgetProcessStatus', bridge.budgetProcessStatus)}${bridge.budgetYear ? ` · Budgetjahr ${bridge.budgetYear}` : ''}`);
  }
  if (bridge.budgetProcessStatus === 'posting_blocked') {
    add('posting', 'Buchungs-/Rückspielweg klären', 'Budget-/Posting-Status ist blockiert; führendes System und Rückspielweg dokumentieren.');
  }
  if (bridge.capexOpexTreatment === 'unclear' || bridge.activationStatus === 'requires_accounting_review') {
    add('accounting', 'CAPEX/OPEX- und Aktivierungsbehandlung klären', `CAPEX/OPEX: ${measureBridgeLabel('capexOpexTreatment', bridge.capexOpexTreatment)} · Aktivierung: ${measureBridgeLabel('activationStatus', bridge.activationStatus)}`);
  }
  if (bridge.regulatoryEffect === 'requires_regulatory_review' || bridge.returnTiming === 'unknown') {
    add('regulatory-return', 'regulatorische/wirtschaftliche Wirkung und Timing klären', `Wirkung: ${measureBridgeLabel('regulatoryEffect', bridge.regulatoryEffect)} · Timing: ${measureBridgeLabel('returnTiming', bridge.returnTiming)}`);
  }
  if (bridge.bridgeStatus === 'owner_missing' || !bridge.ownerRole && bridge.bridgeStatus !== 'complete' && bridge.bridgeStatus !== 'not_assessed') {
    add('owner', 'Validierungsverantwortung benennen', 'Rolle/Owner für die wirtschaftliche Brücke bzw. Überleitung fehlt.', 'documentation');
  }
  if (bridge.openBridgeQuestions.length) {
    add('questions', 'offene Brückenfragen bearbeiten', bridge.openBridgeQuestions.join(' | '), 'documentation');
  }
  return items;
}

export function measureBridgePromptFields(measure = {}, index = 0, options = {}) {
  const bridge = normalizeMeasureBridge(measure.measureBridge);
  if (!hasMeasureBridge(measure.measureBridge)) return null;
  const name = options.anonymizeMeasures ? `Maßnahme ${index + 1}` : measure.name || measure.id || `Maßnahme ${index + 1}`;
  return {
    id: measure.id || '',
    name,
    numberType: bridge.numberType,
    budgetProcessStatus: bridge.budgetProcessStatus,
    budgetYear: bridge.budgetYear,
    budgetBucket: bridge.budgetBucket,
    capexOpexTreatment: bridge.capexOpexTreatment,
    activationStatus: bridge.activationStatus,
    regulatoryEffect: bridge.regulatoryEffect,
    returnTiming: bridge.returnTiming,
    operationalCriticality: bridge.operationalCriticality,
    deferrability: bridge.deferrability,
    bridgeStatus: bridge.bridgeStatus,
    ownerRole: bridge.ownerRole,
    calculationImpact: 'none',
    openBridgeQuestions: bridge.openBridgeQuestions,
    openStatus: measureBridgeOpenStatus(bridge),
  };
}

export function measureBridgePromptSummary(measures = [], options = {}) {
  const measureBridgeMeasures = measures
    .map((measure, index) => measureBridgePromptFields(measure, index, options))
    .filter(Boolean);
  const summary = measureBridgeSummary(measures);
  return {
    ...summary,
    measures: options.dataScope === 'summary' ? [] : measureBridgeMeasures,
  };
}
