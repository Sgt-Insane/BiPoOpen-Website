<template>
    <div class="PlayerCompare">
        <div class="pc-content">
            <div class="pc-hero">
                <div class="pc-hero-head">
                    <button type="button" class="pc-back" aria-label="Zurück" @click="goBack()">
                        <i class="pi pi-chevron-left"></i>
                    </button>
                    <h1 class="pc-hero-title">Spieler-Vergleich <InfoButton term="vergleich" /></h1>
                </div>

                <!-- Zwei Spieler: antippen zum Wechseln -->
                <div class="pc-players">
                    <div v-for="side in [0, 1]" :key="side" class="pc-player">
                        <template v-if="names[side] && !editing[side]">
                            <router-link :to="`/Spieler/${encodeURIComponent(names[side])}`" class="pc-player-link">
                                <Avatar :name="names[side]" :lazy="false" class="pc-avatar" />
                                <span class="pc-player-name">{{ names[side] }}</span>
                            </router-link>
                            <button type="button" class="pc-change" @click="editing[side] = true">ändern</button>
                        </template>
                        <PlayerSearchAutoComplete
                            v-else
                            v-model="drafts[side]"
                            placeholder="Spieler suchen"
                            className="pc-search"
                            @item-select="choose(side, $event.value)"
                        />
                    </div>
                    <button type="button" class="pc-swap" aria-label="Seiten tauschen" @click="swap()"><i class="pi pi-arrow-right-arrow-left"></i></button>
                </div>
            </div>

            <div v-if="loading" class="pc-card pc-empty"><i class="pi pi-spin pi-spinner"></i> Lade Statistiken …</div>
            <div v-else-if="!profiles[0] || !profiles[1]" class="pc-card pc-empty">Wähle zwei Spieler, um sie zu vergleichen.</div>

            <template v-else>
                <!-- Direkte Duelle und gemeinsame Spiele -->
                <section class="pc-card">
                    <h2 class="pc-card-title">Gegeneinander</h2>
                    <div v-if="duel.matches" class="pc-duel">
                        <span class="pc-duel-score" :class="{ 'pc-better': duel.wins > duel.losses }">{{ duel.wins }}</span>
                        <span class="pc-duel-colon">:</span>
                        <span class="pc-duel-score" :class="{ 'pc-better': duel.losses > duel.wins }">{{ duel.losses }}</span>
                    </div>
                    <div class="pc-duel-text">{{ duelText }}</div>
                    <div v-if="team" class="pc-duel-text">Zusammen im Team: {{ team.wins }} {{ team.wins === 1 ? 'Sieg' : 'Siege' }}, {{ team.losses }} {{ team.losses === 1 ? 'Niederlage' : 'Niederlagen' }} ({{ team.matches }} {{ team.matches === 1 ? 'Spiel' : 'Spiele' }})</div>
                </section>

                <!-- Werte nebeneinander, der bessere Wert ist hervorgehoben -->
                <section v-for="group in groups" :key="group.title" class="pc-card">
                    <h2 class="pc-card-title">{{ group.title }}</h2>
                    <div v-for="row in group.rows" :key="row.label" class="pc-row">
                        <span class="pc-value" :class="{ 'pc-better': row.better === 0 }">{{ row.text[0] }}</span>
                        <div class="pc-row-middle">
                            <span class="pc-label"><GlossaryWord :text="row.label" /></span>
                            <div class="pc-bar" aria-hidden="true">
                                <span class="pc-bar-left" :style="{ width: `${row.share[0]}%` }"></span>
                                <span class="pc-bar-right" :style="{ width: `${row.share[1]}%` }"></span>
                            </div>
                        </div>
                        <span class="pc-value pc-value--right" :class="{ 'pc-better': row.better === 1 }">{{ row.text[1] }}</span>
                    </div>
                </section>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Avatar from '@/components/shared/Avatar.vue';
import InfoButton from '@/components/shared/InfoButton.vue';
import GlossaryWord from '@/components/shared/GlossaryWord.vue';
import PlayerSearchAutoComplete from '@/components/shared/PlayerSearchAutoComplete.vue';
import { getGameData } from '@/util/gameDataCache';
import { buildPlayerProfileData } from './PlayerProfileUtilFunctions';
import { getAccuracy } from '@/components/frontend/biPoKnecht/knechtStats';

const route = useRoute();
const router = useRouter();

const names = ref<[string, string]>([String(route.query.a ?? ''), String(route.query.b ?? '')]);
const drafts = reactive<[string, string]>(['', '']);
const editing = reactive<[boolean, boolean]>([!names.value[0], !names.value[1]]);
const profiles = ref<[PlayerProfileData | null, PlayerProfileData | null]>([null, null]);
const loading = ref(false);

