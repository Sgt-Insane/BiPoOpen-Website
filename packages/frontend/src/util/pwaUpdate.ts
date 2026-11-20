import { registerSW } from 'virtual:pwa-register';
import { loadStoredGame } from '@/components/frontend/biPoKnecht/knechtStorage';

// Updates der App (Service Worker, registerType 'autoUpdate' in vite.config.mts).
//
// Der Browser sucht von sich aus nur beim echten Seitenaufruf nach einem neuen Service Worker.
// Eine installierte PWA wird aber meist nur aus dem Hintergrund zurueckgeholt, dann passiert das nie.
// Deshalb pruefen wir selbst: beim Zurueckholen der App und regelmaessig, solange sie offen ist.
// Ist eine neue Version da, laedt der neue Service Worker sie, uebernimmt (skipWaiting/clientsClaim)
// und registerSW laedt die Seite einmal neu.

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
// Nicht bei jedem kurzen App-Wechsel erneut pruefen
const MIN_GAP_MS = 60 * 1000;

let lastCheck = 0;

// Waehrend eines laufenden Knecht-Spiels nicht neu laden (das Spiel wuerde zwar wiederhergestellt,
// aber ein Neuladen mitten im Wurf stoert). Nach dem Spiel holt die naechste Pruefung das Update.
const isInRunningGame = () => location.pathname.startsWith('/Knecht') && !!loadStoredGame();

const checkForUpdate = async (registration: ServiceWorkerRegistration) => {
	if (registration.installing || !navigator.onLine) return;
	if (Date.now() - lastCheck < MIN_GAP_MS || isInRunningGame()) return;
	lastCheck = Date.now();
	try {
		await registration.update();
	} catch {
		// Offline oder Server nicht erreichbar: naechster Versuch beim naechsten Anlass
	}
};

export const setupPwaUpdates = () => {
	registerSW({
		immediate: true,
		onRegisteredSW(_swUrl, registration) {
			if (!registration) return;
			lastCheck = Date.now();

			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') checkForUpdate(registration);
			});
			window.addEventListener('online', () => checkForUpdate(registration));
			setInterval(() => {
				if (document.visibilityState === 'visible') checkForUpdate(registration);
			}, CHECK_INTERVAL_MS);
		}
	});

	// Alter Tab nach einem Deploy: ein nachgeladener Seitenteil existiert nicht mehr -> einmal neu laden
	window.addEventListener('vite:preloadError', (event) => {
		const key = 'bipo_preload_reload';
		try {
			if (sessionStorage.getItem(key)) return;
			sessionStorage.setItem(key, '1');
		} catch {
			return;
		}
		event.preventDefault();
		location.reload();
	});
	window.addEventListener('load', () => {
		setTimeout(() => {
			try { sessionStorage.removeItem('bipo_preload_reload'); } catch { /* egal */ }
		}, 10000);
	});
};
