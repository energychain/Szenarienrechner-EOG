import { describe, expect, it } from 'vitest';
import {
  calcPortfolio,
  params,
  portfolioDecisionMetrics,
  scenarioParams
} from '../src/engine.js';
import { buildAiPrompt, defaultAiPromptOptions, redactModelForPrompt } from '../src/ai-prompt-generator.js';

const stromInputs = {
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
  portfolioAttribution: 25,
  qDelta: 0,
  eDelta: 0,
  regulationProcedure: 'standard',
  annualEnergyGwh: 465,
  householdConsumptionKwh: 2900,
  capexLagYears: 0,
  opexLagYears: 3,
  qeLagYears: 2
};

function stromMeasure(id, overrides = {}) {
  return {
    id,
    active: true,
    name: `Strom Maßnahme ${id}`,
    type: 'noRegret',
    portfolioClassification: 'core_portfolio',
    assetType: 'digitalization',
    usefulLifeEvidenceStatus: 'default',
    riskAvoidedEvidenceStatus: 'not_assessed',
    cost: 10,
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
    riskAvoided: 20,
    portfolioShare: 0,
    impactAssumptions: [],
    ...overrides
  };
}

describe('Strom robustness and plausibility checks', () => {
  it('marks identical conservative scenario as missing stress test without affecting gas', () => {
    const p = params(stromInputs);
    const model = { measures: [stromMeasure('s1')] };
    const basis = calcPortfolio(model, scenarioParams(p, 'basis'));
    const conservative = calcPortfolio(model, scenarioParams(p, 'konservativ'));
    const metrics = portfolioDecisionMetrics(basis, conservative);

    expect(metrics.scenarioComparison.identicalBasisConservative).toBe(true);
    expect(metrics.interpretationWarnings.map(w => w.type)).toContain('strom_conservative_case_missing');
    expect(metrics.governanceDecision.title).not.toBe('Robust tragfähig');

    const gasP = params({ ...stromInputs, sector: 'gas' });
    const gasBasis = calcPortfolio(model, scenarioParams(gasP, 'basis'));
    const gasConservative = calcPortfolio(model, scenarioParams(gasP, 'konservativ'));
    const gasMetrics = portfolioDecisionMetrics(gasBasis, gasConservative);
    expect(gasMetrics.interpretationWarnings.map(w => w.type)).not.toContain('strom_conservative_case_missing');
  });

  it('adds Strom-specific review warnings for regulatory sensitivity, defaults, risk, useful life and no-regret overuse', () => {
    const p = params(stromInputs);
    const result = calcPortfolio({
      measures: [
        stromMeasure('a', { portfolioClassification: 'scope_candidate' }),
        stromMeasure('b', { riskAvoided: 50 }),
        stromMeasure('c', { life: 40, assetType: 'communication' })
      ]
    }, p);
    const types = result.warnings.map(warning => warning.type);

    expect(types).toContain('strom_regulatory_framework_review');
    expect(types).toContain('strom_default_assumptions_review');
    expect(types).toContain('risk_avoidance_evidence_missing');
    expect(types).toContain('risk_avoidance_outlier_review');
    expect(types).toContain('useful_life_plausibility_review');
    expect(types).toContain('no_regret_overuse_review');
    expect(result.portfolioSegmentation.scopeCandidate.invest).toBeGreaterThan(0);
    expect(result.portfolioSegmentation.corePortfolio.invest).toBeGreaterThan(0);
  });

  it('exports aggregated Strom review context to challenge prompts without touching gas-only logic', () => {
    const model = {
      inputs: stromInputs,
      scenario: 'basis',
      process: { phase: 'massnahmenbewertung', resume: { nextStep: '' } },
      projectPlan: { milestones: [] },
      measures: [stromMeasure('a', { portfolioClassification: 'scope_candidate' }), stromMeasure('b'), stromMeasure('c')]
    };
    const redacted = redactModelForPrompt(model, { ...defaultAiPromptOptions, roleId: 'challenge', dataScope: 'standard' });
    expect(redacted.stromReview.warningTypes).toContain('strom_regulatory_framework_review');
    expect(redacted.stromReview.warningTypes).toContain('project_maturity_review');
    expect(redacted.portfolioSegmentation.scopeCandidate.investTeur).toBeGreaterThan(0);

    const prompt = buildAiPrompt(model, { ...defaultAiPromptOptions, roleId: 'challenge', dataScope: 'standard' });
    expect(prompt).toContain('## Robustheit / Szenariologik');
    expect(prompt).toContain('## Regulatorischer Sensitivitätsrahmen Strom / NEST');
    expect(prompt).toContain('## Kernportfolio vs. Scope-Kandidaten');
    expect(prompt).toContain('strom_regulatory_framework_review');
    expect(prompt).toContain('risk_avoidance_evidence_missing');
  });
});
