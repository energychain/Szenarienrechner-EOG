import { readFileSync } from 'node:fs';
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
  .replaceAll('http://schemas.openxmlformats.org', '')), 'Built app artifact must not contain unapproved external http(s) URLs.');
assert(!/\b(XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(appHtml), 'Built app artifact must not contain push or socket network APIs.');
assert(appHtml.includes('release-manifest.json'), 'Built app artifact must expose the consent-driven release manifest check.');
assert(appHtml.includes('KI-Prompt erstellen'), 'Built app artifact must expose the local AI prompt export.');
assert(homepage.includes('Regulierte Finanzplanung verständlich'), 'Homepage must contain the public positioning headline.');
assert(homepage.includes('Fachliche Features'), 'Homepage must list fachliche features.');
assert(homepage.includes('Technische Features'), 'Homepage must list technical features.');
assert(homepage.includes('STROMDAO GmbH'), 'Homepage must provide STROMDAO contact context.');
assert(homepage.includes('app.html'), 'Homepage must link to the browser app.');
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
