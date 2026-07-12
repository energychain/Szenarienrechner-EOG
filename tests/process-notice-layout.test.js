// @ts-expect-error Node built-in types are not part of the app typecheck scope.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('process notice layout', () => {
  it('can be dismissed with its hidden class', () => {
    expect(css).toMatch(/\.process-notice\.hidden\s*\{[^}]*display:\s*none/i);
  });

  it('is placed near the top of the page flow instead of as a bottom overlay', () => {
    const rule = css.match(/\.process-notice\s*\{(?<body>[^}]*)\}/)?.groups?.body || '';

    expect(html.indexOf('id="processNotice"')).toBeLessThan(html.indexOf('id="startScreen"'));
    expect(rule).not.toMatch(/position:\s*fixed/i);
    expect(rule).not.toMatch(/bottom:\s*22px/i);
  });
});
