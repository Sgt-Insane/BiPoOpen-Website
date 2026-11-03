
<template>
    <div class="Tournament">

        <!-- Skelett, bis das Turnier geladen ist: Name steht schon in der URL -->
        <div v-if="!tournament" aria-busy="true">
            <h1 class="bp-title bp-white-band bp-white-band--top">{{ route.params.TournamentName }}</h1>
            <div class="to-skeleton-tabs bp-white-band">
                <div class="bp-skeleton" style="width: 110px"></div>
                <div class="bp-skeleton" style="width: 90px"></div>
                <div class="bp-skeleton" style="width: 50px"></div>
            </div>
            <div v-for="i in 3" :key="i" class="bp-skeleton to-skeleton-group"></div>
        </div>

        <div v-if="tournament && tournament.groupPhase.groups">

            <h1 class="bp-title bp-white-band bp-white-band--top">{{ tournament.name }}</h1>

            <!-- Tabs (lazy: nur der aktive Reiter wird gerendert, z.B. Fotos erst beim Oeffnen) -->
            <Tabs v-model:value="place" lazy @update:value="changeRouter">
               <!-- Reiter kleben unter dem App-Header -->
               <div ref="stickyBar" class="to-sticky-bar bp-white-band" :style="{ top: stickyBarTop }">
                  <TabList>
                     <!-- <Tab value="Teams">Teams</Tab> -->
                     <Tab value="Gruppenphase">Gruppenphase</Tab>
                     <Tab value="K.o.Phase">K.o.Phase</Tab>
                     <Tab v-if="tournament.settings.trackPlayerShots" value="MVP">MVP</Tab>
                     <Tab v-if="getTournamentPhotos()" value="Fotos">Fotos</Tab>
                  </TabList>
               </div>
               <TabPanels class="!px-0 !pb-0 !pt-[20px]">
                  <!-- Laufendes Turnier (Finale noch offen): Ergebnisse per Push -->
                  <PushPromptCard
                     v-if="isLive"
                     class="to-push-prompt"
                     title="Ergebnisse live aufs Handy?"
                     text="Push für jedes Spiel in Gruppe und K.o.-Phase"
                     :to="{ path: PUSH_SETTINGS_PATH, query: { kategorie: 'tournamentResults' } }"
                     :dismissKey="`bp-push-prompt-tournament-${tournament._id}`"
                  />
                  <!-- <TabPanel value="Teams">
                     <Teams :tournament="tournament"/>
                  </TabPanel> -->
                  <TabPanel value="Gruppenphase">
                     <ScheduleGroups :getTournament="getTournament" :tournament="tournament" :isBackend="false"/>
                  </TabPanel>
                  <TabPanel value="K.o.Phase">
                     <KOSchedule :getTournament="getTournament" :tournament="tournament" :isBackend="false"/>
                  </TabPanel>
                  <TabPanel v-if="tournament.settings.trackPlayerShots" value="MVP">
                     <MVP :tournament="tournament"/>
                  </TabPanel>
                  <TabPanel v-if="getTournamentPhotos()" value="Fotos">
                     <Photos :tournamentPhotos="getTournamentPhotos()"/>
                  </TabPanel>
               </TabPanels>
            </Tabs>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, Ref } from "vue"
import { getTournamentByName, getTournamentPodium } from "@/util/tournamentFunctions"
// import Teams from '@/components/frontend/tournament/Teams.vue';
import ScheduleGroups from '@/components/frontend/tournament/ScheduleGroups.vue';
import KOSchedule from '@/components/frontend/tournament/KOSchedule.vue';
import MVP from '@/components/frontend/tournament/MVP.vue';
import Photos from '@/components/frontend/tournament/photos/_Photos.vue';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import { useStickyBar } from '@/components/shared/useStickyStack';
import { useGrayPage } from '@/components/shared/useGrayPage';
import PushPromptCard from '@/components/shared/PushPromptCard.vue';
import { PUSH_SETTINGS_PATH } from '@/components/shared/usePushNotifications';

import { useRoute } from "vue-router";
const route = useRoute()

useGrayPage();

const stickyBar = ref<HTMLElement | null>(null);
const stickyBarTop = useStickyBar(stickyBar);

let tournament = ref<Tournament|undefined>();

// Turniertag: Finale noch offen und Turnier aus diesem Jahr (alte, nie beendete Turniere nicht)
const isLive = computed(() =>
   !!tournament.value
   && tournament.value.name.includes(String(new Date().getFullYear()))
   && !getTournamentPodium(tournament.value).length
);

let place:Ref<"Teams"|"Gruppenphase"|"K.o.Phase"|"MVP"|"Fotos"> = ref("Gruppenphase");
let name = route.path.split("/").pop();
if(name == "Teams")
   place.value = "Teams";
