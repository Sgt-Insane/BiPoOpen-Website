// @ts-nocheck

import { getAmmountOfEnemyHitsFromTeam, getAmmountOfHitsFromTeam, getAmmountOfMatchesFromPlayer, getAmmountOfWinsFromTeam } from "@/util/tournamentStatsFunctions";
import { updateMatchesKOPhase } from "@/util/tournamentKOPhaseFunctions";
import { getFinishedMatchesFromTeam } from "@/util/tournamentTeamFunctions";
import { checkIfTeam1WonVsTeam2 } from "@/util/tournamentMatchFunctions";
import { shuffleArray } from "@/util/util";
import axios from "axios";

export const setGroups = async (tournamentID:string, groups:Group[]) => {
    let response = await axios.post("/tournaments/setGroups", {tournamentID: tournamentID, groups: groups})
    console.log(response.data.message);
    return response.status == 201;
}

export const generateRandomGroups = async (tournament:Tournament) => {
    let groups:Group[] = [];
    let teams:Team[] = shuffleArray(tournament.teams);
 
    // Case: Fixed ammount of Groups
    let groupAmmount = tournament.settings.fixedGroupAmmount;
    for (let i = 0; i < groupAmmount; i++)
       groups.push({teams: []});
    for (let i = 0; i < teams.length; i++)
       groups[i%groupAmmount].teams.push({teamID: teams[i]._id});
    
    await setGroups(tournament._id, groups);  // Set Groups in Database
}

export const getGroupsWithStats = (tournament:Tournament|undefined) => {
    let groupsWithStats:GroupWithStats[] = [];
    
    let tournamentGroups = tournament?.groupPhase.groups!;
    
    for (let i = 0; i < tournamentGroups.length; i++) {
        groupsWithStats.push({teams: []});
        
        for (let x = 0; x < tournamentGroups[i].teams.length; x++) {
            if(!tournamentGroups[i].teams[x]) continue;
            let teamName = tournamentGroups[i].teams[x].name!;
            let ammountOfHitsFromTeam = getAmmountOfHitsFromTeam(tournament, teamName, true);
            let ammountOfEnemyHitsFromTeam = getAmmountOfEnemyHitsFromTeam(tournament, teamName, true);

            let team = {
                name: teamName,
                logo: tournamentGroups[i].teams[x].logo,
                players: tournamentGroups[i].teams[x].players,
                wins: getAmmountOfWinsFromTeam(tournament, teamName, true),
                ammountOfMatches: getAmmountOfMatchesFromPlayer(tournament, tournamentGroups[i].teams[x].players[0].name, true),
                hitDifference: ammountOfHitsFromTeam + " : " + ammountOfEnemyHitsFromTeam,
                hitDifferenceNumber: ammountOfHitsFromTeam - ammountOfEnemyHitsFromTeam,
                hits: ammountOfHitsFromTeam
            }

            groupsWithStats[i].teams.push(team);
        }
    }

    // Sort after wins, hit difference and direct win against component
    groupsWithStats.forEach((group) => {
        group.teams = group.teams.sort((team1, team2) => {
            if (team1.wins == team2.wins && team1.hitDifferenceNumber == team2.hitDifferenceNumber) {
                // Direkter Vergleich: abgeschlossene Spiele zwischen den beiden Teams zählen
                let directMatches = getFinishedMatchesFromTeam(tournament, team1.name, true).filter((m) => m.team1.name == team2.name || m.team2.name == team2.name);

                let team1DirectWins = 0;
                let team2DirectWins = 0;
                directMatches.forEach((match) => {
                    let team1Won = checkIfTeam1WonVsTeam2(match);
                    if (team1Won === undefined) return;
                    let winnerName = team1Won ? match.team1.name : match.team2.name;
                    if (winnerName == team1.name) team1DirectWins++;
                    else if (winnerName == team2.name) team2DirectWins++;
                });

                if (team1DirectWins != team2DirectWins)
                    return team2DirectWins - team1DirectWins; // Sieger im direkten Duell steht vorne

                return team2.hits - team1.hits;
            }
            else if(team1.wins == team2.wins)
                return team2.hitDifferenceNumber - team1.hitDifferenceNumber;

            return team2.wins - team1.wins;
        });
    });
    
    return groupsWithStats;
}

