import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dataFormat = readFileSync(new URL('../DATA_FORMAT.md', import.meta.url), 'utf8');

describe('project plan UI integration', () => {
  it('adds a persistent project plan view to the app shell', () => {
    expect(html).toContain('data-view="projectPlan"');
    expect(html).toContain('data-view-panel="projectPlan"');
    expect(html).toContain('projectPlanBody');
    expect(ui).toContain('renderProjectPlan');
    expect(ui).toContain('renderProjectRoleSwimlanes');
    expect(ui).toContain('projectPlanEffectiveTaskStates');
    expect(ui).toContain('projectPlanNextReadyTask');
    expect(ui).toContain('activeProjectTaskId');
  });

  it('stores the project plan in JSON/HTML model exports and restores it on import', () => {
    expect(ui).toContain('projectPlan: structuredClone(projectPlan)');
    expect(ui).toContain('projectPlan = normalizeProjectPlan(model.projectPlan');
    expect(ui).toContain('activeProjectTaskId = findProjectPlanTask(projectPlan');
  });

  it('blocks task progression in the UI while dependencies are incomplete', () => {
    expect(ui).toContain('dependencyBlocked');
    expect(ui).toContain('Vorgängeraufgaben zuerst erledigen');
    expect(ui).toContain('Aufgabe ist blockiert: Vorgängeraufgaben zuerst erledigen.');
    expect(ui).toContain('Nächste fällige Aufgabe');
  });

  it('documents the projectPlan field in the public data format', () => {
    expect(dataFormat).toContain('projectPlan');
    expect(dataFormat).toContain('Meilenstein');
    expect(dataFormat).toContain('Deep-Link');
  });
});
