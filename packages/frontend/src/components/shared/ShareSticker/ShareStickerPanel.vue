<template>
    <!-- Teilen-Sticker: transparente Bilder fuer Insta-/Snapchat-Storys, zum Durchwischen -->
    <div class="ShareStickerPanel">
        <div ref="track" class="ss-track" @scroll.passive="onScroll">
            <div v-for="slide in slides" :key="slide.key" class="ss-slide">
                <div class="ss-preview" :class="`ss-preview--${theme}`">
                    <img v-if="slide.url" :src="slide.url" :alt="slide.label" class="ss-image" />
                </div>
                <div class="ss-label">{{ slide.label }}</div>
            </div>
        </div>
        <div class="ss-dots" aria-hidden="true">
            <span v-for="(slide, index) in slides" :key="slide.key" class="ss-dot" :class="{ 'ss-dot--on': index === current }"></span>
        </div>

        <div class="ss-segmented" role="radiogroup" aria-label="Schriftfarbe">
            <button type="button" role="radio" :aria-checked="theme === 'light'" @click="theme = 'light'">Helle Schrift</button>
            <button type="button" role="radio" :aria-checked="theme === 'dark'" @click="theme = 'dark'">Dunkle Schrift</button>
        </div>

        <div class="ss-actions">
            <button v-if="canShare" type="button" class="ss-button ss-button--primary" :disabled="busy" @click="share()">
                <i class="pi pi-share-alt"></i> Teilen
            </button>
            <button v-if="canCopy" type="button" class="ss-button" :class="{ 'ss-button--primary': !canShare }" :disabled="busy" @click="copy()">
                <i class="pi pi-copy"></i> Kopieren
            </button>
            <button type="button" class="ss-button" :disabled="busy" @click="download()">
                <i class="pi pi-download"></i> Speichern
            </button>
        </div>
        <div class="ss-hint">{{ message || 'Tipp: „Kopieren“ und in der Insta- oder Snapchat-Story einfügen – dann liegt das Bild als Sticker über deinem Foto.' }}</div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { buildStickerData } from './stickerData';
import { loadStickerFonts, renderSticker, toPngBlob, type StickerTemplate, type StickerTheme } from './stickerRender';

const props = defineProps<{ match: Match; eloDeltas?: Record<string, number> }>();

const theme = ref<StickerTheme>('light');
const data = computed(() => buildStickerData(props.match, props.eloDeltas));

type Slide = { key: string; label: string; template: StickerTemplate; playerIndex?: number; url: string };
const slides = ref<Slide[]>([]);
const canvases = new Map<string, HTMLCanvasElement>();

const SLIDE_LIST = (): Omit<Slide, 'url'>[] => [
    { key: 'result', label: 'Endstand', template: 'result' },
    { key: 'curve', label: 'Spielverlauf', template: 'curve' },
    ...data.value.players.map((player, index) => ({ key: `player-${index}`, label: player.name, template: 'player' as const, playerIndex: index })),
    { key: 'awards', label: 'Auszeichnungen', template: 'awards' },
];

const render = async () => {
    await loadStickerFonts();
    canvases.clear();
    slides.value = SLIDE_LIST().map(slide => {
        const canvas = renderSticker(data.value, slide.template, theme.value, slide.playerIndex !== undefined ? data.value.players[slide.playerIndex] : undefined);
        canvases.set(slide.key, canvas);
        return { ...slide, url: canvas.toDataURL('image/png') };
    });
};
onMounted(render);
watch([theme, data], render);

// Aktuelle Vorlage aus der Scroll-Position
const track = ref<HTMLElement | null>(null);
const current = ref(0);
const onScroll = () => {
    if (!track.value) return;
    current.value = Math.round(track.value.scrollLeft / track.value.clientWidth);
};

const busy = ref(false);
const message = ref('');
const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [new File([''], 'test.png', { type: 'image/png' })] });
const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof ClipboardItem !== 'undefined';

const currentFile = async () => {
    const slide = slides.value[current.value] ?? slides.value[0];
    const blob = await toPngBlob(canvases.get(slide.key)!);
    const name = `bipo-${slide.key}.png`;
    return { blob, file: new File([blob], name, { type: 'image/png' }), name };
};

const run = async (action: () => Promise<string>) => {
    busy.value = true;
    message.value = '';
    try {
        message.value = await action();
    } catch (error) {
        // Teilen abgebrochen: keine Meldung
        if ((error as Error)?.name !== 'AbortError') message.value = 'Hat nicht geklappt – versuch „Speichern“.';
    } finally {
        busy.value = false;
    }
};

const share = () => run(async () => {
    const { file } = await currentFile();
    await navigator.share({ files: [file] });
    return '';
});

const copy = () => run(async () => {
    // Safari verlangt das Promise direkt im ClipboardItem (sonst geht die Nutzer-Geste verloren)
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': currentFile().then(entry => entry.blob) })]);
    return 'Kopiert – jetzt in der Story einfügen (lange tippen → Einfügen).';
});

const download = () => run(async () => {
    const { blob, name } = await currentFile();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'Gespeichert.';
});
</script>

<style scoped>
.ShareStickerPanel{
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.ss-track{
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    border-radius: 16px;
}
.ss-track::-webkit-scrollbar{
    display: none;
}
.ss-slide{
    flex: 0 0 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scroll-snap-align: center;
}
/* Beispiel-"Foto" hinter dem Sticker, damit man die Transparenz sieht */
.ss-preview{
    display: grid;
    place-items: center;
    min-height: 260px;
    padding: 18px;
    border-radius: 16px;
}
.ss-preview--light{
    background: radial-gradient(circle at 30% 20%, #5B6B8C 0%, #1E2A44 55%, #0E1424 100%);
}
.ss-preview--dark{
    background: radial-gradient(circle at 30% 20%, #FFFFFF 0%, #F3E6CF 55%, #E2CFA9 100%);
}
.ss-image{
    display: block;
    width: 100%;
    height: auto;
}
.ss-label{
    font-size: 14px;
    font-weight: 700;
    text-align: center;
    color: var(--bp-text-strong);
}
.ss-dots{
    display: flex;
    justify-content: center;
    gap: 6px;
    margin-top: -4px;
}
.ss-dot{
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--bp-border-strong);
}
.ss-dot--on{
    background: var(--main-color);
}
.ss-segmented{
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 12px;
    background: var(--page-gray);
}
.ss-segmented button{
    flex: 1;
    min-height: 38px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--bp-text-muted);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
}
.ss-segmented button[aria-checked="true"]{
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    box-shadow: 0 1px 2px rgba(0, 0, 0, .1);
}
.ss-actions{
    display: flex;
    gap: 8px;
}
.ss-button{
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    border: 1.5px solid var(--bp-border);
    border-radius: 12px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
}
.ss-button--primary{
    border-color: var(--main-color);
    background: var(--main-color);
    color: white;
}
.ss-button:disabled{
    opacity: .5;
}
.ss-hint{
    font-size: 13px;
    color: var(--bp-text-muted);
    text-align: center;
}
</style>
