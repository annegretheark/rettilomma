/* RIL FINAL SYSADM FIX 2026-06-25
   Kilde for sysadm: public.system_adminer(epost, aktiv=true).
   Spesial: greknuts@online.no behandles som sysadm for å unngå blink mens DB-sjekk kjører.
   Ingen redirect, ingen løkke som kan henge innlogging.
*/
(function(){
  'use strict';
  if (window.__handFinalSysadmSystemAdminer20260625) return;
  window.__handFinalSysadmSystemAdminer20260625 = true;

  function norm(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function isGreknuts(e){ return norm(e) === 'greknuts@online.no'; }
  function client(){ return window.supabaseClient || (window.supabase && window.supabase.from ? window.supabase : null); }
  function show(el){ if(!el) return; el.classList.remove('hidden','skjult','modul-skjult'); el.hidden=false; el.style.display=''; el.removeAttribute('aria-hidden'); }
  function hide(el){ if(!el) return; el.classList.add('hidden','skjult'); el.hidden=true; el.style.display='none'; el.setAttribute('aria-hidden','true'); }
  function storedEmail(){ return norm(window.innloggetEpost || window.innloggetBrukerEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('rettilommaSistEpost') || localStorage.getItem('epost')); }
  async function authEmail(){
    var c = client();
    try{ if(c && c.auth && c.auth.getUser){ var u = await c.auth.getUser(); var e = norm(u && u.data && u.data.user && u.data.user.email); if(e) return e; } }catch(e){}
    try{ if(c && c.auth && c.auth.getSession){ var r = await c.auth.getSession(); var e2 = norm(r && r.data && r.data.session && r.data.session.user && r.data.session.user.email); if(e2) return e2; } }catch(e){}
    return "";
  }
  async function isSystemAdminer(email){
    email = norm(email);
    if(!email) return false;
    if(isGreknuts(email)) return true;
    var c = client();
    if(!c) return false;
    try{
      var r = await c.from('system_adminer').select('id').ilike('epost', email).eq('aktiv', true).limit(1);
      if(!r.error && Array.isArray(r.data) && r.data.length) return true;
    }catch(e){}
    return false;
  }
  function applySysadm(email){
    email = norm(email);
    if(email){
      window.innloggetEpost = email;
      window.innloggetBrukerEpost = email;
      try{ localStorage.setItem('handInnloggetEpost', email); localStorage.setItem('innloggetEpost', email); localStorage.setItem('rettilommaSistEpost', email); }catch(e){}
    }
    window.erSystemadmin = true;
    window.erAdmin = true;
    window.innloggetRolle = 'sysadm';
    window.handInnloggetRolle = 'sysadm';
    try{
      localStorage.setItem('handInnloggetRolle','sysadm');
      localStorage.setItem('innloggetRolle','sysadm');
      localStorage.setItem('rilAdminModus','ja');
      localStorage.setItem('handAdminModus','ja');
      localStorage.setItem('rilSysadminModus','ja');
      localStorage.setItem('sysadminModus','ja');
      localStorage.setItem('handSysadminModus','ja');
    }catch(e){}
    document.documentElement.classList.add('ril-auth-ready','ril-admin-ready','ril-sysadm-ready');
    document.querySelectorAll('.admin-only,.systemadmin-only,.sysadmin-entry').forEach(show);
    ['sysadminModeKnapp','sysadminNyKundeKnapp','sysadminKundelisteKnapp','sysadminModulerKnapp','visModulerKnapp','adminMenyGruppe'].forEach(function(id){ show(document.getElementById(id)); });
    var rv=document.getElementById('innloggetRolleVisning');
    if(rv) rv.textContent = ' (rolle: sysadm, sysadm)';
    var bv=document.getElementById('innloggetBrukerVisning');
    if(bv && email) bv.textContent = email;
  }
  function applyNotSysadm(){
    var role = norm(window.innloggetRolle || localStorage.getItem('handInnloggetRolle') || localStorage.getItem('innloggetRolle'));
    if(role === 'sysadm' || role === 'sysadmin' || role === 'systemadmin') return;
    document.querySelectorAll('.systemadmin-only,.sysadmin-entry').forEach(hide);
  }
  async function refresh(){
    var e = await authEmail();
    if(await isSystemAdminer(e)) applySysadm(e); else applyNotSysadm();
  }

  // Ikke bruk lagret e-post til sysadm etter logout. Sysadm settes bare fra aktiv Auth-session.

  window.handFinalSysadmRefresh = refresh;
  document.addEventListener('DOMContentLoaded', function(){ refresh(); setTimeout(refresh, 250); setTimeout(refresh, 900); setTimeout(refresh, 2500); setTimeout(refresh, 5200); });
  window.addEventListener('load', function(){ refresh(); setTimeout(refresh, 400); setTimeout(refresh, 1500); setTimeout(refresh, 3500); setTimeout(refresh, 7000); });
  document.addEventListener('handPartialerLastet', function(){ setTimeout(refresh,0); setTimeout(refresh,500); });
  document.addEventListener('click', function(e){
    var t=e.target && e.target.closest && e.target.closest('#sysadminModeKnapp,#sysadminNyKundeKnapp,#sysadminKundelisteKnapp,#sysadminModulerKnapp,#visModulerKnapp');
    if(t && window.erSystemadmin !== true){ refresh(); }
  }, true);
})();
