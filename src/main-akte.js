// Zweite, eigenständige Oberfläche ("digitale Akte") für dasselbe Modell-JSON
// und denselben Rechenkern wie src/ui.js — siehe UX_AKTE_REDESIGN-Spezifikation.
// Stufe 4 lieferte das Layout-Gerüst mit vollständiger Satzdarstellung für
// Maßnahmen. Stufe 5 macht alle übrigen fachlichen Objekte (Rahmen, Szenario,
// Ziel, Kontext, Quelle, Klärpunkt) zu Objekten derselben Liste, bearbeitbar
// in derselben Detailfläche (Kriterium 6), und macht jede Lücke über einen
// Filter erreichbar (Kriterium 9).
//
// Eigenständiger Zustand: main-akte.js teilt keinen Modulzustand mit ui.js.
// Es schreibt UI-Zustand ausschließlich unter model.ui2 (Spezifikation 7.2)
// und benutzt einen eigenen localStorage-Schlüssel (Spezifikation 7.3), damit
// beide Oberflächen im selben Browserprofil kollisionsfrei koexistieren.
import {
  calcMeasure,
  calcPortfolio,
  measureDrilldownFor,
  params as engineParams,
  portfolioDecisionMetrics,
  portfolioEffectFor,
  regulatoryParameterSet,
  scenarioParams as engineScenarioParams,
  workstandReliabilityFor,
  activationSplitHelper,
  riskHelper,
  qImpactHelper,
  depreciationLifeHelper,
  financingSpreadHelper,
  gasTransformationHelper,
  flexibilityHelper
} from './engine.js';
import { clarificationItems } from './clarifications.js';
import { maturityScore } from './maturity.js';
import { contributionBarsModel, eogFlowModel, linearScale, measureMicroFlowModel, riskMatrixModel, tornadoModel, viabilitySegmentsModel, waterfallModel } from './chart-model.js';
import { defaultCommittee, defaultProcessState, defaultStrategy, normalizeMeasure, normalizeProcessState } from './model-normalize.js';
import { fieldDescriptorsFor } from './field-registry.js';
import { evidenceGaps, missingValueFields, referenceFieldsFor, suggestedEdges, valueState } from './value-state.js';
import { esc, fmtPct, fmtPlain, fmtTeur } from './render-utils.js';
import { normalizeSidecar, normalizeSidecarObject, normalizeSidecarSource } from './sidecar.js';
import { demoMeasures, demoSidecar } from './demo-data.js';
import { appendHistoryEvents, diffModelEvents, emptyHistory, eventSummary } from './history.js';
import { inputDefaults, inputIds, processPhases } from './ui-config.js';
import { buildInfo } from './build-info.js';
import { downloadBlob, exportStamp, htmlWithEmbeddedModelState, stripForeignScripts } from './export-utils.js';
import { spreadsheetTables, tablesToCsvZip, tablesToXlsx } from './spreadsheet-export.js';
import { buildAiPrompt, defaultAiPromptOptions, promptRoles } from './ai-prompt-generator.js';
import { rulesetInfo, supportContext, supportPackage } from './release-awareness.js';
import { viabilityOverviewFor } from './viability-classification.js';

const storageKey = 'regulierte-sparten-szenario-rechner-akte-v1';
const modelVersion = 8;
const appVersion = '0.4.0';

const helperFunctions = {
  activationSplitHelper,
  riskHelper,
  qImpactHelper,
  depreciationLifeHelper,
  financingSpreadHelper,
  gasTransformationHelper,
  flexibilityHelper
};

// ---------------------------------------------------------------------------
// Modellzustand (eigenständig, kein geteilter Zustand mit ui.js)
// ---------------------------------------------------------------------------

let model = null;
let history = emptyHistory();
let selectedType = 'measure';
let selectedId = '';
let filterKey = 'all';
let searchText = '';
let previousModelForHistory = null;
let previousKpis = null;
let author = 'Akte';
// Diagramm-Zustand je Filter (Abschnitt 4.2/7.3 der Visualisierungs-
// Spezifikation): ob das Diagramm ein-/ausgeklappt bzw. als Tabelle gezeigt
// wird, gilt pro Filter, nicht global.
let chartCollapsed = {};
let chartAsTable = {};
// Jahresmarkierung (Abschnitt 7.2): der einzige zusätzliche Interaktions-
// zustand für Elemente ohne Objektbezug (Jahressäulen im Verlaufsdiagramm).
// Bewusst nicht in model.ui2 persistiert — anders als chartCollapsed/
// chartAsTable ist das nur eine Anzeige, kein Modellzustand.
let chartYearMarker = null;

// Rahmen/Szenario sind vier feste Pseudo-Objekte über model.inputs (siehe
// Spezifikation 4.4) statt eigener Modellobjekte — dieselben 31 Felder aus
// field-registry.js 'input', nur nach .group aufgeteilt dargestellt.
const inputPseudoObjects = [
  { id: 'rahmen-sparte', group: 'rahmenSparte', title: 'Rahmen: Sparte', badge: 'Rahmen' },
  { id: 'rahmen-kapitalkosten', group: 'rahmenKapitalkosten', title: 'Rahmen: Kapitalkosten', badge: 'Rahmen' },
  { id: 'szenario-basis', group: 'szenarioBasis', title: 'Szenario: Basis', badge: 'Szenario' },
  { id: 'szenario-konservativ', group: 'szenarioKonservativ', title: 'Szenario: Konservativ', badge: 'Szenario' }
];
// Value-state/history/openDecisions behandeln alle Inputfelder als ein
// Objekt (subject.scope === 'inputs'), unabhängig von der Pseudo-Gruppe.
const inputsObjectId = 'inputs';

function skeletonInputs() {
  const base = {
    sector: 'gas',
    regulationProcedure: 'standard',
    baseYear: new Date().getFullYear() + 1,
    baseEog: 0,
    rab: 0,
    returnRate: 5,
    financingRate: 5,
    annualEnergyGwh: '',
    householdConsumptionKwh: '',
    horizon: 20,
    discountRate: 5,
    kanuEndYear: new Date().getFullYear() + 19,
    degressiveRate: 10,
    taxFactor: 0,
    portfolioAttribution: 25,
    capexLagYears: 0,
    opexLagYears: 3,
    qeLagYears: 2,
    qDelta: 0,
    eDelta: 0
  };
  const inputs = {};
  inputIds.forEach(id => {
    inputs[id] = Object.hasOwn(base, id) ? base[id] : Object.hasOwn(inputDefaults, id) ? inputDefaults[id] : '';
  });
  return inputs;
}

function emptyProvisionalIds() {
  return { measure: [], objective: [], sidecarObject: [], sidecarSource: [] };
}

// Skelett statt Leere (Spezifikation 6.5): ein neues Modell startet mit den
// Standard-Zielen und Rahmen-Vorbelegungen der gewählten Sparte, aber ohne
// Maßnahmen — das eigene, noch unbeschriebene Blatt. Das unterscheidet sich
// bewusst von den Demodaten (ein fremdes Beispiel); beide bleiben über die
// Kopfzeile erreichbar.
function emptySkeletonModel() {
  return {
    inputs: skeletonInputs(),
    measures: [],
    sidecar: normalizeSidecar(),
    strategy: defaultStrategy(),
    committee: defaultCommittee(),
    process: defaultProcessState(),
    clarificationStatus: {},
    openDecisions: {},
    provisionalIds: emptyProvisionalIds()
  };
}

function demoModel() {
  const measures = demoMeasures.map((measure, index) => normalizeMeasure(measure, index, {}));
  return {
    inputs: skeletonInputs(),
    measures,
    sidecar: normalizeSidecar(demoSidecar),
    strategy: defaultStrategy(),
    committee: defaultCommittee(),
    process: defaultProcessState(),
    clarificationStatus: {},
    openDecisions: {},
    provisionalIds: emptyProvisionalIds()
  };
}

// Verlustfreier Datenvertrag (Spezifikation 7.1/7.2): main-akte.js bearbeitet
// nur einen Teil der Modellfelder (inputs/measures/sidecar/strategy/
// committee/process/clarificationStatus) plus seine eigenen additiven
// Schlüssel (openDecisions, provisionalIds, ui2). Alles andere — activeView,
// reportMode, meetingFocus, scenario, selectedId, role, projectPlan,
// activeProjectTaskId, selectedSidecarId, importMapping, catalogGroupBy,
// resultViewMode, meetingTextOverrides, model.lastReleaseCheck — liest die
// alte Oberfläche und schreibt sie; die neue liest sie nicht, interpretiert
// sie nicht, gibt sie aber beim Export unverändert durch. Dasselbe gilt für
// Envelope-Felder außerhalb von model (buildCommit, regulatoryParameterSetId
// usw.). modelPassthrough/envelopePassthrough halten genau diese Reste fest.
const managedModelKeys = new Set(['inputs', 'measures', 'sidecar', 'strategy', 'committee', 'process', 'clarificationStatus', 'openDecisions', 'provisionalIds', 'ui2']);
const managedEnvelopeKeys = new Set(['app', 'version', 'appVersion', 'savedAt', 'model', 'history']);

let modelPassthrough = {};
let envelopePassthrough = {};

function extractPassthrough(source, managedKeys) {
  const passthrough = {};
  Object.keys(source || {}).forEach(key => {
    if (!managedKeys.has(key)) passthrough[key] = source[key];
  });
  return passthrough;
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const state = JSON.parse(raw);
    return {
      model: state.model,
      history: state.history && Array.isArray(state.history.events) ? state.history : emptyHistory(),
      envelope: state
    };
  } catch (_error) {
    return null;
  }
}

function collectModelState() {
  return {
    ...envelopePassthrough,
    app: 'regulierte-sparten-szenario-rechner',
    version: modelVersion,
    appVersion,
    savedAt: new Date().toISOString(),
    model: currentModelData(),
    history
  };
}

function exportSnapshotLabel() {
  return `Stand wie versendet · ${new Date().toLocaleString('de-DE')} · ${author}`;
}

// Wie ui.js: JSON- und HTML-Exporte hinterlassen ein history-Ereignis und
// einen Snapshot, damit spätere Vergleiche einen Bezugspunkt haben.
function createExportSnapshot() {
  const timestamp = new Date().toISOString();
  history = appendHistoryEvents(history, [{
    type: 'modelExported',
    subject: { scope: 'model' },
    field: 'export',
    oldValue: null,
    newValue: timestamp,
    note: 'Snapshot beim Export erzeugt.'
  }], author);
  history.snapshots = [...(history.snapshots || []), {
    id: 'snap_export_' + Date.now().toString(36),
    eventId: history.headId,
    label: exportSnapshotLabel(),
    author,
    timestamp,
    phase: model.process.phase
  }];
  previousModelForHistory = currentModelData();
}

function refreshBuildMeta() {
  const commitNode = document.querySelector('meta[name="build-commit"]');
  const timeNode = document.querySelector('meta[name="build-time"]');
  if (commitNode) commitNode.setAttribute('content', buildInfo.buildCommit);
  if (timeNode) timeNode.setAttribute('content', buildInfo.buildTime);
}

// "HTML mit Daten speichern" (Terminologie wie ui.js, Abschnitt 8): erzeugt
// eine eigenständige, offline lauffähige Kopie dieser Oberfläche inklusive
// des aktuellen Datenstands, ohne jede Netzwerkfunktion.
function exportSelfContainedHtml() {
  createExportSnapshot();
  refreshBuildMeta();
  const state = collectModelState();
  const html = '<!DOCTYPE html>\n' + htmlWithEmbeddedModelState(stripForeignScripts(document.documentElement.outerHTML), state);
  const blob = new Blob([html], { type: 'text/html' });
  downloadBlob(blob, 'digitale-akte-mit-daten-' + exportStamp(state) + '.html');
  showToast('HTML-Datei mit eingebettetem Datenstand wurde zum Download vorbereitet.');
}

function saveToStorage(silent = true) {
  try {
    const currentModel = currentModelData();
    if (previousModelForHistory) {
      // diffModelEvents deckt inputs/measures/impactAssumptions/strategy
      // (Ziele) feldweise bzw. objektweise ab. sidecar wird bislang nicht
      // diff't (siehe src/value-state.js) — Kontextobjekt-/Quellenänderungen
      // bleiben daher ohne history-Signal, value-state.js fällt dafür schon
      // sauber auf den Vorbelegungsvergleich zurück.
      const drafts = diffModelEvents(previousModelForHistory, currentModel);
      if (drafts.length) {
        history = appendHistoryEvents(history, drafts, author);
      }
    }
    previousModelForHistory = structuredClone(currentModel);
    localStorage.setItem(storageKey, JSON.stringify(collectModelState()));
    if (!silent) showToast('Im Browser gespeichert (eigener Akte-Speicherstand).');
  } catch (_error) {
    if (!silent) showToast('Speichern nicht möglich.');
  }
}

function currentModelData() {
  return {
    ...modelPassthrough,
    inputs: structuredClone(model.inputs),
    measures: structuredClone(model.measures),
    sidecar: structuredClone(model.sidecar),
    strategy: structuredClone(model.strategy),
    committee: structuredClone(model.committee),
    process: structuredClone(model.process),
    clarificationStatus: structuredClone(model.clarificationStatus),
    openDecisions: structuredClone(model.openDecisions),
    provisionalIds: structuredClone(model.provisionalIds || emptyProvisionalIds()),
    ui2: { filterKey, selectedType, selectedId, chartCollapsed, chartAsTable }
  };
}

function modelFromStoredData(storedModel) {
  modelPassthrough = extractPassthrough(storedModel, managedModelKeys);
  return {
    inputs: storedModel.inputs || skeletonInputs(),
    measures: (storedModel.measures || []).map((measure, index) => normalizeMeasure(measure, index, {})),
    sidecar: normalizeSidecar(storedModel.sidecar),
    strategy: storedModel.strategy || defaultStrategy(),
    committee: storedModel.committee || defaultCommittee(),
    process: storedModel.process || defaultProcessState(),
    clarificationStatus: storedModel.clarificationStatus || {},
    openDecisions: storedModel.openDecisions || {},
    provisionalIds: {
      ...emptyProvisionalIds(),
      ...(storedModel.provisionalIds || {})
    }
  };
}

// Übernimmt einen vollständigen Envelope-Zustand (aus Datei-Import oder aus
// einer selbstenthaltenen HTML-mit-Daten-Datei) als aktuelles Modell.
function applyIncomingState(state) {
  const incomingModel = state.model || state;
  model = modelFromStoredData(incomingModel);
  envelopePassthrough = extractPassthrough(state, managedEnvelopeKeys);
  history = state.history && Array.isArray(state.history.events) ? state.history : emptyHistory();
  selectedType = incomingModel.ui2?.selectedType || 'measure';
  selectedId = incomingModel.ui2?.selectedId || model.measures[0]?.id || '';
  filterKey = incomingModel.ui2?.filterKey || 'all';
  chartCollapsed = incomingModel.ui2?.chartCollapsed || {};
  chartAsTable = incomingModel.ui2?.chartAsTable || {};
  previousModelForHistory = currentModelData();
  previousKpis = null;
}

// Selbstenthaltene "HTML mit Daten"-Datei (siehe exportSelfContainedHtml):
// ein eingebetteter <script id="embedded-model-state"> im selben Format wie
// bei ui.js — dasselbe Exportformat funktioniert für beide Oberflächen.
function loadEmbeddedModelState() {
  const node = document.getElementById('embedded-model-state');
  if (!node?.textContent?.trim()) return false;
  try {
    applyIncomingState(JSON.parse(node.textContent));
    saveToStorage(true);
    return true;
  } catch (_error) {
    return false;
  }
}

function bootstrap() {
  if (loadEmbeddedModelState()) return;
  const stored = loadFromStorage();
  if (stored?.model) {
    model = modelFromStoredData(stored.model);
    envelopePassthrough = extractPassthrough(stored.envelope, managedEnvelopeKeys);
    history = stored.history || emptyHistory();
    filterKey = stored.model.ui2?.filterKey || 'all';
    selectedType = stored.model.ui2?.selectedType || 'measure';
    selectedId = stored.model.ui2?.selectedId || model.measures[0]?.id || '';
    chartCollapsed = stored.model.ui2?.chartCollapsed || {};
    chartAsTable = stored.model.ui2?.chartAsTable || {};
  } else {
    model = emptySkeletonModel();
    modelPassthrough = {};
    envelopePassthrough = {};
    selectedType = 'input';
    selectedId = 'rahmen-sparte';
  }
  previousModelForHistory = currentModelData();
}

