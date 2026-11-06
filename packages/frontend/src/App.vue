<script lang="ts" setup>
import AppHeader from '@/components/shared/AppHeader.vue';
import AppFooter from '@/components/shared/AppFooter.vue';
import AppBottomNav from '@/components/shared/AppBottomNav.vue';
import TournamentPickerDrawer from '@/components/shared/TournamentPickerDrawer.vue';
import AddGameDrawer from '@/components/shared/GameEntry/AddGameDrawer.vue';
import PlayerSearchDrawer from '@/components/shared/PlayerSearchDrawer.vue';
import Toast from 'primevue/toast';
import { Analytics } from '@vercel/analytics/vue';
import { SpeedInsights } from '@vercel/speed-insights/vue';

import { computed, onBeforeMount, provide } from 'vue'
import { useRoute } from 'vue-router';
import router from './router.js';
import axios from "axios";
import { getPlayerProfilePath } from '@/util/util';

// Spielerprofil ist eine eigene Seite, ueberall per inject('openPlayerProfile') erreichbar
const openPlayerProfile = (name: string) => {
	router.push(getPlayerProfilePath(name));
};

provide('openPlayerProfile', openPlayerProfile);

// Detailseiten (z.B. Benachrichtigungen) haben mobil keinen App-Header, nur ihren Zurueck-Pfeil
const route = useRoute();
const isDetailPage = computed(() => route.meta.detailPage === true);

onBeforeMount(async() => {
	// Configure Axios
	axios.defaults.baseURL = "https://bipoopen-backend.vercel.app/";
	// axios.defaults.baseURL = "http://localhost:8080";

	// Redirect		
	let path = localStorage.getItem('path');
	if(path){
		localStorage.removeItem('path');
		router.push(path);
	}
})
</script>

<template>
	<Toast position="bottom-right">
		<template #container="{ message, closeCallback }">
			<div class="app-toast" :class="`app-toast--${message.severity ?? 'info'}`">
				<span class="app-toast-icon">
					<i v-if="message.severity === 'success'" class="pi pi-check"></i>
					<i v-else-if="!message.severity || message.severity === 'info'" class="pi pi-info"></i>
					<template v-else>!</template>
				</span>
				<div class="app-toast-text">
					<div class="app-toast-summary">{{ message.summary }}</div>
					<div v-if="message.detail" class="app-toast-detail">{{ message.detail }}</div>
					<!-- Optionaler Link im Toast: toast.add({ ..., action: { label, to } }) -->
					<button
						v-if="message.action"
						type="button"
						class="app-toast-action"
						@click="closeCallback(); router.push(message.action.to)"
					>{{ message.action.label }}</button>
				</div>
				<!-- Restlaufzeit, schrumpft ueber die Lebensdauer des Toasts -->
				<span v-if="message.life" class="app-toast-progress" :style="{ animationDuration: `${message.life}ms` }"></span>
			</div>
		</template>
	</Toast>
	<Analytics/>
	<SpeedInsights/>

	<!-- App header -->
	<AppHeader :class="{ 'AppHeader--hidden-mobile': isDetailPage }"/>

	<div class="Page" :class="{ 'Page--detail': isDetailPage }">
		<router-view v-slot="{ Component }" :key="$route.fullPath">
			<transition name="fade-page" mode="out-in">
				<component :is="Component"/>
			</transition>
		</router-view>
	</div>

	<!-- App footer -->
	<AppFooter/>

	<!-- Mobile bottom navigation + tournament picker + "Spiel eintragen" (Plus in der Navigation) -->
	<AppBottomNav/>
	<TournamentPickerDrawer/>
	<AddGameDrawer/>
	<!-- Spielersuche (Lupe im Header) -->
	<PlayerSearchDrawer/>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Overpass:wght@100&display=swap');
@import "tailwindcss";

