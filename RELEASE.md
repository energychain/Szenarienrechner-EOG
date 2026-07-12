# Szenarienrechner-EOG Release Process

Szenarienrechner-EOG wird als offline lauffaehiges Single-File-HTML-Artefakt ausgeliefert. Dieses Dokument beschreibt die reproduzierbare Erstellung und Pruefung.

## Voraussetzungen

```bash
npm ci
```

## Lokale Release-Prüfung

```bash
npm run lint
npm test
npm run typecheck
npm run build:release
npm run test:distribution
npm run test:docs
```

## Artefakte

- `dist/index.html`: technisches Vite-Buildartefakt.
- `dist/szenarienrechner-eog.html`: neutrales Release-Artefakt fuer Verteilung.

Beide Dateien sollen nach `npm run build:release` denselben Inhalt haben.

## Vertrauensprüfung

Vor einer Veroeffentlichung pruefen:

- Build enthaelt die erwartete Content-Security-Policy.
- Keine externen HTTP(S)-URLs im gebauten HTML.
- Keine Netzwerk-APIs im gebauten HTML.
- Apache-2.0-Lizenzhinweis ist sichtbar.
- Impressum stimmt mit `README.md` und `src/trust-content.js` ueberein.
- Demodaten sind synthetisch und enthalten keine realen Netzbetreiber.

## Versionierung

Bis zu formalen Releases wird `CHANGELOG.md` unter `Unreleased` gepflegt. Bei Release:

1. `CHANGELOG.md` von `Unreleased` auf Versionsnummer datieren.
2. `package.json` Version passend setzen.
3. Vollstaendige lokale Pruefung ausfuehren.
4. GitHub Release mit `dist/szenarienrechner-eog.html` als Artefakt erstellen.
5. SHA256 des Artefakts im Release-Text nennen.

## Keine automatische Fachfreigabe

Ein erfolgreiches Release ist nur technische Auslieferungsfaehigkeit. Fachliche Nutzung in produktiven Entscheidungen braucht eigene Pruefung gegen aktuelle regulatorische Grundlagen und Unternehmenskontext.
