import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');

const teurFields = [
  'deductionCapital',
  'mCost',
  'mAvoidedCapexTeur',
  'mDeferredCapexTeur',
  'mFlexOpexPaTeur',
  'mAnnualRevenueAtRiskTeur',
  'mConnectionCostContributionTeur',
  'mOpexPa',
  'mOpexDeltaPa',
  'mReinvestCost',
  'mDecommissionCost',
  'mQDirect',
  'mEDirect',
  'mRiskAvoided',
];

const glossaryTerms = [
  'EOG',
  'RAB',
  'QE',
  'KANU',
  'NEST/RAMEN',
  'ARegV',
  'Regulierungsperiode',
  'Kostenbasisjahr',
  'IRR',
  'Kapitalwert/NPV',
  'Diskontsatz',
  'Cashflow',
  'CAPEX',
  'OPEX',
  'AfA/Abschreibung',
  'Nutzungsdauer',
  'Befassung',
  'Klärpunkt',
  'Wirkannahme',
  'Evidenz',
  'Stresstest / konservatives Szenario',
  'Systemreferenz / Rückspielweg',
  'Risiko-Mapping',
  'Snapshot',
  'VNB',
  'TEUR',
  'Attribution',
  'Wirkungsverzug',
  'Kapitalkostenabgleich',
  'Regulierungskonto',
  'vereinfachtes Verfahren',
  'No-Regret',
  'Kontextobjekt',
  'Entscheidungsreife',
  'AGNeS',
  'Netzfahrplan',
  'Flexibilität(sobjekt)',
  'EEG 2027 / Netzanschlusspaket',
  'kapazitätslimitiertes Netzgebiet',
  'Erlösrisiko',
  'Risikowert (RiskAvoided)',
  'Ewigkeitsvermutung',
  'Stilllegung/Rückbau',
  'Umwidmung/Wasserstoffleitung',
  'Rückstellungen',
  'KAnEu',
  'Ist-Kosten/Kostenpfad',
  'Abzugskapital',
  'EK-/FK-Anteil',
  'Kapitalverzinsung',
  'Baukostenzuschuss (BKZ)',
];

describe('CR-04 completion: amount fields and single delete undo', () => {
  it('formats every TEUR amount field in the measure editor', () => {
    for (const id of teurFields) {
      const pattern = new RegExp(`<input id="${id}"[^>]*type="text"[^>]*inputmode="numeric"[^>]*data-format="teur"`);
      expect(html).toMatch(pattern);
      expect(html).toContain(`${id}Unit`);
    }
  });

  it('offers undo for deleting a single measure', () => {
    expect(html).toContain('id="deleteSelectedMeasure"');
    expect(ui).toContain("captureUndoSnapshot('Maßnahme löschen')");
    expect(ui).toContain("showUndoToast('Maßnahme löschen')");
    expect(ui).toContain('function deleteSelectedMeasure');
  });
});

describe('CR-05 language and glossary', () => {
  it('adds a bundled glossary with menu entry and hash deep link support', () => {
    expect(html).toContain('id="openGlossary"');
    expect(html).toContain('id="glossaryModal"');
    expect(ui).toContain('function openGlossaryModal');
    expect(ui).toContain("hash.startsWith('#glossar/')");
    for (const term of glossaryTerms) {
      expect(ui).toContain(`term: '${term}'`);
    }
    expect(ui).toContain("aliases: ['Sidecar', 'Evidenzobjekt']");
    expect(ui).toContain("aliases: ['Qualitätselement', 'Q-Element']");
    expect(ui).toContain('Auch auffindbar als');
    expect(ui).toContain("type: 'Glossar'");
  });

  it('links info-dot popovers to matching glossary entries', () => {
    expect(ui).toContain('function glossarySlugForHelp');
    expect(ui).toContain('data-open-glossary');
    expect(ui).toContain('Im Glossar öffnen');
    expect(ui).toContain("window.addEventListener('hashchange', applyGlossaryDeepLink)");
    expect(css).toContain('.popover-glossary-link');
  });

  it('keeps the Mehr menu to the three CR-05 sections', () => {
    expect(html).toContain('Export</span>');
    expect(html).toContain('Hilfe & Kontext</span>');
    expect(html).toContain('Arbeitsstand ersetzen oder löschen</span>');
    expect(html).not.toContain('Unterstützung</span>');
    expect(html.indexOf('Arbeitsstand ersetzen oder löschen')).toBeGreaterThan(html.indexOf('Hilfe & Kontext'));
  });

  it('keeps headings concise and moves long next-step text out of headings', () => {
    const headings = [...html.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gs)]
      .map(match => match[1].replace(/<[^>]+>/g, '').trim())
      .filter(Boolean);
    for (const heading of headings) {
      expect(heading.length).toBeLessThanOrEqual(60);
    }
    expect(ui).toContain('compactHeading(nextStepText)');
    expect(ui).toContain('full-next-step-text');
  });

  it('styles glossary and warning-safe danger menu states', () => {
    expect(css).toContain('.glossary-list');
    expect(css).toContain('.glossary-entry.active');
    expect(css).toContain('.menu-section-title.danger');
  });
});
