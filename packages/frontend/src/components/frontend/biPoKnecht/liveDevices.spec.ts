import { describe, expect, it } from 'vitest';
import { canDeviceEnter, getTeamDevice, isBindingTaken, withJoinedDevice, type LiveDevice } from './liveDevices';

const device = (id: string, team: number | null, player: number | null, joinedAt = 0): LiveDevice => ({ id, name: id, team, player, joinedAt });

describe('Mehrere Handys: wer traegt wofuer ein', () => {
    it('ein einzelnes Handy traegt alles ein', () => {
        const devices = [device('a', 0, 0)];
        expect(canDeviceEnter(devices, 'a', 1, 0)).toBe(true);
    });

    it('jeder Spieler traegt mit seinem Handy nur selbst ein', () => {
        const devices = [device('a', 0, 0), device('b', 0, 1), device('c', 1, 0), device('d', 1, 1)];
        expect(canDeviceEnter(devices, 'a', 0, 0)).toBe(true);
        expect(canDeviceEnter(devices, 'a', 0, 1)).toBe(false);
        expect(canDeviceEnter(devices, 'a', 1, 0)).toBe(false);
    });

    it('Spieler ohne Handy traegt ein Handy seines Teams mit ein', () => {
        // 2 gegen 2, Spieler 1 von Team 0 hat kein Handy
        const devices = [device('a', 0, 0), device('c', 1, 0), device('d', 1, 1)];
        expect(canDeviceEnter(devices, 'a', 0, 1)).toBe(true);
        expect(canDeviceEnter(devices, 'c', 0, 1)).toBe(false);
        expect(canDeviceEnter(devices, 'c', 0, 0)).toBe(false);
    });

    it('hat ein Team gar kein Handy, traegt jedes Handy fuer es ein', () => {
        const devices = [device('a', 0, 0), device('b', 0, 1)];
        expect(canDeviceEnter(devices, 'a', 1, 0)).toBe(true);
        expect(canDeviceEnter(devices, 'b', 1, 0)).toBe(true);
    });

    it('ein Tischende deckt alle Spieler seines Teams ab', () => {
        const devices = [device('a', 0, null), device('b', 1, null)];
        expect(canDeviceEnter(devices, 'a', 0, 1)).toBe(true);
        expect(canDeviceEnter(devices, 'b', 0, 1)).toBe(false);
    });

    it('ein Platz gehoert hoechstens einem Handy', () => {
        const devices = [device('a', 0, 0), device('b', 1, null)];
        expect(isBindingTaken(devices, { team: 0, player: 0 })).toBe(true);
        expect(isBindingTaken(devices, { team: 0, player: 0 }, 'a')).toBe(false);
        expect(isBindingTaken(devices, { team: 1, player: null })).toBe(true);
        expect(isBindingTaken(devices, { team: 1, player: 0 })).toBe(false);
    });

    it('wer den ganzen Tisch hatte, steht nach einem Beitritt am anderen Tischende', () => {
        const joined = withJoinedDevice([device('a', null, null)], device('b', 1, 0));
        expect(joined.map(entry => [entry.id, entry.team, entry.player])).toEqual([['a', 0, null], ['b', 1, 0]]);
    });

    it('Hinweise wie "Shot-Zeit" zeigt nur das erste Handy des Teams', () => {
        const devices = [device('b', 1, 0, 2), device('a', 0, 0, 1), device('c', 1, 1, 3)];
        expect(getTeamDevice(devices, 1)?.id).toBe('b');
        // Team ohne Handy: das erste Handy ueberhaupt
        expect(getTeamDevice([device('b', 1, 0, 2), device('c', 1, 1, 3)], 0)?.id).toBe('b');
    });
});
