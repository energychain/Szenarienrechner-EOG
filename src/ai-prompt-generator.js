import {
  calcPortfolio,
  params as engineParams,
  portfolioDecisionMetrics,
  regulatoryParameterSet,
  scenarioParams
} from './engine.js';
import { projectPlanEffectiveTaskStates, projectPlanTaskCounts } from './project-plan.js';

export const llmContextUrl = 'https://energychain.github.io/Szenarienrechner-EOG/llm.txt';

export const promptRoles = [
  {
    id: 'committee',
    title: 'Aufsichtsrat / Stadtrat / Gremium',
    task: 'Erkläre die Planung für ein kommunales Gremium. Trenne Entscheidung, Annahmen, Risiken, offene Punkte und Auflagen. Vermeide technische Detailtiefe und mache deutlich, dass EOG-Wirkung nicht gleich Cashflow ist.',
    output: ['Kurzfazit', 'Was soll beschlossen werden?', 'Wesentliche finanzielle Wirkungen', 'Prüfpflichtige Annahmen', 'Empfohlene Auflagen', 'Fragen, die ein Gremium stellen sollte']
  },
  {
    id: 'management',
    title: 'Geschäftsführung / Management',
    task: 'Bewerte die Entscheidungsreife. Zeige Basis vs. konservativ, Risiken, Abhängigkeiten und nächste Management-Entscheidungen.',
    output: ['Entscheidungsvorschlag', 'Ampelinterpretation', 'Top-3-Werttreiber', 'Top-3-Risiken', 'Offene Klärpunkte', 'Empfohlene nächste Schritte']
  },
  {
    id: 'controlling',
    title: 'Controlling / Finanzen',
    task: 'Übersetze die Planung in eine Controlling-Sicht. Trenne Budget, CAPEX/OPEX, HGB-Wirkung, regulatorische EOG-Wirkung und indikative Cashflow-Kennzahlen.',
    output: ['Budgetwirkung', 'Kapitalbindung', 'CAPEX/OPEX-Struktur', 'NPV/IRR/MIRR-Interpretation', 'Sensitivitäten', 'Rückfragen an Fachbereiche']
  },
  {
    id: 'regulation',
    title: 'Regulierungsmanagement',
    task: 'Prüfe die Planung aus Sicht Regulierungsmanagement. Achte auf Ruleset-Stand, Konfidenz, Wirkungsverzüge, Anerkennungslogik, Q/E-Wirkungen, Doppelzählung und prüfpflichtige Annahmen.',
    output: ['Verwendeter Regulierungsstand', 'Annahmen mit Prüfbedarf', 'Mögliche Doppelzählungen', 'Q/E-/Risiko-/Attributionsfragen', 'Punkte für Bescheid-/Kostenprüfungsabgleich', 'Keine Anerkennungszusage']
  },
  {
    id: 'assetManagement',
    title: 'Asset Management / Technik',
    task: 'Formuliere die technische Maßnahmenlogik so, dass Controlling, Regulierung und Management sie verstehen. Erkläre Zustands-/Resilienz-/Pflichtcharakter, Risiken bei Nichtumsetzung und Evidenzlage.',
    output: ['Technischer Anlass', 'Folgen bei Nichtumsetzung', 'Wirkungskette zur Finanz-/Regulierungssicht', 'Offene technische Evidenz', 'Rückfragen an Technik']
  },
  {
    id: 'accounting',
    title: 'Anlagenbuchhaltung / Bilanzierung',
    task: 'Prüfe Aktivierbarkeit, Nutzungsdauer, HGB-vs.-regulatorische Sicht, Reinvestition und CAPEX/OPEX-Abgrenzung.',
    output: ['Aktivierungsfragen', 'Nutzungsdauer-/AfA-Sicht', 'HGB/regulatorische Abweichungen', 'Reinvestitionslogik', 'Klärpunkte vor Freigabe']
  },
  {
    id: 'projectControl',
    title: 'Projektsteuerung / PMO',
    task: 'Analysiere den Projektplan. Welche Aufgaben sind blockiert, welche Rollen müssen handeln, welche nächsten Schritte sind kritisch, welche Klärpunkte gefährden die Gremienreife?',
    output: ['nächste Schritte', 'Blockierte Aufgaben', 'Rollen mit Handlungsbedarf', 'Termin-/Gate-Risiken', 'Vorbereitung der Gremienreife']
  },
  {
    id: 'challenge',
    title: 'Arbeitsstand hinterfragen',
    task: 'Hinterfrage den aktuellen Arbeitsstand fachlich-kritisch. Suche keine glatte Management-Erzählung, sondern belastbare Aussagen, prüfpflichtige Annahmen, Widersprüche, Datenlücken und nächste Klärfragen. Triff keine regulatorische, rechtliche oder bilanzielle Entscheidung; formuliere Prüf- und Klärfragen. Falls die Sparte Gas betroffen ist, prüfe besonders Stilllegung, Rückbau, Rückstellungen und Ewigkeitsvermutung sowie KAnEu-/Ist-Kosten-Behandlung als offene Herleitung.',
    output: ['Kurzurteil zum Arbeitsstand', 'Belastbare Aussagen', 'Prüfpflichtige Annahmen', 'Widersprüche / Unschärfen', 'Gas-spezifische Prüfspuren', 'Fragen an Regulierungsmanagement', 'Fragen an Bilanzierung / Rechnungswesen', 'Fragen an Technik / Asset Management', 'Fragen an Management / Gremium', 'Empfohlene nächste Klärpunkte im Projektplan']
  }
];

