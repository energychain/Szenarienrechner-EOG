import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ui = fs.readFileSync(path.join(root, 'src/ui.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

describe('explainability UI', () => {
  it('adds a measure-level calculation drilldown in the edit modal', () => {
    expect(html).toContain('measureDrilldownPanel');
    expect(html).toContain('Wie wird aus dieser Maßnahme diese Zahl?');
    expect(ui).toContain('renderMeasureDrilldown');
    expect(ui).toContain('measureDrilldownFor');
    expect(ui).toContain('CAPEX → AfA/KANU → Verzinsung → EOG → Cashflow');
  });

  it('adds a portfolio waterfall for base EOG and EOG-to-cashflow bridge', () => {
    expect(html).toContain('portfolioWaterfallPanel');
    expect(html).toContain('Größenordnung einordnen');
    expect(ui).toContain('renderPortfolioWaterfall');
    expect(ui).toContain('portfolioWaterfallFor');
    expect(ui).toContain('Basis-EOG → Maßnahmenwirkung');
    expect(ui).toContain('EOG → wirtschaftliche Überleitung → Cashflow');
  });

  it('adds a tornado sensitivity view for both Strom and Gas without changing scenarios', () => {
    expect(html).toContain('sensitivityTornadoPanel');
    expect(html).toContain('Sensitivitäts-/Treiberansicht');
    expect(ui).toContain('renderSensitivityTornado');
    expect(ui).toContain('portfolioSensitivityTornadoFor');
    expect(ui).toContain('RiskAvoided ±25 %');
    expect(ui).toContain('Nutzungsdauer ±20 %');
    expect(ui).toContain('Sidecar-Finanzsignale');
    expect(ui).toContain('calculationImpact');
  });
});
