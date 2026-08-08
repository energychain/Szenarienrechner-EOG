// Stufe 7 Nachtrag: "HTML mit Daten speichern" auch in der digitalen Akte
// (gleiche Terminologie, gleicher Mechanismus wie ui.js — siehe
// tests/self-contained-html-export.test.js für das Original in der alten
// Oberfläche).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const html = readFileSync(resolve(__dirname, '../akte.html'), 'utf8');
const mainAkte = readFileSync(resolve(__dirname, '../src/main-akte.js'), 'utf8');
const exportUtils = readFileSync(resolve(__dirname, '../src/export-utils.js'), 'utf8');

describe('digitale Akte: self-contained HTML export with embedded model data', () => {
  it('offers a dedicated HTML export action next to the existing JSON export, same wording as ui.js', () => {
    expect(html).toContain('id="akteExportButton"');
    expect(html).toContain('id="akteExportHtmlButton"');
    expect(html).toContain('HTML mit Daten speichern');
  });

  it('embeds the current model state as application/json instead of relying on localStorage only', () => {
    expect(mainAkte).toContain('function exportSelfContainedHtml()');
    expect(mainAkte).toContain('htmlWithEmbeddedModelState');
    expect(exportUtils).toContain('embedded-model-state');
    expect(exportUtils).toContain('type="application/json"');
    expect(mainAkte).toContain('collectModelState()');
    expect(mainAkte).toContain('document.documentElement.outerHTML');
  });

  it('loads embedded model state before falling back to browser localStorage', () => {
    const embeddedLoadIndex = mainAkte.indexOf('if (loadEmbeddedModelState())');
    const storageLoadIndex = mainAkte.indexOf('const stored = loadFromStorage();');
    expect(embeddedLoadIndex).toBeGreaterThan(-1);
    expect(storageLoadIndex).toBeGreaterThan(-1);
    expect(embeddedLoadIndex).toBeLessThan(storageLoadIndex);
  });
});

// @vitest-environment jsdom
describe('digitale Akte: booting from an embedded HTML data state', () => {
  it('prefers the embedded state over an existing browser save when both are present', async () => {
    document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
    localStorage.clear();
    localStorage.setItem('regulierte-sparten-szenario-rechner-akte-v1', JSON.stringify({
      app: 'regulierte-sparten-szenario-rechner',
      version: 8,
      appVersion: '0.4.0',
      savedAt: new Date().toISOString(),
      model: { measures: [{ id: 'm-storage', name: 'Aus localStorage' }] },
      history: { events: [], headId: null, snapshots: [] }
    }));

    const embeddedState = {
      app: 'regulierte-sparten-szenario-rechner',
      version: 8,
      appVersion: '0.4.0',
      savedAt: new Date().toISOString(),
      model: { measures: [{ id: 'm-embedded', name: 'Aus HTML mit Daten' }] },
      history: { events: [], headId: null, snapshots: [] }
    };
    const embedded = document.createElement('script');
    embedded.type = 'application/json';
    embedded.id = 'embedded-model-state';
    embedded.textContent = JSON.stringify(embeddedState);
    document.body.appendChild(embedded);

    vi.resetModules();
    const mainModulePath = '../src/main-akte.js';
    await import(mainModulePath);
    const debug = /** @type {any} */ (window).__akte2Debug;

    expect(debug.getModel().measures[0].id).toBe('m-embedded');
  });
});
