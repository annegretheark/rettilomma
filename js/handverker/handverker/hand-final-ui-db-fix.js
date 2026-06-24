

async function handSafeInsertBilBestilling(rows) {
  const klient = window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null);
  if (!klient) return { error: { message: "Supabase er ikke lastet." } };

  const uuidFelter = ["id", "firma_id", "bil_id", "vare_id", "bruker_id", "ansatt_id"];
  const erUuid = v => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

  function rensRad(rad) {
    const out = { ...(rad || {}) };
    for (const k of Object.keys(out)) {
      if (out[k] === undefined || out[k] === "") delete out[k];
    }
    uuidFelter.forEach(k => {
      if (out[k] != null && !erUuid(String(out[k]))) delete out[k];
    });
    return out;
  }

  let payload = Array.isArray(rows) ? rows.map(rensRad) : [rensRad(rows || {})];

  for (let forsok = 0; forsok < 25; forsok++) {
    const res = await klient.from("hand_bil_bestilling").insert(payload);
    if (!res.error) return res;

    const msg = String(res.error.message || "");
    const mKol =
      msg.match(/Could not find the '([^']+)' column of 'hand_bil_bestilling'/i) ||
      msg.match(/column "([^"]+)".*does not exist/i);

    if (mKol) {
      const kol = mKol[1];
      payload.forEach(rad => { delete rad[kol]; });
      continue;
    }

    const mUuid = msg.match(/invalid input syntax for type uuid:\s*"([^"]+)"/i);
    if (mUuid) {
      const bad = mUuid[1];
      let fjernet = false;
      payload.forEach(rad => {
        Object.keys(rad).forEach(k => {
          if (String(rad[k]) === String(bad) || (uuidFelter.includes(k) && rad[k] != null && !erUuid(String(rad[k])))) {
            delete rad[k];
            fjernet = true;
          }
        });
      });
      if (fjernet) continue;
    }

    return res;
  }

  return { error: { message: "Kunne ikke lagre bestilling etter flere forsøk." } };
}

