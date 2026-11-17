<template>
    <AutoComplete
        :modelValue="modelValue"
        @update:modelValue="$emit('update:modelValue', $event)"
        :suggestions="suggestions"
        @complete="onSearch"
        @show="scrollSuggestionsToBottom"
        @item-select="$emit('item-select', $event)"
        @focus="loadNames"
        :placeholder="placeholder"
        :class="className"
        overlayClass="bipo-player-autocomplete-panel"
        appendTo="self"
        :dropdown="false"
        v-bind="$attrs"
        class="p-0"
        inputClass="!p-[5px]"
        :pt="{ list: { onClick: stopListClick } }"
    >
        <template #option="{ option }">
            <div class="flex items-center gap-[8px]">
                <Avatar :name="option" size="normal" shape="circle" />
                <span>{{ option }}</span>
            </div>
        </template>
    </AutoComplete>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import AutoComplete from 'primevue/autocomplete';
import Avatar from '@/components/shared/Avatar.vue';
import { getAllPlayerNames, getPlayerMatchCounts } from '@/components/frontend/playerProfile/PlayerProfileUtilFunctions';
import { rankPlayerNames } from '@/components/shared/playerNameSearch';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
    modelValue?: string;
    placeholder?: string;
    className?: string;
    maxResults?: number;
}>(), {
    modelValue: '',
    placeholder: 'Spieler suchen...',
    className: '',
    maxResults: 15,
});

defineEmits<{
    'update:modelValue': [value: string];
    'item-select': [event: { value: string }];
}>();

let names: string[] = [];
let matchCounts: Record<string, number> = {};
let namesLoaded = false;
let namesLoading = false;
const suggestions = ref<string[]>([]);

// Klick auf einen Vorschlag nicht bis zum Rahmen des Feldes durchreichen: PrimeVue will dort das Eingabefeld
// fokussieren, das nach der Auswahl schon weg ist (Fehler "reading '$el'")
const stopListClick = (event: MouseEvent) => event.stopPropagation();

const scrollSuggestionsToBottom = async () => {
    await nextTick();
    const panel = document.querySelector<HTMLElement>('.bipo-player-autocomplete-panel');
    const scrollContainer = panel?.querySelector<HTMLElement>('.p-autocomplete-list-container')
        ?? panel?.querySelector<HTMLElement>('.p-autocomplete-list');
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
};

const loadNames = async () => {
    if (namesLoaded || namesLoading) return;
    namesLoading = true;
    names = await getAllPlayerNames();
    matchCounts = await getPlayerMatchCounts();
    namesLoading = false;
    namesLoaded = true;
};

const onSearch = async (event: { query: string }) => {
    const query = event.query.trim().toLowerCase();
    if (!query) {
        suggestions.value = [];
        return;
    }
    if (!namesLoaded) await loadNames();
    // Beste Treffer unten, direkt ueber dem Eingabefeld (die Liste oeffnet nach oben)
    suggestions.value = rankPlayerNames(names, query, matchCounts)
        .slice(0, props.maxResults)
        .reverse();
    await scrollSuggestionsToBottom();
};
</script>

<style scoped>
:deep(.bipo-player-autocomplete-panel) {
    top: auto !important;
    bottom: calc(100% + 8px) !important;
}
</style>
