<template>
    <div class="MatchElementTeam"
        :class="{
            'mt-team-win': isWinner,
            'mt-team-loose': isLoser
        }"
    >
        <!-- Team Header -->
        <div class="mt-team">
            <div class="mt-team-avatars">

                <!-- Team Logo -->
                <Avatar
                    v-if="teamLogo && team"
                    :name="teamName"
                    :avatarImage="teamLogo"
                    :shape="avatarShape"
                    :grayscale="isLoser"
                    class="mt-logo"
                />

                <!-- Ohne Team-Logo: Spielerbilder immer rund, avatarShape gilt nur fuer Logos -->
                <template v-else-if="team">
                    <Avatar
                        v-for="(player, index) in team.players"
                        :key="`${player.name}-${index}`"
                        :name="player.name"
                        shape="circle"
                        size="normal"
                        :grayscale="isLoser"
                        class="mt-avatar border-[2px] border-[--p-surface-0] box-content"
                    />
                </template>
            </div>
            <div class="mt-team-main">
                <!-- Name und Score auf einer Hoehe, Elo darunter -->
                <div class="mt-team-line">
                    <div
                        v-fit-text="fitTextGroup"
                        class="mt-team-name"
                        :class="{ 'cursor-pointer': team && team.players.length === 1 }"
                        :title="teamName"
                        @click="team && team.players.length === 1 && openPlayerProfile?.(team.players[0].name)"
                    >
                        {{ teamName }}
                    </div>
                    <div class="mt-team-score">{{ teamScore ?? '–' }}</div>
                </div>
                <!-- Elo nach dem Spiel, im Doppel der Durchschnitt -->
                <div v-if="elo" class="mt-team-elo">
                    {{ elo.players > 1 ? 'Ø ' : '' }}{{ elo.rating.toLocaleString('de-DE') }} Elo
                    <span class="mt-team-elo-delta" :class="elo.delta > 0 ? 'mt-elo-up' : 'mt-elo-down'">
                        {{ elo.delta > 0 ? '▲' : '▼' }} {{ elo.delta > 0 ? `+${elo.delta}` : `−${-elo.delta}` }}
                    </span>
                </div>
            </div>
        </div>

        <!-- Team Players when expanded -->
        <div v-if="team && playersVisible && team.players.length > 1" class="mt-team-players">
            <div class="mt-team-player cursor-pointer" v-for="(player, index) in team.players" :key="`${player.name}-${index}`" @click.stop="openPlayerProfile?.(player.name)">
                <Avatar
                    :name="player.name"
                    :shape="avatarShape"
                    size="normal"
                    class="mt-player-avatar shrink-0"
                    :grayscale="isLoser"
                />
                <div class="mt-team-player-name">{{ player.name }}</div>
                <div class="mt-team-player-score">{{ formatPlayerScore(player.score) }}</div>
            </div>
        </div>

    </div>
</template>

<script setup lang="ts">
import { PropType, computed, inject } from 'vue';
import { getMatchScore } from "@/util/tournamentMatchFunctions";
import Avatar from '@/components/shared/Avatar.vue';
import { vFitText, type FitTextGroup } from '@/components/shared/fitText';
import type { EloMatchSide } from '@/components/frontend/worldRanking/eloRating';

const props = defineProps({
    match: {type: Object as PropType<Match>, required: true },
    playersVisible: {type: Boolean, required: true },
    isTeam2: {type: Boolean, required: true },
    placeholder: {type: String, default: undefined},
    avatarShape: {type: String as () => 'circle' | 'square', default: 'circle'},
    elo: {type: Object as PropType<EloMatchSide>, default: undefined},
    // Beide Teamnamen eines Spiels gleich gross (v-fit-text)
    fitTextGroup: {type: Object as PropType<FitTextGroup>, default: undefined},
});

const team = computed(() => props.isTeam2 ? props.match.team2 : props.match.team1);

let teamName = computed(() => {
    if(team.value){
        if(team.value.name){
            return team.value.name;
        }else{
            return team.value.players.map(p => p.name.trim()).filter(name => name.length > 0).join(' & ');
        }
    }

    return props.placeholder || "TBD";
});

let teamScore = computed<number | undefined>(() => {
    return getMatchScore(props.match, !props.isTeam2);
});

let opponentTeamScore = computed<number | undefined>(() => {
    return getMatchScore(props.match, props.isTeam2);
});

const isWinner = computed(() => teamScore.value != undefined && opponentTeamScore.value != undefined && teamScore.value > opponentTeamScore.value);
const isLoser = computed(() => teamScore.value != undefined && opponentTeamScore.value != undefined && teamScore.value < opponentTeamScore.value);

