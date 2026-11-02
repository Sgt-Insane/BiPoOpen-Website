<template>
  <div
    class="flex flex-col items-center justify-between w-full h-full relative select-none overflow-hidden"
    :style="{
      position: 'relative',
      zIndex: isActiveTeam ? 1001 : 1,
      transform: isTeam1 ? 'rotate(180deg)' : 'rotate(0deg)',
      height: isActiveTeam ? '46%' : '54%',
      transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }"
  >
    <!-- OPPONENT VIEW: Die 10 Becher von oben (Top-Down-Ansicht) -->
    <div
      v-show="!isActiveTeam"
      class="w-full flex-1 flex flex-col items-center justify-center py-2"
    >
      <!-- Becher-Gitter als Dreieck / Pyramide -->
      <div class="flex flex-col items-center justify-center gap-2 sm:gap-3">
        <div
          v-for="rowIndex in 4"
          :key="rowIndex"
          class="flex justify-center items-center gap-2 sm:gap-3"
        >
          <div
            v-for="circleIndex in rowIndex"
            :key="circleIndex"
            :id="`ra-cup-team-${teamIndex}-${game.cupIndexOf(rowIndex, circleIndex)}`"
            class="cup-top-down relative cursor-pointer flex items-center justify-center transition-all duration-150 transform active:scale-90"
            :class="{
              'cup-hit': isCupHit(game.cupIndexOf(rowIndex, circleIndex)),
              'cup-standing': !isCupHit(game.cupIndexOf(rowIndex, circleIndex))
            }"
            :style="{
              width: '64px',
              height: '64px',
              maxWidth: '17.5dvw',
              maxHeight: '17.5dvw',
              pointerEvents: isCupHit(game.cupIndexOf(rowIndex, circleIndex)) ? 'none' : 'auto'
            }"
            @click="game.performTurn('hit', game.cupIndexOf(rowIndex, circleIndex))"
          >
            <!-- Äußerer Becherrand (Plastikrand) -->
            <div
              class="cup-rim absolute inset-0 rounded-full"
              :style="{
                borderColor: getRimColor(rowIndex, circleIndex),
                backgroundColor: isCupHit(game.cupIndexOf(rowIndex, circleIndex)) ? '#d1d5db' : getLiquidColor()
              }"
            >
              <!-- Becher-Boden / Flüssigkeitsschatten -->
              <div class="cup-inner absolute inset-[5px] rounded-full flex items-center justify-center">
                <span
                  v-if="isCupHit(game.cupIndexOf(rowIndex, circleIndex))"
                  class="text-white text-base font-black opacity-80"
                >✕</span>
                <span
                  v-else
                  class="cup-shine absolute inset-0 rounded-full"
                ></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ACTIVE TEAM: Dart-Automat Kontrollleiste & Spielerauswahl -->
    <div
      v-show="isActiveTeam"
      class="w-full max-w-[500px] px-3 pb-3 pt-2 flex flex-col justify-end gap-2 bg-gradient-to-t from-white via-white/95 to-transparent"
    >
      <!-- Info-Banner (z.B. "Alice ist am Zug", "ON FIRE!") -->
      <div class="flex items-center justify-between px-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="font-extrabold text-sm sm:text-base text-gray-800 truncate">
            {{ game.infoText }}
          </span>
          <span
            v-if="currentFireStatus === 'on-fire'"
            class="on-fire-badge px-2 py-0.5 rounded-full text-xs font-black text-white shrink-0"
          >
            🔥 ON FIRE
          </span>
          <span
            v-else-if="currentFireStatus === 'heating-up'"
            class="heating-badge px-2 py-0.5 rounded-full text-xs font-bold text-orange-600 bg-orange-100 border border-orange-200 shrink-0"
          >
            🔥 Heating Up
          </span>
        </div>
        <span class="text-xs font-semibold text-gray-400 shrink-0 ml-2">
          Wurf {{ game.activePlayerIndex + 1 }}/{{ teamPlayers.length }}
        </span>
      </div>

      <!-- Spieler-Pills zum direkten Auswählen des Werfers -->
      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="(player, pIdx) in teamPlayers"
          :key="player._id || pIdx"
          @click="game.selectPlayer(pIdx)"
          class="cursor-pointer rounded-xl px-2.5 py-1.5 border-2 transition-all duration-200 flex items-center justify-between"
          :class="[
            game.activePlayerIndex === pIdx
              ? isTeam1
                ? 'bg-[#EA5160]/10 border-[#EA5160] shadow-sm'
                : 'bg-[#61C3D9]/10 border-[#61C3D9] shadow-sm'
              : 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-100'
          ]"
        >
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-1">
              <span class="font-bold text-xs sm:text-sm text-gray-900 truncate">
                {{ player.name }}
              </span>
              <!-- Flammen-Icon für diesen Spieler -->
              <span
                v-if="game.getPlayerFireStatus(teamIndex, pIdx) === 'on-fire'"
                class="text-sm animate-bounce"
                title="On Fire!"
              >🔥</span>
              <span
                v-else-if="game.getPlayerFireStatus(teamIndex, pIdx) === 'heating-up'"
                class="text-xs"
                title="Heating Up"
              >🔥</span>
            </div>
            <span class="text-[10px] text-gray-500">
              {{ game.activePlayerIndex === pIdx ? 'Aktiv' : 'Wählen' }} · Streak: {{ game.getPlayerStreak(teamIndex, pIdx) }}
            </span>
          </div>
          <div
            class="w-2.5 h-2.5 rounded-full shrink-0"
            :class="game.activePlayerIndex === pIdx ? (isTeam1 ? 'bg-[#EA5160]' : 'bg-[#61C3D9]') : 'bg-gray-300'"
          />
        </div>
      </div>

      <!-- Dart-Automat Tastenfeld: Nullwurf, Airball, Spezialwürfe -->
      <div class="flex flex-col gap-1.5">
        <!-- Haupt-Tasten: Große Fehlwurf-Buttons direkt am Daumen -->
        <div class="grid grid-cols-2 gap-2">
          <Button
            @click="game.performTurn('miss')"
            :id="`ra-null-team-${1 - teamIndex}`"
            class="!h-11 !rounded-xl !font-bold !text-sm flex items-center justify-center gap-1.5 shadow-xs !border-2 !border-gray-300 !bg-gray-100 !text-gray-700 active:!bg-gray-200"
            outlined
          >
            <span>✕</span>
            <span>Nullwurf</span>
          </Button>

          <Button
            @click="game.performTurn('airball')"
            :id="`ra-airball-team-${1 - teamIndex}`"
            class="!h-11 !rounded-xl !font-bold !text-sm flex items-center justify-center gap-1.5 shadow-xs !border-2 !border-blue-300 !bg-blue-50/70 !text-blue-600 active:!bg-blue-100"
            outlined
          >
            <span>💨</span>
            <span>Airball</span>
          </Button>
        </div>

        <!-- Modifiers: Bouncer & Trickshot -->
        <div class="grid grid-cols-2 gap-2">
          <Button
            @click="game.setModifier('bouncer')"
            :class="[
              '!h-9 !rounded-lg !text-xs !font-bold transition-all',
              game.modifier === 'bouncer'
                ? '!bg-amber-500 !border-amber-500 !text-white shadow-sm ring-2 ring-amber-300'
                : '!bg-white !border-gray-200 !text-gray-700 hover:!bg-gray-50'
            ]"
            outlined
          >
            <span class="flex items-center justify-center gap-1">
              <span>⚡</span>
              <span>Bouncer (2)</span>
            </span>
          </Button>

          <Button
            @click="game.setModifier('trickshot')"
            :class="[
              '!h-9 !rounded-lg !text-xs !font-bold transition-all',
              game.modifier === 'trickshot'
                ? '!bg-indigo-600 !border-indigo-600 !text-white shadow-sm ring-2 ring-indigo-300'
                : '!bg-white !border-gray-200 !text-gray-700 hover:!bg-gray-50'
            ]"
            outlined
          >
            <span class="flex items-center justify-center gap-1">
              <span>🎯</span>
              <span>Trickshot</span>
            </span>
          </Button>
        </div>

        <!-- Re-Rack & Deathcup (Kontext-Aktionen) -->
        <div class="flex items-center gap-2 mt-0.5">
          <Button
            v-if="game.reRackAvailable(teamIndex)"
            @click="game.performReRack(teamIndex)"
            class="flex-1 !h-8 !rounded-lg !text-xs !font-bold !bg-teal-600 !border-teal-600 !text-white hover:!bg-teal-700"
          >
            <span>🔄 Re-Rack</span>
          </Button>

          <Button
            @click="confirmDeathcup"
            class="!h-8 !px-2.5 !rounded-lg !text-[11px] !font-bold !border-red-300 !bg-red-50 !text-red-700 hover:!bg-red-100"
            :class="{ 'w-full': !game.reRackAvailable(teamIndex) }"
            outlined
            title="Sofortiges Spielende laut Regelwerk bei Treffer in bereits getrunkenen Becher"
          >
            <span>💀 Deathcup</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- Ballflug-Animationselemente -->
    <div :id="`ra-ball-team-${teamIndex}-0`" class="ra-ball" />
    <div :id="`ra-ball-team-${teamIndex}-1`" class="ra-ball" />
  </div>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue';
