<template>
    <section v-if="isLoading || photos.length" class="HomePhotoMosaic" aria-label="Fotos">
        <div class="hp-grid">
            <template v-if="isLoading">
                <Skeleton v-for="i in TILE_COUNT" :key="i" class="hp-tile" width="100%" height="100%" borderRadius="10px" />
            </template>

            <button
                v-for="(photo, index) in tiles"
                v-else
                :key="photo.img_id"
                type="button"
                class="hp-tile"
                @click="openModal(index)"
            >
                <img :src="getDriveThumbnail(photo.img_id, 600)" alt="" loading="lazy">
            </button>
        </div>

        <Transition name="fade">
            <ImageModal v-if="showModal" :toggleModal="closeModal" :pictures="pictures" :index="modalIndex" />
        </Transition>
    </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Skeleton from 'primevue/skeleton';
import ImageModal from '@/components/frontend/tournament/photos/ImageModal.vue';
import { getDriveThumbnail, loadAllTournamentPhotos, type DrivePhoto } from './homeUtil';

// Passt genau ins Kachelmuster: Desktop 6x3, Mobil 3x6 (siehe CSS)
const TILE_COUNT = 11;
// Im Vollbild geht es nach den Kacheln mit weiteren zufaelligen Fotos weiter
const MODAL_PHOTO_COUNT = 60;

// Zufaellige Fotos aus allen Turnieren
const photos = ref<DrivePhoto[]>([]);
const isLoading = ref(true);

loadAllTournamentPhotos().then((loaded) => {
    photos.value = loaded.slice(0, MODAL_PHOTO_COUNT);
    isLoading.value = false;
});

const tiles = computed(() => photos.value.slice(0, TILE_COUNT));

const pictures = computed(() => photos.value.map(photo => ({
    thumbnail: getDriveThumbnail(photo.img_id, 500),
    picture: getDriveThumbnail(photo.img_id, 1000),
})));

const showModal = ref(false);
const modalIndex = ref(0);
const openModal = (index: number) => {
    modalIndex.value = index;
    showModal.value = true;
};
const closeModal = () => showModal.value = false;
</script>

<style scoped>
/* Desktop: 6 Spalten x 3 Reihen, Kacheln 1, 4 gross und 7 breit */
.hp-grid{
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    grid-auto-rows: 150px;
    grid-auto-flow: dense;
    gap: 6px;
}
.hp-tile{
    padding: 0;
    border: 0;
    border-radius: 10px;
    overflow: hidden;
    background: var(--bp-fill);
    cursor: pointer;
}
.hp-tile img{
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
}
.hp-tile:hover img{
    transform: scale(1.04);
}
.hp-tile:nth-child(1),
.hp-tile:nth-child(4){
    grid-column: span 2;
    grid-row: span 2;
}
.hp-tile:nth-child(7){
    grid-column: span 2;
}

/* MOBILE: 3 Spalten x 6 Reihen, Kacheln 1 und 10 gross, 5 hoch */
@media (width <= 900px){
    .hp-grid{
        grid-template-columns: repeat(3, 1fr);
        grid-auto-rows: 104px;
        gap: 4px;
    }
    .hp-tile:nth-child(n){
        grid-column: auto;
        grid-row: auto;
    }
    .hp-tile:nth-child(1),
    .hp-tile:nth-child(10){
        grid-column: span 2;
        grid-row: span 2;
    }
    .hp-tile:nth-child(5){
        grid-row: span 2;
    }
}
</style>
