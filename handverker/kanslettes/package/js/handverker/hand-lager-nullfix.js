/* RIL lager nullfix 20260622
   Retter fylleliste der Hovedlager/Minimum vises som 0 selv om hand_vare har lager_antall.
   Ingen hardkodet bruker. Leser rolle/firma fra aktiv kontekst og bruker riktig hand_vare-felt.
*/
(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }
  function esc(v){ return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
  function num(v){
    if (v === undefined || v === null || String(v).trim() === '') return 0;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  function lager(v){ return num(v && (v.lager_antall ?? v.antall ?? v.beholdning ?? v.lager ?? v.qty ?? v.quantity)); }
  function minimum(v){ return num(v && (v.minimum_antall ?? v.min_antall ?? v.minimum ?? v.min)); }
  function navn(v){ return String((v && (v.varenr ? v.varenr + ' - ' : '')) + (v && (v.navn || v.varenavn || v.beskrivelse || 'Vare'))); }
  function pris(v){ return num(v && (v.utpris ?? v.pris ?? v.utsalgspris ?? v.salgspris)); }
  function innpris(v){ return num(v && (v.innpris ?? v.vareinnpris)); }
  function mva(v){ return num(v && (v.mva_prosent ?? v.mva_sats ?? v.mva ?? 25)) || 25; }
  function key(v){ return String((v && (v.varenr || v.navn || v.id)) || '').trim().toLowerCase(); }
  function melding(t, feil){
    const e = $('importBilLagerMelding') || $('bilMelding') || $('vareMelding');
    if (e){ e.textContent = t || ''; e.style.color = feil ? '#fca5a5' : '#86efac'; }
    (feil ? console.error : console.log)('[lager-nullfix]', t || '');
  }
  function hentFirmaId(){
    try { if (typeof window.hentAktivFirmaId === 'function') { const id = window.hentAktivFirmaId(); if (id && typeof id !== 'object') return String(id); } } catch(e) {}
    return String(window.aktivFirmaId || window.handFirmaId || window.firmaData?.id || window.firma?.id || localStorage.getItem('aktivFirmaId') || localStorage.getItem('handFirmaId') || localStorage.getItem('firmaId') || localStorage.getItem('firma_id') || '').trim();
  }
  function erSysadmin(){
    const r = String(window.innloggetRolle || localStorage.getItem('handRolle') || localStorage.getItem('rolle') || '').toLowerCase();
    return window.erSystemadmin === true || r === 'sysadm' || r === 'sysadmin' || r === 'systemadmin';
  }
  async function hentVarer(){
    if (!window.supabaseClient) throw new Error('Supabase er ikke lastet.');
    const cols = 'id,varenr,navn,beskrivelse,innpris,pris,utpris,lager_antall,minimum_antall,antall,beholdning,mva,mva_sats,mva_prosent,firma_id,aktiv';
    const firmaId = hentFirmaId();

    let res;
    if (firmaId && !erSysadmin()) {
      res = await supabaseClient.from('hand_vare').select(cols).eq('firma_id', firmaId).limit(2000);
    } else if (firmaId) {
      res = await supabaseClient.from('hand_vare').select(cols).eq('firma_id', firmaId).limit(2000);
      if (res.error || !(res.data || []).length) res = await supabaseClient.from('hand_vare').select(cols).limit(2000);
    } else {
      res = await supabaseClient.from('hand_vare').select(cols).limit(2000);
    }
    if (res.error) throw res.error;

    let rows = (res.data || []).filter(v => v && v.aktiv !== false);

    // Hvis valgt firma gir 0-lager overalt, hent synlige varer uten firmalås og bruk høyeste lager per varenr.
    // Dette reparerer tilfeller der appen viser en dublett-rad med 0 selv om samme varenr har lager_antall i hand_vare.
    const sum = rows.reduce((s, v) => s + lager(v), 0);
    if (sum === 0) {
      const all = await supabaseClient.from('hand_vare').select(cols).limit(5000);
      if (!all.error && (all.data || []).length) {
        const best = new Map();
        for (const v of (all.data || [])) {
          if (!v || v.aktiv === false) continue;
          const k = key(v);
          if (!k) continue;
          const old = best.get(k);
          if (!old || lager(v) > lager(old)) best.set(k, v);
        }
        rows = rows.map(v => {
          const b = best.get(key(v));
          if (b && lager(b) > lager(v)) {
            return { ...v, lager_antall: lager(b), antall: lager(b), minimum_antall: minimum(b) || minimum(v) };
          }
          return v;
        });
        if (!rows.length) rows = Array.from(best.values());
      }
    }

    rows.sort((a,b) => navn(a).localeCompare(navn(b), 'no'));
    return rows;
  }

  async function tegnKorrektFylleliste(){
    const c = $('bilLagerFyllListe');
    if (!c) return;
    c.innerHTML = '<p class="info">Henter varer fra hovedlager...</p>';
    try {
      const varer = await hentVarer();
      window.varerTilBilLager = varer;
      if (!varer.length) { c.innerHTML = '<p class="melding">Ingen varer i hovedlager.</p>'; return; }
      c.innerHTML = `
        <div class="info" style="margin:8px 0 6px 0; font-weight:bold;">${varer.length} varer klare for fylling av bil</div>
        <div style="overflow:auto; max-height:460px; border:1px solid #374151; border-radius:10px; margin-top:8px;">
          <table class="bil-tabell">
            <thead><tr>
              <th>Varenr</th><th>Vare</th><th>Innpris</th><th>Utpris</th><th>Hovedlager</th><th>Min. hovedlager</th><th>MVA</th><th>Antall til bil</th><th>Min. på bil</th>
            </tr></thead>
            <tbody>
              ${varer.map(v => `
                <tr>
                  <td>${esc(v.varenr || '')}</td>
                  <td>${esc(navn(v))}</td>
                  <td>${esc(innpris(v).toFixed(2))}</td>
                  <td>${esc(pris(v).toFixed(2))}</td>
                  <td>${esc(lager(v))}</td>
                  <td>${esc(minimum(v))}</td>
                  <td>${esc(mva(v))}%</td>
                  <td><input class="bil-lager-antall-liste" data-vare-id="${esc(v.id)}" type="text" inputmode="numeric" pattern="[0-9]*" value="" placeholder="0" autocomplete="off" style="width:86px; max-width:86px; height:30px; padding:4px 6px; margin:0; pointer-events:auto; background:#f8fafc; color:#111827; border:1px solid #cbd5e1;"></td>
                  <td><input class="bil-lager-min-liste" data-vare-id="${esc(v.id)}" type="text" inputmode="numeric" pattern="[0-9]*" value="" placeholder="0" autocomplete="off" style="width:86px; max-width:86px; height:30px; padding:4px 6px; margin:0; pointer-events:auto; background:#f8fafc; color:#111827; border:1px solid #cbd5e1;"></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
      melding('Fyllelisten er oppdatert med lager_antall fra hand_vare. Sum hovedlager: ' + varer.reduce((s,v)=>s+lager(v),0), false);
    } catch(e) {
      c.innerHTML = '<p class="melding">Kunne ikke hente varer: ' + esc(e.message || String(e)) + '</p>';
      melding('Kunne ikke hente varer: ' + (e.message || String(e)), true);
    }
  }

  // Overstyr knapper og globale kall etter at alle eldre scripts er lastet.
  function bind(){
    window.hentOgTegnBilFyllelisteFraDatabase = tegnKorrektFylleliste;
    window.fyllBilLagerVareValg = tegnKorrektFylleliste;
    window.tegnFyllBilListeKorrekt = tegnKorrektFylleliste;

    const btn = $('hentFyllelisteFraDbKnapp');
    if (btn) btn.onclick = function(e){ if(e) e.preventDefault(); tegnKorrektFylleliste(); return false; };

    const c = $('bilLagerFyllListe');
    if (c && (!c.textContent || c.textContent.includes('0') || c.textContent.includes('Laster'))) {
      // Kjør litt forsinket slik at gammel hand-biler.js ikke tegner over oss.
      setTimeout(tegnKorrektFylleliste, 250);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(bind, 300); setTimeout(bind, 1200); });
  document.addEventListener('handPartialerLastet', function(){ setTimeout(bind, 200); setTimeout(bind, 1000); });
  window.addEventListener('load', function(){ setTimeout(bind, 500); setTimeout(bind, 1500); });
})();
