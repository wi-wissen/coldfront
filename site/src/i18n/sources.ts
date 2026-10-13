/** Messages of the "sources" page (German and English). Owned by the page author. */
export const messages = {
  de: {
    title: 'Daten & Quellen',
    description: 'Herkunft, Lizenz und vorgeschriebene Nennung der Daten von Coldfront sowie bekannte Einschränkungen.',
    heading: 'Daten & Quellen',
    intro:
      'Coldfront verwendet nur öffentlich zugängliche Daten. Die Angaben je Quelle stammen aus der Quellenliste des Projekts. Abrufdatum und Prüfsumme belegen, welcher Stand verwendet wurde.',
    cardsHeading: 'Eingesetzte Datenquellen',
    cardsFallback: 'Die Quellenliste ist in dieser Ausgabe nicht verfügbar.',
    card: {
      licence: 'Lizenz',
      retrieved: 'Abgerufen am',
      reference: 'Nachweis',
      sha256: 'SHA-256 (gekürzt)',
      attribution: 'Nennung',
    },
    noticeHeading: 'Pflichthinweise',
    notice:
      'Dieses Projekt ist nicht vom RKI, DWD oder anderen genannten Stellen erstellt oder gebilligt. Prognosen sind eigene Berechnungen auf Basis der Daten; Änderungen wurden vorgenommen.',
    licenceHeading: 'Lizenzen je Quelle',
    licenceCaption: 'Lizenz und Nennung je Quelle',
    licenceHead: { source: 'Quelle', licence: 'Lizenz', note: 'Nennung und Hinweise' },
    licenceSource: 'Quelle: die jeweilige Datenquelle. Stand der Angaben ist das Abrufdatum in der Quellenliste oben.',
    rows: {
      rki: {
        name: 'RKI-Datensätze (ARE-Konsultationsinzidenz, GrippeWeb, Influenzafälle)',
        licence: 'CC BY 4.0',
        note: 'Nennung wie in der Quellenliste, z. B. „Robert Koch-Institut, ARE-Konsultationsinzidenz, CC BY 4.0“. Verwendet werden wöchentliche Werte.',
      },
      amelag: {
        name: 'AMELAG Abwassersurveillance (Einzelstandorte)',
        licence: 'CC BY 4.0',
        note: 'Nennung: „Robert Koch-Institut und Umweltbundesamt, Abwassersurveillance AMELAG, CC BY 4.0“. Das Programm ist zeitlich begrenzt.',
      },
      dwd: {
        name: 'DWD Klimadaten (Tageswerte Temperatur)',
        licence: 'CC BY 4.0',
        note: 'Nennung: „Quelle: Deutscher Wetterdienst“. Änderungshinweis: Wochenmittel aus Tageswerten mehrerer Stationen berechnet.',
      },
      bkg: {
        name: 'BKG VG250 Verwaltungsgebiete (Bundesländer)',
        licence: 'dl-de/by-2-0',
        note: 'Nennung: „© GeoBasis-DE / BKG (2026) dl-de/by-2-0“. Geometrie vereinfacht (bearbeitet).',
        link: 'Datenquellen des BKG',
      },
      geonames: {
        name: 'GeoNames Postleitzahlen Deutschland',
        licence: 'CC BY 4.0',
        note: 'Nennung: „GeoNames, https://www.geonames.org, CC BY 4.0“.',
        link: 'geonames.org',
      },
      holidays: {
        name: 'Ferienzeiten je Bundesland',
        licence: 'Je Eintrag angegeben',
        note: 'Nennung: „Ferientermine: Kultusministerkonferenz, Ferienkalender der Länder; eigene Erfassung, Quelle je Eintrag“.',
      },
    },
    notUsedHeading: 'Nicht verwendete Quellen',
    notUsedIntro: 'Diese Datenarten werden bewusst nicht verwendet:',
    notUsed: {
      sharealike:
        'Quellen mit Weitergabebedingung (Share-Alike) oder ungeklärter Lizenz. Sie würden die Lizenz der Prognosen einschränken oder deren Nachnutzung unsicher machen.',
      search:
        'Indikatoren aus Suchanfragen. Ein solcher Ansatz überschätzte in der Fachliteratur den Grippegipfel der Saison 2012/13 um rund 140 %. Solche Signale fließen deshalb nicht in die Modelle ein.',
    },
    caveatsHeading: 'Einschränkungen der Daten',
    caveats: {
      retro:
        'Nachträgliche Korrekturen: Die ARE-Konsultationsinzidenz wird in den letzten etwa vier Wochen rückwirkend korrigiert. Prognosen verwenden den jeweils aktuellen Datenstand.',
      wastewater:
        'Abwasserdaten erscheinen bis zu zwei Wochen verspätet und können enden, weil das Programm zeitlich begrenzt ist.',
      withoutWastewater: 'Das Modell bleibt auch ohne Abwasserdaten nutzbar.',
    },
    fallback: 'Nicht verfügbar',
  },
  en: {
    title: 'Data & sources',
    description: 'Origin, licence and required attribution of the data used by Coldfront, and known limitations.',
    heading: 'Data & sources',
    intro:
      'Coldfront uses only publicly available data. The details per source come from the project source list. The retrieval date and checksum show which version of the data was used.',
    cardsHeading: 'Data sources used',
    cardsFallback: 'The source list is not available in this build.',
    card: {
      licence: 'Licence',
      retrieved: 'Retrieved on',
      reference: 'Reference',
      sha256: 'SHA-256 (shortened)',
      attribution: 'Attribution',
    },
    noticeHeading: 'Required notices',
    notice:
      'This project is not created or endorsed by RKI, DWD or other named bodies. Forecasts are our own calculations based on the data; changes have been made.',
    licenceHeading: 'Licences per source',
    licenceCaption: 'Licence and attribution per source',
    licenceHead: { source: 'Source', licence: 'Licence', note: 'Attribution and notes' },
    licenceSource: 'Source: the respective data provider. The date of the details is the retrieval date in the source list above.',
    rows: {
      rki: {
        name: 'RKI datasets (ARE consultation incidence, GrippeWeb, influenza cases)',
        licence: 'CC BY 4.0',
        note: 'Attribution as in the source list, e.g. "Robert Koch-Institut, ARE-Konsultationsinzidenz, CC BY 4.0". Weekly values are used.',
      },
      amelag: {
        name: 'AMELAG wastewater surveillance (single sites)',
        licence: 'CC BY 4.0',
        note: 'Attribution: "Robert Koch-Institut und Umweltbundesamt, Abwassersurveillance AMELAG, CC BY 4.0". The programme is time-limited.',
      },
      dwd: {
        name: 'DWD climate data (daily values, temperature)',
        licence: 'CC BY 4.0',
        note: 'Attribution: "Quelle: Deutscher Wetterdienst". Change notice: weekly means calculated from daily values of several stations.',
      },
      bkg: {
        name: 'BKG VG250 administrative boundaries (federal states)',
        licence: 'dl-de/by-2-0',
        note: 'Attribution: "© GeoBasis-DE / BKG (2026) dl-de/by-2-0". Geometry simplified (edited).',
        link: 'BKG data sources',
      },
      geonames: {
        name: 'GeoNames postal codes Germany',
        licence: 'CC BY 4.0',
        note: 'Attribution: "GeoNames, https://www.geonames.org, CC BY 4.0".',
        link: 'geonames.org',
      },
      holidays: {
        name: 'Vacation periods per federal state',
        licence: 'Stated per entry',
        note: 'Attribution: "Ferientermine: Kultusministerkonferenz, Ferienkalender der Länder; eigene Erfassung, Quelle je Eintrag".',
      },
    },
    notUsedHeading: 'Sources not used',
    notUsedIntro: 'These kinds of data are deliberately not used:',
    notUsed: {
      sharealike:
        'Sources with a share-alike condition or an unclear licence. They would restrict the licence of the forecasts or make their reuse uncertain.',
      search:
        'Indicators based on search queries. In the literature, such an approach overestimated the influenza peak of the 2012/13 season by about 140 %. For this reason such signals are not used in the models.',
    },
    caveatsHeading: 'Limitations of the data',
    caveats: {
      retro:
        'Retrospective corrections: ARE consultation incidence is corrected retrospectively for about the last four weeks. Forecasts use the data version that is current at the time of issue.',
      wastewater:
        'Wastewater data arrive up to two weeks late and may stop, because the programme is time-limited.',
      withoutWastewater: 'The model remains usable without wastewater data.',
    },
    fallback: 'Not available',
  },
};
