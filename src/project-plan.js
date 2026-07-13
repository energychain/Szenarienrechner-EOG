import { appDeepLinkForMilestone, storyMilestoneById } from './story-navigation.js';

export const projectPlanRoles = {
  modellverantwortung: 'Modellverantwortung',
  regulierungsmanagement: 'Regulierungsmanagement',
  bilanzierung: 'Anlagenbuchhaltung/Bilanzierung',
  assetmanagement: 'Netzbetrieb/Asset Management',
  controlling: 'Controlling/Finanzierung',
  management_gremium: 'Management/Gremium',
  einkauf_projekt: 'Einkauf/Projektleitung'
};

export const projectPlanStatuses = ['open', 'in_progress', 'done', 'blocked'];
export const projectPlanStatusLabels = {
  open: 'Offen',
  in_progress: 'In Arbeit',
  done: 'Erledigt',
  blocked: 'Blockiert'
};

const roleIds = new Set(Object.keys(projectPlanRoles));
const evidenceIds = new Set(['quelle', 'beleg', 'freigabe']);

function task(id, milestoneId, title, ownerRole, dueOffsetDays, resultArtifact, options = {}) {
  return {
    id,
    milestoneId,
    title,
    ownerRole,
    dueOffsetDays,
    deepLinkKey: options.deepLinkKey || options.storyKey || '',
    targetView: options.targetView || null,
    dependsOn: options.dependsOn || [],
    status: 'open',
    evidenceRequired: options.evidenceRequired || null,
    resultArtifact,
    note: options.note || ''
  };
}

