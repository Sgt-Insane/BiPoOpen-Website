<template>
    <BottomSheet v-model:visible="visible">
        <template #header>
            <div class="ees-title">Elo erklärt</div>
        </template>

        <p class="ees-intro">
            Jeder startet mit <b>{{ formatRating(ELO_START) }}</b>. Wer gewinnt, nimmt dem Gegner Punkte ab, gegen Stärkere mehr als
            gegen Schwächere und für deutliche Siege mehr als für knappe. Titel bringen keine Extrapunkte: Wer viele starke Teams
            schlägt, steigt automatisch.
        </p>

        <div class="ees-card">
            <div class="ees-card-title">Was du für einen Sieg bekommst</div>
            <div :style="{ '--ees-results': ELO_EXAMPLE_RESULTS.length }">
                <div class="ees-table-head">
                    <span>Du bist</span>
                    <span v-for="scores in ELO_EXAMPLE_RESULTS" :key="formatResult(scores)">{{ formatResult(scores) }}</span>
                </div>
                <!-- Ueber die Tabelle hinaus geht es weiter: der Favorit bekommt noch weniger, der Aussenseiter noch mehr -->
                <div class="ees-table-row ees-table-row--more">
                    <span>noch stärker</span>
                    <span class="ees-more" :style="{ '--ees-heat': getHeat(0) }">noch weniger</span>
                </div>
                <div v-for="row in ELO_EXAMPLE_ROWS" :key="row.difference" class="ees-table-row" :class="{ 'ees-table-row--even': row.difference === 0 }">
                    <span>{{ formatDifference(row.difference) }}</span>
                    <span v-for="(points, index) in row.points" :key="index" class="ees-points" :style="{ '--ees-heat': getHeat(points) }">
                        {{ formatDelta(points) }}
                    </span>
                </div>
                <div class="ees-table-row ees-table-row--more">
                    <span>noch schwächer</span>
                    <span class="ees-more" :style="{ '--ees-heat': getHeat(maxExamplePoints * 1.25) }">noch mehr</span>
                </div>
            </div>
            <div class="ees-hint">Dazwischen wird stufenlos gerechnet, der Gegner verliert genau so viel.</div>
        </div>

        <div class="ees-card">
            <div class="ees-card-title">Knapp oder deutlich</div>
            <p class="ees-text">Die Becher-Differenz zählt mit, die Punkte werden mit diesem Faktor multipliziert:</p>
            <div class="ees-factors">
                <span v-for="example in marginExamples" :key="example.result" class="ees-factor">
                    {{ example.result }} <b>×{{ formatFactor(example.factor) }}</b>
                </span>
            </div>
            <p class="ees-text">
                Spiele mit Verlängerung werden auf 10 Becher umgerechnet, ein 13:12 zählt also noch weniger als ein 10:9.
                Bei klaren Favoriten zählt die Differenz etwas weniger, bei Außenseitern etwas mehr.
            </p>
        </div>

        <div class="ees-card">
            <div class="ees-card-title">Im Doppel</div>
            <p class="ees-text">
                Euer Team-Rating ist der Durchschnitt: {{ formatRating(1200) }} + {{ formatRating(1000) }} → <b>{{ formatRating(1100) }}</b>.
                Die Punkte fürs Team werden nach Treffern verteilt: Bei {{ ELO_EXAMPLE_HITS.hits.join(' und ') }} Treffern bekommt der eine
                das {{ formatFactor(ELO_EXAMPLE_HITS.factors[0]) }}-, der andere das {{ formatFactor(ELO_EXAMPLE_HITS.factors[1]) }}-Fache,
                bei gleich vielen Treffern beide dasselbe. Wer mehr trifft, bekommt beim Sieg mehr und verliert bei einer Niederlage weniger.
            </p>
        </div>

        <div class="ees-card">
            <div class="ees-card-title">Die ersten {{ ELO_MIN_GAMES }} Spiele</div>
            <p class="ees-text">
                Bis du in der Liste stehst, zählen deine Spiele mehr: das erste {{ formatFactor(ELO_K_NEWCOMER / ELO_K) }}-fach, danach von
                Spiel zu Spiel weniger. So landest du schnell bei deiner echten Stärke. Deine Gegner bekommen ihre normalen Punkte.
            </p>
        </div>

        <div class="ees-card">
            <div class="ees-card-title">Was zählt</div>
            <ul class="ees-list">
                <li class="ees-check"><b>Liga, Cup und BiPo Open</b> – alle gleich, 1. und 2. Liga ohne Faktor</li>
                <li class="ees-check"><b>Offene Spiele</b> – jedes eingetragene Spiel zählt</li>
            </ul>
        </div>

        <div class="ees-card">
            <div class="ees-card-title">Wer in der Liste steht</div>
            <ul class="ees-list">
                <li>In der Liste erscheint, wer mindestens <b>{{ ELO_MIN_GAMES }} Spiele</b> gemacht hat</li>
                <li>Aktiv heißt: mindestens {{ ELO_MIN_GAMES }} Spiele und eins in den letzten {{ ELO_ACTIVE_MONTHS }} Monaten</li>
                <li>Wer pausiert, behält sein Rating und taucht beim nächsten Spiel wieder auf</li>
            </ul>
        </div>

        <p class="ees-footnote">
            Wer immer mit demselben Partner spielt, unterscheidet sich vom Partner nur durch die Treffer. Für solche Duos ist die
            Ansicht „Teams“ aussagekräftiger.
        </p>
    </BottomSheet>
