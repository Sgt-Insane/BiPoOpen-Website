<template>
    <div class="MpVote">
        <div class="mv-card">
            <div class="mv-icon">{{ vote.kind === 'save' ? '🏆' : '✋' }}</div>
            <div class="mv-title">{{ title }}</div>
            <div class="mv-text">{{ text }}</div>

            <ul class="mv-players">
                <li v-for="player in players" :key="player.deviceId" class="mv-player">
                    <Avatar :name="player.name" class="mv-avatar" :lazy="false" />
                    <span class="mv-name">{{ player.deviceId === deviceId ? 'Du' : player.name }}</span>
                    <span class="mv-state" :class="`mv-state--${stateOf(player.deviceId)}`">
                        {{ stateOf(player.deviceId) === 'ok' ? '✓ OK' : stateOf(player.deviceId) === 'no' ? '✕ Nein' : '…' }}
                    </span>
                </li>
            </ul>

            <div v-if="vote.declinedBy" class="mv-actions">
                <button type="button" class="mv-button mv-button--primary" @click="$emit('dismiss')">Weiterspielen</button>
            </div>
            <div v-else-if="!hasApproved" class="mv-actions">
                <button type="button" class="mv-button" @click="$emit('decline')">Nein</button>
                <button type="button" class="mv-button mv-button--primary" @click="$emit('approve')">OK</button>
            </div>
            <div v-else class="mv-actions mv-actions--column">
                <div class="mv-waiting"><i class="pi pi-spin pi-spinner"></i> Warte auf die anderen …</div>
                <button v-if="canForce" type="button" class="mv-link" @click="$emit('force')">Handy ausgefallen? Ohne die anderen fortfahren</button>
                <button v-if="vote.by === deviceId" type="button" class="mv-link" @click="$emit('decline')">Zurückziehen</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import type { MpPlayer, MpVote } from './multiplayerTypes';

const props = defineProps<{ vote: MpVote; players: MpPlayer[]; deviceId: string; score: string }>();
defineEmits<{ approve: []; decline: []; dismiss: []; force: [] }>();

const FORCE_AFTER = 20_000;
const now = ref(Date.now());
const timer = setInterval(() => { now.value = Date.now(); }, 1000);
onUnmounted(() => clearInterval(timer));

const nameOf = (id: string | null) => props.players.find(player => player.deviceId === id)?.name ?? 'Jemand';
const hasApproved = computed(() => props.vote.approvals.includes(props.deviceId));
const canForce = computed(() => props.vote.by === props.deviceId && now.value - props.vote.createdAt > FORCE_AFTER);
const stateOf = (id: string) => props.vote.declinedBy === id ? 'no' : props.vote.approvals.includes(id) ? 'ok' : 'open';

const title = computed(() => {
    if (props.vote.declinedBy) return `${props.vote.declinedBy === props.deviceId ? 'Du hast' : `${nameOf(props.vote.declinedBy)} hat`} abgelehnt`;
    if (props.vote.kind === 'abort') return 'Spiel abbrechen?';
    return props.vote.rematch ? 'Speichern & Revanche?' : 'Spiel eintragen?';
});

const text = computed(() => {
    if (props.vote.declinedBy) return 'Es geht weiter wie bisher.';
    const who = props.vote.by === props.deviceId ? 'Du willst' : `${nameOf(props.vote.by)} will`;
    return props.vote.kind === 'abort'
        ? `${who} das Spiel abbrechen. Es wird nicht gespeichert. Alle müssen zustimmen.`
        : `${who} das Spiel mit ${props.score} eintragen. Alle müssen zustimmen.`;
});
</script>

<style scoped>
.MpVote{
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(31, 35, 40, .55);
}
.mv-card{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: min(380px, 100%);
    padding: 22px 18px 18px;
    border-radius: 22px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    text-align: center;
    box-shadow: 0 18px 40px rgba(0, 0, 0, .3);
}
.mv-icon{ font-size: 34px; }
.mv-title{ font-size: 20px; font-weight: 900; }
.mv-text{ font-size: 14px; color: var(--bp-text-secondary); }
.mv-players{
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    margin: 6px 0;
    padding: 0;
    list-style: none;
}
.mv-player{
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border-radius: 12px;
    background: var(--bp-fill-soft);
}
.mv-avatar{
    width: 28px !important;
    height: 28px !important;
    font-size: 11px;
}
.mv-name{
    flex: 1;
    text-align: left;
    font-weight: 700;
    font-size: 14px;
}
.mv-state{
    font-size: 13px;
    font-weight: 800;
    color: var(--bp-text-muted);
}
.mv-state--ok{ color: var(--bp-success-strong); }
.mv-state--no{ color: var(--bp-danger-strong); }
.mv-actions{
    display: flex;
    gap: 10px;
    width: 100%;
}
.mv-actions--column{
    flex-direction: column;
    align-items: center;
}
.mv-button{
    flex: 1;
    border: none;
    border-radius: 999px;
    padding: 12px;
    background: var(--bp-fill-soft);
    color: var(--bp-text-strong);
    font-weight: 800;
    font-size: 15px;
}
.mv-button--primary{
    background: var(--main-color);
    color: white;
}
.mv-waiting{
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    color: var(--bp-text-secondary);
}
.mv-link{
    border: none;
    background: none;
    color: var(--bp-text-secondary);
    font-size: 13px;
    font-weight: 700;
    text-decoration: underline;
}
</style>