// ---------------------------------------------------------------------------
// Ableitungen
// ---------------------------------------------------------------------------

function currentParams() {
  return engineParams(model.inputs);
}

function currentPortfolio() {
  return calcPortfolio({ measures: model.measures }, currentParams());
}

function currentClarifications(portfolio) {
  return clarificationItems({ measures: model.measures, sidecar: model.sidecar }, currentParams(), portfolio, model.clarificationStatus);
}

function resultsByScenario() {
  const p = currentParams();
  return Object.fromEntries(['basis', 'konservativ', 'wert'].map(name => [name, calcPortfolio({ measures: model.measures }, engineScenarioParams(p, name))]));
}

function currentMaturity(portfolio) {
  return maturityScore({ measures: model.measures, sidecar: model.sidecar }, currentParams(), portfolio, resultsByScenario(), model.clarificationStatus);
}

function measureEogAtYearIndex(measure, p, yearIndex) {
  try {
    const effect = portfolioEffectFor(measure, p);
    const result = calcMeasure(measure, p, effect);
    return result.rows?.[yearIndex]?.regulatoryEogEffect || 0;
  } catch (_error) {
    return 0;
  }
}

// Anhang A2: der Beitrag je Maßnahme zur angeklickten Kennzahl — dieselbe
// Größe, aus der die Kennzahl selbst entsteht (kpiDefinitions), nicht ein
// Näherungswert wie zuvor die Investitionssumme. kpi:irr zeigt bewusst den
// Kapitalwertbeitrag (siehe Diagrammkatalog Abschnitt 5 der
// Visualisierungs-Spezifikation): Portfolio-IRR ist nicht additiv über
// Maßnahmen, Kapitalwert ist es.
function measureKpiContribution(measure, p, kpiKey, portfolioResults) {
  if (kpiKey === 'eogYear1') return measureEogAtYearIndex(measure, p, 0);
  if (kpiKey === 'eogFollow') return measureEogAtYearIndex(measure, p, 1);
  const result = portfolioResults.find(item => item.measure.id === measure.id);
  return result?.npv || 0;
}

// Anhang A1: "aus unbelegten Annahmen" heißt hier — dieselbe Maßnahme trägt
// zur Kennzahl bei UND mindestens eines ihrer wirkungsrelevanten Felder
// (Gruppe "wirkung": qDirect/eDirect/riskAvoided/portfolioShare/
// impactAssumptions) steht noch auf Vorbelegung ODER hat eine offene
// Evidenzlücke (evidenceGaps). Der Anteil ist wertgewichtet, nicht
// stückzahlgewichtet: eine kleine unbelegte Maßnahme verzerrt die Kennzahl
// weniger als eine große.
const wirkungFieldKeys = new Set(fieldDescriptorsFor('measure').filter(descriptor => descriptor.group === 'wirkung').map(descriptor => descriptor.key));

function measureContributionIsUnreliable(measure) {
  const stateContext = { object: measure, objectId: measure.id, history, openDecisions: model.openDecisions };
  const hasDefaultWirkungField = missingValueFields('measure', measure, stateContext).some(entry => wirkungFieldKeys.has(entry.key));
  return hasDefaultWirkungField || evidenceGaps('measure', measure).length > 0;
}

// Wertgewichteter Belastbarkeitsanteil je Kennzahl (nicht der globale,
// stückzahlbasierte workstandReliabilityFor-Wert der "Belastbarkeit"-Kachel).
function kpiReliabilityShare(kpiKey, p, portfolioResults) {
  const activeMeasures = model.measures.filter(measure => measure.active);
  let total = 0;
  let unreliable = 0;
  activeMeasures.forEach(measure => {
    const value = Math.abs(measureKpiContribution(measure, p, kpiKey, portfolioResults));
    if (!value) return;
    total += value;
    if (measureContributionIsUnreliable(measure)) unreliable += value;
  });
  return total > 0 ? unreliable / total : null;
}

// ---------------------------------------------------------------------------
// KPI-Streifen (Abschnitt 4.1) — bleibt maßnahmenbezogen: Portfolio-KPIs
// entstehen aus Maßnahmen, ihr Drilldown filtert daher auf den Objekttyp
// 'measure' bzw. auf Klärpunkte (offene Punkte).
// ---------------------------------------------------------------------------

const kpiDefinitions = [
  { key: 'eogYear1', label: 'EOG Jahr 1', compute: portfolio => portfolio.yearly?.[0]?.regulatoryEogEffect, format: v => fmtTeur(v, 1) },
  { key: 'eogFollow', label: 'EOG Folgejahr', compute: portfolio => portfolio.yearly?.[1]?.regulatoryEogEffect ?? portfolio.yearly?.[0]?.regulatoryEogEffect, format: v => fmtTeur(v, 1) },
  { key: 'irr', label: 'IRR', compute: portfolio => portfolio.irr, format: v => Number.isFinite(v) ? fmtPct(v * 100, 1) : '–' },
  { key: 'npv', label: 'Kapitalwert', compute: portfolio => portfolio.npv, format: v => fmtTeur(v, 1) }
];

function renderKpiStrip(portfolio, clarifications) {
  const reliability = workstandReliabilityFor({ measures: model.measures, sidecar: model.sidecar }, portfolio);
  const openCount = clarifications.filter(item => item.status !== 'closed').length;
  const warnCount = reliability.items.filter(item => item.severity === 'warn').length;
  const reliabilityPct = reliability.items.length ? Math.round((reliability.items.length - warnCount) / reliability.items.length * 100) : 100;

  const nextKpis = {};
  kpiDefinitions.forEach(def => { nextKpis[def.key] = def.compute(portfolio); });
  const p = currentParams();

  const node = document.getElementById('akteKpiStrip');
  node.innerHTML = kpiDefinitions.map(def => {
    const value = nextKpis[def.key];
    const delta = previousKpis && Number.isFinite(previousKpis[def.key]) && Number.isFinite(value)
      ? value - previousKpis[def.key]
      : null;
    const showDelta = delta !== null && Math.abs(delta) > 0.0001;
    const deltaCls = showDelta ? (delta > 0 ? 'up' : 'down') : '';
    const deltaText = showDelta ? `${delta > 0 ? '+' : ''}${fmtPlain(delta, 1)}` : '';
    const reliabilityShare = kpiReliabilityShare(def.key, p, portfolio.results || []);
    const reliabilityHtml = reliabilityShare === null
      ? ''
      : `<span class="akte-kpi-reliability">davon ${Math.round(reliabilityShare * 100)} % aus unbelegten Annahmen</span>`;
    return `
      <button type="button" class="akte-kpi-tile" data-kpi="${esc(def.key)}" aria-label="${esc(def.label)}: auf zugrundeliegende Maßnahmen filtern">
        <span class="akte-kpi-label">${esc(def.label)}</span>
        <span class="akte-kpi-value">${esc(def.format(value))}</span>
        <span class="akte-kpi-delta ${deltaCls} ${showDelta ? 'showing' : ''}">${esc(deltaText)}</span>
        ${reliabilityHtml}
      </button>
    `;
  }).join('') + `
    <button type="button" class="akte-kpi-tile reliability ${warnCount ? '' : 'good'}" data-kpi="reliability" aria-label="Belastbarkeit des Arbeitsstands: auf offene Klärpunkte filtern">
      <span class="akte-kpi-label">Belastbarkeit</span>
      <span class="akte-kpi-value">${reliabilityPct} % belegt</span>
      <span class="akte-kpi-delta"></span>
    </button>
    <button type="button" class="akte-kpi-tile open-items ${openCount ? '' : 'zero'}" data-kpi="open" aria-label="Offene Punkte: auf offene Klärpunkte filtern">
      <span class="akte-kpi-label">Offene Punkte</span>
      <span class="akte-kpi-value">${openCount}</span>
      <span class="akte-kpi-delta"></span>
    </button>
  `;

  previousKpis = nextKpis;
}

// ---------------------------------------------------------------------------
// Objektregister (Abschnitt 4.2/4.4) — jedes fachliche Objekt in einer Liste
// (Kriterium 6): Maßnahme, Rahmen/Szenario (Pseudo-Objekte über
// model.inputs), Ziel, Kontextobjekt, Quelle, Klärpunkt.
// ---------------------------------------------------------------------------

const objectTypeLabels = {
  measure: 'Maßnahme',
  input: 'Rahmen/Szenario',
  objective: 'Ziel',
  sidecarObject: 'Kontextobjekt',
  sidecarSource: 'Quelle',
  clarification: 'Klärpunkt'
};

function resolveObject(objectType, id) {
  if (objectType === 'measure') return model.measures.find(item => item.id === id) || null;
  if (objectType === 'input') return model.inputs;
  if (objectType === 'objective') return (model.strategy.objectives || []).find(item => item.id === id) || null;
  if (objectType === 'sidecarObject') return (model.sidecar.objects || []).find(item => item.id === id) || null;
  if (objectType === 'sidecarSource') return (model.sidecar.sources || []).find(item => item.id === id) || null;
  return null;
}

function objectIdForState(objectType, id) {
  return objectType === 'input' ? inputsObjectId : id;
}

function historySubjectFor(objectType, stateObjectId) {
  if (objectType === 'measure') return { measureId: stateObjectId };
  if (objectType === 'input') return { scope: 'inputs' };
  if (objectType === 'objective') return { scope: 'strategy' };
  if (objectType === 'sidecarObject' || objectType === 'sidecarSource') return { scope: 'sidecar', sidecarId: stateObjectId };
  return null;
}

// Ein im Popover gespeicherter Wert gilt als geprüft, auch wenn er dabei
// unverändert bleibt (Beispiel: Sparte ist mit "Gas" vorbelegt, der Nutzer
// prüft das und speichert erneut "Gas") — ohne dieses Signal bliebe das Feld
// dauerhaft als "Vorbelegung, bitte prüfen" markiert, weil diffModelEvents
// nur tatsächliche Wertänderungen protokolliert (Abschnitt 6.1, Schritt 3).
function confirmFieldIfStillDefault(objectType, stateObjectId, key, value, object) {
  const subject = historySubjectFor(objectType, stateObjectId);
  if (!subject) return;
  const state = valueState(objectType, key, value, { object, objectId: stateObjectId, history, openDecisions: model.openDecisions });
  if (state.state !== 'default') return;
  history = appendHistoryEvents(history, [{
    type: 'fieldConfirmed',
    subject,
    field: key,
    oldValue: value,
    newValue: value,
    note: 'Vorbelegung im Popover geprüft und bestätigt.'
  }], author);
}

function historyEventsFor(objectType, id) {
  if (objectType === 'measure') return history.events.filter(event => event.subject?.measureId === id && !event.subject?.impactId);
  if (objectType === 'input') return history.events.filter(event => event.subject?.scope === 'inputs');
  if (objectType === 'objective') return history.events.filter(event => event.subject?.scope === 'strategy');
  if (objectType === 'sidecarObject' || objectType === 'sidecarSource') return history.events.filter(event => event.subject?.scope === 'sidecar' && event.subject?.sidecarId === id);
  return [];
}

function listEntries(clarifications) {
  const entries = [];
  model.measures.forEach(measure => {
    entries.push({
      objectType: 'measure',
      id: measure.id,
      title: measure.name || 'Maßnahme ohne Namen',
      subtitle: measure.orgUnit || '',
      badge: measure.active ? 'aktiv' : 'inaktiv',
      active: Boolean(measure.active),
      hasObjectiveIds: Boolean((measure.objectiveIds || []).length),
      gapCount: clarifications.filter(item => item.status !== 'closed' && item.measureId === measure.id).length
    });
  });
  inputPseudoObjects.forEach(pseudo => {
    const gapCount = fieldDescriptorsFor('input')
      .filter(descriptor => descriptor.group === pseudo.group)
      .filter(descriptor => valueState('input', descriptor.key, model.inputs[descriptor.key], { object: model.inputs, objectId: inputsObjectId, history, openDecisions: model.openDecisions }).state === 'default')
      .length;
    entries.push({ objectType: 'input', id: pseudo.id, title: pseudo.title, subtitle: pseudo.badge, badge: pseudo.badge, gapCount });
  });
  (model.strategy.objectives || []).forEach(objective => {
    entries.push({ objectType: 'objective', id: objective.id, title: objective.label || 'Ziel', subtitle: 'Ziel', badge: 'Ziel', gapCount: 0 });
  });
  (model.sidecar.objects || []).forEach(object => {
    entries.push({
      objectType: 'sidecarObject',
      id: object.id,
      title: object.title || 'Kontextobjekt',
      subtitle: object.division || '',
      badge: 'Kontext',
      gapCount: evidenceGaps('sidecarObject', object).length + clarifications.filter(item => item.status !== 'closed' && item.sidecarId === object.id).length
    });
  });
  (model.sidecar.sources || []).forEach(source => {
    entries.push({ objectType: 'sidecarSource', id: source.id, title: source.title || 'Quelle', subtitle: source.type || '', badge: 'Quelle', gapCount: 0 });
  });
  clarifications.filter(item => item.status !== 'closed').forEach(item => {
    entries.push({ objectType: 'clarification', id: item.key, title: item.title, subtitle: item.measure || item.area || '', badge: item.priority?.label || '', gapCount: 1 });
  });
  return entries;
}

// ---------------------------------------------------------------------------
// Filterspalte (Abschnitt 4.2)
// ---------------------------------------------------------------------------

const typeFilterDefs = [
  { key: 'all', label: 'Alles', match: () => true },
  { key: 'measure', label: 'Maßnahmen', match: entry => entry.objectType === 'measure' },
  { key: 'clarification', label: 'Offen', match: entry => entry.objectType === 'clarification' },
  { key: 'objective', label: 'Ziele', match: entry => entry.objectType === 'objective' },
  { key: 'sidecarObject', label: 'Kontext', match: entry => entry.objectType === 'sidecarObject' },
  { key: 'sidecarSource', label: 'Quellen', match: entry => entry.objectType === 'sidecarSource' },
  { key: 'rahmen', label: 'Rahmen', match: entry => entry.objectType === 'input' && entry.badge === 'Rahmen' },
  { key: 'szenario', label: 'Szenarien', match: entry => entry.objectType === 'input' && entry.badge === 'Szenario' }
];

const savedFilterDefs = [
  { key: 'active', label: 'Aktiv', match: entry => entry.objectType === 'measure' && entry.active },
  { key: 'without-objective', label: 'Ohne Ziel-Zuordnung', match: entry => entry.objectType === 'measure' && entry.active && !entry.hasObjectiveIds }
];

const allFilterDefs = [...typeFilterDefs, ...savedFilterDefs];

function filterCounts(entries) {
  const counts = {};
  allFilterDefs.forEach(def => { counts[def.key] = entries.filter(def.match).length; });
  return counts;
}

// Anhang A2: eine Kennzahlkachel führt "auf die Objekte, aus denen sie
// entsteht" (Kriterium 5) — Maßnahmen ohne Beitrag zu genau dieser Kennzahl
// gehören nicht in diese Menge. kpiExcludedCount zählt sie für den Hinweis im
// Filterkopf (renderObjectSurface), damit das Ausblenden sichtbar bleibt.
function filteredEntries(entries, portfolio) {
  let list;
  let kpiExcludedCount = 0;
  if (filterKey.startsWith('kpi:')) {
    const kpiKey = filterKey.slice(4);
    const p = currentParams();
    const withContribution = entries
      .filter(entry => entry.objectType === 'measure')
      .map(entry => ({ entry, value: measureKpiContribution(resolveObject('measure', entry.id), p, kpiKey, portfolio?.results || []) }));
    kpiExcludedCount = withContribution.filter(item => !item.value).length;
    list = withContribution
      .filter(item => item.value)
      .sort((a, b) => b.value - a.value)
      .map(item => item.entry);
  } else if (filterKey.startsWith('viability:')) {
    // Vom Segmentbalken gesetzter Filter (Abschnitt 5: "Segment → setzt
    // Filter auf die Kategorie") — dieselbe "measure"-Objektfläche, aber nur
    // die Maßnahmen dieser Tragfähigkeitskategorie. Dieselbe Quelle wie das
    // Segment selbst (viabilityOverviewFor via viabilitySegmentsModel), statt
    // die Klassifikation hier redundant und potenziell abweichend erneut zu
    // berechnen (u. a. schließt viabilityOverviewFor inaktive Maßnahmen aus).
    const category = filterKey.slice('viability:'.length);
    const bucketMeasureIds = new Set(
      (viabilityOverviewFor({ measures: model.measures }, model.inputs).categories[category]?.measures || []).map(item => item.measureId)
    );
    list = entries.filter(entry => entry.objectType === 'measure' && bucketMeasureIds.has(entry.id));
  } else {
    const def = allFilterDefs.find(item => item.key === filterKey);
    list = def ? entries.filter(def.match) : entries;
  }
  if (searchText.trim()) {
    const needle = searchText.trim().toLowerCase();
    list = list.filter(entry => entry.title.toLowerCase().includes(needle));
  }
  return { list, kpiExcludedCount };
}

