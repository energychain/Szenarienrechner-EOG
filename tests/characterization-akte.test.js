// @vitest-environment jsdom
//
// Stage-0 characterization test (see UX_AKTE_REDESIGN spec, Abschnitt 3 "Schritt 0").
// Loads the reference model from tests/fixtures/reference-model.json into the
// full application (index.html + src/ui.js) inside jsdom and freezes the
// observable KPIs, Klärpunktliste, Reifegrad-Kennzahl and Segmentierung via the
// window.__akteDebug seam. This test is black-box: it does not import internal
// ui.js functions directly, so it must stay green across the Stage-1 module
// extraction (clarifications.js/maturity.js/model-normalize.js) without being
// touched itself — any behavioral drift during extraction shows up here.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const referenceModel = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/reference-model.json'), 'utf8')
);

let debug;

beforeAll(async () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
  document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');

  // jsdom does not implement CSS.escape; ui.js only uses it for accessible-label
  // bookkeeping that this test does not exercise.
  if (!window.CSS) /** @type {any} */ (window).CSS = {};
  if (!window.CSS.escape) {
    window.CSS.escape = value => String(value).replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`);
  }

  const embedded = document.createElement('script');
  embedded.type = 'application/json';
  embedded.id = 'embedded-model-state';
  embedded.textContent = JSON.stringify(referenceModel);
  document.body.appendChild(embedded);

  // Not typechecked (see tsconfig.json): ui.js is a DOM-heavy entry point that
  // is intentionally outside the typecheck surface. The indirection through a
  // variable keeps tsc from statically resolving and pulling it into the
  // program via this test.
  const uiModulePath = '../src/ui.js';
  await import(uiModulePath);
  debug = /** @type {any} */ (window).__akteDebug;
});

describe('Akte Charakterisierungstest (Referenzmodell, Gas)', () => {
  it('exposes the debug seam after loading the embedded reference model', () => {
    expect(debug).toBeTruthy();
    expect(debug.currentModelData().measures).toHaveLength(referenceModel.model.measures.length);
  });

  it('freezes portfolio KPIs for the base scenario', () => {
    const portfolio = debug.currentPortfolio();
    expect(portfolio.irr).toMatchSnapshot('irr');
    expect(portfolio.npv).toMatchSnapshot('npv');
    expect(portfolio.invest).toMatchSnapshot('invest');
    expect(portfolio.yearly[0]).toMatchSnapshot('year-1');
    expect(portfolio.warnings.map(w => w.type).sort()).toMatchSnapshot('warning-types');
  });

  it('freezes the portfolio segmentation (Budget-Tragfähigkeitsklassen)', () => {
    expect(debug.portfolioSegmentation()).toMatchSnapshot('segmentation');
  });

  it('freezes the Klärpunktliste (clarificationItems)', () => {
    const items = debug.clarificationItems();
    const shape = items.map(item => ({
      key: item.key,
      type: item.type,
      area: item.area,
      priority: item.priority.label,
      status: item.status
    }));
    expect(shape).toMatchSnapshot('clarification-items');
  });

  it('freezes the Reifegrad-Kennzahl (maturityScore)', () => {
    const maturity = debug.maturityScore();
    expect({
      score: maturity.score,
      blockers: maturity.blockers,
      reviewCount: maturity.reviewCount,
      verdictStable: maturity.verdictStable,
      openClarificationCount: maturity.openClarifications.length
    }).toMatchSnapshot('maturity-score');
  });
});
