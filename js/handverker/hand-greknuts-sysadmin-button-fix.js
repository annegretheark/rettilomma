/* Håndverker - greknuts sysadmin button hardfix 2026-06-30
   Fikser at Sysadm-knappen ikke åpner panelet fordi eldre rolle-/klikkvakter kan stoppe klikket.
   Denne filen skal lastes sist. Den bruker window-capture så den kjører før document-capture-vaktene. */
(function(){
  'use strict';
  if (window.__handGreknutsSysadminButtonFix) return;
  window.__handGreknutsSysadminButtonFix = true;

  var SYS_EMAILS = ['greknuts@online.no','sysadmin@rettilomma.no'];
  var SIDE_IDS = [
    'timerSide','jobberSide','fravaerSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide',
    'kundeSide','kunderSide','ansattSide','ansatteSide','firmaSide','testSide','testpanelSide','lonnPanel','lonnSide',
    'bilBestillingerSide','adminBilBestillinger','adminBilBestillingerPanel','modulerSide','adminSide','adminKonsollSide'
  ];

  function $(id){ return document.getElementById(id); }
  function n(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function isSysRole(v){ v = n(v); return v === 'sysadm' || v === 'sysadmin' || v === 'systemadmin'; }
  function storage(k){ try { return localStorage.getItem(k) || ''; } catch(e) { return ''; } }
  function setStorage(k,v){ try { localStorage.setItem(k,v); } catch(e) {} }
  function emailNow(){
    return n(window.innloggetEpost || window.innloggetBrukerEpost || window.handInnloggetEpost ||
      storage('handInnloggetEpost') || storage('innloggetEpost') || storage('rettilommaSistEpost') || storage('rilEpost'));
  }
  function isGreknutsOrSys(){
    var e = emailNow();
    return SYS_EMAILS.indexOf(e) !== -1 || window.erSystemadmin === true ||
      isSysRole(window.innloggetRolle || window.handInnloggetRolle || storage('handInnloggetRolle') || storage('innloggetRolle'));
  }
  function show(el){
    if (!el) return;
    el.hidden = false;
    el.classList.remove('hidden','skjult','modul-skjult');
    el.style.setProperty('display', '', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.removeAttribute('aria-hidden');
  }
  function hide(el){
    if (!el) return;
    el.hidden = true;
    el.classList.add('hidden','skjult');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.setAttribute('aria-hidden','true');
  }
  function markSys(){
    var e = emailNow();
    if (e) { setStorage('handInnloggetEpost', e); setStorage('innloggetEpost', e); setStorage('rettilommaSistEpost', e); }
    window.erSystemadmin = true;
    window.erAdmin = true;
    window.innloggetRolle = 'sysadm';
    window.handInnloggetRolle = 'sysadm';
    setStorage('handInnloggetRolle', 'sysadm');
    setStorage('innloggetRolle', 'sysadm');
    setStorage('rilAdminModus', 'ja');
    document.documentElement.classList.remove('hand-role-locking');
    document.documentElement.classList.add('hand-is-sysadm','ril-sysadm-ready','ril-admin-ready','ril-role-ready','hand-role-ready');
  }
  function ensureVisibleButtons(){
    if (!isGreknutsOrSys()) return;
    markSys();
    ['adminMenyGruppe','adminMenyKnapp','sysadminModeKnapp','sysadminNyKundeKnapp','sysadminKundelisteKnapp','sysadminTilAdminKnapp'].forEach(function(id){ show($(id)); });
    var b = $('sysadminModeKnapp');
    if (b) { b.textContent = b.textContent || 'Sysadm'; b.disabled = false; b.type = 'button'; }
  }
  function clearActiveSides(){
    var ids = SIDE_IDS.concat(['sysadminPanelSide']);
    ids.forEach(function(id){ var el=$(id); if(el && el.classList) el.classList.remove('ril-active-side'); });
  }
  function activateSysadminPanel(){
    var app = $('appSide');
    var panel = $('sysadminPanelSide');
    if (app) app.classList.add('ril-panel-lock');
    clearActiveSides();
    if (panel && panel.classList) panel.classList.add('ril-active-side');
    return panel;
  }
  function openPanel(){
    if (!isGreknutsOrSys()) return false;
    markSys();
    setStorage('rilSysadminModus','ja');
    setStorage('rilAdminModus','ja');
    try { if (typeof window.skjulAlleSider === 'function') window.skjulAlleSider(); } catch(e) {}
    SIDE_IDS.forEach(function(id){ hide($(id)); });
    var app = $('appSide');
    show(app);
    if (app) { app.classList.remove('ril-starter','skjult','hidden'); app.hidden=false; app.style.removeProperty('display'); app.style.removeProperty('visibility'); app.removeAttribute('aria-hidden'); }
    show($('handTopbarKort'));
    show($('adminMenyGruppe'));
    var panel = activateSysadminPanel();
    show(panel);
    show($('handSystemadminBlokk'));
    ['sysadminNyKundeKnapp','sysadminKundelisteKnapp','sysadminTilAdminKnapp'].forEach(function(id){ show($(id)); });
    var rv = $('innloggetRolleVisning'); if (rv) rv.textContent = ' (sysadm)';
    var bv = $('innloggetBrukerVisning'); if (bv && emailNow()) bv.textContent = emailNow();
    setTimeout(function(){ try { if (typeof window.handLastKundeliste === 'function') window.handLastKundeliste(); } catch(e) { console.warn('handLastKundeliste feilet', e); } }, 50);
    return false;
  }
  function bind(){
    ensureVisibleButtons();
    var b = $('sysadminModeKnapp');
    if (b) b.onclick = function(ev){ if(ev){ ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation(); } return openPanel(); };
    var l = $('sysadminKundelisteKnapp');
    if (l) l.onclick = function(ev){ if(ev) ev.preventDefault(); markSys(); try { if (typeof window.handLastKundeliste === 'function') window.handLastKundeliste(); } catch(e) {} return false; };
    var t = $('sysadminTilAdminKnapp');
    if (t) t.onclick = function(ev){ if(ev) ev.preventDefault(); try { localStorage.removeItem('rilSysadminModus'); } catch(e) {} ensureVisibleButtons(); if (typeof window.visTimerSide === 'function') window.visTimerSide(); return false; };
  }

  var previousPanel = window.handVisSysadminPanel;
  window.handVisSysadminPanel = function(){
    if (isGreknutsOrSys()) return openPanel();
    return typeof previousPanel === 'function' ? previousPanel.apply(this, arguments) : false;
  };
  window.visHandKundeAdminSide = window.handVisSysadminPanel;
  window.handGreknutsOpenSysadmin = openPanel;

  window.addEventListener('click', function(ev){
    var t = ev.target && ev.target.closest && ev.target.closest('#sysadminModeKnapp');
    if (!t) return;
    if (!isGreknutsOrSys()) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    openPanel();
    return false;
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ bind(); setTimeout(bind,100); setTimeout(bind,700); });
  document.addEventListener('handPartialerLastet', function(){ bind(); setTimeout(bind,100); setTimeout(bind,700); });
  window.addEventListener('load', function(){ bind(); setTimeout(bind,300); setTimeout(bind,1200); });
  setInterval(ensureVisibleButtons, 1500);
})();
