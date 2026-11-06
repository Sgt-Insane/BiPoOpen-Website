<template>
    <nav class="KnechtSideBar" :class="`kn-sidebar--${side}`" aria-label="BiPo Knecht">
        <button type="button" class="kn-side-button" :disabled="!canUndo" title="Letzten Wurf rückgängig machen" aria-label="Rückgängig" @click="$emit('undo')">
            <i class="pi pi-undo"></i>
        </button>
        <button type="button" class="kn-side-button" title="Punktestand" aria-label="Punktestand" @click="$emit('scoreboard')">
            <i class="pi pi-trophy"></i>
        </button>
        <button type="button" class="kn-side-button" title="Spielverlauf" aria-label="Spielverlauf" @click="$emit('timeline')">
            <i class="pi pi-clock"></i>
        </button>
        <button type="button" class="kn-side-button" title="Menü" aria-label="Menü" @click="$emit('menu')">
            <i class="pi pi-bars"></i>
        </button>
        <span class="kn-side-spacer"></span>
        <button type="button" class="kn-side-button kn-side-button--small" :title="`Leiste nach ${side === 'right' ? 'links' : 'rechts'}`" :aria-label="`Leiste nach ${side === 'right' ? 'links' : 'rechts'}`" @click="$emit('move')">
            <i :class="side === 'right' ? 'pi pi-angle-double-left' : 'pi pi-angle-double-right'"></i>
        </button>
    </nav>
</template>

<script setup lang="ts">
defineProps<{ side: 'left' | 'right'; canUndo: boolean }>();
defineEmits<{ undo: []; scoreboard: []; timeline: []; menu: []; move: [] }>();
</script>

<style scoped>
.KnechtSideBar{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 56px;
    min-width: 56px;
    padding: 10px 0;
    background: white;
}
.kn-sidebar--left{ border-right: 1px solid #E6E8EB; }
.kn-sidebar--right{ border-left: 1px solid #E6E8EB; }

.kn-side-spacer{
    height: 12px;
}
.kn-side-button{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid #E6E8EB;
    border-radius: 50%;
    background: white;
    color: #3A3F46;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, .06);
    transition: background .15s ease, transform .1s ease;
}
.kn-side-button .pi{
    font-size: 17px;
}
.kn-side-button:active:not(:disabled){
    transform: scale(.94);
    background: #F6F7F9;
}
.kn-side-button:disabled{
    opacity: .35;
    cursor: default;
}
.kn-side-button--small{
    width: 34px;
    height: 34px;
    box-shadow: none;
    color: #8A9099;
}
.kn-side-button--small .pi{
    font-size: 13px;
}
</style>
