# Szenarienrechner-EOG Model Overview

Szenarienrechner-EOG rechnet geplante Massnahmen regulierter Sparten in einer gemeinsamen EOG-, Rendite- und Finanzierungslogik. Dieses Dokument beschreibt das Modellverstaendnis, nicht eine verbindliche regulatorische Auslegung. Details und Grenzen stehen in `REGULATORY_ASSUMPTIONS.md`.

## Ziel des Modells

Das Modell soll Massnahmenportfolios vergleichbar machen:

- erwartete Wirkung auf Erlösobergrenze,
- regulatorische Aktivierung und Abschreibung,
- Kapitalbindung und Finanzierungskosten,
- Risiko-, Qualitaets- und Effizienzannahmen,
- OPEX-, Lifecycle-, Rueckbau- und Reinvestitionspfade,
- Entscheidungsreife und Governance-Status.

Es ersetzt keine Rechts- oder Regulierungsberatung und keine unternehmensspezifische Bescheidpruefung.

Nicht jede Budgetmassnahme braucht eine klassische Renditerechnung. Relevante Zusatzmassnahmen brauchen aber eine nachvollziehbare wirtschaftliche Wirklogik: Welche Annahme macht die Massnahme entscheidungsfaehig, welche Evidenz stuetzt sie, und welcher Klärpunkt bleibt offen?

## Zentrale Eingaben

### Basisdaten

- Sparte: Strom oder Gas.
- Regulierungsverfahren: Standard oder vereinfachtes Verfahren.
- Startjahr und Betrachtungshorizont.
- bestehende Erlösobergrenze und regulierte Kapitalbasis.
- Zinssaetze, Jahresarbeit und weitere Portfolioannahmen.

### Massnahmen

- Kosten und Inbetriebnahmejahr.
- sicher aktivierbarer und unsicher aktivierbarer Anteil.
- Wahrscheinlichkeit des unsicheren Anteils.
- Nutzungsdauer und Abschreibungspfad.
- OPEX-Anerkennung, Lifecycle-OPEX, Rueckbau und Reinvestition.
- qualitative oder quantitative Wirkannahmen.

### Szenarien

Die App arbeitet mit Szenarien wie konservativ, Basis und Wert. Szenarien dienen dazu, Unsicherheit sichtbar zu machen, nicht Scheingenauigkeit zu erzeugen.

## Wirkannahmen

Wirkannahmen werden explizit modelliert, damit sie auditierbar bleiben. Typische Kategorien sind:

- Qualitaetselement,
- Effizienz,
- Kostenbasis,
- Risiko,
- Portfolioeffekt.

Jede Annahme soll nachvollziehbar machen:

- was angenommen wird,
- ob sie belegt, angenommen oder pruefpflichtig ist,
- ob sie in der Berechnung aktiv ist oder nur dokumentiert wird,
- welche Evidenz oder Quelle dahinter steht.

Wenn ein Effekt nicht sauber erklaert werden kann, ist er kein Ergebnis-KPI, sondern ein Klärpunkt. Portfolioeffekte duerfen nicht stillschweigend einzelnen Massnahmen zugerechnet werden; Attribution ist selbst eine Governance-Annahme.

## Vereinfachtes Verfahren

Beim vereinfachten Verfahren werden individuelle Q- und Effizienzeffekte vorsichtig behandelt. Die App dokumentiert Annahmen weiter, rechnet sie aber nicht automatisch als individuelle Erlöswirkung, wenn der gewaehlte Verfahrenskontext das nicht traegt.

## Gas/KANU-Kontext

Gasbezogene Szenarien koennen beschleunigte Abschreibungs-, Rueckbau- und Transformationspfade brauchen. Die App bildet solche Pfade als Planungsannahmen ab. Produktive Verwendung muss gegen den jeweils aktuellen regulatorischen Stand und konkrete Bescheide geprueft werden.

## Ergebnisse

Das Modell erzeugt unter anderem:

- Jahreswirkung je Massnahme und Szenario,
- Portfoliowerte,
- Kapitalwert- und Renditeindikatoren,
- indikative Tarif-/Haushaltswirkung,
- Governance- und Entscheidungsindikatoren.

Die Ergebnis- und Controlling-Sicht ist indikativ. Handelsbilanz, Steuern, Eigenleistungen, Umlagen, konkrete Entgeltsystematik und unternehmensspezifische Bescheide muessen fuer produktive Entscheidungen separat uebergeleitet werden.

## Technische Abgrenzung

Der DOM-freie Rechenkern liegt in `src/engine.js`. UI, Import, Report und lokale Speicherung liegen in `src/ui.js` und sollen schrittweise modularisiert werden. Rechenlogik soll testbar bleiben und nicht implizit in UI-Rendering wandern.