export const projectPlanSeedMilestones = [
  {
    id: 'm0', storyKey: 'kickoff', title: 'Kick-off', plannedOffsetMonths: 0, leadRole: 'modellverantwortung',
    entryCriteria: 'Planungsrunde wird gestartet und Entscheidungszweck ist noch zu klären.', exitArtifact: 'dokumentierter Auftrag, Rollenmatrix und erster Arbeitsstand',
    tasks: [
      task('m0-t1','m0','Entscheidungszweck festlegen','modellverantwortung',0,'dokumentierter Auftrag',{evidenceRequired:'quelle'}),
      task('m0-t2','m0','Rollen & Zuständigkeiten besetzen','modellverantwortung',1,'Rollenmatrix',{dependsOn:['m0-t1'],evidenceRequired:'freigabe'}),
      task('m0-t3','m0','Arbeitsmodus vereinbaren: erst Struktur/Quellen, dann Werte','modellverantwortung',1,'Protokollnotiz',{dependsOn:['m0-t1']}),
      task('m0-t4','m0','Gremienkalender & Beschlussfrist erfassen, rückwärts terminieren','controlling',2,'Zieltermin M7'),
      task('m0-t5','m0','In App: Rolle wählen, Prozessphase = Kick-off setzen','modellverantwortung',2,'gesetzter Prozessstatus',{dependsOn:['m0-t2']}),
      task('m0-t6','m0','Ausgangs-Unklarheiten dokumentieren','modellverantwortung',3,'Liste offener Punkte'),
      task('m0-t7','m0','Arbeitsstand-Datei anlegen','modellverantwortung',3,'Modell-JSON v0',{dependsOn:['m0-t5']})
    ]
  },
  {
    id: 'm1', storyKey: 'initialisierung', title: 'Initialisierung', plannedOffsetMonths: 0.5, leadRole: 'modellverantwortung',
    entryCriteria: 'Kick-off abgeschlossen und Rollen besetzt.', exitArtifact: 'Stammdatenrahmen und Datenanforderungsliste',
    tasks: [
      task('m1-t1','m1','Stammdaten-Wizard öffnen, Sparte wählen','regulierungsmanagement',0,'gesetzte Sparte',{dependsOn:['m0-t7'],targetView:'basis'}),
      task('m1-t2','m1','Startjahr festlegen','controlling',1,'begründetes baseYear',{dependsOn:['m1-t1'],evidenceRequired:'quelle'}),
      task('m1-t3','m1','Regulierungsverfahren aus Bescheid übernehmen','regulierungsmanagement',2,'Verfahren + Belegstelle',{dependsOn:['m1-t1'],evidenceRequired:'beleg'}),
      task('m1-t4','m1','Bestehende EOG als Referenz eintragen, als vorläufig markieren','regulierungsmanagement',3,'Wert + Statuskennung',{evidenceRequired:'beleg'}),
      task('m1-t5','m1','Kapitalbasis anfragen / eintragen','bilanzierung',4,'Wert oder Klärpunkt',{evidenceRequired:'quelle'}),
      task('m1-t6','m1','Jahresarbeit-Quelle festlegen','controlling',4,'Quellenzuordnung',{evidenceRequired:'quelle'}),
      task('m1-t7','m1','Je Feld Quelle + Verantwortung + Status erfassen','modellverantwortung',5,'Datenanforderungsliste',{dependsOn:['m1-t2','m1-t3','m1-t4','m1-t5','m1-t6']}),
      task('m1-t8','m1','Datenanforderung mit Fristen an Fachbereiche versenden','modellverantwortung',5,'versendete Anforderung',{dependsOn:['m1-t7']})
    ]
  },
  {
    id: 'm2', storyKey: 'datenerhebung', title: 'Datenerhebung', plannedOffsetMonths: 1, leadRole: 'modellverantwortung',
    entryCriteria: 'Stammdatenrahmen und Datenanforderung liegen vor.', exitArtifact: 'belastbare Datenbasis mit Klärpunktliste',
    tasks: [
      task('m2-t1','m2','Ausgangsmodell laden, Prozessstatus dokumentieren','modellverantwortung',0,'aktualisierter Status',{dependsOn:['m1-t8']}),
      task('m2-t2','m2','Ist-Jahresarbeit aus Abrechnung/Mengenplanung übernehmen','controlling',3,'belegter Wert',{dependsOn:['m1-t6'],evidenceRequired:'beleg'}),
      task('m2-t3','m2','Regulatorische Kapitalbasis vs. HGB-Buchwert abgrenzen','bilanzierung',8,'Abgrenzungsnotiz',{dependsOn:['m1-t5'],evidenceRequired:'beleg'}),
      task('m2-t4','m2','Wirtschaftsplan-Budgetpositionen fachlich CAPEX/OPEX aufteilen','controlling',9,'Split-Tabelle',{evidenceRequired:'quelle'}),
      task('m2-t5','m2','Fehlende Werte explizit als Klärpunkt markieren','modellverantwortung',15,'Klärpunktliste',{dependsOn:['m2-t2','m2-t3','m2-t4']}),
      task('m2-t6','m2','Herkunft je Wert dokumentieren','modellverantwortung',16,'Provenienznotizen',{dependsOn:['m2-t2','m2-t3','m2-t4']}),
      task('m2-t7','m2','Nächsten Liefertermin + Verantwortlichen im Prozessstatus setzen','modellverantwortung',22,'terminierter Status',{dependsOn:['m2-t5']})
    ]
  },
  {
    id: 'm3', storyKey: 'massnahmenbewertung', title: 'Maßnahmenbewertung', plannedOffsetMonths: 3, leadRole: 'assetmanagement',
    entryCriteria: 'Stammdaten & Quellen erhoben.', exitArtifact: 'vergleichbarer Maßnahmenkatalog',
    tasks: [
      task('m3-t1','m3','Maßnahmenkatalog aufbauen, Budgetpositionen in Maßnahmenobjekte überführen','assetmanagement',3,'Maßnahmenliste',{dependsOn:['m2-t7'],targetView:'measures'}),
      task('m3-t2','m3','Kosten & Inbetriebnahmejahr je Maßnahme aktualisieren','einkauf_projekt',8,'aktuelle Kosten/Jahre',{dependsOn:['m3-t1'],evidenceRequired:'quelle'}),
      task('m3-t3','m3','Aktivierbaren Anteil je Maßnahme bewerten','bilanzierung',14,'Aktivierbarkeitsprofil',{dependsOn:['m3-t1'],targetView:'measures',evidenceRequired:'beleg'}),
      task('m3-t4','m3','Maßnahmentyp zuordnen','assetmanagement',15,'Kategorisierung',{dependsOn:['m3-t1']}),
      task('m3-t5','m3','Basiscase- vs. Sensitivitäts-Maßnahmen trennen','controlling',21,'Szenariozuordnung',{dependsOn:['m3-t3','m3-t4']}),
      task('m3-t6','m3','Reinvest-/Rückbau-Parameter setzen','bilanzierung',23,'Reinvest-Modus je Maßnahme',{dependsOn:['m3-t3']}),
      task('m3-t7','m3','Portfolioanteil & Attribution je Maßnahme festlegen','regulierungsmanagement',24,'Attributionswerte',{dependsOn:['m3-t1']}),
      task('m3-t8','m3','Doppelzählungs-Hinweise prüfen','regulierungsmanagement',25,'geklärte/quittierte Warnungen',{dependsOn:['m3-t7']})
    ]
  },
  {
    id: 'm4', storyKey: 'technik-rueckkopplung', title: 'Technische Rückkopplung', plannedOffsetMonths: 4, leadRole: 'regulierungsmanagement',
    entryCriteria: 'Maßnahmenkatalog ist aufgebaut.', exitArtifact: 'Wirkannahmen mit Evidenz, Status und Klärpunkten',
    tasks: [
      task('m4-t1','m4','Wirkannahmen je Maßnahme erfassen','assetmanagement',3,'Wirkannahmenliste',{dependsOn:['m3-t8'],targetView:'results'}),
      task('m4-t2','m4','Vertrauensstufe je Wirkannahme setzen','regulierungsmanagement',8,'confidence je Annahme',{dependsOn:['m4-t1'],evidenceRequired:'freigabe'}),
      task('m4-t3','m4','Evidenztyp & Beleg dokumentieren','assetmanagement',9,'Evidenzvermerk',{dependsOn:['m4-t1'],evidenceRequired:'beleg'}),
      task('m4-t4','m4','Governance-Status setzen','regulierungsmanagement',10,'governance je Annahme',{dependsOn:['m4-t2']}),
      task('m4-t5','m4','Risikoannahmen in Sensitivität statt Basiscase einordnen','regulierungsmanagement',15,'Sensitivitätszuordnung',{dependsOn:['m4-t4']}),
      task('m4-t6','m4','Klärpunkte je unsicherer Wirkung anlegen','modellverantwortung',16,'terminierte Klärpunkte',{dependsOn:['m4-t2']}),
      task('m4-t7','m4','Konservativen Case gegen Basiscase prüfen','modellverantwortung',22,'Szenariovergleich',{dependsOn:['m4-t4','m4-t5']})
    ]
  },
  {
    id: 'm5', storyKey: 'konsolidierung', title: 'Konsolidierung', plannedOffsetMonths: 5, leadRole: 'management_gremium',
    entryCriteria: 'Wirkannahmen sind bewertet.', exitArtifact: 'Management-Entscheidungstendenz mit Auflagen',
    tasks: [
      task('m5-t1','m5','Managementsicht öffnen, Entscheidungsreife-Ampel prüfen','management_gremium',3,'gelesenes Verdikt',{dependsOn:['m4-t7'],targetView:'results'}),
      task('m5-t2','m5','FK-Zins/Finanzierungsannahme aktualisieren, Finanzierungsspread prüfen','controlling',4,'aktueller Spread',{evidenceRequired:'quelle'}),
      task('m5-t3','m5','Budgetanschluss an Wirtschaftsplan bestätigen','controlling',9,'Budgetbestätigung',{dependsOn:['m5-t2'],evidenceRequired:'freigabe'}),
      task('m5-t4','m5','Nicht verschiebbare Maßnahmen markieren','assetmanagement',9,'Prioritätsvermerk',{dependsOn:['m3-t1']}),
      task('m5-t5','m5','Wichtigsten Haken + nächsten Schritt festhalten','management_gremium',15,'dokumentierter Haken',{dependsOn:['m5-t1']}),
      task('m5-t6','m5','Beschlussoption formulieren','management_gremium',16,'Beschlussoption',{dependsOn:['m5-t5']}),
      task('m5-t7','m5','Offene Wirkannahmen als Nachverfolgungspunkte übernehmen','regulierungsmanagement',23,'Nachverfolgungsliste',{dependsOn:['m4-t6']})
    ]
  },
  {
    id: 'm6', storyKey: 'entscheidungsvorlage', title: 'Entscheidungsvorlage', plannedOffsetMonths: 6, leadRole: 'modellverantwortung',
    entryCriteria: 'Management hat Beschlussoption geklärt.', exitArtifact: 'entscheidungsreifer Report',
    tasks: [
      task('m6-t1','m6','Management-Report generieren','modellverantwortung',3,'Report-Entwurf',{dependsOn:['m5-t6'],targetView:'report'}),
      task('m6-t2','m6','Beschluss / Begründung / Auflage sprachlich trennen','modellverantwortung',4,'strukturierter Report',{dependsOn:['m6-t1']}),
      task('m6-t3','m6','Governance-Hinweise & offene Punkte in Report übernehmen','modellverantwortung',8,'vollständige Hinweise',{dependsOn:['m6-t1']}),
      task('m6-t4','m6','Kennzahlen einordnen: EOG ≠ Cashflow, IRR/MIRR-Hinweis','regulierungsmanagement',9,'Lesehinweise im Report',{dependsOn:['m6-t1']}),
      task('m6-t5','m6','Nachvollziehbarkeit prüfen','modellverantwortung',15,'Review-Vermerk',{dependsOn:['m6-t2','m6-t3','m6-t4']}),
      task('m6-t6','m6','Vorlage mit Controlling/Regulierung gegenlesen','controlling',16,'Freigabevermerk',{dependsOn:['m6-t5'],evidenceRequired:'freigabe'}),
      task('m6-t7','m6','Arbeitsstand + JSON-Export als Entscheidungsstand ablegen','modellverantwortung',23,'archivierter Stand',{dependsOn:['m6-t6']})
    ]
  },
  {
    id: 'm7', storyKey: 'gremium', title: 'Gremienvorlage', plannedOffsetMonths: 6.5, leadRole: 'management_gremium',
    entryCriteria: 'Entscheidungsreport ist freigegeben.', exitArtifact: 'Gremienvorlage und versionierter Snapshot',
    tasks: [
      task('m7-t1','m7','Einseiter-/Gremienansicht öffnen','modellverantwortung',0,'Vorlage-Ansicht',{dependsOn:['m6-t7'],targetView:'report'}),
      task('m7-t2','m7','Gremium, Sitzungsdatum, neutralen Beschlussvorschlag eintragen','modellverantwortung',1,'befüllte Vorlage',{dependsOn:['m7-t1']}),
      task('m7-t3','m7','Faire Darstellung prüfen','regulierungsmanagement',2,'Prüfvermerk',{dependsOn:['m7-t2'],evidenceRequired:'freigabe'}),
      task('m7-t4','m7','Druck/PDF erzeugen und archivieren','modellverantwortung',3,'PDF-Vorlage',{dependsOn:['m7-t3']}),
      task('m7-t5','m7','Beschluss mit Prüfauflagen protokollieren','management_gremium',7,'Beschlussprotokoll',{dependsOn:['m7-t4'],evidenceRequired:'freigabe'}),
      task('m7-t6','m7','Beschlossenen Stand als Snapshot sichern','modellverantwortung',8,'versionierter Snapshot',{dependsOn:['m7-t5']})
    ]
  },
  {
    id: 'm8', storyKey: 'archiv', title: 'Beschluss & Archiv', plannedOffsetMonths: 9, leadRole: 'modellverantwortung',
    entryCriteria: 'Beschluss ist protokolliert.', exitArtifact: 'Archivpaket und Startpunkt Folgerunde',
    tasks: [
      task('m8-t1','m8','Datei nach Beschluss erneut öffnen, Re-Entry prüfen','modellverantwortung',0,'bestätigter Re-Entry',{dependsOn:['m7-t6']}),
      task('m8-t2','m8','Auflagen in Monitoringpunkte überführen','regulierungsmanagement',5,'Monitoringliste',{dependsOn:['m8-t1']}),
      task('m8-t3','m8','Umsetzungsstatus je Maßnahme dokumentieren','assetmanagement',12,'Umsetzungsstatus',{dependsOn:['m8-t1']}),
      task('m8-t4','m8','Review nach erster Umsetzungsetappe terminieren','modellverantwortung',7,'Review-Termin',{dependsOn:['m8-t2']}),
      task('m8-t5','m8','Arbeitsstand + Report + JSON als Entscheidungsarchiv ablegen','modellverantwortung',10,'Archivpaket',{dependsOn:['m8-t1']}),
      task('m8-t6','m8','Einstieg in nächsten Planungszyklus vorbereiten','modellverantwortung',12,'Startpunkt Folgerunde',{dependsOn:['m8-t5']})
    ]
  }
].map(milestone => ({
  ...milestone,
  tasks: milestone.tasks.map(item => ({ ...item, deepLinkKey: item.deepLinkKey || milestone.storyKey }))
}));

