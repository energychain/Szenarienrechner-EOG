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
  'GOVERNANCE.md',
  'docs/ecosystem/index.md',
  'docs/handbook/regulierte-finanzplanung-vnb.md',
  'docs/regulatory-map.md',
  'docs/maturity-model.md',
  'docs/decision-artifacts.md',
  'docs/project-plan.md',
  'docs/release-awareness.md',
  'docs/ai-prompts.md',
  'docs/pilot-program.md',
  'docs/validation-methodology.md',
  'docs/visuals/methodik-grafikserie.md',
  'docs/templates/massnahmensteckbrief.md',
  'docs/templates/gremienvorlage.md',
  'docs/templates/klaerpunktliste.md',
  'docs/templates/datenanforderung.md',
  'docs/templates/workshop-agenda.md',
  'docs/templates/validation-protocol.md',
  'docs/starter-kits/index.md',
  'docs/starter-kits/starter-kit-strom-ortsnetz.md',
  'docs/starter-kits/starter-kit-gas-transformation.md',
  'docs/starter-kits/starter-kit-spartenportfolio.md',
  'docs/guides/management.md',
  'docs/guides/controlling.md',
  'docs/guides/regulierung.md',
  'docs/guides/asset-management.md',
  'docs/guides/anlagenbuchhaltung.md',
  'docs/examples/strom-ortsnetz.md',
  'docs/examples/gas-transformation.md',
  'docs/examples/spartenportfolio.md'
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const path of requiredDocs) {
  assert(existsSync(path), `${path} is missing.`);
  const content = readFileSync(path, 'utf8');
  assert(content.includes('Szenarienrechner-EOG') || path.startsWith('docs/templates/') || path.startsWith('docs/guides/') || path.startsWith('docs/examples/') || path.startsWith('docs/starter-kits/'), `${path} must name the project or be a role/template/example/starter-kit page.`);
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
assert(dataFormat.includes('lastReleaseCheck'), 'DATA_FORMAT must document release-awareness persistence.');
assert(dataFormat.includes('Tabellenexporte'), 'DATA_FORMAT must document spreadsheet export scope.');
assert(dataFormat.includes('schemaVersion'), 'DATA_FORMAT must document schemaVersion.');
assert(dataFormat.includes('regulatoryProfileId'), 'DATA_FORMAT must document regulatoryProfileId.');
assert(dataFormat.includes('## Minimaler Projektumschlag'), 'DATA_FORMAT must document the minimal project envelope.');
assert(dataFormat.includes('## Migrationsregeln'), 'DATA_FORMAT must document migration handling.');
assert(dataFormat.includes('synthetisch'), 'DATA_FORMAT must document synthetic demo data.');

const releaseAwareness = readFileSync('docs/release-awareness.md', 'utf8');
assert(releaseAwareness.includes('kein Netzzugriff'), 'Release awareness doc must preserve offline-first wording.');
assert(releaseAwareness.includes('release-manifest.json'), 'Release awareness doc must document the manifest.');
assert(releaseAwareness.includes('Modelldaten werden nicht angehängt'), 'Release awareness doc must document support privacy.');

const aiPrompts = readFileSync('docs/ai-prompts.md', 'utf8');
assert(aiPrompts.includes('KI-Prompt erstellen'), 'AI prompt doc must document the menu action.');
assert(aiPrompts.includes('keine automatische Übertragung'), 'AI prompt doc must document no automatic transfer.');
assert(aiPrompts.includes('llm.txt'), 'AI prompt doc must link the LLM context file.');
assert(existsSync('llm.txt') && existsSync('llms.txt'), 'LLM context files must exist at repository root.');

const pilotProgram = readFileSync('docs/pilot-program.md', 'utf8');
assert(pilotProgram.includes('STROMDAO GmbH'), 'Pilot program must identify the public steward.');
assert(pilotProgram.includes('Star vergeben'), 'Pilot program must ask for visible OSS signals.');
assert(pilotProgram.includes('Fork'), 'Pilot program must invite forks.');
assert(pilotProgram.includes('Pull Request'), 'Pilot program must invite pull requests.');
assert(pilotProgram.includes('Real-but-private Benchmark'), 'Pilot program must document private benchmark handling.');
assert(pilotProgram.includes('vertraulichen'), 'Pilot program must preserve confidentiality guidance.');

const story = readFileSync('docs/story/planungsrunde-userstory.md', 'utf8');
assert(story.includes('Szenarienrechner-EOG') || story.includes('EOG-Planungsrunde'), 'Story doc must name the planning context.');
assert(story.includes('Bidirektionale Navigation'), 'Story doc must explain bidirectional navigation.');
assert(story.includes('Projektplan als Struktur-Element'), 'Story doc must explain the project plan as operational structure.');
assert(story.includes('Gas-Transformationspfad: Stilllegung, Rückbau und Rückstellungen strukturieren'), 'Story doc must explain the Gas transformation path.');
assert(story.includes('Wegfall der sogenannten Ewigkeitsvermutung'), 'Story doc must mention the Gas eternity-assumption review point.');
assert(story.includes('KI-Prompt-Export als Übersetzungsschicht'), 'Story doc must explain the AI prompt export as translation layer.');
assert(story.includes('nächste fällige Aufgabe'), 'Story doc must explain project plan next-task guidance.');
for (const id of ['kickoff', 'initialisierung', 'datenerhebung', 'massnahmenbewertung', 'technik-rueckkopplung', 'konsolidierung', 'entscheidungsvorlage', 'gremium', 'archiv']) {
  assert(story.includes(`id="${id}"`), `Story doc is missing anchor ${id}.`);
  assert(story.includes(`?story=${id}`), `Story doc is missing app deep link for ${id}.`);
}
const imageRefs = [...story.matchAll(/!\[[^\]]*\]\((screenshots\/[^)]+\.png)\)/g)].map(match => `docs/story/${match[1]}`);
assert(imageRefs.length >= 9, 'Story doc must reference at least nine screenshots.');
for (const imagePath of imageRefs) {
  assert(existsSync(imagePath), `Story screenshot is missing: ${imagePath}`);
}

console.log('Documentation checks passed.');
