/* Handverker sysadm bedrifter SAFE v8
   Viser KUN hand_firma, dedupliserer, og legger Rediger/Kopier-knapper i listen.
   Bruker egne funksjonsnavn og overstyrer gamle sysadm-funksjoner etter at siden er lastet.
*/
(function(){
  'use strict';
  if(typeof window.user === 'undefined') window.user = null;

  function $(id){ return document.getElementById(id); }
  function s(v){ return String(v == null ? '' : v); }
  function esc(v){ return s(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function val(id){ var e=$(id); return s(e && e.value).trim(); }
  function setVal(id,v){ var e=$(id); if(e) e.value = v == null ? '' : String(v); }
  function msg(t, feil){ var e=$('nyHandKundeMelding') || $('firmaMelding'); if(e){ e.textContent=t||''; e.style.color=feil?'#fca5a5':'#86efac'; } }
  function client(){
    if(window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient;
    try{ if(typeof supabaseClient !== 'undefined' && supabaseClient && typeof supabaseClient.from === 'function') return supabaseClient; }catch(e){}
    return null;
  }
  function slugify(v){ return s(v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function appBase(){ return location.pathname.toLowerCase().indexOf('/rettilomma/')>=0 ? location.origin + '/rettilomma/handverker/' : location.origin + '/handverker/'; }
  function rootBase(){ return location.pathname.toLowerCase().indexOf('/rettilomma/')>=0 ? location.origin + '/rettilomma/' : location.origin + '/'; }
  function kundelink(slug){ return appBase() + '?firma=' + encodeURIComponent(slug || ''); }
  function withTimeout(p, ms, label){
    var timer;
    var timeout = new Promise(function(_, reject){ timer=setTimeout(function(){ reject(new Error((label||'Foresporsel')+' tok for lang tid.')); }, ms||12000); });
    return Promise.race([p, timeout]).finally(function(){ clearTimeout(timer); });
  }
  async function authUser(){
    var c=client(); if(!c || !c.auth) return null;
    try{ var r=await c.auth.getUser(); if(r && r.data && r.data.user) return r.data.user; }catch(e){}
    try{ var se=await c.auth.getSession(); if(se && se.data && se.data.session && se.data.session.user) return se.data.session.user; }catch(e){}
    return null;
  }
  function ensureHidden(){ if(!$('redigerHandKundeId')){ var i=document.createElement('input'); i.type='hidden'; i.id='redigerHandKundeId'; document.body.appendChild(i); } }
  function bindForm(){
    ensureHidden();
    var n=$('nyHandKundeNavn');
    if(n && n.dataset.handFirmaSlugV8 !== '1'){
      n.dataset.handFirmaSlugV8='1';
      n.addEventListener('input',function(){ var slug=slugify(val('nyHandKundeNavn')); setVal('nyHandKundeLinknavn',slug); setVal('nyHandKundeLink',kundelink(slug)); });
    }
    var b=$('sysadminKundelisteKnapp'); if(b){ b.textContent='Hent/oppdater bedrifter'; b.onclick=function(ev){ if(ev) ev.preventDefault(); window.handFirmaListeV8(); return false; }; }
    var b2=$('handSysadmRefreshInline'); if(b2){ b2.textContent='Hent/oppdater bedrifter'; b2.onclick=function(ev){ if(ev) ev.preventDefault(); window.handFirmaListeV8(); return false; }; }
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
      var e=s(firmaEpost(r)).toLowerCase(); if(!key && e) key='epost:'+e;
      var org=s(firmaOrg(r)).replace(/\D/g,''); if(!key && org) key='org:'+org;
      var slug=s(firmaSlug(r)).toLowerCase(); if(!key && slug) key='slug:'+slug;
      if(!key) key='rad:'+JSON.stringify(r);
      if(!seen[key]){ seen[key]=true; out.push(r); }
    });
    out.sort(function(a,b){ return s(firmaNavn(a)||firmaEpost(a)).localeCompare(s(firmaNavn(b)||firmaEpost(b)),'nb'); });
    return out;
  }
  function renderFirma(rows){
    var liste=$('handKundeAdminListe'); if(!liste) return;
    rows=dedupe(rows);
    window.handFirmaRowsV8=rows;
    window.handAdminKunder=rows.map(function(r){ var x=Object.assign({},r); x.__tabell='hand_firma'; return x; });
    if(!rows.length){ liste.innerHTML='<div class="melding">Ingen bedrifter funnet i hand_firma.</div>'; return; }
    var html='<div style="margin-bottom:10px"><b>'+rows.length+' bedrifter i hand_firma</b></div>';
    html += rows.map(function(r,idx){
      var navn=firmaNavn(r), epost=firmaEpost(r), adr=firmaAdresse(r), org=firmaOrg(r), slug=firmaSlug(r), link=r.kundelink||r.kunde_link||kundelink(slug);
      return '<div class="hand-bedriftkort" style="margin:10px 0;padding:14px 16px;border:1px solid #1f2937;border-radius:10px;background:#111827;box-shadow:0 2px 8px rgba(0,0,0,.20)">'+
        '<div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">'+
        '<div><div style="font-weight:700">'+esc(navn||'(uten navn)')+'</div>'+
        (adr?'<div>'+esc(adr)+'</div>':'')+
        (epost?'<div>'+esc(epost)+'</div>':'')+
        (org?'<div style="opacity:.8">Org.nr: '+esc(org)+'</div>':'')+
        '<div style="opacity:.6;font-size:12px">hand_firma</div></div>'+
        '<div style="white-space:nowrap"><button type="button" onclick="handFirmaRedigerV8('+idx+')">Rediger</button> <button type="button" onclick="handFirmaKopierV8('+idx+')">Kopier link</button></div>'+
        '</div></div>';
    }).join('');
    liste.innerHTML=html;
  }
  window.handFirmaListeV8 = async function(){
    bindForm();
    var liste=$('handKundeAdminListe'); if(!liste) return;
    var c=client();
    if(!c){ liste.innerHTML='<div class="melding">Supabase er ikke lastet.</div>'; return; }
    if(window.__handFirmaV8Busy) return;
    window.__handFirmaV8Busy=true;
    try{
      liste.innerHTML='<div class="info">Henter bedrifter fra hand_firma...</div>';
      var r=await withTimeout(c.from('hand_firma').select('*').limit(1000),12000,'Henting fra hand_firma');
      if(r.error) throw r.error;
      renderFirma(Array.isArray(r.data)?r.data:[]);
    }catch(e){ liste.innerHTML='<div class="melding">Feil ved henting fra hand_firma: '+esc(e.message||e)+'</div>'; }
    finally{ window.__handFirmaV8Busy=false; }
  };
  window.handLastKundeliste = window.handFirmaListeV8;
  window.handLastBedriftsliste = window.handFirmaListeV8;

  window.handFirmaRedigerV8 = function(idx){
    var r=(window.handFirmaRowsV8||[])[idx]; if(!r){ msg('Fant ikke valgt bedrift. Hent listen pa nytt.',true); return; }
    var navn=firmaNavn(r), epost=firmaEpost(r), slug=firmaSlug(r);
    setVal('redigerHandKundeId',s(r.id||r.firma_id||r.kunde_id||''));
    setVal('nyHandKundeNavn',navn); setVal('nyHandKundeEpost',epost); setVal('nyHandKundeTelefon',r.telefon||''); setVal('nyHandKundeAdresse',firmaAdresse(r)); setVal('nyHandKundeOrgNr',firmaOrg(r)); setVal('nyHandKundeLinknavn',slug); setVal('nyHandKundeLink',r.kundelink||r.kunde_link||kundelink(slug));
    msg('Redigerer: '+(navn||epost||r.id));
    var form=$('handSystemadminBlokk'); if(form) form.scrollIntoView({behavior:'smooth',block:'start'});
  };
  window.handFirmaKopierV8 = async function(idx){
    var r=(window.handFirmaRowsV8||[])[idx]; if(!r) return;
    var link=r.kundelink||r.kunde_link||kundelink(firmaSlug(r));
    try{ await navigator.clipboard.writeText(link); msg('Kundelink kopiert.'); }catch(e){ setVal('nyHandKundeLink',link); msg('Kopier manuelt fra kundelink-feltet.'); }
  };
  window.handNullstillKundeSkjema=function(){ ['redigerHandKundeId','nyHandKundeNavn','nyHandKundeEpost','nyHandKundeTelefon','nyHandKundeAdresse','nyHandKundeOrgNr','nyHandKundeLinknavn','nyHandKundePassord','nyHandKundeLink'].forEach(function(id){setVal(id,'');}); msg('Klar for ny bedrift.'); };
  function missingCol(error){ var m=s(error && error.message || error); return ((m.match(/Could not find the '([^']+)' column/i)||[])[1] || (m.match(/column "([^"]+)"/i)||[])[1] || ''); }
  function clean(p){ var o={}; Object.keys(p||{}).forEach(function(k){ var v=p[k]; if(v!==undefined && v!=='' && v!==null) o[k]=v; }); return o; }
  async function adaptive(kind, table, payload, id){
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
  function payload(){
    var navn=val('nyHandKundeNavn'), epost=val('nyHandKundeEpost').toLowerCase(), org=val('nyHandKundeOrgNr'), slug=slugify(val('nyHandKundeLinknavn')||navn||epost);
    return {navn:navn,firmanavn:navn,firma_navn:navn,epost:epost,email:epost,telefon:val('nyHandKundeTelefon'),adresse:val('nyHandKundeAdresse'),orgnr:org,org_nr:org,linknavn:slug,slug:slug,kundelink:kundelink(slug),kunde_link:kundelink(slug),system_type:'handverker',aktiv:true};
  }
  async function upsertAnsatt(firma,p){
    var c=client(); if(!c || !p.epost) return;
    var u=await authUser();
    var base={firma_id:(firma && (firma.id||firma.firma_id||firma.kunde_id))||null, navn:p.navn, epost:p.epost, email:p.epost, rolle:'admin', er_admin:true, aktiv:true};
    if(u && u.id){ base.user_id=u.id; base.auth_id=u.id; }
    try{
      var ex=await c.from('hand_ansatt').select('id').eq('epost',p.epost).limit(1);
      if(ex && !ex.error && ex.data && ex.data.length){ await adaptive('update','hand_ansatt',base,ex.data[0].id); return; }
      await adaptive('insert','hand_ansatt',base);
    }catch(e){ console.warn('Kunne ikke lagre hand_ansatt automatisk:',e); }
  }
  window.handOpprettKundeDirekte=async function(){
    try{
      var p=payload(); if(!p.navn) throw new Error('Skriv firmanavn.'); if(!p.epost) throw new Error('Skriv e-post.'); if(!client()) throw new Error('Supabase er ikke lastet.');
      msg('Oppretter bedrift...');
      var firma=await adaptive('insert','hand_firma',p);
      await upsertAnsatt(firma,p);
      msg('Bedrift opprettet.');
      await window.handFirmaListeV8();
    }catch(e){ msg('Feil: '+(e.message||e),true); }
  };
  window.handLagreRedigertKunde=async function(){
    try{
      var id=val('redigerHandKundeId'); if(!id) throw new Error('Trykk Rediger pa en bedrift forst.');
      var p=payload(); msg('Lagrer redigering...');
      await adaptive('update','hand_firma',p,id);
      msg('Bedrift oppdatert.');
      await window.handFirmaListeV8();
    }catch(e){ msg('Feil: '+(e.message||e),true); }
  };
  window.handSendPassordopprettingDirekte=async function(){
    try{ var e=val('nyHandKundeEpost').toLowerCase(); if(!e) throw new Error('Skriv e-post forst.'); var r=await withTimeout(client().auth.resetPasswordForEmail(e,{redirectTo:rootBase()+'reset.html'}),12000,'Passord-e-post'); if(r.error) throw r.error; msg('Passordoppretting sendt.'); }catch(e){ msg('Feil: '+(e.message||e),true); }
  };
  window.handKopierKundelinkDirekte=function(){ var link=val('nyHandKundeLink'); if(!link){ link=kundelink(slugify(val('nyHandKundeLinknavn')||val('nyHandKundeNavn')||val('nyHandKundeEpost'))); setVal('nyHandKundeLink',link); } navigator.clipboard.writeText(link).then(function(){msg('Kundelink kopiert.');}).catch(function(){msg('Kopier manuelt fra feltet.');}); };

  document.addEventListener('click',function(ev){
    var t=ev.target && ev.target.closest && ev.target.closest('#sysadminKundelisteKnapp,#handSysadmRefreshInline');
    if(!t) return;
    ev.preventDefault(); ev.stopImmediatePropagation(); window.handFirmaListeV8(); return false;
  },true);
  function init(){ bindForm(); if($('handKundeAdminListe') && /Ingen bedrifter lastet/i.test(s($('handKundeAdminListe').textContent))) window.handFirmaListeV8(); }
  [100,500,1200,2500].forEach(function(ms){ setTimeout(init,ms); });
  document.addEventListener('DOMContentLoaded',init);
  window.addEventListener('load',init);
  document.addEventListener('handPartialerLastet',function(){ setTimeout(init,100); setTimeout(init,900); });
})();
