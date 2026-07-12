# Regulatory assumptions

Stand: 2026-07

Dieses Dokument beschreibt die fachliche Modellgrenze des Szenarienrechners. Es ist bewusst generisch gehalten: Die App enthaelt keine unternehmensinternen Inhalte, keine projektspezifischen Bescheide und keine vertraulichen Planungsdaten.

## Zweck

Der Rechner unterstuetzt eine strukturierte Vorbewertung von Massnahmenportfolios in regulierten Sparten. Er macht Annahmen sichtbar, trennt Basisrechnung von Sensitivitaeten und dokumentiert, welche Effekte nur unter Governance-Vorbehalt angesetzt werden.

Er ersetzt keine Rechts-, Steuer-, Wirtschaftspruefungs- oder Regulierungsberatung. Vor Entscheidungen muessen alle Parameter gegen den aktuellen Rechtsstand, regulatorische Festlegungen, Bescheide und unternehmensspezifische Bilanzierungsregeln geprueft werden.

## Abgebildete Regulierungslogik

- Regulierungsperioden werden als fuenfjaehrige Perioden modelliert.
- Gas und Strom haben getrennte bekannte Periodenstarts und Fortschreibungen.
- Die EOG-Wirkung wird aus aktivierbarer Basis, Abschreibung, Kapitalverzinsung, OPEX-Anteil und dokumentierten Wirkannahmen abgeleitet.
- Qualitaets-, Effizienz-, Risiko- und Portfolioeffekte werden als explizite Annahmen mit Evidenztyp, Vertrauensstufe und Governance-Status gefuehrt.
- Im vereinfachten Verfahren werden Q- und Effizienzeffekte weiterhin dokumentiert, aber nicht als individueller Erloesbeitrag angesetzt.
- KANU-Varianten werden als Gas-spezifische Abschreibungs- und Restwertszenarien betrachtet.

## Parameterstand im Code

`src/engine.js` enthaelt `regulatoryParameterSet` mit:

- `id`: `regulatory-parameters-2026-07`
- `effectiveMonth`: `2026-07`
- bekannten Regulierungsperioden fuer Gas und Strom
- generischer Fortschreibung zukuenftiger Perioden in Fuenfjahresschritten
- Quellen- und Scope-Hinweis fuer Public-OSS-Nutzung

Die Periodenlogik ist ein Planungsmodell. Sie darf nicht als verbindliche Aussage zu zukuenftigen Festlegungen verstanden werden.

## Fachliche Quellenebenen

Die App referenziert folgende oeffentliche Quellenebenen als Modellkontext:

- ARegV: Regulierungsperioden, Erloesobergrenzen, Qualitaetselement und vereinfachtes Verfahren.
- EnWG: allgemeiner Rechtsrahmen fuer Netzbetrieb, Netzentgelte und Regulierung.
- Bundesnetzagentur: Anreizregulierung, Kostenpruefung, Effizienzvergleich, Kapitalkostenabgleich, Qualitaetselement und Regulierungskonto.
- KANU-Kontext der Bundesnetzagentur: beschleunigte Abschreibungs-, Nutzungsdauer-, Restwert- und Transformationsfragen fuer Gasnetze.
- NEST/RAMEN-Kontext der Bundesnetzagentur: Weiterentwicklung des Regulierungsrahmens; im Rechner deshalb als dokumentierter Arbeitsstand und nicht als harte unveraenderliche Logik behandelt.

## Designentscheidungen aus der Regulatorik

- Offline Single-File: Planungsdaten koennen sensibel sein; die App benoetigt keine Serververbindung.
- DOM-freier Rechenkern: Fachliche Formeln bleiben testbar und auditierbar.
- JSON Export/Import: Arbeitsstaende lassen sich versionieren, pruefen und in Gremienprozesse einbringen.
- Wirkannahmen statt versteckter Excel-Zellen: Jede Q-/Effizienz-/Risikoannahme braucht Kausalkette, Evidenz und Governance-Status.
- Szenarien statt Scheingenauigkeit: Konservativ-, Basis- und Wert-Sicht trennen Annahmen von Stammdaten.
- Rollen- und Historienmodell: Management, Fachbereich, Modellverantwortung und Audit brauchen unterschiedliche Sichten auf dieselben Daten.

## Public-OSS-Abgrenzung

- Demodaten sind synthetisch.
- Namen wie Demogebiet, Beispielnetz oder Budgetrunde sind Platzhalter.
- Es werden keine realen Netzbetreiber, Kunden, Projekte oder internen Dokumente referenziert.
- Pull Requests sollen neue Beispiele ebenfalls synthetisch halten und keine vertraulichen Daten einbringen.

## Pruefpflicht vor produktiver Nutzung

Vor Nutzung fuer reale Entscheidungen sollten mindestens geprueft werden:

1. aktueller Rechts- und Festlegungsstand,
2. zulaessige Kapitalverzinsung und Kapitalkostenlogik,
3. konkrete EOG-/Bescheidlage der Sparte,
4. Aktivierbarkeit und Bilanzierungsregeln,
5. KANU-/Transformationsannahmen bei Gas,
6. Q-Element-/Effizienzsystematik,
7. interne Governance fuer Annahmen, Sensitivitaeten und Freigaben.
