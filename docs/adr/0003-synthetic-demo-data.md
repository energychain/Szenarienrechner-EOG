# ADR 0003: Synthetische Demodaten und Public-OSS-Neutralitaet in Szenarienrechner-EOG

## Status

Accepted

## Context

Szenarienrechner-EOG ist ein Public-OSS-Projekt. Das Projekt darf keine realen Netzbetreiber, internen Projekte, vertraulichen Unterlagen, Kundendaten oder produktiven Planungswerte enthalten. Gleichzeitig braucht die App Demodaten, damit Nutzerinnen und Nutzer Workflows verstehen koennen.

## Decision

Alle Demodaten, Namen, Szenarien, Evidenztexte und Befassungsbeispiele muessen synthetische Demodaten sein. Sie duerfen nicht wie reale interne Projektartefakte wirken und sollen neutrale Begriffe verwenden, z.B. `Beispielnetz`, `Demogebiet Alpha` oder `synthetische Störungsanalyse`.

Die Demo-Fixtures sollen zugleich den aktuellen Produktstand erklaeren. Deshalb muessen sie bewusst Beispiele fuer die heutigen Arbeitsmuster enthalten: Systemreferenzen/Rueckspielweg, Sidecar-/Evidenzobjekte, offene Datenqualitaet, wirtschaftliche Ueberleitung ohne KPI-Automatik, Stresstest-Parameter, Kanban-Klaerfaelle und Befassungsnotizen.

Neue Beitraege muessen in PR-Beschreibung und Tests bestaetigen, dass keine realen Netzbetreiber- oder internen Referenzen eingefuehrt wurden.

## Consequences

Positive:

- Das Projekt bleibt als neutrales Open-Source-Werkzeug nutzbar.
- Beispielworkflows koennen gezeigt werden, ohne reale Herkunft zu suggerieren.
- Review kann Demodaten anhand klarer Regeln pruefen.

Trade-offs:

- Synthetische Beispiele sind fachlich weniger reich als reale Projektfaelle.
- Gute Demodaten muessen aktiv gepflegt werden, damit sie zugleich neutral und lehrreich bleiben.
- Automatische Checks koennen Neutralitaet unterstuetzen, aber nicht vollstaendig garantieren.

## Verification

- Suche nach realen oder internen Referenzen vor PR-Abschluss.
- `npm run test:docs`
- Spaeter: eigener Neutralitaetscheck fuer Demo-Fixtures.
