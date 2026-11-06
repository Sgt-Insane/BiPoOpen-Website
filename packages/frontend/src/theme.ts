import { definePreset } from '@primevue/themes';
import Aura from '@primevue/themes/aura';

// Brand colors: --main-color: #EA5160, --secondary-color: #61C3D9
// Farben in den Komponenten ueber die --bp-* Tokens aus App.vue, die schalten selbst zwischen hell und dunkel um

const tabsColors = {
    tablist: {
        background: 'var(--bp-surface)',
        borderColor: 'var(--bp-border)'
    },
    // Inhalt unter den Reitern liegt immer auf dem grauen Seitengrund
    tabpanel: {
        background: 'var(--page-gray)'
    },
    tab: {
        background: 'transparent',
        hoverBackground: 'transparent',
        activeBackground: 'transparent',
        color: 'var(--bp-text-muted)',
        hoverColor: 'var(--bp-text-strong)',
        activeColor: '{primary.color}'
    },
    activeBar: {
        background: '{primary.color}'
    }
};

const datatableColors = {
    root: {
        borderColor: 'var(--bp-border)'
    },
    headerCell: {
        background: 'var(--bp-surface)',
        hoverBackground: 'var(--bp-surface)',
        selectedBackground: 'var(--bp-surface)',
        color: 'var(--bp-text-subtle)',
        hoverColor: 'var(--bp-text-strong)',
        selectedColor: 'var(--bp-text-strong)'
    },
    row: {
        background: 'var(--bp-surface)',
        hoverBackground: 'var(--bp-fill-soft)',
        color: 'var(--bp-text)',
        hoverColor: 'var(--bp-text)'
    },
    footer: {
        background: 'var(--bp-surface)',
        color: 'var(--bp-text-subtle)'
    }
};
const BiPoPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50:  '#fef2f3',
            100: '#fde6e8',
            200: '#fbd0d5',
            300: '#f8a9b2',
            400: '#f37a88',
            500: '#EA5160',
            600: '#d62f42',
            700: '#b42236',
            800: '#961f32',
            900: '#7f1f30',
            950: '#460c16'
        },
        colorScheme: {
            light: {
                primary: {
                    color: '#EA5160',
                    contrastColor: '#ffffff',
                    hoverColor: '#d62f42',
                    activeColor: '#b42236'
                },
                highlight: {
                    background: '#fde6e8',
                    focusBackground: '#fbd0d5',
                    color: '#b42236',
                    focusColor: '#961f32'
                }
            },
            // Flaechen passend zu den --bp-* Tokens in App.vue, Markenrot bleibt auch im Dark Mode
            dark: {
                surface: {
                    0:   '#ffffff',
                    50:  '#ECEEF1',
                    100: '#C9CDD3',
                    200: '#ADB2BA',
                    300: '#979DA6',
                    400: '#858B94',
                    500: '#6E747D',
                    600: '#3A3F46',
                    700: '#31353C',
                    800: '#282C32',
                    900: '#1B1E22',
                    950: '#121417'
                },
                primary: {
                    color: '#EA5160',
                    contrastColor: '#ffffff',
                    hoverColor: '#f37a88',
                    activeColor: '#f8a9b2'
                },
                highlight: {
                    background: 'rgba(234, 81, 96, 0.18)',
                    focusBackground: 'rgba(234, 81, 96, 0.26)',
                    color: '#f37a88',
                    focusColor: '#f8a9b2'
                }
            }
        }
    },
    components: {
        // Minimale Reiter: linksbuendiger Text, aktiver Reiter rot mit Unterstrich
        tabs: {
            // Nur eine feine Linie unter den Reitern, kein Schatten
            tablist: {
                borderWidth: '0 0 1px 0'
            },
            tab: {
                borderWidth: '0',
                margin: '0',
                padding: '0.75rem 0',
                fontWeight: '700'
            },
            activeBar: {
                height: '3px',
                bottom: '0'
            },
            colorScheme: {
                light: tabsColors,
                dark: tabsColors
            },
            css: `
                .p-tablist-tab-list {
                    gap: 1.5rem;
                }
                .p-tablist-active-bar {
                    border-radius: 3px 3px 0 0;
                }

                /* Chip-Variante: <Tabs class="p-tabs-chips">, aktiver Chip immer in der Primaerfarbe */
                .p-tabs-chips .p-tablist {
                    background: transparent;
                }
                .p-tabs-chips .p-tablist-tab-list {
                    gap: 0.5rem;
                    border-width: 0;
                }
                .p-tabs-chips .p-tab {
                    padding: 0.4rem 0.9rem;
                    font-size: 13px;
                    line-height: 1.2;
                    color: var(--bp-text-strong);
                    background: var(--bp-surface);
                    border: 1px solid var(--bp-border-strong);
                    border-radius: 999px;
                }
                .p-tabs-chips .p-tab:not(.p-tab-active):not(.p-disabled):hover {
                    color: var(--bp-text-strong);
                    background: var(--bp-fill-soft);
                }
                .p-tabs-chips .p-tab.p-tab-active {
                    color: var(--p-primary-contrast-color);
                    background: var(--p-primary-color);
                    border-color: var(--p-primary-color);
                }
                .p-tabs-chips .p-tablist-active-bar {
                    display: none;
                }
            `
        },
        // Segment-Auswahl (SelectButton): graue Leiste, aktive Option als weisse Pille
        selectbutton: {
            root: {
                borderRadius: '12px'
            }
        },
        togglebutton: {
            root: {
                padding: '0.25rem',
                fontWeight: '700'
            },
            content: {
                padding: '0.5rem 0.75rem',
                borderRadius: '9px',
                checkedShadow: '0px 1px 3px 0px rgba(0, 0, 0, 0.08), 0px 1px 2px 0px rgba(0, 0, 0, 0.06)'
            }
        },
        // Tabellen als weisse Karte: kleiner grauer Kopf in Grossbuchstaben, feine Zeilenlinien.
        // Mit scrollable + frozen (Platz, Name) wischt der Rest seitlich, fixierte Spalten sind linksbuendig.
        datatable: {
            headerCell: {
                padding: '0.5rem 0.375rem',
                gap: '0.25rem'
            },
            columnTitle: {
                fontWeight: '700'
            },
            bodyCell: {
                padding: '0.375rem 0.375rem'
            },
            footer: {
                padding: '0.5rem 0.75rem',
                borderWidth: '1px 0 0 0'
            },
            colorScheme: {
                light: datatableColors,
                dark: datatableColors
            },
            css: `
                .p-datatable {
                    overflow: hidden;
                    background: var(--bp-surface);
                    border: 1px solid var(--p-datatable-border-color);
                    border-radius: 14px;
                }

                .p-datatable-thead > tr > th {
                    font-size: 0.6875rem;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    text-align: center;
                    white-space: nowrap;
                }
                .p-datatable-column-header-content {
                    justify-content: center;
                }
                .p-datatable .p-datatable-tbody > tr > td {
                    font-size: 0.875rem;
                    font-variant-numeric: tabular-nums;
                    text-align: center;
                    white-space: nowrap;
                    vertical-align: middle;
                }
                .p-datatable-tbody > tr:last-child > td {
                    border-bottom-width: 0;
                }
                .p-datatable-hoverable .p-datatable-tbody > tr {
                    cursor: pointer;
                }

                /* Innenabstand zum Kartenrand */
                .p-datatable-thead > tr > th:first-child,
                .p-datatable-tbody > tr > td:first-child {
                    padding-inline-start: 0.5rem;
                }
                .p-datatable-thead > tr > th:last-child,
                .p-datatable-tbody > tr > td:last-child {
                    padding-inline-end: 0.75rem;
                }

                /* Fixierte Spalten und <Column class="bp-col-start"> linksbuendig, Trennlinie nach der letzten fixierten */
                .p-datatable .p-datatable-frozen-column,
                .p-datatable .bp-col-start {
                    text-align: start;
                }
                .p-datatable-frozen-column .p-datatable-column-header-content,
                .bp-col-start .p-datatable-column-header-content {
                    justify-content: flex-start;
                }
                .p-datatable .p-datatable-frozen-column:not(:has(+ .p-datatable-frozen-column)) {
                    border-inline-end: 1px solid var(--p-datatable-border-color);
                }

                /* Platz-Spalte <Column class="bp-col-rank">: trotz fixiert zentriert, damit ein- und zweistellige Plaetze mittig wirken */
                .p-datatable th.bp-col-rank,
                .p-datatable td.bp-col-rank {
                    text-align: center;
                }
                .p-datatable .bp-col-rank .p-datatable-column-header-content {
                    justify-content: center;
                }

                /* Hervorgehobene Spalte, z.B. Siege */
                .p-datatable th.bp-col-strong {
                    color: var(--p-datatable-header-cell-selected-color);
                }
                .p-datatable td.bp-col-strong {
                    font-weight: 700;
                    color: var(--bp-text-strong);
                }

                /* Sortierung als kleiner Pfeil am Spaltentitel statt Icon */
                .p-datatable-sort-icon {
                    display: none;
                }
                .p-datatable-column-sorted[aria-sort="descending"] .p-datatable-column-title::after {
                    content: ' ▾';
                }
                .p-datatable-column-sorted[aria-sort="ascending"] .p-datatable-column-title::after {
                    content: ' ▴';
                }

                /* Gestrichelte Linie zwischen zwei Tabellenzonen: rowClass "bp-row-divider" */
                .p-datatable-tbody > tr.bp-row-divider > td {
                    border-bottom: 1px dashed var(--bp-border-strong);
                }

                /* Name mit Avatar */
                .bp-name-cell {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .bp-name {
                    overflow: hidden;
                    max-width: 9rem;
                    font-weight: 700;
                    color: var(--bp-text-strong);
                    text-align: start;
                    text-overflow: ellipsis;
                }
                /* Doppelte Klasse, damit seitenweite Avatar-Groessen (z.B. in _League.vue) die Tabelle nicht aufblaehen */
                .p-datatable .p-datatable-tbody .p-avatar {
                    --bp-avatar-size: 2.25rem;
                    flex-shrink: 0;
                    width: var(--bp-avatar-size);
                    height: var(--bp-avatar-size);
                    font-size: calc(var(--bp-avatar-size) * 0.35);
                    font-weight: 700;
                    opacity: 1;
                    --avatar-background: var(--bp-fill);
                    --avatar-color: var(--bp-text-muted);
                }

                /* Platz: Podium 1-3 (bp-rank-1..3) oder Tabellenzone (bp-zone-*) mit Pfeil */
                .bp-rank {
                    font-weight: 700;
                    color: var(--bp-text-strong);
                }
                .bp-rank-1 { color: #C9A227; }
                .bp-rank-2 { color: #8E949C; }
                .bp-rank-3 { color: #B0703C; }
                .bp-zone-qualify { --bp-zone-color: #1F97B0; --bp-zone-marker: '▲'; }
                .bp-zone-promotion { --bp-zone-color: var(--bp-success); --bp-zone-marker: '▲'; }
                .bp-zone-relegation { --bp-zone-color: var(--bp-danger); --bp-zone-marker: '▼'; }
                .bp-rank[class*="bp-zone-"] {
                    color: var(--bp-zone-color);
                }
                .bp-rank[class*="bp-zone-"]::after {
                    content: var(--bp-zone-marker);
                    margin-inline-start: 0.125rem;
                    font-size: 0.5625rem;
                    vertical-align: 0.1em;
                }

                /* Positive / negative Werte, z.B. Trefferdifferenz */
                .bp-value-up { color: var(--bp-success); }
                .bp-value-down { color: var(--bp-danger); }

                /* Wert mit Tooltip (v-tooltip.focus + tabindex): gepunktet unterstrichen */
                .bp-tooltip-target {
                    cursor: pointer;
                    outline: none;
                    text-decoration: underline dotted;
                    text-underline-offset: 3px;
                }

                /* Legende im #footer der Tabelle */
                .bp-legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.25rem 1rem;
                    font-size: 0.75rem;
                }
                .bp-legend > [class*="bp-zone-"]::before {
                    content: var(--bp-zone-marker);
                    margin-inline-end: 0.25rem;
                    color: var(--bp-zone-color);
                }

                @media (width > 900px) {
                    .bp-name {
                        max-width: 18rem;
                    }
                }

                /* Mobil: engere Spalten, kleinerer Avatar und Name, damit moeglichst alle Spalten ohne Wischen passen */
                @media (width <= 900px) {
                    .p-datatable .p-datatable-thead > tr > th,
                    .p-datatable .p-datatable-tbody > tr > td {
                        padding-inline: 0.25rem;
                    }
                    .p-datatable .p-datatable-thead > tr > th:first-child,
                    .p-datatable .p-datatable-tbody > tr > td:first-child {
                        padding-inline-start: 0.375rem;
                    }
                    .p-datatable .p-datatable-thead > tr > th:last-child,
                    .p-datatable .p-datatable-tbody > tr > td:last-child {
                        padding-inline-end: 0.5rem;
                    }
                    .bp-name-cell {
                        gap: 0.375rem;
                    }
                    .bp-name {
                        max-width: 6.5rem;
                        font-size: 0.8125rem;
                    }
                    /* Waechst stufenlos mit der Breite: 24px bei 360px Viewport bis max. 36px ab 500px */
                    .p-datatable .p-datatable-tbody .p-avatar {
                        --bp-avatar-size: clamp(1.5rem, calc(1.5rem + (100vw - 360px) * 0.0857), 2.25rem);
                    }
                }
            `
        }
    }
});

export default BiPoPreset;
