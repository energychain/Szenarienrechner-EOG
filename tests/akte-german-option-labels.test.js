// @vitest-environment jsdom
//
// Nachtrag: Select-Feldwerte sind im Modell englische/camelCase Enum-
// Konstanten (z. B. "costPathReview") — angezeigt werden muss die deutsche
// Fachbezeichnung, im Satz genau wie im Popover-Dropdown, nicht der Rohwert.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fieldDescriptor, fieldDescriptorsFor, objectTypes } from '../src/field-registry.js';

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

describe('field-registry: jedes Select-Feld trägt deutsche optionLabels', () => {
  it('every select-type field descriptor across all object types has a German label for every one of its options', () => {
    const gaps = [];
    objectTypes.forEach(objectType => {
      fieldDescriptorsFor(objectType).forEach(descriptor => {
        if (descriptor.type !== 'select' || !descriptor.options) return;
        descriptor.options.forEach(option => {
          if (!descriptor.optionLabels || !Object.hasOwn(descriptor.optionLabels, option)) {
            gaps.push(`${objectType}.${descriptor.key} = "${option}"`);
          }
        });
      });
    });
    expect(gaps).toEqual([]);
  });

  it('the gasRegulatoryTreatment option "costPathReview" has a real German label, not the raw enum value', () => {
    const descriptor = fieldDescriptor('measure', 'gasRegulatoryTreatment');
    expect(descriptor.optionLabels.costPathReview).toBe('Kostenpfad / EOG-Wirkung prüfen');
    expect(descriptor.optionLabels.costPathReview).not.toBe('costPathReview');
  });
});

describe('Popover und Satzdarstellung zeigen die deutsche Beschriftung, nicht den Rohwert', () => {
  it('a measure with gasRegulatoryTreatment=costPathReview shows the German label in its sentence view', () => {
    debug.getModel().measures.push({
      id: 'demo_gas_regulatory', active: true, name: 'Gasmaßnahme', gasRegulatoryTreatment: 'costPathReview'
    });
    debug.setSelectedObject('measure', 'demo_gas_regulatory');

    const valueButton = document.querySelector('[data-edit-key="gasRegulatoryTreatment"]');
    expect(valueButton).toBeTruthy();
    expect(valueButton.textContent).toContain('Kostenpfad / EOG-Wirkung prüfen');
    expect(valueButton.textContent).not.toContain('costPathReview');
  });

  it('the popover select dropdown shows German option text while keeping the English value attribute', () => {
    debug.getModel().measures.push({
      id: 'demo_gas_regulatory', active: true, name: 'Gasmaßnahme', gasRegulatoryTreatment: 'unclear'
    });
    debug.setSelectedObject('measure', 'demo_gas_regulatory');
    click(document.querySelector('[data-edit-key="gasRegulatoryTreatment"]'));

    const select = /** @type {HTMLSelectElement} */ (document.getElementById('akteFieldInput'));
    expect(select).toBeTruthy();
    const options = [...select.options];
    const costPathOption = options.find(option => option.value === 'costPathReview');
    expect(costPathOption).toBeTruthy();
    expect(costPathOption.textContent).toBe('Kostenpfad / EOG-Wirkung prüfen');

    // saving still writes the English enum value, not the German label
    select.value = 'costPathReview';
    click(document.getElementById('aktePopoverSave'));
    expect(debug.getModel().measures.find(m => m.id === 'demo_gas_regulatory').gasRegulatoryTreatment).toBe('costPathReview');
  });

  it('the "Vorbelegung" hint in the popover is also translated', () => {
    debug.getModel().measures.push({ id: 'demo_gas_default', active: true, name: 'Gasmaßnahme mit Vorbelegung' });
    debug.setSelectedObject('measure', 'demo_gas_default');
    click(document.querySelector('[data-edit-key="gasRegulatoryTreatment"]'));
    const stateLine = document.querySelector('.akte-popover-state');
    expect(stateLine.textContent).toContain('offen / zu prüfen');
    expect(stateLine.textContent).not.toContain('unclear');
  });
});
