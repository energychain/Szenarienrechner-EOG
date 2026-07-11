# Szenarienrechner-EOG

Portfolio-App fuer regulierte Sparten: Basisdaten der Sparte, geplante Massnahmen und Szenarioannahmen werden in einer gemeinsamen EOG-, Rendite- und Finanzierungslogik gerechnet.

## Entwicklung

```bash
npm ci
npm run dev
```

Der Rechenkern liegt DOM-frei in `src/engine.js`, die UI in `src/ui.js`, das Styling in `src/styles.css`.

## Qualitaetssicherung

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

## Auslieferung

```bash
npm run build
cp dist/index.html gas-massnahme-eog-rechner.html
```

`gas-massnahme-eog-rechner.html` bleibt das offline lauffaehige Single-File-Deliverable.