export const defaultAiPromptOptions = {
  roleId: 'committee',
  detailLevel: 'standard',
  dataScope: 'standard',
  includeProjectPlan: true,
  anonymizeMeasures: false,
  roundAmounts: true,
  omitNotes: true,
  language: 'Deutsch'
};

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundTeur(value, enabled) {
  const number = finiteNumber(value, 0);
  return enabled ? Math.round(number / 10) * 10 : Number(number.toFixed(2));
}

function pct(value) {
  return Number.isFinite(value) ? Number((value * 100).toFixed(1)) : null;
}

function roleFor(id) {
  return promptRoles.find(role => role.id === id) || promptRoles[0];
}

function activeMeasures(model) {
  return (Array.isArray(model?.measures) ? model.measures : []).filter(measure => measure.active !== false);
}

function impactSummary(measure, options) {
  return (Array.isArray(measure.impactAssumptions) ? measure.impactAssumptions : []).map(impact => ({
    area: impact.area || 'portfolio',
    title: impact.title || 'Wirkannahme',
    amountTeurPa: roundTeur(impact.amount, options.roundAmounts),
    confidence: impact.confidence || 'review',
    governance: impact.governance || 'sensitivity',
    evidenceType: impact.evidenceType || 'open',
    chain: options.omitNotes ? '' : (impact.chain || ''),
    evidence: options.omitNotes ? '' : (impact.evidence || '')
  }));
}

function summarizeProjectPlan(plan) {
  if (!plan || !Array.isArray(plan.milestones)) return null;
  const counts = projectPlanTaskCounts(plan);
  const states = projectPlanEffectiveTaskStates(plan);
  const openTasks = [];
  const blockedTasks = [];
  for (const milestone of plan.milestones) {
    for (const task of milestone.tasks || []) {
      if (task.templateSkipped || task.status === 'done') continue;
      const state = states[task.id];
      const item = {
        id: task.id,
        milestone: milestone.title,
        title: task.title,
        ownerRole: task.ownerRole,
        status: task.status || 'open',
        effectiveState: state?.blocked ? 'blocked' : 'ready',
        missingDependencies: state?.missingDependencies || [],
        source: task.source || 'template',
        resultArtifact: task.resultArtifact || ''
      };
      if (state?.blocked) blockedTasks.push(item);
      else openTasks.push(item);
    }
  }
  return {
    schemaVersion: plan.schemaVersion || '1.0.0',
    targetDecisionMilestone: plan.targetDecisionMilestone || '',
    counts,
    nextReadyTasks: openTasks.slice(0, 8),
    blockedTasks: blockedTasks.slice(0, 8)
  };
}

