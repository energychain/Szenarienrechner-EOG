import { describe, expect, it } from 'vitest';
import { neutralizeRestrictedSystemTerms } from '../src/public-term-sanitizer.js';
import { normalizeSidecar } from '../src/sidecar.js';
import { normalizeProjectPlan } from '../src/project-plan.js';

const assetSource = ['L', 'I', 'D', 'S'].join('');
const financeSource = ['S', 'A', 'P'].join('');
const restrictedPair = `${assetSource}/${financeSource}`;
const masterDataTerm = 'Master-Data-Synchronität';

describe('public system-term neutralization', () => {
  it('replaces concrete source-system pairings with Master-Data-Synchronität', () => {
    expect(neutralizeRestrictedSystemTerms(`${restrictedPair}-Synchronität klären`))
      .toBe(`${masterDataTerm} klären`);
    expect(neutralizeRestrictedSystemTerms(`${assetSource}-vs-${financeSource}/Anlagenbuchhaltung`))
      .toBe(`${masterDataTerm}/Anlagenbuchhaltung`);
  });

  it('neutralizes imported sidecar text before rendering or export', () => {
    const sidecar = normalizeSidecar({
      objects: [{
        title: `${restrictedPair}-Matching Gas`,
        summary: `Abgleich ${assetSource} und ${financeSource} definieren`,
        openQuestions: [`${restrictedPair}-Status erfassen`],
        bridgeLogic: { openQuestions: [`${financeSource}-ID prüfen`] }
      }]
    });
    const serialized = JSON.stringify(sidecar);
    expect(serialized).toContain(masterDataTerm);
    expect(serialized).not.toContain(assetSource);
    expect(serialized).not.toContain(financeSource);
  });

  it('neutralizes imported project-plan task text', () => {
    const plan = normalizeProjectPlan({
      milestones: [{
        id: 'm2',
        tasks: [{
          id: 'user-restricted-source-sync',
          milestoneId: 'm2',
          source: 'user',
          title: `${restrictedPair}-Synchronität dokumentieren`,
          resultArtifact: `${restrictedPair} Abgleich`,
          note: `${assetSource}-ID und ${financeSource}-ID nicht öffentlich nennen`
        }]
      }]
    }, 2027);
    const serialized = JSON.stringify(plan);
    expect(serialized).toContain(masterDataTerm);
    expect(serialized).not.toContain(assetSource);
    expect(serialized).not.toContain(financeSource);
  });
});
