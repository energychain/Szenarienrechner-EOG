# Aktualitäts-Erkennung und Support-Anbindung

Diese Dokumentation beschreibt die optionale Release-Awareness des Szenarienrechner-EOG.

Der Szenarienrechner bleibt offline-first: Beim Start, Rechnen, Importieren und Exportieren findet kein Netzzugriff statt. Für zwei bewusst ausgelöste Aktionen kann die Anwendung optional GitHub Pages bzw. GitHub öffnen.

## Zwei Versionsachsen

Die App unterscheidet zwei Stände:

- Anwendung / Engine: `appVersion`, `buildCommit`, `buildTime`
- Regulierungsparameter: `rulesetId`, `effectiveMonth`, `confidence`, `sourceRef`

Der Regulierungsstand trägt einen Konfidenzgrad:

- `enacted`: rechtskräftig
- `consultation`: Konsultationsstand
- `draft`: Entwurf

Diese Information erscheint als Badge in der App, in Exporten und im Report. Wenn ein Stand nicht `enacted` ist, weist der Report darauf hin, dass Entscheidungen unter Vorbehalt stehen.

## Aktualität prüfen

Die Aktion „Aktualität prüfen“ liest erst nach Bestätigung eine öffentliche Datei:

`release-manifest.json`

Dabei werden keine Modell-, Maßnahmen-, Browser- oder localStorage-Daten übertragen. Die App vergleicht die lokale App-/Ruleset-Kennung mit dem Manifest und zeigt getrennt an, ob Code oder Regulierungsstand veraltet sind. Ist eine neue HTML-Version verfügbar, zeigt die App den erwarteten SHA-256 aus dem Manifest an.

Falls kein Netz verfügbar ist oder das Manifest nicht erreichbar ist, bleibt die App vollständig nutzbar. Der letzte Prüfzeitpunkt wird im Modellzustand serialisiert.

## Release-Manifest

Das Manifest enthält:

- App-Version, Commit, Build-Zeit
- SHA-256 des Single-File-Artefakts
- Download- und Changelog-Link
- Ruleset-ID, Wirksamkeitsmonat, Konfidenz und Quellenreferenz
- optionale Advisories

Der Build erzeugt `dist/release-manifest.json` automatisch aus dem gebauten Artefakt und berechnet den SHA-256 der `szenarienrechner-eog.html`.

## GitHub-Support

Die Aktion „Feedback / Support melden“ öffnet ein vorbefülltes GitHub-Issue im Browser. Übergeben werden nur nicht-sensitive Metadaten:

- App-Version
- Build-Commit
- Build-Zeit
- Ruleset-ID und Konfidenz
- letzter Aktualitätscheck
- Browserkennung

Modelldaten werden nicht angehängt. Der Nutzer sieht das Issue-Formular und sendet es selbst ab.

Für Umgebungen ohne GitHub-Zugriff gibt es „Support-Paket exportieren“. Das erzeugt eine JSON-Datei mit demselben nicht-sensitiven Kontext, ebenfalls ohne Modell- oder Maßnahmenwerte.

## Datenschutz-Leitplanken

- Kein automatischer Netzzugriff beim Start.
- Aktualitätscheck nur per explizitem Klick und Bestätigung.
- Support-Issue nur durch Nutzeraktion im Browser.
- Kein automatisches Posten.
- Keine Modelldaten im Standard-Supportkontext.
- Offline-Artefakt bleibt voll funktionsfähig.
