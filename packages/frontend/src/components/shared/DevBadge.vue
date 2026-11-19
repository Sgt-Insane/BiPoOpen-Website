<template>
    <!-- Kleines "DEV": dieses Element sieht man nur im Entwicklermodus (Feature noch nicht veroeffentlicht) -->
    <span v-if="isDevOnly(feature)" v-hint.tap="'Nur im Entwicklermodus sichtbar (noch nicht veröffentlicht)'" class="DevBadge" :class="{ 'DevBadge--corner': corner }">DEV</span>
</template>

<script setup lang="ts">
import { isDevOnly, type FeatureKey } from '@/util/featureFlags';

// corner: oben rechts an einem runden Knopf (Elternelement braucht position: relative)
defineProps<{ feature: FeatureKey | FeatureKey[]; corner?: boolean }>();
</script>

<style scoped>
.DevBadge{
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    margin-left: 6px;
    padding: 1px 5px;
    border-radius: 999px;
    background: #F5A524;
    color: #0C1E47;
    font-size: 9px;
    font-weight: 800;
    line-height: 1.4;
    letter-spacing: .06em;
    vertical-align: middle;
    text-transform: uppercase;
    cursor: help;
}
.DevBadge--corner{
    position: absolute;
    top: -4px;
    left: -6px;
    margin: 0;
    pointer-events: none;
}
</style>
