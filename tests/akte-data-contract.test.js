// @vitest-environment jsdom
//
// Stufe 7, Kriterium 2: "Referenz-JSON laden → exportieren → verlustfreier
// Vergleich, in beide Richtungen zwischen beiden Oberflächen (7.1)."
//
// Zulässige Abweichungen (Spezifikation 7.1/7.2): savedAt, buildTime,
// buildCommit, sowie model.ui2 (schreibt nur die neue Oberfläche) und die
// additiven Schlüssel model.openDecisions/model.provisionalIds (existieren
// im Referenzexport nicht, sind aber additiv und werden von der alten
// Oberfläche unverändert durchgereicht, siehe 7.2/7.3). Alles andere muss
// nach Normalisierung der Schlüsselreihenfolge exakt übereinstimmen.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const referenceModel = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/reference-model.json'), 'utf8')
);

async function loadOldUiWithState(state) {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
  document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  if (!window.CSS) /** @type {any} */ (window).CSS = {};
  if (!window.CSS.escape) {
    window.CSS.escape = value => String(value).replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`);
  }
  const embedded = document.createElement('script');
  embedded.type = 'application/json';
  embedded.id = 'embedded-model-state';
  embedded.textContent = JSON.stringify(state);
  document.body.appendChild(embedded);

  vi.resetModules();
  const uiModulePath = '../src/ui.js';
  await import(uiModulePath);
  return /** @type {any} */ (window).__akteDebug;
}

async function loadNewUiWithState(state) {
  const html = readFileSync(resolve(__dirname, '../akte.html'), 'utf8');
  document.documentElement.innerHTML = html.replace(/^[\s\S]*<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
  localStorage.clear();
  localStorage.setItem('regulierte-sparten-szenario-rechner-akte-v1', JSON.stringify(state));

  vi.resetModules();
  const mainModulePath = '../src/main-akte.js';
  await import(mainModulePath);
  return /** @type {any} */ (window).__akte2Debug;
}

// Normalisiert einen exportierten Zustand für den Vergleich: erlaubte
// Abweichungen (Build-/Zeitmetadaten, UI-Zustand der neuen Oberfläche,
// additive Schlüssel) werden entfernt, alles andere bleibt unverändert
// stehen und muss danach deepEqual sein.
function normalizeForComparison(state) {
  const clone = structuredClone(state);
  delete clone.savedAt;
  delete clone.buildTime;
  delete clone.buildCommit;
  if (clone.model) {
    delete clone.model.ui2;
    // openDecisions/provisionalIds sind additiv (Spezifikation 7.3): leer
    // gilt als "nicht vorhanden", damit ein Referenzexport ohne diese
    // Schlüssel gegen einen frischen Export mit leeren Objekten bestehen kann.
    if (clone.model.openDecisions && Object.keys(clone.model.openDecisions).length === 0) delete clone.model.openDecisions;
    if (clone.model.provisionalIds) {
      const allEmpty = Object.values(clone.model.provisionalIds).every(list => Array.isArray(list) && list.length === 0);
      if (allEmpty) delete clone.model.provisionalIds;
    }
  }
  return clone;
}

describe('Kriterium 2: Referenz-JSON → neue UI laden → unverändert exportieren → Vergleich', () => {
  it('round-trips the reference model through main-akte.js without any loss', async () => {
    const debug = await loadNewUiWithState(referenceModel);
    const exported = debug.collectModelState();

    expect(normalizeForComparison(exported)).toEqual(normalizeForComparison(referenceModel));
  });

  it('preserves UI-state fields the new UI does not manage, unread and unwritten (Spezifikation 7.2)', async () => {
    const debug = await loadNewUiWithState(referenceModel);
    const exported = debug.collectModelState();

    ['activeView', 'reportMode', 'meetingFocus', 'scenario', 'selectedId', 'role', 'catalogGroupBy', 'resultViewMode', 'activeProjectTaskId', 'selectedSidecarId'].forEach(key => {
      expect(exported.model[key]).toEqual(referenceModel.model[key]);
    });
    // projectPlan/importMapping/meetingTextOverrides/model.lastReleaseCheck sind
    // ebenfalls unverwaltete Modellfelder und müssen unangetastet bleiben.
    expect(exported.model.projectPlan).toEqual(referenceModel.model.projectPlan);
    expect(exported.model.importMapping).toEqual(referenceModel.model.importMapping);
    expect(exported.model.meetingTextOverrides).toEqual(referenceModel.model.meetingTextOverrides);
  });

  it('preserves envelope fields outside model untouched (regulatoryParameterSetId etc.)', async () => {
    const debug = await loadNewUiWithState(referenceModel);
    const exported = debug.collectModelState();

    ['regulatoryParameterSetId', 'regulatoryParameterEffectiveMonth', 'regulatoryParameterConfidence', 'regulatoryParameterSourceRef', 'lastReleaseCheck'].forEach(key => {
      expect(exported[key]).toEqual(referenceModel[key]);
    });
  });

  it('writes its own UI state only under model.ui2, never touching the legacy keys', async () => {
    const debug = await loadNewUiWithState(referenceModel);
    debug.setFilterKey('active');
    const exported = debug.collectModelState();

    expect(exported.model.ui2).toBeTruthy();
    expect(exported.model.activeView).toBe(referenceModel.model.activeView);
    expect(exported.model.selectedId).toBe(referenceModel.model.selectedId);
  });
});

describe('Kriterium 2: beide Richtungen zwischen beiden Oberflächen', () => {
  // Jeder dieser Tests lädt ui.js und/oder main-akte.js mehrfach frisch (nicht
  // in einem gemeinsamen beforeAll); jeder Import verkabelt den vollständigen
  // DOM und dauert mehrere Sekunden, siehe tests/akte-parity.test.js.
  it('an export from the new UI is fully readable by the old UI (same KPIs as the original)', { timeout: 20000 }, async () => {
    const newDebug = await loadNewUiWithState(referenceModel);
    const exportedFromNew = newDebug.collectModelState();

    const oldDebugOriginal = await loadOldUiWithState(referenceModel);
    const originalPortfolio = oldDebugOriginal.currentPortfolio();

    const oldDebugFromNew = await loadOldUiWithState(exportedFromNew);
    const portfolioFromNewExport = oldDebugFromNew.currentPortfolio();

    expect(portfolioFromNewExport.irr).toBeCloseTo(originalPortfolio.irr, 9);
    expect(portfolioFromNewExport.npv).toBeCloseTo(originalPortfolio.npv, 6);
    expect(portfolioFromNewExport.yearly.length).toBe(originalPortfolio.yearly.length);
  });

  it('round-trips old UI -> new UI -> old UI without loss (arbitrarily repeatable)', { timeout: 20000 }, async () => {
    const oldDebug = await loadOldUiWithState(referenceModel);
    const exportedFromOld = oldDebug.collectModelState();

    const newDebug = await loadNewUiWithState(exportedFromOld);
    const exportedFromNew = newDebug.collectModelState();

    const oldDebugAgain = await loadOldUiWithState(exportedFromNew);
    const finalExport = oldDebugAgain.collectModelState();

    expect(normalizeForComparison(finalExport)).toEqual(normalizeForComparison(exportedFromOld));
  });

  it('a history chain started in the old UI and continued in the new UI stays one chain (compareHistoryChains)', { timeout: 20000 }, async () => {
    const oldDebug = await loadOldUiWithState(referenceModel);
    const exportedFromOld = oldDebug.collectModelState();
    expect(exportedFromOld.history.headId).toBeTruthy();

    const newDebug = await loadNewUiWithState(exportedFromOld);
    const measure = newDebug.getModel().measures[0];
    measure.name = `${measure.name} (Stufe 7 Test)`;
    newDebug.saveNow(); // triggers diffModelEvents + appendHistoryEvents, same as any popover save
    const historyFromNew = newDebug.getHistory();

    expect(historyFromNew.headId).toBeTruthy();
    expect(historyFromNew.headId).not.toBe(exportedFromOld.history.headId);
    // every event from the old UI's chain must still be present — the new
    // UI's edit continues the same chain instead of starting a new one.
    const oldEventIds = new Set(exportedFromOld.history.events.map(event => event.id));
    const newEventIds = new Set(historyFromNew.events.map(event => event.id));
    oldEventIds.forEach(id => expect(newEventIds.has(id)).toBe(true));
    expect(historyFromNew.events.length).toBeGreaterThan(exportedFromOld.history.events.length);
  });
});