/* Rett i Lomma FINAL FIX 20260623
   - Topplinje samme bredde som aktivt skjema
   - Riktig overskrift når Min bil / fyll lager er valgt
   - Bilbestilling uten bil_navn-kolonne (kolonnen finnes ikke i DB)
   - Lagerlogg uten feil Supabase-relasjoner til biler/varer
   - Sikrer at bilvalg ikke blir tomt hvis aktiv bil finnes
*/
(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]; }); }
  function tall(v){ var n=Number(String(v ?? '0').replace(',','.')); return Number.isFinite(n)?n:0; }
  function isVisible(el){ return !!(el && el.offsetParent !== null && getComputedStyle(el).display !== 'none'); }

  function topbarKort(){
    var h = $('handSideOverskrift');
    return h ? h.closest('.kort') : null;
  }
  function aktivtInnholdKort(){
    var ids=['bilerSide','timerSide','jobberSide','fravaerSide','varerSide','fakturaSide','kundeSide','ansattSide','firmaSide','tilbudSide','lonnPanel','modulerSide','testSide'];
    for(var i=0;i<ids.length;i++){
      var el=$(ids[i]);
      if(isVisible(el)) return el;
    }
    return $('timerSide') || $('bilerSide');
  }
  function justerTopplinje(){
    var top=topbarKort();
    var aktiv=aktivtInnholdKort();
    if(!top) return;
    var w = 760;
    try{
      if(aktiv){
        var r=aktiv.getBoundingClientRect();
        if(r && r.width > 300) w=Math.round(r.width);
      }
    }catch(e){}
    top.style.maxWidth=w+'px';
    top.style.marginLeft='auto';
    top.style.marginRight='auto';
    top.style.boxSizing='border-box';
    var h=$('handSideOverskrift');
    if(h){ h.style.textAlign='center'; h.style.width='100%'; }
  }
  function setTittel(t){ var h=$('handSideOverskrift'); if(h) h.textContent=t; justerTopplinje(); }

  function visBilSideRent(){
    var sideIds=['timerSide','jobberSide','tilbudSide','backupSide','fakturaSide','varerSide','kundeSide','ansattSide','firmaSide','bilBestillingerSide','testSide','lonnPanel','fravaerSide','modulerSide','sysadminPanelSide'];
    sideIds.forEach(function(id){ var el=$(id); if(el){ el.classList.add('skjult','hidden'); el.style.display='none'; }});
    var b=$('bilerSide');
    if(b){ b.classList.remove('skjult','hidden','modul-skjult'); b.style.display=''; }
    setTittel('Min bil / fyll lager');
    var h2=b && b.querySelector('h2');
    if(h2){ h2.textContent='Min bil / lager'; h2.style.textAlign='center'; h2.style.width='100%'; }
    setTimeout(sikreBilvalg,50); setTimeout(sikreBilvalg,400); setTimeout(justerTopplinje,100);
  }

  var gammelVisBilerSide = window.visBilerSide;
  window.visBilerSide = async function(){
    try{ if(typeof gammelVisBilerSide==='function') await gammelVisBilerSide.apply(this, arguments); }catch(e){ console.warn('visBilerSide original feilet:', e); }
    visBilSideRent();
    return false;
  };

  document.addEventListener('click', function(e){
    var k=e.target && e.target.closest && e.target.closest('#visBilerKnapp');
    if(!k) return;
    e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    window.visBilerSide();
    return false;
  }, true);

  ['visTimerKnapp','visJobberKnapp','visFravaerKnapp'].forEach(function(id){
    document.addEventListener('click', function(e){
      var k=e.target && e.target.closest && e.target.closest('#'+id); if(!k) return;
      setTimeout(function(){
        if(id==='visTimerKnapp') setTittel('Timeregistrering');
        if(id==='visJobberKnapp') setTittel('Jobber');
        if(id==='visFravaerKnapp') setTittel('Fravær / Flexi');
      },80);
    }, true);
  });

  async function hentFirmaId(){
    try{ if(typeof window.hentAktivFirmaId==='function') return await window.hentAktivFirmaId(); }catch(e){}
    try{ if(typeof window.hentInnloggetFirmaIdForBiler==='function') return await window.hentInnloggetFirmaIdForBiler(); }catch(e){}
    return window.aktivFirmaId || window.firmaData?.id || window.firma?.id || null;
  }

  window.handLagreBilBestilling = async function(rad){
    if(!window.supabaseClient) throw new Error('Supabase er ikke lastet.');
    var payload = {
      firma_id: rad.firma_id || await hentFirmaId(),
      bil_id: rad.bil_id || null,
      vare_id: rad.vare_id || null,
      varenr: rad.varenr || null,
      varenavn: rad.varenavn || null,
      bestilt: tall(rad.bestilt),
      levert: tall(rad.levert),
      rest: tall(rad.rest),
      status: rad.status || 'venter',
      hentet_av: rad.hentet_av || null,
      bruker_id: rad.bruker_id || null,
      bruker_epost: rad.bruker_epost || null,
      bruker_navn: rad.bruker_navn || null,
      hovedlager_for: tall(rad.hovedlager_for),
      hovedlager_etter: tall(rad.hovedlager_etter)
    };
    Object.keys(payload).forEach(function(k){ if(payload[k] === undefined) delete payload[k]; });
    var res = await handSafeInsertBilBestilling([payload]);
    if(res.error) throw res.error;
    return true;
  };

  async function sikreBilvalg(){
    var sel=$('bilLagerBilValg'); if(!sel) return;
    var aktivId=localStorage.getItem('aktivBilId') || window.aktivBilId || sel.value || '';
    var aktivNavn=localStorage.getItem('aktivBilNavn') || window.aktivBilNavn || '';
    if(aktivId && !Array.from(sel.options).some(function(o){ return String(o.value)===String(aktivId); })){
      var opt=document.createElement('option'); opt.value=aktivId; opt.textContent=aktivNavn || ('Bil '+aktivId); sel.appendChild(opt); sel.value=aktivId;
    }
    if(sel.options.length<=1 && window.supabaseClient){
      try{
        var q=window.supabaseClient.from('hand_bil').select('*').order('navn',{ascending:true});
        var firma=await hentFirmaId();
        if(firma) q=q.eq('firma_id', firma);
        var r=await q.limit(100);
        if(!r.error && Array.isArray(r.data) && r.data.length){
          window.biler=r.data;
          sel.innerHTML='<option value="">Velg bil</option>';
          r.data.filter(function(b){ return b.aktiv !== false; }).forEach(function(b){
            var o=document.createElement('option'); o.value=b.id; o.textContent=(b.navn || 'Bil') + (b.regnr ? ' - '+b.regnr : ''); sel.appendChild(o);
          });
          if(aktivId && Array.from(sel.options).some(function(o){ return String(o.value)===String(aktivId); })) sel.value=aktivId;
          else if(sel.options.length===2) sel.selectedIndex=1;
        }
      }catch(e){ console.warn('Kunne ikke sikre bilvalg:', e); }
    }
  }
  window.sikreBilvalg = sikreBilvalg;

  function finnVareNavn(rad, vareMap){
    var v = (rad && rad.varer) || (vareMap && vareMap[String(rad.vare_id)]) || {};
    var varenr = v.varenr || rad.varenr || '';
    var navn = v.navn || v.varenavn || rad.varenavn || rad.vare_navn || rad.navn || 'Vare';
    return (varenr ? varenr + ' - ' : '') + navn;
  }
  function datoNo(v){ if(!v) return ''; try{return new Date(v).toLocaleString('no-NO');}catch(e){return String(v);} }
  function loggNavn(rad){ return rad.hentet_av || rad.bruker_navn || rad.bruker_epost || rad.opprettet_av_navn || rad.opprettet_av || ''; }
  function valgtBilId(){ try{ if(typeof window.hentValgtBilIdForBilLager==='function') return window.hentValgtBilIdForBilLager() || ''; }catch(e){} return $('bilLagerBilValg')?.value || localStorage.getItem('aktivBilId') || ''; }
  function valgtBilTekst(){ var s=$('bilLagerBilValg'); if(s && s.value) return s.selectedOptions?.[0]?.textContent || 'valgt bil'; return localStorage.getItem('aktivBilNavn') || 'valgt bil'; }

  window.tegnLagerloggForBil = async function(){
    var base=$('bilLagerListe') || $('bilerSide'); if(!base) return;
    var boks=$('bilLagerLoggListe');
    if(!boks){
      var wrap=document.createElement('div'); wrap.id='bilLagerLoggWrap'; wrap.style.marginTop='18px';
      wrap.innerHTML='<h4>Lagerlogg</h4><p class="info">Loggen viser først mottatte varer etter at brukeren har trykket <strong>Bekreft mottatt og legg på bil</strong>.</p><div id="bilLagerLoggListe"><p class="info">Laster lagerlogg...</p></div>';
      base.after(wrap); boks=$('bilLagerLoggListe');
    }
    if(!window.supabaseClient){ boks.innerHTML='<p class="info">Supabase er ikke lastet.</p>'; return; }
    var bilId=valgtBilId(); if(!bilId){ boks.innerHTML='<p class="info">Velg bil for å se lagerlogg.</p>'; return; }
    boks.innerHTML='<p class="info">Laster lagerlogg...</p>';
    var res=await window.supabaseClient.from('hand_lagerlogg')
      .select('*')
      .eq('bil_id', bilId).limit(100);
    if(res.error){ boks.innerHTML='<p class="melding">Lagerlogg kunne ikke hentes, men varelisten vises fortsatt: '+esc(res.error.message)+'</p>'; return; }
    var data=res.data || [];
    if(!data.length){ boks.innerHTML='<p class="info">Ingen lagerlogg for '+esc(valgtBilTekst())+' ennå.</p>'; return; }
    var ids=[...new Set(data.map(function(r){return r.vare_id;}).filter(Boolean).map(String))];
    var vareMap={};
    if(ids.length){
      try{ var vr=await window.supabaseClient.from('hand_vare').select('id,varenr,navn,varenavn').in('id', ids); if(!vr.error) (vr.data||[]).forEach(function(v){ vareMap[String(v.id)]=v; }); }catch(e){}
    }
    boks.innerHTML='<div class="info" style="margin:8px 0 6px 0;font-weight:bold;">Lagerlogg for '+esc(valgtBilTekst())+'</div>'+
      '<table class="bil-tabell"><thead><tr><th>Dato</th><th>Vare</th><th>Antall</th><th>Handling</th><th>Bruker</th><th>Kommentar</th></tr></thead><tbody>'+
      data.map(function(r){ return '<tr><td>'+esc(datoNo(r.created_at))+'</td><td>'+esc(finnVareNavn(r, vareMap))+'</td><td>'+esc(r.antall ?? '')+'</td><td>'+esc(r.handling || '')+'</td><td>'+esc(loggNavn(r))+'</td><td>'+esc(r.kommentar || '')+'</td></tr>'; }).join('')+
      '</tbody></table>';
  };

  document.addEventListener('change', function(e){ if(e.target && e.target.id==='bilLagerBilValg') setTimeout(window.tegnLagerloggForBil,80); }, true);
  document.addEventListener('handPartialerLastet', function(){
    var k=$('visBilerKnapp'); if(k) k.textContent='Min bil / fyll lager';
    justerTopplinje(); sikreBilvalg();
  });
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(justerTopplinje,200); setTimeout(sikreBilvalg,700); });
  window.addEventListener('load', function(){ setTimeout(justerTopplinje,300); setTimeout(sikreBilvalg,900); setTimeout(justerTopplinje,1500); });
  window.addEventListener('resize', function(){ setTimeout(justerTopplinje,100); });
})();


