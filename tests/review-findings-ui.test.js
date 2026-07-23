import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ui = fs.readFileSync(path.join(root, 'src/ui.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'src/engine.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

describe('review findings 3.1-3.4 UI integration', () => {
  it('uses recurring EOG effect instead of year-1 peak as decision headline', () => {
    expect(ui).toContain('metrics.recurringRegulatoryEog');
    expect(ui).toContain('Einmaleffekt');
    expect(html).toContain('EOG-Wirkung Folgejahr');
    expect(ui).not.toContain('entsteht im ersten Jahr ein EOG-Zusatz');
    expect(ui).not.toContain('laufende rechnerische EOG-Wirkung');
    expect(ui).not.toContain('laufende modellierte EOG-Wirkung ab Jahr 2');
    expect(ui).toContain('Der erste Folgejahreswert ${firstFollowYear} liegt bei');
    expect(ui).toContain('im Startjahr ${startYear} bei');
    expect(ui).toContain('Für einen Durchschnittshaushalt entspricht der erste Folgejahreswert ${narrative.firstFollowYear}');
    expect(ui).toContain('spätere Jahreswerte können');
    expect(ui).toContain('Einmaleffekt nur im Startjahr');
  });

  it('shows conservative judgement without review-marked assumptions in the verdict', () => {
    expect(ui).toContain("currentScenarioParams('konservativ')");
    expect(ui).toContain('Ohne prüfpflichtige Annahmen');
    expect(ui).toContain('metrics.governanceDecision');
    expect(engine).toContain('Tragfähig mit Auflage');
    expect(engine).toContain('Robust tragfähig');
    expect(engine).toContain('Nicht tragfähig im Basiscase');
    expect(engine).toContain('Nicht entscheidungsreif');
    expect(ui).toContain('konservatives Urteil');
  });

  it('separates EOG effect from indicative cashflow wording', () => {
    expect(ui).toContain('kein garantierter EOG-Cashflow');
    expect(ui).toContain('IRR und Kapitalwert sind indikative Cashflow-Kennzahlen');
    expect(ui).toContain('regulatoryEogEffect');
    expect(ui).toContain('indicativeCashflow');
    expect(html).toContain('IRR indikativ');
  });

  it('renders an explicit EOG-to-cashflow bridge in the decision UI and report', () => {
    expect(html).toContain('eogCashflowBridge');
    expect(html).toContain('Regulatorische EOG-Wirkung ≠ Cashflow');
    expect(html).toContain('cashflowBridgeEog');
    expect(html).toContain('cashflowBridgeEconomic');
    expect(html).toContain('cashflowBridgeResult');
    expect(ui).toContain('renderEogCashflowBridge');
    expect(ui).toContain('Modellierte EOG-Wirkung');
    expect(ui).toContain('wirtschaftliche Überleitung');
    expect(ui).toContain('indikative Cashflow-Basis');
    expect(ui).toContain('Diese Überleitung erklärt, warum IRR/NPV nicht die EOG selbst bewerten');
  });
});
