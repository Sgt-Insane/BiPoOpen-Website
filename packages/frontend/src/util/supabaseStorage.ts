import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Auch fuer Realtime (Mehrspieler-Knecht)
export const getSupabaseClient = () => supabase;

const TEAM_LOGO_BUCKET = "BiPo Open Bilder";

// Uploads a cropped logo (data URL) to Supabase Storage and returns the stored path.
export const uploadTeamLogo = async (dataUrl: string): Promise<string> => {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${crypto.randomUUID()}.png`;

    const { error } = await supabase.storage
        .from(TEAM_LOGO_BUCKET)
        .upload(path, blob, { contentType: "image/png", upsert: false });

    if (error)
        throw error;

    return path;
};

// Resolves a stored logo reference to a displayable URL.
// Already-resolved URLs / legacy data URLs are passed through unchanged.
export const resolveTeamLogo = (ref?: string): string | undefined => {
    if (!ref)
        return undefined;

    if (/^(https?:|data:)/.test(ref))
        return ref;

    return supabase.storage.from(TEAM_LOGO_BUCKET).getPublicUrl(ref).data.publicUrl;
};
