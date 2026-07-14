import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdown } from './build-story.mjs';

const pages = [
  { source: 'docs/ecosystem/index.md', output: 'dist/docs/index.html', title: 'Ökosystem · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/handbook/regulierte-finanzplanung-vnb.md', output: 'dist/docs/handbook/regulierte-finanzplanung-vnb.html', title: 'Methodikhandbuch · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/regulatory-map.md', output: 'dist/docs/regulatory-map.html', title: 'Regulatorik-Landkarte · Szenarienrechner-EOG', back: 'index.html' },
  { source: 'docs/maturity-model.md', output: 'dist/docs/maturity-model.html', title: 'Reifegradmodell · Szenarienrechner-EOG', back: 'index.html' },
  { source: 'docs/decision-artifacts.md', output: 'dist/docs/decision-artifacts.html', title: 'Entscheidungsartefakte · Szenarienrechner-EOG', back: 'index.html' },
  { source: 'docs/project-plan.md', output: 'dist/docs/project-plan.html', title: 'Projektplan · Szenarienrechner-EOG', back: 'index.html' },
  { source: 'docs/release-awareness.md', output: 'dist/docs/release-awareness.html', title: 'Aktualitäts-Erkennung · Szenarienrechner-EOG', back: 'index.html' },
  { source: 'docs/pilot-program.md', output: 'dist/docs/pilot-program.html', title: 'Pilotprogramm · Szenarienrechner-EOG', back: 'index.html' },
  { source: 'docs/validation-methodology.md', output: 'dist/docs/validation-methodology.html', title: 'Validierungsmethodik · Szenarienrechner-EOG', back: 'index.html' },
  { source: 'docs/templates/massnahmensteckbrief.md', output: 'dist/docs/templates/massnahmensteckbrief.html', title: 'Vorlage Maßnahmensteckbrief · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/templates/gremienvorlage.md', output: 'dist/docs/templates/gremienvorlage.html', title: 'Vorlage Gremienvorlage · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/templates/klaerpunktliste.md', output: 'dist/docs/templates/klaerpunktliste.html', title: 'Vorlage Klärpunktliste · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/templates/datenanforderung.md', output: 'dist/docs/templates/datenanforderung.html', title: 'Vorlage Datenanforderung · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/templates/workshop-agenda.md', output: 'dist/docs/templates/workshop-agenda.html', title: 'Vorlage Workshop-Agenda · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/templates/validation-protocol.md', output: 'dist/docs/templates/validation-protocol.html', title: 'Vorlage Validierungsprotokoll · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/starter-kits/index.md', output: 'dist/docs/starter-kits/index.html', title: 'Starter-Kits · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/starter-kits/starter-kit-strom-ortsnetz.md', output: 'dist/docs/starter-kits/starter-kit-strom-ortsnetz.html', title: 'Starter-Kit Strom-Ortsnetz · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/starter-kits/starter-kit-gas-transformation.md', output: 'dist/docs/starter-kits/starter-kit-gas-transformation.html', title: 'Starter-Kit Gas-Transformation · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/starter-kits/starter-kit-spartenportfolio.md', output: 'dist/docs/starter-kits/starter-kit-spartenportfolio.html', title: 'Starter-Kit Spartenportfolio · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/guides/management.md', output: 'dist/docs/guides/management.html', title: 'Lernpfad Management · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/guides/controlling.md', output: 'dist/docs/guides/controlling.html', title: 'Lernpfad Controlling · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/guides/regulierung.md', output: 'dist/docs/guides/regulierung.html', title: 'Lernpfad Regulierung · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/guides/asset-management.md', output: 'dist/docs/guides/asset-management.html', title: 'Lernpfad Asset Management · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/guides/anlagenbuchhaltung.md', output: 'dist/docs/guides/anlagenbuchhaltung.html', title: 'Lernpfad Anlagenbuchhaltung · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/examples/strom-ortsnetz.md', output: 'dist/docs/examples/strom-ortsnetz.html', title: 'Fallstudie Strom-Ortsnetz · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/examples/gas-transformation.md', output: 'dist/docs/examples/gas-transformation.html', title: 'Fallstudie Gas-Transformation · Szenarienrechner-EOG', back: '../index.html' },
  { source: 'docs/examples/spartenportfolio.md', output: 'dist/docs/examples/spartenportfolio.html', title: 'Fallstudie Spartenportfolio · Szenarienrechner-EOG', back: '../index.html' }
];

