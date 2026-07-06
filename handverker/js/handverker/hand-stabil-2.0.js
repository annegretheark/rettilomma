/* Håndverker stabil 2.1
   Ett sted for rollevisning, admin/sysadm-knapper og kompakt/mobilvennlig UI.
   Systembruker greknuts@online.no skal alltid ha sysadm-tilgang i appen. */
(function(){
  'use strict';

  function rilKeepTopMenuOnly(){
    try{
      var active=document.querySelector('.ril-active-side');
      if(!active){ document.documentElement.classList.add('ril-topmenu-only'); document.documentElement.classList.remove('ril-side-selected'); }
      var p=document.getElementById('adminMenyPanel');
      if(p && !p.classList.contains('apen') && !p.classList.contains('open')){
        p.hidden=true; p.style.setProperty('display','none','important'); p.style.setProperty('visibility','hidden','important'); p.style.setProperty('pointer-events','none','important'); p.setAttribute('aria-hidden','true');
      }
    }catch(e){}
  }
  if (window.__HAND_STABIL_20__) return;
  window.__HAND_STABIL_20__ = true;

  var SYSADMIN_FALLBACK_EMAILS = [];
  var ADMIN_FALLBACK_EMAILS = [];
  var SIDE_IDS = [
    'timerSide','jobberSide','fravaerSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide',
    'kundeSide','kunderSide','ansattSide','ansatteSide','firmaSide','testSide','testpanelSide','lonnPanel',
    'lonnSide','bilBestillingerSide','adminBilBestillinger','adminBilBestillingerPanel','modulerSide',
    'sysadminPanelSide','adminSide','adminKonsollSide'
  ];
  var ADMIN_IDS = [
    'adminMenyGruppe','adminMenyKnapp','visKundeKnapp','visTilbudKnapp','visFakturaKnapp',
    'visAdminVarerKnapp','varerKnapp','visAdminBilerKnapp','visBilBestillingerKnapp','visLonnKnapp',
    'visAnsattKnapp','visFirmaKnapp','visBackupKnapp','visTestKnapp'
  ];
  var SYS_IDS = ['sysadminModeKnapp','sysadminNyKundeKnapp','sysadminKundelisteKnapp','sysadminModulerKnapp','visModulerKnapp','velgModulKnapp'];
  var state = { email:'', role:'bruker', isAdmin:false, isSys:false, ready:false };

  function n(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function id(x){ return document.getElementById(x); }
  function client(){ return window.supabaseClient || (window.supabase && window.supabase.from ? window.supabase : null); }
  function isSide(el){ return !!(el && el.id && SIDE_IDS.indexOf(el.id) !== -1); }
  function isSysRole(r){ r = n(r); return r === 'sysadm' || r === 'sysadmin' || r === 'systemadmin'; }
  function isAdminRole(r){ r = n(r); return r === 'admin' || r === 'administrator' || isSysRole(r); }
  function emailIn(list, email){ return list.indexOf(n(email)) >= 0; }

  function show(el){
    if(!el) return;
    el.hidden = false;
    el.classList.remove('skjult','hidden','modul-skjult');
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.removeAttribute('aria-hidden');
  }
  function hide(el){
    if(!el) return;
    el.hidden = true;
    el.classList.add('skjult','hidden');
    el.style.setProperty('display','none','important');
    el.setAttribute('aria-hidden','true');
  }
  function closeAdminMenu(){
    var p = id('adminMenyPanel');
    var b = id('adminMenyKnapp');
    var g = id('adminMenyGruppe');
    if(p){ p.hidden = true; p.style.setProperty('display','none','important'); p.style.setProperty('visibility','hidden','important'); p.setAttribute('aria-hidden','true'); p.classList.remove('apen','open'); }
    if(g) g.classList.remove('apen','open');
    if(b) b.setAttribute('aria-expanded','false');
  }

  async function authEmail(){
    var c = client();
    try{ if(c && c.auth && c.auth.getUser){ var u = await c.auth.getUser(); var e = n(u && u.data && u.data.user && u.data.user.email); if(e) return e; } }catch(e){}
    try{ if(c && c.auth && c.auth.getSession){ var s = await c.auth.getSession(); var e2 = n(s && s.data && s.data.session && s.data.session.user && s.data.session.user.email); if(e2) return e2; } }catch(e){}
    try{ return n(window.innloggetEpost || window.handInnloggetEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('rettilommaSistEpost')); }catch(e){ return ''; }
  }

  async function oneRoleFrom(table, email, userId){
    var c = client();
    if(!c) return '';
    try{
      var q = c.from(table).select('rolle,epost,user_id,aktiv').limit(10);
      if(userId) q = q.eq('user_id', userId); else q = q.ilike('epost', email);
      var r = await q;
      if(!r.error && Array.isArray(r.data) && r.data.length){
        var roles = r.data.map(function(x){ return n(x && x.rolle); }).filter(Boolean);
        if(roles.some(isSysRole)) return roles.find(isSysRole);
        if(roles.some(isAdminRole)) return roles.find(isAdminRole);
        return roles[0] || '';
      }
    }catch(e){}
    if(userId && email){
      try{
        var r2 = await c.from(table).select('rolle,epost,user_id,aktiv').ilike('epost', email).limit(10);
        if(!r2.error && Array.isArray(r2.data) && r2.data.length){
          var roles2 = r2.data.map(function(x){ return n(x && x.rolle); }).filter(Boolean);
          if(roles2.some(isSysRole)) return roles2.find(isSysRole);
          if(roles2.some(isAdminRole)) return roles2.find(isAdminRole);
          return roles2[0] || '';
        }
      }catch(e){}
    }
    return '';
  }

  async function hasSysadminTable(email){
    var c = client();
    if(!c || !email) return false;
    try{
      var r = await c.from('hand_sysadm').select('id,epost,aktiv').ilike('epost', email).eq('aktiv', true).limit(1);
      return !r.error && Array.isArray(r.data) && r.data.length > 0;
    }catch(e){ return false; }
  }

  async function findUserId(){
    var c = client();
    try{ if(c && c.auth && c.auth.getUser){ var u = await c.auth.getUser(); return String(u && u.data && u.data.user && u.data.user.id || '').trim(); } }catch(e){}
    try{ return String(localStorage.getItem('innloggetUserId') || localStorage.getItem('authUserId') || '').trim(); }catch(e){ return ''; }
  }

  async function resolveRole(){
    var email = await authEmail();
    var userId = await findUserId();
    var role = '';
    var sys = false;

    if(email){
      sys = emailIn(SYSADMIN_FALLBACK_EMAILS, email) || await hasSysadminTable(email);
      role = await oneRoleFrom('hand_firma_bruker', email, userId) || await oneRoleFrom('hand_ansatt', email, userId) || '';
    }

    if(sys || emailIn(SYSADMIN_FALLBACK_EMAILS, email)) role = 'sysadm';
    if(!role && emailIn(ADMIN_FALLBACK_EMAILS, email)) role = 'admin';

    state.email = email;
    state.role = role || 'bruker';
    state.isSys = sys || emailIn(SYSADMIN_FALLBACK_EMAILS, email) || isSysRole(state.role);
    state.isAdmin = state.isSys || isAdminRole(state.role) || emailIn(ADMIN_FALLBACK_EMAILS, email);
    state.ready = true;
    return state;
  }

  function writeState(){
    window.innloggetEpost = state.email || window.innloggetEpost || '';
    window.handInnloggetEpost = state.email || window.handInnloggetEpost || '';
    window.innloggetRolle = state.role;
    window.handInnloggetRolle = state.role;
    window.erAdmin = !!state.isAdmin;
    window.erSystemadmin = !!state.isSys;
    try{
      if(state.email){ localStorage.setItem('handInnloggetEpost', state.email); localStorage.setItem('innloggetEpost', state.email); localStorage.setItem('rettilommaSistEpost', state.email); }
      localStorage.setItem('handInnloggetRolle', state.role);
      localStorage.setItem('innloggetRolle', state.role);
      localStorage.setItem('rilAdminModus', state.isAdmin ? 'ja' : 'nei');
      if(state.isSys){ localStorage.setItem('rilSysadminModus','ja'); }
      else { localStorage.removeItem('rilSysadminModus'); localStorage.removeItem('sysadminModus'); localStorage.removeItem('handSysadminModus'); }
    }catch(e){}
  }

  function applyVisibility(){
    writeState();
    document.documentElement.classList.toggle('ril-admin-ready', !!state.isAdmin);
    document.documentElement.classList.toggle('ril-sysadm-ready', !!state.isSys);
    document.documentElement.classList.toggle('hand-is-sysadm', !!state.isSys);
    document.documentElement.classList.add('ril-role-ready','hand-role-ready');
    document.documentElement.classList.remove('hand-role-locking');

    document.querySelectorAll('.admin-only').forEach(function(el){ if(!isSide(el)) state.isAdmin ? show(el) : hide(el); });
    ADMIN_IDS.forEach(function(x){ state.isAdmin ? show(id(x)) : hide(id(x)); });

    document.querySelectorAll('.systemadmin-only,.sysadmin-entry').forEach(function(el){ if(!isSide(el)) state.isSys ? show(el) : hide(el); });
    SYS_IDS.forEach(function(x){ state.isSys ? show(id(x)) : hide(id(x)); });

    if(!state.isSys) hide(id('sysadminPanelSide'));
    if(!state.isAdmin) closeAdminMenu();

    var bruker = id('innloggetBrukerVisning');
    if(bruker && state.email) bruker.textContent = state.email;
    var rolle = id('innloggetRolleVisning');
    if(rolle){
      if(state.isSys) rolle.textContent = ' (sysadm)';
      else if(state.isAdmin) rolle.textContent = ' (admin)';
      else rolle.textContent = '';
    }
    rilKeepTopMenuOnly();
  }

  async function refresh(){
    await resolveRole();
    applyVisibility();
    return state;
  }

  function bindAdminMenu(){
    var b = id('adminMenyKnapp');
    var p = id('adminMenyPanel');
    var g = id('adminMenyGruppe');
    if(!b || !p || !g) return;
    b.type = 'button';
    b.onclick = function(ev){
      if(ev){ ev.preventDefault(); ev.stopPropagation(); }
      if(!state.isAdmin){ closeAdminMenu(); return false; }
      var open = p.hidden || p.style.display === 'none' || p.getAttribute('aria-hidden') === 'true';
      if(open){
        document.documentElement.classList.add('ril-topmenu-only');
        document.documentElement.classList.remove('ril-side-selected');
        ['timerSide','jobberSide','fravaerSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','kundeSide','kunderSide','ansattSide','firmaSide','testSide','testpanelSide','lonnPanel','lonnSide','bilBestillingerSide','adminBilBestillinger','adminBilBestillingerPanel','modulerSide','sysadminPanelSide','adminSide','adminKonsollSide'].forEach(function(x){ hide(id(x)); });
        show(p); p.hidden = false; p.style.display = 'block'; p.style.visibility = 'visible'; p.style.pointerEvents = 'auto'; p.setAttribute('aria-hidden','false'); g.classList.add('apen'); p.classList.add('apen','open'); b.setAttribute('aria-expanded','true');
      } else closeAdminMenu();
      return false;
    };
  }

  function installCss(){
    if(id('handStabil20Css')) return;
    var css = document.createElement('style');
    css.id = 'handStabil20Css';
    css.textContent = `
      #handTopbarKort{max-width:980px!important;margin:14px auto 10px!important;padding:14px 16px!important;border-radius:12px!important}
      #handSideOverskrift{font-size:26px!important;line-height:1.15!important;margin:0 0 12px!important;text-align:center!important}
      #innloggetBrukerBoks{font-size:14px!important;margin:0 0 8px!important}
      .topplinje{display:flex!important;gap:8px!important;align-items:center!important;flex-wrap:wrap!important}
      .topplinje button,.topplinje a{width:auto!important;margin:0!important;padding:8px 12px!important;font-size:14px!important;line-height:1.1!important;white-space:nowrap!important}
      #adminMenyGruppe{position:relative!important;display:inline-flex!important}
      #adminMenyPanel{position:absolute!important;top:calc(100% + 6px)!important;left:0!important;z-index:5000!important;min-width:230px!important;max-height:70vh!important;overflow:auto!important;background:#15181d!important;border:1px solid #334155!important;border-radius:12px!important;padding:8px!important;box-shadow:0 10px 30px rgba(0,0,0,.35)!important}
      #adminMenyPanel[hidden]{display:none!important}
      #adminMenyPanel button{display:block!important;width:100%!important;text-align:left!important;margin:3px 0!important;padding:8px 10px!important}
      #timerSide.kort,#timerSide{max-width:980px!important;margin:10px auto!important;padding:14px!important;border-radius:12px!important}
      #timerSide>h2:first-child{font-size:22px!important;margin-bottom:14px!important;text-align:center!important}
      #timerSide .rad{gap:8px!important;margin:5px 0!important}
      #timerSide label{font-size:14px!important;margin:4px 0 3px!important;line-height:1.1!important}
      #timerSide input,#timerSide select,#timerSide textarea{padding:7px 9px!important;font-size:14px!important}
      #timerSide button{padding:7px 10px!important;font-size:13px!important;margin:2px!important;width:auto!important}
      #timerSide img,#rilJobbBilder img,#rilFastBildeGalleri img{width:72px!important;height:72px!important;object-fit:cover!important;border-radius:10px!important;display:block!important}
      #rilJobbBilder,#rilFastBildeGalleri{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;gap:8px!important;overflow-x:auto!important;overflow-y:hidden!important;max-width:100%!important;padding:8px!important;scroll-snap-type:x proximity!important}
      #rilJobbBilder a,#rilFastBildeGalleri a{display:inline-flex!important;flex:0 0 auto!important;flex-direction:column!important;gap:4px!important;text-decoration:none!important;scroll-snap-align:start!important}
      #rilJobbBilder small,#rilFastBildeGalleri small{max-width:72px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
      @media(max-width:700px){
        body{font-size:15px!important}
        section,#appSide{padding:8px!important;max-width:100%!important}
        #handTopbarKort{margin:6px!important;padding:10px!important}
        #handSideOverskrift{font-size:21px!important;text-align:left!important;margin-bottom:8px!important}
        #innloggetBrukerBoks{font-size:13px!important;word-break:break-word!important}
        .topplinje{gap:6px!important;overflow-x:auto!important;flex-wrap:nowrap!important;padding-bottom:4px!important}
        .topplinje button,.topplinje a{flex:0 0 auto!important;width:auto!important;padding:8px 10px!important;font-size:13px!important}
        #adminMenyPanel{position:fixed!important;left:8px!important;right:8px!important;top:96px!important;min-width:0!important;max-height:70vh!important}
        #timerSide.kort,#timerSide{margin:6px!important;padding:10px!important}
        #timerSide .rad,#timerSide .timer-row-2,#timerSide .timer-row-vare,#timerSide .timer-row-utgift{display:grid!important;grid-template-columns:1fr!important;gap:6px!important}
        #timerSide button{width:auto!important}
        #timerSide img,#rilJobbBilder img,#rilFastBildeGalleri img{width:64px!important;height:64px!important}
      }
    `;
    document.head.appendChild(css);
  }

  function start(){ installCss(); bindAdminMenu(); refresh(); setTimeout(refresh,250); setTimeout(refresh,1000); }
  window.handStabil20Refresh = refresh;
  window.oppdaterAdminVisning = function(){ applyVisibility(); bindAdminMenu(); };
  document.addEventListener('handPartialerLastet', start);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('load', start);
})();