:root {
  --main-color: #EA5160;
  --secondary-color: #61C3D9;
  --secondary-color-weak: #d3f7ff;
  --main-color-hover: rgb(241, 200, 200);
  --loose-gray: rgb(209, 209, 209);
  --page-gray: #F6F7F9;
  --app-header-height: 72px;
  --app-bottom-nav-height: 64px;

  /* Farb-Tokens, im Dark Mode (html.bp-dark, siehe useColorScheme) ueberschrieben */
  --bp-bg: #ffffff;
  --bp-surface: #ffffff;
  --bp-surface-soft: #FAFBFC;
  --bp-fill-soft: #F4F5F7;
  --bp-fill: #EEF0F2;
  --bp-fill-strong: #E4E6E9;
  --bp-border: #ECEEF1;
  --bp-border-strong: #DCDFE4;
  --bp-text-strong: #1D1F23;
  --bp-text: #3B4048;
  --bp-text-secondary: #555B63;
  --bp-text-muted: #6B717B;
  --bp-text-subtle: #8A9099;
  --bp-text-faint: #A0A5AD;
  /* Dunkle Flaeche mit heller Schrift, im Dark Mode umgekehrt */
  --bp-inverse-bg: #1D1F23;
  --bp-inverse-text: #ffffff;
  --bp-primary-weak: #FDE6E8;
  --bp-primary-faint: #FEF2F3;
  /* Text in Akzentfarbe (im Dark Mode heller) und passende zarte Hintergruende */
  --bp-primary-text: #B42236;
  --bp-secondary-text: #1F7F95;
  --bp-success: #1F9D55;
  --bp-success-strong: #1F7A43;
  --bp-success-weak: #E6F5EA;
  --bp-danger: #D64545;
  --bp-danger-strong: #B3323C;
  --bp-danger-weak: #FBE7E8;
  --bp-gold: #8A6400;
  --bp-gold-icon: #C48A0E;
  --bp-gold-weak: #FDF3DC;
  --bp-gold-faint: #FFFCF0;
  --bp-gold-border: #F3DD9B;
  --bp-gold-card: linear-gradient(135deg, #FFF6DC 0%, #FDEEC2 100%);
  --bp-info: #2F6FE4;
  --bp-info-weak: #E8F0FE;
  --bp-navy: #1E3A6B;
  --bp-navy-weak: #EAF0F8;
  --bp-violet: #5B3CC4;
  --bp-violet-weak: #EDE8FB;
  --bp-warn-text: #5F5636;
  --bp-warn-weak: #FDF6E3;
}

html.bp-dark {
  /* Bootstrap-Grundfarben (data-bs-theme="dark") an die eigenen Tokens angleichen */
  --bs-body-bg: var(--bp-bg);
  --bs-body-color: var(--bp-text-strong);
  --bs-border-color: var(--bp-border);

  --main-color-hover: rgba(234, 81, 96, 0.35);
  --secondary-color-weak: rgba(97, 195, 217, 0.18);
  --loose-gray: #3A3F46;
  --page-gray: #121417;

  --bp-bg: #121417;
  --bp-surface: #1B1E22;
  --bp-surface-soft: #1F2226;
  --bp-fill-soft: #22252A;
  --bp-fill: #282C32;
  --bp-fill-strong: #31353C;
  --bp-border: #2A2E34;
  --bp-border-strong: #3A3F46;
  --bp-text-strong: #ECEEF1;
  --bp-text: #C9CDD3;
  --bp-text-secondary: #ADB2BA;
  --bp-text-muted: #979DA6;
  --bp-text-subtle: #858B94;
  --bp-text-faint: #6E747D;
  --bp-inverse-bg: #ECEEF1;
  --bp-inverse-text: #1D1F23;
  --bp-primary-weak: rgba(234, 81, 96, 0.18);
  --bp-primary-faint: rgba(234, 81, 96, 0.1);
  --bp-primary-text: #F37A88;
  --bp-secondary-text: #6FCFE3;
  --bp-success: #3DBE76;
  --bp-success-strong: #5ED394;
  --bp-success-weak: rgba(61, 190, 118, 0.16);
  --bp-danger: #EF6B6B;
  --bp-danger-strong: #F28B8B;
  --bp-danger-weak: rgba(239, 107, 107, 0.16);
  --bp-gold: #E2B93B;
  --bp-gold-icon: #E2B93B;
  --bp-gold-weak: rgba(226, 185, 59, 0.14);
  --bp-gold-faint: rgba(226, 185, 59, 0.06);
  --bp-gold-border: rgba(226, 185, 59, 0.35);
  --bp-gold-card: linear-gradient(135deg, rgba(226, 185, 59, 0.16) 0%, rgba(226, 185, 59, 0.08) 100%);
  --bp-info: #7FA8F5;
  --bp-info-weak: rgba(127, 168, 245, 0.16);
  --bp-navy: #A9C2EE;
  --bp-navy-weak: rgba(127, 168, 245, 0.14);
  --bp-violet: #A48DF0;
  --bp-violet-weak: rgba(164, 141, 240, 0.16);
  --bp-warn-text: #D9CFA8;
  --bp-warn-weak: rgba(226, 185, 59, 0.12);
}

body{
	background: var(--bp-bg);
	font-family: Overpass, Helvetica, Arial, sans-serif;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	scrollbar-width: none;
	margin: 0;
}

.Page{
	margin: auto;
	margin-top: calc(var(--app-header-height) + 51px);
	padding-bottom: 50px;
	min-height: calc(100dvh - var(--app-header-height) - 47px - 80px);
	width: 90%;
}
/* Gesetzt ueber useGrayPage */
html.bp-gray-page body{
	background: var(--page-gray);
}
/* Weisses Band bis an den Bildschirmrand (z.B. Reiter-Leiste auf grauen Seiten) */
.bp-white-band{
	background: var(--bp-surface);
	box-shadow: 0 0 0 100vmax var(--bp-surface);
	clip-path: inset(0 -100vmax);
}
/* Zusaetzlich nach oben bis unter den App-Header (Seitentitel) */
.bp-white-band--top{
	clip-path: inset(-100vmax -100vmax 0);
}
.bp-button{
	padding: 20px;
	background: var(--main-color);
	cursor: pointer;
	color: white;
	text-align: center;
	margin-bottom: 50px;
	transition: .3s background ease;
	text-decoration: none;
}
.bp-button:hover{
	background: var(--main-color-hover);
	color: white;
}
.bp-title{
	margin: 0;
	padding: 10px 0 16px;
	color: var(--main-color);
	font-size: 36px;
	font-weight: 700;
	line-height: 1.15;
	text-align: left;
}

/* Lade-Skelett: grauer Platzhalter mit Schimmer, Groesse setzt der Aufrufer */
.bp-skeleton{
	border-radius: 16px;
	background: linear-gradient(90deg, var(--bp-fill) 0%, var(--bp-fill-soft) 50%, var(--bp-fill) 100%);
	background-size: 200% 100%;
	animation: bp-shimmer 1.2s ease-in-out infinite;
}
/* Platzhalter fuer ein MatchElement */
.bp-skeleton-match{
	height: 96px;
	margin-bottom: 8px;
	border-radius: 12px;
}
@keyframes bp-shimmer {
	from { background-position: 100% 0; }
	to { background-position: -100% 0; }
}

/* Transition Animations */
.fade-page-enter-active {
	animation: coming 0.4s;
	animation-delay: 0.2s;
	opacity: 0;
}
.fade-page-leave-active {
	animation: going 0.4s;
}
@keyframes going {
	from {
		transform: translateX(0);
	}
	to {
		transform: translateX(-10px);
		opacity: 0;
	}
}
@keyframes coming {
	from {
		transform: translateX(-10px);
		opacity: 0;
	}
	to {
		transform: translateX(0px);
		opacity: 1;
	}
}

/* Fade Transition */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
@media (width <= 900px){
	:root{
		--app-header-height: 54px;
	}
	body{
		padding-bottom: calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom));
	}
	.Page{
		margin-top: calc(var(--app-header-height) + 1px);
		width: 95%;
		padding-bottom: 30px;
		min-height: calc(100dvh - var(--app-header-height) + 4px - 80px - var(--app-bottom-nav-height));
	}
	.bp-title{
		font-size: 28px;
		padding: 12px 0 14px;
	}
	.AppHeader.AppHeader--hidden-mobile{
		display: none;
	}
	.Page.Page--detail{
		margin-top: 0;
	}
}

