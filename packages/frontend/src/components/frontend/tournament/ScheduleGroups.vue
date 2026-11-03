<template>
      <div style="text-align: center; font-size: 18px; color: var(--main-color);" v-if="tournament.groupPhase.groups.length == 0">
         Gruppenphase noch nicht verfügbar
      </div>

      <div v-else>
         <div ref="pagination" class="swiper-pagination" id="GameScheduleGroupsSwiper-Pagination" :style="{ top: paginationTop }"/>

         <div class="GameScheduleGroups swiper-container" id="GameScheduleGroupsSwiper">
            <div class="swiper-wrapper">

               <div class="rt-table swiper-slide" v-for="(group, groupIndex) in groupsWithStats" :key="groupIndex" :id="'Match-Table-'+groupIndex">

                  <!-- Caption -->
                  <div class="rt-caption">{{ "Gruppe " + convertNumberToCharacter(groupIndex + 1)}}</div>

                  <StandingsGroups :tournament="tournament" :group="group"/>

                  <div class="rt-caption">Spiele</div>

                  <!-- Matches -->
                  <div class="rt-matches">
                     <MatchElement v-for="(match) in tournament.groupPhase.matches[groupIndex]" :key="match._id" 
                        :match="match" 
                        :isBackend="isBackend"
                        @edit="openEdit"
                        :avatarShape="'square'"
                     />
                  </div>

               </div>
            </div>
         </div>

         <GameEntryDrawer v-if="isBackend"
            v-model:visible="editVisible"
            :title="editingMatch && checkIfMatchFinished(editingMatch) ? 'Spiel bearbeiten' : 'Spiel eintragen'"
            :subtitle="`${tournament.name} · Gruppenphase`"
            :initialSides="editSides"
            :sideLabels="['Team 1', 'Team 2']"
            lockedNames
            avatarShape="square"
            :save="saveGameResult"
         />
      </div>
</template>

<script setup lang="ts">
import Sortable from "sortablejs";
import { computed, onMounted, PropType, ref, watch } from "vue"
import { convertNumberToCharacter } from "@/util/util.js";
import MatchElement from '@/components/shared/MatchElement/MatchElement.vue';
import GameEntryDrawer from '@/components/shared/GameEntry/GameEntryDrawer.vue';
import { applySidesToMatch, useMatchEdit, type GameEntrySide } from '@/components/shared/GameEntry/gameEntry';
import { checkIfMatchFinished } from '@/util/tournamentMatchFunctions';
import StandingsGroups from '@/components/frontend/tournament/StandingsGroups.vue';
import { useStickyBar } from '@/components/shared/useStickyStack';
import { setMatchesGroupPhase, getGroupsWithStats, setGameResultGroupPhase } from "@/util/tournamentGroupFunctions";

import Swiper from 'swiper';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

const props = defineProps({
   getTournament: {type: Function, required: true },
   tournament: {type: Object as PropType<Tournament>, required: true },
   isBackend: {type: Boolean, required: true },
});

// Die Gruppenauswahl klebt unter den Reitern, die Gruppentabellen darunter.
const pagination = ref<HTMLElement | null>(null);
const paginationTop = useStickyBar(pagination);

// Nur neu berechnen, wenn sich das Turnier aendert, nicht bei jedem Render
const groupsWithStats = computed(() => getGroupsWithStats(props.tournament));

const onDragEnd = async (evt:Sortable.SortableEvent) => {

   // Get Index of Group via Group Caption html element
   let groupCaption = (evt.target.parentElement!.getElementsByClassName("rt-caption")[0] as HTMLDivElement).innerText;
   let groupIndex = groupCaption.split(" ")[1].toLowerCase().charCodeAt(0) - 97;

   let matches = props.tournament.groupPhase.matches;
   let matchesInGroup = matches[groupIndex];
   let movedMatch = matchesInGroup.splice(evt.oldIndex!,1);
   matchesInGroup.splice(evt.newIndex!, 0, movedMatch[0]);

   let success:boolean = await setMatchesGroupPhase(props.tournament._id, matches);
   if(success){
      await props.getTournament();
      initSortable();
   }
}

const initSortable = () => {
   setTimeout(() => { 
      let groupAmmount:number = props.tournament.settings.fixedGroupAmmount;
      for (let i = 0; i < groupAmmount; i++){
         let matchesForGroupDOM = document.getElementById("Match-Table-"+i)!.getElementsByClassName("rt-matches")[0] as HTMLDivElement;
         new Sortable(matchesForGroupDOM, {
            animation: 100,
            group: "_" + i ,
            onEnd: onDragEnd,
            filter: '.Modal',
            preventOnFilter: false,
            handle: ".mt-handle"
         });
      }
   }, 0);
}

watch(() => props.tournament, () => {
   if(props.tournament.groupPhase.groups && props.isBackend)
      initSortable();
});

onMounted(() => {
   if(props.tournament && props.tournament.groupPhase.groups && props.isBackend)
      initSortable();

   new Swiper('#GameScheduleGroupsSwiper',{
      modules: [Pagination],
      initialSlide: 0,
      allowTouchMove: !props.isBackend,
      spaceBetween: 50,
      speed: 500,
      // Auf der Tabelle wischt der Finger die Tabelle seitlich, nicht den Slider
      noSwipingSelector: '.p-datatable-table-container',
      pagination: {
         el: "#GameScheduleGroupsSwiper-Pagination",
         clickable: true,
         renderBullet: (index, className) => {
            return '<span class="' + className + '">' + convertNumberToCharacter(index+1) + '</span>';
         }
      }
   });
});

const { editingMatch, editVisible, editSides, openEdit } = useMatchEdit();

const saveGameResult = async (sides: GameEntrySide[]) => {
   await setGameResultGroupPhase(props.tournament, applySidesToMatch(editingMatch.value!, sides));
   await props.getTournament();

   return true;
}
</script>

<style>
.GameScheduleGroups{
   overflow: clip;
}
.rt-caption{
   margin-bottom: 10px;
   font-size: 28px;
   font-weight: bold;
   color: var(--main-color);
}

/* Top Swiper Pagination */
#GameScheduleGroupsSwiper-Pagination{
   position: sticky;
   padding-bottom: 20px;
   display: flex;
   background-color: var(--page-gray);
}
#GameScheduleGroupsSwiper-Pagination .swiper-pagination-bullet, .Standings .swiper-pagination-bullet{
	padding: 5px 10px; 
	border-radius: 0;
	width: auto;
   height: auto;
	text-align: center;
	color: var(--secondary-color);
   background-color: transparent;
   opacity: 1; 
   margin: 0;
   flex: 1 1 0;
   text-align: center;
}
#GameScheduleGroupsSwiper-Pagination .swiper-pagination-bullet-active, .Standings .swiper-pagination-bullet-active{
	color:white;
	background: var(--main-color);
}

/* MOBILE */
@media (width <= 900px){
   .rt-caption{
      font-size: 22px;
   }
}
</style>
