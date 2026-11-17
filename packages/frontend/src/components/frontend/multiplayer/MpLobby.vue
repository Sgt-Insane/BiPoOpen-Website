<template>
    <div class="MpLobby">
        <div class="ml-code-card">
            <div class="ml-code-label">Spiel-Code</div>
            <div class="ml-code">{{ session.code }}</div>
            <div class="ml-code-hint">Weitere Spieler: Handy an ein Handy der Runde stoßen oder den Code eingeben</div>
            <button type="button" class="ml-share" @click="$emit('share')"><i class="pi pi-share-alt"></i> Einladen</button>
        </div>

        <div class="ml-teams">
            <div v-for="team in [0, 1]" :key="team" class="ml-team" :style="{ '--ml-team-color': TEAM_COLORS[team] }">
                <div class="ml-team-title">Team {{ team + 1 }}</div>
                <button
                    v-for="player in getTeamPlayers(session.players, team)"
                    :key="player.deviceId"
                    type="button"
                    class="ml-player"
                    :class="{ 'ml-player--me': player.deviceId === deviceId }"
                    :disabled="!canMove(team)"
                    :title="canMove(team) ? 'Ins andere Team' : undefined"
                    @click="$emit('move', player.deviceId)"
                >
                    <Avatar :name="player.name" class="ml-player-avatar" :lazy="false" />
                    <span class="ml-player-name">{{ player.name }}</span>
                    <span v-if="player.deviceId === deviceId" class="ml-player-tag">Du</span>
                    
                </button>
                <div v-if="!getTeamPlayers(session.players, team).length" class="ml-empty">Wartet auf Spieler …</div>
            </div>
        </div>
        <p class="ml-hint">Antippen, um einen Spieler ins andere Team zu schieben. Jeder trägt später auf seinem Handy nur seine eigenen Würfe ein.</p>

        <!-- Spieltyp: offen oder noch offenes Liga-/Cup-Spiel -->
        <div v-if="options && options.length > 1" class="ml-options">
            <div class="ml-options-title">Was spielt ihr?</div>
            <button v-for="option in options" :key="option.kind" type="button" class="ml-option" :class="`ml-option--${option.kind}`" @click="$emit('start', option)">
                <span class="ml-option-label">{{ option.label }}</span>
                <span class="ml-option-detail">{{ option.detail }}</span>
                <i class="pi pi-chevron-right ml-option-arrow"></i>
            </button>
            <button type="button" class="ml-link" @click="$emit('cancelOptions')">Zurück</button>
        </div>

        <div v-else class="ml-footer">
            <button type="button" class="ml-button" @click="$emit('leave')">Verlassen</button>
            <button type="button" class="ml-button ml-button--primary" :disabled="!canStart || loadingOptions" @click="$emit('prepare')">
                <i v-if="loadingOptions" class="pi pi-spin pi-spinner"></i>
                <span v-else>{{ canStart ? 'Spiel starten' : 'Warte auf Gegner …' }}</span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import { TEAM_COLORS } from '../biPoKnecht/KnechtUtilFunctions';
import { MAX_PLAYERS_PER_TEAM, getTeamPlayers, type MpSession } from './multiplayerTypes';
import type { MpGameOption } from './multiplayerGameOptions';

const props = defineProps<{
    session: MpSession;
    deviceId: string;
    options: MpGameOption[] | null;
    loadingOptions: boolean;
}>();

defineEmits<{ move: [deviceId: string]; prepare: []; start: [option: MpGameOption]; cancelOptions: []; leave: []; share: [] }>();

const canStart = computed(() => [0, 1].every(team => getTeamPlayers(props.session.players, team).length > 0));
// Wechseln geht, solange im anderen Team Platz ist
const canMove = (team: number) => getTeamPlayers(props.session.players, 1 - team).length < MAX_PLAYERS_PER_TEAM;
</script>

<style scoped>
.MpLobby{
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.ml-code-card{
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 16px;
    border-radius: 20px;
    background: var(--bp-surface);
    border: 1px solid var(--bp-border);
    text-align: center;
}
.ml-code-label{
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: var(--bp-text-muted);
}
.ml-code{
    font-size: 44px;
    font-weight: 900;
    letter-spacing: .25em;
    margin-right: -.25em;
    color: var(--bp-text-strong);
    font-variant-numeric: tabular-nums;
}
.ml-code-hint{
    max-width: 320px;
    font-size: 13px;
    color: var(--bp-text-secondary);
}
.ml-share{
    margin-top: 8px;
    border: none;
    border-radius: 999px;
    padding: 7px 14px;
    background: var(--bp-fill-soft);
    color: var(--bp-text-strong);
    font-size: 13px;
    font-weight: 700;
}
.ml-teams{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}
.ml-team{
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    padding: 12px;
    border-radius: 18px;
    background: var(--bp-surface);
    border-top: 4px solid var(--ml-team-color);
}
.ml-team-title{
    font-size: 13px;
    font-weight: 900;
    color: var(--ml-team-color);
    text-transform: uppercase;
    letter-spacing: .06em;
}
.ml-player{
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px;
    border: 1px solid var(--bp-border);
    border-radius: 12px;
    background: var(--bp-surface-soft, var(--bp-surface));
    color: var(--bp-text-strong);
    text-align: left;
}
.ml-player--me{ border-color: var(--ml-team-color); }
.ml-player:disabled{ opacity: 1; }
.ml-player-avatar{
    width: 30px !important;
    height: 30px !important;
    flex-shrink: 0;
    font-size: 11px;
}
.ml-player-name{
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.2;
}
.ml-player-tag{
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--ml-team-color);
    color: white;
    font-size: 11px;
    font-weight: 800;
}
.ml-empty{
    padding: 10px 4px;
    font-size: 13px;
    color: var(--bp-text-muted);
    animation: ml-wait 1.6s ease-in-out infinite;
}
@keyframes ml-wait{ 50%{ opacity: .4; } }
.ml-hint{
    margin: -4px 0 0;
    font-size: 12px;
    color: var(--bp-text-secondary);
}
.ml-options{
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.ml-options-title{
    font-size: 18px;
    font-weight: 900;
    color: var(--bp-text-strong);
}
.ml-option{
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 14px 40px 14px 16px;
    border: 1px solid var(--bp-border);
    border-left: 5px solid var(--bp-text-muted);
    border-radius: 16px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    text-align: left;
}
.ml-option--league{ border-left-color: #2AA3B8; }
.ml-option--cup{ border-left-color: #EA5160; }
.ml-option-label{
    font-size: 16px;
    font-weight: 900;
}
.ml-option-detail{
    font-size: 13px;
    color: var(--bp-text-secondary);
}
.ml-option-arrow{
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--bp-text-muted);
}
.ml-link{
    align-self: center;
    border: none;
    background: none;
    color: var(--bp-text-secondary);
    font-weight: 700;
    font-size: 14px;
}
.ml-footer{
    display: flex;
    gap: 10px;
}
.ml-button{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: none;
    border-radius: 999px;
    padding: 13px 18px;
    background: var(--bp-fill-soft);
    color: var(--bp-text-strong);
    font-weight: 800;
    font-size: 15px;
}
.ml-button--primary{
    flex: 1;
    background: var(--main-color);
    color: white;
}
.ml-button:disabled{ opacity: .55; }
</style>
