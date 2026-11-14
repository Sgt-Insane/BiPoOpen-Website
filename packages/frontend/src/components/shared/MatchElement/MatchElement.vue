
<template>
    <div class="Match">

         <!-- Kopfzeile: Spielart-Chip, Datum und optionale Extras (z.B. Sieg/Niederlage) -->
         <div v-if="showHeader" class="mt-header">
            <span v-if="showChip" class="mt-chip" :class="`mt-chip--${resolvedGameType}`">{{ chipLabel ?? GAME_TYPE_LABELS[resolvedGameType] }}</span>
            <span v-if="showDate && match.time" class="mt-date">{{ formatGameTime(match.time) }}</span>
            <slot name="meta"/>
         </div>

         <!-- Team Name & Score -->
         <MatchElementTeam :match="match" :isTeam2="false" :playersVisible="playersVisible" :placeholder="team1Placeholder" :avatarShape="avatarShape" :elo="matchElo?.[0]" :fitTextGroup="nameFitGroup"/> <!-- Team 1 -->
         <MatchElementTeam :match="match" :isTeam2="true" :playersVisible="playersVisible" :placeholder="team2Placeholder" :avatarShape="avatarShape" :elo="matchElo?.[1]" :fitTextGroup="nameFitGroup"/> <!-- Team 2 -->

         <!-- Spielverlauf Timeline -->
         <MatchTimeline v-if="hasTurns && playersVisible" :match="match" />

         <!-- Fusszeile: Eintragen-Button (Backend) und Spielverlauf/Wuerfe auf-/zuklappen -->
         <div v-if="hasDetails || showEditButton" class="mt-footer">
            <div v-if="showEditButton" class="bp-button mt-button" @click="emit('edit', match)">{{ checkIfMatchFinished(match) ? 'Bearbeiten' : 'Eintragen'}}</div>
            <button v-if="hasDetails" type="button" class="mt-toggle" @click="togglePlayersVisible()">
               {{ toggleLabel }}
               <i class="pi" :class="playersVisible ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
            </button>
         </div>
    </div>
</template>

<script setup lang="ts">
import { PropType, computed, ref, useSlots } from "vue"
import MatchElementTeam from '@/components/shared/MatchElement/MatchElementTeam.vue';
import MatchTimeline from '@/components/shared/MatchElement/MatchTimeline.vue';
import { useEloRatings } from '@/components/shared/useEloRatings';
import { createFitTextGroup } from '@/components/shared/fitText';
import { checkIfMatchFinished } from "@/util/tournamentMatchFunctions";
import { formatGameTime } from "@/util/util";

type GameType = 'open' | 'league' | 'cup';

const GAME_TYPE_LABELS: Record<GameType, string> = {
   open: 'Offenes Spiel',
   league: 'Liga',
   cup: 'Cup',
};

const props = defineProps({
   match: {type: Object as PropType<Match>, required: true },
   // Backend: Button "Eintragen"/"Bearbeiten", die Seite oeffnet dafuer ihren GameEntryDrawer.
   isBackend: {type: Boolean, default: false},
   team1Placeholder: {type: String, default: undefined},
   team2Placeholder: {type: String, default: undefined},
   avatarShape: {type: String as () => 'circle' | 'square', default: 'circle'},
   // Kopfzeile im Element
   showDate: {type: Boolean, default: false},
   showChip: {type: Boolean, default: false},
   // Ohne Angabe aus dem Spiel abgeleitet: cupId -> Cup, season/league -> Liga, sonst offenes Spiel.
   gameType: {type: String as PropType<GameType>, default: undefined},
   // Eigener Chip-Text statt des Spielart-Labels (z.B. Quelle im Spielerprofil).
   chipLabel: {type: String, default: undefined},
   // Elo nach dem Spiel klein unter jedem Team
   showElo: {type: Boolean, default: false},
});

const emit = defineEmits<{ edit: [match: Match] }>();
const slots = useSlots();

const { loadEloRatings, getMatchElo } = useEloRatings();
if(props.showElo) loadEloRatings();
const matchElo = computed(() => props.showElo ? getMatchElo(props.match) : null);

// Beide Teamnamen werden gemeinsam verkleinert, damit sie immer gleich gross sind
const nameFitGroup = createFitTextGroup();

const resolvedGameType = computed<GameType>(() => {
   if(props.gameType) return props.gameType;
   if(props.match.cupId) return 'cup';
   if(props.match.season || props.match.league != undefined) return 'league';
   return 'open';
});

const showHeader = computed(() => props.showChip || (props.showDate && !!props.match.time) || !!slots.meta);
const showEditButton = computed(() => props.isBackend && !!props.match.team1 && !!props.match.team2);

const hasTurns = computed(() => !!props.match.turns && props.match.turns.length > 0);
const hasDetails = computed(() => {
   if(hasTurns.value) return true;
   if(!checkIfMatchFinished(props.match)) return false;
   return props.match.team1.players.length > 1 || props.match.team2.players.length > 1;
});

let playersVisible = ref(false);
// Knecht-Spiele haben einen Spielverlauf, sonst gibt es nur die Wuerfe je Spieler
const toggleLabel = computed(() => `${hasTurns.value ? 'Spielverlauf' : 'Würfe'} ${playersVisible.value ? 'ausblenden' : 'anzeigen'}`);
let togglePlayersVisible = () => {
   playersVisible.value = !playersVisible.value;
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

/*MOBILE*/
@media (width <= 900px){
   .Match{
      padding: 10px;
   }
   .mt-button{
      font-size: 13px;
   }
}
</style>
