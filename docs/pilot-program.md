# Pilotprogramm: Szenarienrechner-EOG gemeinsam validieren

Der Szenarienrechner-EOG ist ein neues Open-Source-Werkzeug für regulierte Finanzplanung in Strom- und Gasverteilnetzen. Damit aus einem guten Werkzeug ein belastbarer Branchenstandard werden kann, braucht das Projekt fachliche Pilotanwenderinnen und Pilotanwender, die methodisch prüfen, Rückmeldungen öffentlich nachvollziehbar machen und eigene Verbesserungen beitragen.

Das Pilotprogramm wird von der STROMDAO GmbH als öffentlicher Open-Source-Beitrag begleitet. Die App selbst bleibt neutral, offline-first und unter Apache-2.0 verfügbar.

## Wen wir suchen

Gesucht werden Organisationen und Personen, die den Open-Source-Gedanken aktiv mittragen:

- Stadtwerke und Verteilnetzbetreiber mit regulierten Strom- oder Gas-Sparten,
- Regulierungsmanagement, Controlling, Asset Management, Anlagenbuchhaltung und Geschäftsführungsvorbereitung,
- Hochschulen, Forschungsgruppen und Energieökonomie-Lehrstühle,
- Beratungen und Expertinnen, die transparente Methoden statt Blackbox-Artefakte fördern,
- Open-Source-Energy-Communities und Civic-Tech-Gruppen mit Energiewirtschaftsbezug.

Ein guter Pilotbeitrag beginnt nicht mit vertraulichen Echtdaten, sondern mit einem öffentlichen Signal:

1. GitHub-Repository ansehen und bei Interesse einen Star vergeben.
2. Repository forken, um eigene Tests, Kommentare oder Verbesserungen nachvollziehbar vorzubereiten.
3. Demodaten oder synthetische interne Kopien verwenden, niemals vertrauliche Netz-, Bescheid- oder Projektdaten veröffentlichen.
4. Rückmeldung als GitHub Issue oder Pull Request einbringen.
5. Bei fachlichen Modellfragen Quellenstand, Annahmen und Grenzen offen dokumentieren.

## Pilotpfade

| Pfad | Zeitbedarf | Geeignet für | Ergebnis |
|---|---:|---|---|
| 30-Minuten-Selbsttest | 30 Minuten | Erstprüfung durch Controlling, Regulierung oder Management | Erste Rückmeldung zu Verständlichkeit, UI und Nutzen |
| Methodik-Review | 1-2 Stunden | Fachliche Reviewer, Beratung, Hochschulen | Issue mit Modellgrenzen, Begrifflichkeiten oder Quellenhinweisen |
| Real-but-private Benchmark | 0,5-2 Tage intern | Stadtwerke/VNB mit echten Unterlagen | Öffentlich nur anonymisierte Abweichungen und methodische Erkenntnisse |
| Pull-Request-Pilot | variabel | Entwickler, Open-Source-Gruppen, Hochschulen | Kleine PRs für Doku, Tests, Beispiele oder UI-Verbesserungen |
| Lehr-/Workshop-Pilot | 2-4 Stunden | Forschung, Lehre, interne Weiterbildung | Rückmeldung zu Starter-Kits, Rollenpfaden und Fallstudien |

## 30-Minuten-Selbsttest

1. Live-App öffnen: https://energychain.github.io/Szenarienrechner-EOG/
2. „Demodaten ansehen“ laden.
3. User-Story öffnen und einen Meilenstein per Deep Link in der App nachvollziehen.
4. Projektplan öffnen: Rollen, fällige Aufgaben und Klärpunkte prüfen.
5. Entscheidungsansicht und Management-Report lesen.
6. „HTML mit Daten speichern“ testen und die Datei wieder öffnen.
7. Optional „Aktualität prüfen“ auslösen und kontrollieren, dass keine Modelldaten übertragen werden.
8. GitHub Issue oder Pull Request mit Rückmeldung vorbereiten.

## Methodik-Review

Bitte prüfen Sie insbesondere:

- Sind Begriffe, Rollen und Planungslogik für Stadtwerke/VNB verständlich?
- Sind EOG-Wirkung, indikative Cashflow-Sicht und Governance-Urteil sauber getrennt?
- Sind konservative Urteile ohne prüfpflichtige Annahmen hilfreich?
- Sind MIRR, Wirkungsverzüge und Reinvestitionsoptionen nachvollziehbar dokumentiert?
- Fehlen typische Klärpunkte aus Regulierungsmanagement, Anlagenbuchhaltung, Treasury oder Asset Management?
- Welche öffentlichen Quellen oder regulatorischen Parameter sollten ergänzt werden?

## Real-but-private Benchmark

Echte Wirtschaftsplan-, EOG-, Kostenprüfungs- oder Bescheiddaten dürfen nicht öffentlich geteilt werden. Für einen belastbaren Pilot kann ein Unternehmen intern mit Echtdaten rechnen und öffentlich nur folgende Informationen zurückmelden:

- welche Modellannahme gepasst oder nicht gepasst hat,
- welche Abweichungsklasse auftrat, ohne Zahlen oder vertrauliche Details,
- welche Begriffe, Eingabefelder oder Reports unklar waren,
- welche fachliche Prüfung zusätzlich notwendig blieb,
- ob die Vorlage für eine reale Planungsrunde grundsätzlich brauchbar ist.

Dafür gibt es die Validierungsmethodik und ein Protokoll:

- https://energychain.github.io/Szenarienrechner-EOG/docs/validation-methodology.html
- https://energychain.github.io/Szenarienrechner-EOG/docs/templates/validation-protocol.html

## Open-Source-Beiträge

Willkommen sind kleine, überprüfbare Beiträge:

- Dokumentationsverbesserungen,
- synthetische Beispiele und Starter-Kits,
- Tests für Import, Export, Offline-Verteilung oder Berechnungsgrenzen,
- UI-Verbesserungen für Verständlichkeit und Re-Entry,
- öffentliche Quellenhinweise zu Regulierungsparametern,
- Übersetzungen oder Lehrmaterialien.

Fachliche Modelländerungen brauchen Quellenstand, Begründung, Testnachweis und klare Abgrenzung zu Rechts- oder Regulierungsberatung.

## Was nicht in öffentliche Issues gehört

Bitte nicht veröffentlichen:

- reale Netzbetreiber-, Kunden-, Projekt- oder Ortsnetzdaten,
- Bescheide, Kostenprüfungsunterlagen oder interne Wirtschaftsplanwerte,
- personenbezogene Daten,
- vertrauliche Beratungsunterlagen,
- Screenshots mit produktiven Daten,
- Annahmen, die als regulatorische Anerkennungszusage verstanden werden könnten.

## Call to action

Wenn Sie das Projekt unterstützen möchten:

1. Repository öffnen: https://github.com/energychain/Szenarienrechner-EOG
2. Star vergeben, wenn der Ansatz für Sie relevant ist.
3. Fork erstellen, wenn Sie selbst testen oder beitragen möchten.
4. Pilot-Feedback einreichen: https://github.com/energychain/Szenarienrechner-EOG/issues/new/choose
5. Pull Request mit kleinem, überprüfbarem Scope vorbereiten.

Die STROMDAO GmbH begleitet das Pilotprogramm als fachlicher und technischer Steward. Das Ziel ist ein transparentes, methodisch prüfbares Open-Source-Werkzeug, das kleine und mittlere Stadtwerke/VNB befähigt, regulierte Finanzplanung strukturierter und nachvollziehbarer vorzubereiten.