function filterButtonHtml(def, counts) {
  return `
    <button type="button" class="akte-filter-item ${filterKey === def.key ? 'active' : ''}" data-filter="${esc(def.key)}">
      <span>${esc(def.label)}</span>
      <span class="count">${counts[def.key] || 0}</span>
    </button>
  `;
}

function renderFilterColumn(entries) {
  const counts = filterCounts(entries);
  const node = document.getElementById('akteFilterColumn');
  node.innerHTML = `
    <div class="akte-filter-group">
      <h3>Objekte</h3>
      ${typeFilterDefs.map(def => filterButtonHtml(def, counts)).join('')}
    </div>
    <div class="akte-filter-group">
      <h3>Gespeicherte Filter</h3>
      ${savedFilterDefs.map(def => filterButtonHtml(def, counts)).join('')}
    </div>
    ${renderSuggestions()}
  `;
}

// ---------------------------------------------------------------------------
// Objektfläche (Abschnitt 4.3) — Objektliste + Satzdarstellung, generisch
// über alle Objekttypen (Kriterium 6).
// ---------------------------------------------------------------------------

const measureGroupTitles = {
  identitaet: 'Identität',
  investitionAktivierung: 'Investition & Aktivierung',
  wirkung: 'Wirkung',
  lebenszyklus: 'Lebenszyklus',
  gasTransformationspfad: 'Gas-Transformationspfad',
  flexibilitaetNetzfahrplan: 'Flexibilität / Netzfahrplan',
  eeg2027Netzanschluss: 'EEG 2027 / Netzanschluss',
  monitoring14d: 'Monitoring / §14d',
  herkunftEvidenz: 'Herkunft & Evidenz',
  tragfaehigkeit: 'Tragfähigkeit',
  notiz: 'Notiz'
};
const alwaysOpenGroups = new Set(['identitaet', 'investitionAktivierung', 'wirkung']);
const measureGroupOrder = ['identitaet', 'investitionAktivierung', 'wirkung', 'lebenszyklus', 'gasTransformationspfad', 'flexibilitaetNetzfahrplan', 'eeg2027Netzanschluss', 'monitoring14d', 'herkunftEvidenz', 'tragfaehigkeit', 'notiz'];

function formattedValue(descriptor, value) {
  if (descriptor.type === 'bool') return value ? 'ja' : 'nein';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '–';
  // Select-Werte bleiben im Modell englische/camelCase Enum-Konstanten
  // (z. B. "costPathReview") — angezeigt wird die deutsche Beschriftung aus
  // dem Felddeskriptor, nicht der Rohwert. Vor der generischen Leerwert-
  // Prüfung, da manche Optionslisten der leeren Zeichenkette selbst eine
  // Beschriftung geben (z. B. "automatisch ableiten").
  if (descriptor.type === 'select' && descriptor.optionLabels && Object.hasOwn(descriptor.optionLabels, value ?? '')) {
    return descriptor.optionLabels[value ?? ''];
  }
  if (value === '' || value === null || value === undefined) return '(nicht gesetzt)';
  if (descriptor.type === 'teur') return fmtPlain(Number(value) || 0, 1);
  if (descriptor.type === 'percent' || descriptor.type === 'number' || descriptor.type === 'year') return fmtPlain(Number(value) || 0, 0);
  return String(value);
}

function stateSuffix(state) {
  if (state.state === 'default') return ' <span class="akte-state-note">(Vorbelegung)</span>';
  if (state.state === 'derived') return ' <span class="akte-state-note">(abgeleitet)</span>';
  return '';
}

// Felder, die kein einfacher Skalar-/String-Array-Popover abbilden kann:
// id ist ein Systemschlüssel (nicht Teil des Satzes, siehe Spezifikation
// 5.2 — die Identität-Gruppe listet ihn nicht), impactAssumptions ist eine
// verschachtelte Objektliste (eigene Objektfläche, spätere Stufe).
const nonEditableFieldKeys = new Set(['id']);
const summaryOnlyFieldKeys = new Set(['impactAssumptions']);

function referenceDisplayLabel(targetType, id) {
  if (!id) return id;
  const collection = referenceCollection(targetType);
  const labelKey = referenceLabelKeys[targetType];
  const match = collection.find(item => item.id === id);
  const label = match ? (match[labelKey] || id) : id;
  return isProvisional(targetType, id) ? `${label} (vorläufig)` : label;
}

function renderFieldValue(objectType, objectId, descriptor, object) {
  const rawValue = object[descriptor.key];
  if (summaryOnlyFieldKeys.has(descriptor.key)) {
    const count = Array.isArray(rawValue) ? rawValue.length : 0;
    return `<span class="akte-value akte-value--summary">${esc(count)}</span>`;
  }
  const state = valueState(objectType, descriptor.key, rawValue, { object, objectId, history, openDecisions: model.openDecisions });
  if (state.state === 'openByDecision') {
    return `<button type="button" class="akte-value akte-value--openByDecision" data-edit-key="${esc(descriptor.key)}" data-object-type="${esc(objectType)}" data-object-id="${esc(objectId)}">bewusst offen gelassen: ${esc(state.reason || 'ohne Begründung')}</button>`;
  }
  const referenceTarget = referenceFieldsFor(objectType)[descriptor.key];
  let display;
  let hasProvisional = false;
  if (referenceTarget) {
    const ids = referenceTarget.multi ? (Array.isArray(rawValue) ? rawValue : []) : (rawValue ? [rawValue] : []);
    hasProvisional = ids.some(id => isProvisional(referenceTarget.targetType, id));
    display = ids.length ? ids.map(id => referenceDisplayLabel(referenceTarget.targetType, id)).join(', ') : '–';
  } else {
    display = formattedValue(descriptor, rawValue);
  }
  const provisionalCls = hasProvisional ? ' akte-value--provisional' : '';
  return `<button type="button" class="akte-value akte-value--${esc(state.state)}${provisionalCls}" data-edit-key="${esc(descriptor.key)}" data-object-type="${esc(objectType)}" data-object-id="${esc(objectId)}">${esc(display)}</button>${stateSuffix(state)}`;
}

function renderSentenceForGroup(objectType, objectId, group, object) {
  const descriptors = fieldDescriptorsFor(objectType)
    .filter(descriptor => descriptor.group === group)
    .filter(descriptor => !nonEditableFieldKeys.has(descriptor.key))
    .filter(descriptor => !descriptor.appliesWhen || descriptor.appliesWhen(object))
    .sort((a, b) => a.order - b.order);
  if (!descriptors.length) return '';
  return descriptors.map(descriptor => {
    const valueHtml = renderFieldValue(objectType, objectId, descriptor, object);
    return descriptor.sentence.replace('{v}', valueHtml) + '. ';
  }).join('');
}

function groupHasGapOrNonDefault(objectType, objectId, group, object) {
  return fieldDescriptorsFor(objectType)
    .filter(descriptor => descriptor.group === group)
    .filter(descriptor => !descriptor.appliesWhen || descriptor.appliesWhen(object))
    .some(descriptor => valueState(objectType, descriptor.key, object[descriptor.key], { object, objectId, history, openDecisions: model.openDecisions }).state !== 'default');
}

function measureGroupOpenPointCount(group, measure, clarifications) {
  const measureClarifications = clarifications.filter(item => item.measureId === measure.id);
  const descriptorKeys = new Set(fieldDescriptorsFor('measure').filter(d => d.group === group).map(d => d.key));
  const evidence = evidenceGaps('measure', measure).filter(gap => descriptorKeys.has(gap.key));
  return measureClarifications.length && group === 'wirkung' ? measureClarifications.length : evidence.length;
}

function blockHtml(group, title, openCount, shouldOpen, sentence) {
  return `
    <details class="akte-sentence-block" ${shouldOpen ? 'open' : ''} data-group="${esc(group)}">
      <summary>
        <span>${esc(title)}</span>
        ${openCount ? `<span class="badge">${openCount} offen</span>` : ''}
      </summary>
      <div class="akte-sentence-body">${sentence}</div>
    </details>
  `;
}

function renderRechenpfad(measure, p) {
  try {
    const drilldown = measureDrilldownFor(measure, p);
    const row = drilldown.rows?.[0];
    if (!row) return '';
    return `
      <div class="akte-rechenpfad">
        Rechenpfad: CAPEX <strong>${esc(fmtTeur(drilldown.capexTeur, 0))}</strong>
        → aktiviert <strong>${esc(fmtTeur(drilldown.activatedTeur, 0))}</strong> (${esc(fmtPlain(drilldown.activeSharePct, 0))} %)
        → AfA/Verzinsung <strong>${esc(fmtTeur((row.depreciation || 0) + (row.capitalReturn || 0), 1))}</strong>
        → EOG-Wirkung Jahr 1 <strong>${esc(fmtTeur(row.regulatoryEogEffect || 0, 1))}</strong>
        → indikative Cashflow-Basis <strong>${esc(fmtTeur(row.indicativeCashflow || 0, 1))}</strong>.
      </div>
    `;
  } catch (_error) {
    return '';
  }
}

function renderMeasureDetail(measure, clarifications, p) {
  const blocksHtml = measureGroupOrder
    .filter(group => fieldDescriptorsFor('measure').some(d => d.group === group && (!d.appliesWhen || d.appliesWhen(measure))))
    .map(group => {
      const sentence = renderSentenceForGroup('measure', measure.id, group, measure);
      const isCore = alwaysOpenGroups.has(group);
      const openCount = measureGroupOpenPointCount(group, measure, clarifications);
      const hasNonDefault = groupHasGapOrNonDefault('measure', measure.id, group, measure);
      const shouldOpen = isCore || openCount > 0 || hasNonDefault;
      return blockHtml(group, measureGroupTitles[group] || group, openCount, shouldOpen, sentence);
    }).join('');
  const titleHtml = esc(measure.name || 'Maßnahme ohne Namen') + provisionalBadgeHtml('measure', measure.id);
  return `
    ${objectDetailHeaderHtml('measure', measure.id, titleHtml, `Maßnahme · ${measure.orgUnit || 'ohne Bereich'} · ${measure.active ? 'aktiv' : 'inaktiv'}`)}
    ${blocksHtml}
    ${renderRechenpfad(measure, p)}
  `;
}

function provisionalBadgeHtml(objectType, objectId) {
  return isProvisional(objectType, objectId) ? '<span class="akte-provisional-badge">vorläufig</span>' : '';
}

// Symmetrisch zu addNewObject(): nur die vier direkt anlegbaren Objekttypen
// zeigen einen Löschen-Button (kein Rahmen/Szenario, kein Klärpunkt — beide
// sind nicht eigenständig löschbar).
function objectDeleteButtonHtml(objectType, objectId) {
  if (!creatableObjectTypes[objectType]) return '';
  return `<button type="button" class="akte-delete-button" data-delete-object-type="${esc(objectType)}" data-delete-object-id="${esc(objectId)}">Löschen</button>`;
}

function objectDetailHeaderHtml(objectType, objectId, titleHtml, subtitleText) {
  return `
    <div class="akte-object-detail-header">
      <div>
        <h2 class="akte-object-title">${titleHtml}</h2>
        <p class="akte-object-subtitle">${esc(subtitleText)}</p>
      </div>
      ${objectDeleteButtonHtml(objectType, objectId)}
    </div>
  `;
}

function renderFlatDetail(objectType, objectId, group, object, title, subtitle) {
  const sentence = renderSentenceForGroup(objectType, objectId, group, object);
  return `
    ${objectDetailHeaderHtml(objectType, objectId, esc(title) + provisionalBadgeHtml(objectType, objectId), subtitle)}
    <div class="akte-sentence-block akte-sentence-block--flat">
      <div class="akte-sentence-body">${sentence}</div>
    </div>
  `;
}

function renderClarificationDetail(item, clarifications, p) {
  const infoCard = `
    <h2 class="akte-object-title">${esc(item.title)}</h2>
    <p class="akte-object-subtitle">Klärpunkt · ${esc(item.area || '')} · Priorität ${esc(item.priority?.label || '')}</p>
    <div class="akte-sentence-block akte-sentence-block--flat">
      <div class="akte-sentence-body">${esc(item.detail || 'Kein weiterer Hinweistext.')}</div>
    </div>
  `;
  let underlying = '';
  if (item.measureId) {
    const measure = model.measures.find(entry => entry.id === item.measureId);
    if (measure) {
      underlying = `<div class="akte-clarification-target"><h3>Betroffenes Objekt: ${esc(measure.name)}</h3>${renderMeasureDetail(measure, clarifications, p)}</div>`;
    }
  } else if (item.sidecarId) {
    const object = (model.sidecar.objects || []).find(entry => entry.id === item.sidecarId);
    if (object) {
      underlying = `<div class="akte-clarification-target"><h3>Betroffenes Objekt: ${esc(object.title)}</h3>${renderFlatDetail('sidecarObject', object.id, 'kontext', object, object.title || 'Kontextobjekt', 'Kontextobjekt')}</div>`;
    }
  }
  return infoCard + underlying;
}

function renderObjectDetailHtml(objectType, id, clarifications, p) {
  if (objectType === 'measure') {
    const measure = model.measures.find(item => item.id === id);
    return measure ? renderMeasureDetail(measure, clarifications, p) : '<div class="akte-empty-state">Maßnahme nicht gefunden.</div>';
  }
  if (objectType === 'input') {
    const pseudo = inputPseudoObjects.find(item => item.id === id);
    return pseudo ? renderFlatDetail('input', inputsObjectId, pseudo.group, model.inputs, pseudo.title, `${pseudo.badge} · gilt für das gesamte Modell`) : '';
  }
  if (objectType === 'objective') {
    const objective = (model.strategy.objectives || []).find(item => item.id === id);
    return objective ? renderFlatDetail('objective', objective.id, 'ziel', objective, objective.label || 'Ziel', 'Ziel') : '<div class="akte-empty-state">Ziel nicht gefunden.</div>';
  }
  if (objectType === 'sidecarObject') {
    const object = (model.sidecar.objects || []).find(item => item.id === id);
    return object ? renderFlatDetail('sidecarObject', object.id, 'kontext', object, object.title || 'Kontextobjekt', `Kontextobjekt · ${object.division || ''}`) : '<div class="akte-empty-state">Kontextobjekt nicht gefunden.</div>';
  }
  if (objectType === 'sidecarSource') {
    const source = (model.sidecar.sources || []).find(item => item.id === id);
    return source ? renderFlatDetail('sidecarSource', source.id, 'quelle', source, source.title || 'Quelle', 'Quelle') : '<div class="akte-empty-state">Quelle nicht gefunden.</div>';
  }
  if (objectType === 'clarification') {
    const item = clarifications.find(entry => entry.key === id);
    return item ? renderClarificationDetail(item, clarifications, p) : '<div class="akte-empty-state">Klärpunkt nicht gefunden (evtl. bereits geschlossen).</div>';
  }
  return '<div class="akte-empty-state">Unbekannter Objekttyp.</div>';
}

