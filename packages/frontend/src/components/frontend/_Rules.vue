<template>
    <div class="Rules">

        <h1 class="bp-title">{{"Regeln"}}</h1>

        <!-- Allgemeine Regeln oder Liga & Cup -->
        <nav class="ru-toggle">
            <SelectButton v-model="ruleSet" :options="RULE_SETS" optionLabel="label" optionValue="value" :allowEmpty="false" fluid />
        </nav>

        <section v-for="section in visibleSections" :key="section.label" class="ru-section" :class="`ru-section--${section.tone}`">
            <h2 class="ru-label">{{ section.label }}</h2>

            <div class="ru-card">
                <article v-for="rule in section.rules" :key="rule.title" class="ru-rule" :class="{ 'ru-rule--open': openRules.has(rule.title) }">
                    <button type="button" class="ru-head" :aria-expanded="openRules.has(rule.title)" @click="toggleRule(rule.title)">
                        <span class="ru-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" v-html="icons[rule.icon]"></svg>
                        </span>

                        <span class="ru-body">
                            <span class="ru-title">{{ rule.title }}</span>
                            <span class="ru-summary">
                                <strong>{{ rule.key }}</strong> · {{ rule.summary }}
                            </span>
                        </span>

                        <i class="pi pi-chevron-down ru-chevron" aria-hidden="true"></i>
                    </button>

                    <!-- Aufklappen ueber grid-template-rows 0fr -> 1fr, damit die Hoehe animiert -->
                    <div class="ru-collapse" :aria-hidden="!openRules.has(rule.title)">
                        <div class="ru-collapse-inner">
                            <ul class="ru-points">
                                <li v-for="point in rule.points" :key="point">{{ point }}</li>
                            </ul>

                            <div v-if="rule.formations" class="ru-formations">
                                <figure v-for="formation in rule.formations" :key="formation.label" class="ru-formation">
                                    <svg viewBox="0 0 36 30" aria-hidden="true">
                                        <circle v-for="(cup, i) in formationCups(formation.rows)" :key="i" :cx="cup.x" :cy="cup.y" r="4.6" />
                                    </svg>
                                    <figcaption>{{ formation.label }}</figcaption>
                                </figure>
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import SelectButton from 'primevue/selectbutton';
import { useGrayPage } from '@/components/shared/useGrayPage';

useGrayPage();

const RULE_SETS = [
    { label: 'Allgemein', value: 'general' },
    { label: 'Liga & Cup', value: 'league' },
];

// /Regeln?Liga oeffnet direkt die Liga-Regeln
const ruleSet = ref<'general' | 'league'>('Liga' in useRoute().query ? 'league' : 'general');

// Alle Regeln starten eingeklappt
const openRules = reactive(new Set<string>());

const toggleRule = (title: string) => {
    if (openRules.has(title))
        openRules.delete(title);
    else
        openRules.add(title);
}

// Strich-Icons im 24er Raster (Lucide-Stil)
const icons = {
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    throw: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    bounce: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    back: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    bomb: '<circle cx="11" cy="13" r="9"/><path d="M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.95 1.95"/><path d="m22 2-1.5 1.5"/>',
    fire: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    rerack: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    skull: '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    updown: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
};

// Becher pro Reihe, von der Spitze aus gezaehlt
type Formation = {
    label: string;
    rows: number[];
}

type Rule = {
    icon: keyof typeof icons;
    title: string;
    key: string;
    summary: string;
    points: string[];
    formations?: Formation[];
}

// Becher-Mittelpunkte im 36x30-Feld, Reihen zentriert und dicht gepackt
const formationCups = (rows: number[]) => {
    const dx = 10.4;
    const dy = 9;
    const top = (30 - (rows.length - 1) * dy) / 2;
    return rows.flatMap((count, r) =>
        Array.from({ length: count }, (_, c) => ({
            x: 18 + (c - (count - 1) / 2) * dx,
            y: top + r * dy,
        }))
    );
}

type Section = {
    label: string;
    tone: 'gray' | 'blue' | 'red' | 'gold';
    rules: Rule[];
}

