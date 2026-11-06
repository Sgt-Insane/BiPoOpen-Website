<template>
    <Dialog
        v-model:visible="dialogVisible"
        modal
        :header="header ?? 'Bild zuschneiden'"
        :style="{ width: '95vw', maxWidth: '500px' }"
        :closable="!processing"
        :draggable="false"
    >
        <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
            <div style="width: 100%; overflow: hidden; border-radius: 8px; max-height: 60vh;">
                <Cropper
                    ref="cropperRef"
                    :src="src"
                    :stencil-component="stencil === 'circle' ? CircleStencil : RectangleStencil"
                    :stencil-props="aspectRatio ? { aspectRatio } : {}"
                    :resize-image="{ adjustStencil: false }"
                    image-restriction="stencil"
                    class="cropper"
                />
            </div>
            <div style="display: flex; gap: 12px; width: 100%; justify-content: flex-end;">
                <Button
                    label="Abbrechen"
                    severity="secondary"
                    text
                    :disabled="processing"
                    @click="dialogVisible = false"
                />
                <Button
                    label="Zuschneiden"
                    icon="pi pi-check"
                    :loading="processing"
                    @click="confirm"
                />
            </div>
        </div>
    </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Cropper, CircleStencil, RectangleStencil } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';

const props = defineProps<{
    visible: boolean;
    src: string;
    stencil?: 'circle' | 'rectangle';
    aspectRatio?: number;
    outputSize?: number;
    outputFormat?: 'jpeg' | 'png';
    header?: string;
}>();

const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void;
    (e: 'cropped', dataUrl: string): void;
}>();

const dialogVisible = computed({
    get: () => props.visible,
    set: (val) => emit('update:visible', val),
});

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null);
const processing = ref(false);

const confirm = () => {
    if (!cropperRef.value) return;
    const { canvas } = cropperRef.value.getResult();
    if (!canvas) return;

    const maxSize = props.outputSize ?? 600;
    const resized = resizeCanvas(canvas, maxSize, maxSize);

    const format = props.outputFormat ?? 'png';
    const quality = format === 'jpeg' ? 0.85 : undefined;
    const dataUrl = resized.toDataURL(`image/${format}`, quality);

    emit('cropped', dataUrl);
    emit('update:visible', false);
};

const resizeCanvas = (source: HTMLCanvasElement, maxWidth: number, maxHeight: number): HTMLCanvasElement => {
    const { width, height } = source;
    if (width <= maxWidth && height <= maxHeight) return source;
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
};
</script>

<style scoped>
.cropper {
    min-height: 300px;
    max-height: 55vh;
}

/* Schachbrett statt Schwarz, damit transparente Bereiche als solche erkennbar sind */
.cropper :deep(.vue-advanced-cropper__background),
.cropper :deep(.vue-circle-stencil__preview),
.cropper :deep(.vue-rectangle-stencil__preview) {
    background-color: var(--bp-surface);
    background-image:
        linear-gradient(45deg, #ccc 25%, transparent 25%),
        linear-gradient(-45deg, #ccc 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #ccc 75%),
        linear-gradient(-45deg, transparent 75%, #ccc 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
</style>
