# Starter-Kit: Strom-Ortsnetz / Trafostation

Dieses Starter-Kit beschreibt eine synthetische Planungsrunde für eine Strom-Verteilnetzmaßnahme: Ersatz oder Verstärkung einer Trafostation mit Fernwirkfähigkeit und begleitender Ortsnetzertüchtigung.

## Typische Ausgangslage

Ein kleines Stadtwerk sieht steigende Anschlussleistung, alternde Betriebsmittel und höhere Anforderungen an Beobachtbarkeit und Fernsteuerung. Die Maßnahme ist technisch plausibel, muss aber in Wirtschaftsplan, HGB-/Aktivierungslogik, regulatorische Wirkung und Gremienvorlage übersetzt werden.

## Workshop-Ziel

Am Ende des Workshops liegt ein entscheidungsfähiger Arbeitsstand vor:

- Maßnahmensteckbrief mit Kosten, Inbetriebnahmejahr und Aktivierbarkeit
- dokumentierte Datenquellen für Jahresarbeit, Kapitalbasis und Budget
- Wirkannahmen zu Versorgungssicherheit, Effizienz und Risiko mit Vertrauensstufe
- EOG-/Cashflow-Überleitung und konservatives Urteil
- Projektplan mit Verantwortlichen, Fristen und offenen Klärpunkten

## Datenanforderung

| Datenpunkt | Typischer Lieferant | Verwendung in der App | Klärpunkt, falls offen |
| --- | --- | --- | --- |
| Maßnahmenkosten und Terminplan | Projektleitung / Einkauf | Kosten, Jahr, Reinvest-/Rückbauannahmen | Kostenstand und Vergabeunsicherheit |
| Aktivierbarer Anteil | Anlagenbuchhaltung | secure / uncertain / probability | HGB- und regulatorische Sicht trennen |
| Jahresarbeit | Controlling / Vertrieb | indikative Tarifwirkung | Quelle und Bezugsjahr dokumentieren |
| Kapitalbasis / EOG-Referenz | Regulierung | regulatorische Einordnung | Bescheid-/Planwert abgrenzen |
| Störungs-/Qualitätsdaten | Netzbetrieb | Q-/Risikowirkung | keine Q-Wirkung ohne Evidenz verhärten |

## Empfohlene App-Schritte

1. Demodaten oder eigenen Arbeitsstand laden.
2. Im Projektplan Meilenstein „Maßnahmenbewertung“ öffnen.
3. Maßnahme anlegen oder Demomaßnahme „Ersatz Trafostation“ nutzen.
4. CAPEX/OPEX-Split-Helfer verwenden und Aktivierbarkeit als prüfpflichtig dokumentieren.
5. Risiko-Erwartungswert nur übernehmen, wenn Eintrittswahrscheinlichkeit und Schadenshöhe plausibilisiert sind.
6. Ergebnisse in der EOG-/Cashflow-Überleitung prüfen.
7. Gelbe Ampel als „Freigabe mit Auflage“ formulieren, falls konservativ negativ.

## Entscheidungsartefakte

- Maßnahmensteckbrief: `docs/templates/massnahmensteckbrief.html`
- Klärpunktliste: `docs/templates/klaerpunktliste.html`
- Gremienvorlage: `docs/templates/gremienvorlage.html`
- Validierungsprotokoll, wenn echte Daten genutzt werden: `docs/templates/validation-protocol.html`

## Beraterhinweis

Die Strom-Maßnahme sollte nicht nur als „EOG erhöhend“ erklärt werden. Entscheidend ist die Brücke zwischen technischer Notwendigkeit, Budgetbindung, aktivierter Kapitalbasis, laufender EOG-Wirkung, indikativer Cashflow-Sicht und den noch offenen Evidenzfragen.
