// @vitest-environment jsdom
//
// Stufe V-7 der Visualisierungs-Spezifikation: Großfassungen aller sechs
// Diagramme im Ausgabefenster (Report / Befassungsvorlage), mit Achsen,
// Legende und Quellenzeile (Abschnitt 4.3). Deckt V13/V14 indirekt über den
// bestehenden Distribution-Check/Charakterisierungstest; dieser Test prüft
// den fachlichen Inhalt (Achsen, Legende, Quellenzeile, alle sechs Typen).
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
  click(document.getElementById('akteOutputButton'));
});

describe('Abschnitt 4.3: Großfassungen im Ausgabefenster (Report-Reiter)', () => {
  it('shows all six chart types from the Diagrammkatalog, each with a heading', () => {
    const headings = queryAllHtml('.akte-output-chart h4').map(node => node.textContent);
    expect(headings).toEqual([
      'Risikomatrix',
      'Liquiditäts-/EOG-Verlauf',
      'Wasserfall',
      'Beitragsbalken',
      'Wirkungsrangliste',
      'Segmentbalken'
    ]);
  });

  it('every rendered chart carries a value axis (Achsen/Werteachse), unlike the compact object-surface version', () => {
    const chartSvgs = queryAllHtml('.akte-output-chart svg');
    expect(chartSvgs.length).toBeGreaterThan(0);
    chartSvgs.forEach(svg => {
      const axisLine = svg.querySelector('.akte-chart-axis-line');
      const axisLabels = svg.querySelectorAll('.akte-chart-axis-label');
      expect(axisLine, `${svg.getAttribute('aria-label')} has no axis line`).toBeTruthy();
      expect(axisLabels.length, `${svg.getAttribute('aria-label')} has no axis tick labels`).toBeGreaterThan(0);
    });
  });

  it('shows a shared value-state legend once for the whole chart section', () => {
    const legend = document.querySelector('.akte-chart-legend');
    expect(legend).toBeTruthy();
    expect(legend.textContent).toContain('geprüft');
    expect(legend.textContent).toContain('Vorbelegung');
    expect(legend.textContent).toContain('abgeleitet');
    expect(legend.textContent).toContain('bewusst offen');
    expect(legend.textContent).toContain('Evidenz fehlt');
  });

  it('shows a Quellenzeile (source line) for the chart section', () => {
    const source = document.querySelector('.akte-chart-source');
    expect(source).toBeTruthy();
    expect(source.textContent).toContain('Quelle');
  });

  it('the large charts are noticeably bigger than the compact object-surface version (720×320 vs 560×220)', () => {
    const svg = document.querySelector('.akte-output-chart svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 720 320');
  });

  it('are static output, not wired to the object-surface selection/filter mechanism (no click-driven state change)', () => {
    const before = { type: debug.getSelectedType(), id: debug.getSelectedId(), filterKey: debug.getFilterKey() };
    const chartElement = document.querySelector('.akte-output-chart .akte-chart-element');
    expect(chartElement).toBeTruthy();
    click(chartElement);
    expect(debug.getSelectedType()).toBe(before.type);
    expect(debug.getSelectedId()).toBe(before.id);
    expect(debug.getFilterKey()).toBe(before.filterKey);
  });

  it('an empty-state chart (e.g. no measures) states the missing input instead of a blank chart', () => {
    debug.getModel().measures.length = 0;
    click(document.getElementById('akteOutputButton')); // re-open re-renders report
    click(document.getElementById('akteOutputButton'));
    const riskMatrixSection = queryAllHtml('.akte-output-chart').find(section => section.querySelector('h4').textContent === 'Risikomatrix');
    expect(riskMatrixSection.querySelector('.akte-chart-empty')).toBeTruthy();
  });
});

describe('V14: die Rechenergebnisse ändern sich durch die Großfassung nicht', () => {
  it('the KPI values shown in the report table match currentPortfolio(), independent of the new chart section', () => {
    const portfolio = debug.currentPortfolio();
    const reportText = document.getElementById('akteOutputBody').textContent;
    expect(reportText).toContain(String(Math.round(portfolio.npv * 10) / 10).split('.')[0]);
  });
});
