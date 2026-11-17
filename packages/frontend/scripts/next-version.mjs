// Schlaegt die naechste Versionsnummer vor, gezaehlt an den Commits seit der letzten veroeffentlichten Version.
//
//   MAJOR.MINOR.PATCH
//   - grosses Update: erste Zahl (von Hand: npm run version:next -- --major)
//   - jedes neue Feature (Commit "feat: ..."): zweite Zahl +1, dritte zurueck auf 0
//   - jeder Bugfix oder jede Optimierung ("fix:", "perf:", "refactor:", "style:" ...): dritte Zahl +1
//
// Die letzte Version ist der neueste Eintrag in src/releases.json ohne "draft": true. Gezaehlt wird ab dem
// Commit, der diese Version in releases.json eingetragen hat (oder ab dem Git-Tag v<Version>, falls vorhanden).

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RELEASES = fileURLToPath(new URL('../src/releases.json', import.meta.url));
const git = (args) => execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const releases = JSON.parse(readFileSync(RELEASES, 'utf8'));
const published = releases.filter(release => !release.draft);
const last = published.at(-1)?.version;
if (!last) {
    console.log('Noch keine veroeffentlichte Version in releases.json.');
    process.exit(0);
}

const findBase = () => {
    try { return git(`rev-list -n 1 v${last}`); } catch { /* kein Tag */ }
    const added = git(`log --format=%H --reverse -S"\\"version\\": \\"${last}\\"" -- "${RELEASES}"`).split('\n').filter(Boolean);
    return added[0] ?? null;
};

const base = findBase();
const range = base ? `${base}..HEAD` : 'HEAD';
const subjects = git(`log --no-merges --reverse --format=%s ${range}`).split('\n').filter(Boolean);

let [major, minor, patch] = last.split('.').map(Number);
const counts = { feat: 0, fix: 0, other: 0 };
if (process.argv.includes('--major')) {
    major += 1; minor = 0; patch = 0;
} else {
    for (const subject of subjects) {
        if (/^feat(\(.+\))?!?:/.test(subject)) { minor += 1; patch = 0; counts.feat++; }
        else if (/^(fix|perf|refactor|style|chore|docs|test|build|ci)(\(.+\))?!?:/.test(subject)) { patch += 1; counts.fix++; }
        else counts.other++;
    }
}

console.log(`Letzte Version: ${last}${base ? '' : ' (Commit nicht gefunden, alle Commits gezaehlt)'}`);
console.log(`Seitdem: ${counts.feat} Features, ${counts.fix} Fixes/Optimierungen${counts.other ? `, ${counts.other} sonstige` : ''}`);
console.log(`Vorschlag: ${major}.${minor}.${patch}`);
