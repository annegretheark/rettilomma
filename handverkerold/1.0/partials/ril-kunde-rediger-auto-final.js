

/* RIL FINAL FIX 20260623
   - Rediger-knapp vises for systemadmin-rolle, sysadmin, systemadmin og admin.
   - Kundenr lages automatisk ved ny kunde.
   - Prosjektnr lages automatisk som kundenr + '-' + løpenr, f.eks. 1001-1, 1001-2.
*/
(function(){
  'use strict';
  if(window.__rilKundeRedigerAutoNrFinal) return;
  window.__rilKundeRedigerAutoNrFinal = true;

  function $(id){ return document.getElementById(id); }
  function s(v){ return String(v == null ? '' : v); }
  function esc(v){ return s(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function numOnly(v){ return s(v).replace(/[^0-9]/g,''); }
  function client(){ return window.supabaseClient || window.supabase || null; }
  function rolle(){ return s(window.innloggetRolle || localStorage.getItem('handInnloggetRolle') || localStorage.getItem('innloggetRolle')).toLowerCase(); }
  function innloggetEpost(){ return s(window.innloggetEpost || window.handInnloggetEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('email')).trim().toLowerCase(); }
  function kanRedigereKunder(){
    var r=rolle(), e=innloggetEpost();
    return r.indexOf('admin')>=0 || r.indexOf('sysadmin')>=0 || r.indexOf('systemadmin')>=0 || s(localStorage.getItem('rilAdminModus')).toLowerCase()==='true' || s(localStorage.getItem('rilSysadminModus')).toLowerCase()==='true';
  }
  function msg(t){ var el=$('kundeMelding'); if(el) el.textContent=t||''; }
  function getKunder(){ return window.kunder || []; }
  function getProsjekter(){ return window.prosjekter || []; }
  function kundenr(k){ return s(k && (k.kundenr || k.kunde_nr || k.kundenummer || k.nr)); }
  function prosjektnr(p){ return s(p && (p.prosjektnr || p.prosjekt_nr || p.prosjektNr || p.nr)); }

  async function firmaId(){
    try{ if(typeof window.hentAktivFirmaId === 'function') return await window.hentAktivFirmaId(); }catch(e){}
    return window.aktivFirmaId || window.handFirmaId || localStorage.getItem('aktivFirmaId') || localStorage.getItem('handFirmaId') || localStorage.getItem('firma_id') || null;
  }
  async function safeInsert(table, row){
    var c=client(), data=Object.assign({},row);
    for(var i=0;i<40;i++){
      var r=await c.from(table).insert([data]).select();
      if(!r.error) return r;
      var m=s(r.error.message);
      var col=(m.match(/Could not find the '([^']+)' column/i)||[])[1] || (m.match(/column "([^"]+)".*does not exist/i)||[])[1];
      if(col && Object.prototype.hasOwnProperty.call(data,col)){ delete data[col]; continue; }
      return r;
    }
  }
  async function safeUpdate(table, id, row){
    var c=client(), data=Object.assign({},row);
    for(var i=0;i<40;i++){
      var r=await c.from(table).update(data).eq('id',id).select();
      if(!r.error) return r;
      var m=s(r.error.message);
      var col=(m.match(/Could not find the '([^']+)' column/i)||[])[1] || (m.match(/column "([^"]+)".*does not exist/i)||[])[1];
      if(col && Object.prototype.hasOwnProperty.call(data,col)){ delete data[col]; continue; }
      return r;
    }
  }
  function nesteKundenr(){
    var max=0;
    getKunder().forEach(function(k){ var n=parseInt(numOnly(kundenr(k)),10); if(Number.isFinite(n) && n>max) max=n; });
    return String(max ? max+1 : 1001);
  }
  function nesteProsjektNrForKunde(kunde){
    var base=kundenr(kunde) || s($('kundeNrVis')&&$('kundeNrVis').value) || s($('kundeNr')&&$('kundeNr').value) || nesteKundenr();
    base=s(base).replace(/\s+/g,'');
    var prefix=base+'-';
    var max=0;
    var valgtKundeId=s(kunde && kunde.id || $('kundeId') && $('kundeId').value);
    getProsjekter().filter(function(p){ return s(p.kunde_id)===valgtKundeId; }).forEach(function(p){
      var pn=prosjektnr(p);
      var part = pn.indexOf(prefix)===0 ? pn.slice(prefix.length) : pn.split('-').pop();
      var n=parseInt(numOnly(part),10); if(Number.isFinite(n)&&n>max) max=n;
    });
    return prefix + String(max+1);
  }
  function fillKundeForm(k){
    if(!$('kundeId')) return;
    $('kundeId').value = k && k.id || '';
    if($('kundeNr')) $('kundeNr').value = k ? kundenr(k) : '';
    if($('kundeNrVis')) $('kundeNrVis').value = k ? kundenr(k) : '(lages automatisk)';
    if($('kundeNavn')) $('kundeNavn').value = k && k.navn || '';
    if($('kundeAdresse')) $('kundeAdresse').value = k && k.adresse || '';
    if($('kundeEpost')) $('kundeEpost').value = k && k.epost || '';
    if($('kundeKontaktperson')) $('kundeKontaktperson').value = k && k.kontaktperson || '';
    if($('kundeKontonr')) $('kundeKontonr').value = k && k.kontonr || '';
    if($('leggTilKundeKnapp')) $('leggTilKundeKnapp').textContent = k ? 'Lagre endringer' : 'Lagre kunde';
    var avbryt=$('avbrytKundeRedigeringKnapp'); if(avbryt) avbryt.style.display = k ? '' : 'none';
  }
  window.redigerKunde = function(id){
    if(!kanRedigereKunder()){ alert('Du mangler redigeringstilgang til kunder.'); return; }
    var k=getKunder().find(function(x){return s(x.id)===s(id);});
    if(!k){ alert('Fant ikke kunde'); return; }
    fillKundeForm(k);
    if(typeof window.skjulProsjektVindu==='function') window.skjulProsjektVindu();
    msg('Redigerer kunde. Trykk Lagre endringer når du er ferdig.');
    var side=$('kundeSide'); if(side) side.scrollIntoView({behavior:'smooth',block:'start'});
  };
  window.nullstillKundeSkjema = function(){
    fillKundeForm(null);
    if($('kundeNrVis')) $('kundeNrVis').value='(lages automatisk)';
    if(typeof window.skjulProsjektVindu==='function') window.skjulProsjektVindu();
    msg('');
  };
  window.lagreKunde = async function(){
    var c=client(); if(!c){ msg('Supabase er ikke lastet.'); return; }
    var id=s($('kundeId')&&$('kundeId').value);
    var navn=s($('kundeNavn')&&$('kundeNavn').value).trim();
    if(!navn){ msg('Kundenavn må fylles ut.'); return; }
    var nr = id ? s(($('kundeNr')&&$('kundeNr').value) || ($('kundeNrVis')&&$('kundeNrVis').value)) : nesteKundenr();
    nr=s(nr).replace(/[^0-9A-Za-z_-]/g,'');
    var data={
      navn:navn,
      adresse:s($('kundeAdresse')&&$('kundeAdresse').value).trim(),
      epost:s($('kundeEpost')&&$('kundeEpost').value).trim(),
      kontaktperson:s($('kundeKontaktperson')&&$('kundeKontaktperson').value).trim(),
      kontonr:s($('kundeKontonr')&&$('kundeKontonr').value).trim(),
      kundenr:nr,
      kunde_nr:nr,
      firma_id:await firmaId()
    };
    var r=id ? await safeUpdate('hand_kunde', id, data) : await safeInsert('hand_kunde', data);
    if(r && r.error){ msg('Feil ved lagring av kunde: '+r.error.message); return; }
    msg(id ? 'Kunde endret.' : 'Kunde lagret med kundenr '+nr+'.');
    if(typeof window.lastKunder==='function') await window.lastKunder();
    window.nullstillKundeSkjema();
  };
  window.visProsjektVindu = function(){
    var id=s($('kundeId')&&$('kundeId').value);
    if(!id){ msg('Trykk Rediger på kunden først, eller lagre kunden før du legger til prosjekt.'); return; }
    var k=getKunder().find(function(x){return s(x.id)===id;});
    var pn=nesteProsjektNrForKunde(k);
    if($('prosjektNr')) $('prosjektNr').value=pn;
    var overlay=$('prosjektOverlay'), vindu=$('prosjektVindu');
    if(overlay) overlay.style.display='block';
    if(vindu) vindu.style.display='block';
  };
  window.lagreProsjektForValgtKunde = async function(){
    var c=client(); if(!c){ msg('Supabase er ikke lastet.'); return; }
    var kundeId=s($('kundeId')&&$('kundeId').value);
    if(!kundeId){ msg('Velg kunde med Rediger først.'); return; }
    var k=getKunder().find(function(x){return s(x.id)===kundeId;});
    var pn=s($('prosjektNr')&&$('prosjektNr').value).trim() || nesteProsjektNrForKunde(k);
    var navn=s($('prosjektNavn')&&$('prosjektNavn').value).trim();
    var bes=s($('prosjektBeskrivelse')&&$('prosjektBeskrivelse').value).trim();
    if(!navn){ msg('Fyll ut prosjektnavn.'); return; }
    var data={kunde_id:kundeId, prosjektnr:pn, prosjekt_nr:pn, navn:navn, beskrivelse:bes, aktiv:true, firma_id:k&&k.firma_id || await firmaId()};
    var r=await safeInsert('hand_prosjekt', data);
    if(r && r.error){ msg('Feil ved lagring av prosjekt: '+r.error.message); return; }
    msg('Prosjekt lagret med prosjektnr '+pn+'.');
    if($('prosjektNavn')) $('prosjektNavn').value='';
    if($('prosjektBeskrivelse')) $('prosjektBeskrivelse').value='';
    if(typeof window.skjulProsjektVindu==='function') window.skjulProsjektVindu();
    if(typeof window.lastKunder==='function') await window.lastKunder();
    fillKundeForm(k || getKunder().find(function(x){return s(x.id)===kundeId;}));
  };
  function renderKunderMedRediger(){
    var liste=$('kundeListe'); if(!liste) return;
    var ks=getKunder(), ps=getProsjekter();
    if(!ks.length){ liste.innerHTML='<p>Ingen kunder funnet.</p>'; return; }
    liste.innerHTML=ks.map(function(k){
      var kps=ps.filter(function(p){return s(p.kunde_id)===s(k.id);});
      return '<div class="card" style="padding:14px;margin-bottom:14px;border-bottom:1px solid #444">'
        +'<div style="line-height:1.35"><strong>'+esc(k.navn||'')+'</strong><br>Kundenr: '+esc(kundenr(k))+'<br>'+esc(k.adresse||'')+'<br>'+esc(k.epost||'')+'<br>'+esc(k.kontaktperson||'')+'<br>'+esc(k.kontonr||'')+'</div>'
        +(kanRedigereKunder()?'<div style="margin-top:10px"><button type="button" class="secondary ril-rediger-kunde" data-id="'+esc(k.id)+'">Rediger</button></div>':'')
        +'<div style="margin-top:10px"><strong>Prosjekter:</strong>'+(kps.length?'<ul style="margin-top:6px">'+kps.map(function(p){return '<li>'+esc(prosjektnr(p))+' '+esc(p.navn||'')+(p.beskrivelse?'<br><small>'+esc(p.beskrivelse)+'</small>':'')+'</li>';}).join('')+'</ul>':'<div><em>Ingen prosjekter</em></div>')+'</div>'
        +'</div>';
    }).join('');
    liste.querySelectorAll('.ril-rediger-kunde').forEach(function(b){ b.onclick=function(){ window.redigerKunde(b.dataset.id); }; });
  }
  var oldLast=window.lastKunder;
  window.lastKunder=async function(){ if(typeof oldLast==='function') await oldLast.apply(this,arguments); renderKunderMedRediger(); };
  window.tegnKundeListe=renderKunderMedRediger;
  window.visKunder=renderKunderMedRediger;
  document.addEventListener('handPartialerLastet',function(){ setTimeout(function(){ if($('kundeNrVis')) $('kundeNrVis').value='(lages automatisk)'; renderKunderMedRediger(); },800); });
  document.addEventListener('DOMContentLoaded',function(){ setTimeout(function(){ if($('kundeNrVis')) $('kundeNrVis').value='(lages automatisk)'; renderKunderMedRediger(); },1500); });
})();
