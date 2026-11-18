<template>
    <div class="ProfilePage">
        <PageHeader title="Mein Profil" subtitle="Dein Standard-Profil für Spiele auf diesem Handy"/>

        <ProfilePicker />

        <template v-if="profileName">
            <router-link :to="getPlayerProfilePath(profileName)" class="pf-link">
                <i class="pi pi-user"></i> Meine Statistiken ansehen
                <i class="pi pi-chevron-right pf-link-arrow"></i>
            </router-link>
        </template>
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { isFeatureOn } from '@/util/featureFlags';
import { useGrayPage } from '@/components/shared/useGrayPage';
import PageHeader from '@/components/shared/PageHeader.vue';
import { getPlayerProfilePath } from '@/util/util';
import ProfilePicker from './ProfilePicker.vue';
import { useProfile } from './useProfile';

useGrayPage();

const { profileName } = useProfile();

const router = useRouter();

onMounted(() => {
    // Noch nicht freigegeben (Entwicklermodus, Version 2.1.0)
    if (!isFeatureOn('mitspielen')) return router.replace('/');
});
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