function renderDocPage({ title, body, back }) {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: light; --ink: #102033; --muted: #5b6b7f; --line: #d8e1ec; --brand: #007ea7; --soft: #eef8fb; --paper: #ffffff; --bg: #f4f7fa; --warn: #fff7ed; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.65; }
    header { background: rgba(255, 255, 255, 0.94); border-bottom: 1px solid var(--line); padding: 1rem 1.5rem; position: sticky; top: 0; z-index: 1; display: flex; gap: 1rem; justify-content: space-between; align-items: center; }
    header a, header button { color: var(--brand); font-weight: 700; text-decoration: none; }
    header button { border: 1px solid #8ac6da; background: var(--soft); border-radius: 999px; padding: 0.45rem 0.85rem; cursor: pointer; font: inherit; }
    main { max-width: 1080px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    article { background: var(--paper); border: 1px solid var(--line); border-radius: 18px; padding: clamp(1.25rem, 2vw, 2.5rem); box-shadow: 0 18px 40px rgba(16, 32, 51, 0.08); }
    h1 { font-size: clamp(2rem, 4vw, 3.4rem); line-height: 1.1; margin: 0 0 1rem; letter-spacing: -0.035em; }
    h2 { border-top: 1px solid var(--line); margin-top: 3rem; padding-top: 2rem; font-size: clamp(1.45rem, 2.5vw, 2.1rem); break-after: avoid; }
    h3 { margin-top: 1.8rem; break-after: avoid; }
    h1 + p, h2 + p { color: var(--muted); }
    a { color: var(--brand); }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0 1.5rem; font-size: 0.96rem; break-inside: avoid; }
    th, td { border: 1px solid var(--line); padding: 0.75rem; vertical-align: top; }
    th { background: #edf4f8; text-align: left; }
    code { background: #edf2f7; border-radius: 0.3rem; padding: 0.1rem 0.3rem; }
    blockquote { border-left: 4px solid var(--brand); margin: 1.25rem 0; padding: 0.2rem 1rem; background: var(--soft); }
    hr { border: 0; border-top: 1px solid var(--line); margin: 2rem 0; }
    footer { color: var(--muted); font-size: 0.9rem; margin-top: 1.5rem; text-align: center; }
    @page { size: A4; margin: 15mm 13mm 17mm; }
    @media print {
      :root { --ink: #111827; --muted: #374151; --line: #b8c2ce; --paper: #ffffff; --bg: #ffffff; --brand: #004f68; --soft: #ffffff; }
      body { background: #ffffff; font-size: 10.8pt; line-height: 1.48; }
      header { position: static; border: 0; padding: 0 0 8mm; }
      header button { display: none; }
      main { max-width: none; padding: 0; }
      article { border: 0; border-radius: 0; box-shadow: none; padding: 0; }
      h1 { font-size: 24pt; }
      h2 { font-size: 16pt; margin-top: 12mm; padding-top: 7mm; break-after: avoid; }
      h3, p, li, table { orphans: 3; widows: 3; }
      table, tr, blockquote { break-inside: avoid; page-break-inside: avoid; }
      a { color: inherit; text-decoration: none; }
      footer { border-top: 1px solid var(--line); padding-top: 4mm; }
    }
  </style>
</head>
<body>
  <header><a href="${back}">← Zur Übersicht</a><button type="button" onclick="window.print()">Drucken / PDF speichern</button></header>
  <main>
    <article>
${body}
    </article>
    <footer>Szenarienrechner-EOG · Orientierung und Methodik · Apache-2.0</footer>
  </main>
</body>
</html>
`;
}

export function buildDocs() {
  for (const page of pages) {
    const markdown = readFileSync(page.source, 'utf8');
    const html = renderDocPage({ title: page.title, body: renderMarkdown(markdown), back: page.back });
    mkdirSync(dirname(page.output), { recursive: true });
    writeFileSync(page.output, html);
    console.log(`Built ${page.output}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildDocs();
}
