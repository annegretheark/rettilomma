/* RIL 2026-06-23: Admin-konsoll uten blink.
   - Admin-konsollen finnes ikke med innhold i start-HTML.
   - Den bygges først når innlogging/rolle er klar og brukeren trykker Admin-konsoll.
   - Ingen hardkodet e-post. Tilgang styres av rolle/adminflagg. */
(function(){
  'use strict';
  if (window.__rilAdminKonsollNoBlink) return;
  window.__rilAdminKonsollNoBlink = true;

  var SIDE_IDS = [
    'adminKonsollSide','timerSide','jobberSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide',
    'kundeSide','kunderSide','ansattSide','ansatteSide','firmaSide','bilBestillingerSide','testSide','lonnPanel',
    'fravaerSide','modulerSide','sysadminPanelSide'
  ];

  function el(id){ return document.getElementById(id); }
  function low(v){ return String(v == null ? '' : v).toLowerCase(); }
  function show(x){ if(!x) return; x.hidden=false; x.classList.remove('skjult','hidden','modul-skjult'); x.style.display=''; x.style.visibility=''; x.removeAttribute('aria-hidden'); }
  function hide(x){ if(!x) return; x.hidden=true; x.classList.add('skjult','hidden'); x.style.display='none'; x.setAttribute('aria-hidden','true'); }
  function hideAll(){ SIDE_IDS.forEach(function(id){ if(id !== 'adminKonsollSide') hide(el(id)); }); }
  function closeMenus(){ document.querySelectorAll('.meny-gruppe.apen').forEach(function(g){ g.classList.remove('apen'); }); }
  function title(t){ if (typeof window.settHandSideOverskrift === 'function') window.settHandSideOverskrift(t); }

  function roleText(){
    return [
      window.erAdmin, window.handErAdmin, window.adminmodus,
      window.innloggetRolle, window.handInnloggetRolle,
      localStorage.getItem('rolle'), localStorage.getItem('handRolle'),
      localStorage.getItem('innloggetRolle'), localStorage.getItem('rilRolle'),
      localStorage.getItem('rilAdminModus'), localStorage.getItem('adminmodus')
    ].map(low).join(' ');
  }

  function isAdmin(){
    var t = roleText();
    return window.erAdmin === true || window.handErAdmin === true ||
      t.indexOf('admin') >= 0 || t.indexOf('sysadmin') >= 0 ||
      t.indexOf('systemadmin') >= 0 || t.indexOf('adminmodus') >= 0 ||
      t.indexOf('ja') >= 0 || t.indexOf('true') >= 0;
  }

  function adminHtml(){
    return '<h2>Admin-konsoll</h2><p class="info">Velg område først. Da åpnes bare den delen du skal jobbe med.</p>'+
      '<div class="ril-admin-section-grid">'+
      '<div class="ril-admin-section-card"><h3>Kunde og salg</h3><p>Kunder, tilbud og fakturering.</p><div class="ril-admin-actions"><button type="button" data-ril-target="visKundeSide">Kunder</button><button type="button" data-ril-target="visTilbudSide">Tilbud</button><button type="button" data-ril-target="visFakturaSide">Faktura</button></div></div>'+
      '<div class="ril-admin-section-card"><h3>Drift</h3><p>Bestillinger, varer og lager.</p><div class="ril-admin-actions"><button type="button" data-ril-target="visBilBestillingerSide">Bestillinger</button><button type="button" data-ril-target="visVarerSide">Varer / lager</button></div></div>'+
      '<div class="ril-admin-section-card"><h3>Firma og ansatte</h3><p>Administrer ansatte, roller og firmadata.</p><div class="ril-admin-actions"><button type="button" data-ril-target="visAnsattSide">Ansatte</button><button type="button" data-ril-target="visFirmaSide">Firma</button></div></div>'+
      '<div class="ril-admin-section-card ril-admin-section-card-muted"><h3>System</h3><p>Backup og gjenoppretting. Brukes før større endringer.</p><div class="ril-admin-actions"><button type="button" data-ril-target="visBackupSide">Backup / restore</button></div></div>'+
      '</div>';
  }

  function ensureAdminKonsoll(){
    var side = el('adminKonsollSide');
    if(!side){
      var app = el('appSide') || document.body;
      side = document.createElement('section');
      side.id = 'adminKonsollSide';
      side.className = 'admin-only kort skjult ril-admin-konsoll';
      side.hidden = true;
      side.style.display = 'none';
      app.insertBefore(side, app.firstChild);
    }
    if(!side.getAttribute('data-ril-built')){
      side.innerHTML = adminHtml();
      side.setAttribute('data-ril-built','1');
    }
    return side;
  }

  function visAdminKonsollSide(ev){
    if(ev){
      if(ev.preventDefault) ev.preventDefault();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      else if(ev.stopPropagation) ev.stopPropagation();
    }
    if(!document.documentElement.classList.contains('ril-auth-ready') || !isAdmin()) { alert('Du har ikke tilgang til admin-konsoll.'); return false; }
    document.documentElement.classList.add('ril-admin-ready');
    show(el('appSide'));
    hideAll();
    show(ensureAdminKonsoll());
    title('Admin-konsoll');
    closeMenus();
    window.__rilAktivSide = 'adminKonsollSide';
    bindAdminActions();
    return false;
  }

  var oldSkjul = window.skjulArbeidssider;
  window.skjulArbeidssider = function(){
    if(window.__rilAktivSide === 'adminKonsollSide'){
      SIDE_IDS.forEach(function(id){ if(id !== 'adminKonsollSide') hide(el(id)); });
      show(ensureAdminKonsoll());
      return;
    }
    SIDE_IDS.forEach(function(id){ hide(el(id)); });
    if(typeof oldSkjul === 'function') oldSkjul();
  };
  window.skjulAlleSider = window.skjulArbeidssider;
  window.visAdminKonsollSide = visAdminKonsollSide;
  window.rilVisAdminKonsollSide = visAdminKonsollSide;

  function bindAdminActions(){
    document.querySelectorAll('#adminKonsollSide [data-ril-target]').forEach(function(btn){
      if(btn.dataset.rilBound === '1') return;
      btn.dataset.rilBound = '1';
      btn.addEventListener('click', function(){
        var fn = window[btn.getAttribute('data-ril-target')];
        window.__rilAktivSide = '';
        if(typeof fn === 'function') fn();
      });
    });
  }

  function bind(){
    var b = el('visAdminKonsollKnapp');
    if(b && b.dataset.rilAdminNoBlink !== '1'){
      b.dataset.rilAdminNoBlink = '1';
      b.addEventListener('click', visAdminKonsollSide, true);
      b.onclick = visAdminKonsollSide;
    }
  }

  document.addEventListener('DOMContentLoaded', bind);
  document.addEventListener('handPartialerLastet', bind);
  window.addEventListener('load', bind);
  setTimeout(bind, 100);
  setTimeout(bind, 800);
})();
