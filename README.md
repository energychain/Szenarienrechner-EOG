# Szenarienrechner-EOG

Portfolio-App fuer regulierte Sparten: Basisdaten der Sparte, geplante Massnahmen und Szenarioannahmen werden in einer gemeinsamen EOG-, Rendite- und Finanzierungslogik gerechnet.

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
npm run build
```

## Auslieferung

```bash
npm run build
cp dist/index.html gas-massnahme-eog-rechner.html
```

`gas-massnahme-eog-rechner.html` bleibt das offline lauffaehige Single-File-Deliverable.

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
npm run build
sha256sum dist/index.html
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
