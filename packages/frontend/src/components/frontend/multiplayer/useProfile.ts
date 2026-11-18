import { computed, ref } from 'vue';
import { getSeason, CURRENT_SEASON_SLUG } from '../league/LeagueSeasonsData';
import { getDeviceStorage } from '@/util/deviceStorage';

// Standard-Profil ohne Login: welcher Spieler auf diesem Handy spielt. Bleibt im Browser gespeichert.
// deviceId unterscheidet die Handys in der Anstoss-Lobby (zwei Handys koennen denselben Namen haben).

const NAME_KEY = 'bipo_profile_name';
const DEVICE_KEY = 'bipo_device_id';

// Demo-Modus spielt in mehreren Tabs gegeneinander: dort ist jeder Tab ein eigenes Handy (sessionStorage)
const getStorage = getDeviceStorage;

export const readSetting = (key: string) => {
    try { return getStorage().getItem(key); } catch { return null; }
};
export const writeSetting = (key: string, value: string | null) => {
    try {
        if (value === null) getStorage().removeItem(key);
        else getStorage().setItem(key, value);
    } catch { /* Speicher gesperrt: gilt nur bis zum Neuladen */ }
};
const read = readSetting;
const write = writeSetting;

const createDeviceId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const profileName = ref<string | null>(read(NAME_KEY));
let deviceId = read(DEVICE_KEY);
if (!deviceId) {
    deviceId = createDeviceId();
    write(DEVICE_KEY, deviceId);
}

const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

// Liga-Team des Spielers in der aktuellen Saison
export const getCurrentLeagueTeam = (playerName: string | null | undefined) => {
    if (!playerName) return null;
    const season = getSeason(CURRENT_SEASON_SLUG);
    for (const division of season?.divisions ?? []) {
        const team = division.teams.find(entry => normalize(entry.playerName) === normalize(playerName));
        if (team) return { ...team, league: division.league, divisionLabel: division.label, season: season!.slug };
    }
    return null;
};

export const useProfile = () => {
    const setProfileName = (name: string | null) => {
        const cleaned = name?.trim().replace(/\s+/g, ' ') || null;
        profileName.value = cleaned;
        write(NAME_KEY, cleaned);
    };

    return {
        profileName,
        deviceId: deviceId!,
        hasProfile: computed(() => !!profileName.value),
        leagueTeam: computed(() => getCurrentLeagueTeam(profileName.value)),
        setProfileName,
    };
};
