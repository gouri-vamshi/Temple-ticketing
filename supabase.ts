import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url || "https://example.supabase.co", key || "missing-key");
export const configured = Boolean(url && key && !url.includes("YOUR-PROJECT") && !key.includes("YOUR_SUPABASE"));
