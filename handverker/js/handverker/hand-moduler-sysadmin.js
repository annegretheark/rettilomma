/* Handverker - moduler kun for sysadmin, vist under Rediger firma */
(function(){
  const MODULER = [
    { id: 'timer', navn: 'Timer' },
    { id: 'jobber', navn: 'Jobber' },
    { id: 'tilbud', navn: 'Tilbud' },
    { id: 'faktura', navn: 'Faktura' },
    { id: 'kunder', navn: 'Kunder' },
    { id: 'hand-ansatte', navn: 'Ansatte' },
    { id: 'varer', navn: 'Varer/lager' },
    { id: 'biler', navn: 'Biler / bil-lager' },
    { id: 'lonn', navn: 'Lønn' },
    { id: 'fravaer', navn: 'Fravær / Flexi' }
  ];

  function $(id){ return document.getElementById(id); }
  function ensureModulBlock(){
    let el = $('modulerSide');
    if(el) return el;
    const msg = $('nyHandKundeMelding');
    const block = $('handSystemadminBlokk') || (msg && msg.parentElement) || document.body;
    el = document.createElement('section');
    el.id = 'modulerSide';
    el.className = 'systemadmin-only skjult';
    el.style.cssText = 'display:none; margin-top:16px; padding:14px; border:1px solid #334155; border-radius:10px; background:#0f172a;';
    el.innerHTML = '<h3>Moduler for valgt firma</h3><p class="info">Velg hvilke funksjoner denne bedriften skal ha tilgang til.</p><div id="modulListe"><p>Trykk <b>Rediger</b> på en bedrift først.</p></div><button id="lagreModulerKnapp" type="button">Lagre moduler</button><div id="modulStatus" class="melding"></div><div id="modulMelding" class="melding"></div>';
    if(msg && msg.parentElement) msg.insertAdjacentElement('afterend', el); else block.appendChild(el);
    return el;
  }

  function status(txt, feil){ const el = $('modulStatus') || $('modulMelding'); if(el){ el.textContent = txt || ''; el.style.color = feil ? '#fca5a5' : '#86efac'; } }
  function erSysadmin(){ return window.erSystemadmin === true || String(window.innloggetRolle || localStorage.getItem('handInnloggetRolle') || localStorage.getItem('innloggetRolle') || '').toLowerCase().indexOf('sysadm') >= 0; }
  function valgtFirmaId(){
    const fraSkjema = $('redigerHandKundeId')?.value || '';
    const fraSelect = $('modulKundeVelger')?.value || '';
    return String(fraSkjema || fraSelect || localStorage.getItem('handAktuellModulKundeId') || '').trim();
  }
  function setValgtFirmaId(id){
    id = String(id || '').trim();
    if($('redigerHandKundeId') && id) $('redigerHandKundeId').value = id;
    if($('modulKundeVelger')) $('modulKundeVelger').value = id;
    if(id) localStorage.setItem('handAktuellModulKundeId', id);
  }
  window.handHentAktuellModulKundeId = valgtFirmaId;
  window.handSettAktuellModulKundeId = setValgtFirmaId;

  function visModulSeksjon(vis){
    const el=ensureModulBlock(); if(!el) return;
    // Modulvalget skal alltid være synlig inne i Rediger firma for sysadm.
    // Når firma ikke er valgt viser vi bare statusmelding, ikke skjuler boksen.
    el.classList.remove('skjult','hidden','modul-skjult');
    el.hidden=false;
    el.style.display='block';
    el.style.visibility='visible';
    el.removeAttribute('aria-hidden');
  }
  window.handVisModulerUnderRedigerFirma = async function(firmaId){
    if(!erSysadmin()) return;
    setValgtFirmaId(firmaId || valgtFirmaId());
    if(!valgtFirmaId()){ visModulSeksjon(true); window.tegnModulGui(); return; }
    visModulSeksjon(true);
    await window.lastModulerFraDatabase();
    window.tegnModulGui();
  };
  window.handSkjulModulerUnderRedigerFirma = function(){ visModulSeksjon(true); status('Velg et firma med Rediger før du lagrer.'); };

  async function fyllKundevelger(){
    const sel = $('modulKundeVelger');
    if(!sel || !erSysadmin()) return;
    const valgt = valgtFirmaId();
    sel.innerHTML = '<option value="">Velg kunde/firma...</option>';
    if(Array.isArray(window.handFirmaRowsV9)){
      window.handFirmaRowsV9.forEach(function(f){
        const opt=document.createElement('option'); opt.value=String(f.id||''); opt.textContent=f.navn||f.epost||f.id||'Uten navn'; sel.appendChild(opt);
      });
    }
    if(valgt) sel.value = valgt;
  }

  function lesValgteFraGui(){ const obj={}; MODULER.forEach(m => { obj[m.id] = !!$(`modul_${m.id}`)?.checked; }); return obj; }
  function arrayTilObj(arr){ const o={}; (arr||[]).forEach(id => { o[id]=true; }); return o; }
  function objTilArray(o){ return MODULER.filter(m => o && o[m.id]).map(m => m.id); }

  async function hentModulerForFirma(firmaId){
    if(!firmaId || !window.supabaseClient) return {};
    try{
      const r1 = await supabaseClient.from('hand_firma').select('moduler').eq('id', firmaId).maybeSingle();
      if(!r1.error && r1.data && r1.data.moduler){
        if(Array.isArray(r1.data.moduler)) return arrayTilObj(r1.data.moduler);
        if(typeof r1.data.moduler === 'object') return r1.data.moduler;
      }
    }catch(e){}
    try{
      const r2 = await supabaseClient.from('hand_moduler').select('modul, aktiv').eq('firma_id', firmaId);
      if(!r2.error && Array.isArray(r2.data) && r2.data.length){ const o={}; r2.data.forEach(r => { o[r.modul]=r.aktiv!==false; }); return o; }
    }catch(e){}
    try{
      const r3 = await supabaseClient.from('hand_kunde_moduler').select('modul, aktiv').eq('firma_id', firmaId);
      if(!r3.error && Array.isArray(r3.data) && r3.data.length){ const o={}; r3.data.forEach(r => { o[r.modul]=r.aktiv!==false; }); return o; }
    }catch(e){}
    return {};
  }

  async function lagreModulerForFirma(firmaId, obj){
    let ok=false; const arr=objTilArray(obj);
    try{ const r=await supabaseClient.from('hand_firma').update({ moduler: arr }).eq('id', firmaId); if(!r.error) ok=true; }catch(e){}
    const rows=MODULER.map(m => ({ firma_id:firmaId, modul:m.id, aktiv:!!obj[m.id] }));
    for(const tabell of ['hand_moduler','hand_kunde_moduler']){
      try{ await supabaseClient.from(tabell).delete().eq('firma_id', firmaId); const r=await supabaseClient.from(tabell).insert(rows); if(!r.error) ok=true; }catch(e){}
    }
    if(!ok) throw new Error('Fant ingen modultabell/kolonne å lagre til. Legg til moduler på hand_firma eller tabellen hand_moduler.');
  }

  window.tegnModulGui = function(){
    const liste=$('modulListe'); if(!liste) return;
    const firmaId=valgtFirmaId();
    if(!erSysadmin()){ liste.innerHTML='<p>Moduler er kun tilgjengelig for systemadmin.</p>'; return; }
    if(!firmaId){ liste.innerHTML='<p>Trykk Rediger på et firma først.</p>'; return; }
    const aktive=window.handAktuelleKundeModuler || {};
    liste.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px 18px;margin:10px 0 14px;">'+MODULER.map(m =>
      `<label style="display:block;"><input id="modul_${m.id}" type="checkbox" ${aktive[m.id] ? 'checked' : ''}> ${m.navn}</label>`
    ).join('')+'</div>';
  };

  window.brukModulPakke = function(){ status('Pakker er fjernet. Velg modulene enkeltvis.', true); };
  window.lastModulerFraDatabase = async function(){
    if(!erSysadmin()) return;
    await fyllKundevelger();
    const firmaId=valgtFirmaId();
    if(!firmaId){ window.handAktuelleKundeModuler={}; return; }
    window.handAktuelleKundeModuler = await hentModulerForFirma(firmaId);
    status('Moduler lastet for valgt firma.');
  };
  window.lagreModuler = async function(){
    if(!erSysadmin()){ alert('Kun systemadmin kan lagre moduler.'); return; }
    const firmaId=valgtFirmaId();
    if(!firmaId){ status('Trykk Rediger på et firma før du lagrer moduler.', true); return; }
    try{ const obj=lesValgteFraGui(); await lagreModulerForFirma(firmaId,obj); window.handAktuelleKundeModuler=obj; status('Moduler lagret for valgt firma.'); }
    catch(e){ console.error(e); status('Feil ved lagring: '+(e.message||e), true); }
  };
  window.visModulerSide = function(){ window.handVisModulerUnderRedigerFirma(valgtFirmaId()); };
  window.handFyllModulKundeVelger = fyllKundevelger;
  function bind(){ ensureModulBlock(); const knapp=$('lagreModulerKnapp'); if(knapp && knapp.dataset.handModSysBind !== '1'){ knapp.dataset.handModSysBind='1'; knapp.addEventListener('click', function(e){ e.preventDefault(); window.lagreModuler(); }); } visModulSeksjon(true); if(!valgtFirmaId()) window.tegnModulGui(); }
  document.addEventListener('DOMContentLoaded', bind);
  document.addEventListener('handPartialerLastet', bind);
  window.addEventListener('load', bind);
})();
