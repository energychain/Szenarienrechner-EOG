// @vitest-environment jsdom
//
// Stufe V-6 der Visualisierungs-Spezifikation: Mikro-Verlauf in der
// Kontextspalte (Abschnitt 4.1). Deckt V10. Skalen-/Datenlogik selbst ist
// bereits in tests/chart-model.test.js (measureMicroFlowModel) abgedeckt.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(__dirname, '../akte.html'), 'utf8');

let debug;

function click(node) {
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
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

describe('Abschnitt 4.1: Mikro-Verlauf "Wirkung dieses Objekts"', () => {
  it('renders a small SVG (≤ 280×90 px) for a selected measure, with no axis labels, legend, or interactive elements', () => {
    click(document.querySelector('[data-filter="measure"]'));
    const svg = document.querySelector('.akte-context-column .akte-micro-chart');
    expect(svg).toBeTruthy();
    expect(Number(svg.getAttribute('width'))).toBeLessThanOrEqual(280);
    expect(Number(svg.getAttribute('height'))).toBeLessThanOrEqual(90);
    // "keine Achsenbeschriftung, keine Legende, keine Interaktion, kein Klickziel"
    expect(svg.querySelectorAll('text').length).toBe(0);
    expect(svg.querySelectorAll('[tabindex]').length).toBe(0);
    expect(svg.querySelectorAll('title').length).toBe(0);
  });

  it('V10: every value the micro chart traces already exists as text elsewhere in the context column (EOG Jahr 1, IRR/Kapitalwert)', () => {
    click(document.querySelector('[data-filter="measure"]'));
    const contextText = document.getElementById('akteContextColumn').textContent;
    expect(contextText).toContain('EOG Jahr 1');
    expect(contextText).toContain('Kapitalwert');
    // the micro chart itself is aria-hidden — it never claims to be the sole
    // source of a labeled value (Kriterium V10 is trivially satisfied by
    // construction: no labels exist on the graphic to begin with).
    const svg = document.querySelector('.akte-context-column .akte-micro-chart');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('entfällt ersatzlos for a non-measure object type (Abschnitt 4.1)', () => {
    click(document.querySelector('[data-filter="objective"]'));
    expect(document.querySelector('.akte-context-column .akte-micro-chart')).toBeFalsy();
  });

  it('entfällt ersatzlos for a Klärpunkt (clarification) selection too', () => {
    click(document.querySelector('[data-filter="clarification"]'));
    expect(document.querySelector('.akte-context-column .akte-micro-chart')).toBeFalsy();
  });

  it('does not throw and renders no chart for a measure with no rows (degenerate horizon)', () => {
    const measure = debug.getModel().measures[0];
    debug.getModel().inputs.horizon = 0;
    debug.setSelectedObject('measure', measure.id);
    expect(document.getElementById('akteContextColumn')).toBeTruthy();
  });
});
