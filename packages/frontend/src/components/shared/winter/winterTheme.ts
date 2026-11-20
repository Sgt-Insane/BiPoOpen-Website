import './winter.css';

// Winter-Theme (Lichterkette, Schnee, Weihnachtsmuetzen, Schneedecke auf der Bottom-Nav)
// laeuft automatisch vom 15.11. bis zum 6.1. (Heilige Drei Koenige).
// Zum Testen ausserhalb der Saison: ?winter=1 an die URL haengen, ?winter=0 schaltet es ab (bleibt gespeichert).
const STORAGE_KEY = 'winterTheme';
const WINTER_CLASS = 'bp-winter';

export const isWinterSeason = (date = new Date()) => {
	const month = date.getMonth();
	const day = date.getDate();
	return (month === 10 && day >= 15) || month === 11 || (month === 0 && day <= 6);
};

const readOverride = (): boolean | null => {
	try {
		const param = new URLSearchParams(window.location.search).get('winter');
		if (param === '1' || param === '0')
			localStorage.setItem(STORAGE_KEY, param);
		const value = localStorage.getItem(STORAGE_KEY);
		return value === '1' ? true : value === '0' ? false : null;
	} catch {
		return null;
	}
};

export const winterThemeActive = readOverride() ?? isWinterSeason();

// Schnee und Funkeln nur, wenn das System keine reduzierten Bewegungen wuenscht
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.documentElement.classList.toggle(WINTER_CLASS, winterThemeActive);
