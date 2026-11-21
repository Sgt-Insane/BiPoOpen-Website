import { isHitTurnType } from '@/components/frontend/biPoKnecht/knechtEngine';
import { getScoringTeam, getTurnCups } from '@/components/frontend/biPoKnecht/knechtStats';
import { formatPoints, getShortPlayerName, getTeam, getTeamName } from '@/components/frontend/biPoKnecht/KnechtUtilFunctions';
import type { KnechtIconName } from '@/components/frontend/biPoKnecht/knechtIcons';
import { getFormationMoments } from './cupHistory';

// Becherverlauf eines Knecht-Spiels als fertig ausgelegte Grafik (Pixel bei gegebener Breite).
// Dieselbe Auslegung zeichnet MatchCupChart.vue auf der Webseite und im Story-Overlay.

// ─── Besondere Momente (Fahnen ueber dem Diagramm) ───
// Selten und spannend. Normale Treffer, Fehlwuerfe, Kanten, Ausgleich, Fuehrungswechsel und Nachwurf gehoeren nicht dazu.
// Benannte Formationen (Berliner Mauer, Donut, ...) zaehlen dazu, wenn sie durch einen Wurf entstehen.
export type CupChartMoment = {
    key: string;
    rowKey: number | null;      // Turn, zu dem die Fahne springt
    position: number;           // Reihenfolge im Spiel (Ereignisse liegen zwischen zwei Turns)
    teamIndex: number;
    playerIndex: number | null;
    scoreTeam: number;          // auf wessen Linie die Fahne zeigt (beim eigenen Becher der Gegner)
    icon: KnechtIconName;
    title: string;
    importance: number;         // bei Platzmangel werden unwichtige Fahnen zuerst verkleinert
    time: number | null;
    count: number;              // gleicher Moment kurz hintereinander: "Balls Back ×2"
};

const getData = (turn: Turn) => (turn.data ?? {}) as Record<string, unknown>;

const isTrickshotHit = (turn: Turn, previous?: Turn) =>
    previous?.type === 'trickshot' && previous.teamIndex === turn.teamIndex && getData(previous).catcherIndex === turn.playerIndex;

// Gleicher Moment desselben Spielers innerhalb dieser Zeit: eine Fahne
const GROUP_WINDOW = 90 * 1000;

