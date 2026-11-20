<template>
    <div class="ProfilePicker">
        <div v-if="profileName && !editing" class="pp-current">
            <Avatar :name="profileName" class="pp-avatar" :lazy="false" />
            <div class="pp-current-text">
                <span class="pp-current-name">{{ profileName }}</span>
                <span v-if="leagueTeam" class="pp-current-detail">{{ leagueTeam.teamName }} · {{ leagueTeam.divisionLabel }}</span>
                <span v-else class="pp-current-detail">Spielt auf diesem Handy</span>
            </div>
            <button type="button" class="pp-change" @click="startEdit">Ändern</button>
        </div>

        <form v-else class="pp-edit" @submit.prevent="save">
            <label class="pp-label" for="pp-name">Wer spielt auf diesem Handy?</label>
            <PlayerSearchAutoComplete
                id="pp-name"
                v-model="draft"
                placeholder="Deinen Namen suchen …"
                className="pp-input"
                @item-select="onSelect"
            />
            <p class="pp-hint">Schon gespielt? Dann such dich, damit deine Spiele zu deinem Profil zählen. Kein Login nötig – das Profil bleibt nur auf diesem Handy.</p>
            <div class="pp-actions">
                <!-- Standard-Profil wieder abwaehlen: das Handy spielt dann ohne festen Spieler -->
                <button v-if="profileName" v-hint="'Dieses Handy hat dann kein Standard-Profil mehr'" type="button" class="pp-remove" @click="removeProfile">Profil entfernen</button>
                <button v-if="profileName" type="button" class="pp-button" @click="editing = false">Abbrechen</button>
                <button type="submit" class="pp-button pp-button--primary" :disabled="!draft.trim()">Speichern</button>
            </div>
        </form>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import PlayerSearchAutoComplete from '@/components/shared/PlayerSearchAutoComplete.vue';
import { useProfile } from './useProfile';

const emit = defineEmits<{ saved: [name: string] }>();

const { profileName, leagueTeam, setProfileName } = useProfile();
const editing = ref(!profileName.value);
const draft = ref(profileName.value ?? '');

const startEdit = () => {
    draft.value = profileName.value ?? '';
    editing.value = true;
};

const onSelect = (event: { value: string }) => {
    draft.value = event.value;
    save();
};

const removeProfile = () => {
    setProfileName(null);
    draft.value = '';
    editing.value = true;
};

const save = () => {
    const name = draft.value.trim();
    if (!name) return;
    setProfileName(name);
    editing.value = false;
    emit('saved', name);
};
</script>

<style scoped>
.ProfilePicker{
    padding: 16px;
    border-radius: 18px;
    background: var(--bp-surface);
    border: 1px solid var(--bp-border);
}
.pp-current{
    display: flex;
    align-items: center;
    gap: 12px;
}
.pp-avatar{
    --bp-avatar-size: 52px;
    width: 52px !important;
    height: 52px !important;
    font-size: 18px;
    flex-shrink: 0;
}
.pp-current-text{
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
}
.pp-current-name{
    font-size: 18px;
    font-weight: 800;
    color: var(--bp-text-strong);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.pp-current-detail{
    font-size: 13px;
    color: var(--bp-text-secondary);
}
.pp-change{
    border: none;
    border-radius: 999px;
    padding: 7px 14px;
    background: var(--bp-fill-soft);
    color: var(--bp-text-strong);
    font-size: 13px;
    font-weight: 700;
}
.pp-edit{
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.pp-label{
    font-size: 15px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.pp-edit :deep(.pp-input),
.pp-edit :deep(.pp-input input){
    width: 100%;
}
.pp-edit :deep(.pp-input input){
    padding: 10px 12px !important;
    font-size: 16px;
    border-radius: 12px;
}
.pp-hint{
    margin: 0;
    font-size: 12px;
    color: var(--bp-text-secondary);
}
.pp-actions{
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
}
.pp-remove{
    margin-right: auto;
    padding: 9px 4px;
    border: none;
    background: none;
    color: var(--bp-text-secondary);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
}
.pp-button{
    border: none;
    border-radius: 999px;
    padding: 9px 18px;
    background: var(--bp-fill-soft);
    color: var(--bp-text-strong);
    font-weight: 700;
    font-size: 14px;
}
.pp-button--primary{
    background: var(--main-color);
    color: white;
}
.pp-button:disabled{
    opacity: .5;
}
</style>
