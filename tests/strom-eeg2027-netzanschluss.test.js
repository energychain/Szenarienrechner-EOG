import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildAiPrompt, defaultAiPromptOptions, redactModelForPrompt } from '../src/ai-prompt-generator.js';
import { calcPortfolio, params } from '../src/engine.js';
import { spreadsheetTables } from '../src/spreadsheet-export.js';

const baseInputs = {
  sector: 'strom',
  baseYear: 2027,
  baseEog: 48000,
  rab: 77000,
  returnRate: 5,
  financingRate: 4,
  horizon: 6,
  discountRate: 4,
  kanuEndYear: 2045,
  degressiveRate: 10,
  taxFactor: 0,
  portfolioAttribution: 100,
  qDelta: 0,
  eDelta: 0,
  regulationProcedure: 'standard',
  capexLagYears: 0,
  opexLagYears: 0,
  qeLagYears: 0,
  regulatoryStatus: 'cabinet_draft_2026_07_29',
  regulatoryStatusDate: '2026-07-29',
  assumptionStatus: 'draft'
};

function measure(overrides = {}) {
  return {
    id: 'strom-eeg-1',
    active: true,
    name: 'PV-Anschluss Demogebiet',
    type: 'noRegret',
    year: 2027,
    cost: 100,
    secure: 100,
    uncertain: 0,
    probability: 0,
    life: 20,
    hgbLife: 20,
    opexRecognition: 0,
    qDirect: 0,
    eDirect: 0,
    riskAvoided: 0,
    portfolioShare: 0,
    note: 'Strom-Maßnahme mit Entwurfsannahmen',
    objectiveIds: ['obj_supply'],
    sourceSystem: 'Demo-System',
    sourceRecordId: 'ROW-1',
    ...overrides
  };
}

describe('CR-SZR-EEG2027-FLEX-002 Strom-only integration', () => {
  it('applies Strom-only draft status, redispatch revenue-at-risk and cost contribution without touching Gas', () => {
    const enriched = measure({
      capacityLimitedGridArea: true,
      capacityLimitedTechnology: 'pv',
      redispatchCompensationWaiverEnabled: true,
      redispatchCompensationWaiverLimitPct: 20,
      redispatchRiskClass: 'high',
      annualRevenueAtRiskTeur: 12,
      connectionRequestPowerKw: 500,
      voltageLevel: 'medium_voltage',
      connectionRequestStatus: 'under_review',
      queueRiskClass: 'high',
      reservationExpiryDate: '2027-02-01',
      nextRequiredEvidence: '',
      generationConnectionCostContributionEnabled: true,
      connectionCostContributionTeur: 40,
      connectionCostContributionMode: 'user_defined',
      regulatoryStatus: 'cabinet_draft_2026_07_29',
      assumptionStatus: 'draft'
    });

    const stromResult = calcPortfolio({ measures: [enriched] }, params(baseInputs));
    const warningTypes = stromResult.warnings.map(warning => warning.type);
    expect(stromResult.invest).toBe(140);
    expect(stromResult.riskPa).toBe(12);
    expect(warningTypes).toContain('strom_eeg2027_draft_assumption_review');
    expect(warningTypes).toContain('strom_capacity_limited_redispatch_review');
    expect(warningTypes).toContain('strom_connection_evidence_missing');
    expect(warningTypes).toContain('strom_connection_reservation_expiry_review');
    expect(warningTypes).toContain('strom_connection_cost_contribution_draft');

    const gasBaseline = calcPortfolio({ measures: [measure({ cost: 100 })] }, params({ ...baseInputs, sector: 'gas' }));
    const gasWithStromFields = calcPortfolio({ measures: [enriched] }, params({ ...baseInputs, sector: 'gas' }));
    expect(gasWithStromFields.invest).toBe(gasBaseline.invest);
    expect(gasWithStromFields.riskPa).toBe(gasBaseline.riskPa);
    expect(gasWithStromFields.warnings.map(warning => warning.type).join(' ')).not.toMatch(/eeg2027|redispatch|connection|capacity_limited/i);
  });

  it('exports Strom EEG-2027 assumptions to prompt and spreadsheets while omitting them for Gas', () => {
    const stromModel = {
      inputs: baseInputs,
      measures: [measure({
        capacityLimitedGridArea: true,
        annualRevenueAtRiskTeur: 12,
        connectionRequestPowerKw: 500,
        voltageLevel: 'medium_voltage',
        connectionRequestStatus: 'under_review',
        generationConnectionCostContributionEnabled: true,
        connectionCostContributionTeur: 40,
        regulatoryStatus: 'cabinet_draft_2026_07_29',
        assumptionStatus: 'draft'
      })]
    };
    const snapshot = redactModelForPrompt(stromModel, { ...defaultAiPromptOptions, roleId: 'challenge', dataScope: 'standard' });
    expect(snapshot.stromEeg2027).toMatchObject({
      applicable: true,
      regulatoryStatus: 'cabinet_draft_2026_07_29',
      draftAssumptions: 1,
      userSuppliedAssumptions: 0
    });
    const prompt = buildAiPrompt(stromModel, { ...defaultAiPromptOptions, roleId: 'challenge', dataScope: 'standard' });
    expect(prompt).toContain('Regelstand: Kabinettsentwurf 29.07.2026');
    expect(prompt).toContain('Netzanschlussstatus ab 135 kW');
    expect(prompt).toContain('Erlösrisiko 12');

    const stromTables = spreadsheetTables(stromModel);
    expect(stromTables.map(table => table.name)).toContain('Strom_EEG2027_Netzanschluss');
    expect(stromTables.find(table => table.name === 'Strom_EEG2027_Netzanschluss')?.rows[0]).toContain('annualRevenueAtRiskTeur');

    const gasModel = { ...stromModel, inputs: { ...baseInputs, sector: 'gas' } };
    expect(redactModelForPrompt(gasModel, defaultAiPromptOptions).stromEeg2027).toBeNull();
    const gasTables = spreadsheetTables(gasModel);
    expect(gasTables.map(table => table.name)).not.toContain('Strom_EEG2027_Netzanschluss');
    expect(JSON.stringify(gasTables)).not.toContain('annualRevenueAtRiskTeur');
  });

  it('documents Strom-only UI fields and keeps the Gas section gated separately', () => {
    const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const uiJs = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
    expect(indexHtml).toContain('EEG 2027 / Netzanschluss (Entwurfsstand)');
    expect(indexHtml).toContain('mCapacityLimitedGridArea');
    expect(indexHtml).toContain('mConnectionRequestPowerKw');
    expect(indexHtml).toContain('mConnectionCostContributionTeur');
    expect(indexHtml).toContain('strom-eeg2027-only');
    expect(uiJs).toContain("document.body.classList.toggle('sector-strom'");
    expect(uiJs).toContain('renderStromEeg2027Layer(measure)');
  });
});
