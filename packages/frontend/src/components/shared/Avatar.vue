<template>
    <!-- --avatar-background / --avatar-color ueberschreiben die Farben, z.B. graue Avatare in Tabellen (theme.ts) -->
    <PrimeAvatar
        ref="rootRef"
        :label="avatarImageComputed ? undefined : playerInitials"
        :image="avatarImageComputed || undefined"
        :shape="resolvedShape"
        :pt="{
            root: {
                class: `!outline-none !border-none ${isTeamLogo ? '!rounded-none' : ''} ${avatarImageComputed ? '!bg-transparent' : (grayscale ? '!bg-(--bp-fill-strong) !text-(--bp-text)' : '!bg-[var(--avatar-background,var(--main-color))] opacity-70 !text-[var(--avatar-color,white)]')}`
            },
            image: {
                class: `${resolvedShape === 'square' ? 'object-contain' : 'object-cover'} ${isTeamLogo ? '!rounded-none' : ''} bg-transparent ${grayscale ? 'grayscale' : ''}`
            }
        }"
    />
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import PrimeAvatar from 'primevue/avatar';
import { getPlayerInitials, getPlayerProfileImage, fetchPlayerProfileImage, backendImageCache } from '@/components/frontend/playerProfile/PlayerProfileImageMapping';

const props = defineProps({
    name: {type: String, required: true},
    avatarImage: {type: String, required: false},
    shape: {type: String as () => 'circle' | 'square', default: 'circle'},
    grayscale: {type: Boolean, default: false},
    lazy: {type: Boolean, default: true},
});

const rootRef = ref<{ $el?: Element } | null>(null);
let observer: IntersectionObserver | null = null;

onMounted(() => {
    // Eager: sofort laden wie bisher.
    if (!props.lazy || typeof IntersectionObserver === 'undefined') {
        fetchPlayerProfileImage(props.name);
        return;
    }

    // Lazy: erst beim ersten Sichtbarwerden laden, dann Observer trennen.
    const el = rootRef.value?.$el;
    if (!el) {
        fetchPlayerProfileImage(props.name);
        return;
    }

    observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            fetchPlayerProfileImage(props.name);
            observer?.disconnect();
            observer = null;
        }
    });
    observer.observe(el);
});

onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
});

const avatarImageComputed = computed(() => {
    if(props.avatarImage)
        return props.avatarImage;

    // Access backendImageCache reactively to re-render when image is fetched
    const _trigger = backendImageCache[props.name?.trim().replace(/\s+/g, ' ').toLowerCase()];
    return getPlayerProfileImage(props.name);
});
// avatarImage ist immer ein Team-Logo (Liga oder Turnier): nie abrunden und nie beschneiden,
// auch wenn die Stelle shape="circle" nutzt. Spielerbilder und Initialen behalten ihre Form.
const isTeamLogo = computed(() => !!props.avatarImage);
const resolvedShape = computed(() => isTeamLogo.value ? 'square' : props.shape);
const playerInitials = computed(() => getPlayerInitials(props.name));
const grayscale = computed(() => props.grayscale);
</script>
