# Szenarienrechner-EOG Data Format

Szenarienrechner-EOG speichert Arbeitsstaende lokal im Browserprofil und kann Modelle per JSON exportieren/importieren. Dieses Dokument beschreibt die erwartete Struktur auf Projekt-Ebene. Details koennen sich bis zu einem formal versionierten Schema noch entwickeln.

## Speicherorte

- `localStorage`: lokaler Arbeitsstand im Browserprofil.
- JSON-Export: manuell erzeugte Datei fuer Ablage, Austausch oder Archivierung.
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
- Report- und Gremienvorlagenzustand.

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

Ein spaeteres formales Schema sollte enthalten:

- `schemaVersion`,
- `modelVersion`,
- `regulatoryProfileId`,
- `createdAt` und `updatedAt`,
- klare Typen fuer Massnahmen, Annahmen, Szenarien und Historienereignisse,
- Migrationen fuer alte Projektstaende.
