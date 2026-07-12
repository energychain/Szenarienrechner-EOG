import { describe, expect, it } from 'vitest';
import { fieldHelp, fieldHelpText, hasFieldHelp } from '../src/contextual-help.js';

describe('contextual field help', () => {
  it('provides expandable fachliche guidance for guided-start basis values', () => {
    expect(hasFieldHelp('baseEog')).toBe(true);
    expect(fieldHelpText('baseEog')).toContain('Erlösobergrenze');
    expect(fieldHelpText('baseEog')).toContain('Regulierungsmanagement');
    expect(fieldHelpText('baseEog')).toContain('Bescheid');

    expect(fieldHelpText('rab')).toContain('Anlagenbuchhaltung');
    expect(fieldHelpText('rab')).toContain('Regulierungsmanagement');

    expect(fieldHelpText('annualEnergyGwh')).toContain('Netzabsatz');
    expect(fieldHelpText('annualEnergyGwh')).toContain('Abrechnung');
  });

  it('keeps help neutral and avoids real operator/internal references', () => {
    const allHelp = Object.values(fieldHelp).join('\n');

    const forbidden = ['T' + 'WL', ['HERMES', 'BRIEFING'].join('_'), 'Brief' + 'ing'];
    for (const term of forbidden) {
      expect(allHelp).not.toContain(term);
    }
  });
});
