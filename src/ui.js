import {
  calcMeasure,
  calcPortfolio,
  clamp,
  expectedActivated,
  impactAssumptionsFor,
  params as engineParams,
  portfolioEffectFor,
  regulatoryParameterSet,
  regulatoryPeriodFor,
  scenarioParams as engineScenarioParams
} from './engine.js';
import {
  appendHistoryEvents,
  diffModelEvents,
  emptyHistory
} from './history.js';
import { imprintSections } from './trust-content.js';

const initialMeasures = [];

const demoMeasures = [
  {
    id: 'demo_grid_automation',
    active: true,
    name: 'Netzautomatisierung Schwerpunktgebiet Nord',
    type: 'wahl',
    cost: 820,
    year: 2027,
    secure: 70,
    uncertain: 30,
    probability: 60,
    opexRecognition: 60,
    life: 15,
    depr: 'normal',
    qDirect: 0,
    eDirect: 0,
    riskAvoided: 0,
    portfolioShare: 35,
    impactAssumptions: [
      {'id':'impact_demo_grid_q','area':'qElement','title':'Weniger lange Versorgungsunterbrechungen','amount':15,'confidence':'assumption','governance':'basis','startYear':2027,'endYear':'','attribution':100,'chain':'Automatisierung grenzt Fehler schneller ein und verkürzt Wiederversorgung im Schwerpunktgebiet.','evidence':'Betriebserfahrung aus Störungsanalyse Nord 2024-2026','note':'Mit Regulierungsmanagement auf Q-Systematik prüfen.'},
      {'id':'impact_demo_grid_e','area':'efficiency','title':'Weniger manuelle Entstörung und Schaltaufwand','amount':8,'confidence':'assumption','governance':'basis','startYear':2027,'endYear':'','attribution':100,'chain':'Fernsteuerung reduziert Anfahrten und manuelle Schalthandlungen.','evidence':'Expertenschätzung Netzbetrieb','note':''},
      {'id':'impact_demo_grid_risk','area':'risk','title':'Vermiedene Großstörung im Schwerpunktgebiet','amount':20,'confidence':'review','governance':'sensitivity','startYear':2027,'endYear':'','attribution':100,'chain':'Automatisierung reduziert Eskalationsrisiko bei Folgefehlern.','evidence':'Risikoworkshop offen','note':'Nur als Sensitivität bis Freigabe.'}
    ],
    note: 'Abstimmen, ob der Qualitätsbeitrag separat messbar ist oder nur als Portfolioeffekt angesetzt wird.'
  },
  {
    id: 'demo_station_replacement',
    active: true,
    name: 'Ersatz Trafostation mit Fernwirkfähigkeit',
    type: 'wahl',
    cost: 540,
    year: 2027,
    secure: 75,
    uncertain: 25,
    probability: 55,
    opexRecognition: 50,
    life: 35,
    depr: 'normal',
    qDirect: 0,
    eDirect: 0,
    riskAvoided: 0,
    portfolioShare: 25,
    impactAssumptions: [
      {'id':'impact_demo_station_q','area':'qElement','title':'Fernwirkfähigkeit reduziert Ausfallminuten','amount':10,'confidence':'proven','governance':'basis','startYear':2027,'endYear':'','attribution':100,'chain':'Störung wird schneller erkannt und eingegrenzt; Wiederversorgungszeit sinkt.','evidence':'Historische Störungen vergleichbarer Stationen','note':''},
      {'id':'impact_demo_station_risk','area':'risk','title':'Vermiedene Folgekosten bei Stationsausfall','amount':18,'confidence':'assumption','governance':'basis','startYear':2027,'endYear':'','attribution':100,'chain':'Ersatz reduziert Eintrittswahrscheinlichkeit alterungsbedingter Ausfälle.','evidence':'Asset-Zustandsbewertung und Betriebsschätzung','note':''}
    ],
    note: 'Technische Umsetzbarkeit im geplanten Inbetriebnahmejahr bestätigen.'
  },
  {
    id: 'demo_pressure_station',
    active: false,
    name: 'Modernisierung Gasdruckregelanlage',
    type: 'risiko',
    cost: 610,
    year: 2029,
    secure: 72,
    uncertain: 28,
    probability: 50,
    opexRecognition: 70,
    life: 40,
    depr: 'kanuLinear',
    qDirect: 0,
    eDirect: 0,
    riskAvoided: 0,
    portfolioShare: 20,
    impactAssumptions: [
      {'id':'impact_demo_pressure_e','area':'efficiency','title':'Weniger ungeplante Instandsetzung','amount':6,'confidence':'assumption','governance':'basis','startYear':2027,'endYear':'','attribution':100,'chain':'Modernisierung senkt wiederkehrende Störungs- und Instandsetzungsaufwände.','evidence':'Instandhaltungsplanung','note':''},
      {'id':'impact_demo_pressure_risk','area':'risk','title':'Vermiedene Versorgungsunterbrechung','amount':28,'confidence':'review','governance':'sensitivity','startYear':2027,'endYear':'','attribution':100,'chain':'Zustandsrisiko sinkt, monetäre Höhe ist noch nicht freigegeben.','evidence':'Asset-Risikomatrix offen','note':'Prüfung durch Betrieb und VNB erforderlich.'}
    ],
    note: ''
  },
  {
    id: 'demo_sensor_rollout',
    active: false,
    name: 'Sensorik zur Zustands- und Qualitätsüberwachung',
    type: 'wahl',
    cost: 360,
    year: 2028,
    secure: 55,
    uncertain: 35,
    probability: 65,
    opexRecognition: 55,
    life: 12,
    depr: 'normal',
    qDirect: 0,
    eDirect: 0,
    riskAvoided: 0,
    portfolioShare: 20,
    impactAssumptions: [
      {'id':'impact_demo_sensor_q','area':'qElement','title':'Frühere Fehlererkennung verbessert Qualitätskennzahl','amount':18,'confidence':'review','governance':'sensitivity','startYear':2027,'endYear':'','attribution':100,'chain':'Sensorik liefert Zustandsdaten vor Störungen; konkrete Q-Wirkung muss aus Ereignisdaten abgeleitet werden.','evidence':'Noch keine belastbare Historie','note':'Prüfpflichtig bis Datengrundlage vorliegt.'},
      {'id':'impact_demo_sensor_e','area':'efficiency','title':'Gezieltere Instandhaltung','amount':12,'confidence':'assumption','governance':'basis','startYear':2027,'endYear':'','attribution':100,'chain':'Zustandsdaten reduzieren Blindleistung in Inspektion und Instandhaltung.','evidence':'Betriebsschätzung','note':''}
    ],
    note: 'Datengrundlage für Q-/E-Wirkung mit Betrieb und Regulierungsmanagement klären.'
  },
  {
    id: 'demo_line_replacement',
    active: false,
    name: 'Leitungsabschnitt mit erhöhter Ausfallwahrscheinlichkeit',
    type: 'risiko',
    cost: 740,
    year: 2029,
    secure: 80,
    uncertain: 20,
    probability: 50,
    opexRecognition: 70,
    life: 40,
    depr: 'kanuDegressive',
    qDirect: 0,
    eDirect: 0,
    riskAvoided: 0,
    portfolioShare: 0,
    impactAssumptions: [
      {'id':'impact_demo_line_risk','area':'risk','title':'Vermiedener Schadensfall kritischer Leitungsabschnitt','amount':45,'confidence':'review','governance':'sensitivity','startYear':2027,'endYear':'','attribution':100,'chain':'Ersatz senkt Ausfallwahrscheinlichkeit und Folgekosten im kritischen Abschnitt.','evidence':'Risikowert aus Asset-Management noch zu validieren','note':'Nur Sensitivität bis Schadenshöhe und Eintrittswahrscheinlichkeit bestätigt sind.'}
    ],
    note: 'Risikowert validieren: Schadenshöhe, Eintrittswahrscheinlichkeit und mögliche Bauabhängigkeiten.'
  }
];

