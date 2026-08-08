import { normalizePlanningResume } from './planning-resume.js';
import { defaultObjectives, processPhases } from './ui-config.js';

export function parseTags(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value || '').split(/[;,]/).map(item => item.trim()).filter(Boolean);
}

export function tagsText(tags) {
  return parseTags(tags).join(', ');
}

export function defaultCommittee() {
  return {
    body: 'Gemeinderat',
    audience: 'kommunal',
    meetingDate: '',
    proposalText: ''
  };
}

export function defaultProcessState() {
  const phaseTargets = Object.fromEntries(processPhases.map(([id]) => [id, '']));
  return {
    phase: 'massnahmenbewertung',
    phaseTargets,
    resume: normalizePlanningResume(),
    startedAt: new Date().toISOString()
  };
}

export function defaultStrategy() {
  return {
    sampReference: '',
    objectives: structuredClone(defaultObjectives)
  };
}

export function normalizeCommittee(value = {}) {
  const defaults = defaultCommittee();
  return {
    body: String(value.body || defaults.body),
    audience: value.audience === 'vorstand' ? 'vorstand' : 'kommunal',
    meetingDate: String(value.meetingDate || ''),
    proposalText: String(value.proposalText || '')
  };
}

export function normalizeStrategy(value = {}) {
  const objectives = Array.isArray(value.objectives) && value.objectives.length
    ? value.objectives
    : defaultObjectives;
  return {
    sampReference: String(value.sampReference || ''),
    objectives: objectives.map((objective, index) => ({
      id: String(objective.id || `obj_${index + 1}`),
      label: String(objective.label || `Ziel ${index + 1}`),
      note: String(objective.note || '')
    }))
  };
}

export function normalizeProcessState(value = {}) {
  const defaults = defaultProcessState();
  const phaseIds = new Set(processPhases.map(([id]) => id));
  return {
    ...defaults,
    ...value,
    phase: phaseIds.has(value.phase) ? value.phase : defaults.phase,
    phaseTargets: { ...defaults.phaseTargets, ...(value.phaseTargets || {}) },
    resume: normalizePlanningResume(value.resume)
  };
}

export function newImpactAssumptionTemplate(measure = {}, baseYear = new Date().getFullYear()) {
  return {
    id: 'impact_' + Date.now().toString(36),
    area: 'qElement',
    title: 'Neue Wirkannahme',
    amount: 0,
    confidence: 'review',
    governance: 'sensitivity',
    startYear: Number(measure?.year) || Math.round(baseYear),
    endYear: '',
    attribution: 100,
    chain: '',
    evidence: '',
    evidenceType: 'open',
    legacyFlat: false,
    riskProbabilityBefore: 0,
    riskProbabilityAfter: 0,
    riskImpact: 0,
    note: ''
  };
}

export function normalizeTemplateImpact(template, index, year) {
  const impact = structuredClone(template);
  return {
    ...newImpactAssumptionTemplate({ year }, year),
    ...impact,
    id: 'impact_tpl_' + Date.now().toString(36) + '_' + index,
    confidence: impact.confidence || 'review',
    governance: impact.governance || 'sensitivity',
    startYear: year,
    endYear: '',
    evidence: impact.evidence || '',
    evidenceType: impact.evidenceType || 'open',
    note: impact.note || 'Richtwert aus Vorlage lokal prüfen und bestätigen.',
    legacyFlat: false
  };
}

export function measureFromTemplate(template, { baseYear, sector, defaults = {} } = {}) {
  const year = Math.max(Math.round(baseYear) || new Date().getFullYear(), new Date().getFullYear());
  const typicalCost = template.costRange?.[1] || 0;
  const checkNote = template.checkHints?.length
    ? 'Aus Vorlage angelegt. Lokal prüfen: ' + template.checkHints.join(' · ')
    : 'Aus Vorlage angelegt. Richtwerte lokal prüfen.';
  return {
    ...defaults,
    id: 'measure_' + Date.now().toString(36),
    active: true,
    name: template.name,
    cost: typicalCost,
    year,
    secure: template.secure,
    uncertain: template.uncertain,
    probability: template.probability,
    opexRecognition: template.opexRecognition,
    life: template.life,
    hgbLife: template.hgbLife || template.life,
    depr: sector === 'strom' ? 'normal' : template.depr,
    orgUnit: template.orgUnit || '',
    tags: ['Vorlage'],
    templateId: template.templateId,
    templateVersion: template.templateVersion,
    impactAssumptions: (template.impactSkeletons || []).map((impact, index) => normalizeTemplateImpact(impact, index, year)),
    note: checkNote
  };
}

