# Hermes-Briefing: Fachliches Grounding fuer den Szenario-Rechner EOG

Stand: 2026-07-12

Dieses Briefing ist fuer Hermes gedacht. Es soll nicht die README ersetzen, sondern die fachliche Linie hinter dem Repository erklaeren: warum der Rechner existiert, welche Annahmen er bewusst sichtbar macht und wo nicht vorschnell "automatisch gerechnet" werden darf.

## Repository und aktueller Stand

Repository: `github.com/energychain/Szenarienrechner-EOG`

Lokales Arbeitsverzeichnis in Thorstens TWL-Netze-Workspace:

```text
03_Projekte/TWL/eog-rechner
```

Aktueller Hauptzweig: `main`

Letzter Remote-Stand vor diesem Briefing:

```text
39e31e6 docs: define project data envelope (#11)
```

Dieses Briefing wurde danach als eigener Commit ergaenzt und auf `origin/main` gepusht. Die letzten produktrelevanten Schritte inklusive Public-OSS-Haertung, ADRs, Datenformat, Governance- und Release-Dokumentation sind bereits im Remote-Stand enthalten.

Wichtige Artefakte:

- `src/engine.js`: DOM-freier Rechenkern fuer Regulierungsperioden, Aktivierung, AfA, EOG-Wirkung, Portfolioeffekte, IRR, Kapitalwert, Tarifeffekt und Szenarien.
- `src/ui.js`: UI, Modellzustand, Import-/Exportlogik, Wizards, Rollen, Prozess-/Klärpunktlogik, Report.
- `src/history.js`: Audittrail, Modell-Diffs, Import-Kettenvergleich, Divergenzerkennung.
- `src/trust-content.js`: Impressum, Repository-Referenz und Offline-Vertrauenshinweise.
- `dist/index.html`: technisches Vite-Buildartefakt nach `npm run build:release`.
- `dist/szenarienrechner-eog.html`: neutrales offline lauffaehiges Single-File-Deliverable fuer Verteilung.

## Zweck des Produkts

Der Rechner ist eine Entscheidungs- und Governance-App fuer regulierte Sparten, nicht nur ein Finanzrechner.

Die fachliche Ausgangslage: In regulierten Netzsparten sind Massnahmen wirtschaftlich nicht allein ueber "Kosten" oder "Budget vorhanden ja/nein" zu beurteilen. Entscheidend ist, wie eine Massnahme in eine regulaerbare, finanzierbare und governance-faehige Wirkungskette passt:

```text
Massnahme
-> aktivierbarer Anteil
-> regulatorisch anerkannte Kapitalbasis
-> AfA und kalkulatorische Verzinsung
-> EOG-Wirkung
-> Ergebnis-/Finanzierungseffekt
-> Risiko-, Q-, Effizienz- und Portfolioeffekte
-> Entscheidungsreife und offene Klärpunkte
```

Das Tool soll Budget- und Investitionsgespraeche von einer reinen Excel-Zahl auf die relevanten Annahmen verschieben: Was macht diese Massnahme wirtschaftlich, welche Annahmen sind belegt, welche sind Governance-Entscheidungen, und welche offenen Punkte blockieren eine belastbare Freigabe?

## Fachliche Grundsaetze

1. Nicht jede Budgetmassnahme braucht eine klassische Renditerechnung. Jede relevante Zusatzmassnahme braucht aber eine nachvollziehbare wirtschaftliche Wirklogik.

2. Die App ersetzt keine regulatorische Pruefung und keinen Beschluss. Sie erzeugt ein Entscheidungsartefakt, das Annahmen, Risiken, Evidenz und offene Klärpunkte transparent macht.

3. Portfolioeffekte duerfen nicht automatisch einzelnen Massnahmen zugerechnet werden. Attribution ist eine Governance-Annahme und muss sichtbar bleiben.

4. Q-Element-, Effizienz- und Risikoannahmen sind VNB-spezifisches Wissen. Die App assistiert bei Dokumentation und Strukturierung; sie behauptet nicht, diese Effekte objektiv aus einer Massnahme ableiten zu koennen.

