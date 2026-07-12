export const storyBasePath = 'story/planungsrunde-userstory.html';

export const storyMilestones = [
  {
    id: 'kickoff',
    label: 'Kick-off / Orientierung',
    phase: 'initialisierung',
    view: 'basis',
    focus: 'management',
    anchor: 'kickoff',
    shouldLoadDemo: false,
    note: 'Startseite, Rollenwahl und Einstieg in die Planungsrunde.'
  },
  {
    id: 'initialisierung',
    label: 'Initialisierung / geführter Start',
    phase: 'initialisierung',
    view: 'basis',
    focus: 'management',
    anchor: 'initialisierung',
    shouldLoadDemo: false,
    note: 'Stammdaten-Wizard und fachliche Kontext-Hilfe.'
  },
  {
    id: 'datenerhebung',
    label: 'Datenerhebung',
    phase: 'datenerhebung',
    view: 'basis',
    focus: 'management',
    anchor: 'datenerhebung',
    shouldLoadDemo: true,
    note: 'Quellen, Arbeitsstand und nächste Datenabstimmung.'
  },
  {
    id: 'massnahmenbewertung',
    label: 'Maßnahmenbewertung',
    phase: 'massnahmenbewertung',
    view: 'measures',
    focus: 'management',
    anchor: 'massnahmenbewertung',
    shouldLoadDemo: true,
    note: 'Maßnahmenkatalog, neue Fakten und Portfoliozuschnitt.'
  },
  {
    id: 'technik-rueckkopplung',
    label: 'Technische Rückkopplung',
    phase: 'massnahmenbewertung',
    view: 'results',
    focus: 'technik',
    anchor: 'technik-rueckkopplung',
    shouldLoadDemo: true,
    note: 'Wirkannahmen, offene Punkte und technische Plausibilisierung.'
  },
  {
    id: 'konsolidierung',
    label: 'Konsolidierung',
    phase: 'konsolidierung',
    view: 'results',
    focus: 'management',
    anchor: 'konsolidierung',
    shouldLoadDemo: true,
    note: 'Managementsicht auf Entscheidungstendenz und Haken.'
  },
  {
    id: 'entscheidungsvorlage',
    label: 'Entscheidungsvorlage',
    phase: 'entscheidungsvorlage',
    view: 'report',
    focus: 'management',
    anchor: 'entscheidungsvorlage',
    shouldLoadDemo: true,
    reportMode: 'management',
    note: 'Management-Report mit Arbeitsstand und nächstem Schritt.'
  },
  {
    id: 'gremium',
    label: 'Gremienvorlage',
    phase: 'entscheidungsvorlage',
    view: 'report',
    focus: 'management',
    anchor: 'gremium',
    shouldLoadDemo: true,
    reportMode: 'committee',
    note: 'Einseiter für Gremium oder Vorstand.'
  },
  {
    id: 'archiv',
    label: 'Beschluss / Archiv',
    phase: 'archiv',
    view: 'report',
    focus: 'management',
    anchor: 'archiv',
    shouldLoadDemo: true,
    reportMode: 'committee',
    note: 'Re-Entry nach Beschluss und Archivierung des Entscheidungsstands.'
  }
];

export const defaultStoryMilestone = storyMilestones[0];

export function storyMilestoneById(id) {
  return storyMilestones.find(item => item.id === id) || defaultStoryMilestone;
}

export function storyMilestoneForPhase(phase, view = '') {
  return storyMilestones.find(item => item.phase === phase && (!view || item.view === view))
    || storyMilestones.find(item => item.phase === phase)
    || defaultStoryMilestone;
}

export function storyMilestoneFromUrl(urlLike) {
  try {
    const url = new URL(urlLike, 'app://example.invalid/');
    const id = url.searchParams.get('story') || url.hash.replace(/^#story-?/, '');
    return storyMilestoneById(id);
  } catch {
    return defaultStoryMilestone;
  }
}

export function storyUrlForMilestone(id) {
  const milestone = storyMilestoneById(id);
  return `${storyBasePath}#${milestone.anchor}`;
}

export function appDeepLinkForMilestone(id, baseUrl = './') {
  const milestone = storyMilestoneById(id);
  const url = new URL(baseUrl, 'app://example.invalid/');
  url.searchParams.set('story', milestone.id);
  const suffix = `${url.pathname}${url.search}${url.hash}`;
  return baseUrl.includes('://') ? url.toString() : suffix.replace(/^\//, '');
}

export function appStateForStoryMilestone(milestoneOrId) {
  const milestone = typeof milestoneOrId === 'string' ? storyMilestoneById(milestoneOrId) : milestoneOrId || defaultStoryMilestone;
  return {
    shouldLoadDemo: Boolean(milestone.shouldLoadDemo),
    phase: milestone.phase,
    view: milestone.view,
    focus: milestone.focus,
    reportMode: milestone.reportMode || 'management'
  };
}
