// Static UI schema/configuration used by src/ui.js.
// Keep DOM ids, labels and measure template metadata here so the main UI module stays focused on state and rendering.

export const inputIds = [
  'sector', 'regulationProcedure', 'baseYear', 'baseEog', 'rab', 'returnRate', 'financingRate',
  'capitalCostMode', 'equityShare', 'equityReturnRate', 'debtShare', 'debtReturnRate', 'deductionCapital',
  'annualEnergyGwh', 'householdConsumptionKwh',
  'horizon', 'discountRate', 'kanuEndYear', 'degressiveRate', 'taxFactor',
  'portfolioAttribution', 'capexLagYears', 'opexLagYears', 'qeLagYears', 'qDelta', 'eDelta'
];
export const inputDefaults = {
  capitalCostMode: 'simple',
  equityShare: '40',
  equityReturnRate: '5.0',
  debtShare: '60',
  debtReturnRate: '5.0',
  deductionCapital: '0'
};

export const detailIds = [
  'mName', 'mExternalId', 'mOrgUnit', 'mTags', 'mType', 'mEffectType', 'mFlexibilityUseCase', 'mFlexibilityStatus',
  'mRegulatoryTreatment', 'mNetworkScheduleRequired', 'mNetworkScheduleStatus', 'mNetworkConstraintRef',
  'mAffectedNetworkLevel', 'mActivationWindow', 'mDispatchLogic', 'mAvoidedCapexTeur', 'mAvoidedCapexConfidence',
  'mDeferredCapexTeur', 'mDeferredCapexFromYear', 'mDeferredCapexToYear', 'mCapexAvoidanceEvidenceRef',
  'mFlexOpexPaTeur', 'mFlexOpexStartYear', 'mFlexOpexDurationYears', 'mOpexRecognitionStatus', 'mOpexEvidenceRef',
  'mAgnesRelevant', 'mAgnesRole', 'mAgnesIntegrationStatus', 'mAgnesDataNeeded', 'mCost', 'mYear', 'mSecure', 'mUncertain',
  'mMonitoringProfile', 'mMonitoringCategory', 'mNetworkLevel', 'mReportingRegion', 'mReportingStatus',
  'mCapacityImpact', 'mBottleneckRef', 'mPermitRequired', 'mPermitStatus', 'mInvestmentDecisionStatus',
  'mInvestmentDecisionDate', 'mAlternativesChecked', 'mFlexibilityNeed',
  'mSourceSystem', 'mSourceRecordId', 'mScoringRef', 'mAssetSystemRef', 'mErpRef', 'mRiskDbRef',
  'mSourceStatus', 'mRiskEvidenceStatus', 'mRiskOwnerRole', 'mRiskAssessmentStatus',
  'mProbability', 'mOpexRecognition', 'mLife', 'mDepr', 'mQDirect',
  'mEDirect', 'mRiskAvoided', 'mPortfolioShare', 'mOpexPa',
  'mOpexDeltaPa', 'mReinvestCost', 'mReinvestMode', 'mReinvestLife', 'mDecommissionCost', 'mHgbLife',
  'mDecommissionYear', 'mGasTransformationPath', 'mGasAssetScope', 'mGasObligationBasis',
  'mGasEternityAssumption', 'mGasProvisionAssessment', 'mGasRegulatoryTreatment', 'mGasTransformationEvidence', 'mNote'
];


export const committeeIds = ['committeeBody', 'committeeAudience', 'committeeMeetingDate', 'committeeProposalText'];
export const processPhases = [
  ['initialisierung', 'Initialisierung'],
  ['datenerhebung', 'Datenerhebung'],
  ['massnahmenbewertung', 'Maßnahmenbewertung'],
  ['konsolidierung', 'Konsolidierung'],
  ['entscheidungsvorlage', 'Entscheidungsvorlage'],
  ['archiv', 'Beschluss/Archiv']
];

