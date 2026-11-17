<template>
    <!-- Kurzliste fuer die Startseite: wer noch Meilen laufen / Shots trinken muss (Stil wie die Nackte-Meilen-Seite) -->
    <div class="HomeDebtList">
        <div class="hdl-card">
            <div v-if="loading" class="hdl-empty">Lädt …</div>
            <div v-else-if="!debtors.length" class="hdl-empty">{{ kind === 'miles' ? 'Alle Meilen sind gelaufen.' : 'Alle Shots sind getrunken. Prost! 🥃' }}</div>
            <router-link v-for="debtor in debtors.slice(0, LIMIT)" :key="debtor.name" :to="link" class="hdl-row">
                <Avatar :name="debtor.name" class="hdl-avatar"/>
                <span class="hdl-main">
                    <span class="hdl-name">{{ debtor.name }}</span>
                    <span class="hdl-dashes"><span v-for="index in Math.min(debtor.count, 10)" :key="index" class="hdl-dash"></span></span>
                </span>
                <strong class="hdl-count">{{ debtor.count }}</strong>
            </router-link>
        </div>
        <router-link :to="link" class="hdl-more">
            {{ kind === 'miles' ? `Alle ${total} offenen Meilen` : `Alle ${total} offenen Shots` }} <i class="pi pi-angle-right"></i>
        </router-link>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import { getNackteMeilen } from '@/components/frontend/nackteMeilen/nackteMeilen';
import { formatPlayerName } from '@/components/frontend/home/homeUtil';
import { getShots, type Shot } from '@/components/frontend/shots/shots';

const props = defineProps<{ kind: 'miles' | 'shots'; openGames: Match[]; leagueGames: Match[]; gamesLoading: boolean }>();

const LIMIT = 6;
const link = computed(() => props.kind === 'miles' ? '/Nackte-Meilen' : '/Offene-Shots');

// Shots erst laden, wenn der Chip gewaehlt wird
const shots = ref<Shot[] | null>(null);
watch(() => props.kind, kind => {
    if (kind === 'shots' && shots.value === null) getShots().then(list => { shots.value = list; }).catch(() => { shots.value = []; });
}, { immediate: true });

const names = computed(() => props.kind === 'miles'
    ? getNackteMeilen([...props.openGames, ...props.leagueGames]).offen.map(mile => formatPlayerName(mile.name))
    : (shots.value ?? []).filter(shot => !shot.drunkAt).map(shot => shot.name));

const loading = computed(() => props.kind === 'miles' ? props.gamesLoading : shots.value === null);
const total = computed(() => names.value.length);
const debtors = computed(() => {
    const counts = new Map<string, number>();
    names.value.forEach(name => counts.set(name, (counts.get(name) ?? 0) + 1));
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
});
</script>

<style scoped>
.HomeDebtList{
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.hdl-card{
    overflow: hidden;
    border-radius: 16px;
    background: var(--bp-surface);
    box-shadow: 0 1px 2px rgba(16, 24, 40, .06);
}
.hdl-row{
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    column-gap: 10px;
    align-items: center;
    padding: 9px 12px;
    color: inherit;
    text-decoration: none;
}
.hdl-row + .hdl-row{
    border-top: 1px solid var(--bp-border);
}
.hdl-avatar{
    width: 34px !important;
    height: 34px !important;
}
.hdl-main{
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
}
.hdl-name{
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 650;
    color: var(--bp-text-strong);
}
.hdl-dashes{
    display: flex;
    gap: 3px;
}
.hdl-dash{
    width: 14px;
    height: 4px;
    border-radius: 2px;
    background: var(--bp-hero);
}
.hdl-count{
    font-size: 17px;
    font-variant-numeric: tabular-nums;
    color: var(--bp-text-strong);
}
.hdl-empty{
    padding: 24px 12px;
    text-align: center;
    color: var(--bp-text-muted);
}
.hdl-more{
    align-self: flex-end;
    font-size: 14px;
    font-weight: 600;
    color: var(--main-color);
    text-decoration: none;
}
</style>
