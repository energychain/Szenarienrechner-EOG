import { describe, expect, test } from 'vitest';
import {
  defaultSidecar,
  normalizeSidecar,
  sidecarSummary,
  sanitizeSidecarForExport,
  sidecarProfiles,
} from '../src/sidecar.js';
import { calcPortfolio, params } from '../src/engine.js';

describe('sidecar data model', () => {
  test('missing sidecar normalizes to empty versioned sidecar', () => {
    expect(normalizeSidecar(null)).toEqual(defaultSidecar());
  });

  test('normalizes strom and gas objects with required governance fields', () => {
    const sidecar = normalizeSidecar({
      objects: [
        { id: 'ctx_strom', type: 'load_request', division: 'strom', title: 'Großanschluss', sensitivity: 'confidential' },
        { id: 'ctx_gas', type: 'decommissioning_context', division: 'gas', title: 'Rückbaupfad', calculationImpact: 'indirect' },
      ],
      sources: [{ id: 'src_private', title: 'Planungsdokument', sensitivity: 'private', exportStatus: 'sanitized_only' }],
    });

    expect(sidecar.version).toBe('1.0');
    expect(sidecar.objects).toHaveLength(2);
    expect(sidecar.objects[0]).toMatchObject({
      id: 'ctx_strom',
      division: 'strom',
      status: 'context',
      evidenceStatus: 'missing',
      calculationImpact: 'none',
      exportStatus: 'sanitized_only',
    });
    expect(sidecar.sources[0].exportStatus).toBe('sanitized_only');
  });

  test('summarizes evidence, data quality and calculation impact without listing sensitive details', () => {
    const summary = sidecarSummary(normalizeSidecar({
      objects: [
        { id: 'a', type: 'data_quality', division: 'strom', title: 'Mapping offen', evidenceStatus: 'missing', calculationImpact: 'none', openQuestions: ['Mapping nachführen'] },
        { id: 'b', type: 'gas_load_path', division: 'gas', title: 'Lastpfad', evidenceStatus: 'validated', calculationImpact: 'scenario_only', openQuestions: [] },
        { id: 'c', type: 'controllability', division: 'strom', title: 'Steuerbarkeit', evidenceStatus: 'source_available', calculationImpact: 'indirect', openQuestions: ['Teststatus offen'] },
      ],
    }));

    expect(summary.total).toBe(3);
    expect(summary.byDivision.strom).toBe(2);
    expect(summary.byDivision.gas).toBe(1);
    expect(summary.openQuestions).toBe(2);
    expect(summary.dataQualityOpen).toBe(1);
    expect(summary.calculationImpact.none).toBe(1);
    expect(summary.calculationImpact.scenario_only).toBe(1);
  });

  test('sanitized export removes sensitive summaries and excluded objects', () => {
    const sidecar = normalizeSidecar({
      objects: [
        { id: 'keep', type: 'data_quality', division: 'strom', title: 'Datenqualität', summary: 'Interner Kundendetailtext', sensitivity: 'private', exportStatus: 'sanitized_only', sourceRefs: ['src1'], openQuestions: ['Klärung'] },
        { id: 'drop', type: 'external_dependency', division: 'gas', title: 'Vertrag', sensitivity: 'confidential', exportStatus: 'excluded' },
      ],
      sources: [
        { id: 'src1', title: 'Interne Quelle', sensitivity: 'private', exportStatus: 'sanitized_only' },
        { id: 'src2', title: 'Geheimer Vertrag', sensitivity: 'confidential', exportStatus: 'excluded' },
      ],
    });

    const sanitized = sanitizeSidecarForExport(sidecar, 'sanitized_external');
    expect(sanitized.objects).toHaveLength(1);
    expect(sanitized.objects[0].summary).toContain('sanitisiert');
    expect(sanitized.objects[0].sourceRefs).toEqual([]);
    expect(sanitized.sources).toHaveLength(1);
    expect(sanitized.sources[0].title).toBe('Quelle sanitisiert');
  });

  test('sidecar objects do not affect portfolio KPI results', () => {
    const inputs = { sector: 'strom', baseYear: 2027, baseEog: 10000, rab: 50000, returnRate: 5, financingRate: 4, horizon: 10, discountRate: 5 };
    const measures = [{ id: 'm1', name: 'Netzmaßnahme', active: true, cost: 100, year: 2027, life: 20, secure: 100, uncertain: 0, probability: 0 }];
    const p = params(inputs);
    const baseline = calcPortfolio({ measures }, p);
    const withSidecar = calcPortfolio({
      measures,
      sidecar: normalizeSidecar({ objects: [{ id: 'ctx', type: 'load_request', division: 'strom', title: 'Lastanfrage', calculationImpact: 'active' }] }),
    }, p);
    expect(withSidecar.invest).toBeCloseTo(baseline.invest, 6);
    expect(withSidecar.npv).toBeCloseTo(baseline.npv, 6);
    expect(withSidecar.yearly[0].regulatoryEogEffect).toBeCloseTo(baseline.yearly[0].regulatoryEogEffect, 6);
  });

  test('profiles expose division-specific labels', () => {
    expect(sidecarProfiles.strom.categories).toContain('grid_coupling');
    expect(sidecarProfiles.gas.categories).toContain('decommissioning_context');
  });
});
