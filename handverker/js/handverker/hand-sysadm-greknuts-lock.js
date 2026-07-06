/* Rett i Lomma - SysAdm TABLE ONLY guard 20260706
   Viktig regel:
   - SysAdm gis KUN til brukere som finnes i egen SysAdm-tabell.
   - Vanlige firma-admins i hand_firma_bruker får admin, ikke sysadm.
   - Ingen hardkodet e-postadresse gir sysadm.
*/
(function(){
  'use strict';
  if (window.__HAND_SYSADM_TABLE_ONLY_GUARD__) return;
  window.__HAND_SYSADM_TABLE_ONLY_GUARD__ = true;

  var SYS_TABLES = ['hand_sysadmin', 'handsysadmin', 'hand_sysadm'];
  var FIRMA_TABLE = 'hand_firma_bruker';
  var SYS_ROLES = ['sysadm','sysadmin','systemadmin'];
  var ADMIN_ROLES = ['admin','administrator','eier','owner','firmaeier','bedrift_admin'];

  function n(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function s(v){ return String(v == null ? '' : v).trim(); }
  function c(){ return window.supabaseClient || (window.supabase && window.supabase.from ? window.supabase : null); }
  function isSysRole(r){ return SYS_ROLES.indexOf(n(r)) !== -1; }
  function isAdminRole(r){ return ADMIN_ROLES.indexOf(n(r)) !== -1; }
  function show(el){ if(!el) return; el.hidden=false; el.classList.remove('skjult','hidden','modul-skjult'); el.style.removeProperty('display'); el.style.visibility='visible'; el.removeAttribute('aria-hidden'); }
  function hide(el){ if(!el) return; el.hidden=true; el.classList.add('skjult','hidden'); el.style.setProperty('display','none','important'); el.style.visibility='hidden'; el.setAttribute('aria-hidden','true'); }
  function $(id){ return document.getElementById(id); }

  async function authUser(){
    var cl=c();
    try{ var r=await cl?.auth?.getUser?.(); if(r?.data?.user) return r.data.user; }catch(e){}
    try{ var r2=await cl?.auth?.getSession?.(); if(r2?.data?.session?.user) return r2.data.session.user; }catch(e){}
    return null;
  }
  async function authEmail(){
    var u=await authUser();
    var e=n(u && u.email);
    if(e) return e;
    return n(window.innloggetEpost || window.handInnloggetEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('rettilommaSistEpost') || localStorage.getItem('epost'));
  }

  async function findSysadminRow(email){
    email=n(email || await authEmail());
    if(!email || !c()) return null;
    for (var i=0;i<SYS_TABLES.length;i++){
      var table=SYS_TABLES[i];
      try{
        var r=await c().from(table).select('*').ilike('epost', email).limit(1);
        if(!r.error && Array.isArray(r.data) && r.data.length){
          var row=r.data[0] || {};
          if(row.aktiv === false || row.active === false || row.deaktivert === true) return null;
          row.__hand_sysadm_table = table;
          return row;
        }
      }catch(e){}
      try{
        var r2=await c().from(table).select('*').ilike('email', email).limit(1);
        if(!r2.error && Array.isArray(r2.data) && r2.data.length){
          var row2=r2.data[0] || {};
          if(row2.aktiv === false || row2.active === false || row2.deaktivert === true) return null;
          row2.__hand_sysadm_table = table;
          return row2;
        }
      }catch(e){}
    }
    return null;
  }

  async function firmaRole(email){
    email=n(email || await authEmail());
    var u=await authUser();
    var uid=s(u && u.id);
    var row=null;
    if(c()){
      try{
        if(uid){ var r=await c().from(FIRMA_TABLE).select('*').eq('user_id', uid).limit(1); if(!r.error && r.data && r.data[0]) row=r.data[0]; }
      }catch(e){}
      try{
        if(!row && email){ var r2=await c().from(FIRMA_TABLE).select('*').ilike('epost', email).limit(1); if(!r2.error && r2.data && r2.data[0]) row=r2.data[0]; }
      }catch(e){}
    }
    var role=n(row && row.rolle);
    // Sys-ord i hand_firma_bruker skal ikke gi global SysAdm. De nedgraderes til admin.
    if(isSysRole(role)) role='admin';
    if(!role) role='bruker';
    return { row:row, rolle:role, admin:isAdminRole(role), firma_id:s(row && row.firma_id) };
  }

  function setStorage(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function removeStorage(k){ try{ localStorage.removeItem(k); }catch(e){} }

  function applyState(email, sys, fr){
    email=n(email || '');
    fr=fr || {rolle:'bruker', admin:false, firma_id:''};
    var role=sys ? 'sysadm' : (fr.rolle || (fr.admin ? 'admin':'bruker'));
    var admin=sys || !!fr.admin || isAdminRole(role);
    if(email){
      window.innloggetEpost=email; window.handInnloggetEpost=email;
      setStorage('handInnloggetEpost',email); setStorage('innloggetEpost',email); setStorage('rettilommaSistEpost',email);
    }
    if(fr.firma_id){
      window.aktivFirmaId=fr.firma_id; window.handFirmaId=fr.firma_id;
      setStorage('aktivFirmaId',fr.firma_id); setStorage('handFirmaId',fr.firma_id); setStorage('firmaId',fr.firma_id); setStorage('firma_id',fr.firma_id);
    }
    window.innloggetRolle=role; window.handInnloggetRolle=role; window.HAND_ROLE=role;
    window.erSystemadmin=!!sys; window.handErGlobalSysadm=!!sys; window.erAdmin=!!admin;
    setStorage('handInnloggetRolle',role); setStorage('innloggetRolle',role); setStorage('rilAdminModus',admin?'ja':'nei');
    if(sys){ setStorage('rilSysadminModus','ja'); setStorage('rilSysadminRettighet','ja'); }
    else { removeStorage('rilSysadminModus'); removeStorage('rilSysadminRettighet'); removeStorage('sysadminModus'); removeStorage('handSysadminModus'); }

    var de=document.documentElement;
    de.classList.add('ril-auth-ready','ril-role-ready');
    de.classList.toggle('ril-admin-ready',!!admin);
    de.classList.toggle('ril-sysadm-ready',!!sys);
    de.classList.toggle('ril-verified-sysadm',!!sys);
    de.classList.toggle('hand-is-sysadm',!!sys);
    de.classList.toggle('ril-ikke-sysadm',!sys);
    if(document.body){ document.body.classList.toggle('ril-er-admin',!!admin); document.body.classList.toggle('ril-er-sysadm',!!sys); document.body.classList.toggle('ril-vanlig-bruker',!admin); }

    document.querySelectorAll('.sysadmin-entry,.systemadmin-only').forEach(function(el){
      var isSide=el.tagName==='SECTION' || /Side$|Panel$/.test(el.id||'');
      if(sys && !isSide) show(el); else if(!sys) hide(el);
    });
    ['sysadminModeKnapp','sysadminNyKundeKnapp','sysadminKundelisteKnapp','sysadminModulerKnapp','visModulerKnapp','velgModulKnapp','sysadmKnapp','sysadminKnapp'].forEach(function(id){
      var el=$(id); if(!el) return; if(sys) show(el); else hide(el);
    });
    if(!sys){ ['sysadminPanelSide','modulerSide'].forEach(function(id){ hide($(id)); }); }

    var rv=$('innloggetRolleVisning'); if(rv) rv.textContent=' (rolle: '+role+')';
    var bv=$('innloggetBrukerVisning'); if(bv && email) bv.textContent=email;
    return { email:email, rolle:role, admin:admin, sysadm:sys, firma_id:fr.firma_id || '' };
  }

  async function refresh(email){
    email=n(email || await authEmail());
    var sys=!!(await findSysadminRow(email));
    var fr=await firmaRole(email);
    return applyState(email, sys, fr);
  }

  window.handErGlobalSysadmFraTabell = async function(email){ return !!(await findSysadminRow(email)); };
  window.handRefreshSysadmRolle = refresh;
  window.handOppdaterSysadmUI = function(){ refresh(); };
  window.handSysadmKunFraTabell = refresh;
  window.handLockGreknutsSysadm = function(){ return false; };
  window.handRefreshGreknutsSysadm = refresh;

  document.addEventListener('DOMContentLoaded', function(){ refresh(); setTimeout(refresh,200); setTimeout(refresh,900); });
  document.addEventListener('handPartialerLastet', function(){ refresh(); setTimeout(refresh,150); });
  window.addEventListener('load', function(){ refresh(); setTimeout(refresh,400); setTimeout(refresh,1200); });
  setInterval(refresh, 2500);
})();
