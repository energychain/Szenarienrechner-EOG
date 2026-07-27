import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');

describe('clarification audit UX', () => {
  it('does not close a clarification directly from the list without an audit note', () => {
    expect(ui).toContain('data-action="openClarificationAudit"');
    expect(ui).not.toContain('data-action="toggleClarification" data-clarification-key');
    expect(ui).toContain('function openClarificationAudit');
    expect(ui).toContain('function saveClarificationAudit');
    expect(ui).toContain('Klärnotiz ist erforderlich');
  });

  it('adds a dedicated audit modal with required note and data-jump action', () => {
    expect(html).toContain('id="clarificationAuditModal"');
    expect(html).toContain('id="clarificationAuditNote"');
    expect(html).toContain('required');
    expect(html).toContain('id="clarificationAuditOpenMeasure"');
    expect(html).toContain('Datenstelle bearbeiten');
    expect(css).toContain('.clarification-audit-banner');
  });

  it('stores clarification status with note, timestamp, author and measure reference', () => {
    expect(ui).toContain('note: note');
    expect(ui).toContain('timestamp: timestamp');
    expect(ui).toContain('author: author');
    expect(ui).toContain('measureId: pendingClarificationAudit.item.measureId');
    expect(ui).toContain("type: 'clarificationAuditCompleted'");
  });
});
