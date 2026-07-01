// Rett i Lomma håndverker - strukturert SysAdm og bedriftadministrasjon
(function(){
  'use strict';
  if(window.__HAND_SYSTEMADMIN_STRUCTURED_V1) return;
  window.__HAND_SYSTEMADMIN_STRUCTURED_V1 = true;

  function $(id){ return document.getElementById(id); }
  function s(v){ return String(v == null ? '' : v); }
  function n(v){ return s(v).trim().toLowerCase(); }
  function val(id){ return s($(id) && $(id).value).trim(); }
  function setVal(id,v){ const e=$(id); if(e) e.value = v == null ? '' : String(v); }
  function esc(v){ return s(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function client(){ return window.supabaseClient || (window.supabase && window.supabase.from ? window.supabase : null); }
  function msg(t, feil){ const e=$('nyHandKundeMelding') || $('firmaMelding') || $('modulStatus'); if(e){ e.textContent=t||''; e.style.color=feil?'#fca5a5':'#86efac'; } else if(feil){ alert(t); } }
  function show(el){ if(!el) return; el.hidden=false; el.classList.remove('skjult','hidden','modul-skjult'); el.style.display=''; el.style.visibility='visible'; el.removeAttribute('aria-hidden'); }
  function hide(el){ if(!el) return; el.hidden=true; el.classList.add('skjult','hidden'); el.style.display='none'; el.setAttribute('aria-hidden','true'); }
  function slugify(v){ return s(v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function appBase(){ const p=location.pathname.toLowerCase(); if(p.includes('/rettilomma/')) return location.origin + '/rettilomma/handverker/'; if(p.includes('/handverker/')) return location.origin + '/handverker/'; return location.origin + '/handverker/'; }
  function rootBase(){ return location.pathname.toLowerCase().includes('/rettilomma/') ? location.origin + '/rettilomma/' : location.origin + '/'; }
  function kundelink(slug){ return appBase() + '?firma=' + encodeURIComponent(slug || ''); }
  function firmaNavn(r){ return r && (r.navn || r.firmanavn || r.firma_navn || r.kundenavn || '') || ''; }
  function firmaEpost(r){ return r && (r.epost || r.email || '') || ''; }
  function firmaOrg(r){ return r && (r.orgnr || r.org_nr || r.organisasjonsnummer || '') || ''; }
  function firmaSlug(r){ return r && (r.linknavn || r.slug || slugify(firmaNavn(r) || firmaEpost(r) || r.id)) || ''; }

  async function erSysadm(){
    if(window.erSystemadmin === true || window.handErGlobalSysadm === true) return true;
    if(typeof window.handRefreshSysadmRolle === 'function') return await window.handRefreshSysadmRolle();
    return false;
  }

  function ensureEditField(){
    if(!$('redigerHandKundeId')){
      const i=document.createElement('input'); i.type='hidden'; i.id='redigerHandKundeId';
      const host=$('handSystemadminBlokk') || document.body; host.appendChild(i);
    }
  }

  function bindLinkFelter(){
    ensureEditField();
    const navn=$('nyHandKundeNavn'), slug=$('nyHandKundeLinknavn');
    function upd(){ const sl=slugify(val('nyHandKundeNavn')); setVal('nyHandKundeLinknavn', sl); setVal('nyHandKundeLink', kundelink(sl)); }
    if(navn && navn.dataset.handSysadmSlugBind !== '1'){ navn.dataset.handSysadmSlugBind='1'; navn.addEventListener('input', upd); }
    if(slug){ slug.readOnly=true; slug.title='Opprettes automatisk fra firmanavn'; }
  }

  function bindSystemadminKnapper(){
    bindLinkFelter();
    const sys=$('sysadminModeKnapp'); if(sys){ sys.textContent='SysAdm'; sys.type='button'; sys.onclick=window.handAapneSysadmPanel || window.visHandKundeAdminSide; }
    const ny=$('sysadminNyKundeKnapp'); if(ny){ ny.textContent='Ny bedrift'; ny.onclick=function(ev){ ev.preventDefault(); show($('handSystemadminBlokk')); $('nyHandKundeNavn')?.focus(); return false; }; }
    const liste=$('sysadminKundelisteKnapp'); if(liste){ liste.textContent='Hent/oppdater bedrifter'; liste.onclick=function(ev){ ev.preventDefault(); window.handLastKundeliste(); return false; }; }
    hide($('sysadminModulerKnapp')); hide($('visModulerKnapp')); hide($('velgModulKnapp'));
  }

  async function maybeSendPassordEpost(epost){
    try{ const r = await client()?.auth?.resetPasswordForEmail?.(epost, { redirectTo: rootBase() + 'reset.html' }); return !r?.error; }catch(e){ return false; }
  }

  async function adaptiveInsert(table, payload){
    let p=Object.assign({}, payload);
    for(let i=0;i<25;i++){
      Object.keys(p).forEach(k => { if(p[k] === undefined || p[k] === '') delete p[k]; });
      const r = await client().from(table).insert([p]).select('*').maybeSingle();
      if(!r.error) return r.data || p;
      const m=s(r.error.message || r.error);
      const col=(m.match(/Could not find the '([^']+)' column/i)||[])[1] || (m.match(/column "([^"]+)"/i)||[])[1] || (m.match(/'([^']+)' column/i)||[])[1];
      if(col && Object.prototype.hasOwnProperty.call(p,col)){ delete p[col]; continue; }
      throw r.error;
    }
    throw new Error('Kunne ikke lagre i '+table+'.');
  }

  async function adaptiveUpdate(table, id, payload){
    let p=Object.assign({}, payload);
    for(let i=0;i<25;i++){
      Object.keys(p).forEach(k => { if(p[k] === undefined || p[k] === '') delete p[k]; });
      const r = await client().from(table).update(p).eq('id', id).select('*').maybeSingle();
      if(!r.error) return r.data || p;
      const m=s(r.error.message || r.error);
      const col=(m.match(/Could not find the '([^']+)' column/i)||[])[1] || (m.match(/column "([^"]+)"/i)||[])[1] || (m.match(/'([^']+)' column/i)||[])[1];
      if(col && Object.prototype.hasOwnProperty.call(p,col)){ delete p[col]; continue; }
      throw r.error;
    }
    throw new Error('Kunne ikke oppdatere '+table+'.');
  }

  async function upsertFirmaBrukerAdmin(firma, navn, epost){
    if(!firma || !firma.id || !epost) return;
    const rad={ firma_id:firma.id, epost:epost, rolle:'admin' };
    try{
      const ex=await client().from('hand_firma_bruker').select('id').eq('firma_id', firma.id).ilike('epost', epost).limit(1);
      if(!ex.error && ex.data && ex.data.length) await client().from('hand_firma_bruker').update(rad).eq('id', ex.data[0].id);
      else await client().from('hand_firma_bruker').insert([rad]);
    }catch(e){ console.warn('Kunne ikke opprette admin i hand_firma_bruker:', e); }
    try{
      const ansatt={ firma_id:firma.id, navn:navn, epost:epost, rolle:'admin', er_admin:true, aktiv:true };
      const ex=await client().from('hand_ansatt').select('id').ilike('epost', epost).limit(1);
      if(!ex.error && ex.data && ex.data.length) await client().from('hand_ansatt').update(ansatt).eq('id', ex.data[0].id);
      else await adaptiveInsert('hand_ansatt', ansatt);
    }catch(e){ console.warn('Kunne ikke opprette admin i hand_ansatt:', e); }
  }

  function dedupe(rows){
    const out=[], seen=new Set();
    (rows||[]).forEach(r => {
      const key = r.id ? 'id:'+r.id : (firmaEpost(r) ? 'epost:'+n(firmaEpost(r)) : 'navn:'+n(firmaNavn(r)));
      if(!seen.has(key)){ seen.add(key); out.push(r); }
    });
    out.sort((a,b)=>s(firmaNavn(a)||firmaEpost(a)).localeCompare(s(firmaNavn(b)||firmaEpost(b)), 'nb'));
    return out;
  }

  function renderFirma(rows){
    const liste=$('handKundeAdminListe'); if(!liste) return;
    rows=dedupe(rows); window.handAdminKunder=rows; window.handFirmaRows=rows;
    if(!rows.length){ liste.innerHTML='<div class="info">Ingen bedrifter funnet i hand_firma.</div>'; return; }
    liste.innerHTML = '<div style="margin-bottom:10px"><b>Fant '+rows.length+' bedrifter fra hand_firma.</b></div>'+
      rows.map((r,idx)=>{
        const navn=firmaNavn(r), epost=firmaEpost(r), org=firmaOrg(r), slug=firmaSlug(r), link=r.kundelink || r.kunde_link || kundelink(slug);
        return '<div class="hand-bedriftkort" style="margin:10px 0;padding:14px 16px;border:1px solid #1f2937;border-radius:10px;background:#111827">'+
          '<div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">'+
          '<div><div style="font-weight:700">'+esc(navn || '(uten navn)')+'</div>'+
          (epost?'<div>'+esc(epost)+'</div>':'')+(org?'<div style="opacity:.8">Org.nr: '+esc(org)+'</div>':'')+
          '<div style="opacity:.6;font-size:12px">hand_firma</div></div>'+
          '<div style="white-space:nowrap"><button type="button" data-hand-edit-bedrift="'+idx+'">Rediger</button> <button type="button" data-hand-copy-link="'+esc(link)+'">Kopier link</button></div></div></div>';
      }).join('');
  }

  window.handLastKundeliste = async function(){
    bindSystemadminKnapper();
    const liste=$('handKundeAdminListe'); if(!liste || !client()) return;
    if(!(await erSysadm())){ liste.innerHTML='<div class="melding">Bare SysAdm kan hente bedrifter.</div>'; return; }
    try{
      liste.innerHTML='<div class="info">Henter bedrifter fra hand_firma...</div>';
      let r=await client().from('hand_firma').select('*').order('navn',{ascending:true}).limit(1000);
      if(r.error) r=await client().from('hand_firma').select('*').limit(1000);
      if(r.error) throw r.error;
      renderFirma(r.data || []);
    }catch(e){ liste.innerHTML='<div class="melding">Kunne ikke hente bedrifter: '+esc(e.message || e)+'</div>'; }
  };
  window.handLastBedriftsliste = window.handLastKundeliste;

  window.handRedigerKunde = function(idOrIndex){
    const rows=window.handAdminKunder || [];
    let r=rows.find(x => s(x.id) === s(idOrIndex));
    if(!r && rows[Number(idOrIndex)]) r=rows[Number(idOrIndex)];
    if(!r){ msg('Fant ikke valgt bedrift.', true); return; }
    const slug=firmaSlug(r);
    setVal('redigerHandKundeId', r.id || ''); setVal('nyHandKundeNavn', firmaNavn(r)); setVal('nyHandKundeEpost', firmaEpost(r));
    setVal('nyHandKundeTelefon', r.telefon || ''); setVal('nyHandKundeAdresse', r.adresse || ''); setVal('nyHandKundeOrgNr', firmaOrg(r));
    setVal('nyHandKundeLinknavn', slug); setVal('nyHandKundeLink', r.kundelink || r.kunde_link || kundelink(slug));
    msg('Redigerer: '+(firmaNavn(r)||firmaEpost(r)||r.id));
    const blokk=$('handSystemadminBlokk'); if(blokk) show(blokk);
    try{ if(typeof window.handVisModulerUnderRedigerFirma === 'function') window.handVisModulerUnderRedigerFirma(r.id); }catch(e){}
  };

  window.handKopierTekst = async function(t){ try{ await navigator.clipboard.writeText(t || ''); msg('Kopiert.'); }catch(e){ msg('Kopier manuelt: '+t); } };
  window.handKopierKundelinkDirekte = function(){ window.handKopierTekst(val('nyHandKundeLink')); };
  window.handNullstillKundeSkjema = function(){ ['redigerHandKundeId','nyHandKundeNavn','nyHandKundeEpost','nyHandKundeTelefon','nyHandKundeAdresse','nyHandKundeOrgNr','nyHandKundeLinknavn','nyHandKundePassord','nyHandKundeLink'].forEach(id=>setVal(id,'')); msg('Klar for ny bedrift.'); };

  window.handOpprettKundeDirekte = async function(){
    if(window.handOppretterKunde){ msg('Opprettelse pågår allerede. Vent litt.', true); return; }
    window.handOppretterKunde=true;
    try{
      if(!(await erSysadm())){ msg('Bare SysAdm kan opprette/endre bedrifter.', true); return; }
      const id=val('redigerHandKundeId');
      const navn=val('nyHandKundeNavn'); const epost=val('nyHandKundeEpost').toLowerCase(); const slug=slugify(navn);
      if(!navn){ msg('Skriv firmanavn.', true); return; }
      if(!epost){ msg('Skriv e-post.', true); return; }
      setVal('nyHandKundeLinknavn', slug); setVal('nyHandKundeLink', kundelink(slug));
      const payload={ navn:navn, epost:epost, telefon:val('nyHandKundeTelefon') || null, adresse:val('nyHandKundeAdresse') || null, orgnr:val('nyHandKundeOrgNr') || null, linknavn:slug, system_type:'handverker', moduler_konfigurert:false };
      let firma;
      if(id){ msg('Lagrer bedrift...'); firma=await adaptiveUpdate('hand_firma', id, payload); }
      else{
        msg('Sjekker om bedriften finnes fra før...');
        const ex=await client().from('hand_firma').select('*').or('epost.ilike.'+epost+',linknavn.eq.'+slug).limit(1);
        if(!ex.error && ex.data && ex.data.length){ firma=await adaptiveUpdate('hand_firma', ex.data[0].id, payload); }
        else { msg('Oppretter bedrift...'); firma=await adaptiveInsert('hand_firma', payload); }
      }
      await upsertFirmaBrukerAdmin(firma, navn, epost);
      const passordSendt = await maybeSendPassordEpost(epost);
      msg((id ? 'Bedrift oppdatert.' : 'Bedrift opprettet.') + (passordSendt ? ' Passord-e-post er sendt.' : ''), false);
      await window.handLastKundeliste();
    }catch(e){ console.error(e); msg('Feil: '+(e.message || e), true); }
    finally{ window.handOppretterKunde=false; }
  };
  window.handLagreRedigertKunde = window.handOpprettKundeDirekte;
  window.handSendPassordopprettingDirekte = async function(){ const epost=val('nyHandKundeEpost').toLowerCase(); if(!epost){ msg('Skriv e-post først.', true); return; } msg('Sender passord-e-post...'); msg(await maybeSendPassordEpost(epost) ? 'Passord-e-post sendt.' : 'Kunne ikke sende passord-e-post.', false); };

  document.addEventListener('click', function(ev){
    const edit=ev.target && ev.target.closest && ev.target.closest('[data-hand-edit-bedrift]');
    if(edit){ ev.preventDefault(); window.handRedigerKunde(edit.getAttribute('data-hand-edit-bedrift')); return false; }
    const copy=ev.target && ev.target.closest && ev.target.closest('[data-hand-copy-link]');
    if(copy){ ev.preventDefault(); window.handKopierTekst(copy.getAttribute('data-hand-copy-link')); return false; }
  }, true);

  function start(){ bindSystemadminKnapper(); if(typeof window.handOppdaterSysadmUI === 'function') window.handOppdaterSysadmUI(); }
  document.addEventListener('DOMContentLoaded', function(){ start(); setTimeout(start,300); });
  document.addEventListener('handPartialerLastet', function(){ start(); setTimeout(start,300); });
  window.addEventListener('load', function(){ start(); setTimeout(start,500); });
})();
