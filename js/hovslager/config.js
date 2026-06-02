const SUPABASE_URL =
  "https://pxlbrywowphkczkehmee.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_tluvA83iCcKfmgfXetvz5g_farKpCTS";

window.supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

console.log("Hovslager koblet til eget Supabase-prosjekt");