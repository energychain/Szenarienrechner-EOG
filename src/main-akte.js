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
  portfolioEffectFor,
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
import { defaultCommittee, defaultProcessState, defaultStrategy, normalizeMeasure } from './model-normalize.js';
import { fieldDescriptorsFor } from './field-registry.js';
import { evidenceGaps, valueState } from './value-state.js';
import { esc, fmtPct, fmtPlain, fmtTeur } from './render-utils.js';
import { normalizeSidecar } from './sidecar.js';
import { demoMeasures, demoSidecar } from './demo-data.js';
import { appendHistoryEvents, diffModelEvents, emptyHistory, eventSummary } from './history.js';
import { inputDefaults, inputIds } from './ui-config.js';

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
    sector: 'strom',
    regulationProcedure: 'standard',
    baseYear: new Date().getFullYear() + 1,
    baseEog: 48000,
    rab: 77000,
    returnRate: 4.1,
    financingRate: 4,
    annualEnergyGwh: 465,
    householdConsumptionKwh: 2900,
    horizon: 8,
    discountRate: 4,
    kanuEndYear: 2045,
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

function skeletonModel() {
  const inputs = skeletonInputs();
  const measures = demoMeasures.map((measure, index) => normalizeMeasure(measure, index, {}));
  return {
    inputs,
    measures,
    sidecar: normalizeSidecar(demoSidecar),
    strategy: defaultStrategy(),
    committee: defaultCommittee(),
    process: defaultProcessState(),
    clarificationStatus: {},
    openDecisions: {},
    ui2: { filterKey: 'all', selectedType: 'measure', selectedId: measures[0]?.id || '' }
  };
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const state = JSON.parse(raw);
    return {
      model: state.model,
      history: state.history && Array.isArray(state.history.events) ? state.history : emptyHistory()
    };
  } catch (_error) {
    return null;
  }
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
    localStorage.setItem(storageKey, JSON.stringify({
      app: 'regulierte-sparten-szenario-rechner',
      version: modelVersion,
      appVersion,
      savedAt: new Date().toISOString(),
      model: currentModel,
      history
    }));
    if (!silent) showToast('Im Browser gespeichert (eigener Akte-Speicherstand).');
  } catch (_error) {
    if (!silent) showToast('Speichern nicht möglich.');
  }
}

function currentModelData() {
  return {
    inputs: structuredClone(model.inputs),
    measures: structuredClone(model.measures),
    sidecar: structuredClone(model.sidecar),
    strategy: structuredClone(model.strategy),
    committee: structuredClone(model.committee),
    process: structuredClone(model.process),
    clarificationStatus: structuredClone(model.clarificationStatus),
    openDecisions: structuredClone(model.openDecisions),
    ui2: { filterKey, selectedType, selectedId }
  };
}

