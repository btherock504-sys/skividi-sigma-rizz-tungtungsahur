import { createClient } from "@supabase/supabase-js";

let browserClient;

export function getSupabaseSetupError() {
  return "Site setup is incomplete. Please contact the site administrator.";
}

export function getSupabase() {
  if (typeof window === "undefined") return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: { eventsPerSecond: 10 }
      }
    });
  }
  return browserClient;
}