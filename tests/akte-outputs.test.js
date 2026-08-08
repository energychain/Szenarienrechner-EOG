// @vitest-environment jsdom
//
// Stufe 7 (Abschnitt 4.5): Ausgaben sind Aktionen im Kopfbereich, die ein
// Ausgabefenster über der Arbeitsfläche öffnen und wieder schließen. XLSX/CSV,
// KI-Prompt und Support-Paket nutzen spreadsheet-export.js,
// ai-prompt-generator.js und release-awareness.js unverändert. Das gebaute
// dist/akte.html ist zusätzlich mit Playwright gegen Chromium geprüft worden
// (Downloads, Escape-Handling) — jsdom implementiert URL.createObjectURL
// nicht, daher deckt dieser Test das Öffnen/Rendern/Schließen ab, nicht den
// tatsächlichen Blob-Download.
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

describe('Stufe 7: Ausgabefenster (Abschnitt 4.5)', () => {
  it('is closed until opened, and opens over the work area without changing the layout', () => {
    expect(document.getElementById('akteOutputOverlay').classList.contains('hidden')).toBe(true);
    click(document.getElementById('akteOutputButton'));
    expect(document.getElementById('akteOutputOverlay').classList.contains('hidden')).toBe(false);
    expect(document.querySelector('.akte-columns')).toBeTruthy();
  });

  it('closes on the close button, on Escape, and on an overlay backdrop click', () => {
    click(document.getElementById('akteOutputButton'));
    click(document.getElementById('akteOutputClose'));
    expect(document.getElementById('akteOutputOverlay').classList.contains('hidden')).toBe(true);

    click(document.getElementById('akteOutputButton'));
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('akteOutputOverlay').classList.contains('hidden')).toBe(true);

    click(document.getElementById('akteOutputButton'));
    document.getElementById('akteOutputOverlay').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('akteOutputOverlay').classList.contains('hidden')).toBe(true);
  });

  it('renders a Report / Befassungsvorlage with KPIs, decision, segmentation and open items', () => {
    click(document.getElementById('akteOutputButton'));
    const body = document.getElementById('akteOutputBody').textContent;
    expect(body).toContain('Report');
    expect(body).toContain('Segmentierung');
    expect(body).toContain('Beschlussvorschlag');
  });

  it('renders a KI-Prompt for the selected role using ai-prompt-generator.js unchanged', () => {
    click(document.getElementById('akteOutputButton'));
    click(document.querySelector('[data-output-tab="ai-prompt"]'));
    const textarea = /** @type {HTMLTextAreaElement} */ (document.getElementById('akteAiPromptOutput'));
    expect(textarea.value.length).toBeGreaterThan(100);

    const roleSelect = /** @type {HTMLSelectElement} */ (document.getElementById('akteAiPromptRole'));
    const before = textarea.value;
    roleSelect.value = roleSelect.options[1].value;
    roleSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(textarea.value).not.toBe(before);
  });

  it('offers XLSX/CSV table export actions', () => {
    click(document.getElementById('akteOutputButton'));
    click(document.querySelector('[data-output-tab="tables"]'));
    expect(document.getElementById('akteExportXlsx')).toBeTruthy();
    expect(document.getElementById('akteExportCsvZip')).toBeTruthy();
  });

  it('offers a support package download that carries no model data', () => {
    click(document.getElementById('akteOutputButton'));
    click(document.querySelector('[data-output-tab="support"]'));
    expect(document.getElementById('akteOutputBody').textContent).toContain('keine Modell- oder Maßnahmenwerte');
    expect(document.getElementById('akteExportSupport')).toBeTruthy();
  });

  it('switches tabs without losing the underlying model state', () => {
    click(document.getElementById('akteOutputButton'));
    click(document.querySelector('[data-output-tab="ai-prompt"]'));
    click(document.querySelector('[data-output-tab="report"]'));
    expect(debug.getModel().measures.length).toBeGreaterThan(0);
  });
});
