<template>
    <div class="elo-entry" :class="{ 'elo-entry-top': entry.rank !== null && entry.rank <= 3 }">
        <button type="button" class="elo-row" :aria-expanded="expanded" @click="emit('toggle')">
            <div class="elo-col-rank">
                <div class="elo-rank">{{ entry.rank ?? '–' }}</div>
                <div v-if="entry.rank !== null" class="elo-trend" :class="getTrendClass(entry.trend)">{{ getTrendLabel(entry.trend) }}</div>
            </div>

            <div class="elo-avatars" :class="{ 'elo-avatars-team': entry.members.length > 1 }">
                <Avatar v-for="member in entry.members" :key="member" :name="member" class="elo-avatar"/>
            </div>

            <div class="elo-main">
                <div class="elo-name" :class="{ 'elo-name-team': mode === 'teams' }">{{ entry.name }}</div>
                <div class="elo-meta">{{ entry.games }} Spiele · zuletzt {{ formatDate(entry.lastTime) }}</div>
            </div>

            <div class="elo-col-rating">
                <div class="elo-rating">{{ formatRating(entry.rating) }}</div>
                <div class="elo-delta" :class="getDeltaClass(entry.ratingChange)">{{ formatDelta(entry.ratingChange) }}</div>
            </div>
        </button>

        <div v-if="expanded" class="elo-details">
            <div class="elo-stats">
                <div class="elo-stat">
                    <div class="elo-stat-label">Höchstwert</div>
                    <div class="elo-stat-value">{{ formatRating(entry.peak) }}</div>
                </div>
                <div class="elo-stat">
                    <div class="elo-stat-label">Siegquote</div>
                    <div class="elo-stat-value">{{ Math.round(entry.wins / entry.games * 100) }} %</div>
                </div>
                <div v-if="mode === 'players'" class="elo-stat">
                    <div class="elo-stat-label">Häufigster Partner</div>
                    <div class="elo-stat-value elo-stat-text">{{ entry.favoritePartner ?? '–' }}</div>
                </div>
                <div v-else class="elo-stat">
                    <div class="elo-stat-label">Siege</div>
                    <div class="elo-stat-value">{{ entry.wins }} / {{ entry.games }}</div>
                </div>
            </div>

            <div v-for="(game, index) in entry.recent" :key="index" class="elo-game">
                <span class="elo-result" :class="game.won ? 'elo-result-win' : 'elo-result-loss'">{{ game.won ? 'S' : 'N' }}</span>
                <div class="elo-game-main">
                    <div class="elo-game-opponent">gegen {{ game.opponent }}</div>
                    <div class="elo-game-context">{{ game.context }}</div>
                </div>
                <span class="elo-game-delta" :class="getDeltaClass(game.delta)">{{ formatDelta(game.delta) }}</span>
            </div>

            <div v-if="mode === 'players'" class="elo-details-footer">
                <button type="button" class="elo-profile-link" @click="openPlayerProfile(entry.name)">
                    Zum Spielerprofil <i class="pi pi-angle-right"></i>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { inject } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import { EloEntry, EloMode } from './eloRating';

const props = defineProps<{ entry: EloEntry; mode: EloMode; now: number; expanded: boolean }>();
const emit = defineEmits<{ toggle: [] }>();

const openPlayerProfile = inject<(name: string) => void>('openPlayerProfile')!;

const formatRating = (rating: number) => rating.toLocaleString('de-DE');

const formatDelta = (delta: number) => {
    if (delta > 0) return `+${delta}`;
    if (delta < 0) return `−${-delta}`;
    return '±0';
};

const getDeltaClass = (delta: number) => {
    if (delta > 0) return 'elo-up';
    if (delta < 0) return 'elo-down';
    return 'elo-same';
};

