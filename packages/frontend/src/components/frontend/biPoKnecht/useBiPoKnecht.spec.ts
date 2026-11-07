import { describe, it, expect, vi } from 'vitest';
import { nextTick, reactive } from 'vue';

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
import { replay, type KnechtAction } from './knechtEngine';

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

    it('spielt ein fortgesetztes Spiel weiter, auch wenn die Aktionen als reaktive Proxys ankommen', () => {
        const stored = reactive({ actions: [{ type: 'throw', player: 0, outcome: 'hit', cup: 4, bouncer: true, extraCups: [9], time: 1 }] as KnechtAction[] });
        const game = useBiPoKnecht({ _id: 'placeholder', team1: team('Alice', 'Bob'), team2: team('Charlie', 'David') }, 0, stored.actions);
        expect(game.throwMiss('miss')).toBe(true);
        expect(game.actions.value).toHaveLength(2);
    });

    it('uebernimmt von einem gespeicherten Spiel nur den Teil, der zu den aktuellen Regeln passt', () => {
        const stored: KnechtAction[] = [
            { type: 'throw', player: 0, outcome: 'miss', time: 1 },
            { type: 'throw', player: 0, outcome: 'miss', time: 2 },      // derselbe Spieler zweimal: ungueltig
            { type: 'throw', player: 1, outcome: 'miss', time: 3 },
        ];
        const game = useBiPoKnecht({ _id: 'placeholder', team1: team('Alice', 'Bob'), team2: team('Charlie', 'David') }, 0, stored);
        expect(game.droppedActions).toBe(2);
        expect(game.actions.value).toHaveLength(1);
        expect(game.throwMiss('miss')).toBe(true);
        expect(game.state.value.turns).toHaveLength(2);
        expect(game.state.value.activeTeamIndex).toBe(1);
    });

    it('rechnet beim Rueckgaengig und Bearbeiten mit Zwischenstaenden denselben Stand wie ein komplettes Nachspielen', () => {
        const game = useBiPoKnecht({ _id: 'placeholder', team1: team('Alice', 'Bob'), team2: team('Charlie', 'David') }, 0);
        game.tapCup(0); game.throwMiss('miss'); game.throwMiss('miss'); game.throwMiss('airball'); game.tapCup(3); game.tapCup(5);
        const full = () => JSON.stringify(replay(game.config.value, game.actions.value).state);
        expect(JSON.stringify(game.state.value)).toBe(full());
        game.undo(); game.undo();
        expect(JSON.stringify(game.state.value)).toBe(full());
        expect(JSON.stringify(game.getStateAfter(2))).toBe(JSON.stringify(replay(game.config.value, game.actions.value.slice(0, 2)).state));
        const [first, ...rest] = game.actions.value;
        expect(game.replaceActions([{ type: 'throw', player: (first as { player: number }).player, outcome: 'miss', time: 0 }, ...rest])).toBeNull();
        expect(game.state.value.turns[0].type).toBe('miss');
        expect(JSON.stringify(game.state.value)).toBe(full());
    });
});
