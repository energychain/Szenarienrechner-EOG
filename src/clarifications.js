import { impactAssumptionsFor } from './engine.js';
import { confidenceLabels, governanceLabels, impactAreaLabels } from './ui-config.js';
import { viabilityClarificationItems } from './viability-classification.js';
import { impactCounts } from './maturity.js';

export function textPresent(value) {
  return Boolean(String(value ?? '').trim());
}

export function weakEvidenceStatus(status = '') {
  return ['missing', 'stated', 'conflicting', 'stale'].includes(String(status || 'missing'));
}

export function impactWorkArea(impact) {
  if (impact.area === 'risk' || impact.area === 'qElement') return 'technik';
  if (impact.area === 'costBase' || impact.area === 'portfolio') return 'vnb';
  return 'controlling';
}

export function workItemColumn(item) {
  if (item.status === 'closed') return 'closed';
  if (['high', 'evidence', 'normal'].includes(item.column)) return item.column;
  const label = item.priority?.label || 'normal';
  if (label === 'hoch') return 'high';
  if (label === 'mittel') return 'evidence';
  return 'normal';
}

export function clarificationKey(item) {
  return item.key;
}

export function clarificationPriorityFor(item = {}) {
  const text = [item.area, item.title, item.detail, item.type].filter(Boolean).join(' ').toLowerCase();
  if (/risiko|risk|q-element|q\/e|eog|rab|aktivier|cashflow|kapitalwert|irr|verzinsung|kanu/.test(text)) {
    return { level: 1, label: 'hoch', driver: 'Rechen-/Steuerungswirkung' };
  }
  if (/quelle|evidenz|system|daten|mapping|sidecar|wirkannahme|doppelzähl/.test(text)) {
    return { level: 2, label: 'mittel', driver: 'Evidenz / Datenqualität' };
  }
  return { level: 3, label: 'normal', driver: 'Dokumentation / Prozess' };
}

export function hasOpenMeasureItem(measure) {
  return impactCounts(measure).review > 0 || String(measure.note || '').trim().length > 0;
}

export function allImpactAssumptions(measures = [], filterActive = false) {
  return measures
    .filter(measure => !filterActive || measure.active)
    .flatMap(measure => impactAssumptionsFor(measure).map(impact => ({ ...impact, measure })));
}

export function reviewRequiredImpacts(measures = [], filterActive = false) {
  return allImpactAssumptions(measures, filterActive)
    .filter(item => item.confidence === 'review' || item.governance === 'sensitivity');
}

export function measureHasSystemReference(measure = {}) {
  return Boolean(String(measure.sourceSystem || '').trim() && (String(measure.sourceRecordId || '').trim() || String(measure.externalId || '').trim()));
}

export function measureHasRiskEvidence(measure = {}) {
  const status = measure.riskEvidenceStatus || measure.riskAvoidedEvidenceStatus || '';
  return ['documented', 'estimated', 'benannt', 'source_available', 'validated'].includes(status) || (measure.impactAssumptions || []).some(impact => impact.area === 'risk' && (impact.evidence || impact.evidenceType !== 'open'));
}

export function measureEvidenceItems(measures = []) {
  const active = measures.filter(measure => measure.active);
  const items = [];
  active.forEach(measure => {
    if (!measureHasSystemReference(measure)) {
      items.push({
        key: `system-reference:${measure.id}`,
        type: 'system_reference',
        measureId: measure.id,
        area: 'Evidenz',
        column: 'evidence',
        targetPhase: 'konsolidierung',
        title: 'Systemreferenz / Rückspielweg ergänzen',
        measure: measure.name,
        detail: 'Quellsystem und Datensatz-/PSP-/Objektreferenz fehlen oder sind nicht vollständig dokumentiert.'
      });
    }
    if (Number(measure.riskAvoided || 0) > 0 && !measureHasRiskEvidence(measure)) {
      items.push({
        key: `risk-evidence:${measure.id}`,
        type: 'risk_evidence',
        measureId: measure.id,
        area: 'Evidenz',
        column: 'evidence',
        targetPhase: 'massnahmenbewertung',
        title: 'Störungs-/Risikowirkung belegen',
        measure: measure.name,
        detail: 'Die Maßnahme trägt einen Risiko-/Störungswert, aber Evidenzstatus, Wirkungskette oder Quelle sind noch nicht belastbar dokumentiert.'
      });
    }
    if (!(measure.objectiveIds || []).length) {
      items.push({
        key: `target-mapping:${measure.id}`,
        type: 'target_mapping',
        measureId: measure.id,
        area: 'Dokumentation',
        column: 'normal',
        targetPhase: 'entscheidungsvorlage',
        title: 'Ziel-Zuordnung dokumentieren',
        measure: measure.name,
        detail: 'Die Maßnahme ist noch keinem Aktenziel zugeordnet; dadurch bleibt der Entscheidungs- und Dokumentationsbezug unklar.'
      });
    }
    if (!textPresent(measure.note)) {
      items.push({
        key: `measure-documentation:${measure.id}`,
        type: 'measure_documentation',
        measureId: measure.id,
        area: 'Dokumentation',
        column: 'normal',
        targetPhase: 'konsolidierung',
        title: 'Maßnahmendokumentation ergänzen',
        measure: measure.name,
        detail: 'Fachliche Maßnahmennotiz fehlt; Anlass, Quelle oder Begründung sollten dokumentiert werden.'
      });
    }
  });
  return items;
}

