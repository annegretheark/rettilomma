/* Veterinær produksjon: pasient/journal UI
   Ryddet 2026-06-11. Ingen midlertidige fix-/final-navn. */


/* ===== PROD 10.06: JOURNALLISTE KOMPAKT OG KLIKKBAR IGJEN ===== */
(function(){
  function injectJournalKlikkbarStyle(){
    if (document.getElementById('vetJournalKlikkbarStyle')) return;
    const style = document.createElement('style');
    style.id = 'vetJournalKlikkbarStyle';
    style.textContent = `
      .vet-journal-kort .vet-journal-detaljer {
        display: none !important;
        margin-top: 10px;
      }
      .vet-journal-kort.apen .vet-journal-detaljer {
        display: block !important;
      }
      .vet-journal-kort {
        padding: 10px 12px !important;
        margin: 6px 0 !important;
      }
      .vet-journal-linje {
        width: auto !important;
        display: inline-block !important;
        text-align: left !important;
        margin: 0 !important;
        cursor: pointer !important;
      }
    `;
    document.head.appendChild(style);
  }

  function lukkJournalDetaljerSomStandard(){
    injectJournalKlikkbarStyle();
    document.querySelectorAll('.vet-journal-kort').forEach(kort => {
      if (!kort.classList.contains('apen')) {
        const detaljer = kort.querySelector('.vet-journal-detaljer');
        if (detaljer) detaljer.style.display = 'none';
      }
    });
  }

  function toggleJournalDetaljerFix(id){
    injectJournalKlikkbarStyle();
    const kort = document.getElementById('journalKort_' + id);
    if (!kort) return;
    const skalApnes = !kort.classList.contains('apen');
    kort.classList.toggle('apen', skalApnes);
    const detaljer = kort.querySelector('.vet-journal-detaljer');
    if (detaljer) detaljer.style.display = skalApnes ? 'block' : 'none';
  }

  const gammelTegnJournalKlikkbar = window.tegnJournal || (typeof tegnJournal === 'function' ? tegnJournal : null);
  if (gammelTegnJournalKlikkbar) {
    window.tegnJournal = function(){
      const r = gammelTegnJournalKlikkbar.apply(this, arguments);
      setTimeout(lukkJournalDetaljerSomStandard, 0);
      return r;
    };
    try { tegnJournal = window.tegnJournal; } catch(e) {}
  }

  window.toggleJournalDetaljer = toggleJournalDetaljerFix;
  try { toggleJournalDetaljer = toggleJournalDetaljerFix; } catch(e) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', lukkJournalDetaljerSomStandard, { once:true });
  } else {
    lukkJournalDetaljerSomStandard();
  }
  window.addEventListener('load', function(){
    lukkJournalDetaljerSomStandard();
    setTimeout(lukkJournalDetaljerSomStandard, 300);
  });
})();
/* ===== SLUTT JOURNALLISTE FIX ===== */



