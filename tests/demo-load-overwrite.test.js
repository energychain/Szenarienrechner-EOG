import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ui = fs.readFileSync(path.join(root, 'src/ui.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

describe('demo data loading UX', () => {
  it('warns before user-triggered demo loading overwrites stored browser data', () => {
    expect(ui).toContain('function confirmDemoOverwriteIfNeeded()');
    expect(ui).toContain('hasStoredModelState()');
    expect(ui).toContain('Der aktuell im Browser gespeicherte Arbeitsstand wird dadurch überschrieben');
    expect(ui).toContain('Demodaten wurden nicht geladen; vorhandener Arbeitsstand bleibt erhalten.');
    expect(ui).toContain("startDemo').addEventListener('click', () => applyDemoModel({ confirmOverwrite: true, targetView: 'basis' })");
    expect(ui).toContain("loadDemoModel').addEventListener('click', () => applyDemoModel({ confirmOverwrite: true, targetView: 'basis' })");
    expect(ui).toContain("loadDemoFromModal').addEventListener('click'");
  });

  it('opens demo data at the start of the planning workflow instead of the decision view', () => {
    expect(ui).toContain("activeView = targetView");
    expect(ui).toContain("phase: 'initialisierung'");
    expect(ui).toContain('Auf der Grundlagenansicht Startwerte, Quellen und Rollen prüfen');
    expect(ui).not.toContain("activeView = 'results';");
    expect(html).toContain('öffnet den Start der Planungsrunde');
  });
});
