<template>
    <div class="to-overview">

        <!-- Podium: Top 3 Teams -->
        <div v-if="podium.length" class="to-podium-section">
            <div class="to-podium">
                <div v-for="entry in podium" :key="entry.place" class="to-podium-entry">
                    <span class="material-icons to-podium-icon" :style="{ color: placeColors[entry.place - 1] }">{{ placeIcons[entry.place - 1] }}</span>
                    <div class="to-podium-info">
                        <span class="to-podium-place">{{ entry.place }}. Platz</span>
                        <span class="to-podium-team">{{ getTeamDisplayName(entry.team) }}</span>
                        <span class="to-podium-players">{{ entry.team.players.map(p => p.name).join(', ') }}</span>
                    </div>
                </div>
            </div>
            <router-link v-if="basePath" :to="basePath + '/Spielplan'" class="to-cta-btn">
                <span class="material-icons" style="font-size: 18px;">format_list_numbered</span>
                Zum Spielplan
            </router-link>
        </div>

        <!-- MVP Top 4 with fade -->
        <div v-if="mvpTop4.length" class="to-mvp-section">
            <h4 class="to-subsection-title">MVP</h4>
            <div class="to-mvp-fade-wrapper">
                <table class="to-mvp-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th class="text-left">Name</th>
                            <th>Ø</th>
                            <th>SP</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(player, index) in mvpTop4" :key="player.name" :class="{'to-mvp-top1': index === 0}">
                            <td>{{ player.placement! + 1 }}</td>
                            <td class="text-left">{{ player.name }}</td>
                            <td>{{ player.averageHits.toFixed(2) }}</td>
                            <td>{{ player.ammountOfMatches }}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="to-fade-overlay"></div>
            </div>
            <router-link v-if="basePath" :to="basePath + '/MVP'" class="to-cta-btn">
                <span class="material-icons" style="font-size: 18px;">leaderboard</span>
                Zur MVP Tabelle
            </router-link>
        </div>

        <!-- Photo Preview with fade -->
        <div v-if="previewPhotos.length" class="to-photos-section">
            <h4 class="to-subsection-title">Fotos</h4>
            <div class="to-photos-fade-wrapper">
                <div class="to-photos-grid">
                    <img v-for="(photo, index) in previewPhotos" :key="index" :src="photo.thumbnail" class="to-photo-thumb" loading="lazy" />
                </div>
                <div class="to-fade-overlay"></div>
            </div>
            <router-link v-if="basePath" :to="basePath + '/Fotos'" class="to-cta-btn to-cta-btn--secondary">
                <span class="material-icons" style="font-size: 18px;">photo_library</span>
                Alle Fotos ansehen
            </router-link>
        </div>

    </div>
</template>

<script setup lang="ts">
import { computed, PropType } from 'vue';
import { getMVPList } from '@/util/tournamentPlayerFunctions';
import { checkIfTeam1WonVsTeam2 } from '@/util/tournamentMatchFunctions';
import { getDriveThumbnail } from '@/components/frontend/home/homeUtil';

const props = defineProps({
    tournament: { type: Object as PropType<Tournament>, required: true },
    photoIds: { type: Array as PropType<{img_id: string, name: string}[]>, default: () => [] },
    basePath: { type: String, default: '' }
});

// ─── MVP ───
const mvpTop4 = computed(() => {
    if (!props.tournament.settings.trackPlayerShots) return [];
    return getMVPList(props.tournament).slice(0, 4);
});

// ─── Podium (top 3 teams) ───
const getTeamDisplayName = (team: Team) => {
    return team.name || team.players.map(p => p.name).join(' & ');
};

