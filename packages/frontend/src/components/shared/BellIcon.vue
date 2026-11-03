<template>
    <!-- PrimeIcons hat keine gefuellte Glocke: Kontur = Push aus, gefuellt = Push aktiv -->
    <svg class="BellIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path
            d="M6 9.5a6 6 0 0 1 12 0c0 3.6 1 5.6 1.9 6.7.4.5 0 1.3-.6 1.3H4.7c-.6 0-1-.8-.6-1.3C5 15.1 6 13.1 6 9.5Z"
            :fill="filled ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linejoin="round"
        />
        <path d="M10 20.5a2.2 2.2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    </svg>
</template>

<script setup lang="ts">
defineProps<{ filled?: boolean }>();
</script>

<style scoped>
.BellIcon {
    width: 1em;
    height: 1em;
    flex-shrink: 0;
}
</style>
