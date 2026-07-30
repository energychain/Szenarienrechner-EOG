import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');

function indexOf(fragment) {
  const index = html.indexOf(fragment);
  expect(index, `${fragment} should exist`).toBeGreaterThanOrEqual(0);
  return index;
}

describe('decision view meeting and clarification UX', () => {
  it('keeps the meeting entry point before the long clarification list and KPI panels', () => {
    const decision = indexOf('Entscheidung im Detail');
    const meeting = indexOf('Meeting-Fokus');
    const clarification = indexOf('Arbeitsstand und Klärpunkte');
    const kpis = indexOf('Kernkennzahlen');

    expect(meeting).toBeGreaterThan(decision);
    expect(meeting).toBeLessThan(clarification);
    expect(clarification).toBeLessThan(kpis);
  });

  it('renders the clarification list behind an explicit disclosure by default', () => {
    expect(html).toContain('id="clarificationDisclosure"');
    expect(html).toContain('id="clarificationDisclosureSummary"');
    expect(html).not.toContain('Die lange Klärpunktliste ist standardmäßig eingeklappt');
    expect(css).toContain('details.inline-disclosure');
    expect(ui).toContain('Alle ${openItems.length} offenen Klärpunkte anzeigen');
  });

  it('opens the disclosure when the global clarification counter is used', () => {
    expect(ui).toContain("const disclosure = document.getElementById('clarificationDisclosure')");
    expect(ui).toContain('if (disclosure) disclosure.open = true');
  });
});
