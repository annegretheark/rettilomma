/* Håndverker stabil 2.0 - rolle og meny
   Single source of truth for rollevisning. Ingen hardkodede e-poster.
   Sysadm gis kun av Auth metadata, hand_sysadm eller database-rolle.
*/
(function(){
  'use strict';
  if(window.__HAND_STABLE20_ROLE__) return;
  window.__HAND_STABLE20_ROLE__ = true;

  var SYS_ROLES = ['sysadm','sysadmin','systemadmin'];
  var ADMIN_ROLES = ['admin','administrator','eier','owner','firmaeier','firma-eier','hovedbruker'].concat(SYS_ROLES);
  var SIDE_IDS = ['adminKonsollSide','timerSide','jobberSide','fravaerSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','kundeSide','kunderSide','ansattSide','ansatteSide','firmaSide','testSide','testpanelSide','lonnPanel','lonnSide','bilBestillingerSide','adminBilBestillinger','adminBilBestillingerPanel','modulerSide','sysadminPanelSide','adminSide'];
  var state = { ready:false, email:'', rolle:'bruker', admin:false, sys:false };

  function n(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function roleFrom(v){ v=n(v); return SYS_ROLES.indexOf(v)>=0 ? 'sysadm' : (ADMIN_ROLES.indexOf(v)>=0 ? v : (v || 'bruker')); }
  function isSys(r){ return SYS_ROLES.indexOf(n(r)) >= 0; }
  function isAdmin(r){ return ADMIN_ROLES.indexOf(n(r)) >= 0 || isSys(r); }
  function $(id){ return document.getElementById(id); }
  function client(){ return window.supabaseClient || (window.supabase && window.supabase.from ? window.supabase : null); }
  function show(el){ if(!el) return; el.hidden=false; el.classList && el.classList.remove('hidden','skjult','modul-skjult'); el.style && el.style.removeProperty('display'); el.style && el.style.removeProperty('visibility'); el.removeAttribute && el.removeAttribute('aria-hidden'); }
  function hide(el){ if(!el) return; el.hidden=true; el.classList && el.classList.add('hidden','skjult'); if(el.style) el.style.setProperty('display','none','important'); el.setAttribute && el.setAttribute('aria-hidden','true'); }
  function storageEmail(){ try{return n(localStorage.getItem('handInnloggetEpost')||localStorage.getItem('innloggetEpost')||localStorage.getItem('rettilommaSistEpost')||localStorage.getItem('epost'));}catch(e){return '';} }
  async function authUser(){ var c=client(); try{ if(c&&c.auth&&c.auth.getUser){ var r=await c.auth.getUser(); if(r&&r.data&&r.data.user) return r.data.user; } }catch(e){} try{ if(c&&c.auth&&c.auth.getSession){ var s=await c.auth.getSession(); return s&&s.data&&s.data.session&&s.data.session.user || null; } }catch(e){} return null; }
  function metaRole(u){ var m=(u&&(u.user_metadata||u.raw_user_meta_data||u.app_metadata))||{}; return roleFrom(m.rolle||m.role||m.user_role||''); }
  async function q(table, col, val){ var c=client(); if(!c||!val) return []; try{ var r=await c.from(table).select('*').ilike(col, val).limit(20); if(!r.error&&Array.isArray(r.data)) return r.data; }catch(e){} return []; }
  function rowRole(row){ return roleFrom(row && (row.rolle||row.role||row.brukerrolle||row.type||row.tilgang)); }
  async function dbRole(email, uid){
    var roles=[];
    var c=client();
    if(!c) return '';
    try{ var sr=await c.from('hand_sysadm').select('id').ilike('epost',email).eq('aktiv',true).limit(1); if(!sr.error&&sr.data&&sr.data.length) roles.push('sysadm'); }catch(e){}
    var look=[]; if(email) look.push(['epost',email],['email',email],['bruker_epost',email],['user_email',email]);
    for(var t of ['hand_ansatt','firma_brukere','hand_firma_bruker']){
      if(uid){ try{ var ur=await c.from(t).select('*').eq('user_id',uid).limit(20); if(!ur.error&&ur.data) ur.data.forEach(function(r){roles.push(rowRole(r));}); }catch(e){} }
      for(var p of look){ try{ var rows=await q(t,p[0],p[1]); rows.forEach(function(r){roles.push(rowRole(r));}); }catch(e){} }
    }
    if(roles.some(isSys)) return 'sysadm';
    if(roles.some(function(r){return ['admin','administrator','eier','owner','firmaeier','firma-eier','hovedbruker'].indexOf(n(r))>=0;})) return 'admin';
    return roles.filter(Boolean)[0] || '';
  }
  function persist(){
    window.innloggetRolle = state.rolle; window.handInnloggetRolle = state.rolle;
    window.erAdmin = !!state.admin; window.erSystemadmin = !!state.sys;
    try{
      localStorage.setItem('handInnloggetRolle', state.rolle);
      localStorage.setItem('innloggetRolle', state.rolle);
      localStorage.setItem('rilAdminModus', state.admin ? 'ja' : 'nei');
      if(state.sys) localStorage.setItem('rilSysadminModus','ja'); else localStorage.removeItem('rilSysadminModus');
      localStorage.removeItem('sysadminModus'); localStorage.removeItem('handSysadminModus');
    }catch(e){}
  }
  function applyVisibility(){
    persist();
    document.documentElement.classList.add('ril-role-ready','hand-role-ready','ril-auth-ready');
    document.documentElement.classList.remove('hand-role-locking');
    document.documentElement.classList.toggle('ril-admin-ready', state.admin);
    document.documentElement.classList.toggle('ril-sysadm-ready', state.sys);
    document.documentElement.classList.toggle('hand-is-sysadm', state.sys);
    document.querySelectorAll('.admin-only').forEach(function(el){ if(SIDE_IDS.indexOf(el.id)>=0) return; state.admin ? show(el) : hide(el); });
    document.querySelectorAll('.systemadmin-only,.sysadmin-entry').forEach(function(el){ if(SIDE_IDS.indexOf(el.id)>=0) return; state.sys ? show(el) : hide(el); });
    ['adminMenyGruppe','adminMenyKnapp','visAdminKonsollKnapp','visTimerAdminKnapp','visKundeKnapp','visTilbudKnapp','visFakturaKnapp','visAdminVarerKnapp','visAdminBilerKnapp','visBilBestillingerKnapp','visLonnKnapp','visAnsattKnapp','visFirmaKnapp','visBackupKnapp','visTestKnapp'].forEach(function(id){ var el=$(id); if(el) state.admin ? show(el) : hide(el); });
    ['sysadminModeKnapp','sysadminNyKundeKnapp','sysadminKundelisteKnapp','sysadminModulerKnapp','visModulerKnapp','velgModulKnapp'].forEach(function(id){ var el=$(id); if(el) state.sys ? show(el) : hide(el); });
    if(!state.admin){ hide($('adminMenyPanel')); }
    if(!state.sys){ hide($('sysadminPanelSide')); hide($('modulerSide')); }
    var rv=$('innloggetRolleVisning'); if(rv) rv.textContent = state.rolle && state.rolle !== 'bruker' ? ' ('+state.rolle+')' : '';
    var bv=$('innloggetBrukerVisning'); if(bv && state.email) bv.textContent = state.email;
  }
  async function refresh(){
    var u=await authUser(); state.email=n((u&&u.email)||window.innloggetEpost||storageEmail());
    if(state.email){ window.innloggetEpost=state.email; window.innloggetBrukerEpost=state.email; try{localStorage.setItem('handInnloggetEpost',state.email);localStorage.setItem('innloggetEpost',state.email);localStorage.setItem('rettilommaSistEpost',state.email);}catch(e){} }
    var mr=metaRole(u); var dr=await dbRole(state.email, u&&u.id); var role=isSys(mr)?'sysadm':(dr||mr||'bruker');
    state.rolle=roleFrom(role); state.sys=isSys(state.rolle); state.admin=isAdmin(state.rolle); state.ready=true; applyVisibility(); return state;
  }
  document.documentElement.classList.add('hand-role-locking');
  document.addEventListener('click', function(e){
    var b=e.target&&e.target.closest&&e.target.closest('#adminMenyGruppe,#adminMenyKnapp,#adminMenyPanel button,#sysadminModeKnapp,#sysadminNyKundeKnapp,#sysadminKundelisteKnapp,#sysadminModulerKnapp,#visModulerKnapp,#velgModulKnapp');
    if(!b) return; var sysTarget=b.matches&&b.matches('#sysadminModeKnapp,#sysadminNyKundeKnapp,#sysadminKundelisteKnapp,#sysadminModulerKnapp,#visModulerKnapp,#velgModulKnapp');
    if((sysTarget&&!state.sys)||(!sysTarget&&!state.admin)){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation(); refresh(); return false; }
  }, true);
  window.handStable20RefreshRole=refresh;
  window.handErSysadm=function(){return !!state.sys;}; window.handErAdmin=function(){return !!state.admin;};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', refresh, {once:true}); else refresh();
  document.addEventListener('handPartialerLastet', function(){ refresh(); }, {once:true});
  window.addEventListener('load', function(){ refresh(); setTimeout(refresh,500); });
})();
