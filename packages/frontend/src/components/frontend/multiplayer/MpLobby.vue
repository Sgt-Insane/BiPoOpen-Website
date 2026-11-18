<template>
    <div class="MpLobby">
        <div class="ml-code-card">
            <div class="ml-code-label">Lobby-PIN</div>
            <div class="ml-code">{{ session.code }}</div>
            <button v-hint="'Weitere Spieler stoßen mit einem Handy der Runde an oder geben die PIN ein – auch nach dem Start'" type="button" class="ml-share" @click="$emit('share')"><i class="pi pi-share-alt"></i> Einladen</button>
        </div>

        <div class="ml-teams">
            <template v-for="team in [0, 1]" :key="team">
            <!-- Seiten tauschen: bei zwei Spielern tauschen beide, sonst wechselt nur man selbst -->
            <button v-if="team === 1" v-hint="swapLabel" type="button" class="ml-swap" :disabled="!canSwap" @click="$emit('swap')">
                <i class="pi pi-arrow-right-arrow-left"></i>
            </button>
            <div class="ml-team" :style="{ '--ml-team-color': colors[team] }">
                <div class="ml-team-title">{{ teamName(team) }}</div>
                <div v-for="player in getTeamPlayers(session.players, team)" :key="player.deviceId" class="ml-player-row">
                    <div class="ml-player" :class="{ 'ml-player--me': player.deviceId === deviceId }">
                        <Avatar :name="player.name" class="ml-player-avatar" :lazy="false" />
                        <span class="ml-player-name">
                            {{ player.name }}
                            <small v-if="!hasPhone(player)" class="ml-player-nophone">ohne Handy</small>
                        </span>
                        <span v-if="player.deviceId === deviceId" class="ml-player-tag">Du</span>
                    </div>
                    <button v-if="!hasPhone(player)" type="button" class="ml-remove" :aria-label="`${player.name} entfernen`" @click="$emit('removeGuest', player.deviceId)">
                        <i class="pi pi-times"></i>
                    </button>
                </div>
                <div v-if="!getTeamPlayers(session.players, team).length" class="ml-empty">Wartet auf Spieler …</div>

                <!-- Spieler ohne eigenes Handy: kleine Option, ein Handy des Teams traegt fuer ihn ein -->
                <form v-if="guestTeam === team" class="ml-guest" @submit.prevent="addGuest">
                    <PlayerSearchAutoComplete v-model="guestName" placeholder="Name …" className="ml-guest-input" @item-select="onGuestSelect" />
                    <button type="submit" class="ml-guest-add" :disabled="!guestName.trim()" aria-label="Hinzufügen"><i class="pi pi-check"></i></button>
                </form>
                <button v-else-if="hasRoom(team)" v-hint="'Ein Handy seines Teams trägt für ihn ein'" type="button" class="ml-add" @click="openGuest(team)">+ Ohne Handy</button>
            </div>
            </template>
        </div>

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
            <button type="button" class="ml-button ml-button--primary" :disabled="!canStart || busy" @click="$emit('prepare')">
                <i v-if="busy" class="pi pi-spin pi-spinner"></i>
                <span v-else>{{ canStart ? 'Spiel starten' : 'Warte auf Gegner …' }}</span>
            </button>
            <button type="button" class="ml-leave" @click="$emit('leave')">Verlassen</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import PlayerSearchAutoComplete from '@/components/shared/PlayerSearchAutoComplete.vue';
import { TEAM_COLORS } from '../biPoKnecht/KnechtUtilFunctions';
import { MAX_PLAYERS_PER_TEAM, getTeamPlayers, hasPhone, type MpSession } from './multiplayerTypes';
import type { MpGameOption } from './multiplayerGameOptions';

const props = defineProps<{
    session: MpSession;
    deviceId: string;
    options: MpGameOption[] | null;
    busy: boolean;
}>();

const emit = defineEmits<{
    swap: []; prepare: []; start: [option: MpGameOption]; cancelOptions: []; leave: []; share: [];
    addGuest: [team: number, name: string]; removeGuest: [deviceId: string];
}>();

const colors = computed(() => props.session.cupColors ?? TEAM_COLORS);
const teamName = (team: number) => colors.value[team] === TEAM_COLORS[1] ? 'Team Blau' : 'Team Rot';
const canStart = computed(() => [0, 1].every(team => getTeamPlayers(props.session.players, team).length > 0));
const hasRoom = (team: number) => getTeamPlayers(props.session.players, team).length < MAX_PLAYERS_PER_TEAM;
// Zwei Spieler in verschiedenen Teams: beide tauschen. Sonst wechselt man selbst, wenn drueben Platz ist.
const me = computed(() => props.session.players.find(player => player.deviceId === props.deviceId));
const swapsBoth = computed(() => props.session.players.length === 2 && new Set(props.session.players.map(player => player.team)).size === 2);
const canSwap = computed(() => swapsBoth.value || (!!me.value && hasRoom(1 - me.value.team)));
const swapLabel = computed(() => swapsBoth.value ? 'Seiten tauschen' : 'Ins andere Team wechseln');

const guestTeam = ref<number | null>(null);
const guestName = ref('');
const openGuest = (team: number) => {
    guestTeam.value = team;
    guestName.value = '';
};
const addGuest = () => {
    const name = guestName.value.trim();
    if (!name || guestTeam.value === null) return;
    emit('addGuest', guestTeam.value, name);
    guestTeam.value = null;
};
const onGuestSelect = (event: { value: string }) => {
    guestName.value = event.value;
    addGuest();
};
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
    grid-template-columns: 1fr auto 1fr;
    align-items: start;
    gap: 8px;
}
.ml-swap{
    align-self: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    box-shadow: 0 2px 8px rgba(0, 0, 0, .12);
    font-size: 15px;
}
.ml-swap:disabled{ opacity: .4; }
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
/* Man selbst: farbig hinterlegt, damit man sich sofort findet */
.ml-player--me{
    border: 2px solid var(--ml-team-color);
    background: color-mix(in srgb, var(--ml-team-color) 14%, var(--bp-surface));
}
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
    flex-direction: column;
    align-items: center;
    gap: 6px;
}
.ml-footer .ml-button--primary{
    width: 100%;
    max-width: 320px;
}
.ml-leave{
    padding: 8px 16px;
    border: none;
    background: none;
    color: var(--bp-text-secondary);
    font: inherit;
    font-size: 14px;
    font-weight: 700;
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
.ml-player-row{
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
}
.ml-player-row .ml-player{ flex: 1; }
.ml-player-nophone{
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--bp-text-muted);
}
.ml-remove{
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--bp-text-muted);
}
.ml-add{
    align-self: flex-start;
    border: none;
    background: none;
    padding: 4px 2px;
    color: var(--bp-text-secondary);
    font-size: 13px;
    font-weight: 700;
}
.ml-guest{
    display: flex;
    gap: 6px;
    min-width: 0;
}
.ml-guest :deep(.ml-guest-input),
.ml-guest :deep(.p-autocomplete),
.ml-guest :deep(input){
    width: 100%;
    min-width: 0;
}
.ml-guest > :first-child{
    flex: 1;
    min-width: 0;
}
.ml-guest-add{
    flex-shrink: 0;
    width: 40px;
    border: none;
    border-radius: 12px;
    background: var(--ml-team-color);
    color: white;
}
.ml-guest-add:disabled{ opacity: .5; }
</style>