/* ===== LAGERLOGG SUPERTRYGG - VIS ALLE BILER 09.06 ===== */
(function(){
  const LOGG_TABELL = 'vet_lager_logg';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const heltall = v => String(Math.round(Number(v || 0)));

  function steder(){
    return ['lagerLoggListe','lagerLoggListeFane','lagerLoggListeStor','minBilLoggListe']
      .map($).filter(Boolean);
  }

  function parseKommentar(kommentar){
    const t = String(kommentar || '').trim();
    if (!t) return { vare:'', bil:'', handling:'' };

    // Eksempel: Fylte 3 Klorhexidin 2% vask på Bil nr1 - ab45666
    const m = t.match(/^(?:Fylte|La|Flyttet)\s+\d+(?:[,.]\d+)?\s+(.+?)\s+p[åa]\s+(.+)$/i);
    if (m) return { vare:m[1].trim(), bil:m[2].trim(), handling:t };

    const m2 = t.match(/\d+(?:[,.]\d+)?\s+(.+?)\s+p[åa]\s+(.+)$/i);
    if (m2) return { vare:m2[1].trim(), bil:m2[2].trim(), handling:t };

    return { vare:'', bil:'', handling:t };
  }

  async function hentMap(tabell, ids, felt){
    const map = new Map();
    const unike = [...new Set((ids || []).filter(Boolean).map(String))];
    if (!window.supabaseClient || !unike.length) return map;

    // Supabase/PostgREST har URL-lengde, så del opp hvis listen blir lang.
    for (let i = 0; i < unike.length; i += 50) {
      const chunk = unike.slice(i, i + 50);
      const { data, error } = await window.supabaseClient
        .from(tabell)
        .select(felt)
        .in('id', chunk);
      if (error) {
        console.warn('Kunne ikke hente navn fra ' + tabell + ':', error.message);
        continue;
      }
      (data || []).forEach(r => map.set(String(r.id), r));
    }
    return map;
  }

  async function hentLogg(){
    if (!window.supabaseClient) return [];

    let q = window.supabaseClient
      .from(LOGG_TABELL)
      .select('id,created_at,klinikk_id,bil_id,vare_id,antall,opprettet_av_epost,opprettet_av_navn,kommentar')
      .order('created_at', { ascending:false })
      .limit(200);

    // Bare klinikkfilter, aldri bilfilter. Lagerloggen skal vise alle biler.
    if (window.vetAktivKlinikkId && window.vetErSystemAdmin !== true) {
      q = q.eq('klinikk_id', window.vetAktivKlinikkId);
    }

    const { data, error } = await q;
    if (error) throw error;

    const rader = data || [];
    const bilMap = await hentMap('vet_biler', rader.map(r => r.bil_id), 'id,navn,regnr');
    const vareMap = await hentMap('vet_varer', rader.map(r => r.vare_id), 'id,navn,enhet');

    return rader.map(r => {
      const p = parseKommentar(r.kommentar);
      const b = bilMap.get(String(r.bil_id || ''));
      const v = vareMap.get(String(r.vare_id || ''));
      const bilNavn = [b?.navn, b?.regnr].filter(Boolean).join(' - ') || p.bil || 'Ukjent bil';
      const vareNavn = v?.navn || p.vare || 'Ukjent vare';
      return {
        ...r,
        bil_navn: bilNavn,
        vare_navn: vareNavn,
        enhet: v?.enhet || 'stk',
        handling: p.handling || `${vareNavn} på ${bilNavn}`
      };
    });
  }

  function render(rader){
    const els = steder();
    if (!els.length) return;

    if (!rader || !rader.length) {
      els.forEach(el => el.innerHTML = '<p class="lite">Ingen lagerbevegelser logget ennå.</p>');
      return;
    }

    const html = `
      <div style="display:grid;gap:1px;margin-top:6px;font-size:12px;line-height:1.05;">
        <div style="display:grid;grid-template-columns:86px minmax(120px,1fr) minmax(170px,1.5fr) 54px minmax(95px,1fr);gap:5px;align-items:center;padding:2px 6px;background:#111827;border:1px solid #374151;font-weight:bold;color:#f8fafc;min-height:22px;">
          <span>Tid</span><span>Bil</span><span>Vare</span><span>Ant.</span><span>Bruker</span>
        </div>
        ${rader.map(r => {
          const dato = r.created_at ? new Date(r.created_at).toLocaleString('nb-NO', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
          const bruker = r.opprettet_av_navn || r.opprettet_av_epost || 'Ukjent';
          return `
            <div title="${esc(r.kommentar || r.handling || '')}" style="display:grid;grid-template-columns:86px minmax(120px,1fr) minmax(170px,1.5fr) 54px minmax(95px,1fr);gap:5px;align-items:center;padding:1px 6px;border:1px solid #374151;background:#1f2427;min-height:22px;">
              <span class="lite" style="white-space:nowrap;font-size:12px;">${esc(dato)}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${esc(r.bil_navn)}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${esc(r.vare_navn)}</span>
              <span style="text-align:right;font-size:12px;white-space:nowrap;">${esc(heltall(r.antall))}</span>
              <span class="lite" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${esc(bruker)}</span>
            </div>`;
        }).join('')}
      </div>`;

    els.forEach(el => el.innerHTML = html);
  }

  async function lastVetLagerLogg(){
    const els = steder();
    if (!els.length || !window.supabaseClient) return;

    els.forEach(el => {
      if (!el.innerHTML.trim()) el.innerHTML = '<p class="lite">Laster lagerlogg...</p>';
    });

    try {
      const data = await hentLogg();
      render(data);
    } catch (e) {
      console.warn('Lagerlogg-feil:', e);
      els.forEach(el => el.innerHTML = '<p class="lite">Kunne ikke lese lagerlogg akkurat nå.</p>');
    }
  }

  function visLagerLoggSide(){
    if (typeof window.visVetSide === 'function') window.visVetSide('lagerLoggSide');
    setTimeout(lastVetLagerLogg, 0);
  }

  window.lastVetLagerLogg = lastVetLagerLogg;
  window.tegnVetLagerLogg = render;
  window.visLagerLoggSide = visLagerLoggSide;

  const gammelVis = window.visVetSide;
  if (typeof gammelVis === 'function' && !gammelVis.__lagerloggAlleBilerFinal) {
    const nyVis = function(id){
      const r = gammelVis.apply(this, arguments);
      if (['lagerSide','lagerLoggSide'].includes(id)) setTimeout(lastVetLagerLogg, 80);
      return r;
    };
    nyVis.__lagerloggAlleBilerFinal = true;
    window.visVetSide = nyVis;
  }

  document.addEventListener('click', function(e){
    const t = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    const txt = String(t.textContent || '').toLowerCase();
    const onclick = String(t.getAttribute('onclick') || '').toLowerCase();
    if (txt.includes('lagerlogg') || onclick.includes('lagerlogg')) {
      setTimeout(lastVetLagerLogg, 80);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => setTimeout(lastVetLagerLogg, 1200));
  window.addEventListener('load', () => setTimeout(lastVetLagerLogg, 1500));
})();
/* ===== SLUTT LAGERLOGG SUPERTRYGG ===== */
