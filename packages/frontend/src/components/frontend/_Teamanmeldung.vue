<template>
    <div class="Page">
        <h1 class="bp-title">Weck BiPo Open 2026 – Anmeldung</h1>

        <!-- Eckdaten -->
        <div style="background: var(--bp-surface); border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); padding: 32px; margin-bottom: 32px; width: 100%; max-width: 700px;">
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="color: var(--main-color); font-weight: bold; min-width: 130px;">Datum</span>
                    <span>Samstag, 11. Juli 2026</span>
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="color: var(--main-color); font-weight: bold; min-width: 130px;">Ort</span>
                    <span>Kaspar-von-Zumbusch-Straße 6, 33378 Rheda-Wiedenbrück</span>
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="color: var(--main-color); font-weight: bold; min-width: 130px;">Einlass</span>
                    <span>13:00 Uhr</span>
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="color: var(--main-color); font-weight: bold; min-width: 130px;">Turnierstart</span>
                    <span>14:00 Uhr</span>
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="color: var(--main-color); font-weight: bold; min-width: 130px;">Vsl. Ende</span>
                    <span>23:00 Uhr</span>
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="color: var(--main-color); font-weight: bold; min-width: 130px;">Modus</span>
                    <span>32 Teams im 2-gegen-2-Modus. Gruppenphase: 8 Gruppen à 4 Teams. Die Erst- und Zweitplatzierten ziehen ins Achtelfinale (K.O.-Runde) ein.</span>
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start;">
                    <span style="color: var(--main-color); font-weight: bold; min-width: 130px;">Preise</span>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span>🥇 1. Platz – BiPo-Open-folierter Bierpong-Tisch + Wanderpokal</span>
                        <span>🥈 2. Platz – 60 €</span>
                        <span>🥉 3. Platz – 30 €</span>
                        <span>🏆 MVP – 30 € + Wanderpokal</span>
                    </div>
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="color: var(--main-color); font-weight: bold; min-width: 130px;">Essen</span>
                    <span>Hotdogs (Geflügel, vegetarisch &amp; vegan)</span>
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="color: var(--main-color); font-weight: bold; min-width: 130px;">Getränke</span>
                    <span>Bier, Radler (Natur, Flieger, Normal), Wasser, Softdrinks (Cola, Fanta, Sprite)</span>
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="color: var(--main-color); font-weight: bold; min-width: 130px;">Gebühr</span>
                    <span>30 € pro Teilnehmer (60 € pro Team) – Hotdogs &amp; Getränke inklusive</span>
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="color: var(--main-color); font-weight: bold; min-width: 130px;">WhatsApp</span>
                    <a href="https://chat.whatsapp.com/H8FRTm2xQs60fpqLinVd6s" target="_blank" style="color: var(--secondary-color); word-break: break-all;">Gruppe beitreten</a>
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="color: var(--main-color); font-weight: bold; min-width: 130px;">Instagram</span>
                    <a href="https://instagram.com/bipoopen/" target="_blank" style="color: var(--secondary-color);">@bipoopen</a>
                </div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="color: var(--main-color); font-weight: bold; min-width: 130px;">Regeln</span>
                    <router-link to="/Regeln" style="color: var(--secondary-color);">BiPoOpen.de/Regeln</router-link>
                </div>
            </div>

            <div style="margin-top: 24px; background: var(--bp-primary-faint); border-left: 4px solid var(--main-color); border-radius: 4px; padding: 14px 16px;">
                <p style="font-weight: bold; margin-bottom: 6px;">⚠️ Wichtig</p>
                <p style="margin: 0; line-height: 1.6;">
                    Pünktliches Erscheinen um 14:00 Uhr, sonst droht Disqualifikation.
                    Die Anmeldung garantiert keinen Startplatz.
                    Die teilnehmenden Teams werden Anfang Juli bekannt gegeben.
                    Die Anmeldung ist bis zum 01.07.2026 offen!
                </p>
            </div>
        </div>

        <!-- Formular -->
        <div style="background: var(--bp-surface); border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); padding: 32px; width: 100%; max-width: 700px;">
            <h2 style="font-size: 22px; font-weight: bold; margin-bottom: 24px; color: var(--main-color);">Team anmelden</h2>

            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-weight: bold; font-size: 14px;">Teamname *</label>
                    <InputText v-model="teamName" placeholder="Euer Teamname" style="width: 100%;" :invalid="submitted && !teamName.trim()" />
                    <small v-if="submitted && !teamName.trim()" style="color: var(--main-color);">Bitte einen Teamnamen eingeben.</small>
                </div>

                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-weight: bold; font-size: 14px;">Vor- und Nachname Spieler 1 *</label>
                    <InputText v-model="player1" placeholder="z. B. Max Mustermann" style="width: 100%;" :invalid="submitted && !player1.trim()" />
                    <small v-if="submitted && !player1.trim()" style="color: var(--main-color);">Bitte Namen von Spieler 1 eingeben.</small>
                </div>

                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-weight: bold; font-size: 14px;">Vor- und Nachname Spieler 2 *</label>
                    <InputText v-model="player2" placeholder="z. B. Erika Musterfrau" style="width: 100%;" :invalid="submitted && !player2.trim()" />
                    <small v-if="submitted && !player2.trim()" style="color: var(--main-color);">Bitte Namen von Spieler 2 eingeben.</small>
                </div>

                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-weight: bold; font-size: 14px;">Teamlogo (optional)</label>
                    <p style="font-size: 13px; color: var(--bp-text-secondary); margin: 0 0 8px;">Logo als freigestelltes PNG hochladen. Es sollte auch klein gut wirken (Tipp: einfach per ChatGPT generieren).</p>
                    <label
                        style="display: flex; align-items: center; gap: 12px; cursor: pointer; border: 1px solid var(--bp-border-strong); border-radius: 6px; padding: 10px 14px; width: fit-content; transition: border-color 0.2s;"
                        @mouseenter="(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--main-color)'"
                        @mouseleave="(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--bp-border-strong)'"
                    >
                        <span class="material-icons" style="color: var(--main-color); font-size: 20px;">upload</span>
                        <span style="font-size: 14px;">{{ logoFileName || 'Datei auswählen' }}</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp" style="display: none;" @change="onLogoChange" />
                    </label>
                    <div v-if="logoPreview" style="margin-top: 10px;">
                        <img :src="logoPreview" alt="Vorschau" style="max-width: 120px; max-height: 120px; border-radius: 8px; border: 1px solid var(--bp-border); object-fit: contain;" />
                        <button
                            @click="clearLogo"
                            style="display: block; margin-top: 6px; background: none; border: none; color: var(--main-color); cursor: pointer; font-size: 13px; padding: 0;"
                        >
                            Logo entfernen
                        </button>
                    </div>
                    <small v-if="logoError" style="color: var(--main-color);">{{ logoError }}</small>
                </div>

                <Button
                    label="Anmelden"
                    :loading="loading"
                    @click="submit"
                    style="background: var(--main-color); border: none; padding: 14px 32px; font-size: 16px; font-weight: bold; border-radius: 8px; width: 100%; cursor: pointer;"
                />
            </div>
        </div>

    </div>

    <ImageCropDialog
        v-model:visible="cropDialogVisible"
        :src="cropSrc"
        stencil="rectangle"
        :output-size="600"
        output-format="png"
        header="Logo zuschneiden"
        @cropped="onLogoCropped"
    />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import ImageCropDialog from '@/components/shared/ImageCropDialog.vue';

