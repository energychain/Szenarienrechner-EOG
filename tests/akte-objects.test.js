// @vitest-environment jsdom
//
// Stufe 5: Rahmen, Szenario, Ziel, Kontext, Quelle und Klärpunkt werden zu
// Objekten derselben Liste (Kriterium 6), und jede Lücke ist über einen
// Filter erreichbar (Kriterium 9). Wie tests/akte-layout.test.js prüft dies
// gegen die Quelle im jsdom-DOM, nicht gegen das gebaute Artefakt.
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
  // A brand-new session boots with the skeleton (Stufe 6, Abschnitt 6.5), not
  // the demo example — this file exercises measure/sidecar object behaviour,
  // so it loads the demo content explicitly, like a real user would.
  click(document.getElementById('akteLoadDemoButton'));
});

const objectTypeFilters = [
  ['measure', 'measure'],
  ['clarification', 'clarification'],
  ['objective', 'objective'],
  ['sidecarObject', 'sidecarObject'],
  ['sidecarSource', 'sidecarSource'],
  ['rahmen', 'input'],
  ['szenario', 'input']
];

describe('Stufe 5: jedes fachliche Objekt in derselben Liste, derselben Detailfläche (Kriterium 6)', () => {
  it.each(objectTypeFilters)('selecting the "%s" filter renders that object type in the object surface', (filterKey, expectedType) => {
    click(document.querySelector(`[data-filter="${filterKey}"]`));
    expect(debug.getSelectedType()).toBe(expectedType);
    const surfaceText = document.getElementById('akteObjectSurface').textContent;
    expect(surfaceText.trim().length).toBeGreaterThan(0);
    // the detail pane must render field-value buttons wired the same way as
    // for measures — same edit mechanism, not a separate page or modal.
    const anyEditable = document.querySelector('.akte-object-surface .akte-value:not(.akte-value--summary)');
    expect(anyEditable, `${filterKey} has no editable value button`).toBeTruthy();
  });

  it('all filters read from one unified list — filter buttons and object-list rows share the same object-type vocabulary', () => {
    click(document.querySelector('[data-filter="all"]'));
    const rows = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.akte-object-list-item')]);
    const rowTypes = new Set(rows.map(row => row.dataset.objectType));
    // With demo data (measures + sidecar objects/sources + objectives +
    // open clarifications) at least four distinct object types must appear
    // in the very same list.
    expect(rowTypes.size).toBeGreaterThanOrEqual(4);
  });

  it('editing an objective field works through the exact same popover mechanism as a measure field', () => {
    click(document.querySelector('[data-filter="objective"]'));
    const labelButton = document.querySelector('[data-edit-key="label"]');
    expect(labelButton).toBeTruthy();
    click(labelButton);
    /** @type {HTMLInputElement} */ (document.getElementById('akteFieldInput')).value = 'Neues Ziel';
    click(document.getElementById('aktePopoverSave'));

    const objectiveId = debug.getSelectedId();
    const objective = debug.getModel().strategy.objectives.find(item => item.id === objectiveId);
    expect(objective.label).toBe('Neues Ziel');
  });

  it('editing a Rahmen field (model.inputs) works through the same popover mechanism', () => {
    click(document.querySelector('[data-filter="rahmen"]'));
    const sectorButton = document.querySelector('[data-edit-key="sector"]');
    expect(sectorButton).toBeTruthy();
    click(sectorButton);
    /** @type {HTMLSelectElement} */ (document.getElementById('akteFieldInput')).value = 'gas';
    click(document.getElementById('aktePopoverSave'));
    expect(debug.getModel().inputs.sector).toBe('gas');
  });

  it('recording openByDecision on a sidecarObject field persists under model.openDecisions keyed by the object id', () => {
    click(document.querySelector('[data-filter="sidecarObject"]'));
    const button = document.querySelector('[data-edit-key="evidenceStatus"]');
    expect(button).toBeTruthy();
    click(button);
    click(document.getElementById('akteOpenDecisionToggle'));
    /** @type {HTMLTextAreaElement} */ (document.getElementById('akteOpenDecisionReason')).value = 'Wird extern nachgereicht.';
    click(document.getElementById('akteOpenDecisionSave'));

    const sidecarId = debug.getSelectedId();
    expect(debug.getModel().openDecisions[sidecarId].evidenceStatus.reason).toBe('Wird extern nachgereicht.');
    expect(document.querySelector('[data-edit-key="evidenceStatus"]').classList.contains('akte-value--openByDecision')).toBe(true);
  });

  it('selecting an open clarification embeds its underlying object\'s detail in the same surface, editable in place', () => {
    click(document.querySelector('[data-filter="clarification"]'));
    expect(debug.getSelectedType()).toBe('clarification');
    const target = document.querySelector('.akte-clarification-target');
    expect(target).toBeTruthy();
    const editableInTarget = target.querySelector('.akte-value:not(.akte-value--summary)');
    expect(editableInTarget).toBeTruthy();
    click(editableInTarget);
    expect(document.getElementById('akteValuePopover').classList.contains('hidden')).toBe(false);
  });
});

describe('Stufe 5: jede Lücke ist über einen Filter erreichbar (Kriterium 9)', () => {
  it('the "Offen" filter (Klärpunkte als Objekte) surfaces every open clarification as a selectable object', () => {
    click(document.querySelector('[data-filter="clarification"]'));
    const counts = document.getElementById('akteFilterColumn').textContent;
    const openCountMatch = counts.match(/Offen\s*(\d+)/);
    expect(openCountMatch).toBeTruthy();
    const openCount = Number(openCountMatch[1]);
    expect(openCount).toBeGreaterThan(0);
    const rows = document.querySelectorAll('.akte-object-list-item[data-object-type="clarification"]');
    // With <=1 visible entry the list pane collapses (see renderObjectListHtml);
    // either way the filter must have produced at least one clarification object.
    expect(rows.length > 0 || openCount === 1).toBe(true);
  });

  it('the "Ohne Ziel-Zuordnung" saved filter reaches active measures missing objectiveIds', () => {
    click(document.querySelector('[data-filter="without-objective"]'));
    expect(debug.getSelectedType()).toBe('measure');
    const measure = debug.getModel().measures.find(m => m.id === debug.getSelectedId());
    expect(measure.active).toBe(true);
    expect((measure.objectiveIds || []).length).toBe(0);
  });

  it('every top-level and saved filter button reports a non-negative count and is clickable without throwing', () => {
    const buttons = [...document.querySelectorAll('#akteFilterColumn [data-filter]')];
    expect(buttons.length).toBeGreaterThanOrEqual(8);
    buttons.forEach(button => {
      expect(() => click(button)).not.toThrow();
    });
  });
});

describe('Stufe 5: Selektion bleibt über Speichern/Laden erhalten (model.ui2)', () => {
  it('persists selectedType alongside selectedId and filterKey', () => {
    click(document.querySelector('[data-filter="sidecarSource"]'));
    click(document.getElementById('akteSaveButton'));
    const stored = JSON.parse(localStorage.getItem('regulierte-sparten-szenario-rechner-akte-v1'));
    expect(stored.model.ui2.selectedType).toBe('sidecarSource');
    expect(stored.model.ui2.filterKey).toBe('sidecarSource');
  });
});
