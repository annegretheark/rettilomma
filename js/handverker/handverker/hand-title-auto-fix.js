(function () {
  function synlig(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    var st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && !el.classList.contains('skjult') && !el.classList.contains('hidden') && !el.classList.contains('modul-skjult');
  }

  function settOverskrift() {
    var h = document.getElementById('handSideOverskrift');
    if (!h) return;
    h.style.textAlign = 'center';
    h.style.width = '100%';

    if (synlig('bilerSide')) h.textContent = 'Min bil / fyll lager';
    else if (synlig('timerSide')) h.textContent = 'Timeregistrering';
    else if (synlig('jobberSide')) h.textContent = 'Jobber';
    else if (synlig('fravaerSide')) h.textContent = 'Fravær / Flexi';
    else if (synlig('tilbudSide')) h.textContent = 'Tilbud';
    else if (synlig('fakturaSide')) h.textContent = 'Faktura';
    else if (synlig('varerSide')) h.textContent = 'Varer';
    else if (synlig('kundeSide')) h.textContent = 'Kunder';
    else if (synlig('ansattSide')) h.textContent = 'Ansatte';
    else if (synlig('firmaSide')) h.textContent = 'Firma';
    else if (synlig('lonnPanel')) h.textContent = 'Lønn';
    else if (synlig('modulerSide')) h.textContent = 'Moduler';
  }

  window.handOppdaterOverskrift = settOverskrift;

  function pakkFunksjon(navn, tittel) {
    var gammel = window[navn];
    if (typeof gammel !== 'function' || gammel.__overskriftFix) return;
    var ny = function () {
      var svar = gammel.apply(this, arguments);
      setTimeout(function () {
        var h = document.getElementById('handSideOverskrift');
        if (h && tittel) h.textContent = tittel;
        settOverskrift();
      }, 30);
      setTimeout(settOverskrift, 150);
      return svar;
    };
    ny.__overskriftFix = true;
    window[navn] = ny;
  }

  function installer() {
    pakkFunksjon('visBilerSide', 'Min bil / fyll lager');
    pakkFunksjon('visTimerSide', 'Timeregistrering');
    pakkFunksjon('visJobberSide', 'Jobber');
    pakkFunksjon('visFravaerSide', 'Fravær / Flexi');
    pakkFunksjon('visTilbudSide', 'Tilbud');
    pakkFunksjon('visFakturaSide', 'Faktura');
    pakkFunksjon('visVarerSide', 'Varer');
    pakkFunksjon('visKundeSide', 'Kunder');
    pakkFunksjon('visAnsattSide', 'Ansatte');
    pakkFunksjon('visFirmaSide', 'Firma');
    settOverskrift();
  }

  document.addEventListener('DOMContentLoaded', installer);
  document.addEventListener('handPartialerLastet', installer);
  window.addEventListener('load', installer);
  setTimeout(installer, 1000); setTimeout(installer, 3000);
  setTimeout(settOverskrift, 500); setTimeout(settOverskrift, 2000);
})();
