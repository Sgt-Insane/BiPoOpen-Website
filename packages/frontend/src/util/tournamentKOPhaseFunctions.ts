// @ts-nocheck

import { getGroupsWithStats } from "@/util/tournamentGroupFunctions";
import { convertNumberToCharacter } from "@/util/util";
import axios from "axios";

export const setMatchesKOPhase = async (tournamentID:string, matches:Match[][]) => {
    let response = await axios.post("/tournaments/setMatchesKOPhase", {tournamentID: tournamentID, matches: matches})
    console.log(response.data.message);
    return response.status == 201;
}

export const initMatchesKOPhase = async (tournament:Tournament) => {
    let matches:Match[][] = [];
    let teamsInKOPhase = tournament.settings.advancingTeamsPerGroup * tournament.groupPhase.groups.length;

    // Check if teamsInKOPhase is a power of 2. If not, there are not enough teams to play a KO-Phase.  Choose the next power of 2 as teamsInKOPhase
    if(Math.log2(teamsInKOPhase) % 1 != 0){
        let power = 1;
        while (power < teamsInKOPhase) 
          power *= 2;
        teamsInKOPhase = power;
    }

    let stages = Math.log2(teamsInKOPhase);

    // Set Placeholder Matches without TeamIDs or Result for each Stage
    for (let i = 0; i < stages; i++){
        let ammountOfMatches = teamsInKOPhase/(Math.pow(2,i+1));
        matches.push([]);
        for (let x = 0; x < ammountOfMatches; x++) {
            let match = {_id: ""}; // Playerholder id. ID will be set by Database
            matches[i].push(match);
        }

        // Manually add game for 3rd place
        if(i == stages - 1)
            matches[i].push({_id: ""});
    }

    await setMatchesKOPhase(tournament._id, matches);
}

// Computes which group + placement feeds each slot of the first KO stage.
// Match groups that are far away from each other so that teams that played together in groupstage wont play again in KO-Stage.
// Returns { group1Number, group2Number, placeGroup1, placeGroup2 } (place 0 = winner, 1 = runner-up).
export const getFirstStageSeeding = (tournament:Tournament, x:number, stageLength:number) => {
    let group1Number, group2Number;
    let placeGroup1 = 0;
    let placeGroup2 = 1;
    if(x % 2 == 0){
        group1Number = x;
        group2Number = x + 1;
    }else{
        group1Number = stageLength - x;
        group2Number = stageLength - x - 1;
    }

    // 3 Groups and the best 2. advanced
    // TODO: This is hardcoded for 3 Groups. Make it dynamic
    if(tournament.name == "SCW 3 Karneval 2025"){
        if(x == 0){
            group1Number = 2;
            group2Number = 1;
        }
        if(x == 1){
            placeGroup1 = 1;
            placeGroup2 = 0;
            group1Number = 1;
            group2Number = 0;
        }
    }

    // Change first K.o-Stage for 2022 tournament
    if(tournament.name == "Weck BiPo Open 2022"){
        if(x == 0){
            group1Number = 2;
            group2Number = 0;
        }
        if(x == 1){
            group1Number = 3;
            group2Number = 1;
        }
        if(x == 2){
            group1Number = 0;
            group2Number = 3;
        }
        if(x == 3){
            group1Number = 1;
            group2Number = 2;
        }
    }

    return { group1Number, group2Number, placeGroup1, placeGroup2 };
}


