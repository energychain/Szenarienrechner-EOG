// @vitest-environment jsdom
//
// Nachtrag: initiale Datenerfassung. Ein frisches Skelett (Stufe 6, keine
// Maßnahmen, keine Kontextobjekte/Quellen) bot bislang keine Möglichkeit,
// überhaupt eine erste Maßnahme oder ein Sidecar-Objekt anzulegen — Ziele,
// Kontextobjekte und Quellen entstanden bisher nur indirekt als
// Stellvertreterobjekt über ein Referenzfeld einer bereits existierenden
// Maßnahme (Abschnitt 6.2, Lückenart 3), und für Maßnahmen fehlte sogar
// dieser Umweg. Dieser Test prüft den direkten "+ Neu"-Weg für alle vier
// anlegbaren Objekttypen, aus dem leeren Skelett heraus.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
});

afterEach(() => {
  localStorage.clear();
  confirmSpy.mockRestore();
});

describe('initiale Datenerfassung: "+ Neu" legt Objekte direkt an (nicht nur über Stellvertreter)', () => {
  it('a brand-new session (no measures) offers a "+ Maßnahme anlegen" action on the empty Maßnahmen filter', () => {
    expect(debug.getModel().measures).toEqual([]);
    click(document.querySelector('[data-filter="measure"]'));
    const addButton = document.querySelector('[data-add-object-type="measure"]');
    expect(addButton, 'no add-measure button on the empty measure filter').toBeTruthy();
  });

  it('an empty Maßnahmen filter shows its own empty state, not a silent fallback to an unrelated object (e.g. Rahmen)', () => {
    click(document.querySelector('[data-filter="measure"]'));
    const surfaceText = document.getElementById('akteObjectSurface').textContent;
    expect(surfaceText).toContain('Keine Objekte in diesem Filter.');
    expect(surfaceText).not.toContain('Rahmen: Sparte');
    // the selection itself may still fall back internally (so it stays
    // valid once you switch filters), but nothing from that fallback leaks
    // into what is actually rendered for the empty "measure" filter.
    expect(document.querySelectorAll('.akte-object-list-item').length).toBe(0);
  });

  it('clicking "+ Maßnahme anlegen" creates, selects and immediately shows an editable measure', () => {
    click(document.querySelector('[data-filter="measure"]'));
    click(document.querySelector('[data-add-object-type="measure"]'));

    const measures = debug.getModel().measures;
    expect(measures.length).toBe(1);
    expect(debug.getSelectedType()).toBe('measure');
    expect(debug.getSelectedId()).toBe(measures[0].id);
    // not a Stellvertreterobjekt: this is a deliberate, direct creation
    expect(debug.getModel().provisionalIds.measure).not.toContain(measures[0].id);
    // the new measure is immediately editable through the same field popover
    expect(document.querySelector('[data-edit-key="name"]')).toBeTruthy();
  });

  it('a measure can be added even when other measures already exist', () => {
    click(document.querySelector('[data-filter="measure"]'));
    click(document.querySelector('[data-add-object-type="measure"]'));
    click(document.querySelector('[data-add-object-type="measure"]'));
    expect(debug.getModel().measures.length).toBe(2);
    expect(document.querySelector('[data-add-object-type="measure"]')).toBeTruthy();
  });

  it.each([
    ['objective', 'strategy.objectives'],
    ['sidecarObject', 'sidecar.objects'],
    ['sidecarSource', 'sidecar.sources']
  ])('"+ Neu" also creates %s objects directly, from the empty skeleton', (objectType, path) => {
    click(document.querySelector(`[data-filter="${objectType}"]`));
    const addButton = document.querySelector(`[data-add-object-type="${objectType}"]`);
    expect(addButton, `no add button for ${objectType}`).toBeTruthy();
    click(addButton);

    const [scope, key] = path.split('.');
    const collection = debug.getModel()[scope][key];
    expect(collection.length).toBeGreaterThan(0);
    expect(debug.getSelectedType()).toBe(objectType);
    expect(debug.getSelectedId()).toBe(collection.at(-1).id);
  });

  it('the "+ Neu" action is absent on filters that are not a single creatable object type (Alles, Offen, gespeicherte Filter)', () => {
    click(document.querySelector('[data-filter="all"]'));
    expect(document.querySelector('[data-add-object-type]')).toBeFalsy();

    click(document.querySelector('[data-filter="active"]'));
    expect(document.querySelector('[data-add-object-type]')).toBeFalsy();
  });

  it('typing an unknown measure name into a sidecarObject.linkedMeasures reference field also creates the measure (Stellvertreterobjekt)', () => {
    click(document.querySelector('[data-filter="sidecarObject"]'));
    click(document.querySelector('[data-add-object-type="sidecarObject"]'));
    const linkedMeasuresButton = document.querySelector('[data-edit-key="linkedMeasures"]');
    expect(linkedMeasuresButton).toBeTruthy();
    click(linkedMeasuresButton);
    /** @type {HTMLInputElement} */ (document.getElementById('akteFieldInput')).value = 'Frisch referenzierte Maßnahme';
    click(document.getElementById('aktePopoverSave'));

    const measures = debug.getModel().measures;
    expect(measures.length).toBe(1);
    expect(measures[0].name).toBe('Frisch referenzierte Maßnahme');
    // unlike the direct "+ Neu" path, this one is a genuine Stellvertreterobjekt
    expect(debug.getModel().provisionalIds.measure).toContain(measures[0].id);
  });
});

