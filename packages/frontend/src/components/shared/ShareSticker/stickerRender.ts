import type { StickerData, StickerPlayer } from './stickerData';

// Zeichnet das Story-Overlay als transparentes PNG im Story-Format (1080 x 1920).
// Nur Schrift und Grafik, alles andere bleibt durchsichtig: es liegt in Insta/Snapchat ueber einem eigenen Foto.
// 'light' = weisse Schrift mit Schatten (fuer dunkle Fotos), 'dark' = dunkle Schrift (fuer helle Fotos).

export type StickerTemplate = 'result' | 'curve' | 'player' | 'awards';
export type StickerTheme = 'light' | 'dark';

const WIDTH = 1080;
const HEIGHT = 1920;
// Abstand zu den Bedienelementen von Insta/Snapchat oben und unten
const SAFE_TOP = 250;
const SAFE_BOTTOM = 340;

export type StickerPosition = 'top' | 'middle' | 'bottom';
const PAD = 70;
// Wie die Ueberschriften der Seite: Systemschrift (fett verfuegbar)
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const STICKER_FONT = FONT;
const BRAND = 'WECK BIPO OPEN';

type Ctx = CanvasRenderingContext2D;
type Palette = { text: string; muted: string; line: string; shadow: string | null };

const PALETTES: Record<StickerTheme, Palette> = {
    light: { text: '#FFFFFF', muted: 'rgba(255, 255, 255, .82)', line: 'rgba(255, 255, 255, .55)', shadow: 'rgba(0, 0, 0, .45)' },
    dark: { text: '#0C1E47', muted: 'rgba(12, 30, 71, .72)', line: 'rgba(12, 30, 71, .4)', shadow: null },
};

// Schriften bereit, bevor gezeichnet wird (Systemschrift: meist sofort)
export const loadStickerFonts = async () => {
    try { await document.fonts.ready; } catch { /* egal */ }
};

