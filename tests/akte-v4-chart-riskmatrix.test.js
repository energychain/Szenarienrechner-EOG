// @vitest-environment jsdom
//
// Stufe V-4 der Visualisierungs-Spezifikation: Risikomatrix auf dem Filter
// "measure". Deckt V5, V6. Der generische Renderer-Mechanismus (Tabellen-
// Umschalter, Tastatur, Klickparität) ist bereits in
// tests/akte-v2-chart-tornado.test.js abgedeckt und wird hier nur für die
// risikomatrix-spezifischen Punkte (Pfeil vorher/nachher, Mehrfachblasen je
// Maßnahme) wiederholt.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(__dirname, '../akte.html'), 'utf8');

let debug;

function click(node) {
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

/**
 * @param {string} selector
 * @param {Document | Element} root
 * @returns {HTMLElement[]}
 */
function queryAllHtml(selector, root = document) {
  return /** @type {HTMLElement[]} */ ([...root.querySelectorAll(selector)]);
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
  click(document.querySelector('[data-filter="measure"]'));
});

describe('V3: genau ein Diagramm für den Filter "measure"', () => {
  it('renders exactly one riskMatrix chart, no chart-type switcher', () => {
    const sections = queryAllHtml('.akte-chart');
    expect(sections.length).toBe(1);
    expect(sections[0].dataset.chartType).toBe('riskMatrix');
    expect(document.querySelector('[data-chart-type-select]')).toBeFalsy();
  });
});

describe('V5: jedes grafische Element trägt genau eine Wertzustandsklasse', () => {
  it('every bubble carries exactly one akte-chart-mark--* class (demo data has 3 active measures with risk impacts)', () => {
    const bubbles = queryAllHtml('.akte-chart-element');
    expect(bubbles.length).toBeGreaterThan(0);
    const stateClasses = ['akte-chart-mark--set', 'akte-chart-mark--default', 'akte-chart-mark--derived', 'akte-chart-mark--openByDecision'];
    bubbles.forEach(bubble => {
      const present = stateClasses.filter(cls => bubble.classList.contains(cls));
      expect(present.length, `${bubble.outerHTML} has ${present.length} state classes`).toBe(1);
    });
  });
});

describe('V6: ein Modell mit lauter Vorbelegungen erzeugt kein einziges gefülltes Element', () => {
  it('a risk impact assumption with everything still at its default renders as akte-chart-mark--default, not --set', () => {
    debug.getModel().measures.push({
      id: 'risk_default_measure',
      active: true,
      name: 'Nur Vorbelegung',
      impactAssumptions: [{ id: 'ia_default_risk', area: 'risk', riskProbabilityBefore: 0, riskProbabilityAfter: 0, riskImpact: 0 }]
    });
    debug.setSelectedObject('measure', 'risk_default_measure');
    const bubble = queryAllHtml('.akte-chart-element[data-object-id="risk_default_measure"]')[0];
    expect(bubble).toBeTruthy();
    expect(bubble.classList.contains('akte-chart-mark--default')).toBe(true);
    expect(bubble.classList.contains('akte-chart-mark--set')).toBe(false);
    expect(bubble.classList.contains('akte-chart-mark--derived')).toBe(false);
  });

  it('a fully belegte risk impact assumption (all fields set, non-default) renders as akte-chart-mark--set', () => {
    debug.getModel().measures.push({
      id: 'risk_confirmed_measure',
      active: true,
      name: 'Vollständig geprüft',
      impactAssumptions: [{ id: 'ia_confirmed_risk', area: 'risk', riskProbabilityBefore: 12, riskProbabilityAfter: 3, riskImpact: 500 }]
    });
    debug.setSelectedObject('measure', 'risk_confirmed_measure');
    const bubble = queryAllHtml('.akte-chart-element[data-object-id="risk_confirmed_measure"]')[0];
    expect(bubble).toBeTruthy();
    expect(bubble.classList.contains('akte-chart-mark--set')).toBe(true);
  });
});

