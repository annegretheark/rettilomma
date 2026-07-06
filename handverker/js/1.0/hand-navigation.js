/* Rett i Lomma - RYDDET navigasjon 9001
   En fil styrer toppmeny og Admin-meny. Ingen ekstra Admin-handlere.
*/
(function () {
  'use strict';

  var SIDE_IDS = [
    'adminKonsollSide','timerSide','jobberSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide',
    'kundeSide','kunderSide','ansattSide','firmaSide','bilBestillingerSide','adminBilBestillinger','adminBilBestillingerPanel',
    'testSide','testpanelSide','lonnPanel','lonnSide','fravaerSide','modulerSide','sysadminPanelSide','adminSide'
  ];

  function $(id) { return document.getElementById(id); }
  function txt(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

  var adminMenuHoldOpenUntil = 0;
  var lastAdminPointerOpen = 0;


  function erAdmin() {
    var rolle = txt(window.innloggetRolle || window.handInnloggetRolle || localStorage.getItem('handInnloggetRolle') || localStorage.getItem('innloggetRolle'));
    return window.erAdmin === true || rolle === 'admin' || rolle === 'sysadm' || rolle === 'sysadmin' || localStorage.getItem('rilAdminModus') === 'ja';
  }
  function erSysadmin() {
    var rolle = txt(window.innloggetRolle || window.handInnloggetRolle || localStorage.getItem('handInnloggetRolle') || localStorage.getItem('innloggetRolle'));
    var epost = txt(window.innloggetEpost || window.innloggetBrukerEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost'));
    return window.erSystemadmin === true || rolle === 'sysadm' || rolle === 'sysadmin' || rolle === 'systemadmin' || epost === 'greknuts@online.no';
  }

  function show(el) {
    if (!el) return;
    el.hidden = false;
    el.classList.remove('hidden','skjult','modul-skjult','ril-starter');
    el.style.removeProperty('display');
    el.style.removeProperty('visibility');
    el.removeAttribute('aria-hidden');
  }
  function hide(el) {
    if (!el) return;
    el.hidden = true;
    el.classList.add('hidden','skjult');
    el.style.setProperty('display','none','important');
    el.setAttribute('aria-hidden','true');
  }
  function hideSide(id) {
    var el = $(id);
    if (el && el.classList) el.classList.remove('ril-active-side');
    hide(el);
  }

  function clearActiveSides() {
    SIDE_IDS.forEach(function(id){
      var el = $(id);
      if (el && el.classList) el.classList.remove('ril-active-side');
    });
  }

  function activateSide(id) {
    clearActiveSides();
    var el = $(id);
    if (el && el.classList) el.classList.add('ril-active-side');
    return el;
  }

  function closeAdminMenu(force) {
    if (!force && Date.now() < adminMenuHoldOpenUntil) return;
    var group = $('adminMenyGruppe');
    var panel = $('adminMenyPanel');
    var btn = $('adminMenyKnapp');
    if (group) group.classList.remove('apen','open');
    if (panel) {
      panel.hidden = true;
      panel.classList.remove('apen','open');
      panel.setAttribute('aria-hidden','true');
      panel.style.setProperty('display','none','important');
      panel.style.setProperty('visibility','hidden','important');
      panel.style.setProperty('pointer-events','none','important');
    }
    if (btn) btn.setAttribute('aria-expanded','false');
  }

  function openAdminMenu() {
    if (!erAdmin()) return;
    adminMenuHoldOpenUntil = Date.now() + 1200;
    showApp();
    clearActiveSides();
    SIDE_IDS.forEach(hideSide);
    var group = $('adminMenyGruppe');
    var panel = $('adminMenyPanel');
    var btn = $('adminMenyKnapp');
    if (!panel) return;
    if (group) group.classList.add('apen','open');
    panel.hidden = false;
    panel.classList.add('apen','open');
    panel.setAttribute('aria-hidden','false');
    panel.style.setProperty('display','block','important');
    panel.style.setProperty('visibility','visible','important');
    panel.style.setProperty('pointer-events','auto','important');
    if (btn) btn.setAttribute('aria-expanded','true');
  }

  function toggleAdminMenu() {
    var panel = $('adminMenyPanel');
    var isOpen = !!(panel && !panel.hidden && panel.style.display !== 'none');
    if (isOpen) closeAdminMenu(true); else openAdminMenu();
  }

  function setTitle(title) {
    var h = $('handSideOverskrift') || document.querySelector('#appSide h1');
    if (h && title) h.textContent = title;
  }

  function showApp() {
    var app = $('appSide');
    show(app);
    if (app) {
      app.classList.remove('ril-starter','skjult','hidden');
      app.style.removeProperty('visibility');
      app.style.removeProperty('display');
    }
  }

  function visKunToppmenyForAdmin() {
    showApp();
    clearActiveSides();
    SIDE_IDS.forEach(hideSide);
    setTitle('');
    closeAdminMenu();
  }

  function showOnly(sideId, title) {
    showApp();
    SIDE_IDS.forEach(hideSide);
    var side = activateSide(sideId);
    show(side);
    setTitle(title);
    closeAdminMenu();
  }

  function safeCall(name) {
    if (typeof window[name] !== 'function') return;
    try { window[name](); } catch (e) { console.warn('Init feilet:', name, e); }
  }
  function safeCallLater(name, ms) { setTimeout(function(){ safeCall(name); }, ms || 20); }

  function oppdaterAdminVisning() {
    var admin = erAdmin();
    var sys = erSysadmin();
    document.querySelectorAll('.admin-only').forEach(function(el){ admin ? show(el) : hide(el); });
    document.querySelectorAll('.systemadmin-only').forEach(function(el){ sys ? show(el) : hide(el); });

    var minBil = $('visBilerKnapp');
    if (minBil) {
      if (admin) hide(minBil);
      else { show(minBil); minBil.textContent = 'Min bil / fyll lager'; }
    }
    if (!sys) hide($('visModulerKnapp'));
    // Ikke lukk Admin-menyen her; denne funksjonen kjøres ofte av gamle scripts.
  }

  function krevAdmin(melding) {
    if (erAdmin()) return true;
    alert(melding || 'Du har ikke tilgang til denne funksjonen.');
    closeAdminMenu();
    return false;
  }

  function visLogin() { show($('loginSide')); hide($('nyttPassordSide')); hide($('appSide')); closeAdminMenu(); }
  function visNyttPassord() { hide($('loginSide')); show($('nyttPassordSide')); hide($('appSide')); closeAdminMenu(); }

  async function visApp() {
    hide($('loginSide'));
    hide($('nyttPassordSide'));
    showApp();
    oppdaterAdminVisning();

    safeCallLater('lastKunder', 30);
    safeCallLater('lastProsjekter', 40);
    safeCallLater('lastAnsatte', 50);
    safeCallLater('settDagensDato', 60);
    safeCallLater('lastTimer', 70);
    safeCallLater('fyllFirmaSkjema', 80);
    safeCallLater('tegnFirmaInfo', 90);

    if (erAdmin()) {
      visKunToppmenyForAdmin();
    } else {
      visTimerSide();
    }
  }

  function visTimerSide() { oppdaterAdminVisning(); showOnly('timerSide','Timeregistrering'); safeCallLater('reparerBilvalg',20); if (erAdmin()) { show($('adminAnsattRad')); safeCallLater('fyllAdminAnsattValg',30); } else hide($('adminAnsattRad')); }
  function visJobberSide() { oppdaterAdminVisning(); showOnly('jobberSide','Jobber'); safeCallLater('lastJobber',20); }
  function visFravaerSide() { oppdaterAdminVisning(); showOnly('fravaerSide','Fravær / Flexi'); safeCallLater('lastFravaerFlexi',20); }
  function visBilerSide(title) { oppdaterAdminVisning(); showOnly('bilerSide', title || (erAdmin() ? 'Biler / bil-lager' : 'Min bil / fyll lager')); safeCallLater('lastBiler',20); safeCallLater('lastBilLager',40); safeCallLater('lastBilerOgBilLager',60); safeCallLater('reparerBilvalg',80); safeCallLater('fyllBilvalgTrygt',100); safeCallLater('begrensBilLagerForVanligBruker',120); }

  function visKundeSide() { if (!krevAdmin('Du har ikke tilgang til kunderegister.')) return; showOnly('kundeSide','Kunder'); safeCallLater('lastKunder',20); safeCallLater('tegnKunder',40); safeCallLater('tegnKundeListe',60); }
  function visTilbudSide() { if (!krevAdmin('Du har ikke tilgang til tilbud.')) return; showOnly('tilbudSide','Tilbud'); safeCallLater('fyllTilbudKundeDropdown',20); safeCallLater('lastTilbud',40); }
  function visFakturaSide() { if (!krevAdmin('Du har ikke tilgang til faktura.')) return; showOnly('fakturaSide','Faktura'); safeCallLater('fyllOkonomiKundeValg',20); safeCallLater('lastFaktura',40); }
  function visVarerSide() { if (!krevAdmin('Du har ikke tilgang til varer.')) return; showOnly('varerSide','Lager / Varer'); safeCallLater('lastVarer',20); safeCallLater('handLastVarer',40); safeCallLater('lastVarelager',60); }
  function visAdminBilerSide() { if (!krevAdmin('Du har ikke tilgang til biler.')) return; visBilerSide('Biler / bil-lager'); }
  function visBilBestillingerSide() { if (!krevAdmin('Du har ikke tilgang til bestillinger.')) return; showOnly('bilBestillingerSide','Bestillinger'); safeCallLater('handLastBilBestillinger',20); safeCallLater('handLastAdminBilBestillinger',40); safeCallLater('renderAdminBilBestillinger',60); safeCallLater('rilVisBestillinger',80); }
  function visLonnSide() { if (!krevAdmin('Du har ikke tilgang til lønn.')) return; showOnly('lonnPanel','Lønn'); safeCallLater('lastAnsatte',20); safeCallLater('fyllLonnAnsattValg',60); }
  function visAnsattSide() { if (!krevAdmin('Du har ikke tilgang til ansattregister.')) return; showOnly('ansattSide','Ansatte'); safeCallLater('tegnTrekkListe',20); safeCallLater('lastAnsatte',40); }
  function visFirmaSide() { if (!krevAdmin('Du har ikke tilgang til firma.')) return; showOnly('firmaSide','Firma'); safeCallLater('lastFirma',20); safeCallLater('fyllFirmaSkjema',40); safeCallLater('tegnFirmaInfo',60); }
  function visBackupSide() { if (!krevAdmin('Du har ikke tilgang til backup.')) return; showOnly('backupSide','Backup / restore'); }
  function visTestSide() { if (!krevAdmin('Du har ikke tilgang til testpanel.')) return; showOnly('testSide','Testpanel'); }
  function visModulerSide() { if (!erSysadmin()) { alert('Moduler er kun for systemadmin.'); closeAdminMenu(); return; } showOnly('modulerSide','Moduler'); safeCallLater('lastModulerFraDatabase',20); safeCallLater('tegnModulGui',40); }

  var ACTIONS = {
    visTimerKnapp: visTimerSide,
    visJobberKnapp: visJobberSide,
    visFravaerKnapp: visFravaerSide,
    visBilerKnapp: function(){ visBilerSide('Min bil / fyll lager'); },
    visKundeKnapp: visKundeSide,
    visTilbudKnapp: visTilbudSide,
    visFakturaKnapp: visFakturaSide,
    visAdminVarerKnapp: visVarerSide,
    varerKnapp: visVarerSide,
    visAdminBilerKnapp: visAdminBilerSide,
    visBilBestillingerKnapp: visBilBestillingerSide,
    visLonnKnapp: visLonnSide,
    visAnsattKnapp: visAnsattSide,
    visFirmaKnapp: visFirmaSide,
    visBackupKnapp: visBackupSide,
    visTestKnapp: visTestSide,
    visModulerKnapp: visModulerSide
  };

  function handleButton(id) {
    var fn = ACTIONS[id];
    if (!fn) return false;
    fn();
    closeAdminMenu(true);
    return true;
  }


  function globalCaptureHandler(event) {
    var target = event.target;
    if (!target || !target.closest) return;

    var adminBtn = target.closest('#adminMenyKnapp');
    if (adminBtn) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      oppdaterAdminVisning();
      lastAdminPointerOpen = Date.now();
      if (typeof window.rilAdminMenuStableToggle === 'function') window.rilAdminMenuStableToggle(); else toggleAdminMenu();
      return false;
    }

    var navBtn = target.closest('button');
    if (navBtn && ACTIONS[navBtn.id]) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      handleButton(navBtn.id);
      return false;
    }
  }

  // Viktig: bruk window capture fordi noen gamle inline-script i index.html
  // også bruker window capture og stopImmediatePropagation. Denne filen lastes før dem,
  // derfor får vi lukket Admin-menyen og kjørt riktig navigasjon først.
  // Kun click: pointerdown + mousedown + click ga flere toggles/blink på Admin-knappen.
  window.addEventListener('click', globalCaptureHandler, true);

  document.addEventListener('click', function(event) {
    var adminBtn = event.target && event.target.closest && event.target.closest('#adminMenyKnapp');
    if (adminBtn) {
      event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      return false;
    }

    var navBtn = event.target && event.target.closest && event.target.closest('button');
    if (navBtn && ACTIONS[navBtn.id]) {
      event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      handleButton(navBtn.id);
      return false;
    }

    if (!(event.target && event.target.closest && event.target.closest('#adminMenyGruppe'))) closeAdminMenu(true);
  }, true);

  document.addEventListener('keydown', function(event){ if (event.key === 'Escape') closeAdminMenu(true); }, true);

  function bindFallback() {
    Object.keys(ACTIONS).forEach(function(id){ var b=$(id); if(b){ b.type='button'; b.onclick=function(e){ if(e){e.preventDefault(); e.stopPropagation();} handleButton(id); return false; }; } });
    var admin=$('adminMenyKnapp'); if(admin){ admin.type='button'; admin.onclick=function(e){ if(e){e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation();} if(Date.now()-lastAdminPointerOpen<650){ return false; } lastAdminPointerOpen=Date.now(); if (typeof window.rilAdminMenuStableToggle === 'function') window.rilAdminMenuStableToggle(); else toggleAdminMenu(); return false; }; }
    oppdaterAdminVisning();
  }

  window.visLogin = visLogin;
  window.visNyttPassord = visNyttPassord;
  window.visApp = visApp;
  window.oppdaterAdminVisning = oppdaterAdminVisning;
  window.visTimerSide = visTimerSide;
  window.rilVisTimerSide = visTimerSide;
  window.visTimerForAnsattSide = visTimerSide;
  window.rilVisTimerForAnsattSide = visTimerSide;
  window.visJobberSide = visJobberSide;
  window.visFravaerSide = visFravaerSide;
  window.visBilerSide = visBilerSide;
  window.handOpenMinBil = function(){ visBilerSide('Min bil / fyll lager'); return false; };
  window.handOpenMinBilHard = window.handOpenMinBil;
  window.visKundeSide = visKundeSide;
  window.visTilbudSide = visTilbudSide;
  window.visFakturaSide = visFakturaSide;
  window.visVarerSide = visVarerSide;
  window.visBilBestillingerSide = visBilBestillingerSide;
  window.visLonnSide = visLonnSide;
  window.visAnsattSide = visAnsattSide;
  window.visFirmaSide = visFirmaSide;
  window.visBackupSide = visBackupSide;
  window.visTestSide = visTestSide;
  window.visModulerSide = visModulerSide;
  window.skjulArbeidssider = function(){ SIDE_IDS.forEach(hideSide); };
  window.skjulAlleSider = window.skjulArbeidssider;
  window.rilCloseAdminMenuStable = closeAdminMenu;
  window.rilVisKunToppmenyForAdmin = visKunToppmenyForAdmin;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindFallback);
  else bindFallback();
  document.addEventListener('handPartialerLastet', function(){ setTimeout(bindFallback,0); setTimeout(bindFallback,100); });
  window.addEventListener('load', function(){ setTimeout(bindFallback,0); setTimeout(bindFallback,300); });
})();
