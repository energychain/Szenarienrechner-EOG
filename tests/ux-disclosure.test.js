import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('UX disclosure improvements', () => {
  const html = readFileSync('index.html', 'utf8');
  const ui = readFileSync('src/ui.js', 'utf8');
  const css = readFileSync('src/styles.css', 'utf8');

  it('groups catalog actions into search, quick-list, and selected-item toolboxes', () => {
    expect(html).toContain('catalog-toolbox');
    expect(html).toContain('Suche & Filter');
    expect(html).toContain('Schnelllisten');
    expect(html).toContain('Auswahl bearbeiten');
    expect(html).toContain('Maßnahme, ID, Bereich oder Tag suchen');
  });

  it('uses progressive disclosure for project milestones and tasks', () => {
    expect(ui).toContain('<details class="project-plan-milestone"');
    expect(ui).toContain('<summary class="project-milestone-summary">');
    expect(ui).toContain('<details class="project-task');
    expect(ui).toContain('const taskOpen = activeProjectTaskId === item.id || nextReady?.task.id === item.id || item.status === \'in_progress\';');
    expect(css).toContain('.project-task-expanded');
  });

  it('supports next/previous navigation in the measure edit modal', () => {
    expect(html).toContain('measureEditPrev');
    expect(html).toContain('measureEditNext');
    expect(html).toContain('measureEditPosition');
    expect(ui).toContain('function navigateMeasureInCatalog(delta)');
    expect(ui).toContain("document.getElementById('measureEditNext').addEventListener('click', () => navigateMeasureInCatalog(1));");
  });
});
