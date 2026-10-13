/** Messages of the "method" page (German and English). Owned by the page author. */
export const messages = {
  de: {
    title: 'Methode und Auswertung',
    description: 'Was Coldfront prognostiziert, welche Modelle verglichen werden, wie ausgewertet wird und welche Grenzen gelten.',
    heading: 'Methode und Auswertung',
    whatHeading: 'Was prognostiziert wird',
    whatText:
      'Coldfront prognostiziert die ARE-Konsultationsinzidenz des Robert Koch-Instituts: die geschätzten Arztbesuche wegen akuter respiratorischer Erkrankungen je 100.000 Einwohner und Woche. Die Prognose reicht 1 bis 4 Wochen über die letzte beobachtete Woche hinaus, für Deutschland und für jedes Bundesland. Jede Prognose enthält ein 50-%-Band und ein 80-%-Band.',
    modelsHeading: 'Die Modelle',
    modelsText: 'Vier Modelle werden verglichen. Ausgeliefert wird das Ensemble oder die Saisonbaseline, je nach Ergebnis der Auswertung (siehe unten).',
    modelsList: {
      baseline:
        'Saisonbaseline: Der Wert einer Kalenderwoche ist die Verteilung derselben Woche in früheren, bereinigten Jahren, jeweils mit ±1 Woche Fenster.',
      persistence: 'Persistenz: Die letzte beobachtete Woche wird unverändert fortgeschrieben. Sie ist der einfachste Referenzwert.',
      regional:
        'Regionales Modell: lineare Quantilregression auf dem logarithmierten Zuwachs, gepoolt über alle Bundesländer. Die Merkmalsgruppen werden im Tuning gewählt.',
      ensemble:
        'Ensemble: Mittel der Quantile von Saisonbaseline und regionalem Modell mit den Gewichten 0,5 und 0,5. Die Gewichte sind Startwerte.',
    },
    spreadText:
      'Verbreiterungsfaktor: Die Bänder des Ensembles werden mit einem Faktor k gestreckt, der auf den Tuning-Saisons gewählt wird (Raster von 1,0 bis 2,0). Die Regularisierung der Regression (Wert 1,0) ist ebenfalls ein Startwert.',
    groupsHeading: 'Merkmalsgruppen',
    groupsCaption: 'Merkmalsgruppen des regionalen Modells',
    groupsSource: 'Quelle: Paket forecast-core, Konfiguration pipeline/config/evaluation.json.',
    groupsHead: { group: 'Gruppe', content: 'Inhalt' },
    groups: {
      dynamics: 'Niveau gegenüber dem Vorjahr und Zuwachs der letzten 1 und 2 Wochen',
      season: 'Lage im Jahresverlauf (Kalenderwoche)',
      holiday: 'Anteil der Ferienzeiten am Ausgangspunkt und in der Zielwoche',
      weather: 'Wöchentliche Höchst- und Tiefsttemperatur (DWD) und deren Trend',
      wastewater: 'Abwasserlast für SARS-CoV-2, Influenza und RSV: Niveau und Zuwachs (AMELAG)',
    },
    groupNames: { dynamics: 'Dynamik', season: 'Saison', holiday: 'Ferien', weather: 'Wetter', wastewater: 'Abwasser' },
    ciFormat: 'von {lo} bis {hi}',
    seasonHeading: 'Warum keine Prognose für die ganze Saison',
    seasonText:
      'Wie stark eine Saison ausfällt, hängt von Erregermix, Immunität und Impfquoten ab. Diese Größen lassen sich aus den Daten nicht ableiten. Coldfront verlängert deshalb das beobachtete Geschehen um 1 bis 4 Wochen. Eine Aussage über Saisonhöhe oder Gipfeltermin weit darüber hinaus wird nicht gemacht.',
    protocolHeading: 'Auswertungsprotokoll',
    protocolIntro: 'Das Protokoll ist vor der ersten Auswertung festgelegt und wird nicht an Ergebnisse angepasst.',
    protocol: {
      rolling:
        'Keine Zufallsaufteilung: Die Auswertung läuft rollend. Zu jedem Ausgangspunkt stehen nur Daten zur Verfügung, die damals bekannt gewesen wären, mit dem Veröffentlichungsverzug je Signal.',
      seasons:
        'Tuning und Test: Die älteren Saisons dienen dem Tuning. Die jüngste Saison ist die unberührte Testsaison; sie wird einmal ausgewertet.',
      pandemic: 'Die Wochen von 2020-W10 bis 2022-W39 sind ausgeschlossen, weil Testung, Schließungen und Quarantäneregeln die Reihe verzerrten.',
      metrics:
        'Metriken: MAE (mittlerer absoluter Fehler des Medians), WIS (gewichteter Intervall-Score, kleiner ist besser, bewertet Median und beide Bänder zusammen) sowie die Abdeckung des 50-%- und 80-%-Bandes.',
      breakdowns:
        'Aufschlüsselung nach Bundesland, Prognosehorizont und Wellenphase. Phasen: niedrig unter 30 % des Saisonmaximums, Gipfel ab 85 % des Maximums, sonst Anstieg oder Abstieg nach der Richtung des geglätteten Verlaufs.',
      bootstrap:
        'Vergleiche mit Block-Bootstrap: Blöcke von 4 Wochen, 1.000 Ziehungen, fester Zufallsstartwert. Angegeben werden die mittlere WIS-Differenz, das 95-%-Intervall und die Zahl der Saisons, in denen das Modell besser ist.',
      peaks:
        'Gipfelfehler: Zeitverschiebung in Wochen und relative Höhenabweichung des Gipfels der Medianprognose gegenüber dem tatsächlichen Gipfel.',
      gate:
        'Veröffentlichungsregel: Ein Modell wird nur ausgeliefert, wenn seine mittlere WIS mindestens 10 % unter der Saisonbaseline liegt. Die 10 % sind ein Startwert ohne empirische Begründung. Andernfalls wird die Baseline ausgeliefert.',
    },
    resultsHeading: 'Ergebnisse der Testsaison',
    resultsIntro: 'Die Tabellen zeigen die einmalige Auswertung der Testsaison {season}. Die Zahlen werden nicht nachjustiert.',
    unavailableBacktest: 'Die Auswertung der Testsaison ist noch nicht verfügbar. Sie erscheint, sobald der Evaluationslauf abgeschlossen ist.',
    unavailableTuning: 'Die Ergebnisse des Tunings sind noch nicht verfügbar.',
    overallCaption: 'Gesamtergebnis je Modell',
    overallHead: { model: 'Modell', n: 'n', mae: 'MAE', wis: 'WIS', cov50: 'Abdeckung 50 %', cov80: 'Abdeckung 80 %' },
    gateHeading: 'Veröffentlichungsentscheidung',
    gateShipEnsemble:
      'Ausgeliefert wird das Ensemble. Seine mittlere WIS liegt {rel} unter der Saisonbaseline. Die Schwelle von {threshold} ist ein Startwert.',
    gateShipBaseline:
      'Ausgeliefert wird die Saisonbaseline. Das Ensemble verbessert die WIS gegenüber der Baseline um {rel}. Die Schwelle von {threshold} ist ein Startwert und wurde nicht erreicht.',
    gateNoValue: 'Ausgeliefert wird die Saisonbaseline, weil kein Vergleichswert vorliegt.',
    comparisonsHeading: 'Vergleiche mit Unsicherheit',
    comparisonsCaption: 'Vergleiche mit 95-%-Intervall',
    comparisonsNote: 'Eine negative WIS-Differenz bedeutet: Das erste Modell ist besser. Die Intervalle beruhen auf dem Block-Bootstrap.',
    comparisonsHead: { pair: 'Vergleich', diff: 'Mittlere WIS-Differenz', rel: 'Relative Verbesserung', ci: '95-%-Intervall', seasons: 'Saisons besser', n: 'n' },
    cmp: {
      ensembleBaseline: 'Ensemble gegen Saisonbaseline',
      ensemblePersistence: 'Ensemble gegen Persistenz',
      regionalBaseline: 'Regionales Modell gegen Saisonbaseline',
    },
    seasonsOf: '{won} von {total}',
    phaseHeading: 'Nach Wellenphase',
    phaseCaption: 'WIS nach Wellenphase',
    phaseHead: { phase: 'Phase' },
    phases: { low: 'niedrig', rise: 'Anstieg', peak: 'Gipfel', decline: 'Abstieg' },
    horizonHeading: 'Nach Prognosehorizont',
    horizonCaption: 'WIS nach Prognosehorizont',
    horizonHead: { weeks: 'Wochen voraus' },
    regionHeading: 'Nach Bundesland',
    regionCaption: 'WIS nach Bundesland',
    regionHead: { region: 'Bundesland' },
    modelNames: {
      baseline: 'Saisonbaseline',
      persistence: 'Persistenz',
      regional: 'Regionales Modell',
      ensemble: 'Ensemble',
    },
    peakHeading: 'Gipfelfehler',
    peakCaption: 'Gipfelfehler je Modell',
    peakHead: { model: 'Modell', n: 'Bewertete Gipfel', timing: 'Median Zeitfehler (Wochen)', height: 'Mittlere relative Höhenabweichung' },
    tuningHeading: 'Auswahl der Merkmale (Tuning)',
    tuningText:
      'Tuning auf den Saisons {tuned}. Gewählt wird die Merkmalsgruppe mit der niedrigsten mittleren WIS des Ensembles. Danach wird der Verbreiterungsfaktor mit der niedrigsten WIS gewählt. Gewählt wurde {candidate} mit k = {k}.',
    tuningReference: 'Zum Vergleich: WIS der Saisonbaseline {baseline}, WIS der Persistenz {persistence}.',
    tuningCaption: 'Kandidaten der Merkmalsgruppen',
    tuningChosen: 'gewählt',
    tuningHead: { candidate: 'Kandidat', groups: 'Merkmalsgruppen', ensemble: 'WIS Ensemble', model: 'WIS regionales Modell', n: 'n' },
    spreadCaption: 'Verbreiterungsfaktor k im Tuning',
    spreadHead: { k: 'Faktor k', wis: 'WIS Ensemble', cov50: 'Abdeckung 50 %', cov80: 'Abdeckung 80 %' },
    limitsHeading: 'Grenzen',
    limits: {
      seasons:
        'Wenige Saisons: Für die Bundesländer stehen nur etwa drei Saisons zur Verfügung. Unterschiede zwischen Modellen sind deshalb unsicher; die Intervalle zeigen das.',
      vintage:
        'Keine Datenstände am Ausgabetag: Die Auswertung verwendet die heute korrigierten Daten. Eine echte Prognose hatte nur den damaligen Stand. Die Auswertung fällt deshalb etwas zu günstig aus.',
      external:
        'Kein Vergleich mit anderen Prognosen: Ein Vergleich mit anderen deutschen Prognoseinitiativen ist noch nicht durchgeführt.',
      start:
        'Startwerte: Ensemblegewichte, Regularisierung, die 10-%-Schwelle und die Aktivitätsstufen sind nicht empirisch geprüft.',
      scope:
        'Keine Aussagen zu Einzelpersonen oder zur medizinischen Lage: Die Prognose beschreibt Trends auf Bevölkerungsebene, keine Diagnosen und keine Empfehlungen.',
    },
    source: 'Quelle: eigene Berechnung auf Daten des Robert Koch-Instituts',
    na: 'nicht verfügbar',
  },
  en: {
    title: 'Method and evaluation',
    description: 'What Coldfront forecasts, which models are compared, how they are evaluated and which limits apply.',
    heading: 'Method and evaluation',
    whatHeading: 'What is forecast',
    whatText:
      'Coldfront forecasts the ARE consultation incidence of the Robert Koch Institute: the estimated doctor visits for acute respiratory illness per 100,000 inhabitants and week. The forecast reaches 1 to 4 weeks beyond the last observed week, for Germany and for each federal state. Every forecast contains a 50 % band and an 80 % band.',
    modelsHeading: 'The models',
    modelsText: 'Four models are compared. Depending on the evaluation result, either the ensemble or the seasonal baseline is shipped (see below).',
    modelsList: {
      baseline:
        'Seasonal baseline: the value of a calendar week is the distribution of the same week in earlier, cleaned seasons, using a window of ±1 week.',
      persistence: 'Persistence: the last observed week is carried forward unchanged. It is the simplest reference.',
      regional:
        'Regional model: linear quantile regression on the logarithmic growth, pooled over all federal states. The feature groups are chosen in tuning.',
      ensemble:
        'Ensemble: average of the quantiles of the seasonal baseline and the regional model with weights 0.5 and 0.5. The weights are start values.',
    },
    spreadText:
      'Spread factor: the bands of the ensemble are widened by a factor k, which is chosen on the tuning seasons (grid from 1.0 to 2.0). The regularisation of the regression (value 1.0) is also a start value.',
    groupsHeading: 'Feature groups',
    groupsCaption: 'Feature groups of the regional model',
    groupsSource: 'Source: package forecast-core, configuration pipeline/config/evaluation.json.',
    groupsHead: { group: 'Group', content: 'Content' },
    groups: {
      dynamics: 'Level compared with the previous year and growth over the last 1 and 2 weeks',
      season: 'Position in the yearly cycle (calendar week)',
      holiday: 'Share of vacation periods at the origin and in the target week',
      weather: 'Weekly maximum and minimum temperature (DWD) and their trend',
      wastewater: 'Wastewater load for SARS-CoV-2, influenza and RSV: level and growth (AMELAG)',
    },
    groupNames: { dynamics: 'dynamics', season: 'season', holiday: 'holidays', weather: 'weather', wastewater: 'wastewater' },
    ciFormat: 'from {lo} to {hi}',
    seasonHeading: 'Why there is no forecast for the whole season',
    seasonText:
      'How strong a season is depends on the mix of pathogens, immunity and vaccination rates. These quantities cannot be derived from the data. Coldfront therefore extends the observed activity by 1 to 4 weeks. It does not make statements about the season level or the timing of a peak far beyond that.',
    protocolHeading: 'Evaluation protocol',
    protocolIntro: 'The protocol was fixed before the first evaluation and is not adjusted to results.',
    protocol: {
      rolling:
        'No random split: the evaluation rolls forward. At each origin only data are used that would have been known at the time, with the publication lag of each signal.',
      seasons:
        'Tuning and test: the earlier seasons are used for tuning. The most recent season is the untouched test season and is evaluated once.',
      pandemic: 'The weeks from 2020-W10 to 2022-W39 are excluded, because testing, closures and quarantine rules distorted the series.',
      metrics:
        'Metrics: MAE (mean absolute error of the median), WIS (weighted interval score, lower is better, scores the median and both bands together) and the coverage of the 50 % and 80 % bands.',
      breakdowns:
        'Breakdowns by federal state, forecast horizon and wave phase. Phases: low below 30 % of the seasonal maximum, peak from 85 % of the maximum, otherwise rise or decline according to the direction of the smoothed curve.',
      bootstrap:
        'Comparisons use a block bootstrap: blocks of 4 weeks, 1,000 draws, fixed random seed. Reported are the mean WIS difference, the 95 % interval and the number of seasons in which the model is better.',
      peaks:
        'Peak errors: timing offset in weeks and relative height error of the peak of the median forecast against the actual peak.',
      gate:
        'Publication rule: a model is shipped only if its mean WIS is at least 10 % below the seasonal baseline. The 10 % are a start value without empirical justification. Otherwise the baseline is shipped.',
    },
    resultsHeading: 'Results of the test season',
    resultsIntro: 'The tables show the one-time evaluation of the test season {season}. The figures are not readjusted.',
    unavailableBacktest: 'The evaluation of the test season is not available yet. It appears once the evaluation run has finished.',
    unavailableTuning: 'The tuning results are not available yet.',
    overallCaption: 'Overall result per model',
    overallHead: { model: 'Model', n: 'n', mae: 'MAE', wis: 'WIS', cov50: 'Coverage 50 %', cov80: 'Coverage 80 %' },
    gateHeading: 'Publication decision',
    gateShipEnsemble:
      'The ensemble is shipped. Its mean WIS is {rel} below the seasonal baseline. The threshold of {threshold} is a start value.',
    gateShipBaseline:
      'The seasonal baseline is shipped. The ensemble improves the WIS over the baseline by {rel}. The threshold of {threshold} is a start value and was not reached.',
    gateNoValue: 'The seasonal baseline is shipped because no comparison value is available.',
    comparisonsHeading: 'Comparisons with uncertainty',
    comparisonsCaption: 'Comparisons with 95 % interval',
    comparisonsNote: 'A negative WIS difference means that the first model is better. The intervals rest on the block bootstrap.',
    comparisonsHead: { pair: 'Comparison', diff: 'Mean WIS difference', rel: 'Relative improvement', ci: '95 % interval', seasons: 'Seasons better', n: 'n' },
    cmp: {
      ensembleBaseline: 'Ensemble versus seasonal baseline',
      ensemblePersistence: 'Ensemble versus persistence',
      regionalBaseline: 'Regional model versus seasonal baseline',
    },
    seasonsOf: '{won} of {total}',
    phaseHeading: 'By wave phase',
    phaseCaption: 'WIS by wave phase',
    phaseHead: { phase: 'Phase' },
    phases: { low: 'low', rise: 'rise', peak: 'peak', decline: 'decline' },
    horizonHeading: 'By forecast horizon',
    horizonCaption: 'WIS by forecast horizon',
    horizonHead: { weeks: 'Weeks ahead' },
    regionHeading: 'By federal state',
    regionCaption: 'WIS by federal state',
    regionHead: { region: 'Federal state' },
    modelNames: {
      baseline: 'Seasonal baseline',
      persistence: 'Persistence',
      regional: 'Regional model',
      ensemble: 'Ensemble',
    },
    peakHeading: 'Peak errors',
    peakCaption: 'Peak errors per model',
    peakHead: { model: 'Model', n: 'Scored peaks', timing: 'Median timing error (weeks)', height: 'Mean relative height error' },
    tuningHeading: 'Feature selection (tuning)',
    tuningText:
      'Tuning on the seasons {tuned}. The feature group with the lowest mean WIS of the ensemble is chosen. The spread factor with the lowest WIS is chosen next. The chosen candidate is {candidate} with k = {k}.',
    tuningReference: 'For comparison: WIS of the seasonal baseline {baseline}, WIS of persistence {persistence}.',
    tuningCaption: 'Feature group candidates',
    tuningChosen: 'chosen',
    tuningHead: { candidate: 'Candidate', groups: 'Feature groups', ensemble: 'WIS ensemble', model: 'WIS regional model', n: 'n' },
    spreadCaption: 'Spread factor k in tuning',
    spreadHead: { k: 'Factor k', wis: 'WIS ensemble', cov50: 'Coverage 50 %', cov80: 'Coverage 80 %' },
    limitsHeading: 'Limits',
    limits: {
      seasons:
        'Few seasons: only about three seasons are available for the federal states. Differences between models are therefore uncertain; the intervals show this.',
      vintage:
        'No data versions as of the issue date: the evaluation uses today\'s corrected data. A live forecast only had the data of its time. The evaluation therefore looks somewhat better than a live forecast would.',
      external:
        'No comparison with other forecasts: a comparison with other German forecasting initiatives has not been carried out yet.',
      start:
        'Start values: ensemble weights, regularisation, the 10 % threshold and the activity levels have not been checked empirically.',
      scope:
        'No statements about individuals or the medical situation: the forecast describes trends at population level, not diagnoses and not recommendations.',
    },
    source: 'Source: own calculation based on data of the Robert Koch Institute',
    na: 'not available',
  },
};
