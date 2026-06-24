/* RIL 2026-06-22 EMPLOYEE LOCK firmafilter
   Viser ALDRI alle kunder for vanlig ansatt/bruker.
   Finner firma_id fra hand_ansatt ELLER hand_firma_bruker.
   Lastes sist i index.html.
*/
(function(){
  'use strict';

    const SELECT_IDS = ['kundeValg','fakturaKundeValg'];
  const CACHE_KEY = 'rilSikkerFirmaId';

  function norm(v){ return String(v || '').trim().toLowerCase(); }
  function has(v){ return v !== undefined && v !== null && String(v).trim() !== ''; }
  function $(id){ return document.getElementById(id); }

  async function getAuthUser(){
    try { return (await window.supabaseClient.auth.getUser()).data.user || null; }
    catch(e){ return null; }
  }

  async function sessionEmail(){
    const u = await getAuthUser();
    const e = norm(u && u.email);
    if (e) return e;
    return norm(window.innloggetEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('rettilommaSistEpost') || localStorage.getItem('innloggetEpost'));
  }

  async function isTrueSysadmin(){
    const rolle = norm(window.innloggetRolle || localStorage.getItem('handInnloggetRolle') || localStorage.getItem('innloggetRolle'));
    return window.erSystemadmin === true || rolle === 'sysadmin' || rolle === 'systemadmin';
  }

  async function ryddeFeilSysadminFlagg(){
    if (await isTrueSysadmin()) return;
    window.erSystemadmin = false;
    if (norm(localStorage.getItem('handInnloggetRolle')) === 'sysadmin' || norm(localStorage.getItem('handInnloggetRolle')) === 'systemadmin') {
      localStorage.setItem('handInnloggetRolle', 'bruker');
    }
    localStorage.setItem('rilSysadminModus', 'nei');
  }

  function storeFirmaId(id){
    if (!has(id)) return '';
    id = String(id).trim();
    window.aktivFirmaId = id;
    window.handFirmaId = id;
    localStorage.setItem(CACHE_KEY, id);
    localStorage.setItem('aktivFirmaId', id);
    localStorage.setItem('handFirmaId', id);
    localStorage.setItem('firmaId', id);
    localStorage.setItem('firma_id', id);
    return id;
  }

  async function firmaIdFraAnsatt(){
    if (!window.supabaseClient) return '';
    const email = await sessionEmail();
    const user = await getAuthUser();
    const uid = user && user.id;
    const ansattId = window.innloggetAnsattId || localStorage.getItem('innloggetAnsattId') || localStorage.getItem('ansattId') || '';

    const attempts = [];
    if (ansattId) attempts.push(['id','eq',ansattId]);
    if (uid) attempts.push(['user_id','eq',uid], ['auth_id','eq',uid]);
    if (email) attempts.push(['epost','eq',email], ['email','eq',email], ['epost','ilike',email], ['email','ilike',email]);

    for (const [field,op,value] of attempts) {
      try {
        let q = window.supabaseClient.from('hand_ansatt').select('id,firma_id,epost,email,user_id,auth_id').limit(1);
        q = op === 'ilike' ? q.ilike(field, value) : q.eq(field, value);
        const r = await q;
        const row = !r.error && Array.isArray(r.data) && r.data.length ? r.data[0] : null;
        if (row && has(row.firma_id)) return storeFirmaId(row.firma_id);
      } catch(e) {}
    }
    return '';
  }

  async function firmaIdFraFirmaBruker(){
    if (!window.supabaseClient) return '';
    const user = await getAuthUser();
    const uid = user && user.id;
    const email = await sessionEmail();
    const attempts = [];
    if (uid) attempts.push(['user_id','eq',uid], ['auth_id','eq',uid], ['bruker_id','eq',uid]);
    if (email) attempts.push(['epost','eq',email], ['email','eq',email], ['epost','ilike',email], ['email','ilike',email]);

    for (const [field,op,value] of attempts) {
      try {
        let q = window.supabaseClient.from('hand_firma_bruker').select('firma_id').limit(1);
        q = op === 'ilike' ? q.ilike(field, value) : q.eq(field, value);
        const r = await q;
        const row = !r.error && Array.isArray(r.data) && r.data.length ? r.data[0] : null;
        if (row && has(row.firma_id)) return storeFirmaId(row.firma_id);
      } catch(e) {}
    }
    return '';
  }

  async function firmaIdFraEierRadBareAdmin(){
    if (!window.supabaseClient) return '';
    const email = await sessionEmail();
    if (!email) return '';
    const tabeller = ['hand_firma', 'hand_kunder', 'hand_kunde'];
    const epostFelter = ['admin_epost','epost','email','kontakt_epost'];
    for (const tabell of tabeller) {
      for (const felt of epostFelter) {
        try {
          const r = await window.supabaseClient.from(tabell).select('*').ilike(felt, email).limit(1);
          const row = !r.error && Array.isArray(r.data) && r.data.length ? r.data[0] : null;
          if (row) return storeFirmaId(row.firma_id || row.kunde_id || row.id);
        } catch(e) {}
      }
    }
    return '';
  }

  async function sikkerFirmaId(){
    await ryddeFeilSysadminFlagg();

    if (await isTrueSysadmin()) {
      const valgt = window.aktivFirmaId || window.handFirmaId || localStorage.getItem(CACHE_KEY) || localStorage.getItem('aktivFirmaId') || localStorage.getItem('handFirmaId') || localStorage.getItem('firmaId') || localStorage.getItem('firma_id') || '';
      return has(valgt) ? storeFirmaId(valgt) : '';
    }

    // Viktig rekkefolge: ekte kobling i databasen forst, lokal cache sist.
    const fraAnsatt = await firmaIdFraAnsatt();
    if (fraAnsatt) return fraAnsatt;

    const fraFirmaBruker = await firmaIdFraFirmaBruker();
    if (fraFirmaBruker) return fraFirmaBruker;

    const fraEierRad = await firmaIdFraEierRadBareAdmin();
    if (fraEierRad) return fraEierRad;

    const cached = localStorage.getItem(CACHE_KEY) || localStorage.getItem('aktivFirmaId') || localStorage.getItem('handFirmaId') || localStorage.getItem('firmaId') || localStorage.getItem('firma_id') || '';
    return has(cached) ? storeFirmaId(cached) : '';
  }

  function visIngen(select, tekst){
    if (!select) return;
    select.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = tekst || 'Ingen kunder funnet';
    select.appendChild(opt);
  }

  function fyllSelect(select, rows){
    if (!select) return;
    const valgt = select.value || '';
    select.innerHTML = '';
    const tom = document.createElement('option');
    tom.value = '';
    tom.textContent = rows.length ? 'Velg kunde' : 'Ingen kunder funnet';
    select.appendChild(tom);
    rows.forEach(k => {
      const opt = document.createElement('option');
      opt.value = String(k.id || '');
      const nr = String(k.kundenr || k.kunde_nr || '').trim();
      const navn = String(k.navn || k.firmanavn || k.kunde_navn || 'Uten navn').trim();
      opt.textContent = nr ? (nr + ' - ' + navn) : navn;
      opt.dataset.firmaId = String(k.firma_id || '');
      opt.dataset.kundenr = nr;
      select.appendChild(opt);
    });
    if (valgt && Array.from(select.options).some(o => o.value === valgt)) select.value = valgt;
  }

  async function hentKunderSikkert(){
    if (!window.supabaseClient) return [];
    const firmaId = await sikkerFirmaId();
    if (!has(firmaId)) {
      window.kunder = [];
      window.prosjekter = [];
      return [];
    }

    try {
      const r = await window.supabaseClient
        .from('hand_kunde')
        .select('*')
        .eq('firma_id', firmaId)
        .order('navn', { ascending: true });
      if (r.error) throw r.error;
      const rows = (Array.isArray(r.data) ? r.data : []).filter(k => String(k.firma_id || '') === String(firmaId));
      window.kunder = rows;
      return rows;
    } catch(e) {
      console.error('EMPLOYEE LOCK: Feil ved henting av kunder:', e);
      window.kunder = [];
      return [];
    }
  }

  async function fyllKundeDropdownSikkert(){
    const firmaId = await sikkerFirmaId();
    if (!has(firmaId)) {
      SELECT_IDS.forEach(id => visIngen($(id), 'Innlogget bruker er ikke koblet til firma'));
      return [];
    }
    const rows = await hentKunderSikkert();
    SELECT_IDS.forEach(id => fyllSelect($(id), rows));
    const nr = $('kundeNrVisning');
    if (nr && !$('kundeValg')?.value) nr.value = '';
    return rows;
  }

  async function rensEksisterendeOptions(){
    const firmaId = await sikkerFirmaId();
    SELECT_IDS.forEach(id => {
      const s = $(id);
      if (!s) return;
      if (!has(firmaId)) return visIngen(s, 'Innlogget bruker er ikke koblet til firma');
      Array.from(s.options).forEach(o => {
        const ofirma = o.dataset && o.dataset.firmaId;
        if (o.value && has(ofirma) && String(ofirma) !== String(firmaId)) o.remove();
      });
    });
  }

  window.hentAktivFirmaId = sikkerFirmaId;
  window.hentFirmaIdForKundeTilgang = sikkerFirmaId;
  window.handHentFirmaKunderHardlock = hentKunderSikkert;
  window.fyllKundeDropdown = fyllKundeDropdownSikkert;
  window.fyllFakturaKundeDropdown = fyllKundeDropdownSikkert;
  window.lastKunder = async function(){
    const rows = await hentKunderSikkert();
    await fyllKundeDropdownSikkert();
    return rows;
  };

  async function start(){
    await fyllKundeDropdownSikkert();
    await rensEksisterendeOptions();
  }

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(start, 50); setTimeout(start, 400); setTimeout(start, 1200); setInterval(start, 2500); });
  document.addEventListener('handPartialerLastet', function(){ setTimeout(start, 50); setTimeout(start, 400); });
  window.addEventListener('load', function(){ setTimeout(start, 50); setTimeout(start, 600); });
  document.addEventListener('click', function(e){
    const t = norm(e.target && (e.target.id || e.target.textContent || ''));
    if (t.includes('timer') || t.includes('kunde') || t.includes('faktura') || t.includes('jobber')) setTimeout(start, 100);
  });
})();
