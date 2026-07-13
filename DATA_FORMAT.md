# Szenarienrechner-EOG Data Format

Szenarienrechner-EOG speichert Arbeitsstaende lokal im Browserprofil und kann Modelle per JSON exportieren/importieren. Dieses Dokument beschreibt die erwartete Struktur auf Projekt-Ebene. Details koennen sich bis zu einem formal versionierten Schema noch entwickeln.

## Speicherorte

- `localStorage`: lokaler Arbeitsstand im Browserprofil.
- JSON-Export: manuell erzeugte Datei fuer Ablage, Austausch oder Archivierung.
- HTML-mit-Daten-Export: manuell erzeugte Single-File-App, die den aktuellen Projektstand als eingebetteten JSON-Block mitfuehrt.
- Keine Server-Speicherung, keine Telemetrie, keine automatischen Uploads.

Nutzerinnen und Nutzer muessen lokale Browserprofile und Exportdateien nach ihren eigenen IT- und Datenschutzvorgaben schuetzen.

## Inhaltliche Bereiche

Ein Projektstand kann enthalten:

- Basisdaten der Sparte und des Szenarios,
- Massnahmenportfolio,
- Wirkannahmen und Governance-Status,
- Szenarioannahmen,
- Import-/Review-Informationen,
- Historienereignisse,
- Prozessstatus mit kurzer Arbeitsstandnotiz und nächstem Abstimmungsschritt,
- Projektplan der Planungsrunde mit Meilensteinen, Aufgaben, Rollen, Fristen und Deep-Links,
- Aktualitäts-/Release-Kontext (`lastReleaseCheck`) und Build-/Ruleset-Provenienz,
- Report- und Gremienvorlagenzustand.

Aktueller Modellstand (`version: 8`) führt zusätzlich fachlich freigegebene Default-Konventionen für Wirkungsverzüge und Reinvestitionsfelder mit:

- `model.inputs.capexLagYears`, `model.inputs.opexLagYears`, `model.inputs.qeLagYears`: optionale Verzugsannahmen in Jahren. Fehlt ein Feld in alten Exporten, greift die aktuelle fachliche Vorbelegung 0/3/2, sofern der Import nicht bewusst andere Werte setzt.
- `measure.reinvestMode`: `oneOff` (Default, fachlich freigegebener vereinfachter Einmalabzug in der wirtschaftlichen Cashflow-Brücke) oder `assetAddition` (neuer Anlagenzugang mit eigener AfA-/Verzinsungskette).
- `measure.reinvestLife`: Nutzungsdauer des optionalen Reinvestitions-Anlagenzugangs; fehlt der Wert, wird die normale Maßnahmennutzungsdauer genutzt.

Die fachlich freigegebene Vorbelegung für neue Modelle lautet `capexLagYears = 0`, `opexLagYears = 3`, `qeLagYears = 2`. Diese Werte sind prüfpflichtige Startannahmen; importierte Altmodelle können sie überschreiben oder bei Migration die aktuellen Defaults übernehmen.

## Minimaler Projektumschlag

Ein formaler Export sollte langfristig aus einem stabilen Umschlag und einem fachlichen Payload bestehen. Der Umschlag macht Dateien pruefbar, ohne sofort jede fachliche Detailstruktur zu kennen.

```json
{
  "schemaVersion": "1.0.0",
  "modelVersion": "0.3.0",
  "regulatoryProfileId": "DE-ARegV-current",
  "regulatoryParameterSetId": "regulatory-parameters-2026-07",
  "regulatoryParameterConfidence": "consultation",
  "buildCommit": "abc123def456",
  "lastReleaseCheck": {
    "checkedAt": "2026-01-01T12:00:00.000Z",
    "app": { "status": "current" },
    "ruleset": { "status": "current" }
  },
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "source": "szenarienrechner-eog",
  "data": {
    "base": {},
    "measures": [],
    "assumptions": [],
    "scenarios": [],
    "history": [],
    "process": {
      "phase": "massnahmenbewertung",
      "resume": {
        "statusNote": "Arbeitsstand in einem Satz",
        "nextStep": "Nächste Abstimmung oder Entscheidung",
        "owner": "zuständige Rolle oder Gruppe",
        "dueDate": "2026-01-15",
        "updatedAt": "2026-01-01T00:00:00.000Z"
      }
    },
    "projectPlan": {
      "baseYear": 2027,
      "targetDecisionMilestone": "m7",
      "milestones": [
        {
          "id": "m3",
          "storyKey": "massnahmenbewertung",
          "title": "Maßnahmenbewertung",
          "plannedOffsetMonths": 3,
          "leadRole": "assetmanagement",
          "entryCriteria": "Stammdaten & Quellen erhoben",
          "exitArtifact": "vergleichbarer Maßnahmenkatalog",
          "tasks": [
            {
              "id": "m3-t3",
              "milestoneId": "m3",
              "title": "Aktivierbaren Anteil je Maßnahme bewerten",
              "ownerRole": "bilanzierung",
              "dueOffsetDays": 21,
              "deepLinkKey": "massnahmenbewertung",
              "targetView": "measures",
              "dependsOn": ["m3-t1"],
              "status": "open",
              "evidenceRequired": "beleg",
              "resultArtifact": "Aktivierbarkeitsprofil",
              "note": ""
            }
          ]
        }
      ]
    }
  }
}
```

### Felder

