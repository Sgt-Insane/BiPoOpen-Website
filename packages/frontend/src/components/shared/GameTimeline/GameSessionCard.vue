<template>
    <div class="gs" :class="{ 'gs--open': expanded }">

        <!-- Kopf: Titel, Kennzahlen und Schlagzeilen, klappt den Block auf -->
        <button type="button" class="gs-head" :aria-expanded="expanded" @click="emit('update:expanded', !expanded)">
            <div class="gs-head-text">
                <div class="gs-title">{{ title }}</div>
                <div class="gs-meta">{{ meta }}</div>
                <ul v-if="highlights.length" class="gs-highlights">
                    <li v-for="highlight in highlights" :key="highlight.kind" class="gs-highlight">
                        <!-- Fester Bildplatz fuer 2 Bilder, damit der Text in allen Zeilen gleich weit eingerueckt ist.
                             Mehr als 2 Personen: erstes Bild und "+N", die Namen stehen im Text. -->
                        <span class="gs-highlight-avatars">
                            <Avatar v-for="name in getAvatarNames(highlight)" :key="name"
                                :name="getDisplayName(name)"
                                :avatarImage="getLogo?.(name)"
                                class="gs-avatar gs-avatar--small"
                            />
                            <span v-if="highlight.names.length > MAX_HIGHLIGHT_AVATARS" class="gs-avatar-more">+{{ highlight.names.length - 1 }}</span>
                        </span>
                        <span class="gs-highlight-text">{{ highlight.text }}</span>
                    </li>
                </ul>
            </div>
            <i class="pi gs-chevron" :class="expanded ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
        </button>

        <div v-if="expanded" class="gs-body">
            <div class="gs-tabs" role="tablist">
                <button v-for="tab in tabs" :key="tab.value"
                    type="button"
                    role="tab"
                    class="gs-tab"
                    :class="{ 'gs-tab--active': activeTab === tab.value }"
                    :aria-selected="activeTab === tab.value"
                    @click="activeTab = tab.value"
                >{{ tab.label }}</button>
            </div>

            <!-- Ueberblick: Bilanz jedes Teilnehmers an diesem Abend -->
            <ul v-if="activeTab === 'overview'" class="gs-list">
                <li v-for="record in session.records" :key="record.name" class="gs-row">
                    <Avatar :name="getDisplayName(record.name)" :avatarImage="getLogo?.(record.name)" class="gs-avatar"/>
                    <span class="gs-name-cell">
                        <span class="gs-name" v-fit-text>{{ getDisplayName(record.name) }}</span>
                        <!-- Teilbilanz unter anderem Namen, z.B. "Liga · Hopfenstreife 2–1" -->
                        <span v-for="alias in record.aliases" :key="`${alias.label}-${alias.name}`" class="gs-alias">
                            <Avatar :name="getDisplayName(alias.name)" :avatarImage="getLogo?.(alias.name)" class="gs-avatar gs-avatar--tiny"/>
                            <span class="gs-alias-text">{{ alias.label }} · {{ getDisplayName(alias.name) }} {{ alias.wins }}–{{ alias.losses }}</span>
                        </span>
                    </span>
                    <span class="gs-form" :class="{ 'gs-form--dense': record.results.length > DENSE_FORM_FROM }">
                        <span v-for="(result, index) in record.results" :key="index"
                            class="gs-form-item"
                            :class="result === 'W' ? 'gs-form-win' : 'gs-form-loss'"
                            v-hint.tap="result === 'W' ? 'Sieg' : 'Niederlage'"
                        ></span>
                    </span>
                    <span class="gs-record">{{ record.wins }}–{{ record.losses }}</span>
                </li>
            </ul>

            <!-- Spiele: alle Spiele des Abends in Reihenfolge -->
            <div v-else-if="activeTab === 'games'" class="gs-games">
                <MatchElement v-for="match in session.games" :key="match._id"
                    :match="match"
                    :gameType="getGameType?.(match)"
                    :showChip="showChip"
                    timestamp="clock"
                    compact
                />
            </div>

            <!-- Weitere Reiter der Seite, z.B. Tabelle beim Liga-Spieltag -->
            <slot v-else name="tab" :tab="activeTab"/>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import MatchElement from '@/components/shared/MatchElement/MatchElement.vue';
import type { GameSession, SessionHighlight } from './gameTimeline';

type GameType = 'open' | 'league' | 'cup' | 'tournament';

const props = withDefaults(defineProps<{
    session: GameSession;
    expanded: boolean;
    title: string;
    meta: string;
    highlights: SessionHighlight[];
    // Liga-Teams: Logo und Schreibweise aus den Saisondaten. Ohne Logo zeigt Avatar das Spielerbild.
    getLogo?: (name: string) => string | undefined;
    getDisplayName?: (name: string) => string;
    getGameType?: (match: Match) => GameType | undefined;
    showChip?: boolean;
    extraTabs?: { value: string; label: string }[];
}>(), {
    getLogo: undefined,
    getDisplayName: (name: string) => name,
    getGameType: undefined,
    showChip: false,
    extraTabs: () => [],
});

const emit = defineEmits<{ 'update:expanded': [value: boolean] }>();

defineSlots<{ tab(props: { tab: string }): any }>();

const activeTab = ref('overview');