// Jahr nur, wenn es nicht das aktuelle ist
const formatDate = (time: number) => {
    const date = new Date(time);
    const sameYear = date.getFullYear() === new Date(props.now).getFullYear();
    return date.toLocaleDateString('de-DE', sameYear ? { day: '2-digit', month: '2-digit' } : { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const getTrendLabel = (trend: number | null) => {
    if (trend === null) return 'neu';
    if (trend > 0) return `▲${trend}`;
    if (trend < 0) return `▼${-trend}`;
    return '–';
};

const getTrendClass = (trend: number | null) => {
    if (trend === null) return 'elo-trend-new';
    if (trend > 0) return 'elo-up';
    if (trend < 0) return 'elo-down';
    return 'elo-same';
};
</script>

<style scoped>
.elo-entry {
    border-bottom: 1px solid var(--bp-border);
}
.elo-entry:last-child {
    border-bottom: none;
}
.elo-entry-top {
    background: var(--bp-gold-faint);
}

.elo-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    border: none;
    background: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
.elo-col-rank {
    flex-shrink: 0;
    width: 28px;
    text-align: center;
}
.elo-rank {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.1;
}
.elo-trend {
    font-size: 11px;
    font-weight: 700;
    line-height: 1.3;
}
.elo-up { color: var(--bp-success); }
.elo-down { color: var(--bp-danger); }
.elo-same { color: var(--bp-text-faint); }
.elo-trend-new { color: var(--secondary-color); font-weight: 600; }

.elo-avatars {
    flex-shrink: 0;
    display: flex;
    width: 40px;
}
.elo-avatar {
    flex-shrink: 0;
    width: 40px !important;
    height: 40px !important;
    font-size: 14px;
    font-weight: 700;
}
/* Teams: zwei kleinere, ueberlappende Avatare */
.elo-avatars-team .elo-avatar {
    width: 28px !important;
    height: 28px !important;
    font-size: 11px;
    box-shadow: 0 0 0 2px var(--bp-surface);
}
.elo-avatars-team .elo-avatar + .elo-avatar {
    margin-left: -16px;
    margin-top: 12px;
}

.elo-main {
    flex: 1;
    min-width: 0;
}
.elo-name {
    overflow: hidden;
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    text-overflow: ellipsis;
}
/* Teams: zwei Namen, kleiner und notfalls zweizeilig statt abgeschnitten */
.elo-name-team {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    font-size: 13px;
    line-height: 1.25;
    white-space: normal;
}
.elo-meta {
    margin-top: 2px;
    font-size: 12px;
    color: var(--bp-text-muted);
}

.elo-col-rating {
    flex-shrink: 0;
    text-align: right;
}
.elo-rating {
    font-size: 18px;
    font-weight: 800;
    line-height: 1.15;
}
.elo-delta {
    font-size: 12px;
    font-weight: 700;
}

/* ── Aufgeklappte Zeile ── */
.elo-details {
    margin: 0 14px 14px;
    padding: 12px 14px;
    background: var(--bp-fill-soft);
    border-radius: 12px;
}
.elo-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--bp-border);
}
.elo-stat-label {
    font-size: 11px;
    color: var(--bp-text-muted);
}
.elo-stat-value {
    font-size: 15px;
    font-weight: 700;
}
.elo-stat-text {
    overflow: hidden;
    font-size: 13px;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.elo-game {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--bp-border);
}
.elo-game:last-of-type {
    border-bottom: none;
}
.elo-result {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    color: white;
    font-size: 11px;
    font-weight: 700;
}
.elo-result-win { background: #1f9d55; }
.elo-result-loss { background: #d64545; }
.elo-game-main {
    flex: 1;
    min-width: 0;
}
.elo-game-opponent {
    font-size: 13px;
    font-weight: 600;
}
.elo-game-context {
    font-size: 11px;
    color: var(--bp-text-muted);
}
.elo-game-delta {
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 700;
}

.elo-details-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--bp-border);
}
.elo-profile-link {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0;
    border: none;
    background: none;
    color: var(--main-color);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
</style>
