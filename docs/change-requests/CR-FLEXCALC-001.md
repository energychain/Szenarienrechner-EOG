# CR-FLEXCALC-001 — Anlagen-Szenariorechner Strom/Flex

**Status:** Entwurf / separater Modul-CR  
**Bezug:** Szenarienrechner-EOG / Digitale Akte, CR-SZR-EEG2027-FLEX-002  
**Geltungsbereich:** ausschließlich Sparte Strom, außerhalb der Akten-UI

## Ziel

Der Anlagen-Szenariorechner Strom/Flex ist ein eigenständiges Werkzeug für anlagenscharfe Strom-/Flexibilitätsrechnungen. Er ist nicht Teil des Akten-Rechenkerns und erzeugt keine zusätzlichen Hauptnavigationspunkte oder Modals in der Digitalen Akte.

Die Digitale Akte bleibt auf Sparten-Portfolioebene: EOG, Kapitalkosten, NPV, IRR, TEUR p.a., Evidenz und Befassung. Das Flex-Modul darf kWh-Bilanzen, Speicherfahrweisen, Preisprofile oder Stundenlogiken rechnen; in die Akte gelangen daraus ausschließlich aggregierte TEUR-Wirkungen p.a. und Evidenzverweise.

## Vorläufiger Umfang

- PV-Dachanlagen: 50-%-Einspeisekappung, Eigenverbrauch, Speicherstrategien.
- PV-Freifläche: 70-%-Netzanschlusskappung, Abregelungs- und Erlösrisiko.
- Speicher / Co-Location: Netzneutralität, flexible Netzanschlussvereinbarung.
- Kleinanlagen unter 25 kW: Varianten ohne dauerhafte Einspeisevergütung, Übergangszahlung max. 36 Monate.
- Negative Preise: Stundenanzahl, Schwellwert, Erlösverlust, Vermeidung durch Speicher oder Abregelung.
- CfD / Refinanzierungsbeitrag: ab 100 kW, Referenzwert vs. Marktwert, Biomasse ausgenommen.

## Schnittstelle zur Digitalen Akte

Das Modul exportiert Ergebnisse als Kontextobjekt oder Maßnahmen-Import-JSON. Pflicht ist ein Annahmenblock je aggregierter Wirkung:

```json
{
  "assumptions": [
    {
      "key": "pv.rooftop_capping_limit_pct",
      "value": 50,
      "source": "cabinet_draft_2026_07_29",
      "confidence": "draft",
      "note": "Entwurfsstand, parlamentarische Änderungen möglich"
    }
  ]
}
```

Die Akte übernimmt daraus keine kWh-Rohdaten und keine Preisprofile. Zulässig sind nur aggregierte TEUR-Wirkungen p.a., Baukostenzuschüsse, Erlösrisiken, Evidenzstatus und Rückverweise auf die Modulrechnung.

## Nicht-Ziele

- Keine Änderung an Gas, KANU, Gas-Transformationspfad, H2-Umwidmung oder Stilllegungslogik.
- Keine rechtsverbindliche Förderberechnung.
- Keine automatische Netzanschlusszusage oder echte Queue-Verwaltung.
- Keine BNetzA-/EEG-Auslegung.
- Keine Lastfluss- oder Netzberechnung.

## Abnahmeidee

Ein Import-Roundtrip muss zeigen: Modulrechnung → Kontextobjekt mit Annahmenblock → Klärpunkt bei `confidence: draft` → Report/Prompt/Export mit Entwurfswarnung. Die Akten-Kennzahlen dürfen nur über explizit gemappte TEUR-Werte beeinflusst werden.
