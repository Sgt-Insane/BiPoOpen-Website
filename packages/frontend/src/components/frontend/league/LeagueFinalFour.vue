<template>
    <div class="LeagueFinalFour">

        <div class="ff-bracket">
            <div class="ff-round-title">Halbfinale</div>
            <div class="ff-round-title">Finale</div>

            <!-- ── Halbfinale ── -->
            <div class="ff-semis">
                <div v-for="index in [0, 1]" :key="index" class="ff-semi-slot">
                    <FinalFourSeriesCard v-bind="getCardProps(index)" @open="openSeries(index)"/>
                </div>
            </div>

            <!-- ── Finale: mittig zwischen den Halbfinals ── -->
            <div class="ff-final">
                <div class="ff-final-slot">
                    <div v-if="series[2].result.winner" class="ff-champion-label">
                        <i class="pi pi-trophy"></i> Meister
                    </div>
                    <FinalFourSeriesCard v-bind="getCardProps(2)" highlightWinner @open="openSeries(2)"/>
                </div>
            </div>

            <!-- ── Spiel um Platz 3 ── -->
            <div class="ff-third-place">
                <div class="ff-round-title">Spiel um Platz 3</div>
                <FinalFourSeriesCard v-bind="getCardProps(3)" @open="openSeries(3)"/>
            </div>
        </div>

        <FinalFourSeriesSheet
            v-model:visible="sheetVisible"
            :title="selectedSeries.title"
            :team1="selectedSeries.team1"
            :team2="selectedSeries.team2"
            :result="selectedSeries.result"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FinalFourSeriesCard from './FinalFourSeriesCard.vue';
import FinalFourSeriesSheet from './FinalFourSeriesSheet.vue';
import { getLeagueList, getSeriesResult } from './LeagueUtilFunctions';
import { LeagueTeam } from './LeagueSeasonsData';

const props = defineProps({
    leaguePlayers: { type: Array as () => LeaguePlayer[], required: true },
    leagueGames: { type: Array as () => Match[], required: true },
    regularSeasonGameCount: { type: Number, required: true },
    teams: { type: Array as () => LeagueTeam[], required: true },
});

const sortedGames = computed(() => props.leagueGames
    .slice()
    .sort((match1, match2) => (match1.time ?? 0) - (match2.time ?? 0))
);
const regularSeasonGames = computed(() => sortedGames.value.slice(0, props.regularSeasonGameCount));
const finalFourGames = computed(() => sortedGames.value.slice(props.regularSeasonGameCount));

// Die Hauptrunde muss komplett gespielt sein, bevor gesetzt wird.
const isRegularSeasonComplete = computed(() =>
    props.regularSeasonGameCount > 0 && regularSeasonGames.value.length >= props.regularSeasonGameCount
);

// Top 4 der Abschlusstabelle (positional, damit Ties nicht das Seeding verfaelschen).
// Solange die Hauptrunde laeuft, bleiben alle Plaetze leer -> die Karten zeigen die Platzhalter-Texte.
const seedTeams = computed<(Team | undefined)[]>(() => {
    if (!isRegularSeasonComplete.value)
        return [undefined, undefined, undefined, undefined];

    const standings = getLeagueList(regularSeasonGames.value, props.leaguePlayers).slice(0, 4);

    return [0, 1, 2, 3].map((index) => {
        const player = standings[index];
        if (!player)
            return undefined;

        const logo = props.leaguePlayers.find(leaguePlayer => leaguePlayer.name === player.name)?.logo;
        const playerName = props.teams.find(team => team.teamName === player.name)?.playerName ?? player.name;

        return {
            _id: '',
            name: player.name,
            logo,
            players: [{ _id: '', name: playerName }],
        } as unknown as Team;
    });
});

const createSeries = (title: string, team1: Team | undefined, team2: Team | undefined, team1Placeholder: string, team2Placeholder: string) => ({
    title,
    team1,
    team2,
    team1Placeholder,
    team2Placeholder,
    result: getSeriesResult(finalFourGames.value, team1, team2),
});

