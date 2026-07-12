# Userstory: Finanzplanung regulierter Sparten im Verteilnetz

**Projektkontext:** Diese Story beschreibt einen fiktiven Regionalversorger, der seine Investitions- und Finanzplanung für regulierte Verteilnetze vorbereitet. Alle Rollen, Zahlen, Namen und Termine sind synthetisch. Die Story zeigt nicht nur die Bedienung der App, sondern vor allem, wie aus technischen Maßnahmen, kaufmännischen Budgets, regulatorischen Wirkungen und offenen Klärpunkten ein entscheidungsfähiger Planungsstand entsteht.

**Positionierung der App:** Der Szenarienrechner ist kein reiner EOG-Rechner. Er ist ein offline lauffähiger Struktur- und Entscheidungsraum für die Finanzplanung regulierter Sparten. EOG-Wirkungen sind darin ein zentraler Teil, aber nicht der einzige. Ein EVU muss zugleich Wirtschaftsplan, Kapitalbindung, Aktivierbarkeit, Finanzierung, Abschreibung, Betriebskosten, technische Risiken, regulatorische Anerkennung und Gremienfähigkeit zusammenführen.

**Wofür die App gedacht ist:** Sie hilft, eine Planungsrunde so zu führen, dass Fachbereiche nicht nebeneinander in Excel, PowerPoint und Protokollen arbeiten, sondern ihre Annahmen in einem gemeinsamen Modell sichtbar machen. Die App ersetzt keine regulatorische Prüfung und keine Unternehmensentscheidung. Sie macht transparent, welche Werte belastbar sind, welche Wirkannahmen nur Sensitivitäten sind und welche offenen Punkte vor einer Beschlussfassung nachverfolgt werden müssen.

**Typische Ausgangslage in einem EVU:**

- Asset Management und Netzbetrieb melden technische Erneuerungs-, Automatisierungs- oder Transformationsbedarfe.
- Controlling und Finanzierung müssen die Maßnahmen in Wirtschaftsplan, Liquidität und Kapitalbindung einordnen.
- Regulierungsmanagement bewertet, welche Kosten und Wirkungen in der Erlöslogik überhaupt eine Rolle spielen können.
- Anlagenbuchhaltung und Bilanzierung prüfen Aktivierbarkeit, Nutzungsdauer und Abgrenzung zu Aufwand.
- Management und Gremien brauchen am Ende keine Detailtabelle, sondern eine nachvollziehbare Beschlusslage mit Auflagen.

**Beratungslogik hinter der Story:** Ein externer Senior Consultant würde den Prozess nicht mit einer fertigen Rechenantwort beginnen. Er würde zunächst klären, welche Entscheidung vorbereitet wird, welche Datenquellen belastbar sind, welche Annahmen nur Arbeitshypothesen sind und wie die spätere Vorlage erklärbar bleibt. Genau diesen Beratungsprozess bildet die Story ab.

**Ziel der Runde:** Aus einem ersten, unscharfen Maßnahmenbündel soll bis zur Entscheidungsvorlage ein nachvollziehbares Portfolio werden: fachlich begründet, kaufmännisch prüfbar, regulatorisch transparent, finanzierungsseitig plausibel und später wieder aufgreifbar.

**Rollen in der Story:**

- **Modellverantwortung:** hält das Modell zusammen, dokumentiert Arbeitsstand, offene Punkte und nächsten Schritt.
- **Regulierungsmanagement:** liefert EOG-, Kapitalbasis-, Anerkennungs- und Verfahrensannahmen.
- **Anlagenbuchhaltung / Bilanzierung:** prüft Aktivierbarkeit, Nutzungsdauern, HGB-Sicht und Abgrenzung zwischen Investition und Aufwand.
- **Netzbetrieb / Asset Management:** bewertet technische Notwendigkeit, Risiken, Umsetzungszeitpunkt und Wirkannahmen.
- **Controlling / Finanzierung:** plausibilisiert Kosten, Kapitalwert, IRR, FK-Zins, Budgetpfad und Wirtschaftsplananschluss.
- **Management / Gremium:** trifft keine Rechenentscheidung, sondern eine governance-fähige Investitionsentscheidung mit Auflagen.