const load = async () => {
    if (!names.value[0] && !names.value[1]) return;
    loading.value = true;
    try {
        const data = await getGameData();
        profiles.value = names.value.map(name => name ? buildPlayerProfileData(data, name) : null) as [PlayerProfileData | null, PlayerProfileData | null];
    } finally {
        loading.value = false;
    }
};
watch(names, () => {
    router.replace({ query: { ...(names.value[0] && { a: names.value[0] }), ...(names.value[1] && { b: names.value[1] }) } });
    load();
}, { immediate: true, deep: true });

const choose = (side: number, name: string) => {
    names.value[side] = name;
    // Suchfeld erst ausblenden, wenn es seine Vorschlagsliste geschlossen hat
    setTimeout(() => {
        editing[side] = false;
        drafts[side] = '';
    }, 200);
};
const swap = () => { names.value = [names.value[1], names.value[0]]; };

// ─── Direkte Duelle und gemeinsame Spiele: aus allen Spielen von Spieler 1 ───
const together = computed(() => {
    const a = names.value[0].toLowerCase(), b = names.value[1].toLowerCase();
    const result = { against: { matches: 0, wins: 0, losses: 0 }, team: { matches: 0, wins: 0, losses: 0 } };
    if (!a || !b) return result;
    const has = (team: Team, name: string) => team.players.some(player => player.name.toLowerCase() === name);
    profiles.value[0]?.allMatchHistory.forEach(entry => {
        const teams = [entry.match.team1, entry.match.team2];
        const own = teams.findIndex(team => has(team, a));
        if (own < 0) return;
        const bucket = has(teams[1 - own], b) ? result.against : has(teams[own], b) ? result.team : null;
        if (!bucket) return;
        bucket.matches++;
        if (entry.won) bucket.wins++; else bucket.losses++;
    });
    return result;
});
const duel = computed(() => together.value.against);
const duelText = computed(() => {
    const { matches, wins, losses } = duel.value;
    if (!matches) return 'Noch kein Spiel gegeneinander';
    if (wins === losses) return `${matches} Spiele gegeneinander – ausgeglichen`;
    return `${matches} Spiele gegeneinander – ${wins > losses ? names.value[0] : names.value[1]} führt`;
});
const team = computed(() => together.value.team.matches ? together.value.team : null);

// ─── Vergleichszeilen ───
type Row = { label: string; text: [string, string]; share: [number, number]; better: number | null };
const format = (value: number, digits = 0) => value.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });

// lowerIsBetter: z.B. der Rang
const row = (label: string, values: [number | null, number | null], text: (value: number) => string, lowerIsBetter = false): Row | null => {
    if (values[0] === null && values[1] === null) return null;
    const [a, b] = values;
    const better = a === null || b === null || a === b ? (a === null ? (b === null ? null : 1) : b === null ? 0 : null) : (lowerIsBetter ? (a < b ? 0 : 1) : (a > b ? 0 : 1));
    // Balken: Anteil am Gesamtwert (beim Rang umgekehrt)
    const weights = values.map(value => value === null ? 0 : lowerIsBetter ? 1 / Math.max(value, 1) : Math.max(value, 0));
    const total = weights[0] + weights[1] || 1;
    return {
        label,
        text: [a === null ? '–' : text(a), b === null ? '–' : text(b)],
        share: [weights[0] / total * 100, weights[1] / total * 100],
        better,
    };
};

