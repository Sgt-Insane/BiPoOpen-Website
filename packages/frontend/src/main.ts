import { createApp } from 'vue'
import App from '@/App.vue'
import router from '@/router.js';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { hintDirective } from '@/util/hintDirective';
import { vFitText } from '@/components/shared/fitText';
import BiPoPreset from '@/theme';
import "bootstrap/dist/css/bootstrap.min.css"
import "primeicons/primeicons.css"
import "material-icons/iconfont/material-icons.css"
import { setupPwaUpdates } from '@/util/pwaUpdate';
import { cleanupLegacyStorage } from '@/util/legacyStorageCleanup';
import '@/components/shared/useColorScheme';
import '@/components/shared/winter/winterTheme';

setupPwaUpdates();
cleanupLegacyStorage();

const app = createApp(App);

app.use(PrimeVue, {
    // Deutsche Texte fuer Suchfelder, Listen und Screenreader-Ansagen (sonst Englisch)
    locale: {
        emptyMessage: 'Keine Einträge',
        emptyFilterMessage: 'Nichts gefunden',
        emptySearchMessage: 'Kein Spieler gefunden',
        emptySelectionMessage: 'Nichts ausgewählt',
        searchMessage: '{0} Treffer',
        selectionMessage: '{0} ausgewählt',
        noFileChosenMessage: 'Keine Datei ausgewählt'
    },
    theme: {
        preset: BiPoPreset,
        options: {
            // Gesetzt ueber useColorScheme
            darkModeSelector: '.bp-dark'
        }
    }
});

app.use(ToastService);
// Erklaerung beim Drueberfahren (PC) bzw. Gedrueckthalten (Handy), siehe util/hintDirective.ts
app.directive('hint', hintDirective);
// Nie mit … kuerzen: zu langer Text wird kleiner (und bricht notfalls um), siehe components/shared/fitText.ts
app.directive('fit-text', vFitText);
app.use(router);
app.mount('#app');