else if(name == "Gruppenphase")
   place.value = "Gruppenphase";
else if(name == "K.o.Phase")
   place.value = "K.o.Phase";
else if(name == "MVP")
   place.value = "MVP";
else if(name == "Fotos")
   place.value = "Fotos";

const getTournament = async () => {
   tournament.value = await getTournamentByName(route.params.TournamentName as string);

   // Beendete Turniere (Finale entschieden) aendern sich nicht mehr
   if(tournament.value && getTournamentPodium(tournament.value).length)
      clearInterval(updateInterval);
}

let updateInterval = setInterval(() => {
   getTournament();
}, 60000);
getTournament()

onUnmounted(() => {
   clearInterval(updateInterval);
});

const changeRouter = (path:string|number) => {
   let newURL = window.location.origin + "/" + route.params.TournamentName + '/' + path;
   window.history.replaceState({ ...window.history.state, as: newURL, url: newURL }, '', newURL);
   window.scrollTo({top: 0, behavior: 'instant' });
};

const getTournamentPhotos = () => {
   if(tournament.value!.name == "Weck BiPo Open 2026"){
      return {
			driveImageIDs: new URL(`/src/assets/2026/driveImageIDs.json`, import.meta.url),
		}
   }

   if(tournament.value!.name == "Weck BiPo Open 2025"){
      return {
			driveImageIDs: new URL(`/src/assets/2025/driveImageIDs.json`, import.meta.url),
			poster: new URL(`/src/assets/2025/poster.jpg`, import.meta.url),
         text: `
            Ein riesiges Dankeschön geht an Patrik Finger, der auch beim Weck BiPo Open 2025 als Fotograf mit am Start war.
            <br>
            Schaut gern auf seinem Instagram-Profil vorbei:
            <a href="https://www.instagram.com/fingerontrigger" target="_blank">@fingerontrigger</a>
         `
		}
   }

   if(tournament.value!.name == "Weck BiPo Open 2024"){
      return {
			driveImageIDs: new URL(`/src/assets/2024/driveImageIDs.json`, import.meta.url),
			poster: new URL(`/src/assets/2024/poster.jpg`, import.meta.url),
         text: `
            Ein großes Dankeschön an Patrik Finger, der am Weck BiPo Open 2024 wieder als Fotograf tätig war. 
            <br>
            Folgt ihm gerne auf Instagram 
            <a href="https://www.instagram.com/fingerontrigger" target="_blank">@fingerontrigger</a>  
         `
		}
   }

   if(tournament.value!.name == "Weck BiPo Open 2023"){
      return {
			driveImageIDs: new URL(`/src/assets/2023/driveImageIDs.json`, import.meta.url),
			poster: new URL(`/src/assets/2023/poster.jpg`, import.meta.url),
         text: `
            Ein großes Dankeschön an Patrik Finger, der am Weck BiPo Open 2023 über 1500 Fotos geschossen hat. 
            <br>
            Folgt ihm gerne auf Instagram 
            <a href="https://www.instagram.com/fingerontrigger" target="_blank">@fingerontrigger</a>
         `
		}
   }

   if(tournament.value!.name == "Weck BiPo Open 2022"){
      return {
            driveImageIDs: new URL(`/src/assets/2022/driveImageIDs.json`, import.meta.url),
            poster: new URL(`/src/assets/2022/poster.jpg`, import.meta.url)
         }
   }

   if(tournament.value!.name == "Weck BiPo Open 2021"){
      return {
            driveImageIDs:  new URL(`/src/assets/2021/driveImageIDs.json`, import.meta.url),
            poster: new URL(`/src/assets/2021/poster.jpg`, import.meta.url)
         }
   }

   if(tournament.value!.name == "Weck BiPo Open 2020"){
      return {
            driveImageIDs:  new URL(`/src/assets/2020/driveImageIDs.json`, import.meta.url),
            poster: new URL(`/src/assets/2020/poster.jpg`, import.meta.url)
         }
   }
}
</script>

<style scoped>
.to-push-prompt{
   margin-bottom: 16px;
}
.to-sticky-bar{
   position: sticky;
   z-index: 3;
}
:deep(.p-tabs){
   padding-bottom: 30px;
}
.to-skeleton-tabs{
   display: flex;
   gap: 24px;
   padding-bottom: 12px;
   border-bottom: 1px solid #eef0f2;

   .bp-skeleton{
      height: 16px;
      border-radius: 6px;
   }
}
.to-skeleton-group{
   height: 220px;
   margin-top: 20px;
}
/* MOBILE */
@media (width <= 900px){
   :deep(.p-tab){
      font-size: 15px;
   }
}
</style>
