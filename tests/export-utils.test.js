import { describe, expect, it } from 'vitest';
import { exportStamp, htmlWithEmbeddedModelState, jsonForHtmlScript } from '../src/export-utils.js';

describe('export utilities', () => {
  it('builds stable export timestamps', () => {
    expect(exportStamp({ savedAt: '2026-07-13T10:16:54.000Z' })).toBe('2026-07-13-101654');
  });

  it('escapes embedded JSON for inert HTML script blocks', () => {
    const json = jsonForHtmlScript({ value: '<tag>&</tag>' });
    expect(json).toContain('\\u003ctag\\u003e\\u0026\\u003c/tag\\u003e');
    expect(json).not.toContain('<tag>');
  });

  it('replaces stale embedded model state with the current state', () => {
    const html = '<html><body><main>App</main><script id="embedded-model-state" type="application/json">{"old":true}</script></body></html>';
    const result = htmlWithEmbeddedModelState(html, { current: true });
    expect(result).toContain('<main>App</main>');
    expect(result).toContain('"current": true');
    expect(result).not.toContain('"old":true');
    expect(result.match(/embedded-model-state/g)).toHaveLength(1);
  });
});
