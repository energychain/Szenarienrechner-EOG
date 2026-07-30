# Digitale Akte: Zielstruktur nach Usability-Review

Stand: 30.07.2026

Dieses Konzept übersetzt das Usability-Review in eine produktnahe Zielstruktur. Die Anwendung bleibt offline-first und eine neutrale Open-Source-Arbeitsakte. Sie soll keine Herkunftsorganisation nennen und keine Daten automatisch übertragen.

## Leitbild

Die App ist nicht mehr nur Rechner, sondern eine digitale Akte für regulierte Sparten. Sie verbindet Stammdaten, Maßnahmen, Evidenz, Stresstest, Befassungen, Projektplan und Export. Die Bedienung folgt deshalb einem einzigen Arbeitsfluss statt konkurrierenden Navigationsebenen.

## Zielstruktur

Primärer Arbeitsfluss:

1. Akte: Orientierung, Arbeitsstand-Score, nächster Schritt.
2. Grundlagen: Stammdaten, Phase, Szenario und Stresstest-Parameter.
3. Bearbeiten: Maßnahmenkatalog und Maßnahmen-Workspace.
4. Evidenz & Systeme: Kontextobjekte, Datenqualität, Systemreferenzen und wirtschaftliche Überleitung.
5. Prüfen & Klären: deterministisches Kanban mit Befassungs-Workbench.
6. Präsentation: fokussiertes Befassungsfenster.
7. Export: Report, Prompt, Tabellen und Offline-Artefakte.

Nicht mehr als eigene Navigationsebene geführt werden Detailwerkzeuge. Entscheidung im Detail und Projektplan bleiben erreichbar, aber sie sind Arbeitsbestandteile: Detailanalyse über Akte/Präsentation/Export, Projektplan über Akte und Prüfen & Klären.

## Phase 1: Eine Navigationsebene

- Grundlagen wird in die Hauptnavigation aufgenommen, weil Stammdaten und Szenarioannahmen für Erstnutzer zentral sind.
- Der aufgeklappte Detailwerkzeuge-Bereich entfällt.
- Das Header-Phase-Popover zeigt den Stand nur noch kompakt. Die Bearbeitung von Phase, nächstem Schritt, Zuständigkeit und Fälligkeit wandert nach Grundlagen.
- Report, Präsentation und Detailanalyse erhalten klarere Anlässe: Präsentation für Befassung, Export für Übergabe, Akte für Orientierung.

## Phase 2: Statusanzeigen deduplizieren

- Reifegrad und Klärpunktzahl werden primär im Akten-Cockpit geführt.
- Tab-Badges zeigen Zweck/Ort statt kryptischer Live-Zahlen.
- Sticky-KPI wird nicht mehr auf jeder Ansicht gezeigt, sondern nur dort, wo Kennzahlen wirklich ausgewertet oder exportiert werden.
- Verdict wird in der UI als Einschätzung bezeichnet.

## Phase 3: Sicheres Bearbeiten und Undo

- Bulk-Aktionen erhalten ein kurzzeitiges Rückgängig-Angebot.
- Destruktive Aktionen werden im Mehr-Menü gruppiert und mit Konsequenzbeschreibung bestätigt.
- Import, Export, Bulk und Speichern melden sich als deutlicher Toast, nicht nur als kleine Statuszeile.
- Der Maßnahmen-Editor wird als Arbeitsbereich vorbereitet: Für schnelle Klärfälle bleibt das Split-Modal geeignet, für freie Bearbeitung gibt es einen sichtbaren Workspace-Einstieg.

## Phase 4: Hilfe, Tastatur und Barrierefreiheit

- Wichtige Hilfe wird als sichtbare Inline-Hilfe angeboten, nicht nur als title-Tooltip oder i-Zeichen.
- Präsentation unterstützt Pfeiltasten.
- Modals behalten sichtbare Schließen-Aktionen; Fokusmanagement bleibt zu prüfen und in Folge-PRs auszubauen.
- Fachbegriffe werden im sichtbaren UI-Kontext erklärt: Kontextobjekte, Einschätzung, Stresstest, Befassung und wirtschaftliche Überleitung.

## Umsetzungsgrenze dieser Iteration

Diese Iteration ist ein Produktstruktur-Schritt. Sie ändert keine EOG-, IRR-, NPV-, Stresstest- oder KPI-Formeln. Größere Entmodalisierung des vollständigen Maßnahmeneditors bleibt als eigener Umbau möglich, wird hier aber zunächst mit einem Workspace-Einstieg und klarerer Bedienlogik vorbereitet.