const toast = useToast();
const router = useRouter();

const teamName = ref('');
const player1 = ref('');
const player2 = ref('');
const logoBase64 = ref<string | undefined>(undefined);
const logoPreview = ref<string | undefined>(undefined);
const logoFileName = ref('');
const logoError = ref('');
const submitted = ref(false);
const loading = ref(false);
const cropDialogVisible = ref(false);
const cropSrc = ref('');

const onLogoChange = (event: Event) => {
    logoError.value = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        logoError.value = 'Die Datei ist zu groß. Bitte wähle eine Datei unter 2 MB.';
        input.value = '';
        return;
    }

    logoFileName.value = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        cropSrc.value = e.target?.result as string;
        cropDialogVisible.value = true;
    };
    reader.readAsDataURL(file);
    input.value = '';
};

const onLogoCropped = (dataUrl: string) => {
    logoBase64.value = dataUrl;
    logoPreview.value = dataUrl;
};

const clearLogo = () => {
    logoBase64.value = undefined;
    logoPreview.value = undefined;
    logoFileName.value = '';
    logoError.value = '';
    cropSrc.value = '';
};

const submit = async () => {
    submitted.value = true;

    if (!teamName.value.trim() || !player1.value.trim() || !player2.value.trim()) {
        return;
    }

    if (logoError.value) return;

    loading.value = true;
    try {
        await axios.post('/registrations/register', {
            teamName: teamName.value.trim(),
            player1: player1.value.trim(),
            player2: player2.value.trim(),
            teamLogo: logoBase64.value,
        });

        router.push('/2026/Teams');
    } catch (err: any) {
        const msg = err?.response?.data?.message;
        if (err?.response?.status === 409) {
            toast.add({ severity: 'warn', summary: 'Bereits angemeldet', detail: msg || 'Dieses Team ist bereits angemeldet.', life: 6000 });
        } else {
            toast.add({ severity: 'error', summary: 'Fehler', detail: msg || 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.', life: 6000 });
        }
    } finally {
        loading.value = false;
    }
};
</script>

<style scoped>
.Page {
    width: 90%;
    margin-top: 150px;
    min-height: calc(100vh - 300px);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 80px;
}

/* MOBILE */
@media (width <= 900px) {
    .Page {
        width: 95%;
        margin-top: 80px;
    }
}
</style>
