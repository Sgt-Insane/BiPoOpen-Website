import { ref } from 'vue';
import router from '@/router.js';

// Uebergabe eines vorbereiteten Spiels (z.B. aus dem "Spiel eintragen"-Drawer) an den BiPo Knecht.
const pendingMatch = ref<Match | null>(null);

export const useKnechtLaunch = () => {
    const launchKnecht = (match: Match) => {
        pendingMatch.value = match;
        if (router.currentRoute.value.name !== 'BiPo-Knecht') router.push('/Knecht');
    };

    const consumeLaunch = () => {
        const match = pendingMatch.value;
        pendingMatch.value = null;
        return match;
    };

    return { pendingMatch, launchKnecht, consumeLaunch };
};
