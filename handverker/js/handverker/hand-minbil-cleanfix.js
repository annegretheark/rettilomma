
/* RIL 20260705: Stabil vanlig-bruker Min bil.
   - Rører ikke vare-/lagerfunksjonene, så varer på bil og priser fortsetter å komme fra original JS.
   - Fjerner sort skjerm fra gammel hand-role-locking.
   - Skjuler kun biladministrasjon for vanlig bruker.
   - Viser ett stabilt Min bil-kort basert på valgt bil i dropdown. */
(function () {
  'use strict';

  if (window.__rilMinBilCleanFix) return;
  window.__rilMinBilCleanFix = true;

  function $(id) { return document.getElementById(id); }
  function txt(v) { return String(v == null ? '' : v).trim(); }
  function low(v) { return txt(v).toLowerCase(); }
  function esc(v) {
    return txt(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function erAdmin() {
    var rolle = low(window.innloggetRolle || window.handInnloggetRolle || localStorage.getItem('handInnloggetRolle') || localStorage.getItem('innloggetRolle'));
    return window.erAdmin === true || localStorage.getItem('rilAdminModus') === 'ja' || ['admin','administrator','eier','owner','sysadm','sysadmin','systemadmin'].indexOf(rolle) !== -1;
  }

  function unlock() {
    var html = document.documentElement;
    html.classList.remove('hand-role-locking');
    html.classList.add('ril-role-ready', 'hand-role-ready', 'ril-auth-ready');
  }

  function markerRolle() {
    var html = document.documentElement;
    if (erAdmin()) html.classList.remove('ril-vanlig-bruker');
    else html.classList.add('ril-vanlig-bruker');
  }

  function valgtBilFraSelect() {
    var s = $('bilLagerBilValg') || $('bilValg') || $('lagerBilValg');
    if (!s || !s.value) return { id: '', tekst: '' };
    var opt = s.selectedOptions && s.selectedOptions[0] ? s.selectedOptions[0] : null;
    return { id: String(s.value), tekst: txt(opt ? opt.textContent : '') };
  }

  function valgtBilFallback() {
    return {
      id: localStorage.getItem('aktivBilId') || window.aktivBilId || '',
      tekst: localStorage.getItem('aktivBilNavn') || window.aktivBilNavn || ''
    };
  }

  function ensureMinBilKort() {
    var side = $('bilerSide');
    if (!side || erAdmin()) return null;

    var kort = $('rilMinBilKort');
    if (!kort) {
      kort = document.createElement('div');
      kort.id = 'rilMinBilKort';
      kort.style.cssText = 'margin:16px 0 18px 0;padding:12px;border:1px solid rgba(255,255,255,.18);border-radius:8px;';

      var hr = side.querySelector('hr');
      if (hr && hr.parentNode) hr.parentNode.insertBefore(kort, hr);
      else side.appendChild(kort);
    }
    return kort;
  }

  var lastHtml = '';
  var pending = false;

  function renderMinBilKort() {
    pending = false;
    unlock();
    markerRolle();

    if (erAdmin()) return;

    var side = $('bilerSide');
    if (!side) return;

    var kort = ensureMinBilKort();
    if (!kort) return;

    var valgt = valgtBilFraSelect();
    if (!valgt.id) valgt = valgtBilFallback();

    var tekst = valgt.tekst || 'Ingen bil valgt ennå';
    var html = '<h3 style="margin-top:0;">Min bil</h3>' +
      '<p class="info">Dette er bilen som er valgt for deg. Bruk feltet <strong>Bil som skal fylles</strong> under hvis du må fylle en annen bil.</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:1px solid rgba(255,255,255,.14);padding-top:10px;">' +
      '<div><strong>Valgt bil</strong><br>' + esc(tekst) + '</div>' +
      '<div><strong>ID</strong><br>' + esc(valgt.id || '-') + '</div>' +
      '</div>';

    if (html !== lastHtml) {
      kort.innerHTML = html;
      lastHtml = html;
    }
  }

  function scheduleRender() {
    if (pending) return;
    pending = true;
    setTimeout(renderMinBilKort, 60);
  }

  // Gammel kode kan legge på role-locking sent. Ta den bort uten å røre innholdet.
  [0, 100, 300, 700, 1500, 3000].forEach(function (ms) {
    setTimeout(function () { unlock(); markerRolle(); scheduleRender(); }, ms);
  });

  document.addEventListener('DOMContentLoaded', function () { unlock(); markerRolle(); scheduleRender(); });
  document.addEventListener('handPartialerLastet', function () { unlock(); markerRolle(); scheduleRender(); });
  window.addEventListener('load', function () { unlock(); markerRolle(); scheduleRender(); });

  document.addEventListener('change', function (e) {
    if (e.target && ['bilLagerBilValg','bilValg','lagerBilValg'].indexOf(e.target.id) !== -1) {
      scheduleRender();
    }
  }, true);

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('#visBilerKnapp,[data-role="ansatt-bil"]') : null;
    if (btn) setTimeout(scheduleRender, 120);
  }, true);

  try {
    var obs = new MutationObserver(function () { scheduleRender(); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
})();
