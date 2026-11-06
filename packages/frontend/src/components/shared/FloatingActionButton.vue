<template>
    <!-- In den body teleportiert: die Seiten-Transition setzt transform auf die Seite, das bricht position: fixed -->
    <Teleport to="body">
        <Transition name="fab" appear>
            <button v-if="visible"
                type="button"
                class="FloatingActionButton"
                :class="{ 'fab-light': light, 'fab-round': !showLabel, 'fab-stacked': stacked }"
                :aria-label="label"
                :title="showLabel ? undefined : label"
                @click="emit('click')"
            >
                <img v-if="image" :src="image" alt="" class="fab-image"/>
                <i v-else :class="icon" class="fab-icon"></i>
                <span v-if="showLabel">{{ label }}</span>
            </button>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
defineProps({
    label: { type: String, required: true },
    icon: { type: String, default: 'pi pi-plus' },
    // Bild statt PrimeIcon
    image: { type: String, default: '' },
    // false = runder Button nur mit Icon, das Label dient dann als aria-label/Tooltip
    showLabel: { type: Boolean, default: true },
    // Weisser Button statt Hauptfarbe
    light: { type: Boolean, default: false },
    // Sitzt ueber einem normalen Floating Button
    stacked: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
});

const emit = defineEmits<{ click: [] }>();
</script>

<style scoped>
.FloatingActionButton{
    /* Hoehe des normalen Buttons: 2x Padding + Zeilenhoehe */
    --fab-height: 44px;
    --fab-gap: 12px;
    --fab-bottom: 24px;
    position: fixed;
    right: 24px;
    bottom: var(--fab-bottom);
    /* Unter App-Header, Bottom-Nav und Modals (alle 99) */
    z-index: 98;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 24px;
    border: none;
    border-radius: 999px;
    background: var(--main-color);
    color: white;
    font-family: inherit;
    font-weight: 700;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(234, 81, 96, 0.4);
    transition: .2s background ease, .2s transform ease;
    -webkit-tap-highlight-color: transparent;
}
.FloatingActionButton:hover{
    background: #d4434f;
}
.FloatingActionButton:active{
    transform: scale(0.96);
}
.fab-icon{
    font-size: 15px;
    font-weight: 700;
}
.fab-image{
    width: 24px;
    height: 24px;
    /* Gleiche Hoehe wie ein Button mit PrimeIcon */
    margin-block: -4px;
    display: block;
}
.fab-round .fab-image{
    width: 30px;
    height: 30px;
    margin-block: 0;
}

.fab-light{
    background: var(--bp-surface);
    color: var(--main-color);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
}
.fab-light:hover{
    background: var(--bp-fill-soft);
}

.fab-round{
    width: 56px;
    height: 56px;
    padding: 0;
}

/* Rechtsbuendig ueber dem normalen Floating Button */
.fab-stacked{
    bottom: calc(var(--fab-bottom) + var(--fab-height) + var(--fab-gap));
}

.fab-enter-active, .fab-leave-active{
    transition: opacity .2s ease, transform .2s ease;
}
.fab-enter-from, .fab-leave-to{
    opacity: 0;
    transform: translateY(12px) scale(0.9);
}

/* MOBILE: ueber der Bottom-Nav */
@media (width <= 900px){
    .FloatingActionButton{
        right: 16px;
        --fab-bottom: calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom) + 16px);
    }
}
</style>