// Reihenfolge: Halbfinale 1, Halbfinale 2, Finale, Spiel um Platz 3
const series = computed(() => {
    const semiFinal1 = createSeries('Halbfinale 1', seedTeams.value[0], seedTeams.value[3], '1. der Tabelle', '4. der Tabelle');
    const semiFinal2 = createSeries('Halbfinale 2', seedTeams.value[1], seedTeams.value[2], '2. der Tabelle', '3. der Tabelle');

    return [
        semiFinal1,
        semiFinal2,
        createSeries('Finale', semiFinal1.result.winner, semiFinal2.result.winner, 'Sieger Halbfinale 1', 'Sieger Halbfinale 2'),
        createSeries('Spiel um Platz 3', semiFinal1.result.loser, semiFinal2.result.loser, 'Verlierer Halbfinale 1', 'Verlierer Halbfinale 2'),
    ];
});

// Ohne title, der sonst als HTML-Attribut (Tooltip) auf der Karte landet.
const getCardProps = (index: number) => {
    const { title, ...cardProps } = series.value[index];
    return cardProps;
};

// ─── Detail-Sheet ───
const sheetVisible = ref(false);
const selectedSeriesIndex = ref(0);
const selectedSeries = computed(() => series.value[selectedSeriesIndex.value]);

const openSeries = (index: number) => {
    selectedSeriesIndex.value = index;
    sheetVisible.value = true;
};
</script>

<style scoped>
.LeagueFinalFour {
    padding-top: 16px;
}

/* Zwei Spalten: links Halbfinale + Spiel um Platz 3, rechts das Finale mittig neben den Halbfinals */
.ff-bracket {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    --ff-line-length: 12px;
    --ff-line-color: var(--bp-border-strong);
    /* Platz fuer die Verbindungslinien: aus dem Halbfinale raus und ins Finale rein */
    column-gap: calc(2 * var(--ff-line-length));
    max-width: 640px;
    margin: 0 auto;
}

.ff-round-title {
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--main-color);
}

/* ── Verbindungslinien (aus der Turnier-K.o.-Phase): Halbfinale -> Finale ── */
.ff-semis {
    --ff-semi-gap: 20px;
    display: flex;
    flex-direction: column;
    gap: var(--ff-semi-gap);
}

.ff-semi-slot {
    position: relative;
}

/* Waagerecht aus dem Halbfinale nach rechts */
.ff-semi-slot::after {
    content: '';
    position: absolute;
    top: 50%;
    right: calc(-1 * var(--ff-line-length));
    width: var(--ff-line-length);
    height: 2px;
    background: var(--ff-line-color);
}

/* Senkrecht: oberes Halbfinale nach unten, unteres nach oben, treffen sich in der Luecke */
.ff-semi-slot::before {
    content: '';
    position: absolute;
    right: calc(-1 * var(--ff-line-length));
    width: 2px;
    background: var(--ff-line-color);
}
.ff-semi-slot:first-child::before {
    top: 50%;
    bottom: calc(-0.5 * var(--ff-semi-gap));
}
.ff-semi-slot:last-child::before {
    top: calc(-0.5 * var(--ff-semi-gap));
    bottom: 50%;
}

/* Finale mittig neben den Halbfinals, damit die Linie die Karte in der Mitte trifft */
.ff-final {
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.ff-final-slot {
    position: relative;
}

/* Waagerecht von der Mitte der Halbfinals ins Finale */
.ff-final-slot::before {
    content: '';
    position: absolute;
    top: 50%;
    left: calc(-1 * var(--ff-line-length));
    width: var(--ff-line-length);
    height: 2px;
    background: var(--ff-line-color);
}

/* Absolut ueber der Karte, damit sie mittig bleibt */
.ff-champion-label {
    position: absolute;
    bottom: 100%;
    left: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--bp-gold);
}
.ff-champion-label .pi {
    font-size: 11px;
    color: #e2b93b;
}

.ff-third-place {
    margin-top: 28px;
}
</style>
