<script setup lang="ts">
import { computed, PropType } from 'vue';

const props = defineProps({
  match: { type: Object as PropType<Match>, required: true },
});

const turnLabel: Record<Turn['type'], string> = {
  hit: 'Treffer',
  miss: 'Nullwurf',
  airball: 'Airball',
  bomb: 'Bombe',
  bouncer: 'Bouncer',
  trickshot: 'Trickshot',
  onfire: 'On Fire',
  ballsback: 'Balls Back',
  lastCup: 'Letzter Becher',
  deathcup: 'Deathcup',
  owncup: 'Eigener Becher',
};

const importantTypes = new Set<Turn['type']>(['hit', 'bomb', 'bouncer', 'trickshot', 'onfire', 'ballsback', 'lastCup', 'deathcup', 'owncup']);
const EVENT_MIN_GAP = 5; // min % gap between events before spreading

const duration = computed(() => {
  if (!props.match.time || !props.match.endTime) return 1;
  return props.match.endTime - props.match.time || 1;
});

type LayoutEvent = {
  position: number;
  displayPosition: number;
  teamIndex: number;
  label: string;
  playerName: string;
  minute: number;
  hasOffset: boolean;
};

function getPlayerName(teamIndex: number, playerIndex: number): string {
  const team = teamIndex === 0 ? props.match.team1 : props.match.team2;
  if (!team?.players?.[playerIndex]) return '';
  return team.players[playerIndex].name;
}

function spreadEvents(events: LayoutEvent[]): LayoutEvent[] {
  if (events.length <= 1) return events;
  const sorted = [...events].sort((a, b) => a.position - b.position);

  for (let pass = 0; pass < 20; pass++) {
    let changed = false;
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].displayPosition - sorted[i - 1].displayPosition;
      if (gap < EVENT_MIN_GAP) {
        const adjust = (EVENT_MIN_GAP - gap) / 2;
        sorted[i - 1].displayPosition -= adjust;
        sorted[i].displayPosition += adjust;
        changed = true;
      }
    }
    if (!changed) break;
  }

  for (const e of sorted) {
    e.displayPosition = Math.max(2, Math.min(98, e.displayPosition));
    e.hasOffset = Math.abs(e.displayPosition - e.position) > 0.5;
  }

  return sorted;
}

const allRawEvents = computed(() => {
  if (!props.match.turns || !props.match.time) return [];
  const start = props.match.time;
  const dur = duration.value;

  return props.match.turns
    .filter(t => importantTypes.has(t.type))
    .map(t => {
      const pos = Math.min(Math.max(((t.time - start) / dur) * 100, 2), 98);
      return {
        position: pos,
        displayPosition: pos,
        teamIndex: t.teamIndex,
        label: turnLabel[t.type],
        playerName: getPlayerName(t.teamIndex, t.playerIndex),
        minute: Math.floor((t.time - start) / 60000),
        hasOffset: false,
      } as LayoutEvent;
    });
});

const team1Events = computed(() => spreadEvents(allRawEvents.value.filter(e => e.teamIndex === 0)));
const team2Events = computed(() => spreadEvents(allRawEvents.value.filter(e => e.teamIndex === 1)));

