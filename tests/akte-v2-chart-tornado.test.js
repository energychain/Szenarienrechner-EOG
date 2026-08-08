// @vitest-environment jsdom
//
// Stufe V-2 der Visualisierungs-Spezifikation: Renderer + Wirkungsrangliste
// (Tornado) auf dem Filter "clarification". Deckt V1-V5, V8, V9. Rendering
// gegen die echte Quelle (jsdom), Skalen-/Zustandslogik selbst ist bereits in
// tests/chart-model.test.js (Stufe V-1) abgedeckt.
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

function keydown(node, key) {
  node.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
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
  click(document.querySelector('[data-filter="clarification"]'));
});

describe('V1: die Filterspalte bleibt unverändert', () => {
  it('gets no new entry for the chart ("Analyse"/"Auswertung"/"Diagramme" darf nicht existieren)', () => {
    const filterLabels = [...document.querySelectorAll('.akte-filter-item span:first-child')].map(node => node.textContent);
    expect(filterLabels.some(label => /analyse|auswertung|diagramm/i.test(label))).toBe(false);
    // exactly the known, pre-existing set of filters
    expect(filterLabels).toEqual(['Alles', 'Maßnahmen', 'Offen', 'Ziele', 'Kontext', 'Quellen', 'Rahmen', 'Szenarien', 'Aktiv', 'Ohne Ziel-Zuordnung']);
  });
});

describe('V2: das Diagramm zeigt nur Objekte der aktiven Filtermenge', () => {
  it('every element with an object reference points at something in the currently visible clarification list', () => {
    const visibleClarificationIds = new Set(
      queryAllHtml('.akte-object-list-item[data-object-type="clarification"]').map(node => node.dataset.objectId)
    );
    const chartObjectIds = queryAllHtml('.akte-chart-element[data-object-id]').map(node => node.dataset.objectId);
    expect(chartObjectIds.length).toBeGreaterThan(0); // demo data actually produces a match (riskAvoided driver)
    chartObjectIds.forEach(id => expect(visibleClarificationIds.has(id)).toBe(true));
  });
});

describe('V3: genau ein Diagramm je Filter, nicht umschaltbar', () => {
  it('renders exactly one <section class="akte-chart"> for the clarification filter, with no chart-type switcher', () => {
    const sections = queryAllHtml('.akte-chart');
    expect(sections.length).toBe(1);
    expect(sections[0].dataset.chartType).toBe('tornado');
    expect(document.querySelector('[data-chart-type-select]')).toBeFalsy();
  });

  it('a filter without an assigned chart type shows none (Abschnitt 4.2: "Filter ohne zugeordnetes Diagramm zeigen keins")', () => {
    click(document.querySelector('[data-filter="objective"]'));
    expect(document.querySelector('.akte-chart')).toBeFalsy();
  });
});

describe('V4: Klick auf ein Element mit Objektbezug = Klick auf die Listenzeile', () => {
  it('clicking a chart bar with an object reference selects the same object as clicking its list row', () => {
    const chartElement = /** @type {HTMLElement} */ (document.querySelector('.akte-chart-element[data-object-id]'));
    expect(chartElement).toBeTruthy();
    const expectedId = chartElement.dataset.objectId;

    click(chartElement);
    expect(debug.getSelectedType()).toBe('clarification');
    expect(debug.getSelectedId()).toBe(expectedId);

    // now verify the equivalent list row produces the identical selection
    debug.setSelectedObject('measure', debug.getModel().measures[0]?.id || ''); // perturb selection first
    const listRow = document.querySelector(`.akte-object-list-item[data-object-type="clarification"][data-object-id="${expectedId}"]`);
    expect(listRow).toBeTruthy();
    click(listRow);
    expect(debug.getSelectedType()).toBe('clarification');
    expect(debug.getSelectedId()).toBe(expectedId);
  });

  it('clicking a bar without an object reference does not change the current selection', () => {
    const before = { type: debug.getSelectedType(), id: debug.getSelectedId() };
    const unlinkedElement = queryAllHtml('.akte-chart-element').find(node => !node.dataset.objectId);
    expect(unlinkedElement).toBeTruthy(); // returnRate/financingRate/usefulLife/kanuEndYear have no demo clarification match
    click(unlinkedElement);
    expect(debug.getSelectedType()).toBe(before.type);
    expect(debug.getSelectedId()).toBe(before.id);
  });
});

