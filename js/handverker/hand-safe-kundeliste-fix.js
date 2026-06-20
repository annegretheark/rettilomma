
/* SAFE kundeliste-fix: bruker hand_kunde (riktig tabellnavn) og endrer ikke tema/CSS */
(function(){
  function $(id){return document.getElementById(id);}
  function norm(v){return String(v||'').trim().toLowerCase();}
  function erSys(){return window.erSystemadmin===true || norm(window.innloggetEpost||localStorage.getItem('handInnloggetEpost'))==='greknuts@online.no' || norm(window.innloggetRolle||localStorage.getItem('handInnloggetRolle'))==='sysadmin';}
  function navn(k){return k.navn || k.firmanavn || k.kunde_navn || k.navn_firma || k.company || k.epost || k.email || k.id || '';}
  function nummer(k){return k.kundenr || k.kunde_nr || k.kundenummer || '';}
  async function hentKunderTrygt(){
    if(!window.supabaseClient) return [];
    if(Array.isArray(window.handAdminKunder) && window.handAdminKunder.length) return window.handAdminKunder;
    if(Array.isArray(window.kunder) && window.kunder.length) return window.kunder;
    const forsok=[
      ['hand_kunde','*','navn'],['hand_kunde','*','firmanavn'],['hand_kunde','*','kunde_navn'],['hand_kunde','*',null],
      ['hand_firma','*','navn'],['hand_firma','*','firmanavn'],['hand_firma','*',null],
      ['hand_kunder','*','navn'],['hand_kunder','*','firmanavn'],['hand_kunder','*',null]
    ];
    let sisteFeil='';
    for(const [tabell,select,order] of forsok){
      try{
        let q=window.supabaseClient.from(tabell).select(select);
        if(order) q=q.order(order,{ascending:true});
        const r=await q;
        if(!r.error && Array.isArray(r.data) && r.data.length){
          window.handAdminKunder=r.data;
          window.kunder=r.data;
          return r.data;
        }
        if(r.error) sisteFeil=tabell+': '+r.error.message;
      }catch(e){sisteFeil=String(e.message||e);}
    }
    window.handKundeSisteFeil=sisteFeil || '0 rader returnert';
    return [];
  }
  function fyllSelect(sel,kunder,tom){
    if(!sel) return;
    const gammel=sel.value;
    sel.innerHTML='';
    const opt0=document.createElement('option'); opt0.value=''; opt0.textContent=kunder.length?tom:'Ingen kunder funnet'; sel.appendChild(opt0);
    kunder.forEach(k=>{ if(!k || !k.id) return; const o=document.createElement('option'); o.value=k.id; const nr=nummer(k); const nm=navn(k); o.textContent=nr?nr+' - '+nm:nm; sel.appendChild(o); });
    if(gammel && Array.from(sel.options).some(o=>String(o.value)===String(gammel))) sel.value=gammel;
  }
  async function fyllAlleKundevalg(){
    if(!erSys()) return;
    const kunder=await hentKunderTrygt();
    fyllSelect($('modulKundeVelger'),kunder,'Velg kunde/firma...');
    fyllSelect($('fakturaKundeValg'),kunder,'Velg kunde');
    fyllSelect($('okonomiKundeValg'),kunder,'Alle kunder');
    const msg = $('modulMelding') || $('modulStatus') || $('fakturaMelding');
    if(msg && !kunder.length) msg.textContent='Ingen kunder ble hentet. Sjekk Supabase RLS/select for hand_kunde. Det riktige tabellnavnet i appen er hand_kunde.';
  }
  window.handHentKunderTrygt=hentKunderTrygt;
  window.handFyllAlleKundevalg=fyllAlleKundevalg;
  const gammelVisMod=window.visModulerSide;
  window.visModulerSide=async function(){ const r= gammelVisMod ? await gammelVisMod.apply(this,arguments) : undefined; setTimeout(fyllAlleKundevalg,100); setTimeout(fyllAlleKundevalg,500); return r; };
  const gammelVisFak=window.visFakturaSide;
  window.visFakturaSide=function(){ const r= gammelVisFak ? gammelVisFak.apply(this,arguments) : undefined; setTimeout(fyllAlleKundevalg,100); setTimeout(fyllAlleKundevalg,500); return r; };
  document.addEventListener('DOMContentLoaded',()=>setTimeout(fyllAlleKundevalg,300));
  document.addEventListener('handPartialerLastet',()=>setTimeout(fyllAlleKundevalg,300));
  window.addEventListener('load',()=>setTimeout(fyllAlleKundevalg,800));
})();
