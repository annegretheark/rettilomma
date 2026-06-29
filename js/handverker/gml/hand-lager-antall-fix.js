/* Rett i Lomma - LAGER ANTALL FIX
   Fikser at hovedlager vises/importeres som 0.
   Ingen hardkodet bruker. Bruker hand_vare.lager_antall / antall / minimum_antall.
*/
(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }
  function esc(v){ return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
  function norm(s){ return String(s||'').toLowerCase().replace(/^\ufeff/,'').replaceAll(' ','').replaceAll('_','').replaceAll('-','').replaceAll('.','').replaceAll(':','').replaceAll('æ','ae').replaceAll('ø','o').replaceAll('å','a'); }
  function fixText(v){ return String(v ?? '').replace(/^\ufeff/,'').trim(); }
  function num(v){
    if (v === undefined || v === null || String(v).trim() === '') return null;
    let s = String(v).replaceAll(' ','').replaceAll('\u00a0','').replace(/kr/ig,'').replace(/nok/ig,'').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  function get(row, keys){
    const map = {};
    Object.keys(row || {}).forEach(k => { map[norm(k)] = row[k]; });
    for (const key of keys){
      const v = map[norm(key)];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return null;
  }
  function uuid(){
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch(e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  async function firmaId(){
    if (typeof window.hentAktivFirmaId === 'function') return window.hentAktivFirmaId();
    if (window.aktivFirmaId) return window.aktivFirmaId;
    if (window.handFirmaId) return window.handFirmaId;
    if (window.firmaData?.id) return window.firmaData.id;
    if (window.firma?.id) return window.firma.id;
    try {
      const auth = await supabaseClient.auth.getUser();
      const userId = auth?.data?.user?.id;
      if (!userId) return null;
      const res = await supabaseClient.from('hand_firma_bruker').select('firma_id').eq('user_id', userId).limit(1).maybeSingle();
      return res.data?.firma_id || null;
    } catch(e){ return null; }
  }
  function msg(t, err){
    const el = $('importBilLagerMelding') || $('bilMelding') || $('vareMelding');
    if (el){ el.textContent = t || ''; el.style.color = err ? '#fca5a5' : '#86efac'; }
    if (err) console.error(t); else if (t) console.log(t);
  }

  async function readRows(file){
    if (typeof XLSX === 'undefined') throw new Error('XLSX-biblioteket er ikke lastet.');
    const buffer = await file.arrayBuffer();
    const name = String(file.name || '').toLowerCase();
    let workbook;
    if (name.endsWith('.csv')){
      let text = new TextDecoder('utf-8').decode(buffer);
      if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buffer);
      workbook = XLSX.read(text, { type:'string', raw:false });
    } else {
      workbook = XLSX.read(buffer, { type:'array', raw:false });
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval:'', raw:false });
  }

  function mapRow(row){
    const varenr = fixText(get(row, ['varenr','vare nr','vare_nr','artikkel','artikkelnr','artikkelnummer','produktnr','produktnummer','sku']));
    const navn = fixText(get(row, ['navn','varenavn','vare navn','vare','produkt','beskrivelse','tekst','description']));
    if (!varenr && !navn) return null;

    const lagerRaw = get(row, ['lager_antall','lager antall','hovedlager','hoved lager','på lager','pa lager','på hovedlager','pa hovedlager','lager','beholdning','antall','qty','quantity','stock']);
    const minRaw = get(row, ['minimum_antall','minimum antall','min hovedlager','min. hovedlager','minimum','min','min antall']);
    const innpris = num(get(row, ['innpris','inn pris','kostpris','nettopris','pris inn'])) ?? 0;
    const utpris = num(get(row, ['utpris','ut pris','pris','utsalgspris','salgspris','pris ut'])) ?? 0;
    const mva = num(get(row, ['mva_sats','mva_prosent','mva','vat'])) ?? 25;

    const out = {
      varenr: varenr || null,
      navn: navn || varenr,
      beskrivelse: fixText(get(row, ['beskrivelse','tekst','description'])) || null,
      innpris: innpris,
      pris: utpris,
      utpris: utpris,
      mva: mva,
      mva_sats: mva,
      mva_prosent: mva,
      aktiv: true,
      paslag_faktor: num(get(row, ['paslag_faktor','påslag','paslag','faktor'])) ?? 3
    };
    const lager = num(lagerRaw);
    if (lager !== null) { out.lager_antall = Math.round(lager); out.antall = Math.round(lager); }
    const min = num(minRaw);
    if (min !== null) out.minimum_antall = Math.round(min);
    return out;
  }

  async function importerVarerFraBilLagerFix(){
    try {
      const input = $('importBilLagerFil');
      const file = input?.files?.[0];
      if (!file) { msg('Velg CSV- eller Excel-fil først.', true); return; }
      if (!window.supabaseClient) { msg('Supabase er ikke lastet.', true); return; }
      msg('Leser lagerfil...', false);
      const rows = (await readRows(file)).map(mapRow).filter(Boolean);
      const fid = await firmaId();
      if (!fid) { msg('Fant ikke firma_id. Kan ikke importere.', true); return; }
      if (!rows.length) { msg('Fant ingen varer i filen.', true); return; }
      let saved = 0, errors = [];
      for (const r of rows){
        r.firma_id = fid;
        let existing = null;
        if (r.varenr){
          const check = await supabaseClient.from('hand_vare').select('id,lager_antall,antall,minimum_antall').eq('varenr', r.varenr).eq('firma_id', fid).limit(1).maybeSingle();
          if (check.error) { errors.push((r.varenr||r.navn)+': '+check.error.message); continue; }
          existing = check.data || null;
        }
        // Viktig: hvis lagerkolonne mangler i importfilen, behold gammel beholdning i stedet for å sette 0.
        if (existing){
          if (r.lager_antall === undefined) { delete r.lager_antall; delete r.antall; }
          if (r.minimum_antall === undefined) delete r.minimum_antall;
          const res = await supabaseClient.from('hand_vare').update(r).eq('id', existing.id).select('id').single();
          if (res.error) errors.push((r.varenr||r.navn)+': '+res.error.message); else saved++;
        } else {
          if (r.lager_antall === undefined) { r.lager_antall = 0; r.antall = 0; }
          if (r.minimum_antall === undefined) r.minimum_antall = 0;
          const res = await supabaseClient.from('hand_vare').insert([{ id: uuid(), ...r }]).select('id').single();
          if (res.error) errors.push((r.varenr||r.navn)+': '+res.error.message); else saved++;
        }
      }
      if (!saved){ msg('0 varer ble lagret. ' + (errors[0] || ''), true); return; }
      msg('Lagret ' + saved + ' varer. Oppdaterer liste...', false);
      await hentOgTegnBilFyllelisteFraDatabaseFix();
    } catch(e){ msg('Import feilet: ' + (e.message || String(e)), true); console.error(e); }
  }

  async function hentOgTegnBilFyllelisteFraDatabaseFix(){
    const c = $('bilLagerFyllListe');
    if (!c || !window.supabaseClient) return;
    c.innerHTML = '<p class="info">Henter varer fra hovedlager...</p>';
    const fid = await firmaId();
    let q = supabaseClient.from('hand_vare').select('id, varenr, navn, beskrivelse, innpris, pris, utpris, lager_antall, antall, minimum_antall, mva, mva_sats, mva_prosent, firma_id').limit(1000);
    if (fid) q = q.eq('firma_id', fid);
    const res = await q;
    if (res.error){ c.innerHTML = '<p class="melding">Kunne ikke hente varer: '+esc(res.error.message)+'</p>'; return; }
    const varer = (res.data || []).sort((a,b)=>String(a.varenr||a.navn||'').localeCompare(String(b.varenr||b.navn||''),'no'));
    window.varerTilBilLager = varer;
    if (!varer.length){ c.innerHTML = '<p class="melding">Ingen varer i hovedlager.</p>'; return; }
    const lager = v => Number(v.lager_antall ?? v.antall ?? 0);
    const min = v => Number(v.minimum_antall ?? 0);
    const inn = v => Number(v.innpris ?? 0);
    const ut = v => Number(v.utpris ?? v.pris ?? 0);
    const mva = v => Number(v.mva_prosent ?? v.mva_sats ?? v.mva ?? 25);
    c.innerHTML = `<div class="info" style="margin:8px 0 6px 0; font-weight:bold;">${varer.length} varer klare for fylling av bil</div>
      <div style="overflow:auto; max-height:460px; border:1px solid #374151; border-radius:10px; margin-top:8px;">
      <table class="bil-tabell"><thead><tr><th>Varenr</th><th>Vare</th><th>Innpris</th><th>Utpris</th><th>Hovedlager</th><th>Min. hovedlager</th><th>MVA</th><th>Antall til bil</th><th>Min. på bil</th></tr></thead><tbody>
      ${varer.map(v => `<tr class="klikkbar-bilrad"><td>${esc(v.varenr||'')}</td><td>${esc(v.navn||v.beskrivelse||'Vare')}</td><td>${esc(inn(v).toFixed(2))}</td><td>${esc(ut(v).toFixed(2))}</td><td style="font-weight:bold;">${esc(lager(v))}</td><td>${esc(min(v))}</td><td>${esc(mva(v))}%</td><td><input class="bil-lager-antall-liste" data-vare-id="${esc(v.id)}" type="number" step="1" min="0" value="" placeholder="0"></td><td><input class="bil-lager-min-liste" data-vare-id="${esc(v.id)}" type="number" step="1" min="0" value="" placeholder="0"></td></tr>`).join('')}
      </tbody></table></div>`;
  }

  function bind(){
    window.importerVarerFraBilLager = importerVarerFraBilLagerFix;
    window.hentOgTegnBilFyllelisteFraDatabase = hentOgTegnBilFyllelisteFraDatabaseFix;
    const importBtn = $('importBilLagerKnapp') || $('importVarerTilBilKnapp') || $('importHovedlagerKnapp');
    if (importBtn) importBtn.onclick = importerVarerFraBilLagerFix;
    const hentBtn = $('hentFyllelisteFraDbKnapp');
    if (hentBtn) hentBtn.onclick = hentOgTegnBilFyllelisteFraDatabaseFix;
  }
  document.addEventListener('DOMContentLoaded', () => { bind(); setTimeout(bind,300); setTimeout(bind,1200); });
  window.addEventListener('load', () => { bind(); setTimeout(bind,500); });
})();
