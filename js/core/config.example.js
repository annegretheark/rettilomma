window.SUPABASE_URL = "DIN_SUPABASE_URL_HER";
window.SUPABASE_ANON_KEY = "DIN_SUPABASE_ANON_KEY_HER";

window.supabaseClient = supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);