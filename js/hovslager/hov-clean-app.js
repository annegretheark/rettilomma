(function(){
  'use strict';
  const $ = (id) => document.getElementById(id);
  const app = { sb:null, session:null, user:null, profile:null, role:'hovslager', isSysadm:false, firma:null, firmaId:null, voiceRecognition:null, voiceActive:false, voiceStopping:false, voiceProcessing:false, lastVoiceJobbId:null, voiceAutoStopTimer:null, edit:{kunde:null,hest:null,jobb:null,pris:null}, data:{kunder:[],hester:[],jobber:[],fakturaer:[],kreditnotaer:[],priser:[],adminFirmaer:[],adminProfiler:[],backupLogg:[],hestBilder:[],jobbBilder:[]} };
  window.hovApp = app;
  window.hovAppReadLastJobb = function(){ readLastJobbAsNew(); };
  window.hovAppStartVoiceJobb = function(){ startVoiceNyJobb(); };
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
      timeZone:'Europe/Oslo',
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

  function setJobbFormVisible(visible){
    $('jobbFormGrid')?.classList.toggle('hidden', !visible);
    $('jobbFormActions')?.classList.toggle('hidden', !visible);
  }
  function hidePostSavePrompt(){
    $('jobbSavedPrompt')?.classList.add('hidden');
    app.postSaveJobbId = null;
    const input=$('jobbSavedBildeFiles'); if(input) input.value='';
    const preview=$('jobbSavedBildePreview'); if(preview) preview.innerHTML='<span class="muted">Ingen bilder valgt.</span>';
  }
  function showPostSavePrompt(saved){
    app.postSaveJobbId = saved?.id || app.lastVoiceJobbId || app.postSaveJobbId || null;
    showTab('jobber');
    setText('jobbFormTitle','Jobb lagret');
    $('jobbSavedPrompt')?.classList.remove('hidden');
    setJobbFormVisible(false);
    msg('jobbMsg','Jobben er lagret. Legg gjerne til bilde(r), eller start ny jobb.','ok');
    setTimeout(()=>{ $('jobbFormTitle')?.scrollIntoView({behavior:'smooth', block:'start'}); }, 50);
  }
  function previewSavedJobbBilder(){
    const files=Array.from($('jobbSavedBildeFiles')?.files || []);
    const preview=$('jobbSavedBildePreview');
    if(!preview) return;
    preview.innerHTML = files.length ? files.map(f=>`<figure class="timeline-photo"><img class="thumb" src="${esc(URL.createObjectURL(f))}" alt="Valgt bilde"><figcaption>${esc(f.name||'Bilde')}</figcaption></figure>`).join('') : '<span class="muted">Ingen bilder valgt.</span>';
  }
  async function uploadSavedJobbBilder(){
    const jobbId=app.postSaveJobbId || app.lastVoiceJobbId;
    const files=Array.from($('jobbSavedBildeFiles')?.files || []);
    if(!jobbId){ msg('jobbMsg','Fant ikke lagret jobb. Åpne jobben og legg til bilder derfra.','err'); return; }
    if(!files.length){ msg('jobbMsg','Velg ett eller flere bilder først.','err'); return; }
    const j=(app.data.jobber||[]).find(x=>String(x.id)===String(jobbId));
    try{
      msg('jobbMsg','Lagrer bilde(r) ...','ok');
      const rows=[];
      for(const file of files){
        const up=await uploadAppFile(file,'jobber');
        rows.push({firma_id:app.firmaId, jobb_id:jobbId, hest_id:j?.hest_id||null, path:up.path, bilde_url:up.url, dato:today(), filnavn:file.name||null, mime_type:file.type||null});
      }
      const br=await app.sb.from('hov_jobb_bilder').insert(rows);
      if(br.error){ msg('jobbMsg','Bildet ble lastet opp, men ikke registrert: '+br.error.message,'err'); return; }
      const input=$('jobbSavedBildeFiles'); if(input) input.value='';
      previewSavedJobbBilder();
      await loadJobber();
      msg('jobbMsg', rows.length+' bilde(r) lagret på jobben.','ok');
    }catch(err){ msg('jobbMsg','Kunne ikke lagre bilde(r): '+(err.message||String(err)),'err'); }
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
    $('voiceNewJobbBtn')?.addEventListener('click', startVoiceNyJobb);
    $('voiceStopJobbBtn')?.addEventListener('click', ()=>stopVoiceJobb(false));
    $('voiceUseTextJobbBtn')?.addEventListener('click', ()=>applyVoiceTextAsJobb({autoSave:true, restart:false}));
    $('voiceNewAgainBtn')?.addEventListener('click', startVoiceNyJobb);
    $('voiceOpenLastJobbBtn')?.addEventListener('click', openLastVoiceJobb);
    $('voiceDeleteLastJobbBtn')?.addEventListener('click', deleteLastVoiceJobb);
    $('newJobbFromDashBtn')?.addEventListener('click', openBlankJobbFromDashboard);
    document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{ showTab(b.dataset.tab); if(b.dataset.tab==='priser'){ setPrisLayout('listFirst'); } }));
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
    $('jobbSavedBildeFiles')?.addEventListener('change', previewSavedJobbBilder);
    $('uploadSavedJobbBilderBtn')?.addEventListener('click', uploadSavedJobbBilder);
    $('postSaveNewJobbBtn')?.addEventListener('click', openNewJobbForm);
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
    if(id==='hester'){ setHestLayout('listFirst'); }
    if(id==='jobber'){ setJobbLayout('listFirst'); }
    if(id==='priser'){ setPrisLayout('listFirst'); renderPriser(); }
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
      const {data,error}=await app.sb.functions.invoke('backup-hovslager-firma', { body:{ action:'backup', mode:'manual', scope:'firma' } });
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
      const {data,error}=await app.sb.functions.invoke('backup-hovslager-firma', { body:{ action:'list', firma_id:app.firmaId } });
      if(error){ if(el) el.innerHTML='<div class="msg err">Kunne ikke lese backup-logg: '+esc(error.message)+'</div>'; return; }
      const backups=((data && data.ok) ? (data.backups||[]) : []).slice().sort((a,b)=>String(b.created_at||b.file_path||'').localeCompare(String(a.created_at||a.file_path||'')));
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
    if(!confirm('Gjenopprette valgt backup? Dette overskriver data for eget firma.')) return;
    msg('firmaBackupMsg','Gjenoppretter backup...');
    try{
      const {data,error}=await app.sb.functions.invoke('backup-hovslager-firma', { body:{ action:'restore', backup_path:filePath, firma_id:app.firmaId, confirm:true } });
      if(error){ msg('firmaBackupMsg','Restore feilet: '+(error.message||JSON.stringify(error)),'err'); return; }
      if(data && data.ok){ msg('firmaBackupMsg','Backup er gjenopprettet ('+(data.format||'backup')+'). Laster data på nytt...','ok'); await loadAll(); await loadFirmaBackupLogg(); }
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
      standardTekst:'Abonnement',
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
      standardTekst:val('appFakturaStandardTekst') || 'Abonnement',
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
      <style>body{font-family:Arial,sans-serif;padding:30px;color:#111}.top{display:flex;justify-content:space-between;gap:40px;align-items:flex-start}.logo{max-height:85px;max-width:220px;margin-bottom:12px}h1{margin:0 0 10px}.sender{text-align:right;line-height:1.45}.box{border:1px solid #ddd;padding:14px;margin:14px 0}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}.right{text-align:right}.total{font-size:20px;font-weight:bold}.muted{color:#666}.status{display:inline-block;border:1px solid #ddd;border-radius:999px;padding:6px 10px}.footer{margin-top:35px;border-top:1px solid #ddd;padding-top:12px;color:#555;white-space:pre-line}
/* MOBILVENNLIG LES-INN: bare én funksjon/knapp vises */
#navReadLastJobbBtn{display:none!important}
#voiceStopJobbBtn,#voiceUseTextJobbBtn,#newJobbFromDashBtn,#voiceOpenLastJobbBtn,#voiceDeleteLastJobbBtn{display:none!important}
#voiceNewJobbBtn.voice-on{position:sticky;bottom:12px;z-index:50;width:100%;justify-content:center;font-size:20px;padding:18px;border-radius:16px}
.voice-saved-actions{display:none!important}
.quick-job .muted{font-size:15px;line-height:1.35}
@media(max-width:800px){.quick-job{padding:14px}.quick-job .actions{display:grid;grid-template-columns:1fr}.quick-job textarea{min-height:130px}}

</style>
      </head><body>
      <div class="top"><div>${logo}<h1>${esc(title)}</h1><div class="status">${esc(f.status||'sendt')}</div></div><div class="sender"><strong>${esc(settings.brevhode||'Rettilomma')}</strong><br>${settings.orgnr ? 'Org.nr: '+esc(settings.orgnr)+'<br>' : ''}${esc(settings.adresse||'')}<br>${esc(settings.epost||'')}<br>${esc(settings.telefon||'')}</div></div>
      <div class="box"><strong>Kunde</strong><br>${esc(kunde.navn||'')}<br>${esc(kunde.adresse||'')}<br>${esc(kunde.epost||'')}</div>
      <p><strong>Dato:</strong> ${esc(f.dato||'')}<br><strong>Forfall:</strong> ${esc(f.forfall||'')}</p>
      <table><thead><tr><th>Beskrivelse</th><th class="right">Beløp inkl. mva</th></tr></thead><tbody>
      <tr><td>${esc(f.tekst||settings.standardTekst||'Abonnement')}</td><td class="right">${kr(f.belop||0)}</td></tr>
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
    const f={id:String(Date.now())+'-'+Math.random().toString(36).slice(2), nr:appFakturaNr(), firma_id:firmaId, kunde:{navn:kunde.navn||'', epost:kunde.epost||'', adresse:kunde.adresse||''}, dato:today(), forfall:datePlusDays(val('appFakturaForfallDager')||14), tekst:val('appFakturaTekst')||settings.standardTekst||'Abonnement', belop, status:'opprettet'};
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

  function firmaLogoUrl(firma){
    const f = firma || app.firma || {};
    const direct = f.logo_url || f.logo || f.logoUrl || f.bilde_url || f.image_url || f.foto_url || f.photo_url || '';
    if(direct) return String(direct);
    const path = f.logo_path || f.logoPath || '';
    if(path && app.sb){
      try{
        const pub = app.sb.storage.from('hovslager-logo').getPublicUrl(path);
        return pub?.data?.publicUrl || '';
      }catch(_){ return ''; }
    }
    return '';
  }

  async function refreshFirmaForFaktura(){
    if(!app.sb || !app.firmaId) return app.firma || {};
    try{
      const {data,error}=await app.sb.from('hov_firma').select('*').eq('id', app.firmaId).maybeSingle();
      if(!error && data){ app.firma=data; updateHeader(); renderFirma(); }
    }catch(e){ console.warn('Kunne ikke oppdatere firma før fakturavisning', e); }
    return app.firma || {};
  }

  function fakturaHtml(f, opts){
    const options = opts || {};
    const kunde=(app.data.kunder||[]).find(k=>String(k.id)===String(f.kunde_id)) || {};
    const jobb=(app.data.jobber||[]).find(j=>String(j.id)===String(f.jobb_id)) || f._jobb || {};
    const hest=(app.data.hester||[]).find(h=>String(h.id)===String(jobb.hest_id)) || {};
    const firma=app.firma||{};
    const label = options.label || (f._preview ? 'Forhåndsvisning - ikke fakturert' : '');
    const title = f._preview ? `Fakturautkast ${esc(f.fakturanr||'')}` : `Faktura ${esc(f.fakturanr||'')}`;
    const logoUrl = firmaLogoUrl(firma);
    const logoHtml = logoUrl ? `<img class="logo" src="${esc(logoUrl)}" alt="Firmalogo" crossorigin="anonymous" onerror="this.style.display='none'; this.closest('.logo-wrap')?.classList.add('logo-missing')">` : '';
    const orgnr = firma.orgnr || firma.org_nr || firma.bedriftsnr || firma.mva_nr || '';
    const vipps = firma.vippsnummer || firma.vippsnr || '';
    const vippsMottaker = firma.vipps_mottaker || firma.navn || '';
    const firmaSted = [firma.postnr, firma.poststed].filter(Boolean).join(' ');
    const footerParts = [
      firma.navn || '',
      orgnr ? 'Org.nr: '+orgnr : '',
      firma.adresse || '',
      firmaSted,
      firma.epost || '',
      firma.telefon || '',
      firma.kontonr ? 'Kontonr: '+firma.kontonr : '',
      firma.nettside || ''
    ].filter(Boolean);
    const beskrivelse = jobb.jobbtype || f.tekst || 'Hovslagerjobb';
    const ekstraTekst = jobb.beskrivelse || f.tekst || '';
    const printScript = options.autoPrint === false ? '' : `<script>
      (function(){
        function runPrint(){ if(window.print) window.print(); }
        var imgs = Array.from(document.images || []);
        if(!imgs.length){ setTimeout(runPrint, 250); return; }
        var left = imgs.length;
        function done(){ left--; if(left <= 0) setTimeout(runPrint, 250); }
        imgs.forEach(function(img){ if(img.complete) done(); else { img.onload=done; img.onerror=done; } });
        setTimeout(runPrint, 1500);
      })();
    <\/script>`;
    return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:42px 48px;color:#111827;background:#fff;font-size:14px;line-height:1.45}.page{max-width:900px;margin:0 auto}.letterhead{display:flex;justify-content:space-between;gap:36px;align-items:flex-start;border-bottom:1px solid #d1d5db;padding-bottom:22px;margin-bottom:34px}.brand{min-width:260px}.logo-wrap{min-height:70px;margin-bottom:12px}.logo{display:block;max-width:190px;max-height:92px;object-fit:contain}.sender{text-align:right;color:#374151}.sender strong{display:block;color:#111827;font-size:20px;margin-bottom:5px}.invoice-title{margin:0;font-size:34px;letter-spacing:-.03em}.subtitle{margin-top:4px;color:#4b5563}.preview{display:inline-block;margin-top:10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;padding:6px 11px;color:#9a3412;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}.card{border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#fff}.card h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:0 0 10px}.meta{display:grid;gap:7px}.meta div{display:flex;justify-content:space-between;gap:18px}.meta span:first-child{color:#6b7280}.section-title{font-size:16px;font-weight:700;margin:26px 0 10px}table{width:100%;border-collapse:collapse;margin-top:10px}th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;text-align:left;border-bottom:1px solid #d1d5db;padding:10px 8px}td{border-bottom:1px solid #e5e7eb;padding:13px 8px;vertical-align:top}.right{text-align:right}.muted{color:#6b7280}.totals{width:330px;margin:18px 0 0 auto}.totals .row{display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding:8px 0}.totals .pay{font-size:22px;font-weight:800;border-bottom:0;padding-top:14px}.payment{margin-top:28px;border:1px solid #e5e7eb;border-radius:12px;padding:16px}.payment strong{display:block;margin-bottom:6px}.footer{margin-top:44px;border-top:1px solid #d1d5db;padding-top:12px;color:#4b5563;font-size:12px}.nowrap{white-space:nowrap}@media print{body{padding:30px 42px}.page{max-width:none}.card,.payment{break-inside:avoid}.no-print{display:none}}
      
/* MOBILVENNLIG LES-INN: bare én funksjon/knapp vises */
#navReadLastJobbBtn{display:none!important}
#voiceStopJobbBtn,#voiceUseTextJobbBtn,#newJobbFromDashBtn,#voiceOpenLastJobbBtn,#voiceDeleteLastJobbBtn{display:none!important}
#voiceNewJobbBtn.voice-on{position:sticky;bottom:12px;z-index:50;width:100%;justify-content:center;font-size:20px;padding:18px;border-radius:16px}
.voice-saved-actions{display:none!important}
.quick-job .muted{font-size:15px;line-height:1.35}
@media(max-width:800px){.quick-job{padding:14px}.quick-job .actions{display:grid;grid-template-columns:1fr}.quick-job textarea{min-height:130px}}

</style>
      </head><body><div class="page">
      <div class="letterhead"><div class="brand"><div class="logo-wrap">${logoHtml}</div><h1 class="invoice-title">${title}</h1>${label ? `<div class="preview">${esc(label)}</div>` : ''}</div><div class="sender"><strong>${esc(firma.navn||'')}</strong>${orgnr ? '<br>Org.nr: '+esc(orgnr) : ''}${firma.adresse ? '<br>'+esc(firma.adresse) : ''}${firmaSted ? '<br>'+esc(firmaSted) : ''}${firma.epost ? '<br>E-post: '+esc(firma.epost) : ''}${firma.telefon ? '<br>Telefon: '+esc(firma.telefon) : ''}${firma.kontonr ? '<br>Kontonr: '+esc(firma.kontonr) : ''}</div></div>
      <div class="grid"><div class="card"><h2>Mottaker</h2><strong>${esc(kunde.navn||'')}</strong>${kunde.adresse ? '<br>'+esc(kunde.adresse) : ''}${kunde.epost ? '<br>'+esc(kunde.epost) : ''}${kunde.telefon ? '<br>'+esc(kunde.telefon) : ''}</div><div class="card meta"><h2>Fakturadetaljer</h2><div><span>Fakturadato</span><strong>${esc(f.dato||'')}</strong></div><div><span>Forfallsdato</span><strong>${esc(f.forfallsdato||'')}</strong></div><div><span>Status</span><strong>${esc(f.betalingsstatus||f.status||'')}</strong></div></div></div>
      <div class="section-title">Beskrivelse</div><table><thead><tr><th>Arbeid</th><th>Hest</th><th class="right nowrap">Beløp eks. mva</th></tr></thead><tbody><tr><td><strong>${esc(beskrivelse)}</strong>${ekstraTekst ? '<br><span class="muted">'+esc(ekstraTekst)+'</span>' : ''}</td><td>${esc(hest.navn||'')}</td><td class="right nowrap">${kr(f.eks_mva||0)} kr</td></tr></tbody></table>
      <div class="totals"><div class="row"><span>Beløp eks. mva</span><strong>${kr(f.eks_mva||0)} kr</strong></div><div class="row"><span>MVA</span><strong>${kr(f.mva||0)} kr</strong></div><div class="row pay"><span>Å betale</span><span>${kr(f.inkl_mva||0)} kr</span></div></div>
      <div class="payment"><strong>Betaling</strong>${firma.kontonr ? 'Kontonr: '+esc(firma.kontonr)+'<br>' : ''}${vipps ? 'Vipps: '+esc(vipps)+(vippsMottaker ? ' ('+esc(vippsMottaker)+')' : '')+'<br>' : ''}<span class="muted">Merk betalingen med fakturanummer ${esc(f.fakturanr||'')}.</span></div>
      <div class="footer">${esc(footerParts.join(' · '))}</div>
      ${printScript}</div></body></html>`;
  }

  async function visFaktura(f, opts){
    if(!f){ msg('fakturaMsg','Fant ikke faktura.','err'); return; }
    const w=window.open('', '_blank');
    if(!w){ msg('fakturaMsg','Nettleseren blokkerte popup. Tillat popup for å vise faktura.','err'); return; }
    w.document.open();
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Laster faktura</title></head><body style="font-family:Arial,sans-serif;padding:30px">Laster faktura ...</body></html>');
    w.document.close();
    await refreshFirmaForFaktura();
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
      visFaktura(f, {label:'Kopi'});
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
  function table(headers, rows){
    if(!rows.length) return '<div class="msg">Ingen data å vise.</div>';
    const labelledRows = rows.map(row=>{
      let idx = 0;
      return String(row).replace(/<td(\s[^>]*)?>/g, (m, attrs)=>{
        const label = esc(headers[idx++] || '');
        return `<td${attrs || ''} data-label="${label}">`;
      });
    }).join('');
    return `<div style="overflow:auto"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${labelledRows}</tbody></table></div>`;
  }
  function kundeNavn(id){ return app.data.kunder.find(k=>String(k.id)===String(id))?.navn || id || ''; }
  function hestNavn(id){ return app.data.hester.find(h=>String(h.id)===String(id))?.navn || id || ''; }
  function renderKunder(){ $('kundeList').innerHTML = table(['Navn','Telefon','E-post','Adresse',''], app.data.kunder.map(k=>`<tr class="click-row${selectedRowClass('kunde',k.id)}" data-id="${esc(k.id)}"><td>${esc(k.navn)}</td><td>${esc(k.telefon)}</td><td>${esc(k.epost)}</td><td>${esc(k.adresse)}</td></tr>`)); bindClickableRows('kundeList','kunde', editKunde); }
  function renderHester(){ $('hestList').innerHTML = table(['Bilde','Navn','Eier','Rase','Neste besøk',''], app.data.hester.map(h=>`<tr class="click-row${selectedRowClass('hest',h.id)}" data-id="${esc(h.id)}"><td>${imgUrl(h)?`<img class="thumb small" src="${esc(imgUrl(h))}" alt="Hest">`:''}</td><td>${esc(h.navn)}</td><td>${esc(kundeNavn(h.kunde_id))}</td><td>${esc(h.rase)}</td><td>${esc(h.neste_besok)}</td></tr>`)); bindClickableRows('hestList','hest', editHest); }
  function setPrisLayout(mode){
    const section=$('priser'), list=$('prisList'), title=$('prisFormTitle');
    if(!section || !list || !title) return;
    const grid = title.nextElementSibling;
    const actions = grid ? grid.nextElementSibling : null;
    const msgEl = $('prisMsg');
    if(mode === 'formFirst'){
      section.insertBefore(title, list.nextSibling);
      if(grid) section.insertBefore(grid, list.nextSibling);
      if(actions) section.insertBefore(actions, list.nextSibling);
      if(msgEl) section.insertBefore(msgEl, list.nextSibling);
      setTimeout(()=>{ title.scrollIntoView({behavior:'smooth', block:'start'}); }, 50);
    } else {
      section.insertBefore(list, title);
    }
  }

  function setHestLayout(mode){
    const section=$('hester'), list=$('hestList'), title=$('hestFormTitle');
    if(!section || !list || !title) return;
    const grid = title.nextElementSibling;
    const actions = grid ? grid.nextElementSibling : null;
    const msgEl = $('hestMsg');
    if(mode === 'formFirst'){
      section.insertBefore(title, list);
      if(grid) section.insertBefore(grid, list);
      if(actions) section.insertBefore(actions, list);
      if(msgEl) section.insertBefore(msgEl, list);
    } else {
      section.insertBefore(list, title);
    }
  }

  function setJobbLayout(mode){
    const section=$('jobber'), list=$('jobbList'), title=$('jobbFormTitle');
    if(!section || !list || !title) return;
    const grid = title.nextElementSibling;
    const actions = grid ? grid.nextElementSibling : null;
    const msgEl = $('jobbMsg');
    if(mode === 'formFirst'){
      section.insertBefore(title, list);
      if(grid) section.insertBefore(grid, list);
      if(actions) section.insertBefore(actions, list);
      if(msgEl) section.insertBefore(msgEl, list);
    } else {
      section.insertBefore(list, title);
    }
  }

  function renderJobber(){
    const rows=(app.data.jobber||[]).map(j=>`<tr class="click-row${selectedRowClass('jobb',j.id)}" data-id="${esc(j.id)}"><td>${esc(j.dato||'')}</td><td>${esc(kundeNavn(j.kunde_id))}</td><td>${esc(hestNavn(j.hest_id))}</td><td>${esc(j.jobbtype||'')}</td><td>${kr(j.total||0)}</td><td>${jobBilder(j).length}</td><td>${j.fakturert?'Ja':'Nei'}</td></tr>`);
    const cards=(app.data.jobber||[]).map(j=>{
      const faktura = (typeof fakturaForJobb === 'function') ? fakturaForJobb(j.id) : null;
      const mangler = !j.hest_id || !j.kunde_id;
      const forelopig = mangler || /foreløpig|forelopig|ukjent/i.test(String(j.status||j.beskrivelse||j.jobbtype||''));
      const status = j.fakturert || faktura ? 'Fakturert' : forelopig ? 'Mangler hest/eier' : 'Ikke fakturert';
      const statusClass = j.fakturert || faktura ? 'ok' : forelopig ? 'warn' : 'plain';
      const hest = hestNavn(j.hest_id) || (mangler ? 'Mangler hest' : 'Ukjent hest');
      const kunde = kundeNavn(j.kunde_id) || (mangler ? 'Mangler eier' : 'Ukjent kunde');
      return `<button type="button" class="jobb-mobile-card ${selectedRowClass('jobb',j.id)}" data-id="${esc(j.id)}"><span class="jobb-card-top"><strong>🐴 ${esc(hest)}</strong><span>${kr(j.total||0)}</span></span><span>👤 ${esc(kunde)}</span><span class="jobb-card-bottom"><span>📅 ${esc(j.dato||'')}</span><span class="jobb-status ${statusClass}">${esc(status)}</span></span></button>`;
    }).join('');
    $('jobbList').innerHTML = `<div class="jobb-desktop-list">${table(['Dato','Kunde','Hest','Jobbtype','Total','Bilder','Fakturert'], rows)}</div><div class="jobb-mobile-list">${cards || '<div class="msg">Ingen jobber registrert ennå.</div>'}</div>`;
    bindClickableRows('jobbList','jobb', editJobb);
    document.querySelectorAll('#jobbList .jobb-mobile-card').forEach(el=>el.addEventListener('click',()=>editJobb(el.dataset.id)));
  }

  function renderPriser(){
    const rows=(app.data.priser||[]).map(p=>`<tr class="click-row${selectedRowClass('pris',p.id)}" data-id="${esc(p.id)}"><td>${esc(p.kategori||'')}</td><td>${esc(p.varenr||'')}</td><td>${esc(p.navn||p.jobbtype||p.vare||p.type||'')}</td><td>${esc(p.enhet||'')}</td><td>${kr(p.pris_eks_mva ?? p.pris ?? p.belop ?? p.eks_mva)}</td><td>${kr(p.pris_inkl_mva ?? 0)}</td><td>${esc(p.aktiv === false ? 'Nei' : 'Ja')}</td><td>${esc(p.beskrivelse||'')}</td><td><button type="button" class="danger small delete-pris-row" data-id="${esc(p.id)}">Slett</button></td></tr>`);
    $('prisList').innerHTML = table(['Kategori','Varenr','Navn','Enhet','Eks. mva','Inkl. mva','Aktiv','Beskrivelse',''], rows);
    bindClickableRows('prisList','pris', editPris);
    document.querySelectorAll('#prisList .delete-pris-row').forEach(btn=>btn.addEventListener('click', async (e)=>{ e.preventDefault(); e.stopPropagation(); await deletePrisById(btn.dataset.id); }));
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

  function clearVoiceAutoStop(){
    if(app.voiceAutoStopTimer){ clearTimeout(app.voiceAutoStopTimer); app.voiceAutoStopTimer=null; }
  }
  function scheduleVoiceAutoStop(){
    clearVoiceAutoStop();
    app.voiceAutoStopTimer=setTimeout(()=>{
      if(app.voiceRecognition && app.voiceActive && val('voiceJobbText')){
        msg('voiceJobbMsg','Automatisk stopp: ingen ny tale. Lagrer jobben nå ...','ok');
        stopVoiceJobb(false);
      }
    }, 3500);
  }


  function showVoiceSavedActions(show){
    $('voiceSavedActions')?.classList.toggle('hidden', !show);
  }
  function voiceSavedMessage(){
    showVoiceSavedActions(true);
    msg('voiceJobbMsg','✅ Jobben er lagret. Legg til bilde(r), eller start ny jobb.','ok');
    showPostSavePrompt({id:app.lastVoiceJobbId});
  }
  function openLastVoiceJobb(){
    if(!app.lastVoiceJobbId){ msg('voiceJobbMsg','Fant ingen nylig innlest jobb å vise.','err'); return; }
    showTab('jobber');
    editJobb(app.lastVoiceJobbId);
  }
  async function deleteLastVoiceJobb(){
    if(!app.lastVoiceJobbId){ msg('voiceJobbMsg','Fant ingen nylig innlest jobb å slette.','err'); return; }
    if(!confirm('Slette den innleste jobben? Dette kan ikke angres.')) return;
    const id=app.lastVoiceJobbId;
    const {error}=await app.sb.from('hov_jobber').delete().eq('id',id).eq('firma_id',app.firmaId);
    if(error){ msg('voiceJobbMsg','Kunne ikke slette jobben: '+error.message,'err'); return; }
    app.lastVoiceJobbId=null;
    showVoiceSavedActions(false);
    await loadJobber(); renderAll();
    msg('voiceJobbMsg','🗑️ Den innleste jobben er slettet. Du kan lese inn på nytt.','ok');
  }
  async function finishVoiceJobbFromText(reason){
    if(app.voiceProcessing) return;
    const textNow=val('voiceJobbText');
    setVoiceButtons(false);
    if(!textNow){ msg('voiceJobbMsg','Stoppet. Ingen tekst å lagre.','ok'); return; }
    msg('voiceJobbMsg',(reason||'Stoppet')+'. Lagrer innlest jobb uten å hoppe til listen ...','ok');
    await applyVoiceTextAsJobb({autoSave:true, restart:false});
  }


  function openNewJobbWindowFromNav(){
    // Toppknappen skal åpne ny jobb-vinduet, ikke starte/skjule mikrofon direkte.
    stopVoiceJobb(true);
    clearJobbForm();
    setJobbFormReadOnly(false);
    showTab('jobber');
    setText('jobbFormTitle','Ny jobb');
    setText('saveJobbBtn','Lagre jobb');
    $('deleteJobbBtn')?.classList.add('hidden');
    msg('jobbMsg','Ny jobb er åpnet. Skriv inn jobben, eller bruk Les inn beskrivelse på skjemaet.','ok');
    setJobbLayout('formFirst');
    setTimeout(()=>{ const section=$('jobber'); if(section) section.scrollIntoView({behavior:'smooth', block:'start'}); }, 50);
  }

  function handleOneVoiceJobbButton(){
    if(app.voiceActive || app.voiceRecognition){ stopVoiceJobb(false); return; }
    if(app.lastVoiceJobbId && val('voiceJobbText')){ startVoiceNyJobb(); return; }
    if(val('voiceJobbText')){ finishVoiceJobbFromText('Skrevet tekst'); return; }
    startVoiceNyJobb();
  }

  function startVoiceNyJobb(){
    // Egen flyt for NY jobb: aldri rediger eksisterende jobb.
    if(app.voiceActive || app.voiceRecognition){
      msg('voiceJobbMsg','Lytter allerede. Trykk Stopp og lagre jobb når du er ferdig.','ok');
      return;
    }
    app.edit.jobb = null;
    app.voiceStopping = false;
    app.voiceProcessing = false;
    app.lastVoiceJobbId = null;
    showVoiceSavedActions(false);
    clearJobbForm();
    showTab('jobber');
    setJobbLayout('formFirst');
    setText('jobbFormTitle','Ny jobb');
    setText('saveJobbBtn','Lagre jobb');
    $('deleteJobbBtn')?.classList.add('hidden');
    setVal('voiceJobbText','');
    startVoiceJobb();
  }
  function startVoiceJobb(){
    const Speech = speechApi();
    if(!Speech){ msg('voiceJobbMsg','Denne nettleseren støtter ikke talegjenkjenning. Bruk Chrome/Edge på PC eller Android, eller skriv teksten i feltet og trykk Bruk skrevet tekst.','err'); return; }
    try{
      if(app.voiceActive || app.voiceRecognition){
        msg('voiceJobbMsg','Lytter allerede. Trykk Stopp og lagre jobb når du er ferdig.','ok');
        return;
      }
      clearVoiceAutoStop();
      const rec = new Speech();
      app.voiceRecognition = rec;
      app.voiceActive = true;
      app.voiceStopping = false;
      rec.lang = 'nb-NO';
      rec.interimResults = true;
      rec.continuous = true;
      let finalText = '';
      setVoiceButtons(true);
      msg('voiceJobbMsg','🎙️ Lytter ... teksten vises under. Trykk Stopp og lagre jobb når du er ferdig.','ok');
      rec.onstart = () => {
        setVoiceButtons(true);
        msg('voiceJobbMsg','🎙️ Lytter ... teksten vises under. Trykk Stopp og lagre jobb når du er ferdig.','ok');
      };
      rec.onerror = (ev) => {
        clearVoiceAutoStop();
        const current=val('voiceJobbText');
        if(app.voiceStopping || ev.error === 'aborted') return;
        app.voiceActive = false;
        app.voiceStopping = false;
        if(app.voiceRecognition === rec) app.voiceRecognition = null;
        setVoiceButtons(false);
        if((ev.error === 'no-speech' || ev.error === 'audio-capture') && current){ finishVoiceJobbFromText('Mikrofonen stoppet'); return; }
        msg('voiceJobbMsg','Mikrofon/tale feilet: '+(ev.error || 'ukjent feil')+'. Sjekk at siden har tilgang til mikrofon.','err');
      };
      rec.onend = () => {
        clearVoiceAutoStop();
        const shouldAutoSave = !app.voiceStopping && !!val('voiceJobbText');
        app.voiceActive = false;
        app.voiceStopping = false;
        if(app.voiceRecognition === rec) app.voiceRecognition = null;
        setVoiceButtons(false);
        if(shouldAutoSave) finishVoiceJobbFromText('Talen stoppet automatisk');
        else if(!val('voiceJobbText')) msg('voiceJobbMsg','Mikrofon stoppet uten tekst. Trykk Snakk inn ny jobb for å prøve igjen.','ok');
      };
      rec.onresult = (ev) => {
        let interim = '';
        for(let i=ev.resultIndex; i<ev.results.length; i++){
          const txt = ev.results[i][0]?.transcript || '';
          if(ev.results[i].isFinal) finalText = (finalText + ' ' + txt).trim();
          else interim += txt;
        }
        const heard=(finalText + (interim ? ' ' + interim : '')).trim();
        setVal('voiceJobbText', heard);
        if(heard){
          scheduleVoiceAutoStop();
        }
      };
      rec.start();
    }catch(err){
      app.voiceActive = false;
      app.voiceStopping = false;
      app.voiceRecognition = null;
      setVoiceButtons(false);
      msg('voiceJobbMsg','Kunne ikke starte mikrofon: '+(err.message || err),'err');
    }
  }
  function setVoiceButtons(listening){
    const start=$('voiceNewJobbBtn'), top=$('navReadLastJobbBtn'), stop=$('voiceStopJobbBtn'), use=$('voiceUseTextJobbBtn'), empty=$('newJobbFromDashBtn'), txt=$('voiceJobbText');
    const hasText = !!val('voiceJobbText');
    let label = '🎙 Les inn jobb';
    if(listening) label = '⏹ Stopp og lagre';
    else if(app.lastVoiceJobbId && hasText) label = '🎙 Les inn ny jobb';
    else if(hasText) label = '💾 Lagre jobb';
    if(start){
      start.textContent = label;
      start.disabled = false;
      start.classList.toggle('voice-on', !!listening);
      start.style.width = listening ? '100%' : '';
      start.style.justifyContent = listening ? 'center' : '';
      start.style.fontSize = listening ? '20px' : '';
      start.style.padding = listening ? '18px' : '';
    }
    if(top){ top.style.display='none'; top.hidden=true; }
    for(const b of [stop,use,empty]){ if(b){ b.style.display='none'; b.hidden=true; b.disabled=true; } }
    if(txt) txt.classList.toggle('voice-listening', !!listening);
  }

  function stopVoiceJobb(silent){
    clearVoiceAutoStop();
    const rec = app.voiceRecognition;
    app.voiceStopping = true;
    app.voiceActive = false;
    app.voiceRecognition = null;
    setVoiceButtons(false);

    if(rec){
      try{ rec.stop(); }
      catch(_){ try{ rec.abort(); }catch(__){} }
    }

    if(!silent) finishVoiceJobbFromText('Stoppet');
    else app.voiceStopping=false;
  }
  function cleanDictationText(text){
    let out=String(text||'').trim();
    if(!out) return '';
    out=out.replace(/\s+/g,' ');
    out=out.replace(/\bpunktum\b/gi,'.').replace(/\bkomma\b/gi,',').replace(/\bny linje\b/gi,'\n').replace(/\bnytt avsnitt\b/gi,'\n\n');
    out=out.replace(/\s+([.,!?])/g,'$1');
    out=out.replace(/([.!?])\s+([a-zæøå])/g,(m,a,b)=>a+' '+b.toUpperCase());
    out=out.charAt(0).toUpperCase()+out.slice(1);
    if(!/[.!?]$/.test(out)) out+='.';
    return out;
  }
  function appendJobbBeskrivelse(text){
    const cleaned=cleanDictationText(text);
    if(!cleaned) return;
    const old=val('jobbBeskrivelse');
    setVal('jobbBeskrivelse', old ? (old.replace(/\s+$/,'')+'\n\n'+cleaned) : cleaned);
  }
  function setDescriptionVoiceButtons(listening){
    const start=$('voiceBeskrivelseBtn'), stop=$('voiceBeskrivelseStopBtn');
    if(start){ start.textContent=listening?'🎤 Lytter til beskrivelse ...':'🎤 Les inn beskrivelse'; start.disabled=!!listening; }
    if(stop){ stop.classList.toggle('voice-on', !!listening); stop.style.display=listening?'inline-flex':'none'; stop.disabled=!listening; }
  }
  function startVoiceBeskrivelse(){
    const Speech=speechApi();
    if(!Speech){ msg('voiceBeskrivelseMsg','Denne nettleseren støtter ikke talegjenkjenning. Bruk Chrome/Edge på PC eller Android.','err'); return; }
    try{
      stopVoiceJobb(true);
      const rec=new Speech();
      app.voiceRecognition=rec;
      app.voiceActive=true;
      app.voiceStopping=false;
      app.voiceMode='beskrivelse';
      rec.lang='nb-NO';
      rec.interimResults=true;
      rec.continuous=true;
      let finalText='';
      rec.onstart=()=>{ setDescriptionVoiceButtons(true); msg('voiceBeskrivelseMsg','Lytter ... si beskrivelsen. Trykk Stopp beskrivelse når du er ferdig.','ok'); };
      rec.onerror=(ev)=>{ app.voiceActive=false; app.voiceMode=null; setDescriptionVoiceButtons(false); msg('voiceBeskrivelseMsg','Mikrofon/tale feilet: '+(ev.error||'ukjent feil'),'err'); };
      rec.onend=()=>{
        const wasActive=app.voiceActive;
        app.voiceActive=false;
        if(app.voiceRecognition===rec) app.voiceRecognition=null;
        const shouldAppend = finalText.trim() && (!app.voiceStopping || app.voiceMode==='beskrivelse');
        app.voiceMode=null;
        setDescriptionVoiceButtons(false);
        if(shouldAppend){ appendJobbBeskrivelse(finalText); msg('voiceBeskrivelseMsg','Beskrivelsen er lagt til.','ok'); }
        else if(wasActive && !app.voiceStopping) msg('voiceBeskrivelseMsg','Mikrofon stoppet uten tekst.','err');
      };
      rec.onresult=(ev)=>{
        let interim='';
        for(let i=ev.resultIndex;i<ev.results.length;i++){
          const txt=ev.results[i][0]?.transcript || '';
          if(ev.results[i].isFinal) finalText=(finalText+' '+txt).trim();
          else interim+=txt;
        }
        msg('voiceBeskrivelseMsg','Hører: '+esc((finalText+' '+interim).trim()),'ok');
      };
      rec.start();
    }catch(err){ app.voiceActive=false; app.voiceMode=null; setDescriptionVoiceButtons(false); msg('voiceBeskrivelseMsg','Kunne ikke starte mikrofon: '+(err.message||err),'err'); }
  }
  function stopVoiceBeskrivelse(){
    const rec=app.voiceRecognition;
    app.voiceStopping=true;
    setDescriptionVoiceButtons(false);
    if(rec){ try{ rec.stop(); }catch(_){ try{ rec.abort(); }catch(__){} } }
  }

  function normText(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function findNamed(rows, text, keys){
    const ntext = normText(text);
    const compactText = ntext.replace(/[^a-z0-9æøå]+/g,'');
    const sorted = (rows||[]).slice().sort((a,b)=>String(b.navn||'').length-String(a.navn||'').length);
    for(const r of sorted){
      for(const key of keys){
        const name = normText(r?.[key] || '');
        const compactName = name.replace(/[^a-z0-9æøå]+/g,'');
        if(name && (ntext.includes(name) || (compactName && compactText.includes(compactName)))) return r;
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


  function extractVoiceHorseName(text){
    const raw = String(text || '').replace(/[.,;:!?]/g, ' ').replace(/\s+/g, ' ').trim();
    if(!raw) return '';
    const stopWords = new Set(['jeg','vi','du','han','hun','den','det','i','på','pa','og','for','med','hos','til','fra','kjørte','kjorte','kjørt','kjort','kjøring','kjoring','km','kilometer','arbeid','jobb','beløp','belop','pris','varer','utlegg','materialer','beskrivelse','notat','kommentar']);
    const patterns = [
      /\b(?:skodde|sko(?:dde|dd|ing)?|beskar|beskjærte|beskjaerte|trimmet)\s+([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå0-9'\- ]{0,60})/i,
      /\bhest(?:en)?\s+(?:heter\s+)?([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå0-9'\- ]{0,60})/i,
      /\bfor\s+([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå0-9'\- ]{0,60})/i
    ];
    for(const re of patterns){
      const m = raw.match(re);
      if(!m) continue;
      const words = String(m[1] || '').trim().split(/\s+/).filter(Boolean);
      const name = [];
      for(const w of words){
        const nw = normText(w).replace(/[^a-z0-9æøå]/g,'');
        if(!nw || stopWords.has(nw) || /^\d+$/.test(nw)) break;
        name.push(w.replace(/[^A-Za-zÆØÅæøå0-9'\-]/g,''));
        if(name.length >= 2) break;
      }
      const out = name.join(' ').trim();
      if(out) return out;
    }
    return '';
  }

  async function createHorseFromVoiceName(name, kundeId){
    const horseName = String(name || '').trim();
    if(!horseName) return null;
    const payload = {firma_id: app.firmaId, kunde_id: kundeId || null, navn: horseName, rase: null, sist_skodd: null, neste_besok: null, notater: 'Opprettet fra innlest jobb'};
    const {data,error} = await app.sb.from('hov_hester').insert(payload).select('*').single();
    if(error) throw new Error('Hesten kunne ikke opprettes: ' + error.message);
    app.data.hester = [data, ...(app.data.hester || []).filter(h => String(h.id) !== String(data.id))];
    try{ fillHestSelects(); renderHester(); }catch(_){ }
    return data;
  }


  function stripVoiceWordsForName(v){
    return String(v||'')
      .replace(/[.,!?;:]+/g,' ')
      .replace(/\b(i dag|idag|mandag|tirsdag|onsdag|torsdag|fredag|lordag|lørdag|sondag|søndag|morgen|kveld|km|kilometer|kjoring|kjøring|kjorte|kjørte|arbeid|pris|belop|beløp|varer|utlegg|materialer|beskrivelse|notat|kommentar|med|hos|til|for|og)\b.*$/i,'')
      .replace(/\s+/g,' ')
      .trim();
  }

  function inferHestNameFromVoiceText(text){
    const raw=String(text||'').trim();
    if(!raw) return '';
    const patterns=[
      /\bhest(?:en)?\s+(?:heter\s+)?([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå0-9 '\-]{1,40})/i,
      /\b(?:skodde|sko|skoing|beskar|beskjærte|beskjaerte|beskjaring|beskjæring|fullbeslag|barfot|trimmet)\s+([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå0-9 '\-]{1,40})/i,
      /\b(?:på|pa)\s+([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå0-9 '\-]{1,40})/i
    ];
    for(const re of patterns){
      const m=raw.match(re);
      if(m && m[1]){
        const name=stripVoiceWordsForName(m[1]);
        if(name && name.length>=2) return name;
      }
    }
    return '';
  }

  async function ensureVoiceKundeByName(name){
    const wanted = String(name || '').trim();
    if(!wanted) return null;
    const existing = (app.data.kunder || []).find(k => normText(k.navn) === normText(wanted) || normText(k.kontaktperson) === normText(wanted));
    if(existing) return existing;
    const payload = {firma_id: app.firmaId, navn: wanted, telefon: null, epost: null, kontaktperson: null, adresse: null};
    const {data,error} = await app.sb.from('hov_kunder').insert(payload).select('*').single();
    if(error) throw new Error('Kunne ikke opprette eier/kunde "'+wanted+'": '+error.message);
    app.data.kunder = [data, ...(app.data.kunder || []).filter(k => String(k.id) !== String(data.id))];
    try{ fillKundeSelects(); renderKunder(); }catch(_){ }
    return data;
  }

  async function ensureForelopigVoiceKunde(){
    return await ensureVoiceKundeByName('Foreløpig / ukjent eier');
  }

  async function chooseVoiceOwnerForHorse(horseName){
    const kunder = (app.data.kunder || []).slice().sort((a,b)=>String(a.navn||'').localeCompare(String(b.navn||''),'nb'));
    const top = kunder.slice(0, 30);
    const lines = top.map((k,i)=>`${i+1}: ${k.navn}${k.kontaktperson ? ' ('+k.kontaktperson+')' : ''}`);
    const answer = prompt(
      'Hesten "'+horseName+'" finnes ikke. Velg eier før hesten opprettes.\n\n' +
      (lines.length ? lines.join('\n')+'\n\n' : '') +
      'Skriv nummer på eier, eller skriv navn på ny eier.\n' +
      'Skriv FORELØPIG hvis eier er ukjent.\n' +
      'Trykk Avbryt for å lagre jobben uten hest/eier og redigere senere.'
    );
    if(answer === null) return null;
    const value = String(answer || '').trim();
    if(!value) return null;
    if(/^forel[oø]pig|ukjent$/i.test(normText(value))) return await ensureForelopigVoiceKunde();
    const nr = Number(value);
    if(Number.isInteger(nr) && nr >= 1 && nr <= top.length) return top[nr-1];
    const existing = (app.data.kunder || []).find(k => normText(k.navn) === normText(value) || normText(k.kontaktperson) === normText(value));
    if(existing) return existing;
    if(confirm('Opprette ny eier/kunde "'+value+'" og knytte hesten til denne?')) return await ensureVoiceKundeByName(value);
    return null;
  }

  async function resolveVoiceHestFromText(text, kunde){
    const existing = findNamed(app.data.hester, text, ['navn']);
    if(existing) return existing;
    const suggested = inferHestNameFromVoiceText(text) || extractVoiceHorseName(text);
    if(!suggested) return null;

    const answer = prompt(
      'Hesten "'+suggested+'" finnes ikke.\n\n' +
      'Skriv 1 for å åpne hest/eier-bildet og velge eier. Jobben lagres IKKE nå.\n' +
      'Skriv 2 hvis smeden vil lagre jobben foreløpig og redigere senere.\n' +
      'Trykk Avbryt hvis navnet er feil og skal rettes.',
      '1'
    );
    if(answer === null){
      msg('voiceJobbMsg','Hesten "'+suggested+'" finnes ikke. Jobben er IKKE lagret. Rett navnet og prøv igjen.','err');
      throw new Error('Hesten finnes ikke: '+suggested);
    }
    const valg = String(answer || '').trim();
    if(valg === '1'){
      openCreateHorseFromVoice(suggested, text);
      throw new Error('Hesten må opprettes med eier før jobben lagres.');
    }
    if(valg === '2'){
      msg('voiceJobbMsg','Lagrer foreløpig jobb uten hest/eier. Rediger jobben senere og velg riktig hest.','ok');
      return {id:null, navn:suggested, kunde_id:null, _voiceForelopig:true};
    }
    msg('voiceJobbMsg','Ugyldig valg. Jobben er IKKE lagret.','err');
    throw new Error('Ugyldig valg for ukjent hest.');
  }




  function openCreateHorseFromVoice(spokenHestName, voiceText){
    const name = String(spokenHestName || '').trim();
    app.pendingVoiceJobbText = String(voiceText || val('voiceJobbText') || '').trim();
    try{ clearHestForm(); }catch(_){ app.edit.hest=null; }
    showTab('hester');
    setHestLayout('formFirst');
    setVal('hestNavn', name);
    setVal('hestNotater', 'Opprettet fra innlest jobb. Husk å velge riktig eier/kunde før lagring.');
    setText('hestFormTitle','Ny hest fra innlest jobb');
    setText('saveHestBtn','Lagre hest');
    $('deleteHestBtn')?.classList.add('hidden');
    msg('hestMsg','Velg eier/kunde for "' + name + '" og trykk Lagre hest. Jobben er IKKE lagret ennå. Gå tilbake til Les inn jobb etterpå for å lagre/redigere jobben.', 'err');
    setTimeout(()=>{ const el=$('hestKunde'); if(el) el.focus(); }, 80);
  }

  function numText(v){ return Number(String(v||'0').replace(/\s/g,'').replace(',', '.')) || 0; }


  function findBestPrisFromVoiceText(text){
    const ntext = normText(text);
    const priser = (app.data.priser || []).filter(p => p && p.aktiv !== false);
    if(!priser.length) return null;
    const containsAny = (words) => words.some(w => new RegExp('\\b'+w+'\\b','i').test(ntext));
    const scorePris = (p) => {
      const name = normText(prisNavn(p));
      const desc = normText(p.beskrivelse || p.kategori || '');
      let score = 0;
      if(name && ntext.includes(name)) score += 100 + Math.min(name.length, 40);
      const parts = name.split(/[^a-z0-9æøå]+/).filter(w => w.length >= 3);
      for(const w of parts){ if(new RegExp('\\b'+w+'\\b','i').test(ntext)) score += 8; }
      if(desc){
        const dparts = desc.split(/[^a-z0-9æøå]+/).filter(w => w.length >= 4);
        for(const w of dparts){ if(new RegExp('\\b'+w+'\\b','i').test(ntext)) score += 2; }
      }
      if(/full\s*beslag|fullbeslag/.test(name) && containsAny(['skodde','sko','skoing','fullbeslag','beslag'])) score += 80;
      if(/halv\s*beslag|halvbeslag/.test(name) && containsAny(['halvbeslag'])) score += 80;
      if(/barfot/.test(name) && containsAny(['barfot','beskjaering','beskjæring'])) score += 80;
      if(/sko/.test(name) && containsAny(['skodde','sko','skoing'])) score += 20;
      return score;
    };
    let best = null;
    let bestScore = 0;
    for(const p of priser){
      const s = scorePris(p);
      if(s > bestScore){ bestScore = s; best = p; }
    }
    if(best && bestScore > 0) return best;
    if(isSkoingText(text)) return findFullbeslagPris();
    return null;
  }

  async function applyVoiceTextAsJobb(options){
    const opts = options && !options.target ? options : {};
    if(opts.autoSave && app.voiceProcessing) return false;
    if(opts.autoSave) app.voiceProcessing = true;
    const text = val('voiceJobbText').trim();
    if(!text){
      if(opts.autoSave) app.voiceProcessing = false;
      msg('voiceJobbMsg','Snakk inn eller skriv tekst først.','err');
      return false;
    }

    try{
      // Ikke hopp til jobblisten / redigeringsliste når innlesingen stoppes.
      // Vi lager payload direkte fra teksten og lar brukeren bli stående i Les inn-feltet.
      app.edit.jobb = null;
      const kunde = findNamed(app.data.kunder, text, ['navn','kontaktperson']);
      const hest = await resolveVoiceHestFromText(text, kunde);
      const pris = findBestPrisFromVoiceText(text);
      const km = numberNear(text, ['km','kilometer','kjoring','kjøring','kjorte','kjørte','kjort','kjørt','kjoriig','kjøriig']);
      const arbeidTale = numberAfter(text, ['arbeid','jobb','belop','beløp','pris']);
      const varer = numberAfter(text, ['varer','utlegg','materialer']);
      let beskrivelse = textAfter(text, ['beskrivelse','notat','kommentar']) || text;
      if(hest && hest._voiceForelopig){
        beskrivelse = '[FORELØPIG LAGRET - ukjent hest/eier: ' + (hest.navn || '') + ']\n' + beskrivelse;
      }

      let kundeId = kunde?.id || null;
      let hestId = hest?.id || null;
      if(hest && hest.kunde_id) kundeId = hest.kunde_id;

      let jobbtype = pris ? prisNavn(pris) : '';
      if(!jobbtype && isSkoingText(text)) jobbtype = 'Fullbeslag';
      if(!jobbtype) jobbtype = 'Innlest jobb';

      const prisArbeid = pris ? (prisEksMva(pris) || 0) : 0;
      const arbeid = arbeidTale ? numText(arbeidTale) : prisArbeid;
      const kmTall = km ? numText(km) : 0;
      const varerTall = varer ? numText(varer) : 0;
      const kmPris = 5.30;
      const sats = Number(app.firma?.standard_mva_sats ?? app.firma?.mva_sats ?? 25);
      const eks = arbeid + varerTall + (kmTall * kmPris);
      const mva = eks * sats / 100;
      const total = eks + mva;

      const payload = { dato: today(), kunde_id: kundeId, hest_id: hestId, jobbtype, beskrivelse, km: kmTall, km_pris: kmPris, arbeid_belop: arbeid, varer_belop: varerTall, mva, total, fakturert: false, firma_id: app.firmaId };

      // Fyll også ut skjemaet under, men uten å scrolle eller bytte visning.
      setVal('jobbDato', payload.dato);
      setJobbKundeLocked(false);
      if(payload.kunde_id) setVal('jobbKunde', payload.kunde_id);
      fillJobbHester();
      if(payload.hest_id) setVal('jobbHest', payload.hest_id);
      syncJobbKundeHestLock();
      fillJobbTypeSelect();
      if($('jobbType') && !Array.from($('jobbType').options||[]).some(o=>o.value===payload.jobbtype)) $('jobbType').innerHTML += `<option value="${esc(payload.jobbtype)}">${esc(payload.jobbtype)}</option>`;
      setVal('jobbType', payload.jobbtype);
      setVal('jobbKm', payload.km || '');
      setVal('jobbKmPris', payload.km_pris);
      setVal('jobbArbeid', payload.arbeid_belop || 0);
      setVal('jobbVarer', payload.varer_belop || '');
      setVal('jobbBeskrivelse', payload.beskrivelse);

      if(opts.autoSave){
        msg('voiceJobbMsg','Lagrer innlest jobb ...','ok');
        // Bruk den samme lagringen som vanlig Lagre jobb, men uten å hoppe til listen.
        // Dette unngår heng/feil fra ekstra direkte-lagring og holder brukeren på Les inn.
        app.edit.jobb = null;
        const saved = await saveJobb({fromVoice:true, forceNew:true, stayOnVoice:true});
        if(!saved) throw new Error('Vanlig lagring returnerte ikke lagret jobb.');
        app.lastVoiceJobbId = saved.id || null;
        showVoiceSavedActions(!!app.lastVoiceJobbId);
        showPostSavePrompt(saved);
        const q=document.querySelector('.quick-job'); if(q) q.scrollIntoView({behavior:'smooth', block:'start'});
        if(hest && hest._voiceForelopig) msg('voiceJobbMsg','⚠️ Jobben er lagret foreløpig uten hest/eier. Rediger jobben senere og koble riktig hest/eier.','err');
        else msg('voiceJobbMsg','✅ Jobben er lagret. Legg til bilde(r), eller start ny jobb.','ok');
    showPostSavePrompt({id:app.lastVoiceJobbId});
        app.voiceProcessing = false;
        return true;
      }

      app.voiceProcessing = false;
      msg('voiceJobbMsg','Teksten er lagt inn i ny jobb. Trykk Lagre jobb når du er klar.','ok');
      return true;
    }catch(err){
      app.voiceProcessing = false;
      msg('voiceJobbMsg','Jobben ble ikke lagret: '+(err.message || String(err))+'. Du står fortsatt på Les inn, og teksten ligger i feltet.','err');
      return false;
    }
  }
  function openBlankJobbFromDashboard(skipMsg){
    hidePostSavePrompt(); setJobbFormVisible(true);
    clearJobbForm();
    showTab('jobber');
    setJobbLayout('formFirst');
    setText('jobbFormTitle','Ny jobb');
    if(!skipMsg) msg('jobbMsg','Ny tom jobb åpnet. Du kan fylle ut eller bruke mikrofon fra forsiden.','ok');
    setTimeout(()=>{ const formTitle=$('jobbFormTitle'); if(formTitle) formTitle.scrollIntoView({behavior:'smooth', block:'start'}); }, 50);
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
    hidePostSavePrompt(); setJobbFormVisible(true);
    const j = app.data.jobber.find(x=>String(x.id)===String(id));
    if(!j){ msg('dashMsg','Fant ikke jobben som skulle leses inn.','err'); return; }
    app.edit.jobb = null;
    showTab('jobber');
    setText('jobbFormTitle','Ny jobb');
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
    setText('hestFormTitle','Rediger hest'); setText('saveHestBtn','Oppdater hest'); $('deleteHestBtn')?.classList.remove('hidden'); renderHester(); setHestLayout('formFirst'); msg('hestMsg','Redigerer hest: '+(h.navn||''),'ok');
  }
  function clearHestForm(){ app.edit.hest=null; ['hestNavn','hestRase','hestSist','hestNeste','hestNotater'].forEach(id=>setVal(id,'')); setVal('hestKunde',''); if($('hestBildeFile')) $('hestBildeFile').value=''; renderImagePreview('hestBildePreview',''); setText('hestFormTitle','Ny hest'); setText('saveHestBtn','Lagre hest'); $('deleteHestBtn')?.classList.add('hidden'); renderHester(); msg('hestMsg',''); }
  async function deleteHest(){
    if(!app.edit.hest){ msg('hestMsg','Velg en hest først.','err'); return; }
    if(!confirm('Slette valgt hest?')) return;
    const {error}=await app.sb.from('hov_hester').delete().eq('id',app.edit.hest).eq('firma_id',app.firmaId);
    msg('hestMsg', error?error.message:'Hest slettet.', error?'err':'ok'); if(!error){ clearHestForm(); await loadHester(); await loadJobber(); }
  }

  function editJobb(id){
    hidePostSavePrompt(); setJobbFormVisible(true);
    const j = app.data.jobber.find(x=>String(x.id)===String(id)); if(!j) return;
    app.edit.jobb = j.id;
    setVal('jobbDato',j.dato); setJobbKundeLocked(false); setVal('jobbKunde',j.kunde_id); fillJobbHester(); setVal('jobbHest',j.hest_id); syncJobbKundeHestLock(); fillJobbTypeSelect(); setVal('jobbType',j.jobbtype); setVal('jobbKm',j.km); setVal('jobbKmPris',j.km_pris ?? '5,30'); setVal('jobbArbeid',j.arbeid_belop); setVal('jobbVarer',j.varer_belop ?? ''); setVal('jobbBeskrivelse',j.beskrivelse); setVal('jobbBildeDato',j.dato || today()); renderJobbBildePreview(jobBilder(j)); if($('jobbBildeFiles')) $('jobbBildeFiles').value='';
    setText('jobbFormTitle','Rediger jobb'); setText('saveJobbBtn','Oppdater jobb'); $('deleteJobbBtn')?.classList.remove('hidden'); renderJobber(); setJobbLayout('formFirst'); msg('jobbMsg','Redigerer jobb fra '+(j.dato||''),'ok');
    setTimeout(()=>{ const formTitle=$('jobbFormTitle'); if(formTitle) formTitle.scrollIntoView({behavior:'smooth', block:'start'}); }, 50);
  }
  function clearJobbForm(){ hidePostSavePrompt(); setJobbFormVisible(true); app.edit.jobb=null; ['jobbBeskrivelse'].forEach(id=>setVal(id,'')); setVal('jobbType',''); setVal('jobbDato',today()); setVal('jobbBildeDato',today()); setJobbKundeLocked(false); setVal('jobbKunde',''); fillJobbHester(); setVal('jobbHest',''); setVal('jobbKm',''); setVal('jobbKmPris','5,30'); setVal('jobbArbeid',0); setVal('jobbVarer',''); if($('jobbBildeFiles')) $('jobbBildeFiles').value=''; renderJobbBildePreview([]); setText('jobbFormTitle','Ny jobb'); setText('saveJobbBtn','Lagre jobb'); $('deleteJobbBtn')?.classList.add('hidden'); renderJobber(); msg('jobbMsg',''); }
  async function deleteJobb(){
    if(!app.edit.jobb){ msg('jobbMsg','Velg en jobb først.','err'); return; }
    if(!confirm('Slette valgt jobb?')) return;
    const {error}=await app.sb.from('hov_jobber').delete().eq('id',app.edit.jobb).eq('firma_id',app.firmaId);
    msg('jobbMsg', error?error.message:'Jobb slettet.', error?'err':'ok'); if(!error){ clearJobbForm(); await loadJobber(); }
  }


  function prisVarenrPrefix(kategori){
    const k = normText(kategori || val('prisKategori') || '');
    return /beh|behandling|massasje|terapi|laser|fysio/.test(k) ? 'beh-' : 'hov-';
  }
  function generatePrisVarenr(kategori){
    const prefix = prisVarenrPrefix(kategori);
    const used = new Set((app.data.priser || []).map(p => String(p?.varenr || '').trim().toLowerCase()).filter(Boolean));
    let max = 1000;
    for(const p of (app.data.priser || [])){
      const raw = String(p?.varenr || '').trim().toLowerCase();
      const m = raw.match(/^(hov-|beh-|vare-|var-|v-)?(\d{1,8})$/i);
      if(!m) continue;
      const itemPrefix = (m[1] || '').toLowerCase();
      if(itemPrefix && itemPrefix !== prefix) continue;
      if(!itemPrefix && prefix !== 'hov-') continue;
      max = Math.max(max, Number(m[2]) || 0);
    }
    let next = max + 1;
    let varenr = prefix + next;
    while(used.has(varenr.toLowerCase())){
      next += 1;
      varenr = prefix + next;
    }
    return varenr;
  }
  function ensurePrisVarenr(){
    const existing = val('prisVarenr');
    if(existing) return existing;
    const generated = generatePrisVarenr(val('prisKategori'));
    setVal('prisVarenr', generated);
    return generated;
  }

  function editPris(id){
    setPrisLayout('formFirst');
    const p = app.data.priser.find(x=>String(x.id)===String(id)); if(!p) return;
    app.edit.pris = p.id;
    setVal('prisKategori',p.kategori); setVal('prisVarenr',p.varenr); setVal('prisNavn',p.navn||p.jobbtype||p.vare||p.type); setVal('prisEnhet',p.enhet||'stk'); setVal('prisEksMva',p.pris_eks_mva ?? p.pris ?? p.belop ?? p.eks_mva ?? 0); setVal('prisMvaSats',p.mva_sats ?? app.firma?.standard_mva_sats ?? 25); setVal('prisInklMva',p.pris_inkl_mva ?? 0); setChecked('prisAktiv',p.aktiv !== false); setVal('prisBeskrivelse',p.beskrivelse);
    setText('prisFormTitle','Rediger pris'); setText('savePrisBtn','Oppdater pris'); $('deletePrisBtn')?.classList.remove('hidden'); renderPriser(); msg('prisImportMsg','Redigerer pris: '+(p.navn||p.jobbtype||p.vare||''),'ok');
  }
  function clearPrisForm(){
    setPrisLayout('formFirst'); app.edit.pris=null; ['prisKategori','prisVarenr','prisNavn','prisBeskrivelse'].forEach(id=>setVal(id,'')); setVal('prisEnhet','stk'); setVal('prisEksMva',0); setVal('prisMvaSats',app.firma?.standard_mva_sats ?? 25); setVal('prisInklMva',0); setChecked('prisAktiv',true); setText('prisFormTitle','Ny pris'); setText('savePrisBtn','Lagre pris'); $('deletePrisBtn')?.classList.add('hidden'); renderPriser(); msg('prisImportMsg','Varenr genereres automatisk som hov-1001 eller beh-1001 når prisen lagres.','ok'); }
  async function savePris(){
    const eks=num('prisEksMva'); const sats=num('prisMvaSats'); const inkl = num('prisInklMva') || +(eks * (1 + sats/100)).toFixed(2);
    const payload={firma_id:app.firmaId, kategori:val('prisKategori')||null, varenr:ensurePrisVarenr(), navn:val('prisNavn'), enhet:val('prisEnhet')||'stk', pris_eks_mva:eks, mva_sats:sats, pris_inkl_mva:inkl, aktiv:$('prisAktiv')?.checked !== false, beskrivelse:val('prisBeskrivelse')||null};
    if(!payload.navn){ msg('prisImportMsg','Skriv navn på prisen.','err'); return; }
    const q = app.edit.pris ? app.sb.from('hov_priser').update(payload).eq('id',app.edit.pris).select('*').single() : app.sb.from('hov_priser').insert(payload).select('*').single();
    const {error}=await q;
    msg('prisImportMsg', error?error.message:(app.edit.pris?'Pris oppdatert.':'Pris lagret.'), error?'err':'ok'); if(!error){ clearPrisForm(); await loadPriser(); renderPriser(); }
  }
  async function deletePrisById(id){
    if(!id){ msg('prisImportMsg','Velg en pris først.','err'); return; }
    const p = (app.data.priser || []).find(x=>String(x.id)===String(id));
    const navn = p ? (p.navn || p.jobbtype || p.vare || p.type || p.varenr || 'valgt pris') : 'valgt pris';
    if(!confirm('Slette pris: ' + navn + '?')) return;
    const {error}=await app.sb.from('hov_priser').delete().eq('id',id).eq('firma_id',app.firmaId);
    msg('prisImportMsg', error?error.message:'Pris slettet.', error?'err':'ok');
    if(!error){ if(String(app.edit.pris||'')===String(id)) clearPrisForm(); await loadPriser(); renderPriser(); fillJobbTypeSelect(); }
  }
  async function deletePris(){
    if(!app.edit.pris){ msg('prisImportMsg','Velg en pris først, eller trykk Slett i prislisten.','err'); return; }
    await deletePrisById(app.edit.pris);
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
    if(opts.fromVoice && !payload.jobbtype){
      payload.jobbtype = 'Innlest jobb';
      if($('jobbType')){
        const el=$('jobbType');
        if(!Array.from(el.options||[]).some(o=>o.value==='Innlest jobb')) el.innerHTML += '<option value="Innlest jobb">Innlest jobb</option>';
        el.value='Innlest jobb';
      }
    }
    if(hest && hest.kunde_id){ payload.kunde_id = hest.kunde_id; setVal('jobbKunde', hest.kunde_id); setJobbKundeLocked(true); }
    if(!opts.fromVoice && (!payload.kunde_id || !payload.hest_id || !payload.jobbtype)){ msg('jobbMsg','Velg kunde, hest og jobbtype.','err'); return false; }
    if(payload.hest_id && (!hest || (payload.kunde_id && String(hest.kunde_id)!==String(payload.kunde_id)))){ msg('jobbMsg','Hest og kunde/eier matcher ikke. Velg hest på nytt.','err'); return false; }
    try{
      let saved=null;
      if(app.edit.jobb && !opts.forceNew){
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
      clearJobbForm();
      if(opts.fromVoice && saved){
        app.data.jobber = [saved, ...(app.data.jobber||[]).filter(j=>String(j.id)!==String(saved.id))];
        try{ renderDashboard(); }catch(_){}
        if(!opts.stayOnVoice){ try{ renderJobber(); }catch(_){} }
        // Ikke vent på eller scroll til jobblisten etter innlesing.
        setTimeout(()=>{ loadJobber().then(()=>{ try{ renderDashboard(); if(!opts.stayOnVoice) renderAll(); }catch(_){} }).catch(()=>{}); }, 0);
        return saved;
      }
      await loadJobber(); return saved || true;
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
