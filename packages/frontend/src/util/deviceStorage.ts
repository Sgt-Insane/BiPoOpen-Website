// Speicher fuer Dinge, die zu diesem Handy gehoeren (Profil, laufendes Knecht-Spiel).
// Demo-Modus: mehrere Tabs spielen gegeneinander, dort ist jeder Tab ein eigenes Handy (sessionStorage).
const isTabScoped = import.meta.env.VITE_KNECHT_MULTIPLAYER === 'local' || (import.meta.env.DEV && import.meta.env.VITE_KNECHT_MULTIPLAYER !== 'remote');

export const getDeviceStorage = (): Storage => isTabScoped ? sessionStorage : localStorage;
