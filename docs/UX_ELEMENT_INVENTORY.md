# UI-Element-Inventar der Digitalen Akte

Diese Liste dient als Regressions-Checkliste für die aktuelle Akte-UX. Sie ersetzt das frühere Vor-Redesign-Inventar und soll nach größeren UX-Änderungen mit der Implementierung abgeglichen werden.

## View-Panels

### Primärer Arbeitsfluss

- `akte` — Akten-Cockpit als primärer Einstieg
- `basis` — Grundlagen, Stammdaten, Szenario und Stresstest-Parameter
- `measures` — Maßnahmenkatalog und Maßnahmenbearbeitung
- `sidecar` — Evidenz & Systeme / Kontextobjekte
- `expertWork` — Prüfen & Klären / Kanban / Befassungs-Workbench
- `presentation` — folienartiger Präsentationsmodus
- `report` — Export, Report, Prompt und Offline-Artefakte

### Support-Tabs

- `results` — Entscheidung im Detail, Kennzahlen, Klärpunkte, Diagramme, Jahrestabelle
- `projectPlan` — Projektplan Planungsrunde

## Navigation und Orientierung

- Hauptnavigation: Akte, Grundlagen, Bearbeiten, Evidenz & Systeme, Prüfen & Klären, Präsentation, Export
- Support-Tabs: Entscheidung im Detail, Projektplan
- Sichtbarer aktiver Tab-Zustand auch nach Jump-Links
- Breadcrumb-/Rückweg für unterstützende Detailansichten
- Globale Suche im Header: `#globalSearch`
- Command-Palette: `#commandPalette`
- Tastenkürzel Strg/Cmd+K
- Skip-Link: „Zum Inhalt“ mit Ziel `#mainContent`
- Einklappbare Prozessnotiz: `#processNotice`
- Kompakte Sticky-KPI-Leiste beim Scrollen

## Globale Aktionen

### Direkt sichtbar oder über Header erreichbar

- Daten laden
- Daten herunterladen
- HTML mit Daten speichern
- Mehr-Menü öffnen
- Globale Suche öffnen
- Klärpunktliste / offene Punkte erreichen

### Mehr-Menü: Export

- Daten herunterladen
- XLSX exportieren
- CSV-ZIP exportieren
- Report drucken

### Mehr-Menü: Hilfe & Kontext

- Hilfe
- Glossar
- Userstory
- Methodik & Vorlagen
- KI-Prompt erstellen
- Aktualität prüfen
- Feedback / Support melden
- Support-Paket exportieren

### Mehr-Menü: Arbeitsstand ersetzen oder löschen

- Demodaten laden
- Zurücksetzen
- Browserdaten löschen

## Fachliche Arbeitsbereiche

- Rollenwahl
- Prozessphase, Zieltermin, Arbeitsstand, nächster Schritt, Zuständigkeit, Fälligkeit
- Akten-Cockpit mit Arbeitsstand-Score, Einschätzung und nächstem Schritt
- Basisdaten Sparte
- Strategische Ziele
- Szenarioannahmen
- Konservativer Stresstest / Stresstest-Parameter
- Portfolio-Wirkung
- Maßnahmenkatalog mit Suche, Filtern, Schnelllisten und Bulk-Aktionen
- Maßnahmen-Editor mit Grunddaten, Monitoring, Systemreferenzen, Risiko-Mapping, Strom-Flexibilität, EEG 2027 / Netzanschluss, Lebenszyklus, Gas-Transformationspfad, Wirkannahmen, Notiz und Drilldown
- Prüfen & Klären mit Kanban-Spalten: Hohe Steuerungswirkung, Evidenz / Systeme, Dokumentation, Geklärt
- Befassungs-Workbench: Maßnahme links, Befassung rechts
- Kontextobjekte / Evidenzlage
- Systemreferenzen und Rückspielwege
- Projektplan mit Rollen, Aufgaben, Abhängigkeiten und Statuslogik
- Entscheidung im Detail
- Kernkennzahlen und erweiterte Kennzahlen
- EOG-/Cashflow-Überleitung
- Belastbarkeit des Arbeitsstands
- Wasserfall, Tornado, EOG-Zerlegung
- Änderungsübersicht
- Jahresdiagramm, Szenariovergleich, Jahrestabelle
- Präsentationsfolien
- Report / Befassungsvorlage
- KI-Arbeitsauftrag / Prompt-Generator

## Modals und Dialoge

