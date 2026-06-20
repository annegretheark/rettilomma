/*
  Faktura kundeliste sysadmin fix
  - Fyller fakturaKundeValg fra hand_firma/hand_kunder for sysadmin.
  - Bruker samme adaptive henting som systemadmin-listen.
  - Overstyrer tom kundeliste fra vanlig hand-kunder.js.
*/
(function () {
  const SYS_EMAIL = 'greknuts@online.no';
  function norm(v) { return String(v || '').trim().toLowerCase(); }
  function $(id) { return document.getElementById(id); }
  function erSysadmin() {
    return window.erSystemadmin === true ||
      norm(window.innloggetEpost || localStorage.getItem('handInnloggetEpost')) === SYS_EMAIL ||
      norm(window.innloggetRolle || localStorage.getItem('handInnloggetRolle')) === 'sysadmin';
  }
  function navn(k) {
    return k.navn || k.firmanavn || k.firma_navn || k.company || k.epost || k.email || k.id || '';
  }
  function nr(k) {
    return k.kundenr || k.kunde_nr || k.kundenummer || '';
  }
  async function hentAlleFirmaAdaptive() {
    if (!window.supabaseClient) return [];
    const forsok = [
      ['hand_firma', '*', 'navn'],
      ['hand_firma', '*', 'firmanavn'],
      ['hand_firma', '*', null],
      ['hand_kunde', '*', 'navn'],
      ['hand_kunde', '*', 'firmanavn'],
      ['hand_kunde', '*', 'kunde_navn'],
      ['hand_kunde', '*', null],
      ['hand_kunder', '*', 'navn'],
      ['hand_kunder', '*', 'firmanavn'],
      ['hand_kunder', '*', null]
    ];
    for (const f of forsok) {
      try {
        let q = window.supabaseClient.from(f[0]).select(f[1]);
        if (f[2]) q = q.order(f[2], { ascending: true });
        const r = await q;
        if (!r.error && Array.isArray(r.data) && r.data.length) {
          window.handAdminKunder = r.data;
          return r.data;
        }
      } catch (e) {}
    }
    return Array.isArray(window.handAdminKunder) ? window.handAdminKunder : [];
  }
  window.handHentFakturaKunder = async function () {
    if (erSysadmin()) {
      if (Array.isArray(window.handAdminKunder) && window.handAdminKunder.length) return window.handAdminKunder;
      return await hentAlleFirmaAdaptive();
    }
    if (Array.isArray(window.kunder) && window.kunder.length) return window.kunder;
    if (typeof window.lastKunder === 'function') {
      try { await window.lastKunder(); } catch (e) { console.warn('Kunne ikke laste vanlige kunder:', e); }
    }
    return Array.isArray(window.kunder) ? window.kunder : [];
  };
  window.handFyllFakturaKundeDropdownRobust = async function () {
    const valg = $('fakturaKundeValg');
    if (!valg) return [];
    const gammel = valg.value || localStorage.getItem('handSysadminFakturaKundeId') || '';
    const kunder = await window.handHentFakturaKunder();
    valg.innerHTML = '';
    const tom = document.createElement('option');
    tom.value = '';
    tom.textContent = kunder.length ? 'Velg kunde' : 'Ingen kunder funnet';
    valg.appendChild(tom);
    kunder.forEach(function (kunde) {
      if (!kunde || !kunde.id) return;
      const opt = document.createElement('option');
      opt.value = kunde.id;
      const kundenr = nr(kunde);
      const kundenavn = navn(kunde);
      opt.textContent = kundenr ? kundenr + ' - ' + kundenavn : kundenavn;
      valg.appendChild(opt);
    });
    if (gammel && Array.from(valg.options).some(o => String(o.value) === String(gammel))) {
      valg.value = gammel;
    }
    const melding = $('fakturaMelding');
    if (melding && erSysadmin() && !kunder.length) {
      melding.textContent = 'Ingen kunder/firma ble hentet. Sjekk at hand_firma har rader og at sysadmin har select-rettighet i Supabase/RLS.';
    }
    return kunder;
  };

  const gammelFyll = window.fyllFakturaKundeDropdown;
  window.fyllFakturaKundeDropdown = function () {
    if (erSysadmin()) return window.handFyllFakturaKundeDropdownRobust();
    if (typeof gammelFyll === 'function') return gammelFyll.apply(this, arguments);
    return window.handFyllFakturaKundeDropdownRobust();
  };

  const gammelVis = window.visFakturaSide;
  if (typeof gammelVis === 'function') {
    window.visFakturaSide = function () {
      const res = gammelVis.apply(this, arguments);
      setTimeout(window.handFyllFakturaKundeDropdownRobust, 100);
      setTimeout(window.handFyllFakturaKundeDropdownRobust, 600);
      return res;
    };
  }
  function init() {
    const side = $('fakturaSide');
    const synlig = side && !side.classList.contains('skjult') && side.style.display !== 'none';
    if (synlig || erSysadmin()) setTimeout(window.handFyllFakturaKundeDropdownRobust, 100);
  }
  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('handPartialerLastet', init);
  window.addEventListener('load', init);
})();
