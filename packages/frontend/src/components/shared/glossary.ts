// Kurz erklaerte Fachbegriffe der Seite (Nutzertest: viele Begriffe waren Neulingen unklar).
// Erklaerungswuerdige Woerter sind antippbar (GlossaryWord / GlossaryText) und zeigen die Erklaerung
// in einer kleinen Blase direkt am Wort (GlossaryPopover, einmal in App.vue).

export type GlossaryTerm = { term: string; text: string };

export const GLOSSARY = {
    nackteMeile: { term: 'Nackte Meile', text: 'Wer ein Spiel mit 0 Treffern beendet (offenes Spiel, Liga oder Cup), schuldet eine nackte Meile. Sie bleibt offen, bis sie gelaufen ist.' },
    shot: { term: 'Shot', text: 'Je 3 Airballs eines Teams trinkt jede Person dieses Teams einen Shot. Im BiPo Knecht kann man ihn auf „Später“ legen, dann steht er auf der Seite Offene Shots.' },
    schuldenkonto: { term: 'Schuldenkonto', text: 'Offene nackte Meilen und Shots einer Person. Tippe auf eine Kachel, um die ganze Liste zu sehen.' },
    elo: { term: 'Elo', text: 'Spielstärke-Wert: Jeder startet mit 1.000. Sieg gegen Stärkere bringt viele Punkte, Niederlage gegen Schwächere kostet viele. Die Trefferdifferenz zählt mit.' },
    eloAverage: { term: 'Ø Elo', text: 'Durchschnittliches Elo der Spieler eines Teams vor dem Spiel.' },
    offenesSpiel: { term: 'Offenes Spiel', text: 'Ein freies Spiel außerhalb von Liga und Turnier, z. B. auf einer Party. Das Spiel ist trotzdem beendet – „offen“ heißt nur: kein Wettbewerb.' },
    liga: { term: 'Liga & Cup', text: 'Die BiPo League: Teams spielen eine Saison mit Hin- und Rückrunde, dazu den League Cup im K.-o.-Modus.' },
    becher: { term: 'Becher / Treffer', text: 'Jedes Team hat 10 Becher. Wer alle Becher des Gegners trifft, gewinnt. Das Ergebnis zählt getroffene Becher.' },
    nullwurf: { term: 'Nullwurf', text: 'Ein Wurf, der keinen Becher trifft.' },
    airball: { term: 'Airball', text: 'Ein Wurf, der weder Becher noch Tisch berührt. Je 3 Airballs eines Teams gibt es Shots.' },
    bouncer: { term: 'Bouncer', text: 'Der Ball springt vorher auf dem Tisch auf und trifft: zählt 2 Becher.' },
    ballsBack: { term: 'Balls Back', text: 'Beide Bälle einer Runde treffen: Das Team bekommt beide Bälle zurück und wirft noch einmal.' },
    bombe: { term: 'Bombe', text: 'Beide Bälle im selben Becher: 3 Becher, dazu Balls Back.' },
    heatenUp: { term: 'Heaten Up', text: 'Nach 2 Treffern in Folge ansagen – „aufgeheizt“. Der nächste Treffer macht On Fire.' },
    onFire: { term: 'On Fire', text: 'Ab dem 3. Treffer in Folge darf man weiterwerfen, bis man verfehlt.' },
    trickshot: { term: 'Trickshot', text: 'Ein eigener Fehlwurf bleibt auf dem Tisch und wird gefangen: Wer ihn hat, wirft noch einmal (Trickshot-Fang).' },
    reRack: { term: 'Re-Rack', text: 'Die restlichen Becher werden neu aufgestellt, 2× pro Team bei 3, 4 oder 6 Bechern.' },
    deathcup: { term: 'Deathcup', text: 'Treffer in einen alten, nicht ausgetrunkenen Becher: Das Spiel ist sofort verloren.' },
    letzterBecher: { term: 'Letzter Becher', text: 'Muss direkt getroffen werden. Danach darf das andere Team nachwerfen (Gentleman’s Rule).' },
    gentleman: { term: 'Gentleman’s Rule / Nachwurf', text: 'Ist der letzte Becher gefallen, wirft das andere Team abwechselnd weiter, bis es verfehlt. Trifft es alle, geht es in die Verlängerung.' },
    tableColumns: { term: 'Tabellenspalten', text: 'SP = Spiele · S = Siege · N = Niederlagen · DIFF = Trefferdifferenz · Trend = letzte 5 Spiele (S/N), neuestes rechts.' },
    knecht: { term: 'BiPo Knecht', text: 'Der digitale Schiri: Jeder Wurf wird live am Handy gezählt, das Ergebnis wird danach automatisch eingetragen.' },
    vergleich: { term: 'Spieler-Vergleich', text: 'Links der erste, rechts der zweite Spieler. Der bessere Wert ist farbig, der Balken zeigt das Verhältnis der beiden Werte.' },
    getroffen: { term: 'Getroffen', text: 'So viele Becher hat das Team (oder der Spieler) beim Gegner schon getroffen. Bei 10 ist das Spiel gewonnen.' },
    nackteMeilenSeite: { term: 'Nackte Meilen', text: 'Wer ein Spiel mit 0 Treffern beendet, schuldet eine nackte Meile. Hier steht, wer noch laufen muss und wer schon gelaufen ist.' },
    shotsSeite: { term: 'Offene Shots', text: 'Je 3 Airballs eines Teams trinkt jede Person dieses Teams einen Shot. Auf „Später“ gelegte Shots stehen hier, bis sie getrunken sind.' },
} satisfies Record<string, GlossaryTerm>;

export type GlossaryKey = keyof typeof GLOSSARY;

// Schreibweisen auf der Seite -> Begriff (klein geschrieben, auch Mehrzahl)
const ALIASES: Record<string, GlossaryKey> = {
    'nackte meile': 'nackteMeile', 'nackte meilen': 'nackteMeile', 'meile': 'nackteMeile', 'meilen': 'nackteMeile', 'meilen offen': 'nackteMeile', 'meile offen': 'nackteMeile',
    'shot': 'shot', 'shots': 'shot', 'shot offen': 'shot', 'shots offen': 'shot',
    'schuldenkonto': 'schuldenkonto',
    'offenes spiel': 'offenesSpiel',
    'nullwurf': 'nullwurf', 'fehlwurf': 'nullwurf',
    'airball': 'airball', 'airballs': 'airball',
    'bouncer': 'bouncer',
    'balls back': 'ballsBack', 'balls-back': 'ballsBack',
    'bombe': 'bombe', 'bomben': 'bombe',
    'heaten up': 'heatenUp',
    'on fire': 'onFire', 'on-fire': 'onFire',
    'trickshot': 'trickshot', 'trickshots': 'trickshot', 'trickshot-fang': 'trickshot', 'trickshot-treffer': 'trickshot',
    're-rack': 'reRack',
    'deathcup': 'deathcup', 'deathcups': 'deathcup',
    'letzter becher': 'letzterBecher', 'letzte becher': 'letzterBecher',
    'nachwurf': 'gentleman', "gentleman's rule": 'gentleman', 'verlängerung': 'gentleman',
    'sp': 'tableColumns', 'diff': 'tableColumns', 'trend': 'tableColumns',
    'getroffen': 'getroffen',
};

export const findGlossaryKey = (text: string): GlossaryKey | null => {
    const clean = text.trim().toLowerCase().replace(/^\d+\s+/, '');
    if (ALIASES[clean]) return ALIASES[clean];
    if (clean.startsWith('ø') && clean.includes('elo')) return 'eloAverage';
    return null;
};
