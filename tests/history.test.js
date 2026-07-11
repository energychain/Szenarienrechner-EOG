import { describe, expect, it } from 'vitest';
import {
  appendHistoryEvents,
  diffModelEvents,
  emptyHistory
} from '../src/history.js';

const baseModel = {
  scenario: 'basis',
  inputs: {
    sector: 'strom',
    baseYear: '2027',
    baseEog: '20000'
  },
  measures: [
    {
      id: 'm1',
      active: true,
      name: 'Testmaßnahme',
      cost: 100,
      impactAssumptions: [
        {
          id: 'i1',
          area: 'qElement',
          title: 'Q-Wirkung',
          amount: 10,
          confidence: 'review',
          governance: 'sensitivity'
        }
      ]
    }
  ],
  meetingTextOverrides: {}
};

describe('history event log', () => {
  it('creates append-only events with parent links', () => {
    const history = appendHistoryEvents(emptyHistory(), [
      { type: 'imported', subject: { scope: 'model' }, field: 'version', oldValue: null, newValue: 2 },
      { type: 'inputChanged', subject: { scope: 'inputs' }, field: 'baseYear', oldValue: '2027', newValue: '2028' }
    ], 'Zoerner', () => '2026-07-12T09:31:00Z');

    expect(history.events).toHaveLength(2);
    expect(history.headId).toBe(history.events[1].id);
    expect(history.events[0]).toMatchObject({ parentId: null, author: 'Zoerner', type: 'imported' });
    expect(history.events[1]).toMatchObject({ parentId: history.events[0].id, field: 'baseYear' });
  });

  it('diffs model changes as semantic events', () => {
    const nextModel = structuredClone(baseModel);
    nextModel.inputs.baseEog = '21000';
    nextModel.measures[0].impactAssumptions[0].confidence = 'proven';

    const events = diffModelEvents(baseModel, nextModel);

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'inputChanged',
        subject: { scope: 'inputs' },
        field: 'baseEog',
        oldValue: '20000',
        newValue: '21000'
      }),
      expect.objectContaining({
        type: 'assumptionConfidenceChanged',
        subject: { measureId: 'm1', impactId: 'i1' },
        field: 'confidence',
        oldValue: 'review',
        newValue: 'proven'
      })
    ]));
  });
});
