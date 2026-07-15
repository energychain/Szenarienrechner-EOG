import { describe, expect, it } from 'vitest';
import { demoMeasures } from '../src/demo-data.js';
import { normalizeProjectPlan } from '../src/project-plan.js';
import { spreadsheetTables, tableToCsv, tablesToCsvZip, tablesToXlsx } from '../src/spreadsheet-export.js';
import { buildInfo } from '../src/build-info.js';
import { regulatoryParameterSet } from '../src/engine.js';

function zipEntryText(zipBytes, entryName) {
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset < zipBytes.length - 30) {
    const signature = zipBytes[offset] | (zipBytes[offset + 1] << 8) | (zipBytes[offset + 2] << 16) | (zipBytes[offset + 3] << 24);
    if (signature !== 0x04034b50) break;
    const method = zipBytes[offset + 8] | (zipBytes[offset + 9] << 8);
    const compressedSize = zipBytes[offset + 18] | (zipBytes[offset + 19] << 8) | (zipBytes[offset + 20] << 16) | (zipBytes[offset + 21] << 24);
    const nameLength = zipBytes[offset + 26] | (zipBytes[offset + 27] << 8);
    const extraLength = zipBytes[offset + 28] | (zipBytes[offset + 29] << 8);
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(zipBytes.slice(nameStart, nameStart + nameLength));
    if (name === entryName) {
      expect(method).toBe(0);
      return decoder.decode(zipBytes.slice(contentStart, contentStart + compressedSize));
    }
    offset = contentStart + compressedSize;
  }
  throw new Error(`ZIP entry not found: ${entryName}`);
}

function demoModel() {
  return {
    appVersion: '0.3.0-test',
    inputs: {
      sector: 'strom',
      regulationProcedure: 'standard',
      baseYear: '2027',
      baseEog: '12000',
      rab: '30000',
      returnRate: '5',
      financingRate: '5',
      capitalCostMode: 'simple',
      annualEnergyGwh: '18',
      householdConsumptionKwh: '2900',
      horizon: '20',
      discountRate: '5',
      kanuEndYear: '2045',
      degressiveRate: '8',
      taxFactor: '0',
      portfolioAttribution: '100',
      capexLagYears: '0',
      opexLagYears: '3',
      qeLagYears: '2',
      qDelta: '0.2',
      eDelta: '0.1'
    },
    measures: demoMeasures,
    projectPlan: normalizeProjectPlan(undefined, 2027),
    lastReleaseCheck: { checkedAt: '2026-07-13T10:00:00.000Z', status: 'current' }
  };
}

describe('spreadsheet exports', () => {
  it('builds workbook-shaped tables for Excel handover', () => {
    const tables = spreadsheetTables(demoModel(), { buildInfo, ruleset: regulatoryParameterSet });
    expect(tables.map(table => table.name)).toEqual([
      'Uebersicht',
      'Massnahmen',
      'Szenarien_KPI',
      'Jahreswerte',
      'Projektplan',
      'Klaerpunkte',
      'Monitoring_Massnahmen',
      'Monitoring_Aggregat',
      'QReg_Netzleistung',
      'Netzausbauplan_14d',
      'Provenienz'
    ]);
    expect(tables.find(table => table.name === 'Massnahmen')?.rows[0]).toContain('yearOneRegulatoryEogTeur');
    expect(tables.find(table => table.name === 'Monitoring_Massnahmen')?.rows[0]).toContain('externalId');
    expect(tables.find(table => table.name === 'Monitoring_Massnahmen')?.rows.flat()).toContain('SAP-PSP-NA-2027-001');
    expect(tables.find(table => table.name === 'Monitoring_Aggregat')?.rows.flat()).toContain('Neubau/Ausbau/Erweiterung');
    expect(tables.find(table => table.name === 'Netzausbauplan_14d')?.rows[0]).not.toContain('id');
    expect(tables.find(table => table.name === 'Projektplan')?.rows.length).toBeGreaterThan(60);
    expect(tables.find(table => table.name === 'Provenienz')?.rows.flat()).toContain(regulatoryParameterSet.id);
  });

  it('renders Excel-compatible semicolon CSV with UTF-8 BOM', () => {
    const csv = tableToCsv([['Name', 'Wert'], ['A;B', 'Zeile\n2']]);
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toContain('"A;B"');
    expect(csv).toContain('"Zeile\n2"');
  });

  it('creates local XLSX and CSV ZIP payloads without external services', () => {
    const tables = spreadsheetTables(demoModel(), { buildInfo, ruleset: regulatoryParameterSet });
    const xlsx = tablesToXlsx(tables);
    const csvZip = tablesToCsvZip(tables);
    const xlsxText = new TextDecoder().decode(xlsx);
    const csvText = new TextDecoder().decode(csvZip);
    expect(xlsx[0]).toBe(0x50);
    expect(xlsx[1]).toBe(0x4b);
    expect(xlsxText).toContain('xl/workbook.xml');
    expect(xlsxText).toContain('Massnahmen');
    const measuresSheetXml = zipEntryText(xlsx, 'xl/worksheets/sheet2.xml');
    const sharedStringsXml = zipEntryText(xlsx, 'xl/sharedStrings.xml');
    expect(measuresSheetXml).toContain('dimension ref="A1:AS6"');
    expect(measuresSheetXml).toContain('<row r="2"');
    expect(measuresSheetXml).toContain(' t="s"');
    expect(sharedStringsXml).toContain('SAP-PSP-NA-2027-001');
    expect(sharedStringsXml).toContain('Netzautomatisierung Demogebiet Alpha');
    expect(csvZip[0]).toBe(0x50);
    expect(csvZip[1]).toBe(0x4b);
    expect(csvText).toContain('Massnahmen.csv');
    expect(csvText).toContain('Projektplan.csv');
  });
});
