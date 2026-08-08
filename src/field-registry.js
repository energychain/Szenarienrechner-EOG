// Field descriptor registry for the "digitale Akte" second UI (UX_AKTE_REDESIGN
// spec, Abschnitt 5.1). Extends ui-config.js with per-field metadata: which
// Satzblock a field belongs to, how it reads as flowing text, its type/options,
// its Vorbelegung, and (where relevant) which Engine-Herleitungshelfer or
// Evidenzfeld it is tied to.
//
// This module is data, not behaviour: it does not read the model, does not
// touch the DOM, and has no side effects. Consumers (old or new UI) pass a
// concrete value in to interpolate `sentence`.
//
// Object types and their field-key namespaces do not overlap 1:1 (e.g. `id`,
// `type` and `note` exist in more than one object type with different
// meanings), so descriptors are namespaced per object type rather than kept
// in one flat dictionary.
//
// Sentence templates are first drafts (see Spezifikation Abschnitt 11.1):
// fachliche Freigabe steht noch aus. Wording, not structure, is provisional.

function field(overrides) {
  return {
    key: '',
    group: '',
    order: 0,
    label: '',
    unit: '',
    type: 'text',
    options: null,
    sentence: '',
    default: undefined,
    appliesWhen: null,
    helper: null,
    evidenceKey: null,
    clarificationOn: null,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Maßnahme (measure)
// ---------------------------------------------------------------------------

const isGas = measure => measure?.sector ? measure.sector === 'gas' : true;
const isStrom = measure => measure?.sector === 'strom';

export const measureFields = [
  // Identität (immer offen)
  field({ key: 'id', group: 'identitaet', order: 0, label: 'ID', type: 'text', sentence: 'trägt die interne Kennung {v}' }),
  field({ key: 'name', group: 'identitaet', order: 10, label: 'Bezeichnung', type: 'text', sentence: '{v}', clarificationOn: v => !String(v || '').trim() }),
  field({ key: 'externalId', group: 'identitaet', order: 20, label: 'Externe ID / PSP', type: 'text', sentence: 'mit der externen Referenz {v}', evidenceKey: 'sourceStatus' }),
  field({ key: 'orgUnit', group: 'identitaet', order: 30, label: 'Bereich / OE', type: 'text', sentence: 'im Bereich {v}' }),
  field({ key: 'type', group: 'identitaet', order: 40, label: 'Typ', type: 'select', options: ['wahl', 'noRegret', 'risiko'], default: 'wahl', sentence: 'ist als {v} klassifiziert' }),
  field({ key: 'tags', group: 'identitaet', order: 50, label: 'Tags', type: 'text', default: [], sentence: 'mit den Schlagworten {v}' }),
  field({ key: 'active', group: 'identitaet', order: 60, label: 'aktiv', type: 'bool', default: true, sentence: 'ist {v}' }),
  field({ key: 'objectiveIds', group: 'identitaet', order: 70, label: 'Trägt bei zu', type: 'text', default: [], sentence: 'trägt bei zu {v}', clarificationOn: v => !Array.isArray(v) || v.length === 0 }),
  field({ key: 'templateId', group: 'identitaet', order: 80, label: 'Vorlage', type: 'text', sentence: 'aus Vorlage {v} angelegt' }),
  field({ key: 'templateVersion', group: 'identitaet', order: 90, label: 'Vorlagenversion', type: 'text', sentence: 'Vorlagenstand {v}' }),
  field({ key: 'importStatus', group: 'identitaet', order: 100, label: 'Importstatus', type: 'text', sentence: 'Importstatus: {v}' }),

  // Investition & Aktivierung (immer offen)
  field({ key: 'cost', group: 'investitionAktivierung', order: 10, label: 'Kosten', unit: 'TEUR', type: 'teur', sentence: 'kostet {v} TEUR', helper: 'activationSplitHelper' }),
  field({ key: 'year', group: 'investitionAktivierung', order: 20, label: 'Inbetriebnahmejahr', type: 'year', sentence: 'geht {v} in Betrieb' }),
  field({ key: 'secure', group: 'investitionAktivierung', order: 30, label: 'sicher aktivierbar', unit: '%', type: 'percent', default: 70, sentence: 'wird zu {v} % sicher aktiviert', helper: 'activationSplitHelper', clarificationOn: () => false }),
  field({ key: 'uncertain', group: 'investitionAktivierung', order: 40, label: 'unsicher aktivierbar', unit: '%', type: 'percent', default: 30, sentence: '{v} % gelten als unsicher aktivierbar', helper: 'activationSplitHelper' }),
  field({ key: 'probability', group: 'investitionAktivierung', order: 50, label: 'Wahrscheinlichkeit', unit: '%', type: 'percent', default: 50, sentence: 'mit einer Eintrittswahrscheinlichkeit von {v} %', helper: 'riskHelper' }),
  field({ key: 'opexRecognition', group: 'investitionAktivierung', order: 60, label: 'OPEX-Anerkennung', unit: '%', type: 'percent', default: 70, sentence: 'OPEX-Anerkennung {v} %' }),
  field({ key: 'life', group: 'investitionAktivierung', order: 70, label: 'Nutzungsdauer', unit: 'Jahre', type: 'number', default: 40, sentence: 'wird über {v} Jahre abgeschrieben', helper: 'depreciationLifeHelper' }),
  field({ key: 'hgbLife', group: 'investitionAktivierung', order: 80, label: 'HGB-Nutzungsdauer', unit: 'Jahre', type: 'number', sentence: 'HGB-Nutzungsdauer {v} Jahre', helper: 'depreciationLifeHelper' }),
  field({ key: 'depr', group: 'investitionAktivierung', order: 90, label: 'Abschreibungsmodus', type: 'select', options: ['normal', 'kanuLinear', 'kanuDegressive'], sentence: 'Abschreibung: {v}', helper: 'depreciationLifeHelper' }),
  field({ key: 'effectType', group: 'investitionAktivierung', order: 100, label: 'Wirkungstyp', type: 'select', options: ['classic', 'flexibility'], default: 'classic', sentence: 'Wirkungstyp {v}' }),

  // Wirkung (immer offen)
  field({ key: 'qDirect', group: 'wirkung', order: 10, label: 'Q-Wirkung direkt', unit: 'TEUR', type: 'teur', default: 0, sentence: 'wirkt mit {v} TEUR direkt auf Q', helper: 'qImpactHelper' }),
  field({ key: 'eDirect', group: 'wirkung', order: 20, label: 'E-Wirkung direkt', unit: 'TEUR', type: 'teur', default: 0, sentence: 'wirkt mit {v} TEUR direkt auf E', helper: 'qImpactHelper' }),
  field({ key: 'riskAvoided', group: 'wirkung', order: 30, label: 'Risikowert (vermieden)', unit: 'TEUR', type: 'teur', default: 0, sentence: 'vermeidet Risikokosten von {v} TEUR', helper: 'riskHelper', evidenceKey: 'riskEvidenceStatus' }),
  field({ key: 'portfolioShare', group: 'wirkung', order: 40, label: 'Portfolioanteil', unit: '%', type: 'percent', default: 0, sentence: 'trägt {v} % der globalen Portfolio-Wirkung' }),
  field({ key: 'impactAssumptions', group: 'wirkung', order: 50, label: 'Wirkannahmen', type: 'list', default: [], sentence: '{v} Wirkannahme(n) hinterlegt' }),

  // Lebenszyklus
  field({ key: 'opexPa', group: 'lebenszyklus', order: 10, label: 'OPEX p.a.', unit: 'TEUR', type: 'teur', default: 0, sentence: 'verursacht laufend {v} TEUR OPEX p.a.' }),
  field({ key: 'opexDeltaPa', group: 'lebenszyklus', order: 20, label: 'OPEX-Delta p.a.', unit: 'TEUR', type: 'teur', default: 0, sentence: 'verändert OPEX um {v} TEUR p.a.' }),
  field({ key: 'reinvestCost', group: 'lebenszyklus', order: 30, label: 'Re-Investition', unit: 'TEUR', type: 'teur', default: 0, sentence: 'plant eine Re-Investition von {v} TEUR' }),
  field({ key: 'reinvestMode', group: 'lebenszyklus', order: 40, label: 'Re-Investitionsmodus', type: 'select', options: ['oneOff', 'assetAddition'], default: 'oneOff', sentence: 'Re-Investition als {v}' }),
  field({ key: 'reinvestLife', group: 'lebenszyklus', order: 50, label: 'Nutzungsdauer Re-Investition', unit: 'Jahre', type: 'number', sentence: 'Re-Investition über {v} Jahre' }),
  field({ key: 'decommissionCost', group: 'lebenszyklus', order: 60, label: 'Stilllegungs-/Rückbaukosten', unit: 'TEUR', type: 'teur', default: 0, sentence: 'Stilllegung/Rückbau kostet {v} TEUR' }),
  field({ key: 'decommissionYear', group: 'lebenszyklus', order: 70, label: 'Stilllegungsjahr', type: 'year', sentence: 'Stilllegung im Jahr {v}' }),

  // Gas-Transformationspfad (nur Gas)
  field({ key: 'gasTransformationPath', group: 'gasTransformationspfad', order: 10, label: 'Transformationspfad', type: 'select', options: ['unclear', 'continueOperation', 'shutdownOnly', 'physicalDismantling', 'reinvestment', 'h2Option', 'tolerateInGround'], default: 'unclear', appliesWhen: isGas, sentence: 'folgt dem Transformationspfad {v}', helper: 'gasTransformationHelper', clarificationOn: v => !v || v === 'unclear' }),
  field({ key: 'gasAssetScope', group: 'gasTransformationspfad', order: 20, label: 'Asset-Geltungsbereich', type: 'select', options: ['unclear', 'distributionLine', 'connectionLine', 'station', 'h2Candidate', 'other'], default: 'unclear', appliesWhen: isGas, sentence: 'betrifft den Asset-Geltungsbereich {v}', helper: 'gasTransformationHelper' }),
  field({ key: 'gasObligationBasis', group: 'gasTransformationspfad', order: 30, label: 'Verpflichtungsgrundlage', type: 'select', options: ['unclear', 'legalOrContractual', 'concession', 'customerContract', 'noneKnown'], default: 'unclear', appliesWhen: isGas, sentence: 'stützt sich auf die Verpflichtungsgrundlage {v}', helper: 'gasTransformationHelper' }),
  field({ key: 'gasEternityAssumption', group: 'gasTransformationspfad', order: 40, label: 'Ewigkeitsvermutung', type: 'select', options: ['unclear', 'removed', 'continued'], default: 'unclear', appliesWhen: isGas, sentence: 'Ewigkeitsvermutung: {v}', helper: 'gasTransformationHelper', clarificationOn: v => !v || v === 'unclear' }),
  field({ key: 'gasProvisionAssessment', group: 'gasTransformationspfad', order: 50, label: 'Rückstellungsprüfung', type: 'select', options: ['unclear', 'checkProvision', 'notConcrete', 'notApplicable'], default: 'unclear', appliesWhen: isGas, sentence: 'Rückstellungsprüfung: {v}', helper: 'gasTransformationHelper' }),
  field({ key: 'gasRegulatoryTreatment', group: 'gasTransformationspfad', order: 60, label: 'Regulatorische Behandlung', type: 'select', options: ['unclear', 'kanuOrActualCostReview', 'costPathReview', 'h2ExceptionReview', 'notModeled'], default: 'unclear', appliesWhen: isGas, sentence: 'regulatorisch behandelt als {v}', helper: 'gasTransformationHelper' }),
  field({ key: 'gasTransformationEvidence', group: 'gasTransformationspfad', order: 70, label: 'Beleg Transformationspfad', type: 'text', appliesWhen: isGas, sentence: 'Beleg: {v}', clarificationOn: v => !String(v || '').trim() }),

  // Flexibilität / Netzfahrplan (nur Strom)
  field({ key: 'flexibilityUseCase', group: 'flexibilitaetNetzfahrplan', order: 10, label: 'Anwendungsfall', type: 'select', options: ['netzfahrplan', 'capexAvoidance', 'storage', 'controllableLoad', 'other'], default: 'netzfahrplan', appliesWhen: isStrom, sentence: 'Anwendungsfall {v}', helper: 'flexibilityHelper' }),
  field({ key: 'flexibilityStatus', group: 'flexibilitaetNetzfahrplan', order: 20, label: 'Status', type: 'select', options: ['context', 'pruefpflichtig', 'quantified', 'active'], default: 'context', appliesWhen: isStrom, sentence: 'Flexibilitätsstatus {v}', helper: 'flexibilityHelper', clarificationOn: v => v === 'context' || v === 'pruefpflichtig' }),
  field({ key: 'regulatoryTreatment', group: 'flexibilitaetNetzfahrplan', order: 30, label: 'Regulatorische Behandlung', type: 'select', options: ['unknown', 'capex_avoidance', 'opex_recognition', 'mixed', 'not_applicable'], default: 'unknown', appliesWhen: isStrom, sentence: 'regulatorisch behandelt als {v}' }),
  field({ key: 'networkScheduleRequired', group: 'flexibilitaetNetzfahrplan', order: 40, label: 'Netzfahrplan erforderlich', type: 'bool', default: true, appliesWhen: isStrom, sentence: 'benötigt einen Netzfahrplan: {v}' }),
  field({ key: 'networkScheduleStatus', group: 'flexibilitaetNetzfahrplan', order: 50, label: 'Netzfahrplan-Status', type: 'select', options: ['missing', 'draft', 'validated'], default: 'missing', appliesWhen: isStrom, sentence: 'Netzfahrplan-Status {v}', clarificationOn: v => v === 'missing' }),
  field({ key: 'networkConstraintRef', group: 'flexibilitaetNetzfahrplan', order: 60, label: 'Netzrestriktion / Referenz', type: 'text', appliesWhen: isStrom, sentence: 'Netzrestriktion {v}' }),
  field({ key: 'affectedNetworkLevel', group: 'flexibilitaetNetzfahrplan', order: 70, label: 'Betroffene Netzebene', type: 'select', options: ['', 'NS', 'MS', 'UW', 'cross_level'], appliesWhen: isStrom, sentence: 'betrifft Netzebene {v}' }),
  field({ key: 'activationWindow', group: 'flexibilitaetNetzfahrplan', order: 80, label: 'Aktivierungsfenster', type: 'text', appliesWhen: isStrom, sentence: 'Aktivierungsfenster {v}' }),
  field({ key: 'dispatchLogic', group: 'flexibilitaetNetzfahrplan', order: 90, label: 'Abrufsystematik', type: 'text', appliesWhen: isStrom, sentence: 'Abrufsystematik {v}' }),
  field({ key: 'avoidedCapexTeur', group: 'flexibilitaetNetzfahrplan', order: 100, label: 'Vermiedenes CAPEX', unit: 'TEUR', type: 'teur', default: 0, appliesWhen: isStrom, sentence: 'vermeidet CAPEX von {v} TEUR', evidenceKey: 'avoidedCapexConfidence' }),
  field({ key: 'avoidedCapexConfidence', group: 'flexibilitaetNetzfahrplan', order: 110, label: 'Konfidenz vermiedenes CAPEX', type: 'select', options: ['none', 'low', 'medium', 'high'], default: 'none', appliesWhen: isStrom, sentence: 'Konfidenz {v}', clarificationOn: v => !v || v === 'none' }),
  field({ key: 'deferredCapexTeur', group: 'flexibilitaetNetzfahrplan', order: 120, label: 'Verschobenes CAPEX', unit: 'TEUR', type: 'teur', default: 0, appliesWhen: isStrom, sentence: 'verschiebt CAPEX von {v} TEUR' }),
  field({ key: 'deferredCapexFromYear', group: 'flexibilitaetNetzfahrplan', order: 130, label: 'Verschiebung ab Jahr', type: 'year', appliesWhen: isStrom, sentence: 'ab {v}' }),
  field({ key: 'deferredCapexToYear', group: 'flexibilitaetNetzfahrplan', order: 140, label: 'Verschiebung bis Jahr', type: 'year', appliesWhen: isStrom, sentence: 'bis {v}' }),
  field({ key: 'capexAvoidanceEvidenceRef', group: 'flexibilitaetNetzfahrplan', order: 150, label: 'Beleg CAPEX-Vermeidung', type: 'text', appliesWhen: isStrom, sentence: 'Beleg {v}', evidenceKey: 'capexAvoidanceEvidenceRef' }),
  field({ key: 'flexOpexPaTeur', group: 'flexibilitaetNetzfahrplan', order: 160, label: 'Flex-OPEX p.a.', unit: 'TEUR', type: 'teur', default: 0, appliesWhen: isStrom, sentence: 'verursacht {v} TEUR Flex-OPEX p.a.' }),
  field({ key: 'flexOpexStartYear', group: 'flexibilitaetNetzfahrplan', order: 170, label: 'Flex-OPEX ab Jahr', type: 'year', appliesWhen: isStrom, sentence: 'ab {v}' }),
  field({ key: 'flexOpexDurationYears', group: 'flexibilitaetNetzfahrplan', order: 180, label: 'Flex-OPEX Dauer', unit: 'Jahre', type: 'number', appliesWhen: isStrom, sentence: 'über {v} Jahre' }),
  field({ key: 'opexRecognitionStatus', group: 'flexibilitaetNetzfahrplan', order: 190, label: 'OPEX-Anerkennungsstatus', type: 'select', options: ['unknown', 'pruefpflichtig', 'expected', 'not_recognized'], default: 'unknown', appliesWhen: isStrom, sentence: 'OPEX-Anerkennungsstatus {v}', clarificationOn: v => !v || v === 'unknown' }),
  field({ key: 'opexEvidenceRef', group: 'flexibilitaetNetzfahrplan', order: 200, label: 'Beleg OPEX', type: 'text', appliesWhen: isStrom, sentence: 'Beleg {v}' }),
  field({ key: 'agnesRelevant', group: 'flexibilitaetNetzfahrplan', order: 210, label: 'AGNeS-relevant', type: 'bool', default: false, appliesWhen: isStrom, sentence: 'ist AGNeS-relevant: {v}' }),
  field({ key: 'agnesRole', group: 'flexibilitaetNetzfahrplan', order: 220, label: 'AGNeS-Rolle', type: 'select', options: ['offen', 'Steuerung', 'Abruf', 'Prognose', 'Netzfahrplan', 'Nachweis'], default: 'offen', appliesWhen: measure => isStrom(measure) && measure?.agnesRelevant, sentence: 'AGNeS-Rolle {v}', clarificationOn: v => !v || v === 'offen' }),
  field({ key: 'agnesIntegrationStatus', group: 'flexibilitaetNetzfahrplan', order: 230, label: 'AGNeS-Integrationsstatus', type: 'select', options: ['not_assessed', 'required', 'available', 'unavailable', 'not_applicable'], default: 'not_assessed', appliesWhen: measure => isStrom(measure) && measure?.agnesRelevant, sentence: 'Integrationsstatus {v}' }),
  field({ key: 'agnesDataNeeded', group: 'flexibilitaetNetzfahrplan', order: 240, label: 'Benötigte AGNeS-Daten', type: 'text', default: [], appliesWhen: measure => isStrom(measure) && measure?.agnesRelevant, sentence: 'benötigt Daten: {v}' }),
  field({ key: 'flexibilityNeed', group: 'flexibilitaetNetzfahrplan', order: 250, label: 'Flexibilitäts-/SDL-Bedarf', type: 'text', appliesWhen: isStrom, sentence: 'Flexibilitäts-/SDL-Bedarf: {v}' }),

  // EEG 2027 / Netzanschluss (nur Strom, Entwurfsstand)
  field({ key: 'regulatoryStatus', group: 'eeg2027Netzanschluss', order: 10, label: 'Regelstand', type: 'select', options: ['current_law', 'cabinet_draft_2026_07_29', 'user_defined'], default: 'current_law', appliesWhen: isStrom, sentence: 'Regelstand {v}', clarificationOn: v => v === 'cabinet_draft_2026_07_29' }),
  field({ key: 'regulatoryStatusLabel', group: 'eeg2027Netzanschluss', order: 20, label: 'Regelstand-Bezeichnung', type: 'text', appliesWhen: isStrom, sentence: '{v}' }),
  field({ key: 'regulatoryStatusDate', group: 'eeg2027Netzanschluss', order: 30, label: 'Regelstand-Datum', type: 'text', appliesWhen: isStrom, sentence: 'Stand {v}' }),
  field({ key: 'assumptionStatus', group: 'eeg2027Netzanschluss', order: 40, label: 'Annahmestatus', type: 'select', options: ['confirmed', 'draft', 'user_supplied', 'placeholder'], default: 'confirmed', appliesWhen: isStrom, sentence: 'Annahmestatus {v}', clarificationOn: v => v === 'draft' || v === 'placeholder' }),
  field({ key: 'capacityLimitedGridArea', group: 'eeg2027Netzanschluss', order: 50, label: 'Kapazitätslimitiertes Netzgebiet', type: 'bool', default: false, appliesWhen: isStrom, sentence: 'liegt in einem kapazitätslimitierten Netzgebiet: {v}' }),
  field({ key: 'capacityLimitedTechnology', group: 'eeg2027Netzanschluss', order: 60, label: 'Betroffene Technologie', type: 'select', options: ['none', 'pv', 'wind', 'all'], default: 'none', appliesWhen: measure => isStrom(measure) && measure?.capacityLimitedGridArea, sentence: 'betroffene Technologie {v}' }),
  field({ key: 'redispatchCompensationWaiverEnabled', group: 'eeg2027Netzanschluss', order: 70, label: 'Redispatch-Entschädigungsverzicht', type: 'bool', default: false, appliesWhen: isStrom, sentence: 'Entschädigungsverzicht: {v}' }),
  field({ key: 'redispatchCompensationWaiverLimitPct', group: 'eeg2027Netzanschluss', order: 80, label: 'Verzichtsgrenze', unit: '%', type: 'percent', default: 20, appliesWhen: measure => isStrom(measure) && measure?.redispatchCompensationWaiverEnabled, sentence: 'Verzichtsgrenze {v} %' }),
  field({ key: 'windPriorityArea', group: 'eeg2027Netzanschluss', order: 90, label: 'Windvorranggebiet', type: 'bool', default: false, appliesWhen: isStrom, sentence: 'liegt im Windvorranggebiet: {v}' }),
  field({ key: 'redispatchRiskClass', group: 'eeg2027Netzanschluss', order: 100, label: 'Redispatch-Risikoklasse', type: 'select', options: ['low', 'medium', 'high'], default: 'low', appliesWhen: isStrom, sentence: 'Redispatch-Risikoklasse {v}', clarificationOn: v => v === 'high' }),
  field({ key: 'annualRevenueAtRiskTeur', group: 'eeg2027Netzanschluss', order: 110, label: 'Erlösrisiko p.a.', unit: 'TEUR', type: 'teur', default: 0, appliesWhen: isStrom, sentence: 'Erlösrisiko {v} TEUR p.a.' }),
  field({ key: 'connectionRequestPowerKw', group: 'eeg2027Netzanschluss', order: 120, label: 'Anschlussleistung', unit: 'kW', type: 'number', default: 0, appliesWhen: isStrom, sentence: 'Anschlussleistung {v} kW' }),
  field({ key: 'voltageLevel', group: 'eeg2027Netzanschluss', order: 130, label: 'Spannungsebene', type: 'select', options: ['low_voltage', 'medium_voltage', 'high_voltage'], default: 'low_voltage', appliesWhen: isStrom, sentence: 'Spannungsebene {v}' }),
  field({ key: 'connectionRequestStatus', group: 'eeg2027Netzanschluss', order: 140, label: 'Anschlussanfragestatus', type: 'select', options: ['draft', 'submitted', 'confirmed_received', 'under_review', 'capacity_reserved', 'capacity_released', 'connection_offer', 'commissioned'], default: 'draft', appliesWhen: isStrom, sentence: 'Anschlussstatus {v}' }),
  field({ key: 'queueRiskClass', group: 'eeg2027Netzanschluss', order: 150, label: 'Warteschlangen-Risikoklasse', type: 'select', options: ['low', 'medium', 'high'], default: 'low', appliesWhen: isStrom, sentence: 'Warteschlangen-Risikoklasse {v}' }),
  field({ key: 'reservationExpiryDate', group: 'eeg2027Netzanschluss', order: 160, label: 'Reservierung läuft ab', type: 'text', appliesWhen: isStrom, sentence: 'Reservierung läuft ab am {v}', clarificationOn: v => Boolean(v) }),
  field({ key: 'nextRequiredEvidence', group: 'eeg2027Netzanschluss', order: 170, label: 'Nächster erforderlicher Nachweis', type: 'text', appliesWhen: measure => isStrom(measure) && Number(measure?.connectionRequestPowerKw) > 135, sentence: 'nächster Nachweis: {v}', clarificationOn: v => !String(v || '').trim() }),
  field({ key: 'generationConnectionCostContributionEnabled', group: 'eeg2027Netzanschluss', order: 180, label: 'Baukostenzuschuss aktiv', type: 'bool', default: false, appliesWhen: isStrom, sentence: 'Baukostenzuschuss aktiv: {v}' }),
  field({ key: 'connectionCostContributionTeur', group: 'eeg2027Netzanschluss', order: 190, label: 'Baukostenzuschuss', unit: 'TEUR', type: 'teur', default: 0, appliesWhen: measure => isStrom(measure) && measure?.generationConnectionCostContributionEnabled, sentence: 'Baukostenzuschuss {v} TEUR' }),
  field({ key: 'connectionCostContributionMode', group: 'eeg2027Netzanschluss', order: 200, label: 'Baukostenzuschuss-Modus', type: 'select', options: ['none', 'flat', 'regional_parameter', 'user_defined'], default: 'none', appliesWhen: measure => isStrom(measure) && measure?.generationConnectionCostContributionEnabled, sentence: 'Modus {v}' }),

  // Monitoring / §14d
  field({ key: 'monitoringProfile', group: 'monitoring14d', order: 10, label: 'Monitoring-Profil', type: 'select', options: ['none', 'monitoring', 'qreg', 'nap14d'], default: 'none', sentence: 'Monitoring-Profil {v}' }),
  field({ key: 'monitoringCategory', group: 'monitoring14d', order: 20, label: 'Monitoring-/§14d-Kategorie', type: 'text', appliesWhen: measure => measure?.monitoringProfile && measure.monitoringProfile !== 'none', sentence: 'Kategorie {v}' }),
  field({ key: 'networkLevel', group: 'monitoring14d', order: 30, label: 'Netzebene / Druckstufe', type: 'text', sentence: 'Netzebene {v}' }),
  field({ key: 'reportingRegion', group: 'monitoring14d', order: 40, label: 'Region / Netzgebiet', type: 'text', sentence: 'Region {v}' }),
  field({ key: 'reportingStatus', group: 'monitoring14d', order: 50, label: 'Status Reporting', type: 'text', sentence: 'Reporting-Status {v}' }),
  field({ key: 'capacityImpact', group: 'monitoring14d', order: 60, label: 'Kapazitätswirkung', type: 'text', sentence: 'Kapazitätswirkung: {v}' }),
  field({ key: 'bottleneckRef', group: 'monitoring14d', order: 70, label: 'Engpass / Abschnitt', type: 'text', sentence: 'betrifft Engpass {v}' }),
  field({ key: 'permitRequired', group: 'monitoring14d', order: 80, label: 'Genehmigung erforderlich', type: 'select', options: ['unknown', 'yes', 'no'], default: 'unknown', sentence: 'Genehmigung erforderlich: {v}', clarificationOn: v => !v || v === 'unknown' }),
  field({ key: 'permitStatus', group: 'monitoring14d', order: 90, label: 'Genehmigungsstand', type: 'text', appliesWhen: measure => measure?.permitRequired === 'yes', sentence: 'Genehmigungsstand {v}' }),
  field({ key: 'investmentDecisionStatus', group: 'monitoring14d', order: 100, label: 'Investitionsentscheidung', type: 'select', options: ['unknown', 'planned', 'decided', 'deferred'], default: 'unknown', sentence: 'Investitionsentscheidung {v}', clarificationOn: v => !v || v === 'unknown' }),
  field({ key: 'investmentDecisionDate', group: 'monitoring14d', order: 110, label: 'Entscheidungsdatum', type: 'text', appliesWhen: measure => measure?.investmentDecisionStatus === 'decided', sentence: 'Entscheidungsdatum {v}' }),
  field({ key: 'alternativesChecked', group: 'monitoring14d', order: 120, label: 'Alternativenprüfung', type: 'text', sentence: 'Alternativenprüfung: {v}' }),

  // Herkunft & Evidenz
  field({ key: 'sourceSystem', group: 'herkunftEvidenz', order: 10, label: 'Quellsystem', type: 'text', sentence: 'Quellsystem {v}', evidenceKey: 'sourceStatus' }),
  field({ key: 'sourceRecordId', group: 'herkunftEvidenz', order: 20, label: 'Quell-Datensatz', type: 'text', sentence: 'Datensatz {v}', evidenceKey: 'sourceStatus' }),
  field({ key: 'scoringRef', group: 'herkunftEvidenz', order: 30, label: 'Scoring-Referenz', type: 'text', sentence: 'Scoring-Referenz {v}' }),
  field({ key: 'assetSystemRef', group: 'herkunftEvidenz', order: 40, label: 'Asset-System-Referenz', type: 'text', sentence: 'Asset-System-Referenz {v}' }),
  field({ key: 'erpRef', group: 'herkunftEvidenz', order: 50, label: 'ERP-/Anlagenbuchhaltung-Referenz', type: 'text', sentence: 'ERP-Referenz {v}' }),
  field({ key: 'riskDbRef', group: 'herkunftEvidenz', order: 60, label: 'Risikodatenbank-Referenz', type: 'text', appliesWhen: measure => Number(measure?.riskAvoided || 0) > 0, sentence: 'Risikodatenbank-Referenz {v}' }),
  field({ key: 'sourceStatus', group: 'herkunftEvidenz', order: 70, label: 'Quellenstatus', type: 'select', options: ['', 'benannt', 'source_available', 'validated', 'conflicting'], sentence: 'Quellenstatus: {v}', clarificationOn: v => !v }),
  field({ key: 'riskEvidenceStatus', group: 'herkunftEvidenz', order: 80, label: 'Risiko-Evidenzstatus', type: 'select', options: ['', 'missing', 'benannt', 'source_available', 'validated', 'conflicting'], appliesWhen: measure => Number(measure?.riskAvoided || 0) > 0, sentence: 'Risiko-Evidenzstatus {v}', clarificationOn: v => !v || v === 'missing' }),
  field({ key: 'riskOwnerRole', group: 'herkunftEvidenz', order: 90, label: 'Risikoverantwortung', type: 'text', appliesWhen: measure => Number(measure?.riskAvoided || 0) > 0, sentence: 'verantwortet durch {v}' }),
  field({ key: 'riskAssessmentStatus', group: 'herkunftEvidenz', order: 100, label: 'Risiko-Bewertungsstatus', type: 'text', appliesWhen: measure => Number(measure?.riskAvoided || 0) > 0, sentence: 'Bewertungsstatus {v}' }),

  // Tragfähigkeit
  field({ key: 'viabilityCategory', group: 'tragfaehigkeit', order: 10, label: 'Tragfähigkeitskategorie', type: 'select', options: ['', 'regulatory_must', 'asset_preservation_must', 'transformation_must_no_regret', 'strategic_option', 'synergy_timing', 'unclassified'], sentence: 'Tragfähigkeitskategorie {v}', clarificationOn: v => !v || v === 'unclassified' }),
  field({ key: 'viabilityCategorySource', group: 'tragfaehigkeit', order: 20, label: 'Herkunft der Einordnung', type: 'select', options: ['', 'manual', 'derived', 'imported', 'unset'], sentence: '{v}', clarificationOn: v => !v || v === 'unset' }),
  field({ key: 'viabilityRationale', group: 'tragfaehigkeit', order: 30, label: 'Begründung', type: 'text', sentence: 'Begründung: {v}' }),
  field({ key: 'refinancingBridgeStatus', group: 'tragfaehigkeit', order: 40, label: 'Refinanzierungsbrücke', type: 'select', options: ['', 'present', 'partial', 'missing', 'not_applicable'], sentence: 'Refinanzierungsbrücke: {v}', clarificationOn: v => v === 'missing' || v === 'partial' }),
  field({ key: 'refinancingBridgeRefs', group: 'tragfaehigkeit', order: 50, label: 'Refinanzierungsbrücke-Referenzen', type: 'text', default: [], sentence: 'Referenzen: {v}' }),
  field({ key: 'openViabilityQuestions', group: 'tragfaehigkeit', order: 60, label: 'Offene Tragfähigkeitsfragen', type: 'text', default: [], sentence: 'offene Fragen: {v}', clarificationOn: v => Array.isArray(v) && v.length > 0 }),

  // Notiz
  field({ key: 'note', group: 'notiz', order: 10, label: 'Notiz', type: 'text', sentence: '{v}' })
];

// ---------------------------------------------------------------------------
// Wirkannahme (impactAssumption, verschachtelt in measure.impactAssumptions[])
// ---------------------------------------------------------------------------

export const impactAssumptionFields = [
  field({ key: 'id', group: 'wirkannahme', order: 0, label: 'ID', type: 'text', sentence: 'Kennung {v}' }),
  field({ key: 'area', group: 'wirkannahme', order: 10, label: 'Bereich', type: 'select', options: ['qElement', 'efficiency', 'costBase', 'risk', 'portfolio'], default: 'qElement', sentence: 'Bereich {v}' }),
  field({ key: 'title', group: 'wirkannahme', order: 20, label: 'Titel', type: 'text', sentence: '{v}' }),
  field({ key: 'amount', group: 'wirkannahme', order: 30, label: 'Betrag', unit: 'TEUR', type: 'teur', default: 0, sentence: 'wirkt mit {v} TEUR' }),
  field({ key: 'confidence', group: 'wirkannahme', order: 40, label: 'Vertrauensstufe', type: 'select', options: ['proven', 'assumption', 'review'], default: 'review', sentence: 'Vertrauensstufe {v}', clarificationOn: v => v === 'review' }),
  field({ key: 'governance', group: 'wirkannahme', order: 50, label: 'Governance', type: 'select', options: ['basis', 'sensitivity', 'excluded'], default: 'sensitivity', sentence: 'Governance {v}', clarificationOn: v => v === 'sensitivity' }),
  field({ key: 'startYear', group: 'wirkannahme', order: 60, label: 'Wirkung ab', type: 'year', sentence: 'ab {v}' }),
  field({ key: 'endYear', group: 'wirkannahme', order: 70, label: 'Wirkung bis', type: 'year', sentence: 'bis {v}' }),
  field({ key: 'attribution', group: 'wirkannahme', order: 80, label: 'Attribution', unit: '%', type: 'percent', default: 100, sentence: 'Attribution {v} %' }),
  field({ key: 'chain', group: 'wirkannahme', order: 90, label: 'Wirkungskette', type: 'text', sentence: 'Wirkungskette: {v}' }),
  field({ key: 'evidence', group: 'wirkannahme', order: 100, label: 'Evidenz', type: 'text', sentence: 'Evidenz: {v}', evidenceKey: 'evidenceType', clarificationOn: v => !String(v || '').trim() }),
  field({ key: 'evidenceType', group: 'wirkannahme', order: 110, label: 'Evidenzart', type: 'select', options: ['measurement', 'operations', 'expert', 'study', 'open'], default: 'open', sentence: 'Evidenzart {v}', clarificationOn: v => !v || v === 'open' }),
  field({ key: 'legacyFlat', group: 'wirkannahme', order: 120, label: 'Pauschale Altannahme', type: 'bool', default: false, sentence: 'pauschale Altannahme: {v}' }),
  field({ key: 'riskProbabilityBefore', group: 'wirkannahme', order: 130, label: 'Eintrittswahrscheinlichkeit vorher', unit: '%', type: 'percent', default: 0, appliesWhen: impact => impact?.area === 'risk', sentence: 'vorher {v} %' }),
  field({ key: 'riskProbabilityAfter', group: 'wirkannahme', order: 140, label: 'Eintrittswahrscheinlichkeit nachher', unit: '%', type: 'percent', default: 0, appliesWhen: impact => impact?.area === 'risk', sentence: 'nachher {v} %' }),
  field({ key: 'riskImpact', group: 'wirkannahme', order: 150, label: 'Schadenspotenzial', unit: 'TEUR', type: 'teur', default: 0, appliesWhen: impact => impact?.area === 'risk', sentence: 'Schadenspotenzial {v} TEUR' }),
  field({ key: 'note', group: 'wirkannahme', order: 160, label: 'Notiz', type: 'text', sentence: '{v}' })
];

// ---------------------------------------------------------------------------
// Rahmen und Szenario (globale inputs, siehe Spezifikation 4.4)
// ---------------------------------------------------------------------------

export const inputFields = [
  // Rahmen: Sparte
  field({ key: 'sector', group: 'rahmenSparte', order: 10, label: 'Sparte', type: 'select', options: ['gas', 'strom'], default: 'gas', sentence: 'Sparte {v}' }),
  field({ key: 'regulationProcedure', group: 'rahmenSparte', order: 20, label: 'Regulierungsverfahren', type: 'select', options: ['standard', 'simplified'], default: 'standard', sentence: 'Verfahren {v}' }),
  field({ key: 'baseYear', group: 'rahmenSparte', order: 30, label: 'Startjahr', type: 'year', sentence: 'Startjahr {v}' }),
  field({ key: 'baseEog', group: 'rahmenSparte', order: 40, label: 'Basis-EOG', unit: 'TEUR', type: 'teur', sentence: 'Basis-EOG {v} TEUR' }),
  field({ key: 'rab', group: 'rahmenSparte', order: 50, label: 'RAB', unit: 'TEUR', type: 'teur', sentence: 'RAB {v} TEUR' }),
  field({ key: 'annualEnergyGwh', group: 'rahmenSparte', order: 60, label: 'Jahresenergiemenge', unit: 'GWh', type: 'number', sentence: '{v} GWh Jahresenergiemenge' }),
  field({ key: 'householdConsumptionKwh', group: 'rahmenSparte', order: 70, label: 'Haushaltsverbrauch', unit: 'kWh', type: 'number', default: 15000, sentence: 'Haushaltsverbrauch {v} kWh' }),

  // Rahmen: Kapitalkosten
  field({ key: 'returnRate', group: 'rahmenKapitalkosten', order: 10, label: 'Verzinsung', unit: '%', type: 'percent', default: 5, sentence: 'Verzinsung {v} %', helper: 'financingSpreadHelper' }),
  field({ key: 'financingRate', group: 'rahmenKapitalkosten', order: 20, label: 'Finanzierungssatz', unit: '%', type: 'percent', default: 5, sentence: 'Finanzierungssatz {v} %', helper: 'financingSpreadHelper' }),
  field({ key: 'capitalCostMode', group: 'rahmenKapitalkosten', order: 30, label: 'Kapitalkostenmodus', type: 'select', options: ['simple', 'advanced'], default: 'simple', sentence: 'Kapitalkostenmodus {v}', helper: 'financingSpreadHelper' }),
  field({ key: 'equityShare', group: 'rahmenKapitalkosten', order: 40, label: 'EK-Anteil', unit: '%', type: 'percent', default: 40, appliesWhen: inputs => inputs?.capitalCostMode === 'advanced', sentence: 'EK-Anteil {v} %', helper: 'financingSpreadHelper' }),
  field({ key: 'equityReturnRate', group: 'rahmenKapitalkosten', order: 50, label: 'EK-Zins', unit: '%', type: 'percent', default: 5, appliesWhen: inputs => inputs?.capitalCostMode === 'advanced', sentence: 'EK-Zins {v} %', helper: 'financingSpreadHelper' }),
  field({ key: 'debtShare', group: 'rahmenKapitalkosten', order: 60, label: 'FK-Anteil', unit: '%', type: 'percent', default: 60, appliesWhen: inputs => inputs?.capitalCostMode === 'advanced', sentence: 'FK-Anteil {v} %', helper: 'financingSpreadHelper' }),
  field({ key: 'debtReturnRate', group: 'rahmenKapitalkosten', order: 70, label: 'FK-Zins', unit: '%', type: 'percent', default: 5, appliesWhen: inputs => inputs?.capitalCostMode === 'advanced', sentence: 'FK-Zins {v} %', helper: 'financingSpreadHelper' }),
  field({ key: 'deductionCapital', group: 'rahmenKapitalkosten', order: 80, label: 'Abzugskapital', unit: 'TEUR', type: 'teur', default: 0, sentence: 'Abzugskapital {v} TEUR' }),
  field({ key: 'discountRate', group: 'rahmenKapitalkosten', order: 90, label: 'Diskontsatz', unit: '%', type: 'percent', default: 5, sentence: 'Diskontsatz {v} %' }),

  // Szenario: Basis
  field({ key: 'horizon', group: 'szenarioBasis', order: 10, label: 'Betrachtungshorizont', unit: 'Jahre', type: 'number', default: 20, sentence: 'Horizont {v} Jahre' }),
  field({ key: 'kanuEndYear', group: 'szenarioBasis', order: 20, label: 'KANU-Zieljahr', type: 'year', sentence: 'KANU-Zieljahr {v}' }),
  field({ key: 'degressiveRate', group: 'szenarioBasis', order: 30, label: 'Degressive Rate', unit: '%', type: 'percent', default: 10, sentence: 'degressive Rate {v} %' }),
  field({ key: 'taxFactor', group: 'szenarioBasis', order: 40, label: 'Steuerfaktor', unit: '%', type: 'percent', default: 0, sentence: 'Steuerfaktor {v} %' }),
  field({ key: 'portfolioAttribution', group: 'szenarioBasis', order: 50, label: 'Portfolio-Attribution', unit: '%', type: 'percent', default: 25, sentence: 'Portfolio-Attribution {v} %' }),
  field({ key: 'capexLagYears', group: 'szenarioBasis', order: 60, label: 'CAPEX-Wirkungsverzug', unit: 'Jahre', type: 'number', default: 0, sentence: 'CAPEX-Verzug {v} Jahre' }),
  field({ key: 'opexLagYears', group: 'szenarioBasis', order: 70, label: 'OPEX-Wirkungsverzug', unit: 'Jahre', type: 'number', default: 3, sentence: 'OPEX-Verzug {v} Jahre' }),
  field({ key: 'qeLagYears', group: 'szenarioBasis', order: 80, label: 'QE-Wirkungsverzug', unit: 'Jahre', type: 'number', default: 2, sentence: 'QE-Verzug {v} Jahre' }),
  field({ key: 'qDelta', group: 'szenarioBasis', order: 90, label: 'Globale Q-Wirkung', unit: '%', type: 'percent', default: 0, sentence: 'Q-Wirkung {v} %' }),
  field({ key: 'eDelta', group: 'szenarioBasis', order: 100, label: 'Globale E-Wirkung', unit: '%', type: 'percent', default: 0, sentence: 'E-Wirkung {v} %' }),

  // Szenario: Konservativ
  field({ key: 'conservativeAttributionCap', group: 'szenarioKonservativ', order: 10, label: 'Attributionsdeckel', unit: '%', type: 'percent', default: 10, sentence: 'Attributionsdeckel {v} %' }),
  field({ key: 'conservativeQFactor', group: 'szenarioKonservativ', order: 20, label: 'Q-Abschlagsfaktor', unit: '%', type: 'percent', default: 50, sentence: 'Q-Abschlagsfaktor {v} %' }),
  field({ key: 'conservativeEFactor', group: 'szenarioKonservativ', order: 30, label: 'E-Abschlagsfaktor', unit: '%', type: 'percent', default: 50, sentence: 'E-Abschlagsfaktor {v} %' }),
  field({ key: 'conservativeDiscountRate', group: 'szenarioKonservativ', order: 40, label: 'Konservativer Diskontsatz', unit: '%', type: 'percent', sentence: 'Diskontsatz {v} %', clarificationOn: v => !String(v ?? '').trim() }),
  field({ key: 'conservativeAssumptionMode', group: 'szenarioKonservativ', order: 50, label: 'Annahmemodus', type: 'select', options: ['approvedOnly', 'basisNoReview', 'includeReview'], default: 'approvedOnly', sentence: 'Annahmemodus {v}' })
];

// ---------------------------------------------------------------------------
// Befassung (committee)
// ---------------------------------------------------------------------------

export const committeeFields = [
  field({ key: 'committeeBody', group: 'befassung', order: 10, label: 'Gremium', type: 'text', default: 'Gemeinderat', sentence: 'wird im Gremium {v} befasst' }),
  field({ key: 'committeeAudience', group: 'befassung', order: 20, label: 'Adressat', type: 'select', options: ['kommunal', 'vorstand'], default: 'kommunal', sentence: 'Adressat {v}' }),
  field({ key: 'committeeMeetingDate', group: 'befassung', order: 30, label: 'Sitzungstermin', type: 'text', sentence: 'Sitzungstermin {v}' }),
  field({ key: 'committeeProposalText', group: 'befassung', order: 40, label: 'Beschlussvorschlag', type: 'text', sentence: '{v}' })
];

// ---------------------------------------------------------------------------
// Ziel (strategy.objectives[])
// ---------------------------------------------------------------------------

export const objectiveFields = [
  field({ key: 'id', group: 'ziel', order: 0, label: 'ID', type: 'text', sentence: 'Kennung {v}' }),
  field({ key: 'label', group: 'ziel', order: 10, label: 'Ziel', type: 'text', sentence: '{v}', clarificationOn: v => !String(v || '').trim() }),
  field({ key: 'note', group: 'ziel', order: 20, label: 'Notiz', type: 'text', sentence: '{v}' })
];

// ---------------------------------------------------------------------------
// Kontext (sidecar.objects[])
// ---------------------------------------------------------------------------

export const sidecarObjectFields = [
  field({ key: 'id', group: 'kontext', order: 0, label: 'ID', type: 'text', sentence: 'Kennung {v}' }),
  field({ key: 'type', group: 'kontext', order: 10, label: 'Typ', type: 'select', default: 'evidence_only', sentence: 'Typ {v}' }),
  field({ key: 'division', group: 'kontext', order: 20, label: 'Sparte', type: 'select', options: ['strom', 'gas', 'waerme', 'wasser', 'cross_division'], default: 'cross_division', sentence: 'Sparte {v}' }),
  field({ key: 'title', group: 'kontext', order: 30, label: 'Titel', type: 'text', sentence: '{v}', clarificationOn: v => !String(v || '').trim() }),
  field({ key: 'summary', group: 'kontext', order: 40, label: 'Zusammenfassung', type: 'text', sentence: '{v}' }),
  field({ key: 'status', group: 'kontext', order: 50, label: 'Status', type: 'select', options: ['context', 'pruefpflichtig', 'quantified', 'active', 'archived'], default: 'context', sentence: 'Status {v}' }),
  field({ key: 'sidecarType', group: 'kontext', order: 60, label: 'Kontextart', type: 'select', options: ['context', 'sensitivity', 'effect_assumption', 'economic_bridge', 'system_reference'], default: 'context', sentence: 'Kontextart {v}' }),
  field({ key: 'activationStatus', group: 'kontext', order: 70, label: 'Aktivierungsstatus', type: 'select', options: ['not_activated', 'candidate', 'ready_for_activation', 'activated', 'rejected'], default: 'not_activated', sentence: 'Aktivierungsstatus {v}' }),
  field({ key: 'evidenceStatus', group: 'kontext', order: 80, label: 'Evidenzstatus', type: 'select', options: ['missing', 'stated', 'source_available', 'validated', 'conflicting', 'stale'], default: 'missing', sentence: 'Evidenzstatus {v}', evidenceKey: 'evidenceStatus', clarificationOn: v => ['missing', 'stated', 'conflicting', 'stale'].includes(v) }),
  field({ key: 'calculationImpact', group: 'kontext', order: 90, label: 'Rechenwirkung', type: 'select', options: ['none', 'scenario_only', 'indirect', 'active'], default: 'none', sentence: 'Rechenwirkung {v}' }),
  field({ key: 'bridgeLogic', group: 'kontext', order: 100, label: 'Wirtschaftliche Überleitung', type: 'nested', sentence: 'wirtschaftliche Überleitung siehe Detail' }),
  field({ key: 'linkedMeasures', group: 'kontext', order: 110, label: 'Verknüpfte Maßnahmen', type: 'text', default: [], sentence: 'verknüpft mit {v}' }),
  field({ key: 'linkedScenarios', group: 'kontext', order: 120, label: 'Verknüpfte Szenarien', type: 'text', default: [], sentence: 'gilt für Szenarien {v}' }),
  field({ key: 'sourceRefs', group: 'kontext', order: 130, label: 'Quellreferenzen', type: 'text', default: [], sentence: 'Quellen: {v}' }),
  field({ key: 'openQuestions', group: 'kontext', order: 140, label: 'Offene Klärfragen', type: 'text', default: [], sentence: '{v}', clarificationOn: v => Array.isArray(v) && v.length > 0 }),
  field({ key: 'sensitivity', group: 'kontext', order: 150, label: 'Sensitivität', type: 'select', options: ['public', 'internal', 'private', 'confidential'], default: 'internal', sentence: 'Sensitivität {v}' }),
  field({ key: 'exportStatus', group: 'kontext', order: 160, label: 'Exportstatus', type: 'select', options: ['allowed', 'sanitized_only', 'excluded'], default: 'sanitized_only', sentence: 'Exportstatus {v}' }),
  field({ key: 'ownerRole', group: 'kontext', order: 170, label: 'Verantwortung', type: 'text', default: 'unknown', sentence: 'verantwortet durch {v}' }),
  field({ key: 'reviewStatus', group: 'kontext', order: 180, label: 'Reviewstatus', type: 'text', default: 'not_reviewed', sentence: 'Reviewstatus {v}', clarificationOn: v => String(v || '').match(/not_reviewed|needs_update|open|offen/i) }
  )
];

// ---------------------------------------------------------------------------
// Kontext: wirtschaftliche Überleitung (sidecar.objects[].bridgeLogic)
// ---------------------------------------------------------------------------

export const sidecarBridgeLogicFields = [
  field({ key: 'description', group: 'ueberleitung', order: 10, label: 'Beschreibung', type: 'text', sentence: '{v}' }),
  field({ key: 'economicRelation', group: 'ueberleitung', order: 20, label: 'Wirtschaftlicher Bezug', type: 'select', options: ['none', 'opex_effect', 'capex_dependency', 'revenue_effect', 'risk_effect', 'timing_effect', 'avoided_cost'], default: 'none', sentence: 'wirtschaftlicher Bezug {v}', clarificationOn: v => !v || v === 'none' }),
  field({ key: 'direction', group: 'ueberleitung', order: 30, label: 'Richtung', type: 'select', options: ['none', 'positive', 'negative', 'mixed', 'unclear'], default: 'none', sentence: 'Richtung {v}' }),
  field({ key: 'quantificationStatus', group: 'ueberleitung', order: 40, label: 'Quantifizierungsstatus', type: 'select', options: ['not_applicable', 'open', 'described', 'working_value', 'validated'], default: 'not_applicable', sentence: 'Quantifizierungsstatus {v}', clarificationOn: v => ['not_applicable', 'open', 'described'].includes(v) }),
  field({ key: 'quantificationMethod', group: 'ueberleitung', order: 50, label: 'Quantifizierungsmethode', type: 'text', sentence: 'Methode: {v}' }),
  field({ key: 'amount', group: 'ueberleitung', order: 60, label: 'Betrag', type: 'number', sentence: '{v}' }),
  field({ key: 'amountUnit', group: 'ueberleitung', order: 70, label: 'Einheit', type: 'text', sentence: '{v}' }),
  field({ key: 'timeHorizon', group: 'ueberleitung', order: 80, label: 'Zeithorizont', type: 'text', sentence: 'Zeithorizont {v}' }),
  field({ key: 'sourceRefs', group: 'ueberleitung', order: 90, label: 'Quellreferenzen', type: 'text', default: [], sentence: 'Quellen: {v}' }),
  field({ key: 'assumptions', group: 'ueberleitung', order: 100, label: 'Annahmen', type: 'text', default: [], sentence: 'Annahmen: {v}' }),
  field({ key: 'openQuestions', group: 'ueberleitung', order: 110, label: 'Offene Klärfragen', type: 'text', default: [], sentence: '{v}', clarificationOn: v => Array.isArray(v) && v.length > 0 })
];

// ---------------------------------------------------------------------------
// Quelle (sidecar.sources[])
// ---------------------------------------------------------------------------

export const sidecarSourceFields = [
  field({ key: 'id', group: 'quelle', order: 0, label: 'ID', type: 'text', sentence: 'Kennung {v}' }),
  field({ key: 'type', group: 'quelle', order: 10, label: 'Typ', type: 'text', default: 'source', sentence: 'Typ {v}' }),
  field({ key: 'title', group: 'quelle', order: 20, label: 'Titel', type: 'text', sentence: '{v}', clarificationOn: v => !String(v || '').trim() }),
  field({ key: 'contains', group: 'quelle', order: 30, label: 'Enthält', type: 'text', default: [], sentence: 'enthält {v}' }),
  field({ key: 'usableFor', group: 'quelle', order: 40, label: 'Nutzbar für', type: 'text', default: [], sentence: 'nutzbar für {v}' }),
  field({ key: 'sensitivity', group: 'quelle', order: 50, label: 'Sensitivität', type: 'select', options: ['public', 'internal', 'private', 'confidential'], default: 'internal', sentence: 'Sensitivität {v}' }),
  field({ key: 'exportStatus', group: 'quelle', order: 60, label: 'Exportstatus', type: 'select', options: ['allowed', 'sanitized_only', 'excluded'], default: 'sanitized_only', sentence: 'Exportstatus {v}' })
];

// ---------------------------------------------------------------------------
// Registry lookup
// ---------------------------------------------------------------------------

export const fieldRegistry = {
  measure: measureFields,
  impactAssumption: impactAssumptionFields,
  input: inputFields,
  committee: committeeFields,
  objective: objectiveFields,
  sidecarObject: sidecarObjectFields,
  sidecarBridgeLogic: sidecarBridgeLogicFields,
  sidecarSource: sidecarSourceFields
};

export const objectTypes = Object.keys(fieldRegistry);

export function fieldDescriptorsFor(objectType) {
  return fieldRegistry[objectType] || [];
}

export function fieldDescriptor(objectType, key) {
  return fieldDescriptorsFor(objectType).find(descriptor => descriptor.key === key) || null;
}

export function fieldKeysFor(objectType) {
  return fieldDescriptorsFor(objectType).map(descriptor => descriptor.key);
}
