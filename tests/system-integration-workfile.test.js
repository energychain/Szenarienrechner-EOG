import { describe, expect, it } from 'vitest';
import { calcPortfolio, params, workstandReliabilityFor } from '../src/engine.js';
import { spreadsheetTables } from '../src/spreadsheet-export.js';

const baseInputs = {
  sector: 'gas',
  baseYear: 2027,
  baseEog: 24570,
  rab: 60000,
  returnRate: 4.1,
  financingRate: 4,
  horizon: 8,
  discountRate: 4,
  kanuEndYear: 2045,
  degressiveRate: 10,
  taxFactor: 0,
  portfolioAttribution: 0,
  qDelta: 0,
  eDelta: 0,
  regulationProcedure: 'standard',
  annualEnergyGwh: 800,
  householdConsumptionKwh: 15000,
  capexLagYears: 0,
  opexLagYears: 3,
  qeLagYears: 2
};

function measure(id, overrides = {}) {
  return {
    id,
    active: true,
    name: `Maßnahme ${id}`,
    type: 'noRegret',
    cost: 100,
    year: 2027,
    secure: 70,
    uncertain: 30,
    probability: 50,
    opexRecognition: 70,
    life: 40,
    hgbLife: 40,
    depr: 'kanuLinear',
    qDirect: 0,
    eDirect: 0,
    riskAvoided: 10,
    portfolioShare: 0,
    objectiveIds: [],
    impactAssumptions: [],
    ...overrides
  };
}

describe('system integration working file', () => {
  it('flags missing source-system references and incomplete risk database mapping as reliability issues', () => {
    const model = {
      inputs: baseInputs,
      measures: [
        measure('a', { externalId: 'PSP-1', sourceSystem: 'Scoringliste', riskDbRef: 'RISK-1', riskEvidenceStatus: 'validated' }),
        measure('b', { externalId: '', sourceSystem: '', riskDbRef: '', riskEvidenceStatus: 'missing' })
      ]
    };
    const result = calcPortfolio(model, params(baseInputs));
    const reliability = workstandReliabilityFor(model, result);

    expect(reliability.systemReferences).toMatchObject({ totalActive: 2, incomplete: 1 });
    expect(reliability.riskMapping).toMatchObject({ riskMeasures: 2, incomplete: 1 });
    expect(reliability.items.map(item => item.key)).toEqual(expect.arrayContaining(['system-references', 'risk-mapping']));
    expect(reliability.items.find(item => item.key === 'system-references').label).toBe('Systemreferenzen je Maßnahme');
    expect(reliability.items.find(item => item.key === 'risk-mapping').label).toBe('Risiko-Mapping');
  });

  it('exports system references, risk mappings and prioritized clarification rows as separate integration handoff tables', () => {
    const model = {
      inputs: baseInputs,
      measures: [
        measure('a', {
          externalId: 'PSP-1',
          sourceSystem: 'Scoringliste',
          sourceRecordId: 'Zeile 12',
          sourceStatus: 'benannt',
          scoringRef: 'SC-12',
          assetSystemRef: 'ASSET-77',
          erpRef: 'ERP-42',
          riskDbRef: 'RISK-1',
          riskEvidenceStatus: 'benannt',
          riskOwnerRole: 'technik',
          riskAssessmentStatus: 'prüfpflichtig'
        })
      ]
    };

    const tables = spreadsheetTables(model);
    const tableNames = tables.map(table => table.name);
    expect(tableNames).toEqual(expect.arrayContaining(['Systemreferenzen', 'Risiko_Mapping', 'Klaerpunkte_Priorisiert', 'Sidecar_Ueberleitungslogik']));
    const systemRows = tables.find(table => table.name === 'Systemreferenzen').rows;
    expect(systemRows[0]).toEqual(expect.arrayContaining(['sourceSystem', 'sourceRecordId', 'scoringRef', 'assetSystemRef', 'erpRef', 'riskDbRef', 'sourceStatus']));
    expect(systemRows[1]).toEqual(expect.arrayContaining(['Scoringliste', 'Zeile 12', 'SC-12', 'ASSET-77', 'ERP-42', 'RISK-1', 'benannt']));
    const riskRows = tables.find(table => table.name === 'Risiko_Mapping').rows;
    expect(riskRows[0]).toEqual(expect.arrayContaining(['riskDbRef', 'riskEvidenceStatus', 'riskOwnerRole', 'riskAssessmentStatus']));
    expect(riskRows[1]).toEqual(expect.arrayContaining(['RISK-1', 'benannt', 'technik', 'prüfpflichtig']));
    const clarificationRows = tables.find(table => table.name === 'Klaerpunkte_Priorisiert').rows;
    expect(clarificationRows[0]).toEqual(expect.arrayContaining(['priority', 'driver', 'measureId', 'measureName', 'suggestedAction']));
  });
});
