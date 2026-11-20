<template>
    <!-- Einheitlicher Kopf fuer eigene Seiten (nicht Bottom-Navigation): Zurueck-Pfeil + Titel, App-Header bleibt sichtbar -->
    <div class="PageHeader">
        <div class="ph-row">
            <button type="button" class="ph-back" aria-label="Zurück" @click="goBack">
                <i class="pi pi-chevron-left"></i>
            </button>
            <h1 class="ph-title" @click="onTitleClick">{{ title }}<slot name="title-extra"/></h1>
            <div v-if="$slots.actions" class="ph-actions"><slot name="actions"/></div>
        </div>
        <p v-if="subtitle" class="ph-subtitle">{{ subtitle }}</p>
    </div>
</template>

<script setup lang="ts">
import { getCurrentInstance } from 'vue';
import { useRouter } from 'vue-router';

defineProps<{ title: string; subtitle?: string }>();
const emit = defineEmits<{ titleClick: [] }>();

const router = useRouter();
// Titel antippen = zurueck (wie der Pfeil), ausser die Seite nutzt den Titel selbst (z.B. Neuigkeiten)
const hasTitleListener = !!getCurrentInstance()?.vnode.props?.onTitleClick;
const onTitleClick = () => {
    if (hasTitleListener) emit('titleClick');
    else goBack();
};

// Ohne Vorgaengerseite (direkt aufgerufener Link) geht es zur Startseite
const goBack = () => {
    if (window.history.state?.back) router.back();
    else router.push('/');
};
</script>

<style scoped>
.PageHeader{
    margin: 4px 0 16px;
    text-align: left;
}
.ph-row{
    display: flex;
    align-items: center;
    gap: 6px;
}
.ph-back{
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-left: -8px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--bp-text-strong);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
.ph-back .pi{
    font-size: 16px;
}
.ph-back:hover{
    background: var(--bp-fill);
}
.ph-title{
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    margin: 0;
    color: var(--main-color);
    font-size: 32px;
    font-weight: 800;
    line-height: 1.15;
    user-select: none;
}
.ph-actions{
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
}
.ph-subtitle{
    margin: 4px 0 0 30px;
    font-size: 14px;
    color: var(--bp-text-muted);
}

@media (width <= 900px){
    .ph-title{
        font-size: 28px;
    }
}
@media (width <= 360px){
    .ph-title{
        font-size: 22px;
    }
}
</style>
