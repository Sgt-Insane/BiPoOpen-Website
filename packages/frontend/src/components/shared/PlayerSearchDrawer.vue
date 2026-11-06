<template>
	<BottomSheet v-model:visible="playerSearchVisible" flush>
		<template #header>
			<div class="ps-title">Spieler suchen</div>
		</template>

		<div class="ps-input-wrap">
			<i class="pi pi-search ps-search-icon"></i>
			<input
				ref="inputEl"
				v-model="query"
				class="ps-input"
				type="search"
				placeholder="Name eingeben …"
				autocomplete="off"
				enterkeyhint="go"
				@keydown.enter.prevent="openFirst"
			/>
			<button v-if="query" type="button" class="ps-clear" aria-label="Suche leeren" @click="clearQuery">
				<i class="pi pi-times"></i>
			</button>
		</div>

		<div v-if="!isLoaded" class="ps-hint">Spieler werden geladen …</div>
		<template v-else>
			<div class="ps-section-label">{{ normalize(query) ? 'Treffer' : 'Aktivste Spieler' }}</div>
			<div v-if="results.length" class="ps-list">
				<button v-for="name in results" :key="name" type="button" class="ps-row" @click="openProfile(name)">
					<Avatar :name="name" shape="circle" class="ps-avatar" />
					<span class="ps-name">{{ name }}</span>
					<EloChip :rating="getElo(name)" />
					<span class="ps-count">{{ matchCounts[name] ?? 0 }} {{ (matchCounts[name] ?? 0) == 1 ? 'Spiel' : 'Spiele' }}</span>
					<i class="pi pi-angle-right ps-arrow"></i>
				</button>
			</div>
			<div v-else class="ps-hint">Kein Spieler gefunden</div>
		</template>
	</BottomSheet>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import router from '@/router.js';
import Avatar from './Avatar.vue';
import BottomSheet from './BottomSheet.vue';
import EloChip from './EloChip.vue';
import { usePlayerSearch } from './usePlayerSearch';
import { useEloRatings } from './useEloRatings';
import { getAllPlayerNames, getPlayerMatchCounts } from '@/components/frontend/playerProfile/PlayerProfileUtilFunctions';
import { getPlayerProfilePath } from '@/util/util';

const MAX_RESULTS = 30;
const MAX_SUGGESTIONS = 15;

const { playerSearchVisible, closePlayerSearch } = usePlayerSearch();
const { loadEloRatings, getElo } = useEloRatings();

const inputEl = ref<HTMLInputElement>();
const query = ref('');
const names = ref<string[]>([]);
const matchCounts = ref<Record<string, number>>({});
const isLoaded = ref(false);

const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

watch(playerSearchVisible, async (visible) => {
	if (!visible) return;
	query.value = '';
	// Elo kommt nach, die Namen stehen schon vorher da
	loadEloRatings();
	await nextTick();
	inputEl.value?.focus();
	if (isLoaded.value) return;
	[names.value, matchCounts.value] = await Promise.all([getAllPlayerNames(), getPlayerMatchCounts()]);
	isLoaded.value = true;
});

// Leere Suche: die aktivsten Spieler. Sonst: Treffer nach Anzahl Spiele, Namensanfang zuerst.
const results = computed(() => {
	const search = normalize(query.value);
	const counts = matchCounts.value;
	return names.value
		.filter(name => normalize(name).includes(search))
		.sort((name1, name2) =>
			Number(normalize(name2).startsWith(search)) - Number(normalize(name1).startsWith(search)) ||
			(counts[name2] ?? 0) - (counts[name1] ?? 0) ||
			name1.localeCompare(name2, 'de', { sensitivity: 'base' })
		)
		.slice(0, search ? MAX_RESULTS : MAX_SUGGESTIONS);
});

const clearQuery = () => {
	query.value = '';
	inputEl.value?.focus();
};

const openProfile = (name: string) => {
	closePlayerSearch();
	router.push(getPlayerProfilePath(name));
};

const openFirst = () => {
	if (normalize(query.value) && results.value[0]) openProfile(results.value[0]);
};
</script>

<style scoped>
.ps-title {
	font-size: 18px;
	font-weight: bold;
	color: var(--bp-text-strong);
}

.ps-input-wrap {
	display: flex;
	align-items: center;
	gap: 10px;
	height: 46px;
	margin: 0 1.25rem 12px;
	padding: 0 6px 0 14px;
	border: 1px solid var(--bp-border-strong);
	border-radius: 12px;
	background: var(--bp-surface);
}
.ps-input-wrap:focus-within {
	border-color: var(--bp-text-strong);
}
.ps-search-icon {
	color: var(--bp-text-subtle);
	font-size: 15px;
}
.ps-input {
	flex: 1;
	min-width: 0;
	height: 100%;
	padding: 0;
	border: none;
	outline: none;
	background: transparent;
	color: var(--bp-text-strong);
	font: inherit;
	font-size: 16px; /* iOS zoomt bei kleinerer Schrift ins Feld */
}
.ps-input::placeholder {
	color: var(--bp-text-faint);
}
.ps-input::-webkit-search-cancel-button {
	display: none;
}
.ps-clear {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	padding: 0;
	border: none;
	border-radius: 50%;
	background: none;
	color: var(--bp-text-subtle);
	cursor: pointer;
}
.ps-clear:hover {
	background: var(--bp-fill-soft);
}
.ps-clear .pi {
	font-size: 12px;
}

.ps-section-label {
	padding: 4px 20px 6px;
	color: var(--bp-text-subtle);
	font-size: 12px;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: .04em;
}

.ps-list {
	border-top: 1px solid var(--bp-border);
}
.ps-row {
	display: flex;
	align-items: center;
	gap: 12px;
	width: 100%;
	padding: 10px 20px;
	border: none;
	border-bottom: 1px solid var(--bp-border);
	background: var(--bp-surface);
	color: var(--bp-text-strong);
	font: inherit;
	text-align: left;
	cursor: pointer;
	transition: background .2s ease;
}
.ps-row:hover {
	background: var(--bp-surface-soft);
}
.ps-avatar {
	width: 34px !important;
	height: 34px !important;
	min-width: 34px;
	font-size: 13px !important;
}
.ps-name {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 15px;
	font-weight: 600;
}
.ps-count {
	white-space: nowrap;
	color: var(--bp-text-muted);
	font-size: 12px;
}
.ps-arrow {
	color: var(--bp-text-faint);
	font-size: 14px;
}

.ps-hint {
	padding: 24px 20px;
	color: var(--bp-text-muted);
	font-size: 14px;
	text-align: center;
}
</style>
