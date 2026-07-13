import { describe, expect, it } from 'vitest';
import { esc, formatDateShort, fmtEur, fmtPct, fmtPlain, fmtTeur } from '../src/render-utils.js';

describe('render utilities', () => {
  it('formats German planning values consistently', () => {
    expect(fmtTeur(1234.56, 1)).toBe('1.234,6 TEUR');
    expect(fmtPct(5.25, 2)).toBe('5,25 %');
    expect(fmtEur(1530.2, 0)).toBe('1.530 EUR');
    expect(fmtPlain(1234.56, 2)).toBe('1.234,56');
    expect(fmtPct(Number.NaN)).toBe('-');
  });

  it('escapes HTML fragments used in UI templates', () => {
    expect(esc('<script>&"')).toBe('&lt;script&gt;&amp;&quot;');
  });

  it('formats ISO dates for compact German UI labels', () => {
    expect(formatDateShort('2027-06-30')).toBe('30.06.');
    expect(formatDateShort('')).toBe('');
  });
});
