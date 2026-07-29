import {
  activationSplitHelper,
  calcMeasure,
  calcPortfolio,
  clamp,
  defaultEffectLags,
  depreciationLifeHelper,
  expectedActivated,
  financingSpreadHelper,
  flexibilityHelper,
  gasTransformationHelper,
  gasTransformationInputForMeasure,
  impactAssumptionsFor,
  measureDrilldownFor,
  params as engineParams,
  portfolioDecisionMetrics,
  portfolioEffectFor,
  portfolioSensitivityTornadoFor,
  portfolioWaterfallFor,
  qImpactHelper,
  regulatoryParameterSet,
  regulatoryPeriodFor,
  riskExpectedValue,
  riskHelper,
  scenarioParams as engineScenarioParams,
  workstandReliabilityFor
} from './engine.js';
import {
  appendHistoryEvents,
  compareHistoryChains,
  diffModelEvents,
  emptyHistory,
  eventsAfter,
  eventSummary,
  latestEvent
} from './history.js';
import {
  buildPlanningResume,
  normalizePlanningResume,
  shouldShowPlanningResume
} from './planning-resume.js';
import { fieldHelp } from './contextual-help.js';
import {
  appStateForStoryMilestone,
  storyMilestoneForPhase,
  storyMilestoneFromUrl,
  storyUrlForMilestone
} from './story-navigation.js';
import {
  addUserProjectPlanTask,
  deleteUserProjectPlanTask,
  findProjectPlanTask,
  normalizeProjectPlan,
  projectPlanDeepLinkForTask,
  projectPlanMilestoneDate,
  projectPlanEffectiveTaskStates,
  projectPlanNextReadyTask,
  projectPlanNextReadyTasksByRole,
  projectPlanRoles,
  projectPlanStatusLabels,
  projectPlanStatuses,
  projectPlanStoryLabel,
  projectPlanTaskCounts,
  projectPlanTaskSourceLabels,
  projectPlanViewIds,
  projectPlanStoryKeys,
  projectPlanEvidenceLevels,
  resetProjectPlanTemplateState,
  updateProjectPlanTask as updateProjectPlanTaskModel
} from './project-plan.js';
import { buildInfo } from './build-info.js';
import {
  compareReleaseManifest,
  releaseCheckSummary,
  releaseManifestUrl,
  rulesetConfidenceClasses,
  rulesetInfo,
  supportContext,
  supportIssueUrl,
  supportPackage
} from './release-awareness.js';
import { imprintSections } from './trust-content.js';
import { demoMeasures, initialMeasures } from './demo-data.js';
import { downloadBlob, exportStamp, htmlWithEmbeddedModelState } from './export-utils.js';
import {
  esc,
  formatDateShort,
  fmtEur,
  fmtPct,
  fmtPlain,
  fmtTeur,
  fmtTeurPerYear,
  normalizeGermanTeurText
} from './render-utils.js';
import { buildAiPrompt, defaultAiPromptOptions, promptRoles } from './ai-prompt-generator.js';
import { spreadsheetTables, tablesToCsvZip, tablesToXlsx } from './spreadsheet-export.js';
import {
  normalizeSidecar,
  normalizeSidecarObject,
  sidecarProfiles,
  sidecarSummary,
  sanitizeSidecarForExport
} from './sidecar.js';
import {
  bulkImportSteps,
  committeeIds,
  confidenceLabels,
  defaultObjectives,
  detailIds,
  evidenceTypeLabels,
  governanceLabels,
  impactAreaLabels,
  importFields,
  importHeaderSynonyms,
  inputDefaults,
  inputIds,
  measureTemplates,
  processPhases,
  roleProfiles
} from './ui-config.js';

const el = Object.fromEntries([...inputIds, ...detailIds, ...committeeIds].map(id => [id, document.getElementById(id)]));
let measures = structuredClone(initialMeasures);
let selectedId = measures[0]?.id;
let scenario = 'basis';
let activeView = 'akte';
let reportMode = 'management';
let meetingFocus = 'management';
let meetingTextOverrides = {};
let meetingTextEdit = null;
let wizard = null;
let lastStickySnapshot = null;
const storageKey = 'regulierte-sparten-szenario-rechner-v1';
const expertModeKey = 'regulierte-sparten-szenario-rechner-expert-mode';
const authorKey = 'regulierte-sparten-szenario-rechner-author';
const lastSeenEventKey = 'regulierte-sparten-szenario-rechner-last-seen-event';
const roleKey = 'regulierte-sparten-szenario-rechner-role';
const legacyStorageKeys = [];
const modelVersion = 8;
const appVersion = '0.3.1';
let storageStatusTimer = null;
let expertMode = false;
let history = emptyHistory();
let previousModelForHistory = null;
let suppressHistoryEvents = false;
let processState = defaultProcessState();
let projectPlan = normalizeProjectPlan({}, Number(document.getElementById('baseYear')?.value) || 2027);
let activeProjectTaskId = '';
let strategy = defaultStrategy();
let committee = defaultCommittee();
let currentRole = 'owner';
let clarificationStatus = {};
let pendingClarificationAudit = null;
let measureEditClarificationContext = null;
let measureEditReturnView = '';
let measureEditNavigationIds = [];
let measureEditNavigationClarificationKeys = [];
let pendingMeasureFocusTarget = '';
let pendingMeasureFocusLabel = '';
let lastReleaseCheck = null;
let releaseCheckInProgress = false;
let pendingImportReview = null;
let basisEditing = false;
let expertFilter = 'all';
let resultViewMode = 'regulatory';
let catalogGroupBy = 'orgUnit';
let catalogFilters = defaultCatalogFilters();
let selectedCatalogIds = new Set();
let collapsedCatalogGroups = {};
let quickCatalogMode = '';
let bulkImportState = null;
let importMapping = {};
let sidecar = normalizeSidecar();
let selectedSidecarId = '';
let sidecarFilterDivision = 'all';
let sidecarModeFilter = 'all';

function defaultCatalogFilters() {
  return {
    search: '',
    type: 'all',
    active: 'all',
    openOnly: false,
    importedOnly: false,
    yearFrom: '',
    yearTo: '',
    tag: ''
  };
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value || '').split(/[;,]/).map(item => item.trim()).filter(Boolean);
}

function tagsText(tags) {
  return parseTags(tags).join(', ');
}

function orgUnitValues() {
  return [...new Set(measures.map(measure => String(measure.orgUnit || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
}

function hasOpenMeasureItem(measure) {
  return impactCounts(measure).review > 0 || String(measure.note || '').trim().length > 0;
}

function defaultCommittee() {
  return {
    body: 'Gemeinderat',
    audience: 'kommunal',
    meetingDate: '',
    proposalText: ''
  };
}

function defaultProcessState() {
  const phaseTargets = Object.fromEntries(processPhases.map(([id]) => [id, '']));
  return {
    phase: 'massnahmenbewertung',
    phaseTargets,
    resume: normalizePlanningResume(),
    startedAt: new Date().toISOString()
  };
}

function defaultStrategy() {
  return {
    sampReference: '',
    objectives: structuredClone(defaultObjectives)
  };
}

function normalizeCommittee(value = {}) {
  const defaults = defaultCommittee();
  return {
    body: String(value.body || defaults.body),
    audience: value.audience === 'vorstand' ? 'vorstand' : 'kommunal',
    meetingDate: String(value.meetingDate || ''),
    proposalText: String(value.proposalText || '')
  };
}

function syncCommitteeFields() {
  if (!el.committeeBody) return;
  if (document.activeElement && committeeIds.includes(document.activeElement.id)) return;
  el.committeeBody.value = committee.body;
  el.committeeAudience.value = committee.audience;
  el.committeeMeetingDate.value = committee.meetingDate;
  el.committeeProposalText.value = committee.proposalText;
}

function collectCommitteeFields() {
  committee = normalizeCommittee({
    body: el.committeeBody.value,
    audience: el.committeeAudience.value,
    meetingDate: el.committeeMeetingDate.value,
    proposalText: el.committeeProposalText.value
  });
}

function normalizeStrategy(value = {}) {
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

function normalizeProcessState(value = {}) {
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

function phaseLabel(phase = processState.phase) {
  return processPhases.find(([id]) => id === phase)?.[1] || 'Maßnahmenbewertung';
}

function phaseStepperLabel(phase, label = phaseLabel(phase)) {
  const compactLabels = {
    initialisierung: 'Start',
    datenerhebung: 'Daten',
    massnahmenbewertung: 'Maßnahmen',
    konsolidierung: 'Konsolid.',
    entscheidungsvorlage: 'Vorlage',
    archiv: 'Archiv'
  };
  return compactLabels[phase] || label;
}

function loadRole() {
  try {
    const stored = localStorage.getItem(roleKey);
    if (stored && roleProfiles[stored]) currentRole = stored;
  } catch (_error) {}
}

function saveRole() {
  try {
    localStorage.setItem(roleKey, currentRole);
  } catch (_error) {}
}

function applyRole(role, persist = true) {
  if (!roleProfiles[role]) return;
  currentRole = role;
  if (persist) saveRole();
  document.body.dataset.role = role;
  document.body.classList.toggle('role-readonly', role === 'management' || role === 'audit');
  document.querySelectorAll('[data-role-choice]').forEach(button => {
    button.classList.toggle('active', button.dataset.roleChoice === role);
  });
  document.querySelectorAll('.role-pill').forEach(node => {
    node.textContent = roleProfiles[role].label;
  });
  const readonlyPill = document.getElementById('readonlyPill');
  if (readonlyPill) readonlyPill.classList.toggle('hidden', !(role === 'management' || role === 'audit'));
}

function isReadOnlyRole() {
  return currentRole === 'management' || currentRole === 'audit';
}

function applyReadonlyMode() {
  const readOnly = isReadOnlyRole();
  const selectors = [
    'main input', 'main select', 'main textarea',
    '.process-controls input', '.process-controls select', '.process-controls textarea',
    '#measureEditModal input', '#measureEditModal select', '#measureEditModal textarea',
    '#meetingTextModal input', '#meetingTextModal textarea'
  ];
  document.querySelectorAll(selectors.join(',')).forEach(node => {
    node.disabled = readOnly;
  });
  [
    'newMeasure', 'toggleAllInCatalog', 'addImpactAssumption', 'addObjective',
    'openBasisWizard', 'toggleBasisEdit', 'meetingTextSave', 'meetingTextReset'
  ].forEach(id => {
    const node = document.getElementById(id);
    if (node) node.disabled = readOnly;
  });
}

const expertFieldIds = [
  'rab', 'returnRate', 'financingRate', 'capitalCostMode', 'equityShare', 'equityReturnRate', 'debtShare', 'debtReturnRate', 'deductionCapital', 'discountRate', 'kanuEndYear',
  'degressiveRate', 'taxFactor', 'portfolioAttribution', 'capexLagYears', 'opexLagYears', 'qeLagYears', 'qDelta', 'eDelta',
  'mType', 'mSecure', 'mUncertain', 'mProbability', 'mOpexRecognition',
  'mDepr', 'mQDirect', 'mEDirect', 'mRiskAvoided', 'mPortfolioShare',
  'mOpexPa', 'mOpexDeltaPa', 'mReinvestCost', 'mReinvestMode', 'mReinvestLife', 'mDecommissionCost',
  'mDecommissionYear', 'mHgbLife', 'mGasTransformationPath', 'mGasAssetScope', 'mGasObligationBasis',
  'mGasEternityAssumption', 'mGasProvisionAssessment', 'mGasRegulatoryTreatment', 'mGasTransformationEvidence'
];

function periodText(period) {
  return `${period.id} ${period.start}-${period.end}`;
}

function periodDetailText(period) {
  return `${period.label} (${period.start}-${period.end})${period.known ? '' : ', fortgeschrieben'}`;
}

function num(id) {
  const value = Number(el[id].value);
  return Number.isFinite(value) ? value : 0;
}

function currentInputs() {
  return Object.fromEntries(inputIds.map(id => [id, el[id].value]));
}

function currentParams(overrides = {}) {
  return engineParams(currentInputs(), overrides);
}

function currentScenarioParams(name) {
  return engineScenarioParams(currentParams(), name);
}

function portfolioModel() {
  return { measures };
}

function currentPortfolio(p = currentParams()) {
  return calcPortfolio(portfolioModel(), p);
}

function newImpactAssumptionTemplate(measure = selectedMeasure()) {
  return {
    id: 'impact_' + Date.now().toString(36),
    area: 'qElement',
    title: 'Neue Wirkannahme',
    amount: 0,
    confidence: 'review',
    governance: 'sensitivity',
    startYear: Number(measure?.year) || Math.round(num('baseYear')),
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

function normalizeMeasureForUi(measure, index = 0) {
  const impacts = Array.isArray(measure.impactAssumptions) ? structuredClone(measure.impactAssumptions) : [];
  return {
    ...newMeasureTemplate(index + 1),
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

function normalizeTemplateImpact(template, index, year) {
  const impact = structuredClone(template);
  return {
    ...newImpactAssumptionTemplate({ year }),
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

function measureFromTemplate(template) {
  const year = Math.max(Math.round(num('baseYear')) || new Date().getFullYear(), new Date().getFullYear());
  const typicalCost = template.costRange?.[1] || 0;
  const checkNote = template.checkHints?.length
    ? 'Aus Vorlage angelegt. Lokal prüfen: ' + template.checkHints.join(' · ')
    : 'Aus Vorlage angelegt. Richtwerte lokal prüfen.';
  return {
    ...newMeasureTemplate(measures.length + 1),
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
    depr: el.sector.value === 'strom' ? 'normal' : template.depr,
    orgUnit: template.orgUnit || '',
    tags: ['Vorlage'],
    templateId: template.templateId,
    templateVersion: template.templateVersion,
    impactAssumptions: (template.impactSkeletons || []).map((impact, index) => normalizeTemplateImpact(impact, index, year)),
    note: checkNote
  };
}

function confidenceBadge(confidence) {
  const cls = confidence === 'proven' ? 'good' : confidence === 'assumption' ? 'warn' : 'bad';
  return `<span class="assumption-badge ${cls}">${confidenceLabels[confidence] || 'prüfpflichtig'}</span>`;
}

function impactAreaLabel(area) {
  return impactAreaLabels[area] || 'Wirkung';
}

function impactGovernanceLabel(governance) {
  return governanceLabels[governance] || 'Sensitivität';
}

function objectiveLabel(id) {
  return strategy.objectives.find(objective => objective.id === id)?.label || id;
}

function renderStrategyEditor() {
  const ref = document.getElementById('strategySampReference');
  if (ref) ref.value = strategy.sampReference;
  const list = document.getElementById('strategyObjectives');
  if (!list) return;
  list.innerHTML = strategy.objectives.map((objective, index) => `
    <article class="objective-item" data-objective-id="${esc(objective.id)}">
      <div>
        <label for="objectiveLabel_${index}">Ziel</label>
        <input id="objectiveLabel_${index}" type="text" data-objective-field="label" data-objective-id="${esc(objective.id)}" value="${esc(objective.label)}">
      </div>
      <div>
        <label for="objectiveNote_${index}">Notiz</label>
        <input id="objectiveNote_${index}" type="text" data-objective-field="note" data-objective-id="${esc(objective.id)}" value="${esc(objective.note)}" placeholder="optional">
      </div>
      <button type="button" data-action="removeObjective" data-objective-id="${esc(objective.id)}" ${strategy.objectives.length <= 1 ? 'disabled' : ''}>Entfernen</button>
    </article>
  `).join('');
}

function renderMeasureObjectives(measure) {
  const node = document.getElementById('measureObjectives');
  if (!node) return;
  const selected = new Set(measure?.objectiveIds || []);
  node.innerHTML = strategy.objectives.map(objective => `
    <label class="check-option">
      <input type="checkbox" data-objective-id="${esc(objective.id)}" ${selected.has(objective.id) ? 'checked' : ''}>
      <span>${esc(objective.label)}</span>
    </label>
  `).join('') || '<p class="hint">Noch keine Ziele hinterlegt.</p>';
}

function objectivePills(measure) {
  const ids = Array.isArray(measure.objectiveIds) ? measure.objectiveIds : [];
  return ids.length
    ? ids.map(id => `<span class="pill">${esc(objectiveLabel(id))}</span>`).join('')
    : '<span class="pill warn">ohne Ziel</span>';
}

function renderBasisSummaryCards() {
  const node = document.getElementById('basisSummaryCards');
  if (!node) return;
  const p = currentParams();
  const objectiveNames = strategy.objectives.map(objective => objective.label).slice(0, 4).join(' · ');
  const portfolioText = `${fmtPct(num('qDelta'), 2)} Q · ${fmtPct(num('eDelta'), 2)} E · ${fmtPct(num('portfolioAttribution'), 0)} Attribution`;
  const cards = [
    {
      title: 'Basisdaten Sparte',
      value: `${el.sector.value === 'gas' ? 'Gas' : 'Strom'} · Start ${p.baseYear} · EOG ${fmtTeur(p.baseEog, 0)} · RAB ${fmtTeur(p.rab, 0)}`,
      meta: `${periodText(p.regulatoryPeriod)} · Kostenbasis ${p.regulatoryPeriod.costBaseYear}`
    },
    {
      title: 'Strategische Ziele',
      value: strategy.sampReference || 'Keine Strategie-/Planreferenz hinterlegt',
      meta: objectiveNames || 'Noch keine Ziele gepflegt'
    },
    {
      title: 'Szenario',
      value: `${scenarioLabel(scenario)} · Horizont ${p.horizon} Jahre · Diskontsatz ${fmtPct(p.discountRate * 100, 1)}`,
      meta: `KANU-Ziel ${p.kanuEndYear} · Wirkungsverzug CAPEX/OPEX/QE ${p.effectLags.capex}/${p.effectLags.opex}/${p.effectLags.qe} Jahre`
    },
    {
      title: 'Portfolio-Wirkung',
      value: portfolioText,
      meta: 'Globale Q-/E-Wirkung wird über Attribution auf Maßnahmen verteilt'
    }
  ];
  node.innerHTML = cards.map(card => `
    <article class="summary-card">
      <div>
        <h3>${esc(card.title)}</h3>
        <p class="summary-value">${esc(card.value)}</p>
        <p class="summary-meta">${esc(card.meta)}</p>
      </div>
      <button type="button" data-action="editBasis" aria-label="${esc(card.title)} bearbeiten">✎</button>
    </article>
  `).join('');
  document.body.classList.toggle('basis-editing', basisEditing);
  const toggle = document.getElementById('toggleBasisEdit');
  if (toggle) toggle.textContent = basisEditing ? 'Bearbeiten ausblenden' : 'Bearbeiten einblenden';
}

function allImpactAssumptions(filterActive = false) {
  return measures
    .filter(measure => !filterActive || measure.active)
    .flatMap(measure => impactAssumptionsFor(measure).map(impact => ({ ...impact, measure })));
}

function reviewRequiredImpacts(filterActive = false) {
  return allImpactAssumptions(filterActive)
    .filter(item => item.confidence === 'review' || item.governance === 'sensitivity');
}

function impactWorkArea(impact) {
  if (impact.area === 'risk' || impact.area === 'qElement') return 'technik';
  if (impact.area === 'costBase' || impact.area === 'portfolio') return 'vnb';
  return 'controlling';
}

function workItemColumn(item) {
  if (item.status === 'closed') return 'closed';
  if (['high', 'evidence', 'normal'].includes(item.column)) return item.column;
  const label = item.priority?.label || 'normal';
  if (label === 'hoch') return 'high';
  if (label === 'mittel') return 'evidence';
  return 'normal';
}

function projectTaskIdForClarification(key = '') {
  return `user-clarification-${String(key).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)}`;
}

function projectMilestoneForClarification(item = {}) {
  const target = item.targetPhase || 'massnahmenbewertung';
  if (target === 'konsolidierung') return 'm5';
  if (target === 'entscheidungsvorlage') return 'm6';
  if (target === 'datenerhebung') return 'm2';
  return item.type === 'impact' ? 'm4' : 'm3';
}

function projectTaskForClarification(item = {}) {
  return findProjectPlanTask(projectPlan, projectTaskIdForClarification(item.key));
}

function clarificationTargetFor(item = {}) {
  if (item.type === 'sidecar') {
    return { fieldId: 'sidecarOpenQuestions', label: 'Sidecar-Prüfpunkt', task: 'Evidenzobjekt, offene Prüffrage oder Überleitungslogik prüfen' };
  }
  if (item.type === 'system_reference') {
    return { fieldId: 'mSourceSystem', label: 'Quellsystem / Datensatz', task: 'Rückspielweg und Systemreferenz ergänzen' };
  }
  if (item.type === 'risk_evidence') {
    return { fieldId: 'mRiskEvidenceStatus', label: 'Risiko-Evidenzstatus', task: 'Störungs-/Risikowirkung fachlich belegen oder offen markieren' };
  }
  if (item.type === 'target_mapping') {
    return { fieldId: 'measureObjectives', label: 'Trägt bei zu', task: 'Ziel-Zuordnung und Dokumentationsbezug der Maßnahme ergänzen' };
  }
  if (item.type === 'measure_documentation') {
    return { fieldId: 'mNote', label: 'Notiz zur Maßnahme', task: 'fehlende Maßnahmendokumentation ergänzen' };
  }
  if (item.type === 'note') {
    return { fieldId: 'mNote', label: 'Notiz zur Maßnahme', task: 'fachliche Maßnahmennotiz prüfen oder ergänzen' };
  }
  if (item.type === 'impact') {
    return { fieldId: 'impactAssumptions', label: 'Wirkannahmen / Evidenz', task: 'Wirkannahme, Evidenz und Governance-Status prüfen' };
  }
  if (/doppelzähl/i.test(`${item.type} ${item.title} ${item.detail}`)) {
    return { fieldId: 'mPortfolioShare', label: 'Portfolioanteil / Doppelzählung', task: 'Portfolioanteil und mögliche Doppelzählung prüfen' };
  }
  if (/risiko|risk/i.test(`${item.area} ${item.title} ${item.detail}`)) {
    return { fieldId: 'mRiskEvidenceStatus', label: 'Risiko-Mapping / Evidenzstatus', task: 'Risiko-Mapping und Evidenzstatus prüfen' };
  }
  return { fieldId: 'mNote', label: 'Bearbeitungsnotiz', task: 'Datenstelle prüfen und Klärnotiz erfassen' };
}

function ensureClarificationProjectTask(item, status = 'in_progress', note = '') {
  if (!item?.key) return '';
  const taskId = projectTaskIdForClarification(item.key);
  const existing = findProjectPlanTask(projectPlan, taskId);
  const target = clarificationTargetFor(item);
  const patch = {
    status,
    note: note || item.detail || '',
    title: `Klärung: ${item.title}`,
    ownerRole: target.fieldId === 'mNote' ? 'assetmanagement' : 'regulierungsmanagement',
    targetView: item.type === 'sidecar' ? 'sidecar' : 'measures',
    deepLinkKey: item.targetPhase || 'massnahmenbewertung',
    evidenceRequired: 'beleg',
    resultArtifact: `${target.label} für ${item.measure || 'Maßnahme'} geprüft; Audit-Notiz gespeichert`,
    origin: `Klärpunkt-Kanban · ${item.key}`
  };
  if (existing) {
    updateProjectTask(taskId, patch, false);
    return taskId;
  }
  projectPlan = addUserProjectPlanTask(projectPlan, projectMilestoneForClarification(item), {
    id: taskId,
    dueOffsetDays: 0,
    ...patch
  });
  return taskId;
}

function renderWorkItemCard(item) {
  const priority = item.priority?.label || 'normal';
  const detail = String(item.detail || '').trim();
  const target = clarificationTargetFor(item);
  const actionLabel = item.status === 'closed' ? 'Audit ansehen' : item.measureId ? 'Bearbeiten' : item.sidecarId ? 'Evidenz öffnen' : 'Prüfen';
  const projectTask = projectTaskForClarification(item);
  return `
    <article class="work-kanban-card ${item.status === 'closed' ? 'closed' : ''}" data-work-item="${esc(item.key)}">
      <div class="work-card-topline">
        <span class="priority-badge priority-${esc(priority)}">${esc(priority)}</span>
        <span>${esc(item.area)}</span>
      </div>
      <strong>${esc(item.title)}</strong>
      <div class="row-actions compact-actions work-card-primary-action">
        <button type="button" class="primary" data-action="openWorkItem" data-clarification-key="${esc(item.key)}" data-measure-id="${esc(item.measureId || '')}" data-sidecar-id="${esc(item.sidecarId || '')}">${actionLabel}</button>
      </div>
      <p>${esc(item.measure)}</p>
      ${detail ? `<small title="${esc(detail)}">${esc(detail)}</small>` : ''}
      <div class="work-card-guidance">
        <span>Aufgabe: ${esc(target.task)}</span>
        <span>${projectTask ? `Projektplan: ${esc(projectPlanStatusLabels[projectTask.task.status] || projectTask.task.status)}` : 'wird beim Bearbeiten im Projektplan gespiegelt'}</span>
      </div>
    </article>
  `;
}

function expertWorkItems() {
  const impactItems = reviewRequiredImpacts(true).map(item => ({
    key: item.measure.id + ':' + item.id,
    measureId: item.measure.id,
    impactId: item.id,
    title: item.title,
    measure: item.measure.name,
    area: impactWorkArea(item),
    detail: `${impactAreaLabel(item.area)} · ${confidenceLabels[item.confidence]} · ${impactGovernanceLabel(item.governance)}${item.note ? ' · ' + item.note : ''}`,
    priority: clarificationPriorityFor({ area: item.area, title: item.title, detail: item.note, type: 'impact' }),
    status: clarificationStatus[item.measure.id + ':' + item.id]?.status || 'open',
    type: 'impact'
  }));
  const clarificationWork = clarificationItems().map(item => ({
    ...item,
    area: item.area === 'Risiko' || item.area === 'Q-Element' ? 'technik' : item.area === 'Portfolio' || item.area === 'Kostenbasis' ? 'vnb' : item.area === 'Evidenz' || item.area === 'Sidecar' ? 'vnb' : 'controlling',
    type: item.type || 'clarification'
  }));
  return [...impactItems, ...clarificationWork];
}

function textPresent(value) {
  return Boolean(String(value ?? '').trim());
}

function weakEvidenceStatus(status = '') {
  return ['missing', 'stated', 'conflicting', 'stale'].includes(String(status || 'missing'));
}

function measureEvidenceItems() {
  const active = measures.filter(measure => measure.active);
  const items = [];
  active.forEach(measure => {
    if (!measureHasSystemReference(measure)) {
      items.push({
        key: `system-reference:${measure.id}`,
        type: 'system_reference',
        measureId: measure.id,
        area: 'Evidenz',
        column: 'evidence',
        targetPhase: 'konsolidierung',
        title: 'Systemreferenz / Rückspielweg ergänzen',
        measure: measure.name,
        detail: 'Quellsystem und Datensatz-/PSP-/Objektreferenz fehlen oder sind nicht vollständig dokumentiert.'
      });
    }
    if (Number(measure.riskAvoided || 0) > 0 && !measureHasRiskEvidence(measure)) {
      items.push({
        key: `risk-evidence:${measure.id}`,
        type: 'risk_evidence',
        measureId: measure.id,
        area: 'Evidenz',
        column: 'evidence',
        targetPhase: 'massnahmenbewertung',
        title: 'Störungs-/Risikowirkung belegen',
        measure: measure.name,
        detail: 'Die Maßnahme trägt einen Risiko-/Störungswert, aber Evidenzstatus, Wirkungskette oder Quelle sind noch nicht belastbar dokumentiert.'
      });
    }
    if (!(measure.objectiveIds || []).length) {
      items.push({
        key: `target-mapping:${measure.id}`,
        type: 'target_mapping',
        measureId: measure.id,
        area: 'Dokumentation',
        column: 'normal',
        targetPhase: 'entscheidungsvorlage',
        title: 'Ziel-Zuordnung dokumentieren',
        measure: measure.name,
        detail: 'Die Maßnahme ist noch keinem Aktenziel zugeordnet; dadurch bleibt der Entscheidungs- und Dokumentationsbezug unklar.'
      });
    }
    if (!textPresent(measure.note)) {
      items.push({
        key: `measure-documentation:${measure.id}`,
        type: 'measure_documentation',
        measureId: measure.id,
        area: 'Dokumentation',
        column: 'normal',
        targetPhase: 'konsolidierung',
        title: 'Maßnahmendokumentation ergänzen',
        measure: measure.name,
        detail: 'Fachliche Maßnahmennotiz fehlt; Anlass, Quelle oder Begründung sollten dokumentiert werden.'
      });
    }
  });
  return items;
}

function sidecarClarificationItems() {
  return (sidecar.objects || [])
    .filter(object => object.status !== 'archived')
    .map(object => {
      const reasons = [];
      if (object.openQuestions?.length) reasons.push(`${object.openQuestions.length} offene Prüffrage(n)`);
      if (weakEvidenceStatus(object.evidenceStatus)) reasons.push(`Evidenzstatus: ${sidecarEvidenceLabel(object)}`);
      if (object.type === 'data_quality' && object.evidenceStatus !== 'validated') reasons.push('Datenqualitätsobjekt nicht validiert');
      if (sidecarHasOpenBridgeLogic(object)) reasons.push('wirtschaftliche Überleitungslogik offen');
      if (String(object.reviewStatus || '').match(/not_reviewed|needs_update|open|offen/i)) reasons.push('Reviewstatus offen');
      if (!reasons.length) return null;
      return {
        key: `sidecar:${object.id}`,
        type: 'sidecar',
        sidecarId: object.id,
        area: 'Sidecar',
        column: 'evidence',
        targetPhase: 'konsolidierung',
        title: 'Evidenz-/Sidecar-Prüfpunkt klären',
        measure: object.title,
        detail: reasons.join(' · ')
      };
    })
    .filter(Boolean);
}

function renderExpertWorkList() {
  const node = document.getElementById('expertWorkList');
  if (!node) return;
  const items = expertWorkItems()
    .filter(item => expertFilter === 'all' || item.area === expertFilter);
  if (!items.length) {
    node.innerHTML = '<div class="empty-state"><div class="empty-icon">✓</div><strong>Alles geklärt</strong><p>Für den gewählten Bereich liegen keine offenen prüfpflichtigen Punkte vor.</p></div>';
    return;
  }
  const columns = [
    { key: 'high', title: 'Hohe Steuerungswirkung', hint: 'zuerst im Meeting klären' },
    { key: 'evidence', title: 'Evidenz / Systeme', hint: 'Quelle oder Rückspielweg prüfen' },
    { key: 'normal', title: 'Dokumentation', hint: 'Notiz, Phase oder Prozess schärfen' },
    { key: 'closed', title: 'Geklärt', hint: 'auditierbar geschlossen' }
  ];
  const grouped = columns.reduce((acc, column) => ({ ...acc, [column.key]: [] }), {});
  items.forEach(item => grouped[workItemColumn(item)].push(item));
  node.innerHTML = `
    <div class="work-kanban-board" aria-label="Klärpunkt-Kanban">
      ${columns.map(column => `
        <section class="work-kanban-column ${column.key}" aria-label="${esc(column.title)}">
          <div class="work-kanban-column-head">
            <strong>${esc(column.title)}</strong>
            <span>${grouped[column.key].length}</span>
            <small>${esc(column.hint)}</small>
          </div>
          <div class="work-kanban-column-body">
            ${grouped[column.key].length ? grouped[column.key].map(renderWorkItemCard).join('') : '<p class="hint empty-column">Keine Punkte</p>'}
          </div>
        </section>
      `).join('')}
    </div>
  `;
}

function impactCounts(measure) {
  const impacts = impactAssumptionsFor(measure);
  return {
    total: impacts.length,
    proven: impacts.filter(impact => impact.confidence === 'proven').length,
    assumption: impacts.filter(impact => impact.confidence === 'assumption').length,
    review: impacts.filter(impact => impact.confidence === 'review').length
  };
}

function scenarioVerdictSignature() {
  return ['basis', 'konservativ', 'wert'].map(name => decisionFor(currentPortfolio(currentScenarioParams(name))).title);
}

function clarificationKey(item) {
  return item.key;
}

function clarificationPriorityFor(item = {}) {
  const text = [item.area, item.title, item.detail, item.type].filter(Boolean).join(' ').toLowerCase();
  if (/risiko|risk|q-element|q\/e|eog|rab|aktivier|cashflow|kapitalwert|irr|verzinsung|kanu/.test(text)) {
    return { level: 1, label: 'hoch', driver: 'Rechen-/Steuerungswirkung' };
  }
  if (/quelle|evidenz|system|daten|mapping|sidecar|wirkannahme|doppelzähl/.test(text)) {
    return { level: 2, label: 'mittel', driver: 'Evidenz / Datenqualität' };
  }
  return { level: 3, label: 'normal', driver: 'Dokumentation / Prozess' };
}

function clarificationItems() {
  const impactItems = reviewRequiredImpacts(true).map(item => ({
    key: `impact:${item.measure.id}:${item.id}`,
    type: 'impact',
    measureId: item.measure.id,
    impactId: item.id,
    area: impactAreaLabel(item.area),
    targetPhase: 'massnahmenbewertung',
    title: item.title,
    measure: item.measure.name,
    detail: item.note || item.evidence || 'Wirkannahme prüfen und Vertrauensstufe/Governance bestätigen.'
  }));
  const noteItems = measures
    .filter(measure => measure.active && String(measure.note || '').trim())
    .map(measure => ({
      key: `note:${measure.id}`,
      type: 'note',
      measureId: measure.id,
      area: 'Maßnahme',
      targetPhase: 'konsolidierung',
      title: 'Maßnahmennotiz klären',
      measure: measure.name,
      detail: measure.note
    }));
  const result = currentPortfolio();
  const warningItems = result.warnings
    .filter(warning => warning.type === 'possible_double_counting')
    .map(warning => ({
      key: warning.key,
      type: warning.type,
      measureId: warning.measureId || measures.find(measure => measure.name === warning.measure)?.id || '',
      area: warning.area,
      targetPhase: warning.targetPhase,
      title: warning.title,
      measure: warning.measure,
      detail: warning.detail || 'mögliche Doppelzählung prüfen.'
    }));
  return [...impactItems, ...warningItems, ...noteItems, ...measureEvidenceItems(), ...sidecarClarificationItems()]
    .map(item => {
      const priority = clarificationPriorityFor(item);
      return {
        ...item,
        priority,
        status: clarificationStatus[clarificationKey(item)]?.status || 'open'
      };
    })
    .sort((a, b) => a.priority.level - b.priority.level || String(a.measure || '').localeCompare(String(b.measure || ''), 'de'));
}

function maturityScore() {
  const activeImpacts = allImpactAssumptions(true);
  const reviewItems = reviewRequiredImpacts(true);
  const clarifications = clarificationItems();
  const openClarifications = clarifications.filter(item => item.status !== 'closed');
  const basisComplete = Boolean(el.sector.value) && num('baseYear') > 0 && num('baseEog') > 0;
  const confirmedShare = activeImpacts.length
    ? activeImpacts.filter(item => item.confidence === 'proven' && item.governance === 'basis').length / activeImpacts.length
    : 0;
  const reviewPenalty = activeImpacts.length ? reviewItems.length / activeImpacts.length : 0;
  const verdicts = scenarioVerdictSignature();
  const verdictStable = new Set(verdicts).size <= 1;
  const activeCount = measures.filter(measure => measure.active).length;
  let score = 0;
  score += basisComplete ? 20 : 0;
  score += activeCount > 0 ? 20 : 0;
  score += Math.round(confirmedShare * 25);
  score += Math.max(0, 20 - Math.round(reviewPenalty * 20));
  score += verdictStable ? 10 : 4;
  score += openClarifications.length === 0 ? 5 : 0;
  return {
    score: Math.max(0, Math.min(100, score)),
    blockers: openClarifications.length,
    reviewCount: reviewItems.length,
    openClarifications,
    verdictStable
  };
}

function maturityRingHtml(score, blockers, size = 58) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  return `
    <svg class="maturity-ring" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="Entscheidungsreife ${score} Prozent">
      <circle class="ring-bg" cx="32" cy="32" r="${radius}"></circle>
      <circle class="ring-value" cx="32" cy="32" r="${radius}" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
      <text x="32" y="35" text-anchor="middle">${score}</text>
      ${blockers ? `<circle class="ring-blocker" cx="49" cy="15" r="5"></circle>` : ''}
    </svg>
  `;
}

function projectPlanProgressText(counts = projectPlanTaskCounts(projectPlan)) {
  return `${counts.completed}/${counts.total} erledigt · ${counts.byStatus.blocked || 0} blockiert`;
}

function projectPlanDependencyHint(state) {
  if (!state?.dependencyBlocked) return '';
  return ` · gesperrt bis ${esc(state.missingDependencies.join(', '))} erledigt`;
}

function renderProjectTimeline(plan) {
  const milestones = plan.milestones || [];
  const maxOffset = Math.max(...milestones.map(milestone => milestone.plannedOffsetMonths), 9) || 9;
  return `
    <div class="project-timeline" aria-label="Meilenstein-Timeline">
      ${milestones.map(milestone => {
        const counts = projectPlanTaskCounts({ milestones: [milestone] });
        const left = Math.max(0, Math.min(100, milestone.plannedOffsetMonths / maxOffset * 100));
        const doneRatio = counts.total ? counts.completed / counts.total : 0;
        return `
          <article class="project-milestone ${doneRatio === 1 ? 'done' : ''}" style="--offset:${left}%; --done:${Math.round(doneRatio * 100)}%;">
            <div class="project-milestone-bar"><span></span></div>
            <div class="project-milestone-copy">
              <strong>${esc(milestone.id.toUpperCase())} · ${esc(milestone.title)}</strong>
              <span>${esc(projectPlanMilestoneDate(plan.baseYear, milestone.plannedOffsetMonths))} · ${esc(projectPlanRoles[milestone.leadRole] || milestone.leadRole)} · ${counts.completed}/${counts.total}</span>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderProjectRoleSwimlanes(plan) {
  const tasks = (plan.milestones || []).flatMap(milestone => (milestone.tasks || []).map(item => ({ ...item, milestoneTitle: milestone.title })));
  const nextByRole = projectPlanNextReadyTasksByRole(plan);
  return `
    <div class="project-role-lanes" aria-label="Rollen-Swimlanes">
      ${Object.entries(projectPlanRoles).map(([roleId, label]) => {
        const roleTasks = tasks.filter(item => item.ownerRole === roleId);
        const done = roleTasks.filter(item => item.status === 'done').length;
        const next = nextByRole[roleId];
        return `
          <section class="project-role-lane">
            <strong>${esc(label)}</strong>
            <span>${done}/${roleTasks.length} erledigt</span>
            <small>${esc(roleTasks.slice(0, 3).map(item => `${item.milestoneId.toUpperCase()} ${item.title}`).join(' · ') || 'keine Aufgabe')}</small>
            ${next ? `<div class="project-role-next"><b>Nächste:</b> ${esc(next.milestone.id.toUpperCase())} · ${esc(next.task.title)}<span>fällig ${esc(next.dueDate)}</span><button type="button" data-project-jump="${esc(next.task.id)}">Zur Aufgabe</button></div>` : `<div class="project-role-next done"><b>Nächste:</b> keine freigegebene Aufgabe</div>`}
          </section>
        `;
      }).join('')}
    </div>
  `;
}

function renderProjectPlan() {
  const node = document.getElementById('projectPlanBody');
  if (!node) return;
  projectPlan = normalizeProjectPlan(projectPlan, Number(el.baseYear?.value || 2027));
  const counts = projectPlanTaskCounts(projectPlan);
  const taskStates = projectPlanEffectiveTaskStates(projectPlan);
  const nextReady = projectPlanNextReadyTask(projectPlan);
  const roleOptions = Object.entries(projectPlanRoles).map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join('');
  node.innerHTML = `
    <div class="project-plan-summary">
      <div><strong>${counts.completed}/${counts.total}</strong><span>Aufgaben erledigt</span></div>
      <div><strong>${counts.byStatus.in_progress || 0}</strong><span>in Arbeit</span></div>
      <div><strong>${counts.byStatus.blocked || 0}</strong><span>blockiert durch Abhängigkeiten/Auflagen</span></div>
      <div><strong>${esc(projectPlanMilestoneDate(projectPlan.baseYear, 6.5))}</strong><span>exemplarischer Gremienpunkt</span></div>
    </div>
    ${nextReady ? `<div class="project-next-task"><strong>Nächste fällige Aufgabe:</strong> ${esc(nextReady.milestone.id.toUpperCase())} · ${esc(nextReady.task.title)} <span>${esc(projectPlanRoles[nextReady.task.ownerRole] || nextReady.task.ownerRole)} · fällig ${esc(projectPlanMilestoneDate(projectPlan.baseYear, nextReady.milestone.plannedOffsetMonths, nextReady.task.dueOffsetDays))}</span><button type="button" data-project-jump="${esc(nextReady.task.id)}">Zur Aufgabe</button></div>` : `<div class="project-next-task done"><strong>Alle aktuell freigegebenen Aufgaben sind erledigt oder blockiert.</strong></div>`}
    <p class="project-role-next-heading">Nächste fällige Aufgabe je Rolle steht in den Rollen-Swimlanes.</p>
    ${renderProjectTimeline(projectPlan)}
    ${renderProjectRoleSwimlanes(projectPlan)}
    <div class="project-plan-swimlanes">
      ${projectPlan.milestones.map(milestone => `
        <details class="project-plan-milestone" data-project-milestone="${esc(milestone.id)}" ${milestone.tasks.some(task => task.id === activeProjectTaskId || task.id === nextReady?.task.id || task.status === 'in_progress') ? 'open' : ''}>
          <summary class="project-milestone-summary">
            <div>
              <p class="eyebrow">${esc(milestone.id.toUpperCase())} · ${esc(projectPlanMilestoneDate(projectPlan.baseYear, milestone.plannedOffsetMonths))}</p>
              <h3>${esc(milestone.title)}</h3>
              <p>${esc(milestone.entryCriteria)} → <strong>${esc(milestone.exitArtifact)}</strong></p>
            </div>
          </summary>
          <div class="project-milestone-actions">
            <button type="button" class="ghost" data-project-add="${esc(milestone.id)}">Aufgabe hinzufügen</button>
            <a href="${esc(projectPlanDeepLinkForTask({ deepLinkKey: milestone.storyKey }))}" class="secondary-link" data-project-jump="${esc(milestone.tasks[0]?.id || '')}">App öffnen</a>
          </div>
          <div class="project-task-list">
            ${milestone.tasks.map(item => {
              const state = taskStates[item.id] || { effectiveStatus: item.status, dependencyBlocked: false, missingDependencies: [] };
              const statusDisabled = state.dependencyBlocked || item.templateSkipped ? 'disabled aria-disabled="true"' : '';
              const jumpDisabled = state.dependencyBlocked || item.templateSkipped ? 'disabled aria-disabled="true" title="Vorgängeraufgaben zuerst erledigen oder Aufgabe wieder aktivieren"' : '';
              const sourceBadge = `<em class="project-task-source ${esc(item.source || 'template')}">${esc(projectPlanTaskSourceLabels[item.source || 'template'] || item.source || 'Vorlage')}</em>`;
              const titleControl = item.source === 'user'
                ? `<input class="project-task-title-input" data-project-field="${esc(item.id)}" data-project-field-name="title" type="text" value="${esc(item.title)}" aria-label="Titel der eigenen Aufgabe">`
                : `<strong>${esc(item.title)}</strong>`;
              const skippedText = item.templateSkipped ? ' · als nicht zutreffend übersprungen' : '';
              const taskOpen = activeProjectTaskId === item.id || nextReady?.task.id === item.id || item.status === 'in_progress';
              const taskMeta = `${projectPlanRoles[item.ownerRole] || item.ownerRole} · fällig ${projectPlanMilestoneDate(projectPlan.baseYear, milestone.plannedOffsetMonths, item.dueOffsetDays)}${item.evidenceRequired ? ` · Evidenz: ${item.evidenceRequired}` : ''}${projectPlanDependencyHint(state)}${skippedText}`;
              return `
              <details class="project-task ${esc(state.effectiveStatus)} ${state.dependencyBlocked ? 'dependency-blocked' : ''} ${item.templateSkipped ? 'template-skipped' : ''} ${item.source === 'user' ? 'user-task' : 'template-task'} ${activeProjectTaskId === item.id ? 'active' : ''}" data-project-task="${esc(item.id)}" ${taskOpen ? 'open' : ''}>
                <summary class="project-task-summary">
                  <span class="project-task-summary-title"><strong>${esc(item.title)}</strong>${sourceBadge}</span>
                  <span>${esc(taskMeta)}</span>
                </summary>
                <div class="project-task-expanded">
                  <div class="project-task-main">
                    <div class="project-task-title">
                      ${titleControl}${sourceBadge}
                      <span>${esc(taskMeta)}</span>
                    </div>
                    <p>${esc(item.resultArtifact)}${item.origin ? ` · Herkunft: ${esc(item.origin)}` : ''}${item.dependsOn.length ? ` · abhängig von ${esc(item.dependsOn.join(', '))}` : ''}</p>
                  ${item.source === 'user' ? `
                    <div class="project-user-task-fields">
                      <label>Frist +Tage <input data-project-field="${esc(item.id)}" data-project-field-name="dueOffsetDays" type="number" step="1" value="${esc(item.dueOffsetDays)}"></label>
                      <label>Zielsicht <select data-project-field="${esc(item.id)}" data-project-field-name="targetView"><option value="">Story-Standard</option>${projectPlanViewIds.map(view => `<option value="${esc(view)}" ${item.targetView === view ? 'selected' : ''}>${esc(view)}</option>`).join('')}</select></label>
                      <label>Story-Key <select data-project-field="${esc(item.id)}" data-project-field-name="deepLinkKey">${projectPlanStoryKeys.map(key => `<option value="${esc(key)}" ${item.deepLinkKey === key ? 'selected' : ''}>${esc(key)}</option>`).join('')}</select></label>
                      <label>Evidenz <select data-project-field="${esc(item.id)}" data-project-field-name="evidenceRequired"><option value="">keine</option>${projectPlanEvidenceLevels.map(level => `<option value="${esc(level)}" ${item.evidenceRequired === level ? 'selected' : ''}>${esc(level)}</option>`).join('')}</select></label>
                      <label>Ergebnis <input data-project-field="${esc(item.id)}" data-project-field-name="resultArtifact" type="text" value="${esc(item.resultArtifact)}"></label>
                      <label>Herkunft <input data-project-field="${esc(item.id)}" data-project-field-name="origin" type="text" value="${esc(item.origin || '')}"></label>
                    </div>` : ''}
                  <label class="sr-only" for="project-note-${esc(item.id)}">Notiz zu ${esc(item.title)}</label>
                  <input id="project-note-${esc(item.id)}" data-project-note="${esc(item.id)}" type="text" value="${esc(item.note)}" placeholder="Notiz / Klärpunkt zur Aufgabe">
                </div>
                <div class="project-task-actions">
                  <label class="sr-only" for="project-status-${esc(item.id)}">Status</label>
                  <select id="project-status-${esc(item.id)}" data-project-status="${esc(item.id)}" ${statusDisabled}>
                    ${projectPlanStatuses.map(status => `<option value="${esc(status)}" ${item.status === status ? 'selected' : ''}>${esc(projectPlanStatusLabels[status])}</option>`).join('')}
                  </select>
                  <select data-project-owner="${esc(item.id)}" aria-label="Rolle">
                    ${roleOptions.replace(`value="${esc(item.ownerRole)}"`, `value="${esc(item.ownerRole)}" selected`)}
                  </select>
                  ${item.source === 'template' ? `<button type="button" data-project-skip="${esc(item.id)}">${item.templateSkipped ? 'wieder aktivieren' : 'nicht zutreffend'}</button>` : `<button type="button" class="danger" data-project-delete="${esc(item.id)}">löschen</button>`}
                  <button type="button" data-project-jump="${esc(item.id)}" ${jumpDisabled}>Zur App</button>
                  </div>
                </div>
              </details>`;
            }).join('')}
          </div>
        </details>
      `).join('')}
    </div>
  `;
}

function updateProjectTask(taskId, patch, rerender = true) {
  if (Object.hasOwn(patch, 'status')) {
    const state = projectPlanEffectiveTaskStates(projectPlan)[taskId];
    if (state?.dependencyBlocked && ['in_progress', 'done'].includes(patch.status)) {
      setStorageStatus('Aufgabe ist blockiert: Vorgängeraufgaben zuerst erledigen.');
      renderProjectPlan();
      return;
    }
  }
  try {
    projectPlan = updateProjectPlanTaskModel(projectPlan, taskId, patch);
  } catch (error) {
    setStorageStatus(error.message || 'Projektplan-Aufgabe konnte nicht geändert werden.');
    renderProjectPlan();
    return;
  }
  if (rerender) renderAll();
  else saveToBrowser(true);
}

function openProjectTask(taskId) {
  const found = findProjectPlanTask(projectPlan, taskId);
  if (!found) return;
  const { milestone, task } = found;
  const dependencyState = projectPlanEffectiveTaskStates(projectPlan)[task.id];
  if (dependencyState?.dependencyBlocked) {
    setStorageStatus(`Projektplan-Aufgabe blockiert: zuerst ${dependencyState.missingDependencies.join(', ')} erledigen.`);
    renderProjectPlan();
    return;
  }
  const state = appStateForStoryMilestone(task.deepLinkKey || milestone.storyKey);
  activeProjectTaskId = task.id;
  processState = normalizeProcessState({
    ...processState,
    phase: state.phase,
    resume: {
      statusNote: `Projektplan: ${milestone.title} · ${task.title}`,
      nextStep: task.resultArtifact || 'Aufgabe fachlich bearbeiten und Evidenz/Status pflegen.',
      owner: projectPlanRoles[task.ownerRole] || task.ownerRole,
      dueDate: projectPlanMilestoneDate(projectPlan.baseYear, milestone.plannedOffsetMonths, task.dueOffsetDays)
    }
  });
  activeView = task.targetView || state.view;
  meetingFocus = state.focus;
  reportMode = state.reportMode;
  setView(activeView);
  renderAll();
  setStorageStatus(`Projektplan-Aufgabe geöffnet: ${task.title}.`);
  if (task.status === 'open') updateProjectTask(task.id, { status: 'in_progress' });
}

function resetProjectPlan() {
  const hasUserTasks = projectPlan.milestones?.some(milestone => milestone.tasks?.some(task => task.source === 'user'));
  const keepUserTasks = hasUserTasks ? window.confirm('Eigene Aufgaben behalten? OK = behalten, Abbrechen = entfernen.') : true;
  projectPlan = resetProjectPlanTemplateState(projectPlan, { keepUserTasks, baseYear: Number(el.baseYear?.value || 2027) });
  activeProjectTaskId = '';
  renderAll();
  setStorageStatus(keepUserTasks ? 'Projektplan wurde zurückgesetzt; eigene Aufgaben bleiben erhalten.' : 'Projektplan wurde zurückgesetzt; eigene Aufgaben wurden entfernt.');
}

function renderProcessUx() {
  const phase = phaseLabel();
  const currentIndex = processPhases.findIndex(([id]) => id === processState.phase);
  const clarifications = clarificationItems();
  const openCount = clarifications.filter(item => item.status !== 'closed').length;
  const reviewCount = reviewRequiredImpacts(true).length;
  const target = processState.phaseTargets?.entscheidungsvorlage || '';
  const phaseSelect = document.getElementById('processPhase');
  const targetInput = document.getElementById('phaseTargetDate');
  const resume = normalizePlanningResume(processState.resume);
  const resumeSummary = buildPlanningResume({
    phaseLabel: phase,
    resume,
    maturity: maturityScore(),
    openClarifications: openCount,
    reviewCount
  });
  const resumeFieldIds = ['planningStatusNote', 'planningNextStep', 'planningOwner', 'planningDueDate'];
  if (phaseSelect) phaseSelect.value = processState.phase;
  if (targetInput) targetInput.value = target;
  if (!resumeFieldIds.includes(document.activeElement?.id)) {
    const statusNote = document.getElementById('planningStatusNote');
    const nextStep = document.getElementById('planningNextStep');
    const owner = document.getElementById('planningOwner');
    const dueDate = document.getElementById('planningDueDate');
    if (statusNote) statusNote.value = resume.statusNote;
    if (nextStep) nextStep.value = resume.nextStep;
    if (owner) owner.value = resume.owner;
    if (dueDate) dueDate.value = resume.dueDate;
  }
  const banner = document.getElementById('processBanner');
  if (banner) {
    const maturity = maturityScore();
    const compactStatus = `Stand: ${phase} · ${maturity.score} % Entscheidungsreife · ${openCount} Klärpunkte offen`;
    const fullStatus = shouldShowPlanningResume(resume)
      ? `${resumeSummary.headline}. ${resumeSummary.status} ${resumeSummary.next}. ${resumeSummary.risks}.`
      : `KW ${isoWeek(new Date())} - ${phase}. ${reviewCount} Wirkannahmen prüfpflichtig, ${openCount} Klärpunkte offen${target ? `, Zieltermin Entscheidungsvorlage: ${formatDateShort(target)}` : ''}.`;
    banner.textContent = compactStatus;
    banner.title = fullStatus;
  }
  const phasePill = document.getElementById('phasePillLabel');
  if (phasePill) phasePill.textContent = target ? `${phase} · Ziel ${formatDateShort(target)}` : phase;
  const stepper = document.getElementById('phaseStepper');
  if (stepper) {
    stepper.innerHTML = processPhases.map(([id, label], index) => `
      <span class="${index < currentIndex ? 'done' : index === currentIndex ? 'current' : ''}" title="${esc(label)}" aria-label="${esc(label)}">
        <i></i><b>${esc(phaseStepperLabel(id, label))}</b>
      </span>
    `).join('');
  }
  const counter = document.getElementById('clarificationCounter');
  if (counter) {
    counter.textContent = openCount ? `${openCount} Klärpunkte offen` : 'Keine offenen Klärpunkte';
    counter.title = 'Zur Klärpunktliste springen';
  }
  const storyMilestone = storyMilestoneForPhase(processState.phase, activeView);
  const storyLink = document.getElementById('storyContextLink');
  const activeTask = activeProjectTaskId ? findProjectPlanTask(projectPlan, activeProjectTaskId) : null;
  if (storyLink) {
    storyLink.href = storyUrlForMilestone(storyMilestone.id);
    storyLink.textContent = activeTask ? `Aufgabe: ${activeTask.task.title}` : `Story: ${storyMilestone.label}`;
    storyLink.title = activeTask ? `${projectPlanStoryLabel(activeTask.task)} · ${activeTask.task.resultArtifact}` : storyMilestone.note;
  }
  const projectStatus = document.getElementById('status-projectPlan');
  if (projectStatus) projectStatus.textContent = projectPlanProgressText();
}

function isoWeek(date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
}

function metricsForModel(model) {
  try {
    const p = engineParams(model.inputs || {});
    const result = calcPortfolio({ measures: model.measures || [] }, engineScenarioParams(p, model.scenario || 'basis'));
    const first = result.yearly[0] || { eog: 0 };
    const impacts = (model.measures || []).filter(measure => measure.active).flatMap(measure => impactAssumptionsFor(measure));
    const reviewCount = impacts.filter(impact => impact.confidence === 'review' || impact.governance === 'sensitivity').length;
    const maturity = Math.max(0, Math.min(100, 40 + (result.activeMeasures.length ? 20 : 0) + (impacts.length ? Math.round((impacts.length - reviewCount) / impacts.length * 30) : 0)));
    return {
      irr: result.irr,
      npv: result.npv,
      eog: first.regulatoryEogEffect,
      verdict: decisionFor(result).title,
      maturity,
      activeMeasures: result.activeMeasures.length
    };
  } catch (_error) {
    return { irr: NaN, npv: NaN, eog: NaN, verdict: '-', maturity: NaN, activeMeasures: 0 };
  }
}

function metricSummary(metrics) {
  return `IRR ${Number.isFinite(metrics.irr) ? fmtPct(metrics.irr * 100, 1) : '-'}, Kapitalwert ${Number.isFinite(metrics.npv) ? fmtTeur(metrics.npv, 1) : '-'}, EOG-Wirkung ${Number.isFinite(metrics.eog) ? fmtTeur(metrics.eog, 1) : '-'}`;
}

function metricDeltaCell(localMetrics, incomingMetrics, key, formatter) {
  const localValue = localMetrics[key];
  const incomingValue = incomingMetrics[key];
  const delta = Number.isFinite(localValue) && Number.isFinite(incomingValue) ? incomingValue - localValue : NaN;
  const arrow = Number.isFinite(delta) && Math.abs(delta) > 0.000001 ? delta > 0 ? '↑' : '↓' : '→';
  return `<td>${formatter(localValue)}</td><td>${formatter(incomingValue)}</td><td class="${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${arrow} ${Number.isFinite(delta) ? formatter(Math.abs(delta)) : '-'}</td>`;
}

function exportSnapshotLabel(author) {
  return `Stand wie versendet · ${new Date().toLocaleString('de-DE')} · ${author}`;
}

function createExportSnapshot() {
  const author = ensureAuthor();
  const timestamp = new Date().toISOString();
  history = appendHistoryEvents(history, [{
    type: 'modelExported',
    subject: { scope: 'model' },
    field: 'export',
    oldValue: null,
    newValue: timestamp,
    note: 'Snapshot beim JSON-Export erzeugt.'
  }], author);
  history.snapshots = [...(history.snapshots || []), {
    id: 'snap_export_' + Date.now().toString(36),
    eventId: history.headId,
    label: exportSnapshotLabel(author),
    author,
    timestamp,
    phase: processState.phase
  }];
  previousModelForHistory = currentModelData();
  saveToBrowser(true);
}

function renderEventList(events, emptyText = 'Keine neuen Ereignisse.') {
  return events.length
    ? `<ul>${events.map(event => `<li>${esc(eventSummary(event))}</li>`).join('')}</ul>`
    : `<p class="hint">${esc(emptyText)}</p>`;
}

function renderChangeSinceSeen() {
  const node = document.getElementById('changeSinceSeen');
  if (!node) return;
  let lastSeen = '';
  try {
    lastSeen = localStorage.getItem(lastSeenEventKey) || '';
  } catch (_error) {}
  const events = eventsAfter(history, lastSeen);
  const last = latestEvent(history);
  node.innerHTML = `
    <p>${events.length ? `${events.length} Ereignisse seit deiner letzten Ansicht.` : 'Seit deiner letzten Ansicht gibt es keine neuen Ereignisse.'}</p>
    ${renderEventList(events.slice(-6))}
    <p class="hint">Aktueller Head: ${esc(history.headId || '-')}${last ? ` · zuletzt ${esc(last.author)} ${new Date(last.timestamp).toLocaleString('de-DE')}` : ''}</p>
  `;
}

function renderMaturityAndClarifications() {
  const maturity = maturityScore();
  const maturityNode = document.getElementById('maturityPanel');
  if (maturityNode) {
    maturityNode.innerHTML = `
      <div class="maturity-layout">
        ${maturityRingHtml(maturity.score, maturity.blockers, 96)}
        <div>
          <strong>${maturity.score} % Entscheidungsreife</strong> · ${maturity.blockers} Blocker · ${maturity.reviewCount} prüfpflichtige Wirkannahmen
          <ul>
            <li>${maturity.reviewCount} Annahmen prüfpflichtig</li>
            <li>${maturity.openClarifications.length} Klärpunkte offen</li>
            <li>${maturity.verdictStable ? 'Entscheidungstendenz stabil' : 'Entscheidungstendenz je Szenario unterschiedlich'}</li>
          </ul>
        </div>
      </div>
    `;
  }
  const listNode = document.getElementById('clarificationList');
  const disclosure = document.getElementById('clarificationDisclosure');
  const disclosureSummary = document.getElementById('clarificationDisclosureSummary');
  if (!listNode) return;
  const items = clarificationItems();
  const openItems = items.filter(item => item.status !== 'closed');
  if (disclosureSummary) {
    disclosureSummary.textContent = openItems.length
      ? `Alle ${openItems.length} offenen Klärpunkte anzeigen`
      : 'Klärpunktliste anzeigen';
  }
  if (disclosure) {
    disclosure.classList.toggle('has-open-items', openItems.length > 0);
  }
  listNode.innerHTML = items.length
    ? items.map(item => `
      <article class="clarification-item ${item.status === 'closed' ? 'closed' : ''}">
        <div>
          <strong>${esc(item.measure)}: ${esc(item.title)}</strong>
          <div class="clarification-meta">${esc(item.area)} · Zielphase ${esc(phaseLabel(item.targetPhase))} · <span class="priority-badge priority-${esc(item.priority?.label || 'normal')}">Priorität ${esc(item.priority?.label || 'normal')} · ${esc(item.priority?.driver || 'Prüfung')}</span> · ${item.status === 'closed' ? 'geklärt' : 'offen'}</div>
          <p class="hint">${esc(item.detail)}</p>
        </div>
        <div class="row-actions">
          ${item.measureId ? `<button type="button" class="primary" data-action="openClarificationMeasure" data-clarification-key="${esc(item.key)}" data-measure-id="${esc(item.measureId)}">Daten & Befassung bearbeiten</button>` : `<button type="button" data-action="openClarificationAudit" data-clarification-key="${esc(item.key)}">${item.status === 'closed' ? 'Befassungen ansehen' : 'Befassung dokumentieren'}</button>`}
        </div>
      </article>
    `).join('')
    : '<p class="hint">Keine Klärpunkte aus aktiven Wirkannahmen oder Maßnahmennotizen.</p>';
}

function showImportReview(review) {
  pendingImportReview = review;
  const body = document.getElementById('importReviewBody');
  const incomingLatest = latestEvent(review.incoming.history);
  const localMetrics = metricsForModel(currentModelData());
  const incomingMetrics = metricsForModel(review.incoming.model);
  const relationText = {
    same: 'Import und lokaler Stand haben denselben Head.',
    incomingNewer: 'Die Datei ist ein Nachfolger deines lokalen Stands.',
    localNewer: 'Deine lokale Version ist aktueller als die importierte Datei.',
    divergent: 'Lokaler Stand und Import sind auseinander gelaufen.'
  }[review.comparison.relation];
  body.innerHTML = `
    <p><strong>${relationText}</strong></p>
    <p>Import von ${esc(incomingLatest?.author || 'unbekannt')} · ${incomingLatest ? new Date(incomingLatest.timestamp).toLocaleString('de-DE') : 'ohne Zeitstempel'}</p>
    <div class="table-wrap">
      <table class="delta-table">
        <thead><tr><th>KPI</th><th>Lokal</th><th>Import</th><th>Delta</th></tr></thead>
        <tbody>
          <tr><td>Verdict</td><td>${esc(localMetrics.verdict)}</td><td>${esc(incomingMetrics.verdict)}</td><td>${localMetrics.verdict === incomingMetrics.verdict ? '→ unverändert' : '→ geändert'}</td></tr>
          <tr><td>IRR</td>${metricDeltaCell(localMetrics, incomingMetrics, 'irr', value => Number.isFinite(value) ? fmtPct(value * 100, 1) : '-')}</tr>
          <tr><td>Kapitalwert</td>${metricDeltaCell(localMetrics, incomingMetrics, 'npv', value => Number.isFinite(value) ? fmtTeur(value, 1) : '-')}</tr>
          <tr><td>EOG-Wirkung</td>${metricDeltaCell(localMetrics, incomingMetrics, 'eog', value => Number.isFinite(value) ? fmtTeur(value, 1) : '-')}</tr>
          <tr><td>Entscheidungsreife</td>${metricDeltaCell(localMetrics, incomingMetrics, 'maturity', value => Number.isFinite(value) ? `${Math.round(value)} %` : '-')}</tr>
        </tbody>
      </table>
    </div>
    <p class="hint">Kurzfassung lokal: ${esc(metricSummary(localMetrics))}. Kurzfassung Import: ${esc(metricSummary(incomingMetrics))}.</p>
    <h3>Neue Ereignisse im Import</h3>
    ${renderEventList(review.comparison.incomingAfterCommon)}
    ${review.comparison.localAfterCommon.length ? `<h3>Lokale Ereignisse seit gemeinsamem Stand</h3>${renderEventList(review.comparison.localAfterCommon)}` : ''}
  `;
  document.getElementById('importReviewModal').classList.remove('hidden');
}

function closeImportReview() {
  document.getElementById('importReviewModal').classList.add('hidden');
  pendingImportReview = null;
}

function appendDecisionEvent(type, note) {
  history = appendHistoryEvents(history, [{
    type,
    subject: { scope: 'history' },
    field: 'headId',
    oldValue: null,
    newValue: history.headId,
    note
  }], ensureAuthor());
}

function applyPendingImport() {
  if (!pendingImportReview) return;
  const relation = pendingImportReview.comparison.relation;
  applyModelState({
    model: pendingImportReview.incoming.model,
    history: pendingImportReview.incoming.history
  });
  if (relation === 'divergent') {
    appendDecisionEvent('branchSelected', 'Import-Zweig übernommen; lokaler Parallelzweig wurde verworfen.');
  }
  saveToBrowser(true);
  setStorageStatus('Import übernommen und im Browser gespeichert.');
  closeImportReview();
  renderAll();
}

function keepLocalImport() {
  if (!pendingImportReview) return;
  if (pendingImportReview.comparison.relation === 'divergent' || pendingImportReview.comparison.relation === 'incomingNewer') {
    appendDecisionEvent('branchRejected', 'Import-Zweig verworfen; lokaler Stand bleibt maßgeblich.');
    saveToBrowser(true);
  }
  setStorageStatus('Lokaler Stand wurde beibehalten.');
  closeImportReview();
  renderAll();
}

function setProcessPhase(nextPhase) {
  if (!processPhases.some(([id]) => id === nextPhase) || processState.phase === nextPhase) return;
  const previousPhase = processState.phase;
  processState = normalizeProcessState({ ...processState, phase: nextPhase });
  const author = ensureAuthor();
  history = appendHistoryEvents(history, [{
    type: 'phaseChanged',
    subject: { scope: 'process' },
    field: 'phase',
    oldValue: previousPhase,
    newValue: nextPhase,
    note: `Phasenwechsel zu ${phaseLabel(nextPhase)}.`
  }], author);
  history.snapshots.push({
    id: 'snap_' + Date.now().toString(36),
    eventId: history.headId,
    label: 'Phasenwechsel: ' + phaseLabel(nextPhase),
    author,
    timestamp: new Date().toISOString(),
    phase: nextPhase
  });
  previousModelForHistory = currentModelData();
  renderAll();
}

function setPhaseTarget(value) {
  processState = normalizeProcessState({
    ...processState,
    phaseTargets: {
      ...processState.phaseTargets,
      entscheidungsvorlage: value
    }
  });
  renderAll();
}

function setPlanningResumeField(field, value) {
  const nextResume = normalizePlanningResume({
    ...processState.resume,
    [field]: value,
    updatedAt: new Date().toISOString()
  });
  processState = normalizeProcessState({
    ...processState,
    resume: nextResume
  });
  renderAll();
}

function findClarificationItem(key) {
  return clarificationItems().find(item => item.key === key)
    || expertWorkItems().find(item => item.key === key)
    || null;
}

function renderClarificationAuditModal() {
  if (!pendingClarificationAudit) return;
  const item = pendingClarificationAudit.item;
  const status = clarificationStatus[item.key] || {};
  const inReview = status.status === 'in_review';
  const body = document.getElementById('clarificationAuditBody');
  const note = document.getElementById('clarificationAuditNote');
  const error = document.getElementById('clarificationAuditError');
  const openMeasure = document.getElementById('clarificationAuditOpenMeasure');
  if (body) {
    body.innerHTML = `
      <div class="clarification-modal-brief">
        <p class="eyebrow">${esc(item.area)} · Zielphase ${esc(phaseLabel(item.targetPhase))} · ${item.status === 'closed' ? 'geklärt' : inReview ? 'in Bearbeitung' : 'offen'}</p>
        <h3>${esc(item.measure)}: ${esc(item.title)}</h3>
        <p class="hint">Empfohlener Ablauf: erst Datenstelle bearbeiten, dann mit kurzer Notiz auditierbar abschließen.</p>
        <details class="compact-detail">
          <summary>Fachlichen Hinweis anzeigen</summary>
          <p>${esc(item.detail)}</p>
        </details>
        ${status.note ? `<p class="hint"><strong>Letzte Klärnotiz:</strong> ${esc(status.note)} · ${esc(status.author || 'unbekannt')} · ${status.timestamp ? esc(new Date(status.timestamp).toLocaleString('de-DE')) : '-'}</p>` : ''}
      </div>
    `;
  }
  if (note) {
    note.value = status.note || '';
    note.setAttribute('aria-invalid', 'false');
  }
  if (error) error.textContent = '';
  if (openMeasure) {
    openMeasure.disabled = !item.measureId;
    openMeasure.dataset.measureId = item.measureId || '';
  }
}

function openClarificationAudit(key) {
  const item = findClarificationItem(key);
  if (!item) return;
  pendingClarificationAudit = { key, item };
  renderClarificationAuditModal();
  document.getElementById('clarificationAuditModal')?.classList.remove('hidden');
}

function closeClarificationAudit() {
  pendingClarificationAudit = null;
  document.getElementById('clarificationAuditModal')?.classList.add('hidden');
}

function clarificationAuditNoteOrError() {
  const noteNode = document.getElementById('clarificationAuditNote');
  const error = document.getElementById('clarificationAuditError');
  const note = String(noteNode?.value || '').trim();
  if (!note) {
    if (noteNode) noteNode.setAttribute('aria-invalid', 'true');
    if (error) error.textContent = 'Klärnotiz ist erforderlich, damit die Änderung später auditierbar bleibt.';
    return '';
  }
  if (noteNode) noteNode.setAttribute('aria-invalid', 'false');
  if (error) error.textContent = '';
  return note;
}

function appendClarificationAuditEvent(item, note, timestamp, author, type = 'clarificationAuditCompleted', status = 'closed') {
  history = appendHistoryEvents(history, [{
    type,
    subject: { scope: 'clarifications', clarificationKey: item.key, measureId: item.measureId || null, impactId: item.impactId || null },
    field: 'clarificationStatus',
    oldValue: clarificationStatus[item.key] || null,
    newValue: { status, note, timestamp, author, measureId: item.measureId || '', title: item.title },
    note
  }], author, () => timestamp);
}

function clarificationBefassungen(status = {}) {
  if (Array.isArray(status.befassungen)) return status.befassungen;
  if (!status.note) return [];
  return [{
    note: status.note,
    author: status.author || '',
    timestamp: status.timestamp || '',
    outcome: status.status === 'closed' ? 'abgeschlossen' : 'Zwischenstand'
  }];
}

function nextClarificationBefassungen(status = {}, entry = null) {
  const existing = clarificationBefassungen(status);
  return entry ? [...existing, entry] : existing;
}

function clarificationBefassungHistoryHtml(status = {}) {
  const entries = clarificationBefassungen(status);
  if (!entries.length) {
    return '<div class="clarification-befassung-history empty"><strong>Bisherige Befassungen</strong><p class="hint">Noch keine Befassung dokumentiert. Die aktuelle Notiz startet leer.</p></div>';
  }
  return `
    <div class="clarification-befassung-history">
      <strong>Bisherige Befassungen</strong>
      <ol>
        ${entries.slice().reverse().map(entry => `
          <li>
            <span>${esc(entry.timestamp ? new Date(entry.timestamp).toLocaleString('de-DE') : '-')} · ${esc(entry.author || 'unbekannt')} · ${esc(entry.outcome || 'Befassung')}</span>
            <p>${esc(entry.note || '')}</p>
          </li>
        `).join('')}
      </ol>
    </div>
  `;
}

function saveClarificationAudit() {
  if (!pendingClarificationAudit) return false;
  const note = clarificationAuditNoteOrError();
  if (!note) return false;
  const item = pendingClarificationAudit.item;
  const author = ensureAuthor();
  const timestamp = new Date().toISOString();
  appendClarificationAuditEvent(item, note, timestamp, author);
  const taskId = ensureClarificationProjectTask(item, 'done', note);
  clarificationStatus = {
    ...clarificationStatus,
    [item.key]: {
      status: 'closed',
      note: note,
      author: author,
      timestamp: timestamp,
      measureId: pendingClarificationAudit.item.measureId || '',
      title: item.title,
      projectTaskId: taskId
    }
  };
  measureEditClarificationContext = null;
  previousModelForHistory = currentModelData();
  closeClarificationAudit();
  renderAll();
  setStorageStatus('Klärung mit Notiz und Zeitstempel gespeichert.');
  return true;
}

function openClarificationMeasureFromAudit() {
  if (!pendingClarificationAudit?.item?.measureId) return;
  const item = pendingClarificationAudit.item;
  const author = ensureAuthor();
  const timestamp = new Date().toISOString();
  const note = String(document.getElementById('clarificationAuditNote')?.value || '').trim();
  clarificationStatus = {
    ...clarificationStatus,
    [item.key]: {
      ...(clarificationStatus[item.key] || {}),
      status: 'in_review',
      note: note || (clarificationStatus[item.key]?.note || ''),
      author: author,
      timestamp: timestamp,
      measureId: pendingClarificationAudit.item.measureId || '',
      title: item.title
    }
  };
  measureEditClarificationContext = { key: item.key, title: item.title, note: note || 'Klärpunkt wird bearbeitet; Abschlussnotiz folgt beim Speichern der Klärung.', timestamp, author };
  measureEditReturnView = 'expertWork';
  selectedId = item.measureId;
  closeClarificationAudit();
  setView('measures');
  renderAll();
  openMeasureEditModal();
}

function openSidecarWorkItem(sidecarId, key = '') {
  if (!sidecarId) return;
  const item = key ? findClarificationItem(key) : null;
  if (item) {
    const note = clarificationStatus[item.key]?.note || item.detail || '';
    const taskId = ensureClarificationProjectTask(item, clarificationStatus[item.key]?.status === 'closed' ? 'closed' : 'in_progress', note);
    clarificationStatus = {
      ...clarificationStatus,
      [item.key]: {
        ...(clarificationStatus[item.key] || {}),
        status: clarificationStatus[item.key]?.status === 'closed' ? 'closed' : 'in_review',
        author: ensureAuthor(),
        timestamp: new Date().toISOString(),
        sidecarId,
        title: item.title,
        projectTaskId: taskId
      }
    };
  }
  selectedSidecarId = sidecarId;
  sidecarModeFilter = 'open_questions';
  setView('sidecar');
  renderAll();
  document.querySelector(`[data-sidecar-card="${CSS.escape(sidecarId)}"] summary`)?.focus?.();
}

function openClarificationMeasure(measureId, key = '') {
  if (!measureId) return;
  const item = key ? findClarificationItem(key) : null;
  if (item) {
    const author = ensureAuthor();
    const timestamp = new Date().toISOString();
    const taskId = ensureClarificationProjectTask(item, clarificationStatus[item.key]?.status === 'closed' ? 'closed' : 'in_progress', clarificationStatus[item.key]?.note || item.detail || '');
    clarificationStatus = {
      ...clarificationStatus,
      [item.key]: {
        ...(clarificationStatus[item.key] || {}),
        status: clarificationStatus[item.key]?.status === 'closed' ? 'closed' : 'in_review',
        author,
        timestamp,
        measureId: item.measureId || '',
        title: item.title,
        projectTaskId: taskId
      }
    };
    const target = clarificationTargetFor(item);
    const workflowItems = expertWorkItems().filter(entry => entry.measureId && entry.status !== 'closed' && (expertFilter === 'all' || entry.area === item.area));
    measureEditNavigationClarificationKeys = workflowItems.map(entry => entry.key);
    measureEditNavigationIds = workflowItems.map(entry => entry.measureId).filter(Boolean);
    measureEditClarificationContext = { key: item.key, title: item.title, note: clarificationStatus[item.key]?.note || '', timestamp, author, projectTaskId: taskId };
    measureEditReturnView = 'expertWork';
    pendingMeasureFocusTarget = target.fieldId;
    pendingMeasureFocusLabel = target.label;
  }
  selectedId = measureId;
  setView('measures');
  renderAll();
  openMeasureEditModal();
}

function workbenchClarificationNoteOrError() {
  const noteNode = document.getElementById('measureClarificationNote');
  const error = document.getElementById('measureClarificationError');
  const note = String(noteNode?.value || '').trim();
  if (!note) {
    if (noteNode) noteNode.setAttribute('aria-invalid', 'true');
    if (error) error.textContent = 'Bitte kurz dokumentieren, was in dieser Befassung geprüft, geändert oder offen gelassen wurde.';
    return '';
  }
  if (noteNode) noteNode.setAttribute('aria-invalid', 'false');
  if (error) error.textContent = '';
  return note;
}

function saveMeasureClarificationProgressFromWorkbench() {
  if (!measureEditClarificationContext?.key) return false;
  const item = findClarificationItem(measureEditClarificationContext.key) || measureEditClarificationContext;
  const note = workbenchClarificationNoteOrError();
  if (!note) return false;
  updateSelectedFromDetail();
  const author = ensureAuthor();
  const timestamp = new Date().toISOString();
  const previousStatus = clarificationStatus[item.key] || {};
  appendClarificationAuditEvent(item, note, timestamp, author, 'clarificationBefassungSaved', 'in_review');
  const taskId = ensureClarificationProjectTask(item, 'in_progress', note);
  const entry = { note, author, timestamp, outcome: 'Zwischenstand' };
  clarificationStatus = {
    ...clarificationStatus,
    [item.key]: {
      ...previousStatus,
      status: 'in_review',
      draftNote: '',
      note: previousStatus.note || '',
      author,
      timestamp,
      measureId: item.measureId || selectedId || '',
      title: item.title,
      projectTaskId: taskId,
      befassungen: nextClarificationBefassungen(previousStatus, entry)
    }
  };
  measureEditClarificationContext = { ...measureEditClarificationContext, note: '', timestamp, author, projectTaskId: taskId };
  previousModelForHistory = currentModelData();
  renderAll();
  setStorageStatus('Befassungsnotiz gespeichert; der Klärpunkt bleibt offen/in Bearbeitung.');
  return true;
}

function saveMeasureClarificationFromWorkbench() {
  if (!measureEditClarificationContext?.key) return false;
  const item = findClarificationItem(measureEditClarificationContext.key) || measureEditClarificationContext;
  const note = workbenchClarificationNoteOrError();
  if (!note) return false;
  updateSelectedFromDetail();
  const author = ensureAuthor();
  const timestamp = new Date().toISOString();
  const previousStatus = clarificationStatus[item.key] || {};
  appendClarificationAuditEvent(item, note, timestamp, author);
  const taskId = ensureClarificationProjectTask(item, 'done', note);
  const entry = { note, author, timestamp, outcome: 'abgeschlossen' };
  clarificationStatus = {
    ...clarificationStatus,
    [item.key]: {
      status: 'closed',
      note,
      draftNote: '',
      author,
      timestamp,
      measureId: item.measureId || selectedId || '',
      title: item.title,
      projectTaskId: taskId,
      befassungen: nextClarificationBefassungen(previousStatus, entry)
    }
  };
  measureEditClarificationContext = { ...measureEditClarificationContext, note: '', timestamp, author, projectTaskId: taskId };
  previousModelForHistory = currentModelData();
  renderAll();
  setStorageStatus('Klärpunkt abgeschlossen; Datenänderung, Befassungsnotiz und Projektplan-Aufgabe sind gespeichert.');
  return true;
}

function focusActiveClarificationTarget() {
  const item = measureEditClarificationContext?.key ? findClarificationItem(measureEditClarificationContext.key) : null;
  const target = clarificationTargetFor(item || {});
  pendingMeasureFocusTarget = target.fieldId;
  pendingMeasureFocusLabel = target.label;
  focusPendingMeasureField();
}

function setStorageStatus(text) {
  const node = document.getElementById('storageStatus');
  if (!node) return;
  node.textContent = text;
  window.clearTimeout(storageStatusTimer);
  storageStatusTimer = window.setTimeout(() => {
    if (node.textContent === text) node.textContent = '';
  }, 4500);
}

function errorMessageText(error) {
  if (error?.message) return String(error.message);
  if (error?.reason?.message) return String(error.reason.message);
  if (error?.error?.message) return String(error.error.message);
  return String(error || 'Unbekannter Fehler');
}

function showRuntimeError(title, error, details = '') {
  const modal = document.getElementById('runtimeErrorModal');
  const titleNode = document.getElementById('runtimeErrorTitle');
  const bodyNode = document.getElementById('runtimeErrorMessage');
  if (!modal || !titleNode || !bodyNode) {
    setStorageStatus(`${title}: ${errorMessageText(error)}`);
    return;
  }
  titleNode.textContent = title || 'Fehler';
  const message = errorMessageText(error);
  bodyNode.innerHTML = `
    <p><strong>${esc(message)}</strong></p>
    ${details ? `<p>${esc(details)}</p>` : ''}
    <p class="hint">Bitte prüfen Sie, ob die Datei zu diesem Rechner passt. Falls der Fehler reproduzierbar ist, kann über „Feedback / Support melden“ ein Support-Hinweis mit Versionskontext erzeugt werden.</p>
  `;
  modal.classList.remove('hidden');
}

function closeRuntimeError() {
  document.getElementById('runtimeErrorModal')?.classList.add('hidden');
}

function activeRulesetInfo() {
  return rulesetInfo(regulatoryParameterSet);
}

function renderReleaseAwareness() {
  const ruleset = activeRulesetInfo();
  const rulesetBadge = document.getElementById('rulesetBadge');
  if (rulesetBadge) {
    rulesetBadge.textContent = `Regulierungsstand ${ruleset.id} · ${ruleset.confidenceLabel}`;
    rulesetBadge.className = `ruleset-badge ${rulesetConfidenceClasses[ruleset.confidence] || 'warn'}`;
    rulesetBadge.title = ruleset.sourceRef;
  }
  const releaseBadge = document.getElementById('releaseCheckBadge');
  if (releaseBadge) {
    releaseBadge.textContent = lastReleaseCheck?.checkedAt
      ? `Aktualität geprüft ${new Date(lastReleaseCheck.checkedAt).toLocaleDateString('de-DE')}`
      : 'Aktualität nicht geprüft';
    releaseBadge.title = releaseCheckSummary(lastReleaseCheck);
  }
}

function localReleaseContext() {
  const ruleset = activeRulesetInfo();
  return {
    appVersion,
    buildCommit: buildInfo.buildCommit,
    buildTime: buildInfo.buildTime,
    rulesetId: ruleset.id,
    rulesetEffectiveMonth: ruleset.effectiveMonth,
    rulesetConfidence: ruleset.confidence,
    rulesetSourceRef: ruleset.sourceRef
  };
}

function releaseResultMessage(result) {
  const lines = [releaseCheckSummary(result)];
  if (result.app.status === 'outdated') {
    lines.push(`App: neu ${result.app.latestVersion || result.app.latestCommit}; erwarteter SHA-256: ${result.app.sha256 || 'nicht angegeben'}.`);
  }
  if (result.ruleset.status === 'outdated') {
    lines.push(`Ruleset: ${result.ruleset.latestId}; Quelle: ${result.ruleset.sourceRef || 'nicht angegeben'}.`);
  }
  if (result.advisories.length) lines.push(`${result.advisories.length} Hinweis(e) im Manifest.`);
  return lines.join('\n');
}

async function checkReleaseAwareness() {
  if (releaseCheckInProgress) return;
  const ok = window.confirm('Aktualität prüfen? Die App liest einmalig eine öffentliche release-manifest.json von GitHub Pages. Es werden keine Modell-, Maßnahmen- oder Browserdaten übertragen.');
  if (!ok) return;
  releaseCheckInProgress = true;
  setStorageStatus('Aktualitätscheck läuft…');
  try {
    const response = await fetch(releaseManifestUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('manifest unavailable');
    const manifest = await response.json();
    lastReleaseCheck = compareReleaseManifest(localReleaseContext(), manifest);
    renderReleaseAwareness();
    saveToBrowser(true);
    window.alert(releaseResultMessage(lastReleaseCheck));
    setStorageStatus('Aktualitätscheck abgeschlossen.');
  } catch (_error) {
    lastReleaseCheck = { checkedAt: new Date().toISOString(), status: 'failed', error: 'Manifest konnte nicht geladen werden.' };
    renderReleaseAwareness();
    saveToBrowser(true);
    setStorageStatus('Aktualitätscheck nicht möglich. Die App bleibt offline voll nutzbar.');
  } finally {
    releaseCheckInProgress = false;
  }
}

function currentSupportContext() {
  return supportContext({
    ...localReleaseContext(),
    ruleset: activeRulesetInfo(),
    lastReleaseCheck,
    userAgent: navigator.userAgent
  });
}

function openSupportIssue() {
  const ok = window.confirm('GitHub-Supportformular öffnen? Übergeben werden nur App-Version, Build-Commit, Ruleset und Browser-Kontext. Modelldaten werden nicht angehängt.');
  if (!ok) return;
  const url = supportIssueUrl('bug', currentSupportContext());
  const opened = window.open(url, '_blank', 'noopener');
  if (!opened) setStorageStatus('Support-URL konnte nicht geöffnet werden; Popup-Blocker prüfen.');
}

function exportSupportPackage() {
  const payload = supportPackage(currentSupportContext());
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'szenarienrechner-eog-support-kontext-' + payload.createdAt.slice(0, 19).replaceAll(':', '').replace('T', '-') + '.json');
  setStorageStatus('Support-Paket ohne Modelldaten wurde vorbereitet.');
}

function aiPromptOptionsFromUi() {
  return {
    ...defaultAiPromptOptions,
    roleId: document.getElementById('aiPromptRole')?.value || defaultAiPromptOptions.roleId,
    dataScope: document.getElementById('aiPromptDataScope')?.value || defaultAiPromptOptions.dataScope,
    detailLevel: document.getElementById('aiPromptDetailLevel')?.value || defaultAiPromptOptions.detailLevel,
    language: document.getElementById('aiPromptLanguage')?.value || defaultAiPromptOptions.language,
    roundAmounts: Boolean(document.getElementById('aiPromptRoundAmounts')?.checked),
    anonymizeMeasures: Boolean(document.getElementById('aiPromptAnonymizeMeasures')?.checked),
    omitNotes: Boolean(document.getElementById('aiPromptOmitNotes')?.checked),
    includeProjectPlan: Boolean(document.getElementById('aiPromptIncludeProjectPlan')?.checked)
  };
}

function currentAiPrompt() {
  return buildAiPrompt(currentModelData(), aiPromptOptionsFromUi(), {
    buildInfo,
    ruleset: activeRulesetInfo()
  });
}

function renderAiPrompt() {
  const output = document.getElementById('aiPromptOutput');
  if (output) output.value = currentAiPrompt();
}

function openAiPromptGenerator() {
  const select = document.getElementById('aiPromptRole');
  if (select && !select.options.length) {
    select.innerHTML = promptRoles.map(role => `<option value="${esc(role.id)}">${esc(role.title)}</option>`).join('');
    select.value = defaultAiPromptOptions.roleId;
  }
  renderAiPrompt();
  document.getElementById('aiPromptModal').classList.remove('hidden');
}

function closeAiPromptGenerator() {
  document.getElementById('aiPromptModal').classList.add('hidden');
}

async function copyTextToClipboard(text, output) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return 'clipboard-api';
  }

  if (output) {
    output.focus();
    output.select();
    output.setSelectionRange?.(0, text.length);
  }

  if (document.queryCommandSupported?.('copy') !== false) {
    const copied = document.execCommand?.('copy');
    if (copied) return 'exec-command';
  }

  throw new Error('clipboard unavailable');
}

async function copyAiPrompt() {
  const output = document.getElementById('aiPromptOutput');
  const text = output?.value || currentAiPrompt();
  try {
    const method = await copyTextToClipboard(text, output);
    const suffix = method === 'exec-command' ? ' Lokaler Fallback wurde genutzt.' : '';
    setStorageStatus(`KI-Prompt wurde in die Zwischenablage kopiert.${suffix} Bitte vor Nutzung im Unternehmenssystem prüfen.`);
  } catch (_error) {
    if (output) {
      output.focus();
      output.select();
      output.setSelectionRange?.(0, text.length);
    }
    setStorageStatus('Zwischenablage nicht verfügbar. Prompt ist markiert und kann manuell mit Strg/Cmd+C kopiert werden.');
  }
}

function downloadAiPrompt() {
  const text = document.getElementById('aiPromptOutput')?.value || currentAiPrompt();
  const role = document.getElementById('aiPromptRole')?.value || 'prompt';
  downloadBlob(new Blob([text], { type: 'text/plain' }), `szenarienrechner-eog-ki-prompt-${role}-${exportStamp()}.txt`);
  setStorageStatus('KI-Prompt wurde als Textdatei vorbereitet.');
}

function localAuthor() {
  try {
    return localStorage.getItem(authorKey) || '';
  } catch (_error) {
    return '';
  }
}

function ensureAuthor() {
  const existing = localAuthor();
  if (existing) return existing;
  const entered = window.prompt('Name für das Änderungsprotokoll dieses Modells', '') || '';
  const author = entered.trim() || 'Unbekannt';
  try {
    localStorage.setItem(authorKey, author);
  } catch (_error) {}
  return author;
}

function rememberSeenHead() {
  if (!history.headId) return;
  try {
    localStorage.setItem(lastSeenEventKey, history.headId);
  } catch (_error) {}
}

function currentModelData() {
  return {
    activeView,
    reportMode,
    meetingFocus,
    scenario,
    selectedId,
    role: currentRole,
    process: structuredClone(processState),
    projectPlan: structuredClone(projectPlan),
    activeProjectTaskId,
    sidecar: normalizeSidecar(sidecar),
    selectedSidecarId,
    strategy: structuredClone(strategy),
    committee: structuredClone(committee),
    importMapping: structuredClone(importMapping),
    catalogGroupBy,
    resultViewMode,
    inputs: Object.fromEntries(inputIds.map(id => [id, el[id].value])),
    measures: structuredClone(measures),
    meetingTextOverrides: structuredClone(meetingTextOverrides),
    clarificationStatus: structuredClone(clarificationStatus),
    lastReleaseCheck: lastReleaseCheck ? structuredClone(lastReleaseCheck) : null
  };
}

function collectModelState() {
  return {
    app: 'regulierte-sparten-szenario-rechner',
    version: modelVersion,
    appVersion,
    buildCommit: buildInfo.buildCommit,
    buildTime: buildInfo.buildTime,
    build: structuredClone(buildInfo),
    regulatoryParameterSetId: regulatoryParameterSet.id,
    regulatoryParameterEffectiveMonth: regulatoryParameterSet.effectiveMonth,
    regulatoryParameterConfidence: activeRulesetInfo().confidence,
    regulatoryParameterSourceRef: activeRulesetInfo().sourceRef,
    lastReleaseCheck: lastReleaseCheck ? structuredClone(lastReleaseCheck) : null,
    savedAt: new Date().toISOString(),
    model: currentModelData(),
    history: structuredClone(history)
  };
}

function legacyModelFromState(state) {
  return {
    activeView: state.activeView,
    reportMode: state.reportMode || 'management',
    meetingFocus: state.meetingFocus,
    scenario: state.scenario,
    selectedId: state.selectedId,
    role: state.role || 'owner',
    process: state.process || defaultProcessState(),
    projectPlan: state.projectPlan,
    activeProjectTaskId: state.activeProjectTaskId || '',
    sidecar: state.sidecar || {},
    selectedSidecarId: state.selectedSidecarId || '',
    strategy: state.strategy || defaultStrategy(),
    committee: state.committee || defaultCommittee(),
    importMapping: state.importMapping || {},
    catalogGroupBy: state.catalogGroupBy || 'orgUnit',
    resultViewMode: state.resultViewMode || 'regulatory',
    inputs: state.inputs,
    measures: state.measures,
    meetingTextOverrides: state.meetingTextOverrides || {},
    clarificationStatus: state.clarificationStatus || {},
    lastReleaseCheck: state.lastReleaseCheck || null
  };
}

function migrateModelState(state) {
  const model = state?.model && state.model.inputs && Array.isArray(state.model.measures)
    ? state.model
    : legacyModelFromState(state || {});
  if (!model || !Array.isArray(model.measures) || !model.inputs) {
    throw new Error('Die Datei enthält kein gültiges Rechner-Modell.');
  }
  let migratedHistory = state?.history && Array.isArray(state.history.events)
    ? {
        headId: state.history.headId || null,
        events: structuredClone(state.history.events),
        snapshots: Array.isArray(state.history.snapshots) ? structuredClone(state.history.snapshots) : []
      }
    : emptyHistory();
  if (!migratedHistory.events.length) {
    migratedHistory = appendHistoryEvents(migratedHistory, [{
      type: 'imported',
      subject: { scope: 'model' },
      field: 'version',
      oldValue: null,
      newValue: state?.version || 1,
      note: 'Bestehendes Modell ohne Historie übernommen.'
    }], 'Migration', () => state?.savedAt || new Date().toISOString());
  }
  return { model, history: migratedHistory };
}

function applyModelState(state) {
  const migrated = migrateModelState(state);
  const model = migrated.model;
  hideStartScreen();
  inputIds.forEach(id => {
    if (Object.hasOwn(model.inputs, id)) {
      el[id].value = model.inputs[id];
    } else if (Object.hasOwn(inputDefaults, id)) {
      el[id].value = inputDefaults[id];
    }
  });
  measures = model.measures.map((measure, index) => normalizeMeasureForUi(measure, index));
  selectedId = measures.some(measure => measure.id === model.selectedId)
    ? model.selectedId
    : measures[0]?.id;
  scenario = ['basis', 'konservativ', 'wert'].includes(model.scenario) ? model.scenario : 'basis';
  activeView = ['akte', 'basis', 'measures', 'results', 'report', 'projectPlan', 'expertWork', 'sidecar', 'presentation'].includes(model.activeView) ? model.activeView : activeView;
  reportMode = ['management', 'committee'].includes(model.reportMode) ? model.reportMode : 'management';
  meetingFocus = ['management', 'technik', 'vnb', 'controlling', 'finanzierung'].includes(model.meetingFocus) ? model.meetingFocus : 'management';
  meetingTextOverrides = model.meetingTextOverrides && typeof model.meetingTextOverrides === 'object'
    ? structuredClone(model.meetingTextOverrides)
    : {};
  processState = normalizeProcessState(model.process);
  projectPlan = normalizeProjectPlan(model.projectPlan, Number(model.inputs?.baseYear || el.baseYear.value || 2027));
  activeProjectTaskId = findProjectPlanTask(projectPlan, model.activeProjectTaskId)?.task.id || '';
  sidecar = normalizeSidecar(model.sidecar);
  selectedSidecarId = sidecar.objects.some(object => object.id === model.selectedSidecarId) ? model.selectedSidecarId : (sidecar.objects[0]?.id || '');
  strategy = normalizeStrategy(model.strategy);
  committee = normalizeCommittee(model.committee);
  importMapping = model.importMapping && typeof model.importMapping === 'object' ? structuredClone(model.importMapping) : {};
  catalogGroupBy = ['orgUnit', 'type', 'year', 'target'].includes(model.catalogGroupBy) ? model.catalogGroupBy : 'orgUnit';
  resultViewMode = ['regulatory', 'earnings'].includes(model.resultViewMode) ? model.resultViewMode : 'regulatory';
  clarificationStatus = model.clarificationStatus && typeof model.clarificationStatus === 'object'
    ? structuredClone(model.clarificationStatus)
    : {};
  lastReleaseCheck = model.lastReleaseCheck && typeof model.lastReleaseCheck === 'object'
    ? structuredClone(model.lastReleaseCheck)
    : state?.lastReleaseCheck && typeof state.lastReleaseCheck === 'object'
      ? structuredClone(state.lastReleaseCheck)
      : null;
  renderReleaseAwareness();
  applyRole(roleProfiles[model.role] ? model.role : currentRole, false);
  history = migrated.history;
  document.querySelectorAll('.scenario').forEach(btn => btn.classList.toggle('active', btn.dataset.scenario === scenario));
  document.querySelectorAll('.focus-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.focus === meetingFocus));
  setView(activeView);
  suppressHistoryEvents = true;
  try {
    renderAll();
  } finally {
    suppressHistoryEvents = false;
  }
  previousModelForHistory = currentModelData();
  rememberSeenHead();
}

function saveToBrowser(silent = true) {
  try {
    const currentModel = currentModelData();
    if (!suppressHistoryEvents && previousModelForHistory) {
      const eventDrafts = diffModelEvents(previousModelForHistory, currentModel);
      if (eventDrafts.length) {
        history = appendHistoryEvents(history, eventDrafts, ensureAuthor());
        previousModelForHistory = structuredClone(currentModel);
      }
    } else if (!previousModelForHistory) {
      previousModelForHistory = structuredClone(currentModel);
    }
    localStorage.setItem(storageKey, JSON.stringify(collectModelState()));
    rememberSeenHead();
    if (!silent) setStorageStatus('Daten wurden im Browser gespeichert.');
  } catch (_error) {
    setStorageStatus('Browser-Speicherung ist nicht verfügbar.');
  }
}

function loadEmbeddedModelState() {
  const node = document.getElementById('embedded-model-state');
  if (!node?.textContent?.trim()) return false;
  try {
    applyModelState(JSON.parse(node.textContent));
    saveToBrowser(true);
    setStorageStatus('HTML-Datei mit eingebettetem Datenstand geladen.');
    return true;
  } catch (_error) {
    setStorageStatus('Eingebetteter HTML-Datenstand konnte nicht geladen werden.');
    return false;
  }
}

function loadFromBrowser() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    applyModelState(JSON.parse(raw));
    setStorageStatus('Gespeicherte Browserdaten geladen.');
    return true;
  } catch (_error) {
    setStorageStatus('Gespeicherte Browserdaten konnten nicht geladen werden.');
    return false;
  }
}

function showStartScreen() {
  document.body.classList.add('show-start');
  document.getElementById('startScreen').classList.remove('hidden');
}

function hideStartScreen() {
  document.body.classList.remove('show-start');
  document.getElementById('startScreen').classList.add('hidden');
}

function loadExpertMode() {
  try {
    expertMode = localStorage.getItem(expertModeKey) === 'true';
  } catch (_error) {
    expertMode = false;
  }
}

function saveExpertMode() {
  try {
    localStorage.setItem(expertModeKey, expertMode ? 'true' : 'false');
  } catch (_error) {}
}

function setExpertMode(enabled, persist = true) {
  expertMode = enabled;
  document.body.classList.toggle('expert-mode', expertMode);
  const toggle = document.getElementById('expertModeToggle');
  if (toggle) toggle.checked = expertMode;
  expertFieldIds.forEach(id => {
    const field = el[id] || document.getElementById(id);
    const wrapper = field?.closest('.grid2 > div') || field?.closest('div');
    if (!wrapper) return;
    wrapper.classList.add('expert-field');
    wrapper.classList.toggle('expert-hidden', !expertMode);
  });
  if (persist) saveExpertMode();
}

function exportModel() {
  createExportSnapshot();
  const state = collectModelState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'regulierte-sparten-szenario-rechner-' + exportStamp(state) + '.json');
  setStorageStatus('JSON-Datei wurde zum Download vorbereitet.');
}

function refreshBuildMeta() {
  const commitNode = document.querySelector('meta[name="build-commit"]');
  const timeNode = document.querySelector('meta[name="build-time"]');
  if (commitNode) commitNode.setAttribute('content', buildInfo.buildCommit);
  if (timeNode) timeNode.setAttribute('content', buildInfo.buildTime);
}

function exportSelfContainedHtml() {
  createExportSnapshot();
  refreshBuildMeta();
  const state = collectModelState();
  const html = '<!DOCTYPE html>\n' + htmlWithEmbeddedModelState(document.documentElement.outerHTML, state);
  const blob = new Blob([html], { type: 'text/html' });
  downloadBlob(blob, 'szenarienrechner-eog-mit-daten-' + exportStamp(state) + '.html');
  setStorageStatus('HTML-Datei mit eingebettetem Datenstand wurde zum Download vorbereitet.');
}

function currentSpreadsheetTables() {
  return spreadsheetTables(currentModelData(), {
    buildInfo,
    ruleset: activeRulesetInfo()
  });
}

function exportSpreadsheetXlsx() {
  const state = collectModelState();
  const workbook = tablesToXlsx(currentSpreadsheetTables());
  downloadBlob(
    new Blob([workbook], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'szenarienrechner-eog-tabellen-' + exportStamp(state) + '.xlsx'
  );
  setStorageStatus('XLSX-Arbeitsmappe mit Maßnahmen, KPIs, Projektplan und Provenienz wurde vorbereitet.');
}

function exportSpreadsheetCsvZip() {
  const state = collectModelState();
  const archive = tablesToCsvZip(currentSpreadsheetTables());
  downloadBlob(
    new Blob([archive], { type: 'application/zip' }),
    'szenarienrechner-eog-tabellen-csv-' + exportStamp(state) + '.zip'
  );
  setStorageStatus('CSV-ZIP mit Tabellenblättern wurde vorbereitet.');
}

function importModelFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      const incoming = migrateModelState(JSON.parse(String(reader.result)));
      const comparison = compareHistoryChains(history, incoming.history);
      if (comparison.relation === 'incomingNewer' || comparison.relation === 'divergent' || comparison.relation === 'localNewer') {
        showImportReview({ incoming, comparison });
        return;
      }
      applyModelState({ model: incoming.model, history: incoming.history });
      saveToBrowser(true);
      setStorageStatus('Import erfolgreich. Daten wurden im Browser gespeichert.');
    } catch (error) {
      setStorageStatus('Import fehlgeschlagen: JSON-Datei passt nicht zum Rechner.');
      showRuntimeError(
        'Import fehlgeschlagen',
        error,
        'Die JSON-Datei konnte nicht vollständig migriert oder angewendet werden. Der vorhandene Arbeitsstand wurde nicht übernommen.'
      );
    }
  });
  reader.readAsText(file);
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replaceAll('\ufeff', '')
    .replaceAll('.', '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\s+/g, ' ');
}

function detectDelimiter(text) {
  const first = String(text || '').split(/\r?\n/).find(line => line.trim()) || '';
  const candidates = [';', '\t', ','];
  return candidates
    .map(delimiter => ({ delimiter, count: first.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ';';
}

function parseDelimitedRows(text, delimiter = detectDelimiter(text)) {
  return String(text || '')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, '').replaceAll('""', '"')));
}

function autoMapHeaders(headers) {
  const previous = importMapping && typeof importMapping === 'object' ? importMapping : {};
  const mapped = {};
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const previousMatch = previous[header] || previous[normalized];
    if (previousMatch && importFields.some(([field]) => field === previousMatch)) {
      mapped[index] = previousMatch;
      return;
    }
    const match = Object.entries(importHeaderSynonyms).find(([, synonyms]) => synonyms.some(synonym => normalized === normalizeHeader(synonym) || normalized.includes(normalizeHeader(synonym))));
    mapped[index] = match?.[0] || 'ignore';
  });
  return mapped;
}

function parseGermanNumber(value, fallback = 0) {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  const normalized = text
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^\d.+-]/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function parseBooleanCell(value, fallback = false) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return fallback;
  return ['1', 'ja', 'j', 'yes', 'x', 'true', 'aktiv'].includes(text);
}

function importValue(row, mapping, field) {
  const index = Object.entries(mapping).find(([, mappedField]) => mappedField === field)?.[0];
  return index === undefined ? '' : row[Number(index)] ?? '';
}

function importedMeasureFromRow(row, mapping, index) {
  const templateId = String(importValue(row, mapping, 'templateId') || '').trim();
  const template = measureTemplates.find(item => item.templateId === templateId || item.name.toLowerCase() === templateId.toLowerCase());
  const base = template ? measureFromTemplate(template) : newMeasureTemplate(measures.length + index + 1);
  const name = String(importValue(row, mapping, 'name') || base.name).trim();
  const year = Math.round(parseGermanNumber(importValue(row, mapping, 'year'), base.year));
  const cost = parseGermanNumber(importValue(row, mapping, 'cost'), base.cost);
  if (!name) return { error: 'Bezeichnung fehlt' };
  if (!Number.isFinite(cost) || cost <= 0) return { error: 'Kosten unlesbar oder <= 0' };
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return { error: 'Jahr außerhalb plausibler Grenzen' };
  const tags = parseTags(importValue(row, mapping, 'tags') || base.tags);
  const measure = normalizeMeasureForUi({
    ...base,
    id: base.id || 'import_' + Date.now().toString(36) + '_' + index,
    active: importValue(row, mapping, 'active') === '' ? false : parseBooleanCell(importValue(row, mapping, 'active')),
    externalId: String(importValue(row, mapping, 'externalId') || '').trim(),
    name,
    orgUnit: String(importValue(row, mapping, 'orgUnit') || base.orgUnit || '').trim(),
    monitoringProfile: String(importValue(row, mapping, 'monitoringProfile') || base.monitoringProfile || 'none').trim(),
    monitoringCategory: String(importValue(row, mapping, 'monitoringCategory') || base.monitoringCategory || '').trim(),
    networkLevel: String(importValue(row, mapping, 'networkLevel') || base.networkLevel || '').trim(),
    reportingRegion: String(importValue(row, mapping, 'reportingRegion') || base.reportingRegion || '').trim(),
    reportingStatus: String(importValue(row, mapping, 'reportingStatus') || base.reportingStatus || '').trim(),
    capacityImpact: String(importValue(row, mapping, 'capacityImpact') || base.capacityImpact || '').trim(),
    bottleneckRef: String(importValue(row, mapping, 'bottleneckRef') || base.bottleneckRef || '').trim(),
    permitRequired: String(importValue(row, mapping, 'permitRequired') || base.permitRequired || 'unknown').trim(),
    permitStatus: String(importValue(row, mapping, 'permitStatus') || base.permitStatus || '').trim(),
    investmentDecisionStatus: String(importValue(row, mapping, 'investmentDecisionStatus') || base.investmentDecisionStatus || 'unknown').trim(),
    investmentDecisionDate: String(importValue(row, mapping, 'investmentDecisionDate') || base.investmentDecisionDate || '').trim(),
    alternativesChecked: String(importValue(row, mapping, 'alternativesChecked') || base.alternativesChecked || '').trim(),
    flexibilityNeed: String(importValue(row, mapping, 'flexibilityNeed') || base.flexibilityNeed || '').trim(),
    type: ['wahl', 'noRegret', 'risiko'].includes(String(importValue(row, mapping, 'type')).trim()) ? String(importValue(row, mapping, 'type')).trim() : base.type,
    cost,
    year,
    life: Math.max(1, Math.round(parseGermanNumber(importValue(row, mapping, 'life'), base.life))),
    hgbLife: Math.max(1, Math.round(parseGermanNumber(importValue(row, mapping, 'hgbLife'), base.hgbLife || base.life))),
    secure: clamp(parseGermanNumber(importValue(row, mapping, 'secure'), base.secure), 0, 100),
    uncertain: clamp(parseGermanNumber(importValue(row, mapping, 'uncertain'), base.uncertain), 0, 100),
    probability: clamp(parseGermanNumber(importValue(row, mapping, 'probability'), base.probability), 0, 100),
    opexRecognition: clamp(parseGermanNumber(importValue(row, mapping, 'opexRecognition'), base.opexRecognition), 0, 100),
    tags: tags.length ? tags : base.tags,
    importStatus: 'unconfirmed',
    note: String(base.note || '').trim()
      ? base.note
      : 'Aus Import angelegt. Fachliche Annahmen und lokale Werte prüfen.'
  }, measures.length + index);
  return { measure };
}

function buildBulkImportPlan() {
  if (!bulkImportState) return { added: [], updated: [], skipped: [] };
  const existingByExternalId = new Map(measures.filter(measure => measure.externalId).map(measure => [String(measure.externalId), measure]));
  const added = [];
  const updated = [];
  const skipped = [];
  bulkImportState.rows.forEach((row, index) => {
    const parsed = importedMeasureFromRow(row, bulkImportState.mapping, index);
    if (parsed.error) {
      skipped.push({ index: index + 2, reason: parsed.error });
      return;
    }
    const existing = parsed.measure.externalId ? existingByExternalId.get(parsed.measure.externalId) : null;
    if (existing) {
      updated.push({ existing, incoming: parsed.measure, index: index + 2 });
    } else {
      added.push({ incoming: parsed.measure, index: index + 2 });
    }
  });
  return { added, updated, skipped };
}

function renderBulkImportModal() {
  if (!bulkImportState) return;
  const body = document.getElementById('bulkImportBody');
  const stepper = document.getElementById('bulkImportStepper');
  const back = document.getElementById('bulkImportBack');
  const next = document.getElementById('bulkImportNext');
  stepper.innerHTML = bulkImportSteps.map((label, index) => `<span class="${index === bulkImportState.step ? 'active' : ''}">${index + 1}. ${esc(label)}</span>`).join('');
  back.disabled = bulkImportState.step === 0;
  next.textContent = bulkImportState.step === 2 ? 'Übernehmen' : 'Weiter';
  if (bulkImportState.step === 0) {
    body.innerHTML = `
      <div class="stack">
        <p class="hint">CSV-Datei wählen oder Zellen direkt aus Excel einfügen. Semikolon, Komma und Tab werden automatisch erkannt.</p>
        <div class="action-row">
          <button type="button" id="chooseBulkImportFile">CSV-Datei wählen</button>
          <button type="button" id="downloadCsvTemplate">CSV-Vorlage herunterladen</button>
        </div>
        <textarea id="bulkImportPaste" rows="8" placeholder="Excel-Zellbereich hier einfügen">${esc(bulkImportState.rawText || '')}</textarea>
        ${bulkImportState.headers.length ? `<h3>Vorschau</h3><div class="table-wrap">${previewTableHtml([bulkImportState.headers, ...bulkImportState.rows.slice(0, 10)])}</div>` : ''}
      </div>
    `;
    return;
  }
  if (bulkImportState.step === 1) {
    body.innerHTML = `
      <p class="hint">Prüfe die Zuordnung. Nicht erkannte Spalten bleiben auf „Ignorieren“.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Spalte</th><th>Zuordnung</th><th>Beispiel</th></tr></thead>
          <tbody>${bulkImportState.headers.map((header, index) => `
            <tr>
              <td>${esc(header)}</td>
              <td><select data-import-column="${index}">${importFields.map(([field, label]) => `<option value="${field}" ${bulkImportState.mapping[index] === field ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></td>
              <td>${esc(bulkImportState.rows[0]?.[index] || '')}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    `;
    return;
  }
  const plan = buildBulkImportPlan();
  body.innerHTML = `
    <div class="import-summary">
      <div><strong>${plan.added.length}</strong><span>neu</span></div>
      <div><strong>${plan.updated.length}</strong><span>Updates</span></div>
      <div><strong>${plan.skipped.length}</strong><span>übersprungen</span></div>
    </div>
    <p class="hint">Importierte Maßnahmen starten inaktiv, sofern die Spalte „aktiv“ nicht ausdrücklich gesetzt ist. Wirkannahmen und Notizen bleiben bei Updates erhalten.</p>
    ${plan.skipped.length ? `<h3>Übersprungene Zeilen</h3><ul>${plan.skipped.slice(0, 8).map(item => `<li>Zeile ${item.index}: ${esc(item.reason)}</li>`).join('')}</ul>` : ''}
    <h3>Vorschau Übernahme</h3>
    <div class="table-wrap"><table><thead><tr><th>Art</th><th>ID</th><th>Maßnahme</th><th>Kosten</th><th>Jahr</th><th>Bereich</th></tr></thead><tbody>
      ${[...plan.added.map(item => ['neu', item.incoming]), ...plan.updated.map(item => ['Update', item.incoming])].slice(0, 12).map(([kind, measure]) => `
        <tr><td>${kind}</td><td>${esc(measure.externalId || '-')}</td><td>${esc(measure.name)}</td><td>${fmtTeur(measure.cost)}</td><td>${measure.year}</td><td>${esc(measure.orgUnit || '-')}</td></tr>
      `).join('')}
    </tbody></table></div>
  `;
}

function previewTableHtml(rows) {
  if (!rows.length) return '';
  return `<table><tbody>${rows.map((row, rowIndex) => `<tr>${row.map(cell => rowIndex === 0 ? `<th>${esc(cell)}</th>` : `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function loadBulkImportText(text) {
  const delimiter = detectDelimiter(text);
  const parsed = parseDelimitedRows(text, delimiter);
  const headers = parsed[0] || [];
  bulkImportState = {
    ...(bulkImportState || { step: 0 }),
    rawText: text,
    delimiter,
    headers,
    rows: parsed.slice(1),
    mapping: autoMapHeaders(headers)
  };
  renderBulkImportModal();
}

function openBulkImportModal() {
  if (isReadOnlyRole()) return;
  bulkImportState = {
    step: 0,
    rawText: '',
    delimiter: ';',
    headers: [],
    rows: [],
    mapping: {}
  };
  document.getElementById('bulkImportModal').classList.remove('hidden');
  renderBulkImportModal();
}

function closeBulkImportModal() {
  document.getElementById('bulkImportModal').classList.add('hidden');
  bulkImportState = null;
}

function bulkImportForward() {
  if (!bulkImportState) return;
  if (bulkImportState.step === 0) {
    const pasted = document.getElementById('bulkImportPaste')?.value || bulkImportState.rawText || '';
    if (pasted.trim()) {
      const delimiter = detectDelimiter(pasted);
      const parsed = parseDelimitedRows(pasted, delimiter);
      const headers = parsed[0] || [];
      bulkImportState = {
        ...bulkImportState,
        rawText: pasted,
        delimiter,
        headers,
        rows: parsed.slice(1),
        mapping: autoMapHeaders(headers)
      };
    }
    if (!bulkImportState.headers.length || !bulkImportState.rows.length) {
      setStorageStatus('Bitte CSV-Datei wählen oder Excel-Daten einfügen.');
      return;
    }
    bulkImportState.step = 1;
    renderBulkImportModal();
    return;
  }
  if (bulkImportState.step === 1) {
    document.querySelectorAll('[data-import-column]').forEach(select => {
      bulkImportState.mapping[Number(select.dataset.importColumn)] = select.value;
    });
    importMapping = Object.fromEntries(bulkImportState.headers.map((header, index) => [normalizeHeader(header), bulkImportState.mapping[index]]));
    bulkImportState.step = 2;
    renderBulkImportModal();
    return;
  }
  applyBulkImport();
}

function bulkImportBack() {
  if (!bulkImportState || bulkImportState.step === 0) return;
  bulkImportState.step -= 1;
  renderBulkImportModal();
}

function applyBulkImport() {
  const plan = buildBulkImportPlan();
  const importedFields = new Set(Object.values(bulkImportState.mapping).filter(field => field !== 'ignore'));
  const updateFieldNames = ['name', 'orgUnit', 'type', 'cost', 'year', 'life', 'hgbLife', 'secure', 'uncertain', 'probability', 'opexRecognition', 'active', 'tags', 'templateId', 'monitoringProfile', 'monitoringCategory', 'networkLevel', 'reportingRegion', 'reportingStatus', 'capacityImpact', 'bottleneckRef', 'permitRequired', 'permitStatus', 'investmentDecisionStatus', 'investmentDecisionDate', 'alternativesChecked', 'flexibilityNeed'];
  measures = measures.map(measure => {
    const update = plan.updated.find(item => item.existing.id === measure.id);
    if (!update) return measure;
    const patch = {};
    updateFieldNames.forEach(field => {
      if (importedFields.has(field)) patch[field] = update.incoming[field];
    });
    return normalizeMeasureForUi({
      ...measure,
      ...patch,
      externalId: update.incoming.externalId || measure.externalId,
      importStatus: 'unconfirmed'
    });
  });
  const newMeasures = plan.added.map(item => normalizeMeasureForUi({
    ...item.incoming,
    id: 'import_' + Date.now().toString(36) + '_' + item.index
  }));
  measures = [...measures, ...newMeasures];
  selectedId = newMeasures[0]?.id || selectedId;
  history = appendHistoryEvents(history, [{
    type: 'bulkImport',
    subject: { scope: 'measures' },
    field: 'measures',
    oldValue: null,
    newValue: { added: plan.added.length, updated: plan.updated.length, skipped: plan.skipped.length, columns: Object.fromEntries(Object.entries(bulkImportState.mapping).map(([index, field]) => [bulkImportState.headers[Number(index)], field])) },
    note: `Massenimport: ${plan.added.length} neu, ${plan.updated.length} aktualisiert, ${plan.skipped.length} übersprungen.`
  }], ensureAuthor());
  previousModelForHistory = currentModelData();
  closeBulkImportModal();
  setStorageStatus(`Import übernommen: ${plan.added.length} neu, ${plan.updated.length} Updates.`);
  renderAll();
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[;"\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadText(filename, text, type = 'text/csv') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportCatalogCsv() {
  const p = currentParams();
  const rows = filteredMeasures(p).map(measure => {
    const result = calcMeasure(measure, p, portfolioEffectFor(measure, p));
    return [
      measure.externalId,
      measure.name,
      measure.orgUnit,
      measure.type,
      measure.year,
      measure.cost,
      measure.life,
      measure.hgbLife || measure.life,
      measure.monitoringProfile || '',
      measure.monitoringCategory || '',
      measure.networkLevel || '',
      measure.reportingRegion || '',
      measure.reportingStatus || '',
      measure.permitRequired || '',
      measure.investmentDecisionStatus || '',
      measure.active ? 'ja' : 'nein',
      tagsText(measure.tags),
      Number.isFinite(result.irr) ? (result.irr * 100).toFixed(2).replace('.', ',') : '',
      result.npv.toFixed(2).replace('.', ','),
      (result.rows[0]?.regulatoryEogEffect || 0).toFixed(2).replace('.', ','),
      (result.rows[0]?.ebit || 0).toFixed(2).replace('.', ',')
    ];
  });
  const header = ['externalId', 'name', 'orgUnit', 'type', 'year', 'costTeur', 'life', 'hgbLife', 'monitoringProfile', 'monitoringCategory', 'networkLevel', 'reportingRegion', 'reportingStatus', 'permitRequired', 'investmentDecisionStatus', 'active', 'tags', 'irrPct', 'npvTeur', 'eogJ1Teur', 'ebitJ1Teur'];
  const csv = [header, ...rows].map(row => row.map(csvEscape).join(';')).join('\n');
  downloadText('szenario-rechner-katalog.csv', csv);
  setStorageStatus('Katalog-CSV wurde vorbereitet.');
}

function downloadCsvTemplate() {
  const rows = [
    ['externalId', 'name', 'orgUnit', 'type', 'year', 'costTeur', 'life', 'hgbLife', 'active', 'tags', 'templateId', 'monitoringProfile', 'monitoringCategory', 'networkLevel', 'reportingRegion', 'reportingStatus'],
    ['PSP-1001', 'Ersatz Ortsnetzstation Muster', 'Netze Strom', 'wahl', '2028', '150', '35', '35', 'nein', 'RP5, Pflicht', 'tpl_ons_ersatz', 'nap14d', 'Erneuerung', 'Mittelspannung', 'Cluster Nord', 'geplant'],
    ['PSP-2001', 'GDRA-Modernisierung Muster', 'Netze Gas', 'risiko', '2029', '420', '30', '30', 'nein', 'Gas, Sicherheit', 'tpl_gdra_modernisierung', 'monitoring', 'Erhalt/Erneuerung', 'Mitteldruck', 'Netzgebiet Gas', 'geplant']
  ];
  downloadText('szenario-rechner-import-vorlage.csv', rows.map(row => row.map(csvEscape).join(';')).join('\n'));
}

function selectedCatalogMeasures() {
  return measures.filter(measure => selectedCatalogIds.has(measure.id));
}

function applyBulkAction(action) {
  if (isReadOnlyRole()) return;
  const selected = selectedCatalogMeasures();
  if (!selected.length) {
    setStorageStatus('Keine Maßnahmen ausgewählt.');
    return;
  }
  const orgUnit = document.getElementById('bulkOrgUnit')?.value || '';
  const objectiveId = document.getElementById('bulkObjective')?.value || '';
  const tag = document.getElementById('bulkTag')?.value.trim() || '';
  measures = measures.map(measure => {
    if (!selectedCatalogIds.has(measure.id)) return measure;
    if (action === 'activate') return { ...measure, active: true };
    if (action === 'deactivate') return { ...measure, active: false };
    if (action === 'orgUnit' && orgUnit) return { ...measure, orgUnit };
    if (action === 'objective' && objectiveId) return { ...measure, objectiveIds: [...new Set([...(measure.objectiveIds || []), objectiveId])] };
    if (action === 'tag' && tag) return { ...measure, tags: [...new Set([...parseTags(measure.tags), tag])] };
    return measure;
  });
  history = appendHistoryEvents(history, [{
    type: 'bulkAction',
    subject: { scope: 'measures' },
    field: action,
    oldValue: null,
    newValue: { count: selected.length, orgUnit, objectiveId, tag },
    note: `Bulk-Aktion ${action} auf ${selected.length} Maßnahmen.`
  }], ensureAuthor());
  previousModelForHistory = currentModelData();
  setStorageStatus(`Bulk-Aktion auf ${selected.length} Maßnahmen angewendet.`);
  renderAll();
}

function clearBrowserData() {
  try {
    [storageKey, expertModeKey, authorKey, lastSeenEventKey, roleKey, ...legacyStorageKeys].forEach(key => localStorage.removeItem(key));
    setStorageStatus('Browserdaten dieses Rechners wurden gelöscht.');
  } catch (_error) {
    setStorageStatus('Browserdaten konnten nicht gelöscht werden.');
  }
}

function hasStoredModelState() {
  try {
    return Boolean(localStorage.getItem(storageKey));
  } catch (_error) {
    return false;
  }
}

function confirmDemoOverwriteIfNeeded() {
  if (!hasStoredModelState()) return true;
  return window.confirm('Demodaten laden? Der aktuell im Browser gespeicherte Arbeitsstand wird dadurch überschrieben. Wenn du ihn behalten möchtest, speichere vorher JSON oder „HTML mit Daten speichern“.');
}

function applyDemoModel(options = {}) {
  const { confirmOverwrite = false, targetView = 'basis' } = options;
  if (confirmOverwrite && !confirmDemoOverwriteIfNeeded()) {
    setStorageStatus('Demodaten wurden nicht geladen; vorhandener Arbeitsstand bleibt erhalten.');
    return false;
  }
  hideStartScreen();
  el.sector.value = 'strom';
  el.regulationProcedure.value = 'standard';
  el.baseYear.value = '2027';
  el.baseEog.value = '20000';
  el.rab.value = '85000';
  el.returnRate.value = '5.0';
  el.financingRate.value = '5.0';
  el.capitalCostMode.value = 'simple';
  el.equityShare.value = '40';
  el.equityReturnRate.value = '5.0';
  el.debtShare.value = '60';
  el.debtReturnRate.value = '5.0';
  el.deductionCapital.value = '0';
  el.annualEnergyGwh.value = '520';
  el.householdConsumptionKwh.value = '2900';
  el.horizon.value = '20';
  el.discountRate.value = '5.0';
  el.kanuEndYear.value = '2045';
  el.degressiveRate.value = '10';
  el.taxFactor.value = '0';
  el.portfolioAttribution.value = '25';
  el.capexLagYears.value = String(defaultEffectLags.capex);
  el.opexLagYears.value = String(defaultEffectLags.opex);
  el.qeLagYears.value = String(defaultEffectLags.qe);
  el.qDelta.value = '0.6';
  el.eDelta.value = '0.2';
  measures = structuredClone(demoMeasures);
  strategy = normalizeStrategy({
    sampReference: 'Synthetisches AMP-Fragment Stromverteilung, Budgetrunde 2027, Bezug SAMP Kapitel Versorgungssicherheit',
    objectives: defaultObjectives
  });
  committee = normalizeCommittee({
    body: 'Werksausschuss',
    meetingDate: '',
    proposalText: 'Der Werksausschuss nimmt die Investitionsbewertung zur Kenntnis und beauftragt die Verwaltung, die offenen Annahmen vor der Budgetfreigabe zu klären.'
  });
  selectedId = measures[0]?.id;
  scenario = 'basis';
  activeView = targetView;
  meetingFocus = 'management';
  processState = normalizeProcessState({
    phase: 'initialisierung',
    resume: {
      statusNote: 'Demodaten geladen: Der Beispielstand ist als synthetische Planungsrunde verfügbar.',
      nextStep: 'Arbeitsstand im Akten-Cockpit verstehen; danach Maßnahmen und Entscheidungssicht öffnen.',
      owner: 'Modellverantwortung',
      dueDate: '2027-01-20'
    }
  });
  clarificationStatus = {};
  meetingTextOverrides = {};
  document.querySelectorAll('.scenario').forEach(btn => btn.classList.toggle('active', btn.dataset.scenario === scenario));
  document.querySelectorAll('.focus-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.focus === meetingFocus));
  setView(activeView);
  renderAll();
  setStorageStatus('Demodaten wurden geladen; vorhandene Browserdaten wurden überschrieben.');
  return true;
}

const storyResumeText = {
  kickoff: {
    statusNote: 'Kick-off: Rollen, Zielbild und Datenquellen werden geklärt, bevor Detailwerte eingetragen werden.',
    nextStep: 'Geführten Start öffnen und je Feld Quelle, fachliche Verantwortung und Klärbedarf bestimmen.',
    owner: 'Modellverantwortung',
    dueDate: '2027-01-20'
  },
  initialisierung: {
    statusNote: 'Initialisierung: Stammdaten-Wizard strukturiert die erste Datenerhebung mit fachlicher Kontext-Hilfe.',
    nextStep: 'EOG, Kapitalbasis, Jahresarbeit und Verfahren mit Regulierungsmanagement, Anlagenbuchhaltung und Abrechnung abstimmen.',
    owner: 'Modellverantwortung / Regulierungsmanagement',
    dueDate: '2027-02-03'
  },
  datenerhebung: {
    statusNote: 'Datenerhebung: Quellen für EOG, Kapitalbasis und Jahresarbeit sind verteilt; Ist-Werte werden belastbar gemacht.',
    nextStep: 'Regulierungsmanagement, Anlagenbuchhaltung und Abrechnung liefern die abgestimmten Werte.',
    owner: 'Modellverantwortung / Controlling',
    dueDate: '2027-02-14'
  },
  massnahmenbewertung: {
    statusNote: 'Maßnahmenbewertung: neue Fakten aus Technik und Einkauf verändern Kostenpfad, Aktivierbarkeit und Priorisierung.',
    nextStep: 'Maßnahmenkatalog prüfen, offene Wirkannahmen markieren und Sensitivitäten für unsichere Effekte bilden.',
    owner: 'Technik / Controlling',
    dueDate: '2027-03-28'
  },
  'technik-rueckkopplung': {
    statusNote: 'Technische Rückkopplung: Wirkannahmen sind plausibel, bleiben aber teilweise prüfpflichtig.',
    nextStep: 'Technik und Regulierungsmanagement entscheiden, welche Wirkungen in den Basiscase und welche nur in Sensitivitäten gehen.',
    owner: 'Netzbetrieb / Regulierungsmanagement',
    dueDate: '2027-04-18'
  },
  konsolidierung: {
    statusNote: 'Konsolidierung: Kosten, Aktivierbarkeit und wesentliche Wirkannahmen sind zusammengeführt.',
    nextStep: 'Management entscheidet, ob das Portfolio mit Auflagen in die Entscheidungsvorlage geht.',
    owner: 'Projektlenkung',
    dueDate: '2027-05-09'
  },
  entscheidungsvorlage: {
    statusNote: 'Entscheidungsvorlage: priorisierte Maßnahmen, Kennzahlen und offene Prüfpunkte sind im Report zusammengeführt.',
    nextStep: 'Beschlussvorschlag mit Auflagen finalisieren und an das zuständige Gremium geben.',
    owner: 'Modellverantwortung / Geschäftsführung',
    dueDate: '2027-06-20'
  },
  gremium: {
    statusNote: 'Gremienvorlage: Einseiter übersetzt Modelllogik, Kennzahlen und Auflagen in beschlussfähige Sprache.',
    nextStep: 'Beschluss fassen und Monitoringpunkte in die Umsetzung übergeben.',
    owner: 'Gremium / Modellverantwortung',
    dueDate: '2027-06-20'
  },
  archiv: {
    statusNote: 'Beschluss gefasst: Portfolio wird umgesetzt, Auflagen werden als Nachweis- und Monitoringpunkte weitergeführt.',
    nextStep: 'JSON-Modell und Report als Entscheidungsstand archivieren; Review nach erster Umsetzungsetappe.',
    owner: 'Modellverantwortung / Audit',
    dueDate: '2027-09-30'
  }
};

function applyStoryDeepLink() {
  const milestone = storyMilestoneFromUrl(window.location.href);
  if (!new URL(window.location.href).searchParams.has('story') && !window.location.hash.startsWith('#story')) return;
  const state = appStateForStoryMilestone(milestone);
  if (state.shouldLoadDemo) applyDemoModel();
  else hideStartScreen();
  processState = normalizeProcessState({
    ...processState,
    phase: state.phase,
    resume: storyResumeText[milestone.id] || storyResumeText.kickoff
  });
  activeView = state.view;
  meetingFocus = state.focus;
  reportMode = state.reportMode;
  document.querySelectorAll('.focus-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.focus === meetingFocus));
  document.querySelectorAll('.report-mode').forEach(btn => btn.classList.toggle('active', btn.dataset.reportMode === reportMode));
  setView(activeView);
  renderAll(false);
  setStorageStatus(`Story-Meilenstein geöffnet: ${milestone.label}.`);
  if (milestone.id === 'initialisierung') openBasisWizard();
}

function openLoadModal() {
  document.getElementById('loadModal').classList.remove('hidden');
}

function closeLoadModal() {
  document.getElementById('loadModal').classList.add('hidden');
}

function openHelpModal() {
  document.getElementById('helpModal').classList.remove('hidden');
}

function closeHelpModal() {
  document.getElementById('helpModal').classList.add('hidden');
}

function renderImprint() {
  const body = document.getElementById('imprintBody');
  if (!body) return;
  body.innerHTML = imprintSections.map(section => `
    <section>
      <h3>${esc(section.title)}</h3>
      <p>${section.lines.map(line => esc(line)).join('<br>')}</p>
    </section>
  `).join('');
}

function openImprintModal() {
  renderImprint();
  document.getElementById('imprintModal').classList.remove('hidden');
}

function closeImprintModal() {
  document.getElementById('imprintModal').classList.add('hidden');
}

function catalogNavigationList() {
  if (measureEditNavigationIds.length) {
    const byId = new Map(measures.map(measure => [measure.id, measure]));
    return measureEditNavigationIds.map(id => byId.get(id)).filter(Boolean);
  }
  const p = currentParams();
  return filteredMeasures(p);
}

function syncClarificationContextForSelectedMeasure() {
  if (!measureEditNavigationClarificationKeys.length || !measureEditClarificationContext) return;
  const nextItem = measureEditNavigationClarificationKeys
    .map(key => findClarificationItem(key))
    .find(item => item?.measureId === selectedId);
  if (!nextItem) return;
  const status = clarificationStatus[nextItem.key] || {};
  const author = ensureAuthor();
  const timestamp = new Date().toISOString();
  const taskId = ensureClarificationProjectTask(nextItem, status.status === 'closed' ? 'closed' : 'in_progress', status.note || nextItem.detail || '');
  const target = clarificationTargetFor(nextItem);
  clarificationStatus = {
    ...clarificationStatus,
    [nextItem.key]: {
      ...status,
      status: status.status === 'closed' ? 'closed' : 'in_review',
      author,
      timestamp,
      measureId: nextItem.measureId || '',
      title: nextItem.title,
      projectTaskId: taskId
    }
  };
  measureEditClarificationContext = { key: nextItem.key, title: nextItem.title, note: status.note || '', timestamp, author, projectTaskId: taskId };
  pendingMeasureFocusTarget = target.fieldId;
  pendingMeasureFocusLabel = target.label;
}

function updateMeasureStepper() {
  const list = catalogNavigationList();
  const index = list.findIndex(item => item.id === selectedId);
  const position = document.getElementById('measureEditPosition');
  const prev = document.getElementById('measureEditPrev');
  const next = document.getElementById('measureEditNext');
  const clarificationMode = Boolean(measureEditClarificationContext?.key);
  if (position) position.textContent = index >= 0
    ? `${index + 1} von ${list.length} ${clarificationMode ? 'Klärfällen' : 'im aktuellen Filter'}`
    : `${list.length} ${clarificationMode ? 'Klärfälle' : 'im aktuellen Filter'}`;
  if (prev) {
    prev.disabled = index <= 0;
    prev.textContent = clarificationMode ? 'Vorheriger Klärfall' : 'Vorherige Maßnahme';
  }
  if (next) {
    next.disabled = index < 0 || index >= list.length - 1;
    next.textContent = clarificationMode ? 'Nächster Klärfall' : 'Nächste Maßnahme';
  }
  const close = document.getElementById('measureEditClose');
  if (close) close.textContent = clarificationMode ? 'Zurück zu Prüfen & Klären' : 'Schließen';
}

function navigateMeasureInCatalog(delta) {
  const list = catalogNavigationList();
  const index = list.findIndex(item => item.id === selectedId);
  const next = list[index + delta];
  if (!next) return;
  selectedId = next.id;
  syncClarificationContextForSelectedMeasure();
  renderAll();
  renderDetail();
}

function openMeasureEditModal() {
  renderDetail();
  updateMeasureStepper();
  const modal = document.getElementById('measureEditModal');
  modal.classList.toggle('clarification-split-modal', Boolean(measureEditClarificationContext));
  modal.classList.remove('hidden');
  focusPendingMeasureField();
}

function closeMeasureEditModal() {
  const modal = document.getElementById('measureEditModal');
  modal.classList.add('hidden');
  modal.classList.remove('clarification-split-modal');
  if (measureEditReturnView) {
    const targetView = measureEditReturnView;
    measureEditReturnView = '';
    measureEditClarificationContext = null;
    measureEditNavigationIds = [];
    measureEditNavigationClarificationKeys = [];
    pendingMeasureFocusTarget = '';
    pendingMeasureFocusLabel = '';
    setView(targetView);
    renderAll();
  }
}

function meetingOverrideKey(focus, cardKey) {
  return focus + '.' + cardKey;
}

function openMeetingTextModal(focus, cardKey, title, text) {
  const key = meetingOverrideKey(focus, cardKey);
  const override = meetingTextOverrides[key] || {};
  meetingTextEdit = { key, title, text };
  document.getElementById('meetingTextHeading').value = override.title ?? title;
  document.getElementById('meetingTextBody').value = override.text ?? text;
  document.getElementById('meetingTextModal').classList.remove('hidden');
}

function closeMeetingTextModal() {
  meetingTextEdit = null;
  document.getElementById('meetingTextModal').classList.add('hidden');
}

function saveMeetingTextModal() {
  if (!meetingTextEdit) return;
  meetingTextOverrides[meetingTextEdit.key] = {
    title: document.getElementById('meetingTextHeading').value || meetingTextEdit.title,
    text: document.getElementById('meetingTextBody').value || meetingTextEdit.text
  };
  closeMeetingTextModal();
  renderPortfolio();
  saveToBrowser(true);
}

function resetMeetingTextModal() {
  if (!meetingTextEdit) return;
  delete meetingTextOverrides[meetingTextEdit.key];
  closeMeetingTextModal();
  renderPortfolio();
  saveToBrowser(true);
}

function baseHelpId(id) {
  if (!id) return '';
  const withoutWizard = id.startsWith('w_') ? id.slice(2) : id;
  const aliases = {
    mName: 'mName',
    mType: 'mType',
    mCost: 'mCost',
    mYear: 'mYear',
    mSecure: 'mSecure',
    mUncertain: 'mUncertain',
    mProbability: 'mProbability',
    mOpexRecognition: 'mOpexRecognition',
    mLife: 'mLife',
    mDepr: 'mDepr',
    mQDirect: 'mQDirect',
    mEDirect: 'mEDirect',
    mRiskAvoided: 'mRiskAvoided',
    mPortfolioShare: 'mPortfolioShare'
  };
  return aliases[withoutWizard] || withoutWizard;
}

function helpPopover() {
  let popover = document.getElementById('fieldHelpPopover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'fieldHelpPopover';
    popover.className = 'info-popover hidden';
    document.body.appendChild(popover);
  }
  return popover;
}

function hideFieldHelp() {
  helpPopover().classList.add('hidden');
}

function showFieldHelp(button, text) {
  const popover = helpPopover();
  popover.textContent = text;
  popover.classList.remove('hidden');
  const rect = button.getBoundingClientRect();
  const top = Math.min(window.innerHeight - popover.offsetHeight - 12, rect.bottom + 8);
  const left = Math.min(window.innerWidth - popover.offsetWidth - 12, Math.max(12, rect.left));
  popover.style.top = Math.max(12, top) + 'px';
  popover.style.left = left + 'px';
}

function enhanceHelpLabels(root = document) {
  root.querySelectorAll('label[for], label[data-help-id]').forEach(label => {
    if (label.querySelector('.info-dot')) return;
    const helpId = label.dataset.helpId || baseHelpId(label.getAttribute('for'));
    const help = fieldHelp[helpId];
    if (!help) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'info-dot';
    button.textContent = 'i';
    button.setAttribute('aria-label', 'Fachliche Hilfe zu ' + label.textContent.trim());
    button.title = help;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      showFieldHelp(button, help);
    });
    label.appendChild(button);
  });
}

function measureValidation(measure) {
  const messages = [];
  const invalidIds = new Set();
  const percentFields = [
    ['secure', 'mSecure', 'sicher aktivierbar'],
    ['uncertain', 'mUncertain', 'unsicherer Anteil'],
    ['probability', 'mProbability', 'Wahrscheinlichkeit'],
    ['opexRecognition', 'mOpexRecognition', 'OPEX-Anerkennung'],
    ['portfolioShare', 'mPortfolioShare', 'Portfolioanteil']
  ];
  percentFields.forEach(([key, id, label]) => {
    const value = Number(measure[key]);
    if (Number.isFinite(value) && (value < 0 || value > 100)) {
      messages.push(`${label} ${fmtPct(value, 1)} → für die Rechnung auf ${fmtPct(clamp(value, 0, 100), 1)} begrenzt.`);
      invalidIds.add(id);
    }
  });
  const secure = Number(measure.secure);
  const uncertain = Number(measure.uncertain);
  if (Number.isFinite(secure) && Number.isFinite(uncertain) && secure + uncertain > 100) {
    messages.push(`Aktivierungsanteile ${fmtPct(secure + uncertain, 1)} → sicher + unsicher liegt über 100 % der Kosten.`);
    invalidIds.add('mSecure');
    invalidIds.add('mUncertain');
  }
  const active = expectedActivated(measure);
  if (active.rawShare > 1) {
    messages.push(`Wirksamer Aktivierungsanteil ${fmtPct(active.rawShare * 100, 1)} → auf 100,0 % begrenzt.`);
    invalidIds.add('mSecure');
    invalidIds.add('mUncertain');
    invalidIds.add('mProbability');
  }
  if (Number.isFinite(Number(measure.life)) && Number(measure.life) < 1) {
    messages.push(`Nutzungsdauer ${measure.life} Jahre → für die Rechnung mindestens 1 Jahr.`);
    invalidIds.add('mLife');
  }
  return { messages, invalidIds };
}

function renderMeasureValidation(measure) {
  const node = document.getElementById('measureValidation');
  if (!node) return;
  ['mSecure', 'mUncertain', 'mProbability', 'mOpexRecognition', 'mPortfolioShare', 'mLife'].forEach(id => {
    if (el[id]) el[id].setAttribute('aria-invalid', 'false');
  });
  const validation = measureValidation(measure);
  validation.invalidIds.forEach(id => {
    if (el[id]) el[id].setAttribute('aria-invalid', 'true');
  });
  node.classList.toggle('active', Boolean(validation.messages.length));
  node.innerHTML = validation.messages.map(message => `<p>${esc(message)}</p>`).join('');
}

function inferAssetClass(measure, p) {
  const text = `${measure.name || ''} ${measure.tags || ''} ${measure.orgUnit || ''}`.toLowerCase();
  if (p.sector === 'gas') return 'gasPipe';
  if (text.includes('digital') || text.includes('fernwirk') || text.includes('automatis')) return 'digitalControl';
  if (text.includes('kabel') || text.includes('leitung')) return 'cable';
  if (text.includes('tiefbau')) return 'civilWorks';
  return 'station';
}

function renderHelperCalculators(measure) {
  const activationNode = document.getElementById('helperActivationSplit');
  const riskNode = document.getElementById('helperRiskExpectedValue');
  const qNode = document.getElementById('helperQImpact');
  const depreciationNode = document.getElementById('helperDepreciationLife');
  const spreadNode = document.getElementById('helperFinancingSpread');
  const gasNode = document.getElementById('helperGasTransformation');
  if (!activationNode || !riskNode || !qNode || !depreciationNode || !spreadNode) return;

  const p = currentParams();
  const activation = activationSplitHelper(measure);
  activationNode.innerHTML = `
    <strong>CAPEX/OPEX-Split</strong>
    <p><span class="big">${fmtTeur(activation.activated, 1)}</span><br>erwartbar aktivierbar; ${fmtTeur(activation.nonActivated, 1)} nicht aktivierter Anteil.</p>
    <p class="hint">Einmalige OPEX-Anerkennung aus aktuellem Split: ${fmtTeur(activation.firstYearOpexRecognition, 1)}. ${esc(activation.clarification)}</p>
  `;

  const riskImpact = impactAssumptionsFor(measure).find(impact => impact.area === 'risk' && !impact.legacyFlat)
    || { riskProbabilityBefore: 0, riskProbabilityAfter: 0, riskImpact: measure.riskAvoided || 0 };
  const risk = riskHelper({
    probabilityBefore: riskImpact.riskProbabilityBefore,
    probabilityAfter: riskImpact.riskProbabilityAfter,
    impact: riskImpact.riskImpact || measure.riskAvoided || 0
  });
  riskNode.innerHTML = `
    <strong>Risiko-Erwartungswert</strong>
    <p><span class="big">${fmtTeur(risk.expectedAvoidedPa, 1)}</span><br>vermiedener Erwartungsschaden p.a.</p>
    <p class="hint">${esc(risk.chain)} ${esc(risk.governance)}</p>
  `;

  const qImpact = qImpactHelper({
    metric: p.sector === 'strom' ? 'SAIDI' : 'ASIDI',
    interruptionBefore: 12,
    interruptionAfter: 10,
    affectedCustomers: 10000,
    monetizationPerCustomerMinute: 1,
    attribution: measure.portfolioShare || 100,
    evidence: ''
  });
  const directQe = Number(measure.qDirect || 0) + Number(measure.eDirect || 0);
  qNode.innerHTML = `
    <strong>Q-Wirkungs-Rechner</strong>
    <p><span class="big">${fmtTeur(directQe, 1)}</span><br>aktuell direkt angesetzte Q-/Effizienzwirkung p.a.</p>
    <p class="hint">Treiberbeispiel: ${esc(qImpact.chain)} ${esc(qImpact.governance)}</p>
  `;

  const depreciation = depreciationLifeHelper({
    assetClass: inferAssetClass(measure, p),
    sector: p.sector,
    kanuContext: measure.depr === 'kanuLinear' || measure.depr === 'kanuDegressive'
  });
  depreciationNode.innerHTML = `
    <strong>Nutzungsdauer-/AfA-Helfer</strong>
    <p><span class="big">${fmtPlain(depreciation.life, 0)} / ${fmtPlain(depreciation.hgbLife, 0)} Jahre</span><br>regulatorische ND / HGB-ND als Startpunkt.</p>
    <p class="hint">${esc(depreciation.note)}</p>
  `;

  const measureResult = calcMeasure(measure, p);
  const spread = financingSpreadHelper({
    returnMetricRate: measureResult.returnMetric.value,
    financingRate: p.financingRate,
    invest: measure.cost,
    activated: measureResult.activated,
    regulatoryReturnRate: p.returnRate,
    qAndEEffectPa: measureResult.impactSummary.qAndE + portfolioEffectFor(measure, p),
    riskEffectPa: measureResult.impactSummary.risk
  });
  spreadNode.innerHTML = `
    <strong>Finanzierungsspread-Erklärer</strong>
    <p><span class="big">${fmtPct(spread.spreadPp, 1)}</span><br>${esc(measureResult.returnMetric.label)} minus FK-Zins.</p>
    <p class="hint">${esc(spread.explanation)} ${esc(spread.warning)}</p>
  `;

  if (gasNode) {
    const gas = gasTransformationForMeasure(measure, p);
    gasNode.innerHTML = p.sector === 'gas' ? `
      <strong>Gas-Transformationspfad</strong>
      <p><span class="big">${esc(gas.recommendedQuestion || 'Rückstellung prüfen')}</span><br>${esc(gas.summary)}</p>
      <p class="hint">${esc(gas.governance || 'keine automatische Entscheidung')}</p>
    ` : '';
  }
}

function gasTransformationForMeasure(measure, p = currentParams()) {
  return gasTransformationHelper(gasTransformationInputForMeasure(measure, p));
}

function renderGasTransformationLayer(measure) {
  const node = document.getElementById('gasTransformationSummary');
  if (!node) return;
  const p = currentParams();
  if (p.sector !== 'gas' || !measure) {
    node.innerHTML = '';
    return;
  }
  const helper = gasTransformationForMeasure(measure, p);
  const lifeConflict = helper.recommendedQuestion === 'Nutzungsdauer-Entscheid erforderlich';
  node.innerHTML = `
    <div class="meta">prüfpflichtige Gas-Herleitung · ${esc(helper.confidence)}</div>
    ${lifeConflict ? '<div class="warning-card compact"><strong>Nutzungsdauer-Entscheid erforderlich</strong><p>Die Nutzungsdauer kollidiert mit KANU-/Transformationshorizont und Wegfall der Ewigkeitsvermutung; Kennzahlen erst nach bewusster fachlicher Freigabe nutzen.</p></div>' : ''}
    <strong>${esc(helper.summary)}</strong>
    <p class="hint">${esc(helper.governance)}</p>
    <div class="grid2">
      <div><strong>HGB-/Rückstellungsfragen</strong><ul>${helper.hgbChecklist.slice(0, 3).map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>
      <div><strong>Regulatorische Fragen</strong><ul>${helper.regulatoryChecklist.slice(0, 3).map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>
    </div>
  `;
}

function renderFlexibilityLayer(measure) {
  const node = document.getElementById('flexibilitySummary');
  if (!node) return;
  const p = currentParams();
  if (p.sector !== 'strom' || !measure || measure.effectType !== 'flexibility') {
    node.innerHTML = '';
    return;
  }
  const helper = flexibilityHelper(measure, p);
  node.innerHTML = `
    <div class="meta">Strom-Flexibilität · ${esc(helper.statusLabel || '')}</div>
    <strong>${esc(helper.summary)}</strong>
    <p class="hint">${esc(helper.governance)}</p>
    ${helper.warnings.length ? `<div class="warning-card compact"><strong>Prüfung erforderlich</strong><ul>${helper.warnings.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}
    <div class="grid2">
      <div><strong>CAPEX-Vermeidung</strong><p>${fmtTeur(helper.avoidedCapexTeur)} vermieden · ${fmtTeur(helper.deferredCapexTeur)} verschoben</p></div>
      <div><strong>Flex-OPEX / AGNeS</strong><p>${fmtTeur(helper.flexOpexPaTeur)} p.a. · ${helper.agnesRelevant ? esc(helper.agnesRole) : 'kein AGNeS-Bezug gesetzt'}</p></div>
    </div>
  `;
}

function renderGlobalValidation() {
  const node = document.getElementById('globalValidation');
  if (!node) return;
  const checks = [
    ['horizon', num('horizon'), 1, 60, 'Horizont', value => fmtPlain(value, 0) + ' Jahre'],
    ['degressiveRate', num('degressiveRate'), 0, 12, 'KANU degressiv', value => fmtPct(value, 1)],
    ['portfolioAttribution', num('portfolioAttribution'), 0, 100, 'Portfolio-Attribution', value => fmtPct(value, 1)]
  ];
  const messages = [];
  checks.forEach(([id, value, min, max, label, formatter]) => {
    el[id].setAttribute('aria-invalid', 'false');
    if (Number.isFinite(value) && (value < min || value > max)) {
      messages.push(`${label} ${formatter(value)} → für die Rechnung auf ${formatter(clamp(value, min, max))} begrenzt.`);
      el[id].setAttribute('aria-invalid', 'true');
    }
  });
  const simplified = el.regulationProcedure.value === 'simplified';
  const sector = el.sector.value === 'strom' ? 'strom' : 'gas';
  document.body.classList.toggle('sector-gas', sector === 'gas');
  document.body.classList.toggle('sector-strom', sector === 'strom');
  document.body.classList.toggle('simplified-procedure', simplified);
  const simplifiedHint = document.getElementById('simplifiedHint');
  if (simplifiedHint) simplifiedHint.classList.toggle('hidden', !simplified);
  ['qDelta', 'eDelta'].forEach(id => {
    if (el[id]) el[id].disabled = simplified || isReadOnlyRole();
  });
  if (simplified && (num('qDelta') !== 0 || num('eDelta') !== 0)) {
    messages.push('Vereinfachtes Verfahren: Q-/Effizienzeffekte bleiben dokumentiert, werden aber rechnerisch neutralisiert.');
  }
  const simplifiedImpacts = allImpactAssumptions(true).filter(item => item.area === 'qElement' || item.area === 'efficiency');
  if (simplified && simplifiedImpacts.length) {
    messages.push(`${simplifiedImpacts.length} Q-/Effizienz-Wirkannahmen sind dokumentiert, im vereinfachten Verfahren aber nicht erlöswirksam.`);
  }
  node.classList.toggle('active', messages.length > 0);
  node.innerHTML = messages.length
    ? `<strong>Szenarioannahmen begrenzt</strong><ul>${messages.map(message => `<li>${esc(message)}</li>`).join('')}</ul>`
    : '';
}

function scenarioDiffItems(name) {
  const base = currentParams();
  const target = currentScenarioParams(name);
  const fields = [
    ['attribution', 'Attribution', value => fmtPct(value * 100, 0)],
    ['qDelta', 'Q-Delta', value => fmtPct(value * 100, 2)],
    ['eDelta', 'E-/Effizienz-Delta', value => fmtPct(value * 100, 2)],
    ['discountRate', 'Diskontsatz', value => fmtPct(value * 100, 1)]
  ];
  if (name === 'basis') return [];
  return fields
    .filter(([key]) => Math.abs((target[key] ?? 0) - (base[key] ?? 0)) > 0.000001)
    .map(([key, label, formatter]) => `${label}: ${formatter(base[key])} → ${formatter(target[key])}`);
}

function renderScenarioDiff() {
  const node = document.getElementById('scenarioDiff');
  if (!node) return;
  const items = scenarioDiffItems(scenario);
  node.innerHTML = items.length
    ? `<strong>${scenarioLabel(scenario)} verändert:</strong><ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`
    : `<strong>${scenarioLabel(scenario)}:</strong> keine zusätzlichen Szenarioanpassungen. Es gelten die eingegebenen Annahmen.`;
}

function stressParameterItems() {
  const base = currentParams();
  const conservative = currentScenarioParams('konservativ');
  return [
    {
      label: 'Attribution',
      basis: fmtPct(base.attribution * 100, 0),
      stress: fmtPct(conservative.attribution * 100, 0)
    },
    {
      label: 'Q-Faktor',
      basis: fmtPct(base.qDelta * 100, 2),
      stress: fmtPct(conservative.qDelta * 100, 2)
    },
    {
      label: 'E-/Effizienz-Faktor',
      basis: fmtPct(base.eDelta * 100, 2),
      stress: fmtPct(conservative.eDelta * 100, 2)
    },
    {
      label: 'Diskontsatz',
      basis: fmtPct(base.discountRate * 100, 1),
      stress: fmtPct(conservative.discountRate * 100, 1)
    },
    {
      label: 'Wirkannahmen',
      basis: 'Basisannahmen',
      stress: conservative.assumptionMode === 'includeReview'
        ? 'inkl. prüfpflichtig'
        : conservative.assumptionMode === 'basisNoReview'
          ? 'ohne Review'
          : 'nur bestätigt'
    }
  ];
}

function renderStressTestWorkbench(metrics = null) {
  const node = document.getElementById('stressTestStatus');
  if (!node) return;
  const basis = currentPortfolio(currentScenarioParams('basis'));
  const conservative = currentPortfolio(currentScenarioParams('konservativ'));
  const resolvedMetrics = metrics || portfolioDecisionMetrics(basis, conservative);
  const open = resolvedMetrics.conservativeGate === 'stresstest_ausstehend';
  const items = stressParameterItems();
  node.className = 'stress-test-status-card ' + (open ? 'warn' : 'good');
  node.innerHTML = `
    <strong>${open ? 'Stresstest offen' : 'Stresstest unterscheidbar'}</strong>
    <span>${open ? 'Basis und Konservativ liefern derzeit gleiche Ergebniswerte.' : 'Konservativ wird als eigener Fall gerechnet.'}</span>
    <div class="stress-comparison-list">
      ${items.map(item => `<div><span>${esc(item.label)}</span><strong>${esc(item.basis)} → ${esc(item.stress)}</strong></div>`).join('')}
    </div>
  `;
}

function decisionFor(result, conservativeResult = null) {
  const metrics = portfolioDecisionMetrics(result, conservativeResult);
  const decision = metrics.governanceDecision;
  return {
    cls: decision.cls,
    title: decision.title,
    text: `${decision.text} ${decision.recommendation}`
  };
}

function deltaText(current, previous, formatter) {
  if (previous === null || previous === undefined || !Number.isFinite(current) || !Number.isFinite(previous)) return { text: '', cls: '' };
  const delta = current - previous;
  if (Math.abs(delta) < 0.000001) return { text: 'unverändert', cls: '' };
  return {
    text: (delta > 0 ? '+' : '') + formatter(delta),
    cls: delta > 0 ? 'up' : 'down'
  };
}

function markStickyChange(node) {
  if (!node) return;
  node.classList.add('changed');
  window.clearTimeout(node._changeTimer);
  node._changeTimer = window.setTimeout(() => node.classList.remove('changed'), 900);
}

function openStressParameters() {
  scenario = 'konservativ';
  basisEditing = true;
  document.querySelectorAll('.scenario').forEach(btn => btn.classList.toggle('active', btn.dataset.scenario === scenario));
  setView('basis');
  renderAll();
  const workbench = document.getElementById('stressTestWorkbench');
  workbench?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('conservativeDiscountRate')?.focus?.();
  setStorageStatus('Konservative Stresstest-Parameter geöffnet. Ergebnis anschließend als Befassung dokumentieren.');
}

function setDelta(id, delta) {
  const node = document.getElementById(id);
  node.textContent = delta.text;
  node.classList.toggle('up', delta.cls === 'up');
  node.classList.toggle('down', delta.cls === 'down');
  if (delta.cls) markStickyChange(node.closest('.sticky-kpi'));
}

function renderStickyKpis(result, first, decision, metrics) {
  const maturity = maturityScore();
  const snapshot = {
    eog: metrics.recurringRegulatoryEog,
    irr: result.irr,
    npv: result.npv,
    verdict: decision.title,
    maturity: maturity.score
  };
  const verdictTile = document.getElementById('stickyVerdictTile');
  verdictTile.className = 'sticky-kpi ' + decision.cls;
  document.getElementById('stickyVerdict').textContent = decision.title;
  document.getElementById('stickyEog').textContent = fmtTeur(snapshot.eog, 1);
  document.getElementById('stickyIrr').textContent = Number.isFinite(snapshot.irr) ? fmtPct(snapshot.irr * 100, 1) : '-';
  document.getElementById('stickyNpv').textContent = fmtTeur(snapshot.npv, 1);
  document.getElementById('stickyMaturity').innerHTML = maturityRingHtml(maturity.score, maturity.blockers, 44);
  document.getElementById('stickyMaturityDelta').textContent = `${maturity.blockers} Blocker`;
  document.getElementById('stickyMaturityTile').className = 'sticky-kpi ' + (maturity.blockers === 0 && maturity.score >= 75 ? 'good' : maturity.score >= 50 ? 'warn' : 'bad');

  const previous = lastStickySnapshot;
  if (previous && previous.verdict !== snapshot.verdict) {
    document.getElementById('stickyVerdictDelta').textContent = previous.verdict + ' → ' + snapshot.verdict;
    markStickyChange(verdictTile);
  } else {
    document.getElementById('stickyVerdictDelta').textContent = previous ? 'unverändert' : 'live';
  }
  setDelta('stickyEogDelta', deltaText(snapshot.eog, previous?.eog, value => fmtTeur(value, 1)));
  setDelta('stickyIrrDelta', deltaText(snapshot.irr, previous?.irr, value => fmtPct(value * 100, 1)));
  setDelta('stickyNpvDelta', deltaText(snapshot.npv, previous?.npv, value => fmtTeur(value, 1)));
  lastStickySnapshot = snapshot;
}

function pp(value) {
  return Number.isFinite(value) ? fmtPct(value * 100, 1).replace(' %', ' Prozentpunkte') : '-';
}

function trendWord(value) {
  if (!Number.isFinite(value)) return 'nicht bewertbar';
  if (value >= 0) return 'über';
  return 'unter';
}

function eogYearNarrative(result, metrics, activeText) {
  const startYear = result.p.baseYear;
  const firstFollowYear = startYear + 1;
  return {
    startYear,
    firstFollowYear,
    text: `Bei ${fmtTeur(result.invest)} Investition und ${activeText} liegt die modellierte EOG-Wirkung im Startjahr ${startYear} bei ${fmtTeur(metrics.yearOneRegulatoryEog, 1)} inklusive ${fmtTeur(metrics.yearOneOneOff, 1)} Einmaleffekt nur im Startjahr. Der erste Folgejahreswert ${firstFollowYear} liegt bei ${fmtTeur(metrics.recurringRegulatoryEog, 1)}; spätere Jahreswerte können durch AfA, Wirkungsverzüge, Reinvestitionen oder Rückbau abweichen.`
  };
}

function renderManagementSummary(result, first, spread, decision, metrics) {
  const verdict = document.getElementById('managementVerdict');
  verdict.className = 'verdict-card ' + decision.cls;
  document.getElementById('managementVerdictTitle').textContent = decision.title;
  document.getElementById('managementVerdictText').textContent = decision.text;

  const metricLabel = result.rateMetricLabel || metrics.rateMetricLabel || 'IRR';
  const irrText = Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : 'nicht berechenbar';
  const spreadAbs = Number.isFinite(spread) ? Math.abs(spread) : NaN;
  const spreadSentence = Number.isFinite(spread)
    ? `Die ${metricLabel} liegt ${pp(spreadAbs)} ${trendWord(spread)} dem FK-Zins von ${fmtPct(result.p.financingRate * 100, 1)}.`
    : 'Der Spread zum FK-Zins ist nicht berechenbar.';
  const activeText = result.activeMeasures.length === 1 ? '1 aktive Maßnahme' : result.activeMeasures.length + ' aktive Maßnahmen';
  const tariff = tariffImpactLine(result.tariffImpact);

  const narrative = eogYearNarrative(result, metrics, activeText);
  document.getElementById('managementStory').textContent = result.activeMeasures.length
    ? `${narrative.text} Die indikative Portfolio-${metricLabel} beträgt ${irrText}. ${spreadSentence}${result.tariffImpact.available ? ` Für einen Durchschnittshaushalt entspricht der erste Folgejahreswert ${narrative.firstFollowYear} rechnerisch etwa ${tariff.value}.` : ''}`
    : 'Es ist keine aktive Maßnahme ausgewählt. Für eine Entscheidung müssen zuerst Maßnahmen aktiviert oder angelegt werden.';

  const knowledgeEffect = result.qePa + result.impactPa;
  document.getElementById('managementCaveat').textContent = result.activeMeasures.length
    ? metrics.conservativeGate === 'auflage'
      ? `Konservatives Urteil ohne prüfpflichtige Wirkannahmen: ${metrics.conservative.rateMetricLabel || 'IRR'} ${Number.isFinite(metrics.conservative.irr) ? fmtPct(metrics.conservative.irr * 100, 1) : '-'}, Kapitalwert ${fmtTeur(metrics.conservative.npv, 1)}. Der positive Basiscase braucht daher Auflagen/Evidenz.`
      : knowledgeEffect > 0
        ? `Dokumentierte Portfolio- und Wirkannahmen von ${fmtTeur(knowledgeEffect, 1)} p.a. sind entscheidungsrelevant und müssen kausal sowie regulatorisch begründet bleiben.`
        : 'Die Wirtschaftlichkeit hängt vor allem an Aktivierbarkeit, Anerkennungsfähigkeit, Timing und Risikowert der Maßnahmen.'
    : 'Ohne aktive Maßnahme gibt es keinen belastbaren Business Case.';
  if (result.activeMeasures.length && result.tariffImpact.available) {
    document.getElementById('managementCaveat').textContent += ' Entgeltwirkung indikativ: ' + result.tariffImpact.caveat;
  }
  if (result.activeMeasures.length && metrics.scenarioComparison?.identicalBasisConservative) {
    document.getElementById('managementCaveat').textContent += ' Basis- und Konservativ-Szenario sind identisch; das konservative Urteil ist kein zusätzlicher Stresstest.';
  }
  if (result.flexibilitySummary?.totalCount) {
    document.getElementById('managementCaveat').textContent += ` Flexibilität / Netzfahrplan: ${result.flexibilitySummary.totalCount} Objekt(e), davon ${result.flexibilitySummary.activeCount} rechenwirksam. Flexibilitätsobjekte sind OPEX-gegen-CAPEX-Substitutionen und keine klassischen Netz-CAPEX; Netzfahrplan und AGNeS-/Nachweislogik prüfen.`;
  }
  const warningTypes = new Set((result.warnings || []).map(warning => warning.type));
  if (result.p.sector === 'strom' && warningTypes.size) {
    const stromCaveats = [];
    if (warningTypes.has('strom_regulatory_framework_review')) stromCaveats.push('Regulatorischer Sensitivitätsrahmen Strom/NEST offen.');
    if (warningTypes.has('scope_candidate_separation_review')) stromCaveats.push('Kernportfolio und Scope-Kandidaten getrennt betrachten.');
    if (warningTypes.has('strom_default_assumptions_review')) stromCaveats.push('Defaultannahmen erkannt.');
    if (warningTypes.has('risk_avoidance_evidence_missing') || warningTypes.has('risk_avoidance_outlier_review')) stromCaveats.push('RiskAvoided-Herleitung prüfpflichtig.');
    if (warningTypes.has('useful_life_plausibility_review')) stromCaveats.push('Nutzungsdauern nach Maßnahmentyp plausibilisieren.');
    if (warningTypes.has('no_regret_overuse_review')) stromCaveats.push('No-Regret-Kategorie differenzieren.');
    if (stromCaveats.length) document.getElementById('managementCaveat').textContent += ' Strom-Prüfrahmen: ' + stromCaveats.join(' ');
  }

  if (result.activeMeasures.length && metrics.conservativeGate === 'stresstest_ausstehend') {
    document.getElementById('managementCaveat').insertAdjacentHTML('beforeend', ' <button type="button" class="link-button inline-action" data-action="openStressParameters">Stresstest-Parameter bearbeiten</button>');
  }

  document.getElementById('managementNextStep').textContent = result.activeMeasures.length
    ? metrics.conservativeGate === 'stresstest_ausstehend'
      ? 'Konservatives Szenario parametrisieren und das Ergebnis als Befassung dokumentieren.'
      : 'Im Meeting die drei offenen Annahmen festziehen: Aktivierungsprofil, regulatorische Anerkennung und zurechenbare Portfolio-/Risikowirkung.'
    : 'Eine Maßnahme aktivieren, Demodaten laden oder eine neue Maßnahme geführt erfassen.';

	      const pills = [
	        ['Invest ' + fmtTeur(result.invest), ''],
	        ['Folgejahr-EOG ' + fmtTeur(metrics.recurringRegulatoryEog, 1), ''],
	        ['Einmalig J1 ' + fmtTeur(metrics.yearOneOneOff, 1), metrics.yearOneOneOff ? 'warn' : ''],
	        [`${metricLabel} indikativ ` + irrText, decision.cls],
	        [metrics.conservativeGate === 'stresstest_ausstehend'
          ? 'konservativ: Stresstest offen'
          : 'konservativ ' + (metrics.conservative ? (Number.isFinite(metrics.conservative.irr) ? fmtPct(metrics.conservative.irr * 100, 1) : '-') : '-'),
        metrics.conservativeGate === 'tragfaehig' ? 'good' : metrics.conservativeGate === 'auflage' || metrics.conservativeGate === 'stresstest_ausstehend' ? 'warn' : 'bad']
	      ];
	      document.getElementById('managementPills').innerHTML = pills.map(([text, cls]) => `<span class="pill ${cls}">${text}</span>`).join('');
	      document.getElementById('verdictWhyList').innerHTML = [
	        `Grün: Basis- und konservatives Urteil tragen; Spread ≥ 1,0 Prozentpunkt und Kapitalwert > 0.`,
	        `Gelb: Basiscase trägt nur mit Auflage, konservatives Urteil kippt, oder Grün-Kriterien nicht vollständig erfüllt.`,
	        `Rot: Spread < -1,0 Prozentpunkt oder Spread nicht belastbar.`,
	        `Aktuell Basis: Spread ${Number.isFinite(spread) ? fmtPct(spread * 100, 1) : '-'}, Kapitalwert ${fmtTeur(result.npv, 1)}.`,
	        `Ohne prüfpflichtige Annahmen: ${metrics.conservative?.rateMetricLabel || 'IRR'} ${metrics.conservative && Number.isFinite(metrics.conservative.irr) ? fmtPct(metrics.conservative.irr * 100, 1) : '-'}, Kapitalwert ${metrics.conservative ? fmtTeur(metrics.conservative.npv, 1) : '-'}.`,
	        `${metricLabel}/NPV sind indikative Cashflow-Kennzahlen, keine garantierten Zahlungsströme aus der EOG.`,
        metrics.scenarioComparison?.identicalBasisConservative ? metrics.scenarioComparison.note : ''
	      ].filter(Boolean).map(item => `<li>${esc(item)}</li>`).join('');
	    }

function meetingCard(focus, key, title, value, text) {
  const overrideKey = meetingOverrideKey(focus, key);
  const override = meetingTextOverrides[overrideKey] || {};
  const visibleTitle = override.title ?? title;
  const visibleText = override.text ?? text;
  const edited = Object.hasOwn(meetingTextOverrides, overrideKey);
  return `
    <div class="meeting-card" data-meeting-card="${key}">
      <div class="meeting-card-head">
        <strong>${esc(visibleTitle)}</strong>
        <button type="button" class="edit-icon ${edited ? 'edited' : ''}" data-action="editMeetingText" data-focus="${focus}" data-card="${key}" data-title="${esc(title)}" data-text="${esc(text)}" aria-label="Meeting-Text bearbeiten" title="Meeting-Text bearbeiten">✎</button>
      </div>
      <p>${value ? `<span class="big">${value}</span><br>` : ''}${esc(visibleText)}</p>
    </div>
  `;
}

function activeMeasureNames(result) {
  if (!result.activeMeasures.length) return 'Keine aktive Maßnahme.';
  const names = result.activeMeasures.slice(0, 3).map(measure => measure.name).join(', ');
  const suffix = result.activeMeasures.length > 3 ? ` und ${result.activeMeasures.length - 3} weitere` : '';
  return names + suffix + '.';
}

function renderEogCashflowBridge(result, metrics) {
  const economicBridge = metrics.recurringIndicativeCashflow - metrics.recurringRegulatoryEog;
  const yearOneEconomicBridge = metrics.yearOneIndicativeCashflow - metrics.yearOneRegulatoryEog;
  document.getElementById('cashflowBridgeEog').textContent = fmtTeur(metrics.recurringRegulatoryEog, 1);
  document.getElementById('cashflowBridgeEogText').textContent = `Erster Folgejahreswert der modellierten EOG-Wirkung; spätere Jahre können abweichen. Startjahr: ${fmtTeur(metrics.yearOneRegulatoryEog, 1)} inklusive ${fmtTeur(metrics.yearOneOneOff, 1)} Einmaleffekt nur im Startjahr.`;
  document.getElementById('cashflowBridgeEconomic').textContent = fmtTeur(economicBridge, 1);
  document.getElementById('cashflowBridgeEconomicText').textContent = `wirtschaftliche Überleitung aus laufenden OPEX-, Rückbau- und Reinvestitionsannahmen. Startjahr-Überleitung: ${fmtTeur(yearOneEconomicBridge, 1)}.`;
  document.getElementById('cashflowBridgeResult').textContent = fmtTeur(metrics.recurringIndicativeCashflow, 1);
  document.getElementById('cashflowBridgeResultText').textContent = `indikative Cashflow-Basis für IRR ${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'} und Kapitalwert ${fmtTeur(result.npv, 1)}.`;
  document.getElementById('cashflowBridgeCaveat').textContent = 'Diese Überleitung erklärt, warum IRR/NPV nicht die EOG selbst bewerten: Die regulatorische Erlösobergrenze wird als Annahme in eine wirtschaftliche Cashflow-Sicht übersetzt; Mengen-, Zeitverzugs- und Wälzungsrisiken bleiben zu prüfen.';
}


function activeMeasuresForReliability(result) {
  return Array.isArray(result?.activeMeasures) ? result.activeMeasures : measures.filter(measure => measure.active);
}

function measureHasSystemReference(measure = {}) {
  return Boolean(String(measure.sourceSystem || '').trim() && (String(measure.sourceRecordId || '').trim() || String(measure.externalId || '').trim()));
}

function measureHasRiskMapping(measure = {}) {
  if (Number(measure.riskAvoided || 0) <= 0) return true;
  const status = String(measure.riskEvidenceStatus || measure.riskAvoidedEvidenceStatus || '').trim();
  const meaningfulStatus = status && !['missing', 'not_assessed', 'open', 'offen'].includes(status);
  return Boolean(String(measure.riskDbRef || '').trim() || meaningfulStatus || (measure.impactAssumptions || []).some(impact => impact.area === 'risk' && (impact.evidence || impact.chain || impact.riskImpact)));
}

function measureHasRiskEvidence(measure = {}) {
  const status = measure.riskEvidenceStatus || measure.riskAvoidedEvidenceStatus || '';
  return ['documented', 'estimated', 'benannt', 'source_available', 'validated'].includes(status) || (measure.impactAssumptions || []).some(impact => impact.area === 'risk' && (impact.evidence || impact.evidenceType !== 'open'));
}

function reliabilityActionFor(item, result) {
  const active = activeMeasuresForReliability(result);
  const classic = active.filter(measure => measure.effectType !== 'flexibility');
  const riskMeasures = classic.filter(measure => Number(measure.riskAvoided || 0) > 0);
  const action = { type: 'none', label: 'Bearbeiten', ids: [], field: '', fieldLabel: '', sidecarMode: '' };
  if (item.key === 'system-references') {
    return { ...action, type: 'measure', label: 'Rückspielweg bearbeiten', ids: active.filter(measure => !measureHasSystemReference(measure)).map(measure => measure.id), field: 'mSourceSystem', fieldLabel: 'Quellsystem / Datensatz' };
  }
  if (item.key === 'risk-mapping') {
    return { ...action, type: 'measure', label: 'Risiko-Mapping bearbeiten', ids: riskMeasures.filter(measure => !measureHasRiskMapping(measure)).map(measure => measure.id), field: 'mRiskDbRef', fieldLabel: 'Risikodatenbank / Evidenzstatus' };
  }
  if (item.key === 'risk-evidence') {
    return { ...action, type: 'measure', label: 'RiskAvoided-Evidenz bearbeiten', ids: riskMeasures.filter(measure => !measureHasRiskEvidence(measure)).map(measure => measure.id), field: 'mRiskEvidenceStatus', fieldLabel: 'Risiko-Evidenzstatus' };
  }
  if (item.key === 'target-mapping') {
    return { ...action, type: 'measure', label: 'Ziel-Zuordnung bearbeiten', ids: active.filter(measure => !(measure.objectiveIds || []).length).map(measure => measure.id), field: 'measureObjectives', fieldLabel: 'Trägt bei zu' };
  }
  if (item.key === 'no-regret-default') {
    return { ...action, type: 'measure', label: 'Typisierung prüfen', ids: classic.filter(measure => ['noRegret', 'no_regret_working_assumption', 'no_regret_confirmed'].includes(measure.type)).map(measure => measure.id), field: 'mType', fieldLabel: 'Typ / Klassifikation' };
  }
  if (item.key === 'sidecar-evidence') {
    const open = (sidecar.objects || []).filter(object => object.openQuestions?.length || ['missing', 'conflicting', 'stale'].includes(object.evidenceStatus) || (object.type === 'data_quality' && object.status !== 'archived' && object.evidenceStatus !== 'validated'));
    return { ...action, type: 'sidecar', label: 'Evidenzobjekte anzeigen', ids: open.map(object => object.id), sidecarMode: 'open_questions' };
  }
  return action;
}

function reliabilityProgressHtml(item) {
  const match = String(item.value || '').match(/(\d+)\s+von\s+(\d+)/);
  if (!match) return `<div class="value">${esc(item.value)}</div>`;
  const open = Number(match[1]);
  const total = Math.max(1, Number(match[2]));
  const done = Math.max(0, total - open);
  const openPct = Math.min(100, Math.max(0, open / total * 100));
  const donePct = Math.max(0, 100 - openPct);
  return `
    <div class="reliability-progress" aria-label="${open} offen, ${done} dokumentiert, ${total} gesamt">
      <div class="reliability-progress-head"><strong>${open}</strong><span>offen</span><strong>${done}</strong><span>dokumentiert</span></div>
      <div class="reliability-bars" aria-hidden="true">
        <span class="reliability-bar-open" style="width:${openPct}%"></span>
        <span class="reliability-bar-done" style="width:${donePct}%"></span>
      </div>
      <div class="reliability-progress-foot">${total} geprüft</div>
    </div>
  `;
}

function focusPendingMeasureField() {
  if (!pendingMeasureFocusTarget) return;
  window.setTimeout(() => {
    document.querySelectorAll('.field-focus-target').forEach(node => node.classList.remove('field-focus-target'));
    const target = document.getElementById(pendingMeasureFocusTarget);
    if (!target) return;
    const wrapper = target.closest('label, .wide-field, .group, div') || target;
    wrapper.classList.add('field-focus-target');
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (typeof target.focus === 'function' && !target.matches('div')) target.focus({ preventScroll: true });
    const banner = document.getElementById('measureClarificationAuditBanner');
    if (banner && pendingMeasureFocusLabel) {
      banner.classList.remove('hidden');
      banner.insertAdjacentHTML('beforeend', `<p class="focus-hint">Bearbeitungsschwerpunkt: ${esc(pendingMeasureFocusLabel)}</p>`);
    }
  }, 80);
}

function openReliabilityWorkItem(key) {
  const result = currentPortfolio();
  const item = workstandReliabilityFor(currentModelData(), result).items.find(entry => entry.key === key);
  if (!item) return;
  const action = reliabilityActionFor(item, result);
  if (action.type === 'measure' && action.ids.length) {
    selectedId = action.ids[0];
    measureEditNavigationIds = action.ids;
    pendingMeasureFocusTarget = action.field;
    pendingMeasureFocusLabel = action.fieldLabel;
    measureEditReturnView = activeView;
    renderAll();
    openMeasureEditModal();
    return;
  }
  if (action.type === 'sidecar') {
    sidecarModeFilter = action.sidecarMode || 'open_questions';
    selectedSidecarId = action.ids[0] || selectedSidecarId;
    setView('sidecar');
    renderAll();
  }
}

function reliabilityCardHtml(item, result) {
  const action = reliabilityActionFor(item, result);
  const disabled = action.type === 'none' || !action.ids.length;
  return `
    <article class="summary-card reliability-card ${item.severity === 'warn' ? 'warn' : 'good'}" data-reliability-key="${esc(item.key)}">
      <div class="label">${esc(item.label)}</div>
      ${reliabilityProgressHtml(item)}
      <p>${esc(item.detail)}</p>
      <button type="button" class="link-button reliability-action" data-workstand-action="${esc(item.key)}" ${disabled ? 'disabled' : ''}>${esc(disabled ? 'kein direkter Handlungsbedarf' : action.label)}</button>
    </article>
  `;
}

function renderWorkstandReliability(result) {
  const cards = document.getElementById('workstandReliabilityCards');
  if (!cards) return;
  const reliability = workstandReliabilityFor(currentModelData(), result);
  cards.innerHTML = reliability.items.map(item => reliabilityCardHtml(item, result)).join('');
  const caveat = document.getElementById('workstandReliabilityCaveat');
  if (caveat) {
    caveat.textContent = `${reliability.title}: ${reliability.verdict}. ${reliability.caveat}`;
  }
}

function waterfallBarHtml(item, maxAbs) {
  const width = Math.max(2, Math.abs(item.valueTeur) / maxAbs * 100);
  const cls = item.valueTeur < 0 ? 'negative' : 'positive';
  return `
    <div class="waterfall-row ${cls}">
      <div class="waterfall-label">${esc(item.label)}</div>
      <div class="waterfall-track"><div class="waterfall-bar" style="width:${width}%"></div></div>
      <div class="waterfall-value">${fmtTeur(item.valueTeur, 1)}</div>
    </div>
  `;
}

function renderPortfolioWaterfall(result) {
  const target = document.getElementById('portfolioWaterfall');
  if (!target) return;
  const waterfall = portfolioWaterfallFor(result);
  const items = [...waterfall.baseEogWaterfall, ...waterfall.cashflowBridge];
  const maxAbs = Math.max(1, ...items.map(item => Math.abs(item.valueTeur)));
  target.innerHTML = `
    <div class="waterfall-summary">
      <strong>Basis-EOG → Maßnahmenwirkung:</strong>
      ${fmtTeur(waterfall.baseEogTeur, 1)} Basis-EOG plus ${fmtTeur(waterfall.yearOne.regulatoryEogEffect, 1)} Startjahr-Wirkung
      (${fmtPct(waterfall.baseToYearOneRatioPct, 2)} der Basis-EOG).
      <br><strong>EOG → wirtschaftliche Überleitung → Cashflow:</strong>
      ${fmtTeur(waterfall.firstFollowYear.regulatoryEogEffect, 1)} + ${fmtTeur(waterfall.firstFollowYear.economicBridge, 1)} = ${fmtTeur(waterfall.firstFollowYear.indicativeCashflow, 1)}.
    </div>
    <div class="waterfall-bars">
      ${items.map(item => waterfallBarHtml(item, maxAbs)).join('')}
    </div>
  `;
}

function renderSensitivityTornado() {
  const target = document.getElementById('sensitivityTornado');
  if (!target) return;
  const p = currentScenarioParams(scenario);
  const tornado = portfolioSensitivityTornadoFor(portfolioModel(), p);
  const maxAbs = Math.max(1, ...tornado.drivers.flatMap(driver => [Math.abs(driver.lowDeltaNpv), Math.abs(driver.highDeltaNpv)]));
  target.innerHTML = `
    <div class="waterfall-summary">
      Basis: ${tornado.base.rateMetricLabel} ${Number.isFinite(tornado.base.irr) ? fmtPct(tornado.base.irr * 100, 1) : '-'} · Kapitalwert ${fmtTeur(tornado.base.npv, 1)}. RiskAvoided ±25 %, Nutzungsdauer ±20 % und Zinssätze/KANU-Horizont werden nur als Arbeitsvarianten gerechnet.
    </div>
    <div class="tornado-bars">
      ${tornado.drivers.map(driver => {
        const lowWidth = Math.abs(driver.lowDeltaNpv) / maxAbs * 50;
        const highWidth = Math.abs(driver.highDeltaNpv) / maxAbs * 50;
        return `
          <div class="tornado-row">
            <div class="tornado-label">${esc(driver.label)}</div>
            <div class="tornado-track" aria-label="${esc(driver.label)}">
              <div class="tornado-half left"><span class="tornado-bar low" style="width:${lowWidth}%"></span></div>
              <div class="tornado-zero"></div>
              <div class="tornado-half right"><span class="tornado-bar high" style="width:${highWidth}%"></span></div>
            </div>
            <div class="tornado-values">${fmtTeur(driver.lowDeltaNpv, 1)} / ${fmtTeur(driver.highDeltaNpv, 1)}</div>
          </div>
        `;
      }).join('')}
    </div>
    ${sidecarFinancialSignalsHtml()}
    <p class="hint">${esc(tornado.caveat)}</p>
  `;
}

function sidecarFinancialSignalsHtml() {
  const relevant = (sidecar.objects || []).filter(object => {
    const impact = object.calculationImpact || 'none';
    return impact !== 'none' || object.sensitivity === 'high' || (object.openQuestions || []).length > 0;
  });
  if (!relevant.length) {
    return '<p class="hint">Sidecar-Finanzsignale: keine offenen oder sensitivitätsrelevanten Sidecar-Objekte im aktuellen Arbeitsstand.</p>';
  }
  const rows = relevant.slice(0, 6).map(object => {
    const links = [...(object.linkedMeasures || []), ...(object.linkedScenarios || [])].filter(Boolean).join(', ') || 'nicht verknüpft';
    return `<li><strong>${esc(object.title)}</strong> · Rechenwirkung ${esc(object.calculationImpact || 'none')} · Sensitivität ${esc(object.sensitivity || 'internal')} · ${esc(links)}</li>`;
  }).join('');
  return `<div class="waterfall-summary"><strong>Sidecar-Finanzsignale</strong><p class="hint">Sidecar-Objekte werden nicht automatisch KPI-wirksam. Für die Tornado-Einordnung zählen sie als Priorisierungshinweis, sobald calculationImpact, Sensitivität oder offene Fragen auf werttreibende Annahmen zeigen.</p><ul>${rows}</ul></div>`;
}

function renderMeasureDrilldown(measure) {
  const target = document.getElementById('measureDrilldown');
  if (!target || !measure) return;
  const p = currentParams();
  const drilldown = measureDrilldownFor(measure, p, portfolioEffectFor(measure, p));
  target.innerHTML = `
    <div class="waterfall-summary"><strong>${esc(drilldown.measureName)}</strong>: CAPEX → AfA/KANU → Verzinsung → EOG → Cashflow. Aktivierte Basis ${fmtTeur(drilldown.activatedTeur, 1)} von ${fmtTeur(drilldown.capexTeur, 1)}; ${drilldown.returnMetricLabel} ${Number.isFinite(drilldown.returnMetricValue) ? fmtPct(drilldown.returnMetricValue * 100, 1) : '-'}; Kapitalwert ${fmtTeur(drilldown.npvTeur, 1)}.</div>
    <div class="drilldown-steps">
      ${drilldown.steps.map(step => `
        <div class="drilldown-step">
          <strong>${esc(step.label)}</strong>
          <span>${step.valuePct != null ? fmtPct(step.valuePct, 1) : fmtTeur(step.valueTeur || 0, 1)}</span>
          <small>${esc(step.note)}</small>
        </div>
      `).join('')}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Jahr</th><th>AfA/KANU</th><th>Verzinsung</th><th>Q/E</th><th>Risiko</th><th>EOG</th><th>Brücke</th><th>Cashflow</th></tr></thead>
        <tbody>${drilldown.rows.map(row => `
          <tr><td>${row.year}</td><td>${fmtTeur(row.depreciation, 1)}</td><td>${fmtTeur(row.capitalReturn, 1)}</td><td>${fmtTeur(row.qAndE, 1)}</td><td>${fmtTeur(row.risk, 1)}</td><td>${fmtTeur(row.regulatoryEogEffect, 1)}</td><td>${fmtTeur(row.economicBridge, 1)}</td><td>${fmtTeur(row.indicativeCashflow, 1)}</td></tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
}

function recurringDecompositionRow(result) {
  return result.yearly.slice(1).find(row => Math.abs(row.reinvestDecommission || 0) < 0.000001)
    || result.yearly[1]
    || result.yearly[0]
    || {};
}

function eogDecompositionRowHtml(label, row = {}) {
  const reinvestAsset = row.reinvestAssetEffect || 0;
  const economicBridge = (row.economicOpex || 0) + (row.reinvestDecommission || 0);
  return `
    <tr>
      <td>${esc(label)}</td>
      <td>${fmtTeur(row.depreciation || 0, 1)}</td>
      <td>${fmtTeur(row.capitalReturn || 0, 1)}</td>
      <td>${fmtTeur(reinvestAsset, 1)}</td>
      <td>${fmtTeur(row.qAndE || 0, 1)}</td>
      <td>${fmtTeur(row.risk || 0, 1)}</td>
      <td>${fmtTeur(row.firstYearOpex || 0, 1)}</td>
      <td>${fmtTeur(row.regulatoryEogEffect || 0, 1)}</td>
      <td>${fmtTeur(economicBridge, 1)}</td>
      <td>${fmtTeur(row.indicativeCashflow || 0, 1)}</td>
    </tr>
  `;
}

function eogDecompositionTableHtml(result) {
  const first = result.yearly[0] || {};
  const recurring = recurringDecompositionRow(result);
  return [
    eogDecompositionRowHtml(`Jahr 1 (${first.year || result.p.baseYear})`, first),
    eogDecompositionRowHtml(`erstes Folgejahr (${recurring.year || result.p.baseYear + 1})`, recurring)
  ].join('');
}

function renderEogDecomposition(result) {
  const body = document.getElementById('eogDecompositionBody');
  if (!body) return;
  body.innerHTML = eogDecompositionTableHtml(result);
}

function renderMeetingFocus(result, first, spread, metrics = portfolioDecisionMetrics(result)) {
  const activatedShare = result.invest > 0 ? result.activated / result.invest * 100 : 0;
  const irrText = Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-';
  const spreadText = Number.isFinite(spread) ? fmtPct(spread * 100, 1) : '-';
  const rows = {
    management: [
      meetingCard('management', 'decisionQuestion', 'Beschlussfrage', Number.isFinite(result.irr) ? irrText + ' IRR indikativ' : '', `Ist der Business Case bei ${fmtTeur(result.invest)} Investition und ${fmtTeur(metrics.recurringRegulatoryEog, 1)} EOG-Wirkung im ersten Folgejahr mit den offenen Auflagen tragfähig?`),
      meetingCard('management', 'whyItWorks', 'Warum es trägt', Number.isFinite(spread) ? spreadText + ' Spread' : '', `Rendite wird als indikativer Cashflow gegen FK-Zins ${fmtPct(result.p.financingRate * 100, 1)} und Kapitalwert ${fmtTeur(result.npv, 1)} gespiegelt; konservativ ${metrics.conservative && Number.isFinite(metrics.conservative.irr) ? fmtPct(metrics.conservative.irr * 100, 1) : '-'}.`),
      meetingCard('management', 'watchOut', 'Nicht übersehen', '', result.qePa + result.impactPa > 0 ? `Q/E- und Wirkannahmen von ${fmtTeur(result.qePa + result.impactPa, 1)} p.a. brauchen Nachweis, Attribution und Governance-Status.` : 'Ohne Portfolioeffekt zählt vor allem die direkte regulatorische Kapitalwirkung.')
    ],
    technik: [
      meetingCard('technik', 'technicalScope', 'Technische Betroffenheit', '', activeMeasureNames(result)),
      meetingCard('technik', 'commissioningImpact', 'Inbetriebnahme & Wirkung', fmtTeur(first.regulatoryEogEffect, 1), `Modellierte EOG-Wirkung startet im Jahr ${result.p.baseYear}; erster Folgejahreswert ${fmtTeur(metrics.recurringRegulatoryEog, 1)}. Timing, Wirkungsverzüge und spätere Sondereffekte entscheiden über das Profil.`),
      meetingCard('technik', 'riskArgument', 'Risikoargument', fmtTeur(result.yearly[0]?.opexRisk || 0, 1), 'OPEX/Risiko im Startjahr. Technik sollte Risikowert, Störungsfolgen und Umsetzungsrisiken validieren.')
    ],
    vnb: [
      meetingCard('vnb', 'eogStartYear', 'EOG-Wirkung Startjahr', fmtTeur(first.regulatoryEogEffect, 1), `${periodDetailText(result.p.regulatoryPeriod)} mit Kostenbasis ${result.p.regulatoryPeriod.costBaseYear}. Laufende Wirkung ${fmtTeur(metrics.recurringRegulatoryEog, 1)}; Startjahr enthält ${fmtTeur(metrics.yearOneOneOff, 1)} Einmaleffekt.`),
      meetingCard('vnb', 'capitalBase', 'Regulatorische Kapitalbasis', fmtTeur(result.activated), `${fmtPct(activatedShare, 1)} der Investition wird erwartbar kapitalwirksam.`),
      meetingCard('vnb', 'recognitionQe', 'Anerkennung / Q/E', fmtTeur(result.qePa + result.impactPa, 1), 'Portfolioeffekte, Wirkannahmen und OPEX-Anerkennung getrennt belegen, damit keine Doppelzählung entsteht.')
    ],
    controlling: [
      meetingCard('controlling', 'investmentVolume', 'Investitionsvolumen', fmtTeur(result.invest), `${result.activeMeasures.length} aktive Maßnahmen im Szenario.`),
      meetingCard('controlling', 'ebitYearOne', 'EBIT-Effekt Jahr 1', fmtTeur(first.ebit || 0, 1), 'Indikative Ergebnissicht: reine Erlöswirkung plus Netto-OPEX minus HGB-AfA.'),
      meetingCard('controlling', 'bridge', 'Überleitung kumuliert', fmtTeur(result.yearly.at(-1)?.bridgeCumulative || 0, 1), 'Timing-Differenz aus regulatorischer AfA minus HGB-AfA; mit Controlling abstimmen.')
    ],
    finanzierung: [
      meetingCard('finanzierung', 'financingHurdle', 'Finanzierungshürde', fmtPct(result.p.financingRate * 100, 1), 'FK-Zins als Mindestschwelle für die Renditebetrachtung.'),
      meetingCard('finanzierung', 'returnBuffer', 'Renditepuffer', spreadText, `IRR ${irrText} im Vergleich zur Finanzierungshürde.`),
      meetingCard('finanzierung', 'advisorQuestion', 'Bank-/Beraterfrage', fmtTeur(result.npv, 1), 'Sind Cashflow-Profil, regulatorische Anerkennung und Sensitivitäten ausreichend belegbar?')
    ]
  };
  document.getElementById('meetingFocusBody').innerHTML = rows[meetingFocus].join('');
}

function kanbanCountHtml(openItems) {
  const high = openItems.filter(item => item.priority?.label === 'hoch').length;
  const medium = openItems.filter(item => item.priority?.label === 'mittel').length;
  const normal = Math.max(0, openItems.length - high - medium);
  return `
    <div class="kanban-mini">
      <div><strong>${high}</strong><span>hoch</span></div>
      <div><strong>${medium}</strong><span>mittel</span></div>
      <div><strong>${normal}</strong><span>normal</span></div>
      <div><strong>${openItems.length}</strong><span>gesamt</span></div>
    </div>
  `;
}

function renderAkteCockpit(result, first, decision, metrics) {
  const title = document.getElementById('akteTitle');
  if (!title) return;
  const maturity = maturityScore();
  const openItems = maturity.openClarifications;
  const reliability = workstandReliabilityFor(currentModelData(), result);
  const sidecarStats = sidecarSummary(normalizeSidecar(sidecar));
  const nextTask = projectPlanNextReadyTask(projectPlan);
  const highClarifications = openItems.filter(item => item.priority?.label === 'hoch').length;
  const mediumClarifications = openItems.filter(item => item.priority?.label === 'mittel').length;
  const sector = el.sector.value === 'gas' ? 'Gas' : 'Strom';
  title.textContent = `${sector}-Akte · ${phaseLabel(processState.phase)}`;
  document.getElementById('akteSubtitle').textContent = `${result.activeMeasures.length} aktive Maßnahmen · ${maturity.score} % Entscheidungsreife · ${openItems.length} offene Klärpunkte.`;
  document.getElementById('akteDecisionCard').innerHTML = `
    <div class="card-kicker">Entscheidungslage</div>
    <h3>${esc(decision.title)}</h3>
    <div class="metric-strip compact">
      <span><strong>${fmtTeur(metrics.recurringRegulatoryEog, 1)}</strong>EOG</span>
      <span><strong>${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'}</strong>IRR</span>
      <span><strong>${fmtTeur(result.npv, 1)}</strong>NPV</span>
    </div>
    <span class="card-link-hint">Details öffnen</span>
  `;
  document.getElementById('akteClarificationsCard').innerHTML = `
    <div class="card-kicker">Prüfen & Klären</div>
    <h3>${openItems.length ? `${openItems.length} offene Klärpunkte` : 'Keine offenen Klärpunkte'}</h3>
    <div class="kanban-mini compact" aria-label="Klärpunkt-Verteilung">
      <div><strong>${highClarifications}</strong><span>hoch</span></div>
      <div><strong>${mediumClarifications}</strong><span>mittel</span></div>
      <div><strong>${Math.max(openItems.length - highClarifications - mediumClarifications, 0)}</strong><span>normal</span></div>
    </div>
    <span class="card-link-hint">Kanban öffnen</span>
  `;
  document.getElementById('akteEvidenceCard').innerHTML = `
    <div class="card-kicker">Evidenz & Systeme</div>
    <h3>${sidecarStats.total || 0} Sidecar-Objekte</h3>
    <div class="status-chips compact">
      <span class="chip violet">${sidecarStats.withoutCalculationImpact || 0} ohne Rechenwirkung</span>
      <span class="chip amber">${sidecarStats.openBridgeLogic || 0} offene Brücke</span>
    </div>
    <span class="card-link-hint">Evidenz prüfen</span>
  `;
  document.getElementById('akteReliabilityCard').innerHTML = `
    <div class="card-kicker">Belastbarkeit</div>
    <h3>${esc(reliability.verdict)}</h3>
    <div class="reliability-mini compact">${reliability.items.slice(0, 2).map(item => `<span class="${item.severity === 'warn' ? 'amber' : 'green'}"><strong>${esc(item.value)}</strong>${esc(item.label)}</span>`).join('')}</div>
    <span class="card-link-hint">Arbeitsstand prüfen</span>
  `;
  document.getElementById('akteFlowDiagram').innerHTML = `
    <div class="card-kicker">Governance-Logik</div>
    <h3>Von Daten zur Befassung</h3>
    <div class="governance-flow compact" aria-label="Governance-Ablauf">
      <div><strong>Daten</strong></div>
      <div><strong>Maßnahmen</strong></div>
      <div><strong>Evidenz</strong></div>
      <div><strong>Klärung</strong></div>
      <div><strong>Entscheidung</strong></div>
    </div>
    <span class="card-link-hint">Präsentationspfad öffnen</span>
  `;
  document.getElementById('akteNextStepCard').innerHTML = `
    <div class="card-kicker">Nächster Schritt</div>
    <h3>${esc(processState.resume?.nextStep || nextTask?.task?.title || 'Arbeitsstand schärfen')}</h3>
    <p class="compact-note">${nextTask?.task ? esc(nextTask.task.ownerRole) : 'Projektplan ergänzen'}</p>
    <span class="card-link-hint">Projektplan öffnen</span>
  `;
  document.getElementById('akteKanbanPreview').innerHTML = `
    <div class="card-kicker">Klärpunkt-Kanban</div>
    <h3>Offene Punkte als Arbeitsboard</h3>
    <span class="card-link-hint">Prüfen & Klären öffnen</span>
  `;
  document.getElementById('aktePresentationPreview').innerHTML = `
    <div class="card-kicker">Meeting-Modus</div>
    <h3>Präsentieren und zurück bearbeiten</h3>
    <span class="card-link-hint">Präsentation starten</span>
  `;
}

let presentationSlideIndex = 0;

function presentationSlides(result, first, decision, metrics) {
  const maturity = maturityScore();
  const openItems = maturity.openClarifications;
  const reliability = workstandReliabilityFor(currentModelData(), result);
  const waterfall = portfolioWaterfallFor(result);
  const sectorLabel = el.sector.value === 'gas' ? 'Gas' : 'Strom';
  const phase = phaseLabel(processState.phase);
  const blockerText = maturity.blockers === 1 ? '1 Blocker' : `${maturity.blockers} Blocker`;
  const reviewText = maturity.reviewCount === 1 ? '1 prüfpflichtiger Punkt' : `${maturity.reviewCount} prüfpflichtige Punkte`;
  return [
    {
      title: `${sectorLabel}-Planungsakte`,
      eyebrow: 'Startfolie',
      view: 'akte',
      body: `Arbeitsstand ${phase} · ${result.activeMeasures.length} aktive Maßnahmen · ${openItems.length} offene Klärpunkte. Die Kennzahl ist der Arbeitsstand-Score, nicht ein Beschlussstatus.`,
      visual: `
        <div class="presentation-title-grid">
          <div class="presentation-maturity-callout">
            ${maturityRingHtml(maturity.score, maturity.blockers, 132)}
            <div>
              <strong>Arbeitsstand-Score</strong>
              <span>${maturity.score} von 100 Entscheidungsreife</span>
              <small>${esc(blockerText)} · ${esc(reviewText)}</small>
            </div>
          </div>
          <div class="presentation-title-facts" aria-label="Kontext der Akte">
            <span><strong>${esc(sectorLabel)}</strong>Sparte</span>
            <span><strong>${esc(phase)}</strong>Phase</span>
            <span><strong>${result.activeMeasures.length}</strong>aktive Maßnahmen</span>
          </div>
        </div>
      `
    },
    { title: decision.title, eyebrow: 'Entscheidungslage', view: 'results', body: decision.text, visual: `<div class="metric-strip large"><span><strong>${fmtTeur(metrics.recurringRegulatoryEog, 1)}</strong>EOG</span><span><strong>${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'}</strong>IRR</span><span><strong>${fmtTeur(result.npv, 1)}</strong>NPV</span></div>` },
    { title: 'EOG ≠ Cashflow', eyebrow: 'Überleitung', view: 'results', body: `${fmtTeur(waterfall.firstFollowYear.regulatoryEogEffect, 1)} regulatorische EOG plus ${fmtTeur(waterfall.firstFollowYear.economicBridge, 1)} wirtschaftliche Überleitung.`, visual: `<div class="presentation-flow"><span>Basis-EOG</span><span>→</span><span>Maßnahmen</span><span>→</span><span>Cashflow-Überleitung</span></div>` },
    { title: `${openItems.length} offene Klärpunkte`, eyebrow: 'Prüfauftrag', view: 'expertWork', body: openItems.slice(0, 4).map(item => `${item.priority?.label || 'normal'}: ${item.measure} · ${item.title}`).join(' | ') || 'Keine offenen Klärpunkte.', visual: kanbanCountHtml(openItems) },
    { title: 'Belastbarkeit des Arbeitsstands', eyebrow: 'Governance', view: 'results', body: `${reliability.verdict}. ${reliability.caveat}`, visual: `<div class="reliability-mini large">${reliability.items.slice(0, 4).map(item => `<span class="${item.severity === 'warn' ? 'amber' : 'green'}"><strong>${esc(item.value)}</strong>${esc(item.label)}</span>`).join('')}</div>` },
    { title: 'Evidenz & Systeme', eyebrow: 'Sidecar', view: 'sidecar', body: 'Sidecar-Objekte, Systemreferenzen und Überleitungslogik bleibt sichtbar, aber ohne automatische KPI-Wirkung.', visual: `<div class="presentation-flow violet"><span>Quelle</span><span>→</span><span>Evidenz</span><span>→</span><span>Überleitung</span><span>→</span><span>Prüfung</span></div>` },
    { title: 'Nächster Schritt', eyebrow: 'Befassung', view: 'projectPlan', body: processState.resume?.nextStep || projectPlanNextReadyTask(projectPlan)?.task?.title || 'Nächsten Prüfauftrag festlegen.', visual: `<div class="meeting-closeout">Arbeitsstand sichern · Report/Export erzeugen · nächste Befassung vorbereiten</div>` }
  ];
}

function renderPresentation(result, first, decision, metrics) {
  const deck = document.getElementById('presentationDeck');
  if (!deck) return;
  const slides = presentationSlides(result, first, decision, metrics);
  presentationSlideIndex = Math.max(0, Math.min(presentationSlideIndex, slides.length - 1));
  const slide = slides[presentationSlideIndex];
  const counter = document.getElementById('presentationCounter');
  if (counter) counter.textContent = `${presentationSlideIndex + 1} / ${slides.length}`;
  deck.innerHTML = `
    <article class="presentation-slide theme-${esc(slide.view)}">
      <div class="presentation-slide-content">
        <p class="eyebrow">${esc(slide.eyebrow)}</p>
        <h3>${esc(slide.title)}</h3>
        <div class="presentation-visual">${slide.visual}</div>
        <p class="presentation-body">${esc(slide.body)}</p>
      </div>
      <div class="card-actions presentation-slide-actions">
        <button type="button" class="primary" data-jump-view="${esc(slide.view)}">In Bearbeitung öffnen</button>
        <button type="button" data-jump-view="presentation">Zurück zur Folie</button>
      </div>
    </article>
  `;
}

function renderMeasures() {
  const p = currentParams();
  syncCatalogControls();
  const filtered = filteredMeasures(p);
  if (!measures.length) {
    document.getElementById('measureBody').innerHTML = `
      <tr>
        <td colspan="11">
          <div class="empty-state compact">
            <span aria-hidden="true">+</span>
            <strong>Noch keine Maßnahme angelegt.</strong>
            <small>Lege eine Maßnahme geführt an oder lade Demodaten.</small>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  if (!filtered.length) {
    document.getElementById('measureBody').innerHTML = `
      <tr><td colspan="11"><div class="empty-state compact"><span aria-hidden="true">?</span><strong>Keine Maßnahme passt zum Filter.</strong><small>Filter zurücksetzen oder Katalog CSV exportieren.</small></div></td></tr>
    `;
    return;
  }
  const grouped = groupMeasures(filtered, p);
  document.getElementById('measureBody').innerHTML = grouped.map(group => {
    const collapsed = group.collapsed;
    const rows = collapsed ? '' : group.measures.map(measure => measureRowHtml(measure, p)).join('');
    return `
      <tr class="group-row" data-group-key="${esc(group.key)}">
        <td colspan="11">
          <button type="button" data-action="toggleGroup" data-group-key="${esc(group.key)}">${collapsed ? '+' : '-'}</button>
          <strong>${esc(group.label)}</strong>
          <span>${group.measures.length} Maßnahmen · ${fmtTeur(group.cost, 1)} Kosten · ${fmtTeur(group.eog, 1)} EOG-Wirkung Startjahr · ${fmtPct(group.activeShare * 100, 0)} aktiv · ${group.review} prüfpflichtig</span>
        </td>
      </tr>
      ${rows}
    `;
  }).join('');
}

function measureRowHtml(measure, p) {
    const result = calcMeasure(measure, p, portfolioEffectFor(measure, p));
    const counts = impactCounts(measure);
    const templateBadge = measure.templateId ? `<span class="pill warn">aus Vorlage ${esc(measure.templateVersion || '')}</span>` : '';
    const importBadge = measure.importStatus === 'unconfirmed' ? '<span class="pill warn">Import prüfen</span>' : '';
    const tags = parseTags(measure.tags);
    return `
      <tr class="${measure.id === selectedId ? 'selected' : ''}" data-id="${measure.id}">
        <td><input type="checkbox" data-action="selectBulk" data-id="${measure.id}" ${selectedCatalogIds.has(measure.id) ? 'checked' : ''}></td>
        <td><input type="checkbox" data-action="active" data-id="${measure.id}" ${measure.active ? 'checked' : ''}></td>
        <td><button type="button" data-action="select" data-id="${measure.id}">${esc(measure.name)}</button><div class="pill-row compact">${templateBadge}${importBadge}${tags.slice(0, 3).map(tag => `<span class="pill">${esc(tag)}</span>`).join('')}</div><small>${esc(measure.externalId || '')}</small></td>
        <td>${esc(measure.orgUnit || '-')}</td>
        <td>${measure.year}</td>
        <td><div class="pill-row compact">${objectivePills(measure)}</div></td>
        <td>${fmtTeur(measure.cost)}</td>
        <td>${fmtPct(result.activeShare * 100, 0)}</td>
        <td><span class="inline-visual">${measureRiskMiniHtml(measure)}${counts.total ? `${counts.total} (${counts.review} prüf.)` : '-'}</span></td>
        <td>${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'}</td>
        <td><span class="note-indicator ${String(measure.note || '').trim() ? '' : 'empty'}" title="${String(measure.note || '').trim() ? esc(measure.note) : 'Keine Notiz'}">i</span></td>
      </tr>
    `;
}

function filteredMeasures(p) {
  const query = catalogFilters.search.toLowerCase();
  let list = measures.filter(measure => {
    const tags = parseTags(measure.tags);
    const haystack = [measure.name, measure.externalId, measure.orgUnit, measure.type, ...tags].join(' ').toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (catalogFilters.type !== 'all' && measure.type !== catalogFilters.type) return false;
    if (catalogFilters.active === 'active' && !measure.active) return false;
    if (catalogFilters.active === 'inactive' && measure.active) return false;
    if (catalogFilters.openOnly && !hasOpenMeasureItem(measure)) return false;
    if (catalogFilters.importedOnly && measure.importStatus !== 'unconfirmed') return false;
    if (catalogFilters.yearFrom && Number(measure.year) < Number(catalogFilters.yearFrom)) return false;
    if (catalogFilters.yearTo && Number(measure.year) > Number(catalogFilters.yearTo)) return false;
    if (catalogFilters.tag && !tags.some(tag => tag.toLowerCase().includes(catalogFilters.tag.toLowerCase()))) return false;
    return true;
  });
  if (quickCatalogMode) {
    list = list.map(measure => ({ measure, result: calcMeasure(measure, p, portfolioEffectFor(measure, p)) }))
      .sort((a, b) => {
        if (quickCatalogMode === 'risk') return b.result.riskReductionPa - a.result.riskReductionPa;
        if (quickCatalogMode === 'cost') return Number(b.measure.cost) - Number(a.measure.cost);
        return b.result.npv - a.result.npv;
      })
      .slice(0, 10)
      .map(item => item.measure);
  }
  return list;
}

function groupKeyForMeasure(measure) {
  if (catalogGroupBy === 'type') return measure.type || 'ohne Typ';
  if (catalogGroupBy === 'year') return String(measure.year || 'ohne Jahr');
  if (catalogGroupBy === 'target') return (measure.objectiveIds || [])[0] || 'ohne Ziel';
  return measure.orgUnit || 'ohne Bereich';
}

function groupLabelForKey(key) {
  if (catalogGroupBy === 'target') {
    return strategy.objectives.find(objective => objective.id === key)?.label || key;
  }
  if (catalogGroupBy === 'type') {
    return key === 'noRegret' ? 'No-Regret' : key === 'risiko' ? 'Risiko' : key === 'wahl' ? 'Wahl' : key;
  }
  return key;
}

function groupMeasures(list, p) {
  const groups = new Map();
  list.forEach(measure => {
    const key = groupKeyForMeasure(measure);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(measure);
  });
  return [...groups.entries()].sort(([a], [b]) => groupLabelForKey(a).localeCompare(groupLabelForKey(b), 'de')).map(([key, groupList]) => {
    const results = groupList.map(measure => calcMeasure(measure, p, portfolioEffectFor(measure, p)));
    return {
      key,
      label: groupLabelForKey(key),
      measures: groupList,
      collapsed: collapsedCatalogGroups[key] ?? measures.length > 30,
      cost: groupList.reduce((sum, measure) => sum + Number(measure.cost || 0), 0),
      eog: results.reduce((sum, result) => sum + (result.rows[0]?.regulatoryEogEffect || 0), 0),
      activeShare: groupList.length ? groupList.filter(measure => measure.active).length / groupList.length : 0,
      review: groupList.reduce((sum, measure) => sum + impactCounts(measure).review, 0)
    };
  });
}

function syncCatalogControls() {
  const group = document.getElementById('catalogGroupBy');
  if (group && group.value !== catalogGroupBy) group.value = catalogGroupBy;
  const orgOptions = orgUnitValues();
  const datalist = document.getElementById('orgUnitOptions');
  if (datalist) datalist.innerHTML = orgOptions.map(value => `<option value="${esc(value)}"></option>`).join('');
  const bulkOrg = document.getElementById('bulkOrgUnit');
  if (bulkOrg) {
    const current = bulkOrg.value;
    bulkOrg.innerHTML = '<option value="">Bereich setzen...</option>' + orgOptions.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
    bulkOrg.value = current;
  }
  const bulkObjective = document.getElementById('bulkObjective');
  if (bulkObjective) {
    const current = bulkObjective.value;
    bulkObjective.innerHTML = '<option value="">Ziel zuordnen...</option>' + strategy.objectives.map(objective => `<option value="${esc(objective.id)}">${esc(objective.label)}</option>`).join('');
    bulkObjective.value = current;
  }
}

function selectedMeasure() {
  return measures.find(measure => measure.id === selectedId) || measures[0];
}

function setView(view) {
  activeView = view;
  document.body.dataset.view = view;
  document.querySelectorAll('.view-tab').forEach(button => {
    button.classList.toggle('active', button.dataset.view === view);
  });
  document.querySelectorAll('[data-view-panel]').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.viewPanel !== view);
  });
}

function openClarificationList() {
  document.body.classList.remove('show-start');
  setView('results');
  requestAnimationFrame(() => {
    const disclosure = document.getElementById('clarificationDisclosure');
    if (disclosure) disclosure.open = true;
    const target = disclosure || document.getElementById('maturityPanel') || document.getElementById('clarificationList');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target?.focus?.({ preventScroll: true });
  });
}

function newMeasureTemplate() {
  const nextNumber = measures.length + 1;
  return {
    id: 'new_' + Date.now().toString(36) + '_' + nextNumber,
    active: true,
    name: 'Neue Maßnahme ' + nextNumber,
    type: 'wahl',
    cost: 250,
    year: Math.round(num('baseYear')),
    secure: 70,
    uncertain: 30,
    probability: 50,
    opexRecognition: 70,
    life: 40,
    depr: el.sector.value === 'strom' ? 'normal' : 'kanuLinear',
    qDirect: 0,
    eDirect: 0,
    riskAvoided: 0,
    portfolioShare: 0,
    externalId: '',
    orgUnit: '',
    monitoringProfile: 'none',
    monitoringCategory: '',
    networkLevel: '',
    reportingRegion: '',
    reportingStatus: 'geplant',
    capacityImpact: '',
    bottleneckRef: '',
    permitRequired: 'unknown',
    permitStatus: '',
    investmentDecisionStatus: 'unknown',
    investmentDecisionDate: '',
    alternativesChecked: '',
    flexibilityNeed: '',
    effectType: 'classic',
    flexibilityUseCase: 'netzfahrplan',
    flexibilityStatus: 'context',
    regulatoryTreatment: 'unknown',
    networkScheduleRequired: true,
    networkScheduleStatus: 'missing',
    networkConstraintRef: '',
    affectedNetworkLevel: '',
    activationWindow: '',
    dispatchLogic: '',
    avoidedCapexTeur: 0,
    avoidedCapexConfidence: 'none',
    deferredCapexTeur: 0,
    deferredCapexFromYear: '',
    deferredCapexToYear: '',
    capexAvoidanceEvidenceRef: '',
    flexOpexPaTeur: 0,
    flexOpexStartYear: '',
    flexOpexDurationYears: 0,
    opexRecognitionStatus: 'unknown',
    opexEvidenceRef: '',
    agnesRelevant: false,
    agnesRole: 'offen',
    agnesIntegrationStatus: 'not_assessed',
    agnesDataNeeded: [],
    tags: [],
    hgbLife: 40,
    objectiveIds: [],
    templateId: '',
    templateVersion: '',
    opexPa: 0,
    opexDeltaPa: 0,
    reinvestCost: 0,
    reinvestMode: 'oneOff',
    reinvestLife: 40,
    decommissionCost: 0,
    decommissionYear: '',
    impactAssumptions: [],
    note: ''
  };
}

function basisDraft() {
  return {
    sector: el.sector.value,
    regulationProcedure: el.regulationProcedure.value,
    baseYear: Math.round(num('baseYear')),
    baseEog: num('baseEog'),
    rab: num('rab'),
    annualEnergyGwh: el.annualEnergyGwh.value,
    householdConsumptionKwh: el.householdConsumptionKwh.value,
    returnRate: num('returnRate'),
    financingRate: num('financingRate'),
    capitalCostMode: el.capitalCostMode.value,
    equityShare: num('equityShare'),
    equityReturnRate: num('equityReturnRate'),
    debtShare: num('debtShare'),
    debtReturnRate: num('debtReturnRate'),
    deductionCapital: num('deductionCapital'),
    horizon: Math.round(num('horizon')),
    discountRate: num('discountRate'),
    kanuEndYear: Math.round(num('kanuEndYear')),
    degressiveRate: num('degressiveRate'),
    taxFactor: num('taxFactor'),
    portfolioAttribution: num('portfolioAttribution'),
    capexLagYears: num('capexLagYears'),
    opexLagYears: num('opexLagYears'),
    qeLagYears: num('qeLagYears'),
    qDelta: num('qDelta'),
    eDelta: num('eDelta')
  };
}

function wizardSteps(type) {
  if (type === 'basis') {
    return [
      'Sparte',
      'Wertbasis',
      'Finanzierung',
      'Portfolio',
      'Bestätigung'
    ];
  }
  return [
    'Einordnung',
    'Kosten',
    'Regulatorik',
    'Zusatzwirkung',
    'Bestätigung'
  ];
}

function modalValue(id) {
  const node = document.getElementById(id);
  return node ? node.value : '';
}

function modalNumber(id) {
  const value = Number(modalValue(id));
  return Number.isFinite(value) ? value : 0;
}

function reviewRows(rows) {
  return `<dl class="review-list">${rows.map(([label, value]) => `
    <div><dt>${label}</dt><dd>${value}</dd></div>
  `).join('')}</dl>`;
}

function renderBasisWizardStep() {
  const d = wizard.draft;
  const draftPeriod = regulatoryPeriodFor(d.sector, d.baseYear);
  if (wizard.step === 0) {
    return `
      <h3>Sparte und zeitlicher Bezug</h3>
      <div class="grid2">
        <div>
          <label for="w_sector">Sparte</label>
          <select id="w_sector">
            <option value="gas" ${d.sector === 'gas' ? 'selected' : ''}>Gas</option>
            <option value="strom" ${d.sector === 'strom' ? 'selected' : ''}>Strom</option>
          </select>
        </div>
        <div>
          <label for="w_baseYear">Startjahr</label>
          <input id="w_baseYear" type="number" value="${d.baseYear}" min="2025" step="1">
        </div>
        <div>
          <label for="w_regulationProcedure">Regulierungsverfahren</label>
          <select id="w_regulationProcedure">
            <option value="standard" ${d.regulationProcedure !== 'simplified' ? 'selected' : ''}>Standardverfahren</option>
            <option value="simplified" ${d.regulationProcedure === 'simplified' ? 'selected' : ''}>Vereinfachtes Verfahren (§ 24 ARegV)</option>
          </select>
        </div>
      </div>
      <p class="hint">Der Rechner leitet daraus ${periodDetailText(draftPeriod)} mit Kostenbasis ${draftPeriod.costBaseYear} ab. Im vereinfachten Verfahren werden individuelle Qualitäts- und Effizienzeffekte im Modell neutral behandelt.</p>
    `;
  }
  if (wizard.step === 1) {
    return `
      <h3>Bestehende Wert- und Erlösbasis</h3>
      <div class="grid2">
        <div>
          <label for="w_baseEog">bestehende EOG TEUR p.a.</label>
          <input id="w_baseEog" type="number" value="${d.baseEog}" min="0" step="100">
        </div>
        <div>
          <label for="w_rab">regulierte Kapitalbasis TEUR</label>
          <input id="w_rab" type="number" value="${d.rab}" min="0" step="500">
        </div>
        <div>
          <label for="w_annualEnergyGwh">verteilte Jahresarbeit GWh</label>
          <input id="w_annualEnergyGwh" type="number" value="${esc(d.annualEnergyGwh)}" min="0" step="0.1" placeholder="optional">
        </div>
        <div>
          <label for="w_householdConsumptionKwh">Durchschnittshaushalt kWh/a</label>
          <input id="w_householdConsumptionKwh" type="number" value="${esc(d.householdConsumptionKwh)}" min="0" step="100" placeholder="automatisch">
        </div>
      </div>
      <p class="hint">Diese Werte sind der Anker für Portfolioeffekte und relative Bewertung. Die Jahresarbeit übersetzt Mehrerlöse indikativ in eine Haushaltswirkung.</p>
    `;
  }
  if (wizard.step === 2) {
    return `
      <h3>Finanzierung und Auswertung</h3>
      <div class="grid2">
        <div>
          <label for="w_returnRate">Kapitalverzinsung %</label>
          <input id="w_returnRate" type="number" value="${d.returnRate}" min="0" step="0.1">
        </div>
        <div>
          <label for="w_financingRate">Fremdkapitalzins %</label>
          <input id="w_financingRate" type="number" value="${d.financingRate}" min="0" step="0.1">
        </div>
        <div>
          <label for="w_capitalCostMode">Kapitalkostenmodell</label>
          <select id="w_capitalCostMode">
            <option value="simple" ${d.capitalCostMode !== 'advanced' ? 'selected' : ''}>Einfacher Mischsatz</option>
            <option value="advanced" ${d.capitalCostMode === 'advanced' ? 'selected' : ''}>Advanced: EK/FK + Abzugskapital</option>
          </select>
        </div>
        <div>
          <label for="w_equityShare">EK-Anteil %</label>
          <input id="w_equityShare" type="number" value="${d.equityShare}" min="0" max="100" step="1">
        </div>
        <div>
          <label for="w_equityReturnRate">EK-Zinssatz %</label>
          <input id="w_equityReturnRate" type="number" value="${d.equityReturnRate}" min="0" step="0.1">
        </div>
        <div>
          <label for="w_debtShare">FK-Anteil %</label>
          <input id="w_debtShare" type="number" value="${d.debtShare}" min="0" max="100" step="1">
        </div>
        <div>
          <label for="w_debtReturnRate">FK-Zinssatz %</label>
          <input id="w_debtReturnRate" type="number" value="${d.debtReturnRate}" min="0" step="0.1">
        </div>
        <div>
          <label for="w_deductionCapital">Abzugskapital TEUR</label>
          <input id="w_deductionCapital" type="number" value="${d.deductionCapital}" min="0" step="100">
        </div>
        <div>
          <label for="w_horizon">Horizont Jahre</label>
          <input id="w_horizon" type="number" value="${d.horizon}" min="1" max="60" step="1">
        </div>
        <div>
          <label for="w_discountRate">Diskontsatz %</label>
          <input id="w_discountRate" type="number" value="${d.discountRate}" min="0" step="0.1">
        </div>
      </div>
    `;
  }
  if (wizard.step === 3) {
    return `
      <h3>Regulatorik und Portfolioannahmen</h3>
      <div class="grid2">
        <div>
          <label for="w_kanuEndYear">KANU-Zieljahr</label>
          <input id="w_kanuEndYear" type="number" value="${d.kanuEndYear}" min="2028" step="1">
        </div>
        <div>
          <label for="w_degressiveRate">KANU degressiv %</label>
          <input id="w_degressiveRate" type="number" value="${d.degressiveRate}" min="0" max="12" step="0.1">
        </div>
        <div>
          <label for="w_taxFactor">Zuschlag/Steuern %</label>
          <input id="w_taxFactor" type="number" value="${d.taxFactor}" min="0" step="0.1">
        </div>
        <div>
          <label for="w_portfolioAttribution">Portfolio-Attribution %</label>
          <input id="w_portfolioAttribution" type="number" value="${d.portfolioAttribution}" min="0" max="100" step="1">
        </div>
        <div>
          <label for="w_qDelta">Q-Delta Portfolio %</label>
          <input id="w_qDelta" type="number" value="${d.qDelta}" step="0.1">
        </div>
        <div>
          <label for="w_eDelta">E-/Effizienz-Delta %</label>
          <input id="w_eDelta" type="number" value="${d.eDelta}" step="0.1">
        </div>
      </div>
      <p class="hint">Q bei Gas bleibt eine prüfpflichtige Annahme.</p>
    `;
  }
  return `
    <h3>Stammdaten bestätigen</h3>
    ${reviewRows([
      ['Sparte', d.sector === 'gas' ? 'Gas' : 'Strom'],
      ['Verfahren', d.regulationProcedure === 'simplified' ? 'Vereinfachtes Verfahren' : 'Standardverfahren'],
      ['Startjahr', d.baseYear],
      ['Regulierungsperiode', periodDetailText(draftPeriod)],
      ['Kostenbasis', draftPeriod.costBaseYear],
      ['Bestehende EOG', fmtTeur(d.baseEog)],
      ['Regulierte Kapitalbasis', fmtTeur(d.rab)],
      ['Jahresarbeit', d.annualEnergyGwh ? `${d.annualEnergyGwh} GWh` : 'nicht eingetragen'],
      ['Durchschnittshaushalt', d.householdConsumptionKwh ? `${d.householdConsumptionKwh} kWh/a` : 'automatisch'],
      ['Kapitalverzinsung', fmtPct(d.returnRate)],
      ['Fremdkapitalzins', fmtPct(d.financingRate)],
      ['Kapitalkostenmodell', d.capitalCostMode === 'advanced' ? `Advanced: EK ${fmtPct(d.equityShare)} @ ${fmtPct(d.equityReturnRate)}, FK ${fmtPct(d.debtShare)} @ ${fmtPct(d.debtReturnRate)}, Abzugskapital ${fmtTeur(d.deductionCapital)}` : 'Einfacher Mischsatz'],
      ['Horizont', d.horizon + ' Jahre'],
      ['Portfolio-Attribution', fmtPct(d.portfolioAttribution)],
      ['Q-/E-Delta', fmtPct(d.qDelta) + ' / ' + fmtPct(d.eDelta)]
    ])}
  `;
}

function renderMeasureWizardStep() {
  const d = wizard.draft;
  if (wizard.step === 0) {
    return `
      <h3>Einordnung der Maßnahme</h3>
      <div class="grid2">
        <div>
          <label for="w_mName">Name</label>
          <input id="w_mName" type="text" value="${esc(d.name)}">
        </div>
        <div>
          <label for="w_mType">Typ</label>
          <select id="w_mType">
            <option value="wahl" ${d.type === 'wahl' ? 'selected' : ''}>Wahlmaßnahme</option>
            <option value="noRegret" ${d.type === 'noRegret' ? 'selected' : ''}>No-Regret</option>
            <option value="risiko" ${d.type === 'risiko' ? 'selected' : ''}>Risikomaßnahme</option>
          </select>
        </div>
        <div>
          <label for="w_mYear">Inbetriebnahme</label>
          <input id="w_mYear" type="number" value="${d.year}" min="2025" step="1">
        </div>
      </div>
    `;
  }
  if (wizard.step === 1) {
    return `
      <h3>Kosten und Aktivierungsprofil</h3>
      <div class="grid2">
        <div>
          <label for="w_mCost">Kosten TEUR</label>
          <input id="w_mCost" type="number" value="${d.cost}" min="0" step="1">
        </div>
        <div>
          <label for="w_mSecure">sicher aktivierbar %</label>
          <input id="w_mSecure" type="number" value="${d.secure}" min="0" max="100" step="1">
        </div>
        <div>
          <label for="w_mUncertain">unsicherer Anteil %</label>
          <input id="w_mUncertain" type="number" value="${d.uncertain}" min="0" max="100" step="1">
        </div>
        <div>
          <label for="w_mProbability">Wahrscheinlichkeit %</label>
          <input id="w_mProbability" type="number" value="${d.probability}" min="0" max="100" step="1">
        </div>
      </div>
    `;
  }
  if (wizard.step === 2) {
    return `
      <h3>Regulatorische Behandlung</h3>
      <div class="grid2">
        <div>
          <label for="w_mOpexRecognition">OPEX-Anerkennung %</label>
          <input id="w_mOpexRecognition" type="number" value="${d.opexRecognition}" min="0" max="100" step="1">
        </div>
        <div>
          <label for="w_mLife">normale ND Jahre</label>
          <input id="w_mLife" type="number" value="${d.life}" min="1" step="1">
        </div>
        <div>
          <label for="w_mDepr">AfA-Szenario</label>
          <select id="w_mDepr">
            <option value="normal" ${d.depr === 'normal' ? 'selected' : ''}>Normal linear</option>
            <option value="kanuLinear" ${d.depr === 'kanuLinear' ? 'selected' : ''}>KANU linear</option>
            <option value="kanuDegressive" ${d.depr === 'kanuDegressive' ? 'selected' : ''}>KANU degressiv</option>
          </select>
        </div>
      </div>
    `;
  }
  if (wizard.step === 3) {
    return `
      <h3>Zusatzwirkung und Attribution</h3>
      <div class="grid2">
        <div>
          <label for="w_mQDirect">Q direkt TEUR p.a.</label>
          <input id="w_mQDirect" type="number" value="${d.qDirect}" step="1">
        </div>
        <div>
          <label for="w_mEDirect">E direkt TEUR p.a.</label>
          <input id="w_mEDirect" type="number" value="${d.eDirect}" step="1">
        </div>
        <div>
          <label for="w_mRiskAvoided">Risikowert TEUR p.a.</label>
          <input id="w_mRiskAvoided" type="number" value="${d.riskAvoided}" step="1">
        </div>
        <div>
          <label for="w_mPortfolioShare">Portfolioanteil %</label>
          <input id="w_mPortfolioShare" type="number" value="${d.portfolioShare}" min="0" max="100" step="1">
        </div>
      </div>
    `;
	      }
	      const active = expectedActivated(d);
	      const validation = measureValidation(d);
	      return `
	        <h3>Maßnahme bestätigen</h3>
	        ${reviewRows([
      ['Name', esc(d.name)],
      ['Typ', d.type === 'wahl' ? 'Wahlmaßnahme' : d.type === 'noRegret' ? 'No-Regret' : 'Risikomaßnahme'],
      ['Inbetriebnahme', d.year],
      ['Kosten', fmtTeur(d.cost)],
      ['Erwartet aktivierbar', fmtTeur(active.activated) + ' (' + fmtPct(active.share * 100, 1) + ')'],
      ['AfA-Szenario', d.depr],
      ['Direkte Q/E-Wirkung', fmtTeur(Number(d.qDirect) + Number(d.eDirect), 1) + ' p.a.'],
	          ['Risikowert', fmtTeurPerYear(d.riskAvoided, 1)],
	          ['Portfolioanteil', fmtPct(d.portfolioShare)]
	        ])}
	        ${validation.messages.length ? `<div class="validation-messages active" role="status"><strong>Annahmen begrenzt</strong><ul>${validation.messages.map(message => `<li>${esc(message)}</li>`).join('')}</ul></div>` : ''}
	      `;
	    }

function collectWizardStep() {
  if (!wizard) return;
  const d = wizard.draft;
  if (wizard.type === 'basis') {
    if (wizard.step === 0) Object.assign(d, { sector: modalValue('w_sector'), regulationProcedure: modalValue('w_regulationProcedure'), baseYear: Math.round(modalNumber('w_baseYear')) });
    if (wizard.step === 1) Object.assign(d, { baseEog: modalNumber('w_baseEog'), rab: modalNumber('w_rab'), annualEnergyGwh: modalValue('w_annualEnergyGwh'), householdConsumptionKwh: modalValue('w_householdConsumptionKwh') });
    if (wizard.step === 2) Object.assign(d, {
      returnRate: modalNumber('w_returnRate'),
      financingRate: modalNumber('w_financingRate'),
      capitalCostMode: modalValue('w_capitalCostMode'),
      equityShare: modalNumber('w_equityShare'),
      equityReturnRate: modalNumber('w_equityReturnRate'),
      debtShare: modalNumber('w_debtShare'),
      debtReturnRate: modalNumber('w_debtReturnRate'),
      deductionCapital: modalNumber('w_deductionCapital'),
      horizon: Math.round(modalNumber('w_horizon')),
      discountRate: modalNumber('w_discountRate')
    });
    if (wizard.step === 3) Object.assign(d, { kanuEndYear: Math.round(modalNumber('w_kanuEndYear')), degressiveRate: modalNumber('w_degressiveRate'), taxFactor: modalNumber('w_taxFactor'), portfolioAttribution: modalNumber('w_portfolioAttribution'), qDelta: modalNumber('w_qDelta'), eDelta: modalNumber('w_eDelta') });
  } else {
    if (wizard.step === 0) Object.assign(d, { name: modalValue('w_mName') || d.name, type: modalValue('w_mType'), year: Math.round(modalNumber('w_mYear')) });
	        if (wizard.step === 1) Object.assign(d, { cost: modalNumber('w_mCost'), secure: modalNumber('w_mSecure'), uncertain: modalNumber('w_mUncertain'), probability: modalNumber('w_mProbability') });
	        if (wizard.step === 2) Object.assign(d, { opexRecognition: modalNumber('w_mOpexRecognition'), life: Math.round(modalNumber('w_mLife')), depr: modalValue('w_mDepr') });
	        if (wizard.step === 3) Object.assign(d, { qDirect: modalNumber('w_mQDirect'), eDirect: modalNumber('w_mEDirect'), riskAvoided: modalNumber('w_mRiskAvoided'), portfolioShare: modalNumber('w_mPortfolioShare') });
  }
}

function renderWizard() {
  if (!wizard) return;
  const steps = wizardSteps(wizard.type);
  document.getElementById('wizardTitle').textContent = (wizard.type === 'basis' ? 'Stammdaten prüfen' : 'Neue Maßnahme anlegen') + ' - ' + steps[wizard.step];
  document.getElementById('wizardStepper').innerHTML = steps.map((_, index) => `<span class="${index <= wizard.step ? 'active' : ''}"></span>`).join('');
  document.getElementById('wizardBody').innerHTML = wizard.type === 'basis' ? renderBasisWizardStep() : renderMeasureWizardStep();
  enhanceHelpLabels(document.getElementById('wizardBody'));
  document.getElementById('wizardBack').disabled = wizard.step === 0;
  document.getElementById('wizardNext').textContent = wizard.step === steps.length - 1 ? 'Speichern' : 'Weiter';
  document.getElementById('wizardModal').classList.remove('hidden');
}

function openBasisWizard() {
  wizard = { type: 'basis', step: 0, draft: basisDraft() };
  renderWizard();
}

function openMeasureWizard() {
  wizard = { type: 'measure', step: 0, draft: newMeasureTemplate() };
  setView('measures');
  renderWizard();
}

function closeWizard() {
  wizard = null;
  document.getElementById('wizardModal').classList.add('hidden');
}

function saveWizard() {
  if (wizard.type === 'basis') {
    Object.entries(wizard.draft).forEach(([key, value]) => {
      if (el[key]) el[key].value = value;
    });
  } else {
    measures = [...measures, wizard.draft];
    selectedId = wizard.draft.id;
    setView('measures');
  }
  closeWizard();
  renderAll();
}

function wizardForward() {
  collectWizardStep();
  const lastStep = wizardSteps(wizard.type).length - 1;
  if (wizard.step >= lastStep) {
    saveWizard();
    return;
  }
  wizard.step += 1;
  renderWizard();
}

function wizardBack() {
  collectWizardStep();
  if (wizard.step > 0) wizard.step -= 1;
  renderWizard();
}

function toggleAllMeasures() {
  if (!measures.length) {
    setStorageStatus('Es sind noch keine Maßnahmen vorhanden.');
    return;
  }
  const allActive = measures.every(measure => measure.active);
  measures = measures.map(measure => ({ ...measure, active: !allActive }));
  renderAll();
}

function updateActionLabels() {
  const allActive = measures.length > 0 && measures.every(measure => measure.active);
  const label = allActive ? 'Alle deaktivieren' : 'Alle aktivieren';
  const catalogButton = document.getElementById('toggleAllInCatalog');
  if (catalogButton) catalogButton.textContent = label;
}

function setStepStatus(id, text, cls) {
  const node = document.getElementById(id);
  if (!node) return;
  node.textContent = text;
  node.classList.toggle('done', cls === 'done');
  node.classList.toggle('warn', cls === 'warn');
  node.classList.toggle('open', cls === 'open');
}

function updateFlowStatus() {
  const basisComplete = Boolean(el.sector.value) && num('baseYear') > 0 && num('baseEog') > 0;
  const activeCount = measures.filter(measure => measure.active).length;
  const hasMeasures = activeCount > 0;
  const decisionReady = basisComplete && hasMeasures;

  setStepStatus(
    'status-basis',
    basisComplete ? 'Stammdaten erledigt' : 'Stammdaten unvollständig',
    basisComplete ? 'done' : 'warn'
  );
  setStepStatus(
    'status-measures',
    hasMeasures ? `${activeCount} aktiv` : '0 Maßnahmen aktiv',
    hasMeasures ? 'done' : 'warn'
  );
  setStepStatus(
    'status-results',
    decisionReady ? 'entscheidungsfähig' : 'Entscheidung offen',
    decisionReady ? 'done' : 'open'
  );
  const maturity = maturityScore();
  setStepStatus(
    'status-akte',
    `${maturity.score} % Reife`,
    maturity.blockers ? 'warn' : 'done'
  );
  setStepStatus(
    'status-expertWork',
    maturity.blockers ? `${maturity.blockers} offen` : 'alles geklärt',
    maturity.blockers ? 'warn' : 'done'
  );
  setStepStatus(
    'status-presentation',
    decisionReady ? 'bereit' : 'Arbeitsstand',
    decisionReady ? 'done' : 'open'
  );
  setStepStatus(
    'status-report',
    decisionReady ? 'Export bereit' : 'noch offen',
    decisionReady ? 'done' : 'open'
  );
}

function selectOptions(options, selected) {
  return Object.entries(options)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`)
    .join('');
}

function riskBand(value, thresholds) {
  if (value <= thresholds[0]) return 0;
  if (value <= thresholds[1]) return 1;
  return 2;
}

function riskMatrixHtml(impact) {
  const beforeCol = riskBand(impact.riskProbabilityBefore, [3, 10]);
  const afterCol = riskBand(impact.riskProbabilityAfter, [3, 10]);
  const row = riskBand(impact.riskImpact, [250, 750]);
  const probabilityMid = [1.5, 6.5, 18];
  const impactMid = [125, 500, 1000];
  const colors = [
    ['#dcefe6', '#f1e8b8', '#f0cfb4'],
    ['#c8e6d6', '#ead985', '#e7a982'],
    ['#afd8c5', '#dfbd58', '#d97b68']
  ];
  return `
    <svg class="risk-matrix-svg" viewBox="0 0 132 112" role="img" aria-label="Risikomatrix vorher nachher">
      <text x="6" y="12">Schaden</text>
      <text x="54" y="108">Wahrscheinlichkeit</text>
      ${[2, 1, 0].map((y, rowIndex) => [0, 1, 2].map(x => {
        const px = 28 + x * 30;
        const py = 18 + rowIndex * 26;
        const impactIndex = y;
        return `<rect x="${px}" y="${py}" width="28" height="24" rx="4" fill="${colors[impactIndex][x]}" data-risk-cell="true" data-risk-probability="${probabilityMid[x]}" data-risk-impact="${impactMid[impactIndex]}" data-impact-id="${esc(impact.id)}"></rect>`;
      }).join('')).join('')}
      <line x1="${42 + beforeCol * 30}" y1="${30 + (2 - row) * 26}" x2="${42 + afterCol * 30}" y2="${30 + (2 - row) * 26}" stroke="#40505f" stroke-width="1.5" marker-end="url(#arrow-${esc(impact.id)})"></line>
      <defs><marker id="arrow-${esc(impact.id)}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#40505f"></path></marker></defs>
      <circle cx="${42 + beforeCol * 30}" cy="${30 + (2 - row) * 26}" r="5" fill="#16202a"></circle>
      <circle cx="${42 + afterCol * 30}" cy="${30 + (2 - row) * 26}" r="6" fill="none" stroke="#16202a" stroke-width="2"></circle>
    </svg>
  `;
}

function riskMatrixMiniHtml(impact) {
  if (!impact || impact.area !== 'risk' || impact.legacyFlat) return '';
  const beforeCol = riskBand(impact.riskProbabilityBefore, [3, 10]);
  const afterCol = riskBand(impact.riskProbabilityAfter, [3, 10]);
  const row = riskBand(impact.riskImpact, [250, 750]);
  const colors = [
    ['#dcefe6', '#f1e8b8', '#f0cfb4'],
    ['#c8e6d6', '#ead985', '#e7a982'],
    ['#afd8c5', '#dfbd58', '#d97b68']
  ];
  return `
    <svg class="risk-mini" viewBox="0 0 30 30" role="img" aria-label="Risiko vorher nachher">
      ${[2, 1, 0].map((y, rowIndex) => [0, 1, 2].map(x => `<rect x="${x * 10}" y="${rowIndex * 10}" width="9" height="9" rx="1.5" fill="${colors[y][x]}"></rect>`).join('')).join('')}
      <circle cx="${beforeCol * 10 + 4.5}" cy="${(2 - row) * 10 + 4.5}" r="2.6" fill="#16202a"></circle>
      <circle cx="${afterCol * 10 + 4.5}" cy="${(2 - row) * 10 + 4.5}" r="3.2" fill="none" stroke="#16202a" stroke-width="1.4"></circle>
    </svg>
  `;
}

function measureRiskMiniHtml(measure) {
  const riskImpact = (measure.impactAssumptions || []).find(impact => impact.area === 'risk');
  return riskImpact ? riskMatrixMiniHtml(riskImpact) : '';
}

function phaseStepperHtml() {
  const currentIndex = processPhases.findIndex(([id]) => id === processState.phase);
  return `
    <div class="phase-stepper report-stepper">
      ${processPhases.map(([, label], index) => `
        <span class="${index < currentIndex ? 'done' : index === currentIndex ? 'current' : ''}" title="${esc(label)}">
          <i></i><b>${esc(label)}</b>
        </span>
      `).join('')}
    </div>
  `;
}

function lifecycleTimelineHtml(measure, params) {
  if (!measure) return '';
  const width = 720;
  const height = 86;
  const start = Math.min(params.baseYear, Number(measure.year) || params.baseYear);
  const end = params.baseYear + params.horizon - 1;
  const span = Math.max(1, end - start);
  const xForYear = year => 42 + (Math.max(start, Math.min(end, Number(year) || start)) - start) / span * (width - 84);
  const inService = Number(measure.year) || params.baseYear;
  const lifeEnd = inService + Math.max(1, Number(measure.life) || 1);
  const reinvestYear = Number(measure.reinvestCost || 0) > 0 ? lifeEnd : null;
  const decommissionYear = measure.decommissionYear || (params.sector === 'gas' ? params.kanuEndYear : lifeEnd);
  const kanuYear = params.sector === 'gas' ? params.kanuEndYear : null;
  const markers = [
    [inService, 'Inbetriebnahme', '#006f8f'],
    [reinvestYear, 'Reinvestition', '#8a6a32'],
    [decommissionYear, 'Rückbau', '#9a5a4d']
  ].filter(([year]) => year && year >= start && year <= end);
  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="86" role="img" aria-label="Lebenszyklus von ${esc(measure.name)}">
      <line x1="42" y1="44" x2="${width - 42}" y2="44" stroke="#d9e0e8" stroke-width="4" stroke-linecap="round"></line>
      <rect x="${xForYear(inService)}" y="38" width="${Math.max(8, xForYear(Math.min(end, lifeEnd)) - xForYear(inService))}" height="12" rx="6" fill="#d9eaf0"></rect>
      ${kanuYear && kanuYear >= start && kanuYear <= end ? `<line x1="${xForYear(kanuYear)}" y1="17" x2="${xForYear(kanuYear)}" y2="68" stroke="#a96500" stroke-dasharray="4 4"></line><text x="${xForYear(kanuYear)}" y="14" text-anchor="middle">KANU</text>` : ''}
      ${markers.map(([year, label, color]) => `<g><line x1="${xForYear(year)}" y1="28" x2="${xForYear(year)}" y2="60" stroke="${color}" stroke-width="2"></line><circle cx="${xForYear(year)}" cy="44" r="5" fill="${color}"></circle><text x="${xForYear(year)}" y="76" text-anchor="middle">${esc(label)}</text></g>`).join('')}
      <text x="42" y="26" text-anchor="middle">${start}</text>
      <text x="${width - 42}" y="26" text-anchor="middle">${end}</text>
    </svg>
  `;
}

function riskFieldsHtml(impact) {
  if (impact.area !== 'risk') {
    return `
      <div>
        <label>Wert TEUR p.a.</label>
        <input type="number" data-impact-field="amount" data-impact-id="${esc(impact.id)}" value="${impact.amount}" step="1">
      </div>
    `;
  }
  if (impact.legacyFlat) {
    return `
      <div class="wide-field">
        <div class="note warning">
          Bisheriger pauschaler Risikowert: ${fmtTeurPerYear(impact.amount, 1)}. Für bessere Nachvollziehbarkeit auf Wahrscheinlichkeit mal Schadenshöhe umstellen.
          <button type="button" data-action="convertRisk" data-impact-id="${esc(impact.id)}">Umstellen</button>
        </div>
      </div>
      <div>
        <label>Wert TEUR p.a.</label>
        <input type="number" data-impact-field="amount" data-impact-id="${esc(impact.id)}" value="${impact.amount}" step="1">
      </div>
    `;
  }
  return `
    <div>
      <label>Wahrscheinlichkeit vorher % p.a.</label>
      <input type="number" data-impact-field="riskProbabilityBefore" data-impact-id="${esc(impact.id)}" value="${impact.riskProbabilityBefore}" min="0" max="100" step="0.1">
    </div>
    <div>
      <label>Wahrscheinlichkeit nachher % p.a.</label>
      <input type="number" data-impact-field="riskProbabilityAfter" data-impact-id="${esc(impact.id)}" value="${impact.riskProbabilityAfter}" min="0" max="100" step="0.1">
    </div>
    <div>
      <label>Schadenshöhe TEUR je Ereignis</label>
      <input type="number" data-impact-field="riskImpact" data-impact-id="${esc(impact.id)}" value="${impact.riskImpact}" min="0" step="1">
    </div>
    <div class="risk-calculation">
      <strong>Erwartungswert:</strong> ${fmtTeurPerYear(riskExpectedValue(impact), 1)}
      <span class="hint">Risikomatrix vorher/nachher</span>
      ${riskMatrixHtml(impact)}
    </div>
  `;
}

function renderImpactAssumptions(measure) {
  const node = document.getElementById('impactAssumptions');
  if (!node) return;
  const assumptions = impactAssumptionsFor(measure);
  const simplified = el.regulationProcedure.value === 'simplified';
  const rows = assumptions.map(impact => {
    const isNeutralized = simplified && (impact.area === 'qElement' || impact.area === 'efficiency');
    return `
    <article class="impact-card ${isNeutralized ? 'neutralized-impact' : ''}" data-impact-id="${esc(impact.id)}">
      <div class="impact-card-head">
        <div>
          <strong>${esc(impact.title)}</strong>
          <div class="impact-meta">${impactAreaLabel(impact.area)} · ${impact.area === 'risk' ? fmtTeurPerYear(impact.amount * impact.attribution, 1) : `${fmtTeur(impact.amount * impact.attribution, 1)} p.a.`} · ${impactGovernanceLabel(impact.governance)}</div>
        </div>
        <div class="impact-actions">
          ${confidenceBadge(impact.confidence)}
          <button type="button" data-action="removeImpact" data-impact-id="${esc(impact.id)}" class="small-danger">Entfernen</button>
        </div>
      </div>
      ${isNeutralized ? '<div class="note warning">Im vereinfachten Verfahren wird diese Q-/Effizienzwirkung nur dokumentiert und nicht erlöswirksam gerechnet.</div>' : ''}
      <div class="grid2 compact-grid">
        <div>
          <label>Titel</label>
          <input type="text" data-impact-field="title" data-impact-id="${esc(impact.id)}" value="${esc(impact.title)}">
        </div>
        <div>
          <label>Wirkbereich</label>
          <select data-impact-field="area" data-impact-id="${esc(impact.id)}">${selectOptions(impactAreaLabels, impact.area)}</select>
        </div>
        ${riskFieldsHtml(impact)}
        <div>
          <label>Attribution %</label>
          <input type="number" data-impact-field="attribution" data-impact-id="${esc(impact.id)}" value="${impact.attribution * 100}" min="0" max="100" step="1">
        </div>
        <div>
          <label>Vertrauen</label>
          <select data-impact-field="confidence" data-impact-id="${esc(impact.id)}">${selectOptions(confidenceLabels, impact.confidence)}</select>
        </div>
        <div>
          <label>Einfluss</label>
          <select data-impact-field="governance" data-impact-id="${esc(impact.id)}">${selectOptions(governanceLabels, impact.governance)}</select>
        </div>
        <div>
          <label>ab Jahr</label>
          <input type="number" data-impact-field="startYear" data-impact-id="${esc(impact.id)}" value="${impact.startYear}" step="1">
        </div>
        <div>
          <label>bis Jahr</label>
          <input type="number" data-impact-field="endYear" data-impact-id="${esc(impact.id)}" value="${impact.endYear ?? ''}" placeholder="offen" step="1">
        </div>
      </div>
      <label>Kausalkette</label>
      <textarea data-impact-field="chain" data-impact-id="${esc(impact.id)}" placeholder="Maßnahme verändert welchen technischen/regulatorischen Treiber?">${esc(impact.chain)}</textarea>
      <label>Datenbasis / Quelle</label>
      <select data-impact-field="evidenceType" data-impact-id="${esc(impact.id)}">${selectOptions(evidenceTypeLabels, impact.evidenceType)}</select>
      <textarea data-impact-field="evidence" data-impact-id="${esc(impact.id)}" placeholder="Historie, Betriebserfahrung, Gutachten, Regulierungsmanagement ...">${esc(impact.evidence)}</textarea>
      <label>Prüf- oder Freigabehinweis</label>
      <textarea data-impact-field="note" data-impact-id="${esc(impact.id)}" placeholder="Was muss vor Beschluss/Freigabe noch bestätigt werden?">${esc(impact.note)}</textarea>
    </article>
  `;
  }).join('');
  node.innerHTML = rows || '<p class="hint">Noch keine Wirkannahme erfasst. Direkte Q-/E- oder Risikowerte sollten künftig hier mit Quelle, Kausalkette und Vertrauensstufe dokumentiert werden.</p>';
}

function updateImpactAssumption(event) {
  const field = event.target.dataset.impactField;
  const id = event.target.dataset.impactId;
  const measure = selectedMeasure();
  if (!field || !id || !measure) return;
  const impact = (measure.impactAssumptions || []).find(item => String(item.id) === id);
  if (!impact) return;
  const numericFields = new Set(['amount', 'attribution', 'startYear', 'endYear', 'riskProbabilityBefore', 'riskProbabilityAfter', 'riskImpact']);
  impact[field] = numericFields.has(field) ? event.target.value === '' ? '' : Number(event.target.value) : event.target.value;
  if (field === 'area' && impact.area === 'risk' && impact.amount > 0 && !impact.riskImpact) {
    impact.legacyFlat = true;
  }
  if (['riskProbabilityBefore', 'riskProbabilityAfter', 'riskImpact'].includes(field)) {
    impact.legacyFlat = false;
    impact.amount = riskExpectedValue({ ...impact, area: 'risk', legacyFlat: false });
  }
  if (field === 'confidence' && impact.confidence === 'review' && impact.governance === 'basis') {
    impact.governance = 'sensitivity';
  }
  renderAll();
}

function convertRiskAssumption(id) {
  const measure = selectedMeasure();
  if (!measure) return;
  const impact = (measure.impactAssumptions || []).find(item => String(item.id) === id);
  if (!impact) return;
  const amount = Number(impact.amount) || 0;
  impact.legacyFlat = false;
  impact.riskProbabilityBefore = impact.riskProbabilityBefore || (amount > 0 ? 10 : 0);
  impact.riskProbabilityAfter = impact.riskProbabilityAfter || 0;
  impact.riskImpact = impact.riskImpact || (amount > 0 ? Math.round(amount / 0.1) : 0);
  impact.amount = riskExpectedValue({ ...impact, area: 'risk', legacyFlat: false });
  renderAll();
}

function addImpactAssumption() {
  const measure = selectedMeasure();
  if (!measure) return;
  measure.impactAssumptions = [...(measure.impactAssumptions || []), newImpactAssumptionTemplate(measure)];
  renderAll();
}

function removeImpactAssumption(id) {
  const measure = selectedMeasure();
  if (!measure) return;
  measure.impactAssumptions = (measure.impactAssumptions || []).filter(impact => String(impact.id) !== id);
  renderAll();
}

function renderMeasureClarificationAuditBanner(measure) {
  const banner = document.getElementById('measureClarificationAuditBanner');
  if (!banner) return;
  if (!measureEditClarificationContext || measure?.id !== selectedId) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }
  const context = measureEditClarificationContext;
  const item = findClarificationItem(context.key) || { title: context.title, detail: '', measure: measure?.name || '' };
  const status = clarificationStatus[context.key] || {};
  const target = clarificationTargetFor(item);
  const projectTask = projectTaskForClarification(item);
  const timestamp = context.timestamp ? new Date(context.timestamp).toLocaleString('de-DE') : '-';
  banner.classList.remove('hidden');
  banner.innerHTML = `
    <aside class="clarification-workbench-panel" aria-label="Befassung zum aktiven Klärpunkt">
      <div class="clarification-workbench-head">
        <div>
          <p class="eyebrow">Aktiver Klärpunkt · ${esc(status.status === 'closed' ? 'geklärt' : 'in Bearbeitung')}</p>
          <strong>${esc(context.title)}</strong>
          <span>${esc(item.measure || measure?.name || '')} · ${esc(context.author || 'unbekannt')} · ${esc(timestamp)}</span>
        </div>
        <span class="pill warn">Projektplan: ${projectTask ? esc(projectPlanStatusLabels[projectTask.task.status] || projectTask.task.status) : 'in Arbeit'}</span>
      </div>
      <div class="clarification-workbench-grid">
        <section class="clarification-task-card">
          <h4>Was ist zu tun?</h4>
          <p>${esc(target.task)}</p>
          <button type="button" class="link-button" id="measureClarificationFocusField">Zum Feld: ${esc(target.label)}</button>
          <p class="hint">Links bleibt die Maßnahme bearbeitbar; diese Befassung dokumentiert rechts den Arbeitsschritt.</p>
        </section>
        <section class="clarification-note-card">
          <h4>Aktuelle Befassung</h4>
          <label for="measureClarificationNote">Neue Befassungsnotiz</label>
          <textarea id="measureClarificationNote" rows="3" placeholder="Was wurde in dieser Befassung geprüft, geändert oder offen gelassen? Quelle/Rolle kurz benennen.">${esc(status.draftNote || '')}</textarea>
          <p id="measureClarificationError" class="form-error" role="alert"></p>
        </section>
      </div>
      ${clarificationBefassungHistoryHtml(status)}
      <div class="clarification-workbench-foot clarification-workbench-actions">
        <p>${esc(item.detail || 'Klärpunkt aus der Arbeitsliste; Daten und Befassung werden gemeinsam auditierbar gespeichert.')}</p>
        <div class="dialog-actions">
          <button type="button" id="measureClarificationSaveProgress">Befassungsnotiz speichern</button>
          <button type="button" id="measureClarificationSave" class="primary">Klärpunkt abschließen</button>
        </div>
      </div>
    </aside>
  `;
}

function renderDetail() {
  const measure = selectedMeasure();
	      if (!measure) {
	        detailIds.forEach(id => {
	          if (el[id]) el[id].value = '';
	          if (el[id]) el[id].setAttribute('aria-invalid', 'false');
	        });
	        document.getElementById('selectedPills').innerHTML = '<span class="pill warn">Keine Maßnahme ausgewählt</span>';
	        const validationNode = document.getElementById('measureValidation');
	        if (validationNode) {
	          validationNode.classList.remove('active');
	          validationNode.innerHTML = '';
	        }
        renderImpactAssumptions({ impactAssumptions: [] });
        renderHelperCalculators({ cost: 0, secure: 0, uncertain: 0, probability: 0, opexRecognition: 0, impactAssumptions: [] });
        updateMeasureStepper();
        renderMeasureClarificationAuditBanner(null);
        const timeline = document.getElementById('lifecycleTimeline');
        if (timeline) timeline.innerHTML = '';
	        return;
	      }
  el.mName.value = measure.name;
  el.mExternalId.value = measure.externalId || '';
  el.mOrgUnit.value = measure.orgUnit || '';
  el.mTags.value = tagsText(measure.tags);
  el.mMonitoringProfile.value = measure.monitoringProfile || 'none';
  el.mMonitoringCategory.value = measure.monitoringCategory || '';
  el.mNetworkLevel.value = measure.networkLevel || '';
  el.mReportingRegion.value = measure.reportingRegion || '';
  el.mReportingStatus.value = measure.reportingStatus || '';
  el.mCapacityImpact.value = measure.capacityImpact || '';
  el.mBottleneckRef.value = measure.bottleneckRef || '';
  el.mPermitRequired.value = measure.permitRequired || 'unknown';
  el.mPermitStatus.value = measure.permitStatus || '';
  el.mInvestmentDecisionStatus.value = measure.investmentDecisionStatus || 'unknown';
  el.mInvestmentDecisionDate.value = measure.investmentDecisionDate || '';
  el.mAlternativesChecked.value = measure.alternativesChecked || '';
  el.mFlexibilityNeed.value = measure.flexibilityNeed || '';
  el.mSourceSystem.value = measure.sourceSystem || '';
  el.mSourceRecordId.value = measure.sourceRecordId || '';
  el.mScoringRef.value = measure.scoringRef || '';
  el.mAssetSystemRef.value = measure.assetSystemRef || '';
  el.mErpRef.value = measure.erpRef || '';
  el.mRiskDbRef.value = measure.riskDbRef || '';
  el.mSourceStatus.value = measure.sourceStatus || '';
  el.mRiskEvidenceStatus.value = measure.riskEvidenceStatus || measure.riskAvoidedEvidenceStatus || '';
  el.mRiskOwnerRole.value = measure.riskOwnerRole || '';
  el.mRiskAssessmentStatus.value = measure.riskAssessmentStatus || '';
  el.mType.value = measure.type;
  el.mEffectType.value = measure.effectType || 'classic';
  el.mFlexibilityUseCase.value = measure.flexibilityUseCase || 'netzfahrplan';
  el.mFlexibilityStatus.value = measure.flexibilityStatus || 'context';
  el.mRegulatoryTreatment.value = measure.regulatoryTreatment || 'unknown';
  el.mNetworkScheduleRequired.checked = measure.networkScheduleRequired !== false;
  el.mNetworkScheduleStatus.value = measure.networkScheduleStatus || 'missing';
  el.mNetworkConstraintRef.value = measure.networkConstraintRef || '';
  el.mAffectedNetworkLevel.value = measure.affectedNetworkLevel || '';
  el.mActivationWindow.value = measure.activationWindow || '';
  el.mDispatchLogic.value = measure.dispatchLogic || '';
  el.mAvoidedCapexTeur.value = measure.avoidedCapexTeur || 0;
  el.mAvoidedCapexConfidence.value = measure.avoidedCapexConfidence || 'none';
  el.mDeferredCapexTeur.value = measure.deferredCapexTeur || 0;
  el.mDeferredCapexFromYear.value = measure.deferredCapexFromYear ?? '';
  el.mDeferredCapexToYear.value = measure.deferredCapexToYear ?? '';
  el.mCapexAvoidanceEvidenceRef.value = measure.capexAvoidanceEvidenceRef || '';
  el.mFlexOpexPaTeur.value = measure.flexOpexPaTeur || 0;
  el.mFlexOpexStartYear.value = measure.flexOpexStartYear ?? '';
  el.mFlexOpexDurationYears.value = measure.flexOpexDurationYears || 0;
  el.mOpexRecognitionStatus.value = measure.opexRecognitionStatus || 'unknown';
  el.mOpexEvidenceRef.value = measure.opexEvidenceRef || '';
  el.mAgnesRelevant.checked = Boolean(measure.agnesRelevant);
  el.mAgnesRole.value = measure.agnesRole || 'offen';
  el.mAgnesIntegrationStatus.value = measure.agnesIntegrationStatus || 'not_assessed';
  el.mAgnesDataNeeded.value = Array.isArray(measure.agnesDataNeeded) ? measure.agnesDataNeeded.join(', ') : (measure.agnesDataNeeded || '');
  el.mCost.value = measure.cost;
  el.mYear.value = measure.year;
  el.mSecure.value = measure.secure;
  el.mUncertain.value = measure.uncertain;
  el.mProbability.value = measure.probability;
  el.mOpexRecognition.value = measure.opexRecognition;
  el.mLife.value = measure.life;
  el.mDepr.value = measure.depr;
  el.mQDirect.value = measure.qDirect;
  el.mEDirect.value = measure.eDirect;
  el.mRiskAvoided.value = measure.riskAvoided;
  el.mPortfolioShare.value = measure.portfolioShare;
  el.mOpexPa.value = measure.opexPa || 0;
  el.mOpexDeltaPa.value = measure.opexDeltaPa || 0;
  el.mReinvestCost.value = measure.reinvestCost || 0;
  el.mReinvestMode.value = measure.reinvestMode === 'assetAddition' ? 'assetAddition' : 'oneOff';
  el.mReinvestLife.value = measure.reinvestLife || measure.life || 1;
  el.mDecommissionCost.value = measure.decommissionCost || 0;
  el.mHgbLife.value = measure.hgbLife || measure.life || 1;
  el.mDecommissionYear.value = measure.decommissionYear ?? '';
  el.mGasTransformationPath.value = measure.gasTransformationPath || 'unclear';
  el.mGasAssetScope.value = measure.gasAssetScope || 'unclear';
  el.mGasObligationBasis.value = measure.gasObligationBasis || 'unclear';
  el.mGasEternityAssumption.value = measure.gasEternityAssumption || 'unclear';
  el.mGasProvisionAssessment.value = measure.gasProvisionAssessment || 'unclear';
  el.mGasRegulatoryTreatment.value = measure.gasRegulatoryTreatment || 'unclear';
  el.mGasTransformationEvidence.value = measure.gasTransformationEvidence || '';
  el.mNote.value = measure.note || '';
  renderMeasureObjectives(measure);

  const p = currentParams();
  const result = calcMeasure(measure, p, portfolioEffectFor(measure, p));
	      const pills = [
	        ['aktivierbar ' + fmtTeur(result.activated), 'good'],
    ['TOTEX ' + fmtTeur(result.totex.nominal, 1), 'warn'],
    ['IRR ' + (Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'), Number.isFinite(result.irr) && result.irr >= p.financingRate ? 'good' : 'warn'],
    [measure.type === 'noRegret' ? 'No-Regret' : measure.type === 'risiko' ? 'Risiko' : 'Wahl', measure.type === 'noRegret' ? 'warn' : 'good']
	      ];
	      document.getElementById('selectedPills').innerHTML = pills.map(([text, cls]) => `<span class="pill ${cls}">${text}</span>`).join('');
	      renderMeasureValidation(measure);
      renderGasTransformationLayer(measure);
      renderFlexibilityLayer(measure);
      renderHelperCalculators(measure);
      renderMeasureDrilldown(measure);
      renderImpactAssumptions(measure);
      renderMeasureClarificationAuditBanner(measure);
      updateMeasureStepper();
      const timeline = document.getElementById('lifecycleTimeline');
      if (timeline) timeline.innerHTML = lifecycleTimelineHtml(measure, p);
	    }

function renderChart(yearly) {
  const width = 900;
  const height = 270;
  const pad = { top: 20, right: 18, bottom: 34, left: 58 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const segments = [
    ['depreciation', '#006f8f', 'AfA'],
    ['capitalReturn', '#4b8f6f', 'Verzinsung'],
    ['qAndE', '#c78a22', 'Q/E'],
    ['risk', '#7b6a9a', 'Risiko'],
    ['opex', '#8a6a32', 'OPEX'],
    ['reinvestDecommission', '#9a5a4d', 'Rückbau/Reinvest']
  ];
  const stackTotal = row => segments.reduce((sum, [key]) => sum + Math.max(0, row[key]), 0);
  const max = Math.max(1, ...yearly.map(stackTotal));
  const step = innerW / yearly.length;
  const barW = Math.max(8, step * 0.62);
  const ticks = [0, .25, .5, .75, 1].map(t => {
    const y = pad.top + innerH - t * innerH;
    return `<line x1="${pad.left}" x2="${width - pad.right}" y1="${y}" y2="${y}" stroke="#d9e0e8"></line>
      <text x="${pad.left - 8}" y="${y + 4}" text-anchor="end">${Math.round(max * t)}</text>`;
  }).join('');
  const bars = yearly.map((row, i) => {
    const x = pad.left + i * step + (step - barW) / 2;
    let yCursor = pad.top + innerH;
    const parts = segments.map(([key, color]) => {
      const value = Math.max(0, row[key]);
      const h = value / max * innerH;
      yCursor -= h;
      return `<rect x="${x}" y="${yCursor}" width="${barW}" height="${h}" rx="2" fill="${color}"></rect>`;
    }).join('');
    const label = yearly.length <= 25 || i % 2 === 0 ? `<text x="${x + barW / 2}" y="${height - 11}" text-anchor="middle">${row.year}</text>` : '';
    const tooltip = [
      `${row.year} / ${periodText(row.regulatoryPeriod)}`,
      `AfA: ${fmtTeur(row.depreciation, 1)}`,
      `Verzinsung: ${fmtTeur(row.capitalReturn, 1)}`,
      `Q/E: ${fmtTeur(row.qAndE, 1)}`,
      `Risiko: ${fmtTeur(row.risk, 1)}`,
      `OPEX: ${fmtTeur(row.opex, 1)}`,
      `Rückbau/Reinvest: ${fmtTeur(row.reinvestDecommission, 1)}`,
      `Indik. Cashflow: ${fmtTeur(row.indicativeCashflow, 1)}`
    ].join('\n');
    return `<g tabindex="0" aria-label="${esc(tooltip)}"><title>${esc(tooltip)}</title>${parts}</g>${label}`;
  }).join('');
  document.getElementById('chart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="EOG-Zusatzwirkung">
    ${ticks}
    <line x1="${pad.left}" x2="${width - pad.right}" y1="${pad.top + innerH}" y2="${pad.top + innerH}" stroke="#64707d"></line>
    <text x="12" y="16">TEUR p.a.</text>
    ${bars}
  </svg>`;
}

function renderYears(result) {
  const head = document.getElementById('yearHead');
  const caveat = document.getElementById('resultViewCaveat');
  document.querySelectorAll('.year-view').forEach(button => button.classList.toggle('active', button.dataset.yearView === resultViewMode));
  if (resultViewMode === 'earnings') {
    if (caveat) caveat.classList.remove('hidden');
    head.innerHTML = `
      <tr>
        <th>Jahr</th><th>RP</th><th>Erlöswirkung</th><th>HGB-AfA</th><th>OPEX netto</th><th>EBIT-Effekt</th><th>Überleitung</th><th>kumuliert</th>
      </tr>
    `;
    document.getElementById('yearBody').innerHTML = result.yearly.map(row => `
      <tr>
        <td>${row.year}</td>
        <td>${periodText(row.regulatoryPeriod)}</td>
        <td>${fmtTeur(row.eog, 1)}</td>
        <td>${fmtTeur(row.hgbDepreciation, 1)}</td>
        <td>${fmtTeur(row.opex, 1)}</td>
        <td>${fmtTeur(row.ebit, 1)}</td>
        <td>${fmtTeur(row.bridge, 1)}</td>
        <td>${fmtTeur(row.bridgeCumulative, 1)}</td>
      </tr>
    `).join('');
    return;
  }
  if (caveat) caveat.classList.add('hidden');
  head.innerHTML = `
    <tr>
      <th>Jahr</th><th>RP</th><th>Basis-EOG</th><th>AfA/KANU regulatorisch</th><th>Verzinsung</th><th>Q/E</th><th>Risiko</th><th>Einmalig</th><th>modellierte EOG-Wirkung</th><th>wirtschaftl. OPEX/Rückbau</th><th>indik. Cashflow</th><th>EOG gesamt</th>
    </tr>
  `;
  document.getElementById('yearBody').innerHTML = result.yearly.map(row => `
    <tr>
      <td>${row.year}</td>
      <td>${periodText(row.regulatoryPeriod)}</td>
      <td>${fmtTeur(result.p.baseEog, 1)}</td>
      <td>${fmtTeur(row.depreciation, 1)}</td>
      <td>${fmtTeur(row.capitalReturn, 1)}</td>
      <td>${fmtTeur(row.qAndE, 1)}</td>
      <td>${fmtTeur(row.risk, 1)}</td>
      <td>${fmtTeur(row.firstYearOpex, 1)}</td>
      <td>${fmtTeur(row.regulatoryEogEffect, 1)}</td>
      <td>${fmtTeur(row.economicOpex + row.reinvestDecommission, 1)}</td>
      <td>${fmtTeur(row.indicativeCashflow, 1)}</td>
      <td>${fmtTeur(result.p.baseEog + row.regulatoryEogEffect, 1)}</td>
    </tr>
  `).join('');
}

function renderTemplateGallery() {
  const gallery = document.getElementById('templateGallery');
  if (!gallery) return;
  const sector = el.sector.value;
  const templates = measureTemplates.filter(template => template.sector === 'both' || template.sector === sector);
  gallery.innerHTML = templates.map(template => `
    <button type="button" class="template-card" data-template-id="${esc(template.templateId)}">
      <span class="template-icon" aria-hidden="true">${esc(template.icon || '+')}</span>
      <strong>${esc(template.name)}</strong>
      <span>${template.sector === 'both' ? 'Gas/Strom' : template.sector === 'gas' ? 'Gas' : 'Strom'} · typisch ${fmtTeur(template.costRange[1])}</span>
      <small>Spanne ${fmtTeur(template.costRange[0])} bis ${fmtTeur(template.costRange[2])} · Stand ${esc(template.templateVersion)}</small>
    </button>
  `).join('');
}

function openTemplateModal() {
  if (isReadOnlyRole()) return;
  renderTemplateGallery();
  document.getElementById('templateModal').classList.remove('hidden');
}

function closeTemplateModal() {
  document.getElementById('templateModal').classList.add('hidden');
}

function startBlankMeasureWizard() {
  closeTemplateModal();
  openMeasureWizard();
}

function addMeasureFromTemplate(templateId) {
  const template = measureTemplates.find(item => item.templateId === templateId);
  if (!template) return;
  const measure = measureFromTemplate(template);
  measures = [...measures, measure];
  selectedId = measure.id;
  setView('measures');
  closeTemplateModal();
  renderAll();
  openMeasureEditModal();
  setStorageStatus('Maßnahme aus Vorlage angelegt. Richtwerte bitte lokal prüfen.');
}

function renderScenarios() {
  const rows = ['basis', 'konservativ', 'wert'].map(name => {
    const result = currentPortfolio(currentScenarioParams(name));
    const first = result.yearly[0] || { eog: 0 };
    return `
      <tr>
        <td>${name === 'basis' ? 'Basis' : name === 'konservativ' ? 'Konservativ' : 'Wert'}</td>
        <td>${fmtPct(result.p.attribution * 100, 0)}</td>
        <td>${fmtTeur(result.qePa + result.impactPa, 1)}</td>
        <td>${fmtTeur(first.regulatoryEogEffect, 1)}</td>
        <td>${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'}</td>
        <td>${fmtTeur(result.npv, 1)}</td>
      </tr>
    `;
  });
  document.getElementById('scenarioBody').innerHTML = rows.join('');
}

function sidecarTypeLabel(object) {
  const profile = sidecarProfiles[object.division];
  return profile?.categoryLabels?.[object.type] || object.type;
}

function newSidecarObjectTemplate() {
  const division = el.sector?.value === 'strom' ? 'strom' : 'gas';
  const type = division === 'strom' ? 'data_quality' : 'gas_load_path';
  return normalizeSidecarObject({
    id: 'ctx_' + Date.now().toString(36),
    type,
    division,
    title: division === 'strom' ? 'Neuer Strom-Kontext' : 'Neuer Gas-Kontext',
    status: 'pruefpflichtig',
    evidenceStatus: 'missing',
    calculationImpact: 'none',
    sensitivity: 'internal',
    exportStatus: 'sanitized_only'
  }, sidecar.objects.length);
}

function addSidecarObject() {
  const object = newSidecarObjectTemplate();
  sidecar = normalizeSidecar({ ...sidecar, objects: [...sidecar.objects, object] });
  selectedSidecarId = object.id;
  renderAll();
  setStorageStatus('Sidecar-Objekt wurde hinzugefügt.');
}

function updateSidecarObject(id, patchFields = {}, rerender = true) {
  sidecar = normalizeSidecar({
    ...sidecar,
    objects: sidecar.objects.map(object => object.id === id ? normalizeSidecarObject({ ...object, ...patchFields }) : object)
  });
  if (rerender) renderAll();
  else saveToBrowser(true);
}

function sidecarHasOpenBridgeLogic(object) {
  if (!['effect_assumption', 'economic_bridge'].includes(object.sidecarType)) return false;
  if (object.calculationImpact === 'none') return false;
  const bridge = object.bridgeLogic || {};
  return bridge.economicRelation === 'none' || ['not_applicable', 'open', 'described'].includes(bridge.quantificationStatus);
}

function sidecarHasQuantifiedBridge(object) {
  return ['working_value', 'validated'].includes(object.bridgeLogic?.quantificationStatus);
}

function sidecarMatchesModeFilter(object) {
  if (sidecarModeFilter === 'all') return true;
  if (sidecarModeFilter === 'context') return object.sidecarType === 'context';
  if (sidecarModeFilter === 'sensitivity') return object.sidecarType === 'sensitivity';
  if (sidecarModeFilter === 'open_questions') return object.openQuestions.length || sidecarHasOpenBridgeLogic(object) || ['missing', 'conflicting', 'stale'].includes(object.evidenceStatus);
  if (sidecarModeFilter === 'open_bridge_logic') return sidecarHasOpenBridgeLogic(object);
  if (sidecarModeFilter === 'quantified_effect') return sidecarHasQuantifiedBridge(object);
  if (sidecarModeFilter === 'activated') return object.activationStatus === 'activated';
  if (sidecarModeFilter === 'no_calculation') return object.calculationImpact === 'none';
  return true;
}

function sidecarBridgeWarning(object) {
  const bridge = object.bridgeLogic || {};
  if (['effect_assumption', 'economic_bridge'].includes(object.sidecarType) && object.calculationImpact !== 'none' && !bridge.description) {
    return 'Sidecar sichtbar, wirtschaftliche Überleitung nicht modelliert';
  }
  if (['effect_assumption', 'economic_bridge'].includes(object.sidecarType) && ['open', 'described', 'not_applicable'].includes(bridge.quantificationStatus)) {
    return 'Wirkbeziehung beschrieben, Quantifizierung offen';
  }
  if (object.activationStatus === 'activated' || object.calculationImpact === 'active') {
    return 'Aktivierung verändert keine Kennzahl ohne freigegebene Mapping-Logik';
  }
  return 'Sidecar sichtbar, Überleitungslogik prüfpflichtig, keine automatische KPI-Wirkung';
}

function sidecarNextAuditAction(object) {
  const bridge = object.bridgeLogic || {};
  if (object.calculationImpact === 'none') return 'Bei Kontextobjekt belassen oder Wirkbeziehung bewusst beschreiben.';
  if (!bridge.description || bridge.economicRelation === 'none') return 'Wirkbeziehung und Bezug zur Maßnahme beschreiben.';
  if (['not_applicable', 'open', 'described'].includes(bridge.quantificationStatus)) return 'Quantifizierungsmethode, Betrag oder offene Frage dokumentieren.';
  if (object.activationStatus !== 'activated') return 'Validierung prüfen und Aktivierung bewusst entscheiden.';
  return 'Aktivierung und Mapping-Logik auditieren; KPI-Wirkung bleibt ohne Mapping neutral.';
}

function sidecarCardTone(object) {
  if (object.activationStatus === 'activated' || object.calculationImpact === 'active') return 'active';
  if (sidecarHasOpenBridgeLogic(object) || ['missing', 'conflicting', 'stale'].includes(object.evidenceStatus)) return 'warn';
  if (object.evidenceStatus === 'validated') return 'good';
  if (object.sidecarType === 'system_reference') return 'system';
  if (object.sidecarType === 'sensitivity') return 'sensitivity';
  return 'context';
}

function sidecarTypeInitial(object) {
  if (object.sidecarType === 'economic_bridge') return 'B';
  if (object.sidecarType === 'effect_assumption') return 'W';
  if (object.sidecarType === 'system_reference') return 'S';
  if (object.sidecarType === 'sensitivity') return 'T';
  return 'K';
}

function sidecarImpactLabel(object) {
  if (object.calculationImpact === 'active') return 'aktiv markiert';
  if (object.calculationImpact === 'scenario_only') return 'nur Szenario';
  if (object.calculationImpact === 'indirect') return 'indirekter Bezug';
  return 'keine Rechenwirkung';
}

function sidecarEvidenceLabel(object) {
  const labels = {
    missing: 'Evidenz fehlt',
    stated: 'Evidenz benannt',
    source_available: 'Quelle verfügbar',
    validated: 'validiert',
    conflicting: 'widersprüchlich',
    stale: 'veraltet'
  };
  return labels[object.evidenceStatus] || object.evidenceStatus;
}

function renderSidecar() {
  sidecar = normalizeSidecar(sidecar);
  const summary = sidecarSummary(sidecar);
  const status = document.getElementById('status-sidecar');
  if (status) status.textContent = `${summary.total} Objekte · ${summary.openQuestions} Prüfpunkte`;
  const cards = document.getElementById('sidecarSummaryCards');
  if (cards) {
    cards.innerHTML = `
      <button type="button" class="summary-card summary-card-button" data-sidecar-summary-filter="all"><strong>${summary.total}</strong><span>Sidecar-Objekte</span></button>
      <button type="button" class="summary-card summary-card-button" data-sidecar-summary-filter="open_questions"><strong>${summary.openQuestions}</strong><span>offene Prüfpunkte</span></button>
      <button type="button" class="summary-card summary-card-button" data-sidecar-summary-filter="open_bridge_logic"><strong>${summary.openBridgeLogic}</strong><span>offene Überleitungslogik</span></button>
      <button type="button" class="summary-card summary-card-button" data-sidecar-summary-filter="quantified_effect"><strong>${summary.quantifiedNotActivated}</strong><span>quantifiziert, aber nicht aktiviert</span></button>
      <button type="button" class="summary-card summary-card-button" data-sidecar-summary-filter="activated"><strong>${summary.activated}</strong><span>aktiviert markiert</span></button>
    `;
  }
  const filter = document.getElementById('sidecarDivisionFilter');
  if (filter && filter.value !== sidecarFilterDivision) filter.value = sidecarFilterDivision;
  const modeFilter = document.getElementById('sidecarModeFilter');
  if (modeFilter && modeFilter.value !== sidecarModeFilter) modeFilter.value = sidecarModeFilter;
  const body = document.getElementById('sidecarBody');
  if (!body) return;
  const objects = sidecar.objects
    .filter(object => sidecarFilterDivision === 'all' || object.division === sidecarFilterDivision)
    .filter(sidecarMatchesModeFilter);
  body.innerHTML = objects.length ? objects.map(object => `
    <article class="sidecar-object-card sidecar-tone-${esc(sidecarCardTone(object))} ${object.id === selectedSidecarId ? 'active' : ''}" data-sidecar-card="${esc(object.id)}">
      <div class="sidecar-card-main">
        <div class="sidecar-card-marker" aria-hidden="true">${esc(sidecarTypeInitial(object))}</div>
        <div class="sidecar-card-copy">
          <p class="eyebrow">${esc(object.division)} · ${esc(sidecarTypeLabel(object))}</p>
          <h3>${esc(object.title)}</h3>
          <p class="sidecar-card-summary">${esc(object.summary || 'Kurzbeschreibung fehlt noch.')}</p>
          <div class="sidecar-card-warning">
            <strong>${esc(sidecarBridgeWarning(object))}</strong>
            <span>Nächste Prüfaktion: ${esc(sidecarNextAuditAction(object))}</span>
          </div>
        </div>
        <div class="sidecar-card-status" aria-label="Sidecar-Status">
          <span class="sidecar-status-chip">${esc(sidecarTypeLabel(object))}</span>
          <span class="sidecar-status-chip">${esc(sidecarImpactLabel(object))}</span>
          <span class="sidecar-status-chip">${esc(sidecarEvidenceLabel(object))}</span>
        </div>
      </div>
      <details class="sidecar-editor-disclosure" ${object.id === selectedSidecarId ? 'open' : ''}>
        <summary class="sidecar-edit-action"><span>Bearbeiten/Verknüpfen</span></summary>
        <div class="grid2 sidecar-editor-grid">
          <div><label data-help-id="sidecarTitle">Titel<input data-sidecar-field="title" data-sidecar-id="${esc(object.id)}" value="${esc(object.title)}"></label></div>
          <div><label data-help-id="sidecarDivision">Sparte<select data-sidecar-field="division" data-sidecar-id="${esc(object.id)}"><option value="strom" ${object.division === 'strom' ? 'selected' : ''}>Strom</option><option value="gas" ${object.division === 'gas' ? 'selected' : ''}>Gas</option><option value="cross_division" ${object.division === 'cross_division' ? 'selected' : ''}>spartenübergreifend</option></select></label></div>
          <div><label data-help-id="sidecarType">Typ<input data-sidecar-field="type" data-sidecar-id="${esc(object.id)}" value="${esc(object.type)}"></label></div>
          <div><label data-help-id="sidecarBridgeLogic">Sidecar-Typ<select data-sidecar-field="sidecarType" data-sidecar-id="${esc(object.id)}"><option value="context" ${object.sidecarType === 'context' ? 'selected' : ''}>Kontext</option><option value="sensitivity" ${object.sidecarType === 'sensitivity' ? 'selected' : ''}>Sensitivität</option><option value="effect_assumption" ${object.sidecarType === 'effect_assumption' ? 'selected' : ''}>Wirkannahme</option><option value="economic_bridge" ${object.sidecarType === 'economic_bridge' ? 'selected' : ''}>wirtschaftliche Überleitung</option><option value="system_reference" ${object.sidecarType === 'system_reference' ? 'selected' : ''}>Systemreferenz</option></select></label></div>
          <div><label data-help-id="sidecarStatus">Status<select data-sidecar-field="status" data-sidecar-id="${esc(object.id)}"><option value="context" ${object.status === 'context' ? 'selected' : ''}>Kontext</option><option value="pruefpflichtig" ${object.status === 'pruefpflichtig' ? 'selected' : ''}>prüfpflichtig</option><option value="quantified" ${object.status === 'quantified' ? 'selected' : ''}>quantifiziert</option><option value="active" ${object.status === 'active' ? 'selected' : ''}>aktiv</option><option value="archived" ${object.status === 'archived' ? 'selected' : ''}>archiviert</option></select></label></div>
          <div><label data-help-id="sidecarEvidenceStatus">Evidenzstatus<select data-sidecar-field="evidenceStatus" data-sidecar-id="${esc(object.id)}"><option value="missing" ${object.evidenceStatus === 'missing' ? 'selected' : ''}>fehlt</option><option value="stated" ${object.evidenceStatus === 'stated' ? 'selected' : ''}>benannt</option><option value="source_available" ${object.evidenceStatus === 'source_available' ? 'selected' : ''}>Quelle verfügbar</option><option value="validated" ${object.evidenceStatus === 'validated' ? 'selected' : ''}>validiert</option><option value="conflicting" ${object.evidenceStatus === 'conflicting' ? 'selected' : ''}>widersprüchlich</option><option value="stale" ${object.evidenceStatus === 'stale' ? 'selected' : ''}>veraltet</option></select></label></div>
          <div><label data-help-id="sidecarCalculationImpact">Rechenwirkung<select data-sidecar-field="calculationImpact" data-sidecar-id="${esc(object.id)}"><option value="none" ${object.calculationImpact === 'none' ? 'selected' : ''}>keine</option><option value="scenario_only" ${object.calculationImpact === 'scenario_only' ? 'selected' : ''}>nur Szenario</option><option value="indirect" ${object.calculationImpact === 'indirect' ? 'selected' : ''}>indirekt</option><option value="active" ${object.calculationImpact === 'active' ? 'selected' : ''}>aktiv markiert</option></select></label></div>
          <div><label data-help-id="sidecarActivationStatus">Aktivierungsstatus<select data-sidecar-field="activationStatus" data-sidecar-id="${esc(object.id)}"><option value="not_activated" ${object.activationStatus === 'not_activated' ? 'selected' : ''}>nicht aktiviert</option><option value="candidate" ${object.activationStatus === 'candidate' ? 'selected' : ''}>Kandidat</option><option value="ready_for_activation" ${object.activationStatus === 'ready_for_activation' ? 'selected' : ''}>bereit zur Aktivierung</option><option value="activated" ${object.activationStatus === 'activated' ? 'selected' : ''}>aktiviert</option><option value="rejected" ${object.activationStatus === 'rejected' ? 'selected' : ''}>verworfen</option></select></label></div>
          <div><label data-help-id="sidecarSensitivity">Sensitivität<select data-sidecar-field="sensitivity" data-sidecar-id="${esc(object.id)}"><option value="public" ${object.sensitivity === 'public' ? 'selected' : ''}>öffentlich</option><option value="internal" ${object.sensitivity === 'internal' ? 'selected' : ''}>intern</option><option value="private" ${object.sensitivity === 'private' ? 'selected' : ''}>privat</option><option value="confidential" ${object.sensitivity === 'confidential' ? 'selected' : ''}>vertraulich</option></select></label></div>
          <div><label data-help-id="sidecarExportStatus">Exportstatus<select data-sidecar-field="exportStatus" data-sidecar-id="${esc(object.id)}"><option value="allowed" ${object.exportStatus === 'allowed' ? 'selected' : ''}>erlaubt</option><option value="sanitized_only" ${object.exportStatus === 'sanitized_only' ? 'selected' : ''}>nur sanitisiert</option><option value="excluded" ${object.exportStatus === 'excluded' ? 'selected' : ''}>ausgeschlossen</option></select></label></div>
          <div class="wide-field"><label data-help-id="sidecarTitle">Kurzbeschreibung<textarea data-sidecar-field="summary" data-sidecar-id="${esc(object.id)}" rows="2">${esc(object.summary)}</textarea></label></div>
          <div class="wide-field"><label data-help-id="sidecarLinkedMeasures">Verknüpfte Maßnahmen-IDs<input data-sidecar-field="linkedMeasures" data-sidecar-id="${esc(object.id)}" value="${esc(object.linkedMeasures.join(', '))}"></label></div>
          <div class="wide-field"><label data-help-id="sidecarOpenQuestions">Offene Prüfpunkte<input data-sidecar-field="openQuestions" data-sidecar-id="${esc(object.id)}" value="${esc(object.openQuestions.join('; '))}"></label></div>
          <div class="wide-field"><label data-help-id="sidecarBridgeLogic">Überleitungslogik Beschreibung<textarea data-sidecar-field="bridgeLogic.description" data-sidecar-id="${esc(object.id)}" rows="2" placeholder="Welche wirtschaftliche Beziehung ist gemeint?">${esc(object.bridgeLogic?.description || '')}</textarea></label></div>
          <div><label data-help-id="sidecarBridgeLogic">Wirkbeziehung<select data-sidecar-field="bridgeLogic.economicRelation" data-sidecar-id="${esc(object.id)}"><option value="none" ${object.bridgeLogic?.economicRelation === 'none' ? 'selected' : ''}>keine</option><option value="opex_effect" ${object.bridgeLogic?.economicRelation === 'opex_effect' ? 'selected' : ''}>OPEX-Effekt</option><option value="capex_dependency" ${object.bridgeLogic?.economicRelation === 'capex_dependency' ? 'selected' : ''}>CAPEX-Abhängigkeit</option><option value="revenue_effect" ${object.bridgeLogic?.economicRelation === 'revenue_effect' ? 'selected' : ''}>Erlöseffekt</option><option value="risk_effect" ${object.bridgeLogic?.economicRelation === 'risk_effect' ? 'selected' : ''}>Risikoeffekt</option><option value="timing_effect" ${object.bridgeLogic?.economicRelation === 'timing_effect' ? 'selected' : ''}>Timing-Effekt</option><option value="avoided_cost" ${object.bridgeLogic?.economicRelation === 'avoided_cost' ? 'selected' : ''}>vermiedene Kosten</option></select></label></div>
          <div><label data-help-id="sidecarQuantificationStatus">Quantifizierungsstatus<select data-sidecar-field="bridgeLogic.quantificationStatus" data-sidecar-id="${esc(object.id)}"><option value="not_applicable" ${object.bridgeLogic?.quantificationStatus === 'not_applicable' ? 'selected' : ''}>nicht anwendbar</option><option value="open" ${object.bridgeLogic?.quantificationStatus === 'open' ? 'selected' : ''}>offen</option><option value="described" ${object.bridgeLogic?.quantificationStatus === 'described' ? 'selected' : ''}>beschrieben</option><option value="working_value" ${object.bridgeLogic?.quantificationStatus === 'working_value' ? 'selected' : ''}>Arbeitswert</option><option value="validated" ${object.bridgeLogic?.quantificationStatus === 'validated' ? 'selected' : ''}>validiert</option></select></label></div>
          <div><label data-help-id="sidecarBridgeLogic">Richtung<select data-sidecar-field="bridgeLogic.direction" data-sidecar-id="${esc(object.id)}"><option value="none" ${object.bridgeLogic?.direction === 'none' ? 'selected' : ''}>keine</option><option value="positive" ${object.bridgeLogic?.direction === 'positive' ? 'selected' : ''}>positiv</option><option value="negative" ${object.bridgeLogic?.direction === 'negative' ? 'selected' : ''}>negativ</option><option value="mixed" ${object.bridgeLogic?.direction === 'mixed' ? 'selected' : ''}>gemischt</option><option value="unclear" ${object.bridgeLogic?.direction === 'unclear' ? 'selected' : ''}>unklar</option></select></label></div>
          <div><label data-help-id="sidecarBridgeLogic">Betrag<input data-sidecar-field="bridgeLogic.amount" data-sidecar-id="${esc(object.id)}" type="number" step="0.1" value="${esc(object.bridgeLogic?.amount ?? '')}"></label></div>
          <div><label data-help-id="sidecarBridgeLogic">Einheit<input data-sidecar-field="bridgeLogic.amountUnit" data-sidecar-id="${esc(object.id)}" placeholder="z.B. TEUR/a" value="${esc(object.bridgeLogic?.amountUnit || '')}"></label></div>
          <div><label data-help-id="sidecarBridgeLogic">Zeithorizont<input data-sidecar-field="bridgeLogic.timeHorizon" data-sidecar-id="${esc(object.id)}" value="${esc(object.bridgeLogic?.timeHorizon || '')}"></label></div>
          <div class="wide-field"><label data-help-id="sidecarBridgeLogic">Methode / Annahmen<input data-sidecar-field="bridgeLogic.quantificationMethod" data-sidecar-id="${esc(object.id)}" value="${esc(object.bridgeLogic?.quantificationMethod || '')}"></label></div>
          <div class="wide-field"><label data-help-id="sidecarBridgeLogic">Brücken-Prüffragen<input data-sidecar-field="bridgeLogic.openQuestions" data-sidecar-id="${esc(object.id)}" value="${esc((object.bridgeLogic?.openQuestions || []).join('; '))}"></label></div>
        </div>
      </details>
    </article>
  `).join('') : '<div class="empty-state"><strong>Noch keine Sidecar-Objekte.</strong><small>Kontext- und Evidenzwissen kann hier getrennt von Maßnahmen erfasst werden.</small></div>';
  enhanceHelpLabels(body);
}

function sidecarReportSummaryHtml() {
  const exportSidecar = sanitizeSidecarForExport(sidecar, 'sanitized_external');
  const summary = sidecarSummary(exportSidecar);
  const open = exportSidecar.objects.filter(object => object.openQuestions.length || sidecarHasOpenBridgeLogic(object) || ['missing', 'conflicting', 'stale'].includes(object.evidenceStatus));
  return `
    <section class="report-section">
      <h2>Kontext- und Wirkobjekte / Sidecars</h2>
      <p class="hint">Sidecar-Objekte sind Kontext-, Evidenz-, Sensitivitäts- oder Wirkobjekte. Sidecar sichtbar, Überleitungslogik prüfpflichtig, keine automatische KPI-Wirkung: Sie sind nicht als klassische Maßnahmen zu lesen und gehen nicht in CAPEX-/EOG-/KPI-Summen ein.</p>
      <div class="report-summary">
        <div class="report-box"><strong>Evidenzlage</strong><p>${summary.total} Objekte, davon ${summary.byEvidenceStatus.validated || 0} validiert und ${summary.byEvidenceStatus.missing || 0} ohne Evidenz.</p></div>
        <div class="report-box"><strong>Datenqualität</strong><p>${summary.dataQualityOpen} offene Datenqualitätsobjekte; ${summary.openQuestions} offene Prüfpunkte.</p></div>
        <div class="report-box"><strong>Rechenwirkung</strong><p>${summary.withoutCalculationImpact} ohne Rechenwirkung, ${summary.calculationImpact.indirect || 0} indirekt, ${summary.calculationImpact.scenario_only || 0} nur Szenario, ${summary.calculationImpact.active || 0} aktiv markiert.</p></div>
        <div class="report-box"><strong>Überleitungslogik</strong><p>${summary.openBridgeLogic} offene Überleitungslogik, ${summary.quantifiedNotActivated} quantifiziert, aber nicht aktiviert; ${summary.activated} aktiviert markiert.</p></div>
      </div>
      ${open.length ? `<div class="report-sidecar-list">${open.slice(0, 8).map(object => `<article class="report-sidecar-item"><span>${esc(object.division)} · ${esc(object.sidecarType)} · ${esc(sidecarTypeLabel(object))}</span><strong>${esc(object.title)}</strong><p>${esc(sidecarBridgeWarning(object))}</p></article>`).join('')}</div>` : '<p class="hint">Keine offenen Sidecar-Prüfpunkte im sanitisierten Exportprofil.</p>'}
    </section>
  `;
}

function renderReportMode() {
  document.querySelectorAll('.report-mode').forEach(button => {
    button.classList.toggle('active', button.dataset.reportMode === reportMode);
  });
  document.body.dataset.reportMode = reportMode;
}

function scenarioLabel(name) {
  return name === 'basis' ? 'Basis' : name === 'konservativ' ? 'Konservativ' : 'Wert';
}

function strategyMeasureNamesCell(items) {
  if (!items.length) return '<span class="strategy-measure-empty">-</span>';
  return `
    <ul class="strategy-measure-list">
      ${items.map(item => `<li>${esc(item.measure.name)}</li>`).join('')}
    </ul>
  `;
}

function strategyContributionRows(result) {
  const objectiveRows = strategy.objectives.map(objective => {
    const matching = result.results.filter(item => (item.measure.objectiveIds || []).includes(objective.id));
    const invest = matching.reduce((sum, item) => sum + Number(item.measure.cost || 0), 0);
    const firstEog = matching.reduce((sum, item) => sum + (item.rows[0]?.regulatoryEogEffect || 0), 0);
    const risk = matching.reduce((sum, item) => sum + item.riskReductionPa, 0);
    return `
      <tr>
        <td>${esc(objective.label)}</td>
        <td>${fmtTeur(invest, 1)}</td>
        <td>${fmtTeur(firstEog, 1)}</td>
        <td>${fmtTeur(risk, 1)}</td>
        <td class="strategy-measures-cell">${strategyMeasureNamesCell(matching)}</td>
      </tr>
    `;
  }).join('');
  const unassigned = result.results.filter(item => !(item.measure.objectiveIds || []).length);
  const unassignedRow = unassigned.length
    ? `<tr class="warn-row"><td>Ohne Zielzuordnung</td><td>${fmtTeur(unassigned.reduce((sum, item) => sum + Number(item.measure.cost || 0), 0), 1)}</td><td>${fmtTeur(unassigned.reduce((sum, item) => sum + (item.rows[0]?.regulatoryEogEffect || 0), 0), 1)}</td><td>${fmtTeur(unassigned.reduce((sum, item) => sum + item.riskReductionPa, 0), 1)}</td><td class="strategy-measures-cell">${strategyMeasureNamesCell(unassigned)}</td></tr>`
    : '';
  return objectiveRows + unassignedRow;
}

function strategyContributionBars(result) {
  const maxInvest = Math.max(1, ...strategy.objectives.map(objective => {
    return result.results
      .filter(item => (item.measure.objectiveIds || []).includes(objective.id))
      .reduce((sum, item) => sum + Number(item.measure.cost || 0), 0);
  }));
  const maxEog = Math.max(1, ...strategy.objectives.map(objective => {
    return result.results
      .filter(item => (item.measure.objectiveIds || []).includes(objective.id))
      .reduce((sum, item) => sum + (item.rows[0]?.regulatoryEogEffect || 0), 0);
  }));
  if (!strategy.objectives.length) {
    return '<div class="empty-state"><span aria-hidden="true">◎</span><strong>Noch keine strategischen Ziele hinterlegt.</strong><small>Mit Zielen wird sichtbar, worauf das Budget einzahlt.</small></div>';
  }
  return `
    <div class="goal-bars" aria-label="Zielbeitrag als Balken">
      ${strategy.objectives.map(objective => {
        const matching = result.results.filter(item => (item.measure.objectiveIds || []).includes(objective.id));
        const invest = matching.reduce((sum, item) => sum + Number(item.measure.cost || 0), 0);
        const eog = matching.reduce((sum, item) => sum + (item.rows[0]?.regulatoryEogEffect || 0), 0);
        const investWidth = Math.round(invest / maxInvest * 100);
        const markerLeft = Math.min(100, Math.round(eog / maxEog * 100));
        return `
          <div class="goal-bar">
            <div><strong>${esc(objective.label)}</strong><small>${fmtTeur(invest, 1)} Invest · ${fmtTeur(eog, 1)} EOG-Wirkung Startjahr</small></div>
            <div class="goal-track"><span style="width:${investWidth}%"></span><i style="left:${markerLeft}%"></i></div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function tariffImpactLine(tariffImpact) {
  if (!tariffImpact?.available) {
    return {
      value: 'Jahresarbeit fehlt',
      sub: 'Jahresarbeit eintragen',
      sentence: 'Die indikative Entgeltwirkung kann erst gezeigt werden, wenn die verteilte Jahresarbeit eingetragen ist.'
    };
  }
  const household = tariffImpact.householdEurPerYear;
  const value = household > 0 && household < 1
    ? 'unter 1 EUR/Jahr je Haushalt'
    : '~' + fmtEur(household, household < 10 ? 1 : 0) + '/Jahr je Haushalt';
  return {
    value,
    sub: fmtPlain(tariffImpact.ctPerKwh, 3) + ' ct/kWh',
    sentence: `Für einen Durchschnittshaushalt entspricht das rechnerisch etwa ${value}. ${tariffImpact.caveat}`
  };
}

function regulationProcedureNote(result) {
  return result.p.regulationProcedure === 'simplified'
    ? 'Modell im vereinfachten Verfahren nach § 24 ARegV; qualitäts- und effizienzbezogene Einzeleffekte werden pauschaliert und hier rechnerisch neutral behandelt.'
    : '';
}

function reinvestTreatmentLabel(measure) {
  if (measure.reinvestMode === 'assetAddition') return 'neuer Anlagenzugang';
  return Number(measure.reinvestCost || 0) > 0 ? 'vereinfachter Einmalabzug' : 'keine Reinvestition';
}

function reinvestTreatmentNote(measure) {
  if (measure.reinvestMode === 'assetAddition') {
    return `Reinvest-Logik: neuer Anlagenzugang mit eigener AfA-/Verzinsungskette über ${Math.max(1, Number(measure.reinvestLife || measure.life || 1))} Jahre.`;
  }
  return Number(measure.reinvestCost || 0) > 0
    ? 'Reinvest-Logik: vereinfachter Einmalabzug in der wirtschaftlichen Cashflow-Überleitung; keine neue Kapitalbasis.'
    : 'Reinvest-Logik: keine zusätzliche Reinvestition hinterlegt.';
}

function complianceOverviewRows(result) {
  const activeImpacts = allImpactAssumptions(true);
  const lccMeasures = result.activeMeasures.filter(measure =>
    Number(measure.opexPa || 0) ||
    Number(measure.opexDeltaPa || 0) ||
    Number(measure.reinvestCost || 0) ||
    Number(measure.decommissionCost || 0)
  ).length;
  const riskImpacts = activeImpacts.filter(impact => impact.area === 'risk').length;
  const linkedMeasures = result.activeMeasures.filter(measure => (measure.objectiveIds || []).length).length;
  const sourcedImpacts = activeImpacts.filter(impact => impact.evidenceType && impact.evidenceType !== 'open').length;
  const eventCount = history.events?.length || 0;
  const snapshotCount = history.snapshots?.length || 0;
  const rows = [
    ['Entscheidungen auf Lebenszyklusbasis', 'TOTEX/LCC-Cashflows je Maßnahme', `${lccMeasures} aktive Maßnahmen mit Lebenszyklusdaten, TOTEX ${fmtTeur(result.totex.nominal, 1)} nominal`],
    ['Risikobasierte Priorisierung', 'Wahrscheinlichkeit x Schadenshöhe, vorher/nachher', `${riskImpacts} Risiko-Wirkannahmen, Risikoreduktion ${fmtTeur(result.riskPa, 1)} p.a.`],
    ['Line of Sight Strategie zu Maßnahme', 'Zielkatalog und Zielzuordnung', `${linkedMeasures} von ${result.activeMeasures.length} aktiven Maßnahmen mit Zielzuordnung`],
    ['Dokumentierte Annahmen und Datenqualität', 'Vertrauensstufe, Evidenztyp, Kausalkette', `${sourcedImpacts} von ${activeImpacts.length} Wirkannahmen mit belastbarer Quellenart`],
    ['Nachvollziehbarkeit von Änderungen', 'Event-Log und Snapshots', `${eventCount} Ereignisse, ${snapshotCount} Snapshots im Modell-JSON`],
    ['Bewertungs- und Entscheidungskriterien', 'Verdict-Schwellen und Szenariovergleich', `IRR, Kapitalwert, Spread und drei Szenarien im Report ausgewiesen`]
  ];
  return rows.map(([requirement, functionText, evidence]) => `
    <tr>
      <td>${esc(requirement)}</td>
      <td>${esc(functionText)}</td>
      <td>${esc(evidence)}</td>
    </tr>
  `).join('');
}

function valueLabel(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function eventJournalRows() {
  const events = [...(history.events || [])].reverse();
  return events.length
    ? events.map(event => `
      <tr>
        <td>${new Date(event.timestamp).toLocaleString('de-DE')}</td>
        <td>${esc(event.author || '-')}</td>
        <td>${esc(event.type || '-')}</td>
        <td>${esc(event.field || '-')}</td>
        <td>${esc(valueLabel(event.oldValue))} → ${esc(valueLabel(event.newValue))}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5">Noch keine Ereignisse im Journal.</td></tr>';
}

function plainCommitteeStory(result, first, metrics = portfolioDecisionMetrics(result)) {
  if (!result.activeMeasures.length) {
    return 'Es ist noch keine aktive Maßnahme ausgewählt. Die Vorlage dokumentiert daher einen Arbeitsstand ohne Beschlussreife.';
  }
  const activeText = result.activeMeasures.length === 1 ? 'eine aktive Maßnahme' : `${result.activeMeasures.length} aktive Maßnahmen`;
  const tariff = tariffImpactLine(result.tariffImpact);
  const tariffText = result.tariffImpact.available
    ? ` Für einen Durchschnittshaushalt entspricht das rechnerisch etwa ${tariff.value}.`
    : '';
  return `Das Modell bewertet ${activeText} mit ${fmtTeur(result.invest)} Investition. Die modellierte EOG-Wirkung liegt im ersten Folgejahr bei ${fmtTeur(metrics.recurringRegulatoryEog, 1)}; spätere Jahreswerte können abweichen. Das Startjahr enthält ${fmtTeur(metrics.yearOneOneOff, 1)} Einmaleffekt.${tariffText}`;
}

function committeeProposal(result) {
  const text = String(committee.proposalText || '').trim();
  if (text) return text;
  return result.activeMeasures.length
    ? 'Das Gremium nimmt die dargestellte Maßnahmebewertung zur Kenntnis und beauftragt die Verwaltung, die offenen Punkte vor einer finalen Budgetfreigabe zu klären.'
    : 'Das Gremium nimmt den Arbeitsstand zur Kenntnis. Eine Beschlussfassung wird nach Ergänzung aktiver Maßnahmen vorbereitet.';
}

function committeeReportHtml(result, first, spread, metrics = portfolioDecisionMetrics(result)) {
  const isBoardAudience = committee.audience === 'vorstand';
  const tariff = tariffImpactLine(result.tariffImpact);
  const openItems = clarificationItems().filter(item => item.status !== 'closed');
  const reviewItems = reviewRequiredImpacts(true);
  const latestSnapshot = (history.snapshots || []).at(-1);
  const activeNames = result.activeMeasures.map(measure => measure.name).slice(0, 4).join(', ') || 'noch keine aktive Maßnahme';
  const ebitYearOne = first?.ebit || 0;
  const ebitFiveYears = result.yearly.slice(0, 5).reduce((sum, row) => sum + (row.ebit || 0), 0);
  const bridgeFiveYears = result.yearly.slice(0, 5).reduce((sum, row) => sum + (row.bridge || 0), 0);
  const orgUnitRows = [...new Map(result.results.map(item => [item.measure.orgUnit || 'ohne Bereich', []])).keys()].map(orgUnit => {
    const matching = result.results.filter(item => (item.measure.orgUnit || 'ohne Bereich') === orgUnit);
    return {
      orgUnit,
      invest: matching.reduce((sum, item) => sum + Number(item.measure.cost || 0), 0),
      eog: matching.reduce((sum, item) => sum + (item.rows[0]?.regulatoryEogEffect || 0), 0),
      ebit: matching.reduce((sum, item) => sum + (item.rows[0]?.ebit || 0), 0)
    };
  }).sort((a, b) => b.invest - a.invest);
  const riskText = result.riskPa > 0
    ? `Die erfassten Risikodaten zeigen eine erwartete Risikoreduktion von ${fmtTeurPerYear(result.riskPa, 1)}. Dieser Wert entsteht aus Eintrittswahrscheinlichkeit vorher/nachher und Schadenshöhe und ist als prüfpflichtiger Arbeitswert zu validieren.`
    : 'Für den Arbeitsstand ist noch keine belastbare Risikoreduktion hinterlegt.';
  const financeLine = `Für Rückfragen: IRR ${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'}, Kapitalwert ${fmtTeur(result.npv, 1)}, Spread ${Number.isFinite(spread) ? fmtPct(spread * 100, 1) : '-'}, EBIT Jahr 1 ${fmtTeur(ebitYearOne, 1)}.`;
  const ruleset = activeRulesetInfo();
  const rulesetLine = `Regulierungsstand: ${ruleset.id} (${ruleset.confidenceLabel}). Quelle: ${ruleset.sourceRef || '-'}; keine Anerkennungszusage.`;
  const planningSummary = buildPlanningResume({
    phaseLabel: phaseLabel(),
    resume: processState.resume,
    maturity: maturityScore(),
    openClarifications: openItems.length,
    reviewCount: reviewItems.length
  });
  return `
    <article class="committee-page">
      <header class="committee-head">
        <div>
          <h1>${isBoardAudience ? 'Vorstandsvorlage Investitionsbewertung' : 'Gremienvorlage Investitionsbewertung'}</h1>
          <p>${esc(committee.body || (isBoardAudience ? 'Vorstand' : 'Gremium'))}${committee.meetingDate ? ` · Sitzung ${esc(formatDateShort(committee.meetingDate))}` : ''}</p>
        </div>
        <div>
          <strong>${result.p.sector === 'gas' ? 'Gas' : 'Strom'}</strong><br>
          Stand ${esc(phaseLabel())} · ${esc(localAuthor() || 'ohne Autor')}
        </div>
      </header>
      <section>
        <h2>Arbeitsstand und nächster Schritt</h2>
        <p><strong>${esc(planningSummary.headline)}.</strong> ${esc(planningSummary.status)}</p>
        <p>${esc(planningSummary.next)}. ${esc(planningSummary.risks)}.</p>
      </section>
      <section>
        <h2>Anlass und Beschlussvorschlag</h2>
        <p>${esc(committeeProposal(result))}</p>
      </section>
      <section>
        <h2>Worum es geht</h2>
        <p>${esc(isBoardAudience
          ? `${plainCommitteeStory(result, first, metrics)} Wirtschaftlich ergibt sich ein indikativer IRR von ${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'}, ein Kapitalwert von ${fmtTeur(result.npv, 1)} und ein Spread von ${Number.isFinite(spread) ? fmtPct(spread * 100, 1) : '-'}.`
          : plainCommitteeStory(result, first, metrics))}</p>
        <p class="committee-muted">Betrachtete Maßnahmen: ${esc(activeNames)}.</p>
      </section>
      <section class="committee-grid">
        <div>
          <h2>Was es kostet</h2>
          <p>Investition: <strong>${fmtTeur(result.invest)}</strong>. Lebenszykluskosten über den Horizont: <strong>${fmtTeur(result.totex.nominal, 1)}</strong>.</p>
        </div>
        ${isBoardAudience
          ? `<div>
              <h2>Ergebniswirkung</h2>
              <p>EBIT-Effekt Jahr 1: <strong>${fmtTeur(ebitYearOne, 1)}</strong>. Kumuliert über fünf Jahre: <strong>${fmtTeur(ebitFiveYears, 1)}</strong>; Überleitung regulatorische zu handelsrechtlicher AfA: <strong>${fmtTeur(bridgeFiveYears, 1)}</strong>.</p>
              <p class="committee-muted">Indikative Ergebnissicht ohne Steuern, Eigenleistungen und Konzerneffekte.</p>
            </div>`
          : `<div>
              <h2>Was es für Bürger bedeutet</h2>
              <p>${esc(tariff.sentence)}</p>
            </div>`}
      </section>
      ${isBoardAudience ? `
        <section>
          <h2>Beitrag je Bereich</h2>
          <table class="compact-table">
            <thead><tr><th>Bereich</th><th>Investition</th><th>zulässige Erlöse Jahr 1</th><th>EBIT Jahr 1</th></tr></thead>
            <tbody>${orgUnitRows.slice(0, 6).map(row => `<tr><td>${esc(row.orgUnit)}</td><td>${fmtTeur(row.invest, 1)}</td><td>${fmtTeur(row.eog, 1)}</td><td>${fmtTeur(row.ebit, 1)}</td></tr>`).join('')}</tbody>
          </table>
        </section>
      ` : ''}
      <section>
        <h2>Was passiert, wenn wir es nicht tun</h2>
        <p>${esc(riskText)}</p>
      </section>
      <section>
        <h2>Offene Punkte und Auflagen</h2>
        ${openItems.length || reviewItems.length
          ? `<p>${openItems.length} offene Klärpunkte, ${reviewItems.length} prüfpflichtige Annahmen.</p><ul>${[...openItems.slice(0, 4).map(item => item.title), ...reviewItems.slice(0, 3).map(item => item.title)].slice(0, 6).map(item => `<li>${esc(item)}</li>`).join('')}</ul>`
          : '<p>Für diesen Stand sind keine offenen Blocker dokumentiert.</p>'}
      </section>
      <footer class="committee-foot">
        <span>Erstellt mit Szenario-Rechner · Modellstand ${latestSnapshot ? esc(latestSnapshot.label) : new Date().toLocaleDateString('de-DE')}</span>
        <span>Unterschrift: __________________________</span>
      </footer>
      <p class="committee-footnote">${esc(financeLine)}</p>
      <p class="committee-footnote">${esc(rulesetLine)}</p>
      ${regulationProcedureNote(result) ? `<p class="committee-footnote">${esc(regulationProcedureNote(result))}</p>` : ''}
    </article>
  `;
}

function systemIntegrationReportHtml(result) {
  const active = result.activeMeasures || [];
  const missingSources = active.filter(measure => !(String(measure.sourceSystem || '').trim() && (String(measure.sourceRecordId || '').trim() || String(measure.externalId || '').trim())));
  const riskMeasures = active.filter(measure => Number(measure.riskAvoided || 0) > 0);
  const incompleteRisk = riskMeasures.filter(measure => !(String(measure.riskDbRef || '').trim() || String(measure.riskEvidenceStatus || measure.riskAvoidedEvidenceStatus || '').trim()));
  const linkedBack = active.length - missingSources.length;
  return `
    <section class="report-section">
      <h2>Arbeitsakte und Systemrückspielweg</h2>
      <p class="hint">Arbeitsakte ersetzt kein führendes System: ERP, Asset-System, Scoringliste, Risikodatenbank und Investitionsmanagement bleiben Quellen bzw. Rückspielziele. Der Rechner bündelt Annahmen, Wirkung und Prüfstatus für Befassung und Export.</p>
      <div class="report-summary">
        <div class="report-box"><strong>Systemreferenzen</strong><p>${linkedBack} von ${active.length} aktiven Maßnahmen mit Quellsystem und Datensatz-/PSP-Bezug.</p></div>
        <div class="report-box"><strong>Risiko-Mapping</strong><p>${riskMeasures.length - incompleteRisk.length} von ${riskMeasures.length} Risikowerten mit Datenbank-/Evidenzbezug.</p></div>
        <div class="report-box"><strong>Nutzungsmodus</strong><p>Sidecar zu bestehenden Systemen / Import-Export-Brücke; keine Vollintegration und keine führende Stammdatenhaltung.</p></div>
      </div>
    </section>
  `;
}

function renderReport(result, first, spread, decision, metrics) {
  const report = document.getElementById('reportPage');
  if (!report) return;
  if (reportMode === 'committee') {
    report.innerHTML = committeeReportHtml(result, first, spread, metrics);
    return;
  }
  const activeText = result.activeMeasures.length === 1 ? '1 aktive Maßnahme' : result.activeMeasures.length + ' aktive Maßnahmen';
  const scenarioRows = ['basis', 'konservativ', 'wert'].map(name => {
    const scenarioResult = currentPortfolio(currentScenarioParams(name));
    const scenarioFirst = scenarioResult.yearly[0] || { eog: 0 };
    return `
      <tr>
        <td>${scenarioLabel(name)}</td>
        <td>${fmtPct(scenarioResult.p.attribution * 100, 0)}</td>
        <td>${fmtTeur(scenarioResult.qePa + scenarioResult.impactPa, 1)}</td>
        <td>${fmtTeur(scenarioFirst.regulatoryEogEffect, 1)}</td>
        <td>${Number.isFinite(scenarioResult.irr) ? fmtPct(scenarioResult.irr * 100, 1) : '-'}</td>
        <td>${fmtTeur(scenarioResult.npv, 1)}</td>
      </tr>
    `;
  }).join('');
  const measureRows = result.results.map(item => {
    const normalizedNote = normalizeGermanTeurText(item.measure.note || '');
    return `
    <tr>
      <td>${esc(item.measure.name)}</td>
      <td>${item.measure.year}</td>
      <td>${fmtTeur(item.measure.cost)}</td>
      <td>${fmtTeur(item.totex.nominal, 1)}</td>
      <td><div class="pill-row compact">${objectivePills(item.measure)}</div></td>
      <td>${fmtPct(item.activeShare * 100, 0)}</td>
      <td>${impactCounts(item.measure).total || '-'}</td>
      <td>${reinvestTreatmentLabel(item.measure)}</td>
      <td>${Number.isFinite(item.irr) ? fmtPct(item.irr * 100, 1) : '-'}</td>
      <td>${normalizedNote.trim() ? `${esc(normalizedNote)} · ${esc(reinvestTreatmentNote(item.measure))}` : esc(reinvestTreatmentNote(item.measure))}</td>
    </tr>
  `;
  }).join('') || '<tr><td colspan="10">Keine aktive Maßnahme im Report.</td></tr>';
  const impactRows = allImpactAssumptions(true).map(item => `
    <tr>
      <td>${esc(item.measure.name)}</td>
      <td><span class="inline-visual">${riskMatrixMiniHtml(item)}${impactAreaLabel(item.area)}</span></td>
      <td>${esc(item.title)}</td>
      <td>${fmtTeur(item.amount * item.attribution, 1)}</td>
      <td>${confidenceLabels[item.confidence]}</td>
      <td>${impactGovernanceLabel(item.governance)}</td>
      <td>${esc(item.evidence || '-')}</td>
    </tr>
  `).join('') || '<tr><td colspan="7">Keine regulatorischen Wirkannahmen dokumentiert.</td></tr>';
  const reviewItems = reviewRequiredImpacts(true);
  const reviewHtml = reviewItems.length
    ? `<ul>${reviewItems.map(item => `<li><strong>${esc(item.measure.name)}:</strong> ${esc(item.title)} (${impactAreaLabel(item.area)}, ${confidenceLabels[item.confidence]}, ${impactGovernanceLabel(item.governance)})${item.note ? ` - ${esc(item.note)}` : ''}</li>`).join('')}</ul>`
    : '<p class="hint">Keine prüfpflichtigen Wirkannahmen im aktiven Szenario dokumentiert.</p>';
  const notes = measures.filter(measure => String(measure.note || '').trim());
  const notesHtml = notes.length
    ? notes.map(measure => `
      <article>
        <h3>${esc(measure.name)}</h3>
        <p>${esc(normalizeGermanTeurText(measure.note))}</p>
      </article>
    `).join('')
    : '<p class="hint">Keine Maßnahmennotizen erfasst.</p>';
  const maturity = maturityScore();
  const clarifications = clarificationItems();
  const clarificationRows = clarifications.map(item => `
    <tr>
      <td>${esc(item.priority?.label || 'normal')}</td>
      <td>${esc(item.priority?.driver || 'Prüfung')}</td>
      <td>${esc(item.measure)}</td>
      <td>${esc(item.title)}</td>
      <td>${esc(item.area)}</td>
      <td>${esc(phaseLabel(item.targetPhase))}</td>
      <td>${item.status === 'closed' ? 'geklärt' : 'offen'}</td>
    </tr>
  `).join('') || '<tr><td colspan="7">Keine Klärpunkte dokumentiert.</td></tr>';
  const snapshotRows = (history.snapshots || []).map(snapshot => `
    <tr>
      <td>${esc(snapshot.label)}</td>
      <td>${esc(snapshot.author)}</td>
      <td>${new Date(snapshot.timestamp).toLocaleString('de-DE')}</td>
      <td>${esc(phaseLabel(snapshot.phase))}</td>
    </tr>
  `).join('') || '<tr><td colspan="4">Noch keine Snapshots dokumentiert.</td></tr>';
  const narrative = eogYearNarrative(result, metrics, activeText);
  const story = result.activeMeasures.length
    ? `${narrative.text} IRR und Kapitalwert sind indikative Cashflow-Kennzahlen: Portfolio-IRR ${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : 'nicht berechenbar'} bei einem FK-Zins von ${fmtPct(result.p.financingRate * 100, 1)}.`
    : 'Es ist keine aktive Maßnahme ausgewählt. Der Report dokumentiert daher noch keinen belastbaren Business Case.';
  const strategyRows = strategyContributionRows(result) || '<tr><td colspan="5">Noch keine strategischen Ziele hinterlegt.</td></tr>';
  const strategyBars = strategyContributionBars(result);
  const strategyHint = strategy.sampReference
    ? `Referenz: ${esc(strategy.sampReference)}`
    : 'Noch keine Strategie- oder Planreferenz hinterlegt. Mit einer Referenz bleibt sichtbar, worauf das Budget einzahlt.';
  const planningSummary = buildPlanningResume({
    phaseLabel: phaseLabel(),
    resume: processState.resume,
    maturity,
    openClarifications: clarifications.filter(item => item.status !== 'closed').length,
    reviewCount: reviewItems.length
  });
  const economicBridge = metrics.recurringIndicativeCashflow - metrics.recurringRegulatoryEog;
  const yearOneEconomicBridge = metrics.yearOneIndicativeCashflow - metrics.yearOneRegulatoryEog;
  const ruleset = activeRulesetInfo();
  const rulesetWarning = ruleset.confidence === 'enacted'
    ? ''
    : `<section class="report-section ruleset-warning"><h2>Regulierungsstand unter Vorbehalt</h2><p>Gerechnet unter ${esc(ruleset.id)} (${esc(ruleset.confidenceLabel)}). Der Parameterstand ist nicht als rechtskräftige Festlegung zu lesen; Entscheidungen sollten die Quelle und spätere Änderungen prüfen.</p><p class="hint">Quelle: ${esc(ruleset.sourceRef || '-')}</p></section>`;

  report.innerHTML = `
    <div class="report-head">
      <div>
        <h1 class="report-title">Management-Report Investitionsszenario</h1>
        <p>${story}</p>
      </div>
      <div class="report-meta">
        <div><strong>Stand:</strong> ${new Date().toLocaleString('de-DE')}</div>
        <div><strong>Sparte:</strong> ${result.p.sector === 'gas' ? 'Gas' : 'Strom'}</div>
        <div><strong>Startjahr:</strong> ${result.p.baseYear}</div>
        <div><strong>Regulierungsperiode:</strong> ${periodText(result.p.regulatoryPeriod)}</div>
        <div><strong>Kostenbasis:</strong> ${result.p.regulatoryPeriod.costBaseYear}</div>
        <div><strong>Szenario:</strong> ${scenarioLabel(scenario)}</div>
        <div><strong>Phase:</strong> ${phaseLabel()}</div>
        <div><strong>Regulierungsstand:</strong> ${esc(ruleset.id)} · ${esc(ruleset.confidenceLabel)}</div>
        <div><strong>Entscheidungsreife:</strong> ${maturity.score} % / ${maturity.blockers} Blocker</div>
      </div>
    </div>

    ${rulesetWarning}

    <section class="report-section">
      <h2>Arbeitsstand und nächster Schritt</h2>
      <div class="report-summary">
        <div class="report-box">
          <strong>${esc(planningSummary.headline)}</strong>
          <p>${esc(planningSummary.status)}</p>
        </div>
        <div class="report-box">
          <strong>Weiterarbeit</strong>
          <p>${esc(planningSummary.next)}. ${esc(planningSummary.risks)}.</p>
        </div>
      </div>
    </section>

    <section class="report-section">
      <h2>Entscheidungstendenz</h2>
      <div class="report-summary">
        <div class="report-box">
          <strong>Urteil</strong>
          <p>${decision.title}</p>
          <p class="hint">${esc(metrics.governanceDecision.recommendation)}</p>
          <p class="hint">Ohne prüfpflichtige Annahmen: IRR ${metrics.conservative && Number.isFinite(metrics.conservative.irr) ? fmtPct(metrics.conservative.irr * 100, 1) : '-'}, Kapitalwert ${metrics.conservative ? fmtTeur(metrics.conservative.npv, 1) : '-'}. ${metrics.conservativeGate === 'auflage' ? 'Basiscase nur mit Auflage/Evidenz beschlussreif.' : ''} ${metrics.scenarioComparison?.identicalBasisConservative ? metrics.scenarioComparison.note : ''}</p>
        </div>
        <div class="report-box">
          <strong>Governance-Hinweis</strong>
          <p>${result.qePa + result.impactPa > 0 ? `Portfolio- und Wirkannahmen von ${fmtTeur(result.qePa + result.impactPa, 1)} p.a. müssen kausal, regulatorisch und hinsichtlich Attribution belegt werden.` : 'Entscheidend sind Aktivierbarkeit, Anerkennung, Timing und Risikowert der aktiven Maßnahmen.'}</p>
        </div>
      </div>
    </section>

    <section class="report-section">
      <h2>Kernkennzahlen</h2>
      <div class="kpis">
        <div class="kpi"><div class="label">Investition</div><div class="value">${fmtTeur(result.invest)}</div><div class="sub">${activeText}</div></div>
        <div class="kpi"><div class="label">TOTEX Horizont</div><div class="value">${fmtTeur(result.totex.nominal, 1)}</div><div class="sub">diskontiert ${fmtTeur(result.totex.discounted, 1)}</div></div>
        <div class="kpi"><div class="label">EOG-Wirkung Folgejahr</div><div class="value">${fmtTeur(metrics.recurringRegulatoryEog, 1)}</div><div class="sub">Startjahr ${fmtTeur(metrics.yearOneRegulatoryEog, 1)} · Einmaleffekt im Startjahr ${fmtTeur(metrics.yearOneOneOff, 1)}</div></div>
        <div class="kpi"><div class="label">IRR indikativ</div><div class="value">${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'}</div><div class="sub">kein garantierter EOG-Cashflow</div></div>
        <div class="kpi"><div class="label">Kapitalwert</div><div class="value">${fmtTeur(result.npv, 1)}</div><div class="sub">Diskontsatz ${fmtPct(result.p.discountRate * 100, 1)}</div></div>
      </div>
    </section>

    <section class="report-section">
      <h2>EOG-/Cashflow-Überleitung</h2>
      <p class="hint">Regulatorische EOG-Wirkung ≠ Cashflow. Die EOG ist eine Erlösobergrenze; IRR und Kapitalwert nutzen eine daraus abgeleitete indikative Cashflow-Basis.</p>
      <div class="report-summary">
        <div class="report-box">
          <strong>Modellierte EOG-Wirkung</strong>
          <p>${fmtTeur(metrics.recurringRegulatoryEog, 1)} erster Folgejahreswert; Startjahr ${fmtTeur(metrics.yearOneRegulatoryEog, 1)} inklusive ${fmtTeur(metrics.yearOneOneOff, 1)} Einmaleffekt nur im Startjahr. Spätere Jahreswerte können abweichen.</p>
        </div>
        <div class="report-box">
          <strong>wirtschaftliche Überleitung</strong>
          <p>${fmtTeur(economicBridge, 1)} laufend; Startjahr ${fmtTeur(yearOneEconomicBridge, 1)}. Enthält modellierte OPEX-, Rückbau- und Reinvestitionsannahmen.</p>
        </div>
        <div class="report-box">
          <strong>indikative Cashflow-Basis</strong>
          <p>${fmtTeur(metrics.recurringIndicativeCashflow, 1)} laufend. Diese Basis erklärt IRR/NPV, ist aber kein garantierter Zahlungsstrom.</p>
        </div>
      </div>
    </section>

    <section class="report-section">
      <h2>EOG-Zerlegung im Report</h2>
      <p class="hint">Die Komponenten zeigen, welche Treiber den Startjahreswert und den ersten Folgejahreswert prägen. Spätere Jahreswerte können abweichen; die wirtschaftliche Überleitung bleibt getrennt von der regulatorischen EOG-Wirkung.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Sicht</th><th>AfA</th><th>Verzinsung</th><th>Reinvest-Asset</th><th>Q/E</th><th>Risiko</th><th>Einmal-OPEX</th><th>regulatorische EOG</th><th>wirtschaftliche Überleitung</th><th>indikativer Cashflow</th></tr></thead>
          <tbody>${eogDecompositionTableHtml(result)}</tbody>
        </table>
      </div>
    </section>

    <section class="report-section">
      <h2>Szenariovergleich</h2>
      <p class="hint scenario-edit-hint">Szenarioannahmen werden unter Grundlagen → Bearbeiten einblenden → Szenario und Portfolio-Wirkung gepflegt. Dort werden Basis, Konservativ und Wert-Sicht gesetzt; Maßnahmenwerte bearbeitest du weiterhin in der jeweiligen Maßnahme.</p>
      <button type="button" class="link-button" data-jump-view="basis">Szenarioannahmen bearbeiten</button>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Szenario</th><th>Attribution</th><th>Q/E + Wirkung p.a.</th><th>Jahr 1</th><th>IRR</th><th>Kapitalwert</th></tr></thead>
          <tbody>${scenarioRows}</tbody>
        </table>
      </div>
    </section>

    <section class="report-section">
      <h2>Aktive Maßnahmen</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Maßnahme</th><th>Jahr</th><th>CAPEX</th><th>TOTEX</th><th>Ziele</th><th>aktiv.</th><th>Wirkannahmen</th><th>Reinvest-Logik</th><th>IRR</th><th>Notiz</th></tr></thead>
          <tbody>${measureRows}</tbody>
        </table>
      </div>
    </section>

    <section class="report-section">
      <h2>Beitrag zu strategischen Zielen</h2>
      <p class="hint">${strategyHint}</p>
      ${strategyBars}
      <div class="table-wrap">
        <table class="strategy-contribution-table">
          <thead><tr><th>Ziel</th><th>Investition</th><th>EOG-Wirkung Startjahr</th><th>Risikoreduktion p.a.</th><th>Maßnahmen</th></tr></thead>
          <tbody>${strategyRows}</tbody>
        </table>
      </div>
    </section>

    ${sidecarReportSummaryHtml()}

    ${systemIntegrationReportHtml(result)}

    <section class="report-section">
      <h2>Regulatorische Wirkannahmen</h2>
      <p class="hint">Diese Datenpunkte holen VNB-spezifisches Wissen ab. Sie fließen je nach Vertrauen und Governance-Status in Basis-, konservatives oder Wert-Szenario ein.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Maßnahme</th><th>Bereich</th><th>Wirkung</th><th>Wert p.a.</th><th>Vertrauen</th><th>Einfluss</th><th>Datenbasis</th></tr></thead>
          <tbody>${impactRows}</tbody>
        </table>
      </div>
    </section>

    <section class="report-section">
      <h2>Prüfpflichtige Annahmen dieses Modells</h2>
      ${reviewHtml}
    </section>

    <section class="report-section">
      <h2>Klärpunkte und Prozessstand</h2>
      <p class="hint">Ein finaler Entscheidungsreport sollte offene Blocker schließen oder als Restunsicherheit zeichnen.</p>
      ${phaseStepperHtml()}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Priorität</th><th>Treiber</th><th>Maßnahme</th><th>Klärpunkt</th><th>Bereich</th><th>Zielphase</th><th>Status</th></tr></thead>
          <tbody>${clarificationRows}</tbody>
        </table>
      </div>
    </section>

    <section class="report-section">
      <h2>Snapshots</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Marke</th><th>Autor</th><th>Zeitpunkt</th><th>Phase</th></tr></thead>
          <tbody>${snapshotRows}</tbody>
        </table>
      </div>
    </section>

    <section class="report-section">
      <details>
        <summary>Event-Journal für Audit-Sicht</summary>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Zeit</th><th>Autor</th><th>Ereignis</th><th>Feld</th><th>Alt → Neu</th></tr></thead>
            <tbody>${eventJournalRows()}</tbody>
          </table>
        </div>
      </details>
    </section>

    <section class="report-section">
      <h2>Offene Punkte aus Maßnahmennotizen</h2>
      <div class="note-list">${notesHtml}</div>
    </section>

    <section class="report-section">
      <details>
        <summary>Konformitätsübersicht für Audit-/Expertensicht</summary>
        <p class="hint">Die Anwendung ersetzt kein Managementsystem. Sie liefert ein dokumentiertes Entscheidungsartefakt innerhalb des Asset-Management-Systems.</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Anforderung vereinfacht</th><th>App-Funktion</th><th>Nachweis im Modell</th></tr></thead>
            <tbody>${complianceOverviewRows(result)}</tbody>
          </table>
        </div>
      </details>
    </section>
  `;
}

function renderPortfolio() {
  const result = currentPortfolio(currentScenarioParams(scenario));
  const conservativeResult = currentPortfolio(currentScenarioParams('konservativ'));
  const metrics = portfolioDecisionMetrics(result, conservativeResult);
  const first = result.yearly[0] || { eog: 0, regulatoryEogEffect: 0, indicativeCashflow: 0, firstYearOpex: 0 };
  const activatedShare = result.invest > 0 ? result.activated / result.invest * 100 : 0;
  const spread = Number.isFinite(result.irr) ? result.irr - result.p.financingRate : NaN;

  document.getElementById('kpiInvest').textContent = fmtTeur(result.invest);
  document.getElementById('kpiInvestSub').textContent = result.activeMeasures.length + ' aktive Maßnahmen · TOTEX ' + fmtTeur(result.totex.nominal, 1);
  document.getElementById('kpiActivated').textContent = fmtTeur(result.activated);
  document.getElementById('kpiActivatedSub').textContent = fmtPct(activatedShare, 1) + ' der Investitionen';
  document.getElementById('kpiEog').textContent = fmtTeur(metrics.recurringRegulatoryEog, 1);
  document.getElementById('kpiEogSub').textContent = 'erster Folgejahreswert; Startjahr ' + fmtTeur(metrics.yearOneRegulatoryEog, 1) + ', Einmaleffekt im Startjahr ' + fmtTeur(metrics.yearOneOneOff, 1);
  document.getElementById('kpiIrr').textContent = Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-';
  document.getElementById('kpiIrrSub').textContent = 'indikativ, kein garantierter EOG-Cashflow';
  document.getElementById('kpiNpv').textContent = fmtTeur(result.npv, 1);
  document.getElementById('kpiNpvSub').textContent = 'konservativ ' + (metrics.conservative ? fmtTeur(metrics.conservative.npv, 1) : '-');
  const tariff = tariffImpactLine(result.tariffImpact);
  document.getElementById('kpiTariff').textContent = tariff.value;
  document.getElementById('kpiTariffSub').textContent = tariff.sub;
  document.getElementById('kpiEbit').textContent = fmtTeur(first.ebit || 0, 1);
  document.getElementById('kpiEbitSub').textContent = 'bis Jahr 5 kumuliert ' + fmtTeur(result.yearly.slice(0, 5).reduce((sum, row) => sum + (row.ebit || 0), 0), 1);
  document.getElementById('kpiPortfolioEffect').textContent = fmtTeur(result.qePa + result.impactPa, 1);
  document.getElementById('kpiPortfolioSub').textContent = 'davon Risiko ' + fmtTeur(result.riskPa, 1) + ' p.a.';
  document.getElementById('kpiTotalEog').textContent = fmtTeur(result.p.baseEog + first.regulatoryEogEffect, 1);
  document.getElementById('kpiSpread').textContent = Number.isFinite(spread) ? fmtPct(spread * 100, 1) : '-';

	      const decision = decisionFor(result, conservativeResult);
	      renderStickyKpis(result, first, decision, metrics);
	      renderManagementSummary(result, first, spread, decision, metrics);
	      renderEogCashflowBridge(result, metrics);
      renderWorkstandReliability(result);
      renderPortfolioWaterfall(result);
      renderSensitivityTornado();
      renderEogDecomposition(result);
	      renderMeetingFocus(result, first, spread, metrics);
      renderAkteCockpit(result, first, decision, metrics);
      renderPresentation(result, first, decision, metrics);

  renderChart(result.yearly);
  renderYears(result);
  renderScenarios();
  renderReport(result, first, spread, decision, metrics);
}

function syncSectorDefaults() {
  const isGas = el.sector.value === 'gas';
  const period = regulatoryPeriodFor(el.sector.value, num('baseYear'));
  document.getElementById('sectorHint').textContent = isGas
    ? `Gas: ${periodDetailText(period)}. KANU-Szenarien und Q-Element sind prüfpflichtige Annahmen.`
    : `Strom: ${periodDetailText(period)}. Q-Element ist regulatorisch naheliegender; KANU wird für Strom nicht angewendet.`;
  document.getElementById('periodName').textContent = period.label;
  document.getElementById('periodYears').textContent = period.start + '-' + period.end;
  document.getElementById('periodBaseYear').textContent = 'Kostenbasis ' + period.costBaseYear;
  if (!isGas) {
    measures = measures.map(measure => ({ ...measure, depr: 'normal' }));
  }
}

function renderAll(persist = true) {
  syncSectorDefaults();
  syncCommitteeFields();
  renderGlobalValidation();
  renderScenarioDiff();
  renderStressTestWorkbench();
  renderBasisSummaryCards();
  renderStrategyEditor();
  renderMeasures();
  renderExpertWorkList();
  renderDetail();
  renderPortfolio();
  renderProcessUx();
  renderProjectPlan();
  renderSidecar();
  renderChangeSinceSeen();
  renderMaturityAndClarifications();
  renderReportMode();
  renderReleaseAwareness();
  updateActionLabels();
  updateFlowStatus();
  applyReadonlyMode();
  if (persist) saveToBrowser(true);
}

function updateSelectedFromDetail() {
  const measure = selectedMeasure();
  if (!measure) return;
	Object.assign(measure, {
	        name: el.mName.value,
	        externalId: el.mExternalId.value.trim(),
	        orgUnit: el.mOrgUnit.value.trim(),
	        monitoringProfile: el.mMonitoringProfile.value,
	        monitoringCategory: el.mMonitoringCategory.value.trim(),
	        networkLevel: el.mNetworkLevel.value.trim(),
	        reportingRegion: el.mReportingRegion.value.trim(),
	        reportingStatus: el.mReportingStatus.value.trim(),
	        capacityImpact: el.mCapacityImpact.value.trim(),
	        bottleneckRef: el.mBottleneckRef.value.trim(),
	        permitRequired: el.mPermitRequired.value,
	        permitStatus: el.mPermitStatus.value.trim(),
	        investmentDecisionStatus: el.mInvestmentDecisionStatus.value,
	        investmentDecisionDate: el.mInvestmentDecisionDate.value,
	        alternativesChecked: el.mAlternativesChecked.value.trim(),
	        flexibilityNeed: el.mFlexibilityNeed.value.trim(),
	        sourceSystem: el.mSourceSystem.value.trim(),
	        sourceRecordId: el.mSourceRecordId.value.trim(),
	        scoringRef: el.mScoringRef.value.trim(),
	        assetSystemRef: el.mAssetSystemRef.value.trim(),
	        erpRef: el.mErpRef.value.trim(),
	        riskDbRef: el.mRiskDbRef.value.trim(),
	        sourceStatus: el.mSourceStatus.value,
	        riskEvidenceStatus: el.mRiskEvidenceStatus.value,
	        riskOwnerRole: el.mRiskOwnerRole.value.trim(),
	        riskAssessmentStatus: el.mRiskAssessmentStatus.value.trim(),
	        effectType: el.mEffectType.value === 'flexibility' ? 'flexibility' : 'classic',
        flexibilityUseCase: el.mFlexibilityUseCase.value,
        flexibilityStatus: el.mFlexibilityStatus.value,
        regulatoryTreatment: el.mRegulatoryTreatment.value,
        networkScheduleRequired: el.mNetworkScheduleRequired.checked,
        networkScheduleStatus: el.mNetworkScheduleStatus.value,
        networkConstraintRef: el.mNetworkConstraintRef.value.trim(),
        affectedNetworkLevel: el.mAffectedNetworkLevel.value,
        activationWindow: el.mActivationWindow.value.trim(),
        dispatchLogic: el.mDispatchLogic.value.trim(),
        avoidedCapexTeur: num('mAvoidedCapexTeur'),
        avoidedCapexConfidence: el.mAvoidedCapexConfidence.value,
        deferredCapexTeur: num('mDeferredCapexTeur'),
        deferredCapexFromYear: el.mDeferredCapexFromYear.value === '' ? '' : Math.round(num('mDeferredCapexFromYear')),
        deferredCapexToYear: el.mDeferredCapexToYear.value === '' ? '' : Math.round(num('mDeferredCapexToYear')),
        capexAvoidanceEvidenceRef: el.mCapexAvoidanceEvidenceRef.value.trim(),
        flexOpexPaTeur: num('mFlexOpexPaTeur'),
        flexOpexStartYear: el.mFlexOpexStartYear.value === '' ? '' : Math.round(num('mFlexOpexStartYear')),
        flexOpexDurationYears: Math.max(0, Math.round(num('mFlexOpexDurationYears'))),
        opexRecognitionStatus: el.mOpexRecognitionStatus.value,
        opexEvidenceRef: el.mOpexEvidenceRef.value.trim(),
        agnesRelevant: el.mAgnesRelevant.checked,
        agnesRole: el.mAgnesRole.value,
        agnesIntegrationStatus: el.mAgnesIntegrationStatus.value,
        agnesDataNeeded: parseTags(el.mAgnesDataNeeded.value),
	        tags: parseTags(el.mTags.value),
	        type: el.mType.value,
	        cost: num('mCost'),
	        year: Math.round(num('mYear')),
	        secure: num('mSecure'),
	        uncertain: num('mUncertain'),
	        probability: num('mProbability'),
	        opexRecognition: num('mOpexRecognition'),
	        life: Math.round(num('mLife')),
	        depr: el.mDepr.value,
	        qDirect: num('mQDirect'),
	        eDirect: num('mEDirect'),
	        riskAvoided: num('mRiskAvoided'),
	        portfolioShare: num('mPortfolioShare'),
	        opexPa: num('mOpexPa'),
	        opexDeltaPa: num('mOpexDeltaPa'),
	        reinvestCost: num('mReinvestCost'),
        reinvestMode: el.mReinvestMode.value === 'assetAddition' ? 'assetAddition' : 'oneOff',
        reinvestLife: Math.max(1, Math.round(num('mReinvestLife') || num('mLife'))),
	        decommissionCost: num('mDecommissionCost'),
	        hgbLife: Math.max(1, Math.round(num('mHgbLife') || num('mLife'))),
	        decommissionYear: el.mDecommissionYear.value === '' ? '' : Math.round(num('mDecommissionYear')),
        gasTransformationPath: el.mGasTransformationPath.value,
        gasAssetScope: el.mGasAssetScope.value,
        gasObligationBasis: el.mGasObligationBasis.value,
        gasEternityAssumption: el.mGasEternityAssumption.value,
        gasProvisionAssessment: el.mGasProvisionAssessment.value,
        gasRegulatoryTreatment: el.mGasRegulatoryTreatment.value,
        gasTransformationEvidence: el.mGasTransformationEvidence.value.trim(),
	        note: el.mNote.value
  });
  renderAll();
}

function updateStrategyReference(event) {
  strategy = { ...strategy, sampReference: event.target.value };
  renderAll();
}

function updateObjective(event) {
  const id = event.target.dataset.objectiveId;
  const field = event.target.dataset.objectiveField;
  if (!id || !field) return;
  strategy = {
    ...strategy,
    objectives: strategy.objectives.map(objective => objective.id === id
      ? { ...objective, [field]: event.target.value }
      : objective)
  };
  renderAll();
}

function addObjective() {
  const id = 'obj_' + Date.now().toString(36);
  strategy = {
    ...strategy,
    objectives: [...strategy.objectives, { id, label: 'Neues Ziel', note: '' }]
  };
  renderAll();
}

function removeObjective(id) {
  if (strategy.objectives.length <= 1) return;
  strategy = {
    ...strategy,
    objectives: strategy.objectives.filter(objective => objective.id !== id)
  };
  measures = measures.map(measure => ({
    ...measure,
    objectiveIds: (measure.objectiveIds || []).filter(objectiveId => objectiveId !== id)
  }));
  renderAll();
}

function toggleMeasureObjective(event) {
  const measure = selectedMeasure();
  if (!measure) return;
  const id = event.target.dataset.objectiveId;
  if (!id) return;
  const ids = new Set(measure.objectiveIds || []);
  if (event.target.checked) ids.add(id);
  else ids.delete(id);
  measure.objectiveIds = [...ids];
  renderAll();
}

inputIds.forEach(id => el[id].addEventListener('input', renderAll));
el.sector.addEventListener('change', renderAll);
detailIds.forEach(id => el[id].addEventListener('input', updateSelectedFromDetail));
el.mType.addEventListener('change', updateSelectedFromDetail);
el.mDepr.addEventListener('change', updateSelectedFromDetail);
el.mReinvestMode.addEventListener('change', updateSelectedFromDetail);
document.getElementById('strategySampReference').addEventListener('input', updateStrategyReference);
document.getElementById('strategyObjectives').addEventListener('input', updateObjective);
document.getElementById('strategyObjectives').addEventListener('click', event => {
  const button = event.target.closest('[data-action="removeObjective"]');
  if (button) removeObjective(button.dataset.objectiveId);
});
document.getElementById('addObjective').addEventListener('click', addObjective);
document.getElementById('measureObjectives').addEventListener('change', toggleMeasureObjective);
document.getElementById('resetProjectPlan').addEventListener('click', resetProjectPlan);
document.getElementById('projectPlanBody').addEventListener('change', event => {
  const statusId = event.target.dataset.projectStatus;
  if (statusId) updateProjectTask(statusId, { status: event.target.value });
  const ownerId = event.target.dataset.projectOwner;
  if (ownerId) updateProjectTask(ownerId, { ownerRole: event.target.value });
  const fieldId = event.target.dataset.projectField;
  if (fieldId) {
    const fieldName = event.target.dataset.projectFieldName;
    const value = fieldName === 'dueOffsetDays' ? Number(event.target.value) : event.target.value || null;
    updateProjectTask(fieldId, { [fieldName]: value });
  }
});
document.getElementById('projectPlanBody').addEventListener('input', event => {
  const taskId = event.target.dataset.projectNote;
  if (taskId) updateProjectTask(taskId, { note: event.target.value }, false);
  const fieldId = event.target.dataset.projectField;
  const fieldName = event.target.dataset.projectFieldName;
  if (fieldId && ['title', 'resultArtifact', 'origin'].includes(fieldName)) updateProjectTask(fieldId, { [fieldName]: event.target.value }, false);
});
document.getElementById('projectPlanBody').addEventListener('click', event => {
  const addButton = event.target.closest('[data-project-add]');
  if (addButton) {
    const title = window.prompt('Titel der eigenen Aufgabe');
    if (title?.trim()) {
      projectPlan = addUserProjectPlanTask(projectPlan, addButton.dataset.projectAdd, { title: title.trim(), origin: 'manuell ergänzt' });
      renderAll();
      setStorageStatus('Eigene Aufgabe wurde ergänzt.');
    }
    return;
  }
  const skipButton = event.target.closest('[data-project-skip]');
  if (skipButton) {
    const found = findProjectPlanTask(projectPlan, skipButton.dataset.projectSkip);
    updateProjectTask(skipButton.dataset.projectSkip, { templateSkipped: !found?.task.templateSkipped });
    return;
  }
  const deleteButton = event.target.closest('[data-project-delete]');
  if (deleteButton) {
    if (window.confirm('Eigene Aufgabe wirklich löschen?')) {
      projectPlan = deleteUserProjectPlanTask(projectPlan, deleteButton.dataset.projectDelete);
      renderAll();
      setStorageStatus('Eigene Aufgabe wurde gelöscht; Abhängigkeiten wurden bereinigt.');
    }
    return;
  }
  const button = event.target.closest('[data-project-jump]');
  if (!button) return;
  event.preventDefault();
  openProjectTask(button.dataset.projectJump);
});

document.getElementById('workstandReliabilityCards')?.addEventListener('click', event => {
  const button = event.target.closest('[data-workstand-action]');
  if (!button || button.disabled) return;
  openReliabilityWorkItem(button.dataset.workstandAction);
});
document.getElementById('addSidecarObject')?.addEventListener('click', addSidecarObject);
document.getElementById('sidecarDivisionFilter')?.addEventListener('change', event => {
  sidecarFilterDivision = event.target.value;
  renderSidecar();
});
document.getElementById('sidecarModeFilter')?.addEventListener('change', event => {
  sidecarModeFilter = event.target.value;
  renderSidecar();
});
document.getElementById('sidecarSummaryCards')?.addEventListener('click', event => {
  const button = event.target.closest('[data-sidecar-summary-filter]');
  if (!button) return;
  sidecarModeFilter = button.dataset.sidecarSummaryFilter;
  const modeFilter = document.getElementById('sidecarModeFilter');
  if (modeFilter) modeFilter.value = sidecarModeFilter;
  renderSidecar();
  document.getElementById('sidecarBody')?.focus?.();
});
document.getElementById('sidecarBody')?.addEventListener('focusin', event => {
  const id = event.target.dataset.sidecarId || event.target.closest('[data-sidecar-card]')?.dataset.sidecarCard;
  if (id) selectedSidecarId = id;
});
document.getElementById('sidecarBody')?.addEventListener('input', event => {
  const field = event.target.dataset.sidecarField;
  const id = event.target.dataset.sidecarId;
  if (!field || !id) return;
  const value = ['linkedMeasures', 'linkedScenarios', 'sourceRefs'].includes(field)
    ? parseTags(event.target.value)
    : field === 'openQuestions' || field === 'bridgeLogic.openQuestions' || field === 'bridgeLogic.sourceRefs' || field === 'bridgeLogic.assumptions'
      ? String(event.target.value || '').split(';').map(item => item.trim()).filter(Boolean)
      : field === 'bridgeLogic.amount'
        ? event.target.value
      : event.target.value;
  if (field.startsWith('bridgeLogic.')) {
    const object = sidecar.objects.find(item => item.id === id);
    updateSidecarObject(id, { bridgeLogic: { ...(object?.bridgeLogic || {}), [field.split('.')[1]]: value } }, false);
    return;
  }
  updateSidecarObject(id, { [field]: value }, false);
});
document.getElementById('sidecarBody')?.addEventListener('change', event => {
  const field = event.target.dataset.sidecarField;
  const id = event.target.dataset.sidecarId;
  if (!field || !id) return;
  if (field.startsWith('bridgeLogic.')) {
    const object = sidecar.objects.find(item => item.id === id);
    updateSidecarObject(id, { bridgeLogic: { ...(object?.bridgeLogic || {}), [field.split('.')[1]]: event.target.value } });
    return;
  }
  updateSidecarObject(id, { [field]: event.target.value });
});
enhanceHelpLabels();
loadRole();
applyRole(currentRole, false);
loadExpertMode();
setExpertMode(expertMode, false);

document.addEventListener('keydown', event => {
  const jump = event.target.closest?.('[data-jump-view][role="button"]');
  if (!jump || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  document.body.classList.remove('show-start');
  setView(jump.dataset.jumpView);
  renderAll();
});

document.addEventListener('click', event => {
  const jump = event.target.closest('[data-jump-view]');
  if (!jump) return;
  document.body.classList.remove('show-start');
  setView(jump.dataset.jumpView);
  renderAll();
});

document.addEventListener('click', event => {
  const target = event.target.closest('[data-clarification-jump]');
  if (!target) return;
  openClarificationAudit(target.dataset.clarificationJump);
});

document.getElementById('presentationPrev')?.addEventListener('click', () => {
  presentationSlideIndex = Math.max(0, presentationSlideIndex - 1);
  renderPortfolio();
});
document.getElementById('presentationNext')?.addEventListener('click', () => {
  presentationSlideIndex += 1;
  renderPortfolio();
});

document.querySelectorAll('.view-tab').forEach(button => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

document.querySelectorAll('[data-role-choice]').forEach(button => {
  button.addEventListener('click', () => {
    const role = button.dataset.roleChoice;
    applyRole(role);
    const profile = roleProfiles[role];
    if (profile) {
      meetingFocus = profile.focus;
      setExpertMode(profile.expert);
      document.querySelectorAll('.focus-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.focus === meetingFocus));
    }
    renderAll(!document.body.classList.contains('show-start'));
  });
});

document.getElementById('dismissProcessNotice').addEventListener('click', () => {
  document.getElementById('processNotice')?.classList.add('hidden');
});

document.getElementById('clarificationCounter')?.addEventListener('click', openClarificationList);

document.addEventListener('click', event => {
  if (!event.target.closest('.info-dot') && !event.target.closest('#fieldHelpPopover')) hideFieldHelp();
});

document.addEventListener('click', event => {
  const action = event.target.closest('[data-action="openStressParameters"]');
  if (!action) return;
  event.preventDefault();
  openStressParameters();
});

document.querySelectorAll('.scenario').forEach(button => {
  button.addEventListener('click', () => {
	        scenario = button.dataset.scenario;
	        document.querySelectorAll('.scenario').forEach(btn => btn.classList.toggle('active', btn === button));
	        renderScenarioDiff();
	        renderPortfolio();
	      });
});

document.querySelectorAll('.focus-tab').forEach(button => {
  button.addEventListener('click', () => {
    meetingFocus = button.dataset.focus;
    document.querySelectorAll('.focus-tab').forEach(btn => btn.classList.toggle('active', btn === button));
    renderPortfolio();
    saveToBrowser(true);
  });
});

document.getElementById('meetingFocusBody').addEventListener('click', event => {
  const button = event.target.closest('[data-action="editMeetingText"]');
  if (!button) return;
  openMeetingTextModal(button.dataset.focus, button.dataset.card, button.dataset.title, button.dataset.text);
});

document.getElementById('clarificationList').addEventListener('click', event => {
  const auditButton = event.target.closest('[data-action="openClarificationAudit"]');
  if (auditButton) {
    openClarificationAudit(auditButton.dataset.clarificationKey);
    return;
  }
  const measureButton = event.target.closest('[data-action="openClarificationMeasure"]');
  if (measureButton) openClarificationMeasure(measureButton.dataset.measureId, measureButton.dataset.clarificationKey || '');
});

document.getElementById('measureBody').addEventListener('click', event => {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;
  if (!action) return;
  if (action === 'toggleGroup') {
    const key = event.target.dataset.groupKey;
    collapsedCatalogGroups = { ...collapsedCatalogGroups, [key]: !(collapsedCatalogGroups[key] ?? measures.length > 30) };
    renderMeasures();
    return;
  }
  if (action === 'selectBulk') {
    if (event.target.checked) selectedCatalogIds.add(id);
    else selectedCatalogIds.delete(id);
    return;
  }
  if (!id) return;
  const measure = measures.find(item => item.id === id);
  if (!measure) return;
  if (action === 'select') {
    selectedId = id;
    renderAll();
    openMeasureEditModal();
    return;
  }
  if (isReadOnlyRole()) {
    event.target.checked = measure.active;
    return;
  }
  if (action === 'active') measure.active = event.target.checked;
  renderAll();
});

document.querySelectorAll('.year-view').forEach(button => {
  button.addEventListener('click', () => {
    resultViewMode = button.dataset.yearView === 'earnings' ? 'earnings' : 'regulatory';
    renderPortfolio();
    saveToBrowser(true);
  });
});

document.getElementById('catalogSearch').addEventListener('input', event => {
  catalogFilters = { ...catalogFilters, search: event.target.value };
  renderMeasures();
});
document.getElementById('catalogGroupBy').addEventListener('change', event => {
  catalogGroupBy = event.target.value;
  collapsedCatalogGroups = {};
  renderAll();
});
document.getElementById('catalogTypeFilter').addEventListener('change', event => {
  catalogFilters = { ...catalogFilters, type: event.target.value };
  renderMeasures();
});
document.getElementById('catalogActiveFilter').addEventListener('change', event => {
  catalogFilters = { ...catalogFilters, active: event.target.value };
  renderMeasures();
});
document.getElementById('catalogYearFrom').addEventListener('input', event => {
  catalogFilters = { ...catalogFilters, yearFrom: event.target.value };
  renderMeasures();
});
document.getElementById('catalogYearTo').addEventListener('input', event => {
  catalogFilters = { ...catalogFilters, yearTo: event.target.value };
  renderMeasures();
});
document.getElementById('catalogTagFilter').addEventListener('input', event => {
  catalogFilters = { ...catalogFilters, tag: event.target.value };
  renderMeasures();
});
document.getElementById('catalogOpenOnly').addEventListener('change', event => {
  catalogFilters = { ...catalogFilters, openOnly: event.target.checked };
  renderMeasures();
});
document.getElementById('catalogImportedOnly').addEventListener('change', event => {
  catalogFilters = { ...catalogFilters, importedOnly: event.target.checked };
  renderMeasures();
});
document.querySelectorAll('.catalog-quick').forEach(button => {
  button.addEventListener('click', () => {
    quickCatalogMode = quickCatalogMode === button.dataset.quick ? '' : button.dataset.quick;
    document.querySelectorAll('.catalog-quick').forEach(item => item.classList.toggle('active', quickCatalogMode === item.dataset.quick));
    renderMeasures();
  });
});
document.getElementById('bulkActivate').addEventListener('click', () => applyBulkAction('activate'));
document.getElementById('bulkDeactivate').addEventListener('click', () => applyBulkAction('deactivate'));
document.getElementById('bulkSetOrgUnit').addEventListener('click', () => applyBulkAction('orgUnit'));
document.getElementById('bulkAssignObjective').addEventListener('click', () => applyBulkAction('objective'));
document.getElementById('bulkAddTag').addEventListener('click', () => applyBulkAction('tag'));
document.getElementById('bulkImportMeasures').addEventListener('click', openBulkImportModal);
document.getElementById('exportCatalogCsv').addEventListener('click', exportCatalogCsv);
document.getElementById('bulkImportCancel').addEventListener('click', closeBulkImportModal);
document.getElementById('bulkImportBack').addEventListener('click', bulkImportBack);
document.getElementById('bulkImportNext').addEventListener('click', bulkImportForward);
document.getElementById('bulkImportModal').addEventListener('click', event => {
  if (event.target.id === 'bulkImportModal') closeBulkImportModal();
  if (event.target.id === 'chooseBulkImportFile') document.getElementById('bulkImportFile').click();
  if (event.target.id === 'downloadCsvTemplate') downloadCsvTemplate();
});
document.getElementById('bulkImportBody').addEventListener('input', event => {
  if (event.target.id === 'bulkImportPaste' && bulkImportState) {
    bulkImportState.rawText = event.target.value;
  }
});
document.getElementById('bulkImportBody').addEventListener('change', event => {
  if (event.target.dataset.importColumn && bulkImportState) {
    bulkImportState.mapping[Number(event.target.dataset.importColumn)] = event.target.value;
  }
});
document.getElementById('bulkImportFile').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => loadBulkImportText(String(reader.result || '')));
  reader.readAsText(file);
  event.target.value = '';
});

document.getElementById('openHelp').addEventListener('click', openHelpModal);
document.getElementById('helpClose').addEventListener('click', closeHelpModal);
document.getElementById('helpModal').addEventListener('click', event => {
  if (event.target.id === 'helpModal') closeHelpModal();
});
document.getElementById('openImprint').addEventListener('click', openImprintModal);
document.getElementById('imprintClose').addEventListener('click', closeImprintModal);
document.getElementById('imprintModal').addEventListener('click', event => {
  if (event.target.id === 'imprintModal') closeImprintModal();
});
document.getElementById('measureEditClose').addEventListener('click', closeMeasureEditModal);
document.getElementById('measureEditPrev').addEventListener('click', () => navigateMeasureInCatalog(-1));
document.getElementById('measureEditNext').addEventListener('click', () => navigateMeasureInCatalog(1));
document.getElementById('measureEditModal').addEventListener('click', event => {
  if (event.target.id === 'measureEditModal') closeMeasureEditModal();
  if (event.target.closest('#measureClarificationSaveProgress')) saveMeasureClarificationProgressFromWorkbench();
  if (event.target.closest('#measureClarificationSave')) saveMeasureClarificationFromWorkbench();
  if (event.target.closest('#measureClarificationFocusField')) focusActiveClarificationTarget();
});
document.getElementById('addImpactAssumption').addEventListener('click', addImpactAssumption);
document.getElementById('impactAssumptions').addEventListener('change', event => {
  if (isReadOnlyRole()) return;
  updateImpactAssumption(event);
});
document.getElementById('impactAssumptions').addEventListener('click', event => {
  if (isReadOnlyRole()) return;
  const button = event.target.closest('[data-action="removeImpact"]');
  if (button) {
    removeImpactAssumption(button.dataset.impactId);
    return;
  }
  const convertButton = event.target.closest('[data-action="convertRisk"]');
  if (convertButton) {
    convertRiskAssumption(convertButton.dataset.impactId);
    return;
  }
  const riskCell = event.target.closest('[data-risk-cell]');
  if (riskCell) {
    const measure = selectedMeasure();
    const impact = (measure?.impactAssumptions || []).find(item => String(item.id) === riskCell.dataset.impactId);
    if (!impact) return;
    impact.area = 'risk';
    impact.legacyFlat = false;
    impact.riskProbabilityBefore = Number(riskCell.dataset.riskProbability);
    impact.riskProbabilityAfter = Math.max(0, Math.round(impact.riskProbabilityBefore / 2 * 10) / 10);
    impact.riskImpact = Number(riskCell.dataset.riskImpact);
    impact.amount = riskExpectedValue({ ...impact, area: 'risk', legacyFlat: false });
    renderAll();
  }
});
document.getElementById('meetingTextCancel').addEventListener('click', closeMeetingTextModal);
document.getElementById('meetingTextSave').addEventListener('click', saveMeetingTextModal);
document.getElementById('meetingTextReset').addEventListener('click', resetMeetingTextModal);
document.getElementById('clarificationAuditCancel').addEventListener('click', closeClarificationAudit);
document.getElementById('clarificationAuditSave').addEventListener('click', saveClarificationAudit);
document.getElementById('clarificationAuditOpenMeasure')?.addEventListener('click', openClarificationMeasureFromAudit);
document.getElementById('clarificationAuditModal').addEventListener('click', event => {
  if (event.target.id === 'clarificationAuditModal') closeClarificationAudit();
});
document.getElementById('meetingTextModal').addEventListener('click', event => {
  if (event.target.id === 'meetingTextModal') closeMeetingTextModal();
});
document.getElementById('openBasisWizard').addEventListener('click', openBasisWizard);
document.getElementById('toggleBasisEdit').addEventListener('click', () => {
  if (isReadOnlyRole()) return;
  basisEditing = !basisEditing;
  renderAll();
});
document.getElementById('basisSummaryCards').addEventListener('click', event => {
  const button = event.target.closest('[data-action="editBasis"]');
  if (!button || isReadOnlyRole()) return;
  basisEditing = true;
  renderAll();
});
document.getElementById('expertWorkList').addEventListener('click', event => {
  const openButton = event.target.closest('[data-action="openWorkItem"]');
  if (openButton?.dataset.measureId) {
    openClarificationMeasure(openButton.dataset.measureId, openButton.dataset.clarificationKey || '');
    return;
  }
  if (openButton?.dataset.sidecarId) {
    openSidecarWorkItem(openButton.dataset.sidecarId, openButton.dataset.clarificationKey || '');
    return;
  }
  if (openButton?.dataset.clarificationKey) {
    openClarificationAudit(openButton.dataset.clarificationKey);
    return;
  }
  const clarifyButton = event.target.closest('[data-action="openClarificationAudit"]');
  if (clarifyButton) openClarificationAudit(clarifyButton.dataset.clarificationKey);
});
document.querySelectorAll('.expert-filter').forEach(button => {
  button.addEventListener('click', () => {
    expertFilter = button.dataset.expertFilter;
    document.querySelectorAll('.expert-filter').forEach(item => item.classList.toggle('active', item === button));
    renderExpertWorkList();
  });
});
committeeIds.forEach(id => {
  const syncCommitteeInput = () => {
    collectCommitteeFields();
    renderAll();
  };
  el[id].addEventListener('input', syncCommitteeInput);
  el[id].addEventListener('change', syncCommitteeInput);
});

document.querySelectorAll('.report-mode').forEach(button => {
  button.addEventListener('click', () => {
    reportMode = button.dataset.reportMode;
    collectCommitteeFields();
    renderAll();
  });
});

document.getElementById('newMeasure').addEventListener('click', openTemplateModal);
document.getElementById('blankMeasureWizard').addEventListener('click', startBlankMeasureWizard);
document.getElementById('templateCancel').addEventListener('click', closeTemplateModal);
document.getElementById('templateModal').addEventListener('click', event => {
  if (event.target.id === 'templateModal') closeTemplateModal();
});
document.getElementById('templateGallery').addEventListener('click', event => {
  const card = event.target.closest('[data-template-id]');
  if (card) addMeasureFromTemplate(card.dataset.templateId);
});
document.getElementById('exportModel').addEventListener('click', exportModel);
document.getElementById('exportSelfContainedHtml').addEventListener('click', exportSelfContainedHtml);
document.getElementById('exportSpreadsheetXlsx').addEventListener('click', exportSpreadsheetXlsx);
document.getElementById('exportSpreadsheetCsvZip').addEventListener('click', exportSpreadsheetCsvZip);
document.getElementById('expertModeToggle').addEventListener('change', event => {
  setExpertMode(event.target.checked);
});
document.getElementById('startDemo').addEventListener('click', () => applyDemoModel({ confirmOverwrite: true, targetView: 'akte' }));
document.getElementById('startWizard').addEventListener('click', () => {
  hideStartScreen();
  setView(roleProfiles[currentRole]?.view || 'basis');
  renderAll();
  if (currentRole === 'owner') openBasisWizard();
});
document.getElementById('startImport').addEventListener('click', () => {
  document.getElementById('importFile').click();
});
document.getElementById('printReport').addEventListener('click', () => {
  setView('report');
  renderPortfolio();
  window.print();
});
document.getElementById('printReportFromView').addEventListener('click', () => {
  renderPortfolio();
  window.print();
});
document.getElementById('importModel').addEventListener('click', openLoadModal);
document.getElementById('loadDemoModel').addEventListener('click', () => applyDemoModel({ confirmOverwrite: true, targetView: 'akte' }));
document.getElementById('checkReleaseAwareness').addEventListener('click', checkReleaseAwareness);
document.getElementById('openAiPromptGenerator').addEventListener('click', openAiPromptGenerator);
document.getElementById('openSupportIssue').addEventListener('click', openSupportIssue);
document.getElementById('exportSupportPackage').addEventListener('click', exportSupportPackage);
document.getElementById('aiPromptClose').addEventListener('click', closeAiPromptGenerator);
document.getElementById('copyAiPrompt').addEventListener('click', copyAiPrompt);
document.getElementById('downloadAiPrompt').addEventListener('click', downloadAiPrompt);
['aiPromptRole', 'aiPromptDataScope', 'aiPromptDetailLevel', 'aiPromptLanguage', 'aiPromptRoundAmounts', 'aiPromptAnonymizeMeasures', 'aiPromptOmitNotes', 'aiPromptIncludeProjectPlan'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', renderAiPrompt);
});
document.getElementById('aiPromptModal').addEventListener('click', event => {
  if (event.target.id === 'aiPromptModal') closeAiPromptGenerator();
});
document.getElementById('clearBrowserData').addEventListener('click', () => {
  if (window.confirm('Alle im Browser gespeicherten Daten dieses Rechners löschen? Das aktuelle Modell bleibt bis zum Neuladen sichtbar.')) {
    clearBrowserData();
  }
});
document.getElementById('loadJson').addEventListener('click', () => {
  closeLoadModal();
  document.getElementById('importFile').click();
});
document.getElementById('loadBasisWizard').addEventListener('click', () => {
  closeLoadModal();
  openBasisWizard();
});
document.getElementById('loadDemoFromModal').addEventListener('click', () => {
  closeLoadModal();
  applyDemoModel({ confirmOverwrite: true, targetView: 'akte' });
});
document.getElementById('loadCancel').addEventListener('click', closeLoadModal);
document.getElementById('loadModal').addEventListener('click', event => {
  if (event.target.id === 'loadModal') closeLoadModal();
});
document.getElementById('importFile').addEventListener('change', event => {
  importModelFile(event.target.files[0]);
  event.target.value = '';
});
document.getElementById('processPhase').addEventListener('change', event => setProcessPhase(event.target.value));
document.getElementById('phaseTargetDate').addEventListener('change', event => setPhaseTarget(event.target.value));
[
  ['planningStatusNote', 'statusNote'],
  ['planningNextStep', 'nextStep'],
  ['planningOwner', 'owner'],
  ['planningDueDate', 'dueDate']
].forEach(([id, field]) => {
  const node = document.getElementById(id);
  if (node) node.addEventListener('input', event => setPlanningResumeField(field, event.target.value));
});
document.getElementById('importApplyIncoming').addEventListener('click', applyPendingImport);
document.getElementById('importKeepLocal').addEventListener('click', keepLocalImport);
document.getElementById('importReviewClose').addEventListener('click', closeImportReview);
document.getElementById('importReviewModal').addEventListener('click', event => {
  if (event.target.id === 'importReviewModal') closeImportReview();
});
document.getElementById('toggleAllInCatalog').addEventListener('click', toggleAllMeasures);
document.getElementById('wizardCancel').addEventListener('click', closeWizard);
document.getElementById('wizardBack').addEventListener('click', wizardBack);
document.getElementById('wizardNext').addEventListener('click', wizardForward);
document.getElementById('wizardModal').addEventListener('click', event => {
  if (event.target.id === 'wizardModal') closeWizard();
});

document.getElementById('runtimeErrorClose').addEventListener('click', closeRuntimeError);
document.getElementById('runtimeErrorModal').addEventListener('click', event => {
  if (event.target.id === 'runtimeErrorModal') closeRuntimeError();
});
window.addEventListener('error', event => {
  showRuntimeError('JavaScript-Fehler', event.error || event.message, 'Der Fehler wurde sichtbar gemacht, damit er nicht nur in der Browser-Konsole erscheint.');
});
window.addEventListener('unhandledrejection', event => {
  showRuntimeError('JavaScript-Fehler', event.reason, 'Eine asynchrone Aktion wurde nicht vollständig verarbeitet.');
});

document.getElementById('resetModel').addEventListener('click', () => {
  if (!window.confirm('Aktuelles Modell zurücksetzen? Gespeicherte Browserdaten werden danach mit dem leeren Modell überschrieben.')) return;
  measures = structuredClone(initialMeasures);
  selectedId = measures[0]?.id;
  scenario = 'basis';
  meetingFocus = 'management';
  processState = defaultProcessState();
  strategy = defaultStrategy();
  clarificationStatus = {};
  meetingTextOverrides = {};
  document.querySelectorAll('.scenario').forEach(btn => btn.classList.toggle('active', btn.dataset.scenario === 'basis'));
  document.querySelectorAll('.focus-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.focus === meetingFocus));
  renderAll();
  setStorageStatus('Modell wurde zurückgesetzt und im Browser gespeichert.');
});

document.querySelectorAll('.action-menu-list button').forEach(button => {
  button.addEventListener('click', () => {
    const menu = button.closest('.action-menu');
    if (menu) menu.removeAttribute('open');
  });
});

if (!loadEmbeddedModelState() && !loadFromBrowser()) {
  setView(activeView);
  renderAll(false);
  previousModelForHistory = currentModelData();
  showStartScreen();
}
applyStoryDeepLink();
