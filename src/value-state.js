// Wertherkunft und Lückenklassifikation für die "digitale Akte" (Spezifikation
// Abschnitt 6). Jedes Feld trägt genau einen von vier Zuständen — set,
// default, derived, openByDecision — und jede Lücke fällt in eine von vier
// Lückenarten (fehlender Wert, fehlende Evidenz, fehlendes Objekt, fehlende
// Kante). Dieses Modul liest nur, was ihm übergeben wird: kein DOM-Zugriff,
// kein Modulzustand, keine Seiteneffekte.
//
// Herkunftsheuristik (Abschnitt 6.1): Die Herkunft eines Werts wird nicht im
// Modell dupliziert, sondern abgeleitet —
//   1. openByDecision hat Vorrang, wenn eine Begründung unter
//      model.openDecisions[objectId][fieldKey] hinterlegt ist (die einzige
//      Ausnahme, die tatsächlich persistiert wird, siehe Spezifikation 7.2).
//   2. derived, wenn eine feldspezifische Ableitungsregel greift (aktuell nur
//      measure.viabilityCategory über classifyMeasureViability).
//   3. set, wenn history.js ein Änderungsereignis für genau dieses Feld
//      kennt. history.js protokolliert Maßnahmen- und Inputfelder je Feld,
//      Strategie/Ziele und Befassung dagegen nur objektweise und Kontext-
//      objekte/Quellen aktuell gar nicht (diffModelEvents diff't sidecar
//      nicht) — für diese Objekttypen liefert dieser Schritt daher nie einen
//      Treffer und die Herkunft fällt auf Schritt 4 zurück.
//   4. Vergleich mit der Vorbelegung aus dem Felddeskriptor: Gleichheit (oder
//      ein leerer Wert ohne definierte Vorbelegung) ergibt default, jede
//      Abweichung ergibt set.
import { fieldDescriptor, fieldDescriptorsFor } from './field-registry.js';
import { classifyMeasureViability } from './viability-classification.js';

export const VALUE_STATES = ['set', 'default', 'derived', 'openByDecision'];

function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// ---------------------------------------------------------------------------
// Schritt 1: bewusst offen gelassen (persistiert, siehe Spezifikation 7.2)
// ---------------------------------------------------------------------------

export function openDecisionFor(openDecisions, objectId, key) {
  const decision = openDecisions?.[objectId]?.[key];
  return decision && typeof decision === 'object' ? decision : null;
}

// ---------------------------------------------------------------------------
// Schritt 2: abgeleitet
// ---------------------------------------------------------------------------

const derivedCheckers = {
  measure: {
    viabilityCategory: measure => classifyMeasureViability(measure || {}).source === 'derived'
  }
};

export function isDerivedValue(objectType, key, object) {
  return Boolean(derivedCheckers[objectType]?.[key]?.(object));
}

// ---------------------------------------------------------------------------
// Schritt 3: aus history.js abgeleitete Nutzereingabe
// ---------------------------------------------------------------------------

export function historyIndicatesChange(history, objectType, objectId, key) {
  const events = Array.isArray(history?.events) ? history.events : [];
  if (!events.length) return false;
  if (objectType === 'measure') {
    return events.some(event => event.subject?.measureId === objectId && !event.subject?.impactId && event.field === key);
  }
  if (objectType === 'impactAssumption') {
    const [measureId, impactId] = String(objectId).split(':');
    return events.some(event => event.subject?.measureId === measureId && event.subject?.impactId === impactId && event.field === key);
  }
  if (objectType === 'input') {
    return events.some(event => event.subject?.scope === 'inputs' && event.field === key);
  }
  if (objectType === 'committee') {
    return events.some(event => event.subject?.scope === 'committee');
  }
  if (objectType === 'objective') {
    // strategy.objectives[] is only diffed as a whole (subject.scope === 'strategy'):
    // history can confirm "something in strategy changed", not which objective/field.
    return events.some(event => event.subject?.scope === 'strategy');
  }
  // sidecarObject / sidecarSource / sidecarBridgeLogic: diffModelEvents does not
  // diff sidecar today, so there is no history signal at any granularity yet.
  return false;
}

// ---------------------------------------------------------------------------
// Zusammengesetzter Zustand
// ---------------------------------------------------------------------------

/**
 * @param {string} objectType one of the field-registry object types
 * @param {string} key field key within that object type
 * @param {*} value current value of the field
 * @param {{ object?: object, objectId?: string, history?: object, openDecisions?: object }} context
 */
export function valueState(objectType, key, value, context = {}) {
  const { object = {}, objectId = '', history = null, openDecisions = null } = context;

  const decision = openDecisionFor(openDecisions, objectId, key);
  if (decision) {
    return {
      state: 'openByDecision',
      reason: decision.reason || '',
      author: decision.author || '',
      timestamp: decision.timestamp || ''
    };
  }

  if (isDerivedValue(objectType, key, object)) {
    return { state: 'derived' };
  }

  if (historyIndicatesChange(history, objectType, objectId, key)) {
    return { state: 'set' };
  }

  const descriptor = fieldDescriptor(objectType, key);
  const hasDefault = Boolean(descriptor) && Object.hasOwn(descriptor, 'default') && descriptor.default !== undefined;
  if (hasDefault ? sameValue(value, descriptor.default) : isEmptyValue(value)) {
    return { state: 'default' };
  }

  return { state: 'set' };
}

