// Team-Logos der BiPo League als PNG nach public/league-logos/, fuer die Ergebniskarte im Push (api/push-image.ts).
// Die WebP-Logos im Bundle haben wechselnde Dateinamen und @vercel/og kann kein WebP.
// Neu ausfuehren, wenn Teams oder Logos in LeagueSeasonsData.ts dazukommen: npm run generate:league-logos
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seasonsData = readFileSync(join(root, 'src/components/frontend/league/LeagueSeasonsData.ts'), 'utf8');
const outputDir = join(root, 'public/league-logos');

// Gleicher Slug wie leagueLogoSlug in api/push-image.ts
const leagueLogoSlug = (teamName) => teamName
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const logos = new Map();
for (const [, teamName, fileName] of seasonsData.matchAll(/teamName: '([^']+)'.*?logo: teamLogo\('([^']+)'\)/g))
    logos.set(leagueLogoSlug(teamName), fileName);

mkdirSync(outputDir, { recursive: true });
for (const [slug, fileName] of logos) {
    await sharp(join(root, 'src/assets/league/teams', fileName))
        .resize(200, 200, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ palette: true, quality: 85, compressionLevel: 9 })
        .toFile(join(outputDir, `${slug}.png`));
}
console.log(`${logos.size} Logos nach public/league-logos/ geschrieben`);
