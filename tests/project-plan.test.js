import { describe, expect, it } from 'vitest';
import {
  addUserProjectPlanTask,
  createDefaultProjectPlan,
  deleteUserProjectPlanTask,
  findProjectPlanTask,
  normalizeProjectPlan,
  projectPlanDeepLinkForTask,
  projectPlanEffectiveTaskStates,
  projectPlanMilestoneDate,
  projectPlanNextReadyTask,
  projectPlanNextReadyTasksByRole,
  projectPlanRoles,
  projectPlanSchemaVersion,
  projectPlanTaskCounts,
  projectPlanWouldCreateCycle,
  resetProjectPlanTemplateState,
  updateProjectPlanTask
} from '../src/project-plan.js';

function allTasks(plan) {
  return plan.milestones.flatMap(milestone => milestone.tasks);
}

describe('project plan', () => {
  it('seeds nine story milestones with role-owned tasks and deep links', () => {
    const plan = createDefaultProjectPlan(2027);

    expect(plan.milestones).toHaveLength(9);
    expect(plan.milestones.map(item => item.storyKey)).toEqual([
      'kickoff',
      'initialisierung',
      'datenerhebung',
      'massnahmenbewertung',
      'technik-rueckkopplung',
      'konsolidierung',
      'entscheidungsvorlage',
      'gremium',
      'archiv'
    ]);
    expect(allTasks(plan).length).toBeGreaterThan(55);
    expect(new Set(allTasks(plan).map(task => task.ownerRole)).size).toBeGreaterThan(5);
    expect(allTasks(plan).every(task => task.deepLinkKey && Object.hasOwn(projectPlanRoles, task.ownerRole))).toBe(true);
  });

  it('keeps task status and notes during model normalization', () => {
    const plan = createDefaultProjectPlan(2027);
    plan.milestones[3].tasks[0].status = 'done';
    plan.milestones[3].tasks[2].status = 'done';
    plan.milestones[3].tasks[2].note = 'Aktivierbarkeit durch Anlagenbuchhaltung belegt.';

    const normalized = normalizeProjectPlan(plan, 2028);
    const found = findProjectPlanTask(normalized, 'm3-t3');

    expect(found.task.status).toBe('done');
    expect(found.task.note).toContain('Aktivierbarkeit');
  });

  it('derives dates from baseYear and app deep links from story keys', () => {
    const plan = createDefaultProjectPlan(2027);
    const found = findProjectPlanTask(plan, 'm7-t6');

    expect(projectPlanMilestoneDate(plan.baseYear, found.milestone.plannedOffsetMonths, found.task.dueOffsetDays)).toBe('2027-07-24');
    expect(projectPlanDeepLinkForTask(found.task)).toContain('?story=gremium');
  });

  it('derives dependency-blocked states without overwriting stored task status', () => {
    const plan = createDefaultProjectPlan(2027);
    const states = projectPlanEffectiveTaskStates(plan);

    expect(findProjectPlanTask(plan, 'm3-t1').task.status).toBe('open');
    expect(states['m3-t1'].effectiveStatus).toBe('blocked');
    expect(states['m3-t1'].dependencyBlocked).toBe(true);
    expect(states['m3-t1'].missingDependencies).toEqual(['m2-t7']);
    expect(projectPlanTaskCounts(plan).byStatus.blocked).toBeGreaterThan(0);
  });

  it('unblocks cross-milestone successors when their predecessors are done', () => {
    const plan = createDefaultProjectPlan(2027);
    for (const id of ['m0-t1', 'm0-t2', 'm0-t5', 'm0-t7', 'm1-t8', 'm2-t5', 'm2-t7']) {
      findProjectPlanTask(plan, id).task.status = 'done';
    }

    const states = projectPlanEffectiveTaskStates(plan);

    expect(states['m3-t1'].dependencyBlocked).toBe(false);
    expect(states['m3-t1'].effectiveStatus).toBe('open');
    expect(projectPlanNextReadyTask(plan).task.id).toBe('m0-t3');
  });

  it('derives the next due ready task for each role without blocked successors', () => {
    const plan = createDefaultProjectPlan(2027);
    findProjectPlanTask(plan, 'm0-t1').task.status = 'done';
    findProjectPlanTask(plan, 'm1-t6').task.status = 'done';

    const byRole = projectPlanNextReadyTasksByRole(plan);

    expect(byRole.modellverantwortung.task.id).toBe('m0-t2');
    expect(byRole.controlling.task.id).toBe('m0-t4');
    expect(byRole.regulierungsmanagement.task.id).toBe('m1-t4');
    expect(byRole.bilanzierung.task.id).toBe('m1-t5');
    expect(byRole.assetmanagement).toBeNull();
    expect(byRole.modellverantwortung.dueDate).toBe('2027-01-02');
  });

  it('normalizes older plans as template tasks and uses schema version 1.1.0', () => {
    const plan = createDefaultProjectPlan(2027);
    const legacy = structuredClone(plan);
    delete legacy.schemaVersion;
    delete legacy.milestones[0].tasks[0].source;

    const normalized = normalizeProjectPlan(legacy, 2027);

    expect(normalized.schemaVersion).toBe(projectPlanSchemaVersion);
    expect(projectPlanSchemaVersion).toBe('1.1.0');
    expect(findProjectPlanTask(normalized, 'm0-t1').task.source).toBe('template');
  });

  it('adds, normalizes and round-trips user tasks with stable user IDs', () => {
    let plan = createDefaultProjectPlan(2027);
    plan = addUserProjectPlanTask(plan, 'm3', {
      id: 'user-m3-review',
      title: 'Techniktermin nachfassen',
      ownerRole: 'assetmanagement',
      dueOffsetDays: 26,
      targetView: 'measures',
      deepLinkKey: 'massnahmenbewertung',
      evidenceRequired: 'quelle',
      origin: 'aus Techniktermin 04/2027'
    });

    const userTask = findProjectPlanTask(plan, 'user-m3-review').task;
    expect(userTask.source).toBe('user');
    expect(userTask.id).toMatch(/^user-/);
    expect(userTask.origin).toContain('Techniktermin');

    const roundTrip = normalizeProjectPlan(plan, 2027);
    expect(findProjectPlanTask(roundTrip, 'user-m3-review').task.source).toBe('user');
    expect(allTasks(roundTrip)).toHaveLength(allTasks(createDefaultProjectPlan(2027)).length + 1);
  });

  it('allows full user-task edits but limits template edits to status, note, skip and owner', () => {
    let plan = addUserProjectPlanTask(createDefaultProjectPlan(2027), 'm3', { id: 'user-edit', title: 'Alt', ownerRole: 'controlling' });
    plan = updateProjectPlanTask(plan, 'user-edit', {
      title: 'Neu',
      ownerRole: 'regulierungsmanagement',
      dueOffsetDays: 31,
      deepLinkKey: 'gremium',
      targetView: 'report',
      dependsOn: ['m3-t1'],
      resultArtifact: 'ergänzter Prüfvermerk'
    });
    plan = updateProjectPlanTask(plan, 'm3-t1', { title: 'Nicht ändern', status: 'done', templateSkipped: true, note: 'bewusst übersprungen' });

    expect(findProjectPlanTask(plan, 'user-edit').task.title).toBe('Neu');
    expect(findProjectPlanTask(plan, 'user-edit').task.targetView).toBe('report');
    expect(findProjectPlanTask(plan, 'm3-t1').task.title).toContain('Maßnahmenkatalog');
    expect(findProjectPlanTask(plan, 'm3-t1').task.status).toBe('done');
    expect(findProjectPlanTask(plan, 'm3-t1').task.templateSkipped).toBe(true);
  });

  it('removes user tasks without leaving dangling dependencies', () => {
    let plan = addUserProjectPlanTask(createDefaultProjectPlan(2027), 'm3', { id: 'user-source', title: 'Quelle prüfen' });
    plan = addUserProjectPlanTask(plan, 'm3', { id: 'user-dependent', title: 'Folgeschritt', dependsOn: ['user-source'] });

    plan = deleteUserProjectPlanTask(plan, 'user-source');

    expect(findProjectPlanTask(plan, 'user-source')).toBeNull();
    expect(findProjectPlanTask(plan, 'user-dependent').task.dependsOn).toEqual([]);
  });

  it('prevents dependency cycles and treats skipped template predecessors as non-blocking', () => {
    let plan = addUserProjectPlanTask(createDefaultProjectPlan(2027), 'm0', { id: 'user-a', title: 'Zusatz A' });
    plan = addUserProjectPlanTask(plan, 'm0', { id: 'user-b', title: 'Zusatz B', dependsOn: ['user-a'] });
    expect(projectPlanWouldCreateCycle(plan, 'user-a', ['user-b'])).toBe(true);
    expect(() => updateProjectPlanTask(plan, 'user-a', { dependsOn: ['user-b'] })).toThrow(/Zyklus/);
    plan = updateProjectPlanTask(plan, 'm0-t1', { templateSkipped: true });

    const states = projectPlanEffectiveTaskStates(plan);
    expect(states['m0-t2'].dependencyBlocked).toBe(false);
  });

  it('excludes skipped template tasks from progress and preserves or removes user tasks on reset', () => {
    let plan = addUserProjectPlanTask(createDefaultProjectPlan(2027), 'm3', { id: 'user-reset', title: 'Eigener Prüfpunkt' });
    plan = updateProjectPlanTask(plan, 'm0-t1', { templateSkipped: true });

    expect(projectPlanTaskCounts(plan).total).toBe(allTasks(createDefaultProjectPlan(2027)).length);

    const kept = resetProjectPlanTemplateState(plan, { keepUserTasks: true, baseYear: 2027 });
    expect(findProjectPlanTask(kept, 'user-reset')).not.toBeNull();
    expect(findProjectPlanTask(kept, 'm0-t1').task.templateSkipped).toBe(false);

    const removed = resetProjectPlanTemplateState(plan, { keepUserTasks: false, baseYear: 2027 });
    expect(findProjectPlanTask(removed, 'user-reset')).toBeNull();
  });
});
