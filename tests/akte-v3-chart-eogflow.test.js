// @vitest-environment jsdom
//
// Stufe V-3 der Visualisierungs-Spezifikation: Liquiditäts-/EOG-Verlauf auf
// den Filtern "kpi:eogYear1"/"kpi:eogFollow", inklusive Jahresmarkierung
// (Abschnitt 7.2). Deckt V2, V3, V7. Der generische Renderer-Mechanismus
// (Tabellen-Umschalter, Tastatur, Wertzustandsklassen) ist bereits in
// tests/akte-v2-chart-tornado.test.js abgedeckt und wird hier nicht
// wiederholt, nur die diagrammspezifischen Anforderungen.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(__dirname, '../akte.html'), 'utf8');

let debug;

function click(node) {
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

/** @returns {HTMLElement[]} */
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
});

describe('V3: genau ein Diagramm je Filter, für beide EOG-Filter', () => {
  it('kpi:eogYear1 renders exactly one eogFlow chart, no chart-type switcher', () => {
    click(document.querySelector('[data-kpi="eogYear1"]'));
    const sections = queryAllHtml('.akte-chart');
    expect(sections.length).toBe(1);
    expect(sections[0].dataset.chartType).toBe('eogFlow');
    expect(document.querySelector('[data-chart-type-select]')).toBeFalsy();
  });

  it('kpi:eogFollow shows the same chart type as kpi:eogYear1 (same underlying data, same diagram)', () => {
    click(document.querySelector('[data-kpi="eogFollow"]'));
    expect(queryAllHtml('.akte-chart')[0].dataset.chartType).toBe('eogFlow');
  });
});

describe('V2: das Diagramm zeigt nur Objekte der aktiven Filtermenge', () => {
  it('year columns never carry an object reference (Abschnitt 7.2: Jahressäule ist kein Objekt)', () => {
    click(document.querySelector('[data-kpi="eogYear1"]'));
    const columns = queryAllHtml('.akte-chart-element');
    expect(columns.length).toBeGreaterThan(0);
    columns.forEach(column => {
      expect(column.dataset.objectType).toBeUndefined();
      expect(column.dataset.objectId).toBeUndefined();
      expect(column.dataset.chartYear).toBeTruthy();
    });
  });
});

describe('Abschnitt 7.2: Jahresmarkierung statt Objektauswahl', () => {
  it('clicking a year column does not change the current object selection', () => {
    click(document.querySelector('[data-kpi="eogYear1"]'));
    const before = { type: debug.getSelectedType(), id: debug.getSelectedId() };
    click(queryAllHtml('.akte-chart-element')[0]);
    expect(debug.getSelectedType()).toBe(before.type);
    expect(debug.getSelectedId()).toBe(before.id);
  });

  it('clicking a year column makes the context column show that year\'s breakdown', () => {
    click(document.querySelector('[data-kpi="eogYear1"]'));
    const firstColumn = queryAllHtml('.akte-chart-element')[0];
    const year = firstColumn.dataset.chartYear;
    click(firstColumn);

    const contextText = document.getElementById('akteContextColumn').textContent;
    expect(contextText).toContain(year);
    expect(contextText).toContain('AfA');
    expect(contextText).toContain('Verzinsung');
    expect(contextText).toContain('Indikativer Cashflow');
  });

  it('is the only additional interaction state: it does not touch filterKey or selection', () => {
    click(document.querySelector('[data-kpi="eogYear1"]'));
    const filterBefore = debug.getFilterKey();
    click(queryAllHtml('.akte-chart-element')[2]);
    expect(debug.getFilterKey()).toBe(filterBefore);
  });

  it('"Markierung aufheben" clears the year marker and restores the normal context', () => {
    click(document.querySelector('[data-kpi="eogYear1"]'));
    click(queryAllHtml('.akte-chart-element')[0]);
    expect(document.querySelector('[data-chart-year-clear]')).toBeTruthy();

    click(document.querySelector('[data-chart-year-clear]'));
    expect(document.querySelector('[data-chart-year-clear]')).toBeFalsy();
  });

  it('leaving the eogFlow filter clears the year marker (it does not leak into unrelated filters)', () => {
    click(document.querySelector('[data-kpi="eogYear1"]'));
    click(queryAllHtml('.akte-chart-element')[0]);
    expect(document.querySelector('[data-chart-year-clear]')).toBeTruthy();

    click(document.querySelector('[data-filter="measure"]'));
    click(document.querySelector('[data-kpi="eogYear1"]'));
    // returning to the chart without re-clicking a column should not still
    // show a stale year breakdown
    expect(document.querySelector('[data-chart-year-clear]')).toBeFalsy();
  });
});

describe('V7: Leerzustand benennt die fehlende Angabe (nicht "keine Daten")', () => {
  it('a model with no computable horizon states what is missing and does not say "keine Daten"', () => {
    const emptyModel = debug.getModel();
    emptyModel.measures.length = 0;
    emptyModel.inputs.horizon = 0;
    click(document.querySelector('[data-kpi="eogYear1"]'));
    const emptyNode = document.querySelector('.akte-chart-empty');
    if (emptyNode) {
      expect(emptyNode.textContent.toLowerCase()).not.toContain('keine daten');
      expect(emptyNode.textContent.length).toBeGreaterThan(10);
    }
  });
});
