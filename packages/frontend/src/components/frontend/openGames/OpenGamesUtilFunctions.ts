import axios from "axios";
import { getDemoGames } from "@/util/demoGames";

/////////////
// GENERAL //
/////////////
export const getAllOpenGames = async () => {
    let response = await axios.get("/openGames/get");
    if(response.status == 200)
        return [...response.data.openGames as Match[], ...getDemoGames('open')];

    return [];
}

export const addOpenGame = async (openGame:Match) => {
    let response = await axios.post("/openGames/create", openGame);
    return response.status == 201
}

export const updateOpenGame = async (openGame:Match) => {
    let response = await axios.patch("/openGames/update/" + openGame._id, openGame);
    return response.status == 201;
}

export const deleteOpenGame = async (openGame: Match) => {
    let response = await axios.delete("/openGames/delete/" + openGame._id);
    return response.status == 200;
}

export const getAllOpenGameNames = async () => {
    let allOpenGames = await getAllOpenGames();

    let openGameNames = [
        ...new Set(
            allOpenGames.flatMap(game =>
                [...game.team1.players, ...game.team2.players].map(
                    p => p.name
                        .split(" ")
                        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                        .join(" ")
                )
            )
        )
    ];

    return openGameNames;
}


/////////////
// PLAYERS //
/////////////
export const getMatchesFromPlayer = (openGames:Match[], playerName:string, oneVersusOne:boolean) => { 
    let matchesFromPlayer:Match[] = [];

    openGames.forEach((openGame) => {
        if(openGame.team1!.players.map(player => player.name.toLowerCase()).includes(playerName) || openGame.team2!.players.map(player => player.name.toLowerCase()).includes(playerName)){
            if(oneVersusOne){
                if(openGame.team1!.players.length == 1 && openGame.team2!.players.length == 1){
                    matchesFromPlayer.push(openGame);
                }
            }else{
                if(openGame.team1!.players.length == 2 && openGame.team2!.players.length == 2){
                    matchesFromPlayer.push(openGame);
                }
            }
        }
    });

    return matchesFromPlayer;
}
