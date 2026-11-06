<template>
    <div>
        <div v-if="registrations === undefined" aria-busy="true" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;">
            <div v-for="i in 6" :key="i" style="background: var(--bp-surface); border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.07); padding: 20px; display: flex; align-items: center; gap: 16px;">
                <div class="bp-skeleton" style="flex-shrink: 0; width: 56px; height: 56px; border-radius: 10px;"></div>
                <div style="flex: 1;">
                    <div class="bp-skeleton" style="width: 70%; height: 14px; border-radius: 6px;"></div>
                    <div class="bp-skeleton" style="width: 50%; height: 11px; border-radius: 6px; margin-top: 8px;"></div>
                    <div class="bp-skeleton" style="width: 45%; height: 11px; border-radius: 6px; margin-top: 6px;"></div>
                </div>
            </div>
        </div>

        <div v-if="registrations !== undefined">
            <p v-if="registrations.length === 0" style="text-align: center; color: var(--bp-text-subtle); font-size: 16px; padding: 40px 0;">
                Noch keine Anmeldungen vorhanden.
            </p>

            <div v-if="registrations.length > 0">
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;">
                    <div
                        v-for="(reg, index) in registrations"
                        :key="String(reg._id)"
                        style="background: var(--bp-surface); border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.07); padding: 20px; display: flex; align-items: center; gap: 16px;"
                        :style="isBackend ? 'cursor: pointer;' : ''"
                        @click="isBackend && emit('edit', reg)"
                    >
                        <div
                            style="flex-shrink: 0; width: 56px; height: 56px; border-radius: 10px; border: 1px solid var(--bp-border); display: flex; align-items: center; justify-content: center; background: #f9f9f9; overflow: hidden;"
                            :style="reg.teamLogo && !isBackend ? 'cursor: pointer;' : ''"
                            @click="reg.teamLogo && !isBackend && openLightbox(reg.teamLogo, reg.teamName)"
                        >
                            <img v-if="reg.teamLogo" :src="reg.teamLogo" :alt="reg.teamName" style="width: 100%; height: 100%; object-fit: contain;" />
                            <span v-else class="material-icons" style="color: var(--bp-text-faint); font-size: 28px;">groups</span>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="font-weight: bold; font-size: 15px; color: var(--main-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    #{{ registrations.length - index }} {{ reg.teamName }}
                                </span>
                            </div>
                            <div style="font-size: 13px; color: var(--bp-text-secondary);">{{ reg.player1 }}</div>
                            <div style="font-size: 13px; color: var(--bp-text-secondary);">{{ reg.player2 }}</div>
                            <div v-if="showDates" style="font-size: 11px; color: var(--bp-text-faint); margin-top: 4px;">{{ formatDate(reg.createdAt) }}</div>
                        </div>
                    </div>
                </div>

                <p v-if="showDates" style="margin-top: 20px; color: var(--bp-text-subtle); font-size: 14px; text-align: right;">
                    {{ registrations.length }} {{ registrations.length === 1 ? 'Anmeldung' : 'Anmeldungen' }} gesamt
                </p>
            </div>
        </div>

        <!-- Lightbox -->
        <Teleport to="body">
            <Transition name="lb">
                <div
                    v-if="lightbox"
                    style="position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.82); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer;"
                    @click="lightbox = null"
                >
                    <img
                        :src="lightbox.src"
                        :alt="lightbox.name"
                        style="max-width: 90vw; max-height: 80vh; border-radius: 12px; object-fit: contain; box-shadow: 0 8px 40px rgba(0,0,0,0.5);"
                        @click.stop
                    />
                    <p style="color: white; margin-top: 16px; font-size: 16px; font-weight: bold;">{{ lightbox.name }}</p>
                    <span class="material-icons" style="position: absolute; top: 20px; right: 24px; color: white; font-size: 32px; cursor: pointer;">close</span>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';

interface Registration {
    _id: string;
    teamName: string;
    player1: string;
    player2: string;
    teamLogo?: string;
    createdAt: string;
}

defineProps<{ showDates?: boolean; isBackend?: boolean }>();

const emit = defineEmits<{ (e: 'edit', reg: Registration): void }>();

const registrations = ref<Registration[] | undefined>(undefined);
const lightbox = ref<{ src: string; name: string } | null>(null);

const load = async () => {
    try {
        const res = await axios.get('/registrations/get');
        registrations.value = res.data.registrations;
    } catch {
        registrations.value = [];
    }
};
load();

const openLightbox = (src: string, name: string) => {
    lightbox.value = { src, name };
};

const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
};

// Allow the parent to refresh the list (e.g. after editing a team).
defineExpose({ reload: load });
</script>

<style scoped>
.lb-enter-active,
.lb-leave-active {
    transition: opacity 0.2s ease;
}
.lb-enter-from,
.lb-leave-to {
    opacity: 0;
}
</style>
