<template>
    <!-- Schwebende Knoepfe am Rand, das Spielfeld bleibt in voller Breite. Immer sichtbar: Rueckgaengig,
         drei Punkte (mittig) und Sonderaktionen (alles, was man im Spiel eintragen muss, mit einem Tipp).
         Die drei Punkte klappen Punktestand, Spielverlauf und Einstellungen dazu auf. -->
    <div class="KnechtSideBar" :class="{ 'kn-fab--open': open }">
        <div v-if="open" class="kn-fab-backdrop" @click="open = false"></div>

        <nav class="kn-fab-menu" aria-label="BiPo Knecht">
            <transition-group name="kn-fab-item">
                <button v-if="open" key="scoreboard" type="button" class="kn-side-button" v-hint="'Punktestand'" aria-label="Punktestand" @click="pick('scoreboard')">
                    <i class="pi pi-trophy"></i>
                </button>
                <button v-if="open" key="timeline" type="button" class="kn-side-button" v-hint="'Spielverlauf'" aria-label="Spielverlauf" @click="pick('timeline')">
                    <i class="pi pi-clock"></i>
                </button>
            </transition-group>

            <button type="button" class="kn-side-button" :disabled="!canUndo" v-hint="'Letzten Wurf rückgängig machen'" aria-label="Rückgängig" @click="pick('undo')">
                <i class="pi pi-undo"></i>
            </button>

            <button type="button" class="kn-side-button kn-fab" v-hint="open ? 'Schließen' : 'Mehr'" :aria-expanded="open" aria-label="Aktionen" @click="open = !open">
                <i :class="open ? 'pi pi-times' : 'pi pi-ellipsis-v'"></i>
            </button>

            <button type="button" class="kn-side-button kn-side-button--special" v-hint="'Sonderaktion: Strafbier, Verwarnung, eigene Becher, Deathcup'" aria-label="Sonderaktion eintragen" @click="pick('special')">
                <i class="pi pi-flag"></i>
            </button>

            <transition-group name="kn-fab-item">
                <button v-if="open" key="menu" type="button" class="kn-side-button" v-hint="'Einstellungen & Pause'" aria-label="Einstellungen" @click="pick('menu')">
                    <i class="pi pi-cog"></i>
                </button>
            </transition-group>
        </nav>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ canUndo: boolean }>();
const emit = defineEmits<{ undo: []; scoreboard: []; timeline: []; menu: []; special: [] }>();

const open = ref(false);

const pick = (action: 'undo' | 'scoreboard' | 'timeline' | 'menu' | 'special') => {
    open.value = false;
    if (action === 'undo') emit('undo');
    else if (action === 'scoreboard') emit('scoreboard');
    else if (action === 'timeline') emit('timeline');
    else if (action === 'special') emit('special');
    else emit('menu');
};
</script>

<style scoped>
.KnechtSideBar{
    position: absolute;
    top: 50%;
    right: 8px;
    z-index: 25;
    transform: translateY(-50%);
    pointer-events: none;
}
.kn-fab-backdrop{
    position: fixed;
    inset: -100vmax;
    pointer-events: auto;
}
.kn-fab-menu{
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    pointer-events: auto;
}
.kn-side-button{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--bp-border);
    border-radius: 50%;
    background: var(--bp-surface);
    color: var(--bp-text);
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, .18);
    transition: background .15s ease, transform .1s ease, opacity .2s ease;
}
.kn-side-button .pi{
    font-size: 17px;
}
.kn-side-button:active:not(:disabled){
    transform: scale(.94);
    background: var(--page-gray);
}
.kn-side-button:disabled{
    opacity: .35;
    cursor: default;
}
/* Geschlossen dezent, damit die Knoepfe nicht vom Spiel ablenken */
.kn-side-button:not(:disabled){
    opacity: .9;
}
.kn-side-button--special .pi{
    color: #E5484D;
}
.kn-fab--open .kn-side-button:not(:disabled){
    opacity: 1;
}
.kn-fab--open .kn-fab{
    opacity: 1;
    background: var(--bp-text-strong);
    color: var(--bp-surface);
}
.kn-fab-item-enter-active,
.kn-fab-item-leave-active{
    transition: opacity .15s ease, transform .15s ease;
}
.kn-fab-item-enter-from,
.kn-fab-item-leave-to{
    opacity: 0;
    transform: scale(.6);
}
</style>
