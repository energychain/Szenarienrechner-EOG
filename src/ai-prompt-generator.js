import {
  calcPortfolio,
  flexibilityHelper,
  params as engineParams,
  portfolioDecisionMetrics,
  regulatoryParameterSet,
  scenarioParams
} from './engine.js';
import { projectPlanEffectiveTaskStates, projectPlanTaskCounts } from './project-plan.js';
import { normalizeGermanTeurText } from './render-utils.js';
import { normalizeSidecar, sanitizeSidecarForExport, sidecarSummary } from './sidecar.js';

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

function allMeasures(model) {
  return Array.isArray(model?.measures) ? model.measures : [];
}

function activeMeasures(model) {
  return allMeasures(model).filter(measure => measure.active !== false);
}

function isFlexibilityObject(measure = {}) {
  return measure.effectType === 'flexibility'
    || ['pruefpflichtig', 'quantified', 'active'].includes(measure.flexibilityStatus)
    || Boolean(measure.agnesRelevant)
    || measure.importStatus === 'flexibility_review';
}

function baseMeasurePromptFields(measure, index, options) {
  return {
    id: options.anonymizeMeasures ? `measure-${index + 1}` : String(measure.id || `measure-${index + 1}`),
    name: options.anonymizeMeasures ? `Maßnahme ${index + 1}` : String(measure.name || `Maßnahme ${index + 1}`),
    type: measure.type || '',
    year: finiteNumber(measure.year, null),
    costTeur: roundTeur(measure.cost, options.roundAmounts),
    secureActivationPct: finiteNumber(measure.secure, 0),
    uncertainActivationPct: finiteNumber(measure.uncertain, 0),
    probabilityPct: finiteNumber(measure.probability, 0),
    lifeYears: finiteNumber(measure.life, 0),
    reinvestMode: measure.reinvestMode || 'oneOff',
    portfolioSharePct: finiteNumber(measure.portfolioShare, 0),
    directQTeurPa: roundTeur(measure.qDirect, options.roundAmounts),
    directEfficiencyTeurPa: roundTeur(measure.eDirect, options.roundAmounts),
    riskAvoidedTeurPa: roundTeur(measure.riskAvoided, options.roundAmounts),
    note: options.omitNotes ? '' : normalizeGermanTeurText(measure.note || '')
  };
}

function flexibilityObjectPromptFields(measure, index, options, params) {
  const helper = flexibilityHelper(measure, params);
  return {
    ...baseMeasurePromptFields(measure, index, options),
    active: measure.active !== false,
    effectType: 'flexibility',
    flexibilityStatus: measure.flexibilityStatus || 'context',
    flexibilityUseCase: measure.flexibilityUseCase || 'netzfahrplan',
    networkScheduleRequired: measure.networkScheduleRequired !== false,
    networkScheduleStatus: measure.networkScheduleStatus || 'missing',
    networkConstraintRef: measure.networkConstraintRef || '',
    affectedNetworkLevel: measure.affectedNetworkLevel || '',
    dispatchLogic: measure.dispatchLogic || '',
    avoidedCapexTeur: roundTeur(measure.avoidedCapexTeur, options.roundAmounts),
    avoidedCapexConfidence: measure.avoidedCapexConfidence || 'none',
    deferredCapexTeur: roundTeur(measure.deferredCapexTeur, options.roundAmounts),
    deferredCapexFromYear: finiteNumber(measure.deferredCapexFromYear, null),
    deferredCapexToYear: finiteNumber(measure.deferredCapexToYear, null),
    flexOpexPaTeur: roundTeur(measure.flexOpexPaTeur, options.roundAmounts),
    flexOpexStartYear: finiteNumber(measure.flexOpexStartYear, null),
    flexOpexDurationYears: finiteNumber(measure.flexOpexDurationYears, null),
    opexRecognitionStatus: measure.opexRecognitionStatus || 'unknown',
    agnesRelevant: Boolean(measure.agnesRelevant),
    agnesRole: measure.agnesRole || 'offen',
    agnesIntegrationStatus: measure.agnesIntegrationStatus || 'not_assessed',
    agnesDataNeeded: Array.isArray(measure.agnesDataNeeded) ? measure.agnesDataNeeded.map(String) : [],
    rechenwirksam: Boolean(helper.active),
    reviewReason: helper.warnings?.join(' ') || (helper.active ? '' : 'Flexibilitätsobjekt ist nicht rechenwirksam.'),
    governance: helper.governance || ''
  };
}

