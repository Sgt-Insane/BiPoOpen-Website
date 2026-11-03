<template>
    <!-- Aktuelles Elo neben einem Namen, ohne gewertetes Spiel nichts -->
    <span v-if="rating !== null" class="EloChip" :title="`Elo ${formatRating(rating)}`">
        {{ formatRating(rating) }}<span class="ec-unit">Elo</span>
    </span>
</template>

<script setup lang="ts">
defineProps<{ rating: number | null }>();

const formatRating = (rating: number) => rating.toLocaleString('de-DE');
</script>

<style scoped>
.EloChip{
    display: inline-flex;
    flex-shrink: 0;
    align-items: baseline;
    gap: 3px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #EAF0F8;
    color: #1e3a6b;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.4;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}
.ec-unit{
    font-size: 10px;
    font-weight: 600;
    opacity: .7;
}
</style>
