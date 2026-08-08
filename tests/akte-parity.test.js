// @vitest-environment jsdom
//
// Stufe 6, Kriterium 3: "Alle KPIs, Klärpunkte, Reifegrad, Segmentierung und
// Rechenpfade stimmen in beiden Oberflächen bei identischem Modell exakt
// überein." Lädt dasselbe Referenzmodell einmal in ui.js (index.html) und
// einmal in main-akte.js (akte.html) und vergleicht die berechneten Werte.
// Beide Oberflächen rufen dieselben Stufe-1..3-Module (engine.js,
// clarifications.js, maturity.js) auf; dieser Test beweist es anhand
// tatsächlicher Zahlen statt sich nur auf die geteilte Quelle zu verlassen.
//
// Beide Oberflächen werden nur je einmal in beforeAll geladen (nicht pro
// it()) — jeder Import von ui.js verkabelt den gesamten DOM und dauert
// mehrere Sekunden; siehe tests/characterization-akte.test.js für dasselbe
// Muster.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const referenceModel = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/reference-model.json'), 'utf8')
);

async function loadOldUi() {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
  document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  if (!window.CSS) /** @type {any} */ (window).CSS = {};
  if (!window.CSS.escape) {
    window.CSS.escape = value => String(value).replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`);
  }
  const embedded = document.createElement('script');
  embedded.type = 'application/json';
  embedded.id = 'embedded-model-state';
  embedded.textContent = JSON.stringify(referenceModel);
  document.body.appendChild(embedded);

  vi.resetModules();
  const uiModulePath = '../src/ui.js';
  await import(uiModulePath);
  return /** @type {any} */ (window).__akteDebug;
}

async function loadNewUi() {
  const html = readFileSync(resolve(__dirname, '../akte.html'), 'utf8');
  document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  localStorage.clear();
  localStorage.setItem('regulierte-sparten-szenario-rechner-akte-v1', JSON.stringify({
    app: 'regulierte-sparten-szenario-rechner',
    version: referenceModel.version,
    appVersion: referenceModel.appVersion,
    savedAt: referenceModel.savedAt,
    model: referenceModel.model,
    history: referenceModel.history
  }));

  vi.resetModules();
  const mainModulePath = '../src/main-akte.js';
  await import(mainModulePath);
  return /** @type {any} */ (window).__akte2Debug;
}

let oldPortfolio;
let newPortfolio;
let oldClarifications;
let newClarifications;
let oldMaturity;
let newMaturity;
let oldSegmentation;
let newSegmentation;
let oldDrilldowns;
let newDrilldowns;

beforeAll(async () => {
  const oldDebug = await loadOldUi();
  oldPortfolio = oldDebug.currentPortfolio();
  oldClarifications = oldDebug.clarificationItems();
  oldMaturity = oldDebug.maturityScore();
  oldSegmentation = oldDebug.portfolioSegmentation();
  oldDrilldowns = referenceModel.model.measures.map(measure => oldDebug.measureDrilldownFor(measure.id));

  const newDebug = await loadNewUi();
  newPortfolio = newDebug.currentPortfolio();
  newClarifications = newDebug.clarificationItems();
  newMaturity = newDebug.maturityScore();
  newSegmentation = newDebug.portfolioSegmentation();
  newDrilldowns = referenceModel.model.measures.map(measure => newDebug.measureDrilldownFor(measure.id));
}, 30000);

describe('Kriterium 3: identische Rechenergebnisse in beiden Oberflächen', () => {
  it('produces the same portfolio KPIs (IRR, NPV, Invest, Jahresreihe)', () => {
    expect(newPortfolio.irr).toBeCloseTo(oldPortfolio.irr, 9);
    expect(newPortfolio.npv).toBeCloseTo(oldPortfolio.npv, 6);
    expect(newPortfolio.invest).toBeCloseTo(oldPortfolio.invest, 6);
    expect(newPortfolio.yearly.length).toBe(oldPortfolio.yearly.length);
    newPortfolio.yearly.forEach((year, index) => {
      expect(year.regulatoryEogEffect).toBeCloseTo(oldPortfolio.yearly[index].regulatoryEogEffect, 6);
      expect(year.indicativeCashflow).toBeCloseTo(oldPortfolio.yearly[index].indicativeCashflow, 6);
    });
  });

  it('produces the same clarification list (same keys, same priorities, same statuses)', () => {
    const shape = items => items
      .map(item => ({ key: item.key, priority: item.priority.level, status: item.status }))
      .sort((a, b) => a.key.localeCompare(b.key));
    expect(shape(newClarifications)).toEqual(shape(oldClarifications));
  });

  it('produces the same Reifegrad (maturityScore)', () => {
    expect(newMaturity.score).toBe(oldMaturity.score);
    expect(newMaturity.blockers).toBe(oldMaturity.blockers);
    expect(newMaturity.reviewCount).toBe(oldMaturity.reviewCount);
    expect(newMaturity.verdictStable).toBe(oldMaturity.verdictStable);
  });

  it('produces the same Segmentierung (portfolioSegmentation)', () => {
    expect(newSegmentation).toEqual(oldSegmentation);
  });

  it('produces the same Rechenpfad (measureDrilldownFor) for every reference measure', () => {
    oldDrilldowns.forEach((drilldown, index) => {
      expect(newDrilldowns[index].capexTeur).toBeCloseTo(drilldown.capexTeur, 6);
      expect(newDrilldowns[index].activatedTeur).toBeCloseTo(drilldown.activatedTeur, 6);
      expect(newDrilldowns[index].npvTeur).toBeCloseTo(drilldown.npvTeur, 6);
      expect(newDrilldowns[index].rows).toEqual(drilldown.rows);
    });
  });
});