// ---------------------------------------------------------------------------
// Lückenart 1: fehlender Wert
// ---------------------------------------------------------------------------

export function missingValueFields(objectType, object, context = {}) {
  return fieldDescriptorsFor(objectType)
    .filter(descriptor => !descriptor.appliesWhen || descriptor.appliesWhen(object))
    .map(descriptor => ({ key: descriptor.key, ...valueState(objectType, descriptor.key, object?.[descriptor.key], { ...context, object }) }))
    .filter(entry => entry.state === 'default');
}

// ---------------------------------------------------------------------------
// Lückenart 2: fehlende Evidenz
// ---------------------------------------------------------------------------

function isTrivialClaim(value) {
  return isEmptyValue(value) || value === 0 || value === false;
}

export function evidenceGapFor(objectType, key, object) {
  const descriptor = fieldDescriptor(objectType, key);
  if (!descriptor?.evidenceKey) return null;
  // A value of 0/''/[]/false makes no claim yet — that's Lückenart 1
  // (fehlender Wert), not Lückenart 2 (fehlende Evidenz für einen
  // vorhandenen Wert).
  if (isTrivialClaim(object?.[key])) return null;
  const evidenceDescriptor = fieldDescriptor(objectType, descriptor.evidenceKey);
  const evidenceValue = object?.[descriptor.evidenceKey];
  const weak = evidenceDescriptor?.clarificationOn
    ? Boolean(evidenceDescriptor.clarificationOn(evidenceValue))
    : isEmptyValue(evidenceValue);
  if (!weak) return null;
  return { key, evidenceKey: descriptor.evidenceKey, evidenceValue: evidenceValue ?? '' };
}

export function evidenceGaps(objectType, object) {
  return fieldDescriptorsFor(objectType)
    .filter(descriptor => descriptor.evidenceKey && (!descriptor.appliesWhen || descriptor.appliesWhen(object)))
    .map(descriptor => evidenceGapFor(objectType, descriptor.key, object))
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Lückenart 3: fehlendes Objekt (referenzierte Objekt-ID existiert nicht)
// ---------------------------------------------------------------------------

const referenceTargets = {
  measure: {
    objectiveIds: { targetType: 'objective', multi: true },
    bottleneckRef: { targetType: 'sidecarObject', multi: false },
    networkConstraintRef: { targetType: 'sidecarObject', multi: false }
  },
  sidecarObject: {
    sourceRefs: { targetType: 'sidecarSource', multi: true },
    linkedMeasures: { targetType: 'measure', multi: true }
  }
};

export function referenceFieldsFor(objectType) {
  return referenceTargets[objectType] || {};
}

/**
 * @param {string} objectType
 * @param {object} object
 * @param {Record<string, Set<string>>} knownIdsByType e.g. { objective: Set, sidecarObject: Set, measure: Set }
 */
export function missingObjectGaps(objectType, object, knownIdsByType = {}) {
  const targets = referenceFieldsFor(objectType);
  const gaps = [];
  Object.entries(targets).forEach(([key, target]) => {
    const raw = object?.[key];
    const ids = target.multi ? (Array.isArray(raw) ? raw : []) : (raw ? [raw] : []);
    const knownIds = knownIdsByType[target.targetType] || new Set();
    ids.filter(Boolean).forEach(id => {
      if (!knownIds.has(id)) gaps.push({ key, targetType: target.targetType, targetId: id });
    });
  });
  return gaps;
}

// ---------------------------------------------------------------------------
// Lückenart 4: fehlende Kante (beide Objekte existieren, Beziehung fehlt)
// ---------------------------------------------------------------------------

export function suggestedEdges(model = {}) {
  const measures = Array.isArray(model.measures) ? model.measures : [];
  const activeWithoutObjective = measures.filter(measure => measure.active && !(measure.objectiveIds || []).length);
  const edges = [];
  if (activeWithoutObjective.length) {
    edges.push({
      type: 'measure-objective',
      count: activeWithoutObjective.length,
      measureIds: activeWithoutObjective.map(measure => measure.id),
      label: `${activeWithoutObjective.length} aktive Maßnahme(n) ohne Ziel-Zuordnung`
    });
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Zusammenfassung je Objekt
// ---------------------------------------------------------------------------

export function gapsFor(objectType, object, context = {}) {
  return {
    missingValues: missingValueFields(objectType, object, context),
    missingEvidence: evidenceGaps(objectType, object),
    missingObjects: missingObjectGaps(objectType, object, context.knownIdsByType || {})
  };
}
