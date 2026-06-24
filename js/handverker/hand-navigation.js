/* Rett i Lomma - stabil navigasjon 7055
   Én navigasjon. Ingen adminKonsollSide som ikke finnes i HTML.
*/
(function () {
  const ARBEIDSSIDER = [
    "adminKonsollSide", "timerSide", "jobberSide", "tilbudSide", "backupSide", "fakturaSide", "varerSide", "bilerSide",
    "kundeSide", "ansattSide", "firmaSide", "bilBestillingerSide", "testSide", "lonnPanel", "fravaerSide", "modulerSide", "sysadminPanelSide"
  ];

  function hent(id) { return document.getElementById(id); }

  function visElement(id) {
    const el = hent(id);
    if (!el) return;
    el.classList.remove("hidden", "skjult", "modul-skjult");
    el.style.display = "";
  }

  function skjulElement(id) {
    const el = hent(id);
    if (!el) return;
    el.classList.add("hidden", "skjult");
    el.style.display = "none";
  }

  function lukkMenyer() {
    document.querySelectorAll(".meny-gruppe.apen").forEach(function (gruppe) {
      gruppe.classList.remove("apen");
    });
  }

  function oppdaterAdminVisning() {
    const admin = (typeof window.handErAdmin === "function" ? window.handErAdmin() : window.erAdmin === true);
    const sysadmin = (typeof window.handErSysadm === "function" ? window.handErSysadm() : window.erSystemadmin === true);

    if (document.body) {
      document.body.classList.toggle("ril-er-admin", admin);
      document.body.classList.toggle("ril-vanlig-bruker", !admin);
    }

    document.querySelectorAll(".admin-only").forEach(function (element) {
      if (admin) {
        element.classList.remove("hidden", "skjult");
        element.style.display = "";
      } else {
        element.classList.add("hidden", "skjult");
        element.style.display = "none";
      }
    });

    document.querySelectorAll(".systemadmin-only").forEach(function (element) {
      if (sysadmin) {
        element.classList.remove("hidden", "skjult");
        element.style.display = "";
      } else {
        element.classList.add("hidden", "skjult");
        element.style.display = "none";
      }
    });

    if (!admin) skjulElement("adminAnsattRad");

    if (typeof window.begrensBilLagerForVanligBruker === "function") {
      setTimeout(window.begrensBilLagerForVanligBruker, 20);
    }
  }

  function skjulArbeidssider() {
    ARBEIDSSIDER.forEach(skjulElement);
    skjulElement("adminAnsattRad");
  }

  function skjulAlleSider() { skjulArbeidssider(); }

  function krevAdmin(melding) {
    if (typeof window.handErAdmin === "function" ? window.handErAdmin() : window.erAdmin === true) return true;
    alert(melding || "Du har ikke tilgang til denne funksjonen.");
    return false;
  }

  function visSide(sideId) {
    var appSide = document.getElementById("appSide");
    if (appSide) appSide.classList.remove("ril-starter");
    visElement("appSide");
    skjulArbeidssider();
    visElement(sideId);
    lukkMenyer();
  }

  function visLogin() {
    visElement("loginSide");
    skjulElement("nyttPassordSide");
    skjulElement("appSide");
  }

  function visNyttPassord() {
    skjulElement("loginSide");
    visElement("nyttPassordSide");
    skjulElement("appSide");
  }

  function visAdminKonsollSide() {
    if (!krevAdmin("Du har ikke tilgang til admin-konsoll.")) return;
    if (typeof window.settHandSideOverskrift === "function") window.settHandSideOverskrift("Admin-konsoll");
    oppdaterAdminVisning();
    visSide("adminKonsollSide");
  }

  async function visApp() {
    skjulElement("loginSide");
    skjulElement("nyttPassordSide");
    visElement("appSide");
    oppdaterAdminVisning();

    if (typeof window.lastModulerFraDatabase === "function") await window.lastModulerFraDatabase();
    if (typeof window.oppdaterModulVisning === "function") window.oppdaterModulVisning();
    oppdaterAdminVisning();
    if (typeof window.lastKunder === "function") await window.lastKunder();
    if (typeof window.lastProsjekter === "function") await window.lastProsjekter();
    if (typeof window.lastAnsatte === "function") await window.lastAnsatte();
    if (typeof window.settDagensDato === "function") window.settDagensDato();
    if (typeof window.lastTimer === "function") await window.lastTimer();
    else if (typeof window.tegnTimer === "function") window.tegnTimer();
    if (typeof window.fyllFirmaSkjema === "function") window.fyllFirmaSkjema();
    if (typeof window.tegnFirmaInfo === "function") window.tegnFirmaInfo();

    visTimerSide();
  }

  function visTimerSide() {
    if (typeof window.settHandSideOverskrift === "function") window.settHandSideOverskrift("Timeregistrering");
    oppdaterAdminVisning();
    visSide("timerSide");
    if (typeof window.reparerBilvalg === "function") setTimeout(window.reparerBilvalg, 20);
    if (typeof window.handErAdmin === "function" ? window.handErAdmin() : window.erAdmin === true) {
      visElement("adminAnsattRad");
      if (typeof window.fyllAdminAnsattValg === "function") window.fyllAdminAnsattValg();
    } else {
      skjulElement("adminAnsattRad");
    }
  }


  function visJobberSide() {
    if (typeof window.settHandSideOverskrift === "function") window.settHandSideOverskrift("Jobber");
    oppdaterAdminVisning();
    visSide("jobberSide");
    if (typeof window.lastJobber === "function") setTimeout(window.lastJobber, 20);
  }

  function visTimerForAnsattSide() { visTimerSide(); }

  function visTilbudSide() {
    if (!krevAdmin("Du har ikke tilgang til tilbud.")) return;
    visSide("tilbudSide");
    if (typeof window.fyllTilbudKundeDropdown === "function") window.fyllTilbudKundeDropdown();
    if (typeof window.lastTilbud === "function") setTimeout(window.lastTilbud, 20);
  }

  function visFakturaSide() {
    if (!krevAdmin("Du har ikke tilgang til faktura.")) return;
    visSide("fakturaSide");
    if (typeof window.fyllOkonomiKundeValg === "function") window.fyllOkonomiKundeValg();
  }

  function visBackupSide() {
    if (!krevAdmin("Du har ikke tilgang til backup.")) return;
    visSide("backupSide");
  }

  function visVarerSide() {
    if (!krevAdmin("Du har ikke tilgang til varer.")) return;
    visSide("varerSide");
    if (typeof window.lastVarer === "function") setTimeout(window.lastVarer, 20);
  }

  function visBilerSide() {
    if (typeof window.settHandSideOverskrift === "function") window.settHandSideOverskrift("Min bil / fyll lager");
    // Vanlig bruker skal kunne fylle/vedlikeholde sin egen bil.
    // Admin ser hele bilregisteret/bil-lageret.
    oppdaterAdminVisning();
    visSide("bilerSide");
    if (typeof window.lastBiler === "function") setTimeout(window.lastBiler, 20);
    if (typeof window.lastBilLager === "function") setTimeout(window.lastBilLager, 20);
    if (typeof window.reparerBilvalg === "function") setTimeout(window.reparerBilvalg, 50);
    if (typeof window.fyllBilvalgTrygt === "function") setTimeout(window.fyllBilvalgTrygt, 100);
    if (typeof window.begrensBilLagerForVanligBruker === "function") setTimeout(window.begrensBilLagerForVanligBruker, 180);
  }

  async function visKundeSide() {
    if (!krevAdmin("Du har ikke tilgang til kunderegister.")) return;
    visSide("kundeSide");
    if (typeof window.lastKunder === "function") await window.lastKunder();
  }

  async function visAnsattSide() {
    if (!krevAdmin("Du har ikke tilgang til ansattregister.")) return;
    visSide("ansattSide");
    if (typeof window.tegnTrekkListe === "function") window.tegnTrekkListe();
    if (typeof window.lastAnsatte === "function") await window.lastAnsatte();
  }

  function visFirmaSide() {
    if (!krevAdmin("Du har ikke tilgang til firma.")) return;
    visSide("firmaSide");
    if (typeof window.lastFirma === "function") window.lastFirma();
    else if (typeof window.fyllFirmaSkjema === "function") window.fyllFirmaSkjema();
  }

  function visBilBestillingerSide() {
    if (!krevAdmin("Du har ikke tilgang til bilbestillinger.")) return;
    visSide("bilBestillingerSide");
    if (typeof window.handLastBilBestillinger === "function") setTimeout(window.handLastBilBestillinger, 20);
  }

  async function visLonnSide() {
    if (!krevAdmin("Du har ikke tilgang til lønn.")) return;
    visSide("lonnPanel");
    if (typeof window.lastAnsatte === "function") await window.lastAnsatte();
    else if (typeof window.fyllLonnAnsattValg === "function") window.fyllLonnAnsattValg(window.ansatte || []);
  }


  async function visFravaerSide() {
    oppdaterAdminVisning();
    visSide("fravaerSide");
    if (typeof window.lastFravaerFlexi === "function") await window.lastFravaerFlexi();
  }

  function visTestSide() {
    if (!krevAdmin("Du har ikke tilgang til testpanel.")) return;
    visSide("testSide");
  }

  function visModulerSide() {
    const email = String(window.innloggetEpost || localStorage.getItem("handInnloggetEpost") || "").toLowerCase();
    const sysadmin = (typeof window.handErSysadm === "function" ? window.handErSysadm() : window.erSystemadmin === true);
    if (!sysadmin) { alert("Moduler er kun for systemadmin."); return; }
    visSide("modulerSide");
    if (typeof window.lastModulerFraDatabase === "function") window.lastModulerFraDatabase();
    if (typeof window.tegnModulGui === "function") window.tegnModulGui();
  }

  function bindMeny(knappId) {
    const knapp = hent(knappId);
    if (!knapp || knapp.dataset.rilMenyBindet === "1") return;
    knapp.dataset.rilMenyBindet = "1";
    knapp.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      const gruppe = knapp.closest(".meny-gruppe");
      if (!gruppe) return;
      document.querySelectorAll(".meny-gruppe.apen").forEach(function (g) {
        if (g !== gruppe) g.classList.remove("apen");
      });
      gruppe.classList.toggle("apen");
    });
  }

  function bindKnapp(id, fn) {
    const knapp = hent(id);
    if (!knapp || knapp.dataset.rilNavBindet === "1") return;
    knapp.dataset.rilNavBindet = "1";
    knapp.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      fn();
    });
  }

  function bindNavigasjon() {
    bindMeny("adminMenyKnapp");
    bindMeny("lagerMenyKnapp");

    bindKnapp("visTimerKnapp", visTimerSide);
    bindKnapp("visJobberKnapp", visJobberSide);
    bindKnapp("visKundeKnapp", visKundeSide);
    bindKnapp("visTilbudKnapp", visTilbudSide);
    bindKnapp("visFakturaKnapp", visFakturaSide);
    bindKnapp("visLonnKnapp", visLonnSide);
    bindKnapp("visFravaerKnapp", visFravaerSide);
    bindKnapp("varerKnapp", visVarerSide);
    bindKnapp("visBilerKnapp", visBilerSide);
    bindKnapp("visAnsattKnapp", visAnsattSide);
    bindKnapp("visFirmaKnapp", visFirmaSide);
    bindKnapp("visBilBestillingerKnapp", visBilBestillingerSide);
    bindKnapp("visModulerKnapp", visModulerSide);
    bindKnapp("visBackupKnapp", visBackupSide);
    bindKnapp("visTestKnapp", visTestSide);

    document.addEventListener("click", function (event) {
      if (event.target && event.target.closest && event.target.closest(".meny-gruppe")) return;
      lukkMenyer();
    });
  }

  window.visLogin = visLogin;
  window.visNyttPassord = visNyttPassord;
  window.visApp = visApp;
  window.oppdaterAdminVisning = oppdaterAdminVisning;
  window.visTimerSide = visTimerSide;
  window.rilVisTimerSide = visTimerSide;
  window.visTimerForAnsattSide = visTimerForAnsattSide;
  window.visJobberSide = visJobberSide;
  window.rilVisTimerForAnsattSide = visTimerForAnsattSide;
  window.visAdminKonsollSide = visAdminKonsollSide;
  window.rilVisAdminKonsollSide = visAdminKonsollSide;
  window.visTilbudSide = visTilbudSide;
  window.visFakturaSide = visFakturaSide;
  window.visBackupSide = visBackupSide;
  window.visVarerSide = visVarerSide;
  window.visBilerSide = visBilerSide;
  window.visKundeSide = visKundeSide;
  window.visAnsattSide = visAnsattSide;
  window.visFirmaSide = visFirmaSide;
  window.visBilBestillingerSide = visBilBestillingerSide;
  window.visTestSide = visTestSide;
  window.visLonnSide = visLonnSide;
  window.visFravaerSide = visFravaerSide;
  window.visModulerSide = visModulerSide;
  window.skjulAlleSider = skjulAlleSider;
  window.skjulArbeidssider = skjulArbeidssider;
  window.visAdminKonsollHvisAdmin = function () {};

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindNavigasjon);
  } else {
    bindNavigasjon();
  }
  window.addEventListener("load", bindNavigasjon);
})();

