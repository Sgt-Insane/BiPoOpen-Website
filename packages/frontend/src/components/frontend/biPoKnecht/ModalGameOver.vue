<template>
    <Modal class="ModalGameOver">
        <template #title>Spiel Beendet</template>

        <template #template>

            <div>Spiel Ergebnis</div>
            <div class="mgo-result">
                <div v-for="team in [match.team1, match.team2]" class="mgo-team">
                    <div class="mgo-team-score" v-if="team.players.length > 1">{{ team.players.reduce((acc, player) => acc + player.score, 0) }}</div>
                    <div v-for="player in team.players" class="mgo-player">
                        <div class="mgo-player-name">{{ player.name }}</div>
                        <div class="mgo-player-score">{{ player.score }}</div>
                    </div>
                </div>
            </div>

            <div>{{ 'Dauer: ' + formatGameDuration(match.time!, match.endTime!) }}</div>

            <div class="mgo-history">
                <div>Spiel Verlauf</div>
                <div class="mgo-turn" v-for="(turn, index) in match.turns" :style="{ 'background-color': turn.teamIndex == 0 ? 'var(--main-color)' : 'var(--secondary-color)' }">
                    {{ index + 1 + '. ' + getPlayerName(turn.teamIndex, turn.playerIndex) + ' - ' + getCorrectTurnName(turn.type) }}
                </div>
            </div>
        </template>

        <!-- Button 1 -->
        <template #cancle v-if="onRematch">
            <div @click="onRematch()">Revanche</div>
        </template>

        <!-- Button 2 -->   
        <template #confirm>
            <div @click="endGame()">BiPo Knecht beenden</div>
        </template>
    </Modal>
</template>

<script setup lang="ts">
import Modal from '@/components/shared/Modal.vue';
import { onMounted, PropType } from 'vue';
import router from '@/router.js';
import { addLeagueGame } from '../league/LeagueUtilFunctions';
import { addOpenGame } from '../openGames/OpenGamesUtilFunctions';

const props = defineProps({
    match: { type: Object as PropType<Match>, required: true },
    isLeagueGame: {type: Boolean, required: false, default: false },
    onRematch: {type: Function as PropType<() => void>, required: false }
});

onMounted(async () => {
    if(props.isLeagueGame){
        let success = await addLeagueGame(props.match);
    }else{
        let success = await addOpenGame(props.match);
    }
});

let getPlayerName = (teamIndex: number, playerIndex: number) => {
  const team = teamIndex == 0 ? props.match.team1 : props.match.team2;
  const player = team.players[playerIndex];
  return player.name;
}

function formatGameDuration(startTime:number, endTime:number) {
  const diff = endTime - startTime;
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')} Minuten`;
}

let getCorrectTurnName = (turnType:Turn['type']) => {
  switch(turnType) {
    case 'hit': return 'Treffer';
    case 'miss': return 'Nullwurf';
    case 'airball': return 'Airball';
    case 'bomb': return 'Bombe';
    case 'bouncer': return 'Bouncer';
    case 'trickshot': return 'Trickshot';
    case 'onfire': return 'On Fire';
    case 'ballsback': return 'Treffer - Balls Back';
    case 'lastCup': return 'Letzter Becher';
    default: return turnType;
  }
}

let endGame = async () => {
    if(props.isLeagueGame){
        router.push({path: '/League'});
    }else{
        router.push({path: '/'});
    }
}   
</script>

<style>
.ModalGameOver{
    z-index: 9999999;
}
.ModalGameOver .mo-container{
    height: 90%;
    overflow: auto;
}
.mo-button{
   width: 100%;
}
</style>

<style scoped>
.mgo-result{
    display: flex;
    flex-direction: row;
    margin-bottom: 20px;
    justify-content: center;
    width: 100%;
    gap: 5px;
}
.mgo-team{
    width: 100%;
    color: white;
    padding: 5px 15px;
}
.mgo-team:nth-child(1){
    background-color: var(--main-color);
}
.mgo-team:nth-child(2){
    background-color: var(--secondary-color);
}
.mgo-team-score{
    font-weight: bold;
}
.mgo-team:nth-child(1) .mgo-team-score{
    text-align: right;
}
.mgo-player{
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    gap: 5px;
    align-items: center;
}
.mgo-team:nth-child(2) .mgo-player{
    flex-direction: row-reverse;
}
.mgo-player-name{
    white-space: nowrap;
    font-size: 16px;
}

/* History */
.mgo-history{
    margin-top: 20px;
    margin-bottom: 40px;
}
.mgo-turn{
    width: 100%;
    padding: 10px;
    margin-bottom: 5px;
    color: white;
}
</style>