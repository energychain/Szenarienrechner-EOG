// @vitest-environment jsdom
//
// Nachtrag: "3 Wirkannahme(n) hinterlegt" im Wirkung-Satz einer Maßnahme
// sah aus wie ein Wert (fette Zahl in der Satzdarstellung), war aber nicht
// klickbar — Wirkannahmen hatten volle Felddeskriptoren (field-registry.js)
// für Diagramme/Evidenzprüfung, aber keine eigene Ansicht zum Anschauen
// oder Bearbeiten in der Akte. Dieser Test deckt die nachgezogene volle
// Bearbeitung: jede Wirkannahme einer Maßnahme erscheint als eigener,
// aufklappbarer Block direkt unter der "Wirkung"-Gruppe, mit derselben
// Popover-Bearbeitung je Feld wie überall sonst, plus Anlegen/Löschen.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(__dirname, '../akte.html'), 'utf8');

let debug;
let confirmSpy;

function click(node) {
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

beforeEach(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  localStorage.clear();
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.resetModules();
  const mainModulePath = '../src/main-akte.js';
  await import(mainModulePath);
  debug = /** @type {any} */ (window).__akte2Debug;
  click(document.getElementById('akteLoadDemoButton'));
});

function firstMeasureWithImpacts() {
  return debug.getModel().measures.find(measure => (measure.impactAssumptions || []).length > 0);
}

describe('Wirkannahmen: jede Wirkannahme erscheint als eigener Block unter "Wirkung"', () => {
  it('shows one akte-wirkannahme-block per impact assumption, titled with the assumption title', () => {
    const measure = firstMeasureWithImpacts();
    debug.setSelectedObject('measure', measure.id);
    const blocks = [...document.querySelectorAll('.akte-wirkannahme-block')];
    expect(blocks.length).toBe(measure.impactAssumptions.length);
    measure.impactAssumptions.forEach(impact => {
      expect(blocks.some(block => block.querySelector('summary span').textContent === impact.title)).toBe(true);
    });
  });

  it('every field of a Wirkannahme block is editable through the same popover mechanism as any other object', () => {
    const measure = firstMeasureWithImpacts();
    const impact = measure.impactAssumptions[0];
    debug.setSelectedObject('measure', measure.id);
    const block = [...document.querySelectorAll('.akte-wirkannahme-block')].find(node => node.querySelector('summary span').textContent === impact.title);
    const amountButton = /** @type {HTMLElement} */ (block.querySelector('[data-edit-key="amount"]'));
    expect(amountButton).toBeTruthy();
    expect(amountButton.dataset.objectType).toBe('impactAssumption');
    expect(amountButton.dataset.objectId).toBe(`${measure.id}:${impact.id}`);
    click(amountButton);
    const input = /** @type {HTMLInputElement} */ (document.getElementById('akteFieldInput'));
    expect(input).toBeTruthy();
    input.value = '999';
    click(document.getElementById('aktePopoverSave'));
    expect(debug.getModel().measures.find(m => m.id === measure.id).impactAssumptions.find(i => i.id === impact.id).amount).toBe(999);
  });

  it('a saved field change is recorded in history with measureId/impactId subject (diffImpactEvents shape)', () => {
    const measure = firstMeasureWithImpacts();
    const impact = measure.impactAssumptions[0];
    debug.setSelectedObject('measure', measure.id);
    const block = [...document.querySelectorAll('.akte-wirkannahme-block')].find(node => node.querySelector('summary span').textContent === impact.title);
    click(block.querySelector('[data-edit-key="amount"]'));
    /** @type {HTMLInputElement} */ (document.getElementById('akteFieldInput')).value = '777';
    click(document.getElementById('aktePopoverSave'));
    const events = debug.getHistory().events;
    expect(events.some(event => event.subject?.measureId === measure.id && event.subject?.impactId === impact.id && event.field === 'amount' && event.newValue === 777)).toBe(true);
  });
});

describe('Wirkannahmen: Anlegen und Löschen', () => {
  it('"+ Wirkannahme anlegen" adds a new impact assumption to that measure and renders a new block', () => {
    const measure = firstMeasureWithImpacts();
    const before = measure.impactAssumptions.length;
    debug.setSelectedObject('measure', measure.id);
    click(document.querySelector(`[data-add-impact-assumption="${measure.id}"]`));
    const after = debug.getModel().measures.find(m => m.id === measure.id).impactAssumptions;
    expect(after.length).toBe(before + 1);
    expect(document.querySelectorAll('.akte-wirkannahme-block').length).toBe(before + 1);
  });

  it('deleting a Wirkannahme removes it from measure.impactAssumptions and its block disappears', () => {
    const measure = firstMeasureWithImpacts();
    const impact = measure.impactAssumptions[0];
    const before = measure.impactAssumptions.length;
    debug.setSelectedObject('measure', measure.id);
    const compoundId = `${measure.id}:${impact.id}`;
    click(document.querySelector(`[data-delete-impact-assumption="${compoundId}"]`));
    const after = debug.getModel().measures.find(m => m.id === measure.id).impactAssumptions;
    expect(after.length).toBe(before - 1);
    expect(after.find(i => i.id === impact.id)).toBeUndefined();
    expect(document.querySelector(`[data-delete-impact-assumption="${compoundId}"]`)).toBeFalsy();
  });

  it('deleting is guarded by window.confirm, same as measures/sidecars', () => {
    confirmSpy.mockReturnValue(false);
    const measure = firstMeasureWithImpacts();
    const impact = measure.impactAssumptions[0];
    const before = measure.impactAssumptions.length;
    debug.setSelectedObject('measure', measure.id);
    click(document.querySelector(`[data-delete-impact-assumption="${measure.id}:${impact.id}"]`));
    expect(debug.getModel().measures.find(m => m.id === measure.id).impactAssumptions.length).toBe(before);
  });
});

describe('Wirkannahmen: der Zusammenfassungssatz bleibt unverändert', () => {
  it('the "N Wirkannahme(n) hinterlegt" summary in the Wirkung sentence still shows the count', () => {
    const measure = firstMeasureWithImpacts();
    debug.setSelectedObject('measure', measure.id);
    const summarySpan = document.querySelector('.akte-value--summary');
    expect(summarySpan).toBeTruthy();
    expect(summarySpan.textContent).toBe(String(measure.impactAssumptions.length));
  });
});