export const getCupChartMoments = (match: Match): CupChartMoment[] => {
    const turns = match.turns ?? [];
    const events = match.events ?? [];
    const list: Omit<CupChartMoment, 'count'>[] = [];

    // Nur der entscheidende letzte Becher: nicht die vor einer Verlaengerung
    const lastOvertime = Math.max(-1, ...events.filter(event => event.kind === 'overtime').map(event => event.afterTurnIndex));
    let finalLastCup = -1;
    turns.forEach((turn, index) => { if (turn.type === 'lastCup' && !getData(turn).double && index >= lastOvertime) finalLastCup = index; });

    turns.forEach((turn, index) => {
        const data = getData(turn);
        const previous = turns[index - 1];
        const cups = getTurnCups(turn);
        const add = (icon: KnechtIconName, title: string, importance: number) => list.push({
            key: `${index}-${title}`, rowKey: index, position: index, teamIndex: turn.teamIndex, playerIndex: turn.playerIndex,
            scoreTeam: cups ? getScoringTeam(turn) : turn.teamIndex, icon, title, importance, time: turn.time || null,
        });

        if (turn.type === 'deathcup') add('deathcup', 'Deathcup', 9);
        if (turn.type === 'bomb') add('bomb', 'Bombe', 8);
        if (turn.type === 'hit' && isTrickshotHit(turn, previous)) add('trickshot', 'Trickshot', 8);
        if (turn.type === 'owncup') add('owncup', 'Eigener Becher', 7);
        if (turn.type === 'penalty') {
            if (data.card === 'red') add('penalty', 'Rote Karte', 7);
            else if (cups) add('penalty', 'Strafbecher', 3);
            else add('penalty', 'Gelbe Karte', 2);
        }
        if (index === finalLastCup) add('lastCup', 'Letzter Becher', 5);
        // On Fire nur beim Start der Serie, nicht bei jedem weiteren Treffer
        if (turn.type === 'onfire' && !(previous?.type === 'onfire' && previous.playerIndex === turn.playerIndex && previous.teamIndex === turn.teamIndex))
            add('onfire', 'On Fire', 4);
        if (turn.type === 'bouncer' || (data.bouncer && (cups || isHitTurnType(turn.type)))) add('bouncer', 'Bouncer', 3);
        if (turn.type === 'ballsback') add('ballsback', 'Balls Back', 2);
    });
    // Benannte Formation der stehenden Becher (Berliner Mauer, Donut, ...): Fahne beim Team, das sie abgeraeumt hat
    getFormationMoments(match).forEach(({ turnIndex, ownerIndex, formation }) => {
        const turn = turns[turnIndex];
        list.push({
            key: `${turnIndex}-f-${formation.name}`, rowKey: turnIndex, position: turnIndex + .25, teamIndex: 1 - ownerIndex, playerIndex: turn.playerIndex,
            scoreTeam: 1 - ownerIndex, icon: 'formation', title: formation.name, importance: 4, time: turn.time || null,
        });
    });
    // Verlaengerung und Re-Rack (Fahne auf der Linie des Teams, das es verlangt hat)
    const EVENT_MOMENTS: Partial<Record<MatchEvent['kind'], { icon: KnechtIconName; title: string; importance: number }>> = {
        overtime: { icon: 'overtime', title: 'Verlängerung', importance: 6 },
        reRack: { icon: 'reRack', title: 'Re-Rack', importance: 3 },
    };
    events.forEach((event, index) => {
        const moment = EVENT_MOMENTS[event.kind];
        if (!moment) return;
        const previous = turns[event.afterTurnIndex - 1];
        list.push({
            key: `e${index}`, rowKey: previous ? event.afterTurnIndex - 1 : null, position: event.afterTurnIndex - .5, teamIndex: event.teamIndex,
            playerIndex: null, scoreTeam: event.teamIndex, ...moment, time: event.time ?? previous?.time ?? null,
        });
    });
    list.sort((a, b) => a.position - b.position);

    const groups: CupChartMoment[] = [];
    list.forEach(moment => {
        const group = [...groups].reverse().find(entry => entry.title === moment.title && entry.teamIndex === moment.teamIndex && entry.playerIndex === moment.playerIndex);
        const close = group && (group.time !== null && moment.time !== null
            ? moment.time - group.time <= GROUP_WINDOW
            : moment.position - group.position <= 2);
        if (group && close) group.count++;
        else groups.push({ ...moment, count: 1 });
    });
    return groups;
};

// ─── Farben ───
// Webseite: Theme-Variablen (hell/dunkel). Story-Overlay: feste Farben, weil das Bild ausserhalb der Seite gezeichnet wird.
export type CupChartPalette = {
    text: string;
    muted: string;
    grid: string;
    dotFill: string;
    noteBase: string | null;    // Grund unter der Fahne (null = durchsichtig)
    noteTint: number;           // Deckkraft der Teamfarbe in der Fahne
    shadow: string | null;      // Schatten fuer helle Schrift auf Fotos
};

export const SITE_CUP_CHART_PALETTE: CupChartPalette = {
    text: 'var(--bp-text-strong)',
    muted: 'var(--bp-text-muted)',
    grid: 'var(--bp-border)',
    dotFill: 'var(--bp-surface)',
    noteBase: 'var(--bp-surface)',
    noteTint: .1,
    shadow: null,
};

// ─── Auslegung ───
export type MeasureText = (text: string, weight: number, size: number) => number;

export type CupChartNote = {
    key: string; rowKey: number | null; teamIndex: number; icon: KnechtIconName;
    label: string; clock: string;           // leer = nur Symbol / ohne Zeit
    left: number; top: number; width: number;
    lineX: number; lineTop: number; lineBottom: number;
};

