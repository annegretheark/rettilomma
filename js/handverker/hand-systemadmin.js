
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
  function kundelink(slug){ return link(slug); } // Kundelinken ender med firmanavn/linknavn etter ?firma=

  async function innloggetEmail(){
    try{ const r = await window.supabaseClient?.auth?.getSession(); return (r?.data?.session?.user?.email || window.innloggetEpost || '').toLowerCase(); }catch(e){ return String(window.innloggetEpost || '').toLowerCase(); }
  }
  async function erSystemadmin(){
    if (typeof window.handErSysadm === 'function' && window.handErSysadm()) return true;
    try{ const u = await window.handGetAuthUser?.(); const r = String(u?.user_metadata?.rolle || u?.user_metadata?.role || u?.app_metadata?.rolle || u?.app_metadata?.role || '').toLowerCase(); if(['sysadm','sysadmin','systemadmin'].includes(r)) return true; }catch(e){}
    try{ const {data,error}=await window.supabaseClient.rpc('er_systemadmin'); if(!error && data === true) return true; }catch(e){}
    return window.erSystemadmin === true;
  }

  function visAdminElementer(){
    document.querySelectorAll('.admin-only').forEach(el => {
      var erSide = el.tagName === 'SECTION' || /Side$|Panel$/.test(el.id || '');
      if (!erSide) { el.style.display=''; el.classList.remove('skjult','hidden'); }
    });
    document.querySelectorAll('.sysadmin-entry').forEach(el => {
      var visKnapp = window.erSystemadmin === true && localStorage.getItem('rilSysadminModus') !== 'ja';
      el.style.display = visKnapp ? '' : 'none';
      el.classList.toggle('skjult', !visKnapp);
      el.classList.toggle('hidden', !visKnapp);
    });
    document.querySelectorAll('.systemadmin-only').forEach(el => {
      var erSide = el.tagName === 'SECTION' || /Side$|Panel$/.test(el.id || '');
      var sysAktiv = localStorage.getItem('rilSysadminModus') === 'ja';
      if (!erSide && window.erSystemadmin === true && sysAktiv) { el.style.display=''; el.classList.remove('skjult','hidden'); }
      else if (!erSide) { el.style.display='none'; el.classList.add('skjult','hidden'); }
    });
  }

  async function oppdaterSystemadminVisning(){
    const admin = await erSystemadmin();
    window.erSystemadmin = admin === true;
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
    const panel = $('sysadminPanelSide');
    const panelSynlig = panel && !panel.classList.contains('skjult') && panel.style.display !== 'none';
    if(admin && panelSynlig && typeof window.handLastKundeliste === 'function') { try{ await window.handLastKundeliste(); }catch(e){ console.warn(e); } }
  }

  function fjernIkkeDbFelt(tabell, payload){
    const p = {...payload};
    const alltidFjern = [
      'redirectTo',
      'passord',
      'kunde_link',
      'kundelink',
      'email',
      'firmanavn',
      'guiOpprettetUtenAuthKrav',
      'er_admin',
      'rolle'
    ];

    if(tabell === 'hand_firma'){
      alltidFjern.forEach(k => delete p[k]);
      // hand_firma i din DB bruker orgnr, ikke org_nr
      delete p.org_nr;
      if(!p.linknavn && payload.linknavn) p.linknavn = payload.linknavn;
    }

    if(tabell === 'hand_ansatt'){
      delete p.kundelink;
      delete p.kunde_link;
      delete p.linknavn;
      delete p.orgnr;
      delete p.org_nr;
      delete p.adresse;
      delete p.telefon;
      delete p.firmanavn;
      delete p.guiOpprettetUtenAuthKrav;
      delete p.redirectTo;
      delete p.passord;
    }

    Object.keys(p).forEach(k => {
      if(p[k] === undefined) delete p[k];
    });

    return p;
  }

  function kolonneFraFeil(error){
    const m = String(error?.message || error || '');
    return (
      (m.match(/Could not find the '([^']+)' column/i) || [])[1] ||
      (m.match(/'([^']+)' column/i) || [])[1] ||
      (m.match(/column "([^"]+)"/i) || [])[1] ||
      (m.match(/column ([a-zA-Z0-9_]+) of relation/i) || [])[1] ||
      ''
    );
  }

  async function supaInsertAdaptive(tabell, payload){
    let p = fjernIkkeDbFelt(tabell, payload);
    let forrige = '';

    for(let i=0;i<20;i++){
      const res = await window.supabaseClient.from(tabell).insert([p]).select('*').maybeSingle();
      if(!res.error) return res.data || p;

      const col = kolonneFraFeil(res.error);
      if(col && Object.prototype.hasOwnProperty.call(p,col)){
        delete p[col];
        continue;
      }

      const tekst = String(res.error.message || '');
      if(tekst === forrige) throw res.error;
      forrige = tekst;
      throw res.error;
    }

    throw new Error('Kunne ikke lagre. Databasen avviste feltene: ' + Object.keys(p).join(', '));
  }

  async function supaUpdateAdaptive(tabell, id, payload){
    let p = fjernIkkeDbFelt(tabell, payload);
    let forrige = '';

    for(let i=0;i<20;i++){
      const res = await window.supabaseClient.from(tabell).update(p).eq('id', id).select('*').maybeSingle();
      if(!res.error) return res.data || p;

      const col = kolonneFraFeil(res.error);
      if(col && Object.prototype.hasOwnProperty.call(p,col)){
        delete p[col];
        continue;
      }

      const tekst = String(res.error.message || '');
      if(tekst === forrige) throw res.error;
      forrige = tekst;
      throw res.error;
    }

    throw new Error('Kunne ikke oppdatere. Databasen avviste feltene: ' + Object.keys(p).join(', '));
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
      const slug = slugify(navn); // opprettes automatisk fra firmanavn
      const passord = val('nyHandKundePassord');

      if(!navn){ msg('Skriv firmanavn.', true); return; }
      if(!epost){ msg('Skriv e-post.', true); return; }

      set('nyHandKundeLinknavn', slug);
      set('nyHandKundeLink', kundelink(slug));

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
        epost,
        telefon: val('nyHandKundeTelefon') || null,
        adresse: val('nyHandKundeAdresse') || null,
        orgnr: val('nyHandKundeOrgNr') || null,
        linknavn: slug,
        system_type: 'handverker'
      };

      const authPayload = {
        navn,
        firmanavn: navn,
        epost,
        email: epost,
        telefon: val('nyHandKundeTelefon'),
        adresse: val('nyHandKundeAdresse'),
        orgnr: val('nyHandKundeOrgNr'),
        org_nr: val('nyHandKundeOrgNr'),
        linknavn: slug,
        kundelink: kundelink(slug),
        kunde_link: kundelink(slug),
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
        viaFn = await kallOpprettHandKunde(authPayload);
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
        const firmaPayload = {
          navn: navn,
          epost: epost,
          telefon: val('nyHandKundeTelefon') || null,
          adresse: val('nyHandKundeAdresse') || null,
          orgnr: val('nyHandKundeOrgNr') || null,
          linknavn: slug,
          system_type: 'handverker',
          moduler_konfigurert: false,
          moduler: {}
        };

        let firmaRes = await window.supabaseClient
          .from('hand_firma')
          .insert([firmaPayload])
          .select('id, navn, epost')
          .maybeSingle();

        if (firmaRes.error) {
          // fallback hvis noen kolonner mangler
          const minPayload = {
            navn: navn,
            epost: epost,
            linknavn: slug
          };

          firmaRes = await window.supabaseClient
            .from('hand_firma')
            .insert([minPayload])
            .select('id, navn, epost')
            .maybeSingle();
        }

        if (firmaRes.error) {
          throw firmaRes.error;
        }

        firmaRad = firmaRes.data;
      }

      if (firmaRad && firmaRad.id) {
        try {
          const ansattPayload = { firma_id: firmaRad.id, epost: epost, navn: navn, rolle: 'admin', er_admin: true, aktiv: true };
          const finnesAnsatt = await window.supabaseClient.from('hand_ansatt').select('id').eq('epost', epost).limit(1);

          let ansattRes;
          if (!finnesAnsatt.error && Array.isArray(finnesAnsatt.data) && finnesAnsatt.data.length) {
            ansattRes = await window.supabaseClient
              .from('hand_ansatt')
              .update(ansattPayload)
              .eq('id', finnesAnsatt.data[0].id);
          } else {
            ansattRes = await window.supabaseClient
              .from('hand_ansatt')
              .insert([ansattPayload]);
          }

          if (ansattRes && ansattRes.error) {
            const minAnsatt = { firma_id: firmaRad.id, epost: epost, navn: navn, rolle: 'admin' };
            if (!finnesAnsatt.error && Array.isArray(finnesAnsatt.data) && finnesAnsatt.data.length) {
              await window.supabaseClient.from('hand_ansatt').update(minAnsatt).eq('id', finnesAnsatt.data[0].id);
            } else {
              await window.supabaseClient.from('hand_ansatt').insert([minAnsatt]);
            }
          }
        } catch(e) { console.warn('Kunne ikke opprette admin i hand_ansatt:', e); }
      }

      msg(viaFn
        ? 'Kunde/firma er opprettet i GUI. Auth-bruker er opprettet og e-post er sendt.'
        : 'Firma/kunde er opprettet, og adminrad er lagt i hand_ansatt. Hvis kunden fortsatt ikke får logget inn, mangler Auth-brukeren. Da må Edge Function opprett-hand-kunde eller Supabase invite være aktiv.'
      );

      await window.handLastKundeliste();
    } catch(e) {
      console.error(e);
      msg('Feil: ' + (e.message || e), true);
    } finally {
      window.handOppretterKunde = false;
    }
  };

  async function hentAlleFirmaAdaptive(){
    const forsok = [
      ['hand_firma','*','navn'], ['hand_firma','*','firmanavn'], ['hand_firma','*',null],
      ['hand_kunder','*','navn'], ['hand_kunder','*','firmanavn'], ['hand_kunder','*',null]
    ];
    for (const f of forsok) {
      try {
        let q = window.supabaseClient.from(f[0]).select(f[1]);
        if (f[2]) q = q.order(f[2], {ascending:true});
        const r = await q;
        if (!r.error && Array.isArray(r.data)) return r.data;
      } catch(e) {}
    }
    return [];
  }

  window.handLastKundeliste = async function(){
    const liste = $('handKundeAdminListe'); if(!liste || !window.supabaseClient) return;
    try{
      liste.innerHTML = '<div class="info">Henter kunder...</div>';
      window.handAdminKunder = await hentAlleFirmaAdaptive();
      if(!window.handAdminKunder.length){ liste.innerHTML = '<div class="info">Ingen håndverkerkunder funnet. Hvis du vet at det finnes firma, sjekk RLS/select-rettighet på hand_firma for sysadmin.</div>'; return; }
      liste.innerHTML = '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Firma</th><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">E-post</th><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Link</th><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Handling</th></tr></thead><tbody>' +
        window.handAdminKunder.map(k => { const slug = k.linknavn || slugify(k.navn || k.firmanavn || k.epost || k.id); const lnk = kundelink(slug); return '<tr><td style="padding:6px;border-bottom:1px solid #374151">'+esc(k.navn||k.firmanavn||'')+'</td><td style="padding:6px;border-bottom:1px solid #374151">'+esc(k.epost||k.email||'')+'</td><td style="padding:6px;border-bottom:1px solid #374151"><a href="'+esc(lnk)+'" target="_blank" style="color:#93c5fd">'+esc(slug)+'</a></td><td style="padding:6px;border-bottom:1px solid #374151;white-space:nowrap"><button type="button" class="secondary" onclick="handRedigerKunde(\''+esc(k.id)+'\')">Rediger</button> <button type="button" class="secondary" onclick="handKopierTekst(\''+esc(lnk)+'\')">Kopier link</button></td></tr>'; }).join('') + '</tbody></table></div>';
    }catch(e){ console.error(e); liste.innerHTML = '<div class="melding">Kunne ikke hente kunder: '+esc(e.message||e)+'</div>'; }
  };

  window.handRedigerKunde = function(id){
    const k = (window.handAdminKunder || []).find(x => String(x.id) === String(id));
    if(!k){ msg('Fant ikke kunden.', true); return; }
    set('redigerHandKundeId', k.id || ''); set('nyHandKundeNavn', k.navn || k.firmanavn || ''); set('nyHandKundeEpost', k.epost || k.email || ''); set('nyHandKundeTelefon', k.telefon || ''); set('nyHandKundeAdresse', k.adresse || ''); set('nyHandKundeOrgNr', k.orgnr || k.org_nr || ''); set('nyHandKundeLinknavn', k.linknavn || slugify(k.navn || k.firmanavn || '')); set('nyHandKundePassord',''); set('nyHandKundeLink', kundelink(val('nyHandKundeLinknavn'))); msg('Redigerer: ' + (k.navn || k.firmanavn || k.epost || k.id)); $('nyHandKundeNavn')?.scrollIntoView({behavior:'smooth', block:'center'});
  };
  window.handLagreRedigertKunde = async function(){
    if(!(await erSystemadmin())){ msg('Bare systemadmin kan lagre her.', true); return; }
    const id = val('redigerHandKundeId'); if(!id){ msg('Velg en kunde fra listen først.', true); return; }
    const navn = val('nyHandKundeNavn'); const epost = val('nyHandKundeEpost').toLowerCase(); const slug = slugify(navn); // opprettes automatisk fra firmanavn
    try{ msg('Lagrer endringer...'); await supaUpdateAdaptive('hand_firma', id, {navn, firmanavn:navn, epost, email:epost, telefon:val('nyHandKundeTelefon'), adresse:val('nyHandKundeAdresse'), orgnr:val('nyHandKundeOrgNr'), org_nr:val('nyHandKundeOrgNr'), linknavn:slug, kundelink:kundelink(slug), kunde_link:kundelink(slug)}); set('nyHandKundeLinknavn', slug); set('nyHandKundeLink', kundelink(slug)); msg('Kunde oppdatert.'); await window.handLastKundeliste(); }catch(e){ console.error(e); msg('Feil: '+(e.message||e), true); }
  };
  window.handNullstillKundeSkjema = function(){ ['redigerHandKundeId','nyHandKundeNavn','nyHandKundeEpost','nyHandKundeTelefon','nyHandKundeAdresse','nyHandKundeOrgNr','nyHandKundeLinknavn','nyHandKundePassord','nyHandKundeLink'].forEach(id=>set(id,'')); msg('Klar for ny kunde.'); };
  window.handSendPassordopprettingDirekte = async function(){ const epost = val('nyHandKundeEpost').toLowerCase(); if(!epost){ msg('Skriv e-post først.', true); return; } try{ const {error}=await window.supabaseClient.auth.resetPasswordForEmail(epost,{redirectTo: rootBase()+'reset.html'}); if(error) throw error; msg('Passordoppretting sendt.'); }catch(e){ msg('Feil: '+(e.message||e), true); } };
  window.handKopierTekst = async function(t){ try{ await navigator.clipboard.writeText(t||''); msg('Kopiert.'); }catch(e){ msg('Kopier manuelt: '+t); } };
  window.handKopierKundelinkDirekte = function(){ window.handKopierTekst(val('nyHandKundeLink')); };

  function bindLinkFelter(){
    const navn=$('nyHandKundeNavn'), slug=$('nyHandKundeLinknavn');
    function upd(){ const s=slugify(val('nyHandKundeNavn')); if(s){ set('nyHandKundeLinknavn', s); set('nyHandKundeLink', kundelink(s)); } }
    if(navn && navn.dataset.handBind!=='1'){ navn.dataset.handBind='1'; navn.addEventListener('input', upd); }
    if(slug){ slug.readOnly = true; slug.title = 'Opprettes automatisk fra firmanavn'; }
  }


  function visHandKundeAdminSide(){
    try {
      if (typeof window.handVisSysadminPanel === 'function') {
        window.handVisSysadminPanel();
        return;
      }
      if (typeof window.skjulAlleSider === 'function') window.skjulAlleSider();
      localStorage.setItem('rilSysadminModus', 'ja');
      const panel = $('sysadminPanelSide');
      if (panel) { panel.classList.remove('skjult','hidden'); panel.style.display = ''; }
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

/*
  Robust SysAdm kundeoppretting - lagt til av ChatGPT 2026-06-21
  Gjør opprett håndverkerkunde mer tolerant for ulike Supabase-skjema:
  - prøver hand_firma, hand_kunder og hand_kunde
  - prøver både navn/firmanavn/firma_navn og epost/email
  - fjerner automatisk kolonner som databasen ikke har
  - viser feilen direkte i appen, ikke bare i konsoll
*/
(function(){
  function $(id){ return document.getElementById(id); }
  function val(id){ return ($(id)?.value || '').trim(); }
  function set(id,v){ const e=$(id); if(e) e.value = v || ''; }
  function msg(t, feil){ const e=$('nyHandKundeMelding') || $('firmaMelding'); if(e){ e.textContent=t||''; e.style.color=feil?'#fca5a5':'#86efac'; } else if(feil) { alert(t); } }
  function slugify(v){ return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function appBase(){ const p=location.pathname.toLowerCase(); if(p.includes('/rettilomma/')) return location.origin + '/rettilomma/handverker/'; if(p.includes('/handverker/')) return location.origin + '/handverker/'; return location.origin + '/handverker/'; }
  function rootBase(){ return location.pathname.toLowerCase().includes('/rettilomma/') ? location.origin + '/rettilomma/' : location.origin + '/'; }
  function kundelink(slug){ return appBase() + '?firma=' + encodeURIComponent(slug||''); }
  async function innloggetEmail(){ try{ const r = await window.supabaseClient?.auth?.getSession(); return String(r?.data?.session?.user?.email || window.innloggetEpost || localStorage.getItem('handInnloggetEpost') || '').trim().toLowerCase(); }catch(e){ return String(window.innloggetEpost || localStorage.getItem('handInnloggetEpost') || '').trim().toLowerCase(); } }
  async function erSystemadmin(){ if (typeof window.handErSysadm === 'function' && window.handErSysadm()) return true; try{ const u = await window.handGetAuthUser?.(); const rr = String(u?.user_metadata?.rolle || u?.user_metadata?.role || u?.app_metadata?.rolle || u?.app_metadata?.role || '').toLowerCase(); if(['sysadm','sysadmin','systemadmin'].includes(rr)) return true; }catch(e){} if(window.erSystemadmin === true) return true; try{ const r = await window.supabaseClient.rpc('er_systemadmin'); return r && !r.error && r.data === true; }catch(err){ return false; } }
  function missingColumn(error){ const m = String(error?.message || error || ''); return ((m.match(/Could not find the '([^']+)' column/i)||[])[1] || (m.match(/'([^']+)' column/i)||[])[1] || (m.match(/column "([^"]+)"/i)||[])[1] || (m.match(/column ([a-zA-Z0-9_]+) of relation/i)||[])[1] || ''); }
  function cleanPayload(p){ const out = {}; Object.keys(p || {}).forEach(k => { if(p[k] !== undefined && p[k] !== '') out[k] = p[k]; }); return out; }

  async function adaptiveInsert(table, payload){
    let p = cleanPayload(payload);
    let lastError = null;
    for(let i=0;i<30;i++){
      const r = await window.supabaseClient.from(table).insert([p]).select('*').maybeSingle();
      if(!r.error) return { data: r.data || p, table };
      lastError = r.error;
      const col = missingColumn(r.error);
      if(col && Object.prototype.hasOwnProperty.call(p, col)) { delete p[col]; continue; }
      throw r.error;
    }
    throw lastError || new Error('Ukjent lagringsfeil');
  }

  async function findExisting(tables, epost){
    for(const table of tables){
      for(const field of ['epost','email']){
        try{
          const r = await window.supabaseClient.from(table).select('*').eq(field, epost).limit(1);
          if(!r.error && Array.isArray(r.data) && r.data.length) return { data: r.data[0], table };
        }catch(e){}
      }
    }
    return null;
  }

  async function createFirmaRobust(navn, epost, slug){
    const telefon = val('nyHandKundeTelefon') || null;
    const adresse = val('nyHandKundeAdresse') || null;
    const org = val('nyHandKundeOrgNr') || null;
    const link = kundelink(slug);
    const tables = ['hand_firma','hand_kunder','hand_kunde'];
    const payloads = [
      { navn, epost, telefon, adresse, orgnr: org, linknavn: slug, kundelink: link, kunde_link: link, system_type:'handverker', moduler_konfigurert:false, moduler:{} },
      { firmanavn: navn, email: epost, telefon, adresse, org_nr: org, slug, kundelink: link, kunde_link: link, system_type:'handverker' },
      { firma_navn: navn, email: epost, org_nr: org, slug, linknavn: slug, system_type:'handverker' },
      { navn, epost, linknavn: slug },
      { firmanavn: navn, email: epost, slug },
      { navn, epost }
    ];
    let lastError = null;
    for(const table of tables){
      for(const p of payloads){
        try{ return await adaptiveInsert(table, p); }
        catch(e){ lastError = e; }
      }
    }
    throw lastError || new Error('Fant ingen tabell appen kan lagre kunde i.');
  }

  async function upsertAnsattRobust(firmaRad, table, navn, epost){
    const firmaId = firmaRad?.id || firmaRad?.firma_id || firmaRad?.kunde_id || null;
    const payloads = [
      { firma_id: firmaId, epost, navn, rolle:'admin', er_admin:true, aktiv:true },
      { firma_id: firmaId, email: epost, navn, rolle:'admin', er_admin:true, aktiv:true },
      { kunde_id: firmaId, epost, navn, rolle:'admin', aktiv:true },
      { epost, navn, rolle:'admin' },
      { email: epost, navn, rolle:'admin' }
    ];
    for(const p of payloads){
      try{
        const existing = await window.supabaseClient.from('hand_ansatt').select('*').eq(p.epost ? 'epost' : 'email', epost).limit(1);
        if(!existing.error && existing.data && existing.data.length){
          const upd = await window.supabaseClient.from('hand_ansatt').update(cleanPayload(p)).eq('id', existing.data[0].id).select('*').maybeSingle();
          if(!upd.error) return true;
        } else {
          await adaptiveInsert('hand_ansatt', p);
          return true;
        }
      }catch(e){}
    }
    return false;
  }

  async function sendPassordEpost(epost){
    try{
      const r = await window.supabaseClient.auth.resetPasswordForEmail(epost, { redirectTo: rootBase() + 'reset.html' });
      return !r.error;
    }catch(e){ return false; }
  }

  window.handOpprettKundeDirekte = async function(){
    if(window.handOppretterKunde){ msg('Opprettelse pågår allerede. Vent litt.', true); return; }
    window.handOppretterKunde = true;
    try{
      if(!window.supabaseClient){ msg('Supabase er ikke lastet. Last siden på nytt.', true); return; }
      if(!(await erSystemadmin())){ msg('Bare systemadmin kan opprette kunder.', true); return; }
      const navn = val('nyHandKundeNavn');
      const epost = val('nyHandKundeEpost').toLowerCase();
      if(!navn){ msg('Skriv firmanavn.', true); return; }
      if(!epost){ msg('Skriv e-post.', true); return; }
      const slug = slugify(navn);
      set('nyHandKundeLinknavn', slug);
      set('nyHandKundeLink', kundelink(slug));

      msg('Sjekker om kunden finnes fra før...');
      const tables = ['hand_firma','hand_kunder','hand_kunde'];
      const eksisterende = await findExisting(tables, epost);
      let firma = eksisterende;
      if(!firma){
        msg('Oppretter håndverkerkunde...');
        firma = await createFirmaRobust(navn, epost, slug);
      }
      const ansattOk = await upsertAnsattRobust(firma.data, firma.table, navn, epost);
      const epostOk = await sendPassordEpost(epost);
      msg((eksisterende ? 'Kunden fantes fra før. ' : 'Kunde/firma er opprettet. ') + (ansattOk ? 'Adminbruker er lagret. ' : 'Adminbruker kunne ikke lagres automatisk. ') + (epostOk ? 'Passord-e-post er sendt.' : 'Send passordoppretting-knappen kan brukes etterpå.'));
      if(typeof window.handLastKundeliste === 'function') await window.handLastKundeliste();
    }catch(e){
      console.error(e);
      const tekst = String(e?.message || e || 'Ukjent feil');
      msg('Feil ved oppretting: ' + tekst, true);
    }finally{
      window.handOppretterKunde = false;
    }
  };
})();
