// Mehrere Handys in einem Knecht-Spiel: wer traegt wofuer ein? (ohne Imports, auch fuer den Demo-Server devLiveServer.ts)
//
// Jedes Handy hat eine Bindung:
// - team null: ganzer Tisch / "Fuer alle eintragen" (auch Schiri-Modus). Allein: das eine Handy. Mit anderen Handys:
//   hoechstens eines, die anderen sehen dann, dass es fuer alle eintraegt, und tragen selbst nichts ein.
// - team gesetzt, player null: Tischende dieses Teams (alle Spieler des Teams)
// - team und player gesetzt: genau dieser Spieler
// Spieler, die kein Handy abdeckt (z.B. ohne eigenes Handy), traegt jedes Handy mit ein, bevorzugt das eigene Team.

export type LiveDeviceBinding = { team: number | null; player: number | null };
export type LiveDevice = LiveDeviceBinding & { id: string; name: string | null; joinedAt: number };

// Ein Spieler, ein Tischende und "fuer alle" gehoeren hoechstens einem Handy
export const isBindingTaken = (devices: (LiveDeviceBinding & { id: string })[], binding: LiveDeviceBinding, exceptId?: string) =>
    devices.some(device => device.id !== exceptId && device.team === binding.team && (binding.team === null || device.player === binding.player));

// Ein weiteres Handy kommt dazu: hatte bisher ein einzelnes Handy den ganzen Tisch, steht es jetzt am anderen Tischende.
// Traegt in einer Runde mit mehreren Handys eines fuer alle ein, bleibt das so.
export const withJoinedDevice = <T extends LiveDeviceBinding>(devices: T[], joined: T): T[] => [
    ...devices.map(device => device.team === null && devices.length === 1 ? { ...device, team: joined.team === null ? null : 1 - joined.team, player: null } : device),
    joined,
];

// Handy, das (mit anderen Handys im Spiel) gerade fuer alle eintraegt
export const getTrackerDevice = <T extends LiveDeviceBinding>(devices: T[]) => devices.length > 1 ? devices.find(device => device.team === null) ?? null : null;

// Deckt ein Handy diesen Spieler ab?
const covers = (device: LiveDeviceBinding, team: number, player: number) =>
    device.team === null || (device.team === team && (device.player === null || device.player === player));

// Darf dieses Handy fuer den Spieler eintragen? Mit nur einem Handy immer.
export const canDeviceEnter = (devices: LiveDevice[], deviceId: string | null, team: number, player: number) => {
    const me = devices.find(device => device.id === deviceId);
    if (!me || devices.length < 2) return true;
    // Ein anderes Handy traegt fuer alle ein: dieses traegt nichts ein
    if (devices.some(device => device.team === null && device.id !== me.id)) return false;
    if (covers(me, team, player)) return true;
    if (devices.some(device => covers(device, team, player))) return false;
    // Niemand deckt den Spieler ab (kein eigenes Handy): die Handys seines Teams, hat das Team keins, jedes Handy
    return me.team === team || !devices.some(device => device.team === team);
};

// Fuer Hinweise, die nur ein Handy zeigen soll (z.B. "Shot-Zeit"): das erste Handy des Teams, sonst das erste ueberhaupt
export const getTeamDevice = (devices: LiveDevice[], team: number) => {
    const sorted = [...devices].sort((a, b) => a.joinedAt - b.joinedAt);
    return sorted.find(device => device.team === team) ?? sorted[0] ?? null;
};