function flexibilityPromptSummary(flexibilityObjects = []) {
  const agnesRelevant = flexibilityObjects.filter(measure => measure.agnesRelevant).length;
  const activeEffects = flexibilityObjects.filter(measure => measure.rechenwirksam).length;
  const reviewObjects = flexibilityObjects.filter(measure => !measure.rechenwirksam).length;
  const totalAvoided = flexibilityObjects.reduce((sum, measure) => sum + finiteNumber(measure.avoidedCapexTeur), 0);
  const totalDeferred = flexibilityObjects.reduce((sum, measure) => sum + finiteNumber(measure.deferredCapexTeur), 0);
  const totalOpex = flexibilityObjects.reduce((sum, measure) => sum + finiteNumber(measure.flexOpexPaTeur), 0);
  const needsReview = flexibilityObjects.some(measure => !measure.rechenwirksam);
  return {
    objectCount: flexibilityObjects.length,
    activeEffects,
    reviewObjects,
    avoidedCapexTeur: totalAvoided,
    deferredCapexTeur: totalDeferred,
    flexOpexPaTeur: totalOpex,
    agnesRelevantObjects: agnesRelevant,
    agnesSummary: agnesRelevant > 0
      ? `AGNeS-Relevanz: ${agnesRelevant} Flexibilitätsobjekt${agnesRelevant === 1 ? '' : 'e'} prüfpflichtig; ${activeEffects} aktive Flexibilitätswirkungen.`
      : 'AGNeS-Relevanz: keine als AGNeS-relevant markierten Flexibilitätsobjekte.',
    caveat: flexibilityObjects.length > 0
      ? 'AGNeS ist nur bei Flexibilitäts-/Netzfahrplanobjekten als Prüfpunkt zu berücksichtigen. Klassische CAPEX-Maßnahmen ohne AGNeS-Relevanz wurden nicht einzeln mit AGNeS-Feldern exportiert.'
      : '',
    klärpunkte: needsReview ? ['strom_flexibility_review'] : [],
    reviewDetail: needsReview
      ? 'Flexibilitätsobjekt nicht rechenwirksam: Netzfahrplan fehlt oder ist nicht validiert; vermiedene/verschobene CAPEX und Flex-OPEX nicht vollständig quantifiziert; AGNeS-/Nachweislogik prüfen.'
      : ''
  };
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


function projectMaturityWarningsFor(model = {}) {
  const warnings = [];
  const purpose = model.process?.purpose || model.process?.phaseTargets?.initialisierung || '';
  const nextStep = model.process?.nextStep || model.process?.resume?.nextStep || '';
  const plan = summarizeProjectPlan(model.projectPlan);
  const blockers = plan?.counts?.blocked || 0;
  if (!purpose || !nextStep || blockers > 0) {
    warnings.push({
      type: 'project_maturity_review',
      area: 'Projekt-/Reifegradstatus',
      title: 'Projekt-/Reifegradstatus offen',
      detail: 'Die Kennzahlen sind als indikative Rechensicht zu verstehen. Projektauftrag, Rollen, validierte Artefakte oder nächste Prüfschritte sind noch nicht vollständig dokumentiert.'
    });
  }
  return warnings;
}

function segmentationForPrompt(segmentation = {}, roundAmounts = true) {
  const convert = bucket => ({
    count: bucket?.count || 0,
    investTeur: roundTeur(bucket?.invest || 0, roundAmounts),
    npvTeur: roundTeur(bucket?.npv || 0, roundAmounts),
    yearOneRegulatoryEogTeur: roundTeur(bucket?.yearOneRegulatoryEog || 0, roundAmounts),
    recurringRegulatoryEogTeur: roundTeur(bucket?.recurringRegulatoryEog || 0, roundAmounts)
  });
  return {
    mappingNote: segmentation.mappingNote || 'Segmentierung basiert auf importStatus, investmentDecisionStatus, reportingStatus, effectType und orgUnit.',
    corePortfolio: convert(segmentation.corePortfolio),
    scopeCandidate: convert(segmentation.scopeCandidate),
    optionSensitive: convert(segmentation.optionSensitive),
    contextObject: convert(segmentation.contextObject),
    flexibilityObject: convert(segmentation.flexibilityObject),
    excluded: convert(segmentation.excluded)
  };
}

function sidecarForPrompt(model, profile = 'sanitized_external') {
  const sanitized = sanitizeSidecarForExport(normalizeSidecar(model?.sidecar), profile);
  return {
    summary: sidecarSummary(sanitized),
    objects: sanitized.objects.slice(0, 12).map(object => ({
      id: object.id,
      type: object.type,
      division: object.division,
      title: object.title,
      status: object.status,
      evidenceStatus: object.evidenceStatus,
      calculationImpact: object.calculationImpact,
      summary: object.summary,
      linkedMeasures: object.linkedMeasures,
      openQuestions: object.openQuestions,
      exportStatus: object.exportStatus
    })),
    caveat: 'Sidecar-Objekte sind standardmäßig nicht KPI-wirksam. Sie beschreiben Kontext, Evidenz, Datenqualität und Steuerungsfähigkeit; Rechenwirkung entsteht nur durch explizite Aktivierung und definierte Mapping-Logik.'
  };
}

function riskAvoidedSummaryFor(warnings = []) {
  const riskWarnings = warnings.filter(warning => String(warning.type || '').startsWith('risk_avoidance'));
  const missing = riskWarnings.filter(warning => warning.type === 'risk_avoidance_evidence_missing');
  const outliers = riskWarnings.filter(warning => warning.type === 'risk_avoidance_outlier_review');
  const byMeasure = new Map();
  riskWarnings.forEach(warning => {
    const key = warning.measureId || warning.measure || warning.key;
    if (!key || byMeasure.has(key)) return;
    byMeasure.set(key, {
      measureId: warning.measureId || '',
      measure: warning.measure || 'Maßnahme',
      kinds: [...new Set(riskWarnings.filter(item => (item.measureId || item.measure || item.key) === key).map(item => item.type === 'risk_avoidance_outlier_review' ? 'outlier' : 'missing_evidence'))]
    });
  });
  return {
    missingEvidenceCount: missing.length,
    outlierCount: outliers.length,
    examples: Array.from(byMeasure.values()).slice(0, 5),
    caveat: riskWarnings.length
      ? `RiskAvoided-Evidenz fehlt bei ${missing.length} Maßnahmen; RiskAvoided-Ausreißer identifiziert: ${outliers.length} Maßnahmen. Top-Beispiele sind begrenzt, vollständige Details bleiben im Modell/Reportkontext.`
      : 'Keine aggregierten RiskAvoided-Hinweise.'
  };
}

function compactWarningsForPrompt(warnings = []) {
  const riskSummary = riskAvoidedSummaryFor(warnings);
  const compacted = warnings.filter(warning => !String(warning.type || '').startsWith('risk_avoidance'));
  if (riskSummary.missingEvidenceCount > 0) {
    compacted.push({
      type: 'risk_avoidance_evidence_missing',
      area: 'RiskAvoided-Evidenz',
      title: 'RiskAvoided-Evidenz aggregiert offen',
      detail: riskSummary.caveat,
      count: riskSummary.missingEvidenceCount,
      examples: riskSummary.examples
    });
  }
  if (riskSummary.outlierCount > 0) {
    compacted.push({
      type: 'risk_avoidance_outlier_review',
      area: 'RiskAvoided-Evidenz',
      title: 'RiskAvoided-Ausreißer aggregiert prüfen',
      detail: `RiskAvoided-Ausreißer identifiziert: ${riskSummary.outlierCount} Maßnahmen. Top-Beispiele sind im aggregierten RiskAvoided-Abschnitt enthalten.`,
      count: riskSummary.outlierCount,
      examples: riskSummary.examples
    });
  }
  return { warnings: compacted, riskSummary };
}

function conservativeVerdictText(metrics) {
  if (metrics?.conservativeGate === 'stresstest_ausstehend' || metrics?.scenarioComparison?.identicalBasisConservative) return 'Stresstest ausstehend';
  if (!metrics?.conservative) return 'nicht geprüft';
  return metrics.conservative.carries ? 'trägt' : 'trägt nicht';
}

function stromReviewSection(snapshot) {
  if (snapshot.planning?.sector !== 'strom') return '';
  const review = snapshot.stromReview || {};
  const warnings = Array.isArray(review.warningTypes) ? review.warningTypes : [];
  return `
## Robustheit / Szenariologik
${warnings.includes('conservative_case_missing') || warnings.includes('strom_conservative_case_missing') ? 'Klärpunkt conservative_case_missing: Konservatives Szenario nicht parametrisiert; Basiscase nicht als Robustheitsnachweis lesen.' : 'Konservatives Szenario separat prüfen.'}

## Regulatorischer Sensitivitätsrahmen Strom / NEST
${warnings.includes('strom_regulatory_framework_review') ? 'Klärpunkt strom_regulatory_framework_review: Regulatorischer Parameterstand/Reformrahmen pruefpflichtig; NEST-/CAPEX-/OPEX-/Flexibilitätswirkungen als Sensitivität nachführen.' : 'Kein aggregierter Strom-Regulierungsreview im Snapshot.'}

## Kernportfolio vs. Scope-Kandidaten
${snapshot.portfolioSegmentation?.mappingNote || 'Segmentierung nach Statusfeldern prüfen.'}
${JSON.stringify(snapshot.portfolioSegmentation || {}, null, 2)}

## Defaultannahmen und Nutzungsdauern
${warnings.filter(type => ['strom_default_assumptions_review', 'useful_life_plausibility_review', 'measure_specific_parameters_missing'].includes(type)).join(', ') || 'Keine aggregierten Default-/Nutzungsdauerhinweise.'}

## RiskAvoided-Evidenz
${review.riskAvoided?.caveat || 'Keine aggregierten RiskAvoided-Hinweise.'}
${review.riskAvoided?.examples?.length ? `Top-Beispiele: ${review.riskAvoided.examples.map(example => example.measure).join('; ')}` : ''}

## No-Regret-Klassifikation
${warnings.includes('no_regret_overuse_review') ? 'Klärpunkt no_regret_overuse_review: No-Regret-Kategorie differenzieren.' : 'Keine aggregierte No-Regret-Überdehnung im Snapshot.'}

## Projekt-/Reifegradstatus
${warnings.includes('project_maturity_review') ? 'Klärpunkt project_maturity_review: Projektauftrag, Rollen, Artefakte oder nächste Prüfschritte offen.' : 'Kein aggregierter Projekt-Reifegradhinweis im Snapshot.'}
`;
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
  const candidateMeasures = allMeasures(model);
  const promptFlexibilityObjects = includeMeasures && params.sector === 'strom'
    ? candidateMeasures
      .filter(isFlexibilityObject)
      .map((measure, index) => flexibilityObjectPromptFields(measure, index, merged, params))
    : [];
  const measures = includeMeasures ? activeMeasures(model)
    .filter(measure => !isFlexibilityObject(measure))
    .map((measure, index) => ({
      ...baseMeasurePromptFields(measure, index, merged),
      impactAssumptions: includeDetailedMeasures ? impactSummary(measure, merged) : []
    })) : [];
  const promptFlexibilitySummary = flexibilityPromptSummary(promptFlexibilityObjects);
  const projectMaturityWarnings = params.sector === 'strom' ? projectMaturityWarningsFor(model) : [];
  const combinedWarningsRaw = [...(basis.warnings || []), ...(metrics.interpretationWarnings || []), ...projectMaturityWarnings, ...(promptFlexibilitySummary.klärpunkte || []).map(type => ({
    type,
    area: 'Flexibilität / Netzfahrplan',
    title: 'Flexibilitätswirkung nicht rechenwirksam',
    detail: promptFlexibilitySummary.reviewDetail
  }))];
  const compactedPromptWarnings = params.sector === 'strom'
    ? compactWarningsForPrompt(combinedWarningsRaw)
    : { warnings: combinedWarningsRaw, riskSummary: riskAvoidedSummaryFor([]) };
  const combinedWarnings = compactedPromptWarnings.warnings;

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
      conservativeVerdict: conservativeVerdictText(metrics),
      conservativeNpvTeur: roundTeur(metrics.conservative?.npv, merged.roundAmounts),
      cashflowCaveat: metrics.cashflowBasis
    },
    warnings: combinedWarnings,
    flexibility: {
      ...promptFlexibilitySummary,
      ...(basis.flexibilitySummary || {})
    },
    stromReview: params.sector === 'strom' ? {
      warningTypes: [...new Set(combinedWarnings.map(warning => warning.type).filter(Boolean))],
      notes: combinedWarnings.map(warning => warning.detail || warning.title).filter(Boolean).slice(0, 12),
      riskAvoided: compactedPromptWarnings.riskSummary
    } : null,
    portfolioSegmentation: params.sector === 'strom' ? segmentationForPrompt(basis.portfolioSegmentation, merged.roundAmounts) : null,
    sidecar: sidecarForPrompt(model, 'sanitized_external'),
    measures,
    flexibilityObjects: promptFlexibilityObjects,
    projectPlan: merged.includeProjectPlan ? summarizeProjectPlan(model?.projectPlan) : null
  };
}