</template>

<script setup lang="ts">
import BottomSheet from '@/components/shared/BottomSheet.vue';
import {
    ELO_ACTIVE_MONTHS, ELO_EXAMPLE_HITS, ELO_EXAMPLE_RESULTS, ELO_EXAMPLE_ROWS, ELO_K, ELO_K_NEWCOMER, ELO_MIN_GAMES, ELO_START,
    getEloMarginFactor,
} from './eloRating';

const visible = defineModel<boolean>('visible', { default: false });

// Faktor je Ergebnis, Verlaengerung steht im Text
const marginExamples = ([[10, 9], [10, 8], [10, 7], [10, 5], [10, 0]] as const).map(([winner, loser]) =>
    ({ result: `${winner}:${loser}`, factor: getEloMarginFactor(winner, loser) }));

// Tabelle als Heatmap: je mehr Punkte, desto kraeftiger das Gruen. "noch staerker/schwaecher" setzt den Verlauf fort.
const maxExamplePoints = Math.max(...ELO_EXAMPLE_ROWS.flatMap(row => row.points));
const getHeat = (points: number) => `${Math.round(10 + 35 * points / maxExamplePoints)}%`;

const formatDifference = (difference: number) =>
    difference === 0 ? 'gleich stark' : `${Math.abs(difference)} ${difference > 0 ? 'stärker' : 'schwächer'}`;
const formatRating = (rating: number) => rating.toLocaleString('de-DE');
const formatDelta = (delta: number) => delta > 0 ? `+${delta}` : `−${-delta}`;
const formatResult = (scores: [number, number]) => scores.join(':');
const formatFactor = (factor: number) => factor.toLocaleString('de-DE', { maximumFractionDigits: 2 });
</script>

<style scoped>
.ees-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.ees-intro {
    margin: 0 0 14px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--bp-text-secondary);

    b {
        color: var(--bp-text-strong);
    }
}

.ees-card {
    background: var(--bp-fill-soft);
    border-radius: 14px;
    padding: 12px 14px;
    margin-bottom: 12px;
}
.ees-card-title {
    margin-bottom: 8px;
    font-size: 16px;
    font-weight: 700;
    color: var(--bp-text-strong);
}

/* Spalten: Rating-Unterschied + je Beispiel-Ergebnis eine Punktespalte */
.ees-table-head,
.ees-table-row {
    display: grid;
    grid-template-columns: 1fr repeat(var(--ees-results), 48px);
    gap: 6px;
    align-items: center;
}
.ees-table-head {
    padding-bottom: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--bp-text-muted);

    span:not(:first-child) {
        text-align: center;
    }
}
.ees-table-row {
    padding: 3px 0;
    font-size: 14px;
    color: var(--bp-text);
}
.ees-table-row--even {
    font-weight: 700;
    color: var(--bp-text-strong);
}
/* Heatmap: --ees-heat = Anteil Gruen, je mehr Punkte, desto kraeftiger */
.ees-points {
    padding: 6px 0;
    border-radius: 8px;
    background: color-mix(in srgb, var(--bp-success) var(--ees-heat), var(--bp-surface));
    text-align: center;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--bp-text-strong);
}
/* Fortsetzung ueber die Tabelle hinaus, ueber alle Ergebnis-Spalten */
.ees-table-row--more > span:first-child {
    color: var(--bp-text-muted);
}
.ees-more {
    grid-column: 2 / -1;
    padding: 4px 0;
    border: 1px dashed var(--bp-border-strong);
    border-radius: 8px;
    background: color-mix(in srgb, var(--bp-success) var(--ees-heat), var(--bp-surface));
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--bp-text-strong);
}
.ees-hint {
    padding-top: 8px;
    font-size: 12px;
    color: var(--bp-text-subtle);
}

.ees-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: var(--bp-text);
}

.ees-factors {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 8px 0 10px;
}
.ees-factor {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--bp-surface);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--bp-text-secondary);

    b {
        color: var(--bp-text-strong);
    }
}

.ees-list {
    margin: 0;
    padding-left: 18px;
    list-style: '–  ';
    font-size: 14px;
    line-height: 1.45;
    color: var(--bp-text);

    li + li {
        margin-top: 6px;
    }
}
.ees-check {
    list-style: '✓  ';
}
.ees-check::marker {
    color: var(--main-color);
}

.ees-footnote {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--bp-text-subtle);
}
</style>