/* ===== PROD 2026-06-10: STRENG EIERKOBLING I PASIENTLISTE =====
   Viser aldri dyr under feil dyreeier. Dyr kobles kun til eier når
   dyrets dyreeier_id/eier_id faktisk matcher eierens id.
*/
(function(){
  let valgtEierId = '';
  let valgtDyrId = '';
  let tillatJournalSide = false;

  function qs(id){ return document.getElementById(id); }
  function setv(id, value){ const el = qs(id); if (el) el.value = value || ''; }
  function esc(value){
    return String(value ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }
  function arrEiere(){ try { return (vetDyreeiere || []).slice(); } catch(e) { return []; } }
  function arrDyr(){ try { return (vetDyr || []).slice(); } catch(e) { return []; } }
  function arrJournal(){ try { return (vetJournal || []).slice(); } catch(e) { return []; } }
  function datoNo(d){
    const s = String(d || '');
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const p = s.slice(0,10).split('-');
      return `${p[2]}.${p[1]}.${p[0]}`;
    }
    return s || '';
  }
  function eierIdSet(){ return new Set(arrEiere().map(e => String(e.id || '')).filter(Boolean)); }
  function ownerIdForDyr(d){
    const candidates = [
      d?.dyreeier_id,
      d?.eier_id,
      d?.kunde_id,
      d?.owner_id,
      d?.vet_dyreeiere?.id,
      d?.dyreeier?.id
    ].map(x => String(x || '').trim()).filter(Boolean);
    const known = eierIdSet();
    return candidates.find(id => known.has(id)) || '';
  }
  function dyrForEier(eierId){
    eierId = String(eierId || '').trim();
    if (!eierId) return [];
    return arrDyr()
      .filter(d => ownerIdForDyr(d) === eierId)
      .sort((a,b) => String(a.navn || '').localeCompare(String(b.navn || ''), 'nb'));
  }
  function journalForDyr(dyrId){
    dyrId = String(dyrId || '').trim();
    if (!dyrId) return [];
    return arrJournal()
      .filter(j => String(j.dyr_id || j.vet_dyr?.id || '') === dyrId)
      .sort((a,b) => String(b.dato || '').localeCompare(String(a.dato || '')) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }
  function finnDyr(dyrId){ return arrDyr().find(d => String(d.id || '') === String(dyrId || '')) || null; }
  function sideErPasienter(){
    const side = qs('eierSide');
    return !!side && !side.classList.contains('skjult') && side.style.display !== 'none';
  }
  function cssOnce(){
    if (qs('vetStrengEierkoblingCss')) return;
    const s = document.createElement('style');
    s.id = 'vetStrengEierkoblingCss';
    s.textContent = `
      #eierSide .vet-ren-wrap{display:block!important;margin-top:8px!important;}
      #eierSide .vet-ren-toolbar{display:flex!important;gap:8px!important;flex-wrap:wrap!important;margin:8px 0 12px!important;}
      #eierSide .vet-ren-toolbar button{width:auto!important;min-height:32px!important;padding:7px 10px!important;}
      #eierSide .vet-ren-linje{width:100%!important;display:grid!important;grid-template-columns:minmax(170px,1.5fr) minmax(80px,.6fr) minmax(120px,.9fr) minmax(140px,1fr)!important;gap:8px!important;align-items:center!important;text-align:left!important;padding:7px 10px!important;margin:3px 0!important;border:1px solid #374151!important;border-radius:6px!important;background:#202528!important;color:#f8fafc!important;cursor:pointer!important;font-size:14px!important;line-height:1.2!important;}
      #eierSide .vet-ren-linje:hover{outline:1px solid #60a5fa!important;background:#26313a!important;}
      #eierSide .vet-ren-linje strong{font-size:14px!important;font-weight:700!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
      #eierSide .vet-ren-linje span{font-size:13px!important;font-weight:400!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
      #eierSide .vet-ren-under{margin:4px 0 10px 22px!important;border-left:2px solid #374151!important;padding-left:8px!important;}
      #eierSide .vet-ren-behandling{background:#0f172a!important;border:1px solid #1f6feb!important;border-radius:8px!important;padding:8px!important;margin:6px 0 10px 22px!important;}
      #eierSide .vet-ren-behlinje{width:100%!important;display:grid!important;grid-template-columns:100px minmax(130px,1fr) minmax(150px,1.5fr)!important;gap:8px!important;text-align:left!important;padding:5px 7px!important;margin:3px 0!important;border:1px solid #374151!important;border-radius:5px!important;background:#202528!important;color:#f8fafc!important;font-size:13px!important;}
      #eierSide .vet-ren-tom{padding:8px 10px!important;color:#cbd5e1!important;font-size:14px!important;}
      #eierSide .vet-ren-advarsel{padding:8px 10px!important;margin:8px 0!important;border:1px solid #b45309!important;border-radius:8px!important;background:#451a03!important;color:#fed7aa!important;font-size:13px!important;}
      @media(max-width:700px){#eierSide .vet-ren-linje,#eierSide .vet-ren-behlinje{grid-template-columns:1fr!important;}#eierSide .vet-ren-under,#eierSide .vet-ren-behandling{margin-left:0!important;}}
    `;
    document.head.appendChild(s);
  }
  function behandlingHtml(d){
    const linjer = journalForDyr(d.id);
    return `<div class="vet-ren-behandling">
      <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:6px;">
        <strong>${esc(d.navn || 'Dyr')} - behandlinger</strong>
        <button type="button" onclick="vetRenNyBehandling('${esc(d.id)}')">Ny behandling</button>
      </div>
      ${linjer.length ? linjer.map(j => {
        const txt = String(j.notat || j.medisin_kladd || '').replace(/\s+/g,' ').trim();
        return `<button type="button" class="vet-ren-behlinje" onclick="vetApneEksisterendeBehandling('${esc(j.id)}')" title="Klikk for å åpne behandlingen">
          <span><strong>${esc(datoNo(j.dato))}</strong></span>
          <span>${esc(j.type || 'Behandling')}</span>
          <span>${esc(txt ? (txt.length > 90 ? txt.slice(0,90) + '...' : txt) : 'Ingen notattekst')}</span>
        </button>`;
      }).join('') : '<div class="vet-ren-tom">Ingen behandlinger på dette dyret ennå.</div>'}
    </div>`;
  }
  function bygg(){
    const side = qs('eierSide');
    if (!side) return;
    cssOnce();
    const eiere = arrEiere().sort((a,b) => String(a.navn || '').localeCompare(String(b.navn || ''), 'nb'));
    const kjente = eierIdSet();
    const ukoblet = arrDyr().filter(d => !ownerIdForDyr(d) || !kjente.has(ownerIdForDyr(d)));
    const html = eiere.length ? eiere.map(e => {
      const eid = String(e.id || '');
      const apen = valgtEierId === eid;
      const mineDyr = dyrForEier(eid);
      return `<div>
        <button type="button" class="vet-ren-linje" onclick="vetRenVelgEier('${esc(eid)}')">
          <strong>▶ ${esc(e.navn || 'Uten navn')}</strong>
          <span>${mineDyr.length} dyr</span>
          <span>${esc(e.telefon || '')}</span>
          <span>${esc(e.epost || '')}</span>
        </button>
        ${apen ? `<div class="vet-ren-under">
          ${mineDyr.length ? mineDyr.map(d => {
            const did = String(d.id || '');
            const valgt = valgtDyrId === did;
            return `<div>
              <button type="button" class="vet-ren-linje" onclick="vetRenVelgDyr('${esc(did)}')">
                <strong>↳ ${esc(d.navn || 'Uten navn')}</strong>
                <span>${esc(d.art || '')}</span>
                <span>${esc(d.rase || '')}</span>
                <span>${journalForDyr(did).length} beh.</span>
              </button>
              ${valgt ? behandlingHtml(d) : ''}
            </div>`;
          }).join('') : '<div class="vet-ren-tom">Ingen dyr registrert på denne eieren.</div>'}
        </div>` : ''}
      </div>`;
    }).join('') : '<div class="vet-ren-tom">Ingen dyreeiere funnet på denne klinikken.</div>';

    const advarsel = ukoblet.length ? `<div class="vet-ren-advarsel">${ukoblet.length} dyr mangler sikker eierkobling og vises derfor ikke under Nina/Reidunn før eier er rettet.</div>` : '';
    side.innerHTML = `<h2>Dyreeiere</h2>
      <p class="lite">Klikk eier, klikk dyr, åpne behandling eller lag ny behandling.</p>
      <div class="vet-ren-toolbar"><button type="button" class="secondary" onclick="vetRenOppdater()">Oppdater</button></div>
      ${advarsel}
      <div class="vet-ren-wrap">${html}</div>
      <input id="dyreeierId" type="hidden"><input id="dyreeierVelgForDyr" type="hidden"><div id="dyreeierMelding" class="melding"></div>`;
  }
  window.vetRenVelgEier = function(eierId){
    eierId = String(eierId || '');
    valgtEierId = valgtEierId === eierId ? '' : eierId;
    valgtDyrId = '';
    setv('dyreeierId', valgtEierId);
    setv('dyreeierVelgForDyr', valgtEierId);
    bygg();
  };
  window.vetRenVelgDyr = function(dyrId){
    const d = finnDyr(dyrId);
    if (!d) return;
    const eid = ownerIdForDyr(d);
    if (!eid) return;
    valgtEierId = eid;
    valgtDyrId = valgtDyrId === String(dyrId) ? '' : String(dyrId || '');
    setv('dyreeierId', valgtEierId);
    setv('dyreeierVelgForDyr', valgtEierId);
    bygg();
  };
  window.vetRenNyBehandling = function(dyrId){
    const d = finnDyr(dyrId);
    if (!d) return;
    const eid = ownerIdForDyr(d);
    if (!eid) {
      alert('Dette dyret mangler sikker eierkobling. Rediger dyret og velg riktig dyreeier først.');
      return;
    }
    valgtEierId = eid;
    valgtDyrId = String(d.id || '');
    tillatJournalSide = true;
    try { window.visVetSide('journalSide'); } catch(e) { try { visVetSide('journalSide'); } catch(_) {} }
    setTimeout(() => {
      try { if (typeof fyllJournalDyreeierValg === 'function') fyllJournalDyreeierValg(); } catch(e) {}
      setv('journalDyreeierValg', valgtEierId);
      try { if (typeof fyllDyrValg === 'function') fyllDyrValg(); } catch(e) {}
      setv('journalDyrValg', valgtDyrId);
      setv('journalDato', new Date().toISOString().slice(0,10));
      const n = qs('journalNotat');
      if (n) n.focus();
      setTimeout(() => { tillatJournalSide = false; }, 1200);
    }, 120);
  };
  window.vetRenOppdater = async function(){
    try { if (typeof lastDyreeiere === 'function') await lastDyreeiere(); } catch(e) {}
    try { if (typeof lastDyr === 'function') await lastDyr(); } catch(e) {}
    try { if (typeof lastJournal === 'function') await lastJournal(); } catch(e) {}
    bygg();
  };

  const originalVis = window.visVetSide || (typeof visVetSide === 'function' ? visVetSide : null);
  window.visVetSide = function(id){
    if (String(id) === 'journalSide' && !tillatJournalSide) {
      id = 'eierSide';
    }
    const r = originalVis ? originalVis.call(this, id) : undefined;
    if (String(id) === 'eierSide') setTimeout(bygg, 0);
    return r;
  };
  try { visVetSide = window.visVetSide; } catch(e) {}
  // PROD: fjernet tvungen sideskift ved lasting. Pasientliste bygges kun når eierSide vises.
})();
/* ===== SLUTT PROD STRENG EIERKOBLING ===== */



/* ===== PROD 2026-06-10: LEGG TIL BILDER PÅ EKSISTERENDE BEHANDLING =====
   Åpnet behandling får egne felt for galleri/kamera. Bildene lagres på samme journal_id
   i vet_journal_bilder og detaljvisningen oppdateres etter lagring.
*/
(function(){
  function qs(id){ return document.getElementById(id); }
  function esc(value){
    return String(value ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }
  function br(value){ return esc(value).replace(/\n/g, '<br>'); }
  function arr(navn){
    try { return Function('return (typeof ' + navn + ' !== "undefined" ? ' + navn + ' : [])')() || []; }
    catch(e){ return []; }
  }
  function datoNo(d){
    const s = String(d || '');
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const p = s.slice(0,10).split('-');
      return `${p[2]}.${p[1]}.${p[0]}`;
    }
    return s || '';
  }
  function kr(tall){
    try { return typeof formaterKr === 'function' ? formaterKr(tall) : Number(tall || 0).toFixed(2); }
    catch(e){ return Number(tall || 0).toFixed(2); }
  }
  function tryggFilnavn(navn){
    try { if (typeof vetTryggFilnavn === 'function') return vetTryggFilnavn(navn); } catch(e) {}
    return String(navn || 'bilde.jpg')
      .toLowerCase()
      .replace(/[æ]/g, 'ae')
      .replace(/[ø]/g, 'o')
      .replace(/[å]/g, 'a')
      .replace(/[^a-z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 80) || 'bilde.jpg';
  }
  function finnJournal(journalId){
    return arr('vetJournal').find(j => String(j.id || '') === String(journalId || '')) || null;
  }
  function finnDyr(dyrId){
    return arr('vetDyr').find(d => String(d.id || '') === String(dyrId || '')) || null;
  }
  function finnEier(eierId){
    return arr('vetDyreeiere').find(e => String(e.id || '') === String(eierId || '')) || null;
  }
  function cssOnce(){
    if (qs('vetBehandlingBildeUploadCss')) return;
    const s = document.createElement('style');
    s.id = 'vetBehandlingBildeUploadCss';
    s.textContent = `
      .vet-beh-upload{margin-top:10px!important;padding:10px!important;border:1px dashed #60a5fa!important;border-radius:10px!important;background:#0f172a!important;}
      .vet-beh-upload .rad{margin-top:6px!important;}
      .vet-beh-upload input{background:#f8fafc!important;color:#111827!important;}
      .vet-beh-bildeknapper{display:flex!important;gap:6px!important;flex-wrap:wrap!important;margin-top:8px!important;}
      .vet-beh-upload-msg{margin-top:8px!important;color:#fca5a5!important;font-weight:bold!important;}
      .vet-beh-upload-ok{color:#86efac!important;}
    `;
    document.head.appendChild(s);
  }
  async function hentBilder(j){
    if (!window.supabaseClient || !j?.id) return j?.vet_journal_bilder || [];
    try {
      const res = await supabaseClient
        .from('vet_journal_bilder')
        .select('*')
        .eq('journal_id', j.id)
        .order('created_at', { ascending: true });
      if (!res.error && Array.isArray(res.data)) {
        j.vet_journal_bilder = res.data;
        return res.data;
      }
    } catch(e) { console.warn('Kunne ikke hente journalbilder', e); }
    return j?.vet_journal_bilder || [];
  }
  async function hentVarer(j){
    if ((j.vet_journal_varer || []).length) return j.vet_journal_varer;
    if (!window.supabaseClient || !j.id) return [];
    try {
      const res = await supabaseClient
        .from('vet_journal_varer')
        .select('*')
        .eq('journal_id', j.id);
      if (!res.error && Array.isArray(res.data)) {
        j.vet_journal_varer = res.data;
        return res.data;
      }
    } catch(e) { console.warn('Kunne ikke hente journalvarer', e); }
    return [];
  }
  function bildeHtml(bilder){
    if (!bilder || !bilder.length) return '<p class="lite">Ingen bilder lagret på denne behandlingen.</p>';
    return `<div class="vet-beh-bilder">
      ${bilder.map(b => {
        const url = b.bilde_url || b.url || '';
        return `<a class="vet-beh-bildekort" href="${esc(url || '#')}" target="_blank" rel="noopener">
          <img src="${esc(url)}" alt="${esc(b.bildetekst || b.filnavn || 'Journalbilde')}">
          <span class="lite">${esc(b.bildetekst || b.filnavn || '')}</span>
        </a>`;
      }).join('')}
    </div>`;
  }
  function lagDetaljHtml(j, bilder, varer){
    const d = finnDyr(j.dyr_id) || j.vet_dyr || {};
    const eier = finnEier(d.dyreeier_id || j.dyreeier_id || j.vet_dyr?.dyreeier_id) || d.vet_dyreeiere || j.vet_dyr?.vet_dyreeiere || {};
    const sum = Number(j.belop_eks_mva || 0);
    const prisHtml = (sum || j.fastpris || j.timepris || j.timer || j.km) ? `
      <div class="vet-beh-blokk">
        <strong>Pris / kjøring</strong>
        <div class="vet-beh-grid">
          <div class="vet-beh-label">Fastpris</div><div>${kr(j.fastpris || 0)} kr eks. mva</div>
          <div class="vet-beh-label">Timer</div><div>${esc(j.timer || 0)} x ${kr(j.timepris || 0)} kr</div>
          <div class="vet-beh-label">Kjøring</div><div>${esc(j.km || 0)} km x ${kr(j.km_pris || 0)} kr</div>
          <div class="vet-beh-label">Sum</div><div><strong>${kr(sum)} kr eks. mva</strong></div>
        </div>
      </div>` : '';
    const varerHtml = varer && varer.length ? `
      <div class="vet-beh-blokk">
        <strong>Varer / medisiner</strong>
        <ul>
          ${varer.map(v => {
            const ant = Number(v.antall || 0);
            const pris = Number(v.pris || 0);
            const vareSum = Number(v.sum_eks_mva || (ant * pris));
            return `<li>${esc(v.varenavn || v.navn || 'Vare')} - ${kr(ant)} x ${kr(pris)} kr = ${kr(vareSum)} kr</li>`;
          }).join('')}
        </ul>
      </div>` : '';
    return `
      <button type="button" class="vet-beh-lukk" onclick="this.closest('.vet-beh-detalj')?.remove()">Lukk</button>
      <h3>Behandling ${esc(datoNo(j.dato))}</h3>
      <div class="vet-beh-grid">
        <div class="vet-beh-label">Dyr</div><div>${esc(d.navn || '')}</div>
        <div class="vet-beh-label">Eier</div><div>${esc(eier.navn || '')}</div>
        <div class="vet-beh-label">Type</div><div>${esc(j.type || 'Behandling')}</div>
        <div class="vet-beh-label">Behandler</div><div>${esc((typeof finnBehandlerNavnForJournal === 'function' ? finnBehandlerNavnForJournal(j) : '') || '')}</div>
      </div>
      <div class="vet-beh-blokk"><strong>Journalnotat</strong><p>${br(j.notat || 'Ingen journalnotat skrevet.')}</p></div>
      ${j.medisin_kladd ? `<div class="vet-beh-blokk"><strong>Medisin / reseptkladd</strong><p>${br(j.medisin_kladd)}</p></div>` : ''}
      ${prisHtml}
      ${varerHtml}
      <div class="vet-beh-blokk">
        <strong>Bilder</strong>
        <div id="vetBehBilder_${esc(j.id)}">${bildeHtml(bilder)}</div>
        <div class="vet-beh-upload">
          <strong>Legg til bilde på denne behandlingen</strong>
          <div class="rad">
            <div>
              <label for="vetBehGalleri_${esc(j.id)}">Velg bilde fra galleri</label>
              <input id="vetBehGalleri_${esc(j.id)}" type="file" accept="image/*" multiple>
            </div>
            <div>
              <label for="vetBehKamera_${esc(j.id)}">Ta bilde</label>
              <input id="vetBehKamera_${esc(j.id)}" type="file" accept="image/*" capture="environment">
            </div>
          </div>
          <label for="vetBehBildetekst_${esc(j.id)}">Bildetekst</label>
          <input id="vetBehBildetekst_${esc(j.id)}" placeholder="F.eks. kontrollbilde, sår etter rens">
          <div class="vet-beh-bildeknapper">
            <button type="button" class="secondary" onclick="vetLagreBilderPaEksisterendeBehandling('${esc(j.id)}')">Lagre bilde på behandlingen</button>
          </div>
          <div id="vetBehBildeMelding_${esc(j.id)}" class="vet-beh-upload-msg"></div>
        </div>
      </div>
    `;
  }
  async function renderDetalj(journalId, detalj){
    const j = finnJournal(journalId);
    if (!j) return;
    const bilder = await hentBilder(j);
    const varer = await hentVarer(j);
    detalj.innerHTML = lagDetaljHtml(j, bilder, varer);
  }

  window.vetApneEksisterendeBehandling = async function(journalId){
    cssOnce();
    const j = finnJournal(journalId);
    if (!j) return false;
    const knapp = document.activeElement;
    const host = knapp?.closest?.('.vet-ren-behandling,.vet-start-behandling,.vet-behandling-liste,.vet-dyr-behandlinger') || qs('eierSide') || document.body;
    host.querySelectorAll('.vet-beh-detalj').forEach(el => el.remove());
    const detalj = document.createElement('div');
    detalj.className = 'vet-beh-detalj';
    detalj.dataset.journalId = String(journalId || '');
    detalj.innerHTML = '<p class="lite">Henter behandlingsdetaljer ...</p>';
    if (knapp && knapp.parentNode) knapp.insertAdjacentElement('afterend', detalj);
    else host.appendChild(detalj);
    await renderDetalj(journalId, detalj);
    detalj.scrollIntoView({ behavior:'smooth', block:'nearest' });
    return false;
  };

  window.vetLagreBilderPaEksisterendeBehandling = async function(journalId){
    const melding = qs('vetBehBildeMelding_' + journalId);
    const galleri = qs('vetBehGalleri_' + journalId);
    const kamera = qs('vetBehKamera_' + journalId);
    const tekst = String(qs('vetBehBildetekst_' + journalId)?.value || '').trim() || null;
    const filer = [];
    if (galleri?.files?.length) filer.push(...Array.from(galleri.files));
    if (kamera?.files?.length) filer.push(...Array.from(kamera.files));
    if (!journalId) { if (melding) melding.textContent = 'Mangler journal-id.'; return false; }
    if (!filer.length) { if (melding) melding.textContent = 'Velg eller ta minst ett bilde først.'; return false; }
    if (!window.supabaseClient) { if (melding) melding.textContent = 'Supabase er ikke lastet.'; return false; }

    if (melding) { melding.classList.remove('vet-beh-upload-ok'); melding.textContent = 'Laster opp bilde(r) ...'; }
    const rader = [];
    try {
      for (const fil of filer) {
        const filnavn = tryggFilnavn(fil.name || 'journalbilde.jpg');
        const sti = `${journalId}/${Date.now()}_${Math.random().toString(16).slice(2)}_${filnavn}`;
        const up = await supabaseClient.storage
          .from(typeof VET_BILDE_BUCKET !== 'undefined' ? VET_BILDE_BUCKET : 'vet-bilder')
          .upload(sti, fil, {
            cacheControl: '3600',
            upsert: false,
            contentType: fil.type || 'image/jpeg'
          });
        if (up.error) throw up.error;
        const pub = supabaseClient.storage
          .from(typeof VET_BILDE_BUCKET !== 'undefined' ? VET_BILDE_BUCKET : 'vet-bilder')
          .getPublicUrl(sti);
        rader.push({
          journal_id: journalId,
          filnavn: fil.name || filnavn,
          bilde_url: pub?.data?.publicUrl || null,
          bildetekst: tekst
        });
      }
      const ins = await supabaseClient.from('vet_journal_bilder').insert(rader).select('*');
      if (ins.error) throw ins.error;

      const j = finnJournal(journalId);
      if (j) {
        const eksisterende = Array.isArray(j.vet_journal_bilder) ? j.vet_journal_bilder : [];
        j.vet_journal_bilder = [...eksisterende, ...(ins.data || rader)];
      }
      if (galleri) galleri.value = '';
      if (kamera) kamera.value = '';
      const tekstEl = qs('vetBehBildetekst_' + journalId);
      if (tekstEl) tekstEl.value = '';
      if (melding) { melding.classList.add('vet-beh-upload-ok'); melding.textContent = `${rader.length} bilde(r) lagret på behandlingen.`; }

      const detalj = document.querySelector(`.vet-beh-detalj[data-journal-id="${CSS.escape(String(journalId))}"]`);
      if (detalj) await renderDetalj(journalId, detalj);
      return false;
    } catch(e) {
      console.error(e);
      if (melding) { melding.classList.remove('vet-beh-upload-ok'); melding.textContent = 'Kunne ikke lagre bilde: ' + (e.message || e); }
      return false;
    }
  };
})();
/* ===== SLUTT LEGG TIL BILDER PÅ EKSISTERENDE BEHANDLING ===== */



/* ===== TESTDATA: knapp for sletting av demo/testdata ===== */
(function(){
  function vetErTestdataAdmin() {
    try {
      if (typeof vetErSystemAdmin !== 'undefined' && vetErSystemAdmin) return true;
      if (typeof erKlinikkAdmin === 'function' && erKlinikkAdmin()) return true;
    } catch (e) {}
    return false;
  }

  function oppdaterSlettTestdataKnapp() {
    const knapp = document.getElementById('vetSlettTestdataKnapp');
    if (!knapp) return;
    knapp.style.display = vetErTestdataAdmin() ? 'inline-block' : 'none';
  }

  window.slettVetTestdata = async function() {
    const knapp = document.getElementById('vetSlettTestdataKnapp');
    if (!vetErTestdataAdmin()) {
      alert('Bare admin/systemadmin kan slette testdata.');
      return;
    }
    const ok = confirm('Slette alle TESTKLINIKK-testdata? Dette fjerner testklinikker, veterinærer, kunder, dyr, journaler og journalbilder laget av seed-scriptet.');
    if (!ok) return;

    const gammelTekst = knapp ? knapp.textContent : '';
    if (knapp) { knapp.disabled = true; knapp.textContent = 'Sletter testdata ...'; }

    try {
      const { data, error } = await supabaseClient.rpc('slett_vet_testdata');
      if (error) throw error;
      alert('Testdata slettet.');
      if (typeof lastVetData === 'function') await lastVetData();
      else window.location.reload();
      console.log('slett_vet_testdata:', data);
    } catch (e) {
      console.error(e);
      alert('Kunne ikke slette testdata: ' + (e.message || e));
    } finally {
      if (knapp) { knapp.disabled = false; knapp.textContent = gammelTekst || 'Slett testdata'; }
    }
  };

  const gammelOppdaterVetMenySynlighet = typeof oppdaterVetMenySynlighet === 'function' ? oppdaterVetMenySynlighet : null;
  if (gammelOppdaterVetMenySynlighet) {
    oppdaterVetMenySynlighet = function() {
      const r = gammelOppdaterVetMenySynlighet.apply(this, arguments);
      oppdaterSlettTestdataKnapp();
      return r;
    };
  }

  window.addEventListener('load', function(){
    setTimeout(oppdaterSlettTestdataKnapp, 500);
    setTimeout(oppdaterSlettTestdataKnapp, 1500);
  });
})();