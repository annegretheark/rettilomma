/* Rett i Lomma - SYSADM firma og moduler
   Sysadm kan opprette nye håndverkerfirmaer og tildele moduler.
   Rollen leses fra Supabase Auth metadata: user.user_metadata.rolle = "sysadm".
*/
(function(){
  const MODULER = [
    {id:'tilbud', navn:'Tilbud'},
    {id:'faktura', navn:'Faktura'},
    {id:'varer', navn:'Varer/lager'},
    {id:'biler', navn:'Bil'},
    {id:'lonn', navn:'Lønn'},
    {id:'fravaer', navn:'Fravær'}
  ];
  const PAKKER = {
    solo: ['tilbud','faktura'],
    handverker: ['tilbud','faktura','varer','biler'],
    pro: MODULER.map(m => m.id)
  };

  function $(id){ return document.getElementById(id); }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function val(id){ return ($(id)?.value || '').trim(); }
  function set(id,v){ const e=$(id); if(e) e.value = v || ''; }
  function norm(v){ return String(v || '').trim().toLowerCase(); }
  function isSysRole(v){ v = norm(v); return v === 'sysadm' || v === 'sysadmin' || v === 'systemadmin'; }
  function slugify(v){ return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function appBase(){ return location.pathname.toLowerCase().includes('/rettilomma/') ? location.origin + '/rettilomma/handverker/' : location.origin + '/handverker/'; }
  function rootBase(){ return location.pathname.toLowerCase().includes('/rettilomma/') ? location.origin + '/rettilomma/' : location.origin + '/'; }
  function kundelink(slug){ return appBase() + '?firma=' + encodeURIComponent(slug || ''); }
  function msg(id, t, feil){ const e=$(id); if(e){ e.textContent = t || ''; e.style.color = feil ? '#fca5a5' : '#86efac'; } }

  async function authUser(){
    try{ const r = await (window.supabaseClient || supabaseClient).auth.getSession(); return r?.data?.session?.user || null; }catch(e){ return null; }
  }
  async function erSysadm(){
    const u = await authUser();
    const metaRole = u?.user_metadata?.rolle || u?.raw_user_meta_data?.rolle;
    if(isSysRole(metaRole)) return true;
    if(window.erSystemadmin === true || isSysRole(window.innloggetRolle) || isSysRole(localStorage.getItem('handInnloggetRolle'))) return true;
    return false;
  }
  async function markerSysadm(){
    if(!(await erSysadm())) return;
    window.erSystemadmin = true;
    window.erAdmin = true;
    window.innloggetRolle = 'sysadm';
    localStorage.setItem('handInnloggetRolle','sysadm');
    localStorage.setItem('rilAdminModus','ja');
    const badge = $('innloggetBruker');
    const u = await authUser();
    if(badge && u?.email && !/sysadm/i.test(badge.textContent || '')) badge.textContent = 'Innlogget bruker: ' + u.email + ' (sysadm)';
    document.querySelectorAll('.systemadmin-only,.sysadmin-entry').forEach(el => {
      el.classList.remove('skjult','hidden','modul-skjult');
      el.style.display = '';
      el.hidden = false;
    });
  }

  function hideAll(){
    const ids = ['timerSide','jobberSide','fravaerSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','kundeSide','kunderSide','ansattSide','ansatteSide','firmaSide','testSide','testpanelSide','lonnPanel','lonnSide','bilBestillingerSide','adminBilBestillinger','adminBilBestillingerPanel','modulerSide','sysadminPanelSide','adminSide'];
    ids.forEach(id => { const el=$(id); if(el){ el.classList.add('skjult','hidden'); el.style.display='none'; } });
  }
  function show(id){
    hideAll();
    const el=$(id);
    if(el){ el.classList.remove('skjult','hidden','modul-skjult'); el.style.display=''; el.hidden=false; }
  }

  function ensurePanel(){
    let panel = $('sysadminPanelSide');
    const host = $('appSide') || document.body;
    if(!panel){
      panel = document.createElement('section');
      panel.id = 'sysadminPanelSide';
      panel.className = 'kort skjult systemadmin-only';
      host.appendChild(panel);
    }
    panel.innerHTML = `
      <h2>Sysadm - håndverkerfirmaer</h2>
      <p class="info">Opprett nye håndverkerfirmaer og administrer kundelinker.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <button id="sysadmOpprettFirmaFane" type="button">Opprett firma</button>
        <button id="sysadmOppdaterFirmaListe" type="button" class="secondary">Oppdater liste</button>
        <button id="sysadmTilModuler" type="button" class="secondary">Tildel moduler</button>
      </div>
      <div id="handSystemadminBlokk" class="kort" style="border:1px solid #374151;margin-bottom:14px">
        <h3>Nytt håndverkerfirma</h3>
        <input id="redigerHandKundeId" type="hidden">
        <label>Firmanavn</label><input id="nyHandKundeNavn" placeholder="Firmanavn">
        <label>E-post til firma-admin</label><input id="nyHandKundeEpost" type="email" placeholder="kunde@example.no">
        <label>Telefon</label><input id="nyHandKundeTelefon" placeholder="Telefon">
        <label>Adresse</label><input id="nyHandKundeAdresse" placeholder="Adresse">
        <label>Org.nr</label><input id="nyHandKundeOrgNr" placeholder="Org.nr">
        <label>Linknavn</label><input id="nyHandKundeLinknavn" readonly placeholder="automatisk">
        <label>Kundelink</label><input id="nyHandKundeLink" readonly>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button id="sysadmLagreFirma" type="button">Opprett firma</button>
          <button id="sysadmTomFirma" type="button" class="secondary">Tøm</button>
        </div>
        <div id="nyHandKundeMelding" class="melding"></div>
      </div>
      <h3>Håndverkerfirmaer</h3>
      <div id="handKundeAdminListe" class="info">Ingen firma lastet ennå.</div>`;

    $('sysadmLagreFirma')?.addEventListener('click', function(e){ e.preventDefault(); window.handOpprettKundeDirekte(); });
    $('sysadmTomFirma')?.addEventListener('click', function(e){ e.preventDefault(); ['redigerHandKundeId','nyHandKundeNavn','nyHandKundeEpost','nyHandKundeTelefon','nyHandKundeAdresse','nyHandKundeOrgNr','nyHandKundeLinknavn','nyHandKundeLink'].forEach(id=>set(id,'')); msg('nyHandKundeMelding',''); });
    $('sysadmOppdaterFirmaListe')?.addEventListener('click', function(e){ e.preventDefault(); window.handLastKundeliste(); });
    $('sysadmTilModuler')?.addEventListener('click', function(e){ e.preventDefault(); window.visModulerSide(); });
    $('nyHandKundeNavn')?.addEventListener('input', function(){ const s=slugify(val('nyHandKundeNavn')); set('nyHandKundeLinknavn', s); set('nyHandKundeLink', kundelink(s)); });
  }

  function ensureModuler(){
    let side = $('modulerSide');
    const host = $('appSide') || document.body;
    if(!side){
      side = document.createElement('section');
      side.id = 'modulerSide';
      side.className = 'kort skjult systemadmin-only';
      host.appendChild(side);
    }
    side.innerHTML = `
      <h2>Sysadm - tildel moduler</h2>
      <p class="info">Velg håndverkerfirma og hvilke moduler firmaet skal ha.</p>
      <label>Firma</label>
      <select id="modulKundeVelger" style="max-width:520px"></select>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">
        <button type="button" class="secondary" id="modulPakkeSolo">Solo</button>
        <button type="button" class="secondary" id="modulPakkeHand">Håndverker</button>
        <button type="button" class="secondary" id="modulPakkePro">Pro</button>
      </div>
      <div id="modulListe"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button id="lagreModulerKnapp" type="button">Lagre moduler</button>
        <button id="tilSysadmFirma" type="button" class="secondary">Til firmaer</button>
      </div>
      <div id="modulStatus" class="melding"></div>`;
    $('modulPakkeSolo')?.addEventListener('click', ()=>brukPakke('solo'));
    $('modulPakkeHand')?.addEventListener('click', ()=>brukPakke('handverker'));
    $('modulPakkePro')?.addEventListener('click', ()=>brukPakke('pro'));
    $('lagreModulerKnapp')?.addEventListener('click', function(e){ e.preventDefault(); window.lagreModuler(); });
    $('tilSysadmFirma')?.addEventListener('click', function(e){ e.preventDefault(); window.handVisSysadminPanel(); });
    $('modulKundeVelger')?.addEventListener('change', async function(){ await lastModulerFraDatabase(); tegnModulGui(); });
  }

  async function hentFirmaer(){
    if(!window.supabaseClient) return [];
    const forsok = [
      ['hand_firma','id,navn,epost,orgnr,linknavn,moduler','navn'],
      ['hand_firma','*','navn'],
      ['hand_kunder','*','navn']
    ];
    for(const [tab, sel, order] of forsok){
      try{
        let q = window.supabaseClient.from(tab).select(sel);
        if(order) q = q.order(order,{ascending:true});
        const r = await q;
        if(!r.error && Array.isArray(r.data)) { window.handAdminKunder = r.data; return r.data; }
      }catch(e){}
    }
    return [];
  }

  window.handLastKundeliste = async function(){
    const liste = $('handKundeAdminListe');
    if(!liste) return;
    if(!(await erSysadm())){ liste.innerHTML = '<div class="melding">Kun sysadm kan se firmaer.</div>'; return; }
    liste.innerHTML = '<div class="info">Henter firmaer...</div>';
    try{
      const firmaer = await hentFirmaer();
      if(!firmaer.length){ liste.innerHTML = '<div class="info">Ingen firma funnet.</div>'; return; }
      liste.innerHTML = firmaer.map(f => {
        const slug = f.linknavn || slugify(f.navn || f.firmanavn || f.epost || f.id);
        const link = kundelink(slug);
        return `<div style="display:grid;grid-template-columns:1.4fr 1.3fr auto auto;gap:8px;align-items:center;border-bottom:1px solid #374151;padding:8px 0">
          <div><b>${esc(f.navn || f.firmanavn || 'Uten navn')}</b><br><small>${esc(f.orgnr || '')}</small></div>
          <div>${esc(f.epost || f.email || '')}</div>
          <a href="${esc(link)}" target="_blank" style="color:#93c5fd">Åpne</a>
          <button type="button" class="secondary" data-modulfirma="${esc(f.id)}">Moduler</button>
        </div>`;
      }).join('');
      liste.querySelectorAll('[data-modulfirma]').forEach(btn => btn.addEventListener('click', async function(){
        localStorage.setItem('handAktuellModulKundeId', this.getAttribute('data-modulfirma'));
        await window.visModulerSide();
      }));
    }catch(e){ liste.innerHTML = '<div class="melding">Kunne ikke hente firmaer: '+esc(e.message||e)+'</div>'; }
  };

  async function insertAdaptive(table, payload){
    let p = {...payload};
    for(let i=0;i<10;i++){
      const r = await window.supabaseClient.from(table).insert([p]).select('*').maybeSingle();
      if(!r.error) return r.data || p;
      const m = String(r.error.message || '');
      const col = (m.match(/Could not find the '([^']+)' column/i)||[])[1] || (m.match(/column "([^"]+)"/i)||[])[1];
      if(col && Object.prototype.hasOwnProperty.call(p,col)){ delete p[col]; continue; }
      throw r.error;
    }
  }

  window.handOpprettKundeDirekte = async function(){
    if(!(await erSysadm())){ msg('nyHandKundeMelding','Bare sysadm kan opprette firma.', true); return; }
    const navn = val('nyHandKundeNavn');
    const epost = val('nyHandKundeEpost').toLowerCase();
    if(!navn){ msg('nyHandKundeMelding','Skriv firmanavn.', true); return; }
    if(!epost){ msg('nyHandKundeMelding','Skriv e-post til firma-admin.', true); return; }
    const slug = slugify(navn);
    set('nyHandKundeLinknavn', slug); set('nyHandKundeLink', kundelink(slug));
    msg('nyHandKundeMelding','Oppretter firma...');
    try{
      const finnes = await window.supabaseClient.from('hand_firma').select('id').eq('epost', epost).limit(1);
      if(!finnes.error && finnes.data && finnes.data.length){ msg('nyHandKundeMelding','Firma med denne e-posten finnes allerede.', true); return; }
      const firma = await insertAdaptive('hand_firma', {
        navn, epost,
        telefon: val('nyHandKundeTelefon') || null,
        adresse: val('nyHandKundeAdresse') || null,
        orgnr: val('nyHandKundeOrgNr') || null,
        linknavn: slug,
        system_type: 'handverker',
        moduler: []
      });
      try{ await insertAdaptive('hand_ansatt', { firma_id: firma.id, navn, epost, rolle:'admin', aktiv:true }); }catch(e){ console.warn('Adminrad kunne ikke lagres automatisk:', e); }
      try{ await window.supabaseClient.auth.resetPasswordForEmail(epost, { redirectTo: rootBase() + 'reset.html' }); }catch(e){}
      msg('nyHandKundeMelding','Firma opprettet. Kundelink: ' + kundelink(slug));
      await window.handLastKundeliste();
      await fyllFirmaVelger();
    }catch(e){ console.error(e); msg('nyHandKundeMelding','Feil: '+(e.message||e), true); }
  };

  async function fyllFirmaVelger(){
    const sel = $('modulKundeVelger');
    if(!sel) return;
    const valgt = localStorage.getItem('handAktuellModulKundeId') || sel.value || '';
    const firmaer = await hentFirmaer();
    sel.innerHTML = '<option value="">Velg firma...</option>' + firmaer.map(f => `<option value="${esc(f.id)}">${esc(f.navn || f.firmanavn || f.epost || f.id)}</option>`).join('');
    if(valgt) sel.value = valgt;
  }
  function valgtFirma(){ const id = $('modulKundeVelger')?.value || localStorage.getItem('handAktuellModulKundeId') || ''; if(id) localStorage.setItem('handAktuellModulKundeId', id); return id; }
  function arrayToObj(arr){ const o={}; (arr||[]).forEach(id => o[id]=true); return o; }
  function objToArray(o){ return MODULER.filter(m => o && o[m.id]).map(m => m.id); }

  async function hentModuler(firmaId){
    try{
      const r = await window.supabaseClient.from('hand_firma').select('moduler').eq('id', firmaId).maybeSingle();
      if(!r.error && r.data && r.data.moduler){
        if(Array.isArray(r.data.moduler)) return arrayToObj(r.data.moduler);
        if(typeof r.data.moduler === 'object') return r.data.moduler;
      }
    }catch(e){}
    return {};
  }
  async function lagreModulerDb(firmaId, obj){
    const arr = objToArray(obj);
    const r = await window.supabaseClient.from('hand_firma').update({moduler: arr}).eq('id', firmaId);
    if(r.error) throw r.error;
  }
  function tegnModulGui(){
    const liste = $('modulListe'); if(!liste) return;
    const id = valgtFirma();
    if(!id){ liste.innerHTML = '<p>Velg firma først.</p>'; return; }
    const akt = window.handAktuelleKundeModuler || {};
    liste.innerHTML = MODULER.map(m => `<label style="display:block;padding:7px 0;border-bottom:1px solid #374151"><input id="modul_${esc(m.id)}" type="checkbox" ${akt[m.id]?'checked':''}> ${esc(m.navn)}</label>`).join('');
  }
  async function lastModulerFraDatabase(){
    await fyllFirmaVelger();
    const id = valgtFirma();
    if(!id){ window.handAktuelleKundeModuler = {}; return; }
    window.handAktuelleKundeModuler = await hentModuler(id);
    msg('modulStatus','Moduler lastet.');
  }
  function lesGui(){ const o={}; MODULER.forEach(m => o[m.id] = !!$(`modul_${m.id}`)?.checked); return o; }
  function brukPakke(pakke){ window.handAktuelleKundeModuler = arrayToObj(PAKKER[pakke] || []); tegnModulGui(); }

  window.tegnModulGui = tegnModulGui;
  window.lastModulerFraDatabase = lastModulerFraDatabase;
  window.brukModulPakke = brukPakke;
  window.lagreModuler = async function(){
    if(!(await erSysadm())){ alert('Kun sysadm kan lagre moduler.'); return; }
    const id = valgtFirma();
    if(!id){ msg('modulStatus','Velg firma først.', true); return; }
    try{ const obj = lesGui(); await lagreModulerDb(id, obj); window.handAktuelleKundeModuler = obj; msg('modulStatus','Moduler lagret.'); }
    catch(e){ console.error(e); msg('modulStatus','Feil ved lagring: '+(e.message||e), true); }
  };

  window.handVisSysadminPanel = async function(){
    await markerSysadm();
    ensurePanel();
    show('sysadminPanelSide');
    await window.handLastKundeliste();
  };
  window.visModulerSide = async function(){
    await markerSysadm();
    ensureModuler();
    show('modulerSide');
    await lastModulerFraDatabase();
    tegnModulGui();
  };

  function bindSysadmButtons(){
    const labels = Array.from(document.querySelectorAll('button,a')).filter(b => /sysadm|systemadmin/i.test(b.textContent || '') || /sysadmin/i.test(b.id || ''));
    labels.forEach(b => {
      if(b.dataset.sysadmFirmaModBind === '1') return;
      b.dataset.sysadmFirmaModBind = '1';
      b.addEventListener('click', function(ev){
        const txt = norm(b.textContent || b.id || '');
        if(txt.includes('modul')) { ev.preventDefault(); window.visModulerSide(); }
        else if(txt.includes('sysadm') || txt.includes('systemadmin')) { ev.preventDefault(); window.handVisSysadminPanel(); }
      }, true);
    });
  }

  async function boot(){
    await markerSysadm();
    bindSysadmButtons();
  }
  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('handPartialerLastet', boot);
  window.addEventListener('load', function(){ boot(); setTimeout(boot,500); setTimeout(bindSysadmButtons,1500); });
})();
