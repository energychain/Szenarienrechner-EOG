import { existsSync, readFileSync } from 'node:fs';

const requiredDocs = [
  'docs/adr/0001-offline-first-single-file.md',
  'docs/adr/0002-dom-free-calculation-engine.md',
  'docs/adr/0003-synthetic-demo-data.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'ROADMAP.md',
  'MODEL.md',
  'RELEASE.md',
  'DATA_FORMAT.md',
  'GOVERNANCE.md'
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const path of requiredDocs) {
  assert(existsSync(path), `${path} is missing.`);
  const content = readFileSync(path, 'utf8');
  assert(content.includes('Szenarienrechner-EOG'), `${path} must name the project.`);
}

const contributing = readFileSync('CONTRIBUTING.md', 'utf8');
assert(contributing.includes('keine realen Netzbetreiber'), 'CONTRIBUTING must forbid real operator references in demo data.');
assert(contributing.includes('Testnachweis'), 'CONTRIBUTING must require test evidence.');

const governance = readFileSync('GOVERNANCE.md', 'utf8');
assert(governance.includes('keine Rechts- oder Regulierungsberatung'), 'GOVERNANCE must contain advisory disclaimer.');
assert(governance.includes('Fachliche Modelländerungen'), 'GOVERNANCE must define model-change handling.');

const roadmap = readFileSync('ROADMAP.md', 'utf8');
assert(roadmap.includes('Regulierungsprofile'), 'ROADMAP must include regulatory profiles.');
assert(roadmap.includes('UI-Modularisierung'), 'ROADMAP must include UI modularization.');

const model = readFileSync('MODEL.md', 'utf8');
assert(model.includes('REGULATORY_ASSUMPTIONS.md'), 'MODEL must reference regulatory assumptions.');
assert(model.includes('Erlösobergrenze'), 'MODEL must document EOG context.');

const adrIndex = readFileSync('docs/adr/0001-offline-first-single-file.md', 'utf8');
assert(adrIndex.includes('Offline-first'), 'ADR 0001 must document offline-first rationale.');
const adrEngine = readFileSync('docs/adr/0002-dom-free-calculation-engine.md', 'utf8');
assert(adrEngine.includes('DOM-freier Rechenkern'), 'ADR 0002 must document the DOM-free engine.');
const adrDemo = readFileSync('docs/adr/0003-synthetic-demo-data.md', 'utf8');
assert(adrDemo.includes('synthetische Demodaten'), 'ADR 0003 must document synthetic demo data.');

const dataFormat = readFileSync('DATA_FORMAT.md', 'utf8');
assert(dataFormat.includes('localStorage'), 'DATA_FORMAT must document localStorage scope.');
assert(dataFormat.includes('schemaVersion'), 'DATA_FORMAT must document schemaVersion.');
assert(dataFormat.includes('regulatoryProfileId'), 'DATA_FORMAT must document regulatoryProfileId.');
assert(dataFormat.includes('## Minimaler Projektumschlag'), 'DATA_FORMAT must document the minimal project envelope.');
assert(dataFormat.includes('## Migrationsregeln'), 'DATA_FORMAT must document migration handling.');
assert(dataFormat.includes('synthetisch'), 'DATA_FORMAT must document synthetic demo data.');

console.log('Documentation checks passed.');
