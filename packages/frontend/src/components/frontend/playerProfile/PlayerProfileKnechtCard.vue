<template>
    <section class="pp-section">
        <div class="pp-section-head">
            <h2 class="pp-section-title"><GlossaryWord term="knecht">BiPo Knecht</GlossaryWord></h2>
            <span class="pp-knecht-games">{{ stats.games }} {{ stats.games === 1 ? 'Spiel' : 'Spiele' }} gezählt</span>
        </div>

        <div class="pp-card pp-knecht">
            <div class="pp-knecht-tiles pp-knecht-tiles--3">
                <div class="pp-knecht-tile">
                    <b>{{ getAccuracy(stats) }} %</b>
                    <span>Trefferquote</span>
                </div>
                <div class="pp-knecht-tile">
                    <b>{{ formatDecimal(stats.points / stats.games) }}</b>
                    <span>Becher pro Spiel</span>
                </div>
                <div class="pp-knecht-tile">
                    <b>{{ stats.bestStreak }}</b>
                    <span>Treffer in Folge</span>
                </div>
            </div>

            <div class="pp-knecht-accuracy" :aria-label="`${stats.hits} Treffer bei ${stats.throws} Würfen`">
                <span class="pp-knecht-accuracy-bar"><span :style="{ width: `${getAccuracy(stats)}%` }"></span></span>
                <span class="pp-knecht-accuracy-label">{{ stats.hits }} Treffer · {{ stats.throws }} Würfe · {{ stats.wins }} von {{ stats.games }} gewonnen</span>
            </div>

            <!-- Heatmap: wohin trifft man (aus Sicht des Werfers), bei Knecht Pro auch die Kanten -->
            <div v-if="heatmap" class="pp-heat">
                <div class="pp-heat-head">
                    <span class="pp-heat-title">Wo du triffst</span>
                    <div v-if="hasEdges" class="pp-heat-switch" role="radiogroup" aria-label="Heatmap">
                        <button type="button" role="radio" :aria-checked="heatMode === 'hits'" @click="heatMode = 'hits'">Treffer</button>
                        <button type="button" role="radio" :aria-checked="heatMode === 'edges'" @click="heatMode = 'edges'">Kanten</button>
                    </div>
                </div>
                <div class="pp-heat-body">
                    <div class="pp-heat-triangle">
                        <div v-for="(row, rowIndex) in HEAT_ROWS" :key="rowIndex" class="pp-heat-row">
                            <div v-for="number in row" :key="number" class="pp-heat-cup" :style="cupStyle(number)" :title="`Becher ${number}: ${heatValues[number - 1]}`">
                                <span class="pp-heat-number">{{ number }}</span>
                                <span class="pp-heat-count">{{ heatValues[number - 1] }}</span>
                            </div>
                        </div>
                        <div class="pp-heat-thrower">▲ du wirfst von hier</div>
                    </div>
                    <div class="pp-heat-facts">
                        <div><b>Becher {{ topCups }}</b><span>{{ heatMode === 'hits' ? 'Lieblingsbecher' : 'meiste Kanten' }}</span></div>
                        <div><b>{{ frontShare }} %</b><span>{{ heatMode === 'hits' ? 'Treffer' : 'Kanten' }} in den vorderen 3</span></div>
                        <div><b>{{ heatmap.games }}</b><span>{{ heatmap.games === 1 ? 'Spiel' : 'Spiele' }} ausgewertet</span></div>
                    </div>
                </div>
            </div>

            <div v-if="highlights.length" class="pp-knecht-highlights">
                <span v-for="highlight in highlights" :key="highlight.label" class="pp-knecht-chip">
                    <KnechtIcon :name="highlight.icon" />
                    <b>{{ highlight.value }}</b> <GlossaryWord :text="highlight.label" />
                </span>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import GlossaryWord from '@/components/shared/GlossaryWord.vue';
import KnechtIcon from '@/components/frontend/biPoKnecht/KnechtIcon.vue';
import type { KnechtIconName } from '@/components/frontend/biPoKnecht/knechtIcons';
import { getAccuracy, type KnechtCareerStats } from '@/components/frontend/biPoKnecht/knechtStats';
import type { CupHeatmap } from './playerHeatmap';

const props = defineProps<{ stats: KnechtCareerStats; heatmap?: CupHeatmap | null }>();

