import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  committeeIds,
  defaultObjectives,
  detailIds,
  importFields,
  inputIds
} from '../src/ui-config.js';
import { normalizeMeasure, newImpactAssumptionTemplate } from '../src/model-normalize.js';
import { normalizeSidecarObject, normalizeSidecarSource } from '../src/sidecar.js';
import {
  committeeFields,
  fieldKeysFor,
  impactAssumptionFields,
  inputFields,
  measureFields,
  objectiveFields,
  sidecarObjectFields,
  sidecarSourceFields
} from '../src/field-registry.js';

const referenceModel = JSON.parse(
  readFileSync(new URL('./fixtures/reference-model.json', import.meta.url), 'utf8')
);

// detailIds are DOM ids ("mSecure"); the field-registry key is the model field
// key ("secure"). The mapping strips the leading "m" and lowercases the next
// character — verified against normalizeMeasure's actual output below.
function measureKeyFor(detailId) {
  return detailId.slice(1, 2).toLowerCase() + detailId.slice(2);
}

describe('field-registry Vollständigkeitspflicht (Spezifikation 5.1)', () => {
  it('has a measure descriptor for every detailIds-derived field key', () => {
    const keys = new Set(fieldKeysFor('measure'));
    const missing = detailIds.map(measureKeyFor).filter(key => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('has a measure descriptor for every key normalizeMeasure actually produces', () => {
    const keys = new Set(fieldKeysFor('measure'));
    const normalized = normalizeMeasure({}, 0, {});
    const missing = Object.keys(normalized).filter(key => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('has a measure descriptor for every measure key present in the reference model', () => {
    const keys = new Set(fieldKeysFor('measure'));
    const referenceKeys = new Set();
    referenceModel.model.measures.forEach(measure => {
      Object.keys(measure).forEach(key => referenceKeys.add(key));
    });
    const missing = [...referenceKeys].filter(key => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('has a measure descriptor for every importable field (importFields, excluding "ignore")', () => {
    const keys = new Set(fieldKeysFor('measure'));
    const missing = importFields
      .map(([key]) => key)
      .filter(key => key !== 'ignore' && key !== 'active' && !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('has an impactAssumption descriptor for every key newImpactAssumptionTemplate produces', () => {
    const keys = new Set(fieldKeysFor('impactAssumption'));
    const template = newImpactAssumptionTemplate({}, 2027);
    const missing = Object.keys(template).filter(key => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('has an impactAssumption descriptor for every key present in the reference model', () => {
    const keys = new Set(fieldKeysFor('impactAssumption'));
    const referenceKeys = new Set();
    referenceModel.model.measures.forEach(measure => {
      (measure.impactAssumptions || []).forEach(impact => {
        Object.keys(impact).forEach(key => referenceKeys.add(key));
      });
    });
    const missing = [...referenceKeys].filter(key => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('has an input descriptor for every inputIds key', () => {
    const keys = new Set(fieldKeysFor('input'));
    const missing = inputIds.filter(key => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('has an input descriptor for every key present in the reference model inputs', () => {
    const keys = new Set(fieldKeysFor('input'));
    const missing = Object.keys(referenceModel.model.inputs).filter(key => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('has a committee descriptor for every committeeIds key', () => {
    const keys = new Set(fieldKeysFor('committee'));
    const missing = committeeIds.filter(key => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('has an objective descriptor for every key defaultObjectives and the reference model produce', () => {
    const keys = new Set(fieldKeysFor('objective'));
    const referenceKeys = new Set();
    [...defaultObjectives, ...referenceModel.model.strategy.objectives].forEach(objective => {
      Object.keys(objective).forEach(key => referenceKeys.add(key));
    });
    const missing = [...referenceKeys].filter(key => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('has a sidecarObject descriptor for every key normalizeSidecarObject and the reference model produce', () => {
    const keys = new Set(fieldKeysFor('sidecarObject'));
    const referenceKeys = new Set(Object.keys(normalizeSidecarObject({})));
    referenceModel.model.sidecar.objects.forEach(object => {
      Object.keys(object).forEach(key => referenceKeys.add(key));
    });
    const missing = [...referenceKeys].filter(key => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('has a sidecarSource descriptor for every key normalizeSidecarSource and the reference model produce', () => {
    const keys = new Set(fieldKeysFor('sidecarSource'));
    const referenceKeys = new Set(Object.keys(normalizeSidecarSource({})));
    referenceModel.model.sidecar.sources.forEach(source => {
      Object.keys(source).forEach(key => referenceKeys.add(key));
    });
    const missing = [...referenceKeys].filter(key => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('gives every descriptor a key, group, order, label and sentence', () => {
    const allDescriptors = [
      ...measureFields,
      ...impactAssumptionFields,
      ...inputFields,
      ...committeeFields,
      ...objectiveFields,
      ...sidecarObjectFields,
      ...sidecarSourceFields
    ];
    allDescriptors.forEach(descriptor => {
      expect(descriptor.key, `descriptor missing key`).toBeTruthy();
      expect(descriptor.group, `${descriptor.key}: missing group`).toBeTruthy();
      expect(typeof descriptor.order, `${descriptor.key}: missing order`).toBe('number');
      expect(descriptor.label, `${descriptor.key}: missing label`).toBeTruthy();
      expect(descriptor.sentence, `${descriptor.key}: missing sentence`).toBeTruthy();
    });
  });

  it('has no duplicate keys within any single object type', () => {
    Object.entries({
      measure: measureFields,
      impactAssumption: impactAssumptionFields,
      input: inputFields,
      committee: committeeFields,
      objective: objectiveFields,
      sidecarObject: sidecarObjectFields,
      sidecarSource: sidecarSourceFields
    }).forEach(([objectType, descriptors]) => {
      const keys = descriptors.map(descriptor => descriptor.key);
      const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
      expect(duplicates, `${objectType} has duplicate descriptor keys`).toEqual([]);
    });
  });
});
