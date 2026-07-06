/* RIL FINAL 20260622: lager_antall=0 skal ikke skjule faktisk antall.
   Bruker antall/beholdning som fallback hvis lager_antall er 0 eller mangler. */
(function(){
  "use strict";
  function n(v){ const x = Number(String(v ?? "0").replace(",",".")); return Number.isFinite(x) ? x : 0; }
  function hoved(v){ const la=n(v&&v.lager_antall), a=n(v&&v.antall), b=n(v&&v.beholdning); return la>0 ? la : (a>0 ? a : (b>0 ? b : la)); }
  function min(v){ const m=n(v&&v.minimum_antall), mm=n(v&&v.min_antall); return m>0 ? m : mm; }
  window.vareHovedlager = function(v){ return hoved(v); };
  window.vareMinimum = function(v){ return min(v); };
  function repareRows(){
    if (Array.isArray(window.varerTilBilLager)) {
      window.varerTilBilLager.forEach(v => {
        if (!v) return;
        const h = hoved(v);
        if (h > 0 && n(v.lager_antall) === 0) v.lager_antall = h;
        if (min(v) > 0 && n(v.minimum_antall) === 0) v.minimum_antall = min(v);
      });
    }
  }
  const origTegn = window.tegnFyllBilListe;
  if (typeof origTegn === "function" && !origTegn.rilAntallFinalFix) {
    const wrapped = function(){ repareRows(); return origTegn.apply(this, arguments); };
    wrapped.rilAntallFinalFix = true;
    window.tegnFyllBilListe = wrapped;
  }
  const origHent = window.hentOgTegnBilFyllelisteFraDatabase;
  if (typeof origHent === "function" && !origHent.rilAntallFinalFix) {
    const wrappedHent = async function(){ const r = await origHent.apply(this, arguments); repareRows(); if (typeof window.tegnFyllBilListe === "function") window.tegnFyllBilListe(); return r; };
    wrappedHent.rilAntallFinalFix = true;
    window.hentOgTegnBilFyllelisteFraDatabase = wrappedHent;
  }
  document.addEventListener("DOMContentLoaded", function(){ setTimeout(repareRows,100); setTimeout(function(){ repareRows(); if(typeof window.tegnFyllBilListe==="function") window.tegnFyllBilListe(); },700); });
  window.addEventListener("load", function(){ setTimeout(function(){ repareRows(); if(typeof window.tegnFyllBilListe==="function") window.tegnFyllBilListe(); },1200); });
})();
