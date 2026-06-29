/* Handverker - streng rolle-vakt v31
   Database-rollen i hand_ansatt bestemmer. Gammel localStorage/window sysadm ignoreres.
   Vanlig firma-admin skal aldri få Sysadm. */
(function(){
  'use strict';
  window.__handRoleGuardStrict = 'v32-admin-hide';

  var state = { loaded:false, verified:false, email:'', role:'', isSys:false, isAdmin:false };
  function norm(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function byId(id){ return document.getElementById(id); }
  function hide(el){ if(!el) return; el.classList.add('hidden','skjult'); el.hidden = true; el.style.display = 'none'; el.setAttribute('aria-hidden','true'); }
  function show(el){ if(!el) return; el.classList.remove('hidden','skjult','modul-skjult'); el.hidden = false; el.style.display = ''; el.removeAttribute('aria-hidden'); }
  function client(){ return window.supabaseClient || (window.supabase && window.supabase.from ? window.supabase : null); }
  function isSysRole(r){ r = norm(r); return r === 'sysadm' || r === 'sysadmin' || r === 'systemadmin'; }
  function isAdminRole(r){ r = norm(r); return r === 'admin' || r === 'administrator' || isSysRole(r); }

  function clearSysFlags(){
    try{ localStorage.removeItem('rilSysadminModus'); }catch(e){}
    try{ localStorage.removeItem('sysadminModus'); }catch(e){}
    try{ localStorage.removeItem('handSysadminModus'); }catch(e){}
  }

  async function getEmail(){
    var c = client();
    try{
      if(c && c.auth && typeof c.auth.getUser === 'function'){
        var u = await c.auth.getUser();
        var e = norm(u && u.data && u.data.user && u.data.user.email);
        if(e) return e;
      }
    }catch(e){}
    try{
      if(c && c.auth && typeof c.auth.getSession === 'function'){
        var s = await c.auth.getSession();
        var e2 = norm(s && s.data && s.data.session && s.data.session.user && s.data.session.user.email);
        if(e2) return e2;
      }
    }catch(e){}
    return norm(window.innloggetEpost || window.innloggetBrukerEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost'));
  }

  async function fetchDbRole(email){
    var c = client();
    if(!c || !email) return '';
    var res = await c.from('hand_ansatt').select('rolle,epost,firma_id,navn').eq('epost', email);
    if(res && res.error){ throw res.error; }
    var rows = (res && Array.isArray(res.data)) ? res.data : [];
    if(!rows.length) return '';
    var roles = rows.map(function(r){ return norm(r && r.rolle); }).filter(Boolean);
    // Systemrolle gis bare hvis den faktisk finnes i DB for denne e-posten.
    if(roles.some(isSysRole)) return roles.find(isSysRole);
    if(roles.indexOf('admin') >= 0) return 'admin';
    if(roles.indexOf('administrator') >= 0) return 'administrator';
    return roles[0] || '';
  }

  function writeGlobals(){
    window.innloggetRolle = state.role || '';
    try{ localStorage.setItem('handInnloggetRolle', state.role || ''); }catch(e){}
    try{ localStorage.setItem('innloggetRolle', state.role || ''); }catch(e){}
    window.erSystemadmin = !!state.isSys;
    window.erAdmin = !!state.isAdmin;
    if(!state.isSys) clearSysFlags();
    if(state.isAdmin){ try{ localStorage.setItem('rilAdminModus','ja'); }catch(e){} }
  }

  function updateText(){
    var v = byId('innloggetBrukerVisning');
    var rv = byId('innloggetRolleVisning');
    if(v && state.email) v.textContent = state.email;
    if(rv){
      var parts = [];
      if(state.role) parts.push('rolle: ' + state.role);
      if(state.isSys) parts.push('sysadm');
      else if(state.isAdmin) parts.push('adminmodus');
      rv.textContent = parts.length ? ' (' + parts.join(', ') + ')' : '';
    }
  }

  function applyVisibility(){
    writeGlobals();

    // Vanlig ansatt skal IKKE se Admin-meny eller admin-funksjoner.
    // Database-rollen i hand_ansatt bestemmer: admin/administrator/sysadm => admin, alt annet => vanlig bruker.
    document.querySelectorAll('.admin-only').forEach(function(el){
      if (el && el.id && ['timerSide','jobberSide','fravaerSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','kundeSide','kunderSide','ansattSide','firmaSide','testSide','lonnPanel','lonnSide','bilBestillingerSide','adminBilBestillinger','adminBilBestillingerPanel','modulerSide','sysadminPanelSide','adminSide','adminKonsollSide'].indexOf(el.id) !== -1) return;
      state.isAdmin ? show(el) : hide(el);
    });
    ['adminMenyGruppe','adminMenyKnapp','visAdminKonsollKnapp','visTimerAdminKnapp','visKundeKnapp','visTilbudKnapp','visFakturaKnapp','visAdminVarerKnapp','visAdminBilerKnapp','visBilBestillingerKnapp','visLonnKnapp','visAnsattKnapp','visFirmaKnapp','visBackupKnapp','visTestKnapp'].forEach(function(id){
      var el = byId(id);
      if(el) state.isAdmin ? show(el) : hide(el);
    });
    var adminPanel = byId('adminMenyPanel');
    if(adminPanel){
      if(!state.isAdmin) { hide(adminPanel); }
      else if(!adminPanel.classList.contains('apen') && !adminPanel.classList.contains('open') && adminPanel.getAttribute('aria-hidden') !== 'false'){
        adminPanel.hidden = true;
        adminPanel.style.display = 'none';
        adminPanel.style.visibility = 'hidden';
        adminPanel.setAttribute('aria-hidden','true');
      }
    }
    if(!state.isAdmin){
      var p = byId('adminMenyPanel');
      if(p){ p.style.display = 'none'; p.classList.remove('open'); }
      var b = byId('adminMenyKnapp');
      if(b) b.setAttribute('aria-expanded','false');
      // Rydd bort gammel lagret adminmodus for vanlig ansatt.
      try{ localStorage.setItem('rilAdminModus','nei'); }catch(e){}
    }

    document.querySelectorAll('.systemadmin-only, .sysadmin-entry').forEach(function(el){
      if (el && el.id && ['timerSide','jobberSide','fravaerSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','kundeSide','kunderside','ansattSide','firmaSide','testSide','lonnPanel','lonnSide','bilBestillingerSide','adminBilBestillinger','adminBilBestillingerPanel','modulerSide','sysadminPanelSide','adminSide','adminKonsollSide'].indexOf(el.id) !== -1) return;
      state.isSys ? show(el) : hide(el);
    });
    ['sysadminModeKnapp','sysadminNyKundeKnapp','sysadminKundelisteKnapp','sysadminModulerKnapp','visModulerKnapp'].forEach(function(id){
      var el = byId(id); if(el) state.isSys ? show(el) : hide(el);
    });
    var panel = byId('sysadminPanelSide');
    if(!state.isSys && panel){ hide(panel); }
    updateText();
  }

  async function refresh(){
    state.email = await getEmail();
    var dbRole = '';
    try{ dbRole = await fetchDbRole(state.email); state.verified = !!dbRole; }catch(e){ state.verified = false; }
    // Viktig: ikke bruk gammel localStorage sysadm som fallback. Uverifisert = ikke sysadm.
    state.role = dbRole || norm(window.innloggetRolle || localStorage.getItem('handInnloggetRolle') || localStorage.getItem('innloggetRolle'));
    if(!dbRole && isSysRole(state.role)) state.role = '';
    state.isSys = isSysRole(state.role);
    state.isAdmin = isAdminRole(state.role);
    state.loaded = true;
    applyVisibility();
    return state;
  }

  var oldPanel = window.handVisSysadminPanel;
  window.handVisSysadminPanel = async function(){
    await refresh();
    if(!state.isSys){ applyVisibility(); return false; }
    return typeof oldPanel === 'function' ? oldPanel.apply(this, arguments) : undefined;
  };

  var oldSet = window.settInnloggetBrukerVisning;
  window.settInnloggetBrukerVisning = function(){
    if(typeof oldSet === 'function') { try{ oldSet.apply(this, arguments); }catch(e){} }
    refresh();
  };

  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('#adminMenyGruppe,#adminMenyKnapp,#adminMenyPanel button,#visAdminKonsollKnapp,#visTimerAdminKnapp,#sysadminModeKnapp,#sysadminNyKundeKnapp,#sysadminKundelisteKnapp,#sysadminModulerKnapp,#visModulerKnapp');
    if(!t) return;
    var isSysTarget = t.matches && t.matches('#sysadminModeKnapp,#sysadminNyKundeKnapp,#sysadminKundelisteKnapp,#sysadminModulerKnapp,#visModulerKnapp');
    if((isSysTarget && !state.isSys) || (!isSysTarget && !state.isAdmin)){
      e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      refresh(); return false;
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ applyVisibility(); refresh(); setTimeout(refresh,300); setTimeout(refresh,1200); });
  window.addEventListener('load', function(){ applyVisibility(); refresh(); setTimeout(refresh,500); setTimeout(refresh,1500); setTimeout(refresh,3000); });
  setInterval(function(){ refresh(); }, 1200);
  window.handRefreshStrictRole = refresh;
})();
