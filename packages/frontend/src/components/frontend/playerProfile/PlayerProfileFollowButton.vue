<template>
    <button
        v-if="visible"
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
// Immer sichtbar (Nutzertest: wer Push zuerst einschaltet, fand sonst keinen Weg zum Folgen).
const props = defineProps<{ playerName: string }>();

const router = useRouter();
const toast = useToast();
const { isActive, settingsLoaded, usesFollowedPlayers, allCategoriesOff, loadSettings, isFollowing, followPlayer, followToastDetail, followOnlyMyPlayers, unfollowPlayer } = usePushNotifications();

const busy = ref(false);
// Bis die Einstellungen da sind ausgeblendet, sonst blitzt der Button kurz auf
const visible = computed(() => !isActive.value || settingsLoaded.value);
const following = computed(() => isActive.value && isFollowing(props.playerName));
const firstName = computed(() => props.playerName.split(' ')[0]);

watch(isActive, (active) => { if (active) loadSettings(); }, { immediate: true });

const onlyMyPlayers = async () => {
    await followOnlyMyPlayers();
    // Variable statt Literal: "action" ist eine eigene Erweiterung des Toasts (siehe App.vue)
    const message = { severity: 'success' as const, summary: 'Nur noch gefolgte Spieler', detail: 'Du bekommst nur noch Spiele der Spieler, denen du folgst. Ändern geht jederzeit in den Benachrichtigungen.', action: { label: 'Einstellungen ›', to: PUSH_SETTINGS_PATH }, life: 5000 };
    toast.add(message);
};

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
        const wasAllOff = allCategoriesOff.value;
        await followPlayer(props.playerName);
        // Ueberall "Alle Spiele": Folgen aendert gerade nichts - sagen, wie man auf "Nur meine Spieler" umstellt
        const getsAllAnyway = !wasAllOff && !usesFollowedPlayers.value;
        toast.add({
            severity: 'success',
            summary: `Du folgst jetzt ${firstName.value}`,
            // Alles war aus: followPlayer hat alle Kategorien fuer die eigenen Spieler eingeschaltet
            detail: wasAllOff
                ? `Benachrichtigungen sind wieder an. ${followToastDetail(firstName.value)}`
                : getsAllAnyway
                    ? `Du bekommst gerade alle Spiele. Ab jetzt nur noch Spiele der Spieler, denen du folgst?`
                    : followToastDetail(firstName.value),
            // Ueberall "Alle Spiele": Folgen bewirkt erst etwas mit "Nur meine Spieler" - direkt anbieten
            ...(wasAllOff && { action: { label: 'Einstellungen ›', to: PUSH_SETTINGS_PATH } }),
            ...(getsAllAnyway && { action: { label: 'Nur gefolgte Spieler', run: onlyMyPlayers } }),
            life: wasAllOff || getsAllAnyway ? 8000 : 5000,
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
    border: 1px solid var(--bp-border-strong);
    border-radius: 999px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
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
    border-color: var(--bp-border-strong);
}
.pp-follow--active {
    border-color: var(--main-color);
    background: var(--bp-primary-faint);
    color: var(--main-color);
}
.pp-follow:disabled {
    opacity: .6;
}
</style>