const sections: Section[] = [
    {
        label: 'Grundlagen',
        tone: 'gray',
        rules: [
            {
                icon: 'flag',
                title: 'Spielbeginn',
                key: 'Schnick-Schnack-Schnuck',
                summary: 'entscheidet, wer anfängt',
                points: [
                    'Ein Becher zählt, wenn der Ball drin liegen bleibt.',
                    'Pusten, Fingern o. Ä. ist verboten.',
                    'Getroffene Becher werden getrunken.',
                ],
            },
            {
                icon: 'user',
                title: '1 gegen 1',
                key: 'Beide Bälle',
                summary: 'wirft ein Spieler, kein On-Fire',
                points: [
                    'Ein Spieler wirft beide Bälle des Zugs.',
                    'Trifft er mit beiden, gilt Balls-Back, im selben Becher ist es eine Bombe.',
                    'Beim Trickshot fängt und wirft der Spieler selbst.',
                    'Kein Heating Up und kein On-Fire.',
                    'Alle anderen Regeln gelten unverändert.',
                ],
            },
        ],
    },
    {
        label: 'Werfen',
        tone: 'blue',
        rules: [
            {
                icon: 'throw',
                title: 'Wurf',
                key: '2 Würfe',
                summary: 'pro Zug, Ellenbogen hinter der Kante',
                points: [
                    'Ball verlässt die Hand = geworfen.',
                    'Reihenfolge der Werfer ist frei, jeder Spieler wirft aber nur einen Ball pro Zug.',
                    'Becher umgekippt durch den Ball = getroffen.',
                    'Eigene Becher vom Tisch gestoßen = getroffen, im 2 gegen 2 je 0,5 Treffer pro Becher für beide Gegner.',
                    'Fällt dabei der letzte eigene Becher, zählt das als letzter Becher für den Gegner: Es folgt die Gentleman\'s Rule. Passiert es im eigenen Zug, endet der Zug sofort.',
                    'Gegner fängt den Ball vor Tisch/Becher = Treffer, Werfer wählt den Becher.',
                ],
            },
            {
                icon: 'bounce',
                title: 'Bouncer',
                key: '2 Becher',
                summary: 'wenn der Ball vorher aufspringt',
                points: [
                    'Nach Tischkontakt darf verteidigt (weggeschlagen) werden.',
                    'Den zweiten Becher wählt der Werfer – nie den letzten: steht sonst nur noch ein Becher, zählt der Bouncer als normaler Treffer.',
                    'Zählt als 2 Treffer.',
                    'Abpraller vom Becherrand zählt nicht doppelt.',
                ],
            },
            {
                icon: 'back',
                title: 'Balls-Back',
                key: 'Bälle zurück',
                summary: 'wenn beide Bälle treffen',
                points: [
                    'Beide Bälle dürfen sofort noch einmal geworfen werden.',
                    'Ein Trickshot-Treffer zählt mit.',
                ],
            },
        ],
    },
    {
        label: 'Sonderregeln',
        tone: 'red',
        rules: [
            {
                icon: 'bomb',
                title: 'Bombe',
                key: '3 Becher',
                summary: 'beide Bälle im selben Becher',
                points: [
                    'Die Werfer wählen die Becher aus.',
                    'Zusätzlich gilt Balls-Back.',
                    'Zählt je 1,5 Treffer pro Werfer.',
                    'Ein Bouncer in den Bombenbecher bringt 1 Becher und 1 Treffer extra (z. B. 4 Becher: 2,5 + 1,5).',
                ],
            },
            {
                icon: 'fire',
                title: 'On-Fire',
                key: 'Weiterwerfen',
                summary: 'ab dem 3. Treffer in Folge',
                points: [
                    'Nach 2 Treffern „Heaten Up“ ansagen – sonst kein On-Fire.',
                    'Ab dem 3. Treffer werfen, bis man verfehlt.',
                    'Jeder Treffer zählt zur Serie, auch Bouncer, Bombe, gefangene Bälle und umgekippte Becher.',
                    'Trickshot setzt die Serie nicht fort, startet aber eine neue: nach 2 weiteren Treffern On-Fire.',
                    'Mit Balls-Back: erst On-Fire, danach je ein Extra-Wurf.',
                    'Die Serie zählt je Spieler und läuft über die Züge weiter, auch wenn das andere Team dazwischen wirft. Sie endet mit einem eigenen Fehlwurf und mit Beginn der Verlängerung.',
                    'Gilt nicht im 1 gegen 1.',
                ],
            },
            {
                icon: 'star',
                title: 'Trickshot',
                key: 'Nachwurf',
                summary: 'eigener Fehlwurf noch auf dem Tisch',
                points: [
                    'Solange der Ball auf dem Tisch ist, dürfen ihn beide Teams nehmen.',
                    'Fällt er auf den Boden, ist er aus dem Spiel.',
                    'Nimmt ihn das Wurfteam, wirft, wer ihn hat – und zwar einen Trickshot.',
                    'Der verfehlte Wurf zählt als Fehlwurf des Werfers, ein Trickshot-Treffer zählt für den Fänger.',
                    'Wer so zwei Bälle hat, wirft beide, in beliebiger Reihenfolge.',
                    'Trickshots stapeln: Bleibt auch der Trickshot auf dem Tisch und man holt ihn, folgt ein weiterer.',
                    'Schwache Hand zählt nicht als Trickshot.',
                    'Verteidigt wird wie bei einem normalen Wurf.',
                    'Ein Treffer zählt für Balls-Back.',
                ],
            },
            {
                icon: 'rerack',
                title: 'Re-Rack',
                key: '2× pro Team',
                summary: 'bei 3, 4 oder 6 Bechern',
                points: [
                    'Das werfende Team verlangt ihn, der Gegner stellt um.',
                    'Nur vor dem ersten Wurf des Zugs.',
                    'Neue Formation mittig vorne an der Spitze.',
                    'Geworfen wird erst nach Freigabe.',
                ],
                formations: [
                    { label: '6 Becher', rows: [1, 2, 3] },
                    { label: '4 Becher', rows: [1, 2, 1] },
                    { label: '3 Becher', rows: [1, 2] },
                ],
            },
            {
                icon: 'skull',
                title: 'Deathcup',
                key: 'Sofort verloren',
                summary: 'Treffer in alten, nicht getrunkenen Becher',
                points: [
                    'Gilt für Becher aus einem vorherigen Zug, die getroffen, aber noch nicht ausgetrunken sind.',
                    'Ein zweiter Treffer in denselben Becher im laufenden Zug ist kein Deathcup, sondern eine Bombe.',
                    'Alle Restbecher zählen als Treffer für den Werfer.',
                ],
            },
        ],
    },
    {
        label: 'Spielende',
        tone: 'gold',
        rules: [
            {
                icon: 'trophy',
                title: 'Spielende',
                key: 'Letzter Becher',
                summary: 'muss direkt getroffen werden',
                points: [
                    'Wird automatisch an die Spitze gestellt (kein Re-Rack), nur vor dem Wurf.',
                    'Bouncer oder Bombe räumen nie den letzten Becher mit ab – einer bleibt immer stehen.',
                    'Als direkter Treffer zählen auch Bouncer, gefangene Bälle und Becher, die der Gegner selbst umstößt.',
                    'Beide Bälle im letzten Becher = direkt gewonnen, ohne Gentleman\'s Rule.',
                    'Ist der letzte Becher getroffen, endet dieser Ball – auch bei On-Fire oder beim Nachwerfen. Die übrigen Bälle der Runde dürfen nur noch auf diesen Becher geworfen werden.',
                    'Halbe Treffer (Bombe, eigene Becher) werden am Spielende innerhalb des Teams auf ganze Treffer verteilt, die Teamsumme bleibt gleich.',
                    'Endet ein Spiel punktgleich (z. B. durch einen Deathcup im Nachwurf), bekommt der Sieger in der Statistik einen Siegpunkt.',
                ],
            },
            {
                icon: 'repeat',
                title: "Gentleman's Rule",
                key: 'Nachwerfen',
                summary: 'nach dem letzten Becher des Gegners',
                points: [
                    'Jeder Spieler wirft für sich: Wer trifft, bekommt den Ball zurück, bis er verfehlt oder den letzten Becher trifft. Danach ist der Mitspieler dran, im 1 gegen 1 der zweite Ball.',
                    'Getroffene Becher werden sofort abgeräumt.',
                    'Beide Bälle im letzten Becher beim Nachwerfen = Sieg.',
                    'Trickshot gilt weiter. Keine Bombe, kein Balls-Back, kein Heating Up und kein On-Fire.',
                    'Fallen alle Becher, geht es in die Verlängerung.',
                ],
            },
            {
                icon: 'clock',
                title: 'Verlängerung',
                key: '2 × 3 Becher',
                summary: 'wenn beim Nachwerfen alles fällt',
                points: [
                    'Es beginnt das Team, das vorgelegt hat.',
                    'Keine Re-Racks.',
                    'Die Gentleman\'s Rule gilt erneut.',
                    'Es wird so lange verlängert, bis ein Sieger feststeht.',
                ],
            },
        ],
    },
];

