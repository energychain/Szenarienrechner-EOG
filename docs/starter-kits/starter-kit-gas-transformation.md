# Starter-Kit: Gas-Transformation / Reinvestition

Dieses Starter-Kit beschreibt eine synthetische Planungsrunde für eine Gasnetzmaßnahme im Transformationskontext: Reinvestition, Rückbauoption oder befristete Ertüchtigung eines alternden Netzabschnitts.

## Typische Ausgangslage

Ein kleines Stadtwerk muss Versorgungspflicht, sinkende oder unsichere Gasnutzung, KANU-/Abschreibungsfragen und knappe Investitionsmittel zusammenbringen. Die zentrale Frage lautet nicht nur „investieren oder nicht“, sondern: Welche Reinvestition ist noch tragfähig, welche Wirkung ist zeitlich befristet, und welche Rückbau-/Restwertannahmen müssen vor einer Entscheidung geklärt werden?

## Workshop-Ziel

Am Ende des Workshops liegt vor:

- strukturierte Gas-Maßnahme mit Reinvestitionsmodus
- Gas-Transformationspfad für Weiterbetrieb, Stilllegung, physischen Rückbau, H2-/Umwidmung oder Belassen im Boden
- Trennung zwischen vereinfachtem Einmalabzug und optionalem Anlagenzugang
- HGB-/Rückstellungs-Check mit Wegfall der Ewigkeitsvermutung als prüfpflichtigem Punkt
- dokumentierte Annahmen zu Restnutzung, Rückbau, KANU und Wirkungslags
- konservativer Case ohne prüfpflichtige Wirkannahmen
- Liste der Punkte, die vor Gremienentscheidung fachlich freigegeben werden müssen

## Datenanforderung

| Datenpunkt | Typischer Lieferant | Verwendung in der App | Klärpunkt, falls offen |
| --- | --- | --- | --- |
| Zustand / Schadenshistorie | Asset Management / Betrieb | technische Notwendigkeit, Risiko | Eintrittswahrscheinlichkeit und Schadenshöhe |
| Restnutzung / Transformationsannahme | Strategie / Regulierung | Nutzungsdauer, Rückbaujahr, KANU-Kontext | keine politische Zukunftsannahme verstecken |
| Aktivierungsfähigkeit der Reinvestition | Bilanzierung | Reinvestitionsmodus `oneOff` oder `assetAddition` | HGB-/regulatorische Behandlung prüfen |
| Rückbaukosten | Projektleitung / Betrieb | wirtschaftliche Cashflow-Brücke | Zeitbezug und Unsicherheit dokumentieren |
| Stilllegung vs. physischer Rückbau | Technik / Recht / Projektleitung | Gas-Transformationspfad | Kostenarten und Verpflichtungsgrund nicht vermischen |
| Wegfall der Ewigkeitsvermutung | Bilanzierung / Regulierung / Recht | Rückstellungs-Check | dauerhaften Weiterbetrieb nicht ungeprüft unterstellen |
| Regulatorische Behandlung | Regulierungsmanagement | KAnEu-/Ist-Kosten-/Kostenpfad-Herleitung | keine Anerkennungszusage ableiten |
| OPEX-/Instandhaltungseffekt | Controlling / Betrieb | laufende Wirtschaftlichkeit | nur mit Quelle als Basisannahme setzen |

## Empfohlene App-Schritte

1. Sparte Gas wählen und Regulierungsstand prüfen.
2. Wirkungslags CAPEX/OPEX/QE prüfen; Default 0/3/2 bleibt prüfpflichtig.
3. Reinvestitionsmodus bewusst wählen:
   - `oneOff` für konservative Vereinfachung
   - `assetAddition` bei plausibler Aktivierungsfähigkeit
4. Gas-Transformationspfad je Gas-Maßnahme setzen: Pfad, Objektart, Pflicht-/Anspruchsgrund, Ewigkeitsvermutung, Rückstellungs-Check und regulatorische Behandlung.
5. Rückbaujahr und Rückbaukosten transparent dokumentieren; Stilllegungskosten und physische Rückbaukosten getrennt halten.
6. Rückstellung nur als prüfpflichtige Herleitung führen, nicht als automatische Entscheidung.
7. MIRR statt IRR beachten, wenn Rückbau/Reinvestition mehrere Vorzeichenwechsel erzeugt.
8. Gremienvorlage mit Auflagen formulieren, wenn Transformationsannahmen entscheidungstragend sind.

## Entscheidungsartefakte

- Maßnahmensteckbrief mit Reinvestitionslogik
- Klärpunktliste für Restnutzung, Stilllegung, Rückbau, Ewigkeitsvermutung, Rückstellung, KANU und Aktivierung
- Validierungsprotokoll bei echtem Bescheid-/Wirtschaftsplanabgleich
- HTML mit Daten speichern als versionierter Entscheidungsstand

## Beraterhinweis

Gas-Fälle sind häufig keine klassischen Wachstumsinvestitionen. Die App sollte als Struktur dienen, um Unsicherheit offen zu halten: Restnutzung, Stilllegung, Rückbau, Rückstellung, Reinvestition und regulatorische Behandlung sind prüfpflichtige Entscheidungsannahmen, keine automatischen Wahrheiten.
