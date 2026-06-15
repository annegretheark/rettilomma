import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { navn, epost, linknavn, passord } = await req.json();

    const url = Deno.env.get("APP_SUPABASE_URL");
    const key = Deno.env.get("APP_SERVICE_ROLE_KEY");

    if (!url) throw new Error("Mangler APP_SUPABASE_URL");
    if (!key) throw new Error("Mangler APP_SERVICE_ROLE_KEY");
    if (!navn) throw new Error("Mangler navn");
    if (!epost) throw new Error("Mangler epost");
    if (!linknavn) throw new Error("Mangler linknavn");
    if (!passord) throw new Error("Mangler passord");

    const supabase = createClient(url, key);

    const { data: userData, error: userError } =
      await supabase.auth.admin.createUser({
        email: epost,
        password: passord,
        email_confirm: true,
      });

    if (userError) throw userError;

    const authUserId = userData.user?.id;
    if (!authUserId) throw new Error("Auth-bruker ble ikke opprettet");

    const { error: firmaError } = await supabase
      .from("hov_firma")
      .insert([{
        navn,
        epost,
        linknavn,
        auth_user_id: authUserId,
        er_admin: true
      }]);

    if (firmaError) throw firmaError;

    return new Response(JSON.stringify({
      success: true,
      auth_user_id: authUserId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message || String(err)
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});