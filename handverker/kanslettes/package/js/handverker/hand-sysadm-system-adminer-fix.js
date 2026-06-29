/* HAND SYSADM FIX 20260625
   Leser sysadm fra public.system_adminer.
   En aktiv rad med innlogget e-post gir sysadm i håndverkerappen.
*/
(function(){
  'use strict';
  if (window.__handSysadmSystemAdminerFix) return;
  window.__handSysadmSystemAdminerFix = true;

  function n(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function client(){ return window.supabaseClient || (window.supabase && window.supabase.from ? window.supabase : null); }
  function show(el){ if(!el) return; el.hidden=false; el.style.display=''; if(el.classList) el.classList.remove('hidden','skjult','modul-skjult'); if(el.removeAttribute) el.removeAttribute('aria-hidden'); }
  function hide(el){ if(!el) return; el.hidden=true; el.style.display='none'; if(el.classList) el.classList.add('hidden','skjult'); if(el.setAttribute) el.setAttribute('aria-hidden','true'); }

  async function hentEpost(){
    try{
      var c = client();
      if(c && c.auth && c.auth.getUser){
        var res = await c.auth.getUser();
        var e = n(res && res.data && res.data.user && res.data.user.email);
        if(e) return e;
      }
    }catch(e){}
    return n(window.innloggetEpost || window.innloggetBrukerEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('rettilommaSistEpost'));
  }

  async function erSysadmEpost(epost){
    var c = client();
    if(!c || !epost) return false;
    try{
      var res = await c.from('system_adminer')
        .select('id,epost,aktiv')
        .eq('epost', epost)
        .eq('aktiv', true)
        .maybeSingle();
      if(res && res.data) return true;
    }catch(e){}
    try{
      var res2 = await c.from('system_adminer')
        .select('id,epost,aktiv')
        .ilike('epost', epost)
        .eq('aktiv', true)
        .limit(1);
      return !!(res2 && Array.isArray(res2.data) && res2.data.length);
    }catch(e){ return false; }
  }

  function visSysadmUI(){
    window.erSystemadmin = true;
    window.erAdmin = true;
    window.innloggetRolle = 'sysadm';
    try{
      localStorage.setItem('handInnloggetRolle','sysadm');
      localStorage.setItem('innloggetRolle','sysadm');
      localStorage.setItem('rilAdminModus','ja');
      localStorage.setItem('rilSysadminModus','ja');
      localStorage.setItem('handSysadminModus','ja');
    }catch(e){}
    document.documentElement.classList.add('ril-auth-ready','ril-admin-ready','ril-sysadmin-ready');
    document.querySelectorAll('.systemadmin-only,.sysadmin-entry').forEach(show);
    ['sysadminModeKnapp','sysadminNyKundeKnapp','sysadminKundelisteKnapp','sysadminModulerKnapp','visModulerKnapp'].forEach(function(id){ show(document.getElementById(id)); });
    var rv = document.getElementById('innloggetRolleVisning');
    if(rv) rv.textContent = ' (rolle: sysadm, sysadm)';
  }

  async function reparer(){
    var epost = await hentEpost();
    if(epost){
      window.innloggetEpost = epost;
      try{ localStorage.setItem('handInnloggetEpost', epost); localStorage.setItem('innloggetEpost', epost); }catch(e){}
    }
    var ok = await erSysadmEpost(epost);
    if(ok) visSysadmUI();
    return ok;
  }

  window.handReparerSysadmFraSystemAdminer = reparer;
  document.addEventListener('DOMContentLoaded', function(){ reparer(); setTimeout(reparer,300); setTimeout(reparer,1200); setTimeout(reparer,2500); });
  window.addEventListener('load', function(){ reparer(); setTimeout(reparer,500); setTimeout(reparer,1800); setTimeout(reparer,3500); });
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) reparer(); });
  setTimeout(reparer,800); setTimeout(reparer,2000); setTimeout(reparer,4000);
})();
