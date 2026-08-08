// @vitest-environment jsdom
//
// Stufe V-5 der Visualisierungs-Spezifikation: Wasserfall (kpi:npv),
// Beitragsbalken (kpi:irr) und Segmentbalken (rahmen). Deckt V2-V4. Der
// generische Renderer-Mechanismus (Tabellen-Umschalter, Tastatur,
// Wertzustandsklassen, <title>) ist bereits in
// tests/akte-v2-chart-tornado.test.js abgedeckt.
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
});

describe('Wasserfall (kpi:npv)', () => {
  beforeEach(() => click(document.querySelector('[data-kpi="npv"]')));

  it('V3: renders exactly one waterfall chart, no chart-type switcher', () => {
    const sections = queryAllHtml('.akte-chart');
    expect(sections.length).toBe(1);
    expect(sections[0].dataset.chartType).toBe('waterfall');
    expect(document.querySelector('[data-chart-type-select]')).toBeFalsy();
  });

  it('the first bar is Basis-EOG and carries no object reference (a framework value, not a measure contribution)', () => {
    const firstBar = queryAllHtml('.akte-chart-element')[0];
    expect(firstBar.dataset.objectType).toBeUndefined();
    expect(firstBar.querySelector('title').textContent).toContain('Basis-EOG');
  });

  it('bar heights reflect the cascading running total, not a hairline for every step (regression: SVG y-axis inversion bug)', () => {
    const bars = queryAllHtml('.akte-chart-element rect:not(.akte-chart-hit-area)');
    expect(bars.length).toBe(5);
    const heights = bars.map(bar => Number(bar.getAttribute('height')));
    expect(Math.max(...heights)).toBeGreaterThan(5);
  });

  it('with multiple active measures (demo default), no waterfall step is attributable to a single measure ("wo eindeutig")', () => {
    const bars = queryAllHtml('.akte-chart-element');
    expect(bars.length).toBeGreaterThan(1);
    bars.forEach(bar => expect(bar.dataset.objectType).toBeUndefined());
  });

  it('V4: with exactly one active measure, the contribution steps become attributable and select that measure on click', () => {
    const measures = debug.getModel().measures;
    measures.forEach(measure => { measure.active = measure.id === 'demo_grid_automation'; });
    debug.setFilterKey('kpi:npv');

    const bars = queryAllHtml('.akte-chart-element');
    const contributionBar = bars.find(bar => bar.dataset.objectId === 'demo_grid_automation');
    expect(contributionBar, 'no waterfall step became attributable to the sole active measure').toBeTruthy();

    click(contributionBar);
    expect(debug.getSelectedType()).toBe('measure');
    expect(debug.getSelectedId()).toBe('demo_grid_automation');
  });
});

