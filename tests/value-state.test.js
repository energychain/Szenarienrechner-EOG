import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calcPortfolio, params } from '../src/engine.js';
import { fieldDescriptorsFor, objectTypes } from '../src/field-registry.js';
import { classifyMeasureViability } from '../src/viability-classification.js';
import {
  VALUE_STATES,
  evidenceGaps,
  gapsFor,
  historyIndicatesChange,
  isDerivedValue,
  missingObjectGaps,
  missingValueFields,
  openDecisionFor,
  suggestedEdges,
  valueState
} from '../src/value-state.js';

const referenceModel = JSON.parse(
  readFileSync(new URL('./fixtures/reference-model.json', import.meta.url), 'utf8')
);
const measures = referenceModel.model.measures;
const history = referenceModel.history;

describe('value-state: Zustandsklassifikation (Kriterium 7)', () => {
  it('recognizes an openByDecision entry regardless of history or defaults', () => {
    const openDecisions = { measure_1: { note: { reason: 'bewusst offen, wird in Sitzung geklärt', author: 'a@b.de', timestamp: '2027-01-01T00:00:00.000Z' } } };
    const result = valueState('measure', 'note', '', { objectId: 'measure_1', openDecisions });
    expect(result.state).toBe('openByDecision');
    expect(result.reason).toContain('bewusst offen');
  });

  it('recognizes a derived value via classifyMeasureViability', () => {
    const derivedMeasure = measures.find(measure => classifyMeasureViability(measure).source === 'derived');
    expect(derivedMeasure).toBeTruthy();
    expect(isDerivedValue('measure', 'viabilityCategory', derivedMeasure)).toBe(true);
    const result = valueState('measure', 'viabilityCategory', derivedMeasure.viabilityCategory, { object: derivedMeasure, objectId: derivedMeasure.id });
    expect(result.state).toBe('derived');
  });

  it('recognizes set via a matching history event for a measure field', () => {
    // the reference fixture records a 'cost' event for every measure
    expect(historyIndicatesChange(history, 'measure', measures[0].id, 'cost')).toBe(true);
    const result = valueState('measure', 'cost', measures[0].cost, { object: measures[0], objectId: measures[0].id, history });
    expect(result.state).toBe('set');
  });

  it('falls back to default when the value matches the field default and history is silent', () => {
    // opexDeltaPa is never touched in the fixture and keeps its 0 default
    expect(historyIndicatesChange(history, 'measure', measures[0].id, 'opexDeltaPa')).toBe(false);
    const result = valueState('measure', 'opexDeltaPa', measures[0].opexDeltaPa, { object: measures[0], objectId: measures[0].id, history });
    expect(result.state).toBe('default');
  });

  it('falls back to set when the value differs from the default even without a history event', () => {
    // measure_3's cost (180) differs from the generic 250 default and has no dedicated event for that field
    const measure = measures.find(m => m.id === 'measure_3');
    expect(historyIndicatesChange(history, 'measure', measure.id, 'name')).toBe(false);
    const result = valueState('measure', 'name', measure.name, { object: measure, objectId: measure.id, history });
    expect(result.state).toBe('set');
  });

  it('treats sidecar fields as default-vs-value only, since diffModelEvents does not diff sidecar', () => {
    expect(historyIndicatesChange(history, 'sidecarObject', 'ctx_1', 'evidenceStatus')).toBe(false);
    const object = referenceModel.model.sidecar.objects[0];
    const result = valueState('sidecarObject', 'evidenceStatus', object.evidenceStatus, { object, objectId: object.id, history });
    expect(VALUE_STATES).toContain(result.state);
  });

  it('recognizes set for a sidecar field once a confirmation event is recorded for it (main-akte.js confirmFieldIfStillDefault)', () => {
    const confirmedHistory = {
      ...history,
      events: [
        ...history.events,
        { id: 'ev_confirm', type: 'fieldConfirmed', subject: { scope: 'sidecar', sidecarId: 'ctx_1' }, field: 'evidenceStatus', oldValue: 'missing', newValue: 'missing' }
      ]
    };
    expect(historyIndicatesChange(confirmedHistory, 'sidecarObject', 'ctx_1', 'evidenceStatus')).toBe(true);
    const object = referenceModel.model.sidecar.objects[0];
    const result = valueState('sidecarObject', 'evidenceStatus', object.evidenceStatus, { object, objectId: 'ctx_1', history: confirmedHistory });
    expect(result.state).toBe('set');
    // a different sidecar object/field must stay unaffected
    expect(historyIndicatesChange(confirmedHistory, 'sidecarObject', 'ctx_1', 'title')).toBe(false);
    expect(historyIndicatesChange(confirmedHistory, 'sidecarObject', 'ctx_2', 'evidenceStatus')).toBe(false);
  });

  it('always returns one of the four defined states for every descriptor, for every reference measure', () => {
    const seen = new Set();
    measures.forEach(measure => {
      fieldDescriptorsFor('measure').forEach(descriptor => {
        const result = valueState('measure', descriptor.key, measure[descriptor.key], { object: measure, objectId: measure.id, history });
        seen.add(result.state);
        expect(VALUE_STATES, `${measure.id}.${descriptor.key} -> ${result.state}`).toContain(result.state);
      });
    });
    // sanity: the reference model actually exercises more than one state
    expect(seen.size).toBeGreaterThan(1);
  });

  it('never throws for any object type, even against an empty object', () => {
    objectTypes.forEach(objectType => {
      fieldDescriptorsFor(objectType).forEach(descriptor => {
        expect(() => valueState(objectType, descriptor.key, undefined, { object: {}, objectId: 'x' })).not.toThrow();
      });
    });
  });
});

