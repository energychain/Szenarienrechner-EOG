// Versionierter regulatorischer Parametersatz fuer den Szenario-Rechner.
// Diese Datei ist bewusst datenartig gehalten: Ruleset-Aenderungen sollen als kleine,
// pruefbare PRs mit Quelle, Konfidenz und Changelog nachvollziehbar bleiben.

export const regulatoryParameterSet = {
  id: 'regulatory-parameters-2026-07',
  effectiveMonth: '2026-07',
  confidence: 'consultation',
  sourceRef: 'BNetzA Anreizregulierung/ARegV/KANU sowie NEST/RAMEN-Kontext, Arbeitsstand 2026-07; pruefpflichtiger Planungsstand.',
  changelogUrl: 'REGULATORY_ASSUMPTIONS.md',
  scope: 'Generisches Planungsmodell fuer regulierte Sparten; keine Rechts- oder Regulierungsberatung.',
  source: 'ARegV, EnWG, BNetzA-Anreizregulierung, KANU-Kontext und NEST/RAMEN-Arbeitsstand; Details siehe REGULATORY_ASSUMPTIONS.md.',
  sources: [
    'ARegV: Regulierungsperioden, Erloesobergrenzen, Qualitaetselement und vereinfachtes Verfahren',
    'EnWG: regulatorischer Rahmen fuer Netzbetrieb und Netzentgelte',
    'BNetzA: Anreizregulierung, Kapitalkostenabgleich, Qualitaetselement und Regulierungskonto',
    'BNetzA KANU-Kontext: beschleunigte Abschreibungs- und Restwertfragen fuer Gasnetze',
    'BNetzA NEST/RAMEN-Kontext: kuenftige Weiterentwicklung des Regulierungsrahmens'
  ],
  futurePeriodLengthYears: 5,
  defaultEffectLags: {
    capex: 0,
    opex: 3,
    qe: 2
  },
  capitalCostDefaults: {
    mode: 'simple',
    equityShare: 40,
    equityReturnRate: 5.0,
    debtShare: 60,
    debtReturnRate: 5.0,
    deductionCapital: 0
  },
  regulatoryPeriodsBySector: {
    gas: [
      { number: 4, id: 'RP4', label: '4. Regulierungsperiode', start: 2023, end: 2027, costBaseYear: 2020, known: true },
      { number: 5, id: 'RP5', label: '5. Regulierungsperiode', start: 2028, end: 2032, costBaseYear: 2025, known: true }
    ],
    strom: [
      { number: 4, id: 'RP4', label: '4. Regulierungsperiode', start: 2024, end: 2028, costBaseYear: 2021, known: true },
      { number: 5, id: 'RP5', label: '5. Regulierungsperiode', start: 2029, end: 2033, costBaseYear: 2026, known: true }
    ]
  }
};
