const categoryIds = new Set([
  'regulatory_must',
  'asset_preservation_must',
  'transformation_must_no_regret',
  'strategic_option',
  'synergy_timing',
  'unclassified'
]);

const sourceIds = new Set(['manual', 'derived', 'imported', 'unset']);
const bridgeStatuses = new Set(['present', 'partial', 'missing', 'not_applicable']);

export const VIABILITY_CATEGORIES = [
  {
    id: 'regulatory_must',
    label: 'Regulatorisches Muss',
    shortLabel: 'Regulatorisch',
    steeringQuestion: 'Was muss bis wann getan werden und welche Folge hat Nichtumsetzung?',
    budgetMeaning: 'Nicht als frei disponierbare Entwicklung lesen; Timing, Nachweis und Risikohandhabung klären.'
  },
  {
    id: 'asset_preservation_must',
    label: 'Substanzerhalt / Versorgungssicherheit',
    shortLabel: 'Substanzerhalt',
    steeringQuestion: 'Welches Asset- oder Zuverlässigkeitsrisiko wird vermieden und wie ist es belegt?',
    budgetMeaning: 'Faktisches Muss zur Erhaltung der regulierten Substanz und Betriebsfähigkeit.'
  },
  {
    id: 'transformation_must_no_regret',
    label: 'Transformation / No-Regret',
    shortLabel: 'No-Regret',
    steeringQuestion: 'Unter welchen Zukunftspfaden bleibt die Maßnahme robust?',
    budgetMeaning: 'Schärft die No-Regret-Logik; Begründung und Pfadannahmen müssen sichtbar bleiben.'
  },
  {
    id: 'strategic_option',
    label: 'Strategische Option',
    shortLabel: 'Option',
    steeringQuestion: 'Welche künftige Fähigkeit, Option oder Engpassvermeidung entsteht?',
    budgetMeaning: 'Braucht klare Optionswert- und Tragfähigkeitsevidenz, sonst wird sie im knappen Budget verdrängt.'
  },
  {
    id: 'synergy_timing',
    label: 'Synergie / Timing',
    shortLabel: 'Timing',
    steeringQuestion: 'Welches Zeitfenster oder Bündelungsrisiko geht bei Verschiebung verloren?',
    budgetMeaning: 'Kann isoliert verschiebbar wirken, wird aber bei verpasstem Zeitfenster teurer oder riskanter.'
  },
  {
    id: 'unclassified',
    label: 'Noch nicht klassifiziert',
    shortLabel: 'Offen',
    steeringQuestion: 'Welche Tragfähigkeitslogik soll diese Maßnahme tragen?',
    budgetMeaning: 'Nicht als Muss oder Option einordnen, bevor Tragfähigkeitslogik und Evidenz dokumentiert sind.'
  }
];

export const VIABILITY_CATEGORY_LABELS = Object.fromEntries(VIABILITY_CATEGORIES.map(category => [category.id, category.label]));
export const VIABILITY_SOURCE_LABELS = {
  manual: 'manuell gesetzt',
  derived: 'abgeleitet / prüfbar',
  imported: 'importiert',
  unset: 'nicht gesetzt'
};
export const REFINANCING_BRIDGE_LABELS = {
  present: 'Brücke vorhanden',
  partial: 'teilweise belegt',
  missing: 'Brücke fehlt',
  not_applicable: 'nicht anwendbar'
};

