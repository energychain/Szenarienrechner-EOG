import { describe, expect, it } from 'vitest';
import { calcPortfolio, params, workstandReliabilityFor } from '../src/engine.js';

const baseInputs = {
  sector: 'strom',
  baseYear: 2027,
  baseEog: 48000,
  rab: 77000,
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
  annualEnergyGwh: 465,
  householdConsumptionKwh: 2900,
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
    depr: 'normal',
    qDirect: 0,
    eDirect: 0,
    riskAvoided: 5,
    portfolioShare: 0,
    objectiveIds: [],
    impactAssumptions: [],
    riskAvoidedEvidenceStatus: 'not_assessed',
    ...overrides
  };
}

describe('workstand reliability dashboard', () => {
  it('aggregates non-statements across risk evidence, target mapping, no-regret defaults and sidecar quality', () => {
    const model = {
      inputs: baseInputs,
      measures: [
        measure('a'),
        measure('b'),
        measure('c', { riskAvoided: 0, type: 'option_sensitive' })
      ],
      sidecar: {
        objects: [
          { id: 'ctx1', type: 'data_quality', division: 'strom', title: 'Datenqualität', evidenceStatus: 'missing', calculationImpact: 'none', openQuestions: ['Quelle klären'], status: 'pruefpflichtig' },
          { id: 'ctx2', type: 'load_request', division: 'strom', title: 'Lastanfrage', evidenceStatus: 'validated', calculationImpact: 'indirect', openQuestions: [], status: 'context' }
        ]
      }
    };
    const result = calcPortfolio(model, params(baseInputs));
    const reliability = workstandReliabilityFor(model, result);

    expect(reliability.title).toBe('Belastbarkeit des Arbeitsstands');
    expect(reliability.riskAvoided).toMatchObject({ totalWithValue: 2, missingEvidence: 2 });
    expect(reliability.targetMapping).toMatchObject({ totalActive: 3, withoutTargets: 3 });
    expect(reliability.noRegret).toMatchObject({ noRegretCount: 2, activeClassicCount: 3 });
    expect(reliability.sidecar).toMatchObject({ total: 2, weakEvidence: 1, openQuestions: 1 });
    expect(reliability.items.map(item => item.key)).toEqual(expect.arrayContaining([
      'risk-evidence',
      'target-mapping',
      'no-regret-default',
      'sidecar-evidence'
    ]));
    expect(reliability.verdict).toBe('prüfpflichtig');
  });
});