// RIL 20260623: hard fix for "invalid input syntax for type uuid: \"25\"" on Send bestilling.
// Sends only safe non-UUID fields to hand_bil_bestilling. Missing columns are removed and retried.
(function(){
  function $(id){ return document.getElementById(id); }
  function tall(v){ var n = Number(String(v ?? 0).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function msg(t, err){ var e=$('bilMelding'); if(e){ e.textContent=t; e.style.color=err?'#fca5a5':'#86efac'; } }
  async function safeInsertBestilling(rows){
    var klient = window.supabaseClient;
    if(!klient) return { error:{ message:'Supabase er ikke lastet.' } };
    var payload = (Array.isArray(rows)?rows:[rows]).map(function(r){
      var o = Object.assign({}, r || {});
      Object.keys(o).forEach(function(k){ if(o[k] === undefined || o[k] === null || o[k] === '') delete o[k]; });
      // Ikke send noen *_id/id-felter her. I databasen er noen UUID, mens appen har tall-id som 25.
      Object.keys(o).forEach(function(k){ if(k === 'id' || /_id$/.test(k)) delete o[k]; });
      return o;
    });
    for(var i=0;i<30;i++){
      var res = await klient.from('hand_bil_bestilling').insert(payload);
      if(!res.error) return res;
      var tekst = String(res.error.message || '');
      var m = tekst.match(/Could not find the '([^']+)' column of 'hand_bil_bestilling'/i) || tekst.match(/column "([^"]+)".*does not exist/i);
      if(m){ payload.forEach(function(r){ delete r[m[1]]; }); continue; }
      var u = tekst.match(/invalid input syntax for type uuid:\s*"([^"]+)"/i);
      if(u){
        var bad = String(u[1]);
        payload.forEach(function(r){ Object.keys(r).forEach(function(k){ if(String(r[k]) === bad || k === 'id' || /_id$/.test(k)) delete r[k]; }); });
        continue;
      }
      return res;
    }
    return { error:{ message:'Kunne ikke lagre bestilling etter opprydding av kolonner.' } };
  }
  window.handLagreBilBestilling = async function(rad){
    var bilSel = $('bilLagerBilValg');
    var payload = {
      bil_navn: (bilSel && bilSel.options[bilSel.selectedIndex] ? bilSel.options[bilSel.selectedIndex].textContent : '') || rad.bil_navn || null,
      varenr: rad.varenr || null,
      varenavn: rad.varenavn || null,
      bestilt: tall(rad.bestilt || rad.antall || rad.antall_bestilt),
      levert: tall(rad.levert),
      rest: tall(rad.rest),
      status: rad.status || 'venter',
      hentet_av: rad.hentet_av || null,
      bruker_epost: rad.bruker_epost || (window.innloggetBruker && window.innloggetBruker.email) || null,
      bruker_navn: rad.bruker_navn || null,
      hovedlager_for: tall(rad.hovedlager_for),
      hovedlager_etter: tall(rad.hovedlager_etter)
    };
    var res = await safeInsertBestilling([payload]);
    if(res.error) throw res.error;
    return true;
  };
  function koble(){
    var b=$('sendBilLagerBestillingKnapp');
    if(!b || b.dataset.rilUuidHardfix === '1') return;
    b.dataset.rilUuidHardfix = '1';
    b.addEventListener('click', function(){ setTimeout(function(){
      var e=$('bilMelding');
      if(e && /Bestilling sendt|Lagerbestilling sendt/i.test(e.textContent||'')) msg('Bestilling sendt til admin.', false);
    }, 500); }, true);
  }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(koble,100); setTimeout(koble,1000); });
  window.addEventListener('load', function(){ setTimeout(koble,100); setTimeout(koble,1000); });
})();
