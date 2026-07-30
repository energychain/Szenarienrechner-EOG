import {
  calcPortfolio,
  impactAssumptionsFor,
  params as engineParams,
  portfolioDecisionMetrics,
  scenarioParams as engineScenarioParams
} from './engine.js';
import { projectPlanEffectiveTaskStates, projectPlanMilestoneDate, projectPlanRoles } from './project-plan.js';
import { normalizeSidecar, sidecarSummary } from './sidecar.js';
import { normalizeStromEeg2027Measure, stromEeg2027PortfolioSummary } from './strom-eeg2027.js';

const scenarioLabels = {
  basis: 'Basis',
  konservativ: 'Konservativ',
  wert: 'Wert'
};

function clean(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'boolean') return value ? 'ja' : 'nein';
  return String(value);
}

function round(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function text(value) {
  return String(value ?? '').trim();
}

function externalMeasureId(measure) {
  return text(measure.externalId);
}

function yesNoUnknown(value) {
  if (value === 'yes') return 'ja';
  if (value === 'no') return 'nein';
  return 'unbekannt';
}

function investmentDecisionLabel(value) {
  return {
    planned: 'geplant',
    decided: 'getroffen',
    deferred: 'verschoben',
    unknown: 'unbekannt'
  }[value] || text(value) || 'unbekannt';
}

function monitoringProfileLabel(value) {
  return {
    monitoring: 'Monitoring aggregierbar',
    qreg: 'Netzleistungsfähigkeit / Q-Reg',
    nap14d: 'Netzausbauplan / §14d EnWG',
    none: 'nicht zugeordnet'
  }[value] || text(value) || 'nicht zugeordnet';
}

function monitoringQuality(measure) {
  const missing = [];
  if (!externalMeasureId(measure)) missing.push('externe ID');
  if (!text(measure.monitoringCategory)) missing.push('Kategorie');
  if (!text(measure.networkLevel)) missing.push('Netzebene/Druckstufe');
  if (!text(measure.reportingStatus)) missing.push('Status');
  return missing.length ? `prüfen: ${missing.join(', ')}` : 'strukturierte Mindestfelder vorhanden';
}

function profileIncluded(measure, profiles) {
  return profiles.includes(text(measure.monitoringProfile));
}

function investmentBucket(category) {
  const normalized = text(category).toLowerCase();
  if (/neubau|ausbau|erweiter|verstärk|verstaerk/.test(normalized)) return 'Neubau/Ausbau/Erweiterung';
  if (/erhalt|erneuer|ersatz|sanier|modern/.test(normalized)) return 'Erhalt/Erneuerung';
  return 'nicht zugeordnet';
}

function roleLabel(roleId) {
  return projectPlanRoles[roleId] || roleId || '';
}

function taskStatusLabel(task, effectiveState) {
  if (task.templateSkipped) return 'übersprungen';
  if (effectiveState === 'blocked') return 'blockiert';
  return task.status || 'open';
}

/**
 * @param {any} model
 * @param {{ buildInfo?: any, ruleset?: any }} options
 */
export function spreadsheetTables(model, options = {}) {
  const buildInfo = options.buildInfo || {};
  const ruleset = options.ruleset || {};
  const inputs = model?.inputs || {};
  const p = engineParams(inputs);
  const measures = Array.isArray(model?.measures) ? model.measures : [];
  const scenarioResults = Object.fromEntries(Object.keys(scenarioLabels).map(name => [
    name,
    calcPortfolio({ measures }, engineScenarioParams(p, name))
  ]));
  const metrics = portfolioDecisionMetrics(scenarioResults.basis, scenarioResults.konservativ);
  const basisResultsById = Object.fromEntries((scenarioResults.basis.results || []).map(result => [String(result.id), result]));
  const projectPlan = model?.projectPlan;
  const taskStates = projectPlan ? projectPlanEffectiveTaskStates(projectPlan) : new Map();

  const overviewRows = [
    ['Feld', 'Wert'],
    ['App-Version', model?.appVersion || '0.3.0-dev'],
    ['Build-Commit', buildInfo.buildCommit || ''],
    ['Build-Zeit', buildInfo.buildTime || ''],
    ['Ruleset-ID', ruleset.id || model?.regulatoryParameterSetId || ''],
    ['Ruleset-Konfidenz', ruleset.confidence || model?.regulatoryParameterConfidence || ''],
    ['Ruleset-Quelle', ruleset.sourceRef || model?.regulatoryParameterSourceRef || ''],
    ['Sparte', p.sector],
    ['Startjahr', p.baseYear],
    ['Regulierungsverfahren', p.regulationProcedure],
    ['Aktive Maßnahmen', scenarioResults.basis.activeMeasures.length],
    ['Investition TEUR', round(scenarioResults.basis.invest, 2)],
    ['Aktiviert erwartet TEUR', round(scenarioResults.basis.activated, 2)],
    ['Urteil', metrics.governanceDecision.title],
    ['Urteil Empfehlung', metrics.governanceDecision.recommendation],
    ['Basis Kennzahl', metrics.rateMetricLabel || 'IRR/MIRR'],
    ['Basis Kennzahl %', round((scenarioResults.basis.irr || 0) * 100, 3)],
    ['Basis Kapitalwert TEUR', round(scenarioResults.basis.npv, 2)],
    ['Laufende regulatorische EOG TEUR', round(metrics.recurringRegulatoryEog, 2)],
    ['Laufender indikativer Cashflow TEUR', round(metrics.recurringIndicativeCashflow, 2)],
    ['Export-Hinweis', 'Tabellenexport für Weitergabe/Analyse; JSON/HTML-mit-Daten bleiben kanonische Roundtrip-Formate.']
  ];

  const measureRows = [[
    'id', 'externalId', 'name', 'active', 'orgUnit', 'type', 'tags', 'sourceSystem', 'sourceRecordId', 'scoringRef',
    'assetSystemRef', 'erpRef', 'riskDbRef', 'sourceStatus', 'monitoringProfile', 'monitoringCategory',
    'networkLevel', 'reportingRegion', 'reportingStatus', 'capacityImpact', 'bottleneckRef', 'permitRequired',
    'permitStatus', 'investmentDecisionStatus', 'investmentDecisionDate', 'alternativesChecked', 'flexibilityNeed',
    'year', 'costTeur', 'life', 'hgbLife',
    'capitalCostMode', 'activationSecurePct', 'activationUncertainPct', 'activationProbabilityPct', 'expectedActivatedTeur',
    'opexRecognitionPct', 'opexPaTeur', 'opexDeltaPaTeur', 'reinvestMode', 'reinvestCostTeur', 'reinvestLife', 'decommissionCostTeur',
    'portfolioSharePct', 'rateMetric', 'ratePct', 'npvTeur', 'yearOneRegulatoryEogTeur', 'recurringRegulatoryEogTeur',
    'yearOneIndicativeCashflowTeur', 'recurringIndicativeCashflowTeur', 'warnings'
  ]];
  measures.forEach(measure => {
    const result = basisResultsById[String(measure.id)];
    measureRows.push([
      measure.id,
      measure.externalId || '',
      measure.name || '',
      Boolean(measure.active),
      measure.orgUnit || '',
      measure.type || '',
      Array.isArray(measure.tags) ? measure.tags.join(', ') : '',
      measure.sourceSystem || '',
      measure.sourceRecordId || '',
      measure.scoringRef || '',
      measure.assetSystemRef || '',
      measure.erpRef || '',
      measure.riskDbRef || '',
      measure.sourceStatus || '',
      monitoringProfileLabel(measure.monitoringProfile),
      measure.monitoringCategory || '',
      measure.networkLevel || '',
      measure.reportingRegion || '',
      measure.reportingStatus || '',
      measure.capacityImpact || '',
      measure.bottleneckRef || '',
      yesNoUnknown(measure.permitRequired),
      measure.permitStatus || '',
      investmentDecisionLabel(measure.investmentDecisionStatus),
      measure.investmentDecisionDate || '',
      measure.alternativesChecked || '',
      measure.flexibilityNeed || '',
      measure.year,
      round(measure.cost, 2),
      measure.life,
      measure.hgbLife || measure.life,
      inputs.capitalCostMode || 'simple',
      round(measure.secure || 0, 2),
      round(measure.uncertain || 0, 2),
      round(measure.probability || 0, 2),
      result ? round(result.activated, 2) : '',
      round(measure.opexRecognition || 0, 2),
      round(measure.opexPa || 0, 2),
      round(measure.opexDeltaPa || 0, 2),
      measure.reinvestMode || 'oneOff',
      round(measure.reinvestCost || 0, 2),
      measure.reinvestLife || '',
      round(measure.decommissionCost || 0, 2),
      round(measure.portfolioShare || 0, 2),
      result?.rateMetricLabel || '',
      result && Number.isFinite(result.irr) ? round(result.irr * 100, 3) : '',
      result ? round(result.npv, 2) : '',
      result ? round(result.rows[0]?.regulatoryEogEffect || 0, 2) : '',
      result ? round(result.rows[1]?.regulatoryEogEffect ?? result.rows[0]?.regulatoryEogEffect ?? 0, 2) : '',
      result ? round(result.rows[0]?.indicativeCashflow || 0, 2) : '',
      result ? round(result.rows[1]?.indicativeCashflow ?? result.rows[0]?.indicativeCashflow ?? 0, 2) : '',
      (result?.warnings || []).map(warning => warning.title || warning.type).join(' | ')
    ]);
  });

  const scenarioRows = [[
    'scenario', 'rateMetric', 'ratePct', 'npvTeur', 'investTeur', 'activatedTeur', 'yearOneRegulatoryEogTeur',
    'recurringRegulatoryEogTeur', 'yearOneIndicativeCashflowTeur', 'recurringIndicativeCashflowTeur', 'warnings'
  ]];
  Object.entries(scenarioResults).forEach(([name, result]) => {
    const snapshot = portfolioDecisionMetrics(result, name === 'basis' ? scenarioResults.konservativ : null);
    scenarioRows.push([
      scenarioLabels[name],
      result.rateMetricLabel || '',
      Number.isFinite(result.irr) ? round(result.irr * 100, 3) : '',
      round(result.npv, 2),
      round(result.invest, 2),
      round(result.activated, 2),
      round(result.yearly[0]?.regulatoryEogEffect || 0, 2),
      round(snapshot.recurringRegulatoryEog, 2),
      round(result.yearly[0]?.indicativeCashflow || 0, 2),
      round(snapshot.recurringIndicativeCashflow, 2),
      (result.warnings || []).map(warning => warning.title || warning.type).join(' | ')
    ]);
  });

  const yearlyRows = [[
    'year', 'regulatoryPeriod', 'depreciationTeur', 'capitalReturnTeur', 'reinvestAssetEffectTeur', 'qAndETeur',
    'riskTeur', 'firstYearOpexTeur', 'regulatoryEogEffectTeur', 'economicBridgeTeur', 'indicativeCashflowTeur', 'ebitTeur'
  ]];
  scenarioResults.basis.yearly.forEach(row => yearlyRows.push([
    row.year,
    row.regulatoryPeriod?.id || '',
    round(row.depreciation, 2),
    round(row.capitalReturn, 2),
    round(row.reinvestAssetEffect, 2),
    round(row.qAndE, 2),
    round(row.risk, 2),
    round(row.firstYearOpex, 2),
    round(row.regulatoryEogEffect, 2),
    round(row.economicOpex + row.reinvestDecommission, 2),
    round(row.indicativeCashflow, 2),
    round(row.ebit, 2)
  ]));

  const projectRows = [[
    'milestoneId', 'milestone', 'storyKey', 'plannedDate', 'leadRole', 'taskId', 'taskTitle', 'ownerRole', 'dueDate',
    'status', 'effectiveState', 'source', 'templateSkipped', 'dependsOn', 'evidenceRequired', 'resultArtifact', 'note'
  ]];
  (projectPlan?.milestones || []).forEach(milestone => {
    (milestone.tasks || []).forEach(task => {
      const state = taskStates[task.id] || { effectiveState: task.status || 'open' };
      projectRows.push([
        milestone.id,
        milestone.title,
        milestone.storyKey,
        projectPlanMilestoneDate(projectPlan.baseYear, milestone.plannedOffsetMonths),
        roleLabel(milestone.leadRole),
        task.id,
        task.title,
        roleLabel(task.ownerRole),
        projectPlanMilestoneDate(projectPlan.baseYear, milestone.plannedOffsetMonths, task.dueOffsetDays || 0),
        task.status || 'open',
        taskStatusLabel(task, state.effectiveState),
        task.source || 'template',
        Boolean(task.templateSkipped),
        (task.dependsOn || []).join(', '),
        task.evidenceRequired || '',
        task.resultArtifact || '',
        task.note || ''
      ]);
    });
  });

  const warningRows = [['type', 'area', 'measureId', 'measure', 'title', 'detail', 'targetPhase', 'status']];
  scenarioResults.basis.results.forEach(result => {
    (result.warnings || []).forEach(warning => warningRows.push([
      warning.type,
      warning.area || '',
      result.id,
      result.name,
      warning.title || '',
      warning.detail || '',
      warning.targetPhase || '',
      'offen'
    ]));
  });
  measures.forEach(measure => {
    impactAssumptionsFor(measure).forEach(impact => {
      if (impact.confidence === 'review' || impact.governance === 'sensitivity') {
        warningRows.push([
          'impact_assumption_review',
          impact.area || '',
          measure.id,
          measure.name,
          impact.title || 'Wirkannahme prüfen',
          impact.chain || impact.evidence || impact.note || '',
          'technik-rueckkopplung',
          impact.governance || impact.confidence || ''
        ]);
      }
    });
  });

  const monitoringMeasureRows = [[
    'externalId', 'name', 'sector', 'profile', 'category', 'investmentBucket', 'networkLevel', 'region', 'status',
    'plannedStartYear', 'commissioningYear', 'costTeur', 'opexPaTeur', 'opexDeltaPaTeur', 'active', 'dataQuality'
  ]];
  measures
    .filter(measure => profileIncluded(measure, ['monitoring', 'qreg', 'nap14d']))
    .forEach(measure => monitoringMeasureRows.push([
      externalMeasureId(measure),
      measure.name || '',
      p.sector,
      monitoringProfileLabel(measure.monitoringProfile),
      measure.monitoringCategory || '',
      investmentBucket(measure.monitoringCategory),
      measure.networkLevel || '',
      measure.reportingRegion || '',
      measure.reportingStatus || '',
      measure.plannedStartYear || '',
      measure.year || '',
      round(measure.cost, 2),
      round(measure.opexPa || 0, 2),
      round(measure.opexDeltaPa || 0, 2),
      Boolean(measure.active),
      monitoringQuality(measure)
    ]));

  const aggregateMap = new Map();
  measures
    .filter(measure => measure.active && profileIncluded(measure, ['monitoring', 'qreg', 'nap14d']))
    .forEach(measure => {
      const key = [p.sector, measure.year || '', investmentBucket(measure.monitoringCategory), measure.networkLevel || '', measure.reportingRegion || ''].join('|');
      const existing = aggregateMap.get(key) || {
        sector: p.sector,
        year: measure.year || '',
        bucket: investmentBucket(measure.monitoringCategory),
        networkLevel: measure.networkLevel || '',
        region: measure.reportingRegion || '',
        count: 0,
        capex: 0,
        opex: 0,
        ids: []
      };
      existing.count += 1;
      existing.capex += Number(measure.cost) || 0;
      existing.opex += Number(measure.opexPa) || 0;
      if (externalMeasureId(measure)) existing.ids.push(externalMeasureId(measure));
      aggregateMap.set(key, existing);
    });
  const monitoringAggregateRows = [[
    'sector', 'year', 'investmentBucket', 'networkLevel', 'region', 'measureCount', 'capexTeur', 'opexPaTeur', 'externalIds', 'note'
  ]];
  [...aggregateMap.values()].forEach(item => monitoringAggregateRows.push([
    item.sector,
    item.year,
    item.bucket,
    item.networkLevel,
    item.region,
    item.count,
    round(item.capex, 2),
    round(item.opex, 2),
    item.ids.join(', '),
    'Aggregat zur Vorbereitung von Monitoring-/Excel-Abfragen; offizielles Vorlagen-Mapping fachlich prüfen.'
  ]));

  const qregRows = [[
    'externalId', 'name', 'networkLevel', 'region', 'capacityImpact', 'impactAreas', 'evidenceTypes', 'dataQuality'
  ]];
  measures
    .filter(measure => profileIncluded(measure, ['qreg']))
    .forEach(measure => {
      const impacts = impactAssumptionsFor(measure);
      qregRows.push([
        externalMeasureId(measure),
        measure.name || '',
        measure.networkLevel || '',
        measure.reportingRegion || '',
        measure.capacityImpact || '',
        [...new Set(impacts.map(impact => impact.area).filter(Boolean))].join(', '),
        [...new Set(impacts.map(impact => impact.evidenceType).filter(Boolean))].join(', '),
        monitoringQuality(measure)
      ]);
    });

  const napRows = [[
    'externalId', 'name', 'category', 'networkLevel', 'region', 'bottleneckRef', 'capacityImpact', 'costTeur',
    'plannedFiveYearWindow', 'commissioningYear', 'permitRequired', 'permitStatus', 'investmentDecisionStatus',
    'investmentDecisionDate', 'alternativesChecked', 'flexibilityNeed', 'openIssues', 'dataQuality'
  ]];
  measures
    .filter(measure => profileIncluded(measure, ['nap14d']))
    .forEach(measure => napRows.push([
      externalMeasureId(measure),
      measure.name || '',
      measure.monitoringCategory || '',
      measure.networkLevel || '',
      measure.reportingRegion || '',
      measure.bottleneckRef || '',
      measure.capacityImpact || '',
      round(measure.cost, 2),
      measure.year ? `${measure.year}-${Number(measure.year) + 4}` : '',
      measure.year || '',
      yesNoUnknown(measure.permitRequired),
      measure.permitStatus || '',
      investmentDecisionLabel(measure.investmentDecisionStatus),
      measure.investmentDecisionDate || '',
      measure.alternativesChecked || '',
      measure.flexibilityNeed || '',
      [measure.note || '', ...impactAssumptionsFor(measure).filter(impact => impact.confidence === 'review' || impact.governance === 'sensitivity').map(impact => impact.note || impact.title || '')].filter(Boolean).join(' | '),
      monitoringQuality(measure)
    ]));

  const systemReferenceRows = [[
    'measureId', 'externalId', 'name', 'sourceSystem', 'sourceRecordId', 'scoringRef', 'assetSystemRef', 'erpRef', 'riskDbRef', 'sourceStatus', 'returnPathStatus'
  ]];
  measures.forEach(measure => {
    const hasSource = text(measure.sourceSystem) && (text(measure.sourceRecordId) || externalMeasureId(measure));
    systemReferenceRows.push([
      measure.id || '',
      externalMeasureId(measure),
      measure.name || '',
      measure.sourceSystem || '',
      measure.sourceRecordId || '',
      measure.scoringRef || '',
      measure.assetSystemRef || '',
      measure.erpRef || '',
      measure.riskDbRef || '',
      measure.sourceStatus || '',
      hasSource ? 'rueckspielweg_benannt' : 'rueckspielweg_offen'
    ]);
  });

  const riskMappingRows = [[
    'measureId', 'externalId', 'name', 'riskAvoidedTeurPa', 'riskDbRef', 'riskEvidenceStatus', 'riskOwnerRole', 'riskAssessmentStatus', 'impactRiskAssumptions', 'mappingStatus'
  ]];
  measures.filter(measure => Number(measure.riskAvoided || 0) > 0 || text(measure.riskDbRef)).forEach(measure => {
    const riskImpacts = impactAssumptionsFor(measure).filter(impact => impact.area === 'risk');
    const hasMapping = text(measure.riskDbRef) || text(measure.riskEvidenceStatus || measure.riskAvoidedEvidenceStatus) || riskImpacts.some(impact => impact.evidence || impact.chain || impact.riskImpact);
    riskMappingRows.push([
      measure.id || '',
      externalMeasureId(measure),
      measure.name || '',
      round(measure.riskAvoided || 0, 2),
      measure.riskDbRef || '',
      measure.riskEvidenceStatus || measure.riskAvoidedEvidenceStatus || '',
      measure.riskOwnerRole || '',
      measure.riskAssessmentStatus || '',
      riskImpacts.map(impact => `${impact.title}: ${round(impact.amount, 2)} TEUR/a`).join(' | '),
      hasMapping ? 'mapping_benannt' : 'mapping_offen'
    ]);
  });

  function clarificationPriority(area, title, detail, type) {
    const value = [area, title, detail, type].filter(Boolean).join(' ').toLowerCase();
    if (/risiko|risk|q-element|q\/e|eog|rab|aktivier|cashflow|kapitalwert|irr|verzinsung|kanu/.test(value)) return ['hoch', 'Rechen-/Steuerungswirkung'];
    if (/quelle|evidenz|system|daten|mapping|sidecar|wirkannahme|doppelzähl/.test(value)) return ['mittel', 'Evidenz / Datenqualität'];
    return ['normal', 'Dokumentation / Prozess'];
  }
  const prioritizedClarificationRows = [[
    'priority', 'driver', 'type', 'area', 'measureId', 'measureName', 'title', 'detail', 'suggestedAction'
  ]];
  warningRows.slice(1).forEach(row => {
    const [type, area, measureId, measureName, title, detail] = row;
    const [priority, driver] = clarificationPriority(area, title, detail, type);
    prioritizedClarificationRows.push([
      priority,
      driver,
      type,
      area,
      measureId,
      measureName,
      title,
      detail,
      'Datenstelle prüfen, Klärnotiz erfassen und Rückspielweg zum Quellsystem dokumentieren.'
    ]);
  });

  const normalizedSidecar = normalizeSidecar(model?.sidecar);
  const sidecarBridgeSummary = sidecarSummary(normalizedSidecar);
  const stromEeg2027Summary = stromEeg2027PortfolioSummary(model, p.sector);
  const stromEeg2027Rows = [[
    'measureId', 'name', 'regulatoryStatus', 'regulatoryStatusDate', 'assumptionStatus',
    'capacityLimitedGridArea', 'capacityLimitedTechnology', 'redispatchCompensationWaiverEnabled',
    'redispatchCompensationWaiverLimitPct', 'windPriorityArea', 'redispatchRiskClass', 'annualRevenueAtRiskTeur',
    'connectionRequestPowerKw', 'voltageLevel', 'connectionRequestStatus', 'queueRiskClass',
    'reservationExpiryDate', 'nextRequiredEvidence', 'generationConnectionCostContributionEnabled',
    'connectionCostContributionTeur', 'connectionCostContributionMode', 'notice'
  ]];
  if (stromEeg2027Summary?.applicable) {
    measures.forEach(measure => {
      const extension = normalizeStromEeg2027Measure(measure, p.sector);
      const relevant = extension.regulatoryStatus === 'cabinet_draft_2026_07_29'
        || extension.assumptionStatus !== 'confirmed'
        || extension.capacityLimitedGridArea
        || extension.redispatchCompensationWaiverEnabled
        || extension.annualRevenueAtRiskTeur > 0
        || extension.connectionRequestPowerKw > 0
        || extension.connectionCostContributionTeur > 0;
      if (!relevant) return;
      stromEeg2027Rows.push([
        measure.id || '',
        measure.name || '',
        extension.regulatoryStatus,
        extension.regulatoryStatusDate,
        extension.assumptionStatus,
        Boolean(extension.capacityLimitedGridArea),
        extension.capacityLimitedTechnology,
        Boolean(extension.redispatchCompensationWaiverEnabled),
        extension.redispatchCompensationWaiverLimitPct,
        Boolean(extension.windPriorityArea),
        extension.redispatchRiskClass,
        round(extension.annualRevenueAtRiskTeur, 2),
        round(extension.connectionRequestPowerKw, 2),
        extension.voltageLevel,
        extension.connectionRequestStatus,
        extension.queueRiskClass,
        extension.reservationExpiryDate,
        extension.nextRequiredEvidence,
        Boolean(extension.generationConnectionCostContributionEnabled),
        round(extension.connectionCostContributionTeur, 2),
        extension.connectionCostContributionMode,
        stromEeg2027Summary.notice
      ]);
    });
  }
  const sidecarRows = [[
    'id', 'title', 'division', 'category', 'sidecarType', 'linkedMeasures', 'calculationImpact', 'activationStatus',
    'economicRelation', 'quantificationStatus', 'amount', 'amountUnit', 'timeHorizon', 'openQuestions', 'nextStatus'
  ]];
  normalizedSidecar.objects.forEach(object => {
    const bridge = object.bridgeLogic || {};
    const relationOpen = object.calculationImpact !== 'none'
      && ['effect_assumption', 'economic_bridge'].includes(object.sidecarType)
      && (bridge.economicRelation === 'none' || ['not_applicable', 'open', 'described'].includes(bridge.quantificationStatus));
    sidecarRows.push([
      object.id,
      object.title,
      object.division,
      object.type,
      object.sidecarType,
      object.linkedMeasures.join(', '),
      object.calculationImpact,
      object.activationStatus,
      bridge.economicRelation || 'none',
      bridge.quantificationStatus || 'not_applicable',
      bridge.amount,
      bridge.amountUnit || '',
      bridge.timeHorizon || '',
      [...object.openQuestions, ...(bridge.openQuestions || [])].join(' | '),
      relationOpen ? 'brueckenlogik_pruefen' : object.activationStatus === 'activated' ? 'aktivierung_auditieren' : 'dokumentiert'
    ]);
  });

  const provenanceRows = [
    ['Feld', 'Wert'],
    ['Export erstellt am', new Date().toISOString()],
    ['Build-Commit', buildInfo.buildCommit || ''],
    ['Build-Zeit', buildInfo.buildTime || ''],
    ['Ruleset-ID', ruleset.id || ''],
    ['Ruleset-Konfidenz', ruleset.confidence || ''],
    ['Ruleset-Quelle', ruleset.sourceRef || ''],
    ['Letzter Aktualitätscheck', model?.lastReleaseCheck?.checkedAt || 'nicht geprüft'],
    ['Sidecars gesamt', sidecarBridgeSummary.total],
    ['Sidecars ohne Rechenwirkung', sidecarBridgeSummary.withoutCalculationImpact],
    ['Sidecars offene Überleitungslogik', sidecarBridgeSummary.openBridgeLogic],
    ['Sidecars quantifiziert aber nicht aktiviert', sidecarBridgeSummary.quantifiedNotActivated],
    ['Sidecars aktiviert markiert', sidecarBridgeSummary.activated],
    ['Datenschutz', 'Tabellenexport wird lokal im Browser erzeugt; kein Upload, kein Backend, kein Netzzugriff.']
  ];

  return [
    { name: 'Uebersicht', rows: overviewRows },
    { name: 'Massnahmen', rows: measureRows },
    { name: 'Szenarien_KPI', rows: scenarioRows },
    { name: 'Jahreswerte', rows: yearlyRows },
    { name: 'Projektplan', rows: projectRows },
    { name: 'Klaerpunkte', rows: warningRows },
    { name: 'Klaerpunkte_Priorisiert', rows: prioritizedClarificationRows },
    { name: 'Systemreferenzen', rows: systemReferenceRows },
    { name: 'Risiko_Mapping', rows: riskMappingRows },
    { name: 'Sidecar_Ueberleitungslogik', rows: sidecarRows },
    ...(stromEeg2027Summary?.applicable ? [{ name: 'Strom_EEG2027_Netzanschluss', rows: stromEeg2027Rows }] : []),
    { name: 'Monitoring_Massnahmen', rows: monitoringMeasureRows },
    { name: 'Monitoring_Aggregat', rows: monitoringAggregateRows },
    { name: 'QReg_Netzleistung', rows: qregRows },
    { name: 'Netzausbauplan_14d', rows: napRows },
    { name: 'Provenienz', rows: provenanceRows }
  ];
}

export function csvEscape(value, delimiter = ';') {
  const text = String(clean(value));
  return (text.includes(delimiter) || /["\n\r]/.test(text)) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function tableToCsv(rows, delimiter = ';') {
  return '\ufeff' + rows.map(row => row.map(cell => csvEscape(cell, delimiter)).join(delimiter)).join('\n');
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

function writeUint16(target, value) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(target, value) {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

export function zipStore(files) {
  const encoder = new TextEncoder();
  const local = [];
  const central = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime();
  files.forEach(file => {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = file.content instanceof Uint8Array ? file.content : encoder.encode(String(file.content));
    const crc = crc32(contentBytes);
    const localHeader = [];
    writeUint32(localHeader, 0x04034b50);
    writeUint16(localHeader, 20);
    writeUint16(localHeader, 0x0800);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, dosTime);
    writeUint16(localHeader, dosDate);
    writeUint32(localHeader, crc);
    writeUint32(localHeader, contentBytes.length);
    writeUint32(localHeader, contentBytes.length);
    writeUint16(localHeader, nameBytes.length);
    writeUint16(localHeader, 0);
    local.push(Uint8Array.from(localHeader), nameBytes, contentBytes);

    const centralHeader = [];
    writeUint32(centralHeader, 0x02014b50);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 0x0800);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, dosTime);
    writeUint16(centralHeader, dosDate);
    writeUint32(centralHeader, crc);
    writeUint32(centralHeader, contentBytes.length);
    writeUint32(centralHeader, contentBytes.length);
    writeUint16(centralHeader, nameBytes.length);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint32(centralHeader, 0);
    writeUint32(centralHeader, offset);
    central.push(Uint8Array.from(centralHeader), nameBytes);
    offset += localHeader.length + nameBytes.length + contentBytes.length;
  });
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = [];
  writeUint32(end, 0x06054b50);
  writeUint16(end, 0);
  writeUint16(end, 0);
  writeUint16(end, files.length);
  writeUint16(end, files.length);
  writeUint32(end, centralSize);
  writeUint32(end, offset);
  writeUint16(end, 0);
  const parts = [...local, ...central, Uint8Array.from(end)];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let cursor = 0;
  parts.forEach(part => {
    output.set(part, cursor);
    cursor += part.length;
  });
  return output;
}

function xmlEscape(value) {
  return String(clean(value))
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function columnName(index) {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function textXml(value) {
  return `<t xml:space="preserve">${xmlEscape(value)}</t>`;
}

function sheetXml(rows, sharedStringIds) {
  const maxColumns = Math.max(1, ...rows.map(row => row.length));
  const maxRows = Math.max(1, rows.length);
  const dimensionRef = `A1:${columnName(maxColumns - 1)}${maxRows}`;
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((cell, colIndex) => {
      const ref = `${columnName(colIndex)}${rowIndex + 1}`;
      if (typeof cell === 'number' && Number.isFinite(cell)) return `<c r="${ref}"><v>${cell}</v></c>`;
      const sharedStringId = sharedStringIds.get(String(clean(cell)));
      return `<c r="${ref}" t="s"><v>${sharedStringId}</v></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}" spans="1:${maxColumns}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dimensionRef}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${body}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
}

function collectSharedStrings(sheets) {
  const strings = [];
  const ids = new Map();
  sheets.forEach(sheet => {
    sheet.rows.forEach(row => {
      row.forEach(cell => {
        if (typeof cell === 'number' && Number.isFinite(cell)) return;
        const value = String(clean(cell));
        if (!ids.has(value)) {
          ids.set(value, strings.length);
          strings.push(value);
        }
      });
    });
  });
  return { strings, ids };
}

function sharedStringsXml(strings) {
  const items = strings.map(value => `<si>${textXml(value)}</si>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${items}</sst>`;
}

function safeSheetName(name, index) {
  const cleaned = String(name || `Sheet${index + 1}`).replace(/[\\/?*:[\]]/g, '_').slice(0, 31);
  return cleaned || `Sheet${index + 1}`;
}

export function tablesToXlsx(tables) {
  const sheets = tables.map((sheet, index) => ({ ...sheet, name: safeSheetName(sheet.name, index) }));
  const { strings, ids: sharedStringIds } = collectSharedStrings(sheets);
  const sheetEntries = sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  const relEntries = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  const overrideEntries = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  const stylesRelationshipId = sheets.length + 1;
  const sharedStringsRelationshipId = sheets.length + 2;
  const files = [
    { name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>${overrideEntries}</Types>` },
    { name: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: 'docProps/core.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Szenarienrechner EOG</dc:creator><cp:lastModifiedBy>Szenarienrechner EOG</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified></cp:coreProperties>` },
    { name: 'docProps/app.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Szenarienrechner EOG</Application></Properties>` },
    { name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView/></bookViews><sheets>${sheetEntries}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relEntries}<Relationship Id="rId${stylesRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sharedStringsRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>` },
    { name: 'xl/styles.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"/></styleSheet>` },
    { name: 'xl/sharedStrings.xml', content: sharedStringsXml(strings) }
  ];
  sheets.forEach((sheet, index) => files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, content: sheetXml(sheet.rows, sharedStringIds) }));
  return zipStore(files);
}

export function tablesToCsvZip(tables) {
  return zipStore(tables.map(sheet => ({
    name: `${safeSheetName(sheet.name, 0)}.csv`,
    content: tableToCsv(sheet.rows)
  })));
}