import Button from 'primevue/button';
import type { BiPoKnechtGame } from './useBiPoKnecht';

const props = defineProps({
  game: { type: Object as PropType<BiPoKnechtGame>, required: true },
  teamIndex: { type: Number, required: true }
});

const isTeam1 = computed(() => props.teamIndex === 0);
const isActiveTeam = computed(() => props.game.activeTeamIndex === props.teamIndex);

const teamPlayers = computed(() => {
  const team = props.teamIndex === 0 ? props.game.activeTeam : props.game.activeTeam;
  // Sicherstellen, dass das jeweilige Team korrekt adressiert wird
  const current = props.teamIndex === 0 ? (props.game as any).racks : null;
  return props.teamIndex === 0
    ? (props.game as any).match?.team1?.players ?? props.game.activeTeam.players
    : (props.game as any).match?.team2?.players ?? props.game.activeTeam.players;
});

// Berechne den aktuellen Fire-Status des aktiven Spielers
const currentFireStatus = computed(() => {
  return props.game.getPlayerFireStatus(props.game.activeTeamIndex, props.game.activePlayerIndex);
});

// Getroffene Becher dieses Racks
const cupsHit = computed(() => props.game.racks[props.teamIndex].hit);
const cupsPending = computed(() => props.game.racks[props.teamIndex].pending);