export function createDefaultProjectPlan(baseYear = new Date().getFullYear()) {
  return {
    schemaVersion: '1.0.0',
    baseYear: Number.isFinite(Number(baseYear)) ? Math.round(Number(baseYear)) : new Date().getFullYear(),
    targetDecisionMilestone: 'm7',
    milestones: structuredClone(projectPlanSeedMilestones)
  };
}

function incomingTaskMap(value = {}) {
  const map = new Map();
  for (const milestone of Array.isArray(value.milestones) ? value.milestones : []) {
    for (const item of Array.isArray(milestone.tasks) ? milestone.tasks : []) {
      if (item?.id) map.set(String(item.id), item);
    }
  }
  return map;
}

function normalizeTask(seed, incoming = {}) {
  const status = projectPlanStatuses.includes(incoming.status) ? incoming.status : seed.status;
  const ownerRole = roleIds.has(incoming.ownerRole) ? incoming.ownerRole : seed.ownerRole;
  const evidenceRequired = evidenceIds.has(incoming.evidenceRequired) ? incoming.evidenceRequired : seed.evidenceRequired;
  return {
    ...seed,
    ownerRole,
    status,
    evidenceRequired,
    note: String(incoming.note ?? seed.note ?? ''),
    resultArtifact: String(incoming.resultArtifact || seed.resultArtifact || ''),
    dueOffsetDays: Number.isFinite(Number(incoming.dueOffsetDays)) ? Number(incoming.dueOffsetDays) : seed.dueOffsetDays,
    dependsOn: Array.isArray(incoming.dependsOn) ? incoming.dependsOn.map(String) : seed.dependsOn
  };
}

