import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');
const engine = readFileSync('src/engine.js', 'utf8');

describe('workstand reliability UI', () => {
  it('adds a Belastbarkeit des Arbeitsstands dashboard card to the results view', () => {
    expect(html).toContain('workstandReliabilityPanel');
    expect(html).toContain('Belastbarkeit des Arbeitsstands');
    expect(html).toContain('workstandReliabilityCards');
    expect(ui).toContain('renderWorkstandReliability');
    expect(ui).toContain('workstandReliabilityFor');
    expect(engine).toContain('RiskAvoided-Werte unbelegt');
    expect(engine).toContain('Maßnahmen ohne Ziel-Zuordnung');
    expect(engine).toContain('No-Regret-Typisierung');
    expect(engine).toContain('Kontextobjekt-/Evidenzlage');
  });

  it('renders reliability counters as actionable progress cards', () => {
    expect(ui).toContain('reliabilityProgressHtml');
    expect(ui).toContain('data-workstand-action');
    expect(ui).toContain('openReliabilityWorkItem');
    expect(ui).toContain('measureEditNavigationIds');
    expect(ui).toContain('pendingMeasureFocusTarget');
    expect(ui).toContain('Rückspielweg bearbeiten');
    expect(ui).toContain('Risiko-Mapping bearbeiten');
    expect(ui).toContain('Ziel-Zuordnung bearbeiten');
  });

  it('links scenario comparison back to scenario input fields', () => {
    expect(ui).toContain('Szenarioannahmen werden unter Grundlagen');
    expect(ui).toContain('Szenarioannahmen bearbeiten');
    expect(ui).toContain('data-jump-view="basis"');
  });
});
