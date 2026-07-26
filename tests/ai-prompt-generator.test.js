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
      'projectControl',
      'challenge'
    ]);
    expect(promptRoles.find(role => role.id === 'committee')?.title).toContain('Aufsichtsrat');
    expect(promptRoles.find(role => role.id === 'challenge')?.title).toContain('Arbeitsstand hinterfragen');
  });

  it('builds a challenge prompt that asks for prüfpflichtige critique instead of decisions', () => {
    const gasModel = {
      ...demoModel,
      inputs: { ...demoModel.inputs, sector: 'gas' },
      strategy: {
        sampReference: 'Kapitalverzinsungsparameter, H2-/KANU-Ausnahmeabgrenzung sowie methodische Überleitung von Stilllegung, AfA/KANU und EOG-Wirkung bleiben offen.'
      }
    };
    const prompt = buildAiPrompt(gasModel, {
      ...defaultAiPromptOptions,
      roleId: 'challenge',
      dataScope: 'standard',
      includeProjectPlan: true,
      omitNotes: true
    }, { buildInfo: build, ruleset: regulatoryParameterSet });

    expect(prompt).toContain('Arbeitsstand hinterfragen');
    expect(prompt).toContain('Belastbare Aussagen');
    expect(prompt).toContain('Prüfpflichtige Annahmen');
    expect(prompt).toContain('Widersprüche / Unschärfen');
    expect(prompt).toContain('Gas-spezifische Prüfspuren');
    expect(prompt).toContain('Triff keine regulatorische, rechtliche oder bilanzielle Entscheidung');
    expect(prompt).toContain('Stilllegung, Rückbau, Rückstellungen und Ewigkeitsvermutung');
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

  it('deduplicates Strom flexibility and AGNeS defaults in prompt exports', () => {
    const classicMeasures = Array.from({ length: 55 }, (_, index) => ({
      id: `classic-${index + 1}`,
      name: `Klassische CAPEX-Maßnahme ${index + 1}`,
      active: true,
      effectType: 'classic',
      flexibilityStatus: 'context',
      networkScheduleStatus: 'missing',
      avoidedCapexTeur: 0,
      deferredCapexTeur: 0,
      flexOpexPaTeur: 0,
      agnesRelevant: false,
      agnesRole: 'offen',
      year: 2027,
      cost: 10,
      secure: 90,
      uncertain: 0,
      probability: 0,
      life: 20
    }));
    const flexibilityObject = {
      id: 'flex-context-1',
      name: 'Flexibilitätsprüfung Netzfahrplan Demo',
      active: false,
      effectType: 'flexibility',
      flexibilityStatus: 'pruefpflichtig',
      networkScheduleRequired: true,
      networkScheduleStatus: 'missing',
      networkConstraintRef: 'Engpass offen',
      affectedNetworkLevel: 'MS',
      avoidedCapexTeur: 0,
      deferredCapexTeur: 0,
      flexOpexPaTeur: 0,
      agnesRelevant: true,
      agnesRole: 'Netzfahrplan',
      agnesIntegrationStatus: 'not_assessed',
      year: 2027,
      cost: 0,
      life: 1
    };
    const model = {
      ...demoModel,
      measures: [...classicMeasures, flexibilityObject]
    };

    const snapshot = redactModelForPrompt(model, {
      ...defaultAiPromptOptions,
      roleId: 'challenge',
      dataScope: 'standard',
      omitNotes: true
    }, { buildInfo: build, ruleset: regulatoryParameterSet });
    const prompt = buildAiPrompt(model, {
      ...defaultAiPromptOptions,
      roleId: 'challenge',
      dataScope: 'standard',
      omitNotes: true
    }, { buildInfo: build, ruleset: regulatoryParameterSet });

    expect(snapshot.measures).toHaveLength(55);
    expect(snapshot.measures[0]).not.toHaveProperty('agnesRelevant');
    expect(snapshot.measures[0]).not.toHaveProperty('agnesRole');
    expect(snapshot.measures[0]).not.toHaveProperty('flexibilityStatus');
    expect(snapshot.flexibilityObjects).toHaveLength(1);
    expect(snapshot.flexibilityObjects[0].id).toBe('flex-context-1');
    expect(snapshot.flexibilityObjects[0].active).toBe(false);
    expect(snapshot.flexibilityObjects[0].agnesRelevant).toBe(true);
    expect(snapshot.flexibility.klärpunkte).toContain('strom_flexibility_review');
    expect(snapshot.flexibility.agnesSummary).toContain('1 Flexibilitätsobjekt');

    expect(prompt).toContain('## Strom-Flexibilitätsobjekte / Netzfahrplan / AGNeS');
    expect(prompt).toContain('strom_flexibility_review');
    expect((prompt.match(/"agnesRelevant": false/g) || []).length).toBe(0);
    expect((prompt.match(/"agnesRole": "offen"/g) || []).length).toBe(0);
  });
});
