// Rollebasert Sysadm-visning uten hardkodet e-post.
// Skal lastes SIST etter hand-ui.js og andre visibility-fixer.
(function () {
  'use strict';

  function norm(v) { return String(v || '').trim().toLowerCase(); }

  function rolle() {
    return norm(window.innloggetRolle || localStorage.getItem('handInnloggetRolle'));
  }

  function erSysadminRolle() {
    var r = rolle();
    return window.erSystemadmin === true || r === 'sysadmin' || r === 'systemadmin';
  }

  function settSynlig(el, ja) {
    if (!el) return;
    el.classList.toggle('skjult', !ja);
    el.classList.toggle('hidden', !ja);
    el.style.display = ja ? '' : 'none';
    if (ja) el.removeAttribute('hidden');
  }

  function visSysadmKnapp() {
    var erSys = erSysadminRolle();
    var iSysmodus = localStorage.getItem('rilSysadminModus') === 'ja';
    var visKnapp = erSys && !iSysmodus;

    // Selve inngangsknappen i topbar.
    settSynlig(document.getElementById('sysadminModeKnapp'), visKnapp);

    // Elementer som tidligere var bundet til systemadmin-only skal her styres av rolle.
    document.querySelectorAll('.sysadmin-entry, .systemadmin-only').forEach(function (el) {
      settSynlig(el, visKnapp);
    });

    // Menypunkter som bare skal synes når sysadminmodus er aktiv.
    document.querySelectorAll('.systemadmin-only').forEach(function (el) {
      var erSide = el.tagName === 'SECTION' || /Side$|Panel$/.test(el.id || '');
      if (!erSide) settSynlig(el, erSys && iSysmodus);
    });

    if (erSys) {
      window.erSystemadmin = true;
      window.erAdmin = true;
      localStorage.setItem('rilAdminModus', 'ja');
    }
  }

  function bindSysadmKnapp() {
    var b = document.getElementById('sysadminModeKnapp');
    if (!b || b.dataset.roleSysadmBound === '1') return;
    b.dataset.roleSysadmBound = '1';
    b.onclick = function (e) {
      if (e) e.preventDefault();
      localStorage.setItem('rilSysadminModus', 'ja');
      window.erSystemadmin = true;
      window.erAdmin = true;
      if (typeof window.handVisSysadminPanel === 'function') {
        window.handVisSysadminPanel();
      } else {
        if (typeof window.skjulAlleSider === 'function') window.skjulAlleSider();
        var app = document.getElementById('appSide');
        var panel = document.getElementById('sysadminPanelSide');
        settSynlig(app, true);
        settSynlig(panel, true);
      }
      setTimeout(visSysadmKnapp, 0);
      return false;
    };
  }

  function oppdater() {
    visSysadmKnapp();
    bindSysadmKnapp();
  }

  window.handOppdaterSysadmRolleVisning = oppdater;

  document.addEventListener('DOMContentLoaded', oppdater);
  document.addEventListener('handPartialerLastet', oppdater);
  window.addEventListener('storage', oppdater);

  // Flere eksisterende scripts skjuler knappen med setTimeout. Kjør derfor etter dem også.
  [0, 100, 300, 800, 1500, 3000].forEach(function (ms) { setTimeout(oppdater, ms); });
})();
