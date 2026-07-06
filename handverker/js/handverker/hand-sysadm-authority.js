/* Rett i Lomma - strukturert SysAdm authority
   Global sysadm-kilde: kun egen SysAdm-tabell (hand_sysadmin/handsysadmin/hand_sysadm).
*/
(function(){
  'use strict';
  if (window.__HAND_SYSADM_AUTHORITY_V1) return;
  window.__HAND_SYSADM_AUTHORITY_V1 = true;

  const SIDE_IDS = [
    'adminKonsollSide','timerSide','jobberSide','fravaerSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide',
    'kundeSide','kunderSide','ansattSide','ansatteSide','firmaSide','testSide','testpanelSide','lonnPanel','lonnSide',
    'bilBestillingerSide','adminBilBestillinger','adminBilBestillingerPanel','modulerSide','sysadminPanelSide','adminSide'
  ];

  function $(id){ return document.getElementById(id); }
  function norm(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function client(){ return window.supabaseClient || (window.supabase && window.supabase.from ? window.supabase : null); }
  function isSysRole(v){ return ['sysadm','sysadmin','systemadmin'].indexOf(norm(v)) !== -1; }
  function show(el){ if(!el) return; el.hidden=false; el.classList.remove('skjult','hidden','modul-skjult'); el.style.display=''; el.style.visibility='visible'; el.removeAttribute('aria-hidden'); }
  function hide(el){ if(!el) return; el.hidden=true; el.classList.add('skjult','hidden'); el.style.display='none'; el.setAttribute('aria-hidden','true'); }

  async function getEmail(){
    const c = client();
    try{ const r = await c?.auth?.getUser?.(); const e = norm(r?.data?.user?.email); if(e) return e; }catch(e){}
    try{ const r = await c?.auth?.getSession?.(); const e = norm(r?.data?.session?.user?.email); if(e) return e; }catch(e){}
    return norm(window.innloggetEpost || window.handInnloggetEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('rettilommaSistEpost') || localStorage.getItem('epost'));
  }

  async function isGlobalSysadm(email){
    email = norm(email || await getEmail());
    if(!email) return false;
    const c = client();
    if(!c) return false;
    const tables = ['hand_sysadmin','handsysadmin','hand_sysadm'];
    for (const table of tables) {
      try{
        const r = await c.from(table).select('*').ilike('epost', email).limit(1);
        if(!r.error && Array.isArray(r.data) && r.data.length){
          const row = r.data[0] || {};
          return !(row.aktiv === false || row.active === false || row.deaktivert === true);
        }
      }catch(e){}
      try{
        const r2 = await c.from(table).select('*').ilike('email', email).limit(1);
        if(!r2.error && Array.isArray(r2.data) && r2.data.length){
          const row2 = r2.data[0] || {};
          return !(row2.aktiv === false || row2.active === false || row2.deaktivert === true);
        }
      }catch(e){}
    }
    return false;
  }

  function applyRole(email, sys){
    email = norm(email || '');
    if(email){
      window.innloggetEpost = email;
      window.handInnloggetEpost = email;
      try{
        localStorage.setItem('handInnloggetEpost', email);
        localStorage.setItem('innloggetEpost', email);
        localStorage.setItem('rettilommaSistEpost', email);
      }catch(e){}
    }

    if(sys){
      window.handErGlobalSysadm = true;
      window.erSystemadmin = true;
      window.erAdmin = true;
      window.innloggetRolle = 'sysadm';
      window.handInnloggetRolle = 'sysadm';
      window.HAND_ROLE = 'sysadm';
      try{
        localStorage.setItem('handInnloggetRolle','sysadm');
        localStorage.setItem('innloggetRolle','sysadm');
        localStorage.setItem('rilAdminModus','ja');
        localStorage.setItem('rilSysadminRettighet','ja');
      }catch(e){}
      document.documentElement.classList.add('ril-auth-ready','ril-role-ready','ril-admin-ready','ril-sysadm-ready','ril-verified-sysadm','hand-is-sysadm');
      document.documentElement.classList.remove('ril-ikke-sysadm','hand-role-locking');
      if(document.body){ document.body.classList.add('ril-er-sysadm','ril-er-admin'); document.body.classList.remove('ril-vanlig-bruker'); }
    } else {
      window.handErGlobalSysadm = false;
      if(isSysRole(window.innloggetRolle) || isSysRole(localStorage.getItem('handInnloggetRolle'))){
        window.innloggetRolle = 'bruker';
        window.handInnloggetRolle = 'bruker';
        try{ localStorage.setItem('handInnloggetRolle','bruker'); localStorage.setItem('innloggetRolle','bruker'); }catch(e){}
      }
      document.documentElement.classList.remove('ril-sysadm-ready','ril-verified-sysadm','hand-is-sysadm');
    }
    updateVisibility();
  }

  function updateVisibility(){
    const sys = window.erSystemadmin === true || window.handErGlobalSysadm === true || isSysRole(window.innloggetRolle) || isSysRole(localStorage.getItem('handInnloggetRolle'));
    const admin = sys || window.erAdmin === true || ['admin','administrator','eier','owner','firmaeier'].indexOf(norm(window.innloggetRolle || localStorage.getItem('handInnloggetRolle'))) !== -1;
    document.documentElement.classList.toggle('ril-admin-ready', !!admin);
    document.documentElement.classList.toggle('ril-sysadm-ready', !!sys);
    document.documentElement.classList.toggle('ril-verified-sysadm', !!sys);
    document.documentElement.classList.toggle('hand-is-sysadm', !!sys);
    document.querySelectorAll('.sysadmin-entry,.systemadmin-only').forEach(function(el){
      const erSide = el.tagName === 'SECTION' || /Side$|Panel$/.test(el.id || '');
      if(sys && !erSide) show(el); else if(!sys) hide(el);
    });
    document.querySelectorAll('.admin-only').forEach(function(el){
      const erSide = el.tagName === 'SECTION' || /Side$|Panel$/.test(el.id || '');
      if(admin && !erSide) show(el); else if(!admin) hide(el);
    });
    ['sysadminModeKnapp','sysadminNyKundeKnapp','sysadminKundelisteKnapp'].forEach(function(id){ if(sys) show($(id)); });
    if($('sysadminModulerKnapp')) hide($('sysadminModulerKnapp'));
    if($('visModulerKnapp')) hide($('visModulerKnapp'));
    if($('velgModulKnapp')) hide($('velgModulKnapp'));
    const rv = $('innloggetRolleVisning'); if(rv) rv.textContent = '';
    const bv = $('innloggetBrukerVisning'); if(bv && (window.innloggetEpost || window.handInnloggetEpost)) bv.textContent = window.innloggetEpost || window.handInnloggetEpost;
  }

  async function refresh(email){
    email = norm(email || await getEmail());
    const sys = await isGlobalSysadm(email);
    applyRole(email, sys);
    return sys;
  }

  function showOnly(sideId){
    // Viktig: hand-navigation legger på ril-topmenu-only, som har CSS med display:none!important
    // for alle panelsider. SysAdm må derfor markere at en side faktisk er valgt.
    document.documentElement.classList.remove('ril-topmenu-only','hand-role-locking');
    document.documentElement.classList.add('ril-side-selected','ril-auth-ready','ril-role-ready');
    const app = $('appSide'); if(app){ show(app); app.classList.remove('ril-starter','skjult','hidden'); app.style.display=''; }
    SIDE_IDS.forEach(function(id){ if(id !== sideId) hide($(id)); });
    show($(sideId));
  }

  async function openSysadmPanel(ev){
    if(ev){ ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation(); }
    let sys = window.erSystemadmin === true || window.handErGlobalSysadm === true || isSysRole(window.innloggetRolle) || isSysRole(localStorage.getItem('handInnloggetRolle'));
    if(!sys){
      try{ sys = await refresh(); }catch(e){ console.warn('SysAdm refresh feilet:', e); }
    }
    if(!sys){ alert('SysAdm er ikke aktiv for denne brukeren.'); return false; }
    if(typeof window.skjulAlleSider === 'function') { try{ window.skjulAlleSider(); }catch(e){} }
    document.documentElement.classList.remove('ril-topmenu-only','hand-role-locking');
    document.documentElement.classList.add('ril-side-selected','ril-auth-ready','ril-role-ready','ril-sysadm-ready','ril-verified-sysadm','hand-is-sysadm');
    showOnly('sysadminPanelSide');
    const blokk = $('handSystemadminBlokk'); if(blokk) show(blokk);
    const h = $('handSideOverskrift') || document.querySelector('#appSide h1'); if(h) h.textContent = 'SysAdm';
    updateVisibility();
    setTimeout(function(){ try{ if(typeof window.handLastKundeliste === 'function') window.handLastKundeliste(); }catch(e){ console.warn(e); } }, 50);
    setTimeout(function(){ try{ if(typeof window.handInitSysadmBackupGui === 'function') window.handInitSysadmBackupGui(); }catch(e){ console.warn(e); } }, 80);
    return false;
  }

  function bindButtons(){
    updateVisibility();
    ['sysadminModeKnapp','visHandKundeAdminKnapp','sysadmKnapp','sysadminKnapp'].forEach(function(id){
      const b = $(id); if(!b || b.dataset.handSysadmAuthorityBind === '1') return;
      b.dataset.handSysadmAuthorityBind = '1';
      b.type = 'button';
      if(id === 'sysadminModeKnapp') b.textContent = 'SysAdm';
      b.onclick = openSysadmPanel;
      b.addEventListener('click', openSysadmPanel, true);
    });
  }


  function sysadmCapture(ev){
    const b = ev.target && ev.target.closest && ev.target.closest('#sysadminModeKnapp,#visHandKundeAdminKnapp,#sysadmKnapp,#sysadminKnapp');
    if(!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    openSysadmPanel(ev);
    return false;
  }

  // Bruk window capture slik at denne går foran gamle dokument-/inline-handlere.
  window.addEventListener('pointerdown', sysadmCapture, true);
  window.addEventListener('mousedown', sysadmCapture, true);
  window.addEventListener('touchstart', sysadmCapture, true);
  window.addEventListener('click', sysadmCapture, true);

  window.handErGlobalSysadmFraTabell = isGlobalSysadm;
  window.handRefreshSysadmRolle = refresh;
  window.handOppdaterSysadmUI = updateVisibility;
  window.handAapneSysadmPanel = openSysadmPanel;
  window.handVisSysadminPanel = openSysadmPanel;
  window.visHandKundeAdminSide = openSysadmPanel;
  window.handSettSysadmRolle = async function(email){ const ok = await refresh(email); return ok; };
  window.handSikreSysadmKnapp = bindButtons;

  document.documentElement.classList.add('hand-role-locking');
  document.addEventListener('DOMContentLoaded', function(){ refresh(); bindButtons(); setTimeout(bindButtons,150); setTimeout(updateVisibility,400); });
  document.addEventListener('handPartialerLastet', function(){ refresh(); bindButtons(); setTimeout(bindButtons,100); });
  window.addEventListener('load', function(){ refresh(); bindButtons(); setTimeout(bindButtons,300); });
})();
