<template>
	<nav class="AppBottomNav">
		<template v-for="(item, index) in MAIN_NAV_ITEMS" :key="item.label">
			<!-- Plus zum Spiel eintragen in der Mitte -->
			<button v-if="index === ADD_BUTTON_INDEX" type="button" class="bn-item bn-add" @click="onAddClick()">
				<span class="bn-add-circle">
					<i class="pi pi-plus"></i>
					<!-- Laufendes BiPo-Knecht-Spiel -->
					<span v-if="runningGameTitle" class="bn-add-badge" aria-label="Laufendes Knecht-Spiel">🎯</span>
				</span>
				<span class="bn-label">Eintragen</span>
			</button>

			<component
				:is="item.to ? 'router-link' : 'button'"
				:to="item.to"
				:type="item.to ? undefined : 'button'"
				class="bn-item"
				:class="{ 'bn-item-active': isMainNavItemActive(item, route, tournamentPickerVisible) }"
				@click="onItemClick(item)"
			>
				<img :src="item.icon" alt="" class="bn-icon">
				<span class="bn-label">{{ item.label }}</span>
			</component>
		</template>
	</nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import { MAIN_NAV_ITEMS, MainNavItem, isMainNavItemActive } from './mainNav';
import { useTournamentPicker } from './useTournamentPicker';
import { useAddGame } from './GameEntry/useAddGame';
import { runningGameTitle } from '@/components/frontend/biPoKnecht/knechtStorage';

const ADD_BUTTON_INDEX = Math.floor(MAIN_NAV_ITEMS.length / 2);

const route = useRoute();
const { tournamentPickerVisible, openTournamentPicker, closeTournamentPicker } = useTournamentPicker();
const { openAddGame } = useAddGame();

const onItemClick = (item: MainNavItem) => {
	if (item.to)
		closeTournamentPicker();
	else
		openTournamentPicker();
};

const onAddClick = () => {
	closeTournamentPicker();
	openAddGame();
};
</script>

<style scoped>
.AppBottomNav {
	display: none;
}

@media (width <= 900px) {
	.AppBottomNav {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 99;
		display: flex;
		height: calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom));
		padding-bottom: env(safe-area-inset-bottom);
		background: var(--bp-surface);
		border-top: 1px solid var(--bp-border-strong);
		box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.12);
	}
}

.bn-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0;
	background: none;
	border: none;
	padding: 0;
	color: var(--bp-text-secondary);
	text-decoration: none;
	-webkit-tap-highlight-color: transparent;
}
.bn-icon {
	width: 38px;
	height: 38px;
	object-fit: contain;
	filter: grayscale(1) contrast(1.3) brightness(.85);
	opacity: .8;
	transition: filter .2s ease, opacity .2s ease;
}
.bn-label {
	font-size: 11px;
	line-height: 1.2;
	white-space: nowrap;
}
.bn-item-active {
	color: var(--main-color);
}
.bn-item-active .bn-icon {
	filter: grayscale(0) contrast(1) brightness(1);
	opacity: 1;
}

/* Plus: roter Kreis, ragt ueber die Leiste, Label auf Hoehe der anderen */
.bn-add {
	justify-content: flex-end;
	padding-bottom: 6px;
	color: var(--main-color);
	font-weight: 700;
}
.bn-add-circle {
	/* Nicht stauchen lassen: Kreis + Label sind hoeher als die Leiste */
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 40px;
	height: 40px;
	margin-bottom: 3px;
	border-radius: 50%;
	background: var(--main-color);
	color: white;
	box-shadow: 0 0 0 4px var(--bp-surface), 0 4px 12px rgba(234, 81, 96, 0.4);
	transition: transform .15s ease;
}
.bn-add:active .bn-add-circle {
	transform: scale(.94);
}
.bn-add-circle .pi {
	font-size: 16px;
	font-weight: 700;
}
.bn-add-circle {
	position: relative;
}
.bn-add-badge {
	position: absolute;
	top: -6px;
	right: -8px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: white;
	font-size: 12px;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}
</style>
