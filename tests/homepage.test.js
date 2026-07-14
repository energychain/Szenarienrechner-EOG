import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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