function renderObjectListHtml(visible) {
  if (visible.length <= 1) return '';
  return `
    <div class="akte-object-list" role="list" aria-label="Objekte im aktuellen Filter">
      ${visible.map(entry => `
        <button type="button" class="akte-object-list-item ${entry.objectType === selectedType && entry.id === selectedId ? 'active' : ''}" data-object-type="${esc(entry.objectType)}" data-object-id="${esc(entry.id)}">
          <span class="akte-object-list-title">${esc(entry.title)}${provisionalBadgeHtml(entry.objectType, entry.id)}</span>
          <span class="akte-object-list-meta">
            <span class="akte-object-list-type">${esc(objectTypeLabels[entry.objectType] || entry.objectType)}</span>
            ${entry.gapCount ? `<span class="akte-object-list-gap">${entry.gapCount}</span>` : ''}
          </span>
        </button>
      `).join('')}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Diagramme (Visualisierungs-Spezifikation Abschnitt 4-8): "Ein Diagramm ist
// keine Ansicht, sondern die Bildform einer Objektmenge" — genau ein
// Diagrammtyp je Filter, fest zugeordnet, kein eigener Filtereintrag, keine
// Umschaltung des Diagrammtyps (Regel 1-3, Kriterien V1-V3). Stufe V-2 liefert
// den Renderer und den ersten Diagrammtyp (Tornado auf "clarification");
// weitere Zuordnungen kommen in V-3..V-5 hinzu (Diagrammkatalog Abschnitt 5).
const chartTypeByFilter = {
  measure: 'riskMatrix',
  clarification: 'tornado',
  'kpi:eogYear1': 'eogFlow',
  'kpi:eogFollow': 'eogFlow',
  'kpi:npv': 'waterfall',
  'kpi:irr': 'contributionBars',
  rahmen: 'viabilitySegments'
};

const chartTypeLabels = {
  riskMatrix: 'Risikomatrix',
  tornado: 'Wirkungsrangliste',
  eogFlow: 'Liquiditäts-/EOG-Verlauf',
  waterfall: 'Wasserfall',
  contributionBars: 'Beitragsbalken',
  viabilitySegments: 'Segmentbalken'
};

// Baut das Diagrammmodell für den aktuellen Filter, sofern einer zugeordnet
// ist. Regel 3 / Kriterium V2: Objektbezüge, die nicht in der sichtbaren
// Filtermenge liegen, werden gekappt — das Diagramm zeigt nie mehr als die
// Liste darunter.
function chartModelForCurrentFilter(visible) {
  const type = chartTypeByFilter[filterKey];
  if (!type) return null;
  const p = currentParams();
  const context = { history, openDecisions: model.openDecisions };
  if (type === 'riskMatrix') {
    // Nur Maßnahmen aus der aktiven Filtermenge fließen ein (Regel 3 /
    // Kriterium V2) — der Aufrufkontext (Suche, "Aktiv" etc.) bestimmt schon
    // vorher, welche Maßnahmen überhaupt in `visible` stehen.
    const visibleMeasures = visible.filter(entry => entry.objectType === 'measure').map(entry => resolveObject('measure', entry.id)).filter(Boolean);
    return riskMatrixModel(visibleMeasures, context);
  }
  if (type === 'tornado') {
    const visibleIds = new Set(visible.filter(entry => entry.objectType === 'clarification').map(entry => entry.id));
    const visibleClarifications = currentClarifications(currentPortfolio()).filter(item => visibleIds.has(item.key));
    const chart = tornadoModel({ measures: model.measures, inputs: model.inputs }, p, visibleClarifications, context);
    chart.elements.forEach(element => {
      if (element.objectId && !visibleIds.has(element.objectId)) element.objectId = null;
    });
    return chart;
  }
  if (type === 'eogFlow') {
    // Jahressäulen tragen ohnehin nie einen Objektbezug (Abschnitt 7.2) — die
    // Regel-3-Kappung entfällt hier, es gibt nichts zu kappen.
    return eogFlowModel(currentPortfolio(), context);
  }
  if (type === 'waterfall') {
    const visibleIds = new Set(visible.filter(entry => entry.objectType === 'measure').map(entry => entry.id));
    const chart = waterfallModel(currentPortfolio(), context);
    chart.elements.forEach(element => {
      if (element.objectId && !visibleIds.has(element.objectId)) element.objectId = null;
    });
    return chart;
  }
  if (type === 'contributionBars') {
    const visibleIds = new Set(visible.filter(entry => entry.objectType === 'measure').map(entry => entry.id));
    const chart = contributionBarsModel(currentPortfolio(), context);
    chart.elements.forEach(element => {
      if (element.objectId && !visibleIds.has(element.objectId)) element.objectId = null;
    });
    return chart;
  }
  if (type === 'viabilitySegments') {
    // Ein Segment ist keine Referenz auf ein Objekt aus der sichtbaren Liste
    // (die "rahmen"-Liste zeigt Rahmen-/Szenario-Pseudoobjekte, keine
    // Kategorien) — es setzt stattdessen selbst einen neuen Filter (Abschnitt
    // 5: "Segment → setzt Filter auf die Kategorie"). Regel-3-Kappung entfällt
    // aus demselben Grund wie bei Jahressäulen: es gibt keine Objektidentität
    // zu kappen.
    return viabilitySegmentsModel({ measures: model.measures }, model.inputs, context);
  }
  return null;
}

// Deutsche Kurzform je Wertzustand, für <title>/Tabellenspalten aller
// Diagrammtypen einheitlich (Abschnitt 6).
const valueStateLabelDe = { set: 'geprüft', default: 'Vorbelegung', derived: 'abgeleitet', openByDecision: 'bewusst offen' };

// Große Fassung im Ausgabefenster (Abschnitt 4.3): "mit Achsen, Legende,
// Werteachse und Quellenzeile" — im Objektflächen-Diagramm bewusst
// weggelassen (Abschnitt 4.2), hier Pflicht, weil das die Beamer-/
// Papiersituation ist. Achsen/Werteachse werden je Diagrammtyp aus derselben
// Skala gezeichnet, die auch die Balken/Punkte positioniert (kein zweites,
// potenziell abweichendes Koordinatensystem). Legende und Quellenzeile sind
// gemeinsam für alle sechs Diagrammtypen (Abschnitt 6: "muss nur einmal
// gelernt werden").
function verticalAxisSvg(ticks, yScale, x) {
  if (!ticks.length) return '';
  const sorted = [...ticks].sort((a, b) => a - b);
  const line = `<line x1="${x}" y1="${yScale(sorted[0])}" x2="${x}" y2="${yScale(sorted[sorted.length - 1])}" class="akte-chart-axis-line"></line>`;
  const labels = sorted.map(tick => `<text x="${x - 5}" y="${yScale(tick) + 3}" class="akte-chart-axis-label" text-anchor="end">${esc(fmtPlain(tick, 0))}</text>`).join('');
  return line + labels;
}

function horizontalAxisSvg(ticks, xScale, y) {
  if (!ticks.length) return '';
  const sorted = [...ticks].sort((a, b) => a - b);
  const line = `<line x1="${xScale(sorted[0])}" y1="${y}" x2="${xScale(sorted[sorted.length - 1])}" y2="${y}" class="akte-chart-axis-line"></line>`;
  const labels = sorted.map(tick => `<text x="${xScale(tick)}" y="${y + 13}" class="akte-chart-axis-label" text-anchor="middle">${esc(fmtPlain(tick, 0))}</text>`).join('');
  return line + labels;
}

function chartValueStateLegendHtml() {
  const items = [
    ['set', 'geprüft'],
    ['default', 'Vorbelegung'],
    ['derived', 'abgeleitet'],
    ['openByDecision', 'bewusst offen']
  ];
  return `
    <div class="akte-chart-legend">
      ${items.map(([state, label]) => `<span class="akte-chart-legend-item"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" class="akte-chart-mark--${state}"></rect></svg>${esc(label)}</span>`).join('')}
      <span class="akte-chart-legend-item"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" class="akte-chart-mark--no-evidence"></rect></svg>Evidenz fehlt (Kontur ohne Füllfarbe)</span>
    </div>
  `;
}

function chartSourceLineHtml() {
  return `<p class="akte-chart-source">Quelle: Szenarienrechner-EOG (digitale Akte) · Rechenkern engine.js/chart-model.js · Datenstand ${esc(new Date().toLocaleString('de-DE'))}</p>`;
}

function chartChromeButtonsHtml(collapsed, asTable) {
  return `
    <div class="akte-chart-header">
      <button type="button" class="akte-chart-toggle" data-chart-toggle-collapse>${collapsed ? 'Diagramm einblenden' : 'Diagramm ausblenden'}</button>
      ${collapsed ? '' : `<button type="button" class="akte-chart-table-toggle" data-chart-toggle-table>${asTable ? 'als Diagramm' : 'als Tabelle'}</button>`}
    </div>
  `;
}

// Wirkungsrangliste / Tornado (Kriterium V9: <title> je Element mit Name,
// Wert und Zustand im Klartext; Größenberechnung rein aus den Daten, kein
// getBoundingClientRect — siehe Abschnitt 8).
function renderTornadoSvg(chart, { selectedType: selectedObjectType, selectedId: selectedObjectId, axis = false, width = 560, height = 220 }) {
  const labelWidth = 150;
  const plotLeft = labelWidth + 8;
  const plotRight = width - 12;
  const bottomMargin = axis ? 18 : 0;
  const rowHeight = Math.min(30, (height - 16 - bottomMargin) / Math.max(1, chart.elements.length));
  const barHeight = Math.max(6, rowHeight - 8);
  const scale = linearScale(chart.xAxis.min, chart.xAxis.max, plotLeft, plotRight);
  const zeroX = scale(0);
  const bars = chart.elements.map((element, index) => {
    const y = 8 + index * rowHeight;
    const lowX = scale(Math.min(element.low, element.high));
    const highX = scale(Math.max(element.low, element.high));
    const isSelected = element.objectType && element.objectId && element.objectType === selectedObjectType && element.objectId === selectedObjectId;
    const classes = ['akte-chart-element', `akte-chart-mark--${element.valueState}`];
    if (element.hasEvidenceGap) classes.push('akte-chart-mark--no-evidence');
    if (isSelected) classes.push('selected');
    const stateLabel = valueStateLabelDe[element.valueState] || element.valueState;
    const titleText = `${element.label}: Δ Kapitalwert ${fmtTeur(element.low, 1)} bis ${fmtTeur(element.high, 1)}, Zustand ${stateLabel}${element.hasEvidenceGap ? ', Evidenz fehlt' : ''}`;
    return `
      <g class="${classes.join(' ')}" tabindex="${index === 0 ? '0' : '-1'}" role="button"
         data-chart-element-index="${index}"
         ${element.objectType ? `data-object-type="${esc(element.objectType)}"` : ''}
         ${element.objectId ? `data-object-id="${esc(element.objectId)}"` : ''}
         aria-label="${esc(titleText)}">
        <title>${esc(titleText)}</title>
        <rect class="akte-chart-hit-area" x="0" y="${y}" width="${width}" height="${rowHeight}"></rect>
        <rect x="${Math.min(lowX, highX)}" y="${y}" width="${Math.max(1, Math.abs(highX - lowX))}" height="${barHeight}"></rect>
        <text x="4" y="${y + barHeight / 2 + 4}" class="akte-chart-label">${esc(element.label)}</text>
      </g>
    `;
  }).join('');
  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="group" aria-label="${esc(chartTypeLabels[chart.type] || chart.type)}" focusable="false">
      <line x1="${zeroX}" y1="4" x2="${zeroX}" y2="${height - bottomMargin - 4}" class="akte-chart-zero-line"></line>
      ${axis ? horizontalAxisSvg(chart.xAxis.ticks, scale, height - bottomMargin) : ''}
      ${bars}
    </svg>
  `;
}