describe('was angelegt werden kann, kann auch wieder gelöscht werden', () => {
  it('a freshly created measure carries a "Löschen" button in its own detail pane', () => {
    click(document.querySelector('[data-filter="measure"]'));
    click(document.querySelector('[data-add-object-type="measure"]'));
    const deleteButton = /** @type {HTMLElement} */ (document.querySelector('[data-delete-object-type="measure"]'));
    expect(deleteButton).toBeTruthy();
    expect(deleteButton.dataset.deleteObjectId).toBe(debug.getModel().measures[0].id);
  });

  it('clicking "Löschen" asks for confirmation and removes the measure on confirm', () => {
    click(document.querySelector('[data-filter="measure"]'));
    click(document.querySelector('[data-add-object-type="measure"]'));
    click(document.querySelector('[data-delete-object-type="measure"]'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(debug.getModel().measures).toEqual([]);
    // the empty filter's own empty state (with its add button) comes back,
    // not a silent fallback to some unrelated object.
    expect(document.getElementById('akteObjectSurface').textContent).toContain('Keine Objekte in diesem Filter.');
  });

  it('declining the confirmation dialog keeps the measure', () => {
    confirmSpy.mockReturnValue(false);
    click(document.querySelector('[data-filter="measure"]'));
    click(document.querySelector('[data-add-object-type="measure"]'));
    click(document.querySelector('[data-delete-object-type="measure"]'));
    expect(debug.getModel().measures.length).toBe(1);
  });

  it.each([
    ['objective', 'strategy.objectives'],
    ['sidecarObject', 'sidecar.objects'],
    ['sidecarSource', 'sidecar.sources']
  ])('%s objects created via "+ Neu" can also be deleted again', (objectType, path) => {
    const [scope, key] = path.split('.');
    // the skeleton already seeds default objectives (Stufe 6), so this
    // compares before/after counts rather than assuming an empty start.
    const before = debug.getModel()[scope][key].length;
    click(document.querySelector(`[data-filter="${objectType}"]`));
    click(document.querySelector(`[data-add-object-type="${objectType}"]`));
    const createdId = debug.getSelectedId();
    expect(debug.getModel()[scope][key].length).toBe(before + 1);

    click(document.querySelector(`[data-delete-object-type="${objectType}"]`));
    expect(debug.getModel()[scope][key].length).toBe(before);
    expect(debug.getModel()[scope][key].some(item => item.id === createdId)).toBe(false);
  });

  it('deleting the selected object hands selection to something that still exists, instead of leaving it dangling', () => {
    click(document.querySelector('[data-filter="measure"]'));
    click(document.querySelector('[data-add-object-type="measure"]'));
    const deletedId = debug.getModel().measures[0].id;
    click(document.querySelector('[data-delete-object-type="measure"]'));

    expect(debug.getSelectedId()).not.toBe(deletedId);
    // whatever the fallback selection is, it must actually resolve to a
    // real, rendered object — not a blank/broken detail pane.
    expect(document.querySelector('.akte-object-title, .akte-empty-state')).toBeTruthy();
  });

  it('no "Löschen" button appears for Rahmen/Szenario (model.inputs) or Klärpunkt objects — those are not directly deletable', () => {
    click(document.querySelector('[data-filter="rahmen"]'));
    expect(document.querySelector('[data-delete-object-type]')).toBeFalsy();
  });
});