const podium = computed<{ place: number; team: Team }[]>(() => {
    const ko = props.tournament.koPhase;
    if (!ko.matches.length) return [];
    const finalRound = ko.matches[ko.matches.length - 1];
    if (!finalRound.length) return [];

    const result: { place: number; team: Team }[] = [];
    const finalMatch = finalRound[0];

    if (finalMatch?.team1 && finalMatch?.team2) {
        const t1Score = finalMatch.team1.players.reduce((s, p) => s + p.score, 0);
        const t2Score = finalMatch.team2.players.reduce((s, p) => s + p.score, 0);
        if (t1Score > 0 || t2Score > 0) {
            const team1Won = checkIfTeam1WonVsTeam2(finalMatch);
            result.push({ place: 1, team: team1Won ? finalMatch.team1 : finalMatch.team2 });
            result.push({ place: 2, team: team1Won ? finalMatch.team2 : finalMatch.team1 });
        }
    }

    // 3rd place match
    const thirdPlaceMatch = finalRound[1];
    if (thirdPlaceMatch?.team1 && thirdPlaceMatch?.team2) {
        const t1Score = thirdPlaceMatch.team1.players.reduce((s, p) => s + p.score, 0);
        const t2Score = thirdPlaceMatch.team2.players.reduce((s, p) => s + p.score, 0);
        if (t1Score > 0 || t2Score > 0) {
            const team1Won = checkIfTeam1WonVsTeam2(thirdPlaceMatch);
            result.push({ place: 3, team: team1Won ? thirdPlaceMatch.team1 : thirdPlaceMatch.team2 });
        }
    }

    return result;
});

const placeIcons = ['emoji_events', 'military_tech', 'workspace_premium'];
const placeColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

// ─── Photos ───
const previewPhotos = computed(() => {
    if (!props.photoIds.length) return [];
    const shuffled = [...props.photoIds].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6).map(p => ({
        thumbnail: getDriveThumbnail(p.img_id, 300)
    }));
});
</script>

<style scoped>
.to-overview {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

/* ─── Podium ─── */
.to-podium-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.to-podium {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.to-podium-entry {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: var(--bp-surface-soft);
    border: 1px solid var(--bp-border);
    border-radius: 8px;
}
.to-podium-entry:first-child {
    background: var(--bp-gold-card);
    border-color: var(--bp-gold-border);
}
.to-podium-icon {
    font-size: 28px;
    flex-shrink: 0;
}
.to-podium-info {
    display: flex;
    flex-direction: column;
}
.to-podium-place {
    font-size: 11px;
    color: var(--bp-text-subtle);
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.to-podium-team {
    font-size: 15px;
    font-weight: bold;
    color: var(--bp-text-strong);
}
.to-podium-players {
    font-size: 12px;
    color: var(--bp-text-subtle);
    margin-top: 2px;
}

/* ─── Shared ─── */
.to-subsection-title {
    color: var(--main-color);
    font-size: 16px;
    margin: 0 0 10px 0;
    font-weight: bold;
}

/* ─── CTA Button ─── */
.to-cta-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 20px;
    background: var(--main-color);
    color: white;
    border-radius: 8px;
    text-decoration: none;
    font-weight: bold;
    font-size: 14px;
    transition: background 0.2s;
}
.to-cta-btn:hover {
    background: #d4434f;
}
.to-cta-btn--secondary {
    background: var(--secondary-color);
}
.to-cta-btn--secondary:hover {
    background: #4fb0c6;
}

/* ─── Fade overlay ─── */
.to-mvp-fade-wrapper,
.to-photos-fade-wrapper {
    position: relative;
    overflow: hidden;
}
.to-fade-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 50px;
    background: linear-gradient(transparent, var(--bp-surface));
    pointer-events: none;
}

/* ─── MVP ─── */
.to-mvp-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.to-mvp-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}
.to-mvp-table th {
    padding: 6px 8px;
    font-size: 12px;
    color: var(--bp-text-subtle);
    border-bottom: 1px solid var(--bp-border);
    text-align: center;
}
.to-mvp-table th.text-left {
    text-align: left;
}
.to-mvp-table td {
    padding: 8px;
    text-align: center;
    border-bottom: 1px solid var(--bp-border);
}
.to-mvp-table td.text-left {
    text-align: left;
}
.to-mvp-top1 {
    background: rgba(97, 195, 217, 0.08);
}

/* ─── Photos ─── */
.to-photos-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.to-photos-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
}
.to-photo-thumb {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 6px;
}

/* ═══════ MOBILE ═══════ */
@media (width <= 900px) {
    .to-photos-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}
</style>
