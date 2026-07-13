import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

function gitValue(command, fallback) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (_error) {
    return fallback;
  }
}

const htmlPath = 'dist/szenarienrechner-eog.html';
const html = readFileSync(htmlPath);
const sha256 = createHash('sha256').update(html).digest('hex');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const commit = process.env.VITE_BUILD_COMMIT || gitValue('git rev-parse --short=12 HEAD', 'unknown');
const buildTime = process.env.VITE_BUILD_TIME || new Date().toISOString();

const manifest = {
  schemaVersion: '1.0.0',
  app: {
    version: packageJson.version,
    commit,
    buildTime,
    sha256,
    downloadUrl: 'https://github.com/energychain/Szenarienrechner-EOG/releases/latest',
    changelogUrl: 'https://github.com/energychain/Szenarienrechner-EOG/blob/main/CHANGELOG.md',
    minSupportedVersion: '0.3.0'
  },
  ruleset: {
    id: 'regulatory-parameters-2026-07',
    effectiveMonth: '2026-07',
    confidence: 'consultation',
    sourceRef: 'BNetzA Anreizregulierung/ARegV/KANU sowie NEST/RAMEN-Kontext, Arbeitsstand 2026-07; pruefpflichtiger Planungsstand.',
    changelogUrl: 'https://github.com/energychain/Szenarienrechner-EOG/blob/main/REGULATORY_ASSUMPTIONS.md'
  },
  history: [],
  advisories: []
};

mkdirSync('dist', { recursive: true });
writeFileSync('dist/release-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`dist/release-manifest.json written for ${commit} (${sha256})`);