const isCupHit = (cupIndex: number) => {
  return cupsHit.value.includes(cupIndex) || cupsPending.value.includes(cupIndex);
};

const getRimColor = (row: number, position: number) => {
  const index = props.game.cupIndexOf(row, position);
  if (isCupHit(index)) return '#9ca3af';
  return isTeam1.value ? '#EA5160' : '#61C3D9';
};

const getLiquidColor = () => {
  return isTeam1.value ? '#ff6b7a' : '#7ad4e8';
};

const confirmDeathcup = () => {
  if (window.confirm('💀 DEATHCUP: Hat der Werfer wirklich einen getroffenen, noch nicht ausgetrunkenen Becher versenkt? Das Spiel endet sofort als Sieg!')) {
    props.game.performDeathcup();
  }
};
</script>

<style scoped>
/* Runder Top-Down Becher */
.cup-top-down {
  border-radius: 9999px;
  position: relative;
}

.cup-rim {
  border-width: 4px;
  border-style: solid;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15), inset 0 2px 4px rgba(255, 255, 255, 0.4);
}

.cup-inner {
  box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.25);
}

.cup-shine {
  background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 65%);
}

.cup-hit .cup-rim {
  border-color: #9ca3af !important;
  background-color: #e5e7eb !important;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Flammen & On-Fire Effekte */
.on-fire-badge {
  background: linear-gradient(135deg, #ef4444, #f97316, #eab308);
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
  animation: fireGlow 1s ease-in-out infinite alternate;
}

@keyframes fireGlow {
  from { box-shadow: 0 0 6px rgba(239, 68, 68, 0.5); }
  to { box-shadow: 0 0 14px rgba(249, 115, 22, 0.9); }
}

.ra-ball {
  width: 24px;
  height: 24px;
  opacity: 0;
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  background-color: #ffffff;
  border: 2px solid #1f2937;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  z-index: 2000;
  transition: all 0.25s cubic-bezier(0.25, 1, 0.5, 1);
}
</style>
