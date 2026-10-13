/** Messages of the "index" page (German and English). Owned by the page author. */
export const messages = {
  de: {
    title: 'Prognose Atemwegserkrankungen',
    description:
      'Wöchentliche Prognose der Arztbesuche wegen akuter Atemwegserkrankungen für Deutschland und die 16 Bundesländer, 1 bis 4 Wochen voraus, mit Unsicherheitsbereichen.',
    heading: 'Akute Atemwegserkrankungen: Prognose für Deutschland',
    intro:
      'Die ARE-Konsultationsinzidenz ist die geschätzte Zahl der Arztbesuche wegen akuter Atemwegserkrankungen je 100.000 Einwohner und Woche; die Ausgangsdaten stammen vom Robert Koch-Institut.',
    dataLine: 'Datenstand {data} · Prognose vom {issued}',
    staleNotice:
      'Achtung: Der Datenstand ist älter als neun Tage. Möglicherweise ist ein Aktualisierungslauf ausgefallen; die Zahlen sind dann nicht mehr aktuell.',
    chart: {
      title: 'Arztbesuche wegen akuter Atemwegserkrankungen je 100.000 Einwohner, bundesweit',
      currentSeason: 'Aktuelle Saison',
      previousSeasons: 'Frühere Saisons',
      forecast: 'Prognose (Median)',
      band50: '50 %-Bereich',
      band80: '80 %-Bereich',
      yAxis: 'Arztbesuche je 100.000',
      showTable: 'Daten als Tabelle anzeigen',
      tableWeek: 'Woche',
      tableObserved: 'Beobachtet',
      tableMedian: 'Median',
      tableRange50: '50 %-Bereich',
      tableRange80: '80 %-Bereich',
      sourceLine: 'Quelle: Robert Koch-Institut; eigene Berechnung (Prognose)',
    },
    hero: {
      heading: 'Bundesweite Prognose',
      horizonLegend: 'Prognosezeitraum wählen',
      horizon: '{n} Woche voraus ({week})|{n} Wochen voraus ({week})',
      sentence:
        'In {week} erwarten wir bundesweit rund {median} Arztbesuche wegen akuter Atemwegserkrankungen je 100.000 Einwohner. Mit 80 % Wahrscheinlichkeit liegt der Wert zwischen {low} und {high}.',
      indexSimilar: 'Das ist etwa so viel wie üblich für diese Woche.',
      indexTimes: 'Das ist das {index}-fache des für diese Woche üblichen Wertes.',
      indexExplain: 'Index {index}: Verhältnis der Prognose zum saisonal üblichen Wert; 1,00 bedeutet üblich.',
      level: 'Einstufung:',
      thresholds:
        'Einstufung nach dem Verhältnis zum üblichen Wert: normal unter dem {elevated}-fachen, erhöht ab dem {elevated}-fachen, hoch ab dem {high}-fachen. Diese Schwellen sind Startwerte und nicht validiert.',
    },
    levels: { normal: 'normal', elevated: 'erhöht', high: 'hoch' },
    map: {
      heading: 'Karte der Bundesländer',
      intro:
        'Die Farbe zeigt den Index des gewählten Prognosezeitraums. Dieselben Werte stehen als Text in der Liste daneben und in der Tabelle unter der Karte.',
      title: 'Karte: Index der Bundesländer für den gewählten Zeitraum',
      legendTitle: 'Index (1 = üblich)',
      legendLow: '0,5 niedriger',
      legendHigh: '2 höher',
      noData: 'keine Daten',
      showTable: 'Werte als Tabelle anzeigen',
      tableRegion: 'Bundesland',
      tableValue: 'Index und Einstufung',
      valueLabel: 'Index {index} ({level})',
    },
    list: {
      heading: 'Bundesländer',
      intro: 'Jedes Bundesland führt zu seiner eigenen Prognoseseite.',
      range80: '80 %-Bereich {low} bis {high}',
    },
    postcode: {
      heading: 'Prognose für Ihre Region',
      intro:
        'Geben Sie Ihre Postleitzahl ein, um direkt zur Prognose Ihres Bundeslands zu gelangen. Die Suche läuft in Ihrem Browser; Ihre Postleitzahl wird nicht übertragen. Geladen wird nur die Zuordnungstabelle.',
      label: 'Postleitzahl (fünf Ziffern)',
      submit: 'Region anzeigen',
      invalid: 'Bitte geben Sie genau fünf Ziffern ein, zum Beispiel 04109.',
      unknown: 'Die Postleitzahl {plz} ist uns nicht bekannt. Bitte prüfen Sie die Eingabe.',
      loading: 'Suche läuft …',
      found: 'Weiter zur Prognose für {region} …',
      loadFailed: 'Die Postleitzahl-Zuordnung konnte nicht geladen werden. Bitte versuchen Sie es später erneut.',
    },
    quality: {
      link: 'Warum Sie der Prognose trauen können — und warum nicht blind',
      shipped:
        'Im unabhängigen Testzeitraum hatte das Modell einen um {pct} kleineren Prognosefehler (WIS, kleiner ist besser) als die saisonale Referenz. Veröffentlicht wird es nur bei mindestens {threshold} Vorsprung; ausgeliefert wird das Modell.',
      baseline:
        'Im unabhängigen Testzeitraum erreichte das Modell den nötigen Vorsprung von {threshold} nicht; ausgeliefert wird deshalb die saisonale Referenz.',
      none: 'Für diese Auswertung liegt kein Ergebnis vor.',
      evaluationNote:
        'Hinweis: Die Auswertung nutzt die heute korrigierten Daten, nicht die damals gemeldeten Erstwerte. Die Trefferquote im laufenden Betrieb kann davon abweichen.',
    },
  },
  en: {
    title: 'Respiratory illness forecast',
    description:
      'Weekly forecast of doctor visits for acute respiratory illness for Germany and its 16 federal states, 1 to 4 weeks ahead, with uncertainty ranges.',
    heading: 'Acute respiratory illness: forecast for Germany',
    intro:
      'ARE consultation incidence is the estimated number of doctor visits for acute respiratory illness per 100,000 inhabitants and week; the underlying data come from the Robert Koch Institute.',
    dataLine: 'Data version {data} · Forecast issued {issued}',
    staleNotice:
      'Warning: The data version is older than nine days. An update run may have failed, so the figures may no longer be current.',
    chart: {
      title: 'Doctor visits for acute respiratory illness per 100,000 inhabitants, nationwide',
      currentSeason: 'Current season',
      previousSeasons: 'Previous seasons',
      forecast: 'Forecast (median)',
      band50: '50 % range',
      band80: '80 % range',
      yAxis: 'Doctor visits per 100,000',
      showTable: 'Show data as a table',
      tableWeek: 'Week',
      tableObserved: 'Observed',
      tableMedian: 'Median',
      tableRange50: '50 % range',
      tableRange80: '80 % range',
      sourceLine: 'Source: Robert Koch Institute; own calculation (forecast)',
    },
    hero: {
      heading: 'Nationwide forecast',
      horizonLegend: 'Choose the forecast horizon',
      horizon: '{n} week ahead ({week})|{n} weeks ahead ({week})',
      sentence:
        'In {week} we expect nationwide about {median} doctor visits for acute respiratory illness per 100,000 inhabitants. With 80 % probability the value lies between {low} and {high}.',
      indexSimilar: 'That is about as much as usual for this week.',
      indexTimes: 'That is {index} times the usual value for this week.',
      indexExplain: 'Index {index}: ratio of the forecast to the seasonal usual value; 1.00 means usual.',
      level: 'Classification:',
      thresholds:
        'Classification by the ratio to the usual value: normal below {elevated} times, elevated from {elevated} times, high from {high} times. These thresholds are starting values and have not been validated.',
    },
    levels: { normal: 'normal', elevated: 'elevated', high: 'high' },
    map: {
      heading: 'Map of the federal states',
      intro:
        'The colour shows the index for the selected forecast horizon. The same values appear as text in the list next to the map and in the table below it.',
      title: 'Map: index of the federal states for the selected horizon',
      legendTitle: 'Index (1 = usual)',
      legendLow: '0.5 lower',
      legendHigh: '2 higher',
      noData: 'no data',
      showTable: 'Show values as a table',
      tableRegion: 'Federal state',
      tableValue: 'Index and classification',
      valueLabel: 'Index {index} ({level})',
    },
    list: {
      heading: 'Federal states',
      intro: 'Each federal state has its own forecast page.',
      range80: '80 % range {low} to {high}',
    },
    postcode: {
      heading: 'Forecast for your area',
      intro:
        'Enter your postcode to go directly to the forecast of your federal state. The lookup runs in your browser; your postcode is not transmitted. Only the lookup table is loaded.',
      label: 'Postcode (five digits)',
      submit: 'Show region',
      invalid: 'Please enter exactly five digits, for example 04109.',
      unknown: 'The postcode {plz} is not known to us. Please check the entry.',
      loading: 'Searching …',
      found: 'Going to the forecast for {region} …',
      loadFailed: 'The postcode lookup table could not be loaded. Please try again later.',
    },
    quality: {
      link: 'Why you can trust the forecast — and why not blindly',
      shipped:
        'In the untouched test season the model had a {pct} smaller forecast error (WIS, lower is better) than the seasonal reference. It is only published with at least {threshold} advantage; the model is shipped.',
      baseline:
        'In the untouched test season the model did not reach the required advantage of {threshold}; the seasonal reference is therefore shipped.',
      none: 'No result is available for this evaluation.',
      evaluationNote:
        'Note: The evaluation uses today’s corrected data, not the first reported values that were available at the time. Hit rates in day-to-day operation may differ.',
    },
  },
} as const;
