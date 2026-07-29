import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync('index.html', 'utf8');
const uiJs = readFileSync('src/ui.js', 'utf8');
const helpJs = readFileSync('src/contextual-help.js', 'utf8');

describe('sidecar bridge logic UX', () => {
  test('sidecar view offers task-oriented filters for bridge logic usability', () => {
    expect(indexHtml).toContain('id="sidecarModeFilter"');
    expect(indexHtml).toContain('offene Überleitungslogik');
    expect(indexHtml).toContain('quantifizierte Wirkung');
    expect(indexHtml).toContain('aktivierte Sidecars');
    expect(indexHtml).toContain('ohne Rechenwirkung');
    expect(uiJs).toContain('sidecarModeFilter');
    expect(uiJs).toContain('open_bridge_logic');
  });

  test('sidecar cards expose activation, quantification, warnings and next audit action', () => {
    expect(uiJs).toContain('data-help-id="sidecarBridgeLogic"');
    expect(uiJs).toContain('data-help-id="sidecarActivationStatus"');
    expect(uiJs).toContain('data-help-id="sidecarQuantificationStatus"');
    expect(uiJs).toContain('Sidecar sichtbar, wirtschaftliche Überleitung nicht modelliert');
    expect(uiJs).toContain('Wirkbeziehung beschrieben, Quantifizierung offen');
    expect(uiJs).toContain('Aktivierung verändert keine Kennzahl ohne freigegebene Mapping-Logik');
    expect(uiJs).toContain('Nächste Prüfaktion');
  });

  test('management report separates context, bridge status and activated markings', () => {
    expect(uiJs).toContain('Kontext- und Wirkobjekte / Sidecars');
    expect(uiJs).toContain('offene Überleitungslogik');
    expect(uiJs).toContain('quantifiziert, aber nicht aktiviert');
    expect(uiJs).toContain('aktiviert markiert');
  });

  test('field help explains bridge logic and activation gates', () => {
    expect(helpJs).toContain('sidecarBridgeLogic');
    expect(helpJs).toContain('sidecarActivationStatus');
    expect(helpJs).toContain('sidecarQuantificationStatus');
    expect(helpJs).toContain('Sidecar sichtbar, Überleitungslogik prüfpflichtig');
  });
});
