import { reactive } from 'vue';
import RELEASES from '@/releases.json';
import { isDemoMode } from '@/util/demoGames';

// Entwickler-Features: neue Funktionen sind schon auf der Live-Seite, aber erst sichtbar, wenn
// (a) ihre Version in releases.json veroeffentlicht ist (Eintrag ohne "draft": true) – dann fuer alle, oder
// (b) der Entwicklermodus auf diesem Geraet an ist und das Feature unter /Entwickler eingeschaltet wurde.
//
// Ablauf fuer ein neues Feature:
//   1. Hier eintragen mit der geplanten Version, im Code mit isFeatureOn('…') verstecken
//   2. Mergen: auf der Live-Seite nur im Entwicklermodus sichtbar (7× auf „Neuigkeiten“ tippen oder /Entwickler)
//   3. Freigeben: in releases.json beim Eintrag dieser Version "draft": true entfernen und mergen
//      -> Feature fuer alle sichtbar, die GitHub Action verschickt den Update-Push
//
// Versionsnummern MAJOR.MINOR.PATCH: grosses Update = erste Zahl, neues Feature = zweite, Bugfix/Optimierung = dritte.
// Vorschlag fuer die naechste Nummer aus den Commits seit der letzten Version: npm run version:next

export type Release = { version: string; date: string; title: string; notes: string[]; draft?: boolean };

export const FEATURES = {
    live: {
        title: 'Live-Ticker & zweites Handy',
        description: 'Knecht-Spiele live auf der Startseite verfolgen und mit zwei Handys zählen (Code oder Link).',
        release: '2.1.0',
    },
    shareOverlay: {
        title: 'Story-Overlay',
        description: 'Statistik eines Spiels als durchsichtiges Bild im Story-Format, zum Drüberlegen über ein eigenes Foto.',
        release: '2.1.0',
    },
} satisfies Record<string, { title: string; description: string; release: string }>;

export type FeatureKey = keyof typeof FEATURES;

const ALL_RELEASES = RELEASES as Release[];
export const publishedReleases = ALL_RELEASES.filter(release => !release.draft);
export const draftReleases = ALL_RELEASES.filter(release => release.draft);

export const isReleased = (key: FeatureKey) => publishedReleases.some(release => release.version === FEATURES[key].release);

// ─── Entwicklermodus (nur dieses Geraet) ───
const STORAGE_KEY = 'bipo_dev_features';
type DevState = { enabled: boolean; features: Partial<Record<FeatureKey, boolean>> };

const load = (): DevState => {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<DevState>;
        return { enabled: !!stored.enabled, features: stored.features ?? {} };
    } catch {
        // Dev-Server: Entwicklermodus von Anfang an an
        return { enabled: isDemoMode, features: {} };
    }
};

export const devState = reactive<DevState>(load());

const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(devState)); } catch { /* privater Modus */ }
};

export const setDevMode = (enabled: boolean) => {
    devState.enabled = enabled;
    save();
};

// Im Entwicklermodus sind unveroeffentlichte Features standardmaessig an, einzeln abschaltbar
export const isFeatureToggledOn = (key: FeatureKey) => devState.features[key] ?? true;

export const setFeature = (key: FeatureKey, on: boolean) => {
    devState.features[key] = on;
    save();
};

export const isFeatureOn = (key: FeatureKey) => isReleased(key) || (devState.enabled && isFeatureToggledOn(key));

// Update-Push genau so, wie ihn das Backend baut (packages/backend/src/controllers/Push.ts)
export const buildReleasePush = (release: Release) => ({
    title: `🎉 Update ${release.version}${release.title ? ` · ${release.title}` : ''}`,
    body: release.notes.slice(0, 3).join(' · ') || 'Neue Version der BiPo-Open-Seite',
    url: '/Neuigkeiten',
    tag: `release-${release.version}`,
});
