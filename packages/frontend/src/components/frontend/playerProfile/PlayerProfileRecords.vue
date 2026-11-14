<template>
    <!-- Rekorde: eigener Bestwert neben dem Allzeit-Rekord, getrennt von den Auszeichnungen -->
    <section v-if="records.length" class="pp-section">
        <div class="pp-section-head">
            <h2 class="pp-section-title">Rekorde</h2>
            <span class="pp-section-aside">{{ heldCount ? `${heldCount} gehalten` : 'eigener Wert · Rekord' }}</span>
        </div>

        <div class="pp-card pp-records">
            <div v-for="badge in records" :key="badge.id" class="pp-record" :class="`is-${getStatus(badge)}`">
                <span class="pp-record-icon"><span class="material-icons">military_tech</span></span>
                <div class="pp-record-main">
                    <div class="pp-record-label">{{ badge.label }}</div>
                    <div class="pp-record-sub">{{ getSubline(badge) }}</div>
                    <span v-if="getStatus(badge) === 'never'" class="pp-record-bar">
                        <span :style="{ width: `${getPercent(badge)}%` }"></span>
                    </span>
                </div>
                <div class="pp-record-value">
                    <b>{{ formatNumber(badge.record!.own) }}</b>
                    <small>{{ shortUnit(badge.record!.unit) }}</small>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ badges: PlayerBadge[] }>();

type Status = 'current' | 'former' | 'never';

const formatNumber = (value: number) => value.toLocaleString('de-DE');
const formatMonth = (time: number) => new Date(time).toLocaleDateString('de-DE', { month: '2-digit', year: '2-digit' });
const shortUnit = (unit: string) => unit.replace(/ in Folge$/, '');

const getStatus = (badge: PlayerBadge): Status => !badge.locked ? 'current' : badge.former ? 'former' : 'never';

// Gehaltene zuerst, dann frueher gehaltene, dann der Rest
const ORDER: Record<Status, number> = { current: 0, former: 1, never: 2 };
const records = computed(() => props.badges
    .filter(badge => badge.group === 'record' && badge.record)
    .sort((a, b) => ORDER[getStatus(a)] - ORDER[getStatus(b)]));

const heldCount = computed(() => records.value.filter(badge => getStatus(badge) === 'current').length);

const getSubline = (badge: PlayerBadge) => {
    const { best, holder, unit, until } = badge.record!;
    const isStreak = unit.endsWith('in Folge');
    switch (getStatus(badge)) {
        case 'current': return isStreak ? `Rekordhalter · ${unit}` : 'Rekordhalter';
        case 'former': return `Rekord bis ${until ? formatMonth(until) : '–'} · jetzt ${holder} mit ${formatNumber(best)}`;
        default: return `Rekord: ${holder} mit ${formatNumber(best)}`;
    }
};

const getPercent = (badge: PlayerBadge) => Math.min(100, Math.round(badge.record!.own / Math.max(1, badge.record!.best) * 100));
</script>

<style scoped>
.pp-records {
    padding: 4px 14px;
}
.pp-record {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
}
.pp-record + .pp-record {
    border-top: 1px solid var(--bp-border);
}
.pp-record-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bp-fill);
    color: var(--bp-text-faint);

    .material-icons {
        font-size: 19px;
    }
}
.is-current .pp-record-icon {
    background: var(--bp-violet-weak);
    color: var(--bp-violet);
}
.is-former .pp-record-icon {
    color: var(--bp-violet);
}
.pp-record-main {
    flex: 1;
    min-width: 0;
}
.pp-record-label {
    font-size: 15px;
    font-weight: 700;
    color: var(--bp-text-strong);
}
.pp-record-sub {
    font-size: 12px;
    color: var(--bp-text-muted);
}
.is-current .pp-record-sub {
    color: var(--bp-violet);
    font-weight: 600;
}
.pp-record-bar {
    display: block;
    height: 4px;
    margin-top: 6px;
    overflow: hidden;
    border-radius: 2px;
    background: var(--bp-fill-strong);

    span {
        display: block;
        height: 100%;
        border-radius: 2px;
        background: var(--bp-violet);
        opacity: .5;
    }
}
.pp-record-value {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.1;

    b {
        font-size: 18px;
        font-weight: 800;
        color: var(--bp-text-strong);
        font-variant-numeric: tabular-nums;
    }
    small {
        font-size: 11px;
        color: var(--bp-text-muted);
    }
}
.is-current .pp-record-value b {
    color: var(--bp-violet);
}
</style>
