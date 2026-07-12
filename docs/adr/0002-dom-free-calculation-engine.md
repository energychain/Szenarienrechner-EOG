# ADR 0002: DOM-freier Rechenkern in Szenarienrechner-EOG

## Status

Accepted

## Context

Szenarienrechner-EOG verbindet UI-gestuetzte Portfolioarbeit mit regulatorisch relevanten Berechnungen. Berechnung, Darstellung und Nutzerfuehrung duerfen nicht untrennbar vermischt werden, weil fachliche Logik testbar und auditierbar bleiben muss.

## Decision

Der Rechenkern bleibt DOM-frei in `src/engine.js`. UI-Code darf Eingaben sammeln, Ergebnisse darstellen und Workflows steuern, soll aber keine eigene versteckte EOG-, Rendite- oder Finanzierungslogik aufbauen.

Berechnungsnahe Aenderungen brauchen Tests im Engine-Kontext und Dokumentationspruefung in `MODEL.md` oder `REGULATORY_ASSUMPTIONS.md`.

## Consequences

Positive:

- Berechnungen koennen ohne Browser-DOM getestet werden.
- Regulatorische Modelllogik ist leichter reviewbar.
- UI-Refactorings koennen mit geringerem fachlichem Risiko erfolgen.
- Spaetere Regulierungsprofile koennen sauberer eingefuehrt werden.

Trade-offs:

- UI-Code muss Daten vor der Uebergabe an den Engine-Kern normalisieren.
- Komfortfunktionen im UI duerfen nicht versehentlich zu paralleler Fachlogik werden.
- Neue Features brauchen klare Grenze zwischen Darstellung und Berechnung.

## Verification

- `npm test`
- Tests fuer neue Engine-Funktionen vor oder mit jeder Berechnungsaenderung.
- Review auf keine versteckte Fachlogik in UI-Helfern.
