import { describe, expect, it } from 'vitest';
import {
  VIABILITY_CATEGORIES,
  classifyMeasureViability,
  viabilityClarificationItems,
  viabilityOverviewFor
} from '../src/viability-classification.js';

const baseInputs = { sector: 'gas', baseYear: 2027, baseEog: 10000, rab: 50000, horizon: 20, discountRate: 4 };

function measure(overrides = {}) {
  return {
    id: 'm1',
    name: 'Demo-Maßnahme',
    active: true,
    cost: 100,
    year: 2027,
    type: 'noRegret',
    riskAvoided: 0,
    tags: [],
    impactAssumptions: [],
    ...overrides
  };
}

describe('division-scoped viability classification', () => {
  it('uses manual viability category and keeps it reviewable', () => {
    const classification = classifyMeasureViability(measure({
      viabilityCategory: 'strategic_option',
      viabilityCategorySource: 'manual',
      viabilityRationale: 'Schafft spätere Anschlussoption.'
    }));

    expect(classification.category).toBe('strategic_option');
    expect(classification.source).toBe('manual');
    expect(classification.reviewRequired).toBe(false);
    expect(classification.rationale).toContain('Anschlussoption');
  });

  it('derives conservative categories from existing neutral model fields', () => {
    expect(classifyMeasureViability(measure({ permitRequired: 'yes', monitoringCategory: 'Konzessionsvertrag' })).category)
      .toBe('regulatory_must');
    expect(classifyMeasureViability(measure({ riskAvoided: 25, monitoringCategory: 'Störung' })).category)
      .toBe('asset_preservation_must');
    expect(classifyMeasureViability(measure({ gasTransformationPath: 'stilllegung', type: 'noRegret', note: 'No-Regret begründet' })).category)
      .toBe('transformation_must_no_regret');
    expect(classifyMeasureViability(measure({ effectType: 'flexibility', capacityImpact: 'Netzanschlussreserve' })).category)
      .toBe('strategic_option');
    expect(classifyMeasureViability(measure({ flexibilityNeed: 'Mit Straßenbau bündeln', capacityImpact: 'Zeitfenster 2028' })).category)
      .toBe('synergy_timing');
  });

  it('builds one overview for one division without mixed aggregation', () => {
    const measures = [
      measure({ id: 'gas-a', division: 'gas', cost: 100, monitoringCategory: 'Störung', riskAvoided: 10 }),
      measure({ id: 'strom-b', division: 'strom', cost: 900, effectType: 'flexibility', capacityImpact: 'Netzanschlussreserve' })
    ];
    const gas = viabilityOverviewFor({ measures }, { ...baseInputs, sector: 'gas' });
    const strom = viabilityOverviewFor({ measures }, { ...baseInputs, sector: 'strom' });

    expect(gas.sector).toBe('gas');
    expect(strom.sector).toBe('strom');
    expect(gas.totalCount).toBe(1);
    expect(strom.totalCount).toBe(1);
    expect(gas.categories.asset_preservation_must.capexTeur).toBe(100);
    expect(strom.categories.strategic_option.count).toBe(1);
    expect(Object.keys(gas.categories)).toEqual(VIABILITY_CATEGORIES.map(category => category.id));
  });

  it('surfaces missing or weak viability/refinancing logic as review items', () => {
    const unclassified = measure({ id: 'unclear', cost: 120, type: 'other', tags: [], note: '', riskAvoided: 0 });
    const overview = viabilityOverviewFor({ measures: [unclassified] }, { ...baseInputs, sector: 'gas' });
    const items = viabilityClarificationItems({ measures: [unclassified] }, { ...baseInputs, sector: 'gas' });

    expect(overview.warnings.some(warning => warning.type === 'missing_viability_logic')).toBe(true);
    expect(items[0]).toMatchObject({ type: 'viability', measureId: 'unclear', targetView: 'measures' });
    expect(items[0].title).toContain('Tragfähigkeitslogik');
  });
});
