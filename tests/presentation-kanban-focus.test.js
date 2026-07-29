import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const ui = readFileSync('src/ui.js', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');

describe('presentation focus window and clarification kanban', () => {
  it('renders presentation as a closeable focused meeting window', () => {
    expect(html).toContain('class="presentation-close" data-jump-view="akte"');
    expect(html).toContain('Schließen</button>');
    expect(ui).toContain('presentation-slide-content');
    expect(ui).toContain('presentation-body');
    expect(css).toContain('body[data-view="presentation"] .compact-akte-nav');
    expect(css).toContain('body[data-view="presentation"] .sticky-kpis');
    expect(css).toContain('body[data-view="presentation"] footer');
    expect(css).toContain('body[data-view="presentation"] main');
    expect(css).toContain('presentation-slide-actions');
    expect(css).toContain('-webkit-line-clamp: 3;');
  });

  it('shows Prüfen & Klären as an actual kanban board instead of a long homogeneous list', () => {
    expect(html).toContain('Klärpunkt-Kanban');
    expect(ui).toContain('function workItemColumn');
    expect(ui).toContain('function renderWorkItemCard');
    expect(ui).toContain('work-kanban-board');
    expect(ui).toContain('Hohe Steuerungswirkung');
    expect(ui).toContain('Evidenz / Systeme');
    expect(ui).toContain('Dokumentation');
    expect(ui).toContain('Geklärt');
    expect(css).toContain('.work-kanban-board');
    expect(css).toContain('height: 100%;');
    expect(css).toContain('[data-view-panel="expertWork"]');
    expect(css).toContain('overflow: hidden !important;');
    expect(css).toContain('.work-kanban-column.high');
    expect(css).toContain('.work-kanban-card');
  });
});
