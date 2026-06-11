/* Veterinær meny - produksjon
   Viser/skjuler adminvalg. Oppsett-knappen har direkte HTML-kobling i index.html. */
(function () {
  function qs(id) { return document.getElementById(id); }
  function rolleTekst() { try { return String(window.vetKlinikkRolle || vetKlinikkRolle || '').toLowerCase(); } catch (e) { return ''; } }
  function epostTekst() { try { return String(window.vetInnloggetEpost || vetInnloggetEpost || '').toLowerCase(); } catch (e) { return ''; } }
  function erSystemadmin() {
    try { return window.vetErSystemAdmin === true || (typeof vetErSystemAdmin !== 'undefined' && vetErSystemAdmin === true) || epostTekst() === 'greknuts@online.no' || rolleTekst() === 'systemadmin'; }
    catch (e) { return false; }
  }
  function erAdmin() {
    try {
      if (erSystemadmin()) return true;
      const rolle = rolleTekst();
      if (rolle === 'admin' || rolle === 'klinikkadmin') return true;
      if (typeof erKlinikkAdmin === 'function' && erKlinikkAdmin()) return true;
    } catch (e) {}
    return false;
  }
  function vis(el, synlig, display) {
    if (!el) return;
    el.style.display = synlig ? (display || 'inline-block') : 'none';
    el.classList.toggle('skjult', !synlig);
  }
  window.toggleVetOppsettMeny = window.toggleVetOppsettMeny || function () {
    const m = qs('vetOppsettMeny');
    if (!m) return false;
    const open = m.style.display === 'block';
    m.style.display = open ? 'none' : 'block';
    m.classList.toggle('skjult', open);
    return false;
  };
  function oppdaterVetMeny() {
    const admin = erAdmin();
    const systemadmin = erSystemadmin();
    document.querySelectorAll('.vet-bruker-nav').forEach(el => vis(el, true));
    document.querySelectorAll('.vet-lagerlogg-nav').forEach(el => vis(el, true));
    document.querySelectorAll('.vet-faktura-nav').forEach(el => vis(el, true));
    document.querySelectorAll('.vet-admin-nav').forEach(el => vis(el, admin));
    document.querySelectorAll('.vet-systemadmin-nav').forEach(el => vis(el, systemadmin));
    document.querySelectorAll('.vet-oppsett-nav,.vet-admin-toggle').forEach(el => vis(el, admin));
    const meny = qs('vetOppsettMeny');
    if (meny && !admin) { meny.classList.add('skjult'); meny.style.display = 'none'; }
  }
  const opprinneligOppdater = window.oppdaterVetMenySynlighet || (typeof oppdaterVetMenySynlighet === 'function' ? oppdaterVetMenySynlighet : null);
  window.oppdaterVetMenySynlighet = function () {
    let r;
    if (opprinneligOppdater && opprinneligOppdater !== window.oppdaterVetMenySynlighet) {
      try { r = opprinneligOppdater.apply(this, arguments); } catch (e) { console.warn('Meny oppdatering:', e); }
    }
    oppdaterVetMeny();
    return r;
  };
  try { oppdaterVetMenySynlighet = window.oppdaterVetMenySynlighet; } catch (e) {}
  document.addEventListener('DOMContentLoaded', oppdaterVetMeny, { once: true });
  window.addEventListener('load', oppdaterVetMeny, { once: true });
  window.vetOppdaterMeny = oppdaterVetMeny;
})();
