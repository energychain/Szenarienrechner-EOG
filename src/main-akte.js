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
    ui2: { filterKey, selectedType, selectedId }
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
  if (!visible.length) {
    node.innerHTML = renderPhaseWarningHtml() + addBar + exclusionNote + '<div class="akte-empty-state">Keine Objekte in diesem Filter.</div>';
    return;
  }
  const p = currentParams();
  node.innerHTML = renderPhaseWarningHtml() + addBar + exclusionNote + renderObjectListHtml(visible) + renderObjectDetailHtml(selectedType, selectedId, clarifications, p);
}

// ---------------------------------------------------------------------------
// Kontextspalte (Abschnitt 4.3, rechte Spalte) — generisch über alle
// Objekttypen; nur Maßnahmen haben eine "Wirkung dieses Objekts"-Rechnung.
// ---------------------------------------------------------------------------

function emptyContextHtml() {
  return '<div class="akte-empty-state">Kein Objekt ausgewählt.</div>';
}

function renderMeasureContext(node, measure, clarifications, p) {
  const drilldown = measureDrilldownFor(measure, p);
  const related = clarifications.filter(item => item.measureId === measure.id);
  const evidence = evidenceGaps('measure', measure);
  const events = historyEventsFor('measure', measure.id).slice(-6).reverse();
  node.innerHTML = `
    <div class="akte-context-section">
      <h3>Wirkung dieses Objekts</h3>
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

function renderContextColumn(clarifications) {
  const node = document.getElementById('akteContextColumn');
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
    return `<select id="${id}">${options.map(option => `<option value="${esc(option)}" ${String(value) === String(option) ? 'selected' : ''}>${esc(option || '(leer)')}</option>`).join('')}</select>`;
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