export function redactModelForPrompt(model, options = defaultAiPromptOptions, context = {}) {
  const merged = { ...defaultAiPromptOptions, ...options };
  const inputs = model?.inputs || {};
  const params = engineParams(inputs);
  const basis = calcPortfolio({ measures: activeMeasures(model) }, scenarioParams(params, 'basis'));
  const conservative = calcPortfolio({ measures: activeMeasures(model) }, scenarioParams(params, 'konservativ'));
  const metrics = portfolioDecisionMetrics(basis, conservative);
  const includeMeasures = merged.dataScope !== 'summary';
  const includeDetailedMeasures = merged.dataScope === 'detailed';
  const measures = includeMeasures ? activeMeasures(model).map((measure, index) => ({
    id: merged.anonymizeMeasures ? `measure-${index + 1}` : String(measure.id || `measure-${index + 1}`),
    name: merged.anonymizeMeasures ? `Maßnahme ${index + 1}` : String(measure.name || `Maßnahme ${index + 1}`),
    type: measure.type || '',
    year: finiteNumber(measure.year, null),
    costTeur: roundTeur(measure.cost, merged.roundAmounts),
    secureActivationPct: finiteNumber(measure.secure, 0),
    uncertainActivationPct: finiteNumber(measure.uncertain, 0),
    probabilityPct: finiteNumber(measure.probability, 0),
    lifeYears: finiteNumber(measure.life, 0),
    reinvestMode: measure.reinvestMode || 'oneOff',
    portfolioSharePct: finiteNumber(measure.portfolioShare, 0),
    directQTeurPa: roundTeur(measure.qDirect, merged.roundAmounts),
    directEfficiencyTeurPa: roundTeur(measure.eDirect, merged.roundAmounts),
    riskAvoidedTeurPa: roundTeur(measure.riskAvoided, merged.roundAmounts),
    note: merged.omitNotes ? '' : (measure.note || ''),
    impactAssumptions: includeDetailedMeasures ? impactSummary(measure, merged) : []
  })) : [];

  return {
    context: {
      app: 'Szenarienrechner-EOG',
      buildCommit: context.buildInfo?.buildCommit || context.buildCommit || 'unknown',
      buildTime: context.buildInfo?.buildTime || context.buildTime || 'unknown',
      rulesetId: context.ruleset?.id || regulatoryParameterSet.id,
      rulesetConfidence: context.ruleset?.confidence || regulatoryParameterSet.confidence,
      rulesetSourceRef: context.ruleset?.sourceRef || regulatoryParameterSet.sourceRef,
      llmContextUrl
    },
    planning: {
      sector: params.sector,
      baseYear: params.baseYear,
      scenario: model?.scenario || 'basis',
      processPhase: model?.process?.phase || '',
      processStatus: merged.omitNotes ? '' : (model?.process?.statusNote || ''),
      nextStep: model?.process?.nextStep || ''
    },
    kpis: {
      governanceVerdict: metrics.governanceDecision.title,
      governanceRecommendation: metrics.governanceDecision.recommendation,
      activeMeasures: basis.activeMeasures.length,
      investmentTeur: roundTeur(basis.invest, merged.roundAmounts),
      rateMetricLabel: basis.rateMetricLabel,
      rateMetricPct: pct(basis.irr),
      npvTeur: roundTeur(basis.npv, merged.roundAmounts),
      recurringRegulatoryEogTeurPa: roundTeur(metrics.recurringRegulatoryEog, merged.roundAmounts),
      recurringIndicativeCashflowTeurPa: roundTeur(metrics.recurringIndicativeCashflow, merged.roundAmounts),
      yearOneOneOffTeur: roundTeur(metrics.yearOneOneOff, merged.roundAmounts),
      conservativeVerdict: metrics.conservative?.carries ? 'trägt' : 'trägt nicht',
      conservativeNpvTeur: roundTeur(metrics.conservative?.npv, merged.roundAmounts),
      cashflowCaveat: metrics.cashflowBasis
    },
    warnings: basis.warnings || [],
    measures,
    projectPlan: merged.includeProjectPlan ? summarizeProjectPlan(model?.projectPlan) : null
  };
}

