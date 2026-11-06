import { describe, it, expect, vi } from 'vitest';
import { nextTick } from 'vue';

// biPoSound liest localStorage beim Laden des Moduls
vi.hoisted(() => {
    const store = new Map<string, string>();
    (globalThis as any).localStorage ??= {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
    };
    (globalThis as any).localStorage.setItem('bipo_knecht_muted', 'true');
});

import { useBiPoKnecht } from './useBiPoKnecht';

const team = (...names: string[]): Team => ({ _id: 'placeholder', players: names.map(name => ({ _id: 'placeholder', name, score: 0 })) });
const createGame = () => {
    const game = useBiPoKnecht({ _id: 'placeholder', team1: team('Alice', 'Bob'), team2: team('Charlie', 'David') });
    game.start(0);
    return game;
};

describe('useBiPoKnecht (Oberflaeche)', () => {
    it('waehlt beim Bouncer erst den zweiten Becher, dann wird der Wurf eingetragen', () => {
        const game = createGame();
        game.toggleBouncer();
        game.tapCup(4);
        expect(game.pick.value).toMatchObject({ cup: 4, needed: 1 });
        expect(game.actions.value).toHaveLength(0);

        game.tapCup(9);
        expect(game.pick.value).toBeNull();
        expect(game.bouncerArmed.value).toBe(false);
        expect(game.state.value.turns[0]).toMatchObject({ type: 'bouncer', data: { cupIndex1: 4, cupIndex2: 9 } });
    });

    it('fragt bei der Bombe zwei Zusatzbecher ab', () => {
        const game = createGame();
        game.tapCup(4);
        game.tapCup(4);
        expect(game.pick.value).toMatchObject({ type: 'bomb', needed: 2 });
        game.tapCup(1);
        game.tapCup(2);
        expect(game.state.value.turns.at(-1)!.type).toBe('bomb');
    });

    it('bricht die Becherauswahl mit Rueckgaengig ab, danach wird der letzte Wurf entfernt', () => {
        const game = createGame();
        game.throwMiss('miss');
        game.toggleBouncer();
        game.tapCup(4);
        game.undo();
        expect(game.pick.value).toBeNull();
        expect(game.actions.value).toHaveLength(1);
        game.undo();
        expect(game.actions.value).toHaveLength(0);
    });

    it('laesst den Werfer frei waehlen und sperrt Spieler, die schon geworfen haben', async () => {
        const game = createGame();
        game.selectPlayer(1);
        game.throwMiss('airball');
        await nextTick();
        expect(game.state.value.turns[0].playerIndex).toBe(1);
        expect(game.allowedThrowers.value).toEqual([0]);
        expect(game.selectedPlayer.value).toBe(0);
        game.selectPlayer(1);
        expect(game.selectedPlayer.value).toBe(0);
    });

    it('uebernimmt Korrekturen im Verlauf nur, wenn der Rest des Spiels gueltig bleibt', () => {
        const game = createGame();
        game.tapCup(3);
        game.throwMiss('miss');
        const actions = game.actions.value;

        // Treffer -> Nullwurf: gueltig
        expect(game.replaceActions([{ ...actions[0], outcome: 'miss', cup: undefined } as never, actions[1]])).toBeNull();
        expect(game.state.value.turns[0].type).toBe('miss');

        // Zweimal derselbe Spieler im 2 gegen 2: ungueltig, Stand bleibt
        const message = game.replaceActions([actions[0], { ...actions[1], player: 0 } as never]);
        expect(message).toContain('Wurf 2');
        expect(game.state.value.turns[0].type).toBe('miss');
    });
});
