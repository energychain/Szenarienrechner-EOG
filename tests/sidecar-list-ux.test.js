import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync('index.html', 'utf8');
const uiJs = readFileSync('src/ui.js', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');

describe('sidecar evidence list usability', () => {
  test('sidecar workspace separates overview, filters and compact working list', () => {
    expect(indexHtml).toContain('sidecar-workspace');
    expect(indexHtml).toContain('sidecar-toolbar');
    expect(indexHtml).toContain('Arbeitsliste eingrenzen');
    expect(indexHtml).toContain('sidecar-card-list');
    expect(indexHtml).not.toContain('id="sidecarBody" class="clarification-list"');
  });

  test('sidecar cards use compact cards with a clear primary edit affordance', () => {
    expect(uiJs).toContain('sidecar-object-card');
    expect(uiJs).toContain('sidecar-card-main');
    expect(uiJs).toContain('sidecar-status-chip');
    expect(uiJs).toContain('Bearbeiten/Verknüpfen');
    expect(uiJs).not.toContain('Bearbeiten / Verknüpfen');
    expect(uiJs).not.toContain('Felder, Maßnahmenbezug und Brückenlogik öffnen</small>');
  });

  test('sidecar CSS visually differentiates object types and keeps details disclosed on click', () => {
    expect(css).toContain('.sidecar-object-card');
    expect(css).toContain('.sidecar-tone-warn');
    expect(css).toContain('.sidecar-tone-system');
    expect(css).toContain('.sidecar-edit-action span');
    expect(css).toContain('.sidecar-editor-disclosure[open] .sidecar-edit-action span::after');
    expect(css).toContain('-webkit-line-clamp: 2');
  });
});
