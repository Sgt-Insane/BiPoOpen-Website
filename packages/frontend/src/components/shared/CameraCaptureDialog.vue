<template>
    <Dialog
        v-model:visible="dialogVisible"
        modal
        :header="header ?? 'Foto aufnehmen'"
        :style="{ width: '95vw', maxWidth: '500px' }"
        :draggable="false"
        @show="startCamera"
        @hide="stopCamera"
    >
        <div class="flex flex-col items-center gap-4">
            <div class="relative w-full overflow-hidden rounded-lg bg-black aspect-[3/4] max-h-[60vh]">
                <video
                    ref="videoRef"
                    autoplay
                    playsinline
                    muted
                    class="w-full h-full object-cover"
                    :class="{ '-scale-x-100': facingMode === 'user' }"
                />
                <div
                    v-if="!streaming"
                    class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white text-center p-4"
                >
                    <i v-if="!errorMessage" class="pi pi-spin pi-spinner text-3xl" />
                    <template v-else>
                        <i class="pi pi-video text-3xl" />
                        <span class="text-sm">{{ errorMessage }}</span>
                    </template>
                </div>
            </div>
            <div class="flex gap-3 w-full justify-between items-center">
                <Button
                    v-if="canSwitchCamera"
                    icon="pi pi-sync"
                    severity="secondary"
                    rounded
                    text
                    aria-label="Kamera wechseln"
                    :disabled="!streaming"
                    @click="switchCamera"
                />
                <span v-else />
                <div class="flex gap-3">
                    <Button
                        label="Abbrechen"
                        severity="secondary"
                        text
                        @click="dialogVisible = false"
                    />
                    <Button
                        label="Auslösen"
                        icon="pi pi-camera"
                        :disabled="!streaming"
                        @click="capture"
                    />
                </div>
            </div>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';

const props = defineProps<{
    visible: boolean;
    header?: string;
}>();

const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void;
    (e: 'captured', dataUrl: string): void;
}>();

const dialogVisible = computed({
    get: () => props.visible,
    set: (val) => emit('update:visible', val),
});

const videoRef = ref<HTMLVideoElement | null>(null);
const stream = ref<MediaStream | null>(null);
const streaming = ref(false);
const errorMessage = ref('');
const facingMode = ref<'user' | 'environment'>('user');
const canSwitchCamera = ref(false);

const startCamera = async () => {
    stopCamera();
    errorMessage.value = '';
    try {
        stream.value = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode.value, width: { ideal: 1280 }, height: { ideal: 1280 } },
            audio: false,
        });
        if (videoRef.value) {
            videoRef.value.srcObject = stream.value;
            await videoRef.value.play();
        }
        streaming.value = true;

        // Gerätenamen/-liste sind erst nach erteilter Berechtigung zuverlässig verfügbar
        const devices = await navigator.mediaDevices.enumerateDevices();
        canSwitchCamera.value = devices.filter((d) => d.kind === 'videoinput').length > 1;
    } catch (err) {
        const name = (err as DOMException)?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
            errorMessage.value = 'Kein Zugriff auf die Kamera. Bitte erlaube den Kamerazugriff in deinem Browser.';
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
            errorMessage.value = 'Keine Kamera gefunden.';
        } else {
            errorMessage.value = 'Die Kamera konnte nicht gestartet werden.';
        }
    }
};

const stopCamera = () => {
    stream.value?.getTracks().forEach((track) => track.stop());
    stream.value = null;
    streaming.value = false;
    if (videoRef.value) videoRef.value.srcObject = null;
};

const switchCamera = () => {
    facingMode.value = facingMode.value === 'user' ? 'environment' : 'user';
    startCamera();
};

const capture = () => {
    const video = videoRef.value;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    // Frontkamera gespiegelt speichern, damit das Foto der Vorschau entspricht
    if (facingMode.value === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    emit('captured', canvas.toDataURL('image/jpeg', 0.92));
    dialogVisible.value = false;
};

onBeforeUnmount(stopCamera);
</script>
