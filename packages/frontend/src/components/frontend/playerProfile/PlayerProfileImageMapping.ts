import { LEAGUE_PLAYER_DATA } from '@/components/frontend/league/LeaguePlayersData';
import axios from 'axios';
import { reactive } from 'vue';

// Profilbilder als echte Bild-URLs. Eine kleine Liste (/playerImages/list) sagt, wer ein Bild hat und
// von wann es ist. Die URL traegt diesen Stand (?v=), so darf der Browser jedes Bild dauerhaft cachen und
// ein neues Bild hat automatisch eine neue URL.

type PlayerImageEntry = { playerName: string; updatedAt: number };

// Danach wird die Liste beim naechsten Zugriff neu geladen (neue Bilder anderer Geraete)
const MAX_AGE_MS = 5 * 60 * 1000;
// Liste nicht ladbar (z.B. offline): nicht bei jedem Avatar erneut versuchen
const RETRY_AFTER_ERROR_MS = 30 * 1000;

// normalisierter Name -> Bild-URL, reaktiv: Avatare zeigen das Bild, sobald die Liste da ist
export const playerImageUrls = reactive<Record<string, string>>({});
let nextLoadAt = 0;
let request: Promise<void> | null = null;
let requestId = 0;

const buildImageUrl = ({ playerName, updatedAt }: PlayerImageEntry) => {
    const base = (axios.defaults.baseURL ?? '').replace(/\/+$/, '');
    return `${base}/playerImages/raw/${encodeURIComponent(playerName)}?v=${updatedAt}`;
};

const loadImageList = (force = false): Promise<void> => {
    if (!force && Date.now() < nextLoadAt) return Promise.resolve();
    if (!force && request) return request;

    // Nur die zuletzt gestartete Anfrage zaehlt (z.B. Neuladen nach Upload, waehrend noch eine aeltere laeuft).
    // nextLoadAt = 0: Aufrufe bis zur Antwort warten auf diese Anfrage statt die alte Liste zu nehmen.
    const id = ++requestId;
    nextLoadAt = 0;
    request = axios.get<PlayerImageEntry[]>('/playerImages/list')
        .then(({ data }) => {
            if (id !== requestId) return;
            const urls: Record<string, string> = {};
            data.forEach(entry => urls[normalizeName(entry.playerName)] = buildImageUrl(entry));
            Object.keys(playerImageUrls).forEach(key => { if (!(key in urls)) delete playerImageUrls[key]; });
            Object.assign(playerImageUrls, urls);
            nextLoadAt = Date.now() + MAX_AGE_MS;
        })
        .catch(() => {
            // Bisherige Bilder bleiben stehen
            if (id === requestId) nextLoadAt = Date.now() + RETRY_AFTER_ERROR_MS;
        })
        .finally(() => { if (id === requestId) request = null; });
    return request;
};

// Bild-URL des Spielers oder null (kein Bild)
export const fetchPlayerProfileImage = async (playerName: string): Promise<string | null> => {
    await loadImageList();
    return playerImageUrls[normalizeName(playerName)] ?? null;
};

export const getPlayerProfileImageFromBackend = fetchPlayerProfileImage;

// Nach Upload oder Loeschen: Liste sofort neu laden, das Bild bekommt so eine neue URL
export const invalidatePlayerProfileImageCache = (_playerName: string) => loadImageList(true);

export const getPlayerProfileImage = (playerOrTeamName: string): string | null => {
    // Reaktiv: aktualisiert sich, sobald die Liste geladen ist
    const backendKey = normalizeName(playerOrTeamName);
    if (playerImageUrls[backendKey]) return playerImageUrls[backendKey];

    const normalizedInput = normalizeName(playerOrTeamName);
    const leagueTeam = LEAGUE_PLAYER_DATA.find(entry => normalizeName(entry.teamName) === normalizedInput);
    if (leagueTeam?.logo) return leagueTeam.logo;

    return null;
};

export const getPlayerInitials = (playerOrTeamName: string): string => {
    const canonicalName = toTitleCase(playerOrTeamName);
    const parts = canonicalName
        .split(/\s+/)
        .map(part => part.trim())
        .filter(Boolean);

    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

    const initials = `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();

    // "SS" (historisch belastet) vermeiden -> erste zwei Buchstaben des Vornamens
    if (initials === 'SS') {
        const firstName = parts[0];
        return (firstName.length >= 2 ? firstName.slice(0, 2) : firstName.charAt(0)).toUpperCase();
    }

    return initials;
};

const normalizeName = (value: string): string =>
    value
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();

const toTitleCase = (value: string): string =>
    value
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
