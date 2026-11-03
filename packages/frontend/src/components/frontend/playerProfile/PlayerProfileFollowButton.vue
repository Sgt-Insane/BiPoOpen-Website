<template>
    <button
        type="button"
        class="pp-follow"
        :class="{ 'pp-follow--active': following }"
        :aria-pressed="following"
        :disabled="busy"
        @click="onClick"
    >
        <BellIcon :filled="following"/>
        {{ following ? 'Folge ich' : 'Folgen' }}
    </button>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import BellIcon from '@/components/shared/BellIcon.vue';
import { PUSH_SETTINGS_PATH, usePushNotifications } from '@/components/shared/usePushNotifications';

// Push aktiv: Spieler direkt zur Liste. Sonst erst die Aktivieren-Seite, die folgt danach automatisch.
const props = defineProps<{ playerName: string }>();

const router = useRouter();
const toast = useToast();
const { isActive, followMode, loadSettings, isFollowing, followPlayer, unfollowPlayer } = usePushNotifications();

const busy = ref(false);
const following = computed(() => isActive.value && isFollowing(props.playerName));
const firstName = computed(() => props.playerName.split(' ')[0]);

watch(isActive, (active) => { if (active) loadSettings(); }, { immediate: true });

const onClick = async () => {
    if (!isActive.value) {
        router.push({ path: PUSH_SETTINGS_PATH, query: { folgen: props.playerName } });
        return;
    }

    busy.value = true;
    await loadSettings();
    if (isFollowing(props.playerName)) {
        await unfollowPlayer(props.playerName);
        toast.add({ severity: 'info', summary: `Du folgst ${firstName.value} nicht mehr`, life: 3000 });
    } else {
        await followPlayer(props.playerName);
        toast.add({
            severity: 'success',
            summary: `Du folgst jetzt ${firstName.value}`,
            // Bei "Alle Spiele" aendert Folgen nichts an den Pushes, darauf hinweisen
            ...(followMode.value === 'all' && {
                detail: 'Du bekommst gerade noch alle Spiele',
                action: { label: 'Nur gefolgte Spieler ›', to: PUSH_SETTINGS_PATH },
            }),
            life: followMode.value === 'all' ? 6000 : 3000,
        });
    }
    busy.value = false;
};
</script>

<style scoped>
.pp-follow {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    padding: 8px 14px;
    border: 1px solid #dfe2e6;
    border-radius: 999px;
    background: white;
    color: #1d1f23;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    transition: background .2s ease, color .2s ease, border-color .2s ease;
    -webkit-tap-highlight-color: transparent;

    .BellIcon {
        font-size: 15px;
    }
}
.pp-follow:hover {
    border-color: #c9cdd3;
}
.pp-follow--active {
    border-color: var(--main-color);
    background: #fff1f2;
    color: var(--main-color);
}
.pp-follow:disabled {
    opacity: .6;
}
</style>
