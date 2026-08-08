// @vitest-environment jsdom
//
// Stufe 4: Layout-Gerüst der zweiten Oberfläche ("digitale Akte"). Prüft die
// Abnahmekriterien 4, 5 und 12 gegen die echte Quelle (akte.html +
// src/main-akte.js) im Browser-DOM (jsdom), nicht gegen das gebaute
// Artefakt — das gebaute dist/akte.html ist zusätzlich manuell mit Playwright
// gegen einen echten Chromium geprüft worden (jsdom führt Inline-Modul-
// Skripte aus gebauten Single-File-Bundles nicht zuverlässig aus).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(__dirname, '../akte.html'), 'utf8');
const mainSource = readFileSync(resolve(__dirname, '../src/main-akte.js'), 'utf8');

const storageKey = 'regulierte-sparten-szenario-rechner-akte-v1';
const legacyStorageKey = 'regulierte-sparten-szenario-rechner-v1';

let debug;

function click(node) {
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

beforeEach(async () => {
  document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  localStorage.clear();
  // main-akte.js boots at module top-level; force a fresh evaluation per
  // test so it re-runs against this test's freshly reset DOM.
  vi.resetModules();
  const mainModulePath = '../src/main-akte.js';
  await import(mainModulePath);
  debug = /** @type {any} */ (window).__akte2Debug;
});

function fieldInput() {
  return /** @type {HTMLInputElement} */ (document.getElementById('akteFieldInput'));
}

function openDecisionReasonInput() {
  return /** @type {HTMLTextAreaElement} */ (document.getElementById('akteOpenDecisionReason'));
}

afterEach(() => {
  localStorage.clear();
});

describe('Stufe 4: Ein Layout, keine Ansichtswechsel (Kriterium 4)', () => {
  it('boots with a KPI strip, filter column, object surface and context column populated', () => {
    expect(document.getElementById('akteKpiStrip').children.length).toBeGreaterThan(0);
    expect(document.getElementById('akteFilterColumn').textContent).toContain('Alle');
    expect(document.getElementById('akteObjectSurface').textContent.length).toBeGreaterThan(0);
    expect(document.getElementById('akteContextColumn').textContent).toContain('Wirkung dieses Objekts');
  });

  it('contains no view-switching controls anywhere in the shipped markup or source', () => {
    // The old UI's mechanism is data-view / setView(); the new UI must not
    // reintroduce a second navigation concept next to the filter column.
    expect(html).not.toMatch(/data-view=/);
    expect(mainSource).not.toMatch(/data-view=/);
    expect(mainSource).not.toContain('setView(');
  });

  it('changes only the object list, never the layout, when a filter is clicked', () => {
    const layoutBefore = document.querySelector('.akte-columns').children.length;
    click(document.querySelector('[data-filter="active"]'));
    expect(debug.getFilterKey()).toBe('active');
    expect(document.querySelector('.akte-columns').children.length).toBe(layoutBefore);
    expect(document.getElementById('akteFilterColumn')).toBeTruthy();
    expect(document.getElementById('akteObjectSurface')).toBeTruthy();
  });
});

describe('Stufe 4: Ergebnisstreifen als einziger Drilldown (Kriterium 5)', () => {
  it('exposes exactly one clickable element per KPI, each setting the filter to its underlying objects', () => {
    const kpiButtons = document.querySelectorAll('#akteKpiStrip [data-kpi]');
    expect(kpiButtons.length).toBe(6); // 4 KPIs + Belastbarkeit + offene Punkte

    click(document.querySelector('[data-kpi="npv"]'));
    expect(debug.getFilterKey()).toBe('kpi:npv');

    click(document.querySelector('[data-kpi="open"]'));
    expect(debug.getFilterKey()).toBe('clarification');
  });

  it('has no second drilldown mechanism: only the KPI strip and the filter column ever set filterKey', () => {
    const objectSurfaceHandler = mainSource.match(/akteObjectSurface'\)\.addEventListener\('click',[\s\S]*?\n {2}\}\);/)?.[0] || '';
    const contextColumnHandler = mainSource.match(/akteContextColumn'\)\.addEventListener\('click',[\s\S]*?\n {2}\}\);/)?.[0] || '';
    expect(objectSurfaceHandler).not.toMatch(/filterKey\s*=/);
    expect(contextColumnHandler).not.toMatch(/filterKey\s*=/);
    expect(mainSource).not.toMatch(/data-drilldown/);
  });
});

describe('Stufe 4: höchstens zwei Klicks von Kennzahl zu Feld (Kriterium 12)', () => {
  it('reaches an editable field popover after exactly one KPI click and one value click', () => {
    click(document.querySelector('[data-kpi="npv"]')); // click 1
    expect(debug.getFilterKey()).toBe('kpi:npv');
    expect(debug.getSelectedId()).toBeTruthy();

    const valueButton = document.querySelector('.akte-object-surface .akte-value:not(.akte-value--summary)');
    expect(valueButton).toBeTruthy();
    click(valueButton); // click 2

    expect(document.getElementById('akteValuePopover').classList.contains('hidden')).toBe(false);
  });
});

describe('Stufe 4: Satzdarstellung, Zustandsanzeige und Inline-Bearbeitung', () => {
  it('renders every visible measure field with one of the four value-state classes', () => {
    const buttons = [...document.querySelectorAll('.akte-object-surface .akte-value:not(.akte-value--summary)')];
    expect(buttons.length).toBeGreaterThan(10);
    buttons.forEach(button => {
      const hasState = ['set', 'default', 'derived', 'openByDecision'].some(state => button.classList.contains(`akte-value--${state}`));
      expect(hasState, button.outerHTML).toBe(true);
    });
  });

  it('saves an inline edit to the model and reflects it as "set"', () => {
    const nameButton = document.querySelector('[data-edit-key="name"]');
    click(nameButton);
    fieldInput().value = 'Geänderter Name';
    click(document.getElementById('aktePopoverSave'));

    const measure = debug.getModel().measures.find(m => m.id === debug.getSelectedId());
    expect(measure.name).toBe('Geänderter Name');
    expect(document.getElementById('akteValuePopover').classList.contains('hidden')).toBe(true);
    expect(document.querySelector('[data-edit-key="name"]').classList.contains('akte-value--set')).toBe(true);
  });

  it('records an openByDecision reason and renders it in place of the value', () => {
    const secureButton = document.querySelector('[data-edit-key="secure"]');
    click(secureButton);
    click(document.getElementById('akteOpenDecisionToggle'));
    openDecisionReasonInput().value = 'Wird in der nächsten Sitzung geklärt.';
    click(document.getElementById('akteOpenDecisionSave'));

    const button = document.querySelector('[data-edit-key="secure"]');
    expect(button.classList.contains('akte-value--openByDecision')).toBe(true);
    expect(button.textContent).toContain('Wird in der nächsten Sitzung geklärt.');
  });

  it('closes the popover on Escape', () => {
    click(document.querySelector('[data-edit-key="name"]'));
    expect(document.getElementById('akteValuePopover').classList.contains('hidden')).toBe(false);
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('akteValuePopover').classList.contains('hidden')).toBe(true);
  });

  it('focuses the search field on Ctrl+K', () => {
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    expect(document.activeElement.id).toBe('akteSearch');
  });
});

describe('Stufe 4: eigenständiger Speicherstand (Spezifikation 7.3)', () => {
  it('persists under its own localStorage key and never touches the old UI key', () => {
    click(document.querySelector('[data-edit-key="name"]'));
    fieldInput().value = 'Edit';
    click(document.getElementById('aktePopoverSave'));

    expect(localStorage.getItem(storageKey)).toBeTruthy();
    expect(localStorage.getItem(legacyStorageKey)).toBeNull();
  });

  it('writes UI state only under model.ui2', () => {
    click(document.querySelector('[data-filter="active"]'));
    click(document.querySelector('[data-edit-key="name"]'));
    fieldInput().value = 'Edit2';
    click(document.getElementById('aktePopoverSave'));

    const stored = JSON.parse(localStorage.getItem(storageKey));
    expect(stored.model.ui2).toBeTruthy();
    expect(stored.model.ui2.filterKey).toBe('active');
  });
});
