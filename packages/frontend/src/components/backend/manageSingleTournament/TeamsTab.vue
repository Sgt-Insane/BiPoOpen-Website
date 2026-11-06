
<template>
   <div class="ParticipantsTab">
      
      <div class="bp-button" @click="toggleModalCreateTeam()">Team hinzufügen</div>

      <!-- Add -->
      <Transition name="fade">
         <Modal v-if="showModalCreateTeam">
            <template #title>Team hinzufügen</template>
            <template #template>
               <div>Teamname</div>
               <input type="text" v-model="teamnameInput">

               <div>Spieler 1</div>
               <input type="text" v-model="player1Input">

               <div>Spieler 2</div>
               <input type="text" v-model="player2Input">

               <div>Team Logo</div>
               <div
                  style="flex-shrink: 0; width: 80px; height: 80px; margin-bottom: 20px; border: 1px solid var(--bp-border); display: flex; align-items: center; justify-content: center; background: #f9f9f9; overflow: hidden; cursor: pointer;"
                  @click="triggerLogoUpload()"
               >
                  <img v-if="teamLogoPreview" :src="teamLogoPreview" style="width: 100%; height: 100%; object-fit: contain;" />
                  <span v-else class="material-icons" style="color: var(--bp-text-faint); font-size: 28px;">groups</span>
               </div>

            </template>
            <template #cancle>
               <div @click="toggleModalCreateTeam()">Abbrechen</div>
            </template>
            <template #confirm>
               <div @click="addTeamButton()">Hinzufügen</div>
            </template>
         </Modal>
      </Transition>

      <!-- Edit -->
      <Transition name="fade">
         <Modal v-if="showModalEditTeam">
            <template #title>Team Bearbeiten</template>
            <template #template>
            <div>Teamname</div>
               <input type="text" v-model="teamnameInput">

               <div>Spieler 1</div>
               <input type="text" v-model="player1Input">

               <div>Spieler 2</div>
               <input type="text" v-model="player2Input">

               <div>Team Logo</div>
               <div
                  style="flex-shrink: 0; width: 80px; height: 80px; margin-bottom: 20px; border: 1px solid var(--bp-border); display: flex; align-items: center; justify-content: center; background: #f9f9f9; overflow: hidden; cursor: pointer;"
                  @click="triggerLogoUpload()"
               >
                  <img v-if="teamLogoPreview" :src="teamLogoPreview" style="width: 100%; height: 100%; object-fit: contain;" />
                  <span v-else class="material-icons" style="color: var(--bp-text-faint); font-size: 28px;">groups</span>
               </div>

               <button @click="toggleModalConfirmDelete();">Team löschen</button>
            </template>
            <template #cancle>
               <div @click="toggleModalEditTeam()">Abbrechen</div>
            </template>
            <template #confirm>
               <div @click="editTeamButton()">Bearbeiten</div>
            </template>
         </Modal>
      </Transition>

      <!-- Confirm Delete -->
      <Transition name="fade">
         <Modal v-if="showModalConfirmDelete">
            <template #title>Team Löschen</template>
            <template #template>
               <p style="text-align: center;">Sicher das das Team gelöscht werden soll?</p>
            </template>
            <template #cancle>
               <div @click="toggleModalConfirmDelete();">Abbrechen</div>
            </template>
            <template #confirm>
               <div @click="removeTeamButton()">Löschen</div>
            </template>
         </Modal>
      </Transition>

      <!-- Hidden file input for logo upload -->
      <input
         ref="logoInputRef"
         type="file"
         accept="image/png,image/jpeg,image/webp"
         style="display: none;"
         @change="onLogoChange"
      />

      <!-- Edit Logo dialog -->
      <ImageCropDialog
         v-model:visible="cropDialogVisible"
         :src="cropSrc"
         stencil="rectangle"
         :output-size="600"
         output-format="png"
         header="Logo zuschneiden"
         @cropped="onLogoCropped"
      />

      <!-- Team List -->
      <table class="table table-hover">
         <thead>
            <tr class="text-left">
               <th>#</th>
               <th>Logo</th>
               <th>Teamname</th>
               <th>Spieler</th>
            </tr>
         </thead>
         <tbody>
            <tr class="text-left" v-for="(team, id) in tournament.teams" @click="toggleModalEditTeam(team)" :key="team.name">
               <td>{{ id + 1 }}</td>
               <td>
                  <Avatar class="min-w-[65px] min-h-[65px] mr-[10px]" :name="team.name!" :avatarImage="team.logo" :size="'xlarge'" :shape="'square'"/>
               </td>
               <td>{{ team.name }}</td>
               <td>
                  <span v-for="player in team.players" style="margin-right: 15px" :key="player.name">{{ player.name }}</span>
               </td>
            </tr>
         </tbody>
      </table>

   </div>
