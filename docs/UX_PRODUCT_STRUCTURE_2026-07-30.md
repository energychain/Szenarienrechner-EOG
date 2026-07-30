# Digitale Akte: Produktstruktur nach Usability-Reviews

Stand: 30.07.2026 · aktualisiert nach CR-01 bis CR-05

Dieses Konzept übersetzt die Usability-Reviews in die aktuelle produktnahe Struktur der Anwendung. Die Anwendung bleibt offline-first und eine neutrale Open-Source-Arbeitsakte. Sie nennt keine Herkunftsorganisation und überträgt keine Daten automatisch.

## Leitbild

Die App ist nicht mehr nur Rechner, sondern eine digitale Akte für regulierte Sparten. Sie verbindet Stammdaten, Maßnahmen, Kontextobjekte, Stresstest, Befassungen, Projektplan, Präsentation und Export. Die Bedienung folgt einem primären Arbeitsfluss mit sichtbaren Support-Tabs statt konkurrierenden versteckten Werkzeugbereichen.

## Aktuelle Navigation

Primärer Arbeitsfluss:

1. Akte: Orientierung, Arbeitsstand-Score, Einschätzung, nächster Schritt.
2. Grundlagen: Stammdaten, Phase, Szenario, Stresstest-Parameter und Projektkontext.
3. Bearbeiten: Maßnahmenkatalog und Maßnahmeneditor.
4. Evidenz & Systeme: Kontextobjekte, Datenqualität, Systemreferenzen und wirtschaftliche Überleitung.
5. Prüfen & Klären: deterministisches Kanban mit Befassungs-Workbench.
6. Präsentation: fokussiertes Befassungsfenster.
7. Export: Report, Prompt, Tabellen und Offline-Artefakte.

Support-Tabs:

- Entscheidung im Detail: vertiefte Kennzahlen, Szenariovergleich, Diagramme und Rechenweg-Drilldown.
- Projektplan: Userstory-basierter Arbeitsplan, Rollen, Aufgaben, Abhängigkeiten und Rückspiegelung aus Klärfällen.

Die früheren versteckten Detailwerkzeuge werden nicht mehr als separater aufgeklappter Werkzeugbereich geführt. Entscheidung im Detail und Projektplan sind seit CR-01 wieder direkt erreichbar, bleiben aber als Support-Tabs dem Aktenarbeitsfluss untergeordnet.

## Phase 1: Navigation und Orientierung

- Grundlagen ist Teil der Hauptnavigation, weil Stammdaten und Szenarioannahmen für Erstnutzer zentral sind.
- Entscheidung im Detail und Projektplan sind als Support-Tabs erreichbar und haben konsistente aktive Tab-Zustände.
- Sprünge aus Karten oder Projektplanaufgaben führen nicht mehr in verwaiste Views.
- Eine globale Suche / Command-Palette ist im Header verfügbar und per Strg/Cmd+K erreichbar.
- Die Suche findet Views, Feldlabels, Maßnahmen, Klärpunkte, Kontextobjekte und Menüaktionen. Treffer können zugeklappte Bereiche öffnen, Expertenfelder sichtbar machen und das Ziel fokussieren.
- Die Prozessnotiz ist einklappbar; Sticky-KPIs werden beim Scrollen kompakter, damit mehr Arbeitsfläche bleibt.

## Phase 2: Statusanzeigen deduplizieren

- Reifegrad und Klärpunktzahl werden primär im Akten-Cockpit und in der kompakten Statusführung gezeigt.
- Tab-Badges vermeiden kryptische Zahlenkolonnen und werden nur dort verwendet, wo sie eine klare Bedeutung haben.
- Die Sticky-KPI-Leiste ist nicht mehr als dauerhafte Vollanzeige auf jeder Scrollposition gedacht, sondern kollabiert in einen kompakteren Arbeitsmodus.
- Verdict wird in der UI als Einschätzung bezeichnet.

## Phase 3: Sicheres Bearbeiten und Undo

- Destruktive Aktionen legen vor Ausführung interne Undo-Snapshots an, soweit sie fachlich rückgängig gemacht werden können.
- Rückgängig ist umgesetzt für Zurücksetzen, Demodaten laden, Bulk-Aktionen und einzelne Maßnahmenlöschungen.
- Browserdaten löschen bleibt eine echte Danger-Zone-Aktion und erfordert die Eingabe von „LÖSCHEN“.
- Import, Export, Undo und Speichern melden Ereignisse per Toast. Die Statuszeile beschreibt nur noch den persistenten lokalen Arbeitsstand.
- TEUR-Felder verwenden tolerantes Parsing und de-DE-Anzeige; interne Werte bleiben numerisch.
- Plausibilitätswarnungen werden inline am Feld angezeigt und blockieren die Rechnung nicht.

## Phase 4: Hilfe, Tastatur und Barrierefreiheit

- Wichtige Fachhilfe wird nicht mehr ausschließlich über `title`-Tooltips transportiert.
- Info-Dots öffnen zugängliche Popovers per Klick, Touch, Enter oder Space; Escape und Außenklick schließen sie.
- Popovers können auf passende Glossarbegriffe verlinken.
- Das Glossar ist lokal im Bundle enthalten und per Menü sowie `#glossar/<begriff>` erreichbar.
- Es gibt einen Skip-Link zum Hauptinhalt.
- Modals erhalten zentrale Fokusführung: Fokus wird beim Öffnen in den Dialog gesetzt, Tab bleibt im Dialog, Escape schließt, und der Fokus kehrt zum Auslöser zurück.
- Karten und Sprungziele mit Button-Rolle reagieren auf Enter und Space.
- Tabellenköpfe und Formularfelder werden semantisch gehärtet; `prefers-reduced-motion` wird berücksichtigt.

## Umsetzungsgrenze

Diese Produktstruktur ändert keine EOG-, IRR-, NPV-, Stresstest- oder KPI-Formeln. Die vollständige Entmodalisierung des großen Maßnahmeneditors bleibt ein eigener größerer Umbau. Der aktuelle Stand verbessert Navigation, Orientierung, Fehlertoleranz, Hilfe und Barrierefreiheit, ohne die fachliche Rechenlogik neu zu schneiden.