- `schemaVersion`: Version der Import-/Export-Struktur.
- `modelVersion`: Version der App oder Modelllogik, mit der die Datei erzeugt wurde.
- `regulatoryProfileId`: Kennung des verwendeten Regulierungsprofils. Bis zur Umsetzung versionierter Profile ist dies ein Ziel-Feld.
- `createdAt` / `updatedAt`: technische Zeitstempel der Datei, keine fachliche Freigabe.
- `source`: erzeugendes Werkzeug.
- `data`: fachlicher Payload.

#### `projectPlan`

`projectPlan` ist ein additives Feld fuer eine exemplarische Planungsrunde. Es ersetzt nicht `process.resume`, sondern strukturiert die Userstory-Meilensteine als operative Checkliste. Aktuelle Projektplan-Schema-Version: `1.1.0`.

- `baseYear`: Basisjahr der Terminableitung; Meilensteintermine werden aus `plannedOffsetMonths` berechnet.
- `targetDecisionMilestone`: Ziel-Gate fuer die rueckwaertsterminierte Entscheidung, standardmaessig `m7`.
- `milestones[]`: neun Meilensteine von Kick-off bis Beschluss/Archiv.
- `milestones[].storyKey`: identisch zum bestehenden `?story=<key>`-Deep-Link. Dadurch entsteht keine zweite Wahrheit fuer App-Navigation.
- `milestones[].tasks[]`: abhakbare Aufgaben mit Rolle, Frist, Abhaengigkeiten, Evidenzanforderung, Ergebnisartefakt, Status und Notiz.
- `status`: `open`, `in_progress`, `done` oder `blocked`.
- `source`: `template` oder `user`. Fehlende Werte aus alten `1.0.0`-Exporten gelten als `template`.
- `templateSkipped`: Vorlagenaufgaben koennen als bewusst nicht zutreffend markiert werden. Sie bleiben sichtbar, zaehlen aber nicht in Fortschritt oder abgeleitete Blockaden.
- `createdAt` / `origin`: optionale Herkunftsfelder fuer eigene Aufgaben.
- Eigene Aufgaben verwenden stabile IDs mit Praefix `user-...`; Template-IDs wie `m3-t4` bleiben dem Seed vorbehalten.

Beim Import alter Modelle ohne `projectPlan` erzeugt die App den exemplarischen Plan neu. Vorhandene Status-, Notiz-, `source`-, `templateSkipped`- und Herkunftsfelder werden beim Normalisieren erhalten; fachliche Werte werden durch den Plan nicht automatisch veraendert. Eigene Aufgaben reisen in JSON- und HTML-mit-Daten-Exporten mit. Beim Reset werden Template-Tasks auf den Seed-Zustand gesetzt; eigene Aufgaben werden standardmaessig behalten, koennen aber auf Nachfrage entfernt werden.

#### `lastReleaseCheck` und Ruleset-Provenienz

Der Aktualitätscheck ist ein optionaler, explizit ausgeloester GET auf `release-manifest.json`. Das Ergebnis wird als `lastReleaseCheck` gespeichert und in JSON-/HTML-mit-Daten-Exporten serialisiert. Es enthält nur Vergleichs- und Manifest-Metadaten, keine Modellwerte. Jeder Export trägt zusätzlich `buildCommit`, `buildTime`, `regulatoryParameterSetId`, `regulatoryParameterEffectiveMonth`, `regulatoryParameterConfidence` und `regulatoryParameterSourceRef`. Dadurch bleibt nachvollziehbar, ob ein Entscheidungsstand auf einem rechtskräftigen, konsultierten oder Entwurfs-Ruleset gerechnet wurde.

### Umgang mit unbekannten Feldern

Unbekannte Felder duerfen beim Import nicht still als fachlich valide behandelt werden. Die App sollte sie entweder erhalten und als unbekannt kennzeichnen oder den Import mit Review-Hinweis fortsetzen. Ein Import darf keine Fachannahme automatisch aktivieren, nur weil ein Feld vorhanden ist.

## Synthetische Demodaten

Demodaten in Szenarienrechner-EOG sind synthetisch. Sie duerfen keine realen Netzbetreiber, Projekte, internen Dokumente, Kundendaten oder vertraulichen Ortsbezeichnungen enthalten. Neue Beispieldaten muessen als synthetisch erkennbar sein.

## Import-Grundsätze

- Importierte Daten muessen vor Nutzung fachlich geprueft werden.
- Import darf keine stillen Netzwerkzugriffe ausloesen.
- Unbekannte oder zukuenftige Felder sollten nicht automatisch als fachlich valide gelten.
- Importierte Annahmen muessen in Report und Historie nachvollziehbar bleiben.

## Export-Grundsätze

- Exportdateien koennen sensible Planungsdaten enthalten.
- Export ist eine bewusste Nutzeraktion.
- Exportdateien sollten ausserhalb der App versioniert, geschuetzt und geloescht werden, wenn sie nicht mehr benoetigt werden.

## Schema-Roadmap

Ein spaeteres formales Schema sollte zusaetzlich enthalten:

- klare Typen fuer Massnahmen, Annahmen, Szenarien und Historienereignisse,
- Pflicht-/Optional-Kennzeichnung pro Feld,
- Validierungsregeln fuer Wertebereiche,
- Migrationen fuer alte Projektstaende.

## Migrationsregeln

Migrationen sollen explizit, klein und testbar sein:

- Jede Migration hat eine Quell- und Ziel-`schemaVersion`.
- Migrationen duerfen keine unbekannten Annahmen aktivieren.
- Entfernte Felder werden moeglichst in Historie oder Review-Hinweisen dokumentiert.
- Fehlerhafte oder unvollstaendige Dateien werden nicht still korrigiert, sondern zur Importpruefung markiert.
- Migrationen aendern keine fachlichen Berechnungsergebnisse ohne gesonderte Modelländerung.
