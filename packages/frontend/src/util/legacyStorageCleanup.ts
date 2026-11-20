// Frueher lagen Spielerliste und Profilbilder (Base64, bis zu ~1 MB je Bild) im localStorage.
// Beides kommt inzwischen frisch bzw. ueber den Browser-Cache. Die alten Eintraege einmal wegraeumen,
// sonst bleibt der Speicher voll und andere Daten (z.B. ein laufendes Knecht-Spiel) lassen sich nicht sichern.
const LEGACY_KEYS = ['bipo-player-names-cache-v3'];
const LEGACY_PREFIXES = ['playerImg_'];

export const cleanupLegacyStorage = () => {
    try {
        const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
            .filter((key): key is string => !!key)
            .filter(key => LEGACY_KEYS.includes(key) || LEGACY_PREFIXES.some(prefix => key.startsWith(prefix)));
        keys.forEach(key => localStorage.removeItem(key));
    } catch {
        // Kein Zugriff auf den Speicher (privater Modus): dann gibt es auch nichts aufzuraeumen
    }
};
