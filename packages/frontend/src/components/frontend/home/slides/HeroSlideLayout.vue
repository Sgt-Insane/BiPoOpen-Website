<template>
    <div class="HeroSlideLayout">
        <div class="hs-head">
            <div class="hs-kicker">{{ kicker }}</div>
            <h2 class="hs-title">{{ title }}</h2>
            <p v-if="subtitle" class="hs-subtitle">{{ subtitle }}</p>
        </div>

        <div v-if="$slots.default" class="hs-body">
            <slot/>
        </div>

        <router-link v-if="ctaTo" :to="ctaTo" class="hs-cta">
            {{ ctaLabel }}
            <i class="pi pi-angle-right"></i>
        </router-link>
    </div>
</template>

<script setup lang="ts">
// Gemeinsamer Aufbau aller Slides im Home-Slider: Kicker, Titel, Inhalt, Button.
defineProps<{
    kicker: string;
    title: string;
    subtitle?: string;
    ctaLabel?: string;
    ctaTo?: string;
}>();
</script>

<style scoped>
.HeroSlideLayout{
    /* Halbtransparente Flaechen in den Slides (Tabelle, Kacheln, Chips) */
    --hs-glass: rgba(20, 22, 26, 0.45);
    --hs-glass-border: rgba(255, 255, 255, 0.14);

    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    color: white;
}
.hs-head{
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.hs-kicker{
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #ffc2c8;
}
.hs-title{
    margin: 0;
    font-size: 32px;
    font-weight: 800;
    line-height: 1.1;
    color: white;
    text-shadow: 0 2px 14px rgba(0, 0, 0, 0.25);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.hs-subtitle{
    margin: 2px 0 0;
    font-size: 15px;
    color: rgba(255, 255, 255, 0.85);
}
.hs-body{
    width: 100%;
}
.hs-cta{
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 9px 14px 9px 16px;
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    border-radius: 999px;
    font-size: 14px;
    font-weight: 800;
    text-decoration: none;
    transition: opacity 0.2s;
}
.hs-cta:hover{
    color: var(--bp-text-strong);
    opacity: 0.9;
}
.hs-cta .pi{
    font-size: 13px;
}

/* MOBILE */
@media (width <= 900px){
    .HeroSlideLayout{
        gap: 12px;
    }
    .hs-title{
        font-size: 26px;
    }
    .hs-subtitle{
        font-size: 14px;
    }
}
</style>
