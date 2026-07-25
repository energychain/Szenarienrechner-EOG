import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeProjectPlan } from '../src/project-plan.js';

describe('import error handling', () => {
  it('normalizes missing or null projectPlan values to the default plan', () => {
    const normalized = normalizeProjectPlan(null, 2027);

    expect(normalized.schemaVersion).toBe('1.1.0');
    expect(normalized.milestones).toHaveLength(9);
    expect(normalized.milestones[0].id).toBe('m0');
  });

  it('exposes a user-visible JavaScript error modal for import/runtime failures', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');

    expect(html).toContain('id="runtimeErrorModal"');
    expect(html).toContain('id="runtimeErrorMessage"');
    expect(ui).toContain('function showRuntimeError');
    expect(ui).toContain("window.addEventListener('error'");
    expect(ui).toContain("window.addEventListener('unhandledrejection'");
    expect(ui).toContain("'Import fehlgeschlagen'");
  });
});
