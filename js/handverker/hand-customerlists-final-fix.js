/*
  Handverker - kundeliste hard fix
  Fikser tom kundeliste i Moduler/Faktura ved å:
  - ikke kreve kolonnen id (bruker id/firma_id/kunde_id/epost/slug)
  - prøve flere mulige tabeller
  - vise synlig debug med antall rader / feil fra Supabase
  - fylle både Moduler, Faktura og Økonomi på nytt etter at gamle script har kjørt
*/
(function () {
  const SYS_EMAIL = 'greknuts@online.no';
  const TABLES = ['hand_firma', 'hand_kunde', 'hand_kunder', 'firma', 'kunder'];
  function $(id) { return document.getElementById(id); }
  function norm(v) { return String(v || '').trim().toLowerCase(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function slugify(v) { return String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function isSysadmin() {
    const epost = norm(window.innloggetEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('rettilommaSistEpost'));
    const rolle = norm(window.innloggetRolle || localStorage.getItem('handInnloggetRolle'));
    return window.erSystemadmin === true || epost === SYS_EMAIL || rolle === 'sysadmin' || rolle === 'systemadmin';
  }
  function rowId(k) { return k.id || k.firma_id || k.firmaId || k.kunde_id || k.kundeId || k.uuid || k.uid || k.epost || k.email || slugify(label(k)); }
  function label(k) { return k.firmanavn || k.firma_navn || k.navn || k.name || k.company || k.kundenavn || k.kunde_navn || k.epost || k.email || rowId(k) || 'Uten navn'; }
  function kundenr(k) { return k.kundenr || k.kunde_nr || k.kundenummer || k.nr || ''; }
  function normalizeRow(r, table) {
    const x = Object.assign({}, r || {});
    x._hand_tabell = table || x._hand_tabell || '';
    x._hand_id = rowId(x);
    if (!x.id && x._hand_id) x.id = x._hand_id;
    if (!x.navn && x.firmanavn) x.navn = x.firmanavn;
    if (!x.firmanavn && x.navn) x.firmanavn = x.navn;
    return x;
  }
  function uniqueRows(rows) {
    const seen = new Set();
    const out = [];
    (rows || []).forEach(r => {
      if (!r) return;
      const id = rowId(r);
      const key = String(id || JSON.stringify(r));
      if (seen.has(key)) return;
      seen.add(key);
      out.push(normalizeRow(r, r._hand_tabell));
    });
    out.sort((a,b) => String(label(a)).localeCompare(String(label(b)), 'nb'));
    return out;
  }
  function debugBox() {
    let box = $('kundelisteDebugBoks');
    const host = $('modulStatus') || $('fakturaMelding') || $('handKundeAdminListe') || document.body;
    if (!box && host) {
      box = document.createElement('div');
      box.id = 'kundelisteDebugBoks';
      box.style.cssText = 'margin:10px 0;padding:8px;border:1px solid #374151;border-radius:6px;background:#111827;color:#d1d5db;font-size:13px;white-space:pre-wrap';
      if (host.parentNode) host.parentNode.insertBefore(box, host.nextSibling); else document.body.appendChild(box);
    }
    return box;
  }
  function setDebug(lines) {
    const box = debugBox();
    if (box) box.innerHTML = '<b>Kundeliste debug</b>\n' + esc((lines || []).join('\n'));
  }
  async function sessionEmail() {
    try {
      const r = await window.supabaseClient?.auth?.getSession?.();
      return norm(r?.data?.session?.user?.email || window.innloggetEpost || localStorage.getItem('handInnloggetEpost'));
    } catch(e) { return norm(window.innloggetEpost || localStorage.getItem('handInnloggetEpost')); }
  }
  async function queryTable(table, debug) {
    try {
      const res = await window.supabaseClient.from(table).select('*').limit(1000);
      if (res && res.error) {
        debug.push(table + ': FEIL - ' + (res.error.message || JSON.stringify(res.error)));
        return [];
      }
      const data = Array.isArray(res?.data) ? res.data : [];
      debug.push(table + ': ' + data.length + ' rader');
      return data.map(r => normalizeRow(r, table));
    } catch (e) {
      debug.push(table + ': FEIL - ' + (e.message || e));
      return [];
    }
  }
  window.handHentAlleKunderRobust = async function () {
    const debug = [];
    const email = await sessionEmail();
    debug.push('app-bruker: ' + (window.innloggetEpost || localStorage.getItem('handInnloggetEpost') || '(ukjent)'));
    debug.push('Supabase Auth: ' + (email || '(ingen aktiv auth-session)'));
    debug.push('erSystemadmin: ' + String(isSysadmin()));
    if (!window.supabaseClient) { debug.push('supabaseClient mangler'); setDebug(debug); return []; }

    let alle = [];
    for (const t of TABLES) alle = alle.concat(await queryTable(t, debug));

    // Fallback: bruk allerede lastede globale lister hvis de finnes.
    ['handAdminKunder','kunder','firmaer','handFirmaer'].forEach(name => {
      if (Array.isArray(window[name]) && window[name].length) {
        debug.push('fallback window.' + name + ': ' + window[name].length + ' rader');
        alle = alle.concat(window[name].map(r => normalizeRow(r, 'window.' + name)));
      }
    });

    alle = uniqueRows(alle);
    debug.push('valgbare kunder etter rydding: ' + alle.length);
    if (!alle.length) debug.push('Hvis tabellene over viser 0 rader, ligger kundene i en annen tabell eller RLS blokkerer SELECT for aktiv Supabase Auth-bruker.');
    setDebug(debug);
    window.handAdminKunder = alle;
    return alle;
  };
  function fillSelect(select, kunder, firstText, includeNr) {
    if (!select) return;
    const old = select.value || '';
    select.innerHTML = '';
    const first = document.createElement('option');
    first.value = '';
    first.textContent = kunder.length ? firstText : 'Ingen kunder funnet';
    select.appendChild(first);
    kunder.forEach(k => {
      const opt = document.createElement('option');
      const id = rowId(k);
      opt.value = String(id || '');
      const nr = includeNr ? kundenr(k) : '';
      opt.textContent = nr ? nr + ' - ' + label(k) : label(k);
      opt.dataset.tabell = k._hand_tabell || '';
      opt.dataset.rad = JSON.stringify(k);
      select.appendChild(opt);
    });
    if (old && Array.from(select.options).some(o => o.value === old)) select.value = old;
  }
  window.handFyllSysadminKundeVelgere = async function () {
    const kunder = await window.handHentAlleKunderRobust();
    fillSelect($('modulKundeVelger'), kunder, 'Velg kunde/firma...', false);
    fillSelect($('fakturaKundeValg'), kunder, 'Velg kunde', true);
    fillSelect($('okonomiKundeValg'), kunder, 'Alle kunder', true);
    const modulStatus = $('modulStatus') || $('modulMelding');
    if (modulStatus && $('modulKundeVelger')) modulStatus.textContent = kunder.length ? 'Fant ' + kunder.length + ' kunder/firma.' : 'Ingen kunder ble hentet. Se Kundeliste debug under.';
    const fakturaMelding = $('fakturaMelding');
    if (fakturaMelding && $('fakturaKundeValg')) fakturaMelding.textContent = kunder.length ? 'Fant ' + kunder.length + ' kunder/firma.' : 'Ingen kunder ble hentet. Se Kundeliste debug under.';
    return kunder;
  };
  const gammelFyllFaktura = window.fyllFakturaKundeDropdown;
  window.fyllFakturaKundeDropdown = async function () {
    if (isSysadmin()) return window.handFyllSysadminKundeVelgere();
    if (typeof gammelFyllFaktura === 'function') return gammelFyllFaktura.apply(this, arguments);
    return window.handFyllSysadminKundeVelgere();
  };
  const gammelVisFaktura = window.visFakturaSide;
  if (typeof gammelVisFaktura === 'function') {
    window.visFakturaSide = function () {
      const r = gammelVisFaktura.apply(this, arguments);
      setTimeout(window.handFyllSysadminKundeVelgere, 100);
      setTimeout(window.handFyllSysadminKundeVelgere, 700);
      return r;
    };
  }
  function start() {
    [100,500,1200,2500].forEach(ms => setTimeout(window.handFyllSysadminKundeVelgere, ms));
    let n = 0;
    const timer = setInterval(() => {
      n++;
      const m = $('modulKundeVelger');
      const f = $('fakturaKundeValg');
      if ((m && m.options.length <= 1) || (f && f.options.length <= 1)) window.handFyllSysadminKundeVelgere();
      if (n >= 20) clearInterval(timer);
    }, 1000);
  }
  document.addEventListener('DOMContentLoaded', start);
  document.addEventListener('handPartialerLastet', start);
  window.addEventListener('load', start);
  document.addEventListener('click', function (e) {
    const txt = String(e.target && (e.target.textContent || e.target.id || '')).toLowerCase();
    if (txt.includes('faktura') || txt.includes('moduler') || txt.includes('admin') || txt.includes('kunde')) {
      setTimeout(window.handFyllSysadminKundeVelgere, 150);
      setTimeout(window.handFyllSysadminKundeVelgere, 800);
    }
  });
})();
