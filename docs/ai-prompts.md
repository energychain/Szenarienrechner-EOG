# KI-Prompt erstellen

Die App enthält einen lokalen Prompt-Export für unternehmenseigene KI-Systeme. Das ist keine KI-Integration: Es gibt keinen API-Key, keinen Anbieter-Endpunkt und keine automatische Übertragung.

## Zweck

Viele EVU-Rollen brauchen eine Übersetzung derselben Planung in unterschiedliche Sprache: Gremien brauchen Befassungsfähigkeit, Controlling braucht Budget- und Cashflow-Sicht, Regulierungsmanagement braucht Prüfpfade und Asset Management braucht eine nachvollziehbare Wirkungskette. Der Prompt-Export erzeugt dafür rollenspezifische Arbeitsaufträge.

## Rollen im ersten Release

- Aufsichtsrat / Stadtrat / Gremium
- Geschäftsführung / Management
- Controlling / Finanzen
- Regulierungsmanagement
- Asset Management / Technik
- Anlagenbuchhaltung / Bilanzierung
- Projektsteuerung / PMO
- Arbeitsstand hinterfragen

Der Prompt-Typ „Arbeitsstand hinterfragen“ ist bewusst keine Berichtsvorlage. Er soll den aktuellen Arbeitsstand fachlich challengen: belastbare Aussagen von prüfpflichtigen Annahmen trennen, Widersprüche und Datenlücken sichtbar machen, Fragen an Regulierung, Bilanzierung, Technik und Management formulieren und bei Gas-Maßnahmen Stilllegung, Rückbau, Rückstellungen, Ewigkeitsvermutung sowie KAnEu-/Ist-Kosten-Behandlung als offene Herleitung prüfen. Er trifft keine regulatorische, rechtliche oder bilanzielle Entscheidung.

## Datenschutzmodell

Die App sendet den Prompt nicht. Nutzer prüfen die Vorschau, redigieren bei Bedarf und kopieren oder speichern den Text selbst. Standardmäßig werden Beträge gerundet und Notizen ausgelassen. Maßnahmennamen können anonymisiert werden.

Der Prompt enthält einen Verweis auf die öffentliche Kontextdatei:

https://energychain.github.io/Szenarienrechner-EOG/llm.txt

Wenn ein Unternehmens-LLM diese URL nicht abrufen kann, enthält der Prompt trotzdem die wichtigsten Interpretationsregeln: EOG ist nicht Cashflow, Basis vs. konservativ bleibt sichtbar, prüfpflichtige Annahmen sind keine bestätigten Fakten und es gibt keine regulatorische Anerkennungszusage.

Der Prompt enthält inzwischen zusätzlich die expliziten Stresstest-Parameter des konservativen Szenarios: Attributionsdeckel, Q-Faktor, E-/Effizienz-Faktor, Mindest-Diskontsatz und Wirkannahmen-Modus. Wenn Basis und Konservativ identisch sind, soll das KI-System dies als offenen Stresstest mit Befassungsbedarf lesen, nicht als Robustheitsnachweis.

## Prüfen & Klären / Befassungs-Workbench

Der Prompt-Export übernimmt einen aggregierten Auszug der aktuellen Klärfall-Logik. Kanban-Karten entstehen deterministisch aus Wirkannahmen/Warnungen, Maßnahmen-Evidenz, Dokumentationslücken und Sidecar-Klärfragen. Die Auswertung nennt die Verteilung auf „Hohe Steuerungswirkung“, „Evidenz / Systeme“ und „Dokumentation“, zeigt exemplarische Klärfälle mit Bearbeitungsziel und führt vorhandene Befassungsnotizen als Statusauszug. Befassungsnotizen sind Zwischenstände; ein Klärpunkt gilt erst nach explizitem Abschluss als erledigt.

Für Strom-Flexibilitäten enthält der Prompt zusätzlich eine feste Abgrenzung: Flexibilitätsobjekte, Netzfahrpläne, Speicher-/Laststeuerung und AGNeS-Bezüge sind nicht automatisch klassische Netz-CAPEX. Sie beschreiben mögliche OPEX-gegen-CAPEX-Substitutionen. Eine rechnerische Wirkung soll erst interpretiert werden, wenn Netzfahrplan, vermiedene oder verschobene CAPEX, jährliche Flex-OPEX und Steuerungs-/Nachweislogik belastbar dokumentiert sind.

Für Strom-Maßnahmen mit EEG-2027-/Netzanschluss-Entwurfsfeldern enthält der Prompt einen eigenen Abschnitt **„Strom EEG 2027 / Netzanschlusspaket (Entwurfsstand)”**. Er nennt den Regelstand „Kabinettsentwurf 29.07.2026, nicht endgültiges geltendes Recht”, zählt Entwurfs- und nutzerseitige Annahmen, markiert kapazitätslimitierte Netzgebiete, Netzanschlussstatus ab 135 kW, jährliches Erlösrisiko und Baukostenzuschüsse. Gas-Akten erhalten diesen Abschnitt nicht.

