# Projektplan: Planungsrunde steuern statt nur rechnen

Der Projektplan ist das operative Struktur-Element im Szenarienrechner-EOG. Er macht aus der fiktiven User-Story eine mitlaufende Planungsrunde: Meilensteine, Rollen, Aufgaben, Fristen, Abhängigkeiten, Klärpunkte und Deep-Links in die passende App-Sicht werden in einem gemeinsamen Arbeitsstand geführt.

## Zweck

Regulierte Finanzplanung ist kein linearer Rechenlauf. Zwischen Kick-off, Datenanforderung, Maßnahmenbewertung, Technikrückkopplung, Konsolidierung, Entscheidungsvorlage, Gremium und Archiv entstehen Aufgaben, Rückfragen und Freigaben. Der Projektplan hält diese Arbeit sichtbar:

- Welche Aufgabe ist als Nächstes fällig?
- Welche Rolle ist verantwortlich?
- Welche Vorgänger müssen zuerst erledigt sein?
- Welche Template-Schritte sind bewusst übersprungen?
- Welche eigenen Aufgaben hat das Team ergänzt?
- An welcher Stelle der App wird die Aufgabe bearbeitet?

Damit wird die App nicht nur zum Rechner, sondern zum wiederaufnahmefähigen Arbeitsstand einer Planungsrunde.

## Struktur des Plans

Der exemplarische Plan besteht aus neun Meilensteinen der User-Story:

| Meilenstein | Story-Key | Typischer Zeitpunkt | Zweck |
|---|---|---|---|
| M0 Kick-off | `kickoff` | Anfang Januar | Entscheidungszweck, Rollen und Arbeitsmodus klären |
| M1 Initialisierung | `initialisierung` | Mitte Januar | Stammdaten und Datenanforderung vorbereiten |
| M2 Datenerhebung | `datenerhebung` | Februar | Quellen, Werte und Klärpunkte sammeln |
| M3 Maßnahmenbewertung | `massnahmenbewertung` | Ende März | Budgetpositionen in Maßnahmenobjekte übersetzen |
| M4 Technische Rückkopplung | `technik-rueckkopplung` | April | Wirkannahmen, Evidenz und Governance-Status prüfen |
| M5 Konsolidierung | `konsolidierung` | Mai | Managementsicht, Finanzierung und Beschlussoption schärfen |
| M6 Entscheidungsvorlage | `entscheidungsvorlage` | Juni | Report, Lesehinweise und Freigaben vorbereiten |
| M7 Gremienvorlage | `gremium` | Ende Juni | Vorlage finalisieren und Beschluss dokumentieren |
| M8 Beschluss / Archiv | `archiv` | September | Auflagen, Monitoring und Folgerunde sichern |

Die Zeitachse wird aus dem Modell-Startjahr abgeleitet. Verschiebt sich das `baseYear`, verschiebt sich der exemplarische Plan entsprechend.

## Rollen-Swimlanes

Aufgaben sind Rollen zugeordnet. Die Projektplan-Ansicht zeigt je Rolle die nächste freigegebene Aufgabe und die erledigten Aufgaben.

| Rolle | Typischer Beitrag |
|---|---|
| Modellverantwortung | Arbeitsstand, Reset, Import/Export, Report und Prozessstatus halten |
| Regulierungsmanagement | EOG-Kontext, Verfahren, Wirkannahmen und regulatorische Grenzen prüfen |
| Anlagenbuchhaltung / Bilanzierung | Aktivierbarkeit, Nutzungsdauer, AfA und CAPEX/OPEX-Abgrenzung klären |
| Asset Management / Netzbetrieb | technische Notwendigkeit, Maßnahmenstatus und Risiken einordnen |
| Controlling / Finanzierung | Budgetanschluss, FK-Zins, Kapitalwert und Wirtschaftsplanbezug plausibilisieren |
| Management / Gremium | Entscheidung, Auflagen, Priorisierung und Beschlussfähigkeit bewerten |
| Einkauf / Projektleitung | Kosten, Termine, Umsetzungsstand und Projektfristen aktualisieren |

## Abhängigkeiten und Blockaden

