(function(){
  'use strict';
  const $ = (id) => document.getElementById(id);
  const app = { sb:null, session:null, user:null, profile:null, role:'hovslager', isSysadm:false, firma:null, firmaId:null, voiceRecognition:null, voiceActive:false, voiceStopping:false, voiceProcessing:false, edit:{kunde:null,hest:null,jobb:null,pris:null}, data:{kunder:[],hester:[],jobber:[],fakturaer:[],kreditnotaer:[],priser:[],adminFirmaer:[],adminProfiler:[],backupLogg:[],hestBilder:[],jobbBilder:[]} };
  window.hovApp = app;
  window.hovAppReadLastJobb = function(){ readLastJobbAsNew(); };
  window.hovAppStartVoiceJobb = function(){ startVoiceJobb(); };
  window.hovAppStopVoiceJobb = function(){ stopVoiceJobb(false); };
  window.hovAppUseVoiceTextJobb = function(){ applyVoiceTextAsJobb({autoSave:false}); };

  function msg(id, text, type){ const el=$(id); if(!el) return; el.innerHTML = text ? `<div class="msg ${type||''}">${esc(text)}</div>` : ''; }
  function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function kr(v){ const n=Number(v||0); return n.toLocaleString('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function today(){ return new Date().toISOString().slice(0,10); }
  function fmtDateTime(v){
    if(!v) return '';
    const d = new Date(v);
    if(Number.isNaN(d.getTime())) return String(v || '').replace('T',' ').slice(0,19);
    return d.toLocaleString('nb-NO', {
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
      hour:'2-digit',
      minute:'2-digit',
      second:'2-digit'
    }).replace(',', '');
  }
  function val(id){ return ($(id)?.value ?? '').trim(); }
  function num(id){ const n=Number(String($(id)?.value ?? '0').replace(',','.')); return Number.isFinite(n)?n:0; }
  function setVal(id,v){ const el=$(id); if(el) el.value = v ?? ''; }
  function setText(id, text){ const el=$(id); if(el) el.textContent = text; }
  function setChecked(id,v){ const el=$(id); if(el) el.checked = !!v; }
  function selectedRowClass(type,id){ return app.edit[type] && String(app.edit[type])===String(id) ? ' selected-row' : ''; }
  function bindClickableRows(containerId, type, handler){ const el=$(containerId); if(!el) return; el.querySelectorAll('tr.click-row[data-id]').forEach(row=>row.addEventListener('click',()=>handler(row.dataset.id))); }
  function showLogin(show){ $('loginCard')?.classList.toggle('hidden', !show); $('appCard')?.classList.toggle('hidden', show); }
  function safeName(name){ return String(name||'logo').toLowerCase().replace(/[^a-z0-9_.-]+/g,'-').replace(/-+/g,'-').slice(0,80); }
  const PRIVATE_IMAGE_BUCKET = 'hovslager-bilder';
  const SIGNED_IMAGE_SECONDS = 60 * 60;
  function imgUrl(row){ return row?._signed_bilde_url || row?.bilde_signed_url || row?.bilde_url || row?.image_url || row?.foto_url || row?.photo_url || ''; }
  function storagePathFromPublicUrl(url){
    const text=String(url||'');
    const marker='/storage/v1/object/public/'+PRIVATE_IMAGE_BUCKET+'/';
    const i=text.indexOf(marker);
    if(i<0) return '';
    return decodeURIComponent(text.slice(i+marker.length).split('?')[0]);
  }
  async function signedImageUrl(pathOrUrl){
    const raw=String(pathOrUrl||'').trim();
    if(!raw || !app.sb) return '';
    const path = raw.startsWith('http') ? storagePathFromPublicUrl(raw) : raw;
    if(!path) return raw.startsWith('http') ? raw : '';
    const { data, error } = await app.sb.storage.from(PRIVATE_IMAGE_BUCKET).createSignedUrl(path, SIGNED_IMAGE_SECONDS);
    if(error){ console.warn('Kunne ikke lage signed URL', error); return raw.startsWith('http') ? raw : ''; }
    return data?.signedUrl || '';
  }
  async function loadHestBilder(){
    if(!app.firmaId){ app.data.hestBilder=[]; return; }
    const {data,error}=await app.sb.from('hov_hest_bilder').select('*').eq('firma_id', app.firmaId).order('created_at',{ascending:false});
    if(error){ console.warn('hov_hest_bilder', error); app.data.hestBilder=[]; return; }
    app.data.hestBilder=data||[];
  }
  async function loadJobbBilder(){
    if(!app.firmaId){ app.data.jobbBilder=[]; return; }
    const {data,error}=await app.sb.from('hov_jobb_bilder').select('*').eq('firma_id', app.firmaId).order('created_at',{ascending:false});
    if(error){ console.warn('hov_jobb_bilder', error); app.data.jobbBilder=[]; return; }
    app.data.jobbBilder=data||[];
  }
  async function signHestBilder(){
    await loadHestBilder();
    for(const h of (app.data.hester||[])){
      const mine=(app.data.hestBilder||[]).filter(b=>String(b.hest_id)===String(h.id));
      h._hest_bilder=[];
      for(const b of mine){
        const source=b.path || b.bilde_path || storagePathFromPublicUrl(b.url || b.bilde_url) || b.url || b.bilde_url || '';
        const signed=source ? await signedImageUrl(source) : '';
        h._hest_bilder.push({...b, url:signed || b.url || b.bilde_url || '', path:source});
      }
      const first=h._hest_bilder[0];
      const fallback=h.bilde_path || storagePathFromPublicUrl(h.bilde_url) || h.bilde_url || h.image_url || h.foto_url || h.photo_url || '';
      h._signed_bilde_url = first?.url || (fallback ? await signedImageUrl(fallback) : '');
    }
  }
  async function signJobbBilder(){
    await loadJobbBilder();
    for(const j of (app.data.jobber||[])){
      const mine=(app.data.jobbBilder||[]).filter(b=>String(b.jobb_id)===String(j.id));
      const bilder=mine.length ? mine.map(b=>({
        url:b.url || b.bilde_url || '',
        path:b.path || b.bilde_path || storagePathFromPublicUrl(b.url || b.bilde_url) || null,
        dato:b.dato || b.bilde_dato || b.created_at || j.dato,
        tekst:b.tekst || b.note || b.beskrivelse || ''
      })) : jobBilder(j, {preferStored:true});
      j._signed_bilder=[];
      for(const b of bilder){
        const source=b.path || storagePathFromPublicUrl(b.url) || b.url || '';
        const signed=source ? await signedImageUrl(source) : '';
        j._signed_bilder.push({...b, url:signed || b.url, original_url:b.url || '', path:b.path || storagePathFromPublicUrl(b.url) || null});
      }
    }
  }
  function jobBildeDato(item, fallback){
    const d = item?.dato || item?.date || item?.created_at || item?.createdAt || fallback || '';
    return String(d || '').slice(0,10);
  }
  function jobBilder(row, opts){
    if(!opts?.preferStored && Array.isArray(row?._signed_bilder)) return row._signed_bilder;
    const raw = row?.bilder || row?.bilde_urls || row?.image_urls || row?.photos || row?.bilder_url || [];
    let arr = [];
    if(Array.isArray(raw)) arr = raw;
    else if(typeof raw === 'string' && raw.trim()){
      try{ const parsed=JSON.parse(raw); arr = Array.isArray(parsed) ? parsed : [raw]; }
      catch(_){ arr = [raw]; }
    }
    return arr.map(x=>{
      if(typeof x === 'string') return { url:x, dato: jobBildeDato(null, row?.dato), path:storagePathFromPublicUrl(x) || null };
      return { url:x?.url || x?.bilde_url || x?.image_url || x?.src || '', path:x?.path || x?.bilde_path || storagePathFromPublicUrl(x?.url || x?.bilde_url || x?.image_url || x?.src) || null, dato: jobBildeDato(x, row?.dato), tekst:x?.tekst || x?.note || '' };
    }).filter(x=>x.url || x.path).sort((a,b)=>String(a.dato||'').localeCompare(String(b.dato||'')));
  }
  function renderImagePreview(id, url){ const el=$(id); if(!el) return; if(url){ el.innerHTML=`<img class="thumb" src="${esc(url)}" alt="Bilde">`; } else el.innerHTML='<span class="muted">Ingen bilde valgt.</span>'; }
  function renderJobbBildePreview(items){
    const el=$('jobbBildePreview'); if(!el) return;
    const bilder=(items||[]).map(x=>typeof x === 'string' ? {url:x,dato:val('jobbBildeDato')||val('jobbDato')||today()} : x).filter(x=>x && x.url);
    el.innerHTML = bilder.length ? bilder.map(x=>`<figure class="timeline-photo"><img class="thumb" src="${esc(x.url)}" alt="Jobb-bilde"><figcaption>${esc(jobBildeDato(x, val('jobbDato')||today()) || 'Uten dato')}</figcaption></figure>`).join('') : '<span class="muted">Ingen bilder valgt.</span>';
  }
  function previewSelectedHestBilde(){ const file=$('hestBildeFile')?.files?.[0]; renderImagePreview('hestBildePreview', file ? URL.createObjectURL(file) : ''); }
  function previewSelectedJobbBilder(){
    const files=Array.from($('jobbBildeFiles')?.files || []);
    const dato=val('jobbBildeDato') || val('jobbDato') || today();
    renderJobbBildePreview(files.map(f=>({url:URL.createObjectURL(f), dato})));
  }
  async function uploadAppFile(file, folder){
    if(!file) return null;
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
    const path=`${app.firmaId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName(file.name||('bilde.'+ext))}`;
    const up=await app.sb.storage.from(PRIVATE_IMAGE_BUCKET).upload(path,file,{upsert:true,contentType:file.type||'image/jpeg'});
    if(up.error) throw new Error('Bilde kunne ikke lastes opp: '+up.error.message+' (Sjekk at storage bucket '+PRIVATE_IMAGE_BUCKET+' finnes, er privat, og har policy for innlogget opplasting.)');
    const url=await signedImageUrl(path);
    return {url,path};
  }

  async function init(){
    app.sb = window.supabaseClient;
    if(!app.sb){ alert('Mangler Supabase-klient. Sjekk js/hovslager/config.js'); return; }
    bind();
    $('jobbDato') && ($('jobbDato').value = today());
    setVal('jobbKmPris','5,30');
    setVal('jobbVarer','');
    setVal('jobbKm','');
    setVal('jobbBildeDato', today());
    const { data } = await app.sb.auth.getSession();
    app.session = data.session;
    app.user = data.session?.user || null;
    if(app.user) await startApp(); else showLogin(true);
  }

  function bind(){
    $('loginBtn')?.addEventListener('click', login);
    $('resetBtn')?.addEventListener('click', resetPassword);
    $('logoutBtn')?.addEventListener('click', logout);
    $('refreshBtn')?.addEventListener('click', loadAll);
    $('readLastJobbBtn')?.addEventListener('click', readLastJobbAsNew);
    $('voiceNewJobbBtn')?.addEventListener('click', startVoiceJobb);
    $('voiceStopJobbBtn')?.addEventListener('click', stopVoiceJobb);
    $('voiceUseTextJobbBtn')?.addEventListener('click', ()=>applyVoiceTextAsJobb({autoSave:false}));
    $('newJobbFromDashBtn')?.addEventListener('click', openBlankJobbFromDashboard);
    document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
    $('saveFirmaBtn')?.addEventListener('click', saveFirma);
    $('uploadLogoBtn')?.addEventListener('click', uploadLogo);
    $('deleteLogoBtn')?.addEventListener('click', deleteLogo);
    $('saveKundeBtn')?.addEventListener('click', saveKunde);
    $('newKundeBtn')?.addEventListener('click', clearKundeForm);
    $('deleteKundeBtn')?.addEventListener('click', deleteKunde);
    $('saveHestBtn')?.addEventListener('click', saveHest);
    $('newHestBtn')?.addEventListener('click', clearHestForm);
    $('deleteHestBtn')?.addEventListener('click', deleteHest);
    $('saveJobbBtn')?.addEventListener('click', saveJobb);
    $('newJobbBtn')?.addEventListener('click', clearJobbForm);
    $('deleteJobbBtn')?.addEventListener('click', deleteJobb);
    $('loadFakturaBtn')?.addEventListener('click', loadFakturaer);
    $('importPrisCsvBtn')?.addEventListener('click', importPriserFraCsv);
    $('savePrisBtn')?.addEventListener('click', savePris);
    $('newPrisBtn')?.addEventListener('click', clearPrisForm);
    $('deletePrisBtn')?.addEventListener('click', deletePris);
    $('reloadPriserBtn')?.addEventListener('click', async ()=>{ await loadPriser(); renderPriser(); msg('prisImportMsg','Prisliste oppdatert.','ok'); });
    $('adminReloadBtn')?.addEventListener('click', loadAdminData);
    $('adminSwitchFirmaBtn')?.addEventListener('click', adminSwitchFirma);
    $('adminCreateFirmaBtn')?.addEventListener('click', adminCreateFirma);
    $('adminClearFirmaBtn')?.addEventListener('click', clearAdminFirmaForm);
    $('adminFirmaLogoFile')?.addEventListener('change', previewAdminFirmaLogo);
    $('adminSaveProfileBtn')?.addEventListener('click', adminSaveProfile);
    $('adminBackupFirmaBtn')?.addEventListener('click', adminRunFirmaBackup);
    $('adminBackupSystemBtn')?.addEventListener('click', adminRunSystemBackup);
    $('adminBackupReloadBtn')?.addEventListener('click', loadBackupLogg);
    $('adminRestoreReloadBtn')?.addEventListener('click', loadBackupLogg);
    $('adminRestoreBackupBtn')?.addEventListener('click', adminRestoreBackup);
    $('appLagFakturaBtn')?.addEventListener('click', lagAppFaktura);
    $('appOppdaterFakturaBtn')?.addEventListener('click', renderAppFakturaer);
    $('appLagreFakturaDesignBtn')?.addEventListener('click', saveAppFakturaSettings);
    $('appFjernFakturaLogoBtn')?.addEventListener('click', clearAppFakturaLogo);
    $('appFakturaLogoFile')?.addEventListener('change', readAppFakturaLogo);
    $('firmaBackupBtn')?.addEventListener('click', runFirmaBackup);
    $('firmaBackupReloadBtn')?.addEventListener('click', loadFirmaBackupLogg);
    $('firmaRestoreReloadBtn')?.addEventListener('click', loadFirmaBackupLogg);
    $('firmaRestoreBtn')?.addEventListener('click', restoreFirmaBackup);
    $('jobbKunde')?.addEventListener('change', onJobbKundeChange);
    $('jobbHest')?.addEventListener('change', onJobbHestChange);
    $('jobbType')?.addEventListener('change', applySelectedJobbTypePris);
    $('hestBildeFile')?.addEventListener('change', previewSelectedHestBilde);
    $('jobbBildeFiles')?.addEventListener('change', previewSelectedJobbBilder);
    $('jobbBildeDato')?.addEventListener('change', previewSelectedJobbBilder);
    bindReadLastJobbButton();
  }

  function bindReadLastJobbButton(){
    const btn = $('readLastJobbBtn');
    if(!btn) return;
    btn.onclick = function(ev){
      if(ev){ ev.preventDefault(); ev.stopPropagation(); }
      readLastJobbAsNew();
      return false;
    };
  }

  async function login(){
    msg('loginMsg','Logger inn...');
    const { data, error } = await app.sb.auth.signInWithPassword({ email: val('loginEmail'), password: val('loginPassword') });
    if(error){ msg('loginMsg', error.message, 'err'); return; }
    app.session=data.session; app.user=data.user; await startApp();
  }
  async function resetPassword(){
    const email=val('loginEmail'); if(!email){ msg('loginMsg','Skriv e-post først.','err'); return; }
    const { error } = await app.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/rettilomma/behandler/reset.html' });
    msg('loginMsg', error ? error.message : 'Passordlenke sendt hvis brukeren finnes.', error?'err':'ok');
  }
  async function logout(){ await app.sb.auth.signOut(); location.reload(); }

  async function startApp(){
    showLogin(false);
    $('userPill').textContent = app.user?.email || '';
    await ensureFirma();
    await loadAll();
    showTab('dashboard');
    bindReadLastJobbButton();
  }

  async function ensureFirma(){
    const email = app.user?.email || '';

    // Ny flerbruker-modell: hov_profiles bestemmer firma og rolle.
    // Sysadm kan få tilgang til alle firma via RLS, men appen bruker valgt/tilknyttet firma i daglig registrering.
    let profile = null;
    try{
      const pr = await app.sb.from('hov_profiles').select('*').eq('auth_user_id', app.user.id).maybeSingle();
      if(pr.error && pr.error.code !== 'PGRST116') console.warn('Kunne ikke lese hov_profiles', pr.error);
      profile = pr.data || null;
    }catch(e){
      console.warn('hov_profiles er ikke opprettet ennå. Kjør SQL-filen i pakken.', e);
    }
    app.profile = profile;
    app.role = profile?.rolle || 'hovslager';
    app.isSysadm = app.role === 'sysadm';
    if(app.role === 'deaktivert'){
      showLogin(false);
      const card=$('appCard');
      if(card) card.innerHTML = '<section class="card"><h2>Tilgang deaktivert</h2><p>Abonnementet er ikke betalt. Ta kontakt for å aktivere kontoen igjen.</p><button id="logoutBtnBlocked" class="danger">Logg ut</button></section>';
      $('logoutBtnBlocked')?.addEventListener('click', logout);
      throw new Error('Konto deaktivert');
    }

    let firma = null;
    if(profile?.firma_id){
      const r = await app.sb.from('hov_firma').select('*').eq('id', profile.firma_id).maybeSingle();
      firma = r.data || null;
    }

    // Bakoverkompatibilitet for eksisterende installasjon før profiles-tabellen er fylt.
    if(!firma){
      let { data:firmaOld, error } = await app.sb.from('hov_firma').select('*').eq('auth_user_id', app.user.id).maybeSingle();
      if(error && error.code !== 'PGRST116') throw new Error(error.message);
      firma = firmaOld || null;
    }
    if(!firma && email){
      const r = await app.sb.from('hov_firma').select('*').ilike('epost', email).maybeSingle();
      firma = r.data || null;
    }
    if(!firma){
      const payload = { navn:standardFirmaNavnForEpost(email), epost:email, auth_user_id:app.user.id };
      const r = await app.sb.from('hov_firma').insert(payload).select('*').single();
      if(r.error){ msg('dashMsg','Kunne ikke opprette firma: '+r.error.message,'err'); return; }
      firma = r.data;
    } else if(!firma.auth_user_id) {
      const r = await app.sb.from('hov_firma').update({auth_user_id:app.user.id, epost:firma.epost||email}).eq('id', firma.id).select('*').single();
      if(!r.error) firma = r.data;
    }

    // Opprett/oppdater profil automatisk for vanlig hovslager hvis den mangler.
    if(!profile && firma?.id){
      try{
        const r = await app.sb.from('hov_profiles').upsert({
          auth_user_id: app.user.id,
          firma_id: firma.id,
          rolle: 'hovslager',
          epost: email
        }, { onConflict:'auth_user_id' }).select('*').single();
        if(!r.error){ app.profile = r.data; app.role = r.data.rolle || 'hovslager'; app.isSysadm = app.role === 'sysadm'; }
      }catch(e){ console.warn('Kunne ikke opprette profil automatisk', e); }
    }

    app.firma=firma; app.firmaId=firma.id; renderFirma(); updateHeader(); updateAdminVisibility();
  }

  function updateAdminVisibility(){
    const btn=$('adminTabBtn');
    if(btn) btn.classList.toggle('hidden', !app.isSysadm);
  }

  function updateHeader(){
    $('headerTitle').textContent = app.firma?.navn || 'HovslagerSystem';
    $('headerSub').textContent = (app.firma?.epost || app.user?.email || '') + (app.isSysadm ? ' · sysadm' : '');
    const url = app.firma?.logo_url;
    const img=$('headerLogo'), fb=$('headerLogoFallback');
    if(url){ img.src=url; img.classList.remove('hidden'); fb.classList.add('hidden'); }
    else { img.removeAttribute('src'); img.classList.add('hidden'); fb.classList.remove('hidden'); }
  }

  function showTab(id){
    document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('hidden', s.id!==id));
    if(id==='firma'){ renderFirma(); loadFirmaBackupLogg(); }
    if(id==='priser') renderPriser();
    if(id==='admin'){ if(!app.isSysadm){ msg('dashMsg','SysAdm-panelet er bare for systemadministrator.','err'); showTab('dashboard'); return; } loadAdminData(); loadBackupLogg(); loadAppFakturaSettingsForm(); renderAppFakturaer(); }
  }

  async function loadAll(){
    if(!app.firmaId) return;
    msg('dashMsg','Laster data...');
    await Promise.all([loadKunder(), loadHester(), loadJobber(), loadFakturaer(), loadKreditnotaer(), loadPriser()]);
    renderAll(); msg('dashMsg','Data oppdatert.','ok');
  }
  async function selectTable(table, order){
    let q = app.sb.from(table).select('*').eq('firma_id', app.firmaId);
    if(order) q=q.order(order,{ascending:false});
    const {data,error}=await q;
    if(error){ console.error(table,error); return []; }
    return data||[];
  }
  async function loadKunder(){ app.data.kunder = await selectTable('hov_kunder','created_at'); fillKundeSelects(); renderKunder(); }
  async function loadHester(){ app.data.hester = await selectTable('hov_hester','created_at'); await signHestBilder(); fillHestSelects(); renderHester(); }
  async function loadJobber(){ app.data.jobber = await selectTable('hov_jobber','dato'); await signJobbBilder(); renderJobber(); }
  async function loadFakturaer(){ app.data.fakturaer = await selectTable('hov_fakturaer','dato'); await loadKreditnotaer(); renderFakturaer(); }
  async function loadKreditnotaer(){ app.data.kreditnotaer = await selectTable('hov_kreditnotaer','created_at'); }
  async function loadPriser(){
    let q = app.sb.from('hov_priser').select('*').limit(500);
    if(app.firmaId) q = q.or(`firma_id.eq.${app.firmaId},firma_id.is.null`);
    const {data,error}=await q;
    if(error){ console.error('hov_priser', error); app.data.priser = []; fillJobbTypeSelect(); return; }
    app.data.priser = data || [];
    fillJobbTypeSelect();
  }



  function standardFirmaNavnForEpost(email){
    const e=String(email||'').trim().toLowerCase();
    if(e==='salg@rettilomma.com') return 'Hovslager123';
    if(e==='greknuts@online.no') return 'Hovslager';
    return 'Hovslager';
  }

  async function rettStandardFirmaNavn(){
    if(!app.sb) return;
    const regler = [
      { epost:'salg@rettilomma.com', navn:'Hovslager123' },
      { epost:'greknuts@online.no', navn:'Hovslager' }
    ];
    for(const r of regler){
      try{
        await app.sb.from('hov_firma').update({navn:r.navn}).ilike('epost', r.epost);
      }catch(e){ console.warn('Kunne ikke oppdatere firmanavn for '+r.epost, e); }
    }
  }

  async function loadAdminData(){
    if(!app.isSysadm){ msg('adminMsg','Du er ikke sysadm.','err'); return; }
    msg('adminMsg','Laster adminliste...');
    await rettStandardFirmaNavn();
    const [firmaRes, profRes] = await Promise.all([
      app.sb.from('hov_firma').select('*').order('navn',{ascending:true}),
      app.sb.from('hov_profiles').select('*').order('created_at',{ascending:false})
    ]);
    if(firmaRes.error){ msg('adminMsg','Kunne ikke laste firmaer: '+firmaRes.error.message,'err'); return; }
    if(profRes.error){ msg('adminMsg','Kunne ikke laste profiler: '+profRes.error.message,'err'); return; }
    app.data.adminFirmaer = firmaRes.data || [];
    app.data.adminProfiler = profRes.data || [];
    renderAdmin();
    msg('adminMsg','Adminliste oppdatert.','ok');
  }

  function renderAdmin(){
    const firmaer = app.data.adminFirmaer || [];
    const profiler = app.data.adminProfiler || [];
    const opts = '<option value="">Velg firma</option>' + firmaer.map(f=>`<option value="${esc(f.id)}">${esc(f.navn || f.epost || f.id)}</option>`).join('');
    ['adminActiveFirma','adminProfileFirma','adminUserFirma','adminBackupFirma','appFakturaFirma'].forEach(id=>{ const el=$(id); if(el){ const old=el.value; el.innerHTML=opts; el.value = old || ((id==='adminActiveFirma' || id==='adminBackupFirma') ? app.firmaId : ''); }});

    const firmaRows = firmaer.map(f=>`<tr>
      <td><strong>${esc(f.navn||'Uten navn')}</strong>${String(f.id)===String(app.firmaId)?'<br><span class="pill">Aktivt firma</span>':''}</td>
      <td>${esc(f.epost||'')}</td>
      <td>${esc(f.telefon||'')}</td>
      <td>${esc(f.orgnr || f.org_nr || f.bedriftsnr || '')}</td>
      <td><code>${esc(f.id)}</code></td>
      <td class="admin-firma-actions"><button type="button" class="small-btn secondary" data-admin-use-firma="${esc(f.id)}">Åpne</button><button type="button" class="small-btn" data-admin-edit-firma="${esc(f.id)}">Rediger</button><button type="button" class="small-btn secondary" data-admin-user-firma="${esc(f.id)}">Lag bruker</button><button type="button" class="small-btn danger" data-admin-delete-firma="${esc(f.id)}">Slett</button></td>
    </tr>`);
    const firmaList=$('adminFirmaList');
    if(firmaList){
      firmaList.innerHTML = `<div class="msg">Antall lagrede firmaer vist: ${firmaer.length}. Hvis du forventer flere, må de finnes i Supabase-tabellen <code>hov_firma</code> og SysAdm-brukeren må ha tilgang via RLS.</div>` + table(['Firma','E-post','Telefon','Org.nr','ID','Handling'], firmaRows);
      firmaList.querySelectorAll('[data-admin-use-firma]').forEach(btn=>btn.addEventListener('click', async ()=>{
        setVal('adminActiveFirma', btn.dataset.adminUseFirma);
        await adminSwitchFirma();
      }));
      firmaList.querySelectorAll('[data-admin-edit-firma]').forEach(btn=>btn.addEventListener('click', ()=>{
        const f=(app.data.adminFirmaer||[]).find(x=>String(x.id)===String(btn.dataset.adminEditFirma));
        if(!f){ msg('adminMsg','Fant ikke firmaet som skal redigeres.','err'); return; }
        openAdminFirmaEditDialog(f);
      }));
      firmaList.querySelectorAll('[data-admin-user-firma]').forEach(btn=>btn.addEventListener('click', ()=>{
        const f=(app.data.adminFirmaer||[]).find(x=>String(x.id)===String(btn.dataset.adminUserFirma));
        if(!f){ msg('adminMsg','Fant ikke firmaet.','err'); return; }
        clearAdminUserForm(false);
        setVal('adminUserFirma', f.id);
        setVal('adminUserEpost', f.epost || '');
        document.getElementById('adminUserEpost')?.scrollIntoView({behavior:'smooth', block:'center'});
        msg('adminUserMsg','Fyll inn e-post/navn og midlertidig passord for bruker til '+(f.navn||f.epost||'firma')+'.','ok');
      }));
      firmaList.querySelectorAll('[data-admin-delete-firma]').forEach(btn=>btn.addEventListener('click', async ()=>{
        const f=(app.data.adminFirmaer||[]).find(x=>String(x.id)===String(btn.dataset.adminDeleteFirma));
        if(!f){ msg('adminMsg','Fant ikke firmaet som skal slettes.','err'); return; }
        if(!confirm('Slette firma '+(f.navn||f.epost||f.id)+'? Dette kan ikke angres.')) return;
        const {error}=await app.sb.from('hov_firma').delete().eq('id', f.id);
        if(error){ msg('adminMsg','Kunne ikke slette firma: '+error.message,'err'); return; }
        await loadAdminData();
        msg('adminMsg','Firma slettet.','ok');
      }));
    }

    $('adminProfileList').innerHTML = table(['E-post','Navn','Rolle','Firma','Auth User ID'], profiler.map(pr=>`<tr><td>${esc(pr.epost||'')}</td><td>${esc(pr.navn||'')}</td><td>${esc(pr.rolle||'')}</td><td>${esc(firmaer.find(f=>String(f.id)===String(pr.firma_id))?.navn || pr.firma_id || '')}</td><td><code>${esc(pr.auth_user_id||'')}</code></td></tr>`));
    renderAppFakturaer();
  }

  function adminFirmaLogoUrl(f){
    return f?.logo_url || f?.bilde_url || f?.image_url || f?.foto_url || f?.photo_url || '';
  }

  function ensureAdminFirmaEditDialog(){
    let wrap=$('adminFirmaEditDialog');
    if(wrap) return wrap;
    wrap=document.createElement('div');
    wrap.id='adminFirmaEditDialog';
    wrap.className='hidden';
    wrap.innerHTML=`<div class="admin-modal-backdrop" data-admin-firma-close="1"></div>
      <div class="admin-modal-card" role="dialog" aria-modal="true" aria-labelledby="adminFirmaEditTitle">
        <div class="admin-modal-head">
          <h2 id="adminFirmaEditTitle">Rediger hovslagerfirma</h2>
          <button type="button" class="small-btn secondary" data-admin-firma-close="1">Lukk</button>
        </div>
        <div id="adminFirmaEditMsg"></div>
        <div class="admin-modal-grid">
          <div>
            <div class="muted">Nåværende bilde/logo</div>
            <div id="adminFirmaEditLogoPreview" class="admin-logo-large"><span class="muted">Ingen logo lagret.</span></div>
            <label class="admin-file-label">Velg nytt bilde/logo
              <input id="adminFirmaEditLogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">
            </label>
          </div>
          <div class="admin-modal-fields">
            <label>Firmanavn<input id="adminFirmaEditNavn"></label>
            <label>E-post<input id="adminFirmaEditEpost" type="email"></label>
            <label>Telefon<input id="adminFirmaEditTelefon"></label>
            <label>Org.nr<input id="adminFirmaEditOrgnr"></label>
            <label>Adresse<input id="adminFirmaEditAdresse"></label>
          </div>
        </div>
        <div class="admin-modal-actions">
          <button type="button" class="small-btn ok" id="adminFirmaEditSaveBtn">Lagre endringer</button>
          <button type="button" class="small-btn secondary" data-admin-firma-close="1">Avbryt</button>
        </div>
      </div>`;
    const style=document.createElement('style');
    style.textContent=`
      #adminFirmaEditDialog.hidden{display:none}
      #adminFirmaEditDialog{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px}
      #adminFirmaEditDialog .admin-modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.72)}
      #adminFirmaEditDialog .admin-modal-card{position:relative;width:min(760px,96vw);max-height:92vh;overflow:auto;background:#0f172a;border:1px solid #475569;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.55);padding:18px;color:#e5e7eb}
      #adminFirmaEditDialog .admin-modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
      #adminFirmaEditDialog .admin-modal-head h2{margin:0}
      #adminFirmaEditDialog .admin-modal-grid{display:grid;grid-template-columns:240px 1fr;gap:18px;align-items:start}
      #adminFirmaEditDialog .admin-modal-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      #adminFirmaEditDialog label{display:flex;flex-direction:column;gap:6px;font-weight:700}
      #adminFirmaEditDialog input{padding:10px;border-radius:10px;border:1px solid #475569;background:#020617;color:#e5e7eb}
      #adminFirmaEditDialog .admin-logo-large{min-height:170px;border:1px dashed #64748b;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:8px 0 12px;padding:10px;background:#020617}
      #adminFirmaEditDialog .admin-logo-large img{max-width:210px;max-height:170px;border-radius:12px;object-fit:contain}
      #adminFirmaEditDialog .admin-file-label{font-weight:700}
      #adminFirmaEditDialog .admin-modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
      @media(max-width:700px){#adminFirmaEditDialog .admin-modal-grid{grid-template-columns:1fr}#adminFirmaEditDialog .admin-modal-fields{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-admin-firma-close]').forEach(x=>x.addEventListener('click', closeAdminFirmaEditDialog));
    $('adminFirmaEditLogoFile')?.addEventListener('change', previewAdminFirmaEditLogo);
    $('adminFirmaEditSaveBtn')?.addEventListener('click', saveAdminFirmaEditDialog);
    return wrap;
  }

  function openAdminFirmaEditDialog(f){
    if(!app.isSysadm) return;
    const wrap=ensureAdminFirmaEditDialog();
    app.adminEditFirmaId=f.id;
    setVal('adminFirmaEditNavn', f.navn||'');
    setVal('adminFirmaEditEpost', f.epost||'');
    setVal('adminFirmaEditTelefon', f.telefon||'');
    setVal('adminFirmaEditOrgnr', f.orgnr || f.org_nr || f.bedriftsnr || '');
    setVal('adminFirmaEditAdresse', f.adresse||'');
    const file=$('adminFirmaEditLogoFile'); if(file) file.value='';
    renderAdminFirmaEditLogoPreview(adminFirmaLogoUrl(f));
    const title=$('adminFirmaEditTitle'); if(title) title.textContent='Rediger hovslagerfirma: '+(f.navn||f.epost||'');
    msg('adminFirmaEditMsg','Endre firma og bilde/logo her. Trykk Lagre endringer når du er ferdig.','ok');
    wrap.classList.remove('hidden');
  }

  function closeAdminFirmaEditDialog(){
    const wrap=$('adminFirmaEditDialog');
    if(wrap) wrap.classList.add('hidden');
  }

  function renderAdminFirmaEditLogoPreview(url){
    const el=$('adminFirmaEditLogoPreview');
    if(!el) return;
    el.innerHTML = url ? `<img src="${esc(url)}" alt="Firmalogo">` : '<span class="muted">Ingen logo lagret.</span>';
  }

  function previewAdminFirmaEditLogo(){
    const file=$('adminFirmaEditLogoFile')?.files?.[0];
    if(file) renderAdminFirmaEditLogoPreview(URL.createObjectURL(file));
  }

  async function saveAdminFirmaEditDialog(){
    if(!app.isSysadm || !app.adminEditFirmaId) return;
    const navn=val('adminFirmaEditNavn');
    if(!navn){ msg('adminFirmaEditMsg','Skriv firmanavn før du lagrer.','err'); return; }
    const payload={
      navn,
      epost:val('adminFirmaEditEpost')||null,
      telefon:val('adminFirmaEditTelefon')||null,
      orgnr:val('adminFirmaEditOrgnr')||null,
      adresse:val('adminFirmaEditAdresse')||null
    };
    msg('adminFirmaEditMsg','Lagrer endringer...');
    const {data,error}=await app.sb.from('hov_firma').update(payload).eq('id', app.adminEditFirmaId).select('*').single();
    if(error){ msg('adminFirmaEditMsg','Kunne ikke lagre firma: '+error.message,'err'); return; }
    let saved=data;
    const file=$('adminFirmaEditLogoFile')?.files?.[0] || null;
    if(file){
      try{
        const logo=await uploadFirmaLogoForFirma(file, saved.id);
        const up=await app.sb.from('hov_firma').update(logo).eq('id', saved.id).select('*').single();
        if(up.error){ msg('adminFirmaEditMsg','Firma lagret, men logo kunne ikke lagres: '+up.error.message,'err'); return; }
        saved=up.data;
      }catch(e){ msg('adminFirmaEditMsg','Firma lagret, men logo kunne ikke lastes opp: '+(e.message||String(e)),'err'); return; }
    }
    if(String(app.firmaId)===String(saved.id)){ app.firma=saved; updateHeader(); renderFirma(); }
    closeAdminFirmaEditDialog();
    await loadAdminData();
    msg('adminMsg','Firma er oppdatert: '+(saved.navn||saved.epost||saved.id)+'.','ok');
  }

  async function adminSwitchFirma(){
    if(!app.isSysadm) return;
    const id=val('adminActiveFirma');
    if(!id){ msg('adminMsg','Velg firma først.','err'); return; }
    const firma = (app.data.adminFirmaer||[]).find(f=>String(f.id)===String(id));
    if(!firma){ msg('adminMsg','Fant ikke valgt firma.','err'); return; }
    app.firma = firma;
    app.firmaId = firma.id;
    updateHeader();
    renderFirma();
    await loadAll();
    msg('adminMsg','Aktivt firma byttet til '+(firma.navn||firma.epost||firma.id)+'.','ok');
    showTab('dashboard');
  }

  function clearAdminFirmaForm(){
    app.adminEditFirmaId = null;
    ['adminFirmaNavn','adminFirmaEpost','adminFirmaTelefon','adminFirmaOrgnr','adminFirmaAdresse'].forEach(id=>setVal(id,''));
    const file=$('adminFirmaLogoFile');
    if(file) file.value='';
    const title=$('adminFirmaTitle'); if(title) title.textContent='Nytt firma';
    const help=$('adminFirmaHelp'); if(help) help.textContent='Start med blankt skjema. Logo/bilde er tomt til du velger en fil.';
    const btn=$('adminCreateFirmaBtn'); if(btn) btn.textContent='Lagre firma';
    renderAdminFirmaLogoPreview('');
    msg('adminMsg','Klart for nytt firma. Logo/bilde er blankt.','ok');
  }

  function renderAdminFirmaLogoPreview(url){
    const el=$('adminFirmaLogoPreview');
    if(!el) return;
    el.innerHTML = url ? `<img class="thumb" src="${esc(url)}" alt="Firmalogo">` : '<span class="muted">Ingen logo valgt.</span>';
  }

  function previewAdminFirmaLogo(){
    const file=$('adminFirmaLogoFile')?.files?.[0];
    renderAdminFirmaLogoPreview(file ? URL.createObjectURL(file) : '');
  }

  async function uploadFirmaLogoForFirma(file, firmaId){
    if(!file || !firmaId) return null;
    const ext=(file.name.split('.').pop()||'png').toLowerCase();
    const path=`${firmaId}/${Date.now()}-${safeName(file.name||('logo.'+ext))}`;
    const up=await app.sb.storage.from('hovslager-logo').upload(path, file, { upsert:true, contentType:file.type || 'image/png' });
    if(up.error) throw new Error('Logo ble ikke lastet opp: '+up.error.message+' (Sjekk bucket hovslager-logo og policy.)');
    const pub=app.sb.storage.from('hovslager-logo').getPublicUrl(path);
    return { logo_url: pub.data.publicUrl, logo_path: path };
  }

  async function adminCreateFirma(){
    if(!app.isSysadm) return;
    const navn=val('adminFirmaNavn');
    if(!navn){ msg('adminMsg','Skriv firmanavn før du lagrer firma.','err'); return; }
    const file=$('adminFirmaLogoFile')?.files?.[0] || null;
    const payload={navn, epost:val('adminFirmaEpost')||null, telefon:val('adminFirmaTelefon')||null, orgnr:val('adminFirmaOrgnr')||null, adresse:val('adminFirmaAdresse')||null, betalingsfrist_dager:14, faktura_prefix:'F', neste_fakturanr:1, standard_mva_sats:25};
    msg('adminMsg', app.adminEditFirmaId ? 'Lagrer endringer...' : 'Lagrer firma...');
    let saved=null;
    if(app.adminEditFirmaId){
      try{
        const {data,error}=await app.sb.functions.invoke('oppdater-hov-kunde', { body:{ firma_id:app.adminEditFirmaId, ...payload } });
        if(error) throw error;
        if(!data || data.ok === false) throw new Error(data?.error || data?.message || 'Ukjent feil fra oppdater-hov-kunde.');
        saved=data.firma || null;
      }catch(err){
        // Fallback dersom Edge Function ikke er deployet ennå: oppdater bare hov_firma direkte.
        const {data,error}=await app.sb.from('hov_firma').update(payload).eq('id', app.adminEditFirmaId).select('*').single();
        if(error){ msg('adminMsg','Kunne ikke oppdatere firma: '+(err.message||String(err))+' / '+error.message,'err'); return; }
        saved=data;
      }
      if(file && saved?.id){
        try{
          const logo=await uploadFirmaLogoForFirma(file, saved.id);
          const up=await app.sb.from('hov_firma').update(logo).eq('id', saved.id).select('*').single();
          if(!up.error) saved=up.data;
        }catch(e){ msg('adminMsg','Firma oppdatert, men logo kunne ikke lastes opp: '+(e.message||String(e)),'err'); }
      }
      clearAdminFirmaForm();
      await loadAdminData();
      if(saved?.id) setVal('adminActiveFirma', saved.id);
      msg('adminMsg','Firma er oppdatert.','ok');
      return;
    }

    // Nytt firma: bruk Edge Function hvis e-post og passord er fylt i brukerskjema, ellers opprett bare firma som før.
    const createPayload={...payload, passord:val('adminUserPassword')||undefined};
    try{
      if(payload.epost && createPayload.passord){
        const {data,error}=await app.sb.functions.invoke('opprett-hov-kunde', { body:createPayload });
        if(error) throw error;
        if(!data || data.ok === false) throw new Error(data?.error || data?.message || 'Ukjent feil fra opprett-hov-kunde.');
        saved=data.firma || {id:data.firma_id};
      }else{
        const {data,error}=await app.sb.from('hov_firma').insert([{...payload, logo_url:null, logo_path:null}]).select('*').single();
        if(error) throw error;
        saved=data;
      }
    }catch(err){ msg('adminMsg','Kunne ikke lagre firma: '+(err.message||String(err)),'err'); return; }
    if(file && saved?.id){
      try{
        const logo=await uploadFirmaLogoForFirma(file, saved.id);
        const up=await app.sb.from('hov_firma').update(logo).eq('id', saved.id).select('*').single();
        if(up.error){ msg('adminMsg','Firma lagret, men logo kunne ikke lagres: '+up.error.message,'err'); }
        else saved=up.data;
      }catch(e){
        msg('adminMsg','Firma lagret, men logo kunne ikke lastes opp: '+(e.message||String(e)),'err');
      }
    }
    clearAdminFirmaForm();
    await loadAdminData();
    if(saved?.id) setVal('adminActiveFirma', saved.id);
    msg('adminMsg','Firma lagret. Husk å koble en brukerprofil til firmaet.','ok');
  }

  function clearAdminUserForm(showMsg){
    ['adminUserEpost','adminUserNavn','adminUserPassword'].forEach(id=>setVal(id,''));
    setVal('adminUserRole','hovslager');
    if(showMsg !== false) msg('adminUserMsg','Brukerskjema tømt.','ok');
  }

  function randomTempPassword(){
    return 'Hov' + Math.random().toString(36).slice(2,8) + '!' + String(Math.floor(100+Math.random()*900));
  }

  async function adminCreateLoginUser(){
    if(!app.isSysadm) return;
    const firmaId=val('adminUserFirma');
    const email=val('adminUserEpost');
    const navn=val('adminUserNavn');
    const rolle=val('adminUserRole') || 'hovslager';
    let password=val('adminUserPassword');
    if(!firmaId){ msg('adminUserMsg','Velg firma brukeren skal høre til.','err'); return; }
    if(!email){ msg('adminUserMsg','Skriv e-post til brukeren.','err'); return; }
    if(!password){ password=randomTempPassword(); setVal('adminUserPassword', password); }
    if(password.length < 6){ msg('adminUserMsg','Passord må være minst 6 tegn.','err'); return; }
    msg('adminUserMsg','Oppretter innloggingsbruker ...');
    try{
      const {data,error}=await app.sb.functions.invoke('oppdater-hov-kunde', { body:{ firma_id:firmaId, epost:email, passord:password, navn_bruker:navn, rolle, email_confirm:true } });
      if(error) throw error;
      if(!data || data.ok === false) throw new Error(data?.error || data?.message || 'Ukjent feil fra oppdater-hov-kunde.');
      await loadAdminData();
      msg('adminUserMsg','Bruker er opprettet/oppdatert og koblet til firma. Send e-post og passord til brukeren: '+email+' / '+password,'ok');
    }catch(err){
      const tekst=(err && (err.message || err.error_description || err.name)) ? (err.message || err.error_description || err.name) : String(err||'Ukjent feil');
      msg('adminUserMsg','Kunne ikke opprette innloggingsbruker. Sjekk at Supabase Edge Function oppdater-hov-kunde er deployet. Feil: '+tekst,'err');
    }
  }

  async function adminSaveProfile(){
    if(!app.isSysadm) return;
    const authId=val('adminProfileAuthId');
    if(!authId){ msg('adminMsg','Skriv Auth User ID fra Supabase Auth.','err'); return; }
    const payload={auth_user_id:authId, firma_id:val('adminProfileFirma')||null, rolle:val('adminProfileRole')||'hovslager', epost:val('adminProfileEpost')||null, navn:val('adminProfileNavn')||null};
    const {error}=await app.sb.from('hov_profiles').upsert(payload,{onConflict:'auth_user_id'});
    if(error){ msg('adminMsg','Kunne ikke lagre profil: '+error.message,'err'); return; }
    ['adminProfileAuthId','adminProfileEpost','adminProfileNavn'].forEach(id=>setVal(id,''));
    setVal('adminProfileRole','hovslager');
    await loadAdminData();
    msg('adminMsg','Profil lagret/oppdatert.','ok');
  }




  async function runFirmaBackup(){
    if(!app.firmaId){ msg('firmaBackupMsg','Mangler firma-ID. Logg inn på nytt.','err'); return; }
    msg('firmaBackupMsg','Starter backup av eget firma...');
    try{
      const {data,error}=await app.sb.functions.invoke('hov-backup', { body:{ action:'backup', mode:'manual', scope:'firma' } });
      if(error){ msg('firmaBackupMsg','Backup feilet: '+(error.message||JSON.stringify(error)),'err'); return; }
      if(data && data.ok){
        const size = data.file_size ? ` (${Math.round(Number(data.file_size)/1024)} KB)` : '';
        const link = data.signed_url ? ` <a href="${esc(data.signed_url)}" target="_blank" rel="noopener">Last ned ZIP</a>` : '';
        const el=$('firmaBackupMsg');
        if(el) el.innerHTML = `<div class="msg ok">Backup ferdig${esc(size)}: ${esc(data.file_path||'')}.${link}</div>`;
      }else msg('firmaBackupMsg','Backup svarte uventet: '+esc(JSON.stringify(data||{})),'err');
      await loadFirmaBackupLogg();
    }catch(err){ msg('firmaBackupMsg','Backup feilet: '+(err.message||String(err)),'err'); }
  }

  function renderBackupOptions(backups){
    const sel=$('firmaRestoreSelect'); if(!sel) return;
    const old=sel.value;
    sel.innerHTML = '<option value="">Velg backup</option>' + (backups||[]).map(b=>{
      const t=fmtDateTime(b.created_at);
      const label=`${t} - ${b.file_size ? Math.round(Number(b.file_size)/1024)+' KB' : 'backup'}`;
      return `<option value="${esc(b.file_path||'')}">${esc(label)}</option>`;
    }).join('');
    if(old) sel.value=old;
  }

  async function loadFirmaBackupLogg(){
    if(!app.firmaId) return;
    const el=$('firmaBackupList');
    if(el) el.innerHTML='<div class="msg">Laster backup-logg...</div>';
    try{
      const {data,error}=await app.sb.functions.invoke('hov-backup', { body:{ action:'list' } });
      if(error){ if(el) el.innerHTML='<div class="msg err">Kunne ikke lese backup-logg: '+esc(error.message)+'</div>'; return; }
      const backups=(data && data.ok) ? (data.backups||[]) : [];
      renderBackupOptions(backups);
      const rows=backups.map(b=>{
        const dl=b.signed_url ? `<a href="${esc(b.signed_url)}" target="_blank" rel="noopener">Last ned</a>` : '';
        return `<tr><td>${esc(fmtDateTime(b.created_at))}</td><td>${esc(b.status||'')}</td><td>${esc(b.backup_scope||'firma')}</td><td>${esc(b.file_path||'')}</td><td>${b.file_size ? esc(Math.round(Number(b.file_size)/1024)+' KB') : ''}</td><td>${dl}</td></tr>`;
      });
      if(el) el.innerHTML = table(['Tid','Status','Omfang','Fil','Str.','Last ned'], rows);
    }catch(err){ if(el) el.innerHTML='<div class="msg err">Kunne ikke lese backup-logg: '+esc(err.message||String(err))+'</div>'; }
  }

  async function restoreFirmaBackup(){
    const filePath=val('firmaRestoreSelect');
    if(!filePath){ msg('firmaBackupMsg','Velg backup som skal gjenopprettes.','err'); return; }
    if(!confirm('Gjenopprette valgt backup? Dette oppdaterer data med innholdet i backupen.')) return;
    msg('firmaBackupMsg','Gjenoppretter backup...');
    try{
      const {data,error}=await app.sb.functions.invoke('hov-backup', { body:{ action:'restore', file_path:filePath } });
      if(error){ msg('firmaBackupMsg','Restore feilet: '+(error.message||JSON.stringify(error)),'err'); return; }
      if(data && data.ok){ msg('firmaBackupMsg','Backup er gjenopprettet. Laster data på nytt...','ok'); await loadAll(); await loadFirmaBackupLogg(); }
      else msg('firmaBackupMsg','Restore svarte uventet: '+esc(JSON.stringify(data||{})),'err');
    }catch(err){ msg('firmaBackupMsg','Restore feilet: '+(err.message||String(err)),'err'); }
  }


  async function loadBackupLogg(){
    if(!app.isSysadm) return;
    const el=$('adminBackupList');
    if(el) el.innerHTML='<div class="msg">Laster backup-logg...</div>';
    try{
      // Bruk Edge Function i stedet for direkte tabell-lesing.
      // Da får sysadm også signed_url, og samme logikk fungerer for slettede firma.
      const {data,error}=await app.sb.functions.invoke('hov-backup', { body:{ action:'list' } });
      if(error){
        if(el) el.innerHTML='<div class="msg err">Kunne ikke lese backup-logg: '+esc(error.message||JSON.stringify(error))+'</div>';
        return;
      }
      if(!data || !data.ok){
        if(el) el.innerHTML='<div class="msg err">Kunne ikke lese backup-logg: '+esc(JSON.stringify(data||{}))+'</div>';
        return;
      }
      app.data.backupLogg=data.backups||[];
      renderBackupLogg();
    }catch(err){
      if(el) el.innerHTML='<div class="msg err">Kunne ikke lese backup-logg: '+esc(err.message||String(err))+'</div>';
    }
  }

  function backupMeta(b){ return (b && typeof b.meta === 'object' && b.meta) ? b.meta : {}; }
  function adminBackupFirmaNavn(b){
    const firmaer = app.data.adminFirmaer || [];
    const meta = backupMeta(b);
    const idFromPath = String(b?.file_path||b?.backup_prefix||'').match(/^firma\/([^\/]+)/)?.[1] || '';
    const id = b?.firma_id || meta.firma_id || idFromPath;
    const live = id ? firmaer.find(f=>String(f.id)===String(id)) : null;
    // Hvis firmaet finnes i admin-listen, er det aktivt uansett hva eldre list-kall sier.
    if(live) return live.navn || live.epost || live.id;
    const navn = b?.firma_navn || meta.firma_navn || meta.firma?.navn || '';
    if(navn) return b?.firma_deleted ? navn + ' (slettet)' : navn;
    if(id) return b?.firma_deleted ? id + ' (slettet)' : id;
    return '';
  }
  function adminBackupFirmaEier(b){
    const meta = backupMeta(b);
    return b?.firma_epost || meta.firma_epost || meta.owner_email || b?.requested_email || '';
  }
  function adminBackupFirmaOrgnr(b){
    const meta = backupMeta(b);
    return b?.firma_orgnr || meta.firma_orgnr || meta.orgnr || '';
  }

  function renderAdminRestoreOptions(){
    const sel=$('adminRestoreSelect'); if(!sel) return;
    const old=sel.value;
    const backups=(app.data.backupLogg||[]).filter(b=>b.status==='ok' && b.file_path && String(b.backup_type||'') !== 'restore');
    sel.innerHTML = '<option value="">Velg backup</option>' + backups.map(b=>{
      const t=fmtDateTime(b.created_at);
      const firma=adminBackupFirmaNavn(b) || 'Slettet/ukjent firma';
      const eier=adminBackupFirmaEier(b);
      const org=adminBackupFirmaOrgnr(b);
      const size=b.file_size ? ` - ${Math.round(Number(b.file_size)/1024)} KB` : '';
      const label=`${t} - ${firma}${eier ? ' - '+eier : ''}${org ? ' - org '+org : ''}${size}`;
      // Bruk backup-logg ID i GUI. Edge Function finner file_path selv.
      return `<option value="${esc(b.id||'')}" data-file-path="${esc(b.file_path||'')}">${esc(label)}</option>`;
    }).join('');
    if(old) sel.value=old;
  }

  function backupSearchText(b){
    return [fmtDateTime(b.created_at), b.status, b.backup_scope, adminBackupFirmaNavn(b), adminBackupFirmaEier(b), adminBackupFirmaOrgnr(b), b.backup_type, b.file_path, b.backup_prefix, b.error_message]
      .map(x=>String(x||'').toLowerCase()).join(' ');
  }

  function renderBackupToolbar(list){
    const total=(app.data.backupLogg||[]).length;
    const shown=list.length;
    const filter=app.adminBackupFilter||'all';
    const btn=(key,label)=>`<button type="button" class="small-btn ${filter===key?'ok':'secondary'}" data-backup-filter="${key}">${label}</button>`;
    return `<div class="msg" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <strong>Backup v2</strong>
      ${btn('all','Alle')}${btn('active','Aktive firma')}${btn('deleted','Slettede firma')}${btn('system','System')}
      <input id="adminBackupSearch" type="search" placeholder="Søk firma, e-post, org.nr, dato ..." value="${esc(app.adminBackupSearch||'')}" style="min-width:320px;max-width:100%;padding:8px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e5e7eb">
      <span class="muted">Viser ${shown} av ${total}. Velg Alle for å se både aktive og slettede firma.</span>
    </div>`;
  }

  function backupFilterMatch(b){
    const filter=app.adminBackupFilter||'all';
    if(filter==='active'){
      const idFromPath = String(b?.file_path||b?.backup_prefix||'').match(/^firma\/([^\/]+)/)?.[1] || '';
      const firmaId = b?.firma_id || backupMeta(b).firma_id || idFromPath;
      const liveFirma = firmaId ? (app.data.adminFirmaer||[]).some(f=>String(f.id)===String(firmaId)) : false;
      return b.backup_scope==='firma' && (liveFirma || !b.firma_deleted);
    }
    if(filter==='deleted'){
      const idFromPath = String(b?.file_path||b?.backup_prefix||'').match(/^firma\/([^\/]+)/)?.[1] || '';
      const firmaId = b?.firma_id || backupMeta(b).firma_id || idFromPath;
      const liveFirma = firmaId ? (app.data.adminFirmaer||[]).some(f=>String(f.id)===String(firmaId)) : false;
      return b.backup_scope==='firma' && !!b.firma_deleted && !liveFirma;
    }
    if(filter==='system') return b.backup_scope==='system';
    return true;
  }

  function renderBackupLogg(){
    const search=String(app.adminBackupSearch||'').trim().toLowerCase();
    const list=(app.data.backupLogg||[])
      .filter(b=>backupFilterMatch(b))
      .filter(b=>!search || backupSearchText(b).includes(search))
      .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    const rows=list.map(b=>{
      const firmaNavn = adminBackupFirmaNavn(b) || (b.backup_scope === 'firma' ? 'Slettet/ukjent firma' : 'Systembackup');
      const eier=adminBackupFirmaEier(b);
      const org=adminBackupFirmaOrgnr(b);
      const file=b.file_path || b.backup_prefix || '';
      const idFromPath = String(b?.file_path||b?.backup_prefix||'').match(/^firma\/([^\/]+)/)?.[1] || '';
      const firmaId = b?.firma_id || backupMeta(b).firma_id || idFromPath;
      const liveFirma = firmaId ? (app.data.adminFirmaer||[]).find(f=>String(f.id)===String(firmaId)) : null;
      const isDeleted = b.backup_scope==='firma' && !!firmaId && !liveFirma && !!b.firma_deleted;
      const deleted=isDeleted ? '<br><span class="pill">Slettet firma</span>' : (b.backup_scope==='firma' ? '<br><span class="pill">Aktivt firma</span>' : '');
      const dl=b.signed_url ? `<a href="${esc(b.signed_url)}" target="_blank" rel="noopener">Last ned</a>` : '';
      const restoreBtn=(b.status==='ok' && b.file_path && String(b.backup_type||'') !== 'restore')
        ? `<button type="button" class="small-btn ok" data-admin-restore-id="${esc(b.id||'')}">Gjenopprett</button>` : '<span class="muted">Logg</span>';
      const actions=`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${restoreBtn}${dl}</div>`;
      return `<tr><td>${esc(fmtDateTime(b.created_at))}</td><td>${esc(b.status||'')}</td><td>${esc(b.backup_scope||'system')}</td><td><strong>${esc(firmaNavn)}</strong>${deleted}${org ? '<br><span class="muted">Org: '+esc(org)+'</span>' : ''}</td><td>${esc(eier)}</td><td>${esc(b.backup_type||'')}</td><td>${esc(file)}</td><td>${b.file_size ? esc(Math.round(Number(b.file_size)/1024)+' KB') : ''}</td><td>${actions}</td><td>${esc(b.error_message||'')}</td></tr>`;
    });
    renderAdminRestoreOptions();
    const el=$('adminBackupList');
    if(el){
      el.innerHTML = renderBackupToolbar(list) + table(['Tid','Status','Omfang','Firma','Eier/e-post','Type','Fil/prefix','Str.','Handling','Feil'], rows);
      const searchEl=$('adminBackupSearch');
      if(searchEl){ searchEl.addEventListener('input',()=>{ app.adminBackupSearch=searchEl.value; renderBackupLogg(); }); }
      el.querySelectorAll('[data-backup-filter]').forEach(btn=>btn.addEventListener('click',()=>{ app.adminBackupFilter=btn.dataset.backupFilter||'all'; renderBackupLogg(); }));
      el.querySelectorAll('[data-admin-restore-id]').forEach(btn=>btn.addEventListener('click',()=>adminRestoreBackup(btn.dataset.adminRestoreId)));
    }
  }

  async function adminRestoreBackup(backupIdArg){
    if(!app.isSysadm){ msg('adminBackupMsg','Bare sysadm kan gjenopprette backup fra adminpanelet.','err'); return; }
    const backupId=backupIdArg || val('adminRestoreSelect');
    if(!backupId){ msg('adminBackupMsg','Velg backup som skal gjenopprettes.','err'); return; }
    const backup=(app.data.backupLogg||[]).find(b=>String(b.id)===String(backupId));
    const firma=backup ? (adminBackupFirmaNavn(backup) || 'slettet/ukjent firma') : 'valgt backup';
    if(!confirm('Gjenopprette backup for '+firma+'? Dette vil skrive tilbake data fra backupfilen. Fortsette?')) return;
    msg('adminBackupMsg','Gjenoppretter backup...');
    try{
      const {data,error}=await app.sb.functions.invoke('hov-backup', { body:{ action:'restore', backup_id:backupId } });
      if(error){ msg('adminBackupMsg','Restore feilet: '+(error.message||JSON.stringify(error)),'err'); return; }
      if(data && data.ok){
        msg('adminBackupMsg','Backup er gjenopprettet. Laster adminliste og backup-logg på nytt...','ok');
        await loadAdminData();
        await loadBackupLogg();
        if(backup?.file_path && String(backup.file_path).startsWith('firma/') && app.firmaId){ await loadAll(); }
      }else{
        msg('adminBackupMsg','Restore svarte uventet: '+esc(JSON.stringify(data||{})),'err');
      }
    }catch(err){
      msg('adminBackupMsg','Restore feilet: '+(err.message||String(err)),'err');
    }
  }

  async function runBackup(body){
    if(!app.isSysadm){ msg('adminBackupMsg','Bare sysadm kan ta backup fra adminpanelet.','err'); return; }
    msg('adminBackupMsg','Starter backup. Dette kan ta litt tid...');
    try{
      const {data,error}=await app.sb.functions.invoke('hov-backup', { body });
      if(error){ msg('adminBackupMsg','Backup feilet: '+(error.message||JSON.stringify(error)),'err'); return; }
      if(data && data.ok){
        msg('adminBackupMsg','Backup ferdig: '+(data.file_path||data.prefix||'')+' ('+(data.backup_scope||body.scope||'')+')','ok');
      } else {
        msg('adminBackupMsg','Backup svarte uventet: '+esc(JSON.stringify(data||{})),'err');
      }
      await loadBackupLogg();
    }catch(err){
      msg('adminBackupMsg','Backup feilet: '+(err.message||String(err)),'err');
    }
  }

  async function adminRunFirmaBackup(){
    const firmaId = val('adminBackupFirma') || app.firmaId;
    if(!firmaId){ msg('adminBackupMsg','Velg firma først.','err'); return; }
    await runBackup({ mode:'manual', scope:'firma', firma_id:firmaId });
  }

  function appFakturaSettingsKey(){ return 'hov_app_faktura_settings_v1'; }
  function defaultAppFakturaSettings(){
    const f=app.firma||{};
    return {
      logo:'',
      brevhode:f.navn || 'Rettilomma',
      orgnr:f.orgnr || f.org_nr || '',
      adresse:f.adresse || '',
      epost:f.epost || 'salg@rettilomma.com',
      telefon:f.telefon || '',
      kontonr:f.kontonr || '',
      standardTekst:'Abonnement HovslagerSystem',
      bunntekst:'Takk for handelen.'
    };
  }
  function loadAppFakturaSettings(){
    try{ return {...defaultAppFakturaSettings(), ...(JSON.parse(localStorage.getItem(appFakturaSettingsKey()) || '{}') || {})}; }
    catch(_){ return defaultAppFakturaSettings(); }
  }
  function saveAppFakturaSettingsObject(settings){ localStorage.setItem(appFakturaSettingsKey(), JSON.stringify(settings || {})); }
  function loadAppFakturaSettingsForm(){
    if(!app.isSysadm) return;
    const s=loadAppFakturaSettings();
    setVal('appFakturaBrevhode', s.brevhode);
    setVal('appFakturaOrgNr', s.orgnr);
    setVal('appFakturaKonto', s.kontonr);
    setVal('appFakturaAvsenderEpost', s.epost);
    setVal('appFakturaAvsenderTelefon', s.telefon);
    setVal('appFakturaAvsenderAdresse', s.adresse);
    setVal('appFakturaStandardTekst', s.standardTekst);
    setVal('appFakturaBunntekst', s.bunntekst);
    const p=$('appFakturaLogoPreview');
    if(p) p.innerHTML = s.logo ? `<img class="thumb" src="${esc(s.logo)}" alt="Logo">` : '<span class="muted">Ingen logo valgt.</span>';
  }
  function saveAppFakturaSettings(){
    if(!app.isSysadm){ msg('appFakturaDesignMsg','Bare sysadm kan endre disse innstillingene.','err'); return; }
    const old=loadAppFakturaSettings();
    const settings={
      ...old,
      brevhode:val('appFakturaBrevhode') || old.brevhode || 'Rettilomma',
      orgnr:val('appFakturaOrgNr'),
      kontonr:val('appFakturaKonto'),
      epost:val('appFakturaAvsenderEpost'),
      telefon:val('appFakturaAvsenderTelefon'),
      adresse:val('appFakturaAvsenderAdresse'),
      standardTekst:val('appFakturaStandardTekst') || 'Abonnement HovslagerSystem',
      bunntekst:val('appFakturaBunntekst')
    };
    saveAppFakturaSettingsObject(settings);
    loadAppFakturaSettingsForm();
    msg('appFakturaDesignMsg','Fakturainnstillinger er lagret.','ok');
  }
  function readAppFakturaLogo(){
    if(!app.isSysadm) return;
    const file=$('appFakturaLogoFile')?.files?.[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      const s=loadAppFakturaSettings();
      s.logo=String(reader.result||'');
      saveAppFakturaSettingsObject(s);
      loadAppFakturaSettingsForm();
      msg('appFakturaDesignMsg','Logo er lagret.','ok');
    };
    reader.readAsDataURL(file);
  }
  function clearAppFakturaLogo(){
    if(!app.isSysadm){ msg('appFakturaDesignMsg','Bare sysadm kan fjerne logo.','err'); return; }
    const s=loadAppFakturaSettings();
    s.logo='';
    saveAppFakturaSettingsObject(s);
    const f=$('appFakturaLogoFile'); if(f) f.value='';
    loadAppFakturaSettingsForm();
    msg('appFakturaDesignMsg','Logo er fjernet.','ok');
  }

  function appFakturaStorageKey(){ return 'hov_app_fakturaer_v1'; }
  function loadAppFakturaerLocal(){
    try{ return JSON.parse(localStorage.getItem(appFakturaStorageKey()) || '[]') || []; }
    catch(_){ return []; }
  }
  function saveAppFakturaerLocal(rows){ localStorage.setItem(appFakturaStorageKey(), JSON.stringify(rows || [])); }
  function appFakturaNr(){
    const rows=loadAppFakturaerLocal();
    const max=rows.reduce((m,r)=>Math.max(m, Number(String(r.nr||'').replace(/\D/g,''))||0), 0);
    return 'APP-' + String(max + 1).padStart(4,'0');
  }
  function appFirmaById(id){ return (app.data.adminFirmaer||[]).find(f=>String(f.id)===String(id)) || {}; }
  function datePlusDays(days){ const d=new Date(); d.setDate(d.getDate()+Number(days||14)); return d.toISOString().slice(0,10); }
  function appFakturaHtml(f, opts){
    const settings=loadAppFakturaSettings();
    const kunde=f.kunde||appFirmaById(f.firma_id)||{};
    const title='Faktura '+(f.nr||'');
    const logo=settings.logo ? `<img class="logo" src="${esc(settings.logo)}" alt="Logo">` : '';
    const printScript = opts?.autoPrint === false ? '' : '<script>window.print && setTimeout(()=>window.print(),300)<\/script>';
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>body{font-family:Arial,sans-serif;padding:30px;color:#111}.top{display:flex;justify-content:space-between;gap:40px;align-items:flex-start}.logo{max-height:85px;max-width:220px;margin-bottom:12px}h1{margin:0 0 10px}.sender{text-align:right;line-height:1.45}.box{border:1px solid #ddd;padding:14px;margin:14px 0}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}.right{text-align:right}.total{font-size:20px;font-weight:bold}.muted{color:#666}.status{display:inline-block;border:1px solid #ddd;border-radius:999px;padding:6px 10px}.footer{margin-top:35px;border-top:1px solid #ddd;padding-top:12px;color:#555;white-space:pre-line}</style>
      </head><body>
      <div class="top"><div>${logo}<h1>${esc(title)}</h1><div class="status">${esc(f.status||'sendt')}</div></div><div class="sender"><strong>${esc(settings.brevhode||'Rettilomma')}</strong><br>${settings.orgnr ? 'Org.nr: '+esc(settings.orgnr)+'<br>' : ''}${esc(settings.adresse||'')}<br>${esc(settings.epost||'')}<br>${esc(settings.telefon||'')}</div></div>
      <div class="box"><strong>Kunde</strong><br>${esc(kunde.navn||'')}<br>${esc(kunde.adresse||'')}<br>${esc(kunde.epost||'')}</div>
      <p><strong>Dato:</strong> ${esc(f.dato||'')}<br><strong>Forfall:</strong> ${esc(f.forfall||'')}</p>
      <table><thead><tr><th>Beskrivelse</th><th class="right">Beløp inkl. mva</th></tr></thead><tbody>
      <tr><td>${esc(f.tekst||settings.standardTekst||'Abonnement HovslagerSystem')}</td><td class="right">${kr(f.belop||0)}</td></tr>
      </tbody></table>
      <p class="right total">Å betale: ${kr(f.belop||0)}</p>
      <div class="box"><strong>Betaling</strong><br>Kontonr: ${esc(settings.kontonr||'')}</div>
      ${settings.bunntekst ? `<div class="footer">${esc(settings.bunntekst)}</div>` : ''}
      ${printScript}</body></html>`;
  }
  function visAppFaktura(id){
    if(!app.isSysadm){ msg('dashMsg','Bare sysadm kan vise appfaktura.','err'); return; }
    const f=loadAppFakturaerLocal().find(x=>String(x.id)===String(id));
    if(!f){ msg('appFakturaMsg','Fant ikke faktura.','err'); return; }
    const w=window.open('', '_blank');
    if(!w){ msg('appFakturaMsg','Nettleseren blokkerte popup. Tillat popup for å vise faktura.','err'); return; }
    w.document.open(); w.document.write(appFakturaHtml(f)); w.document.close();
  }
  function sendAppFakturaEpost(id){
    if(!app.isSysadm){ msg('dashMsg','Bare sysadm kan sende appfaktura.','err'); return; }
    const f=loadAppFakturaerLocal().find(x=>String(x.id)===String(id));
    if(!f){ msg('appFakturaMsg','Fant ikke faktura.','err'); return; }
    const kunde=f.kunde||appFirmaById(f.firma_id)||{};
    if(!kunde.epost){ msg('appFakturaMsg','Kunden mangler e-postadresse.','err'); return; }
    const settings=loadAppFakturaSettings();
    const subject='Faktura '+(f.nr||'')+' fra '+(settings.brevhode||app.firma?.navn||'Rettilomma');
    const body=[
      'Hei '+(kunde.navn||'')+',',
      '',
      'Vedlagt/gjeldende faktura '+(f.nr||'')+' for '+(f.tekst||'abonnement')+'.',
      'Beløp: '+kr(f.belop||0)+' kr',
      'Forfall: '+(f.forfall||''),
      '',
      'Kontonr: '+(settings.kontonr||''),
      '',
      'Hilsen',
      settings.brevhode||app.firma?.navn||'Rettilomma'
    ].filter(x=>x!==null).join('\n');
    window.location.href='mailto:'+encodeURIComponent(kunde.epost)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    const rows=loadAppFakturaerLocal();
    const row=rows.find(x=>String(x.id)===String(id));
    if(row && row.status==='opprettet'){ row.status='sendt'; row.sendt_dato=today(); saveAppFakturaerLocal(rows); renderAppFakturaer(); }
  }
  async function setAppFirmaRolle(firmaId, rolle){
    const profiler=(app.data.adminProfiler||[]).filter(p=>String(p.firma_id)===String(firmaId));
    let feil=[];
    for(const p of profiler){
      const {error}=await app.sb.from('hov_profiles').update({rolle}).eq('auth_user_id', p.auth_user_id);
      if(error) feil.push(error.message);
    }
    if(feil.length) throw new Error(feil[0]);
    await loadAdminData();
  }
  async function appFakturaBetalt(id){
    if(!app.isSysadm){ msg('appFakturaMsg','Bare sysadm kan sette appfaktura betalt.','err'); return; }
    const rows=loadAppFakturaerLocal();
    const f=rows.find(x=>String(x.id)===String(id));
    if(!f) return;
    f.status='betalt'; f.betalt_dato=today(); saveAppFakturaerLocal(rows);
    try{ await setAppFirmaRolle(f.firma_id,'hovslager'); msg('appFakturaMsg','Faktura er satt betalt og brukeren er aktivert.','ok'); }
    catch(e){ msg('appFakturaMsg','Faktura satt betalt, men kunne ikke aktivere bruker: '+(e.message||e),'err'); }
    renderAppFakturaer();
  }
  async function appFakturaDeaktiver(id){
    if(!app.isSysadm){ msg('appFakturaMsg','Bare sysadm kan deaktivere hovslagere.','err'); return; }
    const rows=loadAppFakturaerLocal();
    const f=rows.find(x=>String(x.id)===String(id));
    if(!f) return;
    if(!confirm('Deaktivere tilgang for '+((f.kunde&&f.kunde.navn)||'kunden')+'?')) return;
    f.status='deaktivert'; f.deaktivert_dato=today(); saveAppFakturaerLocal(rows);
    try{ await setAppFirmaRolle(f.firma_id,'deaktivert'); msg('appFakturaMsg','Kunden er deaktivert.','ok'); }
    catch(e){ msg('appFakturaMsg','Faktura markert deaktivert, men kunne ikke deaktivere bruker: '+(e.message||e),'err'); }
    renderAppFakturaer();
  }
  async function lagAppFaktura(){
    if(!app.isSysadm){ msg('appFakturaMsg','Bare sysadm kan lage appfaktura til hovslagere.','err'); return; }
    const firmaId=val('appFakturaFirma');
    const kunde=appFirmaById(firmaId);
    if(!firmaId || !kunde.id){ msg('appFakturaMsg','Velg hovslager/firma først.','err'); return; }
    const belop=num('appFakturaBelop');
    if(!belop){ msg('appFakturaMsg','Skriv beløp først.','err'); return; }
    const rows=loadAppFakturaerLocal();
    const settings=loadAppFakturaSettings();
    const f={id:String(Date.now())+'-'+Math.random().toString(36).slice(2), nr:appFakturaNr(), firma_id:firmaId, kunde:{navn:kunde.navn||'', epost:kunde.epost||'', adresse:kunde.adresse||''}, dato:today(), forfall:datePlusDays(val('appFakturaForfallDager')||14), tekst:val('appFakturaTekst')||settings.standardTekst||'Abonnement HovslagerSystem', belop, status:'opprettet'};
    rows.unshift(f); saveAppFakturaerLocal(rows); renderAppFakturaer(); msg('appFakturaMsg','Faktura '+f.nr+' er laget. Bruk Vis og Send e-post.','ok'); visAppFaktura(f.id);
  }
  function renderAppFakturaer(){
    const el=$('appFakturaList'); if(!el) return;
    if(!app.isSysadm){ el.innerHTML=''; return; }
    const rows=loadAppFakturaerLocal();
    const html=rows.map(f=>`<tr><td>${esc(f.dato||'')}</td><td>${esc(f.nr||'')}</td><td>${esc((f.kunde&&f.kunde.navn)||appFirmaById(f.firma_id).navn||'')}</td><td>${esc((f.kunde&&f.kunde.epost)||'')}</td><td>${kr(f.belop||0)}</td><td>${esc(f.forfall||'')}</td><td>${esc(f.status||'')}</td><td class="actions"><button type="button" class="small-btn secondary" data-app-vis="${esc(f.id)}">Vis</button><button type="button" class="small-btn" data-app-send="${esc(f.id)}">Send e-post</button>${f.status==='betalt'?'':`<button type="button" class="small-btn ok" data-app-betalt="${esc(f.id)}">Sett betalt</button>`}<button type="button" class="small-btn danger" data-app-deaktiver="${esc(f.id)}">Deaktiver</button></td></tr>`);
    el.innerHTML=table(['Dato','Nr','Hovslager','E-post','Beløp','Forfall','Status','Handling'], html);
    el.querySelectorAll('[data-app-vis]').forEach(b=>b.addEventListener('click',()=>visAppFaktura(b.dataset.appVis)));
    el.querySelectorAll('[data-app-send]').forEach(b=>b.addEventListener('click',()=>sendAppFakturaEpost(b.dataset.appSend)));
    el.querySelectorAll('[data-app-betalt]').forEach(b=>b.addEventListener('click',()=>appFakturaBetalt(b.dataset.appBetalt)));
    el.querySelectorAll('[data-app-deaktiver]').forEach(b=>b.addEventListener('click',()=>appFakturaDeaktiver(b.dataset.appDeaktiver)));
  }

  async function adminRunSystemBackup(){
    if(!confirm('Ta full systembackup av alle firmaer og systemtabeller?')) return;
    await runBackup({ mode:'manual', scope:'system' });
  }



  function fakturaForJobb(jobbId){
    return (app.data.fakturaer||[]).find(f =>
      String(f.jobb_id||'') === String(jobbId) ||
      String(f.jobb_ids||'').includes(String(jobbId)) ||
      (Array.isArray(f.jobber) && f.jobber.map(String).includes(String(jobbId)))
    );
  }

  function kreditnotaForFaktura(fakturaId){
    return (app.data.kreditnotaer||[]).find(k =>
      String(k.faktura_id||'') === String(fakturaId) ||
      String(k.original_faktura_id||'') === String(fakturaId)
    );
  }

  function fakturaNr(){
    const prefix = app.firma?.faktura_prefix || 'F';
    const neste = Number(app.firma?.neste_fakturanr || 1);
    return prefix + String(neste).padStart(4,'0');
  }

  async function incrementFakturaNr(){
    const neste = Number(app.firma?.neste_fakturanr || 1) + 1;
    const {data,error}=await app.sb.from('hov_firma').update({neste_fakturanr:neste}).eq('id',app.firmaId).select('*').single();
    if(!error && data){ app.firma=data; renderFirma(); }
  }

  async function lagFakturaFraJobb(jobbId){
    const j=(app.data.jobber||[]).find(x=>String(x.id)===String(jobbId));
    if(!j){ msg('fakturaMsg','Fant ikke jobben.','err'); return; }
    if(j.fakturert || fakturaForJobb(j.id)){
      msg('fakturaMsg','Jobben er allerede fakturert. Åpner fakturakopi i stedet.','err');
      visFakturaForJobb(j.id);
      return;
    }
    const kunde=(app.data.kunder||[]).find(k=>String(k.id)===String(j.kunde_id));
    const nr=fakturaNr();
    const dato=today();
    const forfall=new Date();
    forfall.setDate(forfall.getDate()+Number(app.firma?.betalingsfrist_dager || 14));
    const forfallsdato=forfall.toISOString().slice(0,10);
    const eks=Number(j.arbeid_belop||0)+Number(j.varer_belop||0)+(Number(j.km||0)*Number(j.km_pris||0));
    const mva=Number(j.mva || (eks * Number(app.firma?.standard_mva_sats || 25) / 100));
    const inkl=Number(j.total || (eks+mva));
    const payload={
      firma_id:app.firmaId,
      kunde_id:j.kunde_id,
      jobb_id:j.id,
      fakturanr:nr,
      dato,
      forfallsdato,
      eks_mva:eks,
      mva,
      inkl_mva:inkl,
      status:'ubetalt',
      betalingsstatus:'ubetalt',
      tekst:'Faktura for jobb '+(j.jobbtype||'')+' '+(j.dato||'')
    };
    const {data,error}=await app.sb.from('hov_fakturaer').insert(payload).select('*').single();
    if(error){ msg('fakturaMsg','Kunne ikke lage faktura: '+error.message,'err'); return; }
    const up=await app.sb.from('hov_jobber').update({fakturert:true}).eq('id',j.id).eq('firma_id',app.firmaId);
    if(up.error){ msg('fakturaMsg','Faktura laget, men jobb ble ikke merket fakturert: '+up.error.message,'err'); }
    await incrementFakturaNr();
    await loadJobber(); await loadFakturaer(); renderFakturaer();
    msg('fakturaMsg','Faktura '+nr+' er laget.','ok');
    visFaktura(data);
  }

  function fakturaHtml(f, opts){
    const options = opts || {};
    const kunde=(app.data.kunder||[]).find(k=>String(k.id)===String(f.kunde_id)) || {};
    const jobb=(app.data.jobber||[]).find(j=>String(j.id)===String(f.jobb_id)) || f._jobb || {};
    const hest=(app.data.hester||[]).find(h=>String(h.id)===String(jobb.hest_id)) || {};
    const firma=app.firma||{};
    const label = options.label || (f._preview ? 'Forhåndsvisning - ikke fakturert' : 'Kopi');
    const title = f._preview ? `Fakturautkast ${esc(f.fakturanr||'')}` : `Faktura ${esc(f.fakturanr||'')}`;
    const printScript = options.autoPrint === false ? '' : '<script>window.print && setTimeout(()=>window.print(),300)<\\/script>';
    return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:Arial,sans-serif;padding:30px;color:#111}h1{margin:0 0 10px}.top{display:flex;justify-content:space-between;gap:40px}.box{border:1px solid #ddd;padding:14px;margin:14px 0}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}.right{text-align:right}.muted{color:#666}.total{font-size:20px;font-weight:bold}.preview{display:inline-block;background:#fff3cd;border:1px solid #e0b94f;border-radius:999px;padding:6px 10px;color:#6b4e00;font-weight:bold}</style>
      </head><body>
      <div class="top"><div><h1>${title}</h1><div class="preview">${esc(label)}</div></div><div><strong>${esc(firma.navn||'')}</strong><br>${esc(firma.adresse||'')}<br>${esc(firma.postnr||'')} ${esc(firma.poststed||'')}<br>${esc(firma.epost||'')}<br>${esc(firma.telefon||'')}</div></div>
      <div class="box"><strong>Kunde</strong><br>${esc(kunde.navn||'')}<br>${esc(kunde.adresse||'')}<br>${esc(kunde.epost||'')}</div>
      <p><strong>Dato:</strong> ${esc(f.dato||'')}<br><strong>Forfall:</strong> ${esc(f.forfallsdato||'')}</p>
      <table><thead><tr><th>Beskrivelse</th><th>Hest</th><th class="right">Beløp eks. mva</th></tr></thead><tbody>
      <tr><td>${esc(jobb.jobbtype||f.tekst||'Hovslagerjobb')}<br><span class="muted">${esc(jobb.beskrivelse||'')}</span></td><td>${esc(hest.navn||'')}</td><td class="right">${kr(f.eks_mva||0)}</td></tr>
      </tbody></table>
      <p class="right">MVA: ${kr(f.mva||0)}</p>
      <p class="right total">Å betale: ${kr(f.inkl_mva||0)}</p>
      <div class="box"><strong>Betaling</strong><br>Kontonr: ${esc(firma.kontonr||'')}<br>Vipps: ${esc(firma.vippsnummer||'')} ${esc(firma.vipps_mottaker||'')}</div>
      ${printScript}
      </body></html>`;
  }

  function visFaktura(f, opts){
    if(!f){ msg('fakturaMsg','Fant ikke faktura.','err'); return; }
    const w=window.open('', '_blank');
    if(!w){ msg('fakturaMsg','Nettleseren blokkerte popup. Tillat popup for å vise faktura.','err'); return; }
    w.document.open(); w.document.write(fakturaHtml(f, opts)); w.document.close();
  }

  function visFakturaForJobb(jobbId){
    const f=fakturaForJobb(jobbId);
    if(!f){ msg('fakturaMsg','Fant ingen faktura for denne jobben.','err'); return; }
    visFaktura(f);
  }

  function fakturaUtkastFraJobb(jobbId){
    const j=(app.data.jobber||[]).find(x=>String(x.id)===String(jobbId));
    if(!j){ msg('fakturaMsg','Fant ikke jobben.','err'); return null; }
    const forfall=new Date();
    forfall.setDate(forfall.getDate()+Number(app.firma?.betalingsfrist_dager || 14));
    const eks=Number(j.arbeid_belop||0)+Number(j.varer_belop||0)+(Number(j.km||0)*Number(j.km_pris||0));
    const mva=Number(j.mva || (eks * Number(app.firma?.standard_mva_sats || 25) / 100));
    const inkl=Number(j.total || (eks+mva));
    return {
      firma_id:app.firmaId,
      kunde_id:j.kunde_id,
      jobb_id:j.id,
      fakturanr:fakturaNr(),
      dato:today(),
      forfallsdato:forfall.toISOString().slice(0,10),
      eks_mva:eks,
      mva,
      inkl_mva:inkl,
      status:'forhåndsvisning',
      betalingsstatus:'ikke opprettet',
      tekst:'Fakturautkast for jobb '+(j.jobbtype||'')+' '+(j.dato||''),
      _preview:true,
      _jobb:j
    };
  }

  function forhåndsvisFakturaFraJobb(jobbId){
    const f=fakturaUtkastFraJobb(jobbId);
    if(!f) return;
    visFaktura(f, {autoPrint:false, label:'Forhåndsvisning - ikke fakturert'});
  }

  async function sendPurring(fakturaId){
    const f=(app.data.fakturaer||[]).find(x=>String(x.id)===String(fakturaId));
    if(!f){ msg('fakturaMsg','Fant ikke faktura for purring.','err'); return; }
    const nyStatus='purret';
    const {error}=await app.sb.from('hov_fakturaer').update({status:nyStatus, betalingsstatus:nyStatus, purret_dato:today()}).eq('id',f.id);
    if(error){ msg('fakturaMsg','Kunne ikke markere purring: '+error.message,'err'); return; }
    await loadFakturaer(); renderFakturaer();
    msg('fakturaMsg','Faktura '+(f.fakturanr||'')+' er markert som purret.','ok');
  }

  async function settFakturaBetalt(fakturaId){
    const f=(app.data.fakturaer||[]).find(x=>String(x.id)===String(fakturaId));
    if(!f){ msg('fakturaMsg','Fant ikke fakturaen som skal settes betalt.','err'); return; }
    const payload={status:'betalt', betalingsstatus:'betalt', betalt_dato:today()};
    const {error}=await app.sb.from('hov_fakturaer').update(payload).eq('id',f.id);
    if(error){ msg('fakturaMsg','Kunne ikke sette faktura betalt: '+error.message,'err'); return; }
    await loadFakturaer(); renderFakturaer();
    msg('fakturaMsg','Faktura '+(f.fakturanr||'')+' er satt som betalt.','ok');
  }

  async function lagKreditnota(fakturaId){
    const f=(app.data.fakturaer||[]).find(x=>String(x.id)===String(fakturaId));
    if(!f){ msg('fakturaMsg','Fant ikke faktura.','err'); return; }
    if(kreditnotaForFaktura(f.id)){ msg('fakturaMsg','Det finnes allerede kreditnota på denne fakturaen.','err'); return; }
    if(!confirm('Lage kreditnota for faktura '+(f.fakturanr||'')+'?')) return;
    const payload={
      firma_id:app.firmaId,
      kunde_id:f.kunde_id,
      faktura_id:f.id,
      original_faktura_id:f.id,
      kreditnotanr:'K-'+(f.fakturanr||Date.now()),
      dato:today(),
      eks_mva:-Math.abs(Number(f.eks_mva||0)),
      mva:-Math.abs(Number(f.mva||0)),
      inkl_mva:-Math.abs(Number(f.inkl_mva||0)),
      status:'kreditert',
      tekst:'Kreditnota for faktura '+(f.fakturanr||'')
    };
    const {error}=await app.sb.from('hov_kreditnotaer').insert(payload);
    if(error){ msg('fakturaMsg','Kunne ikke lage kreditnota: '+error.message,'err'); return; }
    await app.sb.from('hov_fakturaer').update({status:'kreditert', betalingsstatus:'kreditert'}).eq('id',f.id);
    if(f.jobb_id){
      await app.sb.from('hov_jobber').update({fakturert:false}).eq('id',f.jobb_id).eq('firma_id',app.firmaId);
    }
    await loadKreditnotaer(); await loadFakturaer(); await loadJobber(); renderFakturaer();
    msg('fakturaMsg','Kreditnota er laget. Jobben er åpnet for ny fakturering.','ok');
  }

  function fakturaStatus(f){
    return f.betalingsstatus || f.status || '';
  }

  function renderFakturaer(){
    const el=$('fakturaList'); if(!el) return;
    const jobber=app.data.jobber||[];
    const fakturaer=app.data.fakturaer||[];
    const rows=[];

    for(const j of jobber){
      const f=fakturaForJobb(j.id);
      const kunde=kundeNavn(j.kunde_id);
      const hest=hestNavn(j.hest_id);
      if(f || j.fakturert){
        rows.push(`<tr><td>${esc(j.dato||'')}</td><td>${esc(kunde)}</td><td>${esc(hest)}</td><td>${esc(j.jobbtype||'')}</td><td>${kr(j.total||f?.inkl_mva||0)}</td><td><span class="pill">Fakturert</span><br>${esc(f?.fakturanr||'Mangler fakturanr')}</td><td>${esc(f?fakturaStatus(f):'')}</td><td class="actions"><button type="button" class="small-btn secondary" data-vis-faktura="${esc(j.id)}">Vis kopi</button>${f?`${fakturaStatus(f)==='betalt' ? '' : `<button type="button" class="small-btn ok" data-sett-betalt="${esc(f.id)}">Sett betalt</button>`}<button type="button" class="small-btn secondary" data-purr="${esc(f.id)}">Purr</button><button type="button" class="small-btn danger" data-kredit="${esc(f.id)}">Kreditt</button>`:''}</td></tr>`);
      }else{
        rows.push(`<tr><td>${esc(j.dato||'')}</td><td>${esc(kunde)}</td><td>${esc(hest)}</td><td>${esc(j.jobbtype||'')}</td><td>${kr(j.total||0)}</td><td><span class="pill">Ikke fakturert</span></td><td>klar</td><td class="actions"><button type="button" class="small-btn secondary" data-preview-faktura="${esc(j.id)}">Forhåndsvis</button><button type="button" class="small-btn" data-fakturer="${esc(j.id)}">Lag faktura</button></td></tr>`);
      }
    }

    for(const f of fakturaer){
      if(f.jobb_id && jobber.some(j=>String(j.id)===String(f.jobb_id))) continue;
      rows.push(`<tr><td>${esc(f.dato||'')}</td><td>${esc(kundeNavn(f.kunde_id))}</td><td></td><td>${esc(f.tekst||'Faktura')}</td><td>${kr(f.inkl_mva||0)}</td><td><span class="pill">Fakturert</span><br>${esc(f.fakturanr||'')}</td><td>${esc(fakturaStatus(f))}</td><td class="actions"><button type="button" class="small-btn secondary" data-vis-faktura-id="${esc(f.id)}">Vis kopi</button>${fakturaStatus(f)==='betalt' ? '' : `<button type="button" class="small-btn ok" data-sett-betalt="${esc(f.id)}">Sett betalt</button>`}<button type="button" class="small-btn secondary" data-purr="${esc(f.id)}">Purr</button><button type="button" class="small-btn danger" data-kredit="${esc(f.id)}">Kreditt</button></td></tr>`);
    }

    const head=['Dato','Kunde','Hest','Jobb/Faktura','Beløp','Fakturastatus','Betaling','Handling'];
    el.innerHTML = table(head, rows);
    bindFakturaActions();
    const sumAlle=jobber.length;
    const sumUfakt=jobber.filter(j=>!j.fakturert && !fakturaForJobb(j.id)).length;
    const sumFakt=sumAlle-sumUfakt;
    const msgEl=$('fakturaMsg');
    if(msgEl && !msgEl.innerHTML) msgEl.innerHTML=`<div class="msg">Jobber: ${sumAlle}. Ikke fakturert: ${sumUfakt}. Fakturert: ${sumFakt}.</div>`;
  }

  function bindFakturaActions(){
    const el=$('fakturaList'); if(!el) return;
    el.querySelectorAll('[data-preview-faktura]').forEach(b=>b.addEventListener('click',()=>forhåndsvisFakturaFraJobb(b.dataset.previewFaktura)));
    el.querySelectorAll('[data-fakturer]').forEach(b=>b.addEventListener('click',()=>lagFakturaFraJobb(b.dataset.fakturer)));
    el.querySelectorAll('[data-vis-faktura]').forEach(b=>b.addEventListener('click',()=>visFakturaForJobb(b.dataset.visFaktura)));
    el.querySelectorAll('[data-vis-faktura-id]').forEach(b=>b.addEventListener('click',()=>{
      const f=(app.data.fakturaer||[]).find(x=>String(x.id)===String(b.dataset.visFakturaId));
      visFaktura(f);
    }));
    el.querySelectorAll('[data-sett-betalt]').forEach(b=>b.addEventListener('click',()=>settFakturaBetalt(b.dataset.settBetalt)));
    el.querySelectorAll('[data-purr]').forEach(b=>b.addEventListener('click',()=>sendPurring(b.dataset.purr)));
    el.querySelectorAll('[data-kredit]').forEach(b=>b.addEventListener('click',()=>lagKreditnota(b.dataset.kredit)));
  }


  function renderAll(){ renderDashboard(); renderKunder(); renderHester(); renderJobber(); renderFakturaer(); renderPriser(); fillKundeSelects(); fillHestSelects(); fillJobbTypeSelect(); }
  function renderDashboard(){
    const rows=[['Kunder',app.data.kunder.length],['Hester',app.data.hester.length],['Jobber',app.data.jobber.length],['Fakturaer',app.data.fakturaer.length],['Kreditnotaer',app.data.kreditnotaer.length]];
    $('dashCounts').innerHTML = rows.map(r=>`<div class="col-3"><div class="card"><h3>${r[1]}</h3><div class="muted">${r[0]}</div></div></div>`).join('');
  }
  function table(headers, rows){ if(!rows.length) return '<div class="msg">Ingen data å vise.</div>'; return `<div style="overflow:auto"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`; }
  function kundeNavn(id){ return app.data.kunder.find(k=>String(k.id)===String(id))?.navn || id || ''; }
  function hestNavn(id){ return app.data.hester.find(h=>String(h.id)===String(id))?.navn || id || ''; }
  function renderKunder(){ $('kundeList').innerHTML = table(['Navn','Telefon','E-post','Adresse',''], app.data.kunder.map(k=>`<tr class="click-row${selectedRowClass('kunde',k.id)}" data-id="${esc(k.id)}"><td>${esc(k.navn)}</td><td>${esc(k.telefon)}</td><td>${esc(k.epost)}</td><td>${esc(k.adresse)}</td><td class="muted">Klikk for å redigere</td></tr>`)); bindClickableRows('kundeList','kunde', editKunde); }
  function renderHester(){ $('hestList').innerHTML = table(['Bilde','Navn','Eier','Rase','Neste besøk',''], app.data.hester.map(h=>`<tr class="click-row${selectedRowClass('hest',h.id)}" data-id="${esc(h.id)}"><td>${imgUrl(h)?`<img class="thumb small" src="${esc(imgUrl(h))}" alt="Hest">`:''}</td><td>${esc(h.navn)}</td><td>${esc(kundeNavn(h.kunde_id))}</td><td>${esc(h.rase)}</td><td>${esc(h.neste_besok)}</td><td class="muted">Klikk for å redigere</td></tr>`)); bindClickableRows('hestList','hest', editHest); }
  function renderJobber(){ $('jobbList').innerHTML = table(['Dato','Kunde','Hest','Jobbtype','Total','Bilder','Fakturert',''], app.data.jobber.map(j=>`<tr class="click-row${selectedRowClass('jobb',j.id)}" data-id="${esc(j.id)}"><td>${esc(j.dato)}</td><td>${esc(kundeNavn(j.kunde_id))}</td><td>${esc(hestNavn(j.hest_id))}</td><td>${esc(j.jobbtype)}</td><td>${kr(j.total)}</td><td>${jobBilder(j).length}</td><td>${j.fakturert?'Ja':'Nei'}</td><td><button type="button" class="small-btn secondary" data-id="${esc(j.id)}">Les inn</button></td></tr>`)); bindClickableRows('jobbList','jobb', editJobb); bindLesInnJobbButtons(); }

  function renderPriser(){
    const rows=(app.data.priser||[]).map(p=>`<tr class="click-row${selectedRowClass('pris',p.id)}" data-id="${esc(p.id)}"><td>${esc(p.kategori||'')}</td><td>${esc(p.varenr||'')}</td><td>${esc(p.navn||p.jobbtype||p.vare||p.type||'')}</td><td>${esc(p.enhet||'')}</td><td>${kr(p.pris_eks_mva ?? p.pris ?? p.belop ?? p.eks_mva)}</td><td>${kr(p.pris_inkl_mva ?? 0)}</td><td>${esc(p.aktiv === false ? 'Nei' : 'Ja')}</td><td>${esc(p.beskrivelse||'')}</td><td class="muted">Klikk for å redigere</td></tr>`);
    $('prisList').innerHTML = table(['Kategori','Varenr','Navn','Enhet','Eks. mva','Inkl. mva','Aktiv','Beskrivelse',''], rows);
    bindClickableRows('prisList','pris', editPris);
  }

  function fillSelect(sel, rows, valueKey, textFn, empty){ const el=$(sel); if(!el) return; const old=el.value; el.innerHTML = `<option value="">${empty||'Velg'}</option>` + rows.map(r=>`<option value="${esc(r[valueKey])}">${esc(textFn(r))}</option>`).join(''); if(old) el.value=old; }
  function fillKundeSelects(){ fillSelect('hestKunde',app.data.kunder,'id',k=>k.navn,'Velg kunde'); fillSelect('jobbKunde',app.data.kunder,'id',k=>k.navn,'Velg kunde'); fillJobbHester(); syncJobbKundeHestLock(); }
  function fillHestSelects(){ fillJobbHester(); syncJobbKundeHestLock(); }
  function valgtJobbHest(){ const hid=$('jobbHest')?.value; return hid ? app.data.hester.find(h=>String(h.id)===String(hid)) : null; }
  function setJobbKundeLocked(locked){
    const el=$('jobbKunde'); if(!el) return;
    el.disabled = !!locked;
    el.classList.toggle('locked-field', !!locked);
    el.title = locked ? 'Kunde/eier låses automatisk av valgt hest.' : '';
  }
  function syncJobbKundeHestLock(){
    const h=valgtJobbHest();
    if(h && h.kunde_id){ setVal('jobbKunde', h.kunde_id); setJobbKundeLocked(true); }
    else setJobbKundeLocked(false);
  }
  function fillJobbHester(){
    const kid=$('jobbKunde')?.value;
    const rows=kid?app.data.hester.filter(h=>String(h.kunde_id)===String(kid)):app.data.hester;
    fillSelect('jobbHest',rows,'id',h=>h.navn,'Velg hest');
  }
  function onJobbKundeChange(){
    setJobbKundeLocked(false);
    fillJobbHester();
    const h=valgtJobbHest();
    const kid=$('jobbKunde')?.value;
    if(h && kid && String(h.kunde_id)!==String(kid)) setVal('jobbHest','');
  }
  function onJobbHestChange(){
    const h=valgtJobbHest();
    if(h && h.kunde_id){ setVal('jobbKunde', h.kunde_id); setJobbKundeLocked(true); }
    else setJobbKundeLocked(false);
  }

  function prisNavn(p){ return p?.navn || p?.jobbtype || p?.vare || p?.type || ''; }
  function prisEksMva(p){ return Number(p?.pris_eks_mva ?? p?.pris ?? p?.belop ?? p?.eks_mva ?? 0) || 0; }
  function fillJobbTypeSelect(){
    const el=$('jobbType'); if(!el) return;
    const old=el.value;
    const aktive=(app.data.priser||[])
      .filter(p=>p && p.aktiv !== false && prisNavn(p))
      .sort((a,b)=>prisNavn(a).localeCompare(prisNavn(b),'nb'));
    const seen=new Set();
    let html='<option value="">Velg jobbtype/pris</option>';
    for(const p of aktive){
      const navn=prisNavn(p); const key=navn.toLowerCase();
      if(seen.has(key)) continue; seen.add(key);
      const eks=prisEksMva(p);
      const label = eks ? `${navn} - ${kr(eks)} eks. mva` : navn;
      html += `<option value="${esc(navn)}" data-pris-id="${esc(p.id)}">${esc(label)}</option>`;
    }
    if(old && !seen.has(String(old).toLowerCase())) html += `<option value="${esc(old)}">${esc(old)}</option>`;
    el.innerHTML=html;
    if(old) el.value=old;
  }
  function applySelectedJobbTypePris(){
    const el=$('jobbType'); if(!el) return;
    const opt=el.selectedOptions?.[0];
    const id=opt?.dataset?.prisId;
    const p=id ? app.data.priser.find(x=>String(x.id)===String(id)) : null;
    if(!p) return;
    const eks=prisEksMva(p);
    if(eks) setVal('jobbArbeid', eks);
    if(!val('jobbBeskrivelse') && p.beskrivelse) setVal('jobbBeskrivelse', p.beskrivelse);
  }




  function speechApi(){ return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
  function startVoiceJobb(){
    const Speech = speechApi();
    if(!Speech){ msg('voiceJobbMsg','Denne nettleseren støtter ikke talegjenkjenning. Bruk Chrome/Edge på PC eller Android, eller skriv teksten i feltet og trykk Bruk tekst i ny jobb.','err'); return; }
    try{
      stopVoiceJobb(true);
      const rec = new Speech();
      app.voiceRecognition = rec;
      app.voiceActive = true;
      app.voiceStopping = false;
      rec.lang = 'nb-NO';
      rec.interimResults = true;
      rec.continuous = true;
      let finalText = val('voiceJobbText');
      rec.onstart = () => {
        setVoiceButtons(true);
        msg('voiceJobbMsg','Lytter ... snakk inn jobben. Trykk Stopp når du er ferdig.','ok');
      };
      rec.onerror = (ev) => {
        app.voiceActive = false;
        setVoiceButtons(false);
        msg('voiceJobbMsg','Mikrofon/tale feilet: '+(ev.error || 'ukjent feil')+'. Sjekk at siden har tilgang til mikrofon.','err');
      };
      rec.onend = () => {
        const wasActive = app.voiceActive;
        app.voiceActive = false;
        setVoiceButtons(false);
        if(app.voiceRecognition === rec) app.voiceRecognition = null;
        if(wasActive && !app.voiceStopping) msg('voiceJobbMsg','Mikrofon stoppet av nettleseren. Trykk Les inn ny jobb for å starte igjen.','ok');
      };
      rec.onresult = (ev) => {
        let interim = '';
        for(let i=ev.resultIndex; i<ev.results.length; i++){
          const txt = ev.results[i][0]?.transcript || '';
          if(ev.results[i].isFinal) finalText = (finalText + ' ' + txt).trim();
          else interim += txt;
        }
        setVal('voiceJobbText', (finalText + (interim ? ' ' + interim : '')).trim());
      };
      rec.start();
    }catch(err){
      app.voiceActive = false;
      setVoiceButtons(false);
      msg('voiceJobbMsg','Kunne ikke starte mikrofon: '+(err.message || err),'err');
    }
  }
  function setVoiceButtons(listening){
    const start=$('voiceNewJobbBtn'), stop=$('voiceStopJobbBtn');
    if(start) start.textContent = listening ? '🎙 Lytter ...' : '🎙 Snakk inn ny jobb';
    if(start) start.disabled = !!listening;
    if(stop) stop.disabled = !listening && !val('voiceJobbText');
  }
  function stopVoiceJobb(silent){
    const rec = app.voiceRecognition;
    app.voiceStopping = true;
    app.voiceActive = false;
    app.voiceRecognition = null;
    setVoiceButtons(false);

    // Viktig: lagre fra teksten som allerede står i feltet med en gang.
    // Chrome kan bruke lang tid på rec.stop(), og da virker det som Stopp-knappen ikke gjør noe.
    if(!silent){
      const textNow = val('voiceJobbText');
      if(textNow){
        msg('voiceJobbMsg','Stoppet. Lager og lagrer jobben nå ...','ok');
        applyVoiceTextAsJobb({autoSave:true, restart:false});
      }else{
        msg('voiceJobbMsg','Stoppet. Ingen tekst å lagre.','ok');
      }
    }

    if(rec){
      try{ rec.onresult = null; rec.onerror = null; rec.onend = null; rec.stop(); }
      catch(_){ try{ rec.abort(); }catch(__){} }
      setTimeout(()=>{ try{ rec.abort(); }catch(_){} }, 500);
    }
  }
  function normText(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function findNamed(rows, text, keys){
    const ntext = normText(text);
    const sorted = (rows||[]).slice().sort((a,b)=>String(b.navn||'').length-String(a.navn||'').length);
    for(const r of sorted){
      for(const key of keys){
        const name = normText(r?.[key] || '');
        if(name && ntext.includes(name)) return r;
      }
    }
    return null;
  }
  function numberAfter(text, words){
    const ntext = normText(text).replace(/,/g,'.');
    for(const w of words){
      const re = new RegExp('(?:'+w+')\\s*(?:er|pa|på|=|:)?\\s*(\\d+(?:\\.\\d+)?)','i');
      const m = ntext.match(re);
      if(m) return m[1];
    }
    return '';
  }
  function numberNear(text, words){
    const ntext = normText(text).replace(/,/g,'.');
    const wordPattern = words.join('|');
    const after = new RegExp('(?:'+wordPattern+')\\s*(?:er|pa|på|=|:)?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:km|kilometer)?','i');
    const before = new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:km|kilometer)?\\s*(?:'+wordPattern+')','i');
    const plainKm = ntext.match(/(\\d+(?:\\.\\d+)?)\\s*(?:km|kilometer)\\b/i);
    const m = ntext.match(after) || ntext.match(before) || plainKm;
    return m ? m[1] : '';
  }
  function isSkoingText(text){
    const ntext = normText(text);
    return /\b(skodde|sko(dd|ing|e)?|skoing|beslag|fullbeslag)\b/i.test(ntext);
  }
  function findFullbeslagPris(){
    return (app.data.priser||[]).find(p=>/full\s*beslag|fullbeslag/i.test(normText(prisNavn(p)))) || null;
  }
  function setJobbTypeByName(name){
    fillJobbTypeSelect();
    const el=$('jobbType'); if(!el) return;
    const wanted = normText(name);
    const opt = Array.from(el.options || []).find(o=>normText(o.value)===wanted || normText(o.textContent).includes(wanted));
    if(opt){ el.value = opt.value; applySelectedJobbTypePris(); return; }
    const old = el.value;
    el.innerHTML += `<option value="${esc(name)}">${esc(name)}</option>`;
    el.value = name;
    if(!old) setVal('jobbArbeid', val('jobbArbeid') || 0);
  }
  function textAfter(text, words){
    const ntext = String(text||'');
    for(const w of words){
      const re = new RegExp(w+'\\s*[:,-]?\\s*(.+)$','i');
      const m = ntext.match(re);
      if(m) return m[1].trim();
    }
    return '';
  }
  async function applyVoiceTextAsJobb(options){
    const opts = options && !options.target ? options : {};
    if(opts.autoSave && app.voiceProcessing) return;
    if(opts.autoSave) app.voiceProcessing = true;
    const text = val('voiceJobbText');
    if(!text){ msg('voiceJobbMsg','Snakk inn eller skriv tekst først.','err'); return; }
    openBlankJobbFromDashboard(true);
    const hest = findNamed(app.data.hester, text, ['navn']);
    const kunde = findNamed(app.data.kunder, text, ['navn','kontaktperson']);
    let pris = findNamed(app.data.priser, text, ['navn','jobbtype','vare','type']);
    if(isSkoingText(text)) pris = findFullbeslagPris() || pris;
    if(hest){ setVal('jobbHest', hest.id); if(hest.kunde_id) setVal('jobbKunde', hest.kunde_id); syncJobbKundeHestLock(); }
    else if(kunde){ setJobbKundeLocked(false); setVal('jobbKunde', kunde.id); fillJobbHester(); }
    if(pris){ fillJobbTypeSelect(); setVal('jobbType', prisNavn(pris)); applySelectedJobbTypePris(); }
    else if(isSkoingText(text)){ setJobbTypeByName('Fullbeslag'); }
    const km = numberNear(text, ['km','kilometer','kjoring','kjøring','kjorte','kjørte','kjort','kjørt','kjoriig','kjøriig']);
    const arbeid = numberAfter(text, ['arbeid','jobb','belop','beløp','pris']);
    const varer = numberAfter(text, ['varer','utlegg','materialer']);
    if(km) setVal('jobbKm', km);
    if(arbeid) setVal('jobbArbeid', arbeid);
    if(varer) setVal('jobbVarer', varer);
    const beskrivelse = textAfter(text, ['beskrivelse','notat','kommentar']) || text;
    setVal('jobbBeskrivelse', beskrivelse);
    if(opts.autoSave){
      msg('jobbMsg','Lagrer jobb fra tale ...','ok');
      msg('voiceJobbMsg','Lagrer jobb fra tale ...','ok');
      const ok = await saveJobb({fromVoice:true});
      if(ok){
        setVal('voiceJobbText','');
        showTab('dashboard');
        msg('voiceJobbMsg','Jobben er lagret. Klar for neste jobb.','ok');
        
      }else{
        msg('voiceJobbMsg','Jobben ble ikke lagret. Sjekk feilmeldingen i jobbskjemaet, rett feltene og trykk Lagre jobb.','err');
      }
      app.voiceProcessing = false;
      return;
    }
    app.voiceProcessing = false;
    msg('jobbMsg','Ny jobb er fylt ut fra tale/tekst. Kontroller kunde, hest, pris og beløp før du lagrer.','ok');
    msg('voiceJobbMsg','Teksten er lagt inn som ny jobb.','ok');
  }
  function openBlankJobbFromDashboard(skipMsg){
    clearJobbForm();
    showTab('jobber');
    setText('jobbFormTitle','Ny jobb');
    if(!skipMsg) msg('jobbMsg','Ny tom jobb åpnet. Du kan fylle ut eller bruke mikrofon fra forsiden.','ok');
    document.getElementById('jobber')?.scrollIntoView({behavior:'smooth', block:'start'});
  }

  function bindLesInnJobbButtons(){
    const el=$('jobbList'); if(!el) return;
    el.querySelectorAll('button.small-btn[data-id]').forEach(btn=>{
      btn.addEventListener('click',(ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        readJobbAsNew(btn.dataset.id);
      });
    });
  }

  async function readLastJobbAsNew(){
    if(!app.firmaId){ msg('dashMsg','Data er ikke ferdig lastet. Prøv igjen om et øyeblikk.','err'); return; }
    if(!app.data.jobber || !app.data.jobber.length){
      msg('dashMsg','Henter jobber...','');
      await loadJobber();
    }
    const j=(app.data.jobber||[])[0];
    if(!j){ msg('dashMsg','Ingen tidligere jobber å lese inn.','err'); return; }
    readJobbAsNew(j.id);
  }

  function readJobbAsNew(id){
    const j = app.data.jobber.find(x=>String(x.id)===String(id));
    if(!j){ msg('dashMsg','Fant ikke jobben som skulle leses inn.','err'); return; }
    app.edit.jobb = null;
    showTab('jobber');
    setText('jobbFormTitle','Ny jobb basert på innlest jobb');
    setText('saveJobbBtn','Lagre jobb');
    $('deleteJobbBtn')?.classList.add('hidden');
    setVal('jobbDato', today());
    setJobbKundeLocked(false);
    setVal('jobbKunde', j.kunde_id || '');
    fillJobbHester();
    setVal('jobbHest', j.hest_id || '');
    syncJobbKundeHestLock();
    fillJobbTypeSelect();
    setVal('jobbType', j.jobbtype || '');
    setVal('jobbKm', j.km ?? '');
    setVal('jobbKmPris', j.km_pris ?? '5,30');
    setVal('jobbArbeid', j.arbeid_belop ?? 0);
    setVal('jobbVarer', j.varer_belop ?? '');
    setVal('jobbBeskrivelse', j.beskrivelse || '');
    setVal('jobbBildeDato', today());
    if($('jobbBildeFiles')) $('jobbBildeFiles').value='';
    renderJobbBildePreview([]);
    renderJobber();
    msg('jobbMsg','Leste inn jobb: '+(hestNavn(j.hest_id)||'')+' - '+(j.jobbtype||'')+'. Kontroller dato og lagre som ny jobb.','ok');
    document.getElementById('jobber')?.scrollIntoView({behavior:'smooth', block:'start'});
  }


  function editKunde(id){
    const k = app.data.kunder.find(x=>String(x.id)===String(id)); if(!k) return;
    app.edit.kunde = k.id;
    setVal('kundeNavn',k.navn); setVal('kundeTelefon',k.telefon); setVal('kundeEpost',k.epost); setVal('kundeKontakt',k.kontaktperson); setVal('kundeAdresse',k.adresse);
    setText('kundeFormTitle','Rediger kunde'); setText('saveKundeBtn','Oppdater kunde'); $('deleteKundeBtn')?.classList.remove('hidden'); renderKunder(); msg('kundeMsg','Redigerer kunde: '+(k.navn||''),'ok');
  }
  function clearKundeForm(){ app.edit.kunde=null; ['kundeNavn','kundeTelefon','kundeEpost','kundeKontakt','kundeAdresse'].forEach(id=>setVal(id,'')); setText('kundeFormTitle','Ny kunde'); setText('saveKundeBtn','Lagre kunde'); $('deleteKundeBtn')?.classList.add('hidden'); renderKunder(); msg('kundeMsg',''); }
  async function deleteKunde(){
    if(!app.edit.kunde){ msg('kundeMsg','Velg en kunde først.','err'); return; }
    if(!confirm('Slette valgt kunde?')) return;
    const {error}=await app.sb.from('hov_kunder').delete().eq('id',app.edit.kunde).eq('firma_id',app.firmaId);
    msg('kundeMsg', error?error.message:'Kunde slettet.', error?'err':'ok'); if(!error){ clearKundeForm(); await loadKunder(); await loadHester(); await loadJobber(); }
  }

  function editHest(id){
    const h = app.data.hester.find(x=>String(x.id)===String(id)); if(!h) return;
    app.edit.hest = h.id;
    setVal('hestKunde',h.kunde_id); setVal('hestNavn',h.navn); setVal('hestRase',h.rase); setVal('hestSist',h.sist_skodd); setVal('hestNeste',h.neste_besok); setVal('hestNotater',h.notater); renderImagePreview('hestBildePreview', imgUrl(h)); if($('hestBildeFile')) $('hestBildeFile').value='';
    setText('hestFormTitle','Rediger hest'); setText('saveHestBtn','Oppdater hest'); $('deleteHestBtn')?.classList.remove('hidden'); renderHester(); msg('hestMsg','Redigerer hest: '+(h.navn||''),'ok');
  }
  function clearHestForm(){ app.edit.hest=null; ['hestNavn','hestRase','hestSist','hestNeste','hestNotater'].forEach(id=>setVal(id,'')); setVal('hestKunde',''); if($('hestBildeFile')) $('hestBildeFile').value=''; renderImagePreview('hestBildePreview',''); setText('hestFormTitle','Ny hest'); setText('saveHestBtn','Lagre hest'); $('deleteHestBtn')?.classList.add('hidden'); renderHester(); msg('hestMsg',''); }
  async function deleteHest(){
    if(!app.edit.hest){ msg('hestMsg','Velg en hest først.','err'); return; }
    if(!confirm('Slette valgt hest?')) return;
    const {error}=await app.sb.from('hov_hester').delete().eq('id',app.edit.hest).eq('firma_id',app.firmaId);
    msg('hestMsg', error?error.message:'Hest slettet.', error?'err':'ok'); if(!error){ clearHestForm(); await loadHester(); await loadJobber(); }
  }

  function editJobb(id){
    const j = app.data.jobber.find(x=>String(x.id)===String(id)); if(!j) return;
    app.edit.jobb = j.id;
    setVal('jobbDato',j.dato); setJobbKundeLocked(false); setVal('jobbKunde',j.kunde_id); fillJobbHester(); setVal('jobbHest',j.hest_id); syncJobbKundeHestLock(); fillJobbTypeSelect(); setVal('jobbType',j.jobbtype); setVal('jobbKm',j.km); setVal('jobbKmPris',j.km_pris ?? '5,30'); setVal('jobbArbeid',j.arbeid_belop); setVal('jobbVarer',j.varer_belop ?? ''); setVal('jobbBeskrivelse',j.beskrivelse); setVal('jobbBildeDato',j.dato || today()); renderJobbBildePreview(jobBilder(j)); if($('jobbBildeFiles')) $('jobbBildeFiles').value='';
    setText('jobbFormTitle','Rediger jobb'); setText('saveJobbBtn','Oppdater jobb'); $('deleteJobbBtn')?.classList.remove('hidden'); renderJobber(); msg('jobbMsg','Redigerer jobb fra '+(j.dato||''),'ok');
  }
  function clearJobbForm(){ app.edit.jobb=null; ['jobbBeskrivelse'].forEach(id=>setVal(id,'')); setVal('jobbType',''); setVal('jobbDato',today()); setVal('jobbBildeDato',today()); setJobbKundeLocked(false); setVal('jobbKunde',''); fillJobbHester(); setVal('jobbHest',''); setVal('jobbKm',''); setVal('jobbKmPris','5,30'); setVal('jobbArbeid',0); setVal('jobbVarer',''); if($('jobbBildeFiles')) $('jobbBildeFiles').value=''; renderJobbBildePreview([]); setText('jobbFormTitle','Ny jobb'); setText('saveJobbBtn','Lagre jobb'); $('deleteJobbBtn')?.classList.add('hidden'); renderJobber(); msg('jobbMsg',''); }
  async function deleteJobb(){
    if(!app.edit.jobb){ msg('jobbMsg','Velg en jobb først.','err'); return; }
    if(!confirm('Slette valgt jobb?')) return;
    const {error}=await app.sb.from('hov_jobber').delete().eq('id',app.edit.jobb).eq('firma_id',app.firmaId);
    msg('jobbMsg', error?error.message:'Jobb slettet.', error?'err':'ok'); if(!error){ clearJobbForm(); await loadJobber(); }
  }

  function editPris(id){
    const p = app.data.priser.find(x=>String(x.id)===String(id)); if(!p) return;
    app.edit.pris = p.id;
    setVal('prisKategori',p.kategori); setVal('prisVarenr',p.varenr); setVal('prisNavn',p.navn||p.jobbtype||p.vare||p.type); setVal('prisEnhet',p.enhet||'stk'); setVal('prisEksMva',p.pris_eks_mva ?? p.pris ?? p.belop ?? p.eks_mva ?? 0); setVal('prisMvaSats',p.mva_sats ?? app.firma?.standard_mva_sats ?? 25); setVal('prisInklMva',p.pris_inkl_mva ?? 0); setChecked('prisAktiv',p.aktiv !== false); setVal('prisBeskrivelse',p.beskrivelse);
    setText('prisFormTitle','Rediger pris'); setText('savePrisBtn','Oppdater pris'); $('deletePrisBtn')?.classList.remove('hidden'); renderPriser(); msg('prisImportMsg','Redigerer pris: '+(p.navn||p.jobbtype||p.vare||''),'ok');
  }
  function clearPrisForm(){ app.edit.pris=null; ['prisKategori','prisVarenr','prisNavn','prisBeskrivelse'].forEach(id=>setVal(id,'')); setVal('prisEnhet','stk'); setVal('prisEksMva',0); setVal('prisMvaSats',app.firma?.standard_mva_sats ?? 25); setVal('prisInklMva',0); setChecked('prisAktiv',true); setText('prisFormTitle','Ny pris'); setText('savePrisBtn','Lagre pris'); $('deletePrisBtn')?.classList.add('hidden'); renderPriser(); msg('prisImportMsg',''); }
  async function savePris(){
    const eks=num('prisEksMva'); const sats=num('prisMvaSats'); const inkl = num('prisInklMva') || +(eks * (1 + sats/100)).toFixed(2);
    const payload={firma_id:app.firmaId, kategori:val('prisKategori')||null, varenr:val('prisVarenr')||null, navn:val('prisNavn'), enhet:val('prisEnhet')||'stk', pris_eks_mva:eks, mva_sats:sats, pris_inkl_mva:inkl, aktiv:$('prisAktiv')?.checked !== false, beskrivelse:val('prisBeskrivelse')||null};
    if(!payload.navn){ msg('prisImportMsg','Skriv navn på prisen.','err'); return; }
    const q = app.edit.pris ? app.sb.from('hov_priser').update(payload).eq('id',app.edit.pris).select('*').single() : app.sb.from('hov_priser').insert(payload).select('*').single();
    const {error}=await q;
    msg('prisImportMsg', error?error.message:(app.edit.pris?'Pris oppdatert.':'Pris lagret.'), error?'err':'ok'); if(!error){ clearPrisForm(); await loadPriser(); renderPriser(); }
  }
  async function deletePris(){
    if(!app.edit.pris){ msg('prisImportMsg','Velg en pris først.','err'); return; }
    if(!confirm('Slette valgt pris?')) return;
    const {error}=await app.sb.from('hov_priser').delete().eq('id',app.edit.pris).eq('firma_id',app.firmaId);
    msg('prisImportMsg', error?error.message:'Pris slettet.', error?'err':'ok'); if(!error){ clearPrisForm(); await loadPriser(); renderPriser(); }
  }

  async function saveKunde(){
    const payload={navn:val('kundeNavn'), telefon:val('kundeTelefon')||null, epost:val('kundeEpost')||null, kontaktperson:val('kundeKontakt')||null, adresse:val('kundeAdresse')||null, firma_id:app.firmaId};
    if(!payload.navn){ msg('kundeMsg','Skriv kundenavn.','err'); return; }
    const q = app.edit.kunde ? app.sb.from('hov_kunder').update(payload).eq('id',app.edit.kunde).eq('firma_id',app.firmaId) : app.sb.from('hov_kunder').insert(payload);
    const {error}=await q;
    msg('kundeMsg', error?error.message:(app.edit.kunde?'Kunde oppdatert.':'Kunde lagret.'), error?'err':'ok'); if(!error){ clearKundeForm(); await loadKunder(); }
  }
  async function saveHest(){
    const payload={kunde_id: val('hestKunde')||null, navn:val('hestNavn'), rase:val('hestRase')||null, sist_skodd:val('hestSist')||null, neste_besok:val('hestNeste')||null, notater:val('hestNotater')||null, firma_id:app.firmaId};
    if(!payload.kunde_id || !payload.navn){ msg('hestMsg','Velg kunde og skriv hestenavn.','err'); return; }
    try{
      const file=$('hestBildeFile')?.files?.[0];
      let saved=null;
      if(app.edit.hest){
        const {data,error}=await app.sb.from('hov_hester').update(payload).eq('id',app.edit.hest).eq('firma_id',app.firmaId).select('*').single();
        if(error){ msg('hestMsg',error.message,'err'); return; }
        saved=data;
      }else{
        const {data,error}=await app.sb.from('hov_hester').insert(payload).select('*').single();
        if(error){ msg('hestMsg',error.message,'err'); return; }
        saved=data;
      }
      if(file && saved?.id){
        const uploaded=await uploadAppFile(file,'hester');
        const bpayload={firma_id:app.firmaId, hest_id:saved.id, path:uploaded.path, bilde_url:uploaded.url, filnavn:file.name||null, mime_type:file.type||null, tittel:'Bilde av hest'};
        const br=await app.sb.from('hov_hest_bilder').insert(bpayload);
        if(br.error){ msg('hestMsg','Hest lagret, men bilde ble ikke registrert: '+br.error.message,'err'); await loadHester(); return; }
      }
      msg('hestMsg', app.edit.hest?'Hest oppdatert.':'Hest lagret.', 'ok');
      clearHestForm(); await loadHester();
    }catch(err){ msg('hestMsg', err.message || String(err), 'err'); }
  }
  async function saveJobb(options){
    const opts = options && !options.target ? options : {};
    const arbeid=num('jobbArbeid'), varer=num('jobbVarer'), km=num('jobbKm'), kmPris=num('jobbKmPris') || 5.30;
    const eks=arbeid+varer+(km*kmPris); const sats=Number(app.firma?.standard_mva_sats ?? app.firma?.mva_sats ?? 25); const mva=eks*sats/100; const total=eks+mva;
    const payload={dato:val('jobbDato')||today(), kunde_id:val('jobbKunde')||null, hest_id:val('jobbHest')||null, jobbtype:val('jobbType')||null, beskrivelse:val('jobbBeskrivelse')||null, km, km_pris:kmPris, arbeid_belop:arbeid, varer_belop:varer, mva, total, fakturert:false, firma_id:app.firmaId};
    const hest = payload.hest_id ? app.data.hester.find(h=>String(h.id)===String(payload.hest_id)) : null;
    if(hest && hest.kunde_id){ payload.kunde_id = hest.kunde_id; setVal('jobbKunde', hest.kunde_id); setJobbKundeLocked(true); }
    if(!payload.kunde_id || !payload.hest_id || !payload.jobbtype){ msg('jobbMsg','Velg kunde, hest og jobbtype.','err'); return false; }
    if(!hest || String(hest.kunde_id)!==String(payload.kunde_id)){ msg('jobbMsg','Hest og kunde/eier matcher ikke. Velg hest på nytt.','err'); return false; }
    try{
      let saved=null;
      if(app.edit.jobb){
        const {data,error}=await app.sb.from('hov_jobber').update(payload).eq('id',app.edit.jobb).eq('firma_id',app.firmaId).select('*').single();
        if(error){ msg('jobbMsg',error.message,'err'); return false; }
        saved=data;
      }else{
        const {data,error}=await app.sb.from('hov_jobber').insert(payload).select('*').single();
        if(error){ msg('jobbMsg',error.message,'err'); return false; }
        saved=data;
      }
      const files=Array.from($('jobbBildeFiles')?.files || []);
      if(files.length && saved?.id){
        const bildeDato=val('jobbBildeDato') || payload.dato || today();
        const rows=[];
        for(const file of files){
          const up=await uploadAppFile(file,'jobber');
          rows.push({firma_id:app.firmaId, jobb_id:saved.id, hest_id:payload.hest_id, path:up.path, bilde_url:up.url, dato:bildeDato, filnavn:file.name||null, mime_type:file.type||null});
        }
        const br=await app.sb.from('hov_jobb_bilder').insert(rows);
        if(br.error){ msg('jobbMsg','Jobb lagret, men bilde ble ikke registrert: '+br.error.message,'err'); await loadJobber(); return false; }
      }
      msg('jobbMsg', app.edit.jobb?'Jobb oppdatert.':'Jobb lagret.', 'ok');
      clearJobbForm(); await loadJobber(); return true;
    }catch(err){ msg('jobbMsg', err.message || String(err), 'err'); return false; }
  }


  function parseCsvLine(line, delimiter){
    const out=[]; let cur=''; let q=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){
        if(q && line[i+1]==='"'){ cur+='"'; i++; }
        else q=!q;
      } else if(ch===delimiter && !q){ out.push(cur); cur=''; }
      else cur+=ch;
    }
    out.push(cur);
    return out.map(x=>x.trim());
  }

  function parsePrisCsv(text){
    text = String(text||'').replace(/^\uFEFF/, '').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
    if(lines.length < 2) throw new Error('CSV-filen mangler rader.');
    const delimiter = (lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',';
    const headers = parseCsvLine(lines[0], delimiter).map(h=>h.toLowerCase().trim());
    const rows=[];
    for(const line of lines.slice(1)){
      const cols=parseCsvLine(line, delimiter);
      const obj={}; headers.forEach((h,i)=>obj[h]=cols[i] ?? '');
      const eks = Number(String(obj.pris_eks_mva || obj.pris || obj.belop || '0').replace(',', '.')) || 0;
      const sats = Number(String(obj.mva_sats || '25').replace(',', '.')) || 0;
      const inkl = obj.pris_inkl_mva ? (Number(String(obj.pris_inkl_mva).replace(',', '.')) || 0) : +(eks * (1 + sats/100)).toFixed(2);
      rows.push({
        firma_id: app.firmaId,
        kategori: obj.kategori || null,
        varenr: obj.varenr || obj.varenummer || null,
        navn: obj.navn || obj.jobbtype || obj.vare || null,
        beskrivelse: obj.beskrivelse || null,
        enhet: obj.enhet || 'stk',
        pris_eks_mva: eks,
        mva_sats: sats,
        pris_inkl_mva: inkl,
        aktiv: !/^(nei|false|0|no)$/i.test(obj.aktiv || 'ja')
      });
    }
    return rows.filter(r=>r.navn);
  }

  async function importPriserFraCsv(){
    const file = $('prisCsvFile')?.files?.[0];
    if(!file){ msg('prisImportMsg','Velg CSV-filen først.','err'); return; }
    if(!app.firmaId){ msg('prisImportMsg','Mangler firma-ID. Logg inn på nytt.','err'); return; }
    try{
      msg('prisImportMsg','Leser CSV...');
      const text = await file.text();
      const rows = parsePrisCsv(text);
      if(!rows.length){ msg('prisImportMsg','Fant ingen priser i CSV-filen.','err'); return; }
      const uniqueRows = Array.from(new Map(rows.map(r=>[String(r.navn||'').trim().toLowerCase(), r])).values());
      const { error } = await app.sb
        .from('hov_priser')
        .upsert(uniqueRows, { onConflict: 'navn', ignoreDuplicates: false });
      if(error){
        msg('prisImportMsg','Kunne ikke importere priser: '+error.message,'err');
        return;
      }
      await loadPriser(); renderPriser();
      const duplikater = rows.length - uniqueRows.length;
      msg('prisImportMsg',`Importerte/oppdaterte ${uniqueRows.length} priser fra CSV${duplikater ? ` (${duplikater} duplikater i CSV ble slått sammen)` : ''}.`, 'ok');
    }catch(err){
      msg('prisImportMsg','CSV-import feilet: '+(err.message || err), 'err');
    }
  }

  function renderFirma(){
    const f=app.firma||{};
    setVal('firmaNavn',f.navn); setVal('firmaOrgnr',f.orgnr || f.org_nr); setVal('firmaMvaNr',f.mva_nr); setVal('firmaAdresse',f.adresse); setVal('firmaPostnr',f.postnr); setVal('firmaPoststed',f.poststed); setVal('firmaTelefon',f.telefon); setVal('firmaEpost',f.epost || app.user?.email); setVal('firmaNettside',f.nettside); setVal('firmaKontonr',f.kontonr); setVal('firmaVippsNr',f.vippsnummer || f.vipps_nr); setVal('firmaVippsMottaker',f.vipps_mottaker); setVal('firmaBetalingsfrist',f.betalingsfrist_dager ?? 14); setVal('firmaFakturaPrefix',f.faktura_prefix ?? 'F'); setVal('firmaNesteFakturanr',f.neste_fakturanr ?? 1); setVal('firmaMvaSats',f.standard_mva_sats ?? f.mva_sats ?? 25);
    const img=$('firmaLogoPreview'), info=$('firmaLogoInfo');
    if(f.logo_url){ img.src=f.logo_url; img.classList.remove('hidden'); info.textContent='Logo er lagret.'; } else { img.removeAttribute('src'); img.classList.add('hidden'); info.textContent='Ingen logo lagret.'; }
  }
  function firmaPayload(){ return { navn:val('firmaNavn')||'Hovslager', orgnr:val('firmaOrgnr')||null, mva_nr:val('firmaMvaNr')||null, adresse:val('firmaAdresse')||null, postnr:val('firmaPostnr')||null, poststed:val('firmaPoststed')||null, telefon:val('firmaTelefon')||null, epost:val('firmaEpost')||app.user?.email||null, nettside:val('firmaNettside')||null, kontonr:val('firmaKontonr')||null, vippsnummer:val('firmaVippsNr')||null, vipps_mottaker:val('firmaVippsMottaker')||null, betalingsfrist_dager:num('firmaBetalingsfrist')||14, faktura_prefix:val('firmaFakturaPrefix')||'F', neste_fakturanr:num('firmaNesteFakturanr')||1, standard_mva_sats:num('firmaMvaSats')||25, auth_user_id:app.user.id }; }
  async function saveFirma(){
    msg('firmaMsg','Lagrer firma...');
    const {data,error}=await app.sb.from('hov_firma').update(firmaPayload()).eq('id',app.firmaId).select('*').single();
    if(error){ msg('firmaMsg',error.message,'err'); return; }
    app.firma=data; updateHeader(); renderFirma(); msg('firmaMsg','Firmaoppsett lagret.','ok');
  }
  async function uploadLogo(){
    const file=$('firmaLogoFile')?.files?.[0];
    if(!file){ msg('firmaMsg','Velg en logo-fil først.','err'); return; }
    if(!app.firmaId){ msg('firmaMsg','Mangler firma-ID.','err'); return; }
    msg('firmaMsg','Laster opp logo...');
    const ext = (file.name.split('.').pop()||'png').toLowerCase();
    const path = `${app.firmaId}/${Date.now()}-${safeName(file.name||('logo.'+ext))}`;
    const up = await app.sb.storage.from('hovslager-logo').upload(path, file, { upsert:true, contentType:file.type || 'image/png' });
    if(up.error){ msg('firmaMsg','Logo ble ikke lastet opp: '+up.error.message+'  (Sjekk at bucket hovslager-logo finnes og policy er satt.)','err'); return; }
    const pub = app.sb.storage.from('hovslager-logo').getPublicUrl(path);
    const logo_url = pub.data.publicUrl;
    const {data,error}=await app.sb.from('hov_firma').update({logo_url, logo_path:path}).eq('id',app.firmaId).select('*').single();
    if(error){ msg('firmaMsg','Logo lastet opp, men kunne ikke lagre URL: '+error.message,'err'); return; }
    app.firma=data; updateHeader(); renderFirma(); msg('firmaMsg','Logo lastet opp og lagret.','ok');
  }
  async function deleteLogo(){
    if(!confirm('Slette logo fra firmaoppsettet?')) return;
    const oldPath = app.firma?.logo_path;
    if(oldPath){ await app.sb.storage.from('hovslager-logo').remove([oldPath]); }
    const {data,error}=await app.sb.from('hov_firma').update({logo_url:null, logo_path:null}).eq('id',app.firmaId).select('*').single();
    if(error){ msg('firmaMsg',error.message,'err'); return; }
    app.firma=data; updateHeader(); renderFirma(); msg('firmaMsg','Logo slettet.','ok');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