const leagueSections: Section[] = [
    {
        label: 'Liga',
        tone: 'blue',
        rules: [
            {
                icon: 'user',
                title: 'Modus',
                key: '1 gegen 1',
                summary: 'mit 10 Bechern nach den allgemeinen Regeln',
                points: [
                    'In der BiPo League und im League Cup hat jedes Team genau einen Spieler.',
                    'Es gelten die allgemeinen Regeln für 1 gegen 1: beide Bälle pro Zug, kein Heating Up und kein On-Fire.',
                ],
            },
            {
                icon: 'list',
                title: 'Tabelle',
                key: 'Siege',
                summary: 'dann Trefferdifferenz, dann Treffer',
                points: [
                    'Platzierung: 1. Siege, 2. Trefferdifferenz, 3. erzielte Treffer.',
                    'Ein Unentschieden gibt es nicht.',
                ],
            },
            {
                icon: 'trophy',
                title: 'Final Four',
                key: 'Best of 3',
                summary: 'die besten vier nach der Hauptrunde',
                points: [
                    'Halbfinale: 1. gegen 4. und 2. gegen 3., danach das Finale.',
                    'Jede Paarung wird im Modus Best of 3 gespielt.',
                ],
            },
            {
                icon: 'updown',
                title: 'Auf- und Abstieg',
                key: '3 Teams',
                summary: 'wechseln zwischen 1. und 2. Liga',
                points: [
                    'Die letzten drei Teams der 1. Liga steigen ab.',
                    'Die besten drei Teams der 2. Liga steigen auf.',
                ],
            },
        ],
    },
    {
        label: 'League Cup',
        tone: 'gold',
        rules: [
            {
                icon: 'star',
                title: 'League Cup',
                key: 'K.-o.-System',
                summary: 'Teams beider Ligen gegeneinander',
                points: [
                    'Für jede Runde wird festgelegt, wie viele Siege zum Weiterkommen nötig sind (Best of).',
                    'Ein Unentschieden gibt es nicht.',
                ],
            },
        ],
    },
    {
        label: 'Eintragen',
        tone: 'gray',
        rules: [
            {
                icon: 'pencil',
                title: 'Spiele eintragen',
                key: 'Ergebnis oder BiPo Knecht',
                summary: 'über „Eintragen“',
                points: [
                    'Liga- und Cup-Spiele direkt mit dem Ergebnis eintragen.',
                    'Oder live mit dem BiPo Knecht zählen: er kennt die Regeln und trägt das Ergebnis automatisch ein.',
                    'Im Schiedsrichter-Modus zählt eine dritte Person mit, ihr Name wird beim Eintragen gespeichert.',
                ],
            },
        ],
    },
];

