import { computed, reactive, ref } from 'vue';
import axios from 'axios';
import router from '@/router.js';
import { getAllPlayerNames } from '@/components/frontend/playerProfile/PlayerProfileUtilFunctions';

// Push-Benachrichtigungen, geteilt ueber alle Komponenten (Glocke, Einstellungsseite, Folgen-Button).
// Backend: packages/backend/src/controllers/Push.ts, Anzeige im Service Worker: public/push-sw.js

export type PushCategory = 'openGames' | 'leagueGames' | 'tournamentResults' | 'registrations';
export type PushFollowMode = 'all' | 'followed';

// unsupported: Browser kann kein Push; iosInstall: iPhone im Safari-Tab (Push nur als installierte App);
// denied: im Browser blockiert, fragt nie wieder; inactive: noch nicht aktiviert
export type PushStatus = 'loading' | 'unsupported' | 'iosInstall' | 'denied' | 'inactive' | 'active';

export const PUSH_SETTINGS_PATH = '/Benachrichtigungen';

const DEFAULT_PREFERENCES: Record<PushCategory, boolean> = {
	openGames: true,
	leagueGames: true,
	tournamentResults: true,
	registrations: false,
};

const status = ref<PushStatus>('loading');
const preferences = reactive({ ...DEFAULT_PREFERENCES });
const followMode = ref<PushFollowMode>('all');
// Anzeigenamen; das Backend speichert lowercase
const followedPlayers = ref<string[]>([]);
const settingsLoaded = ref(false);

let subscription: PushSubscription | null = null;
let initialized = false;
let settingsRequest: Promise<void> | null = null;

const isIos = () => /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// navigator.serviceWorker.ready loest nie auf, wenn kein Service Worker registriert ist
const getRegistration = () => Promise.race([
	navigator.serviceWorker.ready,
	new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Kein Service Worker')), 10000)),
]);

const urlBase64ToUint8Array = (base64: string) => {
	const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
	return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
};

const normalize = (name: string) => name.trim().toLowerCase();

// lowercase aus dem Backend -> Schreibweise aus den Spielen
const resolvePlayerNames = async (names: string[]) => {
	const allNames = await getAllPlayerNames().catch(() => [] as string[]);
	const byNormalized = new Map(allNames.map(name => [normalize(name), name]));
	return names.map(name => byNormalized.get(normalize(name))
		?? name.replace(/(^|[\s-])(\p{L})/gu, (_, separator, letter) => separator + letter.toUpperCase()));
};

const applySettings = async (data: { preferences?: Partial<Record<PushCategory, boolean>>, followMode?: PushFollowMode, followedPlayers?: string[] }) => {
	Object.assign(preferences, DEFAULT_PREFERENCES, data.preferences);
	followMode.value = data.followMode ?? 'all';
	followedPlayers.value = await resolvePlayerNames(data.followedPlayers ?? []);
	settingsLoaded.value = true;
};

const settingsBody = () => ({
	preferences: { ...preferences },
	followMode: followMode.value,
	followedPlayers: followedPlayers.value,
});

const saveToBackend = (pushSubscription: PushSubscription) =>
	axios.post('push/subscribe', { subscription: pushSubscription.toJSON(), ...settingsBody() });

const init = async () => {
	if (initialized) return;
	initialized = true;

	// Zahl auf dem App-Icon gilt als gelesen, sobald die App offen ist
	const clearBadge = () => { if (document.visibilityState === 'visible') (navigator as any).clearAppBadge?.().catch(() => {}); };
	clearBadge();
	document.addEventListener('visibilitychange', clearBadge);

	if (!isSupported()) {
		status.value = isIos() && !isStandalone() ? 'iosInstall' : 'unsupported';
		return;
	}

	// Tipp auf eine Benachrichtigung bei offener App: push-sw.js schickt das Ziel
	navigator.serviceWorker.addEventListener('message', (event) => {
		if (event.data?.type === 'push-navigate' && typeof event.data.url === 'string')
			router.push(event.data.url);
	});

	if (Notification.permission === 'denied') {
		status.value = 'denied';
		return;
	}

	try {
		const registration = await getRegistration();
		subscription = await registration.pushManager.getSubscription();
	} catch {
		status.value = 'unsupported';
		return;
	}

	status.value = subscription && Notification.permission === 'granted' ? 'active' : 'inactive';
};