function renderTornadoTable(chart) {
  return `
    <table class="akte-chart-table">
      <thead><tr><th>Treiber</th><th>Δ Kapitalwert von</th><th>Δ Kapitalwert bis</th><th>Zustand</th></tr></thead>
      <tbody>
        ${chart.elements.map(element => `
          <tr class="akte-chart-element" ${element.objectType ? `data-object-type="${esc(element.objectType)}"` : ''} ${element.objectId ? `data-object-id="${esc(element.objectId)}"` : ''}>
            <td>${esc(element.label)}</td>
            <td>${esc(fmtTeur(Math.min(element.low, element.high), 1))}</td>
            <td>${esc(fmtTeur(Math.max(element.low, element.high), 1))}</td>
            <td>${esc(valueStateLabelDe[element.valueState] || element.valueState)}${element.hasEvidenceGap ? ' · Evidenz fehlt' : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Liquiditäts-/EOG-Verlauf (Filter kpi:eogYear1/kpi:eogFollow): eine
// Jahressäule je Planungsjahr, gestapelt aus AfA + Verzinsung + Q/E + Risiko
// + Einmal-OPEX, überlagert von zwei Linien (indikativer Cashflow, kumulierte
// Brücke). Jahressäulen haben keinen Objektbezug (Abschnitt 7.2) — ein Klick
// setzt stattdessen die Jahresmarkierung, die die Kontextspalte liest.
const eogFlowStackOrder = [
  ['depreciation', 'AfA'],
  ['capitalReturn', 'Verzinsung'],
  ['qAndE', 'Q/E'],
  ['risk', 'Risiko'],
  ['firstYearOpex', 'Einmal-OPEX']
];

function renderEogFlowSvg(chart, { yearMarker, axis = false, width = 560, height = 220 }) {
  const topMargin = 6;
  const bottomMargin = 18;
  const leftMargin = axis ? 34 : 8;
  const rightMargin = 8;
  const elements = chart.elements;
  const n = Math.max(1, elements.length);
  const colWidth = (width - leftMargin - rightMargin) / n;
  const barWidth = Math.max(2, colWidth * 0.62);
  const yScale = linearScale(chart.yAxis.min, chart.yAxis.max, height - bottomMargin, topMargin);
  const zeroY = yScale(0);
  const labelEvery = Math.max(1, Math.ceil(n / 6));
  const columnX = index => leftMargin + colWidth * index + colWidth / 2;

  const columns = elements.map((element, index) => {
    const cx = columnX(index);
    let positiveTotal = 0;
    let negativeTotal = 0;
    const segments = eogFlowStackOrder.map(([key]) => {
      const value = element.stack[key];
      let y0;
      let y1;
      if (value >= 0) {
        y0 = yScale(positiveTotal);
        positiveTotal += value;
        y1 = yScale(positiveTotal);
      } else {
        y0 = yScale(negativeTotal);
        negativeTotal += value;
        y1 = yScale(negativeTotal);
      }
      return { y: Math.min(y0, y1), height: Math.max(0.5, Math.abs(y1 - y0)) };
    });
    const isMarked = yearMarker === element.year;
    const classes = ['akte-chart-element', `akte-chart-mark--${element.valueState}`];
    if (element.hasEvidenceGap) classes.push('akte-chart-mark--no-evidence');
    if (isMarked) classes.push('selected');
    const stateLabel = valueStateLabelDe[element.valueState] || element.valueState;
    const titleText = eogFlowStackOrder
      .map(([key, label]) => `${label} ${fmtTeur(element.stack[key], 1)}`)
      .concat([`indikativer Cashflow ${fmtTeur(element.indicativeCashflow, 1)}`, `kumulierte Brücke ${fmtTeur(element.bridgeCumulative, 1)}`])
      .join(', ');
    const label = `${element.year}: ${titleText}, Zustand ${stateLabel}${element.hasEvidenceGap ? ', Evidenz fehlt' : ''}`;
    const rects = segments.map(segment => `<rect x="${cx - barWidth / 2}" y="${segment.y}" width="${barWidth}" height="${segment.height}"></rect>`).join('');
    const yearLabel = index % labelEvery === 0 ? `<text x="${cx}" y="${height - 4}" class="akte-chart-label" text-anchor="middle">${element.year}</text>` : '';
    return `
      <g class="${classes.join(' ')}" tabindex="${index === 0 ? '0' : '-1'}" role="button"
         data-chart-element-index="${index}" data-chart-year="${element.year}" aria-label="${esc(label)}">
        <title>${esc(label)}</title>
        <rect class="akte-chart-hit-area" x="${cx - colWidth / 2}" y="${topMargin}" width="${colWidth}" height="${height - topMargin - bottomMargin}"></rect>
        ${rects}
        ${yearLabel}
      </g>
    `;
  }).join('');

  const linePoints = key => elements.map((element, index) => `${columnX(index)},${yScale(element[key])}`).join(' ');

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="group" aria-label="${esc(chartTypeLabels[chart.type] || chart.type)}" focusable="false">
      <line x1="${leftMargin}" y1="${zeroY}" x2="${width - rightMargin}" y2="${zeroY}" class="akte-chart-zero-line"></line>
      ${axis ? verticalAxisSvg(chart.yAxis.ticks, yScale, leftMargin) : ''}
      ${columns}
      <polyline points="${linePoints('indicativeCashflow')}" class="akte-chart-line akte-chart-line--cashflow"></polyline>
      <polyline points="${linePoints('bridgeCumulative')}" class="akte-chart-line akte-chart-line--bridge"></polyline>
    </svg>
  `;
}

function renderEogFlowTable(chart) {
  return `
    <table class="akte-chart-table">
      <thead><tr><th>Jahr</th>${eogFlowStackOrder.map(([, label]) => `<th>${esc(label)}</th>`).join('')}<th>Cashflow</th><th>Brücke kumuliert</th><th>Zustand</th></tr></thead>
      <tbody>
        ${chart.elements.map(element => `
          <tr class="akte-chart-element" data-chart-year="${element.year}">
            <td>${esc(element.year)}</td>
            ${eogFlowStackOrder.map(([key]) => `<td>${esc(fmtTeur(element.stack[key], 1))}</td>`).join('')}
            <td>${esc(fmtTeur(element.indicativeCashflow, 1))}</td>
            <td>${esc(fmtTeur(element.bridgeCumulative, 1))}</td>
            <td>${esc(valueStateLabelDe[element.valueState] || element.valueState)}${element.hasEvidenceGap ? ' · Evidenz fehlt' : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Risikomatrix (Filter "measure"): eine Blase je Risiko-Wirkannahme, x =
// Eintrittswahrscheinlichkeit nachher, y = Schadenshöhe, Blasenfläche =
// erwarteter vermiedener Risikowert, Pfeil von vorher nach nachher entlang
// der x-Achse (Abschnitt 5). Blase → Maßnahme (mehrere Risiko-Wirkannahmen
// derselben Maßnahme wählen beim Klick dieselbe Maßnahme aus).
function riskBubbleRadius(size, maxSize) {
  const minR = 4;
  const maxR = 22;
  if (!maxSize) return minR;
  return minR + Math.sqrt(Math.abs(size) / maxSize) * (maxR - minR);
}

function renderRiskMatrixSvg(chart, { selectedType: selectedObjectType, selectedId: selectedObjectId, axis = false, width = 560, height = 220 }) {
  const leftMargin = axis ? 34 : 20;
  const rightMargin = 16;
  const topMargin = 12;
  const bottomMargin = axis ? 32 : 20;
  const xScale = linearScale(chart.xAxis.min, chart.xAxis.max, leftMargin, width - rightMargin);
  const yScale = linearScale(chart.yAxis.min, chart.yAxis.max || 1, height - bottomMargin, topMargin);
  const maxSize = Math.max(0, ...chart.elements.map(element => Math.abs(element.size)));
  const bubbles = chart.elements.map((element, index) => {
    const cx = xScale(element.xAfter);
    const cxBefore = xScale(element.xBefore);
    const cy = yScale(element.y);
    const radius = riskBubbleRadius(element.size, maxSize);
    const isSelected = element.objectType === selectedObjectType && element.objectId === selectedObjectId;
    const classes = ['akte-chart-element', `akte-chart-mark--${element.valueState}`];
    if (element.hasEvidenceGap) classes.push('akte-chart-mark--no-evidence');
    if (isSelected) classes.push('selected');
    const stateLabel = valueStateLabelDe[element.valueState] || element.valueState;
    const label = `${element.label}: ${fmtPct(element.xBefore, 0)} → ${fmtPct(element.xAfter, 0)} Eintrittswahrscheinlichkeit, Schadenshöhe ${fmtTeur(element.y, 1)}, erwarteter vermiedener Risikowert ${fmtTeur(element.size, 1)}, Zustand ${stateLabel}${element.hasEvidenceGap ? ', Evidenz fehlt' : ''}`;
    const arrow = Math.abs(cxBefore - cx) > 0.5
      ? `<line x1="${cxBefore}" y1="${cy}" x2="${cx}" y2="${cy}" class="akte-chart-risk-arrow" marker-end="url(#akteRiskArrowHead)"></line>`
      : '';
    const hitRadius = Math.max(radius, 12);
    return `
      <g class="${classes.join(' ')}" tabindex="${index === 0 ? '0' : '-1'}" role="button"
         data-chart-element-index="${index}" data-object-type="${esc(element.objectType)}" data-object-id="${esc(element.objectId)}"
         aria-label="${esc(label)}">
        <title>${esc(label)}</title>
        ${arrow}
        <circle class="akte-chart-hit-area" cx="${cx}" cy="${cy}" r="${hitRadius}"></circle>
        <circle cx="${cx}" cy="${cy}" r="${radius}"></circle>
      </g>
    `;
  }).join('');
  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="group" aria-label="${esc(chartTypeLabels[chart.type] || chart.type)}" focusable="false">
      <defs>
        <marker id="akteRiskArrowHead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" class="akte-chart-risk-arrowhead"></path>
        </marker>
      </defs>
      <line x1="${leftMargin}" y1="${height - bottomMargin}" x2="${width - rightMargin}" y2="${height - bottomMargin}" class="akte-chart-zero-line"></line>
      ${axis ? verticalAxisSvg(chart.yAxis.ticks, yScale, leftMargin) : ''}
      ${axis ? horizontalAxisSvg(chart.xAxis.ticks, xScale, height - bottomMargin) : ''}
      ${bubbles}
    </svg>
  `;
}

function renderRiskMatrixTable(chart) {
  return `
    <table class="akte-chart-table">
      <thead><tr><th>Maßnahme</th><th>Wahrscheinlichkeit vorher</th><th>Wahrscheinlichkeit nachher</th><th>Schadenshöhe</th><th>Erwarteter vermiedener Risikowert</th><th>Zustand</th></tr></thead>
      <tbody>
        ${chart.elements.map(element => `
          <tr class="akte-chart-element" data-object-type="${esc(element.objectType)}" data-object-id="${esc(element.objectId)}">
            <td>${esc(element.label)}</td>
            <td>${esc(fmtPct(element.xBefore, 0))}</td>
            <td>${esc(fmtPct(element.xAfter, 0))}</td>
            <td>${esc(fmtTeur(element.y, 1))}</td>
            <td>${esc(fmtTeur(element.size, 1))}</td>
            <td>${esc(valueStateLabelDe[element.valueState] || element.valueState)}${element.hasEvidenceGap ? ' · Evidenz fehlt' : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Wasserfall (Filter "kpi:npv"): Basis-EOG → Wirkungsbeiträge → Ergebnis, ein
// schwebender Balken je Schritt (Abschnitt 5). "Balken → beitragende
// Maßnahme, wo eindeutig" — waterfallModel() setzt den Objektbezug nur, wenn
// genau eine aktive Maßnahme existiert (siehe chart-model.js).
function renderVerticalBarChart({ chart, leftMargin = 12, rightMargin = 12, labelEvery = 1, xLabel, xLabelFor = element => element.label, selectedObjectType, selectedObjectId, overlayFraction, connectSteps, axis = false, width = 560, height = 220 }) {
  if (axis) leftMargin = Math.max(leftMargin, 34);
  const topMargin = 10;
  const bottomMargin = xLabel ? 20 : 8;
  const n = Math.max(1, chart.elements.length);
  const colWidth = (width - leftMargin - rightMargin) / n;
  const barWidth = Math.max(4, colWidth * 0.6);
  const yScale = linearScale(chart.yAxis.min, chart.yAxis.max || 1, height - bottomMargin, topMargin);
  const zeroY = yScale(0);
  const columnX = index => leftMargin + colWidth * index + colWidth / 2;
  let previousEndY = null;
  const bars = chart.elements.map((element, index) => {
    const cx = columnX(index);
    const start = element.start ?? 0;
    const end = element.end ?? element.value ?? 0;
    // yScale kehrt die Richtung um (größerer Datenwert → kleinerer Pixelwert)
    // — pixelTop ist deshalb nicht einfach yScale(min(start,end)).
    const pixelStart = yScale(start);
    const pixelEnd = yScale(end);
    const pixelTop = Math.min(pixelStart, pixelEnd);
    const barHeight = Math.max(1, Math.abs(pixelEnd - pixelStart));
    const isSelected = element.objectType && element.objectId && element.objectType === selectedObjectType && element.objectId === selectedObjectId;
    const classes = ['akte-chart-element', `akte-chart-mark--${element.valueState}`];
    if (element.hasEvidenceGap) classes.push('akte-chart-mark--no-evidence');
    if (isSelected) classes.push('selected');
    const stateLabel = valueStateLabelDe[element.valueState] || element.valueState;
    const labelText = `${element.label}: ${fmtTeur(element.value, 1)}, Zustand ${stateLabel}${element.hasEvidenceGap ? ', Evidenz fehlt' : ''}`;
    const overlay = overlayFraction && overlayFraction(element) > 0
      ? `<rect class="akte-chart-overlay" x="${cx - barWidth / 2}" y="${pixelTop}" width="${barWidth}" height="${Math.max(1, barHeight * overlayFraction(element))}"></rect>`
      : '';
    const connector = connectSteps && previousEndY !== null
      ? `<line x1="${cx - colWidth / 2}" y1="${previousEndY}" x2="${cx - barWidth / 2}" y2="${yScale(start)}" class="akte-chart-connector"></line>`
      : '';
    previousEndY = yScale(end);
    const xLabelText = xLabel && index % labelEvery === 0
      ? `<text x="${cx}" y="${height - 4}" class="akte-chart-label" text-anchor="middle">${esc(xLabelFor(element))}</text>`
      : '';
    return `
      <g class="${classes.join(' ')}" tabindex="${index === 0 ? '0' : '-1'}" role="button"
         data-chart-element-index="${index}"
         ${element.objectType ? `data-object-type="${esc(element.objectType)}"` : ''}
         ${element.objectId ? `data-object-id="${esc(element.objectId)}"` : ''}
         aria-label="${esc(labelText)}">
        <title>${esc(labelText)}</title>
        ${connector}
        <rect class="akte-chart-hit-area" x="${cx - colWidth / 2}" y="${topMargin}" width="${colWidth}" height="${height - topMargin - bottomMargin}"></rect>
        <rect x="${cx - barWidth / 2}" y="${pixelTop}" width="${barWidth}" height="${barHeight}"></rect>
        ${overlay}
        ${xLabelText}
      </g>
    `;
  }).join('');
  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="group" aria-label="${esc(chartTypeLabels[chart.type] || chart.type)}" focusable="false">
      <line x1="${leftMargin}" y1="${zeroY}" x2="${width - rightMargin}" y2="${zeroY}" class="akte-chart-zero-line"></line>
      ${axis ? verticalAxisSvg(chart.yAxis.ticks, yScale, leftMargin) : ''}
      ${bars}
    </svg>
  `;
}

// Kurzbeschriftung nur für die x-Achse — die vollständige Bezeichnung bleibt
// in <title> und Tabelle erhalten (Abschnitt 7.4: keine Information nur im
// Diagramm, aber auch keine überlappende Achsenbeschriftung bei fünf langen
// Schrittnamen auf 560 px Breite).
const waterfallShortLabels = {
  base_eog: 'Basis-EOG',
  measure_effect: 'Wirkung',
  regulatory_eog: 'EOG Folgejahr',
  economic_bridge: 'Überleitung',
  indicative_cashflow: 'Cashflow'
};

function renderWaterfallSvg(chart, { selectedType: selectedObjectType, selectedId: selectedObjectId, axis = false, width = 560, height = 220 }) {
  return renderVerticalBarChart({
    chart,
    xLabel: true,
    xLabelFor: element => waterfallShortLabels[element.key] || element.label,
    selectedObjectType,
    selectedObjectId,
    connectSteps: true,
    axis,
    width,
    height
  });
}

function renderWaterfallTable(chart) {
  return `
    <table class="akte-chart-table">
      <thead><tr><th>Schritt</th><th>Wert</th><th>Stand danach</th><th>Zustand</th></tr></thead>
      <tbody>
        ${chart.elements.map(element => `
          <tr class="akte-chart-element" ${element.objectType ? `data-object-type="${esc(element.objectType)}"` : ''} ${element.objectId ? `data-object-id="${esc(element.objectId)}"` : ''}>
            <td>${esc(element.label)}</td>
            <td>${esc(fmtTeur(element.value, 1))}</td>
            <td>${esc(fmtTeur(element.end, 1))}</td>
            <td>${esc(valueStateLabelDe[element.valueState] || element.valueState)}${element.hasEvidenceGap ? ' · Evidenz fehlt' : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Beitragsbalken (Filter "kpi:irr"): ein Balken je Maßnahme mit
// Kapitalwertbeitrag, absteigend sortiert, Vorzeichen getrennt durch die
// Nulllinie (Abschnitt 5). Keine Balkenbeschriftung — bei bis zu 60 Balken
// nicht mehr lesbar; Name/Wert/Zustand stehen im <title> und in der Liste
// darunter.
function renderContributionBarsSvg(chart, { selectedType: selectedObjectType, selectedId: selectedObjectId, axis = false, width = 560, height = 220 }) {
  return renderVerticalBarChart({ chart, selectedObjectType, selectedObjectId, axis, width, height });
}

function renderContributionBarsTable(chart) {
  return `
    <table class="akte-chart-table">
      <thead><tr><th>Maßnahme</th><th>Kapitalwertbeitrag</th><th>Zustand</th></tr></thead>
      <tbody>
        ${chart.elements.map(element => `
          <tr class="akte-chart-element" data-object-type="${esc(element.objectType)}" data-object-id="${esc(element.objectId)}">
            <td>${esc(element.label)}</td>
            <td>${esc(fmtTeur(element.value, 1))}</td>
            <td>${esc(valueStateLabelDe[element.valueState] || element.valueState)}${element.hasEvidenceGap ? ' · Evidenz fehlt' : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Segmentbalken (Filter "rahmen"): CAPEX je Tragfähigkeitskategorie, mit
// einer Überlagerung für den Anteil offener Refinanzierungsbrücken
// (Abschnitt 5). Ein Segment wählt kein Objekt, sondern setzt den Filter auf
// die Kategorie (siehe activateChartElement) — data-object-type bleibt
// trotzdem gesetzt, damit derselbe Diagramm-Mechanismus (Klick, Tastatur,
// <title>) greift.
function renderViabilitySegmentsSvg(chart, { axis = false, width = 560, height = 220 } = {}) {
  return renderVerticalBarChart({
    chart,
    xLabel: true,
    overlayFraction: element => element.bridgeMissingShare,
    selectedObjectType: null,
    selectedObjectId: null,
    axis,
    width,
    height
  });
}

function renderViabilitySegmentsTable(chart) {
  return `
    <table class="akte-chart-table">
      <thead><tr><th>Kategorie</th><th>CAPEX</th><th>Anzahl Maßnahmen</th><th>Anteil offener Refinanzierungsbrücken</th><th>Zustand</th></tr></thead>
      <tbody>
        ${chart.elements.map(element => `
          <tr class="akte-chart-element" data-object-type="${esc(element.objectType)}" data-object-id="${esc(element.objectId)}">
            <td>${esc(element.label)}</td>
            <td>${esc(fmtTeur(element.value, 1))}</td>
            <td>${esc(element.count)}</td>
            <td>${esc(fmtPct(element.bridgeMissingShare * 100, 0))}</td>
            <td>${esc(valueStateLabelDe[element.valueState] || element.valueState)}${element.hasEvidenceGap ? ' · Evidenz fehlt' : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

const chartRenderers = {
  riskMatrix: { svg: renderRiskMatrixSvg, table: renderRiskMatrixTable },
  tornado: { svg: renderTornadoSvg, table: renderTornadoTable },
  eogFlow: { svg: renderEogFlowSvg, table: renderEogFlowTable },
  waterfall: { svg: renderWaterfallSvg, table: renderWaterfallTable },
  contributionBars: { svg: renderContributionBarsSvg, table: renderContributionBarsTable },
  viabilitySegments: { svg: renderViabilitySegmentsSvg, table: renderViabilitySegmentsTable }
};

function renderChartSectionHtml(visible) {
  const chart = chartModelForCurrentFilter(visible);
  if (!chart) return '';
  const collapsed = Boolean(chartCollapsed[filterKey]);
  const asTable = Boolean(chartAsTable[filterKey]);
  const renderer = chartRenderers[chart.type];
  let body = '';
  if (!collapsed) {
    if (chart.emptyReason) {
      body = `<div class="akte-chart-empty">${esc(chart.emptyReason)}</div>`;
    } else if (asTable) {
      body = renderer.table(chart);
    } else {
      body = renderer.svg(chart, { selectedType, selectedId, yearMarker: chartYearMarker });
    }
  }
  // Skalierung > 60 Elemente (Abschnitt 9.2): die größten bleiben einzeln
  // sichtbar, der Rest wird als ein Sammelwert benannt statt stillschweigend
  // abgeschnitten.
  const collapsedNote = (!collapsed && !chart.emptyReason && chart.collapsedCount)
    ? `<p class="akte-chart-note">+ ${chart.collapsedCount} weitere, zusammengefasst (${esc(fmtTeur(chart.collapsedValue, 1))}).</p>`
    : '';
  return `
    <section class="akte-chart" data-chart-type="${esc(chart.type)}">
      ${chartChromeButtonsHtml(collapsed, asTable)}
      ${body}
      ${collapsedNote}
    </section>
  `;
}

// Klick/Enter auf ein Diagrammelement wählt exakt dasselbe Objekt wie ein
// Klick auf die entsprechende Listenzeile (Kriterium V4). Elemente ohne
// Objektbezug (z. B. ein nicht zugeordneter Sensitivitätstreiber) wählen
// nichts aus — Abschnitt 7.2.
function selectChartElement(node) {
  const objectType = node.dataset.objectType;
  const objectId = node.dataset.objectId;
  if (!objectType || !objectId) return;
  selectedType = objectType;
  selectedId = objectId;
  renderAll();
}

// Aktiviert ein Diagrammelement per Klick oder Enter. Jahressäulen
// (data-chart-year) haben keinen Objektbezug — sie setzen stattdessen die
// Jahresmarkierung (Abschnitt 7.2, einziger zusätzlicher Interaktionszustand).
// Alle übrigen Diagrammelemente wählen wie gewohnt ihr Objekt aus.
function activateChartElement(node) {
  if (node.dataset.chartYear) {
    chartYearMarker = Number(node.dataset.chartYear);
    renderAll();
    return;
  }
  // Segmentbalken (Diagrammkatalog Abschnitt 5): ein Segment wählt kein
  // Objekt, es setzt den Filter auf die Tragfähigkeitskategorie — dieselbe
  // Objektfläche, aber jetzt mit der "measure"-Liste dieser Kategorie.
  if (node.dataset.objectType === 'viabilityCategory') {
    filterKey = `viability:${node.dataset.objectId}`;
    searchText = '';
    renderAll();
    return;
  }
  selectChartElement(node);
}

// Initiale Datenerfassung: der aktuelle Filter bestimmt eindeutig, welcher
// Objekttyp entstehen würde (Kriterium 6: ein Filter zeigt genau einen
// Objekttyp) — der Button erscheint daher nur bei einem der vier
// anlegbaren Objekttyp-Filter, nicht bei "Alles" oder gespeicherten Filtern.
function addObjectBarHtml() {
  const def = creatableObjectTypes[filterKey];
  if (!def) return '';
  return `<div class="akte-add-bar"><button type="button" class="akte-add-button" data-add-object-type="${esc(filterKey)}">+ ${esc(def.label)} anlegen</button></div>`;
}

// Anhang A2: macht das Ausblenden beitragsloser Maßnahmen sichtbar, statt es
// stillschweigend zu tun — sonst wirkt die Kennzahlkachel wie ein Filter, der
// weniger Maßnahmen kennt, als tatsächlich existieren.
function kpiExclusionNoteHtml(kpiExcludedCount) {
  if (!filterKey.startsWith('kpi:') || !kpiExcludedCount) return '';
  return `<p class="akte-filter-note">${kpiExcludedCount} Maßnahme${kpiExcludedCount === 1 ? '' : 'n'} ohne Beitrag zu dieser Kennzahl ausgeblendet.</p>`;
}

function renderObjectSurface(visible, clarifications, kpiExcludedCount = 0) {
  const node = document.getElementById('akteObjectSurface');
  const addBar = addObjectBarHtml();
  const exclusionNote = kpiExclusionNoteHtml(kpiExcludedCount);
  const chartSection = renderChartSectionHtml(visible);
  if (!visible.length) {
    node.innerHTML = renderPhaseWarningHtml() + addBar + exclusionNote + chartSection + '<div class="akte-empty-state">Keine Objekte in diesem Filter.</div>';
    return;
  }
  const p = currentParams();
  node.innerHTML = renderPhaseWarningHtml() + addBar + exclusionNote + chartSection + renderObjectListHtml(visible) + renderObjectDetailHtml(selectedType, selectedId, clarifications, p);
}

// ---------------------------------------------------------------------------
// Kontextspalte (Abschnitt 4.3, rechte Spalte) — generisch über alle
// Objekttypen; nur Maßnahmen haben eine "Wirkung dieses Objekts"-Rechnung.
// ---------------------------------------------------------------------------

function emptyContextHtml() {
  return '<div class="akte-empty-state">Kein Objekt ausgewählt.</div>';
}

// Mikro-Verlauf (Abschnitt 4.1): 280×90 px, keine Achsenbeschriftung, keine
// Legende, keine Interaktion, kein Klickziel — reine Form, kein Diagramm im
// Sinn von Abschnitt 3 (deshalb aria-hidden statt eigener Beschreibung; die
// zugrunde liegenden Werte stehen bereits als Zahl in den Metriken
// darunter/im Satz, Kriterium V10). Entfällt ersatzlos für alle anderen
// Objekttypen als "measure".
function renderMeasureMicroFlowSvg(microFlow) {
  const rows = microFlow.rows;
  if (!rows.length) return '';
  const width = 280;
  const height = 90;
  const padding = 2;
  const stackTotals = rows.map(row => row.depreciation + row.capitalReturn);
  const lineValues = [...rows.map(row => row.regulatoryEogEffect), ...rows.map(row => row.indicativeCashflow)];
  const yMax = Math.max(0, ...stackTotals, ...lineValues);
  const yMin = Math.min(0, ...stackTotals, ...lineValues);
  const xScale = linearScale(0, Math.max(1, rows.length - 1), padding, width - padding);
  const yScale = linearScale(yMin, yMax || 1, height - padding, padding);
  const zeroY = yScale(0);
  const topPoints = rows.map((row, index) => `${xScale(index)},${yScale(row.depreciation + row.capitalReturn)}`);
  const areaPath = `M${xScale(0)},${zeroY} L${topPoints.join(' L')} L${xScale(rows.length - 1)},${zeroY} Z`;
  const linePoints = key => rows.map((row, index) => `${xScale(index)},${yScale(row[key])}`).join(' ');
  return `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="akte-micro-chart" aria-hidden="true" focusable="false">
      <path d="${areaPath}" class="akte-micro-chart-area"></path>
      <polyline points="${linePoints('regulatoryEogEffect')}" class="akte-micro-chart-line akte-micro-chart-line--eog"></polyline>
      <polyline points="${linePoints('indicativeCashflow')}" class="akte-micro-chart-line akte-micro-chart-line--cashflow"></polyline>
    </svg>
  `;
}

function renderMeasureContext(node, measure, clarifications, p) {
  const drilldown = measureDrilldownFor(measure, p);
  const microFlow = measureMicroFlowModel(measure, p);
  const related = clarifications.filter(item => item.measureId === measure.id);
  const evidence = evidenceGaps('measure', measure);
  const events = historyEventsFor('measure', measure.id).slice(-6).reverse();
  node.innerHTML = `
    <div class="akte-context-section">
      <h3>Wirkung dieses Objekts</h3>
      ${renderMeasureMicroFlowSvg(microFlow)}
      <div class="akte-context-metric"><span>EOG Jahr 1</span><strong>${esc(fmtTeur(drilldown.rows?.[0]?.regulatoryEogEffect || 0, 1))}</strong></div>
      <div class="akte-context-metric"><span>${esc(drilldown.returnMetricLabel || 'IRR')}</span><strong>${Number.isFinite(drilldown.returnMetricValue) ? esc(fmtPct(drilldown.returnMetricValue * 100, 1)) : '–'}</strong></div>
      <div class="akte-context-metric"><span>Kapitalwert</span><strong>${esc(fmtTeur(drilldown.npvTeur || 0, 1))}</strong></div>
    </div>
    ${contextSectionHtml('Offene Punkte', related, item => `${esc(item.title)} · ${esc(item.priority?.label || '')}`, 'Keine offenen Punkte für dieses Objekt.')}
    ${contextSectionHtml('Herkunft', evidence, gap => `${esc(gap.key)}: Evidenz (${esc(gap.evidenceKey)}) fehlt`, 'Keine offenen Evidenzlücken erkannt.')}
    ${historySectionHtml(events)}
  `;
}

function contextSectionHtml(title, items, render, emptyText) {
  return `
    <div class="akte-context-section">
      <h3>${esc(title)} (${items.length})</h3>
      ${items.length ? items.slice(0, 8).map(item => `<span class="akte-open-point">${render(item)}</span>`).join('') : `<span class="akte-open-point">${esc(emptyText)}</span>`}
    </div>
  `;
}

function historySectionHtml(events) {
  return `
    <div class="akte-context-section">
      <h3>Verlauf</h3>
      ${events.length
        ? events.map(event => `<div class="akte-history-event">${esc(eventSummary(event))}</div>`).join('')
        : '<div class="akte-history-event">Noch keine Änderungen protokolliert.</div>'}
    </div>
  `;
}

function renderGenericContext(node, objectType, objectId, object, clarifications) {
  const gaps = evidenceGaps(objectType, object);
  const related = objectType === 'sidecarObject'
    ? clarifications.filter(item => item.sidecarId === objectId)
    : [];
  const events = historyEventsFor(objectType, objectId).slice(-6).reverse();
  node.innerHTML = `
    ${contextSectionHtml('Offene Punkte', related, item => `${esc(item.title)} · ${esc(item.priority?.label || '')}`, 'Keine offenen Punkte für dieses Objekt.')}
    ${contextSectionHtml('Herkunft', gaps, gap => `${esc(gap.key)}: Evidenz (${esc(gap.evidenceKey)}) fehlt`, 'Keine offenen Evidenzlücken erkannt.')}
    ${historySectionHtml(events)}
  `;
}

function renderClarificationContext(node, item) {
  node.innerHTML = `
    <div class="akte-context-section">
      <h3>Klärpunkt</h3>
      <div class="akte-context-metric"><span>Priorität</span><strong>${esc(item.priority?.label || '')}</strong></div>
      <div class="akte-context-metric"><span>Treiber</span><strong>${esc(item.priority?.driver || '')}</strong></div>
      <div class="akte-context-metric"><span>Zielphase</span><strong>${esc(item.targetPhase || '')}</strong></div>
    </div>
  `;
}

// Jahresmarkierung (Abschnitt 7.2): die Kontextspalte bezieht sich auf das
// markierte Jahr, solange eine Markierung im Verlaufsdiagramm aktiv ist —
// unabhängig davon, welches Objekt sonst gerade ausgewählt ist.
function renderYearContext(node, year) {
  const row = currentPortfolio().yearly.find(item => item.year === year);
  if (!row) { node.innerHTML = emptyContextHtml(); return; }
  node.innerHTML = `
    <div class="akte-context-section">
      <h3>Jahr ${esc(year)}</h3>
      ${eogFlowStackOrder.map(([key, label]) => `<div class="akte-context-metric"><span>${esc(label)}</span><strong>${esc(fmtTeur(row[key] || 0, 1))}</strong></div>`).join('')}
      <div class="akte-context-metric"><span>Indikativer Cashflow</span><strong>${esc(fmtTeur(row.indicativeCashflow || 0, 1))}</strong></div>
      <div class="akte-context-metric"><span>Kumulierte Brücke</span><strong>${esc(fmtTeur(row.bridgeCumulative || 0, 1))}</strong></div>
    </div>
    <button type="button" class="akte-chart-year-clear" data-chart-year-clear>Markierung aufheben</button>
  `;
}

function renderContextColumn(clarifications) {
  const node = document.getElementById('akteContextColumn');
  if (chartTypeByFilter[filterKey] === 'eogFlow' && chartYearMarker !== null) {
    renderYearContext(node, chartYearMarker);
    return;
  }
  const p = currentParams();
  if (selectedType === 'measure') {
    const measure = model.measures.find(item => item.id === selectedId);
    if (!measure) { node.innerHTML = emptyContextHtml(); return; }
    renderMeasureContext(node, measure, clarifications, p);
    return;
  }
  if (selectedType === 'clarification') {
    const item = clarifications.find(entry => entry.key === selectedId);
    if (!item) { node.innerHTML = emptyContextHtml(); return; }
    renderClarificationContext(node, item);
    return;
  }
  const object = resolveObject(selectedType, selectedId);
  if (!object) { node.innerHTML = emptyContextHtml(); return; }
  renderGenericContext(node, selectedType, objectIdForState(selectedType, selectedId), object, clarifications);
}

// ---------------------------------------------------------------------------
// Wert-Popover (Inline-Editor)
// ---------------------------------------------------------------------------

let activePopoverTarget = null;

function closePopover() {
  const popover = document.getElementById('akteValuePopover');
  popover.classList.add('hidden');
  popover.innerHTML = '';
  if (activePopoverTarget) activePopoverTarget.focus();
  activePopoverTarget = null;
}

const referenceLabelKeys = { measure: 'name', objective: 'label', sidecarObject: 'title', sidecarSource: 'title' };

function referenceCollection(targetType) {
  if (targetType === 'objective') {
    model.strategy.objectives = model.strategy.objectives || [];
    return model.strategy.objectives;
  }
  if (targetType === 'sidecarObject') {
    model.sidecar.objects = model.sidecar.objects || [];
    return model.sidecar.objects;
  }
  if (targetType === 'sidecarSource') {
    model.sidecar.sources = model.sidecar.sources || [];
    return model.sidecar.sources;
  }
  return model.measures;
}

function newObjectId(targetType) {
  return `${targetType}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function createBareObject(targetType, title) {
  const id = newObjectId(targetType);
  if (targetType === 'measure') return normalizeMeasure({ id, name: title, sector: model.inputs.sector }, model.measures.length, {});
  if (targetType === 'objective') return { id, label: title, note: '' };
  if (targetType === 'sidecarObject') return normalizeSidecarObject({ id, title });
  if (targetType === 'sidecarSource') return normalizeSidecarSource({ id, title });
  return null;
}

// Stellvertreterobjekt nach Wiki-Muster (Spezifikation 6.2, Lückenart 3):
// referenziert der Nutzer einen Namen, für den weder eine ID noch ein
// bestehendes Label passt, entsteht sofort ein neues Objekt mit Status
// "vorläufig" (model.provisionalIds) statt eines toten Verweises.
function resolveOrCreateReference(targetType, text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  const collection = referenceCollection(targetType);
  const labelKey = referenceLabelKeys[targetType];
  const existing = collection.find(item => item.id === trimmed || String(item[labelKey] || '').toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.id;
  const created = createBareObject(targetType, trimmed);
  if (!created) return trimmed;
  collection.push(created);
  model.provisionalIds[targetType] = model.provisionalIds[targetType] || [];
  model.provisionalIds[targetType].push(created.id);
  return created.id;
}

// Direkte Neuanlage (initiale Datenerfassung): der "+ Neu"-Button in der
// Objektliste legt ein Objekt mit demselben Grundgerüst wie das
// Stellvertreterobjekt-Muster an, aber bewusst gewählt statt aus einer
// unaufgelösten Referenz entstanden — deshalb ohne provisorischen Status.
const creatableObjectTypes = {
  measure: { label: 'Maßnahme', defaultTitle: 'Neue Maßnahme' },
  objective: { label: 'Ziel', defaultTitle: 'Neues Ziel' },
  sidecarObject: { label: 'Kontextobjekt', defaultTitle: 'Neues Kontextobjekt' },
  sidecarSource: { label: 'Quelle', defaultTitle: 'Neue Quelle' }
};

function addNewObject(objectType) {
  const def = creatableObjectTypes[objectType];
  if (!def) return;
  const created = createBareObject(objectType, def.defaultTitle);
  if (!created) return;
  referenceCollection(objectType).push(created);
  selectedType = objectType;
  selectedId = created.id;
  filterKey = objectType;
  searchText = '';
  afterMutation();
  showToast(`${def.label} angelegt.`);
}

// Alles, was angelegt werden kann, muss auch wieder gelöscht werden können —
// dieselben vier Objekttypen wie addNewObject(). Referenzen auf ein
// gelöschtes Objekt (z. B. sidecarObject.linkedMeasures auf eine gelöschte
// Maßnahme) werden nicht aufgeräumt, sondern laufen bewusst in die bereits
// vorhandene Lückenart 3 ("fehlendes Objekt") — dieselbe Erkennung, die auch
// eine von Anfang an falsche Referenz meldet.
function deleteObject(objectType, objectId) {
  const def = creatableObjectTypes[objectType];
  if (!def) return;
  const collection = referenceCollection(objectType);
  const object = collection.find(item => item.id === objectId);
  if (!object) return;
  const label = object[referenceLabelKeys[objectType]] || def.defaultTitle;
  if (!window.confirm(`${def.label} "${label}" wirklich löschen?`)) return;
  collection.splice(collection.indexOf(object), 1);
  clearProvisional(objectType, objectId);
  if (model.openDecisions) delete model.openDecisions[objectId];
  afterMutation();
  showToast(`${def.label} gelöscht.`);
}

function isProvisional(objectType, id) {
  return Boolean(model.provisionalIds?.[objectType]?.includes(id));
}

function clearProvisional(objectType, id) {
  if (!model.provisionalIds?.[objectType]) return;
  model.provisionalIds[objectType] = model.provisionalIds[objectType].filter(item => item !== id);
}

function helperNoteFor(descriptor, object) {
  const fn = descriptor.helper ? helperFunctions[descriptor.helper] : null;
  if (!fn) return '';
  try {
    const result = fn(object);
    const text = result?.note || result?.chain || result?.clarification || '';
    return text ? `<div class="akte-popover-helper">${esc(text)}</div>` : '';
  } catch (_error) {
    return '';
  }
}

function inputControlFor(descriptor, value) {
  const id = 'akteFieldInput';
  if (descriptor.type === 'bool') {
    return `<input id="${id}" type="checkbox" ${value ? 'checked' : ''}>`;
  }
  if (descriptor.type === 'select') {
    const options = descriptor.options || [];
    return `<select id="${id}">${options.map(option => {
      const optionLabel = descriptor.optionLabels?.[option] || option || '(leer)';
      return `<option value="${esc(option)}" ${String(value) === String(option) ? 'selected' : ''}>${esc(optionLabel)}</option>`;
    }).join('')}</select>`;
  }
  if (descriptor.type === 'number' || descriptor.type === 'percent' || descriptor.type === 'teur' || descriptor.type === 'year') {
    return `<input id="${id}" type="number" step="any" value="${esc(value ?? '')}">`;
  }
  if (Array.isArray(value)) {
    return `<input id="${id}" type="text" value="${esc(value.join(', '))}">`;
  }
  return `<input id="${id}" type="text" value="${esc(value ?? '')}">`;
}

function parseControlValue(descriptor, rawOriginal) {
  const input = document.getElementById('akteFieldInput');
  if (descriptor.type === 'bool') return input.checked;
  if (descriptor.type === 'number' || descriptor.type === 'percent' || descriptor.type === 'teur' || descriptor.type === 'year') {
    const parsed = Number(String(input.value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (Array.isArray(rawOriginal)) {
    return input.value.split(',').map(part => part.trim()).filter(Boolean);
  }
  return input.value;
}

function openPopover(button) {
  const key = button.dataset.editKey;
  const objectType = button.dataset.objectType;
  const objectId = button.dataset.objectId;
  const object = resolveObject(objectType, objectId);
  const descriptor = fieldDescriptorsFor(objectType).find(item => item.key === key);
  if (!object || !descriptor) return;
  activePopoverTarget = button;
  const popover = document.getElementById('akteValuePopover');
  const currentValue = object[key];
  const stateObjectId = objectIdForState(objectType, objectId);
  const state = valueState(objectType, key, currentValue, { object, objectId: stateObjectId, history, openDecisions: model.openDecisions });
  const referenceTarget = referenceFieldsFor(objectType)[key];

  popover.innerHTML = `
    <div class="akte-popover-title">${esc(descriptor.label)}</div>
    <div class="akte-popover-state">Zustand: ${esc(state.state)}${descriptor.default !== undefined ? ` · Vorbelegung: ${esc(formattedValue(descriptor, descriptor.default))}` : ''}</div>
    <label for="akteFieldInput">${esc(descriptor.label)}${descriptor.unit ? ` (${esc(descriptor.unit)})` : ''}</label>
    ${inputControlFor(descriptor, currentValue)}
    ${referenceTarget ? `<div class="akte-popover-helper">Verweist auf ${esc(objectTypeLabels[referenceTarget.targetType])}. Ein noch unbekannter Name legt sofort ein vorläufiges ${esc(objectTypeLabels[referenceTarget.targetType])}-Objekt an.</div>` : ''}
    ${descriptor.evidenceKey ? `<label for="akteEvidenceInput">Quelle / Evidenz (${esc(descriptor.evidenceKey)})</label><input id="akteEvidenceInput" type="text" value="${esc(object[descriptor.evidenceKey] ?? '')}">` : ''}
    ${helperNoteFor(descriptor, object)}
    <button type="button" class="akte-open-decision-toggle" id="akteOpenDecisionToggle">bewusst offen lassen …</button>
    <div id="akteOpenDecisionArea" class="hidden">
      <label for="akteOpenDecisionReason">Begründung (erforderlich)</label>
      <textarea id="akteOpenDecisionReason" placeholder="Warum bleibt dieses Feld offen?"></textarea>
      <div class="akte-popover-actions">
        <button type="button" id="akteOpenDecisionCancel">Abbrechen</button>
        <button type="button" class="primary" id="akteOpenDecisionSave">Als offen markieren</button>
      </div>
    </div>
    <div class="akte-popover-actions" id="akteMainActions">
      <button type="button" id="aktePopoverCancel">Abbrechen</button>
      <button type="button" class="primary" id="aktePopoverSave">Speichern</button>
    </div>
  `;
  popover.classList.remove('hidden');
  positionPopover(popover, button);

  document.getElementById('aktePopoverCancel').addEventListener('click', closePopover);
  document.getElementById('aktePopoverSave').addEventListener('click', () => {
    let nextValue = parseControlValue(descriptor, currentValue);
    const referenceTarget = referenceFieldsFor(objectType)[key];
    if (referenceTarget) {
      nextValue = referenceTarget.multi
        ? (Array.isArray(nextValue) ? nextValue : []).map(text => resolveOrCreateReference(referenceTarget.targetType, text))
        : resolveOrCreateReference(referenceTarget.targetType, nextValue);
    }
    object[key] = nextValue;
    if (descriptor.evidenceKey) {
      const evidenceInput = document.getElementById('akteEvidenceInput');
      if (evidenceInput) object[descriptor.evidenceKey] = evidenceInput.value;
    }
    if (model.openDecisions?.[stateObjectId]) delete model.openDecisions[stateObjectId][key];
    clearProvisional(objectType, stateObjectId);
    confirmFieldIfStillDefault(objectType, stateObjectId, key, object[key], object);
    afterMutation();
    closePopover();
  });
  document.getElementById('akteOpenDecisionToggle').addEventListener('click', () => {
    document.getElementById('akteOpenDecisionArea').classList.toggle('hidden');
  });
  document.getElementById('akteOpenDecisionCancel').addEventListener('click', () => {
    document.getElementById('akteOpenDecisionArea').classList.add('hidden');
  });
  document.getElementById('akteOpenDecisionSave').addEventListener('click', () => {
    const reason = document.getElementById('akteOpenDecisionReason').value.trim();
    if (!reason) return;
    model.openDecisions[stateObjectId] = model.openDecisions[stateObjectId] || {};
    model.openDecisions[stateObjectId][key] = { reason, author, timestamp: new Date().toISOString() };
    afterMutation();
    closePopover();
  });

  const firstControl = document.getElementById('akteFieldInput');
  firstControl?.focus();
}

function positionPopover(popover, anchor) {
  const rect = anchor.getBoundingClientRect();
  const top = window.scrollY + rect.bottom + 6;
  let left = window.scrollX + rect.left;
  const maxLeft = window.scrollX + document.documentElement.clientWidth - 380;
  if (left > maxLeft) left = Math.max(8, maxLeft);
  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
}

// ---------------------------------------------------------------------------
// Phasenübergang (Abschnitt 6.6, Kriterium 10)
//
// Entscheidung des Auftraggebers (Spezifikation 11.3): der Übergang nach
// entscheidungsvorlage warnt bei offenen Lücken, blockiert aber nicht — die
// alte Oberfläche kennt ebenfalls keine Sperre (setProcessPhase in ui.js
// wechselt ungeprüft).
// ---------------------------------------------------------------------------

function allMissingValueFields() {
  const entries = [];
  const collect = (objectType, objectId, object) => {
    missingValueFields(objectType, object, { objectId, history, openDecisions: model.openDecisions })
      .forEach(entry => entries.push({ objectType, objectId, key: entry.key }));
  };
  model.measures.forEach(measure => collect('measure', measure.id, measure));
  collect('input', inputsObjectId, model.inputs);
  (model.strategy.objectives || []).forEach(objective => collect('objective', objective.id, objective));
  (model.sidecar.objects || []).forEach(object => collect('sidecarObject', object.id, object));
  (model.sidecar.sources || []).forEach(source => collect('sidecarSource', source.id, source));
  return entries;
}

function renderPhaseSelect() {
  const select = document.getElementById('aktePhaseSelect');
  select.innerHTML = processPhases.map(([id, label]) => `<option value="${esc(id)}" ${model.process.phase === id ? 'selected' : ''}>${esc(label)}</option>`).join('');
}

function setPhase(nextPhase) {
  if (!processPhases.some(([id]) => id === nextPhase) || model.process.phase === nextPhase) return;
  model.process = normalizeProcessState({ ...model.process, phase: nextPhase });
  afterMutation();
  if (nextPhase === 'entscheidungsvorlage') {
    const gapCount = allMissingValueFields().length;
    if (gapCount > 0) {
      showToast(`Entscheidungsvorlage: ${gapCount} Lücke(n) sind weder gesetzt noch bewusst offen gelassen.`);
    }
  }
}

function renderPhaseWarningHtml() {
  if (model.process.phase !== 'entscheidungsvorlage') return '';
  const gapCount = allMissingValueFields().length;
  if (!gapCount) return '';
  return `
    <div class="akte-phase-warning">
      <strong>Entscheidungsvorlage bei offenen Lücken</strong>
      ${esc(gapCount)} Feld(er) im Arbeitsstand sind weder gesetzt noch bewusst offen gelassen (Abschnitt 6.6). Der Übergang bleibt möglich; vor der Sitzung sollten diese Felder durchgegangen werden.
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Kantenvorschläge (Abschnitt 6.2 Lückenart 4)
// ---------------------------------------------------------------------------

const suggestionFilterFor = {
  'measure-objective': 'without-objective'
};

function renderSuggestions() {
  const edges = suggestedEdges(model);
  if (!edges.length) return '';
  return `
    <div class="akte-filter-group">
      <h3>Vorschläge</h3>
      ${edges.map(edge => `
        <button type="button" class="akte-suggestion-item" data-suggestion-filter="${esc(suggestionFilterFor[edge.type] || 'all')}">
          ${esc(edge.label)}
        </button>
      `).join('')}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Zustand ändern -> neu rendern
// ---------------------------------------------------------------------------

function afterMutation() {
  saveToStorage(true);
  renderAll();
}

function renderAll() {
  // Die Jahresmarkierung gilt nur innerhalb des Verlaufsdiagramms — verlässt
  // man dessen Filter (gleich auf welchem Weg: Filterspalte, KPI-Kachel,
  // Debug-Schnittstelle), wird sie zurückgesetzt statt unsichtbar liegen zu
  // bleiben und bei Rückkehr überraschend wieder aufzutauchen.
  if (chartTypeByFilter[filterKey] !== 'eogFlow') chartYearMarker = null;
  const portfolio = currentPortfolio();
  const clarifications = currentClarifications(portfolio);
  const entries = listEntries(clarifications);
  const { list: visible, kpiExcludedCount } = filteredEntries(entries, portfolio);
  // Wenn der aktuelle Filter (noch) nichts zeigt, bleibt die Auswahl trotzdem
  // gültig — sie fällt auf irgendein vorhandenes Objekt zurück, damit sie
  // nicht auf eine gelöschte ID zeigt. Angezeigt wird dabei aber weiterhin
  // die tatsächlich gefilterte (ggf. leere) Liste, nicht heimlich alle
  // Objekte — sonst verdeckt ein "+ Neu"-Button unbemerkt ein fremdes Objekt
  // (siehe initiale Datenerfassung: leerer Maßnahmen-Filter).
  const selectionPool = visible.length ? visible : entries;
  if (selectionPool.length && !selectionPool.some(entry => entry.objectType === selectedType && entry.id === selectedId)) {
    selectedType = selectionPool[0].objectType;
    selectedId = selectionPool[0].id;
  }
  document.getElementById('akteSectorLabel').textContent = model.inputs.sector === 'gas' ? 'Gas' : 'Strom';
  renderPhaseSelect();
  renderKpiStrip(portfolio, clarifications);
  renderFilterColumn(entries);
  renderObjectSurface(visible, clarifications, kpiExcludedCount);
  renderContextColumn(clarifications);
}

function showToast(text) {
  const toast = document.getElementById('akteToast');
  toast.textContent = text;
  toast.classList.remove('hidden');
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => toast.classList.add('hidden'), 2600);
}

// ---------------------------------------------------------------------------
// Ausgaben (Abschnitt 4.5) — Aktionen im Kopfbereich, kein eigener View.
// Report/Befassungsvorlage sind ein neuer, kompakter Textbaustein (die
// Objektfläche hat kein Äquivalent zu ui.js' renderReport); KI-Prompt,
// Tabellenexport und Support-Paket nutzen spreadsheet-export.js,
// ai-prompt-generator.js, export-utils.js und release-awareness.js
// unverändert, wie in Abschnitt 4.5 gefordert.
// ---------------------------------------------------------------------------

let outputTab = 'report';

function activeRulesetInfo() {
  return rulesetInfo(regulatoryParameterSet);
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

function currentSupportContext() {
  return supportContext({
    ...localReleaseContext(),
    ruleset: activeRulesetInfo(),
    lastReleaseCheck: null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
  });
}

function currentSpreadsheetTables() {
  return spreadsheetTables(currentModelData(), { buildInfo, ruleset: activeRulesetInfo() });
}

function aiPromptOptionsFromUi() {
  return {
    ...defaultAiPromptOptions,
    roleId: document.getElementById('akteAiPromptRole')?.value || defaultAiPromptOptions.roleId
  };
}

function currentAiPrompt() {
  return buildAiPrompt(currentModelData(), aiPromptOptionsFromUi(), { buildInfo, ruleset: activeRulesetInfo() });
}

function reportSegmentationRowsHtml(segmentation) {
  const labels = {
    corePortfolio: 'Kernportfolio',
    scopeCandidate: 'Scope-Kandidat',
    optionSensitive: 'Optionssensitiv',
    contextObject: 'Kontextobjekt',
    flexibilityObject: 'Flexibilitätsobjekt',
    excluded: 'Ausgeschlossen'
  };
  return Object.entries(labels).map(([key, label]) => {
    const bucket = segmentation[key] || { count: 0, invest: 0, yearOneRegulatoryEog: 0 };
    return `<tr><td>${esc(label)}</td><td>${bucket.count}</td><td>${esc(fmtTeur(bucket.invest || 0, 0))}</td><td>${esc(fmtTeur(bucket.yearOneRegulatoryEog || 0, 1))}</td></tr>`;
  }).join('');
}

// Große Fassung aller sechs Diagramme (Abschnitt 4.3) für Bericht/Druck: mit
// Achsen, gemeinsamer Legende und Quellenzeile. Zeigt bewusst den gesamten
// Arbeitsstand (nicht die zuletzt gewählte Objektflächen-Filtermenge) — der
// Bericht ist eine eigenständige Zusammenfassung, kein Abbild des gerade
// aktiven Bildschirms.
function buildChartsSectionHtml() {
  const portfolio = currentPortfolio();
  const p = currentParams();
  const context = { history, openDecisions: model.openDecisions };
  const clarifications = currentClarifications(portfolio);
  const charts = [
    { title: 'Risikomatrix', chart: riskMatrixModel(model.measures, context), svg: renderRiskMatrixSvg },
    { title: 'Liquiditäts-/EOG-Verlauf', chart: eogFlowModel(portfolio, context), svg: renderEogFlowSvg },
    { title: 'Wasserfall', chart: waterfallModel(portfolio, context), svg: renderWaterfallSvg },
    { title: 'Beitragsbalken', chart: contributionBarsModel(portfolio, context), svg: renderContributionBarsSvg },
    { title: 'Wirkungsrangliste', chart: tornadoModel({ measures: model.measures, inputs: model.inputs }, p, clarifications, context), svg: renderTornadoSvg },
    { title: 'Segmentbalken', chart: viabilitySegmentsModel({ measures: model.measures }, model.inputs, context), svg: renderViabilitySegmentsSvg }
  ];
  const sections = charts.map(({ title, chart, svg }) => `
    <div class="akte-output-chart">
      <h4>${esc(title)}</h4>
      ${chart.emptyReason
        ? `<p class="akte-chart-empty">${esc(chart.emptyReason)}</p>`
        : svg(chart, { selectedType, selectedId, yearMarker: null, axis: true, width: 720, height: 320 })}
    </div>
  `).join('');
  return `
    <h3>Diagramme</h3>
    ${chartValueStateLegendHtml()}
    ${sections}
    ${chartSourceLineHtml()}
  `;
}

function buildReportHtml() {
  const portfolio = currentPortfolio();
  const clarifications = currentClarifications(portfolio);
  const decision = portfolioDecisionMetrics(portfolio);
  const openClarifications = clarifications.filter(item => item.status !== 'closed').sort((a, b) => a.priority.level - b.priority.level);
  const p = currentParams();
  return `
    <h3>${esc(p.sector === 'gas' ? 'Gas' : 'Strom')} · Report / Befassungsvorlage</h3>
    <p class="akte-object-subtitle">Stand ${esc(new Date().toLocaleDateString('de-DE'))} · Phase ${esc(processPhases.find(([id]) => id === model.process.phase)?.[1] || model.process.phase)}</p>
    <table class="akte-output-table">
      <tbody>
        ${kpiDefinitions.map(def => `<tr><td>${esc(def.label)}</td><td>${esc(def.format(def.compute(portfolio)))}</td></tr>`).join('')}
        <tr><td>Entscheidungstendenz</td><td>${esc(decision.governanceDecision.title)}</td></tr>
      </tbody>
    </table>
    <p>${esc(decision.governanceDecision.text)} ${esc(decision.governanceDecision.recommendation)}</p>
    <h3>Segmentierung</h3>
    <table class="akte-output-table">
      <thead><tr><th>Klasse</th><th>Anzahl</th><th>Invest</th><th>EOG Jahr 1</th></tr></thead>
      <tbody>${reportSegmentationRowsHtml(portfolio.portfolioSegmentation)}</tbody>
    </table>
    ${buildChartsSectionHtml()}
    <h3>Wichtigste offene Punkte (${openClarifications.length})</h3>
    <table class="akte-output-table">
      <thead><tr><th>Titel</th><th>Bereich</th><th>Priorität</th></tr></thead>
      <tbody>${openClarifications.slice(0, 10).map(item => `<tr><td>${esc(item.title)}</td><td>${esc(item.area || '')}</td><td>${esc(item.priority.label)}</td></tr>`).join('') || '<tr><td colspan="3">Keine offenen Punkte.</td></tr>'}</tbody>
    </table>
    <h3>Beschlussvorschlag (${esc(model.committee.body || 'Gremium')})</h3>
    <p>${esc(model.committee.proposalText || 'Noch kein Beschlussvorschlag hinterlegt (Rahmen: Befassung).')}</p>
  `;
}

function outputTabs() {
  return [
    { key: 'report', label: 'Report' },
    { key: 'ai-prompt', label: 'KI-Prompt' },
    { key: 'tables', label: 'Tabellen' },
    { key: 'support', label: 'Support-Paket' }
  ];
}

function renderOutputBody() {
  const body = document.getElementById('akteOutputBody');
  if (outputTab === 'report') {
    body.innerHTML = `${buildReportHtml()}<div class="akte-output-actions"><button type="button" id="akteReportPrint">Report drucken</button></div>`;
    document.getElementById('akteReportPrint')?.addEventListener('click', () => window.print());
    return;
  }
  if (outputTab === 'ai-prompt') {
    body.innerHTML = `
      <label class="akte-output-field" for="akteAiPromptRole">Zielgruppe</label>
      <select id="akteAiPromptRole" class="akte-output-select">${promptRoles.map(role => `<option value="${esc(role.id)}">${esc(role.title)}</option>`).join('')}</select>
      <div class="akte-output-actions"><button type="button" id="akteAiPromptCopy">In Zwischenablage kopieren</button></div>
      <textarea id="akteAiPromptOutput" readonly></textarea>
    `;
    const select = document.getElementById('akteAiPromptRole');
    select.value = defaultAiPromptOptions.roleId;
    const refresh = () => { document.getElementById('akteAiPromptOutput').value = currentAiPrompt(); };
    refresh();
    select.addEventListener('change', refresh);
    document.getElementById('akteAiPromptCopy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(document.getElementById('akteAiPromptOutput').value);
        showToast('Prompt in Zwischenablage kopiert.');
      } catch (_error) {
        showToast('Kopieren nicht möglich; Text manuell markieren.');
      }
    });
    return;
  }
  if (outputTab === 'tables') {
    body.innerHTML = `
      <p>Maßnahmen, KPIs, Segmentierung und Provenienz als Arbeitsmappe oder CSV-Archiv (spreadsheet-export.js, unverändert).</p>
      <div class="akte-output-actions">
        <button type="button" id="akteExportXlsx">Als XLSX exportieren</button>
        <button type="button" id="akteExportCsvZip">Als CSV-ZIP exportieren</button>
      </div>
    `;
    document.getElementById('akteExportXlsx').addEventListener('click', () => {
      const state = collectModelState();
      const workbook = tablesToXlsx(currentSpreadsheetTables());
      downloadBlob(new Blob([workbook], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'digitale-akte-tabellen-' + exportStamp(state) + '.xlsx');
      showToast('XLSX-Arbeitsmappe vorbereitet.');
    });
    document.getElementById('akteExportCsvZip').addEventListener('click', () => {
      const state = collectModelState();
      const archive = tablesToCsvZip(currentSpreadsheetTables());
      downloadBlob(new Blob([archive], { type: 'application/zip' }), 'digitale-akte-tabellen-csv-' + exportStamp(state) + '.zip');
      showToast('CSV-ZIP vorbereitet.');
    });
    return;
  }
  if (outputTab === 'support') {
    body.innerHTML = `
      <p>Support-Paket enthält nur App-/Ruleset-/Browser-Kontext, keine Modell- oder Maßnahmenwerte.</p>
      <div class="akte-output-actions"><button type="button" id="akteExportSupport">Support-Paket herunterladen</button></div>
    `;
    document.getElementById('akteExportSupport').addEventListener('click', () => {
      const payload = supportPackage(currentSupportContext());
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'digitale-akte-support-kontext-' + payload.createdAt.slice(0, 19).replaceAll(':', '').replace('T', '-') + '.json');
      showToast('Support-Paket ohne Modelldaten vorbereitet.');
    });
  }
}

function renderOutputTabs() {
  document.getElementById('akteOutputTabs').innerHTML = outputTabs().map(tab => `
    <button type="button" class="${tab.key === outputTab ? 'active' : ''}" data-output-tab="${esc(tab.key)}">${esc(tab.label)}</button>
  `).join('');
}

function openOutputWindow() {
  outputTab = 'report';
  renderOutputTabs();
  renderOutputBody();
  document.getElementById('akteOutputOverlay').classList.remove('hidden');
}

function closeOutputWindow() {
  document.getElementById('akteOutputOverlay').classList.add('hidden');
}

// ---------------------------------------------------------------------------
// Ereignisse
// ---------------------------------------------------------------------------

function wireEvents() {
  document.getElementById('akteContextColumn').addEventListener('click', event => {
    const clearButton = event.target.closest('[data-chart-year-clear]');
    if (clearButton) {
      chartYearMarker = null;
      renderAll();
    }
  });

  document.getElementById('akteKpiStrip').addEventListener('click', event => {
    const button = event.target.closest('[data-kpi]');
    if (!button) return;
    const kpi = button.dataset.kpi;
    filterKey = kpi === 'open' || kpi === 'reliability' ? 'clarification' : `kpi:${kpi}`;
    renderAll();
    document.getElementById('akteObjectSurface').focus();
  });

  document.getElementById('akteFilterColumn').addEventListener('click', event => {
    const suggestionButton = event.target.closest('[data-suggestion-filter]');
    if (suggestionButton) {
      filterKey = suggestionButton.dataset.suggestionFilter;
      renderAll();
      return;
    }
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    filterKey = button.dataset.filter;
    renderAll();
  });

  document.getElementById('akteObjectSurface').addEventListener('click', event => {
    const addButton = event.target.closest('[data-add-object-type]');
    if (addButton) {
      addNewObject(addButton.dataset.addObjectType);
      return;
    }
    const deleteButton = event.target.closest('[data-delete-object-type]');
    if (deleteButton) {
      deleteObject(deleteButton.dataset.deleteObjectType, deleteButton.dataset.deleteObjectId);
      return;
    }
    const chartCollapseToggle = event.target.closest('[data-chart-toggle-collapse]');
    if (chartCollapseToggle) {
      chartCollapsed[filterKey] = !chartCollapsed[filterKey];
      renderAll();
      return;
    }
    const chartTableToggle = event.target.closest('[data-chart-toggle-table]');
    if (chartTableToggle) {
      chartAsTable[filterKey] = !chartAsTable[filterKey];
      renderAll();
      return;
    }
    const chartElement = event.target.closest('.akte-chart-element');
    if (chartElement) {
      activateChartElement(chartElement);
      return;
    }
    const listItem = event.target.closest('.akte-object-list-item');
    if (listItem) {
      selectedType = listItem.dataset.objectType;
      selectedId = listItem.dataset.objectId;
      renderAll();
      return;
    }
    const valueButton = event.target.closest('.akte-value');
    if (valueButton) {
      openPopover(valueButton);
    }
  });

  // Tastaturbedienung des Diagramms (Abschnitt 7.3, Kriterium V9): das
  // Diagramm ist ein einziges Tab-Ziel (roving tabindex), Pfeil links/rechts
  // wandert zwischen Elementen, Enter wählt aus, Esc verlässt es.
  document.getElementById('akteObjectSurface').addEventListener('keydown', event => {
    const chartElement = event.target.closest?.('.akte-chart-element');
    if (!chartElement) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const items = [...chartElement.closest('svg, table').querySelectorAll('.akte-chart-element')];
      const currentIndex = items.indexOf(chartElement);
      const nextIndex = event.key === 'ArrowRight'
        ? Math.min(items.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);
      if (nextIndex === currentIndex) return;
      items[currentIndex].setAttribute('tabindex', '-1');
      items[nextIndex].setAttribute('tabindex', '0');
      items[nextIndex].focus();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      activateChartElement(chartElement);
    } else if (event.key === 'Escape') {
      chartElement.blur();
    }
  });

  document.addEventListener('click', event => {
    const popover = document.getElementById('akteValuePopover');
    if (popover.classList.contains('hidden')) return;
    if (popover.contains(event.target) || event.target.closest('.akte-value')) return;
    closePopover();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closePopover();
      closeOutputWindow();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.getElementById('akteSearch').focus();
    }
  });

  document.getElementById('akteOutputButton').addEventListener('click', openOutputWindow);
  document.getElementById('akteOutputClose').addEventListener('click', closeOutputWindow);
  document.getElementById('akteOutputOverlay').addEventListener('click', event => {
    if (event.target.id === 'akteOutputOverlay') closeOutputWindow();
  });
  document.getElementById('akteOutputTabs').addEventListener('click', event => {
    const button = event.target.closest('[data-output-tab]');
    if (!button) return;
    outputTab = button.dataset.outputTab;
    renderOutputTabs();
    renderOutputBody();
  });

  document.getElementById('akteSearch').addEventListener('input', event => {
    searchText = event.target.value;
    // Suchtext filtert die aktuell sichtbaren Objekte, ohne den gewählten
    // Filter zu ändern (siehe Abschnitt 5, Kommandosuche bleibt).
    renderAll();
  });

  document.getElementById('akteSaveButton').addEventListener('click', () => saveToStorage(false));

  document.getElementById('aktePhaseSelect').addEventListener('change', event => setPhase(event.target.value));

  document.getElementById('akteLoadDemoButton').addEventListener('click', () => {
    if (!window.confirm('Demodaten laden? Der aktuelle Arbeitsstand in dieser Oberfläche wird ersetzt. Vorher exportieren, wenn er erhalten bleiben soll.')) return;
    model = demoModel();
    modelPassthrough = {};
    envelopePassthrough = {};
    history = emptyHistory();
    selectedType = 'measure';
    selectedId = model.measures[0]?.id || '';
    filterKey = 'all';
    searchText = '';
    chartCollapsed = {};
    chartAsTable = {};
    previousModelForHistory = currentModelData();
    previousKpis = null;
    afterMutation();
    showToast('Demodaten geladen.');
  });

  document.getElementById('akteExportButton').addEventListener('click', () => {
    const state = collectModelState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'digitale-akte-' + new Date().toISOString().slice(0, 10) + '.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('JSON-Export vorbereitet.');
  });

  document.getElementById('akteExportHtmlButton').addEventListener('click', () => exportSelfContainedHtml());

  document.getElementById('akteImportButton').addEventListener('click', () => {
    document.getElementById('akteImportFile').click();
  });

  document.getElementById('akteImportFile').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applyIncomingState(JSON.parse(String(reader.result)));
        renderAll();
        showToast('Modell geladen.');
      } catch (_error) {
        showToast('Datei konnte nicht gelesen werden.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function boot() {
  refreshBuildMeta();
  bootstrap();
  wireEvents();
  renderAll();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

// Test-Seam analog zu ui.js (siehe tests/akte-layout.test.js, tests/akte-objects.test.js).
if (typeof window !== 'undefined') {
  window.__akte2Debug = {
    getModel: () => model,
    getSelectedId: () => selectedId,
    getSelectedType: () => selectedType,
    getFilterKey: () => filterKey,
    setSelectedId: id => { selectedId = id; renderAll(); },
    setSelectedObject: (type, id) => { selectedType = type; selectedId = id; renderAll(); },
    setFilterKey: key => { filterKey = key; renderAll(); },
    // Kriterium 3 (Parität beider Oberflächen): dieselben Rechenkern-/
    // Modul-Aufrufe wie window.__akteDebug in ui.js, siehe tests/akte-parity.test.js.
    currentPortfolio: () => currentPortfolio(),
    clarificationItems: () => currentClarifications(currentPortfolio()),
    maturityScore: () => currentMaturity(currentPortfolio()),
    portfolioSegmentation: () => currentPortfolio().portfolioSegmentation,
    measureDrilldownFor: measureId => measureDrilldownFor(model.measures.find(measure => measure.id === measureId), currentParams()),
    // Kriterium 2 (verlustfreier Datenvertrag), siehe tests/akte-data-contract.test.js.
    collectModelState: () => collectModelState(),
    saveNow: () => saveToStorage(true),
    getHistory: () => history,
    // Anhang A1 (Visualisierungs-Spezifikation), siehe tests/akte-v0-anhang-a.test.js.
    kpiReliabilityShare: kpiKey => kpiReliabilityShare(kpiKey, currentParams(), currentPortfolio().results || [])
  };
}