---

## Wie diese Story zu lesen ist

Die Story folgt einer mehrmonatigen Planungsrunde. Jeder Meilenstein zeigt drei Ebenen:

- **Prozess:** Was passiert im EVU gerade organisatorisch?
- **Fachliche Klärung:** Welche kaufmännischen, regulatorischen oder technischen Fragen werden sichtbar?
- **App-Nutzung:** Welche App-Funktion unterstützt die Arbeit, ohne die Entscheidung zu automatisieren?

Die Screenshots sind Momentaufnahmen synthetischer Demodaten. Sie sollen Wiedererkennung schaffen: Kick-off, Datenanforderung, Maßnahmenkatalog, Technikrückkopplung, Managementkonsolidierung, Entscheidungsvorlage, Gremium und späterer Re-Entry.

## Bidirektionale Navigation

Diese Story ist mit der Live-Anwendung verknüpft:

- Jeder Meilenstein enthält einen Link **„Zur passenden Stelle in der Anwendung springen“**.
- Die Anwendung zeigt im Prozesshinweis den Link **„Story: …“** zurück zum passenden Kapitel.
- Die App-Links nutzen synthetische Demodaten und setzen Phase, Sicht und Arbeitsstand passend zum Story-Meilenstein.

<a id="kickoff"></a>

## Meilenstein 0 — Kick-off: Finanzplanung zuerst als gemeinsamer Entscheidungsprozess

