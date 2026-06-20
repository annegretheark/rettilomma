
// Rett i Lomma håndverker - systemadmin og kundeadministrasjon
(function(){
  function $(id){ return document.getElementById(id); }
  function val(id){ return ($(id)?.value || '').trim(); }
  function set(id,v){ const e=$(id); if(e) e.value = v || ''; }
  function msg(t, feil){ const e=$('nyHandKundeMelding') || $('firmaMelding'); if(e){ e.textContent=t||''; e.style.color=feil?'#fca5a5':'#86efac'; } }
  function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function slugify(v){ return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function appBase(){ const p=location.pathname.toLowerCase(); if(p.includes('/rettilomma/')) return location.origin + '/rettilomma/handverker/'; if(p.includes('/handverker/')) return location.origin + '/handverker/'; return location.origin + '/handverker/'; }
  function rootBase(){ return location.pathname.toLowerCase().includes('/rettilomma/') ? location.origin + '/rettilomma/' : location.origin + '/'; }
  function link(slug){ return appBase() + '?firma=' + encodeURIComponent(slug||''); }

  async function innloggetEmail(){
    try{ const r = await window.supabaseClient?.auth?.getSession(); return (r?.data?.session?.user?.email || window.innloggetEpost || '').toLowerCase(); }catch(e){ return String(window.innloggetEpost || '').toLowerCase(); }
  }
  async function erSystemadmin(){
    const email = await innloggetEmail();
    if(email === 'greknuts@online.no') return true;
    try{ const {data,error}=await window.supabaseClient.rpc('er_systemadmin'); if(!error && data === true) return true; }catch(e){}
    return window.erSystemadmin === true;
  }

  function visAdminElementer(){
    document.querySelectorAll('.admin-only').forEach(el => { el.style.display=''; el.classList.remove('skjult','hidden'); });
    document.querySelectorAll('.systemadmin-only').forEach(el => { el.style.display=''; el.classList.remove('skjult','hidden'); });
  }

  async function oppdaterSystemadminVisning(){
    const admin = await erSystemadmin();
    window.erSystemadmin = admin || window.erSystemadmin === true;
    if(admin){ window.erAdmin = true; localStorage.setItem('rilAdminModus','ja'); visAdminElementer(); }
    const blokk = $('handSystemadminBlokk');
    if(blokk) blokk.classList.toggle('skjult', !admin);
    const knapp = $('visFirmaKnapp');
    if(knapp) knapp.textContent = admin ? 'Admin' : 'Firma';
    const opprettKnapp = $('visHandKundeAdminKnapp');
    if(opprettKnapp){
      opprettKnapp.classList.toggle('skjult', !admin);
      opprettKnapp.style.display = admin ? '' : 'none';
      opprettKnapp.textContent = 'Opprett håndverkerkunde';
    }
    bindSystemadminKnapp();
    const badge = $('innloggetBruker');
    const email = await innloggetEmail();
    if(badge && email) badge.textContent = 'Innlogget: ' + email;
    if(admin && typeof window.handLastKundeliste === 'function') { try{ await window.handLastKundeliste(); }catch(e){ console.warn(e); } }
  }

  async function supaInsertAdaptive(tabell, payload){
    let p = {...payload};
    for(let i=0;i<10;i++){
      const res = await window.supabaseClient.from(tabell).insert([p]).select('*').maybeSingle();
      if(!res.error) return res.data || p;
      const m = String(res.error.message || '');
      const col = (m.match(/'([^']+)' column/) || m.match(/column "([^"]+)"/i) || [])[1];
      if(col && Object.prototype.hasOwnProperty.call(p,col)){ delete p[col]; continue; }
      throw res.error;
    }
    throw new Error('Kunne ikke lagre etter tilpasning av kolonner.');
  }
  async function supaUpdateAdaptive(tabell, id, payload){
    let p = {...payload};
    for(let i=0;i<10;i++){
      const res = await window.supabaseClient.from(tabell).update(p).eq('id', id).select('*').maybeSingle();
      if(!res.error) return res.data || p;
      const m = String(res.error.message || '');
      const col = (m.match(/'([^']+)' column/) || m.match(/column "([^"]+)"/i) || [])[1];
      if(col && Object.prototype.hasOwnProperty.call(p,col)){ delete p[col]; continue; }
      throw res.error;
    }
    throw new Error('Kunne ikke oppdatere etter tilpasning av kolonner.');
  }


  async function handSendAuthEpostHvisMulig(epost, redirectTo){
    try {
      if (!window.supabaseClient || !window.supabaseClient.auth || !epost) return false;
      const { error } = await window.supabaseClient.auth.resetPasswordForEmail(epost, { redirectTo: redirectTo });
      if (error) {
        console.warn('Kunne ikke sende Auth reset/invite e-post fra klient:', error);
        return false;
      }
      return true;
    } catch(e) {
      console.warn('Auth e-post fra klient feilet:', e);
      return false;
    }
  }

  async function kallOpprettHandKunde(payload){
    try{
      const {data,error} = await window.supabaseClient.functions.invoke('opprett-hand-kunde', {body: payload});
      if(error) throw error;
      if(data && data.error) throw new Error(data.error);
      return data || {};
    }catch(e){
      console.warn('Edge Function opprett-hand-kunde finnes ikke eller feilet, bruker direkte firma-insert:', e);
      return null;
    }
  }

  window.handOpprettKundeDirekte = async function(){
    if (window.handOppretterKunde) {
      msg('Opprettelse pågår allerede. Vent litt.', true);
      return;
    }
    window.handOppretterKunde = true;

    try {
      if(!(await erSystemadmin())){ msg('Bare systemadmin kan opprette kunder.', true); return; }

      const navn = val('nyHandKundeNavn');
      const epost = val('nyHandKundeEpost').toLowerCase();
      const slug = slugify(val('nyHandKundeLinknavn') || navn);
      const passord = val('nyHandKundePassord');

      if(!navn){ msg('Skriv firmanavn.', true); return; }
      if(!epost){ msg('Skriv e-post.', true); return; }

      set('nyHandKundeLinknavn', slug);
      set('nyHandKundeLink', link(slug));

      msg('Sjekker om kunden finnes fra før...');

      const { data: finnes, error: finnesError } = await window.supabaseClient
        .from('hand_firma')
        .select('id, navn, epost')
        .eq('epost', epost)
        .limit(1);

      if (finnesError) throw finnesError;

      if (finnes && finnes.length) {
        msg('Firma med denne e-posten finnes allerede. Kunden ble ikke opprettet på nytt.', true);
        await window.handLastKundeliste();
        return;
      }

      msg('Oppretter håndverkerkunde...');

      const payload = {
        navn,
        firmanavn: navn,
        epost,
        email: epost,
        guiOpprettetUtenAuthKrav: true,
        telefon: val('nyHandKundeTelefon'),
        adresse: val('nyHandKundeAdresse'),
        orgnr: val('nyHandKundeOrgNr'),
        org_nr: val('nyHandKundeOrgNr'),
        linknavn: slug,
        rolle: 'admin',
        er_admin: true,
        aktiv: true,
        passord,
        redirectTo: rootBase() + 'reset.html'
      };

      // GUI er fasit: opprett alltid firma/kunde i hand_firma uten krav om Supabase Auth.
      // Edge Function/Auth forsøkes bare som bonus hvis den finnes.
      let viaFn = null;
      try {
        viaFn = await kallOpprettHandKunde(payload);
      } catch (e) {
        console.warn('Auth/Edge Function hoppes over. GUI-oppretting fortsetter:', e);
        viaFn = null;
      }

      const { data: finnesEtterFn, error: finnesEtterFnError } = await window.supabaseClient
        .from('hand_firma')
        .select('id, navn, epost')
        .eq('epost', epost)
        .limit(1);

      if (finnesEtterFnError) throw finnesEtterFnError;

      let firmaRad = finnesEtterFn && finnesEtterFn.length ? finnesEtterFn[0] : null;

      if (!firmaRad) {
        firmaRad = await supaInsertAdaptive('hand_firma', payload);
      }

      msg(viaFn
        ? 'Kunde/firma er opprettet i GUI. Auth-bruker er opprettet og e-post er sendt.'
        : 'Firma/kunde er opprettet i GUI. Bekreftelses-/passordepost er forsøkt sendt fra Auth.'
      );

      await window.handLastKundeliste();
    } catch(e) {
      console.error(e);
      msg('Feil: ' + (e.message || e), true);
    } finally {
      window.handOppretterKunde = false;
    }
  };

  window.handLastKundeliste = async function(){
    const liste = $('handKundeAdminListe'); if(!liste || !window.supabaseClient) return;
    try{
      liste.innerHTML = '<div class="info">Henter kunder...</div>';
      const {data,error} = await window.supabaseClient.from('hand_firma').select('*').order('navn', {ascending:true});
      if(error) throw error;
      window.handAdminKunder = data || [];
      if(!window.handAdminKunder.length){ liste.innerHTML = '<div class="info">Ingen håndverkerkunder funnet.</div>'; return; }
      liste.innerHTML = '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Firma</th><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">E-post</th><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Link</th><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Handling</th></tr></thead><tbody>' +
        window.handAdminKunder.map(k => { const slug = k.linknavn || slugify(k.navn || k.firmanavn || k.epost || k.id); const lnk = link(slug); return '<tr><td style="padding:6px;border-bottom:1px solid #374151">'+esc(k.navn||k.firmanavn||'')+'</td><td style="padding:6px;border-bottom:1px solid #374151">'+esc(k.epost||k.email||'')+'</td><td style="padding:6px;border-bottom:1px solid #374151"><a href="'+esc(lnk)+'" target="_blank" style="color:#93c5fd">'+esc(slug)+'</a></td><td style="padding:6px;border-bottom:1px solid #374151;white-space:nowrap"><button type="button" class="secondary" onclick="handRedigerKunde(\''+esc(k.id)+'\')">Rediger</button> <button type="button" class="secondary" onclick="handKopierTekst(\''+esc(lnk)+'\')">Kopier link</button></td></tr>'; }).join('') + '</tbody></table></div>';
    }catch(e){ console.error(e); liste.innerHTML = '<div class="melding">Kunne ikke hente kunder: '+esc(e.message||e)+'</div>'; }
  };

  window.handRedigerKunde = function(id){
    const k = (window.handAdminKunder || []).find(x => String(x.id) === String(id));
    if(!k){ msg('Fant ikke kunden.', true); return; }
    set('redigerHandKundeId', k.id || ''); set('nyHandKundeNavn', k.navn || k.firmanavn || ''); set('nyHandKundeEpost', k.epost || k.email || ''); set('nyHandKundeTelefon', k.telefon || ''); set('nyHandKundeAdresse', k.adresse || ''); set('nyHandKundeOrgNr', k.orgnr || k.org_nr || ''); set('nyHandKundeLinknavn', k.linknavn || slugify(k.navn || k.firmanavn || '')); set('nyHandKundePassord',''); set('nyHandKundeLink', link(val('nyHandKundeLinknavn'))); msg('Redigerer: ' + (k.navn || k.firmanavn || k.epost || k.id)); $('nyHandKundeNavn')?.scrollIntoView({behavior:'smooth', block:'center'});
  };
  window.handLagreRedigertKunde = async function(){
    if(!(await erSystemadmin())){ msg('Bare systemadmin kan lagre her.', true); return; }
    const id = val('redigerHandKundeId'); if(!id){ msg('Velg en kunde fra listen først.', true); return; }
    const navn = val('nyHandKundeNavn'); const epost = val('nyHandKundeEpost').toLowerCase(); const slug = slugify(val('nyHandKundeLinknavn') || navn);
    try{ msg('Lagrer endringer...'); await supaUpdateAdaptive('hand_firma', id, {navn, firmanavn:navn, epost, email:epost, telefon:val('nyHandKundeTelefon'), adresse:val('nyHandKundeAdresse'), orgnr:val('nyHandKundeOrgNr'), org_nr:val('nyHandKundeOrgNr'), linknavn:slug}); set('nyHandKundeLinknavn', slug); set('nyHandKundeLink', link(slug)); msg('Kunde oppdatert.'); await window.handLastKundeliste(); }catch(e){ console.error(e); msg('Feil: '+(e.message||e), true); }
  };
  window.handNullstillKundeSkjema = function(){ ['redigerHandKundeId','nyHandKundeNavn','nyHandKundeEpost','nyHandKundeTelefon','nyHandKundeAdresse','nyHandKundeOrgNr','nyHandKundeLinknavn','nyHandKundePassord','nyHandKundeLink'].forEach(id=>set(id,'')); msg('Klar for ny kunde.'); };
  window.handSendPassordopprettingDirekte = async function(){ const epost = val('nyHandKundeEpost').toLowerCase(); if(!epost){ msg('Skriv e-post først.', true); return; } try{ const {error}=await window.supabaseClient.auth.resetPasswordForEmail(epost,{redirectTo: rootBase()+'reset.html'}); if(error) throw error; msg('Passordoppretting sendt.'); }catch(e){ msg('Feil: '+(e.message||e), true); } };
  window.handKopierTekst = async function(t){ try{ await navigator.clipboard.writeText(t||''); msg('Kopiert.'); }catch(e){ msg('Kopier manuelt: '+t); } };
  window.handKopierKundelinkDirekte = function(){ window.handKopierTekst(val('nyHandKundeLink')); };

  function bindLinkFelter(){
    const navn=$('nyHandKundeNavn'), slug=$('nyHandKundeLinknavn');
    function upd(){ const s=slugify(val('nyHandKundeLinknavn') || val('nyHandKundeNavn')); if(s){ set('nyHandKundeLinknavn', s); set('nyHandKundeLink', link(s)); } }
    if(navn && navn.dataset.handBind!=='1'){ navn.dataset.handBind='1'; navn.addEventListener('input', function(){ if(!val('nyHandKundeLinknavn')) upd(); }); }
    if(slug && slug.dataset.handBind!=='1'){ slug.dataset.handBind='1'; slug.addEventListener('input', upd); }
  }


  function visHandKundeAdminSide(){
    try {
      if (typeof window.skjulAlleSider === 'function') window.skjulAlleSider();
      if (typeof window.visFirmaSide === 'function') window.visFirmaSide();
      else { const s = $('firmaSide'); if (s) s.classList.remove('skjult'); }
      const blokk = $('handSystemadminBlokk');
      if (blokk) { blokk.classList.remove('skjult'); blokk.style.display = ''; setTimeout(function(){ blokk.scrollIntoView({behavior:'smooth', block:'start'}); }, 50); }
    } catch(e) { console.warn(e); }
  }

  function bindSystemadminKnapp(){
    const k = $('visHandKundeAdminKnapp');
    if (k && k.dataset.handAdminBind !== '1') {
      k.dataset.handAdminBind = '1';
      k.onclick = function(ev){ ev.preventDefault(); visHandKundeAdminSide(); return false; };
    }
  }

  window.visHandKundeAdminSide = visHandKundeAdminSide;
  window.handOppdaterSystemadminVisning = oppdaterSystemadminVisning;
  document.addEventListener('DOMContentLoaded', function(){ bindLinkFelter(); bindSystemadminKnapp(); setTimeout(oppdaterSystemadminVisning,300); setTimeout(oppdaterSystemadminVisning,1200); });
  window.addEventListener('load', function(){ bindLinkFelter(); bindSystemadminKnapp(); setTimeout(oppdaterSystemadminVisning,300); setTimeout(oppdaterSystemadminVisning,1200); });
  document.addEventListener('click', function(ev){ if(ev.target && (ev.target.id==='loginKnapp' || ev.target.id==='visFirmaKnapp')) setTimeout(oppdaterSystemadminVisning,800); });
})();