5. Bei Gas ist KANU 2.0 ein wesentlicher Szenariohebel. Gleiche Massnahme, andere Abschreibungs- und Restwertpfade, andere zeitliche EOG-Wirkung.

6. Bei Strom ist Q-Element fachlich naheliegender als bei Gas; trotzdem gilt: kein Effekt ohne Kausalkette, Datenbasis, Vertrauensstufe und Governance-Status.

7. Ergebnis-/Controlling-Sicht ist indikativ. Handelsbilanz, Steuern, Eigenleistungen, Konzernumlagen und konkrete Entgeltsystematik muessen bei echten Entscheidungen mit dem Controlling uebergeleitet werden.

## Regulatorische Modelllogik

Der Rechenkern kennt zentrale Regulierungsperioden als Produktannahme:

- Gas RP4: 2023-2027, Kostenbasis 2020.
- Gas RP5: 2028-2032, Kostenbasis 2025.
- Strom RP4: 2024-2028, Kostenbasis 2021.
- Strom RP5: 2029-2033, Kostenbasis 2026.
- Folgeperioden werden in 5-Jahres-Schritten fortgeschrieben; die Kostenbasis liegt drei Jahre vor Periodenbeginn.

Wichtige Eingaben auf Spartebene:

- Sparte: Gas oder Strom.
- Verfahren: Standard oder vereinfacht. Im vereinfachten Verfahren werden Q-/Effizienzannahmen neutralisiert, soweit sie individuell nicht erloeswirksam werden.
- Basisjahr, bestehende EOG, regulatorisch gebundene Kapitalbasis.
- regulatorische Verzinsung, Fremdkapitalzins, Diskontsatz.
- KANU-Zieljahr und degressive KANU-AfA fuer Gas.
- Portfolio-Attribution sowie Q-/E-Delta auf Portfolioebene.
- Jahresarbeit und typischer Haushaltsverbrauch fuer indikative Tarifwirkung.

Wichtige Eingaben je Massnahme:

- Gesamtkosten, Startjahr, Nutzungsdauer.
- sicher aktivierbarer Anteil.
- unsicher aktivierbarer Anteil plus Eintrittswahrscheinlichkeit.
- OPEX-Anerkennung fuer nicht aktivierte Kosten.
- AfA-Szenario: normal, KANU linear, KANU degressiv.
- direkte Q-/E-/Risikowerte, falls separat begruendbar.
- laufende OPEX, OPEX-Delta, Reinvestitions- und Rueckbaukosten.
- HGB-Nutzungsdauer fuer Ergebnisbruecke.
- Strategie-/Zielzuordnung, Organisationseinheit, externe ID, Tags, Notizen.

## Wirkannahmen: der wichtigste fachliche Teil

Die Struktur `impactAssumptions` ist fachlich zentral. Sie verhindert, dass Q-, Effizienz-, Risiko- oder Portfolioeffekte als schwarze Magie in die Rechnung wandern.

Eine Wirkannahme dokumentiert:

- Wirkbereich: `qElement`, `efficiency`, `costBase`, `risk`, `portfolio`.
- Betrag oder bei Risiko: Wahrscheinlichkeit vorher/nachher und Schadenshoehe.
- Vertrauensstufe: `proven`, `assumption`, `review`.
- Governance-Status: `basis`, `sensitivity`, `excluded`.
- Zeitraum.
- Attribution.
- Kausalkette.
- Evidenztyp: Messung, Betriebserfahrung, Expertenschaetzung, Studie oder offen.
- Notiz.

Szenariologik:

- Basisszenario: beruecksichtigt belegte und plausibel als Basis gesetzte Annahmen, aber keine pruefpflichtigen Sensitivitaeten.
- Konservativ: nur belegte Basisannahmen; Attribution und Q-/E-Delta werden begrenzt.
- Wert-Szenario: kann pruefpflichtige Annahmen als Sensitivitaet einbeziehen.

Merksatz fuer Hermes: Wenn ein Effekt nicht sauber erklaert werden kann, ist er kein KPI, sondern ein Klärpunkt.

## Prozess, Rollen und Audit

Die App hat sich vom Rechner zum nachvollziehbaren Entscheidungsartefakt entwickelt.

