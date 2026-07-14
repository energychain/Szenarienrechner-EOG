import { describe, expect, it } from 'vitest';
import { initialMeasures } from '../src/demo-data.js';
import { normalizeProjectPlan } from '../src/project-plan.js';
import { spreadsheetTables, tableToCsv, tablesToCsvZip, tablesToXlsx } from '../src/spreadsheet-export.js';
import { buildInfo } from '../src/build-info.js';
import { regulatoryParameterSet } from '../src/engine.js';

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
    measures: initialMeasures,
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
      'Provenienz'
    ]);
    expect(tables.find(table => table.name === 'Massnahmen')?.rows[0]).toContain('yearOneRegulatoryEogTeur');
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
    expect(csvZip[0]).toBe(0x50);
    expect(csvZip[1]).toBe(0x4b);
    expect(csvText).toContain('Massnahmen.csv');
    expect(csvText).toContain('Projektplan.csv');
  });
});
