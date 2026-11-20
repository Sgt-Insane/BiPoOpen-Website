
<template>
    <div class="Match" :class="{ 'Match--compact': compact }">

         <!-- Kopfzeile: Spielart-Chip, Zeit und optionale Extras (z.B. Sieg/Niederlage) -->
         <div v-if="showHeader" class="mt-header">
            <span v-if="showChip" class="mt-chip" :class="`mt-chip--${resolvedGameType}`"><GlossaryWord :text="GAME_TYPE_LABELS[resolvedGameType]" /></span>
            <span v-if="timeLabel || modeLabel" class="mt-date">{{ [timeLabel, modeLabel].filter(Boolean).join(' · ') }}</span>
            <slot name="meta"/>
         </div>

         <!-- Team Name & Score -->
         <!-- Aufgeklappt: Elo-Aenderung je Spieler. Knecht-Doppel zeigen sie unten im Spieler-Tab, oben klappt dort nichts auf -->
         <MatchElementTeam :match="displayMatch" :isTeam2="false" :playersVisible="teamDetailsVisible" :placeholder="team1Placeholder" :elo="matchElo?.[0]" :showElo="eloVisible" :compact="compact" :fitTextGroup="nameFitGroup"/> <!-- Team 1 -->
         <MatchElementTeam :match="displayMatch" :isTeam2="true" :playersVisible="teamDetailsVisible" :placeholder="team2Placeholder" :elo="matchElo?.[1]" :showElo="eloVisible" :compact="compact" :fitTextGroup="nameFitGroup"/> <!-- Team 2 -->

         <!-- Spielverlauf Timeline -->
         <!-- displayMatch: Liga/Cup mit Team-Logos (Spieler-Tab zeigt dann das Logo statt eines Spielerbilds) -->
         <MatchTimeline v-if="hasTurns && playersVisible" :match="displayMatch" />

         <!-- Fusszeile: Eintragen-Button (Backend) und Spielverlauf/Wuerfe auf-/zuklappen -->
         <div v-if="hasDetails || showEditButton" class="mt-footer">
            <div v-if="showEditButton" class="bp-button mt-button" @click="emit('edit', match)">{{ checkIfMatchFinished(match) ? 'Bearbeiten' : 'Eintragen'}}</div>
            <button v-if="hasDetails" type="button" class="mt-toggle" :aria-expanded="playersVisible" @click="togglePlayersVisible()">
               {{ toggleLabel }}
               <i class="pi" :class="playersVisible ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
            </button>
         </div>
    </div>
</template>

<script setup lang="ts">
import { PropType, computed, ref, useSlots } from "vue"
import MatchElementTeam from '@/components/shared/MatchElement/MatchElementTeam.vue';
import GlossaryWord from '@/components/shared/GlossaryWord.vue';
import MatchTimeline from '@/components/shared/MatchElement/MatchTimeline.vue';
import { useEloRatings } from '@/components/shared/useEloRatings';
import { createFitTextGroup } from '@/components/shared/fitText';
import { checkIfMatchFinished } from "@/util/tournamentMatchFunctions";
import { formatGameClock, formatGameTime } from "@/util/util";
import { withLeagueTeamLogos } from '@/components/frontend/league/LeaguePlayersData';

// Seiten stellen nur ein, WAS angezeigt wird. Wie es aussieht (Logos, Elo, Zeitformat), entscheidet das Element,
// damit Spiele ueberall gleich aussehen.
type GameType = 'open' | 'league' | 'cup' | 'tournament';

const GAME_TYPE_LABELS: Record<GameType, string> = {
   open: 'Offenes Spiel',
   league: 'Liga',
   cup: 'Cup',
   tournament: 'BiPo Open',
};

const props = defineProps({
   match: {type: Object as PropType<Match>, required: true },
   // Backend: Button "Eintragen"/"Bearbeiten", die Seite oeffnet dafuer ihren GameEntryDrawer.
   isBackend: {type: Boolean, default: false},
   team1Placeholder: {type: String, default: undefined},
   team2Placeholder: {type: String, default: undefined},
   // Spielart: Chip-Text und bei Liga/Cup die Team-Logos. Ohne Angabe aus dem Spiel abgeleitet
   // (cupId -> Cup, season/league -> Liga, sonst offenes Spiel). Liga-Altdaten haben keine Felder, dort angeben.
   gameType: {type: String as PropType<GameType>, default: undefined},
   // Kopfzeile: Spielart-Chip
   showChip: {type: Boolean, default: false},
   // Kopfzeile: Zeitpunkt. 'date' = "18.10., 21:04 Uhr", 'clock' = "21:04 Uhr" (wenn das Datum schon drumherum steht)
   timestamp: {type: String as PropType<'date' | 'clock'>, default: undefined},
   // Elo nach dem Spiel unter jedem Team. Die Veraenderung durch das Spiel erst aufgeklappt.
   showElo: {type: Boolean, default: false},
   // Kompakte Variante fuer lange Listen und enge Stellen (Spieltag, KO-Baum): kleinere Logos und Schrift,
   // zugeklappt ohne Elo. Aufgeklappt wie gewohnt mit Elo je Spieler.
   compact: {type: Boolean, default: false},
});

const emit = defineEmits<{ edit: [match: Match] }>();
const slots = useSlots();

let playersVisible = ref(false);

// Elo zugeklappt unter den Teams, in der kompakten Variante nicht
const eloVisible = computed(() => props.showElo && !props.compact);

