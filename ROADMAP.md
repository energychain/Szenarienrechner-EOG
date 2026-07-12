# Szenarienrechner-EOG Roadmap

Diese Roadmap beschreibt risikoarme naechste Schritte fuer Szenarienrechner-EOG. Sie ist bewusst produkt- und governance-orientiert, damit die App als neutrales Open-Source-Werkzeug weiterentwickelt werden kann.

## Leitplanken

- Keine realen Netzbetreiber, internen Projektbezeichnungen oder vertraulichen Inhalte.
- Fachliche Modelländerungen nur mit expliziter Begruendung, Quellenstand und Tests.
- Offline-first bleibt unverhandelbar.
- Kleine PRs mit nachvollziehbarem Testnachweis.

## Phase 1: Projekt-Governance und Wartbarkeit

- `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `RELEASE.md`, `MODEL.md`, `DATA_FORMAT.md` und `GOVERNANCE.md` pflegen.
- Dokumentationschecks in CI integrieren.
- PR- und Release-Checkliste verbindlich machen.
- Offene Architekturentscheidungen in Issues ueberfuehren.

## Phase 2: Modelltransparenz

- Regulierungsprofile aus hart codierten Parametern herausloesen.
- Jedes Regulierungsprofil mit Name, Gueltigkeit, Quellenstand und Status kennzeichnen.
- Experimentelle oder unsichere Annahmen sichtbar markieren.
- Tests sicherstellen, dass Berechnungen immer mit explizitem Profil laufen.

## Phase 3: Demodaten und Datenformat

- Synthetische Demodaten aus `src/ui.js` in ein eigenes Fixture-Modul extrahieren.
- Import-/Export-Schema dokumentieren und optional validieren.
- Beispielportfolios fuer Strom, Gas und Mischportfolio pflegen, ohne reale Referenzen.

## Phase 4: Testabdeckung

- Offline-Smoke-Test fuer das gebaute HTML-Artefakt ergaenzen.
- Browser-/DOM-Test fuer Beispielprojekt, Szenariowechsel, Import/Export und Report-Erzeugung einfuehren.
- Historie und Audit-Pfade gegen Regressionen absichern.

## Phase 5: UI-Modularisierung

`src/ui.js` schrittweise und ohne Big-Bang-Refactor zerlegen:

- `storage.js`
- `demo-data.js`
- `import-review.js`
- `report.js`
- `portfolio-view.js`
- `catalog.js`
- `meeting-template.js`
- `onboarding.js`
- `render-utils.js`

Jede Extraktion braucht vorherige oder begleitende Tests und darf fachliche Berechnung nicht veraendern.

## Phase 6: Produktpositionierung

Die Positionierung bleibt: offline-first Szenario- und Portfolio-Werkzeug fuer regulierte Sparten. Der Begriff EOG bleibt fachlicher Kern, aber nicht die einzige Produktdimension.

## Bewusst nicht automatisch

Diese Punkte brauchen fachliche Abstimmung, bevor sie umgesetzt werden:

- konkrete neue regulatorische Parameter,
- Aenderung von Berechnungsformeln,
- neue rechtliche Interpretationen,
- produktive Beispielwerte, die wie reale Netzbetreiberdaten wirken koennten,
- externe Demo-Website oder Hosting-Entscheidung.