// Gets called when Group or KO Phase sets Game Result
// Loops over all Matches in the KO Phase and sets the TeamIDs for the next Stage
export const updateMatchesKOPhase = async (tournament:Tournament) => {
    let matchesTMP:Match[][] = [];

    let matches = tournament.koPhase.matches;
    let groupsDecoded = tournament.groupPhase.groups;
    let groupsWithStats = getGroupsWithStats(tournament); // getGroups with stats because its sorted after wins. 

    matches.forEach((stage, i) => {
        matchesTMP.push([]);

        if(i == 0) { // First Stage 
            for (let x = 0; x < stage.length; x++) { 
                let matchTMP = stage[x];

                // groupNumber are the groups that are picked for the K.O-Stage.
                let { group1Number, group2Number, placeGroup1, placeGroup2 } = getFirstStageSeeding(tournament, x, stage.length);

                // Check if all games of group are played. Get first place of picked group1 and set as team1
                if(!tournament.groupPhase.matches[group1Number].find((match) => !match.result)) 
                    matchTMP.team1ID = groupsDecoded[group1Number].teams.find(team => team.name == groupsWithStats[group1Number].teams[placeGroup1].name)!._id;
                
                // Check if all games of group are played. Get second place of picked group2 and set as team2
                if(!tournament.groupPhase.matches[group2Number].find((match) => !match.result)) 
                    matchTMP.team2ID = groupsDecoded[group2Number].teams.find(team => team.name == groupsWithStats[group2Number].teams[placeGroup2].name)!._id;

                matchesTMP[i].push(matchTMP); 
            }
        }else if(i == matches.length - 1){ // Last Stage (Finale, 3. Platz)
            let matchFinal = stage[0];
            let matchThirdPlace = stage[1];

            let semiFinal1 = matches[i-1][0];
            let semiFinal2 = matches[i-1][1];

            if(semiFinal1.result){
                matchFinal.team1ID = semiFinal1.result.team1Score > semiFinal1.result.team2Score ? semiFinal1.team1ID : semiFinal1.team2ID;
                matchThirdPlace.team1ID = semiFinal1.result.team1Score > semiFinal1.result.team2Score ? semiFinal1.team2ID : semiFinal1.team1ID;
            }
                
            if(semiFinal2.result){
                matchFinal.team2ID = semiFinal2.result.team1Score > semiFinal2.result.team2Score ? semiFinal2.team1ID : semiFinal2.team2ID;
                matchThirdPlace.team2ID = semiFinal2.result.team1Score > semiFinal2.result.team2Score ? semiFinal2.team2ID : semiFinal2.team1ID;
            }

            matchesTMP[i].push(matchFinal); 
            matchesTMP[i].push(matchThirdPlace); 

        }else{ // Other Stages
            for (let x = 0; x < stage.length; x++) { 
                let matchTMP = stage[x];

                let match1 = matches[i-1][x*2];
                let match2 = matches[i-1][x*2 + 1];

                if(match1.result)
                    matchTMP.team1ID = match1.result.team1Score > match1.result.team2Score ? match1.team1ID : match1.team2ID;
                if(match2.result)
                    matchTMP.team2ID = match2.result.team1Score > match2.result.team2Score ? match2.team1ID : match2.team2ID;
                
                matchesTMP[i].push(matchTMP); 
            }   
        }
    });

    await setMatchesKOPhase(tournament._id, matchesTMP);
}

// KO-PHASE
export const setGameResultKOPhase = async (tournament:Tournament, match:Match) => {
    // Find match in matches and add result 
    let matches = tournament.koPhase.matches;
    for (let i = 0; i < matches.length; i++) {
        for (let x = 0; x < matches[i].length; x++) {
            if(match._id == matches[i][x]._id){
                let result = {
                    team1Score:  match.team1.players[0].score + match.team1.players[1].score,
                    team1Player1Score: match.team1.players[0].score, 
                    team1Player2Score: match.team1.players[1].score, 
                
                    team2Score:  match.team2.players[0].score + match.team2.players[1].score,
                    team2Player1Score: match.team2.players[0].score, 
                    team2Player2Score: match.team2.players[1].score
                }
                
                matches[i][x].result = result;
                matches[i][x].time ??= Date.now(); // beim Bearbeiten bleibt das erste Eintragsdatum
            }
        }
    }

    await setMatchesKOPhase(tournament._id, matches);
    await updateMatchesKOPhase(tournament);
}