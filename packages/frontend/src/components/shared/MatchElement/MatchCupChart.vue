<template>
    <!-- Becherverlauf als reines SVG (ohne CSS-Klassen), damit das Story-Overlay genau diese Grafik als Bild uebernehmen kann -->
    <svg v-if="layout" xmlns="http://www.w3.org/2000/svg" :width="layout.width * scale" :height="layout.height * scale"
        :viewBox="`0 0 ${layout.width} ${layout.height}`" :font-family="fontFamily" style="display: block; overflow: visible" aria-hidden="true">
        <defs v-if="palette.shadow">
            <filter :id="`cc-shadow-${uid}`" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="1" stdDeviation="2.5" :flood-color="palette.shadow" />
            </filter>
        </defs>
        <g :filter="palette.shadow ? `url(#cc-shadow-${uid})` : undefined">
            <!-- Legende: Farbstrich, Team-Logo (Liga/Cup) und voller Teamname -->
            <g v-for="item in layout.legend" :key="`legend-${item.teamIndex}`">
                <rect :x="item.x" :y="item.y - 5" width="14" height="3" rx="1.5" :fill="teamColor(item.teamIndex)" />
                <image v-if="item.logo && !failedLogos.has(item.logo)" :href="item.logo" :x="item.x + 20" :y="item.y - 4 - CUP_CHART.legendLogo / 2"
                    :width="CUP_CHART.legendLogo" :height="CUP_CHART.legendLogo" preserveAspectRatio="xMidYMid meet" @error="onLogoError(item.logo)" />
                <text :x="item.textX" :y="item.y" :font-size="item.size" font-weight="700" :style="{ fill: palette.text }">{{ item.name }}</text>
            </g>

            <!-- Linien der Fahnen unter Diagramm und Fahnen -->
            <line v-for="note in layout.notes" :key="`line-${note.key}`" :x1="note.lineX" :x2="note.lineX" :y1="note.lineTop" :y2="note.lineBottom"
                :stroke="teamColor(note.teamIndex)" stroke-width="1.2" stroke-dasharray="3 3" opacity=".75" />

            <!-- Diagramm -->
            <g :transform="`translate(0 ${layout.plot.top})`">
                <line v-for="grid in layout.grid" :key="`grid-${grid.y}`" x1="0" :x2="layout.plot.width" :y1="grid.y" :y2="grid.y"
                    :style="{ stroke: palette.grid }" stroke-width="1" :stroke-dasharray="grid.dashed ? '3 4' : undefined" />
                <polyline v-for="line in layout.lines" :key="`curve-${line.teamIndex}`" :points="line.points" fill="none"
                    :stroke="teamColor(line.teamIndex)" stroke-width="2.5" stroke-linejoin="round" />
                <circle v-for="dot in layout.dots" :key="`dot-${dot.key}`" :cx="dot.x" :cy="dot.y" r="3.5"
                    :style="{ fill: palette.dotFill }" :stroke="teamColor(dot.teamIndex)" stroke-width="2" />

                <!-- Endstand rechts -->
                <g v-for="end in layout.ends" :key="`end-${end.teamIndex}`">
                    <text :x="layout.plot.width + 8" :y="end.y + 7" font-size="20" font-weight="800" :fill="teamColor(end.teamIndex)">{{ end.score }}</text>
                    <text :x="layout.plot.width + 8" :y="end.y + 19" font-size="10" :style="{ fill: palette.muted }">Becher</text>
                </g>

                <!-- Zeitachse: Strich nach oben, Zeit darunter -->
                <g v-for="(tick, index) in layout.axis" :key="`tick-${index}`">
                    <line :x1="tick.x" :x2="tick.x" :y1="layout.plot.height" :y2="layout.plot.height + 6" :style="{ stroke: palette.muted }" stroke-width="1.5" />
                    <text :x="tick.x" :y="layout.plot.height + 18" font-size="11" :text-anchor="tick.align" :font-weight="tick.end ? 800 : 400"
                        :style="{ fill: tick.end ? palette.text : palette.muted }">{{ tick.label }}</text>
                </g>
            </g>

            <!-- Fahnen fuer besondere Momente -->
            <g v-for="note in layout.notes" :key="`note-${note.key}`" :style="interactive && note.rowKey !== null ? { cursor: 'pointer' } : undefined"
                @click="interactive && note.rowKey !== null && emit('select', note.rowKey)">
                <rect v-if="palette.noteBase" :x="note.left" :y="note.top" :width="note.width" :height="CUP_CHART.noteHeight" :rx="CUP_CHART.noteHeight / 2" :style="{ fill: palette.noteBase }" />
                <rect :x="note.left" :y="note.top" :width="note.width" :height="CUP_CHART.noteHeight" :rx="CUP_CHART.noteHeight / 2"
                    :fill="teamColor(note.teamIndex)" :fill-opacity="palette.noteTint" :stroke="teamColor(note.teamIndex)" stroke-width="1" />
                <g :transform="`translate(${iconX(note)} ${note.top + (CUP_CHART.noteHeight - CUP_CHART.noteIcon) / 2}) scale(${CUP_CHART.noteIcon / 24})`"
                    fill="none" :stroke="teamColor(note.teamIndex)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <template v-for="(shape, index) in KNECHT_ICONS[note.icon]" :key="index">
                        <circle v-if="'r' in shape" :cx="shape.cx" :cy="shape.cy" :r="shape.r" v-bind="shapeAttrs(shape, note.teamIndex)" />
                        <path v-else :d="shape.d" v-bind="shapeAttrs(shape, note.teamIndex)" />
                    </template>
                </g>
                <text v-if="note.label || note.clock" :x="note.left + CUP_CHART.notePad + CUP_CHART.noteIcon + CUP_CHART.noteTextGap"
                    :y="note.top + CUP_CHART.noteHeight / 2 + CUP_CHART.noteFont * .36"
                    :font-size="CUP_CHART.noteFont" font-weight="700" :style="{ fill: palette.text }">{{ note.label }}<tspan v-if="note.clock"
                        :dx="note.label ? CUP_CHART.noteTextGap : 0" font-weight="500" :style="{ fill: palette.muted }">{{ note.clock }}</tspan></text>
            </g>
        </g>
    </svg>
