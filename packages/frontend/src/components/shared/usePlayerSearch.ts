import { ref } from 'vue';

// Globale Spielersuche (PlayerSearchDrawer), geoeffnet ueber die Lupe im Header
const playerSearchVisible = ref(false);

export const usePlayerSearch = () => {
	const openPlayerSearch = () => { playerSearchVisible.value = true; };
	const closePlayerSearch = () => { playerSearchVisible.value = false; };

	return { playerSearchVisible, openPlayerSearch, closePlayerSearch };
};
