# Third-party data

Coldfront uses only public data. Each dataset keeps the licence of its source. The required
attribution strings are reproduced verbatim (German). The provenance records are in
`data/sources/*.json`; the same information is published at `/api/v1/sources.json`.

Forecasts are our own calculations (derivative works) based on these datasets. Use the
attribution `Quelle: Robert Koch-Institut, Umweltbundesamt, Deutscher Wetterdienst; eigene Berechnung`
when you reuse them.

| Dataset | Used for | Licence | Required attribution |
|---|---|---|---|
| ARE-Konsultationsinzidenz (RKI) | Target series | CC BY 4.0 | Robert Koch-Institut, ARE-Konsultationsinzidenz, CC BY 4.0 |
| GrippeWeb Daten des Wochenberichts (RKI) | Context signal | CC BY 4.0 | Robert Koch-Institut, GrippeWeb Daten des Wochenberichts, CC BY 4.0 |
| Influenzafälle in Deutschland (RKI) | Context signal | CC BY 4.0 | Robert Koch-Institut, Influenzafälle in Deutschland, CC BY 4.0 |
| AMELAG Abwassersurveillance, Einzelstandorte (RKI, UBA) | Wastewater signals (time-limited programme, arrives up to two weeks late) | CC BY 4.0 | Robert Koch-Institut und Umweltbundesamt, Abwassersurveillance AMELAG, CC BY 4.0 |
| DWD Climate Data Center, daily station observations (kl) | Weekly temperature signals (weekly means of daily values from several stations) | CC BY 4.0 | Quelle: Deutscher Wetterdienst; Wochenmittel der Tageswerte (TXK, TNK) aus mehreren Stationen berechnet |
| BKG VG250 Verwaltungsgebiete 1:250 000 (Bundesländer) | Map geometry (TopoJSON, simplified) | dl-de/by-2-0 | © GeoBasis-DE / BKG (2026) dl-de/by-2-0; Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf; Geometrie vereinfacht (bearbeitet) |
| GeoNames Postal Codes Germany | Postcode to region lookup (derived index) | CC BY 4.0 | GeoNames, https://www.geonames.org, CC BY 4.0 |
| Ferientermine (Kultusministerkonferenz, Ferienkalender der Länder) | Vacation periods per federal state (holiday feature) | Stated per entry; not yet verified | Ferientermine: Kultusministerkonferenz, Ferienkalender der Länder; eigene Erfassung, Quelle je Eintrag |

## Not used

* Sources with a share-alike condition or an unclear licence: they would restrict the licence of the forecasts or make their reuse uncertain.
* Indicators based on search queries: in the literature such an approach overestimated the influenza peak of the 2012/13 season by about 140 %.

## Notes

* ARE data are corrected retrospectively for about the last four weeks.
* Wastewater data may end when the programme ends; the model remains usable without them.
* The vacation-period licence still has to be verified against the original calendar before publication.
