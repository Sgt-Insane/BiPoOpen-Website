import { onBeforeUnmount, ref, watch, watchEffect } from 'vue';

// Globaler "Spiel eintragen"-Drawer (AddGameDrawer): das Plus in der Navigation oeffnet ihn,
// die gerade angezeigte Seite gibt die Vorauswahl vor, z.B. Liga auf der Liga-Seite.

export type AddGameMode = 'open' | 'league' | 'cup';
export type AddGameContext = { mode: AddGameMode; league?: number };

const addGameVisible = ref(false);
const pageContext = ref<AddGameContext | null>(null);
// Vorbelegte Namen je Seite, z.B. eine offene Liga-Paarung. Gilt nur fuer das naechste Oeffnen.
const presetNames = ref<string[] | null>(null);
// Zaehlt gespeicherte Spiele, damit Seiten ihre Daten neu laden koennen
const savedGameCount = ref(0);

export const useAddGame = () => {
    const openAddGame = (names?: string[]) => {
        presetNames.value = names ?? null;
        addGameVisible.value = true;
    };
    const notifyGameSaved = () => { savedGameCount.value++; };

    return { addGameVisible, pageContext, presetNames, openAddGame, notifyGameSaved };
};

// Vorauswahl der Seite, solange sie angezeigt wird. Ohne Vorauswahl: offenes Spiel.
export const useAddGameContext = (getContext: () => AddGameContext) => {
    watchEffect(() => { pageContext.value = getContext(); });
    onBeforeUnmount(() => { pageContext.value = null; });
};

// Seite laedt neu, sobald irgendwo ein Spiel eingetragen wurde.
export const onGameSaved = (callback: () => void) => watch(savedGameCount, callback);
