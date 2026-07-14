import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const uiJs = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');

describe('spreadsheet export UI', () => {
  it('offers spreadsheet exports from the action menu', () => {
    expect(indexHtml).toContain('id="exportSpreadsheetXlsx"');
    expect(indexHtml).toContain('Tabellen als XLSX exportieren');
    expect(indexHtml).toContain('id="exportSpreadsheetCsvZip"');
    expect(indexHtml).toContain('Tabellen als CSV-ZIP exportieren');
  });

  it('generates spreadsheet exports locally in the browser', () => {
    expect(uiJs).toContain("from './spreadsheet-export.js'");
    expect(uiJs).toContain('function exportSpreadsheetXlsx()');
    expect(uiJs).toContain('function exportSpreadsheetCsvZip()');
    expect(uiJs).toContain("type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'");
    expect(uiJs).not.toMatch(/fetch\([^)]*spreadsheet|xlsx\.cloud|sheetjs\.com/i);
  });
});