[Zur passenden Stelle in der Anwendung springen](https://energychain.github.io/Szenarienrechner-EOG/?story=kickoff)

![Startscreen Kick-off](screenshots/01-startscreen-kickoff.png)

**Zeitpunkt:** Anfang Januar 2027

Die Planungsrunde beginnt nicht mit einer fertigen Excel-Tabelle, sondern mit der Frage, welche Entscheidung vorbereitet werden soll. Im Raum sitzen Modellverantwortung, Regulierungsmanagement, Controlling, Asset Management und später auch Bilanzierung. Alle kennen einen Teil der Wahrheit: Technik kennt die Notwendigkeit, Controlling kennt das Budget, Regulierungsmanagement kennt den regulatorischen Rahmen, aber niemand besitzt allein die entscheidungsreife Gesamtsicht.

Die Modellverantwortliche öffnet die App im Kick-off und zeigt zuerst den geführten Einstieg. Der wichtigste Effekt ist nicht die erste Zahl, sondern die gemeinsame Sprache: Maßnahme, Aktivierung, EOG-Wirkung, Kapitalbindung, Risiko, Wirkannahme, Klärpunkt und Beschlussauflage werden voneinander getrennt.

**Warum dieser Schritt wichtig ist:** In vielen EVU-Planungsrunden werden technische Notwendigkeit, regulatorische Anerkennung und kaufmännische Finanzierbarkeit zu früh vermischt. Dadurch entstehen scheinbar eindeutige Prioritäten, obwohl wesentliche Annahmen noch offen sind. Die App soll diesen Reflex bremsen: Erst verstehen, dann anpassen.

**Nutzung der App zu diesem Zeitpunkt:**

- Die Startseite erklärt den Zweck des Werkzeugs und die lokale Datenhaltung.
- Die Runde wählt zunächst **Modellverantwortung**, weil Stammdaten und Maßnahmen aktiv aufgebaut werden sollen.
- Noch wird kein Beschluss vorbereitet; die App dient als Strukturrahmen für die kommenden Termine.
- Der Prozesshinweis oben zeigt den aktuellen Stand und macht deutlich, dass die Datei einen Planungsprozess begleitet.

**Neue Fakten / offene Punkte:**

- Das Portfolio soll zunächst synthetisch vorbereitet und später mit internen Ist-Werten befüllt werden.
- Noch unklar sind bestehende EOG, regulatorische Kapitalbasis, Jahresarbeit, Aktivierbarkeit einzelner Maßnahmen und belastbare Wirkannahmen.
- Noch offen ist, welche Maßnahmen im Basisszenario entscheidungsrelevant sind und welche nur als Sensitivität betrachtet werden.

**Entscheidung für den weiteren Weg:**

Die Runde entscheidet, nicht direkt alle Felder zu befüllen. Stattdessen wird der geführte Start genutzt, damit jedes Feld mit Quelle, Zuständigkeit und fachlichem Kontext verstanden wird.

---

<a id="initialisierung"></a>

## Meilenstein 1 — Initialisierung: Aus Eingabefeldern wird eine Datenanforderung

[Zur passenden Stelle in der Anwendung springen](https://energychain.github.io/Szenarienrechner-EOG/?story=initialisierung)

![Geführter Start mit Kontext-Hilfe](screenshots/02-guided-start-context-help.png)

**Zeitpunkt:** Mitte Januar 2027

Im ersten Arbeitsmeeting öffnet die Modellverantwortliche den Stammdaten-Wizard. Beim Feld **Startjahr** wird die Kontext-Hilfe angeklickt. Der Hinweis erklärt nicht nur, wie das Feld zu bedienen ist, sondern warum das Jahr fachlich wichtig ist: Es beeinflusst Regulierungsperiode, Kostenbasis, Abschreibungsbeginn und Cashflow-Zeitpunkt.

Ein Mitarbeiter aus dem Controlling erkennt hier seine eigene Tätigkeit wieder: Es geht nicht um „eine Zahl eingeben“, sondern um die Anschlussfähigkeit an Wirtschaftsplanung, Mittelfristplanung und spätere Budgetfreigabe. Das Regulierungsmanagement erkennt zugleich, dass die Erlöslogik nicht isoliert betrachtet werden darf, sondern mit Verfahren, Kapitalbasis und Datenstand verbunden ist.

**Fachliche Klärung:**

| Eingabe | Typische Quelle | Warum sie für die Finanzplanung relevant ist |
|---|---|---|
| Sparte | Spartenleitung und Regulierungsmanagement | bestimmt regulatorischen Kontext, Maßnahmentypen und ggf. Transformationslogik |
| Startjahr | Projektplan und Wirtschaftsplanung | legt fest, ab wann Kapitalbindung, Abschreibung und Planansätze wirken |
| Regulierungsverfahren | aktueller Regulierungsbescheid | beeinflusst, welche Wirkungen individuell betrachtet werden können |
| Bestehende EOG | Regulierungsmanagement / Erlös- oder Netzentgeltkalkulation | Referenz für indikative Erlös- und Entgeltwirkung |
| Kapitalbasis | Anlagenbuchhaltung und regulatorisches Anlagevermögen | Grundlage für Kapitalbindung und regulatorische Wirkung |
| Jahresarbeit | Abrechnung, Mengenplanung oder testierter Jahresabschluss | Brücke zur indikativen Netzentgelt- oder Kundenauswirkung |

**Nutzung der App zu diesem Zeitpunkt:**

- Die Wizard-Schritte strukturieren die Stammdatenerhebung.
- Die `i`-Hilfen werden gezielt geöffnet, wenn die Runde unsicher ist, wo ein Wert herkommt.
- Statt sofort eine Zahl einzutragen, wird je Feld eine Quelle bestimmt.
- Offene Werte werden als Arbeitsstand behandelt, nicht als verdeckte Defaults.

**Rückkopplung:**

Das Meeting zeigt, dass die App nicht nur Eingabemaske ist. Sie erzeugt eine Datenanforderungsliste: Wer liefert welche Zahl, welche Zahl ist vorläufig, und welche Zahl kann später im Gremium erklärt werden?

**Entscheidung für den weiteren Weg:**

Die Initialisierung wird abgeschlossen. Als nächster Schritt wird eine Datensichtung mit Regulierungsmanagement, Anlagenbuchhaltung und Abrechnung angesetzt.

---

<a id="datenerhebung"></a>

## Meilenstein 2 — Datenerhebung: Finanzplanung braucht Quellen, nicht nur Werte

[Zur passenden Stelle in der Anwendung springen](https://energychain.github.io/Szenarienrechner-EOG/?story=datenerhebung)

![Datenerhebung mit Prozessstatus](screenshots/03-datenerhebung-status.png)

**Zeitpunkt:** Februar 2027

Nach zwei Wochen liegen erste Werte vor. Die Modellverantwortliche lädt ein Beispielmodell und trägt im Prozessbereich ein, wo die Runde steht: Kick-off abgeschlossen, Quellen verteilt, Ist-Werte in Klärung. Der Hinweis ist bewusst kein Pop-up, das eine einmalige Information zeigt. Er ist ein Prozessstatus: Wenn jemand die Datei später öffnet, sieht er sofort, wo die Planung zuletzt stand.

**Fachliche Einordnung:** Datenerhebung ist in regulierten Sparten selten trivial. Ein HGB-Buchwert ist nicht automatisch die regulatorische Kapitalbasis. Eine technische Mengenannahme ist nicht automatisch die abrechnungsseitige Jahresarbeit. Und ein genehmigtes Budget ist nicht automatisch regulatorisch anerkannt. Genau diese Unterschiede werden in der App sichtbar gehalten.

**Nutzung der App zu diesem Zeitpunkt:**

- Im Phasen-Popover wird die Phase auf **Datenerhebung** gesetzt.
- Der Arbeitsstand wird in einem kurzen Satz festgehalten.
- Der nächste Schritt wird konkret formuliert: Regulierungsmanagement, Anlagenbuchhaltung und Abrechnung liefern belastbare Werte.
- Zuständigkeit und Fälligkeitsdatum werden dokumentiert.

**Neue Fakten:**

- Die Jahresarbeit ist nicht aus einer technischen Schätzung zu übernehmen, sondern aus Abrechnung/Mengenplanung.
- Die regulatorische Kapitalbasis weicht voraussichtlich vom HGB-Buchwert ab.
- Ein Teil der geplanten Maßnahmen ist noch nicht entscheidungsreif, weil Aktivierbarkeit und Wirkannahmen offen sind.
- Der Wirtschaftsplan enthält Budgetpositionen, die für die regulatorische Betrachtung noch fachlich aufgeteilt werden müssen.

**Einfluss auf den weiteren Weg:**

Die Datenerhebung verhindert frühe Scheingenauigkeit. Wo Werte fehlen, bleibt der Planungsstand explizit offen. Das Modell wird nicht als Wahrheit behandelt, sondern als nachvollziehbarer Arbeitsstand.

---

<a id="massnahmenbewertung"></a>

## Meilenstein 3 — Maßnahmenbewertung: Vom Budgettopf zum steuerbaren Portfolio

[Zur passenden Stelle in der Anwendung springen](https://energychain.github.io/Szenarienrechner-EOG/?story=massnahmenbewertung)

![Maßnahmenkatalog mit ersten Fakten](screenshots/04-massnahmenkatalog-erste-fakten.png)

**Zeitpunkt:** Ende März 2027

Die technischen Fachbereiche liefern neue Fakten: Zwei Automatisierungsmaßnahmen bleiben prioritär, einzelne Ersatzinvestitionen werden in eine konservative Sensitivität verschoben. Einkauf und Projektleitung aktualisieren Kosten und Inbetriebnahmejahre. Damit verändert sich die Planungsfrage: Es geht nicht mehr um „haben wir genug Budget?“, sondern um „welche Maßnahmen tragen regulatorisch, technisch und finanzwirtschaftlich gemeinsam?“

**Beraterperspektive:** Ein Senior Consultant würde hier das Portfolio nicht einfach nach höchstem IRR sortieren. Er würde fragen: Welche Maßnahme ist technisch notwendig? Welche Maßnahme ist aktivierbar? Welche Wirkung ist belegt? Welche Wirkung ist nur eine Annahme? Welche Maßnahme bindet Kapital, ohne zeitnah in der Erlöslogik sichtbar zu werden? Welche Auflage muss in die Entscheidung?

**Nutzung der App zu diesem Zeitpunkt:**

- Die Runde wechselt in den **Maßnahmenkatalog**.
- Maßnahmen werden aktiv/inaktiv gesetzt und nach Bereich, Typ, Jahr oder Ziel gefiltert.
- Kosten, erwartete Aktivierung, Wirkannahmen und Notizen werden je Maßnahme sichtbar.
- Offene Punkte bleiben im Katalog markiert, statt in Meetingprotokollen zu verschwinden.

**Neue Fakten und Wirkung im Modell:**

| Fakt | Wirkung im Modell | Fachliche Bedeutung |
|---|---|---|
| Einkauf bestätigt höhere Kosten für eine Automatisierungsmaßnahme | Kapitalwert und IRR werden neu bewertet | Budget und Finanzierungspfad müssen aktualisiert werden |
| Technik bestätigt spätere Inbetriebnahme | AfA- und EOG-Wirkung verschieben sich | Zeitpunkt der Kapitalbindung und Ergebniswirkung ändern sich |
| Bilanzierung stuft einen Kostenanteil als unsicher aktivierbar ein | Erwartete Kapitalbasis sinkt bzw. wird risikogewichtet | Nicht jede Ausgabe wird automatisch investiv wirksam |
| Regulierungsmanagement markiert Wirkannahmen als prüfpflichtig | Entscheidungsreife bleibt begrenzt | Die Vorlage braucht Auflagen oder Sensitivitäten |

**Rückkopplung:**

Das Portfolio wird nicht linear „durchgerechnet“. Neue Fakten ändern Prioritäten. Die App macht sichtbar, welche Maßnahme wirtschaftlich trägt, welche regulatorisch erklärbar ist und welche nur mit ergänzender Begründung sinnvoll bleibt.

**Entscheidung für den weiteren Weg:**

Die Runde vereinbart eine technische Rückkopplung: Wirkannahmen, Risikowerte und Aktivierbarkeit werden nicht pauschal akzeptiert, sondern je Maßnahme überprüft.

---

<a id="technik-rueckkopplung"></a>

## Meilenstein 4 — Technische Rückkopplung: Wirkannahmen sind keine stillen Erfolgsversprechen

[Zur passenden Stelle in der Anwendung springen](https://energychain.github.io/Szenarienrechner-EOG/?story=technik-rueckkopplung)

![Technische Rückkopplung in der Entscheidungsansicht](screenshots/05-technik-rueckkopplung-results.png)

**Zeitpunkt:** April 2027

Im Techniktermin wird klar: Die Maßnahmen sind plausibel, aber nicht alle Wirkungen sind gleich belastbar. Manche Qualitäts- oder Effizienzannahmen beruhen auf Betriebserfahrung, andere nur auf Expertenschätzung. Eine Risikoannahme soll nicht in den Basiscase, sondern nur in eine Sensitivität.

**Fachliche Aufklärungsarbeit:** Für viele Planungsrunden ist dies der entscheidende Schritt. Eine Maßnahme kann technisch sinnvoll sein und trotzdem für eine Beschlussvorlage noch nicht vollständig belastbar sein. Umgekehrt kann eine Maßnahme kaufmännisch attraktiv wirken, aber auf einer Annahme beruhen, die im Regulierungs- oder Prüfkontext nicht tragfähig ist. Die App zwingt diese Differenzierung nicht dogmatisch auf, aber sie macht sie sichtbar.

**Nutzung der App zu diesem Zeitpunkt:**

- Die App steht auf Phase **Maßnahmenbewertung**.
- In der Entscheidungsansicht wird auf den Meeting-Fokus **Technik** gewechselt.
- Die offenen Klärpunkte und die Entscheidungsreife werden gemeinsam betrachtet.
- Nicht freigegebene Wirkannahmen werden nicht gelöscht, sondern als prüfpflichtig dokumentiert.

**Neue Fakten:**

- Technische Wirkung ja, aber nicht vollständig nachgewiesen.
- Risikoannahmen bleiben für die Beschlusslage erklärungsbedürftig.
- Der Modellwert verbessert sich, aber die Governance-Hinweise verhindern eine zu einfache Ampelentscheidung.
- Die spätere Vorlage braucht eine Sprache für Auflagen, nicht nur für Kennzahlen.

**Einfluss auf den weiteren Weg:**

Die App führt zu einer differenzierten Entscheidungsvorbereitung: Das Portfolio kann wirtschaftlich tragfähig sein, obwohl einzelne Wirkannahmen noch Auflagen haben. Damit entsteht eine Beschlussoption mit Bedingungen statt ein hartes Ja/Nein.

---

<a id="konsolidierung"></a>

## Meilenstein 5 — Konsolidierung: Management betrachtet Finanzbild, Erlöslogik und Haken gemeinsam

[Zur passenden Stelle in der Anwendung springen](https://energychain.github.io/Szenarienrechner-EOG/?story=konsolidierung)

![Konsolidierung mit Managemententscheidung](screenshots/06-konsolidierung-managemententscheidung.png)

**Zeitpunkt:** Mai 2027

Nach mehreren Fachterminen liegen Kosten, Aktivierbarkeit und wesentliche Wirkannahmen vor. Das Managementmeeting soll keine Detaildebatte wiederholen, sondern entscheiden, ob das Portfolio als beschlussreife Vorlage weitergeführt wird. Die App zeigt deshalb nicht nur Einzelwerte, sondern eine Managementsicht: Entscheidungsreife, Verdict, Jahr-1-Wirkung, IRR, Kapitalwert, Auflagen und nächster Schritt.

**Warum die Positionierung nicht zu EOG-lastig sein darf:** Die EOG ist für regulierte Sparten zentral, aber das Management entscheidet nicht allein über eine Erlösobergrenzenwirkung. Es entscheidet über Kapitalbindung, Umsetzungsrisiko, Finanzierungsfähigkeit, Ergebniswirkung, technische Notwendigkeit und regulatorische Erklärbarkeit. Die App soll diese Perspektiven zusammenführen, statt eine einzelne Kennzahl zum Entscheidungskriterium zu machen.

**Nutzung der App zu diesem Zeitpunkt:**

- Die Phase wird auf **Konsolidierung** gesetzt.
- Der Meeting-Fokus wechselt zurück auf **Kurzentscheidung / Management**.
- Entscheidungsreife, Verdict, Jahr-1-EOG, IRR und Kapitalwert werden gemeinsam angezeigt.
- Der wichtigste Haken und der nächste Schritt bleiben sichtbar.

**Neue Fakten / Rückkopplungen:**

- Controlling bestätigt, dass die Kosten in den Wirtschaftsplan eingepasst werden können.
- Finanzierung aktualisiert den FK-Zins; der Finanzierungsspread bleibt tragfähig.
- Regulierungsmanagement akzeptiert die Methodik, verlangt aber Nachverfolgung einzelner Wirkannahmen.
- Asset Management bestätigt, welche Maßnahmen technisch nicht beliebig verschiebbar sind.

**Entscheidung für den weiteren Weg:**

Das Management entscheidet: Die Vorlage soll erstellt werden, aber mit Auflagen. Die App wird damit nicht zum automatischen Genehmigungswerkzeug, sondern zum transparenten Entscheidungsdokument.

---

<a id="entscheidungsvorlage"></a>

## Meilenstein 6 — Entscheidungsvorlage: Aus Planung wird eine prüfbare Managementunterlage

[Zur passenden Stelle in der Anwendung springen](https://energychain.github.io/Szenarienrechner-EOG/?story=entscheidungsvorlage)

![Management-Report Entscheidungsvorlage](screenshots/07-management-report-entscheidungsvorlage.png)

**Zeitpunkt:** Juni 2027

Vor der Gremiensitzung erstellt die Modellverantwortliche den Management-Report. Besonders wichtig ist der Abschnitt **Arbeitsstand und nächster Schritt**: Nach Monaten von Meetings kann jede Person sofort sehen, was beschlossen werden soll, was offen bleibt und welche Auflage in die Vorlage geht.

**Was ein EVU-Mitarbeiter hier wiedererkennen soll:** Eine Entscheidungsvorlage entsteht selten aus einem einzigen Rechenlauf. Sie entsteht aus abgestimmten Teilbeiträgen: Technik liefert Notwendigkeit und Zeitpunkt, Controlling liefert Budgetanschluss, Regulierungsmanagement liefert Anerkennungslogik, Bilanzierung liefert Aktivierbarkeit und Management verdichtet dies zu einer tragfähigen Beschlussoption.

**Nutzung der App zu diesem Zeitpunkt:**

- Die Phase steht auf **Entscheidungsvorlage**.
- Der Report zeigt Kennzahlen, Entscheidungsreife, Verdict und Governance-Hinweise.
- Der zuvor gepflegte Arbeitsstand erscheint direkt im Report.
- Der nächste Schritt ist nicht implizit, sondern Bestandteil der Vorlage.

**Neue Fakten / abschließende Einordnung:**

- Das Portfolio ist wirtschaftlich tragfähig.
- Es gibt weiterhin Blocker bzw. prüfpflichtige Wirkannahmen.
- Die Vorlage enthält deshalb keine blinde Freigabe, sondern eine Freigabe mit Nachverfolgung.
- Die finanzielle Sicht bleibt anschlussfähig an Wirtschaftsplan und Controlling, ohne regulatorische Wirkungen zu überdehnen.

**Einfluss auf den weiteren Weg:**

Die Entscheidung wird anschlussfähig: Wer später in das Modell schaut, sieht nicht nur Zahlen, sondern auch die damalige Begründung und die vereinbarte Weiterarbeit.

---

<a id="gremium"></a>

## Meilenstein 7 — Gremienvorlage: Aus Modelllogik wird ein beschlussfähiger Text

[Zur passenden Stelle in der Anwendung springen](https://energychain.github.io/Szenarienrechner-EOG/?story=gremium)

![Gremienvorlage Beschluss](screenshots/08-gremienvorlage-beschluss.png)

**Zeitpunkt:** Ende Juni 2027

Für das Gremium wird die Einseiter-Ansicht genutzt. Die Modellverantwortliche trägt das Gremium, Sitzungsdatum und einen neutralen Beschlussvorschlag ein. Die Vorlage übersetzt die Rechen- und Governance-Logik in verständliche Entscheidungssprache.

**Aufklärungsleistung der App:** Gremien benötigen keine technische Detailmodellierung, aber sie benötigen eine faire Darstellung der Entscheidungsgrundlage. Dazu gehören: Warum ist die Maßnahme erforderlich? Welche finanzielle Wirkung wird erwartet? Welche regulatorische Annahme liegt zugrunde? Welche Risiken bleiben? Welche Auflage wird beschlossen? Die App liefert dafür eine Struktur, keine automatische Beschlussempfehlung.

**Nutzung der App zu diesem Zeitpunkt:**

- Im Report wird von **Management-Report** auf **Gremienvorlage (1 Seite)** gewechselt.
- Gremium, Datum und Beschlussvorschlag werden gepflegt.
- Die Vorlage enthält Kennzahlen, Begründung, Risiken, Auflagen und Arbeitsstand.
- Die Druck-/PDF-Fähigkeit der Story und der Vorlage unterstützt Weitergabe und Archivierung.

**Entscheidung:**

Das Gremium beschließt das priorisierte Maßnahmenpaket vorbehaltlich der dokumentierten Prüfauflagen. Die App dient dabei als Nachweis, welche Annahmen im Moment der Entscheidung galten.

**Einfluss auf den weiteren Weg:**

Die Planungsrunde endet nicht mit dem Beschluss. Die offenen Wirkannahmen werden als Monitoringpunkte in die Umsetzung übertragen.

---

<a id="archiv"></a>

## Meilenstein 8 — Beschluss und Archiv: Wiederaufnahme nach Monaten bleibt möglich

[Zur passenden Stelle in der Anwendung springen](https://energychain.github.io/Szenarienrechner-EOG/?story=archiv)

![Archiv und Re-Entry nach Beschluss](screenshots/09-archiv-reentry-abschluss.png)

**Zeitpunkt:** September 2027

Drei Monate nach dem Beschluss wird die Datei erneut geöffnet. Ohne alte Protokolle zu suchen, sieht die Modellverantwortliche im Prozessbereich: Beschluss gefasst, Umsetzung läuft, Auflagen bleiben Monitoringpunkte, Review nach erster Umsetzungsetappe.

**Warum das im EVU-Alltag wichtig ist:** Planungs- und Investitionsentscheidungen werden häufig über Monate weitergereicht. Personen wechseln, Termine verschieben sich, Annahmen altern. Ein wiederaufnahmefähiges Modell hilft, nicht wieder bei null zu beginnen. Es zeigt, welche Annahmen galten, welche Fragen offen waren und welche nächste Prüfung vereinbart wurde.

**Nutzung der App zu diesem Zeitpunkt:**

- Die Phase wird auf **Beschluss/Archiv** gesetzt.
- Arbeitsstand, nächster Schritt, Zuständigkeit und Fälligkeit bleiben im Modell-JSON gespeichert.
- Das Modell kann zusammen mit Report und JSON-Export als Entscheidungsstand abgelegt werden.
- Die Historie unterstützt spätere Nachvollziehbarkeit, ohne ein Backend oder eine zentrale Plattform vorauszusetzen.

**Was die Story zeigen soll:**

- Die App begleitet keine Einmalrechnung, sondern einen mehrmonatigen Finanzplanungsprozess.
- Neue Fakten ändern Maßnahmen, Szenarien, Aktivierbarkeit, Kapitalbindung und Entscheidungsreife.
- Rückkopplungen aus Technik, Regulierungsmanagement, Controlling und Finanzierung werden sichtbar gehalten.
- Die Entscheidung bleibt menschlich und governance-basiert; die App liefert Transparenz, Rechenpfad und Erinnerbarkeit.
- Der Prozessstatus verhindert, dass nach Wochen unklar ist, was zuletzt galt und was als Nächstes passieren sollte.

---

## Kurzfazit

Die fiktive Planungsrunde zeigt drei zentrale Nutzungsmuster:

- **Zu Beginn:** Der geführte Start und die Kontext-Hilfe machen aus leeren Eingabefeldern eine fachliche Datenanforderung.
- **Während der Runde:** Maßnahmen, Szenarien und Wirkannahmen werden iterativ angepasst, ohne offene Punkte zu verstecken.
- **Am Ende und danach:** Report, Gremienvorlage und Prozessstatus konservieren nicht nur Kennzahlen, sondern auch Arbeitsstand, Auflagen und nächsten Schritt.

Damit wird die App zu einem Begleiter für echte Finanzplanung in regulierten Sparten: nicht als deterministische Entscheidungsmaschine, nicht als isolierter EOG-Rechner, sondern als nachvollziehbarer, lokaler und prüfbarer Entscheidungsraum für VNB-Portfolios.
