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
- Report- und Gremienvorlagenzustand.

## Minimaler Projektumschlag

Ein formaler Export sollte langfristig aus einem stabilen Umschlag und einem fachlichen Payload bestehen. Der Umschlag macht Dateien pruefbar, ohne sofort jede fachliche Detailstruktur zu kennen.

```json
{
  "schemaVersion": "1.0.0",
  "modelVersion": "0.3.0",
  "regulatoryProfileId": "DE-ARegV-current",
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
