
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (req) => {
  try {
    const body = await req.json();
    const { epost, passord, navn, firma_id } = body;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: epost, password: passord, email_confirm: false
    });
    if (authError) throw authError;
    await supabase.from("hand_ansatt").insert({
      user_id: authUser.user.id, navn, epost, rolle: "admin", firma_id, aktiv: true
    });
    await supabase.auth.admin.generateLink({ type: "invite", email: epost });
    return new Response(JSON.stringify({success:true,user_id:authUser.user.id}));
  } catch(e){
    return new Response(JSON.stringify({error:String(e)}),{status:500});
  }
});