function bootstrap() {
  const stored = loadFromStorage();
  if (stored?.model) {
    model = {
      inputs: stored.model.inputs || skeletonInputs(),
      measures: (stored.model.measures || []).map((measure, index) => normalizeMeasure(measure, index, {})),
      sidecar: normalizeSidecar(stored.model.sidecar),
      strategy: stored.model.strategy || defaultStrategy(),
      committee: stored.model.committee || defaultCommittee(),
      process: stored.model.process || defaultProcessState(),
      clarificationStatus: stored.model.clarificationStatus || {},
      openDecisions: stored.model.openDecisions || {}
    };
    history = stored.history || emptyHistory();
    filterKey = stored.model.ui2?.filterKey || 'all';
    selectedType = stored.model.ui2?.selectedType || 'measure';
    selectedId = stored.model.ui2?.selectedId || model.measures[0]?.id || '';
  } else {
    model = skeletonModel();
    selectedType = 'measure';
    selectedId = model.measures[0]?.id || '';
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

function measureYear1Eog(measure, p) {
  try {
    const effect = portfolioEffectFor(measure, p);
    const result = calcMeasure(measure, p, effect);
    return result.rows?.[0]?.regulatoryEogEffect || 0;
  } catch (_error) {
    return 0;
  }
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

  const node = document.getElementById('akteKpiStrip');
  node.innerHTML = kpiDefinitions.map(def => {
    const value = nextKpis[def.key];
    const delta = previousKpis && Number.isFinite(previousKpis[def.key]) && Number.isFinite(value)
      ? value - previousKpis[def.key]
      : null;
    const showDelta = delta !== null && Math.abs(delta) > 0.0001;
    const deltaCls = showDelta ? (delta > 0 ? 'up' : 'down') : '';
    const deltaText = showDelta ? `${delta > 0 ? '+' : ''}${fmtPlain(delta, 1)}` : '';
    return `
      <button type="button" class="akte-kpi-tile" data-kpi="${esc(def.key)}" aria-label="${esc(def.label)}: auf zugrundeliegende Maßnahmen filtern">
        <span class="akte-kpi-label">${esc(def.label)}</span>
        <span class="akte-kpi-value">${esc(def.format(value))}</span>
        <span class="akte-kpi-delta ${deltaCls} ${showDelta ? 'showing' : ''}">${esc(deltaText)}</span>
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

function historyEventsFor(objectType, id) {
  if (objectType === 'measure') return history.events.filter(event => event.subject?.measureId === id && !event.subject?.impactId);
  if (objectType === 'input') return history.events.filter(event => event.subject?.scope === 'inputs');
  if (objectType === 'objective') return history.events.filter(event => event.subject?.scope === 'strategy');
  // sidecarObject/sidecarSource: diffModelEvents diff't sidecar heute nicht
  // (siehe src/value-state.js) — es gibt kein history-Signal auf dieser Ebene.
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

function filteredEntries(entries) {
  let list;
  if (filterKey.startsWith('kpi:')) {
    list = entries.filter(entry => entry.objectType === 'measure');
    const kpiKey = filterKey.slice(4);
    const p = currentParams();
    if (kpiKey === 'eogYear1' || kpiKey === 'eogFollow') {
      list = [...list].sort((a, b) => measureYear1Eog(resolveObject('measure', b.id), p) - measureYear1Eog(resolveObject('measure', a.id), p));
    } else {
      list = [...list].sort((a, b) => Number(resolveObject('measure', b.id)?.cost || 0) - Number(resolveObject('measure', a.id)?.cost || 0));
    }
  } else {
    const def = allFilterDefs.find(item => item.key === filterKey);
    list = def ? entries.filter(def.match) : entries;
  }
  if (searchText.trim()) {
    const needle = searchText.trim().toLowerCase();
    list = list.filter(entry => entry.title.toLowerCase().includes(needle));
  }
  return list;
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
  const display = formattedValue(descriptor, rawValue);
  return `<button type="button" class="akte-value akte-value--${esc(state.state)}" data-edit-key="${esc(descriptor.key)}" data-object-type="${esc(objectType)}" data-object-id="${esc(objectId)}">${esc(display)}</button>${stateSuffix(state)}`;
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
  return `
    <h2 class="akte-object-title">${esc(measure.name || 'Maßnahme ohne Namen')}</h2>
    <p class="akte-object-subtitle">Maßnahme · ${esc(measure.orgUnit || 'ohne Bereich')} · ${measure.active ? 'aktiv' : 'inaktiv'}</p>
    ${blocksHtml}
    ${renderRechenpfad(measure, p)}
  `;
}

function renderFlatDetail(objectType, objectId, group, object, title, subtitle) {
  const sentence = renderSentenceForGroup(objectType, objectId, group, object);
  return `
    <h2 class="akte-object-title">${esc(title)}</h2>
    <p class="akte-object-subtitle">${esc(subtitle)}</p>
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
          <span class="akte-object-list-title">${esc(entry.title)}</span>
          <span class="akte-object-list-meta">
            <span class="akte-object-list-type">${esc(objectTypeLabels[entry.objectType] || entry.objectType)}</span>
            ${entry.gapCount ? `<span class="akte-object-list-gap">${entry.gapCount}</span>` : ''}
          </span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderObjectSurface(visible, clarifications) {
  const node = document.getElementById('akteObjectSurface');
  if (!visible.length) {
    node.innerHTML = '<div class="akte-empty-state">Keine Objekte in diesem Filter.</div>';
    return;
  }
  const p = currentParams();
  node.innerHTML = renderObjectListHtml(visible) + renderObjectDetailHtml(selectedType, selectedId, clarifications, p);
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

  popover.innerHTML = `
    <div class="akte-popover-title">${esc(descriptor.label)}</div>
    <div class="akte-popover-state">Zustand: ${esc(state.state)}${descriptor.default !== undefined ? ` · Vorbelegung: ${esc(formattedValue(descriptor, descriptor.default))}` : ''}</div>
    <label for="akteFieldInput">${esc(descriptor.label)}${descriptor.unit ? ` (${esc(descriptor.unit)})` : ''}</label>
    ${inputControlFor(descriptor, currentValue)}
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
    const nextValue = parseControlValue(descriptor, currentValue);
    object[key] = nextValue;
    if (descriptor.evidenceKey) {
      const evidenceInput = document.getElementById('akteEvidenceInput');
      if (evidenceInput) object[descriptor.evidenceKey] = evidenceInput.value;
    }
    if (model.openDecisions?.[stateObjectId]) delete model.openDecisions[stateObjectId][key];
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
  let visible = filteredEntries(entries);
  if (!visible.length) visible = entries;
  if (visible.length && !visible.some(entry => entry.objectType === selectedType && entry.id === selectedId)) {
    selectedType = visible[0].objectType;
    selectedId = visible[0].id;
  }
  document.getElementById('akteSectorLabel').textContent = model.inputs.sector === 'gas' ? 'Gas' : 'Strom';
  renderKpiStrip(portfolio, clarifications);
  renderFilterColumn(entries);
  renderObjectSurface(visible, clarifications);
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
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    filterKey = button.dataset.filter;
    renderAll();
  });

  document.getElementById('akteObjectSurface').addEventListener('click', event => {
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
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.getElementById('akteSearch').focus();
    }
  });

  document.getElementById('akteSearch').addEventListener('input', event => {
    searchText = event.target.value;
    // Suchtext filtert die aktuell sichtbaren Objekte, ohne den gewählten
    // Filter zu ändern (siehe Abschnitt 5, Kommandosuche bleibt).
    renderAll();
  });

  document.getElementById('akteSaveButton').addEventListener('click', () => saveToStorage(false));

  document.getElementById('akteExportButton').addEventListener('click', () => {
    const state = {
      app: 'regulierte-sparten-szenario-rechner',
      version: modelVersion,
      appVersion,
      savedAt: new Date().toISOString(),
      model: currentModelData(),
      history
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'digitale-akte-' + new Date().toISOString().slice(0, 10) + '.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('JSON-Export vorbereitet.');
  });

  document.getElementById('akteImportButton').addEventListener('click', () => {
    document.getElementById('akteImportFile').click();
  });

  document.getElementById('akteImportFile').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const state = JSON.parse(String(reader.result));
        const incomingModel = state.model || state;
        model = {
          inputs: incomingModel.inputs || skeletonInputs(),
          measures: (incomingModel.measures || []).map((measure, index) => normalizeMeasure(measure, index, {})),
          sidecar: normalizeSidecar(incomingModel.sidecar),
          strategy: incomingModel.strategy || defaultStrategy(),
          committee: incomingModel.committee || defaultCommittee(),
          process: incomingModel.process || defaultProcessState(),
          clarificationStatus: incomingModel.clarificationStatus || {},
          openDecisions: incomingModel.openDecisions || {}
        };
        history = state.history && Array.isArray(state.history.events) ? state.history : emptyHistory();
        selectedType = incomingModel.ui2?.selectedType || 'measure';
        selectedId = incomingModel.ui2?.selectedId || model.measures[0]?.id || '';
        filterKey = incomingModel.ui2?.filterKey || 'all';
        previousModelForHistory = currentModelData();
        previousKpis = null;
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
    setFilterKey: key => { filterKey = key; renderAll(); }
  };
}
