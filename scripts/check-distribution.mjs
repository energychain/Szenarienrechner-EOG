import { readFileSync } from 'node:fs';
import { imprintSections } from '../src/trust-content.js';

const expectedCsp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const html = readFileSync('dist/index.html', 'utf8');
const readme = readFileSync('README.md', 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  html.includes(`<meta http-equiv="Content-Security-Policy" content="${expectedCsp}">`),
  'Built HTML is missing the expected CSP meta tag.'
);

assert(!/https?:\/\//i.test(html), 'Built HTML must not contain external http(s) URLs.');
assert(!/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(html), 'Built HTML must not contain network APIs.');
assert(html.includes('Apache-2.0'), 'Built HTML must show the Apache-2.0 license.');
assert(!html.includes('CC BY-NC-SA'), 'Built HTML must not contain the old CC BY-NC-SA license label.');
const legacyReleaseName = ['gas', 'massnahme', 'eog', 'rechner'].join('-') + '.html';
assert(!readme.includes(legacyReleaseName), 'README must use the neutral release filename.');
assert(readme.includes('REGULATORY_ASSUMPTIONS.md'), 'README must link the regulatory assumptions document.');

for (const section of imprintSections) {
  assert(readme.includes(section.title), `README is missing imprint heading: ${section.title}`);
  assert(html.includes(section.title), `Built HTML is missing imprint heading: ${section.title}`);
  for (const line of section.lines) {
    assert(readme.includes(line), `README is missing imprint line: ${line}`);
    assert(html.includes(line), `Built HTML is missing imprint line: ${line}`);
  }
}

console.log('Distribution checks passed.');
