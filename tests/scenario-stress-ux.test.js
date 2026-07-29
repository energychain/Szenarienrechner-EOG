import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');
const engine = readFileSync('src/engine.js', 'utf8');
const config = readFileSync('src/ui-config.js', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');

describe('conservative stress test UX', () => {
  it('shows where stress parameters are edited and routes from the open stress-test warning', () => {
    expect(html).toContain('id="stressTestWorkbench"');
    expect(html).toContain('Stresstest-Parameter');
    expect(html).toContain('id="conservativeAttributionCap"');
    expect(html).toContain('id="conservativeQFactor"');
    expect(html).toContain('id="conservativeEFactor"');
    expect(html).toContain('id="conservativeDiscountRate"');
    expect(html).toContain('id="conservativeAssumptionMode"');
    expect(config).toContain("'conservativeAttributionCap'");
    expect(ui).toContain('function renderStressTestWorkbench');
    expect(ui).toContain('data-action="openStressParameters"');
    expect(ui).toContain('openStressParameters');
    expect(ui).toContain("scenario = 'konservativ'");
    expect(ui).toContain("setView('basis')");
    expect(ui).toContain('stress-test-status-card');
    expect(css).toContain('.stress-test-workbench');
    expect(css).toContain('.stress-parameter-grid');
  });

  it('uses explicit conservative stress inputs in the conservative scenario calculation', () => {
    expect(engine).toContain('conservativeStress');
    expect(engine).toContain('attributionCap');
    expect(engine).toContain('qFactor');
    expect(engine).toContain('eFactor');
    expect(engine).toContain('discountRateFloor');
    expect(engine).toContain("assumptionMode: stress.assumptionMode");
  });
});
