# Szenarienrechner-EOG

Offline-first Open-Source-Werkzeug für regulierte Finanzplanung in Strom- und Gasverteilnetzen.

Der Szenarienrechner-EOG unterstützt kleine und mittlere Stadtwerke, EVUs und Verteilnetzbetreiber dabei, Maßnahmenportfolios strukturiert vorzubereiten: Budget, Aktivierung, HGB-/Controlling-Sicht, regulatorische EOG-Wirkung, Finanzierung, Annahmenqualität, Klärpunkte, Projektplan und Gremienvorlage werden in einem wiederaufnahmefähigen Arbeitsstand zusammengeführt.

Die App ist kein reiner EOG-Rechner. Sie ist ein geführter Arbeitsraum für regulierte Spartenplanung: technische Maßnahmen werden in finanzielle, regulatorische und entscheidungsfähige Sprache übersetzt, ohne dass sensible Planungsdaten an einen Server übertragen werden.

## Direkt ausprobieren

- Mini-Homepage: https://energychain.github.io/Szenarienrechner-EOG/
- Live-App: https://energychain.github.io/Szenarienrechner-EOG/app.html
- Geführte Arcade-Demo: https://app.arcade.software/share/ZlZVVMORTrNI4FxeSxlB
- Pilotprogramm: https://energychain.github.io/Szenarienrechner-EOG/docs/pilot-program.html
- User-Story als HTML/PDF-Handout: https://energychain.github.io/Szenarienrechner-EOG/story/planungsrunde-userstory.html
- Methodik & Vorlagen: https://energychain.github.io/Szenarienrechner-EOG/docs/index.html
- Methodikhandbuch: https://energychain.github.io/Szenarienrechner-EOG/docs/handbook/regulierte-finanzplanung-vnb.html
- Projektplan-Dokumentation: https://energychain.github.io/Szenarienrechner-EOG/docs/project-plan.html
- Starter-Kits: https://energychain.github.io/Szenarienrechner-EOG/docs/starter-kits/index.html
- Aktualitäts- und Supportkonzept: https://energychain.github.io/Szenarienrechner-EOG/docs/release-awareness.html
- KI-Prompt-Export: https://energychain.github.io/Szenarienrechner-EOG/docs/ai-prompts.html

Die Live-App läuft clientseitig im Browser. Für sensible Arbeitsstände ist die empfohlene Nutzung weiterhin: Offline-HTML herunterladen oder über „HTML mit Daten speichern“ eine eigenständige Datei mit eingebettetem Arbeitsstand erzeugen.

## Pilotanwender gesucht

STROMDAO begleitet den Szenarienrechner-EOG als offenen Pilot für methodisch prüfbare, offline-first Finanzplanung regulierter Sparten. Gesucht werden Stadtwerke, VNB, Forschung, Beratung und Open-Source-Energie-Communities, die nicht nur Feedback geben, sondern den Open-Source-Gedanken sichtbar mittragen:

1. Repository ansehen und bei Relevanz einen GitHub-Star vergeben.
2. Fork erstellen, wenn eigene Tests, synthetische Beispiele oder Verbesserungen vorbereitet werden.
3. Demodaten oder anonymisierte interne Kopien nutzen; keine vertraulichen Netz-, Bescheid-, Projekt- oder Unternehmensdaten veröffentlichen.
4. Feedback als Pilot-Issue einreichen oder einen kleinen Pull Request vorbereiten.
5. Methodische Hinweise mit Quellenstand, Annahmen und Grenzen dokumentieren.

Einstieg: https://energychain.github.io/Szenarienrechner-EOG/docs/pilot-program.html

## Für wen ist das gedacht?

Primäre Zielgruppen:

