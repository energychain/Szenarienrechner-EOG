import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
const exportUtils = readFileSync(new URL('../src/export-utils.js', import.meta.url), 'utf8');

describe('self-contained HTML export with embedded model data', () => {
  it('offers a dedicated HTML export action next to the existing JSON export', () => {
    expect(html).toContain('id="exportModel"');
    expect(html).toContain('id="exportSelfContainedHtml"');
    expect(html).toContain('HTML mit Daten speichern');
  });

  it('embeds the current model state as application/json instead of relying on localStorage only', () => {
    expect(ui).toContain('function exportSelfContainedHtml()');
    expect(ui).toContain('htmlWithEmbeddedModelState');
    expect(exportUtils).toContain('embedded-model-state');
    expect(exportUtils).toContain('type="application/json"');
    expect(ui).toContain('collectModelState()');
    expect(ui).toContain('document.documentElement.outerHTML');
  });

  it('loads embedded model state before falling back to browser localStorage', () => {
    const embeddedLoadIndex = ui.indexOf('loadEmbeddedModelState()');
    const browserLoadIndex = ui.indexOf('loadFromBrowser()');
    expect(embeddedLoadIndex).toBeGreaterThan(-1);
    expect(browserLoadIndex).toBeGreaterThan(-1);
    expect(embeddedLoadIndex).toBeLessThan(browserLoadIndex);
    expect(ui).toContain('HTML-Datei mit eingebettetem Datenstand geladen.');
  });
});
