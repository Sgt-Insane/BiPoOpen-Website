<template>
    <section class="pp-section">
        <div class="pp-section-head">
            <h2 class="pp-section-title">BiPo Knecht</h2>
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
                    <span>längste Serie</span>
                </div>
            </div>

            <div class="pp-knecht-accuracy" :aria-label="`${stats.hits} Treffer bei ${stats.throws} Würfen`">
                <span class="pp-knecht-accuracy-bar"><span :style="{ width: `${getAccuracy(stats)}%` }"></span></span>
                <span class="pp-knecht-accuracy-label">{{ stats.hits }} Treffer · {{ stats.throws }} Würfe · {{ stats.wins }} von {{ stats.games }} gewonnen</span>
            </div>

            <div v-if="highlights.length" class="pp-knecht-highlights">
                <span v-for="highlight in highlights" :key="highlight.label" class="pp-knecht-chip">
                    <KnechtIcon :name="highlight.icon" />
                    <b>{{ highlight.value }}</b> {{ highlight.label }}
                </span>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import KnechtIcon from '@/components/frontend/biPoKnecht/KnechtIcon.vue';
import type { KnechtIconName } from '@/components/frontend/biPoKnecht/knechtIcons';
import { getAccuracy, type KnechtCareerStats } from '@/components/frontend/biPoKnecht/knechtStats';

const props = defineProps<{ stats: KnechtCareerStats }>();

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
