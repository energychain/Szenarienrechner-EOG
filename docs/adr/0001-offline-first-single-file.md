# ADR 0001: Offline-first Single-File Distribution for Szenarienrechner-EOG

## Status

Accepted

## Context

Szenarienrechner-EOG can be used with sensitive planning, portfolio, investment and regulatory assumptions. Such data should not be sent to an external server merely to run a scenario calculation.

The project also needs a distribution mode that is easy to review by IT, easy to archive with decision material and usable without server operation.

## Decision

Szenarienrechner-EOG is distributed as an Offline-first single HTML file. The build process creates `dist/szenarienrechner-eog.html`. The application must not depend on external scripts, styles, fonts, images, telemetry or network APIs.

The distribution check validates the Content-Security-Policy, absence of external HTTP(S) URLs, absence of selected browser network APIs and consistency of trust/legal content.

## Consequences

Positive:

- Users can open the app locally without uploading planning data.
- The release artifact can be attached to internal decision processes.
- IT review can inspect one static HTML file and its hash.
- The trust model is simple: no backend, no telemetry, no hidden service dependency.

Trade-offs:

- Collaboration is file-based through JSON export/import rather than real-time multi-user editing.
- Browser localStorage remains local to the browser profile and must be handled carefully on shared machines.
- Large UI logic can accumulate in the frontend if modularization is not maintained.

## Verification

- `npm run build:release`
- `npm run test:distribution`
- SHA256 of `dist/szenarienrechner-eog.html`
