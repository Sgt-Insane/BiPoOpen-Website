<template>
    <!-- Platzhalter-Liste im Stil der Ranglisten: Rang, Avatar, zwei Zeilen, Wert rechts -->
    <div class="SkeletonList" aria-busy="true">
        <div v-for="i in rows" :key="i" class="sl-row">
            <div v-if="rank" class="bp-skeleton sl-rank"></div>
            <div v-if="avatar !== 'none'" class="bp-skeleton sl-avatar" :class="{ 'sl-avatar-square': avatar === 'square' }"></div>
            <div class="sl-main">
                <div class="bp-skeleton sl-line" :style="{ width: `${NAME_WIDTHS[i % NAME_WIDTHS.length]}%` }"></div>
                <div class="bp-skeleton sl-line sl-line-sub"></div>
            </div>
            <div v-if="trailing" class="bp-skeleton sl-trailing"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
    rows?: number;
    avatar?: 'circle' | 'square' | 'none';
    rank?: boolean;
    trailing?: boolean;
}>(), {
    rows: 8,
    avatar: 'circle',
    rank: false,
    trailing: true,
});

// Unterschiedlich lange Namen, damit die Liste nicht wie ein Raster wirkt
const NAME_WIDTHS = [55, 70, 45, 62, 50, 75];
</script>

<style scoped>
.SkeletonList {
    overflow: hidden;
    background: var(--bp-surface);
    border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.sl-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--bp-border);
}
.sl-row:last-child {
    border-bottom: none;
}
.sl-rank {
    flex-shrink: 0;
    width: 28px;
    height: 18px;
    border-radius: 6px;
}
.sl-avatar {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
}
.sl-avatar-square {
    border-radius: 8px;
}
.sl-main {
    flex: 1;
    min-width: 0;
}
.sl-line {
    height: 12px;
    border-radius: 6px;
}
.sl-line-sub {
    width: 35%;
    height: 10px;
    margin-top: 8px;
}
.sl-trailing {
    flex-shrink: 0;
    width: 44px;
    height: 18px;
    border-radius: 6px;
}
</style>
