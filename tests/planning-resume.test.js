import { describe, expect, it } from 'vitest';
import {
  buildPlanningResume,
  normalizePlanningResume,
  shouldShowPlanningResume
} from '../src/planning-resume.js';

describe('planning resume', () => {
  it('normalizes a reusable status note and next coordination step without leaking unknown fields', () => {
    const resume = normalizePlanningResume({
      statusNote: 'Kostenpfad mit Technik vorbewertet',
      nextStep: 'Regulatorische Anerkennung mit Controlling abstimmen',
      owner: 'Planung',
      dueDate: '2026-07-20',
      updatedAt: '2026-07-12T10:00:00.000Z',
      ignored: 'not exported'
    });

    expect(resume).toEqual({
      statusNote: 'Kostenpfad mit Technik vorbewertet',
      nextStep: 'Regulatorische Anerkennung mit Controlling abstimmen',
      owner: 'Planung',
      dueDate: '2026-07-20',
      updatedAt: '2026-07-12T10:00:00.000Z'
    });
  });

  it('builds a compact re-entry summary from phase, maturity and next step', () => {
    const summary = buildPlanningResume({
      phaseLabel: 'Konsolidierung',
      resume: normalizePlanningResume({
        statusNote: 'Drei Maßnahmen im Basisszenario, Risikoannahmen noch offen.',
        nextStep: 'Risikoannahmen mit Betrieb und Controlling freigeben.',
        owner: 'Fachrunde',
        dueDate: '2026-07-20'
      }),
      maturity: { score: 68, blockers: 2 },
      openClarifications: 2,
      reviewCount: 4
    });

    expect(summary.headline).toBe('Stand: Konsolidierung · 68 % Entscheidungsreife');
    expect(summary.status).toBe('Drei Maßnahmen im Basisszenario, Risikoannahmen noch offen.');
    expect(summary.next).toBe('Nächster Schritt: Risikoannahmen mit Betrieb und Controlling freigeben. · Zuständig: Fachrunde · fällig 20.07.');
    expect(summary.risks).toBe('2 offene Klärpunkte · 4 prüfpflichtige Wirkannahmen');
  });

  it('shows the resume when either status or next step is maintained', () => {
    expect(shouldShowPlanningResume(normalizePlanningResume({}))).toBe(false);
    expect(shouldShowPlanningResume(normalizePlanningResume({ nextStep: 'Termin klären' }))).toBe(true);
    expect(shouldShowPlanningResume(normalizePlanningResume({ statusNote: 'Arbeitsstand gesichert' }))).toBe(true);
  });
});
