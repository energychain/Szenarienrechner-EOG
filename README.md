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

Auch diese Variante bleibt clientseitig: Die HTML-Datei wird von GitHub Pages geladen, danach erfolgen keine fachlichen Server-Uploads und keine Telemetrie. Nur die explizite Aktion `Aktualität prüfen` liest nach Bestätigung die öffentliche `release-manifest.json`; Support-Issues werden nur nach Nutzeraktion im Browser geöffnet. Sensible Planungsdaten sollten weiterhin bevorzugt ueber lokale Offline-Dateien und manuelle JSON- oder HTML-mit-Daten-Exporte bearbeitet werden.

## Lizenz

Der Code steht unter Apache License 2.0, siehe `LICENSE`. App-Footer, Repository-Lizenz und Dokumentation verwenden dieselbe Lizenzangabe.

## Fachliche Annahmen und Grenzen

Der Rechner bildet ein generisches Planungsmodell fuer regulierte Sparten ab. Er ersetzt keine Rechts-, Steuer-, Wirtschaftspruefungs- oder Regulierungsberatung. Regulatorische Parameter, Periodenlogik und Modellgrenzen sind in `REGULATORY_ASSUMPTIONS.md` dokumentiert und muessen vor produktiven Entscheidungen gegen den jeweils aktuellen Stand von Gesetzgebung, Festlegungen und unternehmensspezifischen Bescheiden geprueft werden.

Weitere Projektdokumente:

- `docs/ecosystem/index.md`: Übersicht zum Beratungs-/Methodik-Ökosystem mit Navigation zu Handbuch, Projektplan, Vorlagen, Lernpfaden und Fallstudien.
- `docs/project-plan.md`: Dokumentation der Projektplan-Ansicht mit Meilensteinen, Rollen-Swimlanes, Abhängigkeiten, eigenen Aufgaben und Reset-/Export-Verhalten.
- `docs/release-awareness.md`: Aktualitäts-Erkennung, Ruleset-Konfidenz, Release-Manifest und GitHub-Support-Leitplanken.
- `docs/handbook/regulierte-finanzplanung-vnb.md`: Methodikhandbuch für regulierte Finanzplanung kleiner VNBs.
- `docs/regulatory-map.md`: öffentliche Quellen und Einordnung zu Strom/Gas-Regulatorik.
- `docs/templates/`: Maßnahmensteckbrief, Gremienvorlage, Klärpunktliste, Datenanforderung und Workshopagenda.
- `docs/guides/`: rollenbasierte Lernpfade für Management, Controlling, Regulierung, Asset Management und Anlagenbuchhaltung.
- `docs/examples/`: synthetische Fallstudien für Strom, Gas und Spartenportfolio.
- `docs/story/planungsrunde-userstory.md`: Markdown-Quelle der fiktiven mehrmonatigen Planungsrunde.
- `dist/story/planungsrunde-userstory.html`: aus der Markdown-Quelle gebauter HTML-Story-Export für GitHub Pages und Browser-Nutzung.
- `dist/docs/index.html`: aus den Ökosystem-Dokumenten gebauter HTML/PDF-Einstieg für GitHub Pages und Browser-Nutzung.
- `MODEL.md`: Modellueberblick und Rechenkontext.
- `GOVERNANCE.md`: Maintainer-, Review- und Neutralitaetsregeln.
- `DATA_FORMAT.md`: lokaler Speicher, JSON-Export und Importgrundsaetze.
- `CHANGELOG.md`: Aenderungshistorie.
- `docs/adr/`: Architekturentscheidungen.

## Offline-Verteilung und Verifikation

Die Datei kommt zum Nutzer, nicht der Nutzer zur URL. Die Anwendung wird als einzelne HTML-Datei verteilt und per Doppelklick lokal im Browser geoeffnet.

- Kein automatischer Netzzugriff beim Start: CSP-erzwungen mit `default-src 'none'`; `connect-src` erlaubt nur den bewusst ausgelösten Abruf von `https://energychain.github.io` für `release-manifest.json`.
- Keine Telemetrie, keine Cookies, keine externen Skripte, Styles, Fonts oder Bilder.
- Speicherung erfolgt nur im lokalen Browserprofil (`localStorage`) und ueber manuelle Exporte.
- `Daten herunterladen` erzeugt weiterhin ein separates JSON-Modell fuer Archivierung und Versionsvergleich.
- `HTML mit Daten speichern` erzeugt eine weitergabefaehige Single-File-App, in der der aktuelle Modellstand als eingebetteter JSON-Block enthalten ist. Beim Oeffnen dieser Datei wird der eingebettete Stand vor eventuell vorhandenen Browserdaten geladen und wieder lokal gespeichert.
- Funktion `Browserdaten löschen` entfernt die lokal gespeicherten Modelle aus dem Browserprofil.
- Shared-/Terminal-PCs: Modelle koennen im Browserprofil und in manuell erzeugten Exportdateien verbleiben; nach Nutzung Browserdaten loeschen und Exportdateien nach den eigenen IT-Vorgaben schuetzen oder loeschen.

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
