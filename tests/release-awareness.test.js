import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  compareReleaseManifest,
  releaseManifestUrl,
  rulesetInfo,
  supportIssueUrl,
  supportPackage
} from '../src/release-awareness.js';
import { regulatoryParameterSet } from '../src/engine.js';

const html = readFileSync('index.html', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');

describe('release awareness and support integration', () => {
  it('exposes ruleset confidence on the regulatory parameter set', () => {
    const info = rulesetInfo(regulatoryParameterSet);
    expect(info.id).toBe('regulatory-parameters-2026-07');
    expect(info.confidence).toBe('consultation');
    expect(info.sourceRef).toContain('Arbeitsstand 2026-07');
  });

  it('renders an explicit UI entry without automatic startup checks', () => {
    expect(html).toContain('id="checkReleaseAwareness"');
    expect(html).toContain('id="openSupportIssue"');
    expect(html).toContain('id="exportSupportPackage"');
    expect(html).toContain('id="rulesetBadge"');
    expect(ui).toContain('async function checkReleaseAwareness()');
    expect(ui).toContain('window.confirm(\'Aktualität prüfen?');
    expect(ui).toContain('fetch(releaseManifestUrl');
    expect(ui).not.toContain('checkReleaseAwareness();');
  });

  it('compares app and ruleset axes separately', () => {
    const result = compareReleaseManifest({
      appVersion: '0.3.0',
      buildCommit: 'abc',
      rulesetId: 'regulatory-parameters-2026-07',
      rulesetConfidence: 'consultation'
    }, {
      app: { version: '0.3.1', commit: 'def', sha256: '123' },
      ruleset: { id: 'regulatory-parameters-2026-11', confidence: 'draft', sourceRef: 'Quelle' }
    });
    expect(result.app.status).toBe('outdated');
    expect(result.ruleset.status).toBe('outdated');
    expect(result.app.sha256).toBe('123');
    expect(result.ruleset.confidence).toBe('draft');
  });

  it('builds GitHub issue URLs without model data', () => {
    const url = supportIssueUrl('regulatory-update', {
      appVersion: '0.3.0-dev',
      buildCommit: 'abc123',
      buildTime: '2026-07-13T00:00:00Z',
      rulesetId: 'regulatory-parameters-2026-07',
      rulesetConfidence: 'consultation',
      rulesetSourceRef: 'Quelle',
      lastReleaseCheckAt: '',
      userAgent: 'test-browser'
    });
    expect(url).toContain('https://github.com/energychain/Szenarienrechner-EOG/issues/new');
    expect(url).toContain('regulatory_update.yml');
    expect(decodeURIComponent(url)).toContain('Build-Commit: abc123');
    expect(decodeURIComponent(url)).toContain('Modelldaten sind standardmäßig nicht enthalten');
  });

  it('creates support packages with metadata only', () => {
    const payload = supportPackage({ appVersion: '0.3.0', buildCommit: 'abc', rulesetId: 'ruleset' });
    expect(payload.privacy).toContain('keine Modell- oder Maßnahmenwerte');
    expect(payload.context.buildCommit).toBe('abc');
    expect(JSON.stringify(payload)).not.toContain('measures');
  });

  it('uses a single approved public manifest endpoint', () => {
    expect(releaseManifestUrl).toBe('https://energychain.github.io/Szenarienrechner-EOG/release-manifest.json');
  });
});
