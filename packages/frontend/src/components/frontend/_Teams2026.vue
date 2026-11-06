<template>
    <div class="Page">
        <h1 class="bp-title">Angemeldete Teams 2026</h1>
        <p style="color: var(--bp-text-subtle); font-size: 15px; margin-bottom: 32px; text-align: center;">Weck BiPo Open · 11. Juli 2026</p>

        <div style="width: 100%; max-width: 900px;">
            <RegistrationsList />
        </div>

        <router-link
            to="/2026/Anmeldung"
            style="margin-top: 40px; display: inline-block; background: var(--main-color); color: white; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px; text-decoration: none;"
        >
            Jetzt anmelden
        </router-link>
    </div>
</template>

<script setup lang="ts">
import RegistrationsList from '@/components/shared/RegistrationsList.vue';
</script>

<style scoped>
.Page {
    width: 90%;
    margin-top: 150px;
    min-height: calc(100vh - 300px);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 80px;
}

@media (width <= 900px) {
    .Page {
        width: 95%;
        margin-top: 80px;
    }
}
</style>
