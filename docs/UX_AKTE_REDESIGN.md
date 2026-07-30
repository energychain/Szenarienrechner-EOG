# UX-Redesign: Akte statt Rechner

## Zielbild

Der Szenarienrechner wird als digitale, präsentier- und auditierbare Akte je Sparte geführt. Die App soll ohne Schulung nutzbar sein: Der Nutzer sieht zuerst Arbeitsstand, Einschätzung, Klärpunkte und nächsten Schritt, nicht die interne Modulstruktur.

## Leitplanken

- Keine View soll im Normalzustand die gesamte Seite scrollen lassen. Lange Inhalte laufen in klar begrenzten Arbeitsflächen, Tabellen, Kanban-Spalten, Modals oder Detail-Drawern.
- Ein Screen hat einen Hauptzweck und wenige primäre Aktionen.
- Farben sind semantisch: Blau = Akte/Orientierung, Grün = belegt, Amber = prüfpflichtig, Rot = Konflikt, Violett = Evidenz/Kontextobjekte, Petrol = Systeme/Rückspielweg, Grau = Kontext ohne Rechenwirkung.
- Text wird durch Karten, Diagramme, Checklisten, Kanban und Präsentationsfolien ersetzt, wo dies Orientierung verbessert.
- Jede Einschätzung bekommt einen Sprung zur Ursache: Maßnahme, Klärung, Evidenz, Report, Detailanalyse oder Export.
- Fachhilfe ist klick- und tastaturfähig; zentrale Begriffe sind im Glossar nachschlagbar.
- Fehlertoleranz geht vor reiner Bestätigung: reversible Aktionen erhalten Undo, echte Danger-Zone-Aktionen verlangen bewusste Texteingabe.

## Aktuelle Hauptnavigation

1. Akte
2. Grundlagen
3. Bearbeiten
4. Evidenz & Systeme
5. Prüfen & Klären
6. Präsentation
7. Export

## Support-Tabs

- Entscheidung im Detail
- Projektplan

Die Support-Tabs sind bewusst erreichbar, ohne wieder einen versteckten Werkzeugbereich einzuführen. Entscheidung im Detail dient der vertieften Analyse. Projektplan dient der operationalisierten Userstory und der Rückspiegelung von Klärfällen.

## Akten-Cockpit

Das Cockpit beantwortet in kurzer Zeit:

- Was ist diese Akte?
- Ist der Stand belastbar?
- Welche Klärungen sind offen?
- Welche Evidenz- und Systemrückspielpunkte fehlen?
- Welche Kennzahlen sind für die Befassung relevant?
- Was ist der nächste sinnvolle Schritt?

Statusanzeigen werden nicht mehrfach ausgespielt. Der Arbeitsstand-Score, offene Klärpunkte und die nächste Aktion bilden die primäre Orientierung.

## Navigation und Suche

Die Navigation ist flach, aber nicht blind: alle Views sind aus dem Arbeitsfluss oder über Support-Tabs erreichbar. Zusätzlich bietet die globale Suche / Command-Palette einen direkten Einstieg zu Views, Feldern, Maßnahmen, Klärpunkten, Kontextobjekten und Menüaktionen. Strg/Cmd+K öffnet die Suche.

## Prüfen und Klären

Das Kanban strukturiert offene Punkte in Hohe Steuerungswirkung, Evidenz / Systeme, Dokumentation und Geklärt. Maßnahmenbezogene Klärfälle öffnen die Befassungs-Workbench: links Datenbearbeitung, rechts Befassungsnotiz und Abschlusslogik. Kontextobjektbezogene Klärfälle führen nach Evidenz & Systeme.

## Präsentationsmodus

Die Akte kann als folienartige Befassungsansicht gezeigt werden. Präsentation und Bearbeitung sind verlinkt: Von einer Folie kann in die Bearbeitung gesprungen werden, danach zurück zur Präsentation.

## Hilfe und Glossar

Info-Dots sind keine `title`-Hovertexte mehr. Sie öffnen zugängliche Popovers, deren Inhalte sichtbar, kopierbar und per Tastatur erreichbar sind. Passende Begriffe können direkt im Glossar geöffnet werden.

Das Glossar erklärt zentrale Begriffe wie EOG, RAB, QE, KANU, ARegV, Befassung, Klärpunkt, Attribution, No-Regret, Kontextobjekt und Entscheidungsreife. Es ist über das Mehr-Menü und per Deep-Link `#glossar/<begriff>` erreichbar.

## Fehlertoleranz

Destruktive, aber reversible Aktionen legen Undo-Snapshots an. Dazu gehören Zurücksetzen, Demodaten laden, Bulk-Aktionen und einzelne Maßnahmenlöschungen. Browserdaten löschen ist eine abgesicherte Danger-Zone-Aktion mit Eingabe von „LÖSCHEN“.

TEUR-Eingaben werden tolerant geparst und im deutschen Zahlenformat angezeigt. Plausibilitätswarnungen erscheinen inline am Feld und blockieren die Berechnung nicht.

## Qualitätskontrolle

Die Element-Inventarliste dient weiterhin als Regressions-Checkliste. Nach UX-Änderungen wird geprüft, dass Views, globale Aktionen, Modals, Suche, Glossar, Undo, Validierung und offline-first Exportwege erreichbar bleiben.