</template>

<script setup lang="ts">
import { computed, PropType, ref } from 'vue';
import { KNECHT_ICONS, type KnechtIconShape } from '@/components/frontend/biPoKnecht/knechtIcons';
import { getTeamColor } from '@/components/frontend/biPoKnecht/KnechtUtilFunctions';
import { buildCupChart, CUP_CHART, SITE_CUP_CHART_PALETTE, type CupChartNote, type CupChartPalette } from './cupChart';

const props = defineProps({
    match: { type: Object as PropType<Match>, required: true },
    // Breite in Pixeln, die Hoehe ergibt sich (Legende, Fahnen, Diagramm, Zeitachse)
    width: { type: Number, required: true },
    palette: { type: Object as PropType<CupChartPalette>, default: () => SITE_CUP_CHART_PALETTE },
    // Story-Overlay: gleiche Auslegung, nur groesser gezeichnet
    scale: { type: Number, default: 1 },
    fontFamily: { type: String, default: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' },
    live: { type: Boolean, default: false },
    // Fahnen antippbar (springt zum Wurf)
    interactive: { type: Boolean, default: false },
    // Team-Logos in der Legende (Story-Overlay: aus, das SVG-Bild laedt keine fremden Bilder)
    logos: { type: Boolean, default: true },
});

const emit = defineEmits<{ select: [rowKey: number] }>();

const uid = Math.random().toString(36).slice(2, 8);
const teamColor = (teamIndex: number) => getTeamColor(props.match, teamIndex);

// Textbreiten mit derselben Schrift messen, damit die Fahnen sich nicht ueberdecken
const context = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
const measure = (text: string, weight: number, size: number) => {
    if (!context) return text.length * size * .58;
    context.font = `${weight} ${size}px ${props.fontFamily}`;
    return context.measureText(text).width;
};

const layout = computed(() => props.width > 0 ? buildCupChart(props.match, props.width, measure, props.live, props.logos) : null);

// Logo nicht ladbar (z.B. offline): nur Farbstrich und Name
const failedLogos = ref(new Set<string>());
const onLogoError = (logo: string) => { failedLogos.value = new Set(failedLogos.value).add(logo); };

// Symbol links in der Fahne, ohne Text mittig
const iconX = (note: CupChartNote) => note.label || note.clock
    ? note.left + CUP_CHART.notePad
    : note.left + (note.width - CUP_CHART.noteIcon) / 2;

// Wie KnechtIcon, aber als Attribute statt CSS-Klassen
const shapeAttrs = (shape: KnechtIconShape, teamIndex: number) => {
    const color = teamColor(teamIndex);
    if ('ball' in shape && shape.ball) return { fill: '#FFFFFF' };
    if (shape.fill) return { fill: color, stroke: 'none' };
    return {
        fill: shape.soft ? color : 'none',
        'fill-opacity': shape.soft ? .14 : undefined,
        'stroke-dasharray': 'dashed' in shape && shape.dashed ? '2.2 2.6' : undefined,
    };
};
</script>