// Einstellungen erst laden, wenn sie gebraucht werden (Seite, Folgen-Button)
const loadSettings = () => {
	if (settingsRequest) return settingsRequest;
	settingsRequest = (async () => {
		await init();
		if (status.value !== 'active' || !subscription) return;
		try {
			const { data } = await axios.post('push/status', { endpoint: subscription.endpoint });
			await applySettings(data);
		} catch (error: any) {
			// Backend hat die Subscription verworfen (z.B. abgelaufen): mit Standardwerten neu anlegen
			if (error?.response?.status === 404) {
				const { data } = await saveToBackend(subscription);
				await applySettings(data);
			}
		}
	})().finally(() => { settingsRequest = null; });
	return settingsRequest;
};

/**
 * Fragt den Browser nach der Erlaubnis und meldet das Geraet an.
 * Nur aus einem Klick heraus aufrufen: requestPermission braucht die Nutzergeste (iOS).
 * options: Spieler, denen direkt gefolgt wird (z.B. vom Spielerprofil), Kategorie, die an sein soll.
 */
const activate = async (options: { follow?: string[], category?: PushCategory } = {}) => {
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') {
		status.value = permission === 'denied' ? 'denied' : 'inactive';
		return false;
	}

	const { data } = await axios.get('push/vapidPublicKey');
	if (!data.publicKey) throw new Error('VAPID_PUBLIC_KEY fehlt im Backend');

	const registration = await getRegistration();
	const applicationServerKey = urlBase64ToUint8Array(data.publicKey);
	try {
		subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
	} catch (error) {
		// Alte Subscription mit anderem VAPID-Key blockiert die neue
		const existing = await registration.pushManager.getSubscription();
		if (!existing) throw error;
		await existing.unsubscribe();
		subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
	}

	if (options.category) preferences[options.category] = true;
	if (options.follow?.length) {
		followMode.value = 'followed';
		followedPlayers.value = [...new Set([...followedPlayers.value, ...options.follow])];
	}

	const response = await saveToBackend(subscription);
	await applySettings(response.data);
	status.value = 'active';
	return true;
};

const deactivate = async () => {
	if (subscription) {
		const endpoint = subscription.endpoint;
		await subscription.unsubscribe().catch(() => {});
		await axios.post('push/unsubscribe', { endpoint }).catch(() => {});
	}
	subscription = null;
	Object.assign(preferences, DEFAULT_PREFERENCES);
	followMode.value = 'all';
	followedPlayers.value = [];
	settingsLoaded.value = false;
	status.value = 'inactive';
};

// Optimistisch: UI ist schon umgestellt, bei Fehler wird neu geladen
const saveSettings = async () => {
	if (!subscription) return false;
	try {
		await axios.patch('push/preferences', { endpoint: subscription.endpoint, ...settingsBody() });
		return true;
	} catch {
		await loadSettings();
		return false;
	}
};

const setPreference = (category: PushCategory, enabled: boolean) => {
	preferences[category] = enabled;
	return saveSettings();
};

const setFollowMode = (mode: PushFollowMode) => {
	followMode.value = mode;
	return saveSettings();
};

const isFollowing = (name: string) => followedPlayers.value.some(entry => normalize(entry) === normalize(name));

const followPlayer = (name: string) => {
	if (!isFollowing(name)) followedPlayers.value = [...followedPlayers.value, name.trim()];
	return saveSettings();
};

const unfollowPlayer = (name: string) => {
	followedPlayers.value = followedPlayers.value.filter(entry => normalize(entry) !== normalize(name));
	return saveSettings();
};

const sendTest = async () => {
	if (!subscription) return false;
	try {
		await axios.post('push/test', { endpoint: subscription.endpoint });
		return true;
	} catch {
		return false;
	}
};

export const usePushNotifications = () => {
	init();
	return {
		status,
		isActive: computed(() => status.value === 'active'),
		preferences,
		followMode,
		followedPlayers,
		settingsLoaded,
		loadSettings,
		activate,
		deactivate,
		setPreference,
		setFollowMode,
		isFollowing,
		followPlayer,
		unfollowPlayer,
		sendTest,
	};
};