const visibleSections = computed(() => ruleSet.value === 'league' ? leagueSections : sections);
</script>

<style scoped>
.Rules{
    max-width: 720px;
    margin: 0 auto;
}
.ru-toggle{
    max-width: 420px;
    margin: 0 auto 24px;
}

/* Farbton je Abschnitt: Akzent fuer Label/Kernaussage/Punkte, Grund fuer das Icon-Feld */
.ru-section--gray{ --ru-accent: var(--bp-text-muted); --ru-label: var(--bp-text); --ru-icon-bg: var(--bp-fill); }
.ru-section--blue{ --ru-accent: #2A9DB8; --ru-label: #2A9DB8; --ru-icon-bg: var(--secondary-color-weak); }
.ru-section--red{ --ru-accent: var(--main-color); --ru-label: var(--main-color); --ru-icon-bg: var(--bp-primary-weak); }
.ru-section--gold{ --ru-accent: #C98A0B; --ru-label: #C98A0B; --ru-icon-bg: var(--bp-gold-weak); }

.ru-section{
    margin-bottom: 24px;
}
.ru-label{
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ru-label);
}
.ru-card{
    background: var(--bp-surface);
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
    overflow: hidden;
}

.ru-rule{
    --ru-pad: 14px;
    --ru-gap: 12px;
}
.ru-rule + .ru-rule{
    border-top: 1px solid var(--bp-border);
}

.ru-head{
    display: flex;
    align-items: center;
    gap: var(--ru-gap);
    width: 100%;
    padding: 12px var(--ru-pad);
    border: 0;
    background: transparent;
    font: inherit;
    text-align: left;
    color: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
.ru-head:focus-visible{
    outline: 2px solid var(--ru-accent);
    outline-offset: -2px;
    border-radius: 16px;
}

.ru-chevron{
    flex: 0 0 auto;
    font-size: 12px;
    color: var(--bp-text-faint);
    transition: transform .25s ease;
}
.ru-rule--open .ru-chevron{
    transform: rotate(180deg);
}

.ru-collapse{
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows .25s ease;
}
.ru-rule--open .ru-collapse{
    grid-template-rows: 1fr;
}
.ru-collapse-inner{
    overflow: hidden;
}

.ru-icon{
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--ru-icon-bg);
    color: var(--ru-accent);
}
.ru-icon svg{
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.ru-body{
    min-width: 0;
    flex: 1;
}
.ru-title{
    display: block;
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
    color: var(--bp-text-strong);
}
.ru-summary{
    display: block;
    margin-top: 1px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--bp-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.ru-summary strong{
    font-weight: 700;
    color: var(--ru-accent);
}

/* Ausgeklappt: ganze Kurzzeile zeigen */
.ru-rule--open .ru-summary{
    white-space: normal;
}

/* Punkte buendig unter dem Titel (Icon-Breite + Abstand) */
.ru-points{
    margin: 0;
    padding: 0 var(--ru-pad) 12px calc(var(--ru-pad) + 36px + var(--ru-gap));
    list-style: none;
}
.ru-points li{
    position: relative;
    padding-left: 14px;
    margin-bottom: 4px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--bp-text);
}
.ru-points li::before{
    content: '';
    position: absolute;
    left: 2px;
    top: 0.55em;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--ru-accent);
}

/* Formations-Skizzen, buendig mit den Punkten */
.ru-formations{
    display: flex;
    gap: 10px;
    padding: 0 var(--ru-pad) 14px calc(var(--ru-pad) + 36px + var(--ru-gap));
}
.ru-formation{
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 10px 6px;
    border-radius: 10px;
    background: var(--ru-icon-bg);
}
.ru-formation svg{
    width: 44px;
    height: 37px;
}
.ru-formation circle{
    fill: white;
    stroke: var(--ru-accent);
    stroke-width: 1.4;
}
.ru-formation figcaption{
    font-size: 11px;
    font-weight: 700;
    color: var(--ru-accent);
}

/*DESKTOP*/
@media (width > 900px){
    .ru-rule{
        --ru-pad: 20px;
        --ru-gap: 16px;
    }
    .ru-head{
        padding-top: 16px;
        padding-bottom: 16px;
    }
    .ru-title{
        font-size: 17px;
    }
    .ru-summary{
        font-size: 13px;
        white-space: normal;
    }
    .ru-points li{
        font-size: 14px;
    }
}
</style>