const inputIds = [
  'sector', 'baseYear', 'baseEog', 'rab', 'returnRate', 'financingRate',
  'horizon', 'discountRate', 'kanuEndYear', 'degressiveRate', 'taxFactor',
  'portfolioAttribution', 'qDelta', 'eDelta'
];

const detailIds = [
  'mName', 'mType', 'mCost', 'mYear', 'mSecure', 'mUncertain',
  'mProbability', 'mOpexRecognition', 'mLife', 'mDepr', 'mQDirect',
  'mEDirect', 'mRiskAvoided', 'mPortfolioShare', 'mNote'
];

const fieldHelp = {
  sector: 'Legt fest, welche regulatorische Logik gilt. Gas kann KANU-Szenarien enthalten; Strom ist bei Qualitäts- und Effizienzthemen anders zu bewerten.',
  baseYear: 'Startjahr der Betrachtung. Der Rechner leitet daraus je Sparte die passende Regulierungsperiode ab und rechnet alle Jahreswerte relativ zu diesem Jahr.',
  baseEog: 'Bestehende Erlösobergrenze der Sparte pro Jahr. Sie ist Bezugsgröße für Portfolioeffekte und zeigt, wie stark eine Maßnahme das Gesamtbild verändert.',
  rab: 'Regulatorisch gebundene Kapitalbasis. Sie hilft, Investitionen relativ zur bestehenden Kapitalbindung und zur künftigen Verzinsungsbasis einzuordnen.',
  returnRate: 'Regulatorische Kapitalverzinsung. Sie wirkt nur auf anerkanntes, aktiviertes Kapital und ist nicht automatisch die Rendite der Gesamtkosten.',
  financingRate: 'Kosten des eingesetzten Fremdkapitals. Der Vergleich mit IRR und Kapitalwert zeigt, ob eine Maßnahme den Finanzierungsspread trägt.',
  horizon: 'Zeitraum der Auswertung. Ein längerer Horizont zeigt vollständige Abschreibungs- und Verzinsungspfade, erhöht aber die Unsicherheit.',
  discountRate: 'Abzinsungssatz für den Kapitalwert. Er bildet die Mindestverzinsung oder Opportunitätskosten des Kapitals ab.',
  kanuEndYear: 'Zieljahr für beschleunigte Gas-Abschreibungen. Es verschiebt EOG-Wirkung, Restwertpfad und Kapitalbindung über die Zeit.',
  degressiveRate: 'Degressiver AfA-Satz im KANU-Szenario. Höhere Werte führen zu schnellerer Refinanzierung, aber auch schneller sinkendem Restbuchwert.',
  taxFactor: 'Pauschaler Zuschlag für Steuern oder weitere regulatorische Zuschläge. Nur verwenden, wenn diese Wirkung fachlich begründet ist.',
  portfolioAttribution: 'Anteil eines Portfolioeffekts, der den aktiven Maßnahmen zugerechnet wird. Dieser Wert ist eine Governance-Annahme und sollte konservativ begründet werden.',
  qDelta: 'Geschätzte Qualitätswirkung auf die relevante Portfolio-Basis. Der Euro-Effekt entsteht erst über Basis x Delta x Attribution.',
  eDelta: 'Geschätzte Effizienz- oder EOG-Wirkung auf Portfolioebene. Sie sollte nur angesetzt werden, wenn ein plausibler kausaler Zusammenhang besteht.',
  mName: 'Eindeutige Bezeichnung der Maßnahme. Sie sollte fachlich wiedererkennbar sein, damit Annahmen später prüfbar bleiben.',
  mType: 'Einordnung der Maßnahme. Wahlmaßnahmen werden als wirtschaftliche Entscheidung betrachtet; Risiko- und Pflichtnähe beeinflussen die Begründung.',
  mCost: 'Gesamtkosten der Maßnahme in TEUR. Die Rendite wird gegen diese Gesamtkosten gestellt, auch wenn nur ein Teil davon aktiviert wird.',
  mYear: 'Jahr der Inbetriebnahme. Erst ab diesem Jahr entstehen Abschreibung, Verzinsung und direkte Zusatzwirkungen im Modell.',
  mSecure: 'Anteil der Kosten, der mit hoher Sicherheit aktivierbar und regulatorisch kapitalwirksam ist.',
  mUncertain: 'Kostenanteil mit unklarer Aktivierung. Dieser Anteil wird nur risikogewichtet berücksichtigt.',
  mProbability: 'Wahrscheinlichkeit, mit der der unsichere Anteil aktivierbar wird. Zusammen mit dem unsicheren Anteil bildet sie die erwartete Kapitalbasis.',
  mOpexRecognition: 'Anteil nicht aktivierter Kosten, der als OPEX anerkannt oder wirtschaftlich berücksichtigt werden kann.',
  mLife: 'Normale Nutzungsdauer für lineare Abschreibung. Sie bestimmt, wie schnell die aktivierte Basis über AfA in die EOG zurückfließt.',
  mDepr: 'Abschreibungsszenario. Bei Gas können KANU-Varianten die zeitliche EOG-Wirkung und den Restwertpfad deutlich verändern.',
  mQDirect: 'Direkte, separat begründete Qualitätswirkung in TEUR pro Jahr. Nicht mit pauschalen Portfolioeffekten doppelt zählen.',
  mEDirect: 'Direkte Effizienz- oder EOG-Wirkung in TEUR pro Jahr. Nur ansetzen, wenn sie der Maßnahme belastbar zurechenbar ist.',
  mRiskAvoided: 'Monetarisierter vermiedener Risikowert pro Jahr, z.B. vermiedene Störungen, Sanktionen oder Folgekosten.',
  mPortfolioShare: 'Anteil, mit dem diese Maßnahme am globalen Q-/E-Portfolioeffekt beteiligt ist. Die Summe sollte fachlich plausibel bleiben.',
  mNote: 'Arbeitsnotiz für Meeting, Klärpunkte oder Governance-Auflagen. Die Notiz wird gespeichert, in der Übersicht markiert und im Report ausgewiesen.'
};

