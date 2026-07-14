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

## Datenschutzmodell

Die App sendet den Prompt nicht. Nutzer prüfen die Vorschau, redigieren bei Bedarf und kopieren oder speichern den Text selbst. Standardmäßig werden Beträge gerundet und Notizen ausgelassen. Maßnahmennamen können anonymisiert werden.

Der Prompt enthält einen Verweis auf die öffentliche Kontextdatei:

https://energychain.github.io/Szenarienrechner-EOG/llm.txt

Wenn ein Unternehmens-LLM diese URL nicht abrufen kann, enthält der Prompt trotzdem die wichtigsten Interpretationsregeln: EOG ist nicht Cashflow, Basis vs. konservativ bleibt sichtbar, prüfpflichtige Annahmen sind keine bestätigten Fakten und es gibt keine regulatorische Anerkennungszusage.

## Nutzung

1. Arbeitsstand prüfen.
2. Menü „Mehr“ öffnen.
3. „KI-Prompt erstellen“ wählen.
4. Rolle, Datenumfang und Redaktionsoptionen auswählen.
5. Prompt prüfen.
6. In Zwischenablage kopieren oder als `.txt` speichern.
7. Nur in ein intern freigegebenes KI-System einfügen.
