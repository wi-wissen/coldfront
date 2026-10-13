/** Messages of the "method" page (German and English). Owned by the page author. */
export const messages = {
  de: {
    title: 'Methode und Auswertung',
    description: 'Was Coldfront prognostiziert, welche Modelle verglichen werden, wie ausgewertet wird, wie sich das Protokoll geändert hat und welche Grenzen gelten.',
    heading: 'Methode und Auswertung',
    whatHeading: 'Was prognostiziert wird',
    whatText:
      'Coldfront prognostiziert die ARE-Konsultationsinzidenz des Robert Koch-Instituts: die geschätzten Arztbesuche wegen akuter respiratorischer Erkrankungen je 100.000 Einwohner und Woche. Die Prognose reicht 1 bis 4 Wochen über die letzte beobachtete Woche hinaus, für Deutschland und für jedes Bundesland. Jede Prognose enthält ein 50-%-Band und ein 80-%-Band.',
    modelsHeading: 'Die Modelle',
    modelsText:
      'Fünf Modelle werden verglichen. Ausgeliefert wird das Ensemble oder die kalenderbereinigte Saisonbaseline, je nach Ergebnis der Auswertung (siehe unten).',
    modelsList: {
      baselinePlain:
        'Saisonbaseline (einfach): Der Wert einer Kalenderwoche ist die Verteilung derselben Woche in früheren, bereinigten Jahren, jeweils mit ±1 Woche Fenster. Das war die Baseline des ersten Protokolls.',
      baseline:
        'Saisonbaseline (kalenderbereinigt): wie die einfache Baseline, aber die früheren Werte werden zuvor um den Kalendereffekt der Inanspruchnahme bereinigt und auf die Zielwoche ausgerichtet. Sie ist die strengere Referenz des zweiten Protokolls und wird bei Rückfall ausgeliefert.',
      persistence: 'Persistenz: Die letzte beobachtete Woche wird unverändert fortgeschrieben. Sie ist der einfachste Referenzwert.',
      regional:
        'Regionales Modell: lineare Quantilregression auf dem logarithmierten Zuwachs, gepoolt über alle Bundesländer, mit Kalenderbereinigung. Die Merkmalsgruppen werden im Tuning gewählt.',
      ensemble:
        'Ensemble: gewichtetes Mittel der Quantile von Saisonbaseline und regionalem Modell. Das Gewicht des regionalen Modells wird im Tuning aus einem Raster gewählt (Startwert 0,5).',
    },
    spreadText:
      'Verbreiterungsfaktor: Die Bänder des Ensembles werden mit einem Faktor k gestreckt, der gemeinsam mit dem Ensemblegewicht auf den Tuning-Saisons gewählt wird. Die Regularisierung der Regression (Wert 1,0) ist ein Startwert.',
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
    protocolIntro:
      'Das Protokoll (Version 1) wurde vor der ersten Auswertung festgelegt. Es wurde danach einmal geändert (Version 2, siehe unten). Hier steht der Stand der Version 2.',
    protocol: {
      rolling:
        'Keine Zufallsaufteilung: Die Auswertung läuft rollend. Zu jedem Ausgangspunkt stehen nur Daten zur Verfügung, die damals bekannt gewesen wären, mit dem Veröffentlichungsverzug je Signal.',
      seasons:
        'Tuning und Test: Die älteren Saisons dienen dem Tuning, die jüngste war die Testsaison. Unter Version 1 wurde diese Testsaison einmal ausgewertet und war damals unberührt. Unter Version 2 ist sie nur noch beschreibend; die nächste unberührte Testsaison ist 2026/27.',
      pandemic: 'Die Wochen von 2020-W10 bis 2022-W39 sind ausgeschlossen, weil Testung, Schließungen und Quarantäneregeln die Reihe verzerrten.',
      metrics:
        'Metriken: MAE (mittlerer absoluter Fehler des Medians), WIS (gewichteter Intervall-Score, kleiner ist besser, bewertet Median und beide Bänder zusammen) sowie die Abdeckung des 50-%- und 80-%-Bandes.',
      breakdowns:
        'Aufschlüsselung nach Bundesland, Prognosehorizont und Wellenphase. Phasen: niedrig unter 30 % des Saisonmaximums, Gipfel ab 85 % des Maximums, sonst Anstieg oder Abstieg nach der Richtung des geglätteten Verlaufs.',
      bootstrap:
        'Vergleiche mit Block-Bootstrap: Blöcke von 4 Wochen, 1.000 Ziehungen, fester Zufallsstartwert. Angegeben werden die mittlere WIS-Differenz, das 95-%-Intervall und die Zahl der Saisons, in denen das Modell besser ist.',
      peaks:
        'Gipfelzeitpunkt (neu in Version 2): je Prognosehorizont, siehe die Definition im Abschnitt zum Gipfelzeitpunkt.',
      gate:
        'Veröffentlichungsregel: Ein Modell wird nur ausgeliefert, wenn seine mittlere WIS mindestens 10 % unter der kalenderbereinigten Saisonbaseline liegt. Die 10 % sind ein Startwert ohne empirische Begründung. Andernfalls wird diese Baseline ausgeliefert.',
    },
    amendmentHeading: 'Änderung des Protokolls (Version 2)',
    amendmentWhy:
      'Nach der ersten Auswertung wurde auf den Tuning-Saisons (nur dort, nicht auf der Testsaison) eine Diagnose durchgeführt. Sie fand einen großen, regelmäßigen Kalendereffekt der Inanspruchnahme in den ARE-Daten, den das Modell der Version 1 nicht erklären konnte, eine fehlerhafte Gipfelmetrik und eine Uneinheitlichkeit bei den Verzugszeiten der Abwassermerkmale. Daraufhin wurde das Protokoll geändert und erneut festgeschrieben.',
    amendment: {
      calendar:
        'Kalenderbereinigung: Geschlossene Wochentage senken die Zahl der Arztbesuche um etwa den Faktor 0,81 je Tag, die Woche zwischen den Jahren um etwa den Faktor 0,4. In den GrippeWeb-Daten, die nicht auf Arztbesuchen beruhen, zeigt sich diese Delle nicht. Der Effekt ist nur auf den Daten bis 2023-W35 geschätzt und wird im regionalen Modell und in der Saisonbaseline berücksichtigt.',
      lags: 'Einheitliche Verzugszeiten: Die Veröffentlichungsverzüge der Merkmale gelten jetzt im Training und in der Prognose gleich.',
      joint: 'Gemeinsame Wahl: Das Ensemblegewicht und der Verbreiterungsfaktor werden zusammen auf den Tuning-Saisons aus einem Raster gewählt.',
      peak: 'Neue Gipfelmetrik: Der Gipfelzeitpunkt wird je Horizont bewertet (Definition unten); die alte, über alle Horizonte zusammengefasste Metrik war fehlerhaft und wurde ersetzt.',
      reference:
        'Strengere Referenz: Die Veröffentlichungsregel vergleicht mit der kalenderbereinigten Saisonbaseline. Die einfache Baseline des ersten Protokolls wird weiter ausgewiesen.',
      vacation: 'Ferienzeiten liegen jetzt ab der Saison 2012/13 vor, sodass frühere Weihnachtsdellen mit ihren Kalendermerkmalen ins Training eingehen.',
    },
    amendmentStatus:
      'Status der Testsaison: Die Saison wurde unter Version 1 einmal ausgewertet und war damals unberührt. Unter Version 2 wird sie ein zweites Mal ausgewertet, nur zur Beschreibung. Sie ist kein unabhängiger Test mehr. Für die Auswahl unter Version 2 wurden ausschließlich die Tuning-Saisons verwendet.',
    resultsHeading: 'Ergebnisse (Protokoll Version 2)',
    noticeTitle: 'Wichtiger Hinweis zur Testsaison',
    noticeText:
      'Die Saison {season} wurde zuerst einmal nach dem ersten Protokoll ausgewertet; damals war sie unberührt. Danach wurde das Protokoll geändert (Version 2, Diagnose nur auf den Tuning-Saisons), und die Saison {season} wurde ein zweites Mal ausgewertet. Die Zahlen unten sind deshalb eine beschreibende Neuauswertung und kein unabhängiger Test. Die nächste unberührte Testsaison ist 2026/27; sie wird nach 2027-W39 einmal ausgewertet.',
    resultsIntro:
      'Die Tabellen zeigen die Auswertung der Saison {season} unter Version 2 mit {n} bewerteten Prognosen (Region, Ursprungswoche und Horizont). Gewählt wurden das Merkmalsset {candidate}, ein Gewicht von {weight} für das regionale Modell und k = {k}, alles auf den Tuning-Saisons.',
    unavailableBacktest: 'Die Auswertung der Testsaison ist noch nicht verfügbar. Sie erscheint, sobald der Evaluationslauf abgeschlossen ist.',
    unavailableTuning: 'Die Ergebnisse des Tunings sind noch nicht verfügbar.',
    overallHead: { model: 'Modell', n: 'n', mae: 'MAE', wis: 'WIS', cov50: 'Abdeckung 50 %', cov80: 'Abdeckung 80 %' },
    versionsHeading: 'Protokoll 1 und Protokoll 2 im Vergleich',
    versionsCaption: 'Gesamtergebnis je Modell: erstes Protokoll (v1) und zweites Protokoll (v2), Saison {season}',
    versionsNote:
      'Beide Spalten betreffen dieselbe Saison. Das Ergebnis von v1 war die einmalige Auswertung; v2 ist beschreibend. Ein Strich bedeutet: Das Modell gab es unter v1 nicht. Die Unterschiede entstehen durch die Änderungen oben, nicht durch neue Daten.',
    versionsHead: {
      model: 'Modell',
      wis1: 'WIS (v1)',
      wis2: 'WIS (v2)',
      mae1: 'MAE (v1)',
      mae2: 'MAE (v2)',
      c501: 'Abdeckung 50 % (v1)',
      c502: 'Abdeckung 50 % (v2)',
      c801: 'Abdeckung 80 % (v1)',
      c802: 'Abdeckung 80 % (v2)',
    },
    gateHeading: 'Veröffentlichungsentscheidung',
    gateShipEnsemble:
      'Ausgeliefert wird das Ensemble. Seine mittlere WIS liegt {rel} unter der kalenderbereinigten Saisonbaseline. Die Schwelle von {threshold} ist ein Startwert.',
    gateShipBaseline:
      'Ausgeliefert wird die kalenderbereinigte Saisonbaseline. Das Ensemble verbessert die WIS gegenüber dieser Baseline um {rel}. Die Schwelle von {threshold} ist ein Startwert und wurde nicht erreicht.',
    gateNoValue: 'Ausgeliefert wird die kalenderbereinigte Saisonbaseline, weil kein Vergleichswert vorliegt.',
    gateScope: 'Diese Entscheidung beruht auf einer einzigen, bereits bekannten Saison und ist deshalb vorläufig.',
    comparisonsHeading: 'Vergleiche mit Unsicherheit',
    comparisonsCaption: 'Vergleiche mit 95-%-Intervall',
    comparisonsNote:
      'Eine negative WIS-Differenz bedeutet: Das erste Modell ist besser. Die Intervalle beruhen auf dem Block-Bootstrap über die Wochen einer einzigen Saison. Eine Saison ist eine dünne Basis: Das Intervall zeigt die Streuung innerhalb der Saison, nicht die Unsicherheit zwischen Saisons.',
    comparisonsHead: { pair: 'Vergleich', diff: 'Mittlere WIS-Differenz', rel: 'Relative Verbesserung', ci: '95-%-Intervall', seasons: 'Saisons besser', n: 'n' },
    cmp: {
      ensembleBaseline: 'Ensemble gegen kalenderbereinigte Saisonbaseline',
      ensembleBaselinePlain: 'Ensemble gegen einfache Saisonbaseline',
      ensemblePersistence: 'Ensemble gegen Persistenz',
      regionalBaseline: 'Regionales Modell gegen kalenderbereinigte Saisonbaseline',
    },
    seasonsOf: '{won} von {total}',
    phaseHeading: 'Nach Wellenphase',
    phaseCaption: 'WIS nach Wellenphase',
    phaseHead: { phase: 'Phase' },
    phases: { low: 'niedrig', rise: 'Anstieg', peak: 'Gipfel', decline: 'Abstieg' },
    horizonHeading: 'Nach Prognosehorizont',
    horizonCaption: 'WIS nach Prognosehorizont',
    horizonHead: { weeks: 'Wochen voraus' },
    regionHeading: 'Nach Bundesland und für Deutschland',
    regionCaption: 'WIS nach Region, einschließlich Deutschland insgesamt',
    regionHead: { region: 'Region', gain: 'Ensemble gegenüber Baseline' },
    regionNote:
      'Die letzte Spalte zeigt den Vorsprung der Ensemble-WIS gegenüber der kalenderbereinigten Baseline (positiv: Ensemble besser). Die Zeile Deutschland ist hervorgehoben.',
    regionSummary:
      'Auf nationaler Ebene liegt das Ensemble {nat} gegenüber der kalenderbereinigten Baseline vorn, in den Bundesländern zwischen {min} und {max}.',
    regionSummaryEqual: 'Auf nationaler Ebene ist das Ensemble damit etwa gleichauf mit der kalenderbereinigten Baseline; der Gewinn steckt vor allem in den Bundesländern.',
    nationalTag: 'national',
    modelNames: {
      baseline: 'Saisonbaseline (kalenderbereinigt)',
      baselinePlain: 'Saisonbaseline (einfach)',
      persistence: 'Persistenz',
      regional: 'Regionales Modell',
      ensemble: 'Ensemble',
    },
    external: 'extern',
    peakHeading: 'Gipfelzeitpunkt',
    peakDefinition:
      'Definition (Version 2): Je Region, Saison und Prognosehorizont wird der Gipfel im Winterfenster von Kalenderwoche 45 bis Kalenderwoche 15 gesucht, und zwar als Maximum des zentrierten Drei-Wochen-Mittels. Die Woche zwischen den Jahren und die Woche danach sind dabei entfernt. Verglichen wird der Gipfel der Medianprognose mit dem Gipfel der tatsächlichen Werte; angegeben sind der mediane absolute Zeitfehler in Wochen und der Anteil der Fälle innerhalb von ±1 Woche.',
    peakReference:
      'Die Persistenz liegt bauartbedingt etwa h Wochen zurück, denn sie wiederholt die letzte Woche; ihr Zeitfehler dient als Referenz für „nichts gelernt“.',
    peakOld: 'Die alte Gipfelmetrik des ersten Protokolls fasste alle Horizonte und Wochen zusammen, war unstetig und wurde ersetzt. Ihre Werte sind nicht vergleichbar.',
    peakHonest:
      'Das Ensemble trifft den Gipfel bei Horizont 1 nur in {share1} der Fälle innerhalb einer Woche (Median {med1} Wochen Abweichung). Bei Horizont 2 bis 4 liegt der mediane Zeitfehler zwischen {lo} und {hi} Wochen. Das ist eine echte Schwäche: Für den Gipfeltermin ist die Prognose nicht geeignet.',
    peakCaption: 'Gipfelzeitpunkt und -höhe je Modell (alle Horizonte)',
    peakHead: {
      model: 'Modell',
      n: 'Bewertete Fälle',
      timing: 'Median Zeitfehler (Wochen)',
      within: 'Anteil innerhalb ±1 Woche',
      ambiguous: 'Davon mehrdeutig',
      height: 'Mittlere relative Höhenabweichung',
    },
    peakTimingCaption: 'Median des absoluten Gipfel-Zeitfehlers in Wochen, je Horizont',
    peakWithinCaption: 'Anteil der Gipfel innerhalb von ±1 Woche, je Horizont',
    peakAmbiguousNote:
      'Mehrdeutig heißt: Die tatsächliche Kurve hat einen zweiten Gipfel von mindestens 90 % des Maximums, der Zeitpunkt ist dort nicht eindeutig.',
    tuningHeading: 'Auswahl der Merkmale, des Gewichts und der Verbreiterung (Tuning)',
    tuningText:
      'Tuning auf den Saisons {tuned}. Zu jedem Merkmalsset wird gemeinsam das beste Ensemblegewicht und der beste Verbreiterungsfaktor gesucht. Gewählt wird das Set mit der niedrigsten mittleren WIS des Ensembles. Gewählt wurde {candidate} mit Gewicht {weight} für das regionale Modell und k = {k}.',
    tuningReference:
      'Zum Vergleich auf denselben Tuning-Saisons: WIS der kalenderbereinigten Saisonbaseline {baseline}, der einfachen Baseline {plain}, der Persistenz {persistence}.',
    tuningCaption: 'Kandidaten der Merkmalsgruppen mit ihrem besten Gewicht und Faktor',
    tuningChosen: 'gewählt',
    tuningHead: { candidate: 'Kandidat', groups: 'Merkmalsgruppen', weight: 'Gewicht regionales Modell', k: 'Faktor k', ensemble: 'WIS Ensemble', model: 'WIS regionales Modell', n: 'n' },
    spreadCaption: 'Verbreiterungsfaktor k im Tuning (gewählter Kandidat)',
    spreadHead: { k: 'Faktor k', wis: 'WIS Ensemble', cov50: 'Abdeckung 50 %', cov80: 'Abdeckung 80 %' },
    vintageHeading: 'Echte Datenstände',
    vintageIntro:
      'Das RKI korrigiert die ARE-Werte nachträglich. Über die öffentliche Versionsgeschichte seiner Daten (seit September 2023) lässt sich rekonstruieren, was zum jeweiligen Ausgangspunkt tatsächlich bekannt war. Die Tabelle vergleicht die WIS mit den heute korrigierten Daten und mit den damaligen Datenständen.',
  vintageNote:
      'Hinweis: In beiden Varianten sind die zu treffenden Werte die heute korrigierten Werte. Revisionen von Abwasser- und Wetterdaten werden nicht nachgebildet. Positive Veränderung bedeutet: Mit den damaligen Datenständen ist die WIS schlechter.',
    vintageUnavailable: 'Der Vergleich mit den echten Datenständen wird berechnet und ist noch nicht verfügbar.',
    vintageCaption: 'WIS mit heute korrigierten Daten und mit den damaligen Datenständen',
    vintageHead: { model: 'Modell', final: 'WIS mit korrigierten Daten', vintage: 'WIS mit damaligem Datenstand', rel: 'Veränderung', n: 'Zellen' },
    vintageGroup: '{seasons}: {vintage} von {total} Ausgangspunkten mit echtem Datenstand, {fallback} mit Rückgriff auf den korrigierten Stand',
    externalHeading: 'Vergleich mit anderen Prognosen (national)',
    externalIntro:
      'Für Deutschland insgesamt liegen Prognosen anderer Gruppen im RESPINOW-Hub vor ({name}). Ihre Fallzahlen wurden mit dem festen Bevölkerungsverhältnis {ratio} in Fälle je 100.000 umgerechnet. Verglichen werden nur Zellen, für die alle gezeigten Modelle eine Prognose haben (Panel „core“: Modelle, die beide Saisons abdecken). Die Prognosen der anderen Gruppen sind unten mit „extern“ gekennzeichnet.',
    externalUnavailable: 'Der Vergleich mit externen Prognosen ist noch nicht verfügbar.',
    externalOverallCaption: 'Gesamtergebnis im Vergleich mit externen Prognosen (national, gemeinsame Zellen)',
    externalCmpCaption: 'Ensemble gegen externe Prognosen, WIS-Differenz mit 95-%-Intervall',
    externalCmpPair: 'Ensemble gegen {name}',
    externalCells: 'Bewertete Zellen je Saison: {cells}.',
    externalCellsOf: 'Insgesamt {n} Zellen aus {origins} Ursprungswochen.',
    externalCiCount: 'Bei {zero} von {total} Vergleichen schließt das 95-%-Intervall die Null ein, der Unterschied ist dort statistisch nicht gesichert.',
    externalCaveatsHeading: 'Warum das kein fairer Wettbewerb ist',
    externalCaveats: {
      vintage:
        'Die externen Prognosen entstanden in Echtzeit mit den damals verfügbaren Daten und enthalten Nowcasts für die noch unvollständige letzte Woche. Die Coldfront-Werte hier nutzen die heute korrigierten Daten. Das begünstigt Coldfront.',
      insample:
        'Die Saison 2024/25 diente bei Coldfront dem Tuning (in-sample), und die Saison 2025/26 wurde bereits unter Protokoll 1 verwendet.',
      wis: 'Für alle Modelle wird dieselbe WIS mit den Quantilen 0,1, 0,25, 0,5, 0,75 und 0,9 berechnet. Das ist nicht die WIS des Dashboards des RESPINOW-Hubs mit mehr Quantilen.',
      small:
        'Die Stichprobe ist klein: wenige Dutzend Ursprungswochen, die Horizonte einer Woche sind stark abhängig. Die Intervalle sind breit und schließen teils die Null ein (siehe oben); abgesichert ist ein Unterschied nur dort, wo das Intervall die Null nicht enthält.',
    },
    externalRespicast: 'RespiCast war nicht erreichbar und ist daher nicht im Vergleich.',
    externalSource: 'Quelle: Prognosen aus {name} (Lizenz {license}), eigene Berechnung auf Daten des Robert Koch-Instituts',
    externalAttribution: 'Prognosen: {attribution}. Quelle:',
    externalLicense: 'Lizenz',
    liveHeading: 'Laufende Überprüfung',
    liveText:
      'Die archivierten Prognosen werden jede Woche mit den später eingetroffenen Werten verglichen. Schneidet das Ensemble über mindestens {min} ausgewertete Läufe schlechter ab als die Baseline, ersetzt die Baseline es automatisch. Aktuell sind {runs} Läufe ausgewertet.',
    liveTextShort:
      'Die archivierten Prognosen werden jede Woche mit den später eingetroffenen Werten verglichen. Schneidet das Ensemble über eine Mindestzahl ausgewerteter Läufe schlechter ab als die Baseline, ersetzt die Baseline es automatisch.',
    limitsHeading: 'Grenzen',
    limits: {
      seasons:
        'Wenige Saisons: Die Auswertung beruht auf einer beschreibenden Saison, für die Bundesländer insgesamt auf etwa drei Saisons. Unterschiede zwischen Modellen sind deshalb unsicher; die Intervalle zeigen das.',
      vintage:
        'Erstveröffentlichungen: Die Auswertung bewertet gegen die heute korrigierten Werte, nicht gegen die zuerst veröffentlichten. Eine echte Prognose hatte nur den damaligen Stand; der Vergleich mit den Datenständen oben bildet das teilweise ab.',
      external:
        'Vergleich mit anderen Initiativen: Es gibt ihn nur für die nationale Ebene und nur gegen die RESPINOW-Modelle, nicht fair und mit kleiner Stichprobe. Die Bundesländer sind nicht verglichen.',
      peak: 'Gipfelzeitpunkt: Ab Horizont 2 verfehlt das Ensemble den Gipfel um viele Wochen. Die Prognose sagt den Gipfeltermin nicht voraus.',
      start:
        'Startwerte: Regularisierung, die 10-%-Schwelle, die Raster für Gewicht und Verbreiterung und die Aktivitätsstufen sind nicht empirisch geprüft.',
      scope:
        'Keine Aussagen zu Einzelpersonen oder zur medizinischen Lage: Die Prognose beschreibt Trends auf Bevölkerungsebene, keine Diagnosen und keine Empfehlungen.',
    },
    source: 'Quelle: eigene Berechnung auf Daten des Robert Koch-Instituts',
    na: 'nicht verfügbar',
  },
  en: {
    title: 'Method and evaluation',
    description: 'What Coldfront forecasts, which models are compared, how they are evaluated, how the protocol changed and which limits apply.',
    heading: 'Method and evaluation',
    whatHeading: 'What is forecast',
    whatText:
      'Coldfront forecasts the ARE consultation incidence of the Robert Koch Institute: the estimated doctor visits for acute respiratory illness per 100,000 inhabitants and week. The forecast reaches 1 to 4 weeks beyond the last observed week, for Germany and for each federal state. Every forecast contains a 50 % band and an 80 % band.',
    modelsHeading: 'The models',
    modelsText:
      'Five models are compared. Depending on the evaluation result, either the ensemble or the calendar-aligned seasonal baseline is shipped (see below).',
    modelsList: {
      baselinePlain:
        'Seasonal baseline (plain): the value of a calendar week is the distribution of the same week in earlier, cleaned seasons, using a window of ±1 week. This was the baseline of the first protocol.',
      baseline:
        'Seasonal baseline (calendar-aligned): like the plain baseline, but the earlier values are first adjusted for the care-seeking calendar effect and aligned to the target week. It is the stricter reference of the second protocol and is shipped on fallback.',
      persistence: 'Persistence: the last observed week is carried forward unchanged. It is the simplest reference.',
      regional:
        'Regional model: linear quantile regression on the logarithmic growth, pooled over all federal states, with calendar adjustment. The feature groups are chosen in tuning.',
      ensemble:
        'Ensemble: weighted average of the quantiles of the seasonal baseline and the regional model. The weight of the regional model is chosen from a grid in tuning (start value 0.5).',
    },
    spreadText:
      'Spread factor: the bands of the ensemble are widened by a factor k, which is chosen together with the ensemble weight on the tuning seasons. The regularisation of the regression (value 1.0) is a start value.',
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
    protocolIntro:
      'The protocol (version 1) was fixed before the first evaluation. It was amended once afterwards (version 2, see below). What follows is the state of version 2.',
    protocol: {
      rolling:
        'No random split: the evaluation rolls forward. At each origin only data are used that would have been known at the time, with the publication lag of each signal.',
      seasons:
        'Tuning and test: the earlier seasons are used for tuning, the most recent one was the test season. Under version 1 this test season was evaluated once and was untouched at that time. Under version 2 it is descriptive only; the next untouched test season is 2026/27.',
      pandemic: 'The weeks from 2020-W10 to 2022-W39 are excluded, because testing, closures and quarantine rules distorted the series.',
      metrics:
        'Metrics: MAE (mean absolute error of the median), WIS (weighted interval score, lower is better, scores the median and both bands together) and the coverage of the 50 % and 80 % bands.',
      breakdowns:
        'Breakdowns by federal state, forecast horizon and wave phase. Phases: low below 30 % of the seasonal maximum, peak from 85 % of the maximum, otherwise rise or decline according to the direction of the smoothed curve.',
      bootstrap:
        'Comparisons use a block bootstrap: blocks of 4 weeks, 1,000 draws, fixed random seed. Reported are the mean WIS difference, the 95 % interval and the number of seasons in which the model is better.',
      peaks: 'Peak timing (new in version 2): per forecast horizon, see the definition in the section on peak timing.',
      gate:
        'Publication rule: a model is shipped only if its mean WIS is at least 10 % below the calendar-aligned seasonal baseline. The 10 % are a start value without empirical justification. Otherwise this baseline is shipped.',
    },
    amendmentHeading: 'Amendment of the protocol (version 2)',
    amendmentWhy:
      'After the first evaluation, a diagnosis was carried out on the tuning seasons only (not on the test season). It found a large, regular care-seeking calendar effect in the ARE data that the version 1 model could not explain, a flawed peak-timing metric, and an inconsistency in the lags of the wastewater features. The protocol was therefore amended and frozen again.',
    amendment: {
      calendar:
        'Calendar adjustment: closed weekdays lower the number of doctor visits by a factor of about 0.81 each, the week between the years by a factor of about 0.4. GrippeWeb, which is not based on doctor visits, shows no such dip. The effect is estimated on data before 2023-W36 only and is applied in the regional model and in the seasonal baseline.',
      lags: 'Consistent lags: the availability lags of the features are now applied identically in training and prediction.',
      joint: 'Joint choice: the ensemble weight and the spread factor are chosen together from grids on the tuning seasons.',
      peak: 'New peak metric: peak timing is scored per horizon (definition below); the old metric, pooled over horizons, was flawed and has been replaced.',
      reference:
        'Stricter reference: the publication rule compares with the calendar-aligned seasonal baseline. The plain baseline of the first protocol is still reported.',
      vacation: 'Vacation periods now cover the season 2012/13 onward, so the Christmas dips of earlier winters enter training with their calendar features.',
    },
    amendmentStatus:
      'Status of the test season: the season was evaluated once under version 1 and was untouched at that time. Under version 2 it is evaluated a second time, for description only. It is no longer an independent test. Only the tuning seasons were used for the choices made under version 2.',
    resultsHeading: 'Results (protocol version 2)',
    noticeTitle: 'Important notice on the test season',
    noticeText:
      'Season {season} was first evaluated once under the first protocol; it was untouched at that time. The protocol was then amended (version 2, diagnosis on the tuning seasons only), and season {season} was evaluated a second time. The figures below are therefore a descriptive re-evaluation and not an independent test. The next untouched test season is 2026/27; it will be evaluated once after 2027-W39.',
    resultsIntro:
      'The tables show the evaluation of season {season} under version 2 with {n} scored forecasts (region, origin week and horizon). Chosen on the tuning seasons: feature set {candidate}, weight {weight} for the regional model and k = {k}.',
    unavailableBacktest: 'The evaluation of the test season is not available yet. It appears once the evaluation run has finished.',
    unavailableTuning: 'The tuning results are not available yet.',
    overallHead: { model: 'Model', n: 'n', mae: 'MAE', wis: 'WIS', cov50: 'Coverage 50 %', cov80: 'Coverage 80 %' },
    versionsHeading: 'Protocol 1 and protocol 2 side by side',
    versionsCaption: 'Overall result per model: first protocol (v1) and second protocol (v2), season {season}',
    versionsNote:
      'Both columns refer to the same season. The v1 result was the one-time evaluation; v2 is descriptive. A dash means the model did not exist under v1. The differences come from the amendments above, not from new data.',
    versionsHead: {
      model: 'Model',
      wis1: 'WIS (v1)',
      wis2: 'WIS (v2)',
      mae1: 'MAE (v1)',
      mae2: 'MAE (v2)',
      c501: 'Coverage 50 % (v1)',
      c502: 'Coverage 50 % (v2)',
      c801: 'Coverage 80 % (v1)',
      c802: 'Coverage 80 % (v2)',
    },
    gateHeading: 'Publication decision',
    gateShipEnsemble:
      'The ensemble is shipped. Its mean WIS is {rel} below the calendar-aligned seasonal baseline. The threshold of {threshold} is a start value.',
    gateShipBaseline:
      'The calendar-aligned seasonal baseline is shipped. The ensemble improves the WIS over this baseline by {rel}. The threshold of {threshold} is a start value and was not reached.',
    gateNoValue: 'The calendar-aligned seasonal baseline is shipped because no comparison value is available.',
    gateScope: 'This decision rests on a single, already known season and is therefore provisional.',
    comparisonsHeading: 'Comparisons with uncertainty',
    comparisonsCaption: 'Comparisons with 95 % interval',
    comparisonsNote:
      'A negative WIS difference means that the first model is better. The intervals rest on the block bootstrap over the weeks of a single season. One season is a thin basis: the interval shows the spread within the season, not the uncertainty between seasons.',
    comparisonsHead: { pair: 'Comparison', diff: 'Mean WIS difference', rel: 'Relative improvement', ci: '95 % interval', seasons: 'Seasons better', n: 'n' },
    cmp: {
      ensembleBaseline: 'Ensemble versus calendar-aligned seasonal baseline',
      ensembleBaselinePlain: 'Ensemble versus plain seasonal baseline',
      ensemblePersistence: 'Ensemble versus persistence',
      regionalBaseline: 'Regional model versus calendar-aligned seasonal baseline',
    },
    seasonsOf: '{won} of {total}',
    phaseHeading: 'By wave phase',
    phaseCaption: 'WIS by wave phase',
    phaseHead: { phase: 'Phase' },
    phases: { low: 'low', rise: 'rise', peak: 'peak', decline: 'decline' },
    horizonHeading: 'By forecast horizon',
    horizonCaption: 'WIS by forecast horizon',
    horizonHead: { weeks: 'Weeks ahead' },
    regionHeading: 'By federal state and for Germany',
    regionCaption: 'WIS by region, including Germany as a whole',
    regionHead: { region: 'Region', gain: 'Ensemble versus baseline' },
    regionNote:
      'The last column shows the advantage of the ensemble WIS over the calendar-aligned baseline (positive: ensemble better). The row for Germany is highlighted.',
    regionSummary:
      'At national level the ensemble is ahead of the calendar-aligned baseline by {nat}, in the federal states by between {min} and {max}.',
    regionSummaryEqual: 'At national level the ensemble is thus about equal to the calendar-aligned baseline; the gain lies mainly in the federal states.',
    nationalTag: 'national',
    modelNames: {
      baseline: 'Seasonal baseline (calendar-aligned)',
      baselinePlain: 'Seasonal baseline (plain)',
      persistence: 'Persistence',
      regional: 'Regional model',
      ensemble: 'Ensemble',
    },
    external: 'external',
    peakHeading: 'Peak timing',
    peakDefinition:
      'Definition (version 2): for each region, season and forecast horizon, the peak is searched in the winter window from calendar week 45 to calendar week 15, as the maximum of the centred 3-week mean. The week between the years and the week after are removed. The peak of the median forecast is compared with the peak of the actual values; reported are the median absolute timing error in weeks and the share of cases within ±1 week.',
    peakReference:
      'Persistence lags by about h weeks by construction, because it repeats the last week; its timing error serves as the reference for "nothing learned".',
    peakOld: 'The old peak metric of the first protocol pooled all horizons and weeks, was discontinuous and has been replaced. Its values are not comparable.',
    peakHonest:
      'At horizon 1 the ensemble finds the peak within one week in only {share1} of the cases (median offset {med1} weeks). At horizons 2 to 4 the median timing error is between {lo} and {hi} weeks. This is a real weakness: the forecast is not suited to predict the date of the peak.',
    peakCaption: 'Peak timing and height per model (all horizons)',
    peakHead: {
      model: 'Model',
      n: 'Scored cases',
      timing: 'Median timing error (weeks)',
      within: 'Share within ±1 week',
      ambiguous: 'Of which ambiguous',
      height: 'Mean relative height error',
    },
    peakTimingCaption: 'Median absolute peak timing error in weeks, per horizon',
    peakWithinCaption: 'Share of peaks within ±1 week, per horizon',
    peakAmbiguousNote:
      'Ambiguous means: the actual curve has a second peak of at least 90 % of the maximum, so the timing is not clear-cut there.',
    tuningHeading: 'Choice of features, weight and spread (tuning)',
    tuningText:
      'Tuning on the seasons {tuned}. For every feature set the best ensemble weight and the best spread factor are searched jointly. The set with the lowest mean WIS of the ensemble is chosen. The chosen candidate is {candidate} with weight {weight} for the regional model and k = {k}.',
    tuningReference:
      'For comparison on the same tuning seasons: WIS of the calendar-aligned seasonal baseline {baseline}, of the plain baseline {plain}, of persistence {persistence}.',
    tuningCaption: 'Feature group candidates with their best weight and factor',
    tuningChosen: 'chosen',
    tuningHead: { candidate: 'Candidate', groups: 'Feature groups', weight: 'Weight regional model', k: 'Factor k', ensemble: 'WIS ensemble', model: 'WIS regional model', n: 'n' },
    spreadCaption: 'Spread factor k in tuning (chosen candidate)',
    spreadHead: { k: 'Factor k', wis: 'WIS ensemble', cov50: 'Coverage 50 %', cov80: 'Coverage 80 %' },
    vintageHeading: 'Real data versions',
    vintageIntro:
      'The RKI corrects ARE values retroactively. The public version history of its data (since September 2023) allows reconstructing what was actually known at each origin. The table compares the WIS with today\'s corrected data and with the data versions of the time.',
    vintageNote:
      'Note: in both variants the values to be hit are today\'s corrected values. Revisions of wastewater and weather data are not reproduced. A positive change means that the WIS is worse with the data versions of the time.',
    vintageUnavailable: 'The comparison with real data versions is being computed and is not available yet.',
    vintageCaption: 'WIS with today\'s corrected data and with the data versions of the time',
    vintageHead: { model: 'Model', final: 'WIS, corrected data', vintage: 'WIS, data version of the time', rel: 'Change', n: 'Cells' },
    vintageGroup: '{seasons}: {vintage} of {total} origins with a real data version, {fallback} fell back to the corrected state',
    externalHeading: 'Comparison with other forecasts (national)',
    externalIntro:
      'For Germany as a whole, forecasts of other groups are available in the RESPINOW-Hub ({name}). Their counts were converted to cases per 100,000 with the fixed population ratio {ratio}. Only cells are compared for which all models shown have a forecast (panel "core": models covering both seasons). Forecasts of the other groups are marked "external" below.',
    externalUnavailable: 'The comparison with external forecasts is not available yet.',
    externalOverallCaption: 'Overall result compared with external forecasts (national, shared cells)',
    externalCmpCaption: 'Ensemble versus external forecasts, WIS difference with 95 % interval',
    externalCmpPair: 'Ensemble versus {name}',
    externalCells: 'Scored cells per season: {cells}.',
    externalCellsOf: 'In total {n} cells from {origins} origin weeks.',
    externalCiCount: 'In {zero} of {total} comparisons the 95 % interval includes zero, so the difference is not statistically established there.',
    externalCaveatsHeading: 'Why this is not a fair contest',
    externalCaveats: {
      vintage:
        'The external forecasts were produced in real time with the data available then and contain nowcasts for the still incomplete last week. The Coldfront figures here use today\'s corrected data. This favours Coldfront.',
      insample:
        'For Coldfront, season 2024/25 was used for tuning (in-sample), and season 2025/26 was already used under protocol 1.',
      wis: 'The same WIS with the quantiles 0.1, 0.25, 0.5, 0.75 and 0.9 is computed for all models. This is not the WIS of the RESPINOW-Hub dashboard, which uses more quantiles.',
      small:
        'The sample is small: a few dozen origin weeks, and the horizons of one origin are strongly dependent. The intervals are wide and partly include zero (see above); a difference is established only where the interval excludes zero.',
    },
    externalRespicast: 'RespiCast was not reachable and is therefore not part of the comparison.',
    externalSource: 'Source: forecasts from {name} (licence {license}), own calculation based on data of the Robert Koch Institute',
    externalAttribution: 'Forecasts: {attribution}. Source:',
    externalLicense: 'Licence',
    liveHeading: 'Ongoing check',
    liveText:
      'Archived forecasts are compared with the actuals that arrive later, every week. If the ensemble scores worse than the baseline over at least {min} evaluated runs, the baseline replaces it automatically. Currently {runs} runs are scored.',
    liveTextShort:
      'Archived forecasts are compared with the actuals that arrive later, every week. If the ensemble scores worse than the baseline over a minimum number of evaluated runs, the baseline replaces it automatically.',
    limitsHeading: 'Limits',
    limits: {
      seasons:
        'Few seasons: the evaluation rests on one descriptive season, and on about three seasons for the federal states overall. Differences between models are therefore uncertain; the intervals show this.',
      vintage:
        'First publications: the evaluation scores against today\'s corrected values, not against the values published first. A live forecast only had the data of its time; the comparison with data versions above reproduces this in part.',
      external:
        'Comparison with other initiatives: it exists for the national level only and only against the RESPINOW models, is not fair and has a small sample. The federal states are not compared.',
      peak: 'Peak timing: from horizon 2 the ensemble misses the peak by many weeks. The forecast does not predict the date of the peak.',
      start:
        'Start values: regularisation, the 10 % threshold, the grids for weight and spread and the activity levels have not been checked empirically.',
      scope:
        'No statements about individuals or the medical situation: the forecast describes trends at population level, not diagnoses and not recommendations.',
    },
    source: 'Source: own calculation based on data of the Robert Koch Institute',
    na: 'not available',
  },
};
