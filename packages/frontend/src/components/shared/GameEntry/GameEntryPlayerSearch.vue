<template>
    <div class="GameEntryPlayerSearch">
        <!-- Gewaehlter Spieler -->
        <div v-if="modelValue" class="gp-chip">
            <Avatar :name="modelValue" shape="circle" class="gp-avatar" />
            <span class="gp-chip-name">{{ modelValue }}</span>
            <EloChip :rating="getElo(modelValue)" />
            <button type="button" class="gp-icon-button" aria-label="Spieler entfernen" @click="emit('clear')">
                <i class="pi pi-times"></i>
            </button>
        </div>

        <!-- Suche: Treffer liegen als Dropdown ueber dem Inhalt darunter, ohne das Layout zu verschieben -->
        <template v-else>
            <div class="gp-input-wrap" :class="{ 'gp-input-wrap--open': showResults }">
                <i class="pi pi-search gp-search-icon"></i>
                <input
                    ref="inputEl"
                    v-model="query"
                    class="gp-input"
                    type="text"
                    :placeholder="placeholder"
                    autocomplete="off"
                    enterkeyhint="done"
                    @focus="onFocus"
                    @blur="isFocused = false"
                    @keydown.enter.prevent="selectFirst"
                    @keydown.esc="inputEl?.blur()"
                />
                <button v-if="removable" type="button" class="gp-icon-button" aria-label="Mitspieler entfernen" @mousedown.prevent @click="emit('clear')">
                    <i class="pi pi-times"></i>
                </button>
            </div>

            <div v-if="showResults" ref="resultsEl" class="gp-results" role="listbox">
                <button v-for="name in suggestions" :key="name"
                    type="button"
                    role="option"
                    class="gp-result"
                    @mousedown.prevent
                    @click="select(name)"
                >
                    <Avatar :name="name" shape="circle" class="gp-avatar" />
                    <span class="gp-result-name">{{ name }}</span>
                    <EloChip :rating="getElo(name)" />
                </button>

                <button v-if="newName" type="button" role="option" class="gp-result gp-result-new" @mousedown.prevent @click="select(newName)">
                    <span class="gp-new-icon"><i class="pi pi-plus"></i></span>
                    <span>„{{ newName }}“ als neuen Spieler hinzufügen</span>
                </button>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import Avatar from '@/components/shared/Avatar.vue';
import EloChip from '@/components/shared/EloChip.vue';
import { useEloRatings } from '@/components/shared/useEloRatings';
import { getAllPlayerNames, getPlayerMatchCounts } from '@/components/frontend/playerProfile/PlayerProfileUtilFunctions';

const MAX_RESULTS = 6;

const props = withDefaults(defineProps<{
    modelValue: string;
    excludedNames?: string[];   // schon im Spiel gewaehlt
    removable?: boolean;        // zusaetzlicher Mitspieler: x entfernt den Platz
    placeholder?: string;
}>(), {
    excludedNames: () => [],
    placeholder: 'Spieler suchen …',
});

const emit = defineEmits<{
    'update:modelValue': [name: string];
    clear: [];
}>();

const inputEl = ref<HTMLInputElement>();
const query = ref('');
const isFocused = ref(false);
const names = ref<string[]>([]);
const matchCounts = ref<Record<string, number>>({});

const { loadEloRatings, getElo } = useEloRatings();
loadEloRatings();

const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const onFocus = async () => {
    isFocused.value = true;
    if (names.value.length) return;
    [names.value, matchCounts.value] = await Promise.all([getAllPlayerNames(), getPlayerMatchCounts()]);
}

// Leere Suche: die aktivsten Spieler zur schnellen Auswahl.
const suggestions = computed(() => {
    const search = normalize(query.value);
    const excluded = props.excludedNames.map(normalize);
    return names.value
        .filter(name => !excluded.includes(normalize(name)) && normalize(name).includes(search))
        .sort((name1, name2) =>
            (matchCounts.value[name2] ?? 0) - (matchCounts.value[name1] ?? 0) || name1.localeCompare(name2, 'de', { sensitivity: 'base' })
        )
        .slice(0, MAX_RESULTS);
});

// Neuer Spieler nur, wenn es den Namen noch nicht gibt.
const newName = computed(() => {
    const name = query.value.trim().replace(/\s+/g, ' ');
    if (!name || names.value.some(existing => normalize(existing) === normalize(name))) return '';
    return props.excludedNames.some(excluded => normalize(excluded) === normalize(name)) ? '' : name;
});

const showResults = computed(() => isFocused.value && (suggestions.value.length > 0 || !!newName.value));

// Dropdown liegt ueber dem Inhalt: weiter unten im Sheet so weit scrollen, dass es ganz sichtbar ist
const resultsEl = ref<HTMLElement>();
watch(showResults, async (visible) => {
    if (!visible) return;
    await nextTick();
    resultsEl.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

const select = (name: string) => {
    query.value = '';
    emit('update:modelValue', name);
}

const selectFirst = () => {
    const first = suggestions.value[0] ?? newName.value;
    if (first) select(first);
}

defineExpose({ focus: () => inputEl.value?.focus() });
</script>

<style scoped>
.GameEntryPlayerSearch{
    position: relative;
}
.gp-input-wrap,
.gp-chip{
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 6px 0 12px;
    border: 1px solid var(--bp-border-strong);
    border-radius: 10px;
    background: var(--bp-surface);
}
.gp-input-wrap:focus-within{
    border-color: var(--bp-text-strong);
}
.gp-input-wrap--open{
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
}
.gp-search-icon{
    color: var(--bp-text-subtle);
    font-size: 15px;
}
.gp-input{
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 15px;
}
.gp-input::placeholder{
    color: var(--bp-text-faint);
}

.gp-chip{
    padding-left: 8px;
}
.gp-chip-name{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--bp-text-strong);
    font-size: 15px;
    font-weight: 600;
}
.gp-avatar{
    width: 28px !important;
    height: 28px !important;
    min-width: 28px;
    font-size: 11px !important;
}

.gp-icon-button{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--bp-text-subtle);
    cursor: pointer;
}
.gp-icon-button:hover{
    background: var(--bp-fill-soft);
}
.gp-icon-button .pi{
    font-size: 12px;
}

.gp-results{
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 5; /* ueber Score-Auswahl und Speichern-Leiste */
    display: flex;
    flex-direction: column;
    border: 1px solid var(--bp-text-strong);
    border-top: none;
    border-radius: 0 0 10px 10px;
    background: var(--bp-surface);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
    overflow: hidden;
}
.gp-result{
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 42px;
    padding: 6px 12px;
    border: none;
    border-top: 1px solid var(--bp-border);
    background: var(--bp-surface);
    color: var(--bp-text-strong);
    font: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
}
.gp-result:hover{
    background: var(--bp-fill-soft);
}
.gp-result-name{
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.gp-result-new{
    color: var(--main-color);
    font-weight: 600;
}
.gp-new-icon{
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    min-width: 28px;
    border-radius: 50%;
    background: var(--bp-primary-weak);
}
.gp-new-icon .pi{
    font-size: 11px;
}
</style>
