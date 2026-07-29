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

  it('shows data editing and audit note together inside the measure modal', () => {
    expect(html).toContain('id="clarificationAuditModal"');
    expect(html).toContain('id="clarificationAuditNote"');
    expect(html).toContain('required');
    expect(html).not.toContain('id="clarificationAuditOpenMeasure"');
    expect(ui).toContain('measureClarificationNote');
    expect(ui).toContain('Befassung zum aktiven Klärpunkt');
    expect(ui).toContain('Was ist zu tun?');
    expect(ui).toContain('Links bleibt die Maßnahme bearbeitbar');
    expect(ui).toContain('Aktuelle Befassung');
    expect(ui).toContain('Befassungsnotiz speichern');
    expect(ui).toContain('Klärpunkt abschließen');
    expect(ui).toContain('clarificationBefassungHistoryHtml');
    expect(ui).toContain('Projektplan: ${projectTask');
    expect(ui).toContain("modal.classList.toggle('clarification-split-modal'");
    expect(css).toContain('.clarification-audit-banner');
    expect(css).toContain('.clarification-workbench-panel');
    expect(css).toContain('.clarification-split-modal .dialog-body');
  });

  it('stores clarification status with note, timestamp, author and measure reference', () => {
    expect(ui).toContain('note: note');
    expect(ui).toContain('befassungen: nextClarificationBefassungen');
    expect(ui).toContain("type = 'clarificationAuditCompleted'");
    expect(ui).toContain('timestamp: timestamp');
    expect(ui).toContain('author: author');
    expect(ui).toContain('measureId: pendingClarificationAudit.item.measureId');
  });
});
