// Zweite, eigenständige Oberfläche ("digitale Akte") für dasselbe Modell-JSON
// und denselben Rechenkern wie src/ui.js — siehe UX_AKTE_REDESIGN-Spezifikation.
// Stufe 4: Layout-Gerüst (Ergebnisstreifen, Filterspalte, Objektfläche) mit
// vollständiger Satzdarstellung für Maßnahmen. Rahmen/Szenario/Ziel/Kontext/
// Quelle folgen in Stufe 5.
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
import { demoMeasures } from './demo-data.js';
import { appendHistoryEvents, emptyHistory, eventSummary } from './history.js';
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
let selectedId = '';
let filterKey = 'all';
let searchText = '';
let previousModelForHistory = null;
let previousKpis = null;
let author = 'Akte';

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
    sidecar: normalizeSidecar(),
    strategy: defaultStrategy(),
    committee: defaultCommittee(),
    process: defaultProcessState(),
    clarificationStatus: {},
    openDecisions: {},
    ui2: { filterKey: 'all', selectedId: measures[0]?.id || '' }
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
      const drafts = diffMeasureFields(previousModelForHistory, currentModel);
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

// Nur die Maßnahmenfelder werden hier diff't (Stufe 4 bearbeitet nur
// Maßnahmen); diffModelEvents aus history.js deckt das gesamte Modell ab und
// wird ab Stufe 5 verwendet, sobald weitere Objekttypen bearbeitbar sind.
function diffMeasureFields(previous, next) {
  const drafts = [];
  const previousById = new Map((previous.measures || []).map(measure => [measure.id, measure]));
  (next.measures || []).forEach(measure => {
    const before = previousById.get(measure.id);
    if (!before) return;
    Object.keys(measure).forEach(field => {
      if (field === 'id' || field === 'impactAssumptions') return;
      const oldValue = before[field];
      const newValue = measure[field];
      if (JSON.stringify(oldValue ?? null) === JSON.stringify(newValue ?? null)) return;
      drafts.push({ type: 'measureFieldChanged', subject: { measureId: measure.id }, field, oldValue, newValue });
    });
  });
  return drafts;
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
    ui2: { filterKey, selectedId }
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
    selectedId = stored.model.ui2?.selectedId || model.measures[0]?.id || '';
  } else {
    model = skeletonModel();
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
// KPI-Streifen (Abschnitt 4.1)
// ---------------------------------------------------------------------------

const kpiDefinitions = [
  { key: 'eogYear1', label: 'EOG Jahr 1', compute: portfolio => portfolio.yearly?.[0]?.regulatoryEogEffect, format: v => fmtTeur(v, 1) },
  { key: 'eogFollow', label: 'EOG Folgejahr', compute: portfolio => portfolio.yearly?.[1]?.regulatoryEogEffect ?? portfolio.yearly?.[0]?.regulatoryEogEffect, format: v => fmtTeur(v, 1) },
  { key: 'irr', label: 'IRR', compute: portfolio => portfolio.irr, format: v => Number.isFinite(v) ? fmtPct(v * 100, 1) : '–' },
  { key: 'npv', label: 'Kapitalwert', compute: portfolio => portfolio.npv, format: v => fmtTeur(v, 1) }
];

function renderKpiStrip() {
  const portfolio = currentPortfolio();
  const clarifications = currentClarifications(portfolio);
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
    <button type="button" class="akte-kpi-tile reliability ${warnCount ? '' : 'good'}" data-kpi="reliability" aria-label="Belastbarkeit des Arbeitsstands: auf offene Maßnahmen filtern">
      <span class="akte-kpi-label">Belastbarkeit</span>
      <span class="akte-kpi-value">${reliabilityPct} % belegt</span>
      <span class="akte-kpi-delta"></span>
    </button>
    <button type="button" class="akte-kpi-tile open-items ${openCount ? '' : 'zero'}" data-kpi="open" aria-label="Offene Punkte: auf offene Maßnahmen filtern">
      <span class="akte-kpi-label">Offene Punkte</span>
      <span class="akte-kpi-value">${openCount}</span>
      <span class="akte-kpi-delta"></span>
    </button>
  `;

  previousKpis = nextKpis;
}

// ---------------------------------------------------------------------------
// Filterspalte (Abschnitt 4.2) — Stufe 4: Maßnahmenfilter
// ---------------------------------------------------------------------------

function measuresForFilter(key, portfolio, clarifications) {
  const measures = model.measures;
  if (key === 'active') return measures.filter(measure => measure.active);
  if (key === 'open' || key === 'reliability') {
    const openMeasureIds = new Set(clarifications.filter(item => item.status !== 'closed' && item.measureId).map(item => item.measureId));
    return measures.filter(measure => openMeasureIds.has(measure.id));
  }
  if (key === 'without-objective') return measures.filter(measure => measure.active && !(measure.objectiveIds || []).length);
  if (key.startsWith('kpi:')) {
    const active = measures.filter(measure => measure.active);
    const kpiKey = key.slice(4);
    const p = currentParams();
    if (kpiKey === 'eogYear1' || kpiKey === 'eogFollow') {
      return [...active].sort((a, b) => measureYear1Eog(b, p) - measureYear1Eog(a, p));
    }
    return [...active].sort((a, b) => Number(b.cost || 0) - Number(a.cost || 0));
  }
  return measures;
}

function filterCounts(portfolio, clarifications) {
  return {
    all: model.measures.length,
    active: model.measures.filter(measure => measure.active).length,
    open: measuresForFilter('open', portfolio, clarifications).length,
    'without-objective': measuresForFilter('without-objective', portfolio, clarifications).length
  };
}

const filterLabels = {
  all: 'Alle',
  active: 'Aktiv',
  open: 'Offen',
  'without-objective': 'Ohne Ziel-Zuordnung'
};

function renderFilterColumn(portfolio, clarifications) {
  const counts = filterCounts(portfolio, clarifications);
  const node = document.getElementById('akteFilterColumn');
  const items = ['all', 'active', 'open', 'without-objective'];
  node.innerHTML = `
    <div class="akte-filter-group">
      <h3>Maßnahmen</h3>
      ${items.map(key => `
        <button type="button" class="akte-filter-item ${filterKey === key ? 'active' : ''}" data-filter="${esc(key)}">
          <span>${esc(filterLabels[key])}</span>
          <span class="count">${counts[key]}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function visibleMeasures(portfolio, clarifications) {
  let list = filterKey.startsWith('kpi:') || filterKey === 'reliability'
    ? measuresForFilter(filterKey === 'reliability' ? 'open' : filterKey, portfolio, clarifications)
    : measuresForFilter(filterKey, portfolio, clarifications);
  if (searchText.trim()) {
    const needle = searchText.trim().toLowerCase();
    list = list.filter(measure => String(measure.name || '').toLowerCase().includes(needle));
  }
  return list;
}

// ---------------------------------------------------------------------------
// Objektfläche (Abschnitt 4.3) — Satzdarstellung für Maßnahmen
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
const groupOrder = ['identitaet', 'investitionAktivierung', 'wirkung', 'lebenszyklus', 'gasTransformationspfad', 'flexibilitaetNetzfahrplan', 'eeg2027Netzanschluss', 'monitoring14d', 'herkunftEvidenz', 'tragfaehigkeit', 'notiz'];

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
// verschachtelte Objektliste (eigene Objektfläche ab Stufe 5).
const nonEditableFieldKeys = new Set(['id']);
const summaryOnlyFieldKeys = new Set(['impactAssumptions']);

function renderFieldValue(objectType, descriptor, measure) {
  const rawValue = measure[descriptor.key];
  if (summaryOnlyFieldKeys.has(descriptor.key)) {
    const count = Array.isArray(rawValue) ? rawValue.length : 0;
    return `<span class="akte-value akte-value--summary">${esc(count)}</span>`;
  }
  const state = valueState(objectType, descriptor.key, rawValue, { object: measure, objectId: measure.id, history, openDecisions: model.openDecisions });
  if (state.state === 'openByDecision') {
    return `<button type="button" class="akte-value akte-value--openByDecision" data-edit-key="${esc(descriptor.key)}" data-measure-id="${esc(measure.id)}">bewusst offen gelassen: ${esc(state.reason || 'ohne Begründung')}</button>`;
  }
  const display = formattedValue(descriptor, rawValue);
  return `<button type="button" class="akte-value akte-value--${esc(state.state)}" data-edit-key="${esc(descriptor.key)}" data-measure-id="${esc(measure.id)}">${esc(display)}</button>${stateSuffix(state)}`;
}

function renderSentenceForGroup(objectType, group, measure) {
  const descriptors = fieldDescriptorsFor(objectType)
    .filter(descriptor => descriptor.group === group)
    .filter(descriptor => !nonEditableFieldKeys.has(descriptor.key))
    .filter(descriptor => !descriptor.appliesWhen || descriptor.appliesWhen(measure))
    .sort((a, b) => a.order - b.order);
  if (!descriptors.length) return '';
  return descriptors.map(descriptor => {
    const valueHtml = renderFieldValue(objectType, descriptor, measure);
    return descriptor.sentence.replace('{v}', valueHtml) + '. ';
  }).join('');
}

function groupHasGapOrNonDefault(objectType, group, measure) {
  return fieldDescriptorsFor(objectType)
    .filter(descriptor => descriptor.group === group)
    .filter(descriptor => !descriptor.appliesWhen || descriptor.appliesWhen(measure))
    .some(descriptor => {
      const state = valueState(objectType, descriptor.key, measure[descriptor.key], { object: measure, objectId: measure.id, history, openDecisions: model.openDecisions });
      return state.state !== 'default';
    });
}

function groupOpenPointCount(objectType, group, measure, clarifications) {
  const measureClarifications = clarifications.filter(item => item.measureId === measure.id);
  const descriptorKeys = new Set(fieldDescriptorsFor(objectType).filter(d => d.group === group).map(d => d.key));
  const evidence = evidenceGaps(objectType, measure).filter(gap => descriptorKeys.has(gap.key));
  return measureClarifications.length && group === 'wirkung' ? measureClarifications.length : evidence.length;
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

function renderObjectSurface() {
  const portfolio = currentPortfolio();
  const clarifications = currentClarifications(portfolio);
  const node = document.getElementById('akteObjectSurface');
  const measure = model.measures.find(item => item.id === selectedId);
  if (!measure) {
    node.innerHTML = '<div class="akte-empty-state">Keine Maßnahme ausgewählt. Wählen Sie links ein Objekt.</div>';
    return;
  }
  const p = currentParams();
  const blocksHtml = groupOrder
    .filter(group => {
      const descriptors = fieldDescriptorsFor('measure').filter(d => d.group === group && (!d.appliesWhen || d.appliesWhen(measure)));
      return descriptors.length > 0;
    })
    .map(group => {
      const sentence = renderSentenceForGroup('measure', group, measure);
      const isCore = alwaysOpenGroups.has(group);
      const openCount = groupOpenPointCount('measure', group, measure, clarifications);
      const hasNonDefault = groupHasGapOrNonDefault('measure', group, measure);
      const shouldOpen = isCore || openCount > 0 || hasNonDefault;
      return `
        <details class="akte-sentence-block" ${shouldOpen ? 'open' : ''} data-group="${esc(group)}">
          <summary>
            <span>${esc(measureGroupTitles[group] || group)}</span>
            ${openCount ? `<span class="badge">${openCount} offen</span>` : ''}
          </summary>
          <div class="akte-sentence-body">${sentence}</div>
        </details>
      `;
    }).join('');

  node.innerHTML = `
    <h2 class="akte-object-title">${esc(measure.name || 'Maßnahme ohne Namen')}</h2>
    <p class="akte-object-subtitle">Maßnahme · ${esc(measure.orgUnit || 'ohne Bereich')} · ${measure.active ? 'aktiv' : 'inaktiv'}</p>
    ${blocksHtml}
    ${renderRechenpfad(measure, p)}
  `;
}

// ---------------------------------------------------------------------------
// Kontextspalte (Abschnitt 4.3, rechte Spalte)
// ---------------------------------------------------------------------------

function renderContextColumn() {
  const node = document.getElementById('akteContextColumn');
  const measure = model.measures.find(item => item.id === selectedId);
  if (!measure) {
    node.innerHTML = '<div class="akte-empty-state">Kein Objekt ausgewählt.</div>';
    return;
  }
  const p = currentParams();
  const portfolio = currentPortfolio();
  const clarifications = currentClarifications(portfolio).filter(item => item.measureId === measure.id);
  const drilldown = measureDrilldownFor(measure, p);
  const evidence = evidenceGaps('measure', measure);
  const measureEvents = history.events.filter(event => event.subject?.measureId === measure.id).slice(-6).reverse();

  node.innerHTML = `
    <div class="akte-context-section">
      <h3>Wirkung dieses Objekts</h3>
      <div class="akte-context-metric"><span>EOG Jahr 1</span><strong>${esc(fmtTeur(drilldown.rows?.[0]?.regulatoryEogEffect || 0, 1))}</strong></div>
      <div class="akte-context-metric"><span>${esc(drilldown.returnMetricLabel || 'IRR')}</span><strong>${Number.isFinite(drilldown.returnMetricValue) ? esc(fmtPct(drilldown.returnMetricValue * 100, 1)) : '–'}</strong></div>
      <div class="akte-context-metric"><span>Kapitalwert</span><strong>${esc(fmtTeur(drilldown.npvTeur || 0, 1))}</strong></div>
    </div>
    <div class="akte-context-section">
      <h3>Offene Punkte (${clarifications.length})</h3>
      ${clarifications.length
        ? clarifications.slice(0, 8).map(item => `<span class="akte-open-point">${esc(item.title)} · ${esc(item.priority?.label || '')}</span>`).join('')
        : '<span class="akte-open-point">Keine offenen Punkte für dieses Objekt.</span>'}
    </div>
    <div class="akte-context-section">
      <h3>Herkunft</h3>
      ${evidence.length
        ? evidence.slice(0, 6).map(gap => `<span class="akte-open-point">${esc(gap.key)}: Evidenz (${esc(gap.evidenceKey)}) fehlt</span>`).join('')
        : '<span class="akte-open-point">Keine offenen Evidenzlücken erkannt.</span>'}
    </div>
    <div class="akte-context-section">
      <h3>Verlauf</h3>
      ${measureEvents.length
        ? measureEvents.map(event => `<div class="akte-history-event">${esc(eventSummary(event))}</div>`).join('')
        : '<div class="akte-history-event">Noch keine Änderungen protokolliert.</div>'}
    </div>
  `;
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

function helperNoteFor(descriptor, measure) {
  const fn = descriptor.helper ? helperFunctions[descriptor.helper] : null;
  if (!fn) return '';
  try {
    const result = fn(measure);
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
  const measureId = button.dataset.measureId;
  const measure = model.measures.find(item => item.id === measureId);
  const descriptor = fieldDescriptorsFor('measure').find(item => item.key === key);
  if (!measure || !descriptor) return;
  activePopoverTarget = button;
  const popover = document.getElementById('akteValuePopover');
  const currentValue = measure[key];
  const state = valueState('measure', key, currentValue, { object: measure, objectId: measure.id, history, openDecisions: model.openDecisions });

  popover.innerHTML = `
    <div class="akte-popover-title">${esc(descriptor.label)}</div>
    <div class="akte-popover-state">Zustand: ${esc(state.state)}${descriptor.default !== undefined ? ` · Vorbelegung: ${esc(formattedValue(descriptor, descriptor.default))}` : ''}</div>
    <label for="akteFieldInput">${esc(descriptor.label)}${descriptor.unit ? ` (${esc(descriptor.unit)})` : ''}</label>
    ${inputControlFor(descriptor, currentValue)}
    ${descriptor.evidenceKey ? `<label for="akteEvidenceInput">Quelle / Evidenz (${esc(descriptor.evidenceKey)})</label><input id="akteEvidenceInput" type="text" value="${esc(measure[descriptor.evidenceKey] ?? '')}">` : ''}
    ${helperNoteFor(descriptor, measure)}
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
    measure[key] = nextValue;
    if (descriptor.evidenceKey) {
      const evidenceInput = document.getElementById('akteEvidenceInput');
      if (evidenceInput) measure[descriptor.evidenceKey] = evidenceInput.value;
    }
    if (model.openDecisions?.[measure.id]) delete model.openDecisions[measure.id][key];
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
    model.openDecisions[measure.id] = model.openDecisions[measure.id] || {};
    model.openDecisions[measure.id][key] = { reason, author, timestamp: new Date().toISOString() };
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
  document.getElementById('akteSectorLabel').textContent = model.inputs.sector === 'gas' ? 'Gas' : 'Strom';
  renderKpiStrip();
  renderFilterColumn(portfolio, clarifications);
  renderObjectSurface();
  renderContextColumn();
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
    filterKey = kpi === 'open' || kpi === 'reliability' ? 'open' : `kpi:${kpi}`;
    const portfolio = currentPortfolio();
    const clarifications = currentClarifications(portfolio);
    const list = visibleMeasures(portfolio, clarifications);
    if (list[0]) selectedId = list[0].id;
    renderAll();
    document.getElementById('akteObjectSurface').focus();
  });

  document.getElementById('akteFilterColumn').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    filterKey = button.dataset.filter;
    const portfolio = currentPortfolio();
    const clarifications = currentClarifications(portfolio);
    const list = visibleMeasures(portfolio, clarifications);
    if (list.length && !list.some(measure => measure.id === selectedId)) selectedId = list[0].id;
    renderAll();
  });

  document.getElementById('akteObjectSurface').addEventListener('click', event => {
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
    renderMeasureListInFilterColumn();
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

function renderMeasureListInFilterColumn() {
  // Suchtext filtert die aktuell sichtbaren Objekte, ohne den gewählten
  // Filter zu ändern (siehe Abschnitt 5, Kommandosuche bleibt).
  renderObjectSurface();
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

// Test-Seam analog zu ui.js (siehe tests/akte-layout.test.js).
if (typeof window !== 'undefined') {
  window.__akte2Debug = {
    getModel: () => model,
    getSelectedId: () => selectedId,
    getFilterKey: () => filterKey,
    setSelectedId: id => { selectedId = id; renderAll(); },
    setFilterKey: key => { filterKey = key; renderAll(); }
  };
}
