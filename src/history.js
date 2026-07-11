export function emptyHistory() {
  return {
    headId: null,
    events: [],
    snapshots: []
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(item => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function cloneValue(value) {
  return value === undefined ? null : structuredClone(value);
}

export function createHistoryEvent(history, draft, timestamp = new Date().toISOString()) {
  const parentId = history?.headId || null;
  const payload = {
    parentId,
    timestamp,
    author: draft.author || 'Unbekannt',
    type: draft.type,
    subject: draft.subject || { scope: 'model' },
    field: draft.field || null,
    oldValue: cloneValue(draft.oldValue),
    newValue: cloneValue(draft.newValue),
    note: draft.note || ''
  };
  return {
    id: 'ev_' + hashString(parentId + stableStringify(payload)),
    ...payload
  };
}

export function appendHistoryEvents(history, drafts, author, timestampFactory = () => new Date().toISOString()) {
  const next = {
    headId: history?.headId || null,
    events: Array.isArray(history?.events) ? structuredClone(history.events) : [],
    snapshots: Array.isArray(history?.snapshots) ? structuredClone(history.snapshots) : []
  };
  drafts.forEach(draft => {
    const event = createHistoryEvent(next, { author, ...draft }, timestampFactory());
    next.events.push(event);
    next.headId = event.id;
  });
  return next;
}

export function eventsAfter(history, eventId) {
  const events = Array.isArray(history?.events) ? history.events : [];
  if (!eventId) return events;
  const index = events.findIndex(event => event.id === eventId);
  return index >= 0 ? events.slice(index + 1) : events;
}

export function latestEvent(history) {
  const events = Array.isArray(history?.events) ? history.events : [];
  return events.find(event => event.id === history?.headId) || events.at(-1) || null;
}

export function compareHistoryChains(localHistory, incomingHistory) {
  const localEvents = Array.isArray(localHistory?.events) ? localHistory.events : [];
  const incomingEvents = Array.isArray(incomingHistory?.events) ? incomingHistory.events : [];
  const localIds = new Set(localEvents.map(event => event.id));
  const incomingIds = new Set(incomingEvents.map(event => event.id));
  let commonId = null;
  for (let index = incomingEvents.length - 1; index >= 0; index -= 1) {
    if (localIds.has(incomingEvents[index].id)) {
      commonId = incomingEvents[index].id;
      break;
    }
  }
  const localAfterCommon = eventsAfter(localHistory, commonId).filter(event => !incomingIds.has(event.id));
  const incomingAfterCommon = eventsAfter(incomingHistory, commonId).filter(event => !localIds.has(event.id));
  const localHead = localHistory?.headId || null;
  const incomingHead = incomingHistory?.headId || null;
  let relation = 'same';
  if (localHead !== incomingHead) {
    if (localIds.has(incomingHead) && !incomingAfterCommon.length) relation = 'localNewer';
    else if (incomingIds.has(localHead) && !localAfterCommon.length) relation = 'incomingNewer';
    else relation = 'divergent';
  }
  return {
    relation,
    commonId,
    localAfterCommon,
    incomingAfterCommon,
    localHead,
    incomingHead
  };
}

export function eventSummary(event) {
  const field = event.field ? ` (${event.field})` : '';
  const author = event.author ? ` · ${event.author}` : '';
  const subject = event.subject?.measureId
    ? ` · Maßnahme ${event.subject.measureId}${event.subject.impactId ? ` / ${event.subject.impactId}` : ''}`
    : '';
  const valueText = event.field
    ? `: ${JSON.stringify(event.oldValue)} → ${JSON.stringify(event.newValue)}`
    : '';
  return `${event.type}${field}${subject}${valueText}${author}`;
}

function valuesEqual(left, right) {
  return stableStringify(left ?? null) === stableStringify(right ?? null);
}

function modelValue(model, key) {
  return model && Object.hasOwn(model, key) ? model[key] : undefined;
}

function diffScalarFields(events, previous, next, fields, type, subject) {
  fields.forEach(field => {
    const oldValue = modelValue(previous, field);
    const newValue = modelValue(next, field);
    if (!valuesEqual(oldValue, newValue)) {
      events.push({ type, subject, field, oldValue, newValue });
    }
  });
}

function diffInputEvents(previous, next) {
  const events = [];
  const previousInputs = previous?.inputs || {};
  const nextInputs = next?.inputs || {};
  const fields = [...new Set([...Object.keys(previousInputs), ...Object.keys(nextInputs)])].sort();
  fields.forEach(field => {
    const oldValue = previousInputs[field];
    const newValue = nextInputs[field];
    if (!valuesEqual(oldValue, newValue)) {
      events.push({
        type: 'inputChanged',
        subject: { scope: 'inputs' },
        field,
        oldValue,
        newValue
      });
    }
  });
  return events;
}

function byId(items = []) {
  return new Map(items.map(item => [String(item.id), item]));
}

function diffImpactEvents(measureId, previousMeasure = {}, nextMeasure = {}) {
  const events = [];
  const previousImpacts = byId(previousMeasure.impactAssumptions || []);
  const nextImpacts = byId(nextMeasure.impactAssumptions || []);
  const ids = [...new Set([...previousImpacts.keys(), ...nextImpacts.keys()])].sort();
  ids.forEach(impactId => {
    const previousImpact = previousImpacts.get(impactId);
    const nextImpact = nextImpacts.get(impactId);
    const subject = { measureId, impactId };
    if (!previousImpact && nextImpact) {
      events.push({ type: 'impactAssumptionAdded', subject, field: 'impactAssumptions', oldValue: null, newValue: nextImpact });
      return;
    }
    if (previousImpact && !nextImpact) {
      events.push({ type: 'impactAssumptionRemoved', subject, field: 'impactAssumptions', oldValue: previousImpact, newValue: null });
      return;
    }
    const fields = [...new Set([...Object.keys(previousImpact || {}), ...Object.keys(nextImpact || {})])]
      .filter(field => field !== 'id')
      .sort();
    fields.forEach(field => {
      const oldValue = previousImpact?.[field];
      const newValue = nextImpact?.[field];
      if (valuesEqual(oldValue, newValue)) return;
      events.push({
        type: field === 'confidence' ? 'assumptionConfidenceChanged' : 'impactAssumptionChanged',
        subject,
        field,
        oldValue,
        newValue
      });
    });
  });
  return events;
}

function diffMeasureEvents(previous, next) {
  const events = [];
  const previousMeasures = byId(previous?.measures || []);
  const nextMeasures = byId(next?.measures || []);
  const ids = [...new Set([...previousMeasures.keys(), ...nextMeasures.keys()])].sort();
  ids.forEach(measureId => {
    const previousMeasure = previousMeasures.get(measureId);
    const nextMeasure = nextMeasures.get(measureId);
    const subject = { measureId };
    if (!previousMeasure && nextMeasure) {
      events.push({ type: 'measureAdded', subject, field: 'measures', oldValue: null, newValue: nextMeasure });
      return;
    }
    if (previousMeasure && !nextMeasure) {
      events.push({ type: 'measureRemoved', subject, field: 'measures', oldValue: previousMeasure, newValue: null });
      return;
    }
    const fields = [...new Set([...Object.keys(previousMeasure || {}), ...Object.keys(nextMeasure || {})])]
      .filter(field => field !== 'id' && field !== 'impactAssumptions')
      .sort();
    fields.forEach(field => {
      const oldValue = previousMeasure?.[field];
      const newValue = nextMeasure?.[field];
      if (valuesEqual(oldValue, newValue)) return;
      events.push({
        type: field === 'active' ? 'measureActivationChanged' : 'measureFieldChanged',
        subject,
        field,
        oldValue,
        newValue
      });
    });
    events.push(...diffImpactEvents(measureId, previousMeasure, nextMeasure));
  });
  return events;
}

export function diffModelEvents(previous, next) {
  if (!previous || !next) return [];
  const events = [
    ...diffInputEvents(previous, next),
    ...diffMeasureEvents(previous, next)
  ];
  diffScalarFields(events, previous, next, ['scenario'], 'scenarioChanged', { scope: 'scenario' });
  diffScalarFields(events, previous, next, ['role'], 'roleChanged', { scope: 'role' });
  if (!valuesEqual(previous.meetingTextOverrides || {}, next.meetingTextOverrides || {})) {
    events.push({
      type: 'meetingTextOverridesChanged',
      subject: { scope: 'meetingTextOverrides' },
      field: 'meetingTextOverrides',
      oldValue: previous.meetingTextOverrides || {},
      newValue: next.meetingTextOverrides || {}
    });
  }
  if (!valuesEqual(previous.process || {}, next.process || {})) {
    events.push({
      type: 'processChanged',
      subject: { scope: 'process' },
      field: 'process',
      oldValue: previous.process || {},
      newValue: next.process || {}
    });
  }
  if (!valuesEqual(previous.clarificationStatus || {}, next.clarificationStatus || {})) {
    events.push({
      type: 'clarificationStatusChanged',
      subject: { scope: 'clarifications' },
      field: 'clarificationStatus',
      oldValue: previous.clarificationStatus || {},
      newValue: next.clarificationStatus || {}
    });
  }
  return events;
}
