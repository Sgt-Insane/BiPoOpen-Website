import { createApp, h } from 'vue';
import MatchCupChart from '@/components/shared/MatchElement/MatchCupChart.vue';
import type { CupChartPalette } from '@/components/shared/MatchElement/cupChart';
import { STICKER_FONT, type StickerTheme } from './stickerRender';

// Becherverlauf fuer das Story-Overlay: dieselbe Komponente wie auf der Webseite (MatchCupChart), als SVG-Bild.
// Ausgelegt in Handybreite und 2,5-fach gezeichnet, damit es genauso aussieht wie im aufgeklappten Spiel.

const LAYOUT_WIDTH = 376;
const SCALE = 2.5;

// Wie die Sticker-Schrift: hell mit Schatten fuer dunkle Fotos, dunkel fuer helle Fotos
const PALETTES: Record<StickerTheme, CupChartPalette> = {
    light: { text: '#FFFFFF', muted: 'rgba(255, 255, 255, .82)', grid: 'rgba(255, 255, 255, .45)', dotFill: '#FFFFFF', noteBase: null, noteTint: .45, shadow: 'rgba(0, 0, 0, .45)' },
    dark: { text: '#0C1E47', muted: 'rgba(12, 30, 71, .72)', grid: 'rgba(12, 30, 71, .35)', dotFill: '#FFFFFF', noteBase: 'rgba(255, 255, 255, .75)', noteTint: .18, shadow: null },
};

export const renderStickerChart = async (match: Match, theme: StickerTheme): Promise<HTMLImageElement | null> => {
    const host = document.createElement('div');
    const app = createApp({ render: () => h(MatchCupChart, { match, width: LAYOUT_WIDTH, scale: SCALE, palette: PALETTES[theme], fontFamily: STICKER_FONT, logos: false }) });
    app.mount(host);
    const svg = host.querySelector('svg');
    const markup = svg ? new XMLSerializer().serializeToString(svg) : null;
    app.unmount();
    if (!markup) return null;

    const image = new Image();
    await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Grafik nicht ladbar'));
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    });
    return image;
};
