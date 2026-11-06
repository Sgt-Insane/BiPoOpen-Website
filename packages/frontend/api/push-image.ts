import { ImageResponse } from '@vercel/og';

// Ergebniskarte fuer Push-Benachrichtigungen (grosses Bild, Android ausgeklappt).
// Aufbau der URL: packages/backend/src/util/notify.ts (resultImageUrl)
// ?t1=Name&t1=Name&s1=10&n1=Teamname&t2=...&s2=9&n2=...&label=Offenes Spiel[&logos=1]
// logos=1 (Liga): t1/t2 sind Teams, statt Spielerbild das Logo aus public/league-logos/ (scripts/generate-league-logos.mjs)
// Gewinner steht immer links, Verlierer abgeblendet.

const WIDTH = 1024;
const HEIGHT = 512;
const AVATAR_SIZE = 150;
const LOGO_SIZE = 180;
// Avatare und Logos stehen mittig in einer Zeile dieser Hoehe
const AVATAR_ROW_HEIGHT = LOGO_SIZE;
const SCORE_SIZE = 124;
// Avatare + einzeilige Namen vertikal mittig; zweizeilige Teamnamen wachsen nach unten
const CONTENT_TOP = 125;
const BACKEND_BASE_URL = 'https://bipoopen-backend.vercel.app';
// Spielerbild darf den Push nicht aufhalten
const IMAGE_TIMEOUT_MS = 2500;
// Standardschrift von @vercel/og kennt kein Fett. Latin-Subset enthaelt Umlaute.
const FONT_URL = 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@5.0.8/latin-700-normal.woff';
let fontRequest: Promise<ArrayBuffer | null> | null = null;
const loadFont = () => fontRequest ??= fetch(FONT_URL)
  .then(res => res.ok ? res.arrayBuffer() : null)
  .catch(() => null)
  .then(font => { if (!font) fontRequest = null; return font; });

// Rot der Website (--main-color), wie die Link-Vorschaubilder (og-image.ts)
const MAIN_COLOR = '#EA5160';
const BACKGROUND = `linear-gradient(135deg, ${MAIN_COLOR} 0%, #C93A4A 100%)`;
// Ring um die Avatare, trennt die ueberlappenden Kreise
const AVATAR_RING = '#D84656';

// Initialen-Farben je Position im Team
const WINNER_AVATAR_COLORS = [
  { background: 'white', color: MAIN_COLOR },
  { background: '#FFD9DD', color: '#B32F3F' },
];
const LOSER_AVATAR_COLOR = { background: '#EE8F99', color: '#FFE7EA' };

type CardTeam = { players: string[]; score: number; name: string };

const getPlayerInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  const initials = `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  // Wie im Frontend: "SS" vermeiden
  if (initials === 'SS') return parts[0].slice(0, 2).toUpperCase();
  return initials;
};

const fetchPlayerImage = async (playerName: string): Promise<string | null> => {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/playerImages/get/${encodeURIComponent(playerName)}`, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
    if (res.status !== 200) return null;
    const data = await res.json();
    return data?.imageData || null;
  } catch {
    return null;
  }
};