const { loadEloRatings, getMatchElo } = useEloRatings();
if(eloVisible.value) loadEloRatings();
// Aufgeklappt steht die Elo je Spieler bei den Spielern, auch ohne showElo
const matchElo = computed(() => eloVisible.value || playersVisible.value ? getMatchElo(props.match) : null);

// Beide Teamnamen werden gemeinsam verkleinert, damit sie immer gleich gross sind
const nameFitGroup = createFitTextGroup();

const resolvedGameType = computed<GameType>(() => {
   if(props.gameType) return props.gameType;
   if(props.match.cupId) return 'cup';
   if(props.match.season || props.match.league != undefined) return 'league';
   return 'open';
});

// Liga und Cup speichern Teams nur als Namen, die Logos kommen aus den Saisondaten.
// Nicht bei offenen Spielen: gleichnamige Spieler (z.B. "Michael Weck") bekaemen sonst das Team-Logo.
const displayMatch = computed(() =>
   resolvedGameType.value === 'league' || resolvedGameType.value === 'cup' ? withLeagueTeamLogos(props.match) : props.match
);

const timeLabel = computed(() => {
   if(!props.timestamp || !props.match.time) return '';
   return props.timestamp === 'clock' ? formatGameClock(props.match.time) : formatGameTime(props.match.time);
});

// Offene Spiele gibt es als 1 gegen 1 und im Doppel: "2 gegen 2" neben der Zeit (Liga/Cup/Turnier sind immer Teams)
const modeLabel = computed(() => {
   if(resolvedGameType.value !== 'open' || !timeLabel.value || !props.match.team1 || !props.match.team2) return '';
   return `${props.match.team1.players.length} gegen ${props.match.team2.players.length}`;
});

const showHeader = computed(() => props.showChip || !!timeLabel.value || !!slots.meta);
const showEditButton = computed(() => props.isBackend && !!props.match.team1 && !!props.match.team2);

const hasTurns = computed(() => !!props.match.turns && props.match.turns.length > 0);
// Aufgeklappte Teamzeilen (Spieler mit Wuerfen bzw. im 1 gegen 1 die Elo-Aenderung). Knecht-Doppel: das steht im Spieler-Tab.
const isTeamGame = computed(() => (props.match.team1?.players.length ?? 0) > 1 || (props.match.team2?.players.length ?? 0) > 1);
const teamDetailsVisible = computed(() => playersVisible.value && (!hasTurns.value || !isTeamGame.value));
const hasDetails = computed(() => {
   if(hasTurns.value) return true;
   if(!checkIfMatchFinished(props.match)) return false;
   return props.match.team1.players.length > 1 || props.match.team2.players.length > 1;
});

// Knecht-Spiele haben einen Spielverlauf, sonst gibt es nur die Wuerfe je Spieler
const toggleLabel = computed(() => playersVisible.value ? 'Einklappen' : `${hasTurns.value ? 'Spielverlauf' : 'Würfe'} anzeigen`);
let togglePlayersVisible = () => {
   playersVisible.value = !playersVisible.value;
   if(playersVisible.value) loadEloRatings();
}
</script>

<style scoped>
.Match{
   display: flex;
   flex-direction: column;
   gap: 6px;
   width: 100%;
   /* Namen brechen nicht um: ohne min-width 0 waere die Mindestbreite der ganze Name und das Element ragt in Grid/Flex heraus */
   min-width: 0;
   max-width: 100%;
   padding: 10px 12px;
   margin-bottom: 8px;
   background: var(--bp-surface);
   border: 1px solid var(--bp-border);
   border-radius: 12px;
   box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

/* Kopfzeile */
.mt-header{
   display: flex;
   align-items: center;
   flex-wrap: wrap;
   gap: 8px;
   min-height: 22px;
}
.mt-chip{
   padding: 2px 8px;
   border-radius: 6px;
   font-size: clamp(12px, 3.1vw, 13px);
   font-weight: 700;
   line-height: 18px;
}
.mt-chip--cup{
   background: var(--bp-primary-weak);
   color: var(--bp-primary-text);
}
.mt-chip--league{
   background: var(--secondary-color-weak);
   color: var(--bp-secondary-text);
}
.mt-chip--open{
   background: var(--bp-fill);
   color: var(--bp-text);
}
.mt-chip--tournament{
   background: var(--bp-navy-weak);
   color: var(--bp-navy);
}
.mt-date{
   font-size: clamp(12px, 3.1vw, 13px);
   color: var(--p-text-muted-color);
}

/* Fusszeile */
.mt-footer{
   display: flex;
   align-items: center;
   gap: 10px;
}
.mt-toggle{
   display: flex;
   align-items: center;
   gap: 6px;
   margin-left: auto;
   padding: 2px 0;
   background: none;
   border: 0;
   font-size: 13px;
   font-weight: 600;
   color: var(--bp-text);
   cursor: pointer;
}
.mt-toggle .pi{
   font-size: 11px;
}
.mt-button{
   font-size: 14px;
   padding: 4px 12px;
   text-align: center;
}

/* Kompakte Variante */
.Match--compact{
   gap: 2px;
   padding: 6px 10px;
   margin-bottom: 6px;
   border-radius: 10px;
   box-shadow: none;
}
.Match--compact .mt-header{
   min-height: 18px;
}
.Match--compact .mt-chip{
   padding: 1px 6px;
   font-size: 11px;
   line-height: 16px;
}
.Match--compact .mt-date{
   font-size: 11px;
}
.Match--compact .mt-toggle{
   font-size: 12px;
}

/*MOBILE*/
@media (width <= 900px){
   .Match:not(.Match--compact){
      padding: 10px;
   }
   .mt-button{
      font-size: 13px;
   }
}
</style>