const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`;

const withShadow = (ctx: Ctx, palette: Palette, draw: () => void) => {
    ctx.save();
    if (palette.shadow) {
        ctx.shadowColor = palette.shadow;
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 4;
    }
    draw();
    ctx.restore();
};

const text = (ctx: Ctx, palette: Palette, value: string, x: number, y: number, options: { weight?: number; size: number; color?: string; align?: CanvasTextAlign; maxWidth?: number }) => {
    withShadow(ctx, palette, () => {
        ctx.font = font(options.weight ?? 800, options.size);
        ctx.fillStyle = options.color ?? palette.text;
        ctx.textAlign = options.align ?? 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(value, x, y, options.maxWidth);
    });
};

// Nie mit … kuerzen: Schriftgroesse, bei der der Text in die Breite passt (hoechstens die gewuenschte)
const fitSize = (ctx: Ctx, value: string, weight: number, size: number, maxWidth: number) => {
    ctx.font = font(weight, size);
    const width = ctx.measureText(value).width;
    return width <= maxWidth ? size : Math.floor(size * maxWidth / width);
};

const roundRect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
};

const brand = (ctx: Ctx, palette: Palette, data: StickerData, y: number) => {
    const line = [BRAND, data.dateText].filter(Boolean).join('  ·  ');
    text(ctx, palette, line, WIDTH / 2, y, { weight: 700, size: 34, color: palette.muted, align: 'center' });
};

const resultLine = (data: StickerData) => {
    const parts = [data.winnerIndex !== null ? `${data.teams[data.winnerIndex].name} gewinnt` : 'Unentschieden'];
    if (data.durationText) parts.push(data.durationText);
    return parts.join('  ·  ');
};

// ─── Endstand ───
const drawResult = (ctx: Ctx, palette: Palette, data: StickerData) => {
    brand(ctx, palette, data, 70);
    data.teams.forEach((team, index) => {
        const top = 120 + index * 150;
        const winner = data.winnerIndex === index;
        withShadow(ctx, palette, () => {
            ctx.fillStyle = team.color;
            roundRect(ctx, PAD, top, 18, 112, 9);
            ctx.fill();
        });
        const nameSize = fitSize(ctx, team.name, 800, 66, WIDTH - PAD * 2 - 260);
        text(ctx, palette, team.name, PAD + 48, top + 80, { weight: 800, size: nameSize, color: winner || data.winnerIndex === null ? palette.text : palette.muted });
        text(ctx, palette, team.score, WIDTH - PAD, top + 96, { weight: 900, size: 128, align: 'right', color: winner || data.winnerIndex === null ? palette.text : palette.muted });
    });
    text(ctx, palette, resultLine(data), WIDTH / 2, 480, { weight: 700, size: 40, color: palette.muted, align: 'center', maxWidth: WIDTH - PAD * 2 });
    return 520;
};

// ─── Spielverlauf: dieselbe Grafik wie im aufgeklappten Spiel (MatchCupChart, siehe stickerChart.ts) ───
const drawCurve = (ctx: Ctx, palette: Palette, data: StickerData, chart: HTMLImageElement | null) => {
    brand(ctx, palette, data, 70);
    // Endstand in Teamfarben, die Namen stehen in der Legende der Grafik
    const left = data.teams[0].score;
    const right = data.teams[1].score;
    text(ctx, palette, ':', WIDTH / 2, 200, { weight: 900, size: 110, align: 'center' });
    text(ctx, palette, left, WIDTH / 2 - 40, 210, { weight: 900, size: 120, align: 'right', color: data.teams[0].color });
    text(ctx, palette, right, WIDTH / 2 + 40, 210, { weight: 900, size: 120, align: 'left', color: data.teams[1].color });
    if (!chart) return 260;

    const width = WIDTH - PAD * 2;
    const height = chart.height * width / chart.width;
    ctx.drawImage(chart, PAD, 270, width, height);
    return 270 + height + 30;
};

// ─── Ein Spieler ───
const drawPlayer = (ctx: Ctx, palette: Palette, data: StickerData, player: StickerPlayer) => {
    brand(ctx, palette, data, 70);
    const team = data.teams[player.teamIndex];
    text(ctx, palette, player.name, WIDTH / 2, 200, { weight: 900, size: fitSize(ctx, player.name, 900, 104, WIDTH - PAD * 2), align: 'center' });
    const won = data.winnerIndex === player.teamIndex;
    const opponent = data.teams[1 - player.teamIndex];
    text(ctx, palette, `${won ? 'Sieg' : data.winnerIndex === null ? 'Unentschieden' : 'Niederlage'} ${team.score} : ${opponent.score} gegen ${opponent.name}`, WIDTH / 2, 262, { weight: 700, size: 38, color: palette.muted, align: 'center', maxWidth: WIDTH - PAD * 2 });

    const tiles = [
        { value: `${player.accuracy} %`, label: `${player.hits}/${player.throws} Treffer` },
        { value: player.points, label: 'Becher' },
        { value: String(player.bestStreak), label: 'in Folge' },
        ...(player.eloDelta !== null ? [{ value: `${player.eloDelta >= 0 ? '+' : '−'}${Math.abs(player.eloDelta)}`, label: 'Elo' }] : []),
    ];
    const gap = 24;
    const tileW = (WIDTH - PAD * 2 - gap * (tiles.length - 1)) / tiles.length;
    tiles.forEach((tile, index) => {
        const x = PAD + index * (tileW + gap);
        withShadow(ctx, palette, () => {
            ctx.fillStyle = team.color;
            roundRect(ctx, x, 320, tileW, 12, 6);
            ctx.fill();
        });
        text(ctx, palette, tile.value, x + tileW / 2, 450, { weight: 900, size: tiles.length > 3 ? 76 : 88, align: 'center', maxWidth: tileW });
        text(ctx, palette, tile.label, x + tileW / 2, 506, { weight: 700, size: 32, color: palette.muted, align: 'center', maxWidth: tileW });
    });

    if (!player.award) return 560;
    text(ctx, palette, `${player.award.icon}  ${player.award.title}`, WIDTH / 2, 620, { weight: 900, size: 56, align: 'center', maxWidth: WIDTH - PAD * 2 });
    text(ctx, palette, player.award.detail, WIDTH / 2, 676, { weight: 700, size: 34, color: palette.muted, align: 'center', maxWidth: WIDTH - PAD * 2 });
    return 720;
};

// ─── Auszeichnungen aller Spieler ───
const drawAwards = (ctx: Ctx, palette: Palette, data: StickerData) => {
    brand(ctx, palette, data, 70);
    text(ctx, palette, 'Auszeichnungen', WIDTH / 2, 170, { weight: 900, size: 76, align: 'center' });
    let y = 250;
    data.players.filter(player => player.award).forEach(player => {
        const team = data.teams[player.teamIndex];
        withShadow(ctx, palette, () => {
            ctx.fillStyle = team.color;
            roundRect(ctx, PAD, y, 14, 96, 7);
            ctx.fill();
        });
        text(ctx, palette, player.award!.icon, PAD + 44, y + 70, { weight: 800, size: 60 });
        text(ctx, palette, player.name, PAD + 140, y + 36, { weight: 800, size: fitSize(ctx, player.name, 800, 34, WIDTH - PAD * 2 - 150), color: palette.muted });
        text(ctx, palette, player.award!.title, PAD + 140, y + 90, { weight: 900, size: fitSize(ctx, player.award!.title, 900, 54, WIDTH - PAD * 2 - 150) });
        y += 130;
    });
    return y + 10;
};

// Inhalt erst auf eine Entwurfs-Leinwand zeichnen (Hoehe ergibt sich), dann an die gewaehlte Stelle im Story-Format setzen
// chart: Becherverlauf als Bild (renderStickerChart) fuer die Vorlage 'curve'
export const renderSticker = (data: StickerData, template: StickerTemplate, theme: StickerTheme, player?: StickerPlayer, position: StickerPosition = 'bottom', chart: HTMLImageElement | null = null): HTMLCanvasElement => {
    const draft = document.createElement('canvas');
    draft.width = WIDTH;
    draft.height = 1500;
    const ctx = draft.getContext('2d')!;
    const palette = PALETTES[theme];
    const height = template === 'result' ? drawResult(ctx, palette, data)
        : template === 'curve' ? drawCurve(ctx, palette, data, chart)
        : template === 'player' && player ? drawPlayer(ctx, palette, data, player)
        : drawAwards(ctx, palette, data);

    const content = Math.ceil(height);
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const top = position === 'top' ? SAFE_TOP : position === 'middle' ? (HEIGHT - content) / 2 : HEIGHT - SAFE_BOTTOM - content;
    canvas.getContext('2d')!.drawImage(draft, 0, 0, WIDTH, content, 0, Math.round(top), WIDTH, content);
    return canvas;
};

export const toPngBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG fehlgeschlagen')), 'image/png'));
