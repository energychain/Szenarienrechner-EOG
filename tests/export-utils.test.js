import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob, exportStamp, htmlWithEmbeddedModelState, jsonForHtmlScript } from '../src/export-utils.js';

describe('export utilities', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds stable export timestamps', () => {
    expect(exportStamp({ savedAt: '2026-07-13T10:16:54.000Z' })).toBe('2026-07-13-101654');
  });

  it('escapes embedded JSON for inert HTML script blocks', () => {
    const json = jsonForHtmlScript({ value: '<tag>&</tag>' });
    expect(json).toContain('\\u003ctag\\u003e\\u0026\\u003c/tag\\u003e');
    expect(json).not.toContain('<tag>');
  });

  it('delays object URL revocation until after the browser starts the download', () => {
    vi.useFakeTimers();
    const anchor = { click: vi.fn(), remove: vi.fn(), href: '', download: '' };
    const documentRef = {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn() }
    };
    const urlRef = {
      createObjectURL: vi.fn(() => 'blob:export'),
      revokeObjectURL: vi.fn()
    };

    const fakeDocument = /** @type {any} */ (documentRef);
    const fakeUrl = /** @type {any} */ (urlRef);
    downloadBlob(new Blob(['self-contained html']), 'export.html', fakeDocument, fakeUrl);

    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(urlRef.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(urlRef.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(urlRef.revokeObjectURL).toHaveBeenCalledWith('blob:export');
  });

  it('inserts embedded model state before the real body close, not a script string literal', () => {
    const html = '<html><body><script>const marker = "</body>";</script><main>App</main></body></html>';
    const result = htmlWithEmbeddedModelState(html, { current: true });

    expect(result).toContain('<script>const marker = "</body>";</script>');
    expect(result.indexOf('embedded-model-state')).toBeGreaterThan(result.indexOf('<main>App</main>'));
    expect(result.indexOf('embedded-model-state')).toBeLessThan(result.lastIndexOf('</body>'));
  });

  it('does not treat embedded-state script markup inside bundled JavaScript as an actual stale state block', () => {
    const html = '<html><body><script>const template = `<script id="embedded-model-state" type="application/json">${data}<\\/script>`; console.log(template);</script><main>App</main></body></html>';
    const result = htmlWithEmbeddedModelState(html, { current: true });

    expect(result).toContain('const template = `<script id="embedded-model-state"');
    expect(result).toContain('console.log(template);</script>');
    expect(result.match(/embedded-model-state/g)).toHaveLength(2);
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
