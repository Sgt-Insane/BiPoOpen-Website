<template>
    <div class="ProfilePage">
        <PageHeader title="Mein Profil" subtitle="Dein Standard-Profil für Spiele auf diesem Handy"/>

        <ProfilePicker />

        <template v-if="profileName">
            <!-- Laufendes Mehrspieler-Spiel -->
            <router-link v-if="storedCode" :to="`/Mitspielen/${storedCode}`" class="pf-running">
                <span class="pf-running-icon">🎯</span>
                <span class="pf-running-text">
                    <span class="pf-running-title">Laufendes Spiel</span>
                    <span class="pf-running-subtitle">Code {{ storedCode }}</span>
                </span>
                <span class="pf-running-action">Fortsetzen</span>
            </router-link>

            <!-- Spiel starten -->
            <router-link to="/Mitspielen" class="pf-start">
                <span class="pf-start-phones" aria-hidden="true">
                    <span class="pf-phone pf-phone--left"></span>
                    <span class="pf-phone pf-phone--right"></span>
                </span>
                <span class="pf-start-title">Spiel starten</span>
                <span class="pf-start-text">Handys aneinanderstoßen – jeder trägt seine eigenen Würfe im BiPo Knecht ein. Auch 2 gegen 2 mit vier Handys.</span>
            </router-link>

            <router-link :to="getPlayerProfilePath(profileName)" class="pf-link">
                <i class="pi pi-user"></i> Meine Statistiken ansehen
                <i class="pi pi-chevron-right pf-link-arrow"></i>
            </router-link>
        </template>
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useGrayPage } from '@/components/shared/useGrayPage';
import PageHeader from '@/components/shared/PageHeader.vue';
import { getPlayerProfilePath } from '@/util/util';
import ProfilePicker from './ProfilePicker.vue';
import { useProfile } from './useProfile';
import { useMultiplayerSession } from './useMultiplayerSession';

useGrayPage();

const { profileName } = useProfile();
const { storedCode, resume } = useMultiplayerSession();

// Gespeichertes Spiel pruefen: vorbei oder nicht mehr dabei -> Hinweis verschwindet
onMounted(() => { if (storedCode.value) resume(); });
</script>

<style scoped>
.ProfilePage{
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 560px;
    margin: 0 auto;
    padding-top: 8px;
    color: var(--bp-text-strong);
}

.pf-running{
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 16px;
    background: var(--bp-primary-weak);
    color: var(--bp-text-strong);
    text-decoration: none;
}
.pf-running-icon{ font-size: 22px; }
.pf-running-text{
    display: flex;
    flex-direction: column;
    flex: 1;
}
.pf-running-title{ font-weight: 800; }
.pf-running-subtitle{ font-size: 12px; color: var(--bp-text-secondary); }
.pf-running-action{
    font-weight: 800;
    color: var(--main-color);
}

.pf-start{
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 22px 20px 20px;
    border-radius: 22px;
    background: linear-gradient(135deg, #EA5160 0%, #b8344a 100%);
    color: white;
    text-decoration: none;
    overflow: hidden;
    box-shadow: 0 12px 28px rgba(234, 81, 96, .3);
    transition: transform .15s ease;
}
.pf-start:active{ transform: scale(.98); }
.pf-start-title{
    font-size: 22px;
    font-weight: 900;
}
.pf-start-text{
    max-width: 75%;
    font-size: 14px;
    opacity: .92;
}
.pf-start-phones{
    position: absolute;
    right: 16px;
    top: 50%;
    width: 64px;
    height: 56px;
    transform: translateY(-50%);
}
.pf-phone{
    position: absolute;
    top: 0;
    width: 28px;
    height: 52px;
    border: 3px solid white;
    border-radius: 7px;
    background: rgba(255, 255, 255, .15);
}
.pf-phone--left{ left: 0; animation: pf-bump-left 1.8s ease-in-out infinite; }
.pf-phone--right{ right: 0; animation: pf-bump-right 1.8s ease-in-out infinite; }
@keyframes pf-bump-left{
    0%, 100%{ transform: translateX(-6px) rotate(-8deg); }
    45%, 55%{ transform: translateX(4px) rotate(0); }
}
@keyframes pf-bump-right{
    0%, 100%{ transform: translateX(6px) rotate(8deg); }
    45%, 55%{ transform: translateX(-4px) rotate(0); }
}

.pf-link{
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-radius: 16px;
    background: var(--bp-surface);
    border: 1px solid var(--bp-border);
    color: var(--bp-text-strong);
    font-weight: 700;
    text-decoration: none;
}
.pf-link-arrow{
    margin-left: auto;
    color: var(--bp-text-muted);
}
</style>