Rollen:

- Modellverantwortung: Stammdaten, Massnahmen, Annahmen und Prozessstand pflegen.
- Management: Entscheidung, Szenariovergleich, offene Punkte und Report.
- Audit: Historie, Report, Konformitaetsuebersicht, Nachvollziehbarkeit.

Prozessphasen:

- Sammlung.
- Pruefung.
- Abstimmung.
- Entscheidungsvorlage.
- Freigabe.

Der Modellzustand wird mit History exportiert. `src/history.js` erzeugt semantische Events fuer Aenderungen an Stammdaten, Massnahmen, Wirkannahmen, Szenario, Rolle, Prozess und Klärpunkten. Beim Import kann die App erkennen, ob das importierte Modell neuer, aelter oder divergent zur lokalen Historie ist.

Das ist fachlich wichtig, weil Entscheidungsmodelle nicht nur Zahlen enthalten, sondern auch Verantwortlichkeit und Aenderungshistorie. Ein importiertes Excel-/JSON-Modell darf nicht stillschweigend lokale Arbeit ueberschreiben.

## Enterprise- und Controlling-Ausbau

Der aktuelle Stand enthaelt bereits Funktionen, die fuer groessere Portfolios und Budgetrunden gedacht sind:

- CSV-/Excel-Import fuer Massnahmenlisten.
- Spaltenmapping und Import-Pruefbericht.
- externe IDs zur Update-Erkennung statt Duplikatbildung.
- importierte Massnahmen koennen als unbestaetigt markiert werden.
- Katalog-CSV-Export.
- Filter nach Status, Organisation, Tags, aktiven Massnahmen und Importstatus.
- fachliche Sichten fuer Management, VNB/kaufmaennisch, Controlling und technische Klaerung.
- Entscheidungsreife mit Blockern und offenen Klärpunkten.
- Report mit Management-Zusammenfassung, Szenariovergleich, Wirkannahmen, Prozessstand, Event-Journal und Konformitaetsuebersicht.

Die Controlling-Sicht ist kein Ersatz fuer SAP/ERP oder Wirtschaftsplanung. Sie soll die regulatorische und HGB-nahe Bruecke sichtbar machen: Wann entstehen EOG-Wirkungen, wann HGB-Aufwand, wie gross ist der zeitliche Ergebnisunterschied, und welche Zusatzwirkungen sind wirklich tragfaehig?

## ISO-55001-/Asset-Management-Linie

Der Rechner ist anschlussfaehig an Asset-Management-Denken, ohne den Nutzer mit Normsprache zu erschlagen.

Die fachliche Linie:

- Jede Massnahme zahlt auf ein Ziel ein.
- Entscheidungen sollen lebenszyklusorientiert sein, nicht nur CAPEX-orientiert.
- Risiko, Performance, Kosten und Finanzierung gehoeren zusammen.
- Annahmen und Evidenz muessen nachvollziehbar bleiben.
- Der Report kann als dokumentiertes Entscheidungsartefakt im Asset-Management-System dienen.

ISO 55001 ist dabei kein Marketingetikett. Die App bildet konkrete Praktiken ab: Zielbezug, Lebenszyklusbetrachtung, Risikobewertung, dokumentierte Entscheidungsgrundlagen, Review-/Auditfaehigkeit.

## TWL-Kontext, der fachlich im Hintergrund steht

Das Repository ist generisch gehalten und enthaelt keine TWL-spezifischen Beispieldaten als Default. Das ist Absicht.

Der fachliche Ursprung liegt aber in TWL-Themen:

- Investitionsplanung 2027 ff. und No-Regret-/Mindestbedarf-Logik.
- Gasnetztransformation, Gruene Waerme, KANU, Restwert- und Rueckbaupfade.
- EOG-/IOG-/NEST-Wirkung und Finanzierungsspielraum.
- Governance-Frage: Wie werden Massnahmen entscheidbar, priorisierbar und gegenueber Management, Controlling und Regulierungsmanagement erklaerbar?
- Wechsel von "Budgettopf reicht/reicht nicht" zu "welche Massnahme ist regulatorisch-kaufmaennisch tragfaehig und warum?"

