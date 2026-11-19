import { createApp } from 'vue'
import App from '@/App.vue'
import router from '@/router.js';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { hintDirective } from '@/util/hintDirective';
import BiPoPreset from '@/theme';
import "bootstrap/dist/css/bootstrap.min.css"
import "primeicons/primeicons.css"
import "material-icons/iconfont/material-icons.css"
import { registerSW } from 'virtual:pwa-register';
import '@/components/shared/useColorScheme';

registerSW({ immediate: true });

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
app.use(router);
app.mount('#app');