const el = Object.fromEntries([...inputIds, ...detailIds].map(id => [id, document.getElementById(id)]));
let measures = structuredClone(initialMeasures);
let selectedId = measures[0]?.id;
let scenario = 'basis';
let activeView = 'basis';
let meetingFocus = 'management';
let meetingTextOverrides = {};
let meetingTextEdit = null;
let wizard = null;
let lastStickySnapshot = null;
const storageKey = 'regulierte-sparten-szenario-rechner-v1';
const expertModeKey = 'regulierte-sparten-szenario-rechner-expert-mode';
const authorKey = 'regulierte-sparten-szenario-rechner-author';
const lastSeenEventKey = 'regulierte-sparten-szenario-rechner-last-seen-event';
const legacyStorageKeys = [];
const modelVersion = 3;
const appVersion = '0.3.0-dev';
let storageStatusTimer = null;
let expertMode = false;
let history = emptyHistory();
let previousModelForHistory = null;
let suppressHistoryEvents = false;

const impactAreaLabels = {
  qElement: 'Q-Element',
  efficiency: 'Effizienz/OPEX',
  costBase: 'Kostenbasis',
  risk: 'Risiko',
  portfolio: 'Portfolio'
};

const confidenceLabels = {
  proven: 'belegt',
  assumption: 'Annahme',
  review: 'prüfpflichtig'
};

const governanceLabels = {
  basis: 'Basisszenario',
  sensitivity: 'Sensitivität',
  excluded: 'nur dokumentiert'
};

const expertFieldIds = [
  'rab', 'returnRate', 'financingRate', 'discountRate', 'kanuEndYear',
  'degressiveRate', 'taxFactor', 'portfolioAttribution', 'qDelta', 'eDelta',
  'mType', 'mSecure', 'mUncertain', 'mProbability', 'mOpexRecognition',
  'mDepr', 'mQDirect', 'mEDirect', 'mRiskAvoided', 'mPortfolioShare'
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

function fmtTeur(value, digits = 0) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value) + ' TEUR';
}

function fmtPct(value, digits = 1) {
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value) + ' %';
}

function fmtPlain(value, digits = 0) {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
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
    note: ''
  };
}

function normalizeMeasureForUi(measure, index = 0) {
  return {
    ...newMeasureTemplate(index + 1),
    ...measure,
    id: String(measure.id || 'import_' + Date.now().toString(36) + '_' + index),
    impactAssumptions: Array.isArray(measure.impactAssumptions) ? structuredClone(measure.impactAssumptions) : []
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

function allImpactAssumptions(filterActive = false) {
  return measures
    .filter(measure => !filterActive || measure.active)
    .flatMap(measure => impactAssumptionsFor(measure).map(impact => ({ ...impact, measure })));
}

function reviewRequiredImpacts(filterActive = false) {
  return allImpactAssumptions(filterActive)
    .filter(item => item.confidence === 'review' || item.governance === 'sensitivity');
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

function setStorageStatus(text) {
  const node = document.getElementById('storageStatus');
  if (!node) return;
  node.textContent = text;
  window.clearTimeout(storageStatusTimer);
  storageStatusTimer = window.setTimeout(() => {
    if (node.textContent === text) node.textContent = '';
  }, 4500);
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
    meetingFocus,
    scenario,
    selectedId,
    inputs: Object.fromEntries(inputIds.map(id => [id, el[id].value])),
    measures: structuredClone(measures),
    meetingTextOverrides: structuredClone(meetingTextOverrides)
  };
}

function collectModelState() {
  return {
    app: 'regulierte-sparten-szenario-rechner',
    version: modelVersion,
    appVersion,
    regulatoryParameterSetId: regulatoryParameterSet.id,
    regulatoryParameterEffectiveMonth: regulatoryParameterSet.effectiveMonth,
    savedAt: new Date().toISOString(),
    model: currentModelData(),
    history: structuredClone(history)
  };
}

function legacyModelFromState(state) {
  return {
    activeView: state.activeView,
    meetingFocus: state.meetingFocus,
    scenario: state.scenario,
    selectedId: state.selectedId,
    inputs: state.inputs,
    measures: state.measures,
    meetingTextOverrides: state.meetingTextOverrides || {}
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
    if (Object.hasOwn(model.inputs, id)) el[id].value = model.inputs[id];
  });
  measures = model.measures.map((measure, index) => normalizeMeasureForUi(measure, index));
  selectedId = measures.some(measure => measure.id === model.selectedId)
    ? model.selectedId
    : measures[0]?.id;
  scenario = ['basis', 'konservativ', 'wert'].includes(model.scenario) ? model.scenario : 'basis';
  activeView = ['basis', 'measures', 'results', 'report'].includes(model.activeView) ? model.activeView : activeView;
  meetingFocus = ['management', 'technik', 'vnb', 'controlling', 'finanzierung'].includes(model.meetingFocus) ? model.meetingFocus : 'management';
  meetingTextOverrides = model.meetingTextOverrides && typeof model.meetingTextOverrides === 'object'
    ? structuredClone(model.meetingTextOverrides)
    : {};
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
  const state = collectModelState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = state.savedAt.slice(0, 19).replaceAll(':', '').replace('T', '-');
  anchor.href = url;
  anchor.download = 'regulierte-sparten-szenario-rechner-' + stamp + '.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setStorageStatus('JSON-Datei wurde zum Download vorbereitet.');
}

function importModelFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      applyModelState(JSON.parse(String(reader.result)));
      saveToBrowser(true);
      setStorageStatus('Import erfolgreich. Daten wurden im Browser gespeichert.');
    } catch (_error) {
      setStorageStatus('Import fehlgeschlagen: JSON-Datei passt nicht zum Rechner.');
    }
  });
  reader.readAsText(file);
}

