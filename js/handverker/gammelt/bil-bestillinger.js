// Rett i Lomma - bilbestillinger/restordre
(function(){
  function $(id){ return document.getElementById(id); }
  function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function krTall(v){ const n=Number(v||0); return Number.isFinite(n)?n:0; }
  function fmtDato(v){ return v ? String(v).slice(0,16).replace('T',' ') : ''; }
  function erAdmin(){ return window.erAdmin === true && localStorage.getItem('rilAdminModus') === 'ja'; }

  function msg(t, feil){
    const e = $('bilBestillingerMelding');
    if(e){ e.textContent = t || ''; e.style.color = feil ? '#fca5a5' : '#86efac'; }
  }

  async function hentFirmaId(){
    try{
      if(typeof window.hentAktivFirmaId === 'function') return await window.hentAktivFirmaId();
    }catch(e){}
    return window.aktivFirmaId || window.firmaData?.id || window.firma?.id || null;
  }

  async function handLagreBilBestilling(rad){
    if(!window.supabaseClient) throw new Error('Supabase er ikke lastet.');
    const payload = {
      firma_id: rad.firma_id || await hentFirmaId(),
      bil_id: rad.bil_id || null,
      bil_navn: rad.bil_navn || null,
      vare_id: rad.vare_id || null,
      varenr: rad.varenr || null,
      varenavn: rad.varenavn || null,
      bestilt: krTall(rad.bestilt),
      levert: krTall(rad.levert),
      rest: krTall(rad.rest),
      status: rad.status || 'venter',
      hentet_av: rad.hentet_av || null,
      bruker_id: rad.bruker_id || null,
      bruker_epost: rad.bruker_epost || null,
      bruker_navn: rad.bruker_navn || null,
      hovedlager_for: krTall(rad.hovedlager_for),
      hovedlager_etter: krTall(rad.hovedlager_etter)
    };
    const {error} = await window.supabaseClient.from('bil_bestillinger').insert([payload]);
    if(error) throw error;
    return true;
  }

  function handVisBilBestillingKvittering({bil, hentetAv, rader}){
    let box = $('bilBestillingKvittering');
    const knapp = $('lagreBilLagerListeKnapp');
    if(!box){
      box = document.createElement('div');
      box.id = 'bilBestillingKvittering';
      box.className = 'listekort';
      box.style.display = 'none';
      box.style.marginTop = '12px';
      box.style.borderColor = '#0f766e';
      if(knapp && knapp.parentNode) knapp.parentNode.insertBefore(box, knapp.nextSibling);
    }
    const rows = (rader||[]).map(r => `
      <tr>
        <td style="padding:6px;border-bottom:1px solid #374151;">${esc((r.vare && (r.vare.varenr ? r.vare.varenr+' - ' : '') + (r.vare.navn || r.vare.varenavn || r.vare.beskrivelse || 'Vare')) || 'Vare')}</td>
        <td style="padding:6px;border-bottom:1px solid #374151;text-align:right;">${esc(r.bestilt)}</td>
        <td style="padding:6px;border-bottom:1px solid #374151;text-align:right;color:#86efac;">${esc(r.levert)}</td>
        <td style="padding:6px;border-bottom:1px solid #374151;text-align:right;color:${Number(r.rest)>0?'#fca5a5':'#86efac'};font-weight:bold;">${esc(r.rest)}</td>
      </tr>`).join('');
    const rest = (rader||[]).reduce((s,r)=>s+Number(r.rest||0),0);
    box.innerHTML = `
      <h3 style="margin-top:0;color:#86efac;">Bestilling sendt</h3>
      <div><b>Bil:</b> ${esc(bil || 'Valgt bil')}</div>
      ${hentetAv ? `<div><b>Hentet av:</b> ${esc(hentetAv)}</div>` : ''}
      <div><b>Status:</b> ${rest>0 ? 'Delvis levert / restordre sendt til admin' : 'Levert fra hovedlager og sendt til admin'}</div>
      <div style="overflow:auto;margin-top:10px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #374151;">Vare</th><th style="text-align:right;padding:6px;border-bottom:1px solid #374151;">Bestilt</th><th style="text-align:right;padding:6px;border-bottom:1px solid #374151;">Levert</th><th style="text-align:right;padding:6px;border-bottom:1px solid #374151;">Rest</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="info" style="margin-top:8px;">Dette er kvitteringen brukeren ser. Admin finner samme bestilling under Admin → Bilbestillinger.</div>
    `;
    box.style.display = 'block';
    try{ box.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){}
  }

  async function handLastBilBestillinger(){
    const liste = $('bilBestillingerListe');
    if(!liste) return;
    if(!window.supabaseClient){ liste.innerHTML = '<div class="melding">Supabase er ikke lastet.</div>'; return; }
    msg('Henter bilbestillinger...');
    try{
      let q = window.supabaseClient.from('bil_bestillinger').select('*').order('opprettet', {ascending:false}).limit(300);
      const firmaId = await hentFirmaId();
      if(firmaId && !(window.erSystemadmin === true)) q = q.eq('firma_id', firmaId);
      const {data,error} = await q;
      if(error) throw error;
      const rows = data || [];
      if(!rows.length){ liste.innerHTML = '<div class="info">Ingen bilbestillinger ennå.</div>'; msg(''); return; }
      liste.innerHTML = `
        <div style="overflow:auto;margin-top:10px;">
          <table class="bil-tabell">
            <thead><tr><th>Dato</th><th>Ansatt</th><th>Bil</th><th>Vare</th><th>Bestilt</th><th>Levert</th><th>Rest</th><th>Status</th><th>Handling</th></tr></thead>
            <tbody>
              ${rows.map(r => `
                <tr style="${Number(r.rest||0)>0 ? 'border-left:4px solid #fca5a5;' : ''}">
                  <td>${esc(fmtDato(r.opprettet || r.created_at))}</td>
                  <td>${esc(r.hentet_av || r.bruker_navn || r.bruker_epost || '')}</td>
                  <td>${esc(r.bil_navn || r.bil_id || '')}</td>
                  <td>${esc((r.varenr ? r.varenr + ' - ' : '') + (r.varenavn || r.vare_id || ''))}</td>
                  <td style="text-align:right;">${esc(r.bestilt || 0)}</td>
                  <td style="text-align:right;color:#86efac;">${esc(r.levert || 0)}</td>
                  <td style="text-align:right;color:${Number(r.rest||0)>0?'#fca5a5':'#86efac'};font-weight:bold;">${esc(r.rest || 0)}</td>
                  <td>${esc(r.status || '')}</td>
                  <td style="white-space:nowrap;">
                    <button type="button" class="secondary" style="font-size:12px;padding:5px 7px;" onclick="handSettBilBestillingStatus('${esc(r.id)}','under_behandling')">Behandles</button>
                    <button type="button" class="secondary" style="font-size:12px;padding:5px 7px;background:#0f766e;" onclick="handSettBilBestillingStatus('${esc(r.id)}','utlevert')">Utlevert</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
      msg('');
    }catch(e){
      console.error(e);
      liste.innerHTML = `<div class="melding">Kunne ikke hente bilbestillinger: ${esc(e.message || e)}</div>`;
      msg('Kunne ikke hente bilbestillinger.', true);
    }
  }

  async function handSettBilBestillingStatus(id, status){
    if(!id || !window.supabaseClient) return;
    const {error} = await window.supabaseClient.from('bil_bestillinger').update({status}).eq('id', id);
    if(error){ alert('Kunne ikke oppdatere status: ' + error.message); return; }
    await handLastBilBestillinger();
  }

  function visBilBestillingerSide(){
    if(!erAdmin()) { alert('Du har ikke tilgang til bilbestillinger.'); return; }
    if(typeof window.skjulAlleSider === 'function') window.skjulAlleSider();
    const side = $('bilBestillingerSide');
    if(side){ side.classList.remove('skjult','hidden'); side.style.display=''; }
    handLastBilBestillinger();
  }

  function bind(){
    const knapp = $('visBilBestillingerKnapp');
    if(knapp && knapp.dataset.handBilBestillingBind !== '1'){
      knapp.dataset.handBilBestillingBind = '1';
      knapp.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); visBilBestillingerSide(); });
    }
    const oppdater = $('oppdaterBilBestillingerKnapp');
    if(oppdater && oppdater.dataset.handBilBestillingBind !== '1'){
      oppdater.dataset.handBilBestillingBind = '1';
      oppdater.addEventListener('click', function(e){ e.preventDefault(); handLastBilBestillinger(); });
    }
  }

  window.handLagreBilBestilling = handLagreBilBestilling;
  window.handVisBilBestillingKvittering = handVisBilBestillingKvittering;
  window.handLastBilBestillinger = handLastBilBestillinger;
  window.handSettBilBestillingStatus = handSettBilBestillingStatus;
  window.visBilBestillingerSide = window.visBilBestillingerSide || visBilBestillingerSide;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
  window.addEventListener('load', bind);
  setTimeout(bind, 500);
})();