// ─── Heatmap ───
const HEAT_ROWS = [[7, 8, 9, 10], [4, 5, 6], [2, 3], [1]];
const heatMode = ref<'hits' | 'edges'>('hits');
const hasEdges = computed(() => !!props.heatmap?.edges.some(Boolean));
const heatValues = computed(() => props.heatmap ? props.heatmap[heatMode.value] : []);
const heatMax = computed(() => Math.max(1, ...heatValues.value));
// Farbe von blass (selten) bis kraeftig (am haeufigsten)
const cupStyle = (number: number) => {
    const share = (heatValues.value[number - 1] ?? 0) / heatMax.value;
    return { '--heat': `${Math.round(12 + share * 88)}%`, color: share > .55 ? 'white' : 'var(--bp-text-strong)' };
};
// Bei Gleichstand alle Spitzenreiter (hoechstens drei)
const topCups = computed(() => {
    const max = Math.max(...heatValues.value);
    const top = heatValues.value.map((value, index) => value === max ? index + 1 : 0).filter(Boolean);
    return top.length > 3 ? `${top.slice(0, 3).join(', ')} …` : top.join(', ');
});
const frontShare = computed(() => {
    const total = heatValues.value.reduce((sum, value) => sum + value, 0);
    return total ? Math.round((heatValues.value[0] + heatValues.value[1] + heatValues.value[2]) / total * 100) : 0;
});

const formatDecimal = (value: number) => value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Nur was tatsaechlich vorkam, haeufigste zuerst
const highlights = computed(() => {
    const entries: { icon: KnechtIconName; value: number; label: string }[] = [
        { icon: 'bomb', value: props.stats.bombs, label: props.stats.bombs === 1 ? 'Bombe' : 'Bomben' },
        { icon: 'bouncer', value: props.stats.bouncers, label: 'Bouncer' },
        { icon: 'ballsback', value: props.stats.ballsBacks, label: 'Balls Back' },
        { icon: 'onfire', value: props.stats.onFires, label: 'On Fire' },
        { icon: 'trickshot', value: props.stats.trickshotHits, label: props.stats.trickshotHits === 1 ? 'Trickshot' : 'Trickshots' },
        { icon: 'lastCup', value: props.stats.lastCups, label: 'letzte Becher' },
        { icon: 'deathcup', value: props.stats.deathcups, label: props.stats.deathcups === 1 ? 'Deathcup' : 'Deathcups' },
        { icon: 'airball', value: props.stats.airballs, label: props.stats.airballs === 1 ? 'Airball' : 'Airballs' },
        { icon: 'owncup', value: props.stats.ownCups, label: 'eigene Becher' },
    ];
    return entries.filter(entry => entry.value > 0).sort((a, b) => b.value - a.value);
});
</script>

<style scoped>
/* ─── Heatmap ─── */
.pp-heat{
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--bp-border);
}
.pp-heat-head{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.pp-heat-title{
    font-size: 14px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.pp-heat-switch{
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    background: var(--page-gray);
}
.pp-heat-switch button{
    padding: 4px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--bp-text-muted);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
}
.pp-heat-switch button[aria-checked="true"]{
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    box-shadow: 0 1px 2px rgba(0, 0, 0, .1);
}
.pp-heat-body{
    display: flex;
    align-items: center;
    gap: 16px;
}
.pp-heat-triangle{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
}
.pp-heat-row{
    display: flex;
    gap: 4px;
}
.pp-heat-cup{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--main-color) var(--heat), var(--bp-surface));
    border: 1.5px solid color-mix(in srgb, var(--main-color) 35%, transparent);
    line-height: 1;
}
.pp-heat-number{
    font-size: 9px;
    opacity: .7;
}
.pp-heat-count{
    font-size: 13px;
    font-weight: 800;
}
.pp-heat-thrower{
    margin-top: 2px;
    font-size: 10px;
    color: var(--bp-text-muted);
}
.pp-heat-facts{
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
}
.pp-heat-facts div{
    display: flex;
    flex-direction: column;
}
.pp-heat-facts b{
    font-size: 16px;
    color: var(--bp-text-strong);
}
.pp-heat-facts span{
    font-size: 12px;
    color: var(--bp-text-muted);
}

.pp-knecht-games {
    font-size: 13px;
    color: var(--bp-text-muted);
}

.pp-knecht {
    padding: 14px;
}

.pp-knecht-tiles {
    display: grid;
    gap: 8px;
}
.pp-knecht-tiles--3 { grid-template-columns: 1fr 1fr 1fr; }
.pp-knecht-tile {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--bp-fill-soft);

    b {
        font-size: 17px;
        font-weight: 800;
        line-height: 1.2;
    }
    span {
        margin-top: 1px;
        font-size: 12px;
        color: var(--bp-text-muted);
    }
}

.pp-knecht-accuracy {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 14px;
}
.pp-knecht-accuracy-bar {
    height: 6px;
    overflow: hidden;
    border-radius: 3px;
    background: var(--bp-primary-weak);

    span {
        display: block;
        height: 100%;
        border-radius: 3px;
        background: var(--main-color);
    }
}
.pp-knecht-accuracy-label {
    font-size: 12px;
    color: var(--bp-text-muted);
}

.pp-knecht-highlights {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 14px;
}
.pp-knecht-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border: 1px solid var(--bp-border);
    border-radius: 999px;
    font-size: 12px;
    color: var(--bp-text-secondary);

    b {
        color: var(--bp-text-strong);
    }
    .KnechtIcon {
        width: 14px;
        height: 14px;
        color: var(--bp-text-muted);
    }
}
</style>
