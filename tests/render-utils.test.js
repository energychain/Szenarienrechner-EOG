import { describe, expect, it } from 'vitest';
import {
  esc,
  formatDateShort,
  fmtEur,
  fmtPct,
  fmtPlain,
  fmtTeur,
  fmtTeurPerYear,
  normalizeGermanTeurText
} from '../src/render-utils.js';

describe('render utilities', () => {
  it('formats German planning values consistently', () => {
    expect(fmtTeur(1234.56, 1)).toBe('1.234,6 TEUR');
    expect(fmtPct(5.25, 2)).toBe('5,25 %');
    expect(fmtEur(1530.2, 0)).toBe('1.530 EUR');
    expect(fmtPlain(1234.56, 2)).toBe('1.234,56');
    expect(fmtPct(Number.NaN)).toBe('-');
  });

  it('formats RiskAvoided yearly working values without ambiguous decimal points', () => {
    expect(fmtTeurPerYear(100, 1)).toBe('100,0 TEUR pro Jahr');
    expect(fmtTeurPerYear(500, 1)).toBe('500,0 TEUR pro Jahr');
    expect(fmtTeurPerYear(58.824, 3)).toBe('58,824 TEUR pro Jahr');
    expect(fmtTeurPerYear(31.25, 3)).toBe('31,250 TEUR pro Jahr');
    expect(fmtTeurPerYear(2.2, 3)).toBe('2,200 TEUR pro Jahr');
    expect(fmtTeurPerYear(0.625, 3)).toBe('0,625 TEUR pro Jahr');
  });

  it('normalizes imported TEUR/a notes to German decimal notation', () => {
    const text = 'Bewertung: Risiko-/Vermeidungseffekt = 100.000 TEUR/a je Maßnahmengruppe; (100.0/170.0 TEUR) → 58.824 TEUR/a.';
    expect(normalizeGermanTeurText(text)).toBe('Bewertung: Risiko-/Vermeidungseffekt = 100,000 TEUR/a je Maßnahmengruppe; (100,0 / 170,0 TEUR) → 58,824 TEUR/a.');
  });

  it('escapes HTML fragments used in UI templates', () => {
    expect(esc('<script>&"')).toBe('&lt;script&gt;&amp;&quot;');
  });

  it('formats ISO dates for compact German UI labels', () => {
    expect(formatDateShort('2027-06-30')).toBe('30.06.');
    expect(formatDateShort('')).toBe('');
  });
});