function dataScopeHint(scope) {
  if (scope === 'summary') return 'Nur aggregierte Kennzahlen und Prozess-/Projektplan-Auszug. Keine Maßnahmenliste.';
  if (scope === 'detailed') return 'Ausführlicher Prompt mit Maßnahmen und Wirkannahmen. Vor Nutzung besonders sorgfältig redigieren.';
  return 'Standard: Kennzahlen, gerundete Maßnahmenwerte und Projektplan-Auszug; Notizen standardmäßig ausgelassen.';
}

function flexibilityPromptSection(snapshot) {
  const objects = Array.isArray(snapshot.flexibilityObjects) ? snapshot.flexibilityObjects : [];
  if (!objects.length) return '';
  const lines = objects.map(object => `- ${object.name}: Status ${object.flexibilityStatus}; Netzfahrplan ${object.networkScheduleStatus}; rechenwirksam ${object.rechenwirksam ? 'ja' : 'nein'}; AGNeS ${object.agnesRelevant ? object.agnesRole : 'nicht relevant'}; Prüfgrund: ${object.reviewReason || 'keine offene Prüfnotiz'}`);
  const summary = snapshot.flexibility || {};
  return `
## Strom-Flexibilitätsobjekte / Netzfahrplan / AGNeS
Klassische CAPEX-Maßnahmen werden ohne Default-Flexibilitätsfelder exportiert. Flexibilitäts-/Netzfahrplanobjekte stehen separat, auch wenn sie nicht rechenwirksam sind.

${summary.agnesSummary || ''}
${summary.caveat || ''}
${summary.klärpunkte?.length ? `Klärpunkt: ${summary.klärpunkte.join(', ')}. ${summary.reviewDetail || ''}` : ''}

${lines.join('\n')}
`;
}