Wichtig fuer Hermes: Das Tool soll nicht behaupten, TWL habe frueher "Einnahmen ignoriert". Belastbarer ist die mildere, aber fachlich wichtige These: In den bisherigen Arbeitsstaenden gibt es starke Indizien, dass Massnahmen, Budgets und Kosten nicht durchgaengig als geschlossener regulatorisch-kaufmaennischer Wirkzusammenhang gesteuert wurden. Genau diese Luecke adressiert der Rechner.

## Nicht-Ziele und rote Linien

- Keine automatische regulatorische Wahrheit vortaeuschen.
- Keine echte Entgeltkalkulation ersetzen.
- Keine Massnahme allein wegen positivem IRR freigeben lassen.
- Keine Q-/E-/Risikoeffekte ohne Datenbasis oder Klärpunkt in harte Entscheidung verwandeln.
- Keine TWL-internen Daten fest in Demo- oder Defaultzustand einbauen.
- Keine Netzwerkabhaengigkeit einfuehren. Das Deliverable muss offline per Doppelklick laufen.
- Keine Telemetrie, externen Fonts, externen Skripte oder Requests.
- Keine localStorage-Daten als sicher gegen gemeinsam genutzte Rechner missverstehen; Browserdaten loeschen oder JSON-Export nutzen.

## Technische Leitplanken fuer weitere Arbeit

Vor fachlichen Aenderungen immer den bestehenden Rechenkern und die Tests lesen. Die App ist bewusst modular:

- Rechenlogik in `src/engine.js`.
- UI und Modellpersistenz in `src/ui.js`.
- Historie und Importvergleich in `src/history.js`.
- Verteilungs-/Trust-Pruefung in `scripts/check-distribution.mjs`.

Standardpruefung vor Commit:

```bash
npm run lint
npm test
npm run typecheck
npm run build:release
npm run test:distribution
npm run test:docs
```

Wenn ein neues Offline-Artefakt erzeugt werden soll:

```bash
npm run build:release
sha256sum dist/szenarienrechner-eog.html
```

Bei UI-Aenderungen zusaetzlich im Browser pruefen, insbesondere:

- Desktop und Mobile.
- Erststart.
- Demodaten laden.
- JSON-Export und Import.
- CSV-/Excel-Import.
- Massnahme bearbeiten.
- Wirkannahme bearbeiten.
- Rolle wechseln.
- Report drucken.
- Browserdaten loeschen.

## Gute naechste Schritte fuer Hermes

1. README und dieses Briefing lesen.
2. `src/engine.js` und `tests/engine.test.js` lesen, um die fachlichen Rechenentscheidungen zu verstehen.
3. `src/history.js` und `tests/history.test.js` lesen, um Import-/Audit-Logik zu verstehen.
4. Die App lokal starten und einen kompletten Entscheidungsfall durchspielen:

```bash
npm ci
npm run dev
```

5. Danach erst neue Fachfeatures ableiten.

Moegliche naechste Produktlinien:

- bessere Plausibilitaetschecks fuer Portfolio-Attribution und Doppelzaehlung.
- explizitere Bruecke zwischen regulatorischer EOG und HGB-/Controlling-Perspektive.
- Importprofile fuer reale Budgetlisten, ohne Defaults mit Kundendaten zu vermischen.
- Reportvarianten fuer Management, VNB/Regulierungsmanagement, Controlling und Audit.
- staerkere Nachverfolgung offener Klärpunkte bis zur Entscheidung.

## Kurzform fuer die Uebergabe

Hermes sollte den Rechner als Governance-Werkzeug verstehen:

```text
Nicht: "Welche Massnahme bringt wie viel Rendite?"

Sondern:
"Welche Massnahme wird unter welchen regulatorischen, kaufmaennischen und Governance-Annahmen entscheidungsfaehig?"
```

Der Wert des Tools liegt weniger in einer einzelnen Kennzahl als in der disziplinierten Offenlegung der Annahmen. Wenn Hermes diese Linie beibehält, kann das Repository technisch weiter wachsen, ohne fachlich in falsche Sicherheit abzurutschen.