function dataScopeHint(scope) {
  if (scope === 'summary') return 'Nur aggregierte Kennzahlen und Prozess-/Projektplan-Auszug. Keine Maßnahmenliste.';
  if (scope === 'detailed') return 'Ausführlicher Prompt mit Maßnahmen und Wirkannahmen. Vor Nutzung besonders sorgfältig redigieren.';
  return 'Standard: Kennzahlen, gerundete Maßnahmenwerte und Projektplan-Auszug; Notizen standardmäßig ausgelassen.';
}

export function buildAiPrompt(model, options = defaultAiPromptOptions, context = {}) {
  const merged = { ...defaultAiPromptOptions, ...options };
  const role = roleFor(merged.roleId);
  const snapshot = redactModelForPrompt(model, merged, context);
  const outputFormat = role.output.map(item => `- ${item}`).join('\n');
  return `# KI-Arbeitsauftrag: ${role.title}

## Datenschutz und Arbeitsmodus
Diese App sendet nichts an eine KI. Der folgende Text wurde lokal erzeugt. Prüfen und redigieren Sie den Prompt, bevor Sie ihn in ein KI-System Ihres Unternehmens einfügen. Verwenden Sie keine öffentlichen KI-Dienste für vertrauliche Netz-, Finanz- oder Unternehmensdaten, sofern dies intern nicht freigegeben ist.

Nutze zur Interpretation der Fachbegriffe und Modellgrenzen diese öffentliche Kontextdatei: ${llmContextUrl}
Wenn Du diese URL nicht abrufen kannst, arbeite nur mit dem folgenden eingebetteten Kontext.

## Rolle und Ziel
Rolle: ${role.title}
Sprache/Stil: ${merged.language}; Detailtiefe: ${merged.detailLevel}
Aufgabe: ${role.task}

## Erwartetes Ausgabeformat
${outputFormat}

## Wichtige Interpretationsregeln
- EOG-Wirkung ist nicht gleich Cashflow. IRR/MIRR und Kapitalwert beruhen auf einer indikativen Cashflow-Sicht.
- Basis vs. konservativ ist entscheidend: Wenn der Basiscase trägt, der konservative Case aber kippt, ist das keine robuste Freigabe, sondern eine Entscheidung mit Auflage.
- Prüfpflichtige Annahmen, Q/E-Wirkungen, Risikoannahmen und Attribution nicht als bestätigte Fakten darstellen.
- Keine regulatorische, steuerliche oder rechtliche Anerkennungszusage formulieren.
- Klärpunkte und Auflagen sichtbar machen, statt sie durch glatte Formulierungen zu verdecken.

## Provenienz
Build-Commit: ${snapshot.context.buildCommit}
Build-Zeit: ${snapshot.context.buildTime}
Regulierungsstand: ${snapshot.context.rulesetId}
Ruleset-Konfidenz: ${snapshot.context.rulesetConfidence}
Quelle/Stand: ${snapshot.context.rulesetSourceRef}
Datenumfang: ${dataScopeHint(merged.dataScope)}
Redaktion: Maßnahmennamen ${merged.anonymizeMeasures ? 'anonymisiert' : 'original'}, Beträge ${merged.roundAmounts ? 'gerundet' : 'nicht gerundet'}, Notizen ${merged.omitNotes ? 'ausgelassen' : 'enthalten'}.

## Planungsdaten als JSON
\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\`
`;
}