Der Projektplan nutzt `dependsOn`, um Aufgaben fachlich zu ordnen. Eine Aufgabe ist abgeleitet blockiert, solange mindestens ein Vorgänger nicht erledigt oder nicht bewusst übersprungen ist. Der gespeicherte Status wird dabei nicht überschrieben.

Beispiel: Eine Maßnahmenbewertung kann erst freigegeben werden, wenn die Datenanforderung abgeschlossen ist. Die blockierte Aufgabe bleibt sichtbar, aber Statuswechsel und Sprung in die App sind gesperrt, bis die Vorgänger erledigt sind.

Die Kopfzeile und Rollen-Swimlanes nutzen diesen effektiven Zustand. Dadurch wird der Plan handlungsleitend: Er zeigt nicht nur eine Checkliste, sondern die nächste fachlich mögliche Aufgabe.

## Eigene Aufgaben und übersprungene Template-Schritte

Der Seed-Plan ist exemplarisch. Reale EVU-Planungsrunden brauchen zusätzliche interne Freigaben, Sonderprüfungen oder Gremienschritte. Deshalb trennt der Projektplan die Herkunft jeder Aufgabe:

| Herkunft | Verhalten |
|---|---|
| `template` | Bestandteil der exemplarischen Planungsrunde; nicht löschbar, aber als `nicht zutreffend` überspringbar |
| `user` | vom Team ergänzte Aufgabe; editierbar, löschbar und exportierbar |

Übersprungene Template-Schritte bleiben sichtbar. Das ist Absicht: In regulierter Finanzplanung ist es oft genauso wichtig zu dokumentieren, dass ein Schritt bewusst nicht relevant war, wie eine Aufgabe abzuhaken.

Eigene Aufgaben erhalten stabile `user-...`-IDs. Beim Löschen werden verwaiste Abhängigkeiten bereinigt. Neue Abhängigkeiten werden auf Zyklen geprüft.

## Deep-Link-Kreis zwischen Projektplan und App

Jede Aufgabe kann in die passende App-Sicht springen. Der Plan nutzt dieselben Story-Keys wie die User-Story, zum Beispiel `?story=massnahmenbewertung`. Zusätzlich kann eine echte App-Sicht wie `measures`, `results`, `report` oder `basis` gesetzt werden.

Der Navigationskreis lautet:

1. Im Projektplan eine Aufgabe auswählen.
2. Per `Zur App` in die passende Sicht springen.
3. Die App setzt Prozesskontext und zeigt die aktive Aufgabe im Prozesshinweis.
4. Status, Notiz und Ergebnisartefakt bleiben im Projektplan pflegbar.
5. Der gesamte Stand reist mit JSON-Export und `HTML mit Daten speichern`.

## Reset und Persistenz

Der Projektplan ist Teil des Modell-JSON:

- Template-Aufgaben werden beim Reset auf den Seed-Zustand zurückgesetzt.
- Eigene Aufgaben werden standardmäßig behalten; sie können auf Nachfrage entfernt werden.
- Status, Notizen, Herkunft, übersprungene Schritte und aktive Aufgabe reisen in JSON- und HTML-mit-Daten-Exporten mit.
- Ältere Modelle ohne `projectPlan` erhalten beim Laden automatisch den exemplarischen Plan.

## Verwendung in einer Planungsrunde

Empfohlene Arbeitsweise:

1. Beim Kick-off den Projektplan öffnen und Rollen prüfen.
2. Die nächste fällige Aufgabe je Rolle als Arbeitsverteilung nutzen.
3. Blockaden nicht umgehen, sondern Vorgänger oder Klärpunkte bearbeiten.
4. Nicht relevante Template-Schritte bewusst überspringen.
5. EVU-spezifische Aufgaben als eigene Aufgaben ergänzen.
6. Vor Gremium `HTML mit Daten speichern` nutzen, damit App, Modellstand und Projektplan gemeinsam archiviert oder weitergegeben werden.

## Grenzen

Der Projektplan steuert den Arbeitsprozess. Er ändert keine fachlichen Modellwerte automatisch und ersetzt keine Projektmanagement-Software für Ressourcenplanung, Kapazitätsplanung oder Vertragssteuerung. Sein Zweck ist die governance-fähige Orchestrierung der Planungsrunde innerhalb des Szenarienrechner-EOG.
