<template>
    <div class="Neuigkeiten">
        <div class="nw-content">
            <!-- Kopf im Stil der Nackte-Meilen-Seite -->
            <div class="nw-hero">
                <div class="nw-hero-head">
                    <button type="button" class="nw-back" aria-label="Zurück" @click="goBack()">
                        <i class="pi pi-chevron-left"></i>
                    </button>
                    <h1 class="nw-hero-title">Neuigkeiten</h1>
                </div>
                <div class="nw-hero-hint">
                    Was sich auf der Seite und im BiPo Knecht geändert hat.
                    <router-link to="/Benachrichtigungen" class="nw-hero-link">Push für Updates <i class="pi pi-angle-right"></i></router-link>
                </div>
            </div>

            <section v-for="release in releases" :key="release.version" class="nw-release">
                <div class="nw-release-head">
                    <span class="nw-version">v{{ release.version }}</span>
                    <h2 class="nw-release-title">{{ release.title }}</h2>
                    <span class="nw-date">{{ formatDate(release.date) }}</span>
                </div>
                <ul class="nw-notes">
                    <li v-for="(note, index) in release.notes" :key="index">{{ note }}</li>
                </ul>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import RELEASES from '@/releases.json';

// Neueste Version zuerst (src/releases.json; nach dem Deploy verschickt die GitHub Action dazu einen Push)
const releases = [...RELEASES].reverse();
const router = useRouter();

const formatDate = (date: string) => new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

const goBack = () => {
    if (window.history.state?.back) router.back();
    else router.push('/');
};
</script>

<style scoped>
.Neuigkeiten{
    margin-inline: calc(50% - 50vw);
    padding: 12px calc(50vw - 50%) 32px;
    background: var(--page-gray);
}
.nw-content{
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 640px;
    margin: 0 auto;
}
.nw-hero{
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px 12px 18px;
    border-radius: 20px;
    background: var(--bp-navy, #0C1E47);
    color: white;
}
.nw-hero-head{
    display: flex;
    align-items: center;
    gap: 4px;
    height: 44px;
}
.nw-back{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: white;
    cursor: pointer;
}
.nw-hero-title{
    margin: 0;
    font-size: 22px;
    font-weight: 800;
}
.nw-hero-hint{
    padding: 0 4px;
    font-size: 13px;
    color: #C9D2E6;
}
.nw-hero-link{
    color: white;
    font-weight: 600;
    text-decoration: none;
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
</style>