export function normalizeProjectPlan(value = {}, baseYear = new Date().getFullYear()) {
  const taskMap = incomingTaskMap(value);
  const base = createDefaultProjectPlan(value.baseYear || baseYear);
  return {
    ...base,
    schemaVersion: String(value.schemaVersion || base.schemaVersion),
    baseYear: Number.isFinite(Number(value.baseYear)) ? Math.round(Number(value.baseYear)) : base.baseYear,
    targetDecisionMilestone: String(value.targetDecisionMilestone || base.targetDecisionMilestone),
    milestones: base.milestones.map(milestone => ({
      ...milestone,
      tasks: milestone.tasks.map(item => normalizeTask(item, taskMap.get(item.id)))
    }))
  };
}


export function flattenProjectPlanTasks(plan) {
  return (plan?.milestones || []).flatMap(milestone => (milestone.tasks || []).map(task => ({ milestone, task })));
}

export function projectPlanTaskDependencyState(plan, taskId) {
  const taskEntries = flattenProjectPlanTasks(plan);
  const taskMap = new Map(taskEntries.map(entry => [entry.task.id, entry.task]));
  const task = taskMap.get(taskId);
  if (!task) return { taskId, dependencyBlocked: false, missingDependencies: [], effectiveStatus: 'open', ready: false };
  const missingDependencies = (task.dependsOn || []).filter(dependencyId => taskMap.get(dependencyId)?.status !== 'done');
  const dependencyBlocked = missingDependencies.length > 0;
  const effectiveStatus = dependencyBlocked || task.status === 'blocked' ? 'blocked' : task.status;
  return {
    taskId,
    dependencyBlocked,
    missingDependencies,
    effectiveStatus,
    ready: !dependencyBlocked && task.status !== 'done' && task.status !== 'blocked'
  };
}

