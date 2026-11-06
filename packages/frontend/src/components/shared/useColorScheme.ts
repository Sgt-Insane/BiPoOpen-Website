import { computed, ref, watchEffect } from 'vue';

export type ColorScheme = 'light' | 'dark';

// Muss zum Vorab-Skript in index.html passen (setzt die Klasse schon vor dem ersten Rendern)
const STORAGE_KEY = 'colorScheme';
const DARK_CLASS = 'bp-dark';

const readStoredScheme = (): ColorScheme | null => {
	try {
		const value = localStorage.getItem(STORAGE_KEY);
		return value === 'light' || value === 'dark' ? value : null;
	} catch {
		return null;
	}
};

// Ohne gespeicherte Wahl folgt die Seite dem System, auch wenn es sich zur Laufzeit umstellt
const systemQuery = window.matchMedia('(prefers-color-scheme: dark)');
const systemDark = ref(systemQuery.matches);
systemQuery.addEventListener('change', (e) => { systemDark.value = e.matches; });

const storedScheme = ref(readStoredScheme());
const isDark = computed(() => (storedScheme.value ?? (systemDark.value ? 'dark' : 'light')) === 'dark');

// Klasse fuer eigene Tokens und PrimeVue, data-bs-theme fuer Bootstrap, color-scheme fuer native Elemente
watchEffect(() => {
	const root = document.documentElement;
	root.classList.toggle(DARK_CLASS, isDark.value);
	root.dataset.bsTheme = isDark.value ? 'dark' : 'light';
	root.style.colorScheme = isDark.value ? 'dark' : 'light';
});

export const useColorScheme = () => {
	// Umschalten im Header: die Wahl bleibt gespeichert und hat dann Vorrang vor dem System
	const toggleColorScheme = () => {
		storedScheme.value = isDark.value ? 'light' : 'dark';
		try {
			localStorage.setItem(STORAGE_KEY, storedScheme.value);
		} catch {
			// z.B. privater Modus: gilt dann nur fuer diese Sitzung
		}
	};

	return { isDark, toggleColorScheme };
};