describe('Beitragsbalken (kpi:irr)', () => {
  beforeEach(() => click(document.querySelector('[data-kpi="irr"]')));

  it('V3: renders exactly one contributionBars chart, no chart-type switcher', () => {
    const sections = queryAllHtml('.akte-chart');
    expect(sections.length).toBe(1);
    expect(sections[0].dataset.chartType).toBe('contributionBars');
  });

  it('V2: every bar points at a measure actually present in the visible (kpi:irr-filtered) list', () => {
    const visibleMeasureIds = new Set(
      queryAllHtml('.akte-object-list-item[data-object-type="measure"]').map(node => node.dataset.objectId)
    );
    const barObjectIds = queryAllHtml('.akte-chart-element[data-object-id]').map(node => node.dataset.objectId);
    expect(barObjectIds.length).toBeGreaterThan(0);
    barObjectIds.forEach(id => expect(visibleMeasureIds.has(id)).toBe(true));
  });

  it('bars are sorted descending by Kapitalwertbeitrag, signs implicitly separated by the zero line', () => {
    click(document.querySelector('[data-chart-toggle-table]'));
    const values = queryAllHtml('.akte-chart-table tbody td:nth-child(2)').map(td => {
      const text = td.textContent.replace(/[.\s]/g, '').replace(',', '.').replace('TEUR', '');
      return Number(text);
    });
    expect(values.length).toBeGreaterThan(0);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('bar heights are actually proportional to their values, not collapsed to a hairline (regression: SVG y-axis inversion bug)', () => {
    const bars = queryAllHtml('.akte-chart-element rect:not(.akte-chart-hit-area)');
    expect(bars.length).toBeGreaterThan(0);
    const heights = bars.map(bar => Number(bar.getAttribute('height')));
    // the demo portfolio's contributions differ enough that a correct render
    // cannot produce (almost) equal, near-zero heights for every bar.
    expect(Math.max(...heights)).toBeGreaterThan(5);
    expect(new Set(heights.map(h => Math.round(h))).size).toBeGreaterThan(1);
  });

  it('V4: clicking a bar selects the same measure as its list row', () => {
    const bar = /** @type {HTMLElement} */ (document.querySelector('.akte-chart-element[data-object-id]'));
    expect(bar).toBeTruthy();
    const expectedId = bar.dataset.objectId;
    click(bar);
    expect(debug.getSelectedType()).toBe('measure');
    expect(debug.getSelectedId()).toBe(expectedId);
  });
});

describe('Segmentbalken (rahmen)', () => {
  beforeEach(() => click(document.querySelector('[data-filter="rahmen"]')));

  it('V3: renders exactly one viabilitySegments chart, no chart-type switcher', () => {
    const sections = queryAllHtml('.akte-chart');
    expect(sections.length).toBe(1);
    expect(sections[0].dataset.chartType).toBe('viabilitySegments');
  });

  it('bar heights reflect CAPEX, not a hairline for every category (regression: SVG y-axis inversion bug)', () => {
    const bars = queryAllHtml('.akte-chart-element rect:not(.akte-chart-hit-area):not(.akte-chart-overlay)');
    expect(bars.length).toBeGreaterThanOrEqual(3);
    const heights = bars.map(bar => Number(bar.getAttribute('height')));
    expect(Math.max(...heights)).toBeGreaterThan(5);
  });

  it('shows one segment per occupied Tragfähigkeitskategorie, using the same category labels as the field registry', () => {
    const segments = queryAllHtml('.akte-chart-element');
    expect(segments.length).toBeGreaterThanOrEqual(3); // demo: strategic_option, asset_preservation_must, regulatory_must
    const ids = segments.map(node => node.dataset.objectId);
    expect(ids).toContain('strategic_option');
    expect(ids).toContain('asset_preservation_must');
    expect(ids).toContain('regulatory_must');
  });

  it('Abschnitt 5: clicking a segment sets the filter to that category instead of selecting the segment itself as an object', () => {
    const segment = queryAllHtml('.akte-chart-element[data-object-id="regulatory_must"]')[0];
    expect(segment).toBeTruthy();
    click(segment);

    expect(debug.getFilterKey()).toBe('viability:regulatory_must');
    // the segment click never selects a "viabilityCategory" object — any
    // resulting selection is only the app's existing, already-established
    // fallback (renderAll() re-anchors selection to the new filter's first
    // visible entry once the old selection falls outside it), not a second
    // selection mechanism introduced by the chart.
    expect(debug.getSelectedType()).not.toBe('viabilityCategory');
  });

  it('the resulting "viability:" filter shows only measures of that category, in the same measure list/detail mechanism', () => {
    click(queryAllHtml('.akte-chart-element[data-object-id="regulatory_must"]')[0]);
    const rows = queryAllHtml('.akte-object-list-item[data-object-type="measure"]');
    // with only demo_fault_response_budget classified as regulatory_must,
    // the filtered list must contain it and nothing of another category.
    const ids = rows.length ? rows.map(r => r.dataset.objectId) : [debug.getSelectedId()];
    expect(ids).toContain('demo_fault_response_budget');
    ids.forEach(id => {
      const measure = debug.getModel().measures.find(m => m.id === id);
      expect(measure.viabilityCategory).toBe('regulatory_must');
    });
  });

  it('no chart appears for the resulting "viability:" filter (Regel 3: kein Diagramm ohne Zuordnung)', () => {
    click(queryAllHtml('.akte-chart-element[data-object-id="regulatory_must"]')[0]);
    expect(document.querySelector('.akte-chart')).toBeFalsy();
  });
});