// Gleicher Slug wie in scripts/generate-league-logos.mjs
const leagueLogoSlug = (teamName: string) => teamName
  .trim()
  .toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const toDataUrl = (buffer: ArrayBuffer, type: string) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(binary)}`;
};

// Fehlt das Logo (neues Team, Skript nicht ausgefuehrt), kommen Initialen
const fetchLeagueLogo = async (origin: string, teamName: string): Promise<string | null> => {
  try {
    const res = await fetch(`${origin}/league-logos/${leagueLogoSlug(teamName)}.png`, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
    if (!res.ok || !res.headers.get('content-type')?.includes('image/png')) return null;
    return toDataUrl(await res.arrayBuffer(), 'image/png');
  } catch {
    return null;
  }
};

const readTeam = (searchParams: URLSearchParams, key: '1' | '2'): CardTeam => {
  const players = searchParams.getAll(`t${key}`).map(name => name.trim()).filter(Boolean).slice(0, 2);
  return {
    players,
    score: Number(searchParams.get(`s${key}`)) || 0,
    // Teamname (Turnier, Liga), sonst Vornamen
    name: searchParams.get(`n${key}`) || players.map(name => name.split(' ')[0]).join(' & '),
  };
};

const logo = (image: string, isLoser: boolean) => ({
  type: 'img',
  props: { src: image, width: LOGO_SIZE, height: LOGO_SIZE, style: { objectFit: 'contain' as const, opacity: isLoser ? 0.6 : 1 } },
});

const avatar = (name: string, image: string | null, index: number, isLoser: boolean) => {
  const size = AVATAR_SIZE;
  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: `7px solid ${AVATAR_RING}`,
    marginLeft: index === 0 ? 0 : -40,
  };

  // Verlierer: Foto abgeblendet, Initialen grau
  if (image) {
    return { type: 'img', props: { src: image, width: size, height: size, style: { ...style, objectFit: 'cover' as const, opacity: isLoser ? 0.55 : 1 } } };
  }

  const colors = isLoser ? LOSER_AVATAR_COLOR : WINNER_AVATAR_COLORS[index] ?? WINNER_AVATAR_COLORS[0];
  return {
    type: 'div',
    props: {
      style: {
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        color: colors.color,
        fontSize: 52,
        fontWeight: 700,
      },
      children: getPlayerInitials(name),
    },
  };
};

const teamColumn = (team: CardTeam, images: (string | null)[], isLoser: boolean, isLogo: boolean) => ({
  type: 'div',
  props: {
    style: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      width: 330,
      flexShrink: 0,
      gap: 20,
    },
    children: [
      {
        type: 'div',
        props: {
          style: { display: 'flex', alignItems: 'center', height: AVATAR_ROW_HEIGHT },
          children: team.players.map((name, index) => isLogo && images[index]
            ? logo(images[index]!, isLoser)
            : avatar(name, images[index], index, isLoser)),
        },
      },
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            fontSize: 38,
            fontWeight: 700,
            color: isLoser ? 'rgba(255,255,255,0.65)' : 'white',
            textAlign: 'center' as const,
            lineHeight: 1.15,
          },
          children: team.name,
        },
      },
    ],
  },
});

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const isLeague = searchParams.get('logos') === '1';
  const fetchImage = (name: string) => isLeague ? fetchLeagueLogo(origin, name) : fetchPlayerImage(name);
  const team1 = readTeam(searchParams, '1');
  const team2 = readTeam(searchParams, '2');
  const label = (searchParams.get('label') || '').toUpperCase();

  if (!team1.players.length || !team2.players.length) {
    return new Response('Missing teams', { status: 400 });
  }

  const isDraw = team1.score === team2.score;
  const [winner, loser] = team1.score >= team2.score ? [team1, team2] : [team2, team1];

  const [winnerImages, loserImages, font] = await Promise.all([
    Promise.all(winner.players.map(fetchImage)),
    Promise.all(loser.players.map(fetchImage)),
    loadFont(),
  ]);

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: `${CONTENT_TOP}px 16px 0`,
          fontFamily: 'Roboto',
          backgroundImage: BACKGROUND,
        },
        children: [
          teamColumn(winner, winnerImages, false, isLeague),
          {
            type: 'div',
            props: {
              // Ergebnis mittig zu den Avataren
              style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6, marginTop: (AVATAR_ROW_HEIGHT - SCORE_SIZE) / 2 },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', fontSize: SCORE_SIZE, fontWeight: 700, color: 'white', lineHeight: 1 },
                    children: `${winner.score} : ${loser.score}`,
                  },
                },
                label && {
                  type: 'div',
                  props: {
                    style: { display: 'flex', fontSize: 28, fontWeight: 700, color: '#FFE7EA', letterSpacing: 3 },
                    children: label,
                  },
                },
              ].filter(Boolean),
            },
          },
          teamColumn(loser, loserImages, !isDraw, isLeague),
        ],
      },
    },
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: font ? [{ name: 'Roboto', data: font, weight: 700, style: 'normal' }] : undefined,
      headers: {
        // Gleiche URL = gleiches Ergebnis, Spielerbilder und Logos koennen sich aber aendern
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