describe('value-state: Lückenlogik (Abschnitt 6.2)', () => {
  it('Lückenart 1 — lists fields at their default as missing values', () => {
    const measure = measures.find(m => m.id === 'measure_1');
    const missing = missingValueFields('measure', measure, { history });
    expect(missing.length).toBeGreaterThan(0);
    missing.forEach(entry => expect(entry.state).toBe('default'));
  });

  it('Lückenart 2 — flags weak evidenceKey values using the evidence field\'s own clarificationOn', () => {
    const measure = measures.find(m => m.id === 'measure_2'); // riskAvoided=45, riskEvidenceStatus=''
    const gaps = evidenceGaps('measure', measure);
    expect(gaps.some(gap => gap.key === 'riskAvoided')).toBe(true);
  });

  it('Lückenart 2 — does not flag evidence for a measure whose evidence status is strong', () => {
    const measure = measures.find(m => m.id === 'measure_4'); // sourceStatus='validated'
    const gaps = evidenceGaps('measure', measure);
    expect(gaps.some(gap => gap.key === 'sourceSystem')).toBe(false);
  });

  it('Lückenart 3 — flags a reference field whose target id does not exist', () => {
    const measure = { id: 'm1', active: true, objectiveIds: ['obj_missing'] };
    const gaps = missingObjectGaps('measure', measure, { objective: new Set(['obj_supply']) });
    expect(gaps).toEqual([{ key: 'objectiveIds', targetType: 'objective', targetId: 'obj_missing' }]);
  });

  it('Lückenart 3 — does not flag a reference field whose target id exists', () => {
    const measure = { id: 'm1', active: true, objectiveIds: ['obj_supply'] };
    const gaps = missingObjectGaps('measure', measure, { objective: new Set(['obj_supply']) });
    expect(gaps).toEqual([]);
  });

  it('Lückenart 4 — suggests a measure-objective edge when active measures lack objectiveIds', () => {
    const edges = suggestedEdges(referenceModel.model);
    const edge = edges.find(item => item.type === 'measure-objective');
    expect(edge).toBeTruthy();
    expect(edge.count).toBe(measures.filter(m => m.active && !(m.objectiveIds || []).length).length);
  });

  it('gapsFor bundles all three detectable gap kinds for one object', () => {
    const measure = measures.find(m => m.id === 'measure_2');
    const gaps = gapsFor('measure', measure, { history, knownIdsByType: { objective: new Set(['obj_supply']) } });
    expect(gaps).toHaveProperty('missingValues');
    expect(gaps).toHaveProperty('missingEvidence');
    expect(gaps).toHaveProperty('missingObjects');
  });
});

describe('value-state: openDecisionFor', () => {
  it('returns null when nothing is recorded', () => {
    expect(openDecisionFor(undefined, 'measure_1', 'note')).toBeNull();
    expect(openDecisionFor({}, 'measure_1', 'note')).toBeNull();
  });

  it('returns the decision record when present', () => {
    const openDecisions = { measure_1: { note: { reason: 'x', author: 'a', timestamp: 't' } } };
    expect(openDecisionFor(openDecisions, 'measure_1', 'note')).toEqual({ reason: 'x', author: 'a', timestamp: 't' });
  });
});

describe('Kriterium 8 — keine Eingabe blockiert die Rechnung, kein Pflichtfeld', () => {
  it('calcPortfolio computes for a completely empty portfolio', () => {
    const p = params({ sector: 'gas', baseYear: 2027, baseEog: 0, rab: 0 });
    expect(() => calcPortfolio({ measures: [] }, p)).not.toThrow();
    const result = calcPortfolio({ measures: [] }, p);
    expect(result.yearly.length).toBeGreaterThan(0);
  });

  it('calcPortfolio computes for a single measure with only an id set (every other field missing)', () => {
    const p = params({ sector: 'gas', baseYear: 2027, baseEog: 0, rab: 0 });
    expect(() => calcPortfolio({ measures: [{ id: 'bare' }] }, p)).not.toThrow();
  });

  it('missingValueFields never throws for a fully empty measure and treats every field as a gap or inapplicable', () => {
    expect(() => missingValueFields('measure', {}, {})).not.toThrow();
    const missing = missingValueFields('measure', {}, {});
    expect(missing.length).toBeGreaterThan(0);
  });
});
