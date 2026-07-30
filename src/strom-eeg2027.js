const regulatoryStatuses = new Set(['current_law', 'cabinet_draft_2026_07_29', 'user_defined']);
const assumptionStatuses = new Set(['confirmed', 'draft', 'user_supplied', 'placeholder']);
const capacityTechnologies = new Set(['pv', 'wind', 'all', 'none']);
const voltageLevels = new Set(['low_voltage', 'medium_voltage', 'high_voltage']);
const connectionStatuses = new Set([
  'draft', 'submitted', 'confirmed_received', 'under_review', 'capacity_reserved',
  'capacity_released', 'connection_offer', 'commissioned'
]);
const riskClasses = new Set(['low', 'medium', 'high']);
const contributionModes = new Set(['none', 'flat', 'regional_parameter', 'user_defined']);

export const stromEeg2027DraftNotice = 'Regelstand: Kabinettsentwurf 29.07.2026, nicht endgültiges geltendes Recht. Parameter sind vor produktiver Nutzung gegen Bundestagsfassung, Verkündung und BNetzA-Festlegungen zu prüfen.';

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function text(value) {
  return String(value ?? '').trim();
}

export function isStromEeg2027Applicable(sector) {
  return String(sector || '') === 'strom';
}

export function normalizeStromEeg2027Assumption(source = {}, sector = 'strom') {
  if (!isStromEeg2027Applicable(sector)) return null;
  const regulatoryStatus = regulatoryStatuses.has(source.regulatoryStatus)
    ? source.regulatoryStatus
    : 'current_law';
  const defaultDate = regulatoryStatus === 'cabinet_draft_2026_07_29' ? '2026-07-29' : '';
  return {
    regulatoryStatus,
    regulatoryStatusLabel: text(source.regulatoryStatusLabel)
      || (regulatoryStatus === 'cabinet_draft_2026_07_29'
        ? 'Kabinettsentwurf EEG 2027 / Netzanschlusspaket'
        : regulatoryStatus === 'user_defined'
          ? 'Nutzerdefinierte Annahme'
          : 'geltender Regelstand'),
    regulatoryStatusDate: text(source.regulatoryStatusDate) || defaultDate,
    assumptionStatus: assumptionStatuses.has(source.assumptionStatus)
      ? source.assumptionStatus
      : regulatoryStatus === 'cabinet_draft_2026_07_29'
        ? 'draft'
        : 'confirmed'
  };
}

export function normalizeStromEeg2027Measure(measure = {}, sector = 'strom') {
  if (!isStromEeg2027Applicable(sector)) return {};
  const assumption = normalizeStromEeg2027Assumption(measure, sector);
  const capacityLimitedTechnology = capacityTechnologies.has(measure.capacityLimitedTechnology)
    ? measure.capacityLimitedTechnology
    : 'none';
  const windPriorityArea = Boolean(measure.windPriorityArea);
  const waiverLimitDefault = windPriorityArea ? 18 : 20;
  const connectionRequestPowerKw = finiteNumber(measure.connectionRequestPowerKw, 0);
  const voltageLevel = voltageLevels.has(measure.voltageLevel) ? measure.voltageLevel : 'low_voltage';
  const connectionRequestStatus = connectionStatuses.has(measure.connectionRequestStatus)
    ? measure.connectionRequestStatus
    : 'draft';
  const contributionEnabled = Boolean(measure.generationConnectionCostContributionEnabled)
    || finiteNumber(measure.connectionCostContributionTeur, 0) > 0;
  return {
    ...assumption,
    capacityLimitedGridArea: Boolean(measure.capacityLimitedGridArea),
    capacityLimitedTechnology,
    redispatchCompensationWaiverEnabled: Boolean(measure.redispatchCompensationWaiverEnabled),
    redispatchCompensationWaiverLimitPct: Math.max(0, finiteNumber(measure.redispatchCompensationWaiverLimitPct, waiverLimitDefault)),
    windPriorityArea,
    redispatchRiskClass: riskClasses.has(measure.redispatchRiskClass) ? measure.redispatchRiskClass : 'low',
    annualRevenueAtRiskTeur: Math.max(0, finiteNumber(measure.annualRevenueAtRiskTeur, 0)),
    connectionRequestPowerKw,
    voltageLevel,
    connectionRequestStatus,
    queueRiskClass: riskClasses.has(measure.queueRiskClass) ? measure.queueRiskClass : 'low',
    reservationExpiryDate: text(measure.reservationExpiryDate),
    nextRequiredEvidence: text(measure.nextRequiredEvidence),
    generationConnectionCostContributionEnabled: contributionEnabled,
    connectionCostContributionTeur: contributionEnabled ? Math.max(0, finiteNumber(measure.connectionCostContributionTeur, 0)) : 0,
    connectionCostContributionMode: contributionModes.has(measure.connectionCostContributionMode)
      ? measure.connectionCostContributionMode
      : contributionEnabled
        ? 'user_defined'
        : 'none'
  };
}

export function stromEffectiveMeasureFor(measure = {}, sector = 'strom') {
  if (!isStromEeg2027Applicable(sector)) return measure;
  const extension = normalizeStromEeg2027Measure(measure, sector);
  return {
    ...measure,
    cost: finiteNumber(measure.cost) + extension.connectionCostContributionTeur,
    riskAvoided: finiteNumber(measure.riskAvoided) + extension.annualRevenueAtRiskTeur,
    stromEeg2027: extension
  };
}

