export const releaseManifestUrl = 'https://energychain.github.io/Szenarienrechner-EOG/release-manifest.json';
export const repositoryUrl = 'https://github.com/energychain/Szenarienrechner-EOG';

export const rulesetConfidenceLabels = {
  enacted: 'rechtskräftig',
  consultation: 'Konsultationsstand',
  draft: 'Entwurf'
};

export const rulesetConfidenceClasses = {
  enacted: 'good',
  consultation: 'warn',
  draft: 'bad'
};

export function normalizeRulesetConfidence(value) {
  return ['enacted', 'consultation', 'draft'].includes(value) ? value : 'draft';
}

export function rulesetInfo(parameterSet = {}) {
  const confidence = normalizeRulesetConfidence(parameterSet.confidence);
  return {
    id: String(parameterSet.id || 'unknown-ruleset'),
    effectiveMonth: String(parameterSet.effectiveMonth || ''),
    confidence,
    confidenceLabel: rulesetConfidenceLabels[confidence],
    sourceRef: String(parameterSet.sourceRef || parameterSet.source || ''),
    changelogUrl: String(parameterSet.changelogUrl || '')
  };
}

function versionParts(version) {
  return String(version || '')
    .replace(/^v/i, '')
    .split(/[.-]/)
    .map(part => Number.parseInt(part, 10))
    .map(value => Number.isFinite(value) ? value : 0);
}

export function compareVersions(localVersion, remoteVersion) {
  const local = versionParts(localVersion);
  const remote = versionParts(remoteVersion);
  const max = Math.max(local.length, remote.length, 3);
  for (let i = 0; i < max; i += 1) {
    const diff = (remote[i] || 0) - (local[i] || 0);
    if (diff > 0) return 'remote-newer';
    if (diff < 0) return 'local-newer';
  }
  return 'same';
}

export function compareReleaseManifest(local, manifest = {}) {
  const app = manifest.app || {};
  const ruleset = manifest.ruleset || {};
  const appVersionComparison = compareVersions(local.appVersion, app.version);
  const appCommitChanged = Boolean(app.commit && local.buildCommit && app.commit !== local.buildCommit);
  const appStatus = appVersionComparison === 'remote-newer' || (appVersionComparison === 'same' && appCommitChanged)
    ? 'outdated'
    : 'current';
  const rulesetStatus = ruleset.id && ruleset.id !== local.rulesetId ? 'outdated' : 'current';
  return {
    checkedAt: new Date().toISOString(),
    app: {
      status: appStatus,
      localVersion: local.appVersion,
      localCommit: local.buildCommit,
      latestVersion: app.version || '',
      latestCommit: app.commit || '',
      buildTime: app.buildTime || '',
      sha256: app.sha256 || '',
      downloadUrl: app.downloadUrl || '',
      changelogUrl: app.changelogUrl || '',
      minSupportedVersion: app.minSupportedVersion || ''
    },
    ruleset: {
      status: rulesetStatus,
      localId: local.rulesetId,
      localConfidence: local.rulesetConfidence,
      latestId: ruleset.id || '',
      effectiveMonth: ruleset.effectiveMonth || '',
      confidence: normalizeRulesetConfidence(ruleset.confidence),
      sourceRef: ruleset.sourceRef || '',
      changelogUrl: ruleset.changelogUrl || ''
    },
    advisories: Array.isArray(manifest.advisories) ? manifest.advisories : []
  };
}

export function releaseCheckSummary(result) {
  if (!result) return 'Noch nicht geprüft.';
  if (!result.app || !result.ruleset) return result.error || 'Aktualitätscheck fehlgeschlagen.';
  const appText = result.app.status === 'outdated'
    ? `Neue App-Version ${result.app.latestVersion || result.app.latestCommit || ''} verfügbar.`
    : 'App-Version aktuell.';
  const rulesetText = result.ruleset.status === 'outdated'
    ? `Neuer Regulierungsstand ${result.ruleset.latestId} (${rulesetConfidenceLabels[result.ruleset.confidence]}) verfügbar.`
    : 'Regulierungsstand aktuell.';
  return `${appText} ${rulesetText}`;
}

function encodeLines(lines) {
  return encodeURIComponent(lines.filter(Boolean).join('\n'));
}

export function supportContext({ appVersion, buildCommit, buildTime, ruleset, lastReleaseCheck, userAgent }) {
  return {
    appVersion,
    buildCommit,
    buildTime,
    rulesetId: ruleset.id,
    rulesetEffectiveMonth: ruleset.effectiveMonth,
    rulesetConfidence: ruleset.confidence,
    rulesetSourceRef: ruleset.sourceRef,
    lastReleaseCheckAt: lastReleaseCheck?.checkedAt || '',
    userAgent: userAgent || ''
  };
}

export function supportIssueUrl(kind, context) {
  const type = ['bug', 'regulatory-update', 'feature'].includes(kind) ? kind : 'bug';
  const template = type === 'regulatory-update'
    ? 'regulatory_update.yml'
    : type === 'feature'
      ? 'feature_request.yml'
      : 'bug_report.yml';
  const title = type === 'regulatory-update'
    ? '[Regulierungsupdate] '
    : type === 'feature'
      ? '[Feature] '
      : '[Fehler] ';
  const body = encodeLines([
    '## Kontext aus der App (keine Modelldaten)',
    `- App-Version: ${context.appVersion}`,
    `- Build-Commit: ${context.buildCommit}`,
    `- Build-Zeit: ${context.buildTime}`,
    `- Ruleset: ${context.rulesetId}`,
    `- Ruleset-Konfidenz: ${context.rulesetConfidence}`,
    `- Ruleset-Quelle: ${context.rulesetSourceRef}`,
    `- Letzter Aktualitätscheck: ${context.lastReleaseCheckAt || 'nicht geprüft'}`,
    `- Browser: ${context.userAgent || 'unbekannt'}`,
    '',
    '## Beschreibung',
    'Bitte hier ergänzen. Modelldaten sind standardmäßig nicht enthalten.'
  ]);
  return `${repositoryUrl}/issues/new?template=${template}&title=${encodeURIComponent(title)}&body=${body}`;
}

export function supportPackage(context) {
  return {
    schemaVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    repository: repositoryUrl,
    privacy: 'Dieses Support-Paket enthält nur App-/Ruleset-/Browser-Kontext, keine Modell- oder Maßnahmenwerte.',
    context
  };
}
