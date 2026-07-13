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
    expect(ui).toContain('projectPlanNextReadyTasksByRole');
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
    expect(ui).toContain('Nächste fällige Aufgabe je Rolle');
  });

  it('supports user-owned tasks and skipped template tasks in the UI', () => {
    expect(ui).toContain('data-project-add');
    expect(ui).toContain('data-project-delete');
    expect(ui).toContain('data-project-skip');
    expect(ui).toContain('Eigene Aufgabe wurde ergänzt');
    expect(ui).toContain('Eigene Aufgaben behalten?');
    expect(ui).toContain('template-skipped');
    expect(ui).toContain('project-task-source');
    expect(ui).toContain('updateProjectPlanTaskModel');
    expect(ui).toContain('deleteUserProjectPlanTask');
  });

  it('documents the projectPlan field in the public data format', () => {
    expect(dataFormat).toContain('projectPlan');
    expect(dataFormat).toContain('Meilenstein');
    expect(dataFormat).toContain('Deep-Link');
    expect(dataFormat).toContain('1.1.0');
    expect(dataFormat).toContain('source');
    expect(dataFormat).toContain('templateSkipped');
    expect(dataFormat).toContain('user-');
  });
});