export type CupChartLayout = {
    width: number;
    height: number;
    // logo: Team-Logo (Liga/Cup) zwischen Farbstrich und Namen, textX: wo der Name beginnt
    legend: { teamIndex: number; name: string; size: number; x: number; y: number; logo: string | null; textX: number }[];
    plot: { top: number; width: number; height: number };
    grid: { y: number; dashed: boolean }[];
    lines: { teamIndex: number; points: string }[];
    dots: { key: string; teamIndex: number; x: number; y: number }[];
    ends: { teamIndex: number; score: string; y: number }[];
    axis: { x: number; label: string; end: boolean; align: 'start' | 'middle' }[];
    notes: CupChartNote[];
};

// Masse in Pixeln (Webseite 1:1, im Story-Overlay hochskaliert)
export const CUP_CHART = {
    legendRow: 18,
    legendLogoRow: 28,          // Legende mit Team-Logos
    legendLogo: 24,
    legendGap: 8,
    plotHeight: 130,
    endsWidth: 52,
    axisHeight: 24,
    // Fahnen bewusst klein, damit sie den Verlauf nicht ueberdecken
    noteRow: 19,
    noteHeight: 15,
    noteGap: 6,
    notePad: 5,
    noteIcon: 10,
    noteFont: 9,
    noteTextGap: 3,
    maxNoteRows: 3,
};

const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

// Legende: Strich (14) + Abstand (6) vor jedem Namen, 14 zwischen den beiden Eintraegen
const LEGEND_MARK = 20;
const LEGEND_GAP = 14;
const LEGEND_FONT = 12;

