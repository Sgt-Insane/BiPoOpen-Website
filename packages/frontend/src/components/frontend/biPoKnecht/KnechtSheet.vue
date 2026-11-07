<template>
    <transition name="kn-sheet">
        <div v-if="visible" class="KnechtSheet" :class="{ 'kn-sheet--flipped': flipped }" @click.self="visible = false">
            <div class="kn-sheet-panel" role="dialog" :aria-label="title">
                <span class="kn-sheet-handle"></span>
                <div class="kn-sheet-header">
                    <div>
                        <div class="kn-sheet-title">{{ title }}</div>
                        <div v-if="subtitle" class="kn-sheet-subtitle">{{ subtitle }}</div>
                    </div>
                    <button type="button" class="kn-sheet-close" aria-label="Schließen" @click="visible = false">
                        <i class="pi pi-times"></i>
                    </button>
                </div>
                <div class="kn-sheet-content">
                    <slot></slot>
                </div>
            </div>
        </div>
    </transition>
</template>

<script setup lang="ts">
// Sheet innerhalb des Spielfelds (statt BottomSheet), damit es sich mit dem Feld dreht:
// Schiedsrichter-Querformat und Spielermodus fuer das Team am oberen Tischende.
const visible = defineModel<boolean>('visible', { default: false });

defineProps<{
    title: string;
    subtitle?: string;
    flipped?: boolean;
}>();
</script>

<style scoped>
.KnechtSheet{
    position: absolute;
    inset: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    background: rgba(31, 35, 40, .45);
}
.kn-sheet--flipped{
    transform: rotate(180deg);
}
.kn-sheet-panel{
    display: flex;
    flex-direction: column;
    max-height: 88%;
    padding: 6px 16px 16px;
    border-radius: 20px 20px 0 0;
    background: var(--bp-surface);
    box-shadow: 0 -8px 30px rgba(0, 0, 0, .15);
}
.kn-sheet-handle{
    align-self: center;
    width: 40px;
    height: 4px;
    margin: 4px 0 8px;
    border-radius: 999px;
    background: var(--bp-border-strong);
}
.kn-sheet-header{
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}
.kn-sheet-title{
    font-size: 20px;
    font-weight: 700;
    color: var(--bp-text-strong);
    line-height: 1.2;
}
.kn-sheet-subtitle{
    font-size: 13px;
    color: var(--bp-text-muted);
}
.kn-sheet-close{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 50%;
    background: var(--bp-fill-soft);
    color: var(--bp-text);
    cursor: pointer;
}
.kn-sheet-content{
    overflow-y: auto;
    overscroll-behavior: contain;
}

.kn-sheet-enter-active,
.kn-sheet-leave-active{
    transition: opacity .2s ease;
}
.kn-sheet-enter-active .kn-sheet-panel,
.kn-sheet-leave-active .kn-sheet-panel{
    transition: transform .25s cubic-bezier(.2, .8, .2, 1);
}
.kn-sheet-enter-from,
.kn-sheet-leave-to{
    opacity: 0;
}
.kn-sheet-enter-from .kn-sheet-panel,
.kn-sheet-leave-to .kn-sheet-panel{
    transform: translateY(100%);
}
</style>