export function stromEeg2027WarningsFor(measure = {}, sector = 'strom', baseYear = new Date().getFullYear()) {
  if (!isStromEeg2027Applicable(sector)) return [];
  const extension = normalizeStromEeg2027Measure(measure, sector);
  const warnings = [];
  const measureName = measure.name || 'Strom-Maßnahme';
  const measureId = measure.id || '';
  if (extension.regulatoryStatus === 'cabinet_draft_2026_07_29' || extension.assumptionStatus === 'draft') {
    warnings.push({
      type: 'strom_eeg2027_draft_assumption_review',
      key: `strom-eeg2027-draft:${measureId || measureName}`,
      area: 'EEG 2027 / Netzanschluss (Entwurfsstand)',
      targetPhase: 'massnahmenbewertung',
      measureId,
      measure: measureName,
      title: 'Entwurfsannahme prüfen',
      detail: stromEeg2027DraftNotice
    });
  }
  if (extension.capacityLimitedGridArea || extension.redispatchCompensationWaiverEnabled || extension.annualRevenueAtRiskTeur > 0) {
    warnings.push({
      type: 'strom_capacity_limited_redispatch_review',
      key: `strom-capacity-redispatch:${measureId || measureName}`,
      area: 'Evidenz / Systeme',
      targetPhase: 'massnahmenbewertung',
      measureId,
      measure: measureName,
      title: 'Kapazitätslimitiertes Gebiet / Redispatch-Verzicht prüfen',
      detail: `Risikoklasse ${extension.redispatchRiskClass}; Erlösrisiko ${extension.annualRevenueAtRiskTeur} TEUR p.a.; Verzichtsgrenze ${extension.redispatchCompensationWaiverLimitPct} %. Entwurfsstand / Vertrag prüfen.`
    });
  }
  if (extension.connectionRequestPowerKw > 135 && !extension.nextRequiredEvidence) {
    warnings.push({
      type: 'strom_connection_evidence_missing',
      key: `strom-connection-evidence:${measureId || measureName}`,
      area: 'Evidenz / Systeme',
      targetPhase: 'datenerhebung',
      measureId,
      measure: measureName,
      title: 'Netzanschluss-Nachweis ab 135 kW offen',
      detail: `Anschlussleistung ${extension.connectionRequestPowerKw} kW, Spannungsebene ${extension.voltageLevel}, Status ${extension.connectionRequestStatus}; nächster erforderlicher Nachweis fehlt.`
    });
  }
  if (extension.reservationExpiryDate) {
    const expiry = Date.parse(extension.reservationExpiryDate);
    const horizon = Date.UTC(Number(baseYear) || new Date().getFullYear(), 11, 31);
    if (Number.isFinite(expiry) && expiry <= horizon) {
      warnings.push({
        type: 'strom_connection_reservation_expiry_review',
        key: `strom-connection-reservation:${measureId || measureName}`,
        area: 'Evidenz / Systeme',
        targetPhase: 'konsolidierung',
        measureId,
        measure: measureName,
        title: 'Reservierungsfrist prüfen',
        detail: `Reservierung läuft am ${extension.reservationExpiryDate} ab; Anschlussstatus und Nachweise vor nächster Befassung klären.`
      });
    }
  }
  if (extension.generationConnectionCostContributionEnabled || extension.connectionCostContributionTeur > 0) {
    warnings.push({
      type: 'strom_connection_cost_contribution_draft',
      key: `strom-connection-cost:${measureId || measureName}`,
      area: 'EEG 2027 / Netzanschluss (Entwurfsstand)',
      targetPhase: 'massnahmenbewertung',
      measureId,
      measure: measureName,
      title: 'Baukostenzuschuss Erzeugungsanlage prüfen',
      detail: `Zusatz-CAPEX ${extension.connectionCostContributionTeur} TEUR; Modus ${extension.connectionCostContributionMode}; nicht final festgelegt.`
    });
  }
  return warnings;
}

export function stromEeg2027PortfolioSummary(model = {}, sector = 'strom') {
  if (!isStromEeg2027Applicable(sector)) return null;
  const measures = Array.isArray(model?.measures) ? model.measures : [];
  const extensions = measures.map(measure => ({ measure, extension: normalizeStromEeg2027Measure(measure, sector) }));
  const relevant = extensions.filter(({ extension }) => extension.regulatoryStatus === 'cabinet_draft_2026_07_29'
    || extension.assumptionStatus !== 'confirmed'
    || extension.capacityLimitedGridArea
    || extension.redispatchCompensationWaiverEnabled
    || extension.annualRevenueAtRiskTeur > 0
    || extension.connectionRequestPowerKw > 0
    || extension.connectionCostContributionTeur > 0);
  return {
    applicable: true,
    notice: stromEeg2027DraftNotice,
    regulatoryStatus: relevant[0]?.extension.regulatoryStatus || normalizeStromEeg2027Assumption(model?.inputs || {}, sector).regulatoryStatus,
    regulatoryStatusDate: relevant[0]?.extension.regulatoryStatusDate || '2026-07-29',
    draftAssumptions: relevant.filter(({ extension }) => extension.assumptionStatus === 'draft').length,
    userSuppliedAssumptions: relevant.filter(({ extension }) => extension.assumptionStatus === 'user_supplied' || extension.regulatoryStatus === 'user_defined').length,
    capacityLimitedMeasures: relevant.filter(({ extension }) => extension.capacityLimitedGridArea).length,
    connection135KwMeasures: relevant.filter(({ extension }) => extension.connectionRequestPowerKw > 135).length,
    annualRevenueAtRiskTeur: relevant.reduce((sum, { extension }) => sum + extension.annualRevenueAtRiskTeur, 0),
    connectionCostContributionTeur: relevant.reduce((sum, { extension }) => sum + extension.connectionCostContributionTeur, 0),
    measures: relevant.slice(0, 20).map(({ measure, extension }) => ({
      id: measure.id || '',
      name: measure.name || '',
      ...extension
    }))
  };
}
