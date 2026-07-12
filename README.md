# Szenarienrechner-EOG

Portfolio-App fuer regulierte Sparten: Basisdaten der Sparte, geplante Massnahmen und Szenarioannahmen werden in einer gemeinsamen EOG-, Rendite- und Finanzierungslogik gerechnet.

Die App ist ein generisches Open-Source-Werkzeug. Demodaten, Namen, Annahmen und Gremientexte sind synthetisch und duerfen nicht als Referenz auf reale Netzbetreiber, Projekte oder interne Unterlagen gelesen werden.

## Projektstatus

Szenarienrechner-EOG ist ein offline-first Public-OSS-Projekt. Die naechsten Ausbauschritte stehen in `ROADMAP.md`. Beitraege folgen `CONTRIBUTING.md`; Sicherheits- und Vertrauensannahmen stehen in `SECURITY.md`.

## Entwicklung

```bash
npm ci
npm run dev
```

Der Rechenkern liegt DOM-frei in `src/engine.js`, die UI in `src/ui.js`, das Styling in `src/styles.css`.

## Qualitaetssicherung

```bash
npm run lint
npm test
npm run typecheck
npm run build:release
npm run test:distribution
npm run test:docs
```

## Auslieferung

```bash
npm run build:release
```

`dist/szenarienrechner-eog.html` ist das offline lauffaehige Single-File-Deliverable. `dist/index.html` bleibt das technische Vite-Buildartefakt. Details stehen in `RELEASE.md`.

Optional stellt GitHub Pages den aktuellen `main`-Stand als statische Browser-Version bereit:

- https://energychain.github.io/Szenarienrechner-EOG/

Auch diese Variante bleibt clientseitig: Die HTML-Datei wird von GitHub Pages geladen, danach erfolgen keine fachlichen Server-Uploads, keine Telemetrie und keine Netzwerk-APIs aus der App heraus. Sensible Planungsdaten sollten weiterhin bevorzugt ueber lokale Offline-Dateien und manuelle JSON-Exporte bearbeitet werden.

## Lizenz

Der Code steht unter Apache License 2.0, siehe `LICENSE`. App-Footer, Repository-Lizenz und Dokumentation verwenden dieselbe Lizenzangabe.

## Fachliche Annahmen und Grenzen

Der Rechner bildet ein generisches Planungsmodell fuer regulierte Sparten ab. Er ersetzt keine Rechts-, Steuer-, Wirtschaftspruefungs- oder Regulierungsberatung. Regulatorische Parameter, Periodenlogik und Modellgrenzen sind in `REGULATORY_ASSUMPTIONS.md` dokumentiert und muessen vor produktiven Entscheidungen gegen den jeweils aktuellen Stand von Gesetzgebung, Festlegungen und unternehmensspezifischen Bescheiden geprueft werden.

Weitere Projektdokumente:

- `MODEL.md`: Modellueberblick und Rechenkontext.
- `GOVERNANCE.md`: Maintainer-, Review- und Neutralitaetsregeln.
- `DATA_FORMAT.md`: lokaler Speicher, JSON-Export und Importgrundsaetze.
- `CHANGELOG.md`: Aenderungshistorie.
- `docs/adr/`: Architekturentscheidungen.

## Offline-Verteilung und Verifikation

Die Datei kommt zum Nutzer, nicht der Nutzer zur URL. Die Anwendung wird als einzelne HTML-Datei verteilt und per Doppelklick lokal im Browser geoeffnet.

- Keine Netzwerkverbindung: CSP-erzwungen mit `connect-src 'none'` und `default-src 'none'`.
- Keine Telemetrie, keine Cookies, keine externen Skripte, Styles, Fonts oder Bilder.
- Speicherung erfolgt nur im lokalen Browserprofil (`localStorage`) und ueber manuellen JSON-Export.
- Funktion `Browserdaten löschen` entfernt die lokal gespeicherten Modelle aus dem Browserprofil.
- Shared-/Terminal-PCs: Modelle koennen im Browserprofil verbleiben; nach Nutzung Browserdaten loeschen oder nur mit manuellem JSON-Export arbeiten.

IT-Pruefung:

```bash
npm ci
npm run build:release
npm run test:distribution
sha256sum dist/szenarienrechner-eog.html
```

Beim lokalen Oeffnen zeigt der F12-Netzwerk-Tab keine Requests. Der CSP-Meta-Tag ist im Quelltext der HTML-Datei sichtbar.

## Impressum

### Angaben gemäß § 5 DDG

- STROMDAO GmbH
- Gerhard Weiser Ring 29
- 69256 Mauer
- Deutschland

### Vertreten durch

Thorsten Zoerner (Geschäftsführer)

### Kontakt

- E-Mail: kontakt@stromdao.de
- Telefon: +49 6226 9680090

### Registereintrag

Amtsgericht Mannheim HR-B 728691

### Umsatzsteuer-ID

USt-ID: DE314368974

### Verantwortlich für den Inhalt

Geschäftsführer: Thorsten Zoerner, Gerhard Weiser Ring 29, 69256 Mauer
