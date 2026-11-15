<template>
    <!-- Kleiner (i)-Knopf: erklaert die Fachbegriffe an dieser Stelle -->
    <button type="button" class="GlossaryHint" :aria-label="`Begriffe erklärt: ${entries.map(entry => entry.term).join(', ')}`" @click.stop.prevent="visible = true">
        <i class="pi pi-info-circle" aria-hidden="true"></i>
    </button>

    <BottomSheet v-model:visible="visible">
        <template #header>
            <div class="gh-title">{{ title ?? 'Kurz erklärt' }}</div>
        </template>
        <dl class="gh-list">
            <template v-for="entry in entries" :key="entry.term">
                <dt>{{ entry.term }}</dt>
                <dd>{{ entry.text }}</dd>
            </template>
        </dl>
        <router-link to="/Regeln#begriffe" class="gh-more" @click="visible = false">Alle Begriffe <i class="pi pi-angle-right"></i></router-link>
    </BottomSheet>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import BottomSheet from './BottomSheet.vue';
import { GLOSSARY, type GlossaryKey } from './glossary';

const props = defineProps<{ terms: GlossaryKey[]; title?: string }>();

const visible = ref(false);
const entries = computed(() => props.terms.map(key => GLOSSARY[key]));
</script>

<style scoped>
.GlossaryHint{
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin: -6px 0;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--bp-text-muted);
    vertical-align: middle;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    i { font-size: 15px; }
}
.GlossaryHint:hover{
    background: var(--bp-fill-soft);
}
.gh-title{
    font-size: 20px;
    font-weight: 800;
    color: var(--bp-text-strong);
}
.gh-list{
    margin: 0;

    dt {
        margin-top: 12px;
        font-size: 15px;
        font-weight: 700;
        color: var(--bp-text-strong);
    }
    dt:first-child { margin-top: 0; }
    dd {
        margin: 2px 0 0;
        font-size: 14px;
        line-height: 1.45;
        color: var(--bp-text);
    }
}
.gh-more{
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-top: 16px;
    color: var(--main-color);
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
}
</style>