Anlagenscharfe PV-, Speicher-, negative-Preise- oder CfD-Rechnungen sind nicht Teil des Prompt-Kontexts der Akte. Sie sind als separates Modul `CR-FLEXCALC-001` geschnitten; in der Akte und im Prompt erscheinen daraus nur aggregierte TEUR-Wirkungen p.a. und Evidenz-/Annahmenverweise.

Flexibilitäts- und AGNeS-Daten werden im Prompt dedupliziert: Klassische CAPEX-Maßnahmen enthalten keine leeren Default-Felder wie `agnesRelevant=false` oder `agnesRole=offen`. Flexibilitäts-/Netzfahrplanobjekte erscheinen stattdessen in einem eigenen Abschnitt „Strom-Flexibilitätsobjekte / Netzfahrplan / AGNeS“ — auch dann, wenn sie als Kontextobjekt nicht rechenwirksam sind. Wenn ein Flexibilitätsobjekt wegen fehlendem Netzfahrplan, fehlender Quantifizierung oder ungeklärter AGNeS-/Nachweislogik nicht wirkt, wird der Klärpunkt `strom_flexibility_review` ausgegeben.

## Kontext & Evidenz / Sidecar im Prompt

Wenn der Arbeitsstand Sidecar-Objekte enthält, erzeugt der Prompt einen eigenen Abschnitt **„Kontext & Evidenz / Sidecar“**. Diese Objekte werden nicht als Maßnahmen, CAPEX oder KPI-Beiträge dargestellt. Sie beschreiben Quellen, Datenqualität, Abhängigkeiten, Steuerungsfähigkeit oder spartenspezifischen Kontext, der eine Bewertung stützt oder blockiert.

Der Prompt berücksichtigt dabei die Export- und Sensitivitätslogik der Sidecar-Objekte:

- `exportStatus=excluded` wird nicht in den Prompt übernommen.
- `exportStatus=sanitized_only` entfernt Detailzusammenfassungen und Quellenreferenzen und hält nur die entscheidungsrelevante Struktur.
- Sidecar-Objekte bleiben als nicht KPI-wirksam gekennzeichnet, solange keine explizite Rechenwirkung definiert ist.
- Überleitungslogik wird separat ausgewiesen: Sidecar sichtbar, Überleitungslogik prüfpflichtig, keine automatische KPI-Wirkung. `sidecarType`, `activationStatus`, `calculationImpact` und `bridgeLogic.quantificationStatus` werden exportiert, damit ein KI-System Kontext, Sensitivität, Wirkannahme und wirtschaftliche Überleitung nicht mit klassischen Maßnahmen verwechselt.
- Offene Fragen werden als Arbeitsauftrag formuliert, nicht als Beschluss- oder Freigabeaussage.

Für den Prompt-Typ **„Arbeitsstand hinterfragen“** ist der Sidecar besonders relevant: Das KI-System soll prüfen, ob Datenqualität, Quellenlage, Steuerungsfähigkeit oder externe Abhängigkeiten ausreichend dokumentiert sind und welche Fragen an Regulierung, Bilanzierung, Technik, Datenmanagement oder Management zurückgespielt werden müssen.

## Nutzung

1. Arbeitsstand prüfen.
2. Menü „Mehr“ öffnen.
3. „KI-Prompt erstellen“ wählen.
4. Rolle, Datenumfang und Redaktionsoptionen auswählen.
5. Prompt prüfen.
6. In Zwischenablage kopieren oder als `.txt` speichern.
7. Nur in ein intern freigegebenes KI-System einfügen.


## Strom-Robustheit und Plausibilitätslogik

Spartenübergreifend führt die App den Prüfhinweis `conservative_case_missing`, wenn Basis- und Konservativ-Szenario identisch sind oder kein eigenständiger konservativer Stresstest vorliegt. Für die Sparte Strom ergänzt sie weitere aggregierte Prüfhinweise, ohne Gas-Logiken zu verändern: `strom_regulatory_framework_review` für NEST-/Regulierungsrahmen-Sensitivität, getrennte Sicht auf Kernportfolio und Scope-Kandidaten, Defaultannahmen, RiskAvoided-Evidenz, Nutzungsdauer-Plausibilisierung, No-Regret-Überverwendung und Projekt-/Reifegradstatus. Diese Hinweise relativieren KPI-Ergebnisse als Befassungs-/Prüfstand; sie entfernen keine Werte automatisch.