// logos: Team-Logos in der Legende (aus im Story-Overlay: das SVG-Bild kann keine fremden Bilder nachladen)
export const buildCupChart = (match: Match, width: number, measure: MeasureText, live = false, logos = true): CupChartLayout | null => {
    const turns = match.turns ?? [];
    // Stand nach jedem Turn
    const running: [number, number] = [0, 0];
    const scores = turns.map(turn => {
        const cups = getTurnCups(turn);
        running[getScoringTeam(turn)] += cups;
        return { turn, cups, score: [running[0], running[1]] as [number, number] };
    });
    const hits = scores.map((entry, index) => ({ ...entry, index })).filter(entry => entry.cups || isHitTurnType(entry.turn.type));
    if (!hits.length) return null;

    const C = CUP_CHART;
    const teams = (match.team1?.players.length ?? 0) > 1 || (match.team2?.players.length ?? 0) > 1;

    // Legende: volle Teamnamen, immer nebeneinander in einer Zeile. Reicht der Platz nicht, werden beide
    // gleich kleiner (nie umgebrochen, nie mit … gekuerzt).
    const names = [0, 1].map(teamIndex => getTeamName(match, teamIndex));
    const teamLogos = [0, 1].map(teamIndex => (logos && getTeam(match, teamIndex)?.logo) || null);
    const hasLogos = teamLogos.some(Boolean);
    // Vor jedem Namen: Farbstrich, mit Logo dazu Logo und Abstand
    const marks = teamLogos.map(logo => LEGEND_MARK + (logo ? C.legendLogo + 6 : 0));
    const textWidths = names.map(name => measure(name, 700, LEGEND_FONT));
    const room = width - marks[0] - marks[1] - LEGEND_GAP;
    const fullWidth = textWidths[0] + textWidths[1];
    const legendSize = fullWidth <= room ? LEGEND_FONT : Math.floor(LEGEND_FONT * room / fullWidth * 2) / 2;
    const scale = legendSize / LEGEND_FONT;
    const legendRow = hasLogos ? C.legendLogoRow : C.legendRow;
    const legend = names.map((name, teamIndex) => {
        const x = teamIndex === 0 ? 0 : marks[0] + textWidths[0] * scale + LEGEND_GAP;
        return { teamIndex, name, size: legendSize, x, y: legendRow / 2 + 4, logo: teamLogos[teamIndex], textX: x + marks[teamIndex] };
    });
    const legendHeight = legendRow + C.legendGap;

    // Skalen
    const plotWidth = width - C.endsWidth;
    const start = match.time ?? hits[0].turn.time;
    const end = (live ? undefined : match.endTime) ?? hits[hits.length - 1].turn.time;
    const useTime = !!start && !!end && end > start && hits.every(entry => !!entry.turn.time);
    const finals = scores[scores.length - 1].score;
    const maxScore = Math.max(10, ...finals);
    const hitX = (hitIndex: number) => useTime
        ? Math.min(1, Math.max(0, (hits[hitIndex].turn.time - start) / (end - start))) * plotWidth
        : (hitIndex + 1) / hits.length * plotWidth;
    const toY = (score: number) => C.plotHeight - score / maxScore * C.plotHeight;

    // Treppenlinien und Punkte bei jedem neuen Stand
    const dots: CupChartLayout['dots'] = [];
    const lines = [0, 1].map(teamIndex => {
        const points = [`0,${C.plotHeight}`];
        let current = 0;
        hits.forEach((entry, hitIndex) => {
            if (entry.score[teamIndex] === current) return;
            const x = hitX(hitIndex);
            points.push(`${x.toFixed(1)},${toY(current).toFixed(1)}`, `${x.toFixed(1)},${toY(entry.score[teamIndex]).toFixed(1)}`);
            current = entry.score[teamIndex];
            dots.push({ key: `${teamIndex}-${entry.index}`, teamIndex, x, y: toY(current) });
        });
        points.push(`${plotWidth},${toY(current).toFixed(1)}`);
        return { teamIndex, points: points.join(' ') };
    });

    // Endstand rechts auf Hoehe der Linie, bei knappem Stand auseinandergeschoben
    const minGap = 30;
    const ends = [0, 1].map(teamIndex => ({ teamIndex, score: formatPoints(finals[teamIndex]), y: toY(finals[teamIndex]) })).sort((a, b) => a.y - b.y);
    if (ends[1].y - ends[0].y < minGap) {
        ends[1].y = Math.min(C.plotHeight, ends[0].y + minGap);
        ends[0].y = ends[1].y - minGap;
    }

    // Zeitachse in Dritteln
    const seconds = useTime ? (end - start) / 1000 : 0;
    const axis = useTime ? [0, 1 / 3, 2 / 3, 1].map((part, index) => ({
        x: part * plotWidth,
        label: `${formatClock(seconds * part)}${index === 3 ? ' min' : ''}`,
        end: index === 3,
        align: index === 0 ? 'start' as const : 'middle' as const,
    })) : [];

    // Fahnen: Position wie die Linie, Spitze zeigt auf den Stand direkt nach dem Moment
    const hitIndexUpTo = (position: number) => hits.reduce((found, entry, hitIndex) => entry.index <= position ? hitIndex : found, -1);
    const moments = getCupChartMoments(match).map(moment => {
        const timed = useTime && moment.time !== null;
        const upTo = hitIndexUpTo(moment.position);
        const scoreEntry = scores[Math.floor(moment.position)] ?? scores[Math.floor(moment.position) - 1];
        return {
            ...moment,
            x: timed ? Math.min(1, Math.max(0, (moment.time! - start) / (end - start))) * plotWidth : upTo < 0 ? 0 : hitX(upTo),
            y: toY(scoreEntry?.score[moment.scoreTeam] ?? 0),
            clock: timed ? formatClock(Math.max(0, moment.time! - start) / 1000) : '',
            name: teams && moment.playerIndex !== null ? getShortPlayerName(match, moment.teamIndex, moment.playerIndex) : '',
            title: moment.count > 1 ? `${moment.title} ×${moment.count}` : moment.title,
        };
    });

    // Stufen bei Platzmangel: 0 = "Bombe · Jonas 2:25", 1 = ohne Zeit, 2 = nur Name (im 1 gegen 1 nur Symbol), 3 = nur Symbol
    type Placed = { moment: typeof moments[number]; label: string; clock: string; left: number; width: number; row: number };
    const levels = new Map(moments.map(moment => [moment.key, 0]));
    const content = (moment: typeof moments[number]) => {
        const level = levels.get(moment.key)!;
        const label = level <= 1 ? [moment.title, moment.name].filter(Boolean).join(' · ') : level === 2 ? moment.name : '';
        return { label, clock: level === 0 ? moment.clock : '' };
    };
    const hidden = new Set<string>();
    const place = () => {
        const rowEnds: number[] = [];
        const placed: Placed[] = moments.filter(moment => !hidden.has(moment.key)).map(moment => {
            const { label, clock } = content(moment);
            const textWidth = (label ? C.noteTextGap + measure(label, 700, C.noteFont) : 0) + (clock ? C.noteTextGap + measure(clock, 500, C.noteFont) : 0);
            const noteWidth = label || clock ? C.notePad * 2 + C.noteIcon + textWidth : C.noteHeight + 2;
            const anchor = label || clock ? moment.x - 8 : moment.x - noteWidth / 2;
            const left = Math.max(0, Math.min(anchor, width - noteWidth));
            let row = rowEnds.findIndex(rowEnd => rowEnd + 4 <= left);
            if (row < 0) { row = rowEnds.length; rowEnds.push(0); }
            rowEnds[row] = left + noteWidth;
            return { moment, label, clock, left, width: noteWidth, row };
        });
        return { placed, rows: rowEnds.length };
    };
    let layout = place();
    const fits = () => layout.rows <= C.maxNoteRows;
    const byImportance = [...moments].sort((a, b) => a.importance - b.importance || a.x - b.x);
    // Schritte bei Platzmangel, bis es in die Zeilen passt: erst ueberall die Zeit weg, dann die gewoehnlichen
    // Momente (Balls Back, Re-Rack, Bouncer, On Fire, Karten) verkleinern und notfalls ausblenden (in der Wurfliste bleiben sie),
    // erst danach die seltenen (Deathcup, Bombe, Trickshot, ...) ebenso
    const RARE = 5;
    const common = byImportance.filter(moment => moment.importance < RARE);
    const rare = byImportance.filter(moment => moment.importance >= RARE);
    const steps: (() => void)[] = [
        ...byImportance.map(moment => () => levels.set(moment.key, Math.max(levels.get(moment.key)!, 1))),
        ...[common, rare].flatMap(group => [
            ...group.map(moment => () => levels.set(moment.key, Math.max(levels.get(moment.key)!, 2))),
            ...group.map(moment => () => levels.set(moment.key, 3)),
            ...group.map(moment => () => hidden.add(moment.key)),
        ]),
    ];
    for (const step of steps) {
        if (fits()) break;
        step();
        layout = place();
    }
    // 3. Wo Platz frei geworden ist: die wichtigsten bekommen ihre Beschriftung zurueck, soweit es passt
    for (let level = 0; level <= 2; level++) {
        for (const moment of [...byImportance].reverse()) {
            const previous = levels.get(moment.key)!;
            if (hidden.has(moment.key) || previous <= level) continue;
            levels.set(moment.key, level);
            layout = place();
            if (!fits()) { levels.set(moment.key, previous); layout = place(); }
        }
    }
    const notesHeight = layout.rows ? layout.rows * C.noteRow + C.noteGap : 0;
    const plotTop = legendHeight + notesHeight;
    const notes = layout.placed.map(({ moment, label, clock, left, width: noteWidth, row }) => ({
        key: moment.key, rowKey: moment.rowKey, teamIndex: moment.teamIndex, icon: moment.icon, label, clock,
        left, top: legendHeight + row * C.noteRow, width: noteWidth,
        lineX: moment.x, lineTop: legendHeight + row * C.noteRow + C.noteHeight, lineBottom: plotTop + moment.y,
    }));

    return {
        width,
        height: plotTop + C.plotHeight + (axis.length ? C.axisHeight : 6),
        legend,
        plot: { top: plotTop, width: plotWidth, height: C.plotHeight },
        grid: [{ y: 0, dashed: false }, { y: C.plotHeight / 2, dashed: true }, { y: C.plotHeight, dashed: false }],
        lines, dots, ends, axis, notes,
    };
};