/*MOBILE S*/
@media (width <= 360px){
    .bp-title{
		font-size: 22px !important;
	}
}

.p-toast .p-toast-message-enter-active, .p-toast .p-toast-message-leave-active {
	transition: transform 0.3s ease, opacity 0.3s ease !important;
	animation: none !important;
}
.p-toast .p-toast-message-enter-from , .p-toast .p-toast-message-leave-to {
  	opacity: 0;
	transform: translateX(80%)
}

/* Toast: eigenes Layout im #container-Slot, PrimeVue-Rahmen neutralisiert */
.p-toast .p-toast-message {
	margin-bottom: 8px;
	border: none;
	border-radius: 14px;
	background: transparent;
	box-shadow: none;
	backdrop-filter: none;
}
.app-toast {
	--toast-accent: #6B7079;
	position: relative;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 14px 16px 16px;
	overflow: hidden;
	border-radius: 14px;
	border: 1px solid var(--bp-border);
	background: var(--bp-surface);
	box-shadow: 0 10px 30px rgba(15, 18, 22, .18), 0 2px 6px rgba(15, 18, 22, .08);
	color: var(--bp-text-strong);
}
.app-toast--success { --toast-accent: #2EA45F; }
.app-toast--error { --toast-accent: #E5484D; }
.app-toast--warn { --toast-accent: #E8A13A; }
.app-toast-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	min-width: 28px;
	border-radius: 50%;
	background: var(--toast-accent);
	color: white;
	font-size: 15px;
	font-weight: 800;
}
.app-toast-icon .pi {
	font-size: 13px;
	font-weight: 800;
}
.app-toast-text {
	flex: 1;
	min-width: 0;
}
/* Kein Abschneiden: Teamnamen muessen immer komplett lesbar sein */
.app-toast-summary {
	font-size: 15px;
	font-weight: 700;
	line-height: 1.3;
	overflow-wrap: anywhere;
}
.app-toast-detail {
	margin-top: 2px;
	color: var(--bp-text-muted);
	font-size: 13px;
	line-height: 1.3;
}
.app-toast-action {
	margin-top: 6px;
	padding: 0;
	border: none;
	background: none;
	color: var(--main-color);
	font-size: 13px;
	font-weight: 700;
}
.app-toast-progress {
	position: absolute;
	left: 0;
	bottom: 0;
	width: 100%;
	height: 3px;
	background: var(--toast-accent);
	transform-origin: left;
	animation: toast-progress linear forwards;
}
/* PrimeVue haelt den Timer beim Hovern an, der Balken auch */
.p-toast-message:hover .app-toast-progress {
	animation-play-state: paused;
}
@keyframes toast-progress {
	from { transform: scaleX(1); }
	to { transform: scaleX(0); }
}

/* Toast mobile */
@media (width <= 900px){
	.p-toast.p-toast-bottom-right {
		right: 0;
		bottom: calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom));
		left: 0;
		width: 100%;
		padding: 10px;
	}
}
</style>