- Stadtwerke und Verteilnetzbetreiber mit regulierten Strom- und Gas-Sparten
- Controlling, Regulierungsmanagement, Asset Management, Anlagenbuchhaltung und Management/Gremienvorbereitung
- Beraterinnen, Berater und Forschungseinrichtungen, die regulierte Finanzplanung strukturieren oder validieren wollen
- Open-Source- und Energie-Communities, die transparente Werkzeuge für Netz- und Spartenplanung weiterentwickeln möchten

Typische Fragen, die die App strukturiert:

- Welche Maßnahmen gehören in den Wirtschaftsplan?
- Was ist CAPEX, was OPEX, was ist aktivierungsfähig?
- Welche Wirkung ist regulatorisch, welche wirtschaftlich, welche nur indikativ?
- Welche Annahmen sind belegt, welche prüfpflichtig, welche offen?
- Trägt ein Maßnahmenportfolio auch konservativ oder nur mit weichen Wirkannahmen?
- Welche Unterlagen, Klärpunkte und Rollen braucht eine entscheidungsreife Vorlage?

## Was die App kann

- Strom- und Gasmaßnahmen mit synthetischen oder eigenen Daten modellieren
- laufende EOG-Wirkung, Startjahr-Effekte und Einmaleffekte getrennt darstellen
- regulatorische EOG-Wirkung und indikative Cashflow-/IRR-/MIRR-Sicht trennen
- konservatives Urteil ohne prüfpflichtige Annahmen anzeigen
- „Robust tragfähig“, „Tragfähig mit Auflage“, „Nicht tragfähig“ und „Nicht entscheidungsreif“ unterscheiden
- MIRR statt uneindeutiger IRR nutzen, wenn Cashflows mehrere Vorzeichenwechsel haben
- Q-/Effizienz-Doppelzählungen als Klärpunkt sichtbar machen
- Wirkungsverzüge für CAPEX/OPEX/QE modellieren
- Reinvestitionen wahlweise vereinfacht oder als neuen Anlagenzugang modellieren
- optional ein erweitertes Kapitalkostenmodell mit EK/FK-Split und Abzugskapital nutzen
- Herleitungshelfer für CAPEX/OPEX, Risiko, Q-Wirkung, Nutzungsdauer/AfA und Finanzierungsspread anbieten
- Projektplan mit Meilensteinen, Rollen-Swimlanes, Abhängigkeiten, eigenen Aufgaben und nächster fälliger Aufgabe führen
- Reports, Gremienvorlagen, Validierungsprotokolle und Starter-Kits als HTML/PDF-fähige Artefakte bereitstellen
- rollenspezifische KI-Prompts lokal erzeugen, ohne KI-API oder automatische Übertragung
- spreadsheet-freundliche Tabellen als XLSX-Arbeitsmappe oder CSV-ZIP lokal exportieren, damit Maßnahmen, KPIs, Projektplan, Klärpunkte, Monitoring-/Netzausbauplan-Vorbereitung und Provenienz nicht im Tool-Silo bleiben
- App- und Ruleset-Aktualität nach expliziter Zustimmung prüfen
- Feedback oder Regulierungsupdates über GitHub-Issue-Formulare vorbereiten, ohne Modelldaten automatisch zu übertragen

## Was die App bewusst nicht tut

- keine Rechts-, Steuer-, Wirtschaftsprüfungs- oder Regulierungsberatung
- keine Anerkennungszusage für konkrete regulatorische Ansätze
- keine automatische Bescheidinterpretation
- keine Telemetrie, kein Tracking, keine Cookies
- keine automatische Datenübertragung beim Start oder Rechnen
- kein Ersatz für fachliche Prüfung, Unternehmensfreigabe oder regulatorische Abnahme

Die App ist ein Strukturierungs-, Plausibilisierungs- und Dokumentationswerkzeug. Produktive Entscheidungen müssen gegen aktuelle Rechtsstände, Festlegungen, Bescheide, Kostenprüfungen und interne Freigaben geprüft werden.

## Pilotstatus und Reifegrad