function text(value) {
  return String(value ?? '').trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function tagsText(measure = {}) {
  const tags = Array.isArray(measure.tags) ? measure.tags.join(' ') : text(measure.tags);
  return lower([
    tags,
    measure.type,
    measure.monitoringCategory,
    measure.note,
    measure.capacityImpact,
    measure.flexibilityNeed,
    measure.gasTransformationPath,
    measure.gasAssetScope,
    measure.gasRegulatoryTreatment,
    measure.viabilityRationale
  ].join(' '));
}

function measureDivision(measure = {}, fallbackSector = '') {
  return lower(measure.division || measure.sector || measure.sparte || fallbackSector);
}

export function measuresForDivision(model = {}, sector = 'gas') {
  const selectedSector = lower(sector || 'gas') === 'strom' ? 'strom' : 'gas';
  return (Array.isArray(model.measures) ? model.measures : [])
    .filter(measure => measure.active !== false)
    .filter(measure => {
      const division = measureDivision(measure, selectedSector);
      return !division || division === selectedSector;
    });
}

function categoryFromManual(value) {
  const normalized = lower(value);
  return categoryIds.has(normalized) && normalized !== 'unclassified' ? normalized : '';
}

function normalizedBridgeRefs(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  return text(value).split(/[;,]/).map(part => part.trim()).filter(Boolean);
}

function derivedCategory(measure = {}) {
  const haystack = tagsText(measure);
  const riskAvoided = finiteNumber(measure.riskAvoided) || finiteNumber(measure.riskAvoidedTeurPa);
  const annualRevenueAtRisk = finiteNumber(measure.annualRevenueAtRiskTeur);
  const impacts = Array.isArray(measure.impactAssumptions) ? measure.impactAssumptions : [];
  const hasRiskImpact = impacts.some(impact => impact.area === 'risk' && finiteNumber(impact.amount || impact.riskImpact) > 0);

  if (measure.permitRequired === 'yes'
    || /pflicht|auflage|konzession|vertrag|compliance|sicherheit|genehmigung|gesetz|regulator/.test(haystack)) {
    return 'regulatory_must';
  }
  if (riskAvoided > 0 || hasRiskImpact || /störung|stoerung|ausfall|schaden|erneuer|ersatz|sanier|zustand|versorgungssicherheit|substanzerhalt/.test(haystack)) {
    return 'asset_preservation_must';
  }
  if (/synergie|timing|zeitfenster|bündel|buendel|koordination|mitverlegung|baukoordination|abhängig|abhaengig/.test(haystack)) {
    return 'synergy_timing';
  }
  if (measure.effectType === 'flexibility'
    || annualRevenueAtRisk > 0
    || /option|zielnetz|anschluss|kapazität|kapazitaet|flexibil|netzfahrplan|redispatch|engpass/.test(haystack)) {
    return 'strategic_option';
  }
  if (measure.type === 'noRegret' && (/transformation|stilllegung|rückbau|rueckbau|umwidmung|h2|wasserstoff|dekarbon/.test(haystack) || text(measure.viabilityRationale))) {
    return 'transformation_must_no_regret';
  }
  return 'unclassified';
}

function derivedBridgeRefs(measure = {}, category = 'unclassified') {
  const refs = new Set(normalizedBridgeRefs(measure.refinancingBridgeRefs));
  if (finiteNumber(measure.cost) > 0) refs.add('capex');
  if (finiteNumber(measure.riskAvoided) > 0 || category === 'asset_preservation_must') refs.add('riskAvoided');
  if (finiteNumber(measure.opexPa) || finiteNumber(measure.opexDeltaPa)) refs.add('opexAvoidance');
  if (finiteNumber(measure.qDirect) || finiteNumber(measure.eDirect)) refs.add('eog');
  if (measure.effectType === 'flexibility' || category === 'strategic_option') refs.add('connectionCapability');
  if (category === 'synergy_timing') refs.add('synergyTiming');
  return [...refs];
}

function bridgeStatusFor(measure = {}, category = 'unclassified', refs = []) {
  const manual = lower(measure.refinancingBridgeStatus);
  if (bridgeStatuses.has(manual)) return manual;
  if (category === 'unclassified') return 'missing';
  if (refs.length >= 2) return 'present';
  if (refs.length === 1) return 'partial';
  return 'missing';
}

function categoryRationale(measure = {}, category = 'unclassified', source = 'derived') {
  const manual = text(measure.viabilityRationale);
  if (manual) return manual;
  if (source === 'manual') return 'Manuell klassifiziert; Begründung noch ergänzen.';
  return {
    regulatory_must: 'Aus Pflicht-, Genehmigungs-, Vertrags- oder Compliance-Hinweisen konservativ abgeleitet.',
    asset_preservation_must: 'Aus Risiko-, Störungs-, Erhaltungs- oder Substanzhinweisen konservativ abgeleitet.',
    transformation_must_no_regret: 'Aus No-Regret- oder Transformationshinweisen konservativ abgeleitet.',
    strategic_option: 'Aus Flexibilitäts-, Kapazitäts-, Anschluss- oder Optionshinweisen konservativ abgeleitet.',
    synergy_timing: 'Aus Zeitfenster-, Bündelungs- oder Koordinationshinweisen konservativ abgeleitet.',
    unclassified: 'Keine belastbare Tragfähigkeitslogik erkennbar; manuelle Einordnung erforderlich.'
  }[category] || '';
}

export function classifyMeasureViability(measure = {}) {
  const manualCategory = categoryFromManual(measure.viabilityCategory);
  const importedSource = lower(measure.viabilityCategorySource) === 'imported';
  const category = manualCategory || derivedCategory(measure);
  const source = manualCategory
    ? (sourceIds.has(lower(measure.viabilityCategorySource)) ? lower(measure.viabilityCategorySource) : 'manual')
    : (importedSource ? 'imported' : category === 'unclassified' ? 'unset' : 'derived');
  const refs = derivedBridgeRefs(measure, category);
  const bridgeStatus = bridgeStatusFor(measure, category, refs);
  const openQuestions = Array.isArray(measure.openViabilityQuestions)
    ? measure.openViabilityQuestions.map(text).filter(Boolean)
    : text(measure.openViabilityQuestions).split(/[;\n]/).map(part => part.trim()).filter(Boolean);
  const reviewRequired = source !== 'manual'
    || category === 'unclassified'
    || bridgeStatus === 'missing'
    || bridgeStatus === 'partial'
    || openQuestions.length > 0;
  return {
    measureId: text(measure.id),
    measureName: text(measure.name) || text(measure.id) || 'Maßnahme',
    category,
    label: VIABILITY_CATEGORY_LABELS[category] || category,
    source,
    sourceLabel: VIABILITY_SOURCE_LABELS[source] || source,
    rationale: categoryRationale(measure, category, source),
    refinancingBridgeStatus: bridgeStatus,
    refinancingBridgeLabel: REFINANCING_BRIDGE_LABELS[bridgeStatus] || bridgeStatus,
    refinancingBridgeRefs: refs,
    openQuestions,
    reviewRequired,
    capexTeur: finiteNumber(measure.cost),
    riskTeurPa: finiteNumber(measure.riskAvoided) + finiteNumber(measure.annualRevenueAtRiskTeur)
  };
}

export function viabilityOverviewFor(model = {}, inputs = {}) {
  const sector = lower(inputs.sector || 'gas') === 'strom' ? 'strom' : 'gas';
  const categories = Object.fromEntries(VIABILITY_CATEGORIES.map(category => [category.id, {
    ...category,
    count: 0,
    capexTeur: 0,
    openClarifications: 0,
    bridgeMissing: 0,
    derived: 0,
    measures: [],
    bridgeRefs: {}
  }]));
  const classifications = measuresForDivision(model, sector).map(measure => classifyMeasureViability(measure));
  classifications.forEach(classification => {
    const bucket = categories[classification.category] || categories.unclassified;
    bucket.count += 1;
    bucket.capexTeur += classification.capexTeur;
    if (classification.reviewRequired) bucket.openClarifications += 1;
    if (classification.source === 'derived' || classification.source === 'unset') bucket.derived += 1;
    if (['missing', 'partial'].includes(classification.refinancingBridgeStatus)) bucket.bridgeMissing += 1;
    classification.refinancingBridgeRefs.forEach(ref => {
      bucket.bridgeRefs[ref] = (bucket.bridgeRefs[ref] || 0) + 1;
    });
    bucket.measures.push(classification);
  });
  const warnings = [];
  const noRegret = categories.transformation_must_no_regret;
  if (classifications.length && noRegret.count / classifications.length > 0.55 && noRegret.derived > 0) {
    warnings.push({ type: 'no_regret_overuse', title: 'Viele No-Regret-Ableitungen', detail: 'No-Regret-Logik ist häufig abgeleitet; Begründungen und Pfadrobustheit prüfen.' });
  }
  const missing = classifications.filter(item => item.category === 'unclassified' || item.refinancingBridgeStatus === 'missing');
  if (missing.length) {
    warnings.push({ type: 'missing_viability_logic', title: 'Tragfähigkeitslogik fehlt', detail: `${missing.length} Maßnahme(n) ohne belastbare Budget-/Refinanzierungsbrücke.` });
  }
  return {
    sector,
    totalCount: classifications.length,
    totalCapexTeur: classifications.reduce((sum, item) => sum + item.capexTeur, 0),
    categories,
    classifications,
    warnings
  };
}

export function viabilityClarificationItems(model = {}, inputs = {}) {
  return viabilityOverviewFor(model, inputs).classifications
    .filter(item => item.reviewRequired)
    .map(item => ({
      key: `viability:${item.measureId}`,
      type: 'viability',
      title: item.category === 'unclassified' ? 'Tragfähigkeitslogik klassifizieren' : 'Tragfähigkeitslogik prüfen',
      measure: item.measureName,
      measureId: item.measureId,
      detail: `${item.label}: ${item.rationale} · ${item.refinancingBridgeLabel}`,
      priority: item.category === 'unclassified' || item.refinancingBridgeStatus === 'missing' ? 'mittel' : 'normal',
      targetView: 'measures'
    }));
}
