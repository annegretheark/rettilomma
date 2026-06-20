/* Handverker - FORCE fix for kundelister i Moduler/Faktura
   Brukes når selectene blir tomme fordi gamle scripts fyller fra window.kunder = [].
   Denne henter kunder/firma direkte fra Supabase og setter både window.kunder og window.handAdminKunder.
*/
(function(){
  const SYS_EMAIL = 'greknuts@online.no';
  const TABLES = ['hand_firma','hand_kunde','hand_kunder','hand_ansatt'];
  const SELECT_IDS = ['modulKundeVelger','fakturaKundeValg','okonomiKundeValg','kundeValg'];
  function $(id){ return document.getElementById(id); }
  function norm(v){ return String(v||'').trim().toLowerCase(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function slugify(v){ return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function erSys(){
    const e = norm(window.innloggetEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('rettilommaSistEpost'));
    const r = norm(window.innloggetRolle || localStorage.getItem('handInnloggetRolle'));
    return window.erSystemadmin === true || e === SYS_EMAIL || r === 'sysadmin' || r === 'systemadmin';
  }
  function rowId(r){ return r.id || r.firma_id || r.firmaId || r.kunde_id || r.kundeId || r.uuid || r.uid || r.epost || r.email || slugify(label(r)); }
  function label(r){ return r.firmanavn || r.firma_navn || r.navn || r.name || r.company || r.kundenavn || r.kunde_navn || r.firma || r.epost || r.email || rowId(r) || 'Uten navn'; }
  function nr(r){ return r.kundenr || r.kunde_nr || r.kundenummer || r.nr || ''; }
  function normaliser(r, tabell){
    const x = Object.assign({}, r || {});
    x._hand_tabell = tabell || x._hand_tabell || '';
    if (tabell === 'hand_ansatt' && !x.navn) x.navn = x.firma_navn || x.firmanavn || x.epost || x.email || ('Firma ' + (x.firma_id || ''));
    if (!x.id) x.id = rowId(x);
    if (!x.firma_id) x.firma_id = x.id;
    if (!x.navn && x.firmanavn) x.navn = x.firmanavn;
    if (!x.firmanavn && x.navn) x.firmanavn = x.navn;
    if (!x.kundelink && !x.kunde_link) x.kundelink = '?firma=' + slugify(label(x));
    return x;
  }
  function unik(rows){
    const out=[], seen=new Set();
    (rows||[]).forEach(r => {
      const x = normaliser(r, r._hand_tabell);
      const key = String(rowId(x) || label(x));
      if (!key || seen.has(key)) return;
      seen.add(key); out.push(x);
    });
    out.sort((a,b)=>String(label(a)).localeCompare(String(label(b)),'nb'));
    return out;
  }
  function debugHost(){
    let b = $('kundelisteForceDebug');
    if (!b) {
      const host = $('modulStatus') || $('fakturaMelding') || $('handKundeAdminListe') || document.body;
      b = document.createElement('div');
      b.id = 'kundelisteForceDebug';
      b.style.cssText = 'margin:10px 0;padding:8px;border:1px solid #475569;border-radius:6px;background:#0f172a;color:#d1d5db;font-size:13px;white-space:pre-wrap';
      if (host.parentNode) host.parentNode.insertBefore(b, host.nextSibling); else document.body.appendChild(b);
    }
    return b;
  }
  function debug(lines){ const b=debugHost(); if(b) b.innerHTML = '<b>Kundeliste status</b>\n' + esc(lines.join('\n')); }
  async function hentFra(tabell, lines){
    if (!window.supabaseClient) return [];
    try{
      let q = window.supabaseClient.from(tabell).select('*');
      const r = await q.limit(1000);
      if (r.error) { lines.push(tabell + ': FEIL - ' + r.error.message); return []; }
      const data = Array.isArray(r.data) ? r.data : [];
      lines.push(tabell + ': ' + data.length + ' rader');
      return data.map(x => normaliser(x, tabell));
    }catch(e){ lines.push(tabell + ': FEIL - ' + (e.message || e)); return []; }
  }
  async function hentKunderForce(){
    const lines = [];
    lines.push('sysadmin: ' + erSys());
    lines.push('epost: ' + (window.innloggetEpost || localStorage.getItem('handInnloggetEpost') || '(ukjent)'));
    if (!window.supabaseClient) { lines.push('supabaseClient mangler'); debug(lines); return []; }
    let rows = [];
    for (const t of TABLES) rows = rows.concat(await hentFra(t, lines));
    ['handAdminKunder','kunder','firmaer','handFirmaer'].forEach(n => {
      if (Array.isArray(window[n]) && window[n].length) { lines.push('window.'+n+': '+window[n].length+' rader'); rows = rows.concat(window[n].map(x => normaliser(x, 'window.'+n))); }
    });
    const kunder = unik(rows).filter(k => label(k) && label(k) !== 'Uten navn');
    lines.push('valgbare kunder: ' + kunder.length);
    if (!kunder.length) lines.push('Ingen rader kan leses av innlogget bruker. Sjekk RLS: greknuts/sysadmin må ha SELECT på hand_firma eller hand_ansatt.');
    debug(lines);
    window.handAdminKunder = kunder;
    window.kunder = kunder;
    window.firmaer = kunder;
    return kunder;
  }
  function fyll(select, kunder){
    if (!select) return;
    const valgt = select.value || '';
    const isOko = select.id === 'okonomiKundeValg';
    const first = isOko ? 'Alle kunder' : (kunder.length ? 'Velg kunde' : 'Ingen kunder funnet');
    select.innerHTML = '<option value="">'+esc(first)+'</option>';
    kunder.forEach(k => {
      const opt = document.createElement('option');
      opt.value = String(rowId(k) || '');
      const n = nr(k);
      opt.textContent = (n ? n + ' - ' : '') + label(k);
      opt.dataset.tabell = k._hand_tabell || '';
      try { opt.dataset.rad = JSON.stringify(k); } catch(e) {}
      select.appendChild(opt);
    });
    if (valgt && Array.from(select.options).some(o => o.value === valgt)) select.value = valgt;
  }
  async function fyllAlle(){
    const kunder = await hentKunderForce();
    SELECT_IDS.forEach(id => fyll($(id), kunder));
    const ms = $('modulStatus') || $('modulMelding');
    if (ms && $('modulKundeVelger')) ms.textContent = kunder.length ? 'Fant ' + kunder.length + ' kunder/firma.' : 'Ingen kunder ble hentet.';
    const fm = $('fakturaMelding');
    if (fm && $('fakturaKundeValg')) fm.textContent = kunder.length ? 'Fant ' + kunder.length + ' kunder/firma.' : 'Ingen kunder ble hentet.';
    return kunder;
  }
  window.handHentAlleKunderRobust = hentKunderForce;
  window.handFyllSysadminKundeVelgere = fyllAlle;
  window.fyllFakturaKundeDropdown = fyllAlle;
  window.fyllOkonomiKundeValg = fyllAlle;
  window.fyllKundeDropdown = fyllAlle;
  const gammelLast = window.handLastKundeliste;
  window.handLastKundeliste = async function(){
    const kunder = await fyllAlle();
    const liste = $('handKundeAdminListe');
    if (liste) {
      if (!kunder.length) { liste.innerHTML = '<div class="info">Ingen kunder kan leses. Se Kundeliste status.</div>'; return; }
      liste.innerHTML = '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Firma</th><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">E-post</th><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Kilde</th></tr></thead><tbody>' + kunder.map(k => '<tr><td style="padding:6px;border-bottom:1px solid #374151">'+esc(label(k))+'</td><td style="padding:6px;border-bottom:1px solid #374151">'+esc(k.epost||k.email||'')+'</td><td style="padding:6px;border-bottom:1px solid #374151">'+esc(k._hand_tabell||'')+'</td></tr>').join('') + '</tbody></table></div>';
    } else if (typeof gammelLast === 'function') {
      try { return gammelLast.apply(this, arguments); } catch(e) {}
    }
  };
  function start(){
    [50,250,800,1600,3000].forEach(ms => setTimeout(fyllAlle, ms));
    let n=0;
    const timer=setInterval(()=>{ n++; const need=SELECT_IDS.some(id => { const s=$(id); return s && s.options.length <= 1; }); if(need) fyllAlle(); if(n>30) clearInterval(timer); }, 1000);
  }
  document.addEventListener('DOMContentLoaded', start);
  document.addEventListener('handPartialerLastet', start);
  window.addEventListener('load', start);
  document.addEventListener('click', e => {
    const txt = String(e.target && (e.target.id || e.target.textContent || '')).toLowerCase();
    if (txt.includes('faktura') || txt.includes('modul') || txt.includes('kunde') || txt.includes('admin')) setTimeout(fyllAlle, 150);
  });
})();
