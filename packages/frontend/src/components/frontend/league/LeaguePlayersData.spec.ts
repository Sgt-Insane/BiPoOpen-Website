import { describe, it, expect } from 'vitest';
import { getLeagueTeamForPlayer, getLeagueTeamsForPlayer, getPlayerForLeagueTeam } from './LeaguePlayersData';

describe('LeaguePlayersData', () => {
    it('kennt alle Teams eines Spielers, auch fruehere Teamnamen', () => {
        // Nutzertest: 8 Liga-Spiele unter "Sgt. Insane" fehlten im Profil (Suche 203, Profil 195)
        const teams = getLeagueTeamsForPlayer('Matthias Weck');
        expect(teams).toEqual(expect.arrayContaining(['Sgt. Insane', 'Cupfire Squad']));
        expect(teams).toContain(getLeagueTeamForPlayer('Matthias Weck'));
        teams.forEach(team => expect(getPlayerForLeagueTeam(team)).toBe('Matthias Weck'));
    });

    it('liefert fuer Spieler ohne Liga-Team eine leere Liste', () => {
        expect(getLeagueTeamsForPlayer('Niemand Unbekannt')).toEqual([]);
    });
});
