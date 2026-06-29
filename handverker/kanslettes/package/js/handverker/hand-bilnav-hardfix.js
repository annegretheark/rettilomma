
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
