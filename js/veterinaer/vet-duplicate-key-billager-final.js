/* ===== FINAL FIX: DUPLICATE KEY VED FYLLING AV BIL 09.06 =====
   Bruker update/upsert på (klinikk_id,bil_id,vare_id) i stedet for blind insert.
   Kloner også fyll-knappen slik at gamle dobbeltkoblinger ikke kjører samtidig.
*/
(function(){
  function $(id){ return document.getElementById(id); }
  function arr(n){ try { return Function("return (typeof "+n+" !== 'undefined' ? "+n+" : [])")() || []; } catch(e){ return []; } }
  function tekst(id){ return typeof vetTekst === 'function' ? vetTekst(id) : String($(id)?.value || '').trim(); }
  function melding(id, t){ if (typeof vetMelding === 'function') vetMelding(id, t); else { const el=$(id); if(el) el.textContent=t||''; } }
  function klinikkId(){
    try { if (typeof hentKlinikkIdForLager === 'function') return hentKlinikkIdForLager(); } catch(e) {}
    return window.vetAktivKlinikkId || tekst('klinikkId') || '';
  }
  function varenavn(id){
    const v = arr('vetVarer').find(x => String(x.id) === String(id));
    return v?.navn || 'Vare';
  }
  function bilnavn(id){
    const b = arr('vetBiler').find(x => String(x.id) === String(id));
    return [b?.navn, b?.regnr].filter(Boolean).join(' - ') || 'valgt bil';
  }
  function heltall(v){
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  async function tryggSettLagerAntall(tabell, filter, nyttAntall, ekstraInsert = {}) {
    const rad = { ...filter, ...ekstraInsert, antall: Number(nyttAntall || 0) };

    let konflikt = 'id';
    if (tabell === 'vet_bil_lager') konflikt = 'klinikk_id,bil_id,vare_id';
    if (tabell === 'vet_lager') konflikt = 'klinikk_id,vare_id';

    // Først prøver vi update direkte. Det gir ikke duplicate key.
    let q = supabaseClient.from(tabell).update({ antall: rad.antall });
    Object.entries(filter).forEach(([k,v]) => { q = q.eq(k, v); });
    const upd = await q.select('id').maybeSingle();

    if (!upd.error && upd.data?.id) return true;

    // Hvis raden ikke finnes, bruk upsert på riktig unike nøkkel.
    const up = await supabaseClient
      .from(tabell)
      .upsert(rad, { onConflict: konflikt })
      .select('id')
      .maybeSingle();

    if (!up.error) return true;

    // Siste sikkerhetsnett: hvis to klikk prøvde samtidig og én vant, oppdater etterpå.
    if (String(up.error.message || '').toLowerCase().includes('duplicate key')) {
      let q2 = supabaseClient.from(tabell).update({ antall: rad.antall });
      Object.entries(filter).forEach(([k,v]) => { q2 = q2.eq(k, v); });
      const upd2 = await q2.select('id').maybeSingle();
      if (!upd2.error) return true;
    }

    throw new Error(up.error.message || upd.error?.message || 'Kunne ikke oppdatere lager.');
  }

  // Gjør også den gamle hjelpefunksjonen trygg hvis annen kode bruker den.
  try { window.settLagerAntall = tryggSettLagerAntall; settLagerAntall = tryggSettLagerAntall; } catch(e) { window.settLagerAntall = tryggSettLagerAntall; }

  async function loggFylling(rad){
    if (!window.supabaseClient) return;
    try {
      await supabaseClient.from('vet_lager_logg').insert({
        klinikk_id: rad.klinikk_id,
        bil_id: rad.bil_id,
        vare_id: rad.vare_id,
        type: 'fyll_bil',
        retning: 'inn_bil',
        antall: Number(rad.antall || 0),
        beholdning_for: Number(rad.beholdning_for || 0),
        beholdning_etter: Number(rad.beholdning_etter || 0),
        opprettet_av: window.vetInnloggetKlinikkBrukerId || window.vetInnloggetAuthUserId || null,
        opprettet_av_epost: window.vetInnloggetEpost || null,
        opprettet_av_navn: window.vetInnloggetBrukerNavn || null,
        kommentar: `Fylte ${rad.antall} ${varenavn(rad.vare_id)} på ${bilnavn(rad.bil_id)}`
      });
    } catch(e) {
      console.warn('Lagerlogg ble ikke lagret:', e.message || e);
    }
  }

  function hentValgteFyllBilLinjer(){
    const inputs = Array.from(document.querySelectorAll('.fyllbil-antall'));
    const valgte = new Set(Array.from(document.querySelectorAll('.fyllbil-velg:checked')).map(cb => String(cb.dataset.vareId || '')));
    const map = new Map();

    inputs.forEach(input => {
      const vareId = String(input.dataset.vareId || '');
      if (!vareId) return;
      const ant = heltall(input.value);
      if (valgte.has(vareId) || ant > 0) {
        map.set(vareId, { vareId, antall: ant });
      }
    });

    return Array.from(map.values());
  }

  async function fyllBilTrygt(e){
    if (e) { e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); }

    if (window.__vetFyllBilPågår) return false;
    window.__vetFyllBilPågår = true;

    const knapp = $('flyttTilBilKnapp');
    if (knapp) knapp.disabled = true;

    try {
      melding('billagerMelding', '');
      const kid = klinikkId();
      const bilId = tekst('fyllBilValg');

      if (!kid || !bilId) {
        melding('billagerMelding', 'Velg bil først.');
        return false;
      }

      const linjer = hentValgteFyllBilLinjer();
      if (!linjer.length) {
        melding('billagerMelding', 'Velg minst én vare og skriv antall.');
        return false;
      }

      for (const l of linjer) {
        if (!(l.antall > 0) || !Number.isInteger(l.antall)) {
          melding('billagerMelding', 'Antall må være heltall større enn 0.');
          return false;
        }
        const hoved = arr('vetHovedlager').find(r => String(r.vare_id) === String(l.vareId));
        const hovedAntall = Number(hoved?.antall || 0);
        if (hovedAntall < l.antall) {
          melding('billagerMelding', `${varenavn(l.vareId)}: ikke nok på hovedlager. Tilgjengelig: ${Math.round(hovedAntall)}.`);
          return false;
        }
      }

      for (const l of linjer) {
        const hoved = arr('vetHovedlager').find(r => String(r.vare_id) === String(l.vareId));
        const hovedAntall = Number(hoved?.antall || 0);
        const bilRad = arr('vetBilLager').find(r => String(r.bil_id) === String(bilId) && String(r.vare_id) === String(l.vareId));
        const bilFor = Number(bilRad?.antall || 0);
        const bilEtter = bilFor + l.antall;

        await tryggSettLagerAntall('vet_lager', { klinikk_id: kid, vare_id: l.vareId }, hovedAntall - l.antall);
        await tryggSettLagerAntall('vet_bil_lager', { klinikk_id: kid, bil_id: bilId, vare_id: l.vareId }, bilEtter);
        await loggFylling({ klinikk_id: kid, bil_id: bilId, vare_id: l.vareId, antall: l.antall, beholdning_for: bilFor, beholdning_etter: bilEtter });
      }

      melding('billagerMelding', `La ${linjer.length} varelinje(r) på ${bilnavn(bilId)}.`);
      if (typeof lastVetLagerAlt === 'function') await lastVetLagerAlt();
      if (typeof window.vetHardSmalListeDraw === 'function') setTimeout(window.vetHardSmalListeDraw, 100);
      if (typeof window.lastVetLagerLogg === 'function') await window.lastVetLagerLogg();
      return false;
    } catch(err) {
      melding('billagerMelding', 'Feil ved fylling av bil: ' + (err.message || err));
      return false;
    } finally {
      window.__vetFyllBilPågår = false;
      if (knapp) knapp.disabled = false;
    }
  }

  function kobleHardt(){
    const gammel = $('flyttTilBilKnapp');
    if (!gammel || gammel.dataset.dupKeyFinal === '1') return;

    const ny = gammel.cloneNode(true);
    ny.dataset.dupKeyFinal = '1';
    ny.onclick = fyllBilTrygt;
    gammel.parentNode.replaceChild(ny, gammel);
  }

  window.flyttTilBil = fyllBilTrygt;
  window.flyttTilBilMedLogg = fyllBilTrygt;

  document.addEventListener('DOMContentLoaded', () => setTimeout(kobleHardt, 500));
  window.addEventListener('load', () => setTimeout(kobleHardt, 800));
  setTimeout(kobleHardt, 1200);
})();
