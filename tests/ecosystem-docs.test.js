import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDocs } from '../scripts/build-docs.mjs';

const docs = [
  'docs/ecosystem/index.md',
  'docs/handbook/regulierte-finanzplanung-vnb.md',
  'docs/regulatory-map.md',
  'docs/maturity-model.md',
  'docs/decision-artifacts.md',
  'docs/project-plan.md',
  'docs/validation-methodology.md',
  'docs/visuals/methodik-grafikserie.md',
  'docs/templates/massnahmensteckbrief.md',
  'docs/templates/gremienvorlage.md',
  'docs/templates/klaerpunktliste.md',
  'docs/templates/datenanforderung.md',
  'docs/templates/workshop-agenda.md',
  'docs/templates/validation-protocol.md',
  'docs/starter-kits/index.md',
  'docs/starter-kits/starter-kit-strom-ortsnetz.md',
  'docs/starter-kits/starter-kit-gas-transformation.md',
  'docs/starter-kits/starter-kit-spartenportfolio.md',
  'docs/guides/management.md',
  'docs/guides/controlling.md',
  'docs/guides/regulierung.md',
  'docs/guides/asset-management.md',
  'docs/guides/anlagenbuchhaltung.md',
  'docs/examples/strom-ortsnetz.md',
  'docs/examples/gas-transformation.md',
  'docs/examples/spartenportfolio.md'
];

describe('consulting ecosystem docs', () => {
  beforeAll(() => {
    buildDocs();
  });

  it('provides the orientation, methodology, templates, learning paths, and decision artifacts', () => {
    for (const path of docs) {
      expect(existsSync(path), `${path} should exist`).toBe(true);
    }
  });

  it('positions the project as regulated utility finance planning rather than a pure EOG calculator', () => {
    const content = readFileSync('docs/ecosystem/index.md', 'utf8');
    expect(content).toContain('kein reiner EOG-Rechner');
    expect(content).toContain('regulierte Finanzplanung');
    expect(content).toContain('kleine und mittlere Stadtwerke');
    expect(content).toContain('Senior-Consulting');
    expect(content).toContain('Projektplan');
    expect(content).toContain('Rollen-Swimlanes');
    expect(content).toContain('TRL-6-Validierung');
    expect(content).toContain('Methodik-Grafikserie');
    expect(content).toContain('../visuals/methodik-grafikserie.md');
    expect(content).toContain('Starter-Kits');
    expect(content).toContain('Strom-Ortsnetz');
    expect(content).toContain('Cernion');
  });

  it('documents public sources and sector-specific Strom/Gas orientation', () => {
    const regulatoryMap = readFileSync('docs/regulatory-map.md', 'utf8');
    expect(regulatoryMap).toContain('Bundesnetzagentur');
    expect(regulatoryMap).toContain('ARegV');
    expect(regulatoryMap).toContain('StromNEV');
    expect(regulatoryMap).toContain('GasNEV');
    expect(regulatoryMap).toContain('KANU');
    expect(regulatoryMap).toContain('Strom-spezifische Planungsfragen');
    expect(regulatoryMap).toContain('Gas-spezifische Planungsfragen');
  });

  it('renders ecosystem markdown pages as print-friendly HTML', () => {
    const index = readFileSync('dist/docs/index.html', 'utf8');
    expect(index).toContain('Drucken / PDF speichern');
    expect(index).toContain('@media print');
    expect(index).toContain('Methodikhandbuch');
    expect(index).toContain('Methodik-Grafikserie');
    expect(index).toContain('href="visuals/index.html"');
    expect(index).toContain('href="visuals/methodik-grafikserie.html"');
    expect(index).toContain('Projektplan');
    expect(index).toContain('Vorlagenpaket');
    expect(index).toContain('Starter-Kits');
    const starterKit = readFileSync('dist/docs/starter-kits/index.html', 'utf8');
    expect(starterKit).toContain('Drucken / PDF speichern');
    expect(starterKit).toContain('Strom-Ortsnetz');
    expect(starterKit).toContain('Gas-Transformation');
    expect(starterKit).toContain('Spartenportfolio');
    const projectPlan = readFileSync('dist/docs/project-plan.html', 'utf8');
    expect(projectPlan).toContain('Drucken / PDF speichern');
    expect(projectPlan).toContain('Rollen-Swimlanes');
    expect(projectPlan).toContain('Eigene Aufgaben');
    const visuals = readFileSync('dist/docs/visuals/index.html', 'utf8');
    expect(visuals).toContain('Drucken / PDF speichern');
    expect(visuals).toContain('Interaktives Online-Karussell / HTML-Slide-Master');
    const slideMaster = readFileSync('dist/docs/visuals/methodik-grafikserie.html', 'utf8');
    expect(slideMaster).toContain('Methodik-Slides als Karussell');
    expect(slideMaster).toContain('data-action="next"');
    expect(slideMaster).toContain('Slide-Großansicht');
    expect(slideMaster).toContain('exports/methodik-slide-07.png');
    expect(existsSync('dist/docs/visuals/methodik-grafikserie.html')).toBe(true);
    expect(existsSync('dist/docs/visuals/exports/methodik-slide-01.png')).toBe(true);
    expect(existsSync('dist/docs/visuals/exports/methodik-contact-sheet.png')).toBe(true);
  });
});
