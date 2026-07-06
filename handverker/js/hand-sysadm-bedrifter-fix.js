/* Handverker sysadm bedrifter SAFE v9
   Retter:
   - Oppretter bare i hand_firma.
   - Hindrer dobbelt-oppretting med global lås + eksisterende-sjekk på e-post/linknavn/orgnr.
   - Modulvalg holdes på Sysadm-panelet, ikke i vanlig Admin-meny.
*/
(function(){
  'use strict';
  try{ if(typeof window.user === 'undefined') window.user = null; }catch(e){}

  function $(id){ return document.getElementById(id); }
  function s(v){ return String(v == null ? '' : v); }
  function n(v){ return s(v).trim().toLowerCase(); }
  function esc(v){ return s(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function val(id){ var e=$(id); return s(e && e.value).trim(); }
  function setVal(id,v){ var e=$(id); if(e) e.value = v == null ? '' : String(v); }
  function client(){
    if(window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient;
    try{ if(typeof supabaseClient !== 'undefined' && supabaseClient && typeof supabaseClient.from === 'function') return supabaseClient; }catch(e){}
    return null;
  }
  function slugify(v){ return s(v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function appBase(){ return location.pathname.toLowerCase().indexOf('/rettilomma/')>=0 ? location.origin + '/rettilomma/handverker/' : location.origin + '/handverker/'; }
  function rootBase(){ return location.pathname.toLowerCase().indexOf('/rettilomma/')>=0 ? location.origin + '/rettilomma/' : location.origin + '/'; }
  function kundelink(slug){ return appBase() + '?firma=' + encodeURIComponent(slug || ''); }
  function msg(t, feil){ var e=$('nyHandKundeMelding') || $('firmaMelding') || $('modulStatus'); if(e){ e.textContent=t||''; e.style.color=feil?'#fca5a5':'#86efac'; } else if(feil){ alert(t); } }
  function withTimeout(p, ms, label){
    var timer;
    var timeout = new Promise(function(_, reject){ timer=setTimeout(function(){ reject(new Error((label||'Foresporsel')+' tok for lang tid.')); }, ms||12000); });
    return Promise.race([p, timeout]).finally(function(){ clearTimeout(timer); });
  }
  async function authUser(){
    var c=client(); if(!c || !c.auth) return null;
    try{ var r=await c.auth.getUser(); if(r && r.data && r.data.user) return r.data.user; }catch(e){}
    try{ var r2=await c.auth.getSession(); if(r2 && r2.data && r2.data.session && r2.data.session.user) return r2.data.session.user; }catch(e){}
    return null;
  }
  function show(el){ if(!el) return; el.classList.remove('hidden','skjult','modul-skjult'); el.hidden=false; el.style.display=''; el.style.visibility='visible'; el.removeAttribute('aria-hidden'); }
  function hide(el){ if(!el) return; el.classList.add('hidden','skjult'); el.hidden=true; el.style.display='none'; el.setAttribute('aria-hidden','true'); }
  function ensureEditField(){ if(!$('redigerHandKundeId')){ var i=document.createElement('input'); i.type='hidden'; i.id='redigerHandKundeId'; document.body.appendChild(i); } }
  function bindUi(){
    ensureEditField();
    var b=$('sysadminNyKundeKnapp'); if(b) b.textContent='Ny bedrift';
    var l=$('sysadminKundelisteKnapp'); if(l){ l.textContent='Hent/oppdater bedrifter'; l.onclick=function(ev){ if(ev) ev.preventDefault(); window.handLastKundeliste(); return false; }; }
    var li=$('handSysadmRefreshInline'); if(li){ li.textContent='Hent/oppdater bedrifter'; li.onclick=function(ev){ if(ev) ev.preventDefault(); window.handLastKundeliste(); return false; }; }
    var n1=$('nyHandKundeNavn');
    if(n1 && n1.dataset.handSysadmV9Slug !== '1'){
      n1.dataset.handSysadmV9Slug='1';
      n1.addEventListener('input',function(){ var slug=slugify(val('nyHandKundeNavn')); setVal('nyHandKundeLinknavn',slug); setVal('nyHandKundeLink',kundelink(slug)); });
    }
    // Modulvalg ligger kun under Rediger firma, ikke som egen knapp.
    hide($('visModulerKnapp'));
    hide($('velgModulKnapp'));
    hide($('sysadminModulerKnapp'));
  }
  function firmaNavn(r){ return r.navn || r.firmanavn || r.firma_navn || r.kundenavn || ''; }
  function firmaEpost(r){ return r.epost || r.email || ''; }
  function firmaAdresse(r){ return r.adresse || r.adresselinje || ''; }
  function firmaOrg(r){ return r.orgnr || r.org_nr || r.organisasjonsnummer || ''; }
  function firmaSlug(r){ return r.linknavn || r.slug || slugify(firmaNavn(r) || firmaEpost(r) || r.id); }
  function dedupe(rows){
    var out=[], seen={};
    (rows||[]).forEach(function(r){
      var key='';
      var id=s(r.id||r.firma_id||r.kunde_id); if(id) key='id:'+id;
      var e=n(firmaEpost(r)); if(!key && e) key='epost:'+e;
      var org=s(firmaOrg(r)).replace(/\D/g,''); if(!key && org) key='org:'+org;
      var slug=n(firmaSlug(r)); if(!key && slug) key='slug:'+slug;
      if(!key) key='rad:'+JSON.stringify(r);
      if(!seen[key]){ seen[key]=true; out.push(r); }
    });
    out.sort(function(a,b){ return s(firmaNavn(a)||firmaEpost(a)).localeCompare(s(firmaNavn(b)||firmaEpost(b)),'nb'); });
    return out;
  }
  function renderFirma(rows){
    var liste=$('handKundeAdminListe'); if(!liste) return;
    rows=dedupe(rows);
    window.handFirmaRowsV9=rows;
    window.handAdminKunder=rows.map(function(r){ var x=Object.assign({},r); x.__tabell='hand_firma'; return x; });
    if(!rows.length){ liste.innerHTML='<div class="melding">Ingen bedrifter funnet i hand_firma.</div>'; return; }
    var html='<div style="margin-bottom:10px"><b>Fant '+rows.length+' bedrifter fra hand_firma.</b></div>';
    html += rows.map(function(r,idx){
      var navn=firmaNavn(r), epost=firmaEpost(r), adr=firmaAdresse(r), org=firmaOrg(r), slug=firmaSlug(r), link=r.kundelink||r.kunde_link||kundelink(slug);
      return '<div class="hand-bedriftkort" style="margin:10px 0;padding:14px 16px;border:1px solid #1f2937;border-radius:10px;background:#111827;box-shadow:0 2px 8px rgba(0,0,0,.20)">'+
        '<div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">'+
        '<div><div style="font-weight:700">'+esc(navn||'(uten navn)')+'</div>'+
        (adr?'<div>'+esc(adr)+'</div>':'')+
        (epost?'<div>'+esc(epost)+'</div>':'')+
        (org?'<div style="opacity:.8">Org.nr: '+esc(org)+'</div>':'')+
        '<div style="opacity:.6;font-size:12px">hand_firma</div></div>'+
        '<div style="white-space:nowrap"><button type="button" data-hand-edit-v9="'+idx+'">Rediger</button> <button type="button" data-hand-copy-v9="'+esc(link)+'">Kopier link</button></div>'+
        '</div></div>';
    }).join('');
    liste.innerHTML=html;
  }
  window.handLastKundeliste = window.handFirmaListeV9 = async function(){
    bindUi();
    var liste=$('handKundeAdminListe'); if(!liste) return;
    if(window.__handFirmaListeV9Busy) return;
    window.__handFirmaListeV9Busy=true;
    try{
      var c=client(); if(!c){ liste.innerHTML='<div class="melding">Supabase er ikke lastet.</div>'; return; }
      liste.innerHTML='<div class="info">Henter bedrifter fra hand_firma...</div>';
      var r=await withTimeout(c.from('hand_firma').select('*').limit(1000),12000,'Henting fra hand_firma');
      if(r.error) throw r.error;
      renderFirma(Array.isArray(r.data)?r.data:[]);
    }catch(e){ liste.innerHTML='<div class="melding">Feil ved henting fra hand_firma: '+esc(e.message||e)+'</div>'; }
    finally{ window.__handFirmaListeV9Busy=false; }
  };
  window.handLastBedriftsliste=window.handLastKundeliste;


  async function visModulerForRedigertFirma(firmaId){
    try{
      firmaId = s(firmaId || val('redigerHandKundeId')).trim();
      if(!firmaId){ if(typeof window.handSkjulModulerUnderRedigerFirma==='function') window.handSkjulModulerUnderRedigerFirma(); return; }
      if(typeof window.handSettAktuellModulKundeId==='function') window.handSettAktuellModulKundeId(firmaId);
      else { var sel=$('modulKundeVelger'); if(sel) sel.value=firmaId; localStorage.setItem('handAktuellModulKundeId', firmaId); }
      if(typeof window.handVisModulerUnderRedigerFirma==='function') await window.handVisModulerUnderRedigerFirma(firmaId);
      else { var m=$('modulerSide'); if(m) show(m); if(typeof window.lastModulerFraDatabase==='function') await window.lastModulerFraDatabase(); if(typeof window.tegnModulGui==='function') window.tegnModulGui(); }
    }catch(e){ console.warn('Kunne ikke vise moduler for firma', e); }
  }

  window.handRedigerKunde=function(idx){
    var r=(window.handFirmaRowsV9||[])[Number(idx)]; if(!r){ msg('Fant ikke valgt bedrift. Hent listen pa nytt.',true); return; }
    var navn=firmaNavn(r), epost=firmaEpost(r), slug=firmaSlug(r);
    setVal('redigerHandKundeId',s(r.id||'')); setVal('nyHandKundeNavn',navn); setVal('nyHandKundeEpost',epost); setVal('nyHandKundeTelefon',r.telefon||''); setVal('nyHandKundeAdresse',firmaAdresse(r)); setVal('nyHandKundeOrgNr',firmaOrg(r)); setVal('nyHandKundeLinknavn',slug); setVal('nyHandKundeLink',r.kundelink||r.kunde_link||kundelink(slug)); msg('Redigerer: '+(navn||epost||r.id)); visModulerForRedigertFirma(r.id); setTimeout(function(){ visModulerForRedigertFirma(r.id); }, 250);
  };
  window.handKopierTekst=async function(t){ try{ await navigator.clipboard.writeText(t||''); msg('Kopiert.'); }catch(e){ msg('Kopier manuelt: '+t); } };
  window.handNullstillKundeSkjema=function(){ ['redigerHandKundeId','nyHandKundeNavn','nyHandKundeEpost','nyHandKundeTelefon','nyHandKundeAdresse','nyHandKundeOrgNr','nyHandKundeLinknavn','nyHandKundePassord','nyHandKundeLink'].forEach(function(id){setVal(id,'');}); if(typeof window.handSkjulModulerUnderRedigerFirma==='function') window.handSkjulModulerUnderRedigerFirma(); msg('Klar for ny bedrift.'); };
  function missingCol(error){ var m=s(error && error.message || error); return ((m.match(/Could not find the '([^']+)' column/i)||[])[1] || (m.match(/column "([^"]+)"/i)||[])[1] || ''); }
  function clean(p){ var o={}; Object.keys(p||{}).forEach(function(k){ var v=p[k]; if(v!==undefined && v!=='' && v!==null) o[k]=v; }); return o; }
  async function adaptiveWrite(kind, table, payload, id){
    var c=client(), p=clean(payload), last=null;
    for(var i=0;i<25;i++){
      var q=kind==='update'?c.from(table).update(p).eq('id',id).select('*').maybeSingle():c.from(table).insert([p]).select('*').maybeSingle();
      var r=await withTimeout(q,12000,'Lagring');
      if(!r.error) return r.data||p;
      last=r.error; var col=missingCol(r.error); if(col && Object.prototype.hasOwnProperty.call(p,col)){ delete p[col]; continue; }
      throw r.error;
    }
    throw last||new Error('Ukjent lagringsfeil');
  }
  function payload(){ var navn=val('nyHandKundeNavn'), epost=n(val('nyHandKundeEpost')), org=val('nyHandKundeOrgNr'), slug=slugify(val('nyHandKundeLinknavn')||navn||epost); return {navn:navn,epost:epost,telefon:val('nyHandKundeTelefon'),adresse:val('nyHandKundeAdresse'),orgnr:org,linknavn:slug,system_type:'handverker',aktiv:true}; }
  async function findExistingFirma(p){
    var c=client();
    var checks=[];
    if(p.epost) checks.push(['epost',p.epost]);
    if(p.linknavn) checks.push(['linknavn',p.linknavn]);
    if(p.orgnr) checks.push(['orgnr',p.orgnr]);
    for(var i=0;i<checks.length;i++){
      try{
        var r=await c.from('hand_firma').select('*').eq(checks[i][0],checks[i][1]).limit(1);
        if(!r.error && r.data && r.data.length) return r.data[0];
      }catch(e){}
    }
    return null;
  }
  async function safeUpsertAnsatt(firma, navn, epost){
    var c=client(); if(!c || !firma || !epost) return;
    var u=await authUser();
    var base={firma_id:firma.id||null, navn:navn, epost:epost, rolle:'admin', aktiv:true};
    if(u && u.id){ base.user_id=u.id; base.auth_id=u.id; }
    try{ var ex=await c.from('hand_ansatt').select('id').eq('epost',epost).limit(1); if(ex && !ex.error && ex.data && ex.data.length){ await adaptiveWrite('update','hand_ansatt',base,ex.data[0].id); } else { await adaptiveWrite('insert','hand_ansatt',base); } }catch(e){ console.warn('Adminrad kunne ikke lagres automatisk:', e); }
    try{
      var eier={firma_id:firma.id||null, epost:epost, rolle:'admin'};
      if(u && u.id) eier.user_id=u.id;
      var exb=await c.from('hand_firma_bruker').select('id').eq('firma_id',firma.id).eq('epost',epost).limit(1);
      if(exb && !exb.error && exb.data && exb.data.length) await c.from('hand_firma_bruker').update(eier).eq('id',exb.data[0].id);
      else await c.from('hand_firma_bruker').insert([eier]);
    }catch(e){ console.warn('Eier/admin kunne ikke lagres i hand_firma_bruker:', e); }
  }
  async function doCreate(){
    if(window.__handCreateFirmaV9Busy){ msg('Opprettelse pågår allerede. Vent litt.', true); return; }
    window.__handCreateFirmaV9Busy=true;
    var btn=document.querySelector('button[onclick*="handOpprettKundeDirekte"]');
    try{
      if(btn){ btn.disabled=true; btn.dataset.oldText=btn.textContent; btn.textContent='Oppretter...'; }
      var p=payload();
      if(!client()) throw new Error('Supabase er ikke lastet.');
      if(!p.navn) throw new Error('Skriv firmanavn.');
      if(!p.epost) throw new Error('Skriv e-post.');
      setVal('nyHandKundeLinknavn',p.linknavn); setVal('nyHandKundeLink',kundelink(p.linknavn));
      msg('Sjekker om bedriften finnes fra før...');
      var existing=await findExistingFirma(p);
      if(existing){
        await safeUpsertAnsatt(existing,p.navn,p.epost);
        msg('Bedriften finnes allerede. Opprettet ikke ny duplikat.');
        await window.handLastKundeliste();
        return;
      }
      msg('Oppretter bedrift...');
      var firma=await adaptiveWrite('insert','hand_firma',p);
      await safeUpsertAnsatt(firma,p.navn,p.epost);
      msg('Bedrift opprettet.');
      await window.handLastKundeliste();
    }catch(e){ msg('Feil: '+(e.message||e),true); }
    finally{
      if(btn){ btn.disabled=false; btn.textContent=btn.dataset.oldText||'Opprett ny bedrift'; }
      setTimeout(function(){ window.__handCreateFirmaV9Busy=false; }, 1200);
    }
  }
  window.handOpprettKundeDirekte=doCreate;
  window.handLagreRedigertKunde=async function(){
    try{ var id=val('redigerHandKundeId'); if(!id) throw new Error('Velg en bedrift fra listen forst.'); var p=payload(); await adaptiveWrite('update','hand_firma',p,id); msg('Bedrift oppdatert.'); await window.handLastKundeliste(); }catch(e){ msg('Feil: '+(e.message||e),true); }
  };
  window.handSendPassordopprettingDirekte=async function(){
    var id=val('redigerHandKundeId');
    var p=payload();
    if(id){ msg('Invitasjon med opprett-hand-kunde brukes bare for ny bedrift. Bruk Ny/tøm skjema først, eller bruk glemt passord for eksisterende bruker.', true); return; }
    if(!p.navn){ msg('Skriv firmanavn først.', true); return; }
    if(!p.epost){ msg('Skriv ekte e-post til eier/admin først.',true); return; }
    try{
      var c=client();
      if(!c || !c.functions) throw new Error('Supabase Functions er ikke tilgjengelig. Deploy Edge Function opprett-hand-kunde først.');
      var existing=await findExistingFirma(p);
      if(existing){ msg('Bedriften finnes allerede. Opprettet ikke ny duplikat. Bruk glemt passord for eksisterende Auth-bruker.', true); return; }
      var redirect=appBase()+'reset.html';
      var body={navn:p.navn,firmanavn:p.navn,email:p.epost,epost:p.epost,phone:p.telefon,telefon:p.telefon,adresse:p.adresse,orgnr:p.orgnr,linknavn:p.linknavn,redirectTo:redirect};
      msg('Oppretter bedrift og sender invitasjon...');
      var r=await withTimeout(c.functions.invoke('opprett-hand-kunde',{body:body}),30000,'Opprett bedrift og invitasjon');
      if(r.error) throw r.error;
      if(r.data && (r.data.error || r.data.ok===false)) throw new Error(r.data.error || 'Edge Function feilet.');
      msg('Bedrift opprettet og invitasjon sendt til '+p.epost+'.');
      setVal('redigerHandKundeId', (r.data && r.data.firma && r.data.firma.id) || '');
      await window.handLastKundeliste();
    }catch(err){
      msg('Feil ved opprettelse/invitasjon: '+(err.message||err),true);
    }
  };
  window.handKopierKundelinkDirekte=function(){ var link=val('nyHandKundeLink'); if(!link){ var slug=slugify(val('nyHandKundeLinknavn')||val('nyHandKundeNavn')||val('nyHandKundeEpost')); link=kundelink(slug); setVal('nyHandKundeLink',link); } window.handKopierTekst(link); };

  document.addEventListener('click',function(ev){
    var t=ev.target && ev.target.closest && ev.target.closest('#sysadminKundelisteKnapp,#handSysadmRefreshInline,#sysadminModulerKnapp,[data-hand-edit-v9],[data-hand-copy-v9],button[onclick*="handOpprettKundeDirekte"],button[onclick*="handLagreRedigertKunde"],button[onclick*="handSendPassordopprettingDirekte"],button[onclick*="handKopierKundelinkDirekte"]');
    if(!t) return;
    if(t.id==='sysadminModulerKnapp'){ ev.preventDefault(); ev.stopImmediatePropagation(); hide(t); return false; }
    if(t.id==='sysadminKundelisteKnapp' || t.id==='handSysadmRefreshInline'){ ev.preventDefault(); ev.stopImmediatePropagation(); window.handLastKundeliste(); return false; }
    if(t.getAttribute('data-hand-edit-v9')){ ev.preventDefault(); ev.stopImmediatePropagation(); window.handRedigerKunde(t.getAttribute('data-hand-edit-v9')); return false; }
    if(t.getAttribute('data-hand-copy-v9')){ ev.preventDefault(); ev.stopImmediatePropagation(); window.handKopierTekst(t.getAttribute('data-hand-copy-v9')); return false; }
    var oc=s(t.getAttribute('onclick'));
    if(oc.indexOf('handOpprettKundeDirekte')>=0){ ev.preventDefault(); ev.stopImmediatePropagation(); window.handOpprettKundeDirekte(); return false; }
    if(oc.indexOf('handLagreRedigertKunde')>=0){ ev.preventDefault(); ev.stopImmediatePropagation(); window.handLagreRedigertKunde(); return false; }
    if(oc.indexOf('handSendPassordopprettingDirekte')>=0){ ev.preventDefault(); ev.stopImmediatePropagation(); window.handSendPassordopprettingDirekte(); return false; }
    if(oc.indexOf('handKopierKundelinkDirekte')>=0){ ev.preventDefault(); ev.stopImmediatePropagation(); window.handKopierKundelinkDirekte(); return false; }
  },true);
  function autoload(){ bindUi(); var l=$('handKundeAdminListe'); if(l && /Ingen bedrifter lastet/i.test(s(l.textContent))) window.handLastKundeliste(); }
  document.addEventListener('DOMContentLoaded',function(){ [100,600,1600].forEach(function(ms){ setTimeout(autoload,ms); }); });
  document.addEventListener('handPartialerLastet',function(){ [100,800,1600].forEach(function(ms){ setTimeout(autoload,ms); }); });
  window.addEventListener('load',function(){ [100,600,1600].forEach(function(ms){ setTimeout(autoload,ms); }); });
  setTimeout(bindUi,100); setTimeout(bindUi,1000); setTimeout(bindUi,2500);
})();