function formatDuration(startTime: number, endTime: number): string {
  const diff = endTime - startTime;
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
</script>

<template>
  <div class="timeline-container">
    <div class="timeline-header">
      <span class="timeline-title">Spielverlauf</span>
      <span v-if="match.time && match.endTime" class="timeline-duration">
        {{ formatDuration(match.time, match.endTime) }} min
      </span>
    </div>

    <div class="timeline-body">
      <!-- Left column: Team 1 -->
      <div class="timeline-col team1-col">
        <div v-for="(event, i) in team1Events" :key="'t1-' + i"
          class="event-row"
          :style="{ top: event.displayPosition + '%' }">
          <div class="event-content">
            <span class="event-player">{{ event.playerName }}</span>
            <span class="event-label">{{ event.label }}</span>
            <span class="event-minute">{{ event.minute }}'</span>
          </div>
          <div class="event-hline" :class="{ 'to-beam': !event.hasOffset }"></div>
        </div>
        <!-- Bracket connectors for spread events -->
        <template v-for="(event, i) in team1Events.filter(e => e.hasOffset)" :key="'b1-' + i">
          <div class="bracket-vline" :style="{
            top: Math.min(event.displayPosition, event.position) + '%',
            height: Math.abs(event.displayPosition - event.position) + '%'
          }"></div>
          <div class="bracket-tick" :style="{ top: event.position + '%' }"></div>
        </template>
      </div>

      <!-- Beam -->
      <div class="timeline-beam">
        <div class="beam-dot"></div>
        <div class="beam-line"></div>
        <div class="beam-dot"></div>
      </div>

      <!-- Right column: Team 2 -->
      <div class="timeline-col team2-col">
        <div v-for="(event, i) in team2Events" :key="'t2-' + i"
          class="event-row"
          :style="{ top: event.displayPosition + '%' }">
          <div class="event-hline" :class="{ 'to-beam': !event.hasOffset }"></div>
          <div class="event-content">
            <span class="event-minute">{{ event.minute }}'</span>
            <span class="event-label">{{ event.label }}</span>
            <span class="event-player">{{ event.playerName }}</span>
          </div>
        </div>
        <!-- Bracket connectors for spread events -->
        <template v-for="(event, i) in team2Events.filter(e => e.hasOffset)" :key="'b2-' + i">
          <div class="bracket-vline" :style="{
            top: Math.min(event.displayPosition, event.position) + '%',
            height: Math.abs(event.displayPosition - event.position) + '%'
          }"></div>
          <div class="bracket-tick" :style="{ top: event.position + '%' }"></div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-container {
  width: 100%;
  padding: 12px 0;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.timeline-title {
  font-weight: 600;
  font-size: 14px;
}

.timeline-duration {
  font-size: 12px;
  color: gray;
}

/* Main layout */
.timeline-body {
  display: flex;
  position: relative;
  min-height: 500px;
}

/* Columns */
.timeline-col {
  flex: 1;
  position: relative;
  overflow: visible;
}

/* Event row */
.event-row {
  position: absolute;
  display: flex;
  align-items: center;
  width: 100%;
  transform: translateY(-50%);
}

.event-content {
  display: flex;
  align-items: baseline;
  gap: 4px;
  white-space: nowrap;
}

.event-minute {
  font-size: 11px;
  color: var(--main-color, #c0392b);
  font-weight: 700;
}

.event-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--main-color, #c0392b);
}

.event-player {
  font-size: 10px;
  color: gray;
}

/* Horizontal connector line */
.event-hline {
  flex-grow: 1;
  height: 0;
  border-top: 1.5px solid var(--main-color, #c0392b);
  min-width: 5px;
}

.team1-col .event-hline.to-beam {
  margin-right: -8px;
}

.team2-col .event-hline.to-beam {
  margin-left: -8px;
}

/* Bracket: vertical connector */
.bracket-vline {
  position: absolute;
  width: 0;
}

.team1-col .bracket-vline {
  right: 0;
  border-right: 1.5px solid var(--main-color, #c0392b);
}

.team2-col .bracket-vline {
  left: 0;
  border-left: 1.5px solid var(--main-color, #c0392b);
}

/* Bracket: horizontal tick to beam */
.bracket-tick {
  position: absolute;
  height: 0;
  border-top: 1.5px solid var(--main-color, #c0392b);
}

.team1-col .bracket-tick {
  right: -8px;
  width: 8px;
}

.team2-col .bracket-tick {
  left: -8px;
  width: 8px;
}

/* Vertical beam – solid red */
.timeline-beam {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 14px;
  flex-shrink: 0;
}

.beam-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--main-color, #c0392b);
  flex-shrink: 0;
}

.beam-line {
  flex-grow: 1;
  width: 3px;
  background-color: var(--main-color, #c0392b);
  border-radius: 2px;
}

/* Mobile */
@media (width <= 900px) {
  .event-label {
    font-size: 11px;
  }
  .event-player {
    font-size: 9px;
  }
}

@media (width <= 360px) {
  .timeline-body {
    min-height: 350px;
  }
  .event-minute {
    font-size: 10px;
  }
}
</style>
