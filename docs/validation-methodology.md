# TRL-6-Validierung: real-but-private Benchmarkfall

Der Szenarienrechner-EOG ist technisch als deterministischer TRL-5-Prototyp belastbar. Der Sprung zu TRL 6 entsteht nicht durch weitere UI-Funktionen, sondern durch einen kontrollierten Abgleich mit einer realen regulierten Sparte. Diese Seite beschreibt den Prozess, ohne vertrauliche Daten in das öffentliche Repository zu bringen.

## Ziel der Validierung

Die Validierung beantwortet drei Fragen:

1. Bildet das Modell die interne Finanzplanungslogik eines kleinen oder mittleren VNB nachvollziehbar ab?
2. Sind Abweichungen gegenüber Wirtschaftsplan, EOG-Bescheid, Kostenprüfung oder internen Regulierungsunterlagen erklärbar?
3. Welche Modellgrenzen müssen vor produktiver Nutzung fachlich freigegeben oder bewusst als Vereinfachung akzeptiert werden?

Das Ergebnis ist keine regulatorische Anerkennungsprognose. Es ist ein fachliches Prüfprotokoll zur Eignung des Werkzeugs als Entscheidungs- und Strukturierungshilfe.

## Grundsatz: privat rechnen, öffentlich nur Methodik zeigen

Kurzregel: keine vertraulichen Daten im öffentlichen Repository, keine realen Netzbetreiberbezüge in Beispielen und keine Veröffentlichung interner Bescheid-, Kostenprüfungs- oder Wirtschaftsplandetails.

Für den Benchmarkfall werden echte Daten ausschließlich lokal oder in einem geschützten Arbeitsraum verarbeitet. Im öffentlichen Repository landen nur:

- die Validierungsmethodik,
- anonymisierte Abweichungstypen,
- generische Lessons Learned,
- gegebenenfalls synthetische Nachbildungsfälle.

Nicht veröffentlicht werden:

- Name des Netzbetreibers,
- echte EOG-, Kostenprüfungs- oder Wirtschaftsplandaten,
- interne Projektlisten,
- Bescheidinhalte, soweit nicht ohnehin öffentlich,
- vertrauliche Annahmen, Preise, Mengen, Zustandsdaten oder Gremienunterlagen.

## Benötigte Unterlagen

| Unterlage | Typischer Lieferant | Nutzung im Benchmark | Veröffentlichung |
| --- | --- | --- | --- |
| Wirtschaftsplan / Investitionsplan | Controlling | Budget-, CAPEX-/OPEX- und Zeitlogik prüfen | nein |
| Maßnahmenliste / Projektsteckbriefe | Asset Management / Technik | Maßnahmenstruktur, Startjahr, Lebensdauer, Risiken | nur synthetisch |
| Anlagenbuchhaltung / AfA-Informationen | Anlagenbuchhaltung | Aktivierung, Nutzungsdauer, HGB-Brücke | nein |
| EOG-Bescheid / Regulierungsdaten | Regulierungsmanagement | Erlösobergrenze, Kapitalbasis, Verfahren, Periodenlogik | nein |
| Kostenprüfung / interne Regulierungsunterlagen | Regulierungsmanagement | Anerkennungslogik und Abweichungsanalyse | nein |
| Finanzierungsannahmen | Finanzen / Treasury | FK-Zins, Diskontsatz, Renditeschwelle | aggregiert möglich |
| Gremienkalender und Beschlusslogik | Geschäftsführung / Sekretariat | Entscheidungsvorlage, Fristen, Freigaben | generisch |

## Validierungsschritte

### 1. Scope festlegen

Eine Sparte wird ausgewählt: Strom oder Gas. Der Benchmark sollte zunächst bewusst klein sein, zum Beispiel ein Maßnahmencluster oder eine Budgetrunde, nicht das gesamte Unternehmen.

Zu dokumentieren:

- Sparte und Regulierungsverfahren,
- Bezugsjahr und relevante Regulierungsperiode,
- Umfang der Maßnahmen,
- verwendeter Modellstand mit Build-Commit,
- Verantwortliche Rollen.

### 2. Daten in das Modell übertragen

Die Eingaben werden aus den vertraulichen Unterlagen in ein lokales Modell überführt. Jede Annahme erhält eine Herkunft:

- belegt,
- Annahme,
- prüfpflichtig,
- bewusst ausgeschlossen.

Unklare Werte werden nicht geschätzt, um eine grüne Ampel zu erreichen. Sie bleiben Klärpunkte.

### 3. Vergleichsgrößen definieren

Mindestens zu vergleichen sind:

- Investitionssumme und aktivierbarer Anteil,
- HGB-/AfA-Sicht,
- modellierte regulatorische EOG-Wirkung,
- indikative Cashflow- und Kapitalwertsicht,
- laufende Wirkung vs. Einmaleffekte,
- konservatives Urteil ohne prüfpflichtige Wirkannahmen.

Optional:

- Tarif-/Jahresarbeitswirkung,
- Reinvestitions-/Rückbauszenario,
- Portfolio-Attribution und Doppelzählungswarnungen.

### 4. Abweichungen klassifizieren

Abweichungen werden nicht sofort als Fehler bewertet. Sie werden einer Ursache zugeordnet:

| Abweichungstyp | Beschreibung | Folgerung |
| --- | --- | --- |
| Datenqualität | Wert fehlt, ist veraltet oder uneinheitlich | Klärpunkt oder Datenanforderung |
| Modellgrenze | App vereinfacht bewusst | dokumentieren oder Advanced-Modus bauen |
| Timing | Verzug zwischen Planung, Regulierung und Wirkung | Wirkungsverzug prüfen |
| Anerkennungslogik | fachliche/regulatorische Spezialfrage | fachliche Freigabe erforderlich |
| Governance | Annahme trägt Ergebnis, ist aber nicht belegt | gelbe Auflage, nicht grün |

### 5. Fachliche Freigabe

Mindestens diese Rollen sollten das Protokoll prüfen:

- Controlling für Wirtschaftsplan-/Budgetlogik,
- Regulierungsmanagement für EOG-/Anerkennungslogik,
- Anlagenbuchhaltung für Aktivierung und Nutzungsdauer,
- Asset Management für technische Plausibilität,
- Management oder Projektsteuerung für Entscheidungsreife.

Eine fachliche Freigabe bedeutet nicht, dass die App eine Rechtsberatung ersetzt. Sie bedeutet: Die verwendete Modellkonvention ist für diesen Benchmark transparent, nachvollziehbar und als Entscheidungsgrundlage geeignet oder mit Einschränkungen geeignet.

## Ergebnisformat

Das Ergebnis sollte in einem Validierungsprotokoll festgehalten werden. Die Vorlage liegt unter `docs/templates/validation-protocol.md`.

Mögliche Abschlussurteile:

- geeignet für strukturierte Entscheidungsunterstützung,
- eingeschränkt geeignet mit dokumentierten Modellgrenzen,
- nicht geeignet ohne weitere Modellanpassungen,
- fachliche Freigabe offen.

## Öffentliche Kommunikation

Öffentlich kommunizierbar ist nur die Methodik und eine anonymisierte Reifegrad-Aussage, zum Beispiel:

> Das Modell wurde gegen einen real-but-private Benchmarkfall geprüft. Abweichungen wurden nach Datenqualität, Timing, Modellgrenze und Anerkennungslogik klassifiziert. Vertrauliche Daten wurden nicht veröffentlicht.

Nicht öffentlich kommunizierbar sind konkrete Zahlen, echte Maßnahmen, Bescheiddetails oder interne Entscheidungen.
