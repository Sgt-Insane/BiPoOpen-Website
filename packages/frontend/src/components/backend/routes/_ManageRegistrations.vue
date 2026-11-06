<template>
    <div class="Manage">
        <h1 class="bp-title" style="position: inherit; margin-bottom: 40px;">Anmeldungen 2026</h1>
        <div style="width: 100%; max-width: 900px;">
            <RegistrationsList ref="listRef" :show-dates="true" :is-backend="true" @edit="openEdit" />
        </div>

        <!-- Edit team dialog -->
        <Modal v-if="showEditModal">
            <template #title>Team bearbeiten</template>
            <template #template>
                <div>Teamname</div>
                <input type="text" v-model="editTeamName" />
                <div>Spieler 1</div>
                <input type="text" v-model="editPlayer1" />
                <div>Spieler 2</div>
                <input type="text" v-model="editPlayer2" />

                <div>Teamlogo (optional)</div>
                <label
                    style="display: flex; align-items: center; gap: 12px; cursor: pointer; border: 1px solid var(--bp-border-strong); border-radius: 6px; padding: 10px 14px; width: fit-content; margin-bottom: 12px;"
                >
                    <span class="material-icons" style="color: var(--main-color); font-size: 20px;">upload</span>
                    <span style="font-size: 14px;">Datei auswählen</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" style="display: none;" @change="onLogoChange" />
                </label>
                <div v-if="editLogo" style="margin-bottom: 12px;">
                    <img :src="editLogo" alt="Vorschau" style="max-width: 120px; max-height: 120px; border-radius: 8px; border: 1px solid var(--bp-border); object-fit: contain;" />
                    <button
                        @click="editLogo = undefined"
                        style="display: block; margin-top: 6px; background: none; border: none; color: var(--main-color); cursor: pointer; font-size: 13px; padding: 0;"
                    >
                        Logo entfernen
                    </button>
                </div>
                <small v-if="logoError" style="color: var(--main-color);">{{ logoError }}</small>
            </template>
            <template #cancle>
                <div @click="showEditModal = false">Abbrechen</div>
            </template>
            <template #confirm>
                <div @click="saveEdit()">{{ saving ? 'Speichert...' : 'Speichern' }}</div>
            </template>
        </Modal>

        <ImageCropDialog
            v-model:visible="cropDialogVisible"
            :src="cropSrc"
            stencil="rectangle"
            :output-size="600"
            output-format="png"
            header="Logo zuschneiden"
            @cropped="onLogoCropped"
        />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import { useToast } from 'primevue/usetoast';
import RegistrationsList from '@/components/shared/RegistrationsList.vue';
import Modal from '@/components/shared/Modal.vue';
import ImageCropDialog from '@/components/shared/ImageCropDialog.vue';

interface Registration {
    _id: string;
    teamName: string;
    player1: string;
    player2: string;
    teamLogo?: string;
    createdAt: string;
}

const toast = useToast();

const listRef = ref<InstanceType<typeof RegistrationsList> | null>(null);

const showEditModal = ref(false);
const selectedId = ref('');
const editTeamName = ref('');
const editPlayer1 = ref('');
const editPlayer2 = ref('');
const editLogo = ref<string | undefined>(undefined);
const saving = ref(false);
const logoError = ref('');
const cropDialogVisible = ref(false);
const cropSrc = ref('');

const openEdit = (reg: Registration) => {
    selectedId.value = reg._id;
    editTeamName.value = reg.teamName;
    editPlayer1.value = reg.player1;
    editPlayer2.value = reg.player2;
    editLogo.value = reg.teamLogo;
    logoError.value = '';
    showEditModal.value = true;
};

const onLogoChange = (event: Event) => {
    logoError.value = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        logoError.value = 'Die Datei ist zu groß. Bitte wähle eine Datei unter 2 MB.';
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

const onLogoCropped = (dataUrl: string) => {
    editLogo.value = dataUrl;
};

const saveEdit = async () => {
    if (saving.value) return;
    if (!editTeamName.value.trim() || !editPlayer1.value.trim() || !editPlayer2.value.trim()) {
        toast.add({ severity: 'warn', summary: 'Fehlende Angaben', detail: 'Teamname und beide Spieler sind erforderlich.', life: 5000 });
        return;
    }

    saving.value = true;
    try {
        await axios.patch('/registrations/update/' + selectedId.value, {
            teamName: editTeamName.value.trim(),
            player1: editPlayer1.value.trim(),
            player2: editPlayer2.value.trim(),
            teamLogo: editLogo.value,
        });
        await listRef.value?.reload();
        showEditModal.value = false;
        toast.add({ severity: 'success', summary: 'Gespeichert', detail: 'Team wurde aktualisiert.', life: 4000 });
    } catch (err: any) {
        const msg = err?.response?.data?.message;
        if (err?.response?.status === 409) {
            toast.add({ severity: 'warn', summary: 'Teamname bereits vergeben', detail: msg || 'Dieser Teamname ist bereits angemeldet.', life: 6000 });
        } else {
            toast.add({ severity: 'error', summary: 'Fehler', detail: msg || 'Speichern fehlgeschlagen. Bitte versuche es erneut.', life: 6000 });
        }
    } finally {
        saving.value = false;
    }
};
</script>

<style scoped>
.Manage {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 80px;
}
</style>