describe('V5: jedes grafische Element trägt genau eine Wertzustandsklasse', () => {
  it('every chart element carries exactly one akte-chart-mark--* class', () => {
    const elements = document.querySelectorAll('.akte-chart-element');
    expect(elements.length).toBeGreaterThan(0);
    const stateClasses = ['akte-chart-mark--set', 'akte-chart-mark--default', 'akte-chart-mark--derived', 'akte-chart-mark--openByDecision'];
    elements.forEach(element => {
      const present = stateClasses.filter(cls => element.classList.contains(cls));
      expect(present.length, `${element.outerHTML} has ${present.length} state classes`).toBe(1);
    });
  });
});

describe('V8: Umschalter "als Tabelle" mit identischem Dateninhalt', () => {
  it('toggles between the SVG chart and a table with the same driver labels and value states', () => {
    const svgLabels = [...document.querySelectorAll('.akte-chart svg .akte-chart-label')].map(node => node.textContent);
    expect(document.querySelector('.akte-chart svg')).toBeTruthy();
    expect(document.querySelector('.akte-chart-table')).toBeFalsy();

    click(document.querySelector('[data-chart-toggle-table]'));
    expect(document.querySelector('.akte-chart svg')).toBeFalsy();
    const table = document.querySelector('.akte-chart-table');
    expect(table).toBeTruthy();
    const tableLabels = [...table.querySelectorAll('tbody tr td:first-child')].map(node => node.textContent);
    expect(tableLabels).toEqual(svgLabels);

    // toggling back returns the chart, and the choice is remembered per filter
    click(document.querySelector('[data-chart-toggle-table]'));
    expect(document.querySelector('.akte-chart svg')).toBeTruthy();
  });

  it('remembers the collapsed/table state per filter across renders', () => {
    click(document.querySelector('[data-chart-toggle-table]'));
    click(document.querySelector('[data-filter="measure"]'));
    click(document.querySelector('[data-filter="clarification"]'));
    expect(document.querySelector('.akte-chart-table')).toBeTruthy();
  });

  it('collapsing the chart hides its body but keeps the toggle reachable', () => {
    click(document.querySelector('[data-chart-toggle-collapse]'));
    expect(document.querySelector('.akte-chart svg')).toBeFalsy();
    expect(document.querySelector('.akte-chart-table')).toBeFalsy();
    expect(document.querySelector('[data-chart-toggle-collapse]')).toBeTruthy();
  });
});

describe('V9: vollständig ohne Maus bedienbar, jedes Element hat eine <title>', () => {
  it('every SVG element carries a <title> child with label, value and state in plain text', () => {
    const elements = document.querySelectorAll('.akte-chart svg .akte-chart-element');
    expect(elements.length).toBeGreaterThan(0);
    elements.forEach(element => {
      const title = element.querySelector('title');
      expect(title).toBeTruthy();
      expect(title.textContent.length).toBeGreaterThan(5);
      expect(title.textContent).toMatch(/TEUR/);
      expect(title.textContent).toMatch(/Zustand/);
    });
  });

  it('exactly one element is the roving tab stop, and ArrowRight/ArrowLeft move it without a mouse', () => {
    const elements = () => [...document.querySelectorAll('.akte-chart svg .akte-chart-element')];
    expect(elements().filter(el => el.getAttribute('tabindex') === '0').length).toBe(1);
    expect(elements()[0].getAttribute('tabindex')).toBe('0');

    keydown(elements()[0], 'ArrowRight');
    expect(elements()[0].getAttribute('tabindex')).toBe('-1');
    expect(elements()[1].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(elements()[1]);

    keydown(elements()[1], 'ArrowLeft');
    expect(elements()[0].getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(elements()[0]);
  });

  it('Enter on a focused element with an object reference selects it, same as a click', () => {
    const elements = queryAllHtml('.akte-chart svg .akte-chart-element');
    const withObject = elements.find(el => el.dataset.objectId);
    expect(withObject).toBeTruthy();
    keydown(withObject, 'Enter');
    expect(debug.getSelectedType()).toBe('clarification');
    expect(debug.getSelectedId()).toBe(withObject.dataset.objectId);
  });
});