function clearBrowserData() {
  try {
    [storageKey, expertModeKey, authorKey, lastSeenEventKey, ...legacyStorageKeys].forEach(key => localStorage.removeItem(key));
    setStorageStatus('Browserdaten dieses Rechners wurden gelöscht.');
  } catch (_error) {
    setStorageStatus('Browserdaten konnten nicht gelöscht werden.');
  }
}

function applyDemoModel() {
  hideStartScreen();
  el.sector.value = 'strom';
  el.baseYear.value = '2027';
  el.baseEog.value = '20000';
  el.rab.value = '85000';
  el.returnRate.value = '5.0';
  el.financingRate.value = '5.0';
  el.horizon.value = '20';
  el.discountRate.value = '5.0';
  el.kanuEndYear.value = '2045';
  el.degressiveRate.value = '10';
  el.taxFactor.value = '0';
  el.portfolioAttribution.value = '25';
  el.qDelta.value = '0.6';
  el.eDelta.value = '0.2';
  measures = structuredClone(demoMeasures);
  selectedId = measures[0]?.id;
  scenario = 'basis';
  activeView = 'results';
  meetingFocus = 'management';
  meetingTextOverrides = {};
  document.querySelectorAll('.scenario').forEach(btn => btn.classList.toggle('active', btn.dataset.scenario === scenario));
  document.querySelectorAll('.focus-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.focus === meetingFocus));
  setView(activeView);
  renderAll();
  setStorageStatus('Demodaten wurden geladen und im Browser gespeichert.');
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

function openMeasureEditModal() {
  renderDetail();
  document.getElementById('measureEditModal').classList.remove('hidden');
}

function closeMeasureEditModal() {
  document.getElementById('measureEditModal').classList.add('hidden');
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
  root.querySelectorAll('label[for]').forEach(label => {
    if (label.querySelector('.info-dot')) return;
    const help = fieldHelp[baseHelpId(label.getAttribute('for'))];
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
  node.classList.toggle('active', validation.messages.length > 0);
  node.innerHTML = validation.messages.length
    ? `<strong>Annahmen begrenzt</strong><ul>${validation.messages.map(message => `<li>${esc(message)}</li>`).join('')}</ul>`
    : '';
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

function decisionFor(result) {
  const spread = Number.isFinite(result.irr) ? result.irr - result.p.financingRate : NaN;
  if (!result.activeMeasures.length) {
    return { cls: 'warn', title: 'Keine aktive Maßnahme', text: 'Es ist kein investives Szenario ausgewählt.' };
  }
  if (Number.isFinite(spread) && spread >= 0.01 && result.npv > 0) {
    return { cls: 'good', title: 'Wirtschaftlich tragfähig', text: 'Portfolio-IRR und Kapitalwert liegen oberhalb der Finanzierungsschwelle. Attribution und Portfolioeffekte müssen trotzdem belegbar bleiben.' };
  }
  if (Number.isFinite(spread) && spread >= -0.01) {
    return { cls: 'warn', title: 'Grenzfall', text: 'Die Wirtschaftlichkeit ist nahe an den Kapitalkosten. Entscheidung braucht belastbare Annahmen zu Aktivierung, Q/E, Risiko und Timing.' };
  }
  return { cls: 'bad', title: 'Nicht als Renditemaßnahme tragfähig', text: 'Unter den aktuellen Annahmen liegt die Rendite unter dem Fremdkapitalzins. Umsetzung wäre nur über Risiko, Pflicht, Strategie oder bessere Annahmen begründbar.' };
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

function setDelta(id, delta) {
  const node = document.getElementById(id);
  node.textContent = delta.text;
  node.classList.toggle('up', delta.cls === 'up');
  node.classList.toggle('down', delta.cls === 'down');
  if (delta.cls) markStickyChange(node.closest('.sticky-kpi'));
}

function renderStickyKpis(result, first, decision) {
  const snapshot = {
    eog: first.eog,
    irr: result.irr,
    npv: result.npv,
    verdict: decision.title
  };
  const verdictTile = document.getElementById('stickyVerdictTile');
  verdictTile.className = 'sticky-kpi ' + decision.cls;
  document.getElementById('stickyVerdict').textContent = decision.title;
  document.getElementById('stickyEog').textContent = fmtTeur(snapshot.eog, 1);
  document.getElementById('stickyIrr').textContent = Number.isFinite(snapshot.irr) ? fmtPct(snapshot.irr * 100, 1) : '-';
  document.getElementById('stickyNpv').textContent = fmtTeur(snapshot.npv, 1);

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

function renderManagementSummary(result, first, spread, decision) {
  const verdict = document.getElementById('managementVerdict');
  verdict.className = 'verdict-card ' + decision.cls;
  document.getElementById('managementVerdictTitle').textContent = decision.title;
  document.getElementById('managementVerdictText').textContent = decision.text;

  const irrText = Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : 'nicht berechenbar';
  const spreadAbs = Number.isFinite(spread) ? Math.abs(spread) : NaN;
  const spreadSentence = Number.isFinite(spread)
    ? `Der IRR liegt ${pp(spreadAbs)} ${trendWord(spread)} dem FK-Zins von ${fmtPct(result.p.financingRate * 100, 1)}.`
    : 'Der Spread zum FK-Zins ist nicht berechenbar.';
  const activeText = result.activeMeasures.length === 1 ? '1 aktive Maßnahme' : result.activeMeasures.length + ' aktive Maßnahmen';

  document.getElementById('managementStory').textContent = result.activeMeasures.length
    ? `Bei ${fmtTeur(result.invest)} Investition und ${activeText} entsteht im ersten Jahr ein EOG-Zusatz von ${fmtTeur(first.eog, 1)} in ${periodDetailText(result.p.regulatoryPeriod)}; der Portfolio-IRR beträgt ${irrText}. ${spreadSentence}`
    : 'Es ist keine aktive Maßnahme ausgewählt. Für eine Entscheidung müssen zuerst Maßnahmen aktiviert oder angelegt werden.';

  const knowledgeEffect = result.qePa + result.impactPa;
  document.getElementById('managementCaveat').textContent = result.activeMeasures.length
    ? knowledgeEffect > 0
      ? `Dokumentierte Portfolio- und Wirkannahmen von ${fmtTeur(knowledgeEffect, 1)} p.a. sind entscheidungsrelevant und müssen kausal sowie regulatorisch begründet bleiben.`
      : 'Die Wirtschaftlichkeit hängt vor allem an Aktivierbarkeit, Anerkennungsfähigkeit, Timing und Risikowert der Maßnahmen.'
    : 'Ohne aktive Maßnahme gibt es keinen belastbaren Business Case.';

  document.getElementById('managementNextStep').textContent = result.activeMeasures.length
    ? 'Im Meeting die drei offenen Annahmen festziehen: Aktivierungsprofil, regulatorische Anerkennung und zurechenbare Portfolio-/Risikowirkung.'
    : 'Eine Maßnahme aktivieren, Demodaten laden oder eine neue Maßnahme geführt erfassen.';

	      const pills = [
	        ['Invest ' + fmtTeur(result.invest), ''],
	        ['IRR ' + irrText, decision.cls],
	        ['Spread ' + (Number.isFinite(spread) ? fmtPct(spread * 100, 1) : '-'), decision.cls]
	      ];
	      document.getElementById('managementPills').innerHTML = pills.map(([text, cls]) => `<span class="pill ${cls}">${text}</span>`).join('');
	      document.getElementById('verdictWhyList').innerHTML = [
	        `Grün: Spread ≥ 1,0 Prozentpunkt und Kapitalwert > 0.`,
	        `Gelb: Spread ≥ -1,0 Prozentpunkt, aber Grün-Kriterien nicht vollständig erfüllt, oder keine aktive Maßnahme.`,
	        `Rot: Spread < -1,0 Prozentpunkt oder Spread nicht belastbar.`,
	        `Aktuell: Spread ${Number.isFinite(spread) ? fmtPct(spread * 100, 1) : '-'}, Kapitalwert ${fmtTeur(result.npv, 1)}.`
	      ].map(item => `<li>${esc(item)}</li>`).join('');
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

function renderMeetingFocus(result, first, spread) {
  const activatedShare = result.invest > 0 ? result.activated / result.invest * 100 : 0;
  const irrText = Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-';
  const spreadText = Number.isFinite(spread) ? fmtPct(spread * 100, 1) : '-';
  const rows = {
    management: [
      meetingCard('management', 'decisionQuestion', 'Beschlussfrage', Number.isFinite(result.irr) ? irrText + ' IRR' : '', `Ist der Business Case bei ${fmtTeur(result.invest)} Investition und ${fmtTeur(first.eog, 1)} EOG-Zusatz im Startjahr tragfähig?`),
      meetingCard('management', 'whyItWorks', 'Warum es trägt', Number.isFinite(spread) ? spreadText + ' Spread' : '', `Rendite wird gegen FK-Zins ${fmtPct(result.p.financingRate * 100, 1)} und Kapitalwert ${fmtTeur(result.npv, 1)} gespiegelt.`),
      meetingCard('management', 'watchOut', 'Nicht übersehen', '', result.qePa + result.impactPa > 0 ? `Q/E- und Wirkannahmen von ${fmtTeur(result.qePa + result.impactPa, 1)} p.a. brauchen Nachweis, Attribution und Governance-Status.` : 'Ohne Portfolioeffekt zählt vor allem die direkte regulatorische Kapitalwirkung.')
    ],
    technik: [
      meetingCard('technik', 'technicalScope', 'Technische Betroffenheit', '', activeMeasureNames(result)),
      meetingCard('technik', 'commissioningImpact', 'Inbetriebnahme & Wirkung', fmtTeur(first.eog, 1), `EOG-Wirkung startet im Jahr ${result.p.baseYear} in ${periodText(result.p.regulatoryPeriod)}. Timing und Bau-/Inbetriebnahmejahr entscheiden über das Zahlungsprofil.`),
      meetingCard('technik', 'riskArgument', 'Risikoargument', fmtTeur(result.yearly[0]?.opexRisk || 0, 1), 'OPEX/Risiko im Startjahr. Technik sollte Risikowert, Störungsfolgen und Umsetzungsrisiken validieren.')
    ],
    vnb: [
      meetingCard('vnb', 'eogStartYear', 'EOG-Wirkung Startjahr', fmtTeur(first.eog, 1), `${periodDetailText(result.p.regulatoryPeriod)} mit Kostenbasis ${result.p.regulatoryPeriod.costBaseYear}. Basis-EOG steigt modellhaft auf ${fmtTeur(result.p.baseEog + first.eog, 1)}.`),
      meetingCard('vnb', 'capitalBase', 'Regulatorische Kapitalbasis', fmtTeur(result.activated), `${fmtPct(activatedShare, 1)} der Investition wird erwartbar kapitalwirksam.`),
      meetingCard('vnb', 'recognitionQe', 'Anerkennung / Q/E', fmtTeur(result.qePa + result.impactPa, 1), 'Portfolioeffekte, Wirkannahmen und OPEX-Anerkennung getrennt belegen, damit keine Doppelzählung entsteht.')
    ],
    controlling: [
      meetingCard('controlling', 'investmentVolume', 'Investitionsvolumen', fmtTeur(result.invest), `${result.activeMeasures.length} aktive Maßnahmen im Szenario.`),
      meetingCard('controlling', 'npv', 'Kapitalwert', fmtTeur(result.npv, 1), `Gegen Diskontsatz ${fmtPct(result.p.discountRate * 100, 1)} gerechnet.`),
      meetingCard('controlling', 'resultLogic', 'Ergebnislogik', spreadText, `Spread zum FK-Zins. Controlling sollte Szenario, Budgetwirkung und Ergebnisbeitrag konsistent übernehmen.`)
    ],
    finanzierung: [
      meetingCard('finanzierung', 'financingHurdle', 'Finanzierungshürde', fmtPct(result.p.financingRate * 100, 1), 'FK-Zins als Mindestschwelle für die Renditebetrachtung.'),
      meetingCard('finanzierung', 'returnBuffer', 'Renditepuffer', spreadText, `IRR ${irrText} im Vergleich zur Finanzierungshürde.`),
      meetingCard('finanzierung', 'advisorQuestion', 'Bank-/Beraterfrage', fmtTeur(result.npv, 1), 'Sind Cashflow-Profil, regulatorische Anerkennung und Sensitivitäten ausreichend belegbar?')
    ]
  };
  document.getElementById('meetingFocusBody').innerHTML = rows[meetingFocus].join('');
}

function renderMeasures() {
  const p = currentParams();
  if (!measures.length) {
    document.getElementById('measureBody').innerHTML = `
      <tr>
        <td colspan="8">Noch keine Maßnahme angelegt. Lege eine neue Maßnahme geführt an oder lade Demodaten.</td>
      </tr>
    `;
    return;
  }
  document.getElementById('measureBody').innerHTML = measures.map(measure => {
    const result = calcMeasure(measure, p, portfolioEffectFor(measure, p));
    const counts = impactCounts(measure);
    return `
      <tr class="${measure.id === selectedId ? 'selected' : ''}" data-id="${measure.id}">
        <td><input type="checkbox" data-action="active" data-id="${measure.id}" ${measure.active ? 'checked' : ''}></td>
        <td><button type="button" data-action="select" data-id="${measure.id}">${measure.name}</button></td>
        <td>${measure.year}</td>
        <td>${fmtTeur(measure.cost)}</td>
        <td>${fmtPct(result.activeShare * 100, 0)}</td>
        <td>${counts.total ? `${counts.total} (${counts.review} prüf.)` : '-'}</td>
        <td>${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'}</td>
        <td><span class="note-indicator ${String(measure.note || '').trim() ? '' : 'empty'}" title="${String(measure.note || '').trim() ? esc(measure.note) : 'Keine Notiz'}">i</span></td>
      </tr>
    `;
  }).join('');
}

function selectedMeasure() {
  return measures.find(measure => measure.id === selectedId) || measures[0];
}

function setView(view) {
  activeView = view;
  document.querySelectorAll('.view-tab').forEach(button => {
    button.classList.toggle('active', button.dataset.view === view);
  });
  document.querySelectorAll('[data-view-panel]').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.viewPanel !== view);
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
    impactAssumptions: [],
    note: ''
  };
}

function basisDraft() {
  return {
    sector: el.sector.value,
    baseYear: Math.round(num('baseYear')),
    baseEog: num('baseEog'),
    rab: num('rab'),
    returnRate: num('returnRate'),
    financingRate: num('financingRate'),
    horizon: Math.round(num('horizon')),
    discountRate: num('discountRate'),
    kanuEndYear: Math.round(num('kanuEndYear')),
    degressiveRate: num('degressiveRate'),
    taxFactor: num('taxFactor'),
    portfolioAttribution: num('portfolioAttribution'),
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
	          </div>
	          <p class="hint">Der Rechner leitet daraus ${periodDetailText(draftPeriod)} mit Kostenbasis ${draftPeriod.costBaseYear} ab.</p>
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
      </div>
      <p class="hint">Diese Werte sind der Anker für Portfolioeffekte und relative Bewertung.</p>
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
      ['Startjahr', d.baseYear],
      ['Regulierungsperiode', periodDetailText(draftPeriod)],
      ['Kostenbasis', draftPeriod.costBaseYear],
      ['Bestehende EOG', fmtTeur(d.baseEog)],
      ['Regulierte Kapitalbasis', fmtTeur(d.rab)],
      ['Kapitalverzinsung', fmtPct(d.returnRate)],
      ['Fremdkapitalzins', fmtPct(d.financingRate)],
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
	          ['Risikowert', fmtTeur(d.riskAvoided, 1) + ' p.a.'],
	          ['Portfolioanteil', fmtPct(d.portfolioShare)]
	        ])}
	        ${validation.messages.length ? `<div class="validation-messages active" role="status"><strong>Annahmen begrenzt</strong><ul>${validation.messages.map(message => `<li>${esc(message)}</li>`).join('')}</ul></div>` : ''}
	      `;
	    }

function collectWizardStep() {
  if (!wizard) return;
  const d = wizard.draft;
  if (wizard.type === 'basis') {
    if (wizard.step === 0) Object.assign(d, { sector: modalValue('w_sector'), baseYear: Math.round(modalNumber('w_baseYear')) });
    if (wizard.step === 1) Object.assign(d, { baseEog: modalNumber('w_baseEog'), rab: modalNumber('w_rab') });
    if (wizard.step === 2) Object.assign(d, { returnRate: modalNumber('w_returnRate'), financingRate: modalNumber('w_financingRate'), horizon: Math.round(modalNumber('w_horizon')), discountRate: modalNumber('w_discountRate') });
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
  setStepStatus(
    'status-report',
    decisionReady ? 'Report bereit' : 'noch offen',
    decisionReady ? 'done' : 'open'
  );
}

function selectOptions(options, selected) {
  return Object.entries(options)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`)
    .join('');
}

function renderImpactAssumptions(measure) {
  const node = document.getElementById('impactAssumptions');
  if (!node) return;
  const assumptions = impactAssumptionsFor(measure);
  const rows = assumptions.map(impact => `
    <article class="impact-card" data-impact-id="${esc(impact.id)}">
      <div class="impact-card-head">
        <div>
          <strong>${esc(impact.title)}</strong>
          <div class="impact-meta">${impactAreaLabel(impact.area)} · ${fmtTeur(impact.amount * impact.attribution, 1)} p.a. · ${impactGovernanceLabel(impact.governance)}</div>
        </div>
        <div class="impact-actions">
          ${confidenceBadge(impact.confidence)}
          <button type="button" data-action="removeImpact" data-impact-id="${esc(impact.id)}" class="small-danger">Entfernen</button>
        </div>
      </div>
      <div class="grid2 compact-grid">
        <div>
          <label>Titel</label>
          <input type="text" data-impact-field="title" data-impact-id="${esc(impact.id)}" value="${esc(impact.title)}">
        </div>
        <div>
          <label>Wirkbereich</label>
          <select data-impact-field="area" data-impact-id="${esc(impact.id)}">${selectOptions(impactAreaLabels, impact.area)}</select>
        </div>
        <div>
          <label>Wert TEUR p.a.</label>
          <input type="number" data-impact-field="amount" data-impact-id="${esc(impact.id)}" value="${impact.amount}" step="1">
        </div>
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
      <textarea data-impact-field="evidence" data-impact-id="${esc(impact.id)}" placeholder="Historie, Betriebserfahrung, Gutachten, Regulierungsmanagement ...">${esc(impact.evidence)}</textarea>
      <label>Prüf- oder Freigabehinweis</label>
      <textarea data-impact-field="note" data-impact-id="${esc(impact.id)}" placeholder="Was muss vor Beschluss/Freigabe noch bestätigt werden?">${esc(impact.note)}</textarea>
    </article>
  `).join('');
  node.innerHTML = rows || '<p class="hint">Noch keine Wirkannahme erfasst. Direkte Q-/E- oder Risikowerte sollten künftig hier mit Quelle, Kausalkette und Vertrauensstufe dokumentiert werden.</p>';
}

function updateImpactAssumption(event) {
  const field = event.target.dataset.impactField;
  const id = event.target.dataset.impactId;
  const measure = selectedMeasure();
  if (!field || !id || !measure) return;
  const impact = (measure.impactAssumptions || []).find(item => String(item.id) === id);
  if (!impact) return;
  const numericFields = new Set(['amount', 'attribution', 'startYear', 'endYear']);
  impact[field] = numericFields.has(field) ? event.target.value === '' ? '' : Number(event.target.value) : event.target.value;
  if (field === 'confidence' && impact.confidence === 'review' && impact.governance === 'basis') {
    impact.governance = 'sensitivity';
  }
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
	        return;
	      }
  el.mName.value = measure.name;
  el.mType.value = measure.type;
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
  el.mNote.value = measure.note || '';

  const p = currentParams();
  const result = calcMeasure(measure, p, portfolioEffectFor(measure, p));
	      const pills = [
	        ['aktivierbar ' + fmtTeur(result.activated), 'good'],
    ['IRR ' + (Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'), Number.isFinite(result.irr) && result.irr >= p.financingRate ? 'good' : 'warn'],
    [measure.type === 'noRegret' ? 'No-Regret' : measure.type === 'risiko' ? 'Risiko' : 'Wahl', measure.type === 'noRegret' ? 'warn' : 'good']
	      ];
	      document.getElementById('selectedPills').innerHTML = pills.map(([text, cls]) => `<span class="pill ${cls}">${text}</span>`).join('');
	      renderMeasureValidation(measure);
      renderImpactAssumptions(measure);
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
    ['opexRisk', '#7b6a9a', 'OPEX/Risiko']
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
      `OPEX/Risiko: ${fmtTeur(row.opexRisk, 1)}`,
      `EOG Zusatz: ${fmtTeur(row.eog, 1)}`
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
  document.getElementById('yearBody').innerHTML = result.yearly.map(row => `
    <tr>
      <td>${row.year}</td>
      <td>${periodText(row.regulatoryPeriod)}</td>
      <td>${fmtTeur(result.p.baseEog, 1)}</td>
      <td>${fmtTeur(row.depreciation, 1)}</td>
      <td>${fmtTeur(row.capitalReturn, 1)}</td>
      <td>${fmtTeur(row.qAndE, 1)}</td>
      <td>${fmtTeur(row.opexRisk, 1)}</td>
      <td>${fmtTeur(row.eog, 1)}</td>
      <td>${fmtTeur(result.p.baseEog + row.eog, 1)}</td>
    </tr>
  `).join('');
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
        <td>${fmtTeur(first.eog, 1)}</td>
        <td>${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'}</td>
        <td>${fmtTeur(result.npv, 1)}</td>
      </tr>
    `;
  });
  document.getElementById('scenarioBody').innerHTML = rows.join('');
}

function scenarioLabel(name) {
  return name === 'basis' ? 'Basis' : name === 'konservativ' ? 'Konservativ' : 'Wert';
}

function renderReport(result, first, spread, decision) {
  const report = document.getElementById('reportPage');
  if (!report) return;
  const activeText = result.activeMeasures.length === 1 ? '1 aktive Maßnahme' : result.activeMeasures.length + ' aktive Maßnahmen';
  const scenarioRows = ['basis', 'konservativ', 'wert'].map(name => {
    const scenarioResult = currentPortfolio(currentScenarioParams(name));
    const scenarioFirst = scenarioResult.yearly[0] || { eog: 0 };
    return `
      <tr>
        <td>${scenarioLabel(name)}</td>
        <td>${fmtPct(scenarioResult.p.attribution * 100, 0)}</td>
        <td>${fmtTeur(scenarioResult.qePa + scenarioResult.impactPa, 1)}</td>
        <td>${fmtTeur(scenarioFirst.eog, 1)}</td>
        <td>${Number.isFinite(scenarioResult.irr) ? fmtPct(scenarioResult.irr * 100, 1) : '-'}</td>
        <td>${fmtTeur(scenarioResult.npv, 1)}</td>
      </tr>
    `;
  }).join('');
  const measureRows = result.results.map(item => `
    <tr>
      <td>${esc(item.measure.name)}</td>
      <td>${item.measure.year}</td>
      <td>${fmtTeur(item.measure.cost)}</td>
      <td>${fmtPct(item.activeShare * 100, 0)}</td>
      <td>${impactCounts(item.measure).total || '-'}</td>
      <td>${Number.isFinite(item.irr) ? fmtPct(item.irr * 100, 1) : '-'}</td>
      <td>${String(item.measure.note || '').trim() ? 'Ja' : '-'}</td>
    </tr>
  `).join('') || '<tr><td colspan="7">Keine aktive Maßnahme im Report.</td></tr>';
  const impactRows = allImpactAssumptions(true).map(item => `
    <tr>
      <td>${esc(item.measure.name)}</td>
      <td>${impactAreaLabel(item.area)}</td>
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
        <p>${esc(measure.note)}</p>
      </article>
    `).join('')
    : '<p class="hint">Keine Maßnahmennotizen erfasst.</p>';
  const story = result.activeMeasures.length
    ? `Bei ${fmtTeur(result.invest)} Investition und ${activeText} entsteht im Startjahr ein EOG-Zusatz von ${fmtTeur(first.eog, 1)} in ${periodDetailText(result.p.regulatoryPeriod)}. Der Portfolio-IRR beträgt ${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : 'nicht berechenbar'} bei einem FK-Zins von ${fmtPct(result.p.financingRate * 100, 1)}.`
    : 'Es ist keine aktive Maßnahme ausgewählt. Der Report dokumentiert daher noch keinen belastbaren Business Case.';

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
      </div>
    </div>

    <section class="report-section">
      <h2>Entscheidungstendenz</h2>
      <div class="report-summary">
        <div class="report-box">
          <strong>Urteil</strong>
          <p>${decision.title}</p>
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
        <div class="kpi"><div class="label">EOG-Zusatz Jahr 1</div><div class="value">${fmtTeur(first.eog, 1)}</div><div class="sub">${result.p.baseYear} / ${periodText(result.p.regulatoryPeriod)}</div></div>
        <div class="kpi"><div class="label">Portfolio IRR</div><div class="value">${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'}</div><div class="sub">Spread ${Number.isFinite(spread) ? fmtPct(spread * 100, 1) : '-'}</div></div>
        <div class="kpi"><div class="label">Kapitalwert</div><div class="value">${fmtTeur(result.npv, 1)}</div><div class="sub">Diskontsatz ${fmtPct(result.p.discountRate * 100, 1)}</div></div>
      </div>
    </section>

    <section class="report-section">
      <h2>Szenariovergleich</h2>
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
          <thead><tr><th>Maßnahme</th><th>Jahr</th><th>Kosten</th><th>aktiv.</th><th>Wirkannahmen</th><th>IRR</th><th>Notiz</th></tr></thead>
          <tbody>${measureRows}</tbody>
        </table>
      </div>
    </section>

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
      <h2>Offene Punkte aus Maßnahmennotizen</h2>
      <div class="note-list">${notesHtml}</div>
    </section>
  `;
}

function renderPortfolio() {
  const result = currentPortfolio(currentScenarioParams(scenario));
  const first = result.yearly[0] || { eog: 0 };
  const activatedShare = result.invest > 0 ? result.activated / result.invest * 100 : 0;
  const spread = Number.isFinite(result.irr) ? result.irr - result.p.financingRate : NaN;

  document.getElementById('kpiInvest').textContent = fmtTeur(result.invest);
  document.getElementById('kpiInvestSub').textContent = result.activeMeasures.length + ' aktive Maßnahmen';
  document.getElementById('kpiActivated').textContent = fmtTeur(result.activated);
  document.getElementById('kpiActivatedSub').textContent = fmtPct(activatedShare, 1) + ' der Investitionen';
  document.getElementById('kpiEog').textContent = fmtTeur(first.eog, 1);
  document.getElementById('kpiEogSub').textContent = result.p.baseYear + ' / ' + periodText(result.p.regulatoryPeriod);
  document.getElementById('kpiIrr').textContent = Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-';
  document.getElementById('kpiIrrSub').textContent = 'FK-Zins ' + fmtPct(result.p.financingRate * 100, 1);
  document.getElementById('kpiNpv').textContent = fmtTeur(result.npv, 1);
  document.getElementById('kpiPortfolioEffect').textContent = fmtTeur(result.qePa + result.impactPa, 1);
  document.getElementById('kpiPortfolioSub').textContent = 'p.a. aus Q/E und Wirkannahmen';
  document.getElementById('kpiTotalEog').textContent = fmtTeur(result.p.baseEog + first.eog, 1);
  document.getElementById('kpiSpread').textContent = Number.isFinite(spread) ? fmtPct(spread * 100, 1) : '-';

	      const decision = decisionFor(result);
	      renderStickyKpis(result, first, decision);
	      renderManagementSummary(result, first, spread, decision);
  renderMeetingFocus(result, first, spread);

  renderChart(result.yearly);
  renderYears(result);
  renderScenarios();
  renderReport(result, first, spread, decision);
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
  renderGlobalValidation();
  renderScenarioDiff();
  renderMeasures();
  renderDetail();
  renderPortfolio();
  updateActionLabels();
  updateFlowStatus();
  if (persist) saveToBrowser(true);
}

function updateSelectedFromDetail() {
  const measure = selectedMeasure();
  if (!measure) return;
  Object.assign(measure, {
	        name: el.mName.value,
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
	        note: el.mNote.value
  });
  renderAll();
}

inputIds.forEach(id => el[id].addEventListener('input', renderAll));
el.sector.addEventListener('change', renderAll);
detailIds.forEach(id => el[id].addEventListener('input', updateSelectedFromDetail));
el.mType.addEventListener('change', updateSelectedFromDetail);
el.mDepr.addEventListener('change', updateSelectedFromDetail);
enhanceHelpLabels();
loadExpertMode();
setExpertMode(expertMode, false);

document.querySelectorAll('.view-tab').forEach(button => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

document.addEventListener('click', event => {
  if (!event.target.closest('.info-dot') && !event.target.closest('#fieldHelpPopover')) hideFieldHelp();
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

document.getElementById('measureBody').addEventListener('click', event => {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;
  if (!action || !id) return;
  const measure = measures.find(item => item.id === id);
  if (!measure) return;
  if (action === 'select') {
    selectedId = id;
    renderAll();
    openMeasureEditModal();
    return;
  }
  if (action === 'active') measure.active = event.target.checked;
  renderAll();
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
document.getElementById('measureEditModal').addEventListener('click', event => {
  if (event.target.id === 'measureEditModal') closeMeasureEditModal();
});
document.getElementById('addImpactAssumption').addEventListener('click', addImpactAssumption);
document.getElementById('impactAssumptions').addEventListener('change', updateImpactAssumption);
document.getElementById('impactAssumptions').addEventListener('click', event => {
  const button = event.target.closest('[data-action="removeImpact"]');
  if (!button) return;
  removeImpactAssumption(button.dataset.impactId);
});
document.getElementById('meetingTextCancel').addEventListener('click', closeMeetingTextModal);
document.getElementById('meetingTextSave').addEventListener('click', saveMeetingTextModal);
document.getElementById('meetingTextReset').addEventListener('click', resetMeetingTextModal);
document.getElementById('meetingTextModal').addEventListener('click', event => {
  if (event.target.id === 'meetingTextModal') closeMeetingTextModal();
});
document.getElementById('openBasisWizard').addEventListener('click', openBasisWizard);
document.getElementById('newMeasure').addEventListener('click', openMeasureWizard);
document.getElementById('exportModel').addEventListener('click', exportModel);
document.getElementById('expertModeToggle').addEventListener('change', event => {
  setExpertMode(event.target.checked);
});
document.getElementById('startDemo').addEventListener('click', applyDemoModel);
document.getElementById('startWizard').addEventListener('click', () => {
  hideStartScreen();
  setView('basis');
  renderAll();
  openBasisWizard();
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
document.getElementById('loadDemoModel').addEventListener('click', applyDemoModel);
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
  applyDemoModel();
});
document.getElementById('loadCancel').addEventListener('click', closeLoadModal);
document.getElementById('loadModal').addEventListener('click', event => {
  if (event.target.id === 'loadModal') closeLoadModal();
});
document.getElementById('importFile').addEventListener('change', event => {
  importModelFile(event.target.files[0]);
  event.target.value = '';
});
document.getElementById('toggleAllInCatalog').addEventListener('click', toggleAllMeasures);
document.getElementById('wizardCancel').addEventListener('click', closeWizard);
document.getElementById('wizardBack').addEventListener('click', wizardBack);
document.getElementById('wizardNext').addEventListener('click', wizardForward);
document.getElementById('wizardModal').addEventListener('click', event => {
  if (event.target.id === 'wizardModal') closeWizard();
});

document.getElementById('resetModel').addEventListener('click', () => {
  if (!window.confirm('Aktuelles Modell zurücksetzen? Gespeicherte Browserdaten werden danach mit dem leeren Modell überschrieben.')) return;
  measures = structuredClone(initialMeasures);
  selectedId = measures[0]?.id;
  scenario = 'basis';
  meetingFocus = 'management';
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

if (!loadFromBrowser()) {
  setView(activeView);
  renderAll(false);
  previousModelForHistory = currentModelData();
  showStartScreen();
}