// Highlight-Bilder: bis zu 2, sonst das erste und "+N"
const MAX_HIGHLIGHT_AVATARS = 2;
const getAvatarNames = (highlight: SessionHighlight) =>
    highlight.names.length > MAX_HIGHLIGHT_AVATARS ? highlight.names.slice(0, 1) : highlight.names;

// Ab so vielen Spielen werden die Kaestchen kleiner (Reihen zu 7), damit der Name lesbar bleibt
const DENSE_FORM_FROM = 5;

const tabs = computed(() => [
    { value: 'overview', label: 'Überblick' },
    { value: 'games', label: 'Spiele' },
    ...props.extraTabs,
]);
</script>

<style scoped>
.gs{
    background: var(--bp-surface);
    border: 1px solid var(--bp-border);
    border-radius: 14px;
    overflow: hidden;
    transition: border-color 0.15s;
}
.gs--open{
    border-color: color-mix(in srgb, var(--main-color) 45%, var(--bp-border));
}

/* ─── Kopf ─── */
.gs-head{
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    padding: 12px 12px 12px 14px;
    background: none;
    border: 0;
    text-align: left;
    color: inherit;
    font: inherit;
    cursor: pointer;
}
.gs-head-text{
    flex: 1;
    min-width: 0;
}
.gs-title{
    font-size: 1rem;
    font-weight: 700;
    color: var(--bp-text-strong);
    line-height: 1.25;
}
.gs-meta{
    margin-top: 2px;
    font-size: 0.75rem;
    color: var(--bp-text-muted);
}
.gs-highlights{
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
}
/* Bildspalte fest breit (2 ueberlappende Bilder), Text beginnt immer an derselben Stelle */
.gs-highlight{
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    align-items: start;
    column-gap: 6px;
    font-size: 0.8125rem;
    color: var(--bp-text);
}
/* Bilder auf Hoehe der ersten Textzeile, mittig im festen Bildplatz (ein einzelnes Bild klebt sonst links) */
.gs-highlight-avatars{
    display: flex;
    justify-content: center;
}
.gs-highlight-avatars > * + *{
    margin-left: -6px;
}
.gs-avatar-more{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--bp-fill-strong);
    box-shadow: 0 0 0 1.5px var(--bp-surface);
    color: var(--bp-text);
    font-size: 0.5625rem;
    font-weight: 700;
}
.gs-highlight-text{
    min-width: 0;
    /* gleiche Hoehe wie die Bilder: erste Zeile steht mittig neben dem Bild */
    line-height: 20px;
}
.gs-chevron{
    flex-shrink: 0;
    margin-top: 4px;
    font-size: 0.75rem;
    color: var(--bp-text-faint);
}

/* Avatar-Groessen fest, die Seite (z.B. Liga) vergroessert Avatare sonst global */
.gs-avatar{
    flex-shrink: 0;
    width: 24px !important;
    height: 24px !important;
    min-width: 24px !important;
    font-size: 0.5625rem !important;
}
.gs-avatar--small{
    width: 20px !important;
    height: 20px !important;
    min-width: 20px !important;
    font-size: 0.5rem !important;
}

/* ─── Reiter ─── */
.gs-body{
    padding: 0 12px 14px;
}
.gs-tabs{
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 6px;
    margin-bottom: 12px;
}
.gs-tab{
    padding: 7px 4px;
    border: 0;
    border-radius: 8px;
    background: var(--bp-fill-soft);
    color: var(--bp-text);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
}
.gs-tab--active{
    background: var(--bp-inverse-bg);
    color: var(--bp-inverse-text);
}

/* ─── Ueberblick ─── */
.gs-list{
    list-style: none;
    margin: 0;
    padding: 0;
}
.gs-row{
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    font-size: 0.8125rem;
}
.gs-row + .gs-row{
    border-top: 1px solid var(--bp-border);
}
.gs-name-cell{
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}
.gs-name{
    overflow: hidden;
    white-space: nowrap;
    font-weight: 600;
    color: var(--bp-text-strong);
}
.gs-alias{
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    font-size: 0.6875rem;
    color: var(--bp-text-muted);
}
/* Lange Teamnamen brechen um statt abgeschnitten zu werden */
.gs-alias-text{
    min-width: 0;
    line-height: 1.25;
    overflow-wrap: anywhere;
}
.gs-avatar--tiny{
    width: 14px !important;
    height: 14px !important;
    min-width: 14px !important;
    font-size: 0.4375rem !important;
}
.gs-form{
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 3px;
    /* hoechstens 7 Kaestchen je Reihe: 7 * 14px + 6 * 3px */
    max-width: 116px;
}
.gs-form-item{
    width: 14px;
    height: 14px;
    border-radius: 3px;
}
/* Viele Spiele: kleinere Kaestchen, 7 je Reihe (7 * 9px + 6 * 2px) */
.gs-form--dense{
    gap: 2px;
    max-width: 75px;
}
.gs-form--dense .gs-form-item{
    width: 9px;
    height: 9px;
    border-radius: 2px;
}
.gs-form-win{ background: #1F9D55; }
.gs-form-loss{ background: #D64545; }
.gs-record{
    flex-shrink: 0;
    min-width: 28px;
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--bp-text-strong);
}

/* ─── Spiele ─── (Abstand kommt vom margin-bottom des MatchElements) */
.gs-games{
    display: flex;
    flex-direction: column;
}
.gs-games > :last-child{
    margin-bottom: 0;
}
</style>
