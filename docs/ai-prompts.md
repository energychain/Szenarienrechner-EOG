# KI-Prompt erstellen

Die App enthält einen lokalen Prompt-Export für unternehmenseigene KI-Systeme. Das ist keine KI-Integration: Es gibt keinen API-Key, keinen Anbieter-Endpunkt und keine automatische Übertragung.

## Zweck

Viele EVU-Rollen brauchen eine Übersetzung derselben Planung in unterschiedliche Sprache: Gremien brauchen Beschlussfähigkeit, Controlling braucht Budget- und Cashflow-Sicht, Regulierungsmanagement braucht Prüfpfade und Asset Management braucht eine nachvollziehbare Wirkungskette. Der Prompt-Export erzeugt dafür rollenspezifische Arbeitsaufträge.

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

Für Strom-Flexibilitäten enthält der Prompt zusätzlich eine feste Abgrenzung: Flexibilitätsobjekte, Netzfahrpläne, Speicher-/Laststeuerung und AGNeS-Bezüge sind nicht automatisch klassische Netz-CAPEX. Sie beschreiben mögliche OPEX-gegen-CAPEX-Substitutionen. Eine rechnerische Wirkung soll erst interpretiert werden, wenn Netzfahrplan, vermiedene oder verschobene CAPEX, jährliche Flex-OPEX und Steuerungs-/Nachweislogik belastbar dokumentiert sind.

Flexibilitäts- und AGNeS-Daten werden im Prompt dedupliziert: Klassische CAPEX-Maßnahmen enthalten keine leeren Default-Felder wie `agnesRelevant=false` oder `agnesRole=offen`. Flexibilitäts-/Netzfahrplanobjekte erscheinen stattdessen in einem eigenen Abschnitt „Strom-Flexibilitätsobjekte / Netzfahrplan / AGNeS“ — auch dann, wenn sie als Kontext- oder Prüfobjekt nicht rechenwirksam sind. Wenn ein Flexibilitätsobjekt wegen fehlendem Netzfahrplan, fehlender Quantifizierung oder ungeklärter AGNeS-/Nachweislogik nicht wirkt, wird der Klärpunkt `strom_flexibility_review` ausgegeben.

## Nutzung

1. Arbeitsstand prüfen.
2. Menü „Mehr“ öffnen.
3. „KI-Prompt erstellen“ wählen.
4. Rolle, Datenumfang und Redaktionsoptionen auswählen.
5. Prompt prüfen.
6. In Zwischenablage kopieren oder als `.txt` speichern.
7. Nur in ein intern freigegebenes KI-System einfügen.
