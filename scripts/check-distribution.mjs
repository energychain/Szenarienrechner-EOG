import { existsSync, readFileSync } from 'node:fs';
import { imprintSections } from '../src/trust-content.js';

const expectedCsp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src https://energychain.github.io; object-src 'none'; base-uri 'none'; form-action 'none'";
const appHtml = readFileSync('dist/szenarienrechner-eog.html', 'utf8');
const homepage = readFileSync('dist/index.html', 'utf8');
const readme = readFileSync('README.md', 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  appHtml.includes(`<meta http-equiv="Content-Security-Policy" content="${expectedCsp}">`),
  'Built app artifact is missing the expected CSP meta tag.'
);

assert(!/https?:\/\//i.test(appHtml
  .replaceAll('https://energychain.github.io', '')
  .replaceAll('https://github.com/energychain/Szenarienrechner-EOG', '')
  .replaceAll('http://schemas.openxmlformats.org', '')
  .replaceAll('http://purl.org/dc/elements/1.1/', '')
  .replaceAll('http://purl.org/dc/terms/', '')
  .replaceAll('http://purl.org/dc/dcmitype/', '')
  .replaceAll('http://www.w3.org/2001/XMLSchema-instance', '')), 'Built app artifact must not contain unapproved external http(s) URLs.');
assert(!/\b(XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(appHtml), 'Built app artifact must not contain push or socket network APIs.');
assert(appHtml.includes('release-manifest.json'), 'Built app artifact must expose the consent-driven release manifest check.');
assert(appHtml.includes('KI-Prompt erstellen'), 'Built app artifact must expose the local AI prompt export.');
assert(homepage.includes('Regulierte Finanzplanung verständlich'), 'Homepage must contain the public positioning headline.');
assert(homepage.includes('Fachliche Features'), 'Homepage must list fachliche features.');
assert(homepage.includes('Technische Features'), 'Homepage must list technical features.');
assert(homepage.includes('So arbeitet die App in der Praxis'), 'Homepage must contain visual workflow proofs.');
assert(homepage.includes('assets/homepage/01-planungsstart.jpg'), 'Homepage must reference generated workflow screenshots.');
assert(homepage.includes('Praxis-Beispiele als Karussell'), 'Homepage must present workflow screenshots as a carousel.');
assert(homepage.includes('id="demoModal"'), 'Homepage must provide a modal for original-size workflow screenshots.');
assert(homepage.includes('Screenshot groß ansehen'), 'Homepage must clearly invite users to open screenshots at readable size.');
assert(homepage.includes('STROMDAO GmbH'), 'Homepage must provide STROMDAO contact context.');
assert(homepage.includes('app.html'), 'Homepage must link to the browser app.');
[
  '01-planungsstart.jpg',
  '02-massnahmen-herleitung.jpg',
  '03-eog-cashflow.jpg',
  '04-projektplan.jpg',
  '05-tabellenexport.jpg',
  '06-ki-prompt.jpg',
  '07-html-mit-daten.jpg'
].forEach(file => assert(existsSync(`dist/assets/homepage/${file}`), `Homepage demo asset missing from dist: ${file}`));
assert(readFileSync('dist/llm.txt', 'utf8').includes('EOG-Wirkung ist nicht gleich Cashflow'), 'Build must publish llm.txt for prompt context.');
assert(readFileSync('dist/llms.txt', 'utf8').includes('llm.txt'), 'Build must publish llms.txt pointer.');
assert(appHtml.includes('Apache-2.0'), 'Built app artifact must show the Apache-2.0 license.');
assert(!appHtml.includes('CC BY-NC-SA'), 'Built app artifact must not contain the old CC BY-NC-SA license label.');
const legacyReleaseName = ['gas', 'massnahme', 'eog', 'rechner'].join('-') + '.html';
assert(!readme.includes(legacyReleaseName), 'README must use the neutral release filename.');
assert(readme.includes('REGULATORY_ASSUMPTIONS.md'), 'README must link the regulatory assumptions document.');

for (const section of imprintSections) {
  assert(readme.includes(section.title), `README is missing imprint heading: ${section.title}`);
  assert(appHtml.includes(section.title), `Built app artifact is missing imprint heading: ${section.title}`);
  for (const line of section.lines) {
    assert(readme.includes(line), `README is missing imprint line: ${line}`);
    assert(appHtml.includes(line), `Built app artifact is missing imprint line: ${line}`);
  }
}

console.log('Distribution checks passed.');