- Impressum
- Wizard
- Daten laden
- Neue Maßnahme anlegen
- Maßnahmenliste importieren
- Import prüfen
- Maßnahme bearbeiten
- Klärpunkt / Befassungsnotiz bearbeiten
- KI-Prompt erstellen
- Hilfe
- Glossar
- Feld-Hilfe-Popover für Info-Dots
- Danger-Zone-Dialog mit „LÖSCHEN“-Bestätigung
- Runtime-Fehler

## Fehlertoleranz und Feedback

- Toast-Feedback: `#appToast`
- Undo-Toast / Rückgängig für Zurücksetzen, Demodaten laden, Bulk-Aktionen und einzelne Maßnahmenlöschungen
- Bulk-Undo im Maßnahmenkatalog
- Interne Snapshot-Erstellung vor reversiblen destruktiven Aktionen
- Danger-Zone für Browserdaten löschen mit Export-Hinweis
- Feldvalidierung mit `field-warning` und `aria-invalid`
- Plausibilitätswarnungen für RAB/EOG, EK+FK, Jahreslogik und unplausible Null-/Negativwerte
- TEUR-Felder mit `data-format="teur"`, de-DE-Anzeige und tolerantem Parsing

## Fachhilfe und Glossar

- Info-Dots ohne `title`-Attribut
- Klick-/Touch-/Tastatur-Popover für Hilfetexte
- Nur ein Feld-Hilfe-Popover gleichzeitig offen
- Escape und Außenklick schließen Popover
- „Im Glossar öffnen“-Link, sofern ein passender Glossarbegriff erkannt wird
- Glossar-Modal mit Begriffsliste und Eintragsbereich
- Deep-Link `#glossar/<begriff>`, z. B. `#glossar/eog`
- Glossarbegriffe mindestens: EOG, RAB, QE/Qualitätselement, KANU, NEST/RAMEN, ARegV, Regulierungsperiode, Kostenbasisjahr, IRR, Kapitalwert/NPV, Diskontsatz, Cashflow, wirtschaftliche Brücke/wirtschaftliche Überleitung, CAPEX, OPEX, AfA/Abschreibung, Nutzungsdauer, Befassung, Klärpunkt, Wirkannahme, Evidenz, Stresstest/konservatives Szenario, Systemreferenz/Rückspielweg, Risiko-Mapping, Snapshot, VNB, TEUR, Attribution, Wirkungsverzug, Kapitalkostenabgleich, Regulierungskonto, vereinfachtes Verfahren, No-Regret, Kontextobjekt/Sidecar, Sidecar als eigener technischer Glossareintrag, Entscheidungsreife, AGNeS, Netzfahrplan, Flexibilität(sobjekt), EEG 2027/Netzanschlusspaket, kapazitätslimitiertes Netzgebiet, Erlösrisiko, Risikowert/RiskAvoided, Ewigkeitsvermutung, Stilllegung/Rückbau, Umwidmung/Wasserstoffleitung, Rückstellungen, KAnEu, Ist-Kosten/Kostenpfad, Abzugskapital, EK-/FK-Anteil, Kapitalverzinsung, Baukostenzuschuss/BKZ

## Barrierefreiheit

- Skip-Link zum Hauptinhalt
- Fokus-Rückgabe nach Dialogschließung
- Fokusfalle in Modals
- Escape-Schließen für Dialoge
- Enter/Space für Karten und Elemente mit `role="button"`
- Tabellenköpfe mit `scope`
- Formularfelder mit zugänglichem Label oder `aria-label`
- Sichtbare Fokuszustände
- `prefers-reduced-motion` wird berücksichtigt

## Regressions-Checkliste

Nach größeren UX-Änderungen prüfen:

- Alle 7 Haupt-Tabs sind erreichbar.
- Beide Support-Tabs sind erreichbar.
- Strg/Cmd+K öffnet die globale Suche.
- Suche findet mindestens ein Feld, eine Maßnahme, einen Klärpunkt und ein Kontextobjekt.
- Info-Dots öffnen Popovers und enthalten kein `title`-Attribut.
- Glossar ist über Menü und `#glossar/eog` erreichbar.
- Danger-Zone verlangt „LÖSCHEN“.
- Undo funktioniert für Demodaten laden, Zurücksetzen, Bulk-Aktion und Einzel-Löschung.
- TEUR-Felder formatieren deutsche Tausendertrennung.
- Inline-Warnungen erscheinen, ohne die Rechnung zu blockieren.
- Skip-Link und Dialog-Fokusführung sind per Tastatur nutzbar.
- Export/Import-JSON und selbsttragendes HTML bleiben offline-first kompatibel.