export function sidecarHasOpenBridgeLogic(object) {
  if (!['effect_assumption', 'economic_bridge'].includes(object.sidecarType)) return false;
  if (object.calculationImpact === 'none') return false;
  const bridge = object.bridgeLogic || {};
  return bridge.economicRelation === 'none' || ['not_applicable', 'open', 'described'].includes(bridge.quantificationStatus);
}

export function sidecarEvidenceLabel(object) {
  const labels = {
    missing: 'Evidenz fehlt',
    stated: 'Evidenz benannt',
    source_available: 'Quelle verfügbar',
    validated: 'validiert',
    conflicting: 'widersprüchlich',
    stale: 'veraltet'
  };
  return labels[object.evidenceStatus] || object.evidenceStatus;
}

export function sidecarClarificationItems(sidecar = {}) {
  return (sidecar.objects || [])
    .filter(object => object.status !== 'archived')
    .map(object => {
      const reasons = [];
      if (object.openQuestions?.length) reasons.push(`${object.openQuestions.length} offene Klärfrage(n)`);
      if (weakEvidenceStatus(object.evidenceStatus)) reasons.push(`Evidenzstatus: ${sidecarEvidenceLabel(object)}`);
      if (object.type === 'data_quality' && object.evidenceStatus !== 'validated') reasons.push('Datenqualitätsobjekt nicht validiert');
      if (sidecarHasOpenBridgeLogic(object)) reasons.push('wirtschaftliche Überleitungslogik offen');
      if (String(object.reviewStatus || '').match(/not_reviewed|needs_update|open|offen/i)) reasons.push('Reviewstatus offen');
      if (!reasons.length) return null;
      return {
        key: `sidecar:${object.id}`,
        type: 'sidecar',
        sidecarId: object.id,
        area: 'Kontextobjekt',
        column: 'evidence',
        targetPhase: 'konsolidierung',
        title: 'Evidenz-/Kontextobjekt-Klärpunkt klären',
        measure: object.title,
        detail: reasons.join(' · ')
      };
    })
    .filter(Boolean);
}

export function viabilityWorkItems(model = {}, params = {}) {
  return viabilityClarificationItems(model, params).map(item => ({
    ...item,
    area: 'Evidenz',
    column: item.priority === 'mittel' ? 'evidence' : 'normal',
    targetPhase: 'konsolidierung'
  }));
}

function impactAreaLabel(area) {
  return impactAreaLabels[area] || 'Wirkung';
}

function impactGovernanceLabel(governance) {
  return governanceLabels[governance] || 'Sensitivität';
}

export function clarificationItems(model = {}, params = {}, result = { warnings: [] }, clarificationStatus = {}) {
  const measures = model.measures || [];
  const impactItems = reviewRequiredImpacts(measures, true).map(item => ({
    key: `impact:${item.measure.id}:${item.id}`,
    type: 'impact',
    measureId: item.measure.id,
    impactId: item.id,
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
      measureId: measure.id,
      area: 'Maßnahme',
      targetPhase: 'konsolidierung',
      title: 'Maßnahmennotiz klären',
      measure: measure.name,
      detail: measure.note
    }));
  const warningItems = (result.warnings || [])
    .filter(warning => warning.type === 'possible_double_counting')
    .map(warning => ({
      key: warning.key,
      type: warning.type,
      measureId: warning.measureId || measures.find(measure => measure.name === warning.measure)?.id || '',
      area: warning.area,
      targetPhase: warning.targetPhase,
      title: warning.title,
      measure: warning.measure,
      detail: warning.detail || 'mögliche Doppelzählung prüfen.'
    }));
  return [...impactItems, ...warningItems, ...noteItems, ...measureEvidenceItems(measures), ...sidecarClarificationItems(model.sidecar), ...viabilityWorkItems(model, params)]
    .map(item => {
      const priority = clarificationPriorityFor(item);
      return {
        ...item,
        priority,
        status: clarificationStatus[clarificationKey(item)]?.status || 'open'
      };
    })
    .sort((a, b) => a.priority.level - b.priority.level || String(a.measure || '').localeCompare(String(b.measure || ''), 'de'));
}

export function expertWorkItems(model = {}, params = {}, result = { warnings: [] }, clarificationStatus = {}) {
  const measures = model.measures || [];
  const impactItems = reviewRequiredImpacts(measures, true).map(item => ({
    key: item.measure.id + ':' + item.id,
    measureId: item.measure.id,
    impactId: item.id,
    title: item.title,
    measure: item.measure.name,
    area: impactWorkArea(item),
    detail: `${impactAreaLabel(item.area)} · ${confidenceLabels[item.confidence]} · ${impactGovernanceLabel(item.governance)}${item.note ? ' · ' + item.note : ''}`,
    priority: clarificationPriorityFor({ area: item.area, title: item.title, detail: item.note, type: 'impact' }),
    status: clarificationStatus[item.measure.id + ':' + item.id]?.status || 'open',
    type: 'impact'
  }));
  const clarificationWork = clarificationItems(model, params, result, clarificationStatus).map(item => ({
    ...item,
    area: item.area === 'Risiko' || item.area === 'Q-Element' ? 'technik' : item.area === 'Portfolio' || item.area === 'Kostenbasis' ? 'vnb' : item.area === 'Evidenz' || item.area === 'Kontextobjekt' ? 'vnb' : 'controlling',
    type: item.type || 'clarification'
  }));
  return [...impactItems, ...clarificationWork];
}

export function findClarificationItem(key, model = {}, params = {}, result = { warnings: [] }, clarificationStatus = {}) {
  return clarificationItems(model, params, result, clarificationStatus).find(item => item.key === key)
    || expertWorkItems(model, params, result, clarificationStatus).find(item => item.key === key)
    || null;
}
