import { CUP_COUNT } from './knechtEngine';

// Benannte Formationen der noch stehenden Becher. Sobald nach einer Aktion genau diese Becher stehen,
// zeigt der Knecht eine Animation. Gespiegelte Formationen zaehlen automatisch mit.
//
// Becher-Nummern aus Sicht des Werfers (Nummer = Index in der Engine + 1):
//
//        7   8   9   10      hinten
//          4   5   6
//            2   3
//              1             vorne (Spitze)
//
// Namen einfach hier aendern oder neue Zeilen ergaenzen.

export type FormationEffect = 'wall' | 'ring' | 'hole' | 'towers' | 'stripe' | 'pop';

export type KnechtFormation = {
    name: string;
    cups: number[];             // stehende Becher (Nummern 1-10)
    effect: FormationEffect;    // Zusatzeffekt der Animation
};

const allExcept = (...missing: number[]) => Array.from({ length: CUP_COUNT }, (_, i) => i + 1).filter(cup => !missing.includes(cup));

export const KNECHT_FORMATIONS: KnechtFormation[] = [
    { name: 'Berliner Mauer', cups: [7, 8, 9, 10], effect: 'wall' },
    { name: 'Ring of Fire', cups: [2, 3, 4, 6, 8, 9], effect: 'ring' },
    { name: 'Arschlochbecher', cups: allExcept(5), effect: 'hole' },
    { name: 'Twin Towers', cups: [2, 3], effect: 'towers' },
    { name: 'Schneise', cups: allExcept(3, 5, 8), effect: 'stripe' },
    { name: 'Friedrich März', cups: allExcept(2, 3, 5), effect: 'pop' },
];

// Spiegelung links <-> rechts aus Sicht des Werfers
const MIRROR: Record<number, number> = { 1: 1, 2: 3, 3: 2, 4: 6, 5: 5, 6: 4, 7: 10, 8: 9, 9: 8, 10: 7 };

const key = (cups: number[]) => [...cups].sort((a, b) => a - b).join(',');

const FORMATION_BY_KEY = new Map<string, KnechtFormation>();
KNECHT_FORMATIONS.forEach(formation => {
    FORMATION_BY_KEY.set(key(formation.cups), formation);
    const mirrored = key(formation.cups.map(cup => MIRROR[cup]));
    if (!FORMATION_BY_KEY.has(mirrored)) FORMATION_BY_KEY.set(mirrored, { ...formation, cups: formation.cups.map(cup => MIRROR[cup]) });
});

// Stehende Becher als Engine-Indizes (0-9) -> passende Formation oder null
export const findFormation = (standingIndices: number[]): KnechtFormation | null =>
    FORMATION_BY_KEY.get(key(standingIndices.map(index => index + 1))) ?? null;

export const cupNumber = (index: number) => index + 1;