export function normalizeMeasure(measure, index = 0, defaults = {}) {
  const impacts = Array.isArray(measure.impactAssumptions) ? structuredClone(measure.impactAssumptions) : [];
  return {
    ...defaults,
    ...measure,
    id: String(measure.id || 'import_' + Date.now().toString(36) + '_' + index),
    externalId: String(measure.externalId || ''),
    orgUnit: String(measure.orgUnit || ''),
    monitoringProfile: String(measure.monitoringProfile || 'none'),
    monitoringCategory: String(measure.monitoringCategory || ''),
    networkLevel: String(measure.networkLevel || ''),
    reportingRegion: String(measure.reportingRegion || ''),
    reportingStatus: String(measure.reportingStatus || ''),
    capacityImpact: String(measure.capacityImpact || ''),
    bottleneckRef: String(measure.bottleneckRef || ''),
    permitRequired: String(measure.permitRequired || 'unknown'),
    permitStatus: String(measure.permitStatus || ''),
    investmentDecisionStatus: String(measure.investmentDecisionStatus || 'unknown'),
    investmentDecisionDate: String(measure.investmentDecisionDate || ''),
    alternativesChecked: String(measure.alternativesChecked || ''),
    flexibilityNeed: String(measure.flexibilityNeed || ''),
    effectType: measure.effectType === 'flexibility' ? 'flexibility' : 'classic',
    flexibilityUseCase: String(measure.flexibilityUseCase || 'netzfahrplan'),
    flexibilityStatus: ['context', 'pruefpflichtig', 'quantified', 'active'].includes(measure.flexibilityStatus) ? measure.flexibilityStatus : 'context',
    regulatoryTreatment: String(measure.regulatoryTreatment || 'unknown'),
    networkScheduleRequired: measure.networkScheduleRequired !== false,
    networkScheduleStatus: String(measure.networkScheduleStatus || 'missing'),
    networkConstraintRef: String(measure.networkConstraintRef || ''),
    affectedNetworkLevel: String(measure.affectedNetworkLevel || ''),
    activationWindow: String(measure.activationWindow || ''),
    dispatchLogic: String(measure.dispatchLogic || ''),
    avoidedCapexTeur: Number(measure.avoidedCapexTeur) || 0,
    avoidedCapexConfidence: String(measure.avoidedCapexConfidence || 'none'),
    deferredCapexTeur: Number(measure.deferredCapexTeur) || 0,
    deferredCapexFromYear: measure.deferredCapexFromYear ?? '',
    deferredCapexToYear: measure.deferredCapexToYear ?? '',
    capexAvoidanceEvidenceRef: String(measure.capexAvoidanceEvidenceRef || ''),
    flexOpexPaTeur: Number(measure.flexOpexPaTeur) || 0,
    flexOpexStartYear: measure.flexOpexStartYear ?? '',
    flexOpexDurationYears: Number(measure.flexOpexDurationYears) || 0,
    opexRecognitionStatus: String(measure.opexRecognitionStatus || 'unknown'),
    opexEvidenceRef: String(measure.opexEvidenceRef || ''),
    agnesRelevant: Boolean(measure.agnesRelevant),
    agnesRole: String(measure.agnesRole || 'offen'),
    agnesIntegrationStatus: String(measure.agnesIntegrationStatus || 'not_assessed'),
    agnesDataNeeded: Array.isArray(measure.agnesDataNeeded) ? measure.agnesDataNeeded.map(String) : parseTags(measure.agnesDataNeeded),
    regulatoryStatus: String(measure.regulatoryStatus || 'current_law'),
    regulatoryStatusLabel: String(measure.regulatoryStatusLabel || ''),
    regulatoryStatusDate: String(measure.regulatoryStatusDate || ''),
    assumptionStatus: String(measure.assumptionStatus || 'confirmed'),
    capacityLimitedGridArea: Boolean(measure.capacityLimitedGridArea),
    capacityLimitedTechnology: String(measure.capacityLimitedTechnology || 'none'),
    redispatchCompensationWaiverEnabled: Boolean(measure.redispatchCompensationWaiverEnabled),
    redispatchCompensationWaiverLimitPct: Number(measure.redispatchCompensationWaiverLimitPct) || 20,
    windPriorityArea: Boolean(measure.windPriorityArea),
    redispatchRiskClass: String(measure.redispatchRiskClass || 'low'),
    annualRevenueAtRiskTeur: Number(measure.annualRevenueAtRiskTeur) || 0,
    connectionRequestPowerKw: Number(measure.connectionRequestPowerKw) || 0,
    voltageLevel: String(measure.voltageLevel || 'low_voltage'),
    connectionRequestStatus: String(measure.connectionRequestStatus || 'draft'),
    queueRiskClass: String(measure.queueRiskClass || 'low'),
    reservationExpiryDate: String(measure.reservationExpiryDate || ''),
    nextRequiredEvidence: String(measure.nextRequiredEvidence || ''),
    generationConnectionCostContributionEnabled: Boolean(measure.generationConnectionCostContributionEnabled),
    connectionCostContributionTeur: Number(measure.connectionCostContributionTeur) || 0,
    connectionCostContributionMode: String(measure.connectionCostContributionMode || 'none'),
    tags: parseTags(measure.tags),
    hgbLife: Number(measure.hgbLife) || Number(measure.life) || 1,
    importStatus: String(measure.importStatus || ''),
    sourceSystem: String(measure.sourceSystem || ''),
    sourceRecordId: String(measure.sourceRecordId || ''),
    scoringRef: String(measure.scoringRef || ''),
    assetSystemRef: String(measure.assetSystemRef || ''),
    erpRef: String(measure.erpRef || ''),
    riskDbRef: String(measure.riskDbRef || ''),
    sourceStatus: String(measure.sourceStatus || ''),
    riskEvidenceStatus: String(measure.riskEvidenceStatus || measure.riskAvoidedEvidenceStatus || ''),
    riskOwnerRole: String(measure.riskOwnerRole || ''),
    riskAssessmentStatus: String(measure.riskAssessmentStatus || ''),
    viabilityCategory: String(measure.viabilityCategory || ''),
    viabilityCategorySource: String(measure.viabilityCategorySource || ''),
    viabilityRationale: String(measure.viabilityRationale || ''),
    refinancingBridgeStatus: String(measure.refinancingBridgeStatus || ''),
    refinancingBridgeRefs: Array.isArray(measure.refinancingBridgeRefs) ? measure.refinancingBridgeRefs.map(String) : parseTags(measure.refinancingBridgeRefs),
    openViabilityQuestions: Array.isArray(measure.openViabilityQuestions) ? measure.openViabilityQuestions.map(String) : parseTags(measure.openViabilityQuestions),
    objectiveIds: Array.isArray(measure.objectiveIds) ? measure.objectiveIds.map(String) : [],
    templateId: String(measure.templateId || ''),
    templateVersion: String(measure.templateVersion || ''),
    opexPa: Number(measure.opexPa) || 0,
    opexDeltaPa: Number(measure.opexDeltaPa) || 0,
    reinvestCost: Number(measure.reinvestCost) || 0,
    reinvestMode: measure.reinvestMode === 'assetAddition' ? 'assetAddition' : 'oneOff',
    reinvestLife: Math.max(1, Math.round(Number(measure.reinvestLife) || Number(measure.life) || 1)),
    decommissionCost: Number(measure.decommissionCost) || 0,
    decommissionYear: measure.decommissionYear ?? '',
    impactAssumptions: impacts.map(impact => ({
      ...impact,
      evidenceType: impact.evidenceType || 'open',
      legacyFlat: impact.area === 'risk' && impact.legacyFlat !== false && !Number(impact.riskImpact)
    }))
  };
}
