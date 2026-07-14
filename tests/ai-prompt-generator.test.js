import { describe, expect, it } from 'vitest';
import { buildAiPrompt, defaultAiPromptOptions, promptRoles, redactModelForPrompt } from '../src/ai-prompt-generator.js';
import { demoMeasures } from '../src/demo-data.js';
import { regulatoryParameterSet } from '../src/engine.js';

const demoModel = {
  inputs: {
    sector: 'strom',
    baseYear: '2027',
    baseEog: '18200',
    rab: '42000',
    returnRate: '5',
    financingRate: '5',
    discountRate: '5',
    annualEnergyGwh: '120',
    householdConsumptionKwh: '3500',
    capexLagYears: '0',
    opexLagYears: '3',
    qeLagYears: '2'
  },
  measures: demoMeasures,
  scenario: 'basis',
  process: { phase: 'massnahmenbewertung', statusNote: 'Review-Annahmen prüfen', nextStep: 'Gremienvorlage vorbereiten' },
  projectPlan: {
    milestones: [{ id: 'm0', storyKey: 'kickoff', title: 'Kick-off', tasks: [
      { id: 'm0-t1', title: 'Entscheidungszweck festlegen', ownerRole: 'modellverantwortung', status: 'done', source: 'template' },
      { id: 'user-demo', title: 'Interne Freigabe Controlling', ownerRole: 'controlling', status: 'open', source: 'user', note: 'Budgetrunde intern' }
    ] }]
  }
};

const build = { buildCommit: 'abc123def456', buildTime: '2026-07-13T12:00:00Z' };

describe('AI prompt generator', () => {
  it('defines role-specific templates for the approved first release roles', () => {
    expect(promptRoles.map(role => role.id)).toEqual([
      'committee',
      'management',
      'controlling',
      'regulation',
      'assetManagement',
      'accounting',
      'projectControl'
    ]);
    expect(promptRoles.find(role => role.id === 'committee')?.title).toContain('Aufsichtsrat');
  });

  it('builds a committee prompt with llm.txt context, provenance and governance caveats', () => {
    const prompt = buildAiPrompt(demoModel, {
      ...defaultAiPromptOptions,
      roleId: 'committee',
      detailLevel: 'standard',
      dataScope: 'standard',
      includeProjectPlan: true,
      omitNotes: true,
      roundAmounts: true
    }, { buildInfo: build, ruleset: regulatoryParameterSet });

    expect(prompt).toContain('https://energychain.github.io/Szenarienrechner-EOG/llm.txt');
    expect(prompt).toContain('Aufsichtsrat / Stadtrat / Gremium');
    expect(prompt).toContain('Build-Commit: abc123def456');
    expect(prompt).toContain('Regulierungsstand: regulatory-parameters-2026-07');
    expect(prompt).toContain('EOG-Wirkung ist nicht gleich Cashflow');
    expect(prompt).toContain('Basis vs. konservativ');
    expect(prompt).toContain('Diese App sendet nichts an eine KI');
    expect(prompt).toContain('Interne Freigabe Controlling');
    expect(prompt).not.toContain('Budgetrunde intern');
  });

  it('redacts measure names and rounds values when requested', () => {
    const redacted = redactModelForPrompt(demoModel, {
      ...defaultAiPromptOptions,
      anonymizeMeasures: true,
      roundAmounts: true,
      omitNotes: true,
      dataScope: 'standard'
    }, { buildInfo: build, ruleset: regulatoryParameterSet });

    expect(redacted.measures[0].name).toBe('Maßnahme 1');
    expect(JSON.stringify(redacted)).not.toContain('Netzautomatisierung Demogebiet Alpha');
    expect(JSON.stringify(redacted)).not.toContain('Budgetrunde intern');
  });

  it('can generate a compact PMO prompt without measure detail', () => {
    const prompt = buildAiPrompt(demoModel, {
      ...defaultAiPromptOptions,
      roleId: 'projectControl',
      dataScope: 'summary',
      includeProjectPlan: true
    }, { buildInfo: build, ruleset: regulatoryParameterSet });

    expect(prompt).toContain('Projektsteuerung / PMO');
    expect(prompt).toContain('nächste Schritte');
    expect(prompt).not.toContain('Netzautomatisierung Demogebiet Alpha');
  });
});
