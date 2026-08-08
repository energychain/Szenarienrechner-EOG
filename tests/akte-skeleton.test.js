// @vitest-environment jsdom
//
// Stufe 6: Stellvertreterobjekte, Kantenvorschläge, Skelett statt Leere, und
// der (nur warnende, siehe Spezifikation 11.3 und die Auftraggeber-
// Entscheidung dazu) Phasenübergang nach entscheidungsvorlage (Kriterium 10).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(__dirname, '../akte.html'), 'utf8');
const storageKey = 'regulierte-sparten-szenario-rechner-akte-v1';

let debug;
let confirmSpy;

function click(node) {
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

async function boot() {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  vi.resetModules();
  const mainModulePath = '../src/main-akte.js';
  await import(mainModulePath);
  debug = /** @type {any} */ (window).__akte2Debug;
}

beforeEach(async () => {
  localStorage.clear();
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  await boot();
});

afterEach(() => {
  localStorage.clear();
  confirmSpy.mockRestore();
});

describe('Stufe 6: Skelett statt Leere (Abschnitt 6.5)', () => {
  it('starts a brand-new session with the skeleton (no measures), not the demo example', () => {
    expect(debug.getModel().measures).toEqual([]);
    expect(debug.getModel().strategy.objectives.length).toBeGreaterThan(0);
    expect(debug.getSelectedType()).toBe('input');
  });

  it('the skeleton already offers Rahmen, Szenario and Ziel objects to select', () => {
    click(document.querySelector('[data-filter="all"]'));
    const rows = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.akte-object-list-item')]);
    const rowTypes = new Set(rows.map(row => row.dataset.objectType));
    expect(rowTypes.has('input')).toBe(true);
    expect(rowTypes.has('objective')).toBe(true);
  });

  it('"Demodaten laden" replaces the skeleton with the demo example after confirmation', () => {
    click(document.getElementById('akteLoadDemoButton'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(debug.getModel().measures.length).toBeGreaterThan(0);
    expect(debug.getSelectedType()).toBe('measure');
  });

  it('declining the confirmation keeps the current model untouched', () => {
    confirmSpy.mockReturnValue(false);
    click(document.getElementById('akteLoadDemoButton'));
    expect(debug.getModel().measures).toEqual([]);
  });

  it('a stored session (not a fresh one) is restored instead of falling back to the skeleton', async () => {
    click(document.getElementById('akteLoadDemoButton'));
    click(document.getElementById('akteSaveButton'));
    await boot();
    expect(debug.getModel().measures.length).toBeGreaterThan(0);
  });
});

describe('Stufe 6: Phasenübergang warnt, blockiert aber nicht (Kriterium 10)', () => {
  it('lists every process phase in the header select, defaulting to the skeleton phase', () => {
    const optionEls = /** @type {HTMLOptionElement[]} */ ([...document.querySelectorAll('#aktePhaseSelect option')]);
    const options = optionEls.map(option => option.value);
    expect(options).toContain('entscheidungsvorlage');
    expect(/** @type {HTMLSelectElement} */ (document.getElementById('aktePhaseSelect')).value).toBe(debug.getModel().process.phase);
  });

  it('changing to entscheidungsvorlage always succeeds, even with open gaps, and shows a warning', () => {
    click(document.getElementById('akteLoadDemoButton'));
    const select = /** @type {HTMLSelectElement} */ (document.getElementById('aktePhaseSelect'));
    select.value = 'entscheidungsvorlage';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));

    expect(debug.getModel().process.phase).toBe('entscheidungsvorlage');
    expect(document.getElementById('akteToast').textContent).toMatch(/Lücke/);
    expect(document.querySelector('.akte-phase-warning')).toBeTruthy();
  });

  it('records a phaseChanged history event', () => {
    const select = /** @type {HTMLSelectElement} */ (document.getElementById('aktePhaseSelect'));
    select.value = 'datenerhebung';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    // diffModelEvents (history.js) diff't process als Ganzes, nicht pro Feld
    // (siehe src/value-state.js-Dokumentation zur selben Einschränkung bei
    // strategy/committee/sidecar).
    const stored = JSON.parse(localStorage.getItem(storageKey));
    expect(stored.history.events.some(event => event.subject?.scope === 'process' && event.field === 'process')).toBe(true);
  });
});

describe('Stufe 6: Kantenvorschläge (Abschnitt 6.2 Lückenart 4)', () => {
  it('surfaces a suggestion for active measures without objectiveIds and navigates the filter on click', () => {
    click(document.getElementById('akteLoadDemoButton'));
    const suggestion = document.querySelector('[data-suggestion-filter]');
    expect(suggestion).toBeTruthy();
    click(suggestion);
    expect(debug.getFilterKey()).toBe('without-objective');
  });
});

describe('Stufe 6: Stellvertreterobjekte (Abschnitt 6.2 Lückenart 3)', () => {
  beforeEach(() => {
    click(document.getElementById('akteLoadDemoButton'));
    click(document.querySelector('[data-filter="measure"]'));
  });

  it('typing a brand-new name into objectiveIds immediately creates a provisional Ziel and links it', () => {
    const objectivesBefore = debug.getModel().strategy.objectives.length;
    const button = document.querySelector('[data-edit-key="objectiveIds"]');
    click(button);
    /** @type {HTMLInputElement} */ (document.getElementById('akteFieldInput')).value = 'Ein ganz neues Ziel';
    click(document.getElementById('aktePopoverSave'));

    const model = debug.getModel();
    expect(model.strategy.objectives.length).toBe(objectivesBefore + 1);
    const created = model.strategy.objectives.at(-1);
    expect(created.label).toBe('Ein ganz neues Ziel');
    expect(model.provisionalIds.objective).toContain(created.id);

    const measure = model.measures.find(m => m.id === debug.getSelectedId());
    expect(measure.objectiveIds).toContain(created.id);

    const buttonAfter = document.querySelector('[data-edit-key="objectiveIds"]');
    expect(buttonAfter.textContent).toContain('vorläufig');
    expect(buttonAfter.classList.contains('akte-value--provisional')).toBe(true);
  });

  it('typing a name that matches an existing Ziel label resolves to the existing id (no duplicate)', () => {
    const model = debug.getModel();
    const existingLabel = model.strategy.objectives[0].label;
    const objectivesBefore = model.strategy.objectives.length;

    const button = document.querySelector('[data-edit-key="objectiveIds"]');
    click(button);
    /** @type {HTMLInputElement} */ (document.getElementById('akteFieldInput')).value = existingLabel;
    click(document.getElementById('aktePopoverSave'));

    expect(debug.getModel().strategy.objectives.length).toBe(objectivesBefore);
    const measure = debug.getModel().measures.find(m => m.id === debug.getSelectedId());
    expect(measure.objectiveIds).toEqual([model.strategy.objectives[0].id]);
  });

  it('editing the provisional object\'s own field clears its provisional status', () => {
    const button = document.querySelector('[data-edit-key="objectiveIds"]');
    click(button);
    /** @type {HTMLInputElement} */ (document.getElementById('akteFieldInput')).value = 'Provisorisches Ziel';
    click(document.getElementById('aktePopoverSave'));
    const createdId = debug.getModel().strategy.objectives.at(-1).id;
    expect(debug.getModel().provisionalIds.objective).toContain(createdId);

    click(document.querySelector('[data-filter="objective"]'));
    debug.setSelectedObject('objective', createdId);
    const labelButton = document.querySelector('[data-edit-key="label"]');
    click(labelButton);
    /** @type {HTMLInputElement} */ (document.getElementById('akteFieldInput')).value = 'Bestätigtes Ziel';
    click(document.getElementById('aktePopoverSave'));

    expect(debug.getModel().provisionalIds.objective).not.toContain(createdId);
  });
});
