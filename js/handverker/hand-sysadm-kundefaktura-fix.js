/*
  Sysadmin kundefaktura fix
  - Sysadmin/greknuts skal ikke ha vanlig Faktura-knapp som egen bruker.
  - Faktura for sysadmin startes fra valgt kunde/firma i sysadmin-listen.
*/
(function () {
  const SYS_EMAIL = 'greknuts@online.no';

  function norm(v) { return String(v || '').trim().toLowerCase(); }
  function $(id) { return document.getElementById(id); }
  function erSysadmin() {
    return window.erSystemadmin === true ||
      norm(window.innloggetEpost || localStorage.getItem('handInnloggetEpost')) === SYS_EMAIL ||
      norm(localStorage.getItem('handInnloggetRolle') || window.innloggetRolle) === 'sysadmin';
  }

  function skjulVanligFakturaForSysadmin() {
    const knapp = $('visFakturaKnapp');
    if (!knapp) return;
    if (erSysadmin()) {
      knapp.style.display = 'none';
      knapp.classList.add('skjult');
      knapp.title = 'Sysadmin lager faktura fra valgt kunde/firma i Systemadministrasjon.';
    } else if (window.erAdmin === true) {
      knapp.classList.remove('skjult');
      knapp.style.display = '';
      knapp.title = '';
    }
  }

  async function sikreKunderLastet() {
    if (Array.isArray(window.kunder) && window.kunder.length) return window.kunder;
    if (typeof window.lastKunder === 'function') {
      try { await window.lastKunder(); } catch (e) { console.warn('Kunne ikke laste kunder:', e); }
    }
    return Array.isArray(window.kunder) ? window.kunder : [];
  }

  function finnKunde(kundeId) {
    const id = String(kundeId || '');
    const alle = [];
    if (Array.isArray(window.kunder)) alle.push(...window.kunder);
    if (Array.isArray(window.handAdminKunder)) alle.push(...window.handAdminKunder);
    return alle.find(k =>
      String(k.id || '') === id ||
      String(k.kundenr || '') === id ||
      String(k.kunde_nr || '') === id
    ) || null;
  }

  function settFakturaKunde(kundeId) {
    const valg = $('fakturaKundeValg');
    if (!valg || !kundeId) return false;
    const id = String(kundeId);
    let finnes = Array.from(valg.options || []).some(o => String(o.value) === id);

    if (!finnes) {
      const kunde = finnKunde(id);
      if (kunde) {
        const opt = document.createElement('option');
        opt.value = kunde.id || id;
        opt.textContent = `${kunde.kundenr || kunde.kunde_nr || kunde.id || ''} ${kunde.navn || kunde.firmanavn || kunde.firma_navn || ''}`.trim();
        valg.appendChild(opt);
        finnes = true;
      }
    }

    valg.value = id;
    return finnes;
  }

  window.handFakturaForKunde = async function (kundeId) {
    if (!erSysadmin()) {
      alert('Bare sysadmin kan bruke kundefaktura her.');
      return;
    }
    if (!kundeId) {
      alert('Velg kunde/firma først.');
      return;
    }

    localStorage.setItem('handSysadminFakturaKundeId', String(kundeId));
    await sikreKunderLastet();

    if (typeof window.skjulAlleSider === 'function') window.skjulAlleSider();
    const app = $('appSide');
    const side = $('fakturaSide');
    if (app) { app.classList.remove('skjult', 'hidden'); app.style.display = ''; }
    if (side) { side.classList.remove('skjult', 'hidden'); side.style.display = ''; }

    if (typeof window.fyllFakturaKundeDropdown === 'function') {
      try { window.fyllFakturaKundeDropdown(); } catch (e) { console.warn(e); }
    }
    if (typeof window.fyllOkonomiKundeValg === 'function') {
      try { window.fyllOkonomiKundeValg(); } catch (e) { console.warn(e); }
    }

    setTimeout(function () {
      settFakturaKunde(kundeId);
      const melding = $('fakturaMelding');
      const kunde = finnKunde(kundeId);
      if (melding) {
        melding.textContent = 'Sysadmin: faktura gjelder kun valgt kunde/firma' + (kunde ? ': ' + (kunde.navn || kunde.firmanavn || kunde.firma_navn || kunde.epost || '') : '') + '.';
      }
    }, 150);
  };

  function leggFakturaKnapperIKundeliste() {
    if (!erSysadmin()) return;
    const liste = $('handKundeAdminListe');
    if (!liste || liste.dataset.kundefakturaPatch === '1') return;
    liste.dataset.kundefakturaPatch = '1';
    liste.addEventListener('click', function (e) {
      const btn = e.target && e.target.closest ? e.target.closest('[data-hand-faktura-kunde]') : null;
      if (!btn) return;
      e.preventDefault();
      window.handFakturaForKunde(btn.getAttribute('data-hand-faktura-kunde'));
    });
  }

  function patchKundelisteHtml() {
    if (!erSysadmin()) return;
    const liste = $('handKundeAdminListe');
    if (!liste) return;
    const rader = liste.querySelectorAll('tbody tr');
    rader.forEach((tr, idx) => {
      if (tr.querySelector('[data-hand-faktura-kunde]')) return;
      const kunde = (window.handAdminKunder || [])[idx];
      if (!kunde || !kunde.id) return;
      const siste = tr.querySelector('td:last-child');
      if (!siste) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'secondary';
      btn.setAttribute('data-hand-faktura-kunde', kunde.id);
      btn.textContent = 'Faktura til kunde';
      btn.style.marginLeft = '6px';
      siste.appendChild(btn);
    });
  }

  const gammelVisKundeliste = window.handLastKundeliste;
  if (typeof gammelVisKundeliste === 'function') {
    window.handLastKundeliste = async function () {
      const res = await gammelVisKundeliste.apply(this, arguments);
      setTimeout(function () { leggFakturaKnapperIKundeliste(); patchKundelisteHtml(); }, 100);
      return res;
    };
  }

  const gammelVisFakturaSide = window.visFakturaSide;
  if (typeof gammelVisFakturaSide === 'function') {
    window.visFakturaSide = function () {
      if (erSysadmin()) {
        const valgt = localStorage.getItem('handSysadminFakturaKundeId') || '';
        if (!valgt) {
          alert('Sysadmin skal lage faktura fra valgt kunde/firma i Systemadministrasjon, ikke fra vanlig Faktura-knapp.');
          if (typeof window.handVisSysadminPanel === 'function') window.handVisSysadminPanel();
          return;
        }
      }
      return gammelVisFakturaSide.apply(this, arguments);
    };
  }

  function init() {
    skjulVanligFakturaForSysadmin();
    leggFakturaKnapperIKundeliste();
    patchKundelisteHtml();
  }

  document.addEventListener('DOMContentLoaded', function () { init(); setTimeout(init, 500); setTimeout(init, 1500); });
  document.addEventListener('handPartialerLastet', function () { init(); setTimeout(init, 500); });
  window.addEventListener('load', function () { init(); setTimeout(init, 500); });
  setInterval(skjulVanligFakturaForSysadmin, 1500);
})();
