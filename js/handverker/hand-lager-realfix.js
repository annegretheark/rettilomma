/* RIL REALFIX 2026-06-22
   Lager/bil-lager må bruke faktiske tabeller/kolonner:
   hand_vare(id, varenr, navn, innpris, utpris, pris, lager_antall, antall, minimum_antall, mva_sats, mva, mva_prosent, firma_id)
   hand_bil(id, navn, regnr, firma_id)
   hand_bil_lager(id, bil_id, vare_id, antall, minimum_antall)
   Ingen PostgREST-relasjoner som biler(*)/varer(*) brukes her.
*/
(function () {
  const VERSJON = 'lager-realfix-20260622-1';
  console.log(VERSJON + ' lastet');

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const num = v => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = v => num(v).toFixed(2);
  const navn = v => v ? (v.navn || v.varenavn || v.beskrivelse || 'Vare') : 'Vare';
  const varenavnFull = v => (v?.varenr ? v.varenr + ' - ' : '') + navn(v);
  const lager = v => num(v?.lager_antall ?? v?.antall ?? v?.beholdning ?? 0);
  const min = v => num(v?.minimum_antall ?? v?.min_antall ?? 0);
  const pris = v => num(v?.utpris ?? v?.pris ?? 0);

  async function firmaId() {
    const cached = window.aktivFirmaId || window.handFirmaId || window.firmaData?.id || window.firma?.id ||
      localStorage.getItem('aktivFirmaId') || localStorage.getItem('handFirmaId') || localStorage.getItem('firmaId') || localStorage.getItem('firma_id');
    if (cached) return String(cached);
    if (!window.supabaseClient) return '';
    try {
      const userRes = await supabaseClient.auth.getUser();
      const user = userRes?.data?.user;
      const uid = user?.id || '';
      const email = (user?.email || window.innloggetEpost || '').toLowerCase();

      if (uid) {
        let r = await supabaseClient.from('hand_firma_bruker').select('firma_id').eq('user_id', uid).limit(1).maybeSingle();
        if (!r.error && r.data?.firma_id) return lagreFirmaId(r.data.firma_id);

        r = await supabaseClient.from('hand_ansatt').select('firma_id').or('user_id.eq.' + uid + ',auth_id.eq.' + uid).limit(1).maybeSingle();
        if (!r.error && r.data?.firma_id) return lagreFirmaId(r.data.firma_id);
      }
      if (email) {
        const r = await supabaseClient.from('hand_ansatt').select('firma_id').ilike('epost', email).limit(1).maybeSingle();
        if (!r.error && r.data?.firma_id) return lagreFirmaId(r.data.firma_id);
      }
    } catch (e) {
      console.warn(VERSJON + ': kunne ikke finne firma_id', e);
    }
    return '';
  }

  function lagreFirmaId(id) {
    id = String(id || '');
    if (!id) return '';
    window.aktivFirmaId = id;
    window.handFirmaId = id;
    localStorage.setItem('aktivFirmaId', id);
    localStorage.setItem('firma_id', id);
    return id;
  }

  function dedupeVarer(rows, fid) {
    const map = new Map();
    (rows || []).forEach(v => {
      if (!v || v.aktiv === false) return;
      const key = String(v.varenr || v.id || '').trim();
      if (!key) return;
      const old = map.get(key);
      if (!old) { map.set(key, v); return; }
      const oldSame = fid && String(old.firma_id || '') === String(fid);
      const newSame = fid && String(v.firma_id || '') === String(fid);
      if (newSame && !oldSame) { map.set(key, v); return; }
      if (newSame === oldSame && lager(v) > lager(old)) map.set(key, v);
    });
    return Array.from(map.values()).sort((a,b) => String(navn(a)).localeCompare(String(navn(b)), 'no'));
  }

  async function hentHandVarer() {
    if (!window.supabaseClient) return { data: [], error: new Error('Supabase er ikke lastet') };
    const fid = await firmaId();
    const cols = 'id,varenr,navn,beskrivelse,innpris,pris,utpris,lager_antall,antall,minimum_antall,mva,mva_sats,mva_prosent,firma_id,aktiv';
    let q = supabaseClient.from('hand_vare').select(cols).limit(2000);
    if (fid) q = q.eq('firma_id', fid);
    let res = await q;
    if (res.error) return res;

    let rows = res.data || [];
    // Hvis aktivt firma ikke gir varer, vis ikke tom skjerm for sysadmin: hent synlige varer og dedupliser.
    if (!rows.length && !fid) {
      res = await supabaseClient.from('hand_vare').select(cols).limit(2000);
      if (res.error) return res;
      rows = res.data || [];
    }
    return { data: dedupeVarer(rows, fid), error: null };
  }

  function renderFylleliste(varer) {
    const c = $('bilLagerFyllListe');
    if (!c) return;
    window.varerTilBilLager = varer || [];
    if (!varer.length) {
      c.innerHTML = '<p class="melding">Ingen varer i vareregisteret for aktivt firma.</p>';
      return;
    }
    c.innerHTML = `
      <div class="info" style="margin:8px 0 6px 0; font-weight:bold;">Fyll bil</div>
      <div style="overflow:auto; max-height:460px; border:1px solid #374151; border-radius:10px; margin-top:8px;">
        <table class="bil-tabell">
          <thead><tr>
            <th>Varenr</th><th>Vare</th><th>Innpris</th><th>Utpris</th><th>Hovedlager</th><th>Min. hovedlager</th><th>MVA</th><th>Antall til bil</th><th>Min. på bil</th>
          </tr></thead>
          <tbody>${varer.map(v => `
            <tr>
              <td>${esc(v.varenr || '')}</td>
              <td>${esc(navn(v))}</td>
              <td>${esc(fmt(v.innpris))}</td>
              <td>${esc(fmt(v.utpris ?? v.pris))}</td>
              <td>${esc(lager(v))}</td>
              <td>${esc(min(v))}</td>
              <td>${esc(num(v.mva_prosent ?? v.mva_sats ?? v.mva ?? 25))}%</td>
              <td><input class="bil-lager-antall-liste" data-vare-id="${esc(v.id)}" type="number" step="1" min="0" value="" placeholder="0"></td>
              <td><input class="bil-lager-min-liste" data-vare-id="${esc(v.id)}" type="number" step="1" min="0" value="" placeholder="0"></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  async function fyllBilLagerVareValgRealfix() {
    const c = $('bilLagerFyllListe');
    if (c) c.innerHTML = '<p class="info">Henter varer fra hand_vare...</p>';
    const res = await hentHandVarer();
    if (res.error) {
      if (c) c.innerHTML = '<p class="melding">Kunne ikke hente varer fra hand_vare: ' + esc(res.error.message || res.error) + '</p>';
      return [];
    }
    renderFylleliste(res.data || []);
    return res.data || [];
  }

  function renderBilLager(rows) {
    const e = $('bilLagerListe');
    if (!e) return;
    const valgtBilId = $('bilLagerBilValg')?.value || $('lagerBilValg')?.value || '';
    const rader = valgtBilId ? rows.filter(r => String(r.bil_id) === String(valgtBilId)) : rows;
    if (!rader.length) {
      e.innerHTML = '<p>Ingen varer på bil-lager.</p>';
      return;
    }
    e.innerHTML = `
      <div class="info" style="margin:8px 0 6px 0; font-weight:bold;">Varer på bil-lager</div>
      <table class="bil-tabell"><thead><tr>
        <th>Bil</th><th>Ansatt / bruker</th><th>Varenr</th><th>Vare</th><th>Utpris</th><th>Antall på bil</th><th>Minimum på bil</th><th>Sist hentet av</th>
      </tr></thead><tbody>${rader.map(r => `
        <tr>
          <td>${esc(r.bil?.navn || r.bil?.bilnavn || 'Bil')}${r.bil?.regnr ? ' - ' + esc(r.bil.regnr) : ''}</td>
          <td>${esc(r.bil?.ansatt_navn || r.bil?.bruker_navn || 'Ikke tildelt')}</td>
          <td>${esc(r.vare?.varenr || '')}</td>
          <td>${esc(navn(r.vare))}</td>
          <td>${esc(fmt(r.vare?.utpris ?? r.vare?.pris))}</td>
          <td>${esc(num(r.antall))}</td>
          <td>${esc(num(r.minimum_antall))}</td>
          <td>${esc(r.hentet_av || '')}</td>
        </tr>`).join('')}</tbody></table>`;
  }

  async function lastBilLagerRealfix() {
    if (!window.supabaseClient) return [];
    const fid = await firmaId();
    const bilCols = 'id,navn,bilnavn,regnr,registreringsnummer,ansatt_id,bruker_id,firma_id,aktiv';
    let bilQ = supabaseClient.from('hand_bil').select(bilCols).limit(1000);
    if (fid) bilQ = bilQ.eq('firma_id', fid);
    const bilRes = await bilQ;
    if (bilRes.error) {
      const e = $('bilLagerListe');
      if (e) e.innerHTML = 'Kunne ikke hente biler: ' + esc(bilRes.error.message);
      return [];
    }
    const biler = bilRes.data || [];
    const bilMap = new Map(biler.map(b => [String(b.id), b]));
    const bilIds = biler.map(b => b.id);

    let lagQ = supabaseClient.from('hand_bil_lager').select('id,bil_id,vare_id,antall,minimum_antall,created_at').limit(2000).order('created_at', { ascending: false });
    if (bilIds.length) lagQ = lagQ.in('bil_id', bilIds);
    const lagRes = await lagQ;
    if (lagRes.error) {
      const e = $('bilLagerListe');
      if (e) e.innerHTML = 'Kunne ikke hente bil-lager: ' + esc(lagRes.error.message);
      return [];
    }
    const lagerRows = lagRes.data || [];
    const vareIds = Array.from(new Set(lagerRows.map(r => r.vare_id).filter(Boolean)));
    let vareMap = new Map();
    if (vareIds.length) {
      const vareRes = await supabaseClient.from('hand_vare').select('id,varenr,navn,beskrivelse,pris,utpris,firma_id').in('id', vareIds).limit(2000);
      if (!vareRes.error) vareMap = new Map((vareRes.data || []).map(v => [String(v.id), v]));
    }
    const rows = lagerRows.map(r => ({ ...r, bil: bilMap.get(String(r.bil_id)) || {}, vare: vareMap.get(String(r.vare_id)) || {} }));
    window.bilLager = rows;
    renderBilLager(rows);
    return rows;
  }

  async function lastBilerOgBilLagerRealfix() {
    if (typeof window.lastBiler === 'function') {
      try { await window.lastBiler(); } catch (e) { console.warn(VERSJON + ': lastBiler feilet', e); }
    }
    await fyllBilLagerVareValgRealfix();
    await lastBilLagerRealfix();
  }

  window.rilLagerRealfixVersjon = VERSJON;
  window.vareHovedlager = lager;
  window.vareMinimum = min;
  window.vareNavn = varenavnFull;
  window.fyllBilLagerVareValg = fyllBilLagerVareValgRealfix;
  window.tegnFyllBilListe = function () { renderFylleliste(window.varerTilBilLager || []); };
  window.hentOgTegnBilFyllelisteFraDatabase = fyllBilLagerVareValgRealfix;
  window.lastBilLager = lastBilLagerRealfix;
  window.lastBilerOgBilLager = lastBilerOgBilLagerRealfix;

  // Kjør når bil-lagerboksen finnes, og igjen etter navigering.
  function maybeRun() {
    if ($('bilLagerFyllListe')) fyllBilLagerVareValgRealfix();
    if ($('bilLagerListe')) lastBilLagerRealfix();
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(maybeRun, 500));
  document.addEventListener('click', ev => {
    const t = String(ev.target?.textContent || '').toLowerCase();
    if (t.includes('bil') || t.includes('lager')) setTimeout(maybeRun, 400);
  }, true);
  const mo = new MutationObserver(() => {
    if ($('bilLagerFyllListe') && !window.__rilLagerRealfixKjort) {
      window.__rilLagerRealfixKjort = true;
      setTimeout(maybeRun, 300);
    }
  });
  try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
})();
