import { describe, expect, it } from 'vitest';
import {
  appStateForStoryMilestone,
  defaultStoryMilestone,
  storyMilestoneFromUrl,
  storyMilestones,
  storyUrlForMilestone
} from '../src/story-navigation.js';

describe('story navigation', () => {
  it('maps public story deep links to app state', () => {
    const milestone = storyMilestoneFromUrl('https://example.test/?story=datenerhebung');

    expect(milestone.id).toBe('datenerhebung');
    expect(appStateForStoryMilestone(milestone)).toMatchObject({
      shouldLoadDemo: true,
      phase: 'datenerhebung',
      view: 'basis',
      focus: 'management'
    });
  });

  it('falls back to kickoff and exposes relative story anchors for the app', () => {
    expect(storyMilestoneFromUrl('https://example.test/?story=unknown')).toBe(defaultStoryMilestone);

    const url = storyUrlForMilestone('entscheidungsvorlage');
    expect(url).toBe('story/planungsrunde-userstory.html#entscheidungsvorlage');
  });

  it('covers every process phase with at least one story milestone', () => {
    const phases = new Set(storyMilestones.map(item => item.phase));

    for (const phase of ['initialisierung', 'datenerhebung', 'massnahmenbewertung', 'konsolidierung', 'entscheidungsvorlage', 'archiv']) {
      expect(phases.has(phase)).toBe(true);
    }
  });
});