Der aktuelle Stand ist für eine kontrollierte breite Pilotnutzung geeignet: technisch lauffähig, offline verteilbar, deterministisch getestet und mit Governance-/Provenienzmechanismen ausgestattet.

Ein produktiver TRL-6-Nachweis erfordert weiterhin eine reale, nicht öffentliche Validierung gegen Wirtschaftsplan, EOG-/Regulierungsunterlagen und fachliche Freigabe durch Regulierungsmanagement. Dafür gibt es Methodik und Vorlage:

- Validierungsmethodik: https://energychain.github.io/Szenarienrechner-EOG/docs/validation-methodology.html
- Validierungsprotokoll: https://energychain.github.io/Szenarienrechner-EOG/docs/templates/validation-protocol.html

## Empfohlener 30-Minuten-Selbsttest

1. Live-App öffnen oder Offline-HTML nutzen.
2. Optional die geführte Arcade-Demo ansehen, um den roten Faden „von der Netzmaßnahme zur belastbaren Investitionsentscheidung“ nachzuvollziehen.
3. „Demodaten ansehen“ laden.
4. Projektplan öffnen und die Rollen-/Meilensteinstruktur prüfen.
5. In der Entscheidungsansicht die Governance-Ampel lesen.
6. EOG-/Cashflow-Überleitung und EOG-Zerlegung ansehen.
7. „HTML mit Daten speichern“ testen und die erzeugte Datei erneut öffnen.
8. „Tabellen als XLSX exportieren“ testen: Maßnahmen, Szenarien/KPIs, Projektplan und Provenienz müssen als weiterverwendbare Tabellenblätter vorliegen.
9. Optional „Aktualität prüfen“ ausführen und bestätigen, dass keine Modelldaten übertragen werden.
10. Feedback über GitHub Issue oder Support-Paket vorbereiten.

## Pilot-Feedback erwünscht

Gesucht wird fachliches Feedback von EVUs, VNBs, Stadtwerken, Forschung, Beratung und Open-Source-Energie-Communities.

Besonders wertvoll sind Rückmeldungen zu:

- Verständlichkeit der Finanz-/Regulatorik-Narrative
- Modellgrenzen, Begrifflichkeiten und fachlichen Annahmen
- Nutzbarkeit der Projektplan- und Gremienlogik
- Eignung der Starter-Kits und Vorlagen für reale Planungsrunden
- fehlenden Regulierungsparametern oder geänderten Rulesets
- Validierung gegen reale, aber nicht öffentliche Fälle

Bitte keine vertraulichen Netz-, Bescheid-, Projekt- oder Unternehmensdaten in öffentliche Issues posten. Für Support ohne Modelldaten gibt es die In-App-Aktion „Support-Paket exportieren“.

## Offline-Verteilung

Die Datei kommt zum Nutzer, nicht der Nutzer zur URL. Die Anwendung wird als einzelne HTML-Datei verteilt und per Doppelklick lokal im Browser geöffnet.

```bash
npm ci
npm run build:release
```

Wichtigste Artefakte:

- `dist/index.html`: statische Mini-Homepage mit Positionierung, Featurelisten, Kontakt und Einstieg in App/Dokumentation
- `dist/app.html`: browserfähige Live-App für GitHub Pages
- `dist/szenarienrechner-eog.html`: offline lauffähige Single-File-App
- `dist/release-manifest.json`: Manifest mit App-/Ruleset-Stand und SHA-256
- `dist/story/planungsrunde-userstory.html`: User-Story als HTML/PDF-Handout
- `dist/docs/index.html`: Einstieg in Methodik, Vorlagen, Starter-Kits und Lernpfade

In der App selbst:

