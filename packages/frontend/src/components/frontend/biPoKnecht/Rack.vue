<template>
  <div
    class="flex flex-col items-center justify-end w-full"
    :style="{
      position: 'relative',
      zIndex: isActiveTeam ? 1001 : 1,
      transform: isTeam1 ? 'rotate(180deg)' : 'rotate(0deg)',
      height: isActiveTeam ? '30%' : '70%'
    }"
  >

    <!-- ACTIVE TEAM: Control card -->
    <div v-show="isActiveTeam" class="w-[80%] bg-(--bp-surface) rounded-t-2xl px-4 pt-4 pb-3 shadow-sm flex flex-col gap-2">
      <!-- Player name + throw indicator -->
      <div class="flex flex-col align-items justify-center pb-3">
        <span class="text-center text-lg font-bold text-base text-(--bp-text-strong)">{{ game.infoText }}</span>
        <span class="text-center text-xs text-(--bp-text-faint) ml-2 shrink-0">Wurf {{ game.activePlayerIndex + 1 }}/{{ game.activeTeam.players.length }}</span>
      </div>

      <!-- Re-Rack button -->
      <Button
        v-if="game.reRackAvailable(teamIndex)"
        @click="game.performReRack(teamIndex)"
        label="Re-Rack — neu stellen"
        class="w-full !bg-[#2da8a8] !border-[#2da8a8] !text-white !font-semibold"
      />

      <!-- Bouncer / Trickshot / more -->
      <div class="flex gap-2 items-center">
        <Button
          @click="game.setModifier('bouncer')"
          :class="[
            'flex-1 !rounded-full !text-sm !py-[6px]',
            game.modifier === 'bouncer'
              ? '!bg-orange-500 !border-orange-500 !text-white'
              : '!bg-(--bp-surface) !border-(--bp-border-strong) !text-(--bp-text)'
          ]"
          outlined
        >
          <span class="flex items-center justify-center gap-1">
            <span v-if="game.modifier === 'bouncer'" class="w-2 h-2 rounded-full bg-white inline-block shrink-0" />
            <span v-else class="w-2 h-2 rounded-full bg-orange-400 inline-block shrink-0" />
            Bouncer
          </span>
        </Button>

        <Button
          @click="game.setModifier('trickshot')"
          :class="[
            'flex-1 !rounded-full !text-sm !py-[6px]',
            game.modifier === 'trickshot'
              ? '!bg-orange-500 !border-orange-500 !text-white'
              : '!bg-(--bp-surface) !border-(--bp-border-strong) !text-(--bp-text)'
          ]"
          outlined
        >
          <span class="flex items-center justify-center gap-1">
            <span v-if="game.modifier === 'trickshot'" class="w-2 h-2 rounded-full bg-white inline-block shrink-0" />
            <span v-else class="w-2 h-2 rounded-full bg-orange-400 inline-block shrink-0" />
            Trickshot
          </span>
        </Button>
      </div>
    </div>

    <!-- OPPONENT: Nullwurf -->
    <div v-show="!isActiveTeam" class="rotate-180 w-[calc(100%-10px)] mb-2">
      <Button
        @click="game.performTurn('miss')"
        :id="`ra-null-team-${teamIndex}`"
        class="w-full !bg-transparent !border-2 !border-dashed !border-[#61C3D9] !text-[#61C3D9] !font-semibold !rounded-none"
        outlined
        label="Nullwurf"
      />
    </div>

    <!-- Cups grid -->
    <div
      class="w-full flex flex-col items-center justify-end"
      :style="{
        opacity: isActiveTeam ? '0.3' : '1',
        pointerEvents: isActiveTeam ? 'none' : 'auto'
      }"
    >
      <div
        v-for="rowIndex in 4"
        :key="rowIndex"
        class="flex justify-center items-end"
        style="gap: 3%"
      >
        <div
          v-for="circleIndex in rowIndex"
          :key="circleIndex"
          :id="`ra-cup-team-${teamIndex}-${game.cupIndexOf(rowIndex, circleIndex)}`"
          class="relative cursor-pointer [clip-path:polygon(10%_0%,90%_0%,82%_100%,18%_100%)]"
          :style="{
            width: isActiveTeam ? '13dvw' : '17dvw',
            height: isActiveTeam ? '16dvw' : '21dvw',
            backgroundColor: getCupColor(rowIndex, circleIndex),
            pointerEvents: cupsHit.includes(game.cupIndexOf(rowIndex, circleIndex)) ? 'none' : 'auto'
          }"
          @click="game.performTurn('hit', game.cupIndexOf(rowIndex, circleIndex))"
        >
          <span
            v-if="cupsHit.includes(game.cupIndexOf(rowIndex, circleIndex))"
            class="absolute inset-0 flex items-center justify-center text-white font-bold"
            :style="{ fontSize: isActiveTeam ? '3dvw' : '4dvw' }"
          >✓</span>
        </div>
      </div>
    </div>

    <!-- OPPONENT: Airball -->
    <div v-show="!isActiveTeam" class="rotate-180 w-[calc(100%-10px)] mt-2">
      <Button
        @click="game.performTurn('airball')"
        :id="`ra-airball-team-${teamIndex}`"
        class="w-full !bg-transparent !border-2 !border-dashed !border-[#61C3D9] !text-[#61C3D9] !font-semibold !rounded-none"
        outlined
        label="Airball"
      />
    </div>

    <!-- Ball animation elements -->
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

// This rack's own cups that are already knocked down.
const cupsHit = computed(() => props.game.racks[props.teamIndex].hit);

const getCupColor = (row: number, position: number) => {
  if (cupsHit.value.includes(props.game.cupIndexOf(row, position)))
    return 'gray';
  return isTeam1.value ? 'var(--main-color)' : 'var(--secondary-color)';
};
</script>

<style scoped>
.ra-ball {
  width: 30px;
  height: 30px;
  opacity: 0;
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  background-color: var(--bp-surface);
  border: 1px solid var(--bp-text-strong);
}
</style>
