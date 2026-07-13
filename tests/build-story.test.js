import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderMarkdown, renderPage } from '../scripts/build-story.mjs';

describe('story HTML rendering', () => {
  it('adds print-friendly article styling for PDF export', () => {
    const html = renderPage('<h1>Test</h1>');

    expect(html).toContain('@media print');
    expect(html).toContain('@page');
    expect(html).toContain('break-inside: avoid');
    expect(html).toContain('Drucken / PDF speichern');
  });

  it('renders consultant-oriented financial planning context in the story body', () => {
    const markdown = `# Userstory\n\nDiese App strukturiert die Finanzplanung regulierter Verteilnetzbetreiber.\n\n## Meilenstein\n\nEin EVU erkennt Budget, Wirtschaftsplan, regulatorische Erlöslogik und Finanzierung als gemeinsamen Prozess.`;
    const body = renderMarkdown(markdown);

    expect(body).toContain('Finanzplanung regulierter Verteilnetzbetreiber');
    expect(body).toContain('Wirtschaftsplan');
    expect(body).toContain('regulatorische Erlöslogik');
  });

  it('renders screenshots eagerly so print/PDF contains every milestone image', () => {
    const body = renderMarkdown('![Startscreen](screenshots/01-startscreen-kickoff.png)');

    expect(body).toContain('<img src="screenshots/01-startscreen-kickoff.png"');
    expect(body).not.toContain('loading="lazy"');
  });

  it('turns bare public source URLs into clickable links in the rendered story', () => {
    const body = renderMarkdown('| Quelle | Link |\n| --- | --- |\n| BNetzA | Bundesnetzagentur: https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Netzentgelte/Anreizregulierung/start.html |');

    expect(body).toContain('<a href="https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Netzentgelte/Anreizregulierung/start.html">https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Netzentgelte/Anreizregulierung/start.html</a>');
  });

  it('keeps the published story positioned as VNB financial planning rather than a pure EOG calculator', () => {
    const story = readFileSync('docs/story/planungsrunde-userstory.md', 'utf8');

    expect(story).toContain('Finanzplanung regulierter Sparten');
    expect(story).toContain('kein reiner EOG-Rechner');
    expect(story).toContain('externer Senior Consultant');
    expect(story).toContain('Wirtschaftsplan');
    expect(story).toContain('VNB-Portfolios');
    expect(story).toContain('Öffentliche Quellen zum Weiterlesen');
    expect(story).toContain('STROMDAO GmbH und Cernion');
    expect(story).toContain('https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Netzentgelte/Anreizregulierung/start.html');
    expect(story).toContain('https://cernion.de/');
  });
});
