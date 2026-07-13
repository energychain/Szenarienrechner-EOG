import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { demoMeasures, initialMeasures } from '../src/demo-data.js';

describe('synthetic demo data module', () => {
  it('keeps demo fixtures outside the UI module', () => {
    expect(Array.isArray(initialMeasures)).toBe(true);
    expect(Array.isArray(demoMeasures)).toBe(true);
    expect(demoMeasures.length).toBeGreaterThan(0);

    const ui = readFileSync('src/ui.js', 'utf8');
    expect(ui).toContain("from './demo-data.js'");
    expect(ui).not.toContain('const demoMeasures = [');
  });

  it('marks examples as synthetic and avoids real-operator references', () => {
    const demoSource = readFileSync('src/demo-data.js', 'utf8');
    expect(demoSource).toContain('Synthetic demo fixtures only');
    expect(demoSource).toMatch(/synthetisch|Synthetisch/);
    expect(demoSource).not.toMatch(/TWL|HERMES_BRIEFING|Snake|snake/);
  });
});
