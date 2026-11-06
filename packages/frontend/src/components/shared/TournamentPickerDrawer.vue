<template>
	<BottomSheet v-model:visible="tournamentPickerVisible" fit flush>
		<template #header>
			<div class="tp-title">Turnier wählen</div>
		</template>

		<div class="tp-list">
			<!-- Next tournament -->
			<div v-if="daysUntilNext > 0" class="tp-row" @click="goTo('/')">
				<div>
					<div class="tp-year">{{ NEXT_BIPO_OPEN.year }}</div>
					<div class="tp-sub">Nächstes Turnier · {{ nextDateLabel }}</div>
				</div>
				<span class="tp-badge">in {{ daysUntilNext }} {{ daysUntilNext == 1 ? 'Tag' : 'Tagen' }}</span>
			</div>

			<!-- Past tournaments -->
			<div
				v-for="year in years"
				:key="year"
				class="tp-row"
				:class="{ 'tp-row-active': isActive(year) }"
				@click="goTo('/' + year)"
			>
				<div>
					<div class="tp-year">{{ year }}</div>
					<div v-if="getWinner(year)" class="tp-sub">Sieger: {{ getWinner(year) }}</div>
				</div>
				<i v-if="isActive(year)" class="pi pi-check tp-check"></i>
			</div>
		</div>
	</BottomSheet>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import router from '@/router.js';
import { BIPO_OPEN_TOURNAMENT_YEARS, BIPO_OPEN_WINNERS, NEXT_BIPO_OPEN } from '@/util/bipoOpenTournamentMeta';
import BottomSheet from './BottomSheet.vue';
import { useTournamentPicker } from './useTournamentPicker';

const route = useRoute();
const { tournamentPickerVisible, closeTournamentPicker } = useTournamentPicker();

const years = [...BIPO_OPEN_TOURNAMENT_YEARS].reverse();

const nextDate = new Date(`${NEXT_BIPO_OPEN.date}T00:00:00`);
const nextDateLabel = nextDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

// Recomputed on each open so the counter stays correct in long-running PWA sessions
const daysUntilNext = computed(() => {
	tournamentPickerVisible.value;
	let today = new Date();
	today.setHours(0, 0, 0, 0);
	return Math.round((nextDate.getTime() - today.getTime()) / 86400000);
});

const getWinner = (year: string) => BIPO_OPEN_WINNERS.find((winner) => winner.year == year)?.name;

const isActive = (year: string) => route.params.TournamentName == year;

const goTo = (path: string) => {
	closeTournamentPicker();
	router.push(path);
};
</script>

<style scoped>
.tp-title {
	font-size: 18px;
	font-weight: bold;
	color: var(--bp-text-strong);
}

.tp-list {
	border-top: 1px solid var(--bp-border);
}
.tp-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 12px 20px;
	border-bottom: 1px solid var(--bp-border);
	cursor: pointer;
	transition: background .2s ease;
}
.tp-row:hover {
	background: var(--bp-surface-soft);
}
.tp-row-active,
.tp-row-active:hover {
	background: rgba(234, 81, 96, 0.08);
}
.tp-year {
	font-weight: bold;
	font-size: 16px;
	color: var(--bp-text-strong);
}
.tp-row-active .tp-year {
	color: var(--main-color);
}
.tp-sub {
	font-size: 12px;
	color: var(--bp-text-muted);
}
.tp-badge {
	white-space: nowrap;
	font-size: 12px;
	font-weight: 600;
	color: var(--main-color);
	background: rgba(234, 81, 96, 0.12);
	border-radius: 999px;
	padding: 3px 10px;
}
.tp-check {
	color: var(--main-color);
}
</style>