let teamLogo = computed(() => {
    if(team.value && team.value.logo)
        return team.value.logo;
    return undefined;
});

// 6.5 -> "6,5"
const formatPlayerScore = (score: number | undefined) => score == undefined ? '–' : score.toLocaleString('de-DE');

const openPlayerProfile = inject<(name: string) => void>('openPlayerProfile');
</script>

<style scoped>
/* Groessen wachsen stufenlos mit der Bildschirmbreite (schmales Handy ~320px bis breites ~440px), darueber fest */
.MatchElementTeam{
    --mt-font: clamp(13.5px, 3.9vw, 17px);
    --mt-avatar: clamp(26px, 8.6vw, 38px);
    --mt-player-avatar: clamp(22px, 6.4vw, 28px);
    --mt-elo-font: clamp(10.5px, 2.75vw, 12px);
    --mt-score-font: clamp(15px, 4.2vw, 18px);
    --mt-score-height: clamp(26px, 7.4vw, 31px);
    --mt-gap: clamp(8px, 2.8vw, 12px);

    display: flex;
    flex-direction: column;
    color: #4a5058;
}
.mt-team{
    display: flex;
    align-items: center;
    gap: var(--mt-gap);
    min-height: calc(var(--mt-avatar) + 4px);
    font-size: var(--mt-font);
}
.mt-team-avatars{
    display: flex;
    align-items: center;
    flex-shrink: 0;
}
.mt-team-avatars > * + *{
    margin-left: calc(var(--mt-avatar) * -0.36);
}
.mt-logo,
.mt-avatar{
    width: var(--mt-avatar) !important;
    height: var(--mt-avatar) !important;
    min-width: var(--mt-avatar) !important;
    font-size: calc(var(--mt-avatar) * 0.39) !important;
}
.mt-player-avatar{
    width: var(--mt-player-avatar) !important;
    height: var(--mt-player-avatar) !important;
    min-width: var(--mt-player-avatar) !important;
    font-size: calc(var(--mt-player-avatar) * 0.4) !important;
}
.mt-team-main{
    flex: 1;
    min-width: 0;
}
.mt-team-line{
    display: flex;
    align-items: center;
    gap: calc(var(--mt-gap) + 6px);
}
/* Immer eine Zeile: zu lange Namen werden kleiner (v-fit-text), … nur als letzte Notloesung */
.mt-team-name{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.25;
}
/* Elo bewusst zurueckhaltend, der Name bleibt im Vordergrund.
   Rueckt in den Leerraum unter dem Namen, den die hoehere Score-Box laesst. */
.mt-team-elo{
    margin-top: min(0px, calc((var(--mt-font) * 1.25 - var(--mt-score-height)) / 2 + 1px));
    font-size: var(--mt-elo-font);
    line-height: 1.3;
    color: #B3B8BF;
    font-variant-numeric: tabular-nums;
}
.mt-elo-up{ color: #7DBD98; }
.mt-elo-down{ color: #DDA0A0; }
.mt-team-win .mt-team-name{
    font-weight: 700;
    color: #1f2328;
}

/* Ergebnis-Box: Sieger rot, sonst neutral grau */
.mt-team-score{
    min-width: calc(var(--mt-score-height) + 4px);
    height: var(--mt-score-height);
    padding: 0 6px;
    border-radius: 6px;
    background: #ECEEF1;
    color: #1f2328;
    font-size: var(--mt-score-font);
    font-weight: 600;
    line-height: var(--mt-score-height);
    text-align: center;
    flex-shrink: 0;
}
.mt-team-win .mt-team-score{
    background: var(--main-color);
    color: white;
    font-weight: 700;
}

/* Aufgeklappte Spieler mit Wuerfen */
.mt-team-players{
    display: flex;
    flex-direction: column;
    gap: 2px;
    /* Spielernamen buendig mit dem Teamnamen */
    padding: 4px 0 6px calc(var(--mt-avatar) + var(--mt-gap));
}
.mt-team-player{
    display: flex;
    align-items: center;
    gap: var(--mt-gap);
    min-height: calc(var(--mt-player-avatar) + 2px);
    font-size: calc(var(--mt-font) - 2px);
    color: #4a5058;
}
.mt-team-player-name{
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
}
.mt-team-player-score{
    min-width: calc(var(--mt-score-height) + 4px);
    text-align: center;
    color: #1f2328;
    flex-shrink: 0;
}
</style>