export const roleProfiles = {
  owner: { label: 'Modellverantwortung', view: 'basis', focus: 'management', expert: true },
  expert: { label: 'Fachexpertise', view: 'expertWork', focus: 'technik', expert: false },
  management: { label: 'Management', view: 'results', focus: 'management', expert: false },
  audit: { label: 'Audit', view: 'report', focus: 'controlling', expert: true }
};
export const defaultObjectives = [
  { id: 'obj_supply', label: 'Versorgungssicherheit', note: '' },
  { id: 'obj_decarb', label: 'KANU-/Dekarbonisierungspfad', note: '' },
  { id: 'obj_eff', label: 'Effizienz/Kostenpfad', note: '' }
];

export const bulkImportSteps = ['Einlesen', 'Spalten zuordnen', 'Prüfbericht'];
export const importFields = [
  ['ignore', 'Ignorieren'],
  ['externalId', 'Externe ID / PSP'],
  ['name', 'Bezeichnung'],
  ['orgUnit', 'Bereich / OE'],
  ['type', 'Typ'],
  ['cost', 'Kosten TEUR'],
  ['year', 'Inbetriebnahmejahr'],
  ['life', 'Nutzungsdauer'],
  ['hgbLife', 'HGB-Nutzungsdauer'],
  ['secure', 'sicher aktivierbar %'],
  ['uncertain', 'unsicher aktivierbar %'],
  ['probability', 'Wahrscheinlichkeit %'],
  ['opexRecognition', 'OPEX-Anerkennung %'],
  ['active', 'aktiv'],
  ['tags', 'Tags'],
  ['templateId', 'Vorlage'],
  ['monitoringProfile', 'Monitoring-Profil'],
  ['monitoringCategory', 'Monitoring-/§14d-Kategorie'],
  ['networkLevel', 'Netzebene / Druckstufe'],
  ['reportingRegion', 'Region / Netzgebiet'],
  ['reportingStatus', 'Status Reporting'],
  ['capacityImpact', 'Kapazitätswirkung'],
  ['bottleneckRef', 'Engpass / Abschnitt'],
  ['permitRequired', 'Genehmigung erforderlich'],
  ['permitStatus', 'Genehmigungsstand'],
  ['investmentDecisionStatus', 'Investitionsentscheidung'],
  ['investmentDecisionDate', 'Entscheidungsdatum'],
  ['alternativesChecked', 'Alternativenprüfung'],
  ['flexibilityNeed', 'Flexibilitäts-/SDL-Bedarf'],
  ['sourceSystem', 'Quellsystem'],
  ['sourceRecordId', 'Quell-Datensatz / Zeile'],
  ['scoringRef', 'Scoring-Referenz'],
  ['assetSystemRef', 'Asset-System-Referenz'],
  ['erpRef', 'ERP-/Anlagenbuchhaltung-Referenz'],
  ['riskDbRef', 'Risikodatenbank-Referenz'],
  ['sourceStatus', 'Quellenstatus'],
  ['riskEvidenceStatus', 'Risiko-Evidenzstatus'],
  ['riskOwnerRole', 'Risikoverantwortung'],
  ['riskAssessmentStatus', 'Risiko-Bewertungsstatus']
];
export const importHeaderSynonyms = {
  externalId: ['psp', 'psp-element', 'projektnr', 'projektnummer', 'projekt-id', 'id', 'sap'],
  name: ['bezeichnung', 'maßnahme', 'massnahme', 'projektname', 'projekt', 'titel', 'name'],
  orgUnit: ['bereich', 'gesellschaft', 'oe', 'organisation', 'orgunit', 'kostenstelle'],
  type: ['typ', 'maßnahmenart', 'massnahmenart', 'kategorie'],
  cost: ['invest', 'kosten', 'budget', 'budget teur', 'invest teur', 'capex', 'betrag'],
  year: ['ibn', 'inbetriebnahme', 'jahr', 'startjahr', 'baujahr'],
  life: ['nd', 'nutzungsdauer', 'regulatorische nd', 'afa'],
  hgbLife: ['hgb nd', 'hgb-nutzungsdauer', 'handelsrechtliche nd'],
  secure: ['sicher', 'sicher aktivierbar', 'aktivierbar sicher'],
  uncertain: ['unsicher', 'unsicher aktivierbar', 'aktivierbar unsicher'],
  probability: ['wahrscheinlichkeit', 'eintritt', 'p50'],
  opexRecognition: ['opex-anerkennung', 'opex anerkennung', 'anerkennung'],
  active: ['aktiv', 'einplanen', 'auswahl'],
  tags: ['tags', 'schlagworte', 'label'],
  templateId: ['vorlage', 'template', 'templateid'],
  monitoringProfile: ['monitoring profil', 'exportprofil', 'reporting profil', 'bnetza profil'],
  monitoringCategory: ['monitoring kategorie', '14d kategorie', 'netzausbau kategorie', 'maßnahmenkategorie', 'massnahmenkategorie'],
  networkLevel: ['netzebene', 'spannungsebene', 'druckstufe'],
  reportingRegion: ['region', 'netzgebiet', 'cluster', 'plz gebiet'],
  reportingStatus: ['status', 'projektstatus', 'umsetzungsstatus'],
  capacityImpact: ['kapazitätswirkung', 'kapazitaetswirkung', 'leistungswirkung', 'mva', 'mw'],
  bottleneckRef: ['engpass', 'leitungsabschnitt', 'umspannstation', 'abschnitt'],
  permitRequired: ['genehmigung erforderlich', 'planfeststellung', 'verfahren erforderlich'],
  permitStatus: ['genehmigungsstand', 'verfahrensstand'],
  investmentDecisionStatus: ['investitionsentscheidung', 'beschlussstatus', 'entscheidung status'],
  investmentDecisionDate: ['entscheidungsdatum', 'beschlussdatum'],
  alternativesChecked: ['alternativenprüfung', 'alternativenpruefung', 'alternativen'],
  flexibilityNeed: ['flexibilitätsbedarf', 'flexibilitaetsbedarf', 'systemdienstleistung', 'sdl'],
  sourceSystem: ['quellsystem', 'source system', 'sourceSystem'],
  sourceRecordId: ['quelldatensatz', 'quell-datensatz', 'source record', 'zeile', 'blatt zeile'],
  scoringRef: ['scoring referenz', 'scoringref', 'scoring-id', 'scoring id'],
  assetSystemRef: ['asset referenz', 'asset-system', 'asset id', 'gis id', 'lids'],
  erpRef: ['erp referenz', 'anlagenbuchhaltung', 'sap ref', 'sap id'],
  riskDbRef: ['risikodatenbank', 'risiko id', 'riskdb', 'risk id'],
  sourceStatus: ['quellenstatus', 'source status'],
  riskEvidenceStatus: ['risiko evidenz', 'risiko-evidenzstatus', 'risk evidence'],
  riskOwnerRole: ['risikoverantwortung', 'risk owner', 'verantwortung risiko'],
  riskAssessmentStatus: ['risiko bewertungsstatus', 'bewertungsstatus risiko', 'risk status']
};

export const impactAreaLabels = {
  qElement: 'Q-Element',
  efficiency: 'Effizienz/OPEX',
  costBase: 'Kostenbasis',
  risk: 'Risiko',
  portfolio: 'Portfolio'
};

export const confidenceLabels = {
  proven: 'belegt',
  assumption: 'Annahme',
  review: 'prüfpflichtig'
};

export const governanceLabels = {
  basis: 'Basisszenario',
  sensitivity: 'Sensitivität',
  excluded: 'nur dokumentiert'
};

export const evidenceTypeLabels = {
  measurement: 'Messdaten',
  operations: 'Betriebserfahrung',
  expert: 'Expertenschätzung',
  study: 'externe Studie',
  open: 'noch offen'
};

export const measureTemplates = [
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