export function projectPlanEffectiveTaskStates(plan) {
  return Object.fromEntries(flattenProjectPlanTasks(plan).map(({ task }) => [task.id, projectPlanTaskDependencyState(plan, task.id)]));
}

function projectPlanTaskSortKey(entry) {
  return (Number(entry.milestone.plannedOffsetMonths) || 0) * 30 + (Number(entry.task.dueOffsetDays) || 0);
}

function sortProjectPlanTaskEntries(a, b) {
  return projectPlanTaskSortKey(a) - projectPlanTaskSortKey(b) || a.task.id.localeCompare(b.task.id);
}

export function projectPlanNextReadyTask(plan) {
  const states = projectPlanEffectiveTaskStates(plan);
  return flattenProjectPlanTasks(plan)
    .filter(({ task }) => states[task.id]?.ready)
    .sort(sortProjectPlanTaskEntries)[0] || null;
}

export function projectPlanNextReadyTasksByRole(plan) {
  const states = projectPlanEffectiveTaskStates(plan);
  const result = Object.fromEntries(Object.keys(projectPlanRoles).map(roleId => [roleId, null]));
  for (const entry of flattenProjectPlanTasks(plan)
    .filter(({ task }) => states[task.id]?.ready)
    .sort(sortProjectPlanTaskEntries)) {
    if (!result[entry.task.ownerRole]) {
      result[entry.task.ownerRole] = {
        ...entry,
        dueDate: projectPlanMilestoneDate(plan.baseYear, entry.milestone.plannedOffsetMonths, entry.task.dueOffsetDays)
      };
    }
  }
  return result;
}