/* RIL HARD FIX 20260623: Min bil / fyll lager skal alltid vise bil-lager, ikke timeregistrering */
(function(){
  function $(id){ return document.getElementById(id); }
  function show(el){ if(!el) return; el.classList.remove('hidden','skjult','modul-skjult'); el.style.display=''; el.removeAttribute('aria-hidden'); }
  function hide(el){ if(!el) return; el.classList.add('hidden','skjult'); el.style.display='none'; el.setAttribute('aria-hidden','true'); }
  var sideIds = ['timerSide','jobberSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','kundeSide','ansattSide','firmaSide','bilBestillingerSide','testSide','lonnPanel','fravaerSide','modulerSide','sysadminPanelSide'];
  function forceBilSide(){
    show($('appSide'));
    sideIds.forEach(function(id){ hide($(id)); });
    var biler = $('bilerSide');
    show(biler);
    var h1 = $('handSideOverskrift') || document.querySelector('#appSide h1');
    if(h1){ h1.textContent = 'Min bil / fyll lager'; h1.style.textAlign = 'center'; }
    if(biler){
      var h2 = biler.querySelector('h2');
      if(h2){ h2.textContent = 'Min bil / lager'; h2.style.textAlign = 'center'; h2.style.width = '100%'; }
    }
    if (typeof window.lastBiler === 'function') setTimeout(window.lastBiler, 10);
    if (typeof window.lastBilLager === 'function') setTimeout(window.lastBilLager, 20);
    if (typeof window.reparerBilvalg === 'function') setTimeout(window.reparerBilvalg, 30);
    if (typeof window.fyllBilvalgTrygt === 'function') setTimeout(window.fyllBilvalgTrygt, 40);
    if (typeof window.begrensBilLagerForVanligBruker === 'function') setTimeout(window.begrensBilLagerForVanligBruker, 60);
  }
  var gammelVisBilerSide = window.visBilerSide;
  window.visBilerSide = function(){
    try { if (typeof gammelVisBilerSide === 'function') gammelVisBilerSide.apply(this, arguments); } catch(e){ console.warn(e); }
    forceBilSide();
    setTimeout(forceBilSide, 50);
    setTimeout(forceBilSide, 200);
    return false;
  };
  document.addEventListener('click', function(e){
    var knapp = e.target && e.target.closest && e.target.closest('#visBilerKnapp');
    if(!knapp) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    window.visBilerSide();
    return false;
  }, true);
  document.addEventListener('handPartialerLastet', function(){
    var knapp = $('visBilerKnapp');
    if(knapp) knapp.textContent = 'Min bil / fyll lager';
  });
})();

