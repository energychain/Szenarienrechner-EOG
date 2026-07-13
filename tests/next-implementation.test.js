import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { buildDocs } from '../scripts/build-docs.mjs';

const read = path => readFileSync(path, 'utf8');

describe('next consulting implementation docs and UI', () => {
  it('documents a private TRL-6 validation methodology and protocol template', () => {
    expect(existsSync('docs/validation-methodology.md')).toBe(true);
    expect(existsSync('docs/templates/validation-protocol.md')).toBe(true);

    const methodology = read('docs/validation-methodology.md');
    expect(methodology).toContain('TRL 6');
    expect(methodology).toContain('real-but-private Benchmarkfall');
    expect(methodology).toContain('keine vertraulichen Daten');
    expect(methodology).toContain('Wirtschaftsplan');
    expect(methodology).toContain('EOG-Bescheid');
    expect(methodology).toContain('fachliche Freigabe');

    const protocol = read('docs/templates/validation-protocol.md');
    expect(protocol).toContain('Validierungsprotokoll');
    expect(protocol).toContain('Abweichungsanalyse');
    expect(protocol).toContain('Freigabe Regulierungsmanagement');
  });

  it('renders validation docs from the public docs ecosystem', () => {
    buildDocs();
    const ecosystem = read('docs/ecosystem/index.md');
    const rendered = read('dist/docs/validation-methodology.html');
    expect(ecosystem).toContain('TRL-6-Validierung');
    expect(ecosystem).toContain('validation-methodology.html');
    expect(rendered).toContain('Drucken / PDF speichern');
    expect(rendered).toContain('Validierungsmethodik');
  });

  it('adds an EOG decomposition panel to decision UI and report', () => {
    const html = read('index.html');
    const ui = read('src/ui.js');
    expect(html).toContain('eogDecompositionPanel');
    expect(html).toContain('EOG-Zerlegung');
    expect(html).toContain('eogDecompositionBody');
    expect(ui).toContain('renderEogDecomposition');
    expect(ui).toContain('AfA');
    expect(ui).toContain('Verzinsung');
    expect(ui).toContain('Reinvest-Asset');
    expect(ui).toContain('Einmal-OPEX');
    expect(ui).toContain('laufendes Jahr');
    expect(ui).toContain('EOG-Zerlegung im Report');
  });

  it('surfaces first helper calculators in the measure dialog', () => {
    const html = read('index.html');
    const ui = read('src/ui.js');
    expect(html).toContain('helperCalculatorPanel');
    expect(html).toContain('Herleitungshelfer');
    expect(html).toContain('helperActivationSplit');
    expect(html).toContain('helperRiskExpectedValue');
    expect(ui).toContain('activationSplitHelper');
    expect(ui).toContain('renderHelperCalculators');
    expect(ui).toContain('CAPEX/OPEX-Split');
    expect(ui).toContain('Risiko-Erwartungswert');
  });
});