</template>

<script setup lang="ts">
import { PropType, ref } from "vue"
import Modal from '@/components/shared/Modal.vue';
import { addTeam, editTeam, removeTeam } from "@/util/tournamentTeamFunctions";
import Avatar from '@/components/shared/Avatar.vue';
import ImageCropDialog from '@/components/shared/ImageCropDialog.vue';
import { uploadTeamLogo } from '@/util/supabaseStorage';

const props = defineProps({
   getTournament: {type: Function, required: true },
   tournament: {type: Object as PropType<Tournament>, required: true }
});

let showModalCreateTeam = ref(false);
let showModalConfirmDelete = ref(false);
let showModalEditTeam = ref(false);

let teamnameInput = ref("");
let teamLogoInput = ref("");
let teamLogoPreview = ref("");
let player1Input = ref("");
let player2Input = ref("");

const cropDialogVisible = ref(false);
const cropSrc = ref('');
const logoInputRef = ref<HTMLInputElement | null>(null);

const addTeamButton = async () => {
   let team = {name: teamnameInput.value.trim(), logo: teamLogoInput.value, players: [player1Input.value.trim(), player2Input.value.trim()]}
   let success = await addTeam(props.tournament._id, team);
   if(success){
      await props.getTournament();
      toggleModalCreateTeam();
   }
}

let selectedTeam = ref();
const editTeamButton = async () => {
   let team = {name: teamnameInput.value.trim(), logo: teamLogoInput.value, players: [player1Input.value.trim(), player2Input.value.trim()], _id: selectedTeam.value._id, teamID: selectedTeam.value._id}
   // @ts-ignore
   let success = await editTeam(props.tournament._id, team);
   if(success){
      await props.getTournament();
      toggleModalEditTeam();
   }
}

const removeTeamButton = async () => {
   let success:boolean = await removeTeam(props.tournament._id, selectedTeam.value._id);
   if(success){
      props.getTournament();
      toggleModalEditTeam();
      toggleModalConfirmDelete();
   }
}

const triggerLogoUpload = () => {
   logoInputRef.value?.click();
};

const onLogoChange = (event: Event) => {
   const input = event.target as HTMLInputElement;
   const file = input.files?.[0];
   if (!file) return;

   if (file.size > 2 * 1024 * 1024) {
      input.value = '';
      return;
   }

   const reader = new FileReader();
   reader.onload = (e) => {
   cropSrc.value = e.target?.result as string;
   cropDialogVisible.value = true;
   };
   reader.readAsDataURL(file);
   input.value = '';
};

const onLogoCropped = async (dataUrl: string) => {
   teamLogoPreview.value = dataUrl;
   try {
      teamLogoInput.value = await uploadTeamLogo(dataUrl);
   } catch (error) {
      console.error("Logo-Upload fehlgeschlagen", error);
      teamLogoInput.value = "";
      teamLogoPreview.value = "";
   }
};

const toggleModalConfirmDelete = () => {
   showModalConfirmDelete.value = !showModalConfirmDelete.value;
}

const toggleModalCreateTeam = () => {
   teamnameInput.value = "";
   teamLogoInput.value = "";
   teamLogoPreview.value = "";
   player1Input.value = "";
   player2Input.value = "";

   showModalCreateTeam.value = !showModalCreateTeam.value;
}

const toggleModalEditTeam = (team?:Team) => {
   if(team){
      teamnameInput.value = team.name!;
      player1Input.value = team.players[0].name;
      player2Input.value = team.players[1].name;
      teamLogoInput.value = team.logoId ? team.logoId : "";
      teamLogoPreview.value = team.logo ? team.logo : "";

      selectedTeam.value = team;
   }

   showModalEditTeam.value = !showModalEditTeam.value;
}
</script>

<style scoped>
.bp-button{
   margin-top: 20px;
}

table{
   text-align: center;
}
table th{
   font-size: 20px;
   font-weight: bold;
}
table td{
   cursor: pointer;
}
table td:nth-child(1){
   max-width: 20px;
   width: 20px;
}
</style>