/* RIL 2026-06-24: robust toppmeny for vanlig ansatt.
   Delegert klikk-handler virker selv om partials/knapper blir lastet etter at de gamle scriptbindene kjørte. */
(function(){
  if (window.__rilRobustAnsattToppmeny) return;
  window.__rilRobustAnsattToppmeny = true;

  var sideIds = [
    'timerSide','jobberSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide',
    'kundeSide','kunderSide','ansattSide','ansatteSide','firmaSide','bilBestillingerSide',
    'testSide','lonnPanel','lonnSide','fravaerSide','modulerSide','sysadminPanelSide','adminSide',
    'adminBilBestillinger','adminKonsollSide'
  ];

  function $(id){ return document.getElementById(id); }
  function show(el){
    if(!el) return;
    el.classList.remove('hidden','skjult','modul-skjult','ril-starter');
    el.hidden = false;
    el.style.display = '';
    el.removeAttribute('aria-hidden');
  }
  function hide(el){
    if(!el) return;
    el.classList.add('hidden','skjult');
    el.hidden = true;
    el.style.display = 'none';
    el.setAttribute('aria-hidden','true');
  }
  function closeMenus(){
    document.querySelectorAll('.meny-gruppe.apen,.meny-gruppe.open').forEach(function(g){
      g.classList.remove('apen','open');
      var b = g.querySelector('button[aria-expanded]');
      if(b) b.setAttribute('aria-expanded','false');
    });
  }
  function fallback(sideId, title){
    show($('appSide'));
    var app = $('appSide');
    if(app) app.classList.remove('ril-starter');
    sideIds.forEach(function(id){ hide($(id)); });
    show($(sideId));
    var h = $('handSideOverskrift') || document.querySelector('#appSide h1');
    if(h && title) h.textContent = title;
    closeMenus();
  }
  function callOrFallback(fnName, sideId, title){
    var app = $('appSide');
    if(app) app.classList.remove('ril-starter');
    var fn = window[fnName];
    if(typeof fn === 'function'){
      try { fn(); } catch(e){ console.warn('Navigasjon feilet, bruker fallback:', fnName, e); fallback(sideId, title); }
    } else {
      fallback(sideId, title);
    }
    setTimeout(function(){
      var side = $(sideId);
      if(!side || side.classList.contains('skjult') || side.style.display === 'none' || side.hidden) fallback(sideId, title);
    }, 60);
  }
  var map = {
    visTimerKnapp: ['visTimerSide','timerSide','Timeregistrering'],
    visJobberKnapp: ['visJobberSide','jobberSide','Jobber'],
    visFravaerKnapp: ['visFravaerSide','fravaerSide','Fravær / Flexi'],
    visBilerKnapp: ['visBilerSide','bilerSide','Min bil / fyll lager']
  };

  document.addEventListener('click', function(ev){
    var btn = ev.target && ev.target.closest ? ev.target.closest('#visTimerKnapp,#visJobberKnapp,#visFravaerKnapp,#visBilerKnapp') : null;
    if(!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    var m = map[btn.id];
    callOrFallback(m[0], m[1], m[2]);
    return false;
  }, true);

  function bindDirect(){
    Object.keys(map).forEach(function(id){
      var btn = $(id);
      if(!btn || btn.dataset.rilRobustAnsattBind === '1') return;
      btn.dataset.rilRobustAnsattBind = '1';
      btn.type = 'button';
      btn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        var m = map[id];
        callOrFallback(m[0], m[1], m[2]);
        return false;
      });
    });
  }
  document.addEventListener('handPartialerLastet', bindDirect);
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(bindDirect, 0); setTimeout(bindDirect, 300); });
  window.addEventListener('load', function(){ setTimeout(bindDirect, 0); setTimeout(bindDirect, 700); });
})();