- „Daten herunterladen“ erzeugt ein separates JSON-Modell.
- „HTML mit Daten speichern“ erzeugt eine weitergabefähige Single-File-App mit eingebettetem Modellstand.
- „Tabellen als XLSX exportieren“ erzeugt lokal eine Excel-Arbeitsmappe mit Übersicht, Maßnahmen, Szenarien/KPIs, Jahreswerten, Projektplan, Klärpunkten und Provenienz.
- „Tabellen als CSV-ZIP exportieren“ erzeugt dieselben Tabellen als Excel-kompatible CSV-Dateien für Systeme, die kein XLSX importieren.
- Beim Öffnen einer HTML-mit-Daten-Datei wird der eingebettete Stand vor eventuell vorhandenen Browserdaten geladen.
- „Browserdaten löschen“ entfernt lokal gespeicherte Modelle aus dem Browserprofil.

## Datensouveränität und Aktualität

- Kein automatischer Netzzugriff beim Start, Rechnen, Importieren oder Exportieren.
- Keine externen Skripte, Fonts, Styles oder Bilder.
- Speicherung erfolgt lokal im Browserprofil (`localStorage`) und über manuelle Exporte.
- `connect-src` erlaubt nur den bewusst ausgelösten Abruf von `https://energychain.github.io` für `release-manifest.json`.
- „Aktualität prüfen“ liest nach Bestätigung nur das öffentliche Manifest und überträgt keine Modelldaten.
- „Feedback / Support melden“ öffnet ein vorbefülltes GitHub-Issue; der Nutzer sieht und sendet es selbst.
- „Support-Paket exportieren“ enthält nur nicht-sensitive Metadaten, keine Maßnahmenwerte.

IT-Prüfung:

```bash
npm ci
npm run build:release
npm run test:distribution
sha256sum dist/szenarienrechner-eog.html
```

## Dokumentation und Ökosystem

Zentrale Projektdokumente:

- `docs/ecosystem/index.md`: Übersicht zum Beratungs-/Methodik-Ökosystem
- `docs/story/planungsrunde-userstory.md`: fiktive mehrmonatige Planungsrunde als User-Story
- `docs/project-plan.md`: Projektplan-Ansicht mit Meilensteinen, Rollen, Abhängigkeiten und eigenen Aufgaben
- `docs/release-awareness.md`: Aktualitäts-Erkennung, Ruleset-Konfidenz und GitHub-Support
- `docs/handbook/regulierte-finanzplanung-vnb.md`: Methodikhandbuch
- `docs/regulatory-map.md`: öffentliche Quellen und Einordnung zu Strom/Gas-Regulatorik
- `docs/templates/`: Maßnahmensteckbrief, Gremienvorlage, Klärpunktliste, Datenanforderung, Workshopagenda, Validierungsprotokoll
- `docs/starter-kits/`: Strom-Ortsnetz, Gas-Transformation, Spartenportfolio
- `docs/guides/`: rollenbasierte Lernpfade
- `docs/examples/`: synthetische Fallstudien
- `MODEL.md`: Modellüberblick und Rechenkontext
- `REGULATORY_ASSUMPTIONS.md`: regulatorische Annahmen und Grenzen
- `DATA_FORMAT.md`: lokaler Speicher, JSON-Export, HTML-mit-Daten und Migration
- `GOVERNANCE.md`: Maintainer-, Review- und Neutralitätsregeln
- `RELEASE.md`: Build- und Release-Prozess
- `CHANGELOG.md`: Änderungshistorie
- `docs/adr/`: Architekturentscheidungen

## Entwicklung

```bash
npm ci
npm run dev
```

Der Rechenkern liegt DOM-frei in `src/engine.js`. Regulatorische Parametersätze liegen versioniert unter `src/rulesets/`. UI-Helfer, Demo-Daten, Projektplan, Story-Navigation, Export- und Release-Awareness-Logik sind schrittweise modularisiert.

Qualitätssicherung:

```bash
npm run lint
npm test
npm run typecheck
npm run build:release
npm run test:distribution
npm run test:docs
```

## Lizenz

Der Code steht unter Apache License 2.0, siehe `LICENSE`. App-Footer, Repository-Lizenz und Dokumentation verwenden dieselbe Lizenzangabe.

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