const groups = computed(() => {
    const [a, b] = profiles.value;
    if (!a || !b) return [];
    const both = <T,>(pick: (profile: PlayerProfileData) => T) => [pick(a), pick(b)] as [T, T];
    const knecht = both(profile => profile.knecht);
    const knechtValue = (pick: (stats: NonNullable<PlayerProfileData['knecht']>) => number) => knecht.map(stats => stats ? pick(stats) : null) as [number | null, number | null];
    const list = [
        {
            title: 'Weltrangliste',
            rows: [
                row('Elo', both(profile => profile.elo?.rating ?? null), value => format(value)),
                row('Rang', both(profile => profile.elo?.rank ?? null), value => `${value}.`, true),
                row('Bestwert', both(profile => profile.elo?.peak ?? null), value => format(value)),
            ],
        },
        {
            title: 'Alle Spiele',
            rows: [
                row('Spiele', both(profile => profile.totalMatches), value => format(value)),
                row('Siege', both(profile => profile.totalWins), value => format(value)),
                row('Siegquote', both(profile => profile.winrate), value => `${format(value)} %`),
                row('Becher pro Spiel', both(profile => profile.averageHits), value => format(value, 1)),
                row('Längste Siegserie', both(profile => profile.bestWinStreak), value => format(value)),
                row('Aktuelle Serie', both(profile => profile.currentWinStreak), value => format(value)),
            ],
        },
        {
            title: 'BiPo Knecht',
            rows: [
                row('Trefferquote', knechtValue(stats => getAccuracy(stats)), value => `${value} %`),
                row('Becher pro Spiel', knechtValue(stats => stats.points / Math.max(stats.games, 1)), value => format(value, 1)),
                row('Treffer in Folge', knechtValue(stats => stats.bestStreak), value => format(value)),
                row('Bomben', knechtValue(stats => stats.bombs), value => format(value)),
                row('Bouncer', knechtValue(stats => stats.bouncers), value => format(value)),
                row('On Fire', knechtValue(stats => stats.onFires), value => format(value)),
                row('Letzte Becher', knechtValue(stats => stats.lastCups), value => format(value)),
            ],
        },
    ];
    return list.map(group => ({ ...group, rows: group.rows.filter((entry): entry is Row => entry !== null) })).filter(group => group.rows.length);
});

const goBack = () => {
    if (window.history.state?.back) router.back();
    else router.push('/');
};
</script>

<style scoped>
.PlayerCompare{
    margin-inline: calc(50% - 50vw);
    padding: 12px calc(50vw - 50%) 32px;
    background: var(--page-gray);
}
.pc-content{
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 640px;
    margin: 0 auto;
}
.pc-hero{
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 8px 12px 18px;
    border-radius: 20px;
    background: var(--bp-navy, #0C1E47);
    color: white;
}
.pc-hero-head{
    display: flex;
    align-items: center;
    gap: 4px;
    height: 44px;
}
.pc-back{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: white;
    cursor: pointer;
}
.pc-hero-title{
    margin: 0;
    font-size: 22px;
    font-weight: 800;
}
.pc-players{
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 44px;
}
.pc-player{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 0;
}
.pc-player-link{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    color: white;
    text-decoration: none;
}
.pc-avatar{
    width: 64px;
    height: 64px;
}
.pc-player-name{
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 16px;
    font-weight: 800;
}
.pc-change{
    border: none;
    background: transparent;
    color: #C9D2E6;
    font-size: 12px;
    text-decoration: underline;
    cursor: pointer;
}
.pc-player :deep(.pc-search),
.pc-player :deep(.pc-search input){
    width: 100%;
}
.pc-swap{
    position: absolute;
    left: 50%;
    top: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    margin-left: -18px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, .14);
    color: white;
    cursor: pointer;
}
.pc-card{
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    border-radius: 16px;
    background: var(--bp-surface);
    box-shadow: 0 1px 2px rgba(16, 24, 40, .06);
}
.pc-empty{
    align-items: center;
    flex-direction: row;
    justify-content: center;
    gap: 8px;
    color: var(--bp-text-muted);
    font-size: 14px;
}
.pc-card-title{
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.pc-duel{
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: 10px;
    font-variant-numeric: tabular-nums;
}
.pc-duel-score{
    font-size: 44px;
    font-weight: 900;
    color: var(--bp-text-muted);
}
.pc-duel-score.pc-better{
    color: var(--main-color);
}
.pc-duel-colon{
    font-size: 32px;
    font-weight: 800;
    color: var(--bp-text-muted);
}
.pc-duel-text{
    font-size: 13px;
    color: var(--bp-text-muted);
    text-align: center;
}
.pc-row{
    display: grid;
    grid-template-columns: 64px 1fr 64px;
    align-items: center;
    gap: 10px;
}
.pc-value{
    font-size: 15px;
    font-weight: 700;
    color: var(--bp-text-muted);
    font-variant-numeric: tabular-nums;
}
.pc-value--right{
    text-align: right;
}
.pc-value.pc-better{
    font-weight: 900;
    color: var(--bp-text-strong);
}
.pc-row-middle{
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}
.pc-label{
    font-size: 12px;
    font-weight: 700;
    color: var(--bp-text);
    text-align: center;
}
.pc-bar{
    display: flex;
    justify-content: space-between;
    height: 6px;
    border-radius: 3px;
    background: var(--page-gray);
    overflow: hidden;
}
.pc-bar-left{
    background: var(--main-color);
}
.pc-bar-right{
    background: #61C3D9;
}
</style>
