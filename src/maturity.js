import {
  impactAssumptionsFor,
  params as engineParams,
  portfolioDecisionMetrics,
  calcPortfolio,
  scenarioParams as engineScenarioParams
} from './engine.js';
import { allImpactAssumptions, reviewRequiredImpacts, clarificationItems } from './clarifications.js';

export function impactCounts(measure) {
  const impacts = impactAssumptionsFor(measure);
  return {
    total: impacts.length,
    proven: impacts.filter(impact => impact.confidence === 'proven').length,
    assumption: impacts.filter(impact => impact.confidence === 'assumption').length,
    review: impacts.filter(impact => impact.confidence === 'review').length
  };
}

function decisionTitleFor(result, conservativeResult = null) {
  return portfolioDecisionMetrics(result, conservativeResult).governanceDecision.title;
}

export function scenarioVerdictSignature(resultsByScenario = {}) {
  return ['basis', 'konservativ', 'wert'].map(name => decisionTitleFor(resultsByScenario[name]));
}

export function maturityScore(model = {}, params = {}, result = { warnings: [] }, resultsByScenario = {}, clarificationStatus = {}) {
  const measures = model.measures || [];
  const activeImpacts = allImpactAssumptions(measures, true);
  const reviewItems = reviewRequiredImpacts(measures, true);
  const clarifications = clarificationItems(model, params, result, clarificationStatus);
  const openClarifications = clarifications.filter(item => item.status !== 'closed');
  const basisComplete = Boolean(params.sector) && Number(params.baseYear) > 0 && Number(params.baseEog) > 0;
  const confirmedShare = activeImpacts.length
    ? activeImpacts.filter(item => item.confidence === 'proven' && item.governance === 'basis').length / activeImpacts.length
    : 0;
  const reviewPenalty = activeImpacts.length ? reviewItems.length / activeImpacts.length : 0;
  const verdicts = scenarioVerdictSignature(resultsByScenario);
  const verdictStable = new Set(verdicts).size <= 1;
  const activeCount = measures.filter(measure => measure.active).length;
  let score = 0;
  score += basisComplete ? 20 : 0;
  score += activeCount > 0 ? 20 : 0;
  score += Math.round(confirmedShare * 25);
  score += Math.max(0, 20 - Math.round(reviewPenalty * 20));
  score += verdictStable ? 10 : 4;
  score += openClarifications.length === 0 ? 5 : 0;
  return {
    score: Math.max(0, Math.min(100, score)),
    blockers: openClarifications.length,
    reviewCount: reviewItems.length,
    openClarifications,
    verdictStable
  };
}

export function metricsForModel(model) {
  try {
    const p = engineParams(model.inputs || {});
    const result = calcPortfolio({ measures: model.measures || [] }, engineScenarioParams(p, model.scenario || 'basis'));
    const first = result.yearly[0] || { eog: 0 };
    const impacts = (model.measures || []).filter(measure => measure.active).flatMap(measure => impactAssumptionsFor(measure));
    const reviewCount = impacts.filter(impact => impact.confidence === 'review' || impact.governance === 'sensitivity').length;
    const maturity = Math.max(0, Math.min(100, 40 + (result.activeMeasures.length ? 20 : 0) + (impacts.length ? Math.round((impacts.length - reviewCount) / impacts.length * 30) : 0)));
    return {
      irr: result.irr,
      npv: result.npv,
      eog: first.regulatoryEogEffect,
      verdict: decisionTitleFor(result),
      maturity,
      activeMeasures: result.activeMeasures.length
    };
  } catch (_error) {
    return { irr: NaN, npv: NaN, eog: NaN, verdict: '-', maturity: NaN, activeMeasures: 0 };
  }
}
