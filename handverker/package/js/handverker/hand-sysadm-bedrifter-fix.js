/* Handverker sysadm bedrifter SAFE v7
   Retter: deduplisering og redigering direkte fra bedriftlisten.
   Ingen langvarige looper. Viser databasefeil direkte på siden.
*/
(function(){
  'use strict';
  try{ if(typeof window.user === 'undefined') window.user = null; }catch(e){}

  function $(id){ return document.getElementById(id); }
  function s(v){ return String(v == null ? '' : v); }
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
  function msg(t, feil){ var e=$('nyHandKundeMelding') || $('firmaMelding'); if(e){ e.textContent=t||''; e.style.color=feil?'#fca5a5':'#86efac'; } }
  function withTimeout(p, ms, label){
    var timer;
    var timeout = new Promise(function(_, reject){ timer=setTimeout(function(){ reject(new Error((label||'Foresporsel')+' tok for lang tid.')); }, ms||12000); });
    return Promise.race([p, timeout]).finally(function(){ clearTimeout(timer); });
  }
  async function authUser(){
    var c=client();
    if(!c || !c.auth) return null;
    try{ var r=await c.auth.getUser(); if(r && r.data && r.data.user) return r.data.user; }catch(e){}
    try{ var s1=await c.auth.getSession(); if(s1 && s1.data && s1.data.session && s1.data.session.user) return s1.data.session.user; }catch(e){}
    return null;
  }
  function listBox(){
    var liste=$('handKundeAdminListe');
    if(liste && !$('handSysadmRefreshInline')){
      var btn=document.createElement('button');
      btn.id='handSysadmRefreshInline'; btn.type='button'; btn.className='secondary'; btn.style.margin='0 0 10px 0';
      btn.textContent='Hent/oppdater bedrifter';
      liste.parentNode.insertBefore(btn,liste);
    }
    return liste;
  }
  function ensureEditField(){ if(!$('redigerHandKundeId')){ var i=document.createElement('input'); i.type='hidden'; i.id='redigerHandKundeId'; document.body.appendChild(i); } }
  function bindUi(){
    var b=$('sysadminNyKundeKnapp'); if(b) b.textContent='Ny bedrift/kunde';
    var l=$('sysadminKundelisteKnapp'); if(l) l.textContent='Hent/oppdater bedrifter';
    var n=$('nyHandKundeNavn');
    if(n && n.dataset.safeSlugBindV6!=='1'){
      n.dataset.safeSlugBindV6='1';
      n.addEventListener('input',function(){ var slug=slugify(val('nyHandKundeNavn')); setVal('nyHandKundeLinknavn',slug); setVal('nyHandKundeLink',kundelink(slug)); });
    }
    ensureEditField();
    listBox();
  }
  async function selectTable(table){
    var c=client();
    if(!c) return {table:table, rows:[], error:new Error('Supabase-klienten er ikke lastet')};
    try{
      var r=await withTimeout(c.from(table).select('*').limit(1000),12000,'Henting fra '+table);
      if(r && r.error) return {table:table, rows:[], error:r.error};
      return {table:table, rows:Array.isArray(r && r.data)?r.data:[], error:null};
    }catch(e){ return {table:table, rows:[], error:e}; }
  }
  async function hentAlle(){
    var tables=['hand_firma','hand_kunder','hand_kunde','firma','kunder'];
    var results=[];
    for(var i=0;i<tables.length;i++) results.push(await selectTable(tables[i]));
    var rows=[];
    results.forEach(function(res){ (res.rows||[]).forEach(function(r){ var x=Object.assign({},r); x.__tabell=res.table; rows.push(x); }); });
    function pref(t){ return t==='hand_firma'?1:(t==='hand_kunder'?2:(t==='hand_kunde'?3:9)); }
    function dedupeKey(r){
      var e=s(r.epost||r.email).trim().toLowerCase();
      if(e) return 'epost:'+e;
      var slug=s(r.linknavn||r.slug).trim().toLowerCase();
      if(slug) return 'slug:'+slug;
      var org=s(r.orgnr||r.org_nr||r.organisasjonsnummer).replace(/\D/g,'');
      if(org) return 'org:'+org;
      var navn=s(r.navn||r.firmanavn||r.firma_navn||r.kundenavn).trim().toLowerCase();
      var adr=s(r.adresse||r.adresselinje||'').trim().toLowerCase();
      if(navn||adr) return 'navnadr:'+navn+'|'+adr;
      return 'id:'+s(r.id||r.firma_id||r.kunde_id||JSON.stringify(r));
    }
    var map={};
    rows.forEach(function(r){
      var key=dedupeKey(r);
      var old=map[key];
      if(!old || pref(r.__tabell)<pref(old.__tabell)) map[key]=r;
    });
    rows=Object.keys(map).map(function(k){ return map[k]; });
    rows.sort(function(a,b){ return s(a.navn||a.firmanavn||a.firma_navn||a.kundenavn||a.epost||a.email).localeCompare(s(b.navn||b.firmanavn||b.firma_navn||b.kundenavn||b.epost||b.email),'nb'); });
    return {rows:rows, results:results};
  }
  function render(liste, rows, results){
    window.handAdminKunder=rows;
    if(!rows.length){
      var status=results.map(function(r){ return '<div><b>'+esc(r.table)+'</b>: '+(r.error ? esc(r.error.message||r.error) : '0 rader')+'</div>'; }).join('');
      liste.innerHTML='<div class="melding">Ingen bedrifter/kunder ble hentet.</div><div class="info" style="margin-top:8px">Diagnose:<br>'+status+'<br>Hvis det står 0 rader på hand_firma, er tabellen tom eller RLS skjuler radene for sysadm.</div>';
      return;
    }
    var html='<div style="margin-bottom:10px"><b>'+rows.length+' bedrifter/kunder funnet</b></div>';
    html += rows.map(function(k){
      var navn=k.navn||k.firmanavn||k.firma_navn||k.kundenavn||'';
      var epost=k.epost||k.email||'';
      var org=k.orgnr||k.org_nr||k.organisasjonsnummer||'';
      var adresse=k.adresse||k.adresselinje||'';
      var slug=k.linknavn||k.slug||slugify(navn||epost||k.id);
      var link=k.kundelink||k.kunde_link||kundelink(slug);
      var key=esc((k.__tabell||'')+':'+(k.id||k.firma_id||k.kunde_id||''));
      return '<div class="hand-bedriftkort" style="margin:10px 0;padding:14px 16px;border:1px solid #1f2937;border-radius:10px;background:#111827;box-shadow:0 2px 8px rgba(0,0,0,.20)">'+
        '<div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">'+
          '<div><div style="font-weight:700">'+esc(navn||'(uten navn)')+'</div>'+
          (adresse?'<div>'+esc(adresse)+'</div>':'')+
          (epost?'<div>'+esc(epost)+'</div>':'')+
          (org?'<div style="opacity:.8">Org.nr: '+esc(org)+'</div>':'')+
          '<div style="opacity:.6;font-size:12px">Tabell: '+esc(k.__tabell||'')+'</div></div>'+
          '<div style="white-space:nowrap"><button type="button" data-hand-edit-kunde="'+key+'">Rediger</button> <button type="button" data-hand-copy="'+esc(link)+'">Kopier link</button></div>'+
        '</div></div>';
    }).join('');
    liste.innerHTML=html;
  }
  window.handLastKundeliste = async function(){
    bindUi();
    var liste=listBox();
    if(!liste) return;
    if(window.__handFirmaListeBusy) return;
    window.__handFirmaListeBusy=true;
    try{
      var c=client();
      if(!c){ liste.innerHTML='<div class="melding">Supabase er ikke lastet. Sjekk at config.js lastes for denne siden.</div>'; return; }
      liste.innerHTML='<div class="info">Henter bedrifter/kunder fra Supabase...</div>';
      var res=await hentAlle();
      render(liste,res.rows,res.results);
    }catch(e){ liste.innerHTML='<div class="melding">Kunne ikke hente bedrifter: '+esc(e.message||e)+'</div>'; }
    finally{ window.__handFirmaListeBusy=false; }
  };
  window.handLastBedriftsliste=window.handLastKundeliste;
  window.handRedigerKunde=function(key){
    var parts=s(key).split(':'); var tab=parts[0]; var id=parts.slice(1).join(':');
    var k=(window.handAdminKunder||[]).find(function(x){ return s(x.__tabell)===tab && s(x.id)===id; });
    if(!k){ msg('Fant ikke valgt bedrift. Hent listen pa nytt.',true); return; }
    var navn=k.navn||k.firmanavn||k.firma_navn||k.kundenavn||''; var epost=k.epost||k.email||''; var slug=k.linknavn||k.slug||slugify(navn||epost||k.id);
    setVal('redigerHandKundeId',tab+':'+id); setVal('nyHandKundeNavn',navn); setVal('nyHandKundeEpost',epost); setVal('nyHandKundeTelefon',k.telefon||''); setVal('nyHandKundeAdresse',k.adresse||''); setVal('nyHandKundeOrgNr',k.orgnr||k.org_nr||k.organisasjonsnummer||''); setVal('nyHandKundeLinknavn',slug); setVal('nyHandKundeLink',k.kundelink||k.kunde_link||kundelink(slug)); msg('Redigerer: '+(navn||epost||id));
  };
  window.handKopierTekst=async function(t){ try{ await navigator.clipboard.writeText(t||''); msg('Kopiert.'); }catch(e){ msg('Kopier manuelt: '+t); } };
  window.handNullstillKundeSkjema=function(){ ['redigerHandKundeId','nyHandKundeNavn','nyHandKundeEpost','nyHandKundeTelefon','nyHandKundeAdresse','nyHandKundeOrgNr','nyHandKundeLinknavn','nyHandKundePassord','nyHandKundeLink'].forEach(function(id){setVal(id,'');}); msg('Klar for ny bedrift/kunde.'); };
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
  function payload(){ var navn=val('nyHandKundeNavn'), epost=val('nyHandKundeEpost').toLowerCase(), slug=slugify(val('nyHandKundeLinknavn')||navn||epost); return {navn:navn,firmanavn:navn,firma_navn:navn,epost:epost,email:epost,telefon:val('nyHandKundeTelefon'),adresse:val('nyHandKundeAdresse'),orgnr:val('nyHandKundeOrgNr'),org_nr:val('nyHandKundeOrgNr'),linknavn:slug,slug:slug,kundelink:kundelink(slug),kunde_link:kundelink(slug),system_type:'handverker',aktiv:true}; }
  async function safeUpsertAnsatt(firma, navn, epost){
    var c=client();
    if(!c || !firma) return;
    var firmaId=firma.id||firma.firma_id||firma.kunde_id||null;
    var u=await authUser();
    var base={firma_id:firmaId, navn:navn, epost:epost, email:epost, rolle:'admin', er_admin:true, aktiv:true};
    if(u && u.id){ base.user_id=u.id; base.auth_id=u.id; }
    try{
      var existing=await c.from('hand_ansatt').select('id').eq('epost',epost).limit(1);
      if(existing && !existing.error && existing.data && existing.data.length){ await adaptiveWrite('update','hand_ansatt',base,existing.data[0].id); return; }
    }catch(e){}
    try{ await adaptiveWrite('insert','hand_ansatt',base); }catch(e){ console.warn('Adminrad kunne ikke lagres automatisk:', e); }
  }
  window.handOpprettKundeDirekte=async function(){
    try{
      var p=payload();
      if(!client()) throw new Error('Supabase er ikke lastet.');
      if(!p.navn) throw new Error('Skriv firmanavn.');
      if(!p.epost) throw new Error('Skriv e-post.');
      msg('Oppretter bedrift...');
      var firma=await adaptiveWrite('insert','hand_firma',p);
      await safeUpsertAnsatt(firma,p.navn,p.epost);
      msg('Bedrift opprettet. Listen hentes på nytt.');
      await window.handLastKundeliste();
    }catch(e){ msg('Feil: '+(e.message||e),true); }
  };
  window.handLagreRedigertKunde=async function(){ try{ var raw=val('redigerHandKundeId'); if(!raw) throw new Error('Velg en bedrift fra listen forst.'); var parts=raw.split(':'); var table=parts[0]||'hand_firma'; var id=parts.slice(1).join(':'); var p=payload(); await adaptiveWrite('update',table,p,id); msg('Bedrift/kunde oppdatert.'); await window.handLastKundeliste(); }catch(e){ msg('Feil: '+(e.message||e),true); } };
  window.handSendPassordopprettingDirekte=async function(){ var e=val('nyHandKundeEpost').toLowerCase(); if(!e){ msg('Skriv e-post forst.',true); return; } try{ var r=await withTimeout(client().auth.resetPasswordForEmail(e,{redirectTo:rootBase()+'reset.html'}),12000,'Passord-e-post'); if(r.error) throw r.error; msg('Passordoppretting sendt.'); }catch(err){ msg('Feil: '+(err.message||err),true); } };
  window.handKopierKundelinkDirekte=function(){ window.handKopierTekst(val('nyHandKundeLink')); };

  document.addEventListener('click',function(ev){
    var t=ev.target && ev.target.closest && ev.target.closest('#sysadminKundelisteKnapp,#handSysadmRefreshInline,[data-hand-edit-kunde],[data-hand-copy],button[onclick*="handOpprettKundeDirekte"],button[onclick*="handLagreRedigertKunde"],button[onclick*="handSendPassordopprettingDirekte"],button[onclick*="handKopierKundelinkDirekte"]');
    if(!t) return;
    if(t.id==='sysadminKundelisteKnapp' || t.id==='handSysadmRefreshInline'){
      ev.preventDefault(); ev.stopImmediatePropagation(); setTimeout(function(){ window.handLastKundeliste(); },0); return false;
    }
    var oc=s(t.getAttribute('onclick'));
    if(oc.indexOf('handOpprettKundeDirekte')>=0){ ev.preventDefault(); ev.stopImmediatePropagation(); setTimeout(function(){ window.handOpprettKundeDirekte(); },0); return false; }
    if(oc.indexOf('handLagreRedigertKunde')>=0){ ev.preventDefault(); ev.stopImmediatePropagation(); setTimeout(function(){ window.handLagreRedigertKunde(); },0); return false; }
    if(oc.indexOf('handSendPassordopprettingDirekte')>=0){ ev.preventDefault(); ev.stopImmediatePropagation(); setTimeout(function(){ window.handSendPassordopprettingDirekte(); },0); return false; }
    if(oc.indexOf('handKopierKundelinkDirekte')>=0){ ev.preventDefault(); ev.stopImmediatePropagation(); window.handKopierKundelinkDirekte(); return false; }
    if(t.getAttribute('data-hand-edit-kunde')){ ev.preventDefault(); ev.stopImmediatePropagation(); window.handRedigerKunde(t.getAttribute('data-hand-edit-kunde')); return false; }
    if(t.getAttribute('data-hand-copy')){ ev.preventDefault(); ev.stopImmediatePropagation(); window.handKopierTekst(t.getAttribute('data-hand-copy')); return false; }
  },true);

  function autoload(){ bindUi(); var l=$('handKundeAdminListe'); if(l && /Ingen (bedrifter|kunder) lastet enna|Ingen bedrifter lastet enna|Ingen kunder lastet enna/i.test(s(l.textContent))) window.handLastKundeliste(); }
  document.addEventListener('DOMContentLoaded',function(){ [300,1200,2600].forEach(function(ms){ setTimeout(autoload,ms); }); });
  document.addEventListener('handPartialerLastet',function(){ [100,900,1800].forEach(function(ms){ setTimeout(autoload,ms); }); });
  window.addEventListener('load',function(){ [300,1200,2600].forEach(function(ms){ setTimeout(autoload,ms); }); });
  setTimeout(bindUi,100);
  setTimeout(bindUi,1000);
  setTimeout(function(){ bindUi(); },2500);
})();
