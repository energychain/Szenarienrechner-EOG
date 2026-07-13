import { describe, expect, it } from 'vitest';
import {
  createDefaultProjectPlan,
  findProjectPlanTask,
  normalizeProjectPlan,
  projectPlanDeepLinkForTask,
  projectPlanMilestoneDate,
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
    plan.milestones[3].tasks[2].status = 'done';
    plan.milestones[3].tasks[2].note = 'Aktivierbarkeit durch Anlagenbuchhaltung belegt.';

    const normalized = normalizeProjectPlan(plan, 2028);
    const found = findProjectPlanTask(normalized, 'm3-t3');

    expect(found.task.status).toBe('done');
    expect(found.task.note).toContain('Aktivierbarkeit');
    expect(projectPlanTaskCounts(normalized).completed).toBe(1);
  });

  it('derives dates from baseYear and app deep links from story keys', () => {
    const plan = createDefaultProjectPlan(2027);
    const found = findProjectPlanTask(plan, 'm7-t6');

    expect(projectPlanMilestoneDate(plan.baseYear, found.milestone.plannedOffsetMonths, found.task.dueOffsetDays)).toBe('2027-07-24');
    expect(projectPlanDeepLinkForTask(found.task)).toContain('?story=gremium');
  });
});
