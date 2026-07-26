const sidecarTypes = new Set([
  'grid_coupling', 'load_request', 'third_party_storage_request', 'flexibility', 'controllability',
  'redispatch_process', 'network_schedule', 'gas_load_path', 'gas_customer_cluster',
  'decommissioning_context', 'conversion_context', 'hydrogen_readiness', 'heat_planning_dependency',
  'no_regret_context', 'asset_mapping', 'data_quality', 'process_context', 'scenario_driver',
  'external_dependency', 'evidence_only'
]);
const divisions = new Set(['strom', 'gas', 'waerme', 'wasser', 'cross_division']);
const statuses = new Set(['context', 'pruefpflichtig', 'quantified', 'active', 'archived']);
const evidenceStatuses = new Set(['missing', 'stated', 'source_available', 'validated', 'conflicting', 'stale']);
const calculationImpacts = new Set(['none', 'indirect', 'scenario_driver', 'quantified', 'active']);
const sensitivities = new Set(['public', 'internal', 'private', 'confidential']);
const exportStatuses = new Set(['allowed', 'sanitized_only', 'excluded']);

export const sidecarProfiles = {
  strom: {
    label: 'Strom',
    categories: ['grid_coupling', 'load_request', 'third_party_storage_request', 'flexibility', 'controllability', 'redispatch_process', 'network_schedule', 'asset_mapping', 'data_quality'],
    categoryLabels: {
      grid_coupling: 'Netzkoppelung / vorgelagertes Netz',
      load_request: 'Großanschlüsse / Lastentwicklung',
      third_party_storage_request: 'Speicher / Dritte',
      flexibility: 'Flexibilität / Netzfahrplan',
      controllability: 'Steuerbarkeit / iMSys / CLS / §14a',
      redispatch_process: 'Redispatch / operative Prozesse',
      network_schedule: 'Netzfahrplan',
      asset_mapping: 'Asset-/Nutzungsdauer-Mapping',
      data_quality: 'Datenqualität'
    }
  },
  gas: {
    label: 'Gas',
    categories: ['gas_load_path', 'gas_customer_cluster', 'decommissioning_context', 'conversion_context', 'hydrogen_readiness', 'heat_planning_dependency', 'no_regret_context', 'asset_mapping', 'data_quality', 'external_dependency'],
    categoryLabels: {
      gas_load_path: 'Kunden-/Lastpfade',
      gas_customer_cluster: 'Kundencluster',
      decommissioning_context: 'Stilllegung / Rückbau',
      conversion_context: 'Umwidmung / Wasserstofffähigkeit',
      hydrogen_readiness: 'Wasserstofffähigkeit',
      heat_planning_dependency: 'Wärmeplanung / Grüne Wärme',
      no_regret_context: 'No-Regret-Kontext',
      asset_mapping: 'Asset-/Nutzungsdauer-Mapping',
      data_quality: 'Datenqualität',
      external_dependency: 'Externe Abhängigkeit'
    }
  }
};

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function list(value) {
  if (Array.isArray(value)) return value.map(item => String(item)).filter(Boolean);
  if (value === null || value === undefined || value === '') return [];
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function enumValue(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

export function defaultSidecar() {
  return { version: '1.0', objects: [], sources: [], links: [], summary: {} };
}

export function normalizeSidecarSource(source = {}, index = 0) {
  const sensitivity = enumValue(source.sensitivity, sensitivities, 'internal');
  const exportStatus = enumValue(source.exportStatus, exportStatuses, sensitivity === 'public' ? 'allowed' : 'sanitized_only');
  return {
    id: text(source.id, `src_${index + 1}`),
    type: text(source.type, 'source'),
    title: text(source.title, `Quelle ${index + 1}`),
    contains: list(source.contains),
    usableFor: list(source.usableFor),
    sensitivity,
    exportStatus
  };
}

export function normalizeSidecarObject(object = {}, index = 0) {
  const division = enumValue(object.division, divisions, 'cross_division');
  const type = enumValue(object.type, sidecarTypes, 'evidence_only');
  const sensitivity = enumValue(object.sensitivity, sensitivities, 'internal');
  const exportStatus = enumValue(object.exportStatus, exportStatuses, sensitivity === 'public' ? 'allowed' : 'sanitized_only');
  return {
    id: text(object.id, `ctx_${index + 1}`),
    type,
    division,
    title: text(object.title, `Kontextobjekt ${index + 1}`),
    summary: text(object.summary),
    status: enumValue(object.status, statuses, 'context'),
    evidenceStatus: enumValue(object.evidenceStatus, evidenceStatuses, 'missing'),
    calculationImpact: enumValue(object.calculationImpact, calculationImpacts, 'none'),
    linkedMeasures: list(object.linkedMeasures),
    linkedScenarios: list(object.linkedScenarios),
    sourceRefs: list(object.sourceRefs),
    openQuestions: list(object.openQuestions),
    sensitivity,
    exportStatus,
    ownerRole: text(object.ownerRole, 'unknown'),
    reviewStatus: text(object.reviewStatus, 'not_reviewed')
  };
}

export function normalizeSidecar(value = {}) {
  const input = /** @type {any} */ (value && typeof value === 'object' ? value : {});
  return {
    version: text(input.version, '1.0'),
    objects: Array.isArray(input.objects) ? input.objects.map(normalizeSidecarObject) : [],
    sources: Array.isArray(input.sources) ? input.sources.map(normalizeSidecarSource) : [],
    links: Array.isArray(input.links) ? input.links.map(link => ({ ...link })) : [],
    summary: input.summary && typeof input.summary === 'object' ? { ...input.summary } : {}
  };
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

export function sidecarSummary(sidecarInput = {}) {
  const sidecar = normalizeSidecar(sidecarInput);
  const summary = {
    total: sidecar.objects.length,
    sources: sidecar.sources.length,
    byDivision: {},
    byType: {},
    byEvidenceStatus: {},
    byStatus: {},
    calculationImpact: {},
    openQuestions: 0,
    dataQualityOpen: 0,
    sensitiveObjects: 0,
    exportRestricted: 0
  };
  sidecar.objects.forEach(object => {
    increment(summary.byDivision, object.division);
    increment(summary.byType, object.type);
    increment(summary.byEvidenceStatus, object.evidenceStatus);
    increment(summary.byStatus, object.status);
    increment(summary.calculationImpact, object.calculationImpact);
    summary.openQuestions += object.openQuestions.length;
    if (object.type === 'data_quality' && object.status !== 'archived' && object.evidenceStatus !== 'validated') summary.dataQualityOpen += 1;
    if (object.sensitivity === 'private' || object.sensitivity === 'confidential') summary.sensitiveObjects += 1;
    if (object.exportStatus !== 'allowed') summary.exportRestricted += 1;
  });
  return summary;
}

function sanitizeObject(object) {
  return {
    ...object,
    summary: object.exportStatus === 'sanitized_only' ? 'Details sanitisiert; interne Quelle im vollständigen Arbeitsstand prüfen.' : object.summary,
    sourceRefs: object.exportStatus === 'sanitized_only' ? [] : object.sourceRefs,
    openQuestions: object.openQuestions.map(question => object.exportStatus === 'sanitized_only' ? 'Prüffrage sanitisiert' : question)
  };
}

function sanitizeSource(source) {
  return source.exportStatus === 'sanitized_only'
    ? { ...source, title: 'Quelle sanitisiert', contains: [], usableFor: [] }
    : { ...source };
}

export function sanitizeSidecarForExport(sidecarInput = {}, profile = 'full_internal') {
  const sidecar = normalizeSidecar(sidecarInput);
  if (profile === 'full_internal') return sidecar;
  if (profile === 'summary_only') {
    return { ...defaultSidecar(), summary: sidecarSummary(sidecar) };
  }
  const allowRestricted = profile === 'decision_relevant';
  const objects = sidecar.objects
    .filter(object => object.exportStatus !== 'excluded')
    .filter(object => allowRestricted || object.exportStatus === 'allowed' || object.exportStatus === 'sanitized_only')
    .map(object => object.exportStatus === 'allowed' ? object : sanitizeObject(object));
  const sources = sidecar.sources
    .filter(source => source.exportStatus !== 'excluded')
    .filter(source => allowRestricted || source.exportStatus === 'allowed' || source.exportStatus === 'sanitized_only')
    .map(source => source.exportStatus === 'allowed' ? source : sanitizeSource(source));
  return { ...sidecar, objects, sources, summary: sidecarSummary({ ...sidecar, objects, sources }) };
}
