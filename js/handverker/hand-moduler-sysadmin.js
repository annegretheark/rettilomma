/* Handverker - moduler kun for sysadmin og valgt kunde/firma */
(function(){
  const MODULER = [
    { id: 'tilbud', navn: 'Tilbud' },
    { id: 'faktura', navn: 'Faktura' },
    { id: 'varer', navn: 'Varer/lager' },
    { id: 'biler', navn: 'Bil' },
    { id: 'lonn', navn: 'Lønn' },
    { id: 'fravaer', navn: 'Fravær' },
];

  const PAKKER = {
    solo: ['tilbud','faktura'],
    handverker: ['tilbud','faktura','varer','biler'],
pro: MODULER.map(m => m.id)
  };

  function $(id){ return document.getElementById(id); }
  function status(txt, feil){ const el = $('modulStatus') || $('modulMelding'); if(el){ el.textContent = txt || ''; el.style.color = feil ? '#b91c1c' : ''; } }
  function erSysadmin(){
    const email = String(window.innloggetEpost || localStorage.getItem('handInnloggetEpost') || '').toLowerCase();
    return (typeof window.handErSysadm === 'function' && window.handErSysadm()) || window.erSystemadmin === true;
  }
  function valgtFirmaId(){
    const fraSelect = $('modulKundeVelger')?.value || '';
    const fraSkjema = $('redigerHandKundeId')?.value || '';
    return String(fraSelect || fraSkjema || localStorage.getItem('handAktuellModulKundeId') || '').trim();
  }
  function setValgtFirmaId(id){
    id = String(id || '').trim();
    if($('modulKundeVelger')) $('modulKundeVelger').value = id;
    if($('redigerHandKundeId') && id) $('redigerHandKundeId').value = id;
    if(id) localStorage.setItem('handAktuellModulKundeId', id);
  }
  window.handHentAktuellModulKundeId = valgtFirmaId;

  async function hentFirmaer(){
    if(!window.supabaseClient && typeof supabaseClient === 'undefined') return [];

    // Moduler skal velge håndverkerfirma, ikke sluttkunder.
    try {
      const res = await supabaseClient
        .from('hand_firma')
        .select('id, navn, epost, orgnr, linknavn, moduler')
        .order('navn', { ascending: true });

      if (!res.error && Array.isArray(res.data)) {
        window.handAdminKunder = res.data;
        return res.data;
      }

      if (res.error) {
        const melding = $('modulMelding') || $('modulStatus');
        if (melding) melding.textContent = 'Kunne ikke hente hand_firma: ' + res.error.message;
      }
    } catch(e) {
      const melding = $('modulMelding') || $('modulStatus');
      if (melding) melding.textContent = 'Kunne ikke hente hand_firma: ' + (e.message || e);
    }

    // Fallback: bruk lista som systemadmin allerede har hentet
    if (Array.isArray(window.handAdminKunder) && window.handAdminKunder.length) {
      return window.handAdminKunder;
    }

    return [];
  }

  async function fyllKundevelger(){
    const sel = $('modulKundeVelger');
    if(!sel || !erSysadmin()) return;
    const valgt = valgtFirmaId();
    const firmaer = await hentFirmaer();
    sel.innerHTML = '';
    const tom = document.createElement('option');
    tom.value = '';
    tom.textContent = 'Velg kunde/firma...';
    sel.appendChild(tom);

    firmaer.forEach(function(f){
      const opt = document.createElement('option');
      opt.value = String(f.id || '');
      opt.textContent = f.navn || f.firmanavn || f.epost || f.email || f.id || 'Uten navn';
      sel.appendChild(opt);
    });

    sel.style.display = 'block';
    sel.style.width = '100%';
    sel.style.maxWidth = '760px';
    if(valgt) sel.value = valgt;
    sel.onchange = async function(){
      setValgtFirmaId(sel.value);
      await window.lastModulerFraDatabase();
      window.tegnModulGui();
    };
  }

  function lesValgteFraGui(){
    const obj = {};
    MODULER.forEach(m => { obj[m.id] = !!$(`modul_${m.id}`)?.checked; });
    return obj;
  }
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
      if(!r2.error && Array.isArray(r2.data) && r2.data.length){
        const o = {}; r2.data.forEach(r => { o[r.modul] = r.aktiv !== false; }); return o;
      }
    }catch(e){}
    try{
      const r3 = await supabaseClient.from('hand_kunde_moduler').select('modul, aktiv').eq('firma_id', firmaId);
      if(!r3.error && Array.isArray(r3.data) && r3.data.length){
        const o = {}; r3.data.forEach(r => { o[r.modul] = r.aktiv !== false; }); return o;
      }
    }catch(e){}
    return {};
  }

  async function lagreModulerForFirma(firmaId, obj){
    let ok = false;
    const arr = objTilArray(obj);
    try{
      const r = await supabaseClient.from('hand_firma').update({ moduler: arr }).eq('id', firmaId);
      if(!r.error) ok = true;
    }catch(e){}
    const rows = MODULER.map(m => ({ firma_id: firmaId, modul: m.id, aktiv: !!obj[m.id] }));
    for(const tabell of ['hand_moduler','hand_kunde_moduler']){
      try{
        await supabaseClient.from(tabell).delete().eq('firma_id', firmaId);
        const r = await supabaseClient.from(tabell).insert(rows);
        if(!r.error) ok = true;
      }catch(e){}
    }
    if(!ok) throw new Error('Fant ingen modultabell/kolonne å lagre til. Legg til moduler på hand_firma eller tabellen hand_moduler.');
  }

  window.tegnModulGui = function(){
    const liste = $('modulListe');
    if(!liste) return;
    const firmaId = valgtFirmaId();
    if(!erSysadmin()) { liste.innerHTML = '<p>Moduler er kun tilgjengelig for systemadmin.</p>'; return; }
    if(!firmaId) { liste.innerHTML = '<p>Velg kunde/firma først.</p>'; return; }
    const aktive = window.handAktuelleKundeModuler || {};
    liste.innerHTML = MODULER.map(m => `
      <label style="display:block; margin:8px 0;">
        <input id="modul_${m.id}" type="checkbox" ${aktive[m.id] ? 'checked' : ''}> ${m.navn}
      </label>`).join('');
  };

  window.brukModulPakke = function(pakke){
    if(!erSysadmin()) { alert('Kun systemadmin kan endre moduler.'); return; }
    const valgt = PAKKER[pakke] || [];
    window.handAktuelleKundeModuler = arrayTilObj(valgt);
    window.tegnModulGui();
  };

  window.lastModulerFraDatabase = async function(){
    if(!erSysadmin()) return;
    await fyllKundevelger();
    const firmaId = valgtFirmaId();
    if(!firmaId){ window.handAktuelleKundeModuler = {}; return; }
    window.handAktuelleKundeModuler = await hentModulerForFirma(firmaId);
    status('Moduler lastet for valgt kunde.');
  };

  window.lagreModuler = async function(){
    if(!erSysadmin()) { alert('Kun systemadmin kan lagre moduler.'); return; }
    const firmaId = valgtFirmaId();
    if(!firmaId){ status('Velg kunde/firma før du lagrer moduler.', true); return; }
    try{
      const obj = lesValgteFraGui();
      await lagreModulerForFirma(firmaId, obj);
      window.handAktuelleKundeModuler = obj;
      status('Moduler lagret for valgt kunde.');
    }catch(e){ console.error(e); status('Feil ved lagring: ' + (e.message || e), true); }
  };

  window.visModulerSide = async function(){
    if(!erSysadmin()) { alert('Moduler er kun for systemadmin.'); return; }
    if(typeof window.visSide === 'function') window.visSide('modulerSide');
    else { document.querySelectorAll('#modulerSide').forEach(el => { el.classList.remove('skjult','hidden'); el.style.display=''; }); }
    await window.lastModulerFraDatabase();
    window.tegnModulGui();
  };

  window.handFyllModulKundeVelger = fyllKundevelger;

  function bind(){
    const knapp = $('lagreModulerKnapp');
    if(knapp && knapp.dataset.handModSysBind !== '1'){
      knapp.dataset.handModSysBind = '1';
      knapp.addEventListener('click', function(e){ e.preventDefault(); window.lagreModuler(); });
    }
    fyllKundevelger().catch(console.warn);
  }
  document.addEventListener('DOMContentLoaded', bind);
  document.addEventListener('handPartialerLastet', bind);
  window.addEventListener('load', bind);
})();
