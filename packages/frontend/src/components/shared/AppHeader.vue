<script setup lang="ts">
import { useRoute } from 'vue-router';
import router from '@/router.js';
import { MAIN_NAV_ITEMS, MainNavItem, isMainNavItemActive } from './mainNav';
import { useTournamentPicker } from './useTournamentPicker';
import { usePwaInstall } from './usePwaInstall';
import { useAddGame } from './GameEntry/useAddGame';
import { usePlayerSearch } from './usePlayerSearch';
import { PUSH_SETTINGS_PATH, usePushNotifications } from './usePushNotifications';
import BellIcon from './BellIcon.vue';

const route = useRoute();
const { tournamentPickerVisible, openTournamentPicker } = useTournamentPicker();
const { openAddGame } = useAddGame();
const { openPlayerSearch } = usePlayerSearch();
const { canInstall, isInstalled, installPwa } = usePwaInstall();
const { isActive: isPushActive } = usePushNotifications();

const scrollToTop = () => {
	if((router as any).path == "/"){
		document.getElementsByTagName("html")[0].style.scrollBehavior = "smooth";
		setTimeout(() => { window.scrollTo(0, 0); }, 0);
		setTimeout(() => { document.getElementsByTagName("html")[0].style.scrollBehavior = ""; }, 1000);
	}
}

const onNavClick = (item: MainNavItem) => {
	if(item.to)
		router.push(item.to);
	else
		openTournamentPicker();
}

let logo = new URL(`/src/assets/Logo_Website.svg`, import.meta.url).href;
</script>

<template>
	<div class="AppHeader">

		<div class="ap-header">
			<div class="ap-logo">
				<router-link to="/" @click="scrollToTop()">
					<img :src="logo" alt="">
				</router-link>
			</div>

			<!-- Desktop navigation (mobile uses AppBottomNav) -->
			<nav class="ap-nav">
				<button
					v-for="item in MAIN_NAV_ITEMS"
					:key="item.label"
					type="button"
					class="ap-nav-item"
					:class="{ 'ap-nav-item-active': isMainNavItemActive(item, route, tournamentPickerVisible) }"
					@click="onNavClick(item)"
				>
					<img :src="item.icon" alt="" class="ap-nav-icon">
					{{ item.label }}
				</button>
			</nav>

			<!-- Spiel eintragen (mobil: Plus in AppBottomNav) -->
			<button type="button" class="ap-add-btn" @click="openAddGame()">
				<i class="pi pi-plus ap-add-icon"></i>
				Spiel eintragen
			</button>

			<div class="ap-actions">
				<!-- PWA install -->
				<button
					v-if="canInstall && !isInstalled"
					type="button"
					class="ap-install-btn"
					@click="installPwa"
				>
					<i class="pi pi-download ap-install-icon"></i>
					App
				</button>

				<!-- Benachrichtigungen: Kontur = aus, gefuellt = aktiv.
				     Spaeter: roter Punkt bei Neuem und Liste der letzten Pushes, bis dahin direkt die Einstellungen -->
				<router-link
					:to="PUSH_SETTINGS_PATH"
					class="ap-round-btn"
					:class="{ 'ap-round-btn--active': route.path === PUSH_SETTINGS_PATH }"
					:aria-label="isPushActive ? 'Benachrichtigungen (aktiv)' : 'Benachrichtigungen'"
				>
					<BellIcon :filled="isPushActive"/>
				</router-link>

				<!-- Spielersuche -->
				<button type="button" class="ap-round-btn" aria-label="Spieler suchen" @click="openPlayerSearch()">
					<i class="pi pi-search"></i>
				</button>
			</div>
		</div>

	</div>
</template>

<style scoped>
.AppHeader{
	width: 100%;
	height: var(--app-header-height);
	z-index: 99;
	position: fixed;
	top: 0px;
	filter: drop-shadow(0px 0px 100px rgba(255, 255, 255, 0.295));
	padding: 0 5%;
	background: white;
	display: flex;
	align-items: center;
}

.ap-header{
	width: 100%;
	display: flex;
	align-items: center;
}

/* LOGO + NAME */
.ap-logo a{
	display: flex;
	justify-content: center;
	align-items: center;
}
.ap-logo img{
	width: 210px;
	height: 33px;
}

/* NAV (Desktop) */
.ap-nav{
	margin-left: auto;
	display: flex;
	gap: 6px;
}
.ap-nav-item{
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 14px;
	border: none;
	border-radius: 999px;
	background: transparent;
	color: #444;
	font-weight: 600;
	font-size: 15px;
	transition: .2s background ease, .2s color ease;
}
.ap-nav-item:hover{
	background: #f5f5f5;
}
.ap-nav-item-active,
.ap-nav-item-active:hover{
	color: var(--main-color);
	background: transparent;
}
.ap-nav-icon{
	width: 32px;
	height: 32px;
	object-fit: contain;
	filter: grayscale(1) contrast(1.3) brightness(.85);
	opacity: .8;
	transition: .2s filter ease, .2s opacity ease;
}
.ap-nav-item-active .ap-nav-icon{
	filter: grayscale(0) contrast(1) brightness(1);
	opacity: 1;
}

/* SPIEL EINTRAGEN (Desktop) */
.ap-add-btn{
	display: flex;
	align-items: center;
	gap: 6px;
	margin-left: 12px;
	padding: 9px 16px;
	border: none;
	border-radius: 999px;
	background: var(--main-color);
	color: white;
	font-weight: 700;
	font-size: 14px;
	line-height: 1;
	white-space: nowrap;
	transition: .2s background ease;
}
.ap-add-btn:hover{
	background: #d4434f;
}
.ap-add-icon{
	font-size: 12px;
	font-weight: 700;
}

/* PWA INSTALL + SPIELERSUCHE */
.ap-actions{
	display: flex;
	align-items: center;
	gap: 8px;
	margin-left: 12px;
}

.ap-install-btn{
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 7px 14px;
	border: none;
	border-radius: 999px;
	background: var(--main-color);
	color: white;
	font-weight: 700;
	font-size: 14px;
	line-height: 1;
	transition: .2s background ease;
}
.ap-install-btn:hover{
	background: #d4434f;
}
.ap-install-icon{
	font-size: 13px;
	font-weight: 700;
}

.ap-round-btn{
	display: flex;
	align-items: center;
	justify-content: center;
	width: 38px;
	height: 38px;
	padding: 0;
	border: none;
	border-radius: 50%;
	background: #f1f2f4;
	color: #222;
	transition: .2s background ease;
}
.ap-round-btn:hover{
	background: #e4e6e9;
	color: #222;
}
.ap-round-btn .pi{
	font-size: 15px;
	font-weight: 700;
}
.ap-round-btn .BellIcon{
	font-size: 18px;
}
.ap-round-btn--active{
	color: var(--main-color);
}

/*MOBILE*/
@media (width <= 900px){
	.AppHeader{
		padding: 0 2.5%;
	}
	.ap-logo img{
		width: 150px;
		height: 25px;
	}
	.ap-nav,
	.ap-add-btn{
		display: none;
	}
	.ap-actions{
		margin-left: auto;
	}
	.ap-install-btn{
		padding: 6px 12px;
		font-size: 13px;
	}
	.ap-round-btn{
		width: 34px;
		height: 34px;
	}
	.ap-round-btn .pi{
		font-size: 14px;
	}
	.ap-round-btn .BellIcon{
		font-size: 17px;
	}
}
</style>
