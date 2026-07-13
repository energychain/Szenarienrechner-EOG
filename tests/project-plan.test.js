import { describe, expect, it } from 'vitest';
import {
  createDefaultProjectPlan,
  findProjectPlanTask,
  normalizeProjectPlan,
  projectPlanDeepLinkForTask,
  projectPlanEffectiveTaskStates,
  projectPlanMilestoneDate,
  projectPlanNextReadyTask,
  projectPlanNextReadyTasksByRole,
  projectPlanRoles,
  projectPlanTaskCounts
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
});
