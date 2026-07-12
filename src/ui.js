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
  riskExpectedValue,
  scenarioParams as engineScenarioParams
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
    objectiveIds: ['obj_supply', 'obj_eff'],
    opexPa: 18,
    opexDeltaPa: 10,
    reinvestCost: 120,
    decommissionCost: 25,
    decommissionYear: 2042,
    impactAssumptions: [
      {'id':'impact_demo_grid_q','area':'qElement','title':'Weniger lange Versorgungsunterbrechungen','amount':15,'confidence':'assumption','governance':'basis','startYear':2027,'endYear':'','attribution':100,'chain':'Automatisierung grenzt Fehler schneller ein und verkürzt Wiederversorgung im Schwerpunktgebiet.','evidence':'Betriebserfahrung aus Störungsanalyse Nord 2024-2026','evidenceType':'operations','note':'Mit Regulierungsmanagement auf Q-Systematik prüfen.'},
      {'id':'impact_demo_grid_e','area':'efficiency','title':'Weniger manuelle Entstörung und Schaltaufwand','amount':8,'confidence':'assumption','governance':'basis','startYear':2027,'endYear':'','attribution':100,'chain':'Fernsteuerung reduziert Anfahrten und manuelle Schalthandlungen.','evidence':'Expertenschätzung Netzbetrieb','evidenceType':'expert','note':''},
      {'id':'impact_demo_grid_risk','area':'risk','title':'Vermiedene Großstörung im Schwerpunktgebiet','confidence':'review','governance':'sensitivity','startYear':2027,'endYear':'','attribution':100,'chain':'Automatisierung reduziert Eskalationsrisiko bei Folgefehlern.','evidence':'Risikoworkshop offen','evidenceType':'open','riskProbabilityBefore':8,'riskProbabilityAfter':3,'riskImpact':400,'note':'Nur als Sensitivität bis Freigabe.'}
    ],
    note: 'Abstimmen, ob der Qualitätsbeitrag separat messbar ist oder nur als Portfolioeffekt angesetzt wird.'
  },
  {
    id: 'demo_station_replacement',
    active: true,
    templateId: 'tpl_fernwirk_trafo',
    templateVersion: '2026-07',
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
    objectiveIds: ['obj_supply'],
    opexPa: 6,
    opexDeltaPa: 4,
    reinvestCost: 0,
    decommissionCost: 15,
    decommissionYear: 2045,
    impactAssumptions: [
      {'id':'impact_demo_station_q','area':'qElement','title':'Fernwirkfähigkeit reduziert Ausfallminuten','amount':10,'confidence':'proven','governance':'basis','startYear':2027,'endYear':'','attribution':100,'chain':'Störung wird schneller erkannt und eingegrenzt; Wiederversorgungszeit sinkt.','evidence':'Historische Störungen vergleichbarer Stationen','evidenceType':'measurement','note':''},
      {'id':'impact_demo_station_risk','area':'risk','title':'Vermiedene Folgekosten bei Stationsausfall','confidence':'assumption','governance':'basis','startYear':2027,'endYear':'','attribution':100,'chain':'Ersatz reduziert Eintrittswahrscheinlichkeit alterungsbedingter Ausfälle.','evidence':'Asset-Zustandsbewertung und Betriebsschätzung','evidenceType':'operations','riskProbabilityBefore':6,'riskProbabilityAfter':1.5,'riskImpact':400,'note':''}
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
    objectiveIds: ['obj_supply', 'obj_decarb'],
    opexPa: 8,
    opexDeltaPa: 14,
    reinvestCost: 0,
    decommissionCost: 80,
    decommissionYear: 2045,
    impactAssumptions: [
      {'id':'impact_demo_pressure_e','area':'efficiency','title':'Weniger ungeplante Instandsetzung','amount':6,'confidence':'assumption','governance':'basis','startYear':2027,'endYear':'','attribution':100,'chain':'Modernisierung senkt wiederkehrende Störungs- und Instandsetzungsaufwände.','evidence':'Instandhaltungsplanung','evidenceType':'operations','note':''},
      {'id':'impact_demo_pressure_risk','area':'risk','title':'Vermiedene Versorgungsunterbrechung','confidence':'review','governance':'sensitivity','startYear':2027,'endYear':'','attribution':100,'chain':'Zustandsrisiko sinkt, monetäre Höhe ist noch nicht freigegeben.','evidence':'Asset-Risikomatrix offen','evidenceType':'open','riskProbabilityBefore':5,'riskProbabilityAfter':2,'riskImpact':930,'note':'Prüfung durch Betrieb und VNB erforderlich.'}
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
    objectiveIds: ['obj_supply', 'obj_eff'],
    opexPa: 22,
    opexDeltaPa: 16,
    reinvestCost: 180,
    decommissionCost: 10,
    decommissionYear: 2040,
    impactAssumptions: [
      {'id':'impact_demo_sensor_q','area':'qElement','title':'Frühere Fehlererkennung verbessert Qualitätskennzahl','amount':18,'confidence':'review','governance':'sensitivity','startYear':2027,'endYear':'','attribution':100,'chain':'Sensorik liefert Zustandsdaten vor Störungen; konkrete Q-Wirkung muss aus Ereignisdaten abgeleitet werden.','evidence':'Noch keine belastbare Historie','evidenceType':'open','note':'Prüfpflichtig bis Datengrundlage vorliegt.'},
      {'id':'impact_demo_sensor_e','area':'efficiency','title':'Gezieltere Instandhaltung','amount':12,'confidence':'assumption','governance':'basis','startYear':2027,'endYear':'','attribution':100,'chain':'Zustandsdaten reduzieren Blindleistung in Inspektion und Instandhaltung.','evidence':'Betriebsschätzung','evidenceType':'expert','note':''}
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
    objectiveIds: ['obj_supply', 'obj_decarb'],
    opexPa: 4,
    opexDeltaPa: 9,
    reinvestCost: 0,
    decommissionCost: 95,
    decommissionYear: 2045,
    impactAssumptions: [
      {'id':'impact_demo_line_risk','area':'risk','title':'Vermiedener Schadensfall kritischer Leitungsabschnitt','confidence':'review','governance':'sensitivity','startYear':2027,'endYear':'','attribution':100,'chain':'Ersatz senkt Ausfallwahrscheinlichkeit und Folgekosten im kritischen Abschnitt.','evidence':'Risikowert aus Asset-Management noch zu validieren','evidenceType':'open','riskProbabilityBefore':7,'riskProbabilityAfter':1,'riskImpact':750,'note':'Nur Sensitivität bis Schadenshöhe und Eintrittswahrscheinlichkeit bestätigt sind.'}
    ],
    note: 'Risikowert validieren: Schadenshöhe, Eintrittswahrscheinlichkeit und mögliche Bauabhängigkeiten.'
  }
];

const inputIds = [
  'sector', 'regulationProcedure', 'baseYear', 'baseEog', 'rab', 'returnRate', 'financingRate',
  'annualEnergyGwh', 'householdConsumptionKwh',
  'horizon', 'discountRate', 'kanuEndYear', 'degressiveRate', 'taxFactor',
  'portfolioAttribution', 'qDelta', 'eDelta'
];

const detailIds = [
  'mName', 'mType', 'mCost', 'mYear', 'mSecure', 'mUncertain',
  'mProbability', 'mOpexRecognition', 'mLife', 'mDepr', 'mQDirect',
  'mEDirect', 'mRiskAvoided', 'mPortfolioShare', 'mOpexPa',
  'mOpexDeltaPa', 'mReinvestCost', 'mDecommissionCost',
  'mDecommissionYear', 'mNote'
];

const fieldHelp = {
  sector: 'Legt fest, welche regulatorische Logik gilt. Gas kann KANU-Szenarien enthalten; Strom ist bei Qualitäts- und Effizienzthemen anders zu bewerten.',
  regulationProcedure: 'Kleinere Netzbetreiber können ein vereinfachtes Verfahren nutzen, bei dem einige Größen pauschal festgelegt sind. Das Modell blendet dann Effekte aus, die individuell nicht erlöswirksam werden - so bleibt die Rechnung ehrlich.',
  baseYear: 'Startjahr der Betrachtung. Der Rechner leitet daraus je Sparte die passende Regulierungsperiode ab und rechnet alle Jahreswerte relativ zu diesem Jahr.',
  baseEog: 'Bestehende Erlösobergrenze der Sparte pro Jahr. Sie ist Bezugsgröße für Portfolioeffekte und zeigt, wie stark eine Maßnahme das Gesamtbild verändert.',
  rab: 'Regulatorisch gebundene Kapitalbasis. Sie hilft, Investitionen relativ zur bestehenden Kapitalbindung und zur künftigen Verzinsungsbasis einzuordnen.',
  returnRate: 'Regulatorische Kapitalverzinsung. Sie wirkt nur auf anerkanntes, aktiviertes Kapital und ist nicht automatisch die Rendite der Gesamtkosten.',
  financingRate: 'Kosten des eingesetzten Fremdkapitals. Der Vergleich mit IRR und Kapitalwert zeigt, ob eine Maßnahme den Finanzierungsspread trägt.',
  annualEnergyGwh: 'Verteilte Jahresarbeit der Sparte. Nur damit kann der Rechner den zulässigen Mehrerlös grob in Cent je Kilowattstunde und Euro je Durchschnittshaushalt übersetzen.',
  householdConsumptionKwh: 'Typischer Jahresverbrauch eines Durchschnittshaushalts. Gas nutzt ohne Eingabe 15.000 kWh, Strom 2.900 kWh. Der Wert ist nur eine Kommunikationsgröße.',
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
  mOpexPa: 'Laufende Kosten, die die Maßnahme selbst verursacht, zum Beispiel Wartung, Software oder Personal. Erst mit Betriebs- und Rückbaukosten zeigt sich, was eine Anlage über ihr Leben wirklich kostet.',
  mOpexDeltaPa: 'Vermiedene laufende Kosten der Altanlage oder des bisherigen Prozesses. Dieser Wert senkt die Lebenszykluskosten, sollte aber nicht zusätzlich als Effizienz-Wirkannahme doppelt angesetzt werden.',
  mReinvestCost: 'Erneuerungskosten, falls innerhalb des Betrachtungshorizonts nach Nutzungsdauer erneut investiert werden muss.',
  mDecommissionCost: 'Rückbau- oder Entsorgungskosten. Bei Gas können diese rund um das KANU-Zieljahr entscheidungsrelevant sein.',
  mDecommissionYear: 'Jahr, in dem Rückbau- oder Entsorgungskosten anfallen. Ohne Eingabe nutzt das Modell bei Gas das KANU-Zieljahr, sonst das Ende der Nutzungsdauer.',
  strategySampReference: 'Falls es einen strategischen Anlagenmanagementplan oder eine Unternehmensstrategie gibt: hier referenzieren. Gibt es keinen, einfach die wichtigsten Ziele der Sparte eintragen.',
  objectiveIds: 'Welchem übergeordneten Ziel dient die Maßnahme? Damit bleibt im Budget sichtbar, wofür investiert wird und was wegfällt, wenn gestrichen wird.',
  evidenceType: 'Art der Datenbasis. Messdaten und dokumentierte Betriebserfahrung erhöhen die Entscheidungsreife stärker als eine offene Schätzung.',
  riskProbabilityBefore: 'Wie oft pro Jahr tritt das Schadensereignis ohne Maßnahme ein? 10 % bedeutet statistisch ungefähr alle 10 Jahre.',
  riskProbabilityAfter: 'Wie oft pro Jahr tritt das Schadensereignis mit Maßnahme ein? Die Differenz zu vorher wird mit der Schadenshöhe bewertet.',
  riskImpact: 'Schadenshöhe je Ereignis in TEUR, inklusive Folgekosten, Sanktionen oder Wiederherstellungskosten.',
  committeeBody: 'Gremium, fuer das eine knappe Vorlage erstellt wird, zum Beispiel Gemeinderat, Aufsichtsrat oder Werksausschuss.',
  committeeMeetingDate: 'Sitzungsdatum fuer die Gremienvorlage. Leer lassen, wenn noch kein Termin feststeht.',
  committeeProposalText: 'Optionaler Beschlussvorschlag in Alltagssprache. Wenn leer, formuliert die Vorlage einen neutralen Vorschlag.',
  mNote: 'Arbeitsnotiz für Meeting, Klärpunkte oder Governance-Auflagen. Die Notiz wird gespeichert, in der Übersicht markiert und im Report ausgewiesen.'
};

const committeeIds = ['committeeBody', 'committeeMeetingDate', 'committeeProposalText'];
const el = Object.fromEntries([...inputIds, ...detailIds, ...committeeIds].map(id => [id, document.getElementById(id)]));
let measures = structuredClone(initialMeasures);
let selectedId = measures[0]?.id;
let scenario = 'basis';
let activeView = 'basis';
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
const modelVersion = 5;
const appVersion = '0.3.0-dev';
const processPhases = [
  ['initialisierung', 'Initialisierung'],
  ['datenerhebung', 'Datenerhebung'],
  ['massnahmenbewertung', 'Maßnahmenbewertung'],
  ['konsolidierung', 'Konsolidierung'],
  ['entscheidungsvorlage', 'Entscheidungsvorlage'],
  ['archiv', 'Beschluss/Archiv']
];

const roleProfiles = {
  owner: { label: 'Modellverantwortung', view: 'basis', focus: 'management', expert: true },
  expert: { label: 'Fachexpertise', view: 'expertWork', focus: 'technik', expert: false },
  management: { label: 'Management', view: 'results', focus: 'management', expert: false },
  audit: { label: 'Audit', view: 'report', focus: 'controlling', expert: true }
};
const defaultObjectives = [
  { id: 'obj_supply', label: 'Versorgungssicherheit', note: '' },
  { id: 'obj_decarb', label: 'KANU-/Dekarbonisierungspfad', note: '' },
  { id: 'obj_eff', label: 'Effizienz/Kostenpfad', note: '' }
];
let storageStatusTimer = null;
let expertMode = false;
let history = emptyHistory();
let previousModelForHistory = null;
let suppressHistoryEvents = false;
let processState = defaultProcessState();
let strategy = defaultStrategy();
let committee = defaultCommittee();
let currentRole = 'owner';
let clarificationStatus = {};
let pendingImportReview = null;
let basisEditing = false;
let expertFilter = 'all';

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

const evidenceTypeLabels = {
  measurement: 'Messdaten',
  operations: 'Betriebserfahrung',
  expert: 'Expertenschätzung',
  study: 'externe Studie',
  open: 'noch offen'
};

const measureTemplates = [
  {
    templateId: 'tpl_ons_ersatz',
    templateVersion: '2026-07',
    sector: 'strom',
    icon: '⚡',
    name: 'Ersatz Ortsnetzstation',
    costRange: [80, 150, 250],
    life: 35,
    depr: 'normal',
    secure: 80,
    uncertain: 20,
    probability: 50,
    opexRecognition: 60,
    impactSkeletons: [
      { area: 'risk', title: 'Vermiedener alterungsbedingter Ausfall', confidence: 'review', governance: 'sensitivity', chain: 'Ersatz senkt Ausfallwahrscheinlichkeit einer kritischen Station.', evidence: '', evidenceType: 'open', riskProbabilityBefore: 5, riskProbabilityAfter: 2, riskImpact: 250 }
    ],
    checkHints: ['Zustandsbewertung vorhanden?', 'Tiefbau im Zieljahr möglich?', 'Stationsstandort abgestimmt?']
  },
  {
    templateId: 'tpl_fernwirk_trafo',
    templateVersion: '2026-07',
    sector: 'strom',
    icon: '↔',
    name: 'Trafostation mit Fernwirkfähigkeit',
    costRange: [120, 220, 380],
    life: 35,
    depr: 'normal',
    secure: 75,
    uncertain: 25,
    probability: 55,
    opexRecognition: 55,
    impactSkeletons: [
      { area: 'qElement', title: 'Schnellere Wiederversorgung durch Fernwirkung', amount: 10, confidence: 'review', governance: 'sensitivity', chain: 'Fernsteuerung verkürzt Such- und Schaltzeiten bei Störungen.', evidence: '', evidenceType: 'open' },
      { area: 'risk', title: 'Vermiedene Folgekosten bei Stationsausfall', confidence: 'assumption', governance: 'sensitivity', chain: 'Fernwirkung reduziert Eskalationsrisiko bei Folgefehlern.', evidence: '', evidenceType: 'expert', riskProbabilityBefore: 6, riskProbabilityAfter: 2, riskImpact: 300 }
    ],
    checkHints: ['Fernwirkanbindung verfügbar?', 'Störungsminuten historisch belegbar?']
  },
  {
    templateId: 'tpl_kabelersatz_ms',
    templateVersion: '2026-07',
    sector: 'strom',
    icon: '━',
    name: 'Kabelersatz NS/MS je km',
    costRange: [180, 320, 550],
    life: 45,
    depr: 'normal',
    secure: 80,
    uncertain: 20,
    probability: 45,
    opexRecognition: 60,
    impactSkeletons: [
      { area: 'risk', title: 'Vermiedener Kabelfehler', confidence: 'review', governance: 'sensitivity', chain: 'Ersatz senkt die Eintrittswahrscheinlichkeit alterungsbedingter Kabelfehler.', evidence: '', evidenceType: 'open', riskProbabilityBefore: 7, riskProbabilityAfter: 2, riskImpact: 400 }
    ],
    checkHints: ['Kabellänge und Tiefbauanteil lokal geprüft?', 'Mit Straßenbau koordinierbar?']
  },
  {
    templateId: 'tpl_netzautomatisierung',
    templateVersion: '2026-07',
    sector: 'strom',
    icon: '●',
    name: 'Netzautomatisierung/Fernwirktechnik',
    costRange: [250, 600, 1200],
    life: 15,
    depr: 'normal',
    secure: 70,
    uncertain: 30,
    probability: 60,
    opexRecognition: 60,
    impactSkeletons: [
      { area: 'qElement', title: 'Weniger lange Versorgungsunterbrechungen', amount: 15, confidence: 'review', governance: 'sensitivity', chain: 'Automatisierung grenzt Fehler schneller ein und verkürzt Wiederversorgung.', evidence: '', evidenceType: 'open' },
      { area: 'efficiency', title: 'Weniger manuelle Schalt- und Entstörungsfahrten', amount: 8, confidence: 'assumption', governance: 'sensitivity', chain: 'Fernsteuerung reduziert manuelle Einsätze.', evidence: '', evidenceType: 'expert' }
    ],
    checkHints: ['Störungsstatistik und Schaltzeiten vorhanden?', 'IT-/Leittechnikaufwand eingepreist?']
  },
  {
    templateId: 'tpl_sensorik',
    templateVersion: '2026-07',
    sector: 'strom',
    icon: '◌',
    name: 'Sensorik/Zustandsüberwachung',
    costRange: [80, 220, 500],
    life: 12,
    depr: 'normal',
    secure: 55,
    uncertain: 35,
    probability: 60,
    opexRecognition: 50,
    impactSkeletons: [
      { area: 'efficiency', title: 'Gezieltere Instandhaltung', amount: 10, confidence: 'review', governance: 'sensitivity', chain: 'Zustandsdaten reduzieren ungeplante oder pauschale Instandhaltung.', evidence: '', evidenceType: 'open' }
    ],
    checkHints: ['Datenprozess nach Einführung geklärt?', 'Betriebskosten der Plattform berücksichtigt?']
  },
  {
    templateId: 'tpl_gdra_modernisierung',
    templateVersion: '2026-07',
    sector: 'gas',
    icon: '◇',
    name: 'GDRA-Modernisierung',
    costRange: [180, 450, 900],
    life: 40,
    depr: 'kanuLinear',
    secure: 75,
    uncertain: 25,
    probability: 50,
    opexRecognition: 70,
    impactSkeletons: [
      { area: 'risk', title: 'Vermiedene Versorgungsunterbrechung', confidence: 'review', governance: 'sensitivity', chain: 'Modernisierung senkt Ausfallwahrscheinlichkeit und Folgekosten der Anlage.', evidence: '', evidenceType: 'open', riskProbabilityBefore: 5, riskProbabilityAfter: 2, riskImpact: 800 }
    ],
    checkHints: ['KANU-Zieljahr/Rückbaupfad berücksichtigt?', 'Ersatzteil- und Zustandslage dokumentiert?']
  },
  {
    templateId: 'tpl_gas_leitung',
    templateVersion: '2026-07',
    sector: 'gas',
    icon: '═',
    name: 'Leitungsersatz Gas je km',
    costRange: [250, 600, 1100],
    life: 45,
    depr: 'kanuLinear',
    secure: 80,
    uncertain: 20,
    probability: 45,
    opexRecognition: 70,
    impactSkeletons: [
      { area: 'risk', title: 'Vermiedener Schadensfall Leitungsabschnitt', confidence: 'review', governance: 'sensitivity', chain: 'Ersatz reduziert Eintrittswahrscheinlichkeit und Folgekosten im Abschnitt.', evidence: '', evidenceType: 'open', riskProbabilityBefore: 6, riskProbabilityAfter: 1.5, riskImpact: 900 }
    ],
    checkHints: ['Schadenshistorie und Materialklasse belegt?', 'Rückbau-/Stilllegungspfad geprüft?']
  },
  {
    templateId: 'tpl_messtechnik_betrieb',
    templateVersion: '2026-07',
    sector: 'both',
    icon: '▣',
    name: 'Messtechnik/Digitalisierung Betrieb',
    costRange: [60, 180, 420],
    life: 12,
    depr: 'normal',
    secure: 60,
    uncertain: 30,
    probability: 60,
    opexRecognition: 50,
    impactSkeletons: [
      { area: 'efficiency', title: 'Weniger manueller Betriebsaufwand', amount: 8, confidence: 'review', governance: 'sensitivity', chain: 'Digitale Mess- und Betriebsdaten ersetzen manuelle Erfassung und verbessern Einsatzsteuerung.', evidence: '', evidenceType: 'open' }
    ],
    checkHints: ['Schnittstellen und Betriebskosten geklärt?', 'Doppelzählung mit OPEX-Einsparung vermeiden?']
  }
];

function defaultCommittee() {
  return {
    body: 'Gemeinderat',
    meetingDate: '',
    proposalText: ''
  };
}

function defaultProcessState() {
  const phaseTargets = Object.fromEntries(processPhases.map(([id]) => [id, '']));
  return {
    phase: 'massnahmenbewertung',
    phaseTargets,
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
    meetingDate: String(value.meetingDate || ''),
    proposalText: String(value.proposalText || '')
  };
}

function syncCommitteeFields() {
  if (!el.committeeBody) return;
  if (document.activeElement && committeeIds.includes(document.activeElement.id)) return;
  el.committeeBody.value = committee.body;
  el.committeeMeetingDate.value = committee.meetingDate;
  el.committeeProposalText.value = committee.proposalText;
}

function collectCommitteeFields() {
  committee = normalizeCommittee({
    body: el.committeeBody.value,
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
    phaseTargets: { ...defaults.phaseTargets, ...(value.phaseTargets || {}) }
  };
}

function phaseLabel(phase = processState.phase) {
  return processPhases.find(([id]) => id === phase)?.[1] || 'Maßnahmenbewertung';
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
  'rab', 'returnRate', 'financingRate', 'discountRate', 'kanuEndYear',
  'degressiveRate', 'taxFactor', 'portfolioAttribution', 'qDelta', 'eDelta',
  'mType', 'mSecure', 'mUncertain', 'mProbability', 'mOpexRecognition',
  'mDepr', 'mQDirect', 'mEDirect', 'mRiskAvoided', 'mPortfolioShare',
  'mOpexPa', 'mOpexDeltaPa', 'mReinvestCost', 'mDecommissionCost',
  'mDecommissionYear'
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

function fmtEur(value, digits = 0) {
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value) + ' EUR';
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
    objectiveIds: Array.isArray(measure.objectiveIds) ? measure.objectiveIds.map(String) : [],
    templateId: String(measure.templateId || ''),
    templateVersion: String(measure.templateVersion || ''),
    opexPa: Number(measure.opexPa) || 0,
    opexDeltaPa: Number(measure.opexDeltaPa) || 0,
    reinvestCost: Number(measure.reinvestCost) || 0,
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
    depr: el.sector.value === 'strom' ? 'normal' : template.depr,
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
      meta: `KANU-Ziel ${p.kanuEndYear} · Zuschlag/Steuern ${fmtPct(p.taxFactor * 100, 1)}`
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

function renderExpertWorkList() {
  const node = document.getElementById('expertWorkList');
  if (!node) return;
  const impactItems = reviewRequiredImpacts(true).map(item => ({
    key: item.measure.id + ':' + item.id,
    measureId: item.measure.id,
    title: item.title,
    measure: item.measure.name,
    area: impactWorkArea(item),
    detail: `${impactAreaLabel(item.area)} · ${confidenceLabels[item.confidence]} · ${impactGovernanceLabel(item.governance)}${item.note ? ' · ' + item.note : ''}`,
    type: 'impact'
  }));
  const clarificationWork = clarificationItems().map(item => ({
    ...item,
    area: item.area === 'Risiko' || item.area === 'Q-Element' ? 'technik' : item.area === 'Portfolio' || item.area === 'Kostenbasis' ? 'vnb' : 'controlling',
    type: 'clarification'
  }));
  const items = [...impactItems, ...clarificationWork]
    .filter(item => expertFilter === 'all' || item.area === expertFilter);
  node.innerHTML = items.length
    ? items.map(item => `
      <article class="clarification-item ${item.status === 'closed' ? 'closed' : ''}">
        <div>
          <strong>${esc(item.measure)}: ${esc(item.title)}</strong>
          <div class="clarification-meta">${esc(item.area)} · ${item.type === 'impact' ? 'Wirkannahme prüfen' : 'Klärpunkt'}</div>
          <p class="hint">${esc(item.detail)}</p>
        </div>
        <div class="row-actions">
          <button type="button" data-action="openWorkItem" data-measure-id="${esc(item.measureId || '')}">Öffnen</button>
          ${item.type === 'clarification' ? `<button type="button" data-action="toggleClarification" data-clarification-key="${esc(item.key)}">${item.status === 'closed' ? 'Wieder öffnen' : 'Klären'}</button>` : ''}
        </div>
      </article>
    `).join('')
    : '<div class="empty-state"><div class="empty-icon">✓</div><strong>Alles geklärt</strong><p>Für den gewählten Bereich liegen keine offenen prüfpflichtigen Punkte vor.</p></div>';
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

function clarificationItems() {
  const impactItems = reviewRequiredImpacts(true).map(item => ({
    key: `impact:${item.measure.id}:${item.id}`,
    type: 'impact',
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
      area: 'Maßnahme',
      targetPhase: 'konsolidierung',
      title: 'Maßnahmennotiz klären',
      measure: measure.name,
      detail: measure.note
    }));
  return [...impactItems, ...noteItems].map(item => ({
    ...item,
    status: clarificationStatus[clarificationKey(item)]?.status || 'open'
  }));
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

function renderProcessUx() {
  const phase = phaseLabel();
  const currentIndex = processPhases.findIndex(([id]) => id === processState.phase);
  const clarifications = clarificationItems();
  const openCount = clarifications.filter(item => item.status !== 'closed').length;
  const reviewCount = reviewRequiredImpacts(true).length;
  const target = processState.phaseTargets?.entscheidungsvorlage || '';
  const phaseSelect = document.getElementById('processPhase');
  const targetInput = document.getElementById('phaseTargetDate');
  if (phaseSelect) phaseSelect.value = processState.phase;
  if (targetInput) targetInput.value = target;
  const banner = document.getElementById('processBanner');
  if (banner) {
    banner.textContent = `KW ${isoWeek(new Date())} - ${phase}. ${reviewCount} Wirkannahmen prüfpflichtig, ${openCount} Klärpunkte offen${target ? `, Zieltermin Entscheidungsvorlage: ${formatDateShort(target)}` : ''}.`;
  }
  const phasePill = document.getElementById('phasePillLabel');
  if (phasePill) phasePill.textContent = target ? `${phase} · Ziel ${formatDateShort(target)}` : phase;
  const stepper = document.getElementById('phaseStepper');
  if (stepper) {
    stepper.innerHTML = processPhases.map(([, label], index) => `
      <span class="${index < currentIndex ? 'done' : index === currentIndex ? 'current' : ''}" title="${esc(label)}">
        <i></i><b>${esc(label)}</b>
      </span>
    `).join('');
  }
  const counter = document.getElementById('clarificationCounter');
  if (counter) counter.textContent = openCount ? `${openCount} Klärpunkte offen` : 'Keine offenen Klärpunkte';
}

function isoWeek(date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
}

function formatDateShort(value) {
  if (!value) return '';
  const date = new Date(value + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
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
      eog: first.eog,
      verdict: decisionFor(result).title,
      maturity,
      activeMeasures: result.activeMeasures.length
    };
  } catch (_error) {
    return { irr: NaN, npv: NaN, eog: NaN, verdict: '-', maturity: NaN, activeMeasures: 0 };
  }
}

function metricSummary(metrics) {
  return `IRR ${Number.isFinite(metrics.irr) ? fmtPct(metrics.irr * 100, 1) : '-'}, Kapitalwert ${Number.isFinite(metrics.npv) ? fmtTeur(metrics.npv, 1) : '-'}, Jahr-1-EOG ${Number.isFinite(metrics.eog) ? fmtTeur(metrics.eog, 1) : '-'}`;
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
  if (!listNode) return;
  const items = clarificationItems();
  listNode.innerHTML = items.length
    ? items.map(item => `
      <article class="clarification-item ${item.status === 'closed' ? 'closed' : ''}">
        <div>
          <strong>${esc(item.measure)}: ${esc(item.title)}</strong>
          <div class="clarification-meta">${esc(item.area)} · Zielphase ${esc(phaseLabel(item.targetPhase))} · ${item.status === 'closed' ? 'geklärt' : 'offen'}</div>
          <p class="hint">${esc(item.detail)}</p>
        </div>
        <button type="button" data-action="toggleClarification" data-clarification-key="${esc(item.key)}">${item.status === 'closed' ? 'Wieder öffnen' : 'Klären'}</button>
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
          <tr><td>Jahr-1-EOG</td>${metricDeltaCell(localMetrics, incomingMetrics, 'eog', value => Number.isFinite(value) ? fmtTeur(value, 1) : '-')}</tr>
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

function toggleClarification(key) {
  const current = clarificationStatus[key]?.status || 'open';
  clarificationStatus = {
    ...clarificationStatus,
    [key]: {
      status: current === 'closed' ? 'open' : 'closed',
      author: ensureAuthor(),
      timestamp: new Date().toISOString()
    }
  };
  renderAll();
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
    reportMode,
    meetingFocus,
    scenario,
    selectedId,
    role: currentRole,
    process: structuredClone(processState),
    strategy: structuredClone(strategy),
    committee: structuredClone(committee),
    inputs: Object.fromEntries(inputIds.map(id => [id, el[id].value])),
    measures: structuredClone(measures),
    meetingTextOverrides: structuredClone(meetingTextOverrides),
    clarificationStatus: structuredClone(clarificationStatus)
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
    reportMode: state.reportMode || 'management',
    meetingFocus: state.meetingFocus,
    scenario: state.scenario,
    selectedId: state.selectedId,
    role: state.role || 'owner',
    process: state.process || defaultProcessState(),
    strategy: state.strategy || defaultStrategy(),
    committee: state.committee || defaultCommittee(),
    inputs: state.inputs,
    measures: state.measures,
    meetingTextOverrides: state.meetingTextOverrides || {},
    clarificationStatus: state.clarificationStatus || {}
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
  activeView = ['basis', 'measures', 'results', 'report', 'expertWork'].includes(model.activeView) ? model.activeView : activeView;
  reportMode = ['management', 'committee'].includes(model.reportMode) ? model.reportMode : 'management';
  meetingFocus = ['management', 'technik', 'vnb', 'controlling', 'finanzierung'].includes(model.meetingFocus) ? model.meetingFocus : 'management';
  meetingTextOverrides = model.meetingTextOverrides && typeof model.meetingTextOverrides === 'object'
    ? structuredClone(model.meetingTextOverrides)
    : {};
  processState = normalizeProcessState(model.process);
  strategy = normalizeStrategy(model.strategy);
  committee = normalizeCommittee(model.committee);
  clarificationStatus = model.clarificationStatus && typeof model.clarificationStatus === 'object'
    ? structuredClone(model.clarificationStatus)
    : {};
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
      const incoming = migrateModelState(JSON.parse(String(reader.result)));
      const comparison = compareHistoryChains(history, incoming.history);
      if (comparison.relation === 'incomingNewer' || comparison.relation === 'divergent' || comparison.relation === 'localNewer') {
        showImportReview({ incoming, comparison });
        return;
      }
      applyModelState({ model: incoming.model, history: incoming.history });
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
    [storageKey, expertModeKey, authorKey, lastSeenEventKey, roleKey, ...legacyStorageKeys].forEach(key => localStorage.removeItem(key));
    setStorageStatus('Browserdaten dieses Rechners wurden gelöscht.');
  } catch (_error) {
    setStorageStatus('Browserdaten konnten nicht gelöscht werden.');
  }
}

function applyDemoModel() {
  hideStartScreen();
  el.sector.value = 'strom';
  el.regulationProcedure.value = 'standard';
  el.baseYear.value = '2027';
  el.baseEog.value = '20000';
  el.rab.value = '85000';
  el.returnRate.value = '5.0';
  el.financingRate.value = '5.0';
  el.annualEnergyGwh.value = '520';
  el.householdConsumptionKwh.value = '2900';
  el.horizon.value = '20';
  el.discountRate.value = '5.0';
  el.kanuEndYear.value = '2045';
  el.degressiveRate.value = '10';
  el.taxFactor.value = '0';
  el.portfolioAttribution.value = '25';
  el.qDelta.value = '0.6';
  el.eDelta.value = '0.2';
  measures = structuredClone(demoMeasures);
  strategy = normalizeStrategy({
    sampReference: 'AMP-Fragment Stromverteilung, Budgetrunde 2027, Bezug SAMP Kapitel Versorgungssicherheit',
    objectives: defaultObjectives
  });
  committee = normalizeCommittee({
    body: 'Werksausschuss',
    meetingDate: '',
    proposalText: 'Der Werksausschuss nimmt die Investitionsbewertung zur Kenntnis und beauftragt die Verwaltung, die offenen Annahmen vor der Budgetfreigabe zu klären.'
  });
  selectedId = measures[0]?.id;
  scenario = 'basis';
  activeView = 'results';
  meetingFocus = 'management';
  processState = normalizeProcessState({ phase: 'massnahmenbewertung' });
  clarificationStatus = {};
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
  const simplified = el.regulationProcedure.value === 'simplified';
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
  const maturity = maturityScore();
  const snapshot = {
    eog: first.eog,
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
  const tariff = tariffImpactLine(result.tariffImpact);

  document.getElementById('managementStory').textContent = result.activeMeasures.length
    ? `Bei ${fmtTeur(result.invest)} Investition und ${activeText} entsteht im ersten Jahr ein EOG-Zusatz von ${fmtTeur(first.eog, 1)} in ${periodDetailText(result.p.regulatoryPeriod)}; der Portfolio-IRR beträgt ${irrText}. ${spreadSentence}${result.tariffImpact.available ? ` Für einen Durchschnittshaushalt entspricht das rechnerisch etwa ${tariff.value}.` : ''}`
    : 'Es ist keine aktive Maßnahme ausgewählt. Für eine Entscheidung müssen zuerst Maßnahmen aktiviert oder angelegt werden.';

  const knowledgeEffect = result.qePa + result.impactPa;
  document.getElementById('managementCaveat').textContent = result.activeMeasures.length
    ? knowledgeEffect > 0
      ? `Dokumentierte Portfolio- und Wirkannahmen von ${fmtTeur(knowledgeEffect, 1)} p.a. sind entscheidungsrelevant und müssen kausal sowie regulatorisch begründet bleiben.`
      : 'Die Wirtschaftlichkeit hängt vor allem an Aktivierbarkeit, Anerkennungsfähigkeit, Timing und Risikowert der Maßnahmen.'
    : 'Ohne aktive Maßnahme gibt es keinen belastbaren Business Case.';
  if (result.activeMeasures.length && result.tariffImpact.available) {
    document.getElementById('managementCaveat').textContent += ' Entgeltwirkung indikativ: ' + result.tariffImpact.caveat;
  }

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
        <td colspan="9">
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
  document.getElementById('measureBody').innerHTML = measures.map(measure => {
    const result = calcMeasure(measure, p, portfolioEffectFor(measure, p));
    const counts = impactCounts(measure);
    const templateBadge = measure.templateId ? `<span class="pill warn">aus Vorlage ${esc(measure.templateVersion || '')}</span>` : '';
    return `
      <tr class="${measure.id === selectedId ? 'selected' : ''}" data-id="${measure.id}">
        <td><input type="checkbox" data-action="active" data-id="${measure.id}" ${measure.active ? 'checked' : ''}></td>
        <td><button type="button" data-action="select" data-id="${measure.id}">${measure.name}</button><div class="pill-row compact">${templateBadge}</div></td>
        <td>${measure.year}</td>
        <td><div class="pill-row compact">${objectivePills(measure)}</div></td>
        <td>${fmtTeur(measure.cost)}</td>
        <td>${fmtPct(result.activeShare * 100, 0)}</td>
        <td><span class="inline-visual">${measureRiskMiniHtml(measure)}${counts.total ? `${counts.total} (${counts.review} prüf.)` : '-'}</span></td>
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
  document.body.dataset.view = view;
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
    objectiveIds: [],
    templateId: '',
    templateVersion: '',
    opexPa: 0,
    opexDeltaPa: 0,
    reinvestCost: 0,
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
    if (wizard.step === 0) Object.assign(d, { sector: modalValue('w_sector'), regulationProcedure: modalValue('w_regulationProcedure'), baseYear: Math.round(modalNumber('w_baseYear')) });
    if (wizard.step === 1) Object.assign(d, { baseEog: modalNumber('w_baseEog'), rab: modalNumber('w_rab'), annualEnergyGwh: modalValue('w_annualEnergyGwh'), householdConsumptionKwh: modalValue('w_householdConsumptionKwh') });
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
          Bisheriger pauschaler Risikowert: ${fmtTeur(impact.amount, 1)} p.a. Für bessere Nachvollziehbarkeit auf Wahrscheinlichkeit mal Schadenshöhe umstellen.
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
      <strong>Erwartungswert:</strong> ${fmtTeur(riskExpectedValue(impact), 1)} p.a.
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
          <div class="impact-meta">${impactAreaLabel(impact.area)} · ${fmtTeur(impact.amount * impact.attribution, 1)} p.a. · ${impactGovernanceLabel(impact.governance)}</div>
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
        const timeline = document.getElementById('lifecycleTimeline');
        if (timeline) timeline.innerHTML = '';
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
  el.mOpexPa.value = measure.opexPa || 0;
  el.mOpexDeltaPa.value = measure.opexDeltaPa || 0;
  el.mReinvestCost.value = measure.reinvestCost || 0;
  el.mDecommissionCost.value = measure.decommissionCost || 0;
  el.mDecommissionYear.value = measure.decommissionYear ?? '';
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
      renderImpactAssumptions(measure);
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
      <td>${fmtTeur(row.risk, 1)}</td>
      <td>${fmtTeur(row.opex, 1)}</td>
      <td>${fmtTeur(row.reinvestDecommission, 1)}</td>
      <td>${fmtTeur(row.eog, 1)}</td>
      <td>${fmtTeur(result.p.baseEog + row.eog, 1)}</td>
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
        <td>${fmtTeur(first.eog, 1)}</td>
        <td>${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'}</td>
        <td>${fmtTeur(result.npv, 1)}</td>
      </tr>
    `;
  });
  document.getElementById('scenarioBody').innerHTML = rows.join('');
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

function strategyContributionRows(result) {
  const objectiveRows = strategy.objectives.map(objective => {
    const matching = result.results.filter(item => (item.measure.objectiveIds || []).includes(objective.id));
    const invest = matching.reduce((sum, item) => sum + Number(item.measure.cost || 0), 0);
    const firstEog = matching.reduce((sum, item) => sum + (item.rows[0]?.eog || 0), 0);
    const risk = matching.reduce((sum, item) => sum + item.riskReductionPa, 0);
    const names = matching.map(item => item.measure.name).join(', ');
    return `
      <tr>
        <td>${esc(objective.label)}</td>
        <td>${fmtTeur(invest, 1)}</td>
        <td>${fmtTeur(firstEog, 1)}</td>
        <td>${fmtTeur(risk, 1)}</td>
        <td>${names ? esc(names) : '-'}</td>
      </tr>
    `;
  }).join('');
  const unassigned = result.results.filter(item => !(item.measure.objectiveIds || []).length);
  const unassignedRow = unassigned.length
    ? `<tr class="warn-row"><td>Ohne Zielzuordnung</td><td>${fmtTeur(unassigned.reduce((sum, item) => sum + Number(item.measure.cost || 0), 0), 1)}</td><td>${fmtTeur(unassigned.reduce((sum, item) => sum + (item.rows[0]?.eog || 0), 0), 1)}</td><td>${fmtTeur(unassigned.reduce((sum, item) => sum + item.riskReductionPa, 0), 1)}</td><td>${esc(unassigned.map(item => item.measure.name).join(', '))}</td></tr>`
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
      .reduce((sum, item) => sum + (item.rows[0]?.eog || 0), 0);
  }));
  if (!strategy.objectives.length) {
    return '<div class="empty-state"><span aria-hidden="true">◎</span><strong>Noch keine strategischen Ziele hinterlegt.</strong><small>Mit Zielen wird sichtbar, worauf das Budget einzahlt.</small></div>';
  }
  return `
    <div class="goal-bars" aria-label="Zielbeitrag als Balken">
      ${strategy.objectives.map(objective => {
        const matching = result.results.filter(item => (item.measure.objectiveIds || []).includes(objective.id));
        const invest = matching.reduce((sum, item) => sum + Number(item.measure.cost || 0), 0);
        const eog = matching.reduce((sum, item) => sum + (item.rows[0]?.eog || 0), 0);
        const investWidth = Math.round(invest / maxInvest * 100);
        const markerLeft = Math.min(100, Math.round(eog / maxEog * 100));
        return `
          <div class="goal-bar">
            <div><strong>${esc(objective.label)}</strong><small>${fmtTeur(invest, 1)} Invest · ${fmtTeur(eog, 1)} EOG Jahr 1</small></div>
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

function plainCommitteeStory(result, first) {
  if (!result.activeMeasures.length) {
    return 'Es ist noch keine aktive Maßnahme ausgewählt. Die Vorlage dokumentiert daher einen Arbeitsstand ohne Beschlussreife.';
  }
  const activeText = result.activeMeasures.length === 1 ? 'eine aktive Maßnahme' : `${result.activeMeasures.length} aktive Maßnahmen`;
  const tariff = tariffImpactLine(result.tariffImpact);
  const tariffText = result.tariffImpact.available
    ? ` Für einen Durchschnittshaushalt entspricht das rechnerisch etwa ${tariff.value}.`
    : '';
  return `Das Modell bewertet ${activeText} mit ${fmtTeur(result.invest)} Investition. Im ersten Jahr steigen die zulässigen Erlöse modellhaft um ${fmtTeur(first.eog, 1)}.${tariffText}`;
}

function committeeProposal(result) {
  const text = String(committee.proposalText || '').trim();
  if (text) return text;
  return result.activeMeasures.length
    ? 'Das Gremium nimmt die dargestellte Maßnahmebewertung zur Kenntnis und beauftragt die Verwaltung, die offenen Punkte vor einer finalen Budgetfreigabe zu klären.'
    : 'Das Gremium nimmt den Arbeitsstand zur Kenntnis. Eine Beschlussfassung wird nach Ergänzung aktiver Maßnahmen vorbereitet.';
}

function committeeReportHtml(result, first, spread) {
  const tariff = tariffImpactLine(result.tariffImpact);
  const openItems = clarificationItems().filter(item => item.status !== 'closed');
  const reviewItems = reviewRequiredImpacts(true);
  const latestSnapshot = (history.snapshots || []).at(-1);
  const activeNames = result.activeMeasures.map(measure => measure.name).slice(0, 4).join(', ') || 'noch keine aktive Maßnahme';
  const riskText = result.riskPa > 0
    ? `Die erfassten Risikodaten zeigen eine erwartete Risikoreduktion von ${fmtTeur(result.riskPa, 1)} pro Jahr. Dieser Wert entsteht aus Eintrittswahrscheinlichkeit vorher/nachher und Schadenshöhe.`
    : 'Für den Arbeitsstand ist noch keine belastbare Risikoreduktion hinterlegt.';
  const financeLine = `Für Rückfragen: IRR ${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-'}, Kapitalwert ${fmtTeur(result.npv, 1)}, Spread ${Number.isFinite(spread) ? fmtPct(spread * 100, 1) : '-'}.`;
  return `
    <article class="committee-page">
      <header class="committee-head">
        <div>
          <h1>Gremienvorlage Investitionsbewertung</h1>
          <p>${esc(committee.body || 'Gremium')}${committee.meetingDate ? ` · Sitzung ${esc(formatDateShort(committee.meetingDate))}` : ''}</p>
        </div>
        <div>
          <strong>${result.p.sector === 'gas' ? 'Gas' : 'Strom'}</strong><br>
          Stand ${esc(phaseLabel())} · ${esc(localAuthor() || 'ohne Autor')}
        </div>
      </header>
      <section>
        <h2>Anlass und Beschlussvorschlag</h2>
        <p>${esc(committeeProposal(result))}</p>
      </section>
      <section>
        <h2>Worum es geht</h2>
        <p>${esc(plainCommitteeStory(result, first))}</p>
        <p class="committee-muted">Betrachtete Maßnahmen: ${esc(activeNames)}.</p>
      </section>
      <section class="committee-grid">
        <div>
          <h2>Was es kostet</h2>
          <p>Investition: <strong>${fmtTeur(result.invest)}</strong>. Lebenszykluskosten über den Horizont: <strong>${fmtTeur(result.totex.nominal, 1)}</strong>.</p>
        </div>
        <div>
          <h2>Was es für Bürger bedeutet</h2>
          <p>${esc(tariff.sentence)}</p>
        </div>
      </section>
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
      ${regulationProcedureNote(result) ? `<p class="committee-footnote">${esc(regulationProcedureNote(result))}</p>` : ''}
    </article>
  `;
}

function renderReport(result, first, spread, decision) {
  const report = document.getElementById('reportPage');
  if (!report) return;
  if (reportMode === 'committee') {
    report.innerHTML = committeeReportHtml(result, first, spread);
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
      <td>${fmtTeur(item.totex.nominal, 1)}</td>
      <td><div class="pill-row compact">${objectivePills(item.measure)}</div></td>
      <td>${fmtPct(item.activeShare * 100, 0)}</td>
      <td>${impactCounts(item.measure).total || '-'}</td>
      <td>${Number.isFinite(item.irr) ? fmtPct(item.irr * 100, 1) : '-'}</td>
      <td>${String(item.measure.note || '').trim() ? 'Ja' : '-'}</td>
    </tr>
  `).join('') || '<tr><td colspan="9">Keine aktive Maßnahme im Report.</td></tr>';
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
        <p>${esc(measure.note)}</p>
      </article>
    `).join('')
    : '<p class="hint">Keine Maßnahmennotizen erfasst.</p>';
  const maturity = maturityScore();
  const clarifications = clarificationItems();
  const clarificationRows = clarifications.map(item => `
    <tr>
      <td>${esc(item.measure)}</td>
      <td>${esc(item.title)}</td>
      <td>${esc(item.area)}</td>
      <td>${esc(phaseLabel(item.targetPhase))}</td>
      <td>${item.status === 'closed' ? 'geklärt' : 'offen'}</td>
    </tr>
  `).join('') || '<tr><td colspan="5">Keine Klärpunkte dokumentiert.</td></tr>';
  const snapshotRows = (history.snapshots || []).map(snapshot => `
    <tr>
      <td>${esc(snapshot.label)}</td>
      <td>${esc(snapshot.author)}</td>
      <td>${new Date(snapshot.timestamp).toLocaleString('de-DE')}</td>
      <td>${esc(phaseLabel(snapshot.phase))}</td>
    </tr>
  `).join('') || '<tr><td colspan="4">Noch keine Snapshots dokumentiert.</td></tr>';
  const story = result.activeMeasures.length
    ? `Bei ${fmtTeur(result.invest)} Investition und ${activeText} entsteht im Startjahr ein EOG-Zusatz von ${fmtTeur(first.eog, 1)} in ${periodDetailText(result.p.regulatoryPeriod)}. Der Portfolio-IRR beträgt ${Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : 'nicht berechenbar'} bei einem FK-Zins von ${fmtPct(result.p.financingRate * 100, 1)}.`
    : 'Es ist keine aktive Maßnahme ausgewählt. Der Report dokumentiert daher noch keinen belastbaren Business Case.';
  const strategyRows = strategyContributionRows(result) || '<tr><td colspan="5">Noch keine strategischen Ziele hinterlegt.</td></tr>';
  const strategyBars = strategyContributionBars(result);
  const strategyHint = strategy.sampReference
    ? `Referenz: ${esc(strategy.sampReference)}`
    : 'Noch keine Strategie- oder Planreferenz hinterlegt. Mit einer Referenz bleibt sichtbar, worauf das Budget einzahlt.';

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
        <div><strong>Entscheidungsreife:</strong> ${maturity.score} % / ${maturity.blockers} Blocker</div>
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
        <div class="kpi"><div class="label">TOTEX Horizont</div><div class="value">${fmtTeur(result.totex.nominal, 1)}</div><div class="sub">diskontiert ${fmtTeur(result.totex.discounted, 1)}</div></div>
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
          <thead><tr><th>Maßnahme</th><th>Jahr</th><th>CAPEX</th><th>TOTEX</th><th>Ziele</th><th>aktiv.</th><th>Wirkannahmen</th><th>IRR</th><th>Notiz</th></tr></thead>
          <tbody>${measureRows}</tbody>
        </table>
      </div>
    </section>

    <section class="report-section">
      <h2>Beitrag zu strategischen Zielen</h2>
      <p class="hint">${strategyHint}</p>
      ${strategyBars}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ziel</th><th>Investition</th><th>EOG-Zusatz Jahr 1</th><th>Risikoreduktion p.a.</th><th>Maßnahmen</th></tr></thead>
          <tbody>${strategyRows}</tbody>
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
      <h2>Klärpunkte und Prozessstand</h2>
      <p class="hint">Ein finaler Entscheidungsreport sollte offene Blocker schließen oder als Restunsicherheit zeichnen.</p>
      ${phaseStepperHtml()}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Maßnahme</th><th>Klärpunkt</th><th>Bereich</th><th>Zielphase</th><th>Status</th></tr></thead>
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
  const first = result.yearly[0] || { eog: 0 };
  const activatedShare = result.invest > 0 ? result.activated / result.invest * 100 : 0;
  const spread = Number.isFinite(result.irr) ? result.irr - result.p.financingRate : NaN;

  document.getElementById('kpiInvest').textContent = fmtTeur(result.invest);
  document.getElementById('kpiInvestSub').textContent = result.activeMeasures.length + ' aktive Maßnahmen · TOTEX ' + fmtTeur(result.totex.nominal, 1);
  document.getElementById('kpiActivated').textContent = fmtTeur(result.activated);
  document.getElementById('kpiActivatedSub').textContent = fmtPct(activatedShare, 1) + ' der Investitionen';
  document.getElementById('kpiEog').textContent = fmtTeur(first.eog, 1);
  document.getElementById('kpiEogSub').textContent = result.p.baseYear + ' / ' + periodText(result.p.regulatoryPeriod);
  document.getElementById('kpiIrr').textContent = Number.isFinite(result.irr) ? fmtPct(result.irr * 100, 1) : '-';
  document.getElementById('kpiIrrSub').textContent = 'FK-Zins ' + fmtPct(result.p.financingRate * 100, 1);
  document.getElementById('kpiNpv').textContent = fmtTeur(result.npv, 1);
  const tariff = tariffImpactLine(result.tariffImpact);
  document.getElementById('kpiTariff').textContent = tariff.value;
  document.getElementById('kpiTariffSub').textContent = tariff.sub;
  document.getElementById('kpiPortfolioEffect').textContent = fmtTeur(result.qePa + result.impactPa, 1);
  document.getElementById('kpiPortfolioSub').textContent = 'davon Risiko ' + fmtTeur(result.riskPa, 1) + ' p.a.';
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
  syncCommitteeFields();
  renderGlobalValidation();
  renderScenarioDiff();
  renderBasisSummaryCards();
  renderStrategyEditor();
  renderMeasures();
  renderExpertWorkList();
  renderDetail();
  renderPortfolio();
  renderProcessUx();
  renderChangeSinceSeen();
  renderMaturityAndClarifications();
  renderReportMode();
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
	        decommissionCost: num('mDecommissionCost'),
	        decommissionYear: el.mDecommissionYear.value === '' ? '' : Math.round(num('mDecommissionYear')),
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
document.getElementById('strategySampReference').addEventListener('input', updateStrategyReference);
document.getElementById('strategyObjectives').addEventListener('input', updateObjective);
document.getElementById('strategyObjectives').addEventListener('click', event => {
  const button = event.target.closest('[data-action="removeObjective"]');
  if (button) removeObjective(button.dataset.objectiveId);
});
document.getElementById('addObjective').addEventListener('click', addObjective);
document.getElementById('measureObjectives').addEventListener('change', toggleMeasureObjective);
enhanceHelpLabels();
loadRole();
applyRole(currentRole, false);
loadExpertMode();
setExpertMode(expertMode, false);

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

document.getElementById('clarificationList').addEventListener('click', event => {
  const button = event.target.closest('[data-action="toggleClarification"]');
  if (!button) return;
  toggleClarification(button.dataset.clarificationKey);
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
  if (isReadOnlyRole()) {
    event.target.checked = measure.active;
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
    selectedId = openButton.dataset.measureId;
    setView('measures');
    renderAll();
    openMeasureEditModal();
  }
  const clarifyButton = event.target.closest('[data-action="toggleClarification"]');
  if (clarifyButton) toggleClarification(clarifyButton.dataset.clarificationKey);
});
document.querySelectorAll('.expert-filter').forEach(button => {
  button.addEventListener('click', () => {
    expertFilter = button.dataset.expertFilter;
    document.querySelectorAll('.expert-filter').forEach(item => item.classList.toggle('active', item === button));
    renderExpertWorkList();
  });
});
committeeIds.forEach(id => {
  el[id].addEventListener('input', () => {
    collectCommitteeFields();
    renderAll();
  });
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
document.getElementById('expertModeToggle').addEventListener('change', event => {
  setExpertMode(event.target.checked);
});
document.getElementById('startDemo').addEventListener('click', applyDemoModel);
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
document.getElementById('processPhase').addEventListener('change', event => setProcessPhase(event.target.value));
document.getElementById('phaseTargetDate').addEventListener('change', event => setPhaseTarget(event.target.value));
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

if (!loadFromBrowser()) {
  setView(activeView);
  renderAll(false);
  previousModelForHistory = currentModelData();
  showStartScreen();
}