export const setMatchesGroupPhase = async (tournamentID:string, matches:Match[][]) => {
    let response = await axios.post("/tournaments/setMatchesGroupPhase", {tournamentID: tournamentID, matches: matches})
    console.log(response.data.message);
    return response.status == 201;
}

export const generateRandomMatchesGroupPhase = async (tournament:Tournament) => {
    let matches:Match[][] = [];
    let groups = tournament.groupPhase.groups;
 
    for (let i = 0; i < groups.length; i++) {
        let matchesForGroup:Match[] = [];
        let teams = groups[i].teams;
        let ammountOfGames = (teams.length * (teams.length - 1)) / 2;

        if(ammountOfGames == 10){ // 5er Gruppen
            matchesForGroup.push({team1ID: teams[0]._id, team2ID: teams[1]._id, _id: ""});
            matchesForGroup.push({team1ID: teams[2]._id, team2ID: teams[3]._id, _id: ""});
            matchesForGroup.push({team1ID: teams[0]._id, team2ID: teams[4]._id, _id: ""});
            matchesForGroup.push({team1ID: teams[1]._id, team2ID: teams[3]._id, _id: ""});
            matchesForGroup.push({team1ID: teams[2]._id, team2ID: teams[4]._id, _id: ""});
            matchesForGroup.push({team1ID: teams[0]._id, team2ID: teams[3]._id, _id: ""});
            matchesForGroup.push({team1ID: teams[1]._id, team2ID: teams[2]._id, _id: ""});
            matchesForGroup.push({team1ID: teams[3]._id, team2ID: teams[4]._id, _id: ""});
            matchesForGroup.push({team1ID: teams[0]._id, team2ID: teams[2]._id, _id: ""});
            matchesForGroup.push({team1ID: teams[1]._id, team2ID: teams[4]._id, _id: ""});

        }else if(ammountOfGames == 6){ // 4er Gruppen
            matchesForGroup.push({team1ID: teams[0]._id, team2ID: teams[1]._id, _id: ""}); // 1. vs 2.
            matchesForGroup.push({team1ID: teams[2]._id, team2ID: teams[3]._id, _id: ""}); // 3. vs 4.
            matchesForGroup.push({team1ID: teams[0]._id, team2ID: teams[3]._id, _id: ""}); // 1. vs 4.
            matchesForGroup.push({team1ID: teams[2]._id, team2ID: teams[1]._id, _id: ""}); // 3. vs 2.
            matchesForGroup.push({team1ID: teams[0]._id, team2ID: teams[2]._id, _id: ""}); // 1. vs 3.
            matchesForGroup.push({team1ID: teams[1]._id, team2ID: teams[3]._id, _id: ""}); // 2. vs 4.

        }else if(ammountOfGames == 3){ // 3er Gruppen
            // Hinrunde
            matchesForGroup.push({team1ID: teams[0]._id, team2ID: teams[1]._id, _id: ""});
            matchesForGroup.push({team1ID: teams[0]._id, team2ID: teams[2]._id, _id: ""});
            matchesForGroup.push({team1ID: teams[1]._id, team2ID: teams[2]._id, _id: ""});

            // Rückrunde
            matchesForGroup.push({team1ID: teams[0]._id, team2ID: teams[1]._id, _id: ""});
            matchesForGroup.push({team1ID: teams[0]._id, team2ID: teams[2]._id, _id: ""});
            matchesForGroup.push({team1ID: teams[1]._id, team2ID: teams[2]._id, _id: ""});

        }else{
            for (let x = 0; x < teams.length; x++){
                for (let y = x+1; y < teams.length; y++) {
                    let match = {team1ID: teams[y]._id, team2ID: teams[x]._id, _id: ""};
                    matchesForGroup.push(match);
                }
            }

            matchesForGroup = shuffleArray(matchesForGroup);
        }

        matches.push(matchesForGroup);
    }

    await setMatchesGroupPhase(tournament._id,matches);
}

export const setGameResultGroupPhase = async (tournament:Tournament, match:Match) => {
    // Find match in matches and add result 
    let matches = tournament.groupPhase.matches;
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

    await setMatchesGroupPhase(tournament._id, matches);
    await updateMatchesKOPhase(tournament);
}