describe('Diagrammkatalog Abschnitt 5: Pfeil von vorher nach nachher', () => {
  it('draws an arrow when probability-before differs from probability-after', () => {
    const bubble = queryAllHtml('.akte-chart-element').find(el => el.querySelector('.akte-chart-risk-arrow'));
    expect(bubble, 'no bubble with an arrow found in demo data (all before === after?)').toBeTruthy();
  });

  it('omits the arrow when probability-before equals probability-after (no movement to show)', () => {
    debug.getModel().measures.push({
      id: 'risk_no_movement',
      active: true,
      name: 'Unveränderte Wahrscheinlichkeit',
      impactAssumptions: [{ id: 'ia_no_movement', area: 'risk', riskProbabilityBefore: 8, riskProbabilityAfter: 8, riskImpact: 300 }]
    });
    debug.setSelectedObject('measure', 'risk_no_movement');
    const bubble = queryAllHtml('.akte-chart-element[data-object-id="risk_no_movement"]')[0];
    expect(bubble).toBeTruthy();
    expect(bubble.querySelector('.akte-chart-risk-arrow')).toBeFalsy();
  });
});

describe('Blase → Maßnahme (Kriterium V4)', () => {
  it('clicking a risk bubble selects the underlying measure, same as its list row', () => {
    const bubble = /** @type {HTMLElement} */ (document.querySelector('.akte-chart-element[data-object-id]'));
    expect(bubble).toBeTruthy();
    const expectedId = bubble.dataset.objectId;
    click(bubble);
    expect(debug.getSelectedType()).toBe('measure');
    expect(debug.getSelectedId()).toBe(expectedId);
  });

  it('a measure with more than one risk impact assumption produces multiple bubbles that all select the same measure', () => {
    debug.getModel().measures.push({
      id: 'risk_multi_measure',
      active: true,
      name: 'Zwei Risiken',
      impactAssumptions: [
        { id: 'ia_multi_1', area: 'risk', riskProbabilityBefore: 10, riskProbabilityAfter: 4, riskImpact: 200 },
        { id: 'ia_multi_2', area: 'risk', riskProbabilityBefore: 20, riskProbabilityAfter: 5, riskImpact: 600 }
      ]
    });
    debug.setSelectedObject('measure', 'risk_multi_measure');
    const bubbles = queryAllHtml('.akte-chart-element[data-object-id="risk_multi_measure"]');
    expect(bubbles.length).toBe(2);
    bubbles.forEach(bubble => {
      click(bubble);
      expect(debug.getSelectedType()).toBe('measure');
      expect(debug.getSelectedId()).toBe('risk_multi_measure');
    });
  });
});

describe('V2: das Diagramm zeigt nur Objekte der aktiven Filtermenge', () => {
  it('every bubble points at a measure actually present in the visible object list', () => {
    const visibleMeasureIds = new Set(
      queryAllHtml('.akte-object-list-item[data-object-type="measure"]').map(node => node.dataset.objectId)
    );
    const bubbleObjectIds = queryAllHtml('.akte-chart-element[data-object-id]').map(node => node.dataset.objectId);
    expect(bubbleObjectIds.length).toBeGreaterThan(0);
    bubbleObjectIds.forEach(id => expect(visibleMeasureIds.has(id)).toBe(true));
  });
});

describe('V8: Umschalter "als Tabelle" mit identischem Dateninhalt', () => {
  it('shows the same measure labels in the table as in the chart', () => {
    const svgLabels = queryAllHtml('.akte-chart-element[data-object-id]').map(node => node.dataset.objectId).sort();
    click(document.querySelector('[data-chart-toggle-table]'));
    const table = document.querySelector('.akte-chart-table');
    expect(table).toBeTruthy();
    const tableIds = queryAllHtml('tr.akte-chart-element', table).map(node => node.dataset.objectId).sort();
    expect(tableIds).toEqual(svgLabels);
  });
});