/* RIL PROD 20260624 v7083: direkte produksjonsnavigasjon for Min bil / fyll lager.
   Denne er ikke en repair-fil. Den ligger i ordinær hand-navigation.js og eier ansattknappen. */
(function(){
  'use strict';
  if (window.__handMinBilProdNav7083) return;
  window.__handMinBilProdNav7083 = true;

  function $(id){ return document.getElementById(id); }
  function show(el){
    if(!el) return;
    el.hidden = false;
    el.style.display = '';
    el.style.visibility = 'visible';
    if(el.classList) el.classList.remove('skjult','hidden','modul-skjult','ril-starter');
    if(el.removeAttribute) el.removeAttribute('aria-hidden');
  }
  function hide(el){
    if(!el) return;
    el.hidden = true;
    el.style.display = 'none';
    if(el.classList) el.classList.add('skjult','hidden');
    if(el.setAttribute) el.setAttribute('aria-hidden','true');
  }
  var sider = ['timerSide','jobberSide','fravaerSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','kundeSide','kunderSide','ansattSide','ansatteSide','firmaSide','testSide','testpanelSide','lonnPanel','lonnSide','bilBestillingerSide','adminBilBestillinger','adminBilBestillingerPanel','modulerSide','sysadminPanelSide','adminSide','adminKonsollSide'];

  function ensureBilerSide(){
    var side = $('bilerSide');
    if(side) return side;
    var app = $('appSide') || document.body;
    side = document.createElement('section');
    side.id = 'bilerSide';
    side.className = 'kort';
    side.setAttribute('data-modul','biler');
    side.innerHTML = '<h2>Min bil / lager</h2><div id="bilMelding" class="melding"></div><div id="bilLagerListe"></div><div id="bilLagerFyllListe"></div>';
    app.appendChild(side);
    return side;
  }

  function initBiler(){
    ['lastBiler','lastBilLager','lastBilerOgBilLager','handLastBiler','fyllAlleBilvalg','fyllBilvalg','fyllBilvalgTrygt','begrensBilLagerForVanligBruker','fyllBilLagerVareValg','fyllVarevalgFraAktivBil'].forEach(function(fn){
      if(typeof window[fn] === 'function') {
        setTimeout(function(){ try { window[fn](); } catch(e) { console.warn('Min bil init feilet:', fn, e); } }, 20);
      }
    });
  }

  function openMinBil(e){
    if(e){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    var app = $('appSide');
    show(app);
    if(app){ app.classList.remove('ril-starter','skjult','hidden'); app.hidden=false; app.style.display=''; }
    sider.forEach(function(id){ if(id !== 'bilerSide') hide($(id)); });
    var side = ensureBilerSide();
    show(side);
    var h = $('handSideOverskrift') || document.querySelector('#appSide h1');
    if(h) h.textContent = 'Min bil / fyll lager';
    var h2 = side.querySelector('h2');
    if(h2) h2.textContent = 'Min bil / lager';
    initBiler();
    [50,150,400].forEach(function(ms){ setTimeout(function(){ show(app); if(app) app.classList.remove('ril-starter'); show(side); }, ms); });
    return false;
  }

  window.handOpenMinBilHard = openMinBil;
  window.handOpenMinBil = openMinBil;

  document.addEventListener('click', function(e){
    var b = e.target && e.target.closest ? e.target.closest('#visBilerKnapp,[data-role="ansatt-bil"]') : null;
    if(!b) return;
    return openMinBil(e);
  }, true);

  function bind(){
    var b = $('visBilerKnapp');
    if(!b) return;
    b.type = 'button';
    b.textContent = 'Min bil / fyll lager';
    b.setAttribute('data-modul','biler');
    b.setAttribute('data-role','ansatt-bil');
    b.onclick = openMinBil;
    show(b);
  }
  document.addEventListener('handPartialerLastet', function(){ bind(); setTimeout(bind,100); });
  document.addEventListener('DOMContentLoaded', function(){ bind(); setTimeout(bind,100); setTimeout(bind,700); });
  window.addEventListener('load', function(){ bind(); setTimeout(bind,300); setTimeout(bind,1200); });
})();