function sidecarPromptSection(snapshot) {
  const sidecar = snapshot.sidecar || { summary: { total: 0 }, objects: [] };
  if (!sidecar.summary?.total) return '';
  return `
## Kontext & Evidenz / Sidecar
${sidecar.caveat}
Aggregat: ${sidecar.summary.total} Objekte; offene Prüfpunkte ${sidecar.summary.openQuestions || 0}; Datenqualität offen ${sidecar.summary.dataQualityOpen || 0}; exporteingeschränkt ${sidecar.summary.exportRestricted || 0}.
${sidecar.objects.map(object => `- ${object.division} · ${object.type}: ${object.title}; Evidenz ${object.evidenceStatus}; Rechenwirkung ${object.calculationImpact}; Status ${object.status}; ${object.summary || ''}`).join('\n')}
`;
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
- Flexibilitätsobjekte sind nicht als klassische CAPEX-Maßnahmen zu interpretieren. Sie bilden mögliche OPEX-gegen-CAPEX-Substitutionen ab; ohne validierten Netzfahrplan, quantifizierte vermiedene/verschobene CAPEX und jährliche Flex-OPEX keine automatische Ergebniswirkung. AGNeS-Relevanz ist als eigener Prüfpunkt zu führen.
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
${stromReviewSection(snapshot)}
${flexibilityPromptSection(snapshot)}
${sidecarPromptSection(snapshot)}
## Planungsdaten als JSON
\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\`
`;
}