export function projectPlanTaskCounts(plan) {
  const entries = flattenProjectPlanTasks(plan);
  const states = projectPlanEffectiveTaskStates(plan);
  const byStatus = Object.fromEntries(projectPlanStatuses.map(status => [status, 0]));
  for (const { task } of entries) {
    const effectiveStatus = states[task.id]?.effectiveStatus || task.status;
    byStatus[effectiveStatus] = (byStatus[effectiveStatus] || 0) + 1;
  }
  return { total: entries.length, byStatus, completed: byStatus.done || 0, open: (byStatus.open || 0) + (byStatus.in_progress || 0) + (byStatus.blocked || 0) };
}

export function projectPlanMilestoneDate(baseYear, plannedOffsetMonths = 0, dueOffsetDays = 0) {
  const wholeMonths = Math.floor(Number(plannedOffsetMonths) || 0);
  const fractionalDays = Math.round(((Number(plannedOffsetMonths) || 0) - wholeMonths) * 30);
  const date = new Date(Date.UTC(Number(baseYear) || new Date().getFullYear(), 0 + wholeMonths, 1 + fractionalDays + (Number(dueOffsetDays) || 0)));
  return date.toISOString().slice(0, 10);
}

export function findProjectPlanTask(plan, taskId) {
  for (const milestone of plan?.milestones || []) {
    const item = (milestone.tasks || []).find(task => task.id === taskId);
    if (item) return { milestone, task: item };
  }
  return null;
}

export function projectPlanDeepLinkForTask(task, baseUrl = './') {
  return appDeepLinkForMilestone(task?.deepLinkKey || 'kickoff', baseUrl);
}

export function projectPlanStoryLabel(task) {
  return storyMilestoneById(task?.deepLinkKey || 'kickoff').label;
}
