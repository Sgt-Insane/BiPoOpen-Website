// Push-Handler, per workbox.importScripts in den generierten Service Worker eingebunden (vite.config.mts).
// Payload kommt aus packages/backend/src/util/notify.ts: { title, body, url, tag?, actions?: [{ action, title, url }] }

// Zahl auf dem App-Icon = angezeigte, noch nicht weggetippte Pushes
const updateAppBadge = async () => {
	if (!self.navigator.setAppBadge) return;
	const notifications = await self.registration.getNotifications();
	if (notifications.length) await self.navigator.setAppBadge(notifications.length);
	else await self.navigator.clearAppBadge();
};

self.addEventListener('push', (event) => {
	let payload = {};
	try {
		payload = event.data ? event.data.json() : {};
	} catch {
		payload = { body: event.data ? event.data.text() : '' };
	}

	const actions = (payload.actions || []).slice(0, 2);

	event.waitUntil((async () => {
		await self.registration.showNotification(payload.title || 'Weck BiPo Open', {
			body: payload.body || '',
			icon: payload.icon || '/pwa-icon-192.png',
			// Statusleiste (Android): nur der Alphakanal zaehlt, daher einfarbiger Becher
			badge: '/push-badge.png',
			image: payload.image,
			// Gleiches Spiel (z.B. Korrektur) ersetzt die alte Benachrichtigung statt zu stapeln
			tag: payload.tag,
			renotify: !!payload.tag,
			actions: actions.map(({ action, title }) => ({ action, title })),
			data: {
				url: payload.url || '/',
				actionUrls: Object.fromEntries(actions.map(({ action, url }) => [action, url]))
			}
		});
		await updateAppBadge();
	})());
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const data = event.notification.data || {};
	const path = (event.action && data.actionUrls && data.actionUrls[event.action]) || data.url || '/';

	event.waitUntil((async () => {
		await updateAppBadge();

		// Offene App: per Router navigieren (kein Neuladen), sonst neues Fenster
		const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
		const client = windowClients.find((windowClient) => new URL(windowClient.url).origin === self.location.origin);
		if (client) {
			client.postMessage({ type: 'push-navigate', url: path });
			return client.focus();
		}
		return self.clients.openWindow(path);
	})());
});

self.addEventListener('notificationclose', (event) => {
	event.waitUntil(updateAppBadge());
});
