# Szenarienrechner-EOG Contribution Guide

Szenarienrechner-EOG ist ein generisches Open-Source-Werkzeug fuer Szenario-, Portfolio- und Entscheidungslogik regulierter Sparten. Beitraege sind willkommen, muessen aber fachliche Neutralitaet, Offline-Faehigkeit und Nachvollziehbarkeit wahren.

## Grundsaetze

- Keine realen Netzbetreiber, Projekte, Ortsnetze, Kundendaten, internen Unterlagen oder vertraulichen Referenzen in Code, App-Texten, Demodaten, Screenshots, Issues oder Tests.
- Demodaten muessen eindeutig synthetisch sein. Verwende neutrale Namen wie `Beispielnetz`, `Demogebiet Alpha` oder `synthetische Störungsanalyse`.
- Keine Rechts-, Steuer-, Wirtschaftspruefungs- oder Regulierungsberatung in App oder Dokumentation behaupten.
- Fachliche Annahmen muessen transparent dokumentiert werden. Siehe `REGULATORY_ASSUMPTIONS.md` und `MODEL.md`.
- Die App bleibt offline-first: keine Telemetrie, keine externen Skripte, keine Netzwerkzugriffe im gebauten Artefakt.

## Arbeitsmodus

1. Issue oder kurze Problemnotiz erstellen.
2. Scope klein halten: ein fachliches oder technisches Ziel pro PR.
3. Branch nach Conventional-Commit-Stil benennen, z.B. `docs/model-overview`, `test/offline-smoke`, `refactor/import-module`.
4. Aendere fachliche Modelllogik nur mit expliziter Begruendung, Quellenstand und Tests.
5. Fuehre die Qualitaetssicherung aus und dokumentiere den Testnachweis im PR.

## Definition of Done

Ein PR ist erst fertig, wenn:

- fachlicher Zweck und Nicht-Ziele klar beschrieben sind,
- keine realen Netzbetreiber oder internen Referenzen eingefuehrt wurden,
- neue oder geaenderte Logik durch Tests abgesichert ist,
- `npm run lint`, `npm test`, `npm run typecheck`, `npm run build:release`, `npm run test:distribution` und `npm run test:docs` erfolgreich waren,
- der PR einen Testnachweis enthaelt,
- bei fachlichen Aenderungen `REGULATORY_ASSUMPTIONS.md`, `MODEL.md` oder passende Dokumentation aktualisiert wurde.

## Fachliche Modelländerungen

Fachliche Modelländerungen sind alle Aenderungen, die Berechnung, Klassifikation, Annahmen, Parameter, Governance-Status oder Report-Aussagen beeinflussen. Solche Aenderungen brauchen:

- Beschreibung der fachlichen Motivation,
- Quellen- oder Annahmenstand,
- Auswirkung auf vorhandene Szenarien,
- Regressionstest oder nachvollziehbare Testdaten,
- klare Abgrenzung zu Rechts- oder Regulierungsberatung.

## Tests lokal ausführen

```bash
npm ci
npm run lint
npm test
npm run typecheck
npm run build:release
npm run test:distribution
npm run test:docs
```

## PR-Beschreibung

Empfohlene Struktur:

```text
Ziel
- ...

Aenderungen
- ...

Fachliche Auswirkungen
- keine / beschrieben in ...

Neutralitaetspruefung
- keine realen Netzbetreiber, Projekte oder internen Referenzen

Testnachweis
- npm run lint
- npm test
- npm run typecheck
- npm run build:release
- npm run test:distribution
- npm run test:docs
```
