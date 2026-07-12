# Szenarienrechner-EOG Security Policy

Szenarienrechner-EOG verarbeitet potentiell sensible Planungs-, Investitions- und Portfoliodaten im Browser der Nutzerinnen und Nutzer. Sicherheit bedeutet hier vor allem: Offline-Faehigkeit, keine Datenabfluesse, transparente Artefakte und vorsichtiger Umgang mit Beispieldaten.

## Unterstützte Versionen

Das Projekt ist jung. Sicherheits- und Vertrauensfixes werden fuer den aktuellen `main`-Stand und die jeweils letzte veroeffentlichte Single-File-HTML-Auslieferung betrachtet.

## Sicherheitsmodell

- Die Anwendung ist als offline lauffaehige Single-File-HTML-Datei konzipiert.
- Der gebaute HTML-Stand darf keine externen HTTP(S)-URLs enthalten.
- Netzwerk-APIs wie `fetch`, `XMLHttpRequest`, `WebSocket` und `EventSource` duerfen nicht im gebauten Artefakt verwendet werden.
- Speicherung erfolgt lokal im Browserprofil ueber `localStorage` und ueber manuellen JSON-Export.
- Das Projekt erhebt keine Telemetrie und setzt keine Cookies.

## Melden von Schwachstellen

Bitte melde Sicherheitsprobleme verantwortungsvoll ueber ein privates GitHub Security Advisory oder, falls nicht verfuegbar, per Kontakt aus dem Impressum in `README.md`.

Bitte oeffentlich keine Beispiel-JSONs, Screenshots oder Reports posten, wenn sie reale Netz-, Investitions- oder Unternehmensdaten enthalten koennten.

## Was als Sicherheitsproblem gilt

- Externe Netzwerkzugriffe im Build-Artefakt.
- Einfuehrung von Drittanbieter-Skripten, Fonts, Bildern oder Telemetrie.
- Speicherung sensibler Daten ausserhalb des lokalen Browserprofils ohne klare Nutzeraktion.
- Beispiel- oder Testdaten, die reale Netzbetreiber, Projekte oder interne Unterlagen erkennen lassen.
- XSS- oder HTML-Injection-Risiken in Import, Report oder Gremienvorlagen.

## Was nicht als Sicherheitszusage gilt

Szenarienrechner-EOG ist keine zertifizierte Sicherheitssoftware und keine Rechts- oder Regulierungsberatung. Nutzerinnen und Nutzer muessen produktive Daten, Browserprofile und Exportdateien entsprechend ihrer eigenen IT- und Datenschutzvorgaben schuetzen.
