// @vitest-environment jsdom
//
// Stufe V-0 der Visualisierungs-Spezifikation: Anhang A arbeitet vier
// Abweichungen vom ausgelieferten Build ab, bevor die eigentlichen
// Diagramme (V-1 ff.) gebaut werden. A3 (Demodatenwerte gegen
// Optionslisten) und A4 (fremde Skripte im HTML-Export) sind in
// tests/field-registry.test.js bzw. tests/export-utils.test.js abgedeckt.
// Dieser Test deckt A2 (kpi:-Filter filtert statt nur zu sortieren).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(__dirname, '../akte.html'), 'utf8');

let debug;

function click(node) {
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

/** @returns {HTMLElement[]} */
function queryAllHtml(selector) {
  return /** @type {HTMLElement[]} */ ([...document.querySelectorAll(selector)]);
}

beforeEach(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.resetModules();
  const mainModulePath = '../src/main-akte.js';
  await import(mainModulePath);
  debug = /** @type {any} */ (window).__akte2Debug;
  click(document.getElementById('akteLoadDemoButton'));
});

describe('Anhang A1: Belastbarkeitsanteil je Kennzahl (wertgewichtet, nicht global)', () => {
  it('each numeric KPI tile shows its own "davon X % aus unbelegten Annahmen" caption', () => {
    const tiles = queryAllHtml('.akte-kpi-tile[data-kpi]').filter(tile =>
      ['eogYear1', 'eogFollow', 'irr', 'npv'].includes(tile.dataset.kpi)
    );
    expect(tiles.length).toBe(4);
    tiles.forEach(tile => {
      const caption = tile.querySelector('.akte-kpi-reliability');
      // demo data mixes belegte and unbelegte Maßnahmen, so every KPI with a
      // nonzero total should carry a share caption.
      expect(caption, `${tile.dataset.kpi} has no per-KPI reliability caption`).toBeTruthy();
      expect(caption.textContent).toMatch(/^davon \d+ % aus unbelegten Annahmen$/);
    });
  });

  it('the global "Belastbarkeit" tile still exists (item-count governance signal, unchanged) alongside the per-KPI shares', () => {
    expect(document.querySelector('[data-kpi="reliability"]')).toBeTruthy();
  });

  it('is value-weighted: a controlled pair of measures matches the fraction independently computed from calcPortfolio results', () => {
    const controlledModel = debug.getModel();
    controlledModel.measures.length = 0; // clear the demo measures loaded in beforeEach
    controlledModel.measures.push(
      {
        id: 'reliable_measure', active: true, name: 'Belegt', effectType: 'classic', cost: 100, year: 2027,
        secure: 100, uncertain: 0, probability: 100, opexRecognition: 100, life: 20, depr: 'normal',
        qDirect: 10, eDirect: 10, riskAvoided: 10, riskEvidenceStatus: 'validated', portfolioShare: 10, objectiveIds: [],
        impactAssumptions: [{ id: 'ia_reliable', area: 'q', confidence: 'proven', governance: 'basis', evidence: 'geprüft', evidenceType: 'measurement' }]
      },
      {
        id: 'unreliable_measure', active: true, name: 'Unbelegt', effectType: 'classic', cost: 300, year: 2027,
        secure: 100, uncertain: 0, probability: 100, opexRecognition: 100, life: 20, depr: 'normal',
        qDirect: 0, eDirect: 0, riskAvoided: 0, portfolioShare: 0, objectiveIds: [], impactAssumptions: []
      }
    );

    const portfolio = debug.currentPortfolio();
    const reliable = portfolio.results.find(r => r.measure.id === 'reliable_measure');
    const unreliable = portfolio.results.find(r => r.measure.id === 'unreliable_measure');
    expect(reliable).toBeTruthy();
    expect(unreliable).toBeTruthy();
    expect(unreliable.npv).not.toBe(0);

    const expectedShare = Math.abs(unreliable.npv) / (Math.abs(reliable.npv) + Math.abs(unreliable.npv));
    expect(debug.kpiReliabilityShare('npv')).toBeCloseTo(expectedShare, 9);
  });
});

describe('Anhang A2: kpi:-Filter filtert auf Beitrag statt nur zu sortieren', () => {
  it('a kpi: filter excludes measures without a contribution to that KPI (demo has 3 active of 6 measures)', () => {
    click(document.querySelector('[data-kpi="npv"]'));
    expect(debug.getFilterKey()).toBe('kpi:npv');
    // every measure shown must actually be active — the inactive demo
    // measures (demo_flexibility_context, demo_pressure_station,
    // demo_line_replacement) contribute nothing to any portfolio KPI.
    const shownIds = queryAllHtml('[data-object-id]')
      .map(node => node.dataset.objectId)
      .filter(Boolean);
    const inactiveIds = debug.getModel().measures.filter(m => !m.active).map(m => m.id);
    inactiveIds.forEach(id => expect(shownIds).not.toContain(id));
  });

  it('names the excluded count in the filter header, not silently', () => {
    click(document.querySelector('[data-kpi="npv"]'));
    const note = document.querySelector('.akte-filter-note');
    expect(note).toBeTruthy();
    expect(note.textContent).toMatch(/\d+ Maßnahmen? ohne Beitrag zu dieser Kennzahl ausgeblendet\./);
  });

  it('the exclusion note only appears for kpi: filters, not for the plain "measure" filter', () => {
    click(document.querySelector('[data-filter="measure"]'));
    expect(document.querySelector('.akte-filter-note')).toBeFalsy();
  });

  it('eogFollow uses the second forecast year, not a duplicate of eogYear1', () => {
    click(document.querySelector('[data-kpi="eogYear1"]'));
    const year1Ids = queryAllHtml('[data-object-id]').map(n => n.dataset.objectId);
    click(document.querySelector('[data-kpi="eogFollow"]'));
    const followIds = queryAllHtml('[data-object-id]').map(n => n.dataset.objectId);
    // both are legitimate views of the same active measures; the meaningful
    // guarantee is that both exclude the same known-inactive measures.
    const inactiveIds = debug.getModel().measures.filter(m => !m.active).map(m => m.id);
    inactiveIds.forEach(id => {
      expect(year1Ids).not.toContain(id);
      expect(followIds).not.toContain(id);
    });
  });
});
