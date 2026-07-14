import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { renderHomepage } from '../scripts/build-homepage.mjs';

describe('static homepage', () => {
  const homepage = renderHomepage();

  it('positions the project as a mini homepage, not only the calculator', () => {
    expect(homepage).toContain('Regulierte Finanzplanung verständlich');
    expect(homepage).toContain('Mehr als ein EOG-Rechner');
    expect(homepage).toContain('App starten');
    expect(homepage).toContain('app.html');
    expect(homepage).toContain('Methodik & Vorlagen');
  });

  it('separates fachliche and technical features', () => {
    expect(homepage).toContain('Fachliche Features');
    expect(homepage).toContain('Governance-Ampel');
    expect(homepage).toContain('EOG-/Cashflow-Brücke');
    expect(homepage).toContain('Technische Features');
    expect(homepage).toContain('Offline-first Single-File');
    expect(homepage).toContain('Excel-freundliche Exporte');
  });

  it('shows visual workflow proofs from real app screenshots', () => {
    expect(homepage).toContain('So arbeitet die App in der Praxis');
    expect(homepage).toContain('Workflow-Beweise');
    expect(homepage).toContain('01-planungsstart.jpg');
    expect(homepage).toContain('02-massnahmen-herleitung.jpg');
    expect(homepage).toContain('03-eog-cashflow.jpg');
    expect(homepage).toContain('04-projektplan.jpg');
    expect(homepage).toContain('05-tabellenexport.jpg');
    expect(homepage).toContain('06-ki-prompt.jpg');
    expect(homepage).toContain('07-html-mit-daten.jpg');
    expect(homepage).toContain('So vermeidet man Datensilos');
    expect(homepage).toContain('So nutzt man Unternehmens-KI');
  });

  it('keeps generated homepage screenshot assets in the repository', () => {
    [
      '01-planungsstart.jpg',
      '02-massnahmen-herleitung.jpg',
      '03-eog-cashflow.jpg',
      '04-projektplan.jpg',
      '05-tabellenexport.jpg',
      '06-ki-prompt.jpg',
      '07-html-mit-daten.jpg'
    ].forEach(file => {
      expect(existsSync(`docs/assets/homepage/${file}`)).toBe(true);
    });
  });

  it('contains contact, trust, and SEO metadata', () => {
    expect(homepage).toContain('<meta name="description"');
    expect(homepage).toContain('application/ld+json');
    expect(homepage).toContain('STROMDAO GmbH');
    expect(homepage).toContain('kontakt@stromdao.de');
    expect(homepage).toContain('Keine Rechts-, Steuer- oder Regulierungsberatung');
    expect(homepage).toContain('Apache-2.0');
  });

  it('documents the new Pages URLs in README', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toContain('Mini-Homepage: https://energychain.github.io/Szenarienrechner-EOG/');
    expect(readme).toContain('Live-App: https://energychain.github.io/Szenarienrechner-EOG/app.html');
    expect(readme).toContain('dist/app.html');
  });
});
