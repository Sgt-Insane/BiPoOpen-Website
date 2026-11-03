<template>
    <Dialog
        v-model:visible="dialogVisible"
        modal
        header="Profilbild ändern"
        :style="{ width: '95vw', maxWidth: '500px' }"
        :closable="!uploading"
        :draggable="false"
        @hide="onDialogHide"
    >
        <div class="flex flex-col items-center gap-4 py-4">
            <Avatar :name="playerName" size="xlarge" shape="circle" class="!w-[250px] !h-[250px] !text-[40px]" />
            <p class="text-[--p-text-muted-color] text-center text-sm">
                Wähle ein Bild aus oder mach ein Foto, um dein Profilbild zu ändern.
            </p>
            <Button
                label="Bild auswählen"
                icon="pi pi-image"
                @click="triggerFileInput"
                class="w-full max-w-[280px]"
            />
            <Button
                label="Foto aufnehmen"
                icon="pi pi-camera"
                severity="secondary"
                @click="openCamera"
                class="w-full max-w-[280px]"
            />
            <Button
                v-if="hasExistingImage"
                label="Profilbild entfernen"
                icon="pi pi-trash"
                severity="danger"
                text
                @click="deleteImage"
                :loading="uploading"
                class="w-full max-w-[280px]"
            />
            <input
                ref="fileInputRef"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="hidden"
                @change="onFileSelected"
            />
            <!-- Fallback für Browser ohne getUserMedia: öffnet auf Mobilgeräten direkt die Kamera-App -->
            <input
                ref="cameraInputRef"
                type="file"
                accept="image/*"
                capture="user"
                class="hidden"
                @change="onFileSelected"
            />
        </div>
    </Dialog>

    <CameraCaptureDialog
        v-model:visible="cameraDialogVisible"
        header="Profilbild aufnehmen"
        @captured="onCaptured"
    />

    <ImageCropDialog
        v-model:visible="cropDialogVisible"
        :src="cropSrc"
        stencil="circle"
        :output-size="400"
        output-format="png"
        header="Profilbild zuschneiden"
        @cropped="onCropped"
    />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import axios from 'axios';
import Avatar from '@/components/shared/Avatar.vue';
import ImageCropDialog from '@/components/shared/ImageCropDialog.vue';
import CameraCaptureDialog from '@/components/shared/CameraCaptureDialog.vue';
import { getPlayerProfileImageFromBackend, invalidatePlayerProfileImageCache } from './PlayerProfileImageMapping';

const props = defineProps<{
    playerName: string;
    visible: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void;
    (e: 'uploaded'): void;
}>();

const toast = useToast();

const dialogVisible = computed({
    get: () => props.visible,
    set: (val) => emit('update:visible', val),
});

const cropDialogVisible = ref(false);
const cropSrc = ref('');
const uploading = ref(false);
const hasExistingImage = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const cameraInputRef = ref<HTMLInputElement | null>(null);
const cameraDialogVisible = ref(false);

watch(() => props.visible, async (visible) => {
    if (visible) {
        try {
            const existing = await getPlayerProfileImageFromBackend(props.playerName);
            hasExistingImage.value = !!existing;
        } catch {
            hasExistingImage.value = false;
        }
    }
});

const triggerFileInput = () => fileInputRef.value?.click();

const openCamera = () => {
    // getUserMedia braucht einen sicheren Kontext (HTTPS/localhost)
    if (window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function') {
        cameraDialogVisible.value = true;
    } else {
        cameraInputRef.value?.click();
    }
};

const onCaptured = (dataUrl: string) => {
    cropSrc.value = dataUrl;
    cropDialogVisible.value = true;
};

const onFileSelected = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
        toast.add({ severity: 'error', summary: 'Fehler', detail: 'Bitte wähle ein Bild (PNG, JPEG oder WebP)', life: 3000 });
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        toast.add({ severity: 'error', summary: 'Fehler', detail: 'Das Bild ist zu groß (max. 10MB)', life: 3000 });
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        cropSrc.value = e.target?.result as string;
        cropDialogVisible.value = true;
    };
    reader.readAsDataURL(file);
    target.value = '';
};

const onCropped = async (dataUrl: string) => {
    uploading.value = true;
    try {
        await axios.post('/playerImages/upload', {
            playerName: props.playerName,
            imageData: dataUrl,
        });
        invalidatePlayerProfileImageCache(props.playerName);
        toast.add({ severity: 'success', summary: 'Erfolg', detail: 'Profilbild wurde gespeichert', life: 3000 });
        emit('uploaded');
        dialogVisible.value = false;
    } catch {
        toast.add({ severity: 'error', summary: 'Fehler', detail: 'Profilbild konnte nicht gespeichert werden', life: 3000 });
    } finally {
        uploading.value = false;
    }
};

const deleteImage = async () => {
    uploading.value = true;
    try {
        await axios.delete(`/playerImages/delete/${encodeURIComponent(props.playerName)}`);
        invalidatePlayerProfileImageCache(props.playerName);
        hasExistingImage.value = false;
        toast.add({ severity: 'success', summary: 'Erfolg', detail: 'Profilbild wurde entfernt', life: 3000 });
        emit('uploaded');
        dialogVisible.value = false;
    } catch {
        toast.add({ severity: 'error', summary: 'Fehler', detail: 'Profilbild konnte nicht entfernt werden', life: 3000 });
    } finally {
        uploading.value = false;
    }
};

const onDialogHide = () => {
    cropSrc.value = '';
    uploading.value = false;
};
</script>
