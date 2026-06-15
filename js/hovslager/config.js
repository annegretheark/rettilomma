// Robust Supabase config for Hovslager
const SUPABASE_URL = "https://pxlbrywowphkczkehmee.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tluvA83iCcKfmgfXetvz5g_farKpCTS";

(function startSupabase(){
  if (window.supabaseClient) return;
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Supabase bibliotek er ikke lastet før config.js");
    window.hovConfigFeil = "Supabase-biblioteket er ikke lastet.";
    return;
  }
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  });
  console.log("Hovslager koblet til Supabase");
})();
