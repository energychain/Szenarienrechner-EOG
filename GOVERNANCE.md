# Szenarienrechner-EOG Governance

Szenarienrechner-EOG ist ein neutrales Public-OSS-Projekt. Governance bedeutet hier: fachliche Neutralitaet, nachvollziehbare Modellannahmen, kleine PRs, reproduzierbare Tests und klare Abgrenzung zu Beratung.

## Projektprinzipien

- Keine realen Netzbetreiber, internen Unterlagen oder vertraulichen Inhalte.
- keine Rechts- oder Regulierungsberatung.
- Offline-first und keine Telemetrie.
- Fachliche Annahmen sind sichtbar, versionierbar und pruefpflichtig.
- Tests und Dokumentation sind Teil des Produkts, nicht Beiwerk.

## Rollen im Projekt

### Maintainer

Maintainer pruefen Scope, Neutralitaet, Tests, Build-Artefakt und Dokumentation. Sie duerfen technische Refactorings entscheiden, solange keine Fachlogik veraendert wird.

### Fachliche Reviewer

Fachliche Reviewer pruefen Modellannahmen, Quellenstand und Formulierungen. Sie entscheiden ueber fachliche Modelländerungen, nicht ueber rein technische Extraktionen.

### Beitragende

Beitragende liefern kleine PRs mit Testnachweis und klarer Beschreibung.

## Fachliche Modelländerungen

Fachliche Modelländerungen duerfen nicht beiläufig in UI-, Text- oder Refactoring-PRs versteckt werden. Sie brauchen:

- expliziten Abschnitt in der PR-Beschreibung,
- Quellen- oder Annahmenstand,
- Risiko-/Auswirkungsanalyse,
- passende Tests,
- Aktualisierung von `REGULATORY_ASSUMPTIONS.md` oder `MODEL.md`.

Beispiele:

- neue oder geaenderte EOG-Formel,
- andere Behandlung des vereinfachten Verfahrens,
- geaenderte KANU-/Abschreibungslogik,
- neue Gewichtung von Risiko, Effizienz oder Qualitaet,
- neue regulatorische Parameter.

## Technische Änderungen ohne Fachentscheidung

Diese Aenderungen koennen risikoarm umgesetzt werden, solange Tests gruen bleiben und keine Berechnungsergebnisse veraendert werden:

- Dokumentation und Checklisten,
- CI- und Testhaertung,
- Extraktion von UI-Modulen ohne Verhaltensaenderung,
- synthetische Demodaten klarer kennzeichnen,
- Import-/Export-Dokumentation,
- Release- und Sicherheitsdokumentation.

## Neutralitätsprüfung

Vor jedem PR muss geprueft werden:

- Kommen reale Organisationen, Orte, Projektlabels oder interne Begriffe vor?
- Wirken Demodaten wie echte Netzbetreiberdaten?
- Enthalten Screenshots oder JSON-Beispiele produktive Informationen?
- Wird eine regulatorische Interpretation als verbindlich formuliert?

Wenn ja, muss der PR neutralisiert oder fachlich freigegeben werden.

## Entscheidungslog

Wichtige Architektur- oder Modellentscheidungen sollen spaeter als ADRs dokumentiert werden. Bis dahin dienen `ROADMAP.md`, `REGULATORY_ASSUMPTIONS.md`, `MODEL.md` und PR-Beschreibungen als nachvollziehbarer Entscheidungsrahmen.
