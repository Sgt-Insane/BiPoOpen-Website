<template>
    <div class="Neuigkeiten">
        <div class="nw-content">
            <PageHeader title="Neuigkeiten" subtitle="Was sich auf der Seite und im BiPo Knecht geändert hat." @titleClick="onTitleTap()">
                <template v-if="devState.enabled" #actions>
                    <router-link to="/Entwickler" class="nw-dev">DEV</router-link>
                </template>
            </PageHeader>

            <section v-for="release in releases" :key="release.version" class="nw-release">
                <div class="nw-release-head">
                    <span class="nw-version">v{{ release.version }}</span>
                    <span v-if="release.draft" class="nw-draft">Entwurf</span>
                    <h2 class="nw-release-title">{{ release.title }}</h2>
                    <span class="nw-date">{{ formatDate(release.date) }}</span>
                </div>
                <ul class="nw-notes">
                    <li v-for="(note, index) in release.notes" :key="index">{{ note }}</li>
                </ul>

                <!-- Kleinigkeiten: eingeklappt, damit das Wichtige auf einen Blick lesbar bleibt -->
                <template v-if="release.details?.length">
                    <button
                        type="button"
                        class="nw-details-toggle"
                        :aria-expanded="openDetails.has(release.version)"
                        @click="toggleDetails(release.version)"
                    >
                        <i class="pi" :class="openDetails.has(release.version) ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                        {{ openDetails.has(release.version) ? 'Kleinigkeiten ausblenden' : `${release.details.length} Kleinigkeiten anzeigen` }}
                    </button>
                    <ul v-if="openDetails.has(release.version)" class="nw-notes nw-notes--details">
                        <li v-for="(detail, index) in release.details" :key="index">{{ detail }}</li>
                    </ul>
                </template>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { computed, reactive } from 'vue';
import { devState, draftReleases, publishedReleases, setDevMode } from '@/util/featureFlags';
import PageHeader from '@/components/shared/PageHeader.vue';

// Neueste Version zuerst (src/releases.json; nach dem Deploy verschickt die GitHub Action dazu einen Push).
// Entwuerfe ("draft": true) nur im Entwicklermodus.
const releases = computed(() => [...publishedReleases, ...(devState.enabled ? draftReleases : [])].reverse());
const router = useRouter();

// Versionen, deren Kleinigkeiten aufgeklappt sind
const openDetails = reactive(new Set<string>());
const toggleDetails = (version: string) => {
    if (openDetails.has(version)) openDetails.delete(version);
    else openDetails.add(version);
};

// Versteckter Zugang zum Entwicklermodus: 7× schnell auf die Ueberschrift tippen
let taps: number[] = [];
const onTitleTap = () => {
    const now = Date.now();
    taps = [...taps.filter(time => now - time < 3000), now];
    if (taps.length < 7) return;
    taps = [];
    setDevMode(true);
    router.push('/Entwickler');
};

const formatDate = (date: string) => new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

</script>

<style scoped>
.Neuigkeiten{
    margin-inline: calc(50% - 50vw);
    padding: 8px calc(50vw - 50%) 32px;
    background: var(--page-gray);
}
.nw-content{
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 640px;
    margin: 0 auto;
}

.nw-content > .PageHeader{
    margin-bottom: 0;
}
.nw-dev{
    padding: 3px 9px;
    border-radius: 999px;
    background: #F5A524;
    color: #0C1E47;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .06em;
    text-decoration: none;
}
.nw-draft{
    padding: 2px 8px;
    border-radius: 999px;
    background: #FFF4DB;
    color: #9A6400;
    font-size: 11px;
    font-weight: 700;
}



.nw-release{
    padding: 14px 16px;
    border-radius: 16px;
    background: var(--bp-surface);
    box-shadow: 0 1px 2px rgba(16, 24, 40, .06);
}
.nw-release-head{
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px;
}
.nw-version{
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--bp-primary-weak);
    color: var(--main-color);
    font-size: 12px;
    font-weight: 800;
}
.nw-release-title{
    flex: 1;
    margin: 0;
    font-size: 17px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.nw-date{
    font-size: 12px;
    color: var(--bp-text-muted);
}
.nw-notes{
    margin: 10px 0 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    color: var(--bp-text);
}
.nw-details-toggle{
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    padding: 6px 12px 6px 10px;
    border: none;
    border-radius: 999px;
    background: var(--bp-fill-soft);
    color: var(--bp-text-secondary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
.nw-details-toggle .pi{
    font-size: 11px;
}
.nw-details-toggle:hover{
    background: var(--bp-fill);
}
.nw-notes--details{
    margin-top: 10px;
    font-size: 13px;
    color: var(--bp-text-secondary);
}
</style>
