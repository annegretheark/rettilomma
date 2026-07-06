/* Rett i Lomma - stabil Sysadm-kontroller
   Fjerner blink og gjør Sysadm-knappen operativ.
   Vanlig Admin beholdes, men Sysadm fra Auth metadata vinner alltid.
*/
(function(){
  'use strict';
  const SYS = ['sysadm','sysadmin','systemadmin'];
  const SIDE_IDS = ['timerSide','jobberSide','fravaerSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','kundeSide','kunderSide','ansattSide','firmaSide','testSide','testpanelSide','lonnPanel','lonnSide','bilBestillingerSide','adminBilBestillinger','adminBilBestillingerPanel','modulerSide','sysadminPanelSide','adminSide'];
  function $(id){ return document.getElementById(id); }
  function norm(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function isSys(r){ return SYS.includes(norm(r)); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function slug(v){ return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function appBase(){ return location.pathname.toLowerCase().includes('/rettilomma/') ? location.origin + '/rettilomma/handverker/' : location.origin + '/handverker/'; }
  function kundelink(s){ return appBase() + '?firma=' + encodeURIComponent(s || ''); }

  async function authUser(){
    try { const r = await window.supabaseClient?.auth?.getUser(); if(r?.data?.user) return r.data.user; } catch(e) {}
    try { const r = await window.supabaseClient?.auth?.getSession(); if(r?.data?.session?.user) return r.data.session.user; } catch(e) {}
    return null;
  }
  function metaRole(user){ return norm(user?.user_metadata?.rolle || user?.user_metadata?.role || user?.app_metadata?.rolle || user?.app_metadata?.role); }
  async function isSysadmUser(){
    const user = await authUser();
    const r = metaRole(user) || norm(window.innloggetRolle || localStorage.getItem('handInnloggetRolle'));
    return isSys(r);
  }
  function forceSysadm(){
    try { if(typeof window.handLockSysadmRole === 'function') window.handLockSysadmRole(); } catch(e) {}
    window.innloggetRolle = 'sysadm';
    window.HAND_ROLE = 'sysadm';
    window.erSystemadmin = true;
    window.erAdmin = true;
    window.handErAdmin = true;
    try {
      localStorage.setItem('handInnloggetRolle','sysadm');
      localStorage.setItem('innloggetRolle','sysadm');
      localStorage.setItem('rilSysadminModus','ja');
      localStorage.setItem('rilAdminModus','ja');
    } catch(e) {}
    document.documentElement.classList.add('ril-role-ready','ril-sysadm-ready','ril-admin-ready');
    if(document.body){ document.body.classList.add('ril-er-sysadm','ril-er-admin'); document.body.classList.remove('ril-vanlig-bruker'); }
  }

  function setVisible(el, yes, display){
    if(!el) return;
    if(yes){ el.classList.remove('skjult','hidden','modul-skjult'); el.hidden = false; el.style.display = display || ''; el.removeAttribute('aria-hidden'); }
    else { el.classList.add('skjult','hidden'); el.hidden = true; el.style.display = 'none'; el.setAttribute('aria-hidden','true'); }
  }
  function ensurePanel(){
    let panel = $('sysadminPanelSide');
    const app = $('appSide');
    if(!panel && app){
      panel = document.createElement('section');
      panel.id = 'sysadminPanelSide';
      panel.className = 'kort systemadmin-only';
      app.appendChild(panel);
    }
    if(panel && !panel.querySelector('#handSystemadminBlokk')){
      panel.innerHTML = '<h2>Systemadministrasjon</h2><p class="info">Her administrerer Sysadm håndverkerfirmaer, moduler og kundelinker.</p>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button id="sysadminNyKundeKnapp" type="button" style="background:#0f766e">Ny håndverkerkunde</button><button id="sysadminKundelisteKnapp" type="button" class="secondary">Oppdater kundeliste</button><button id="sysadminModulerKnapp" type="button" class="secondary">Moduler</button></div>'+
        '<div id="handSystemadminBlokk" class="kort" style="border:2px solid #0f766e;margin-bottom:14px"><h3>Håndverkerkunde</h3><input id="redigerHandKundeId" type="hidden"><label>Firmanavn</label><input id="nyHandKundeNavn" class="hand-wide-input"><label>E-post til kunde/admin</label><input id="nyHandKundeEpost" type="email" class="hand-wide-input"><label>Telefon</label><input id="nyHandKundeTelefon" class="hand-wide-input"><label>Adresse</label><input id="nyHandKundeAdresse" class="hand-wide-input"><label>Org.nr</label><input id="nyHandKundeOrgNr" class="hand-wide-input"><label>Linknavn</label><input id="nyHandKundeLinknavn" readonly class="hand-wide-input"><label>Kundelink</label><input id="nyHandKundeLink" readonly class="hand-wide-input"><button type="button" onclick="handOpprettKundeDirekte()">Opprett ny kunde</button><button type="button" class="secondary" onclick="handNullstillKundeSkjema&&handNullstillKundeSkjema()">Ny/tøm skjema</button><div id="nyHandKundeMelding" class="melding"></div><hr><h3>Håndverkerkunder</h3><div id="handKundeAdminListe" class="info">Ingen kunder lastet ennå.</div></div>';
    }
    return panel;
  }
  function showOnly(id){
    const app = $('appSide'); if(app){ setVisible(app, true); app.classList.remove('ril-starter'); }
    SIDE_IDS.forEach(sid => { const el = $(sid); if(el) setVisible(el, sid === id); });
  }
  function showSysadmPanel(){
    forceSysadm();
    const panel = ensurePanel();
    showOnly('sysadminPanelSide');
    setVisible(panel, true);
    const block = $('handSystemadminBlokk'); setVisible(block, true);
    const menu = $('adminMenyPanel'); if(menu){ menu.style.display='none'; menu.classList.remove('open'); }
    if(typeof window.handLastKundeliste === 'function') { try { window.handLastKundeliste(); } catch(e) { console.warn(e); } }
    else loadFirmaList();
    return false;
  }

  async function loadFirmaList(){
    const list = $('handKundeAdminListe');
    if(!list || !window.supabaseClient) return;
    list.innerHTML = '<div class="info">Henter håndverkerfirmaer...</div>';
    try{
      let r = await window.supabaseClient.from('hand_firma').select('*').order('navn', {ascending:true});
      if(r.error) r = await window.supabaseClient.from('hand_firma').select('*');
      if(r.error) throw r.error;
      const rows = Array.isArray(r.data) ? r.data : [];
      if(!rows.length){ list.innerHTML = '<div class="info">Ingen firma funnet.</div>'; return; }
      window.handAdminKunder = rows;
      list.innerHTML = '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Firma</th><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">E-post</th><th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Link</th></tr></thead><tbody>'+
        rows.map(k => { const s = k.linknavn || slug(k.navn || k.firmanavn || k.epost || k.id); return '<tr><td style="padding:6px;border-bottom:1px solid #374151">'+esc(k.navn || k.firmanavn || '')+'</td><td style="padding:6px;border-bottom:1px solid #374151">'+esc(k.epost || k.email || '')+'</td><td style="padding:6px;border-bottom:1px solid #374151"><a target="_blank" style="color:#93c5fd" href="'+esc(kundelink(s))+'">'+esc(s)+'</a></td></tr>'; }).join('')+'</tbody></table></div>';
    }catch(e){ list.innerHTML = '<div class="melding">Kunne ikke hente firmaer: '+esc(e.message || e)+'</div>'; }
  }

  async function upsertFirmaBrukerAdmin(firma, name, email){
    if(!firma || !firma.id || !email) return;
    const rad = { firma_id: firma.id, epost: email, rolle: 'admin' };
    try{
      const ex = await window.supabaseClient.from('hand_firma_bruker').select('id').eq('firma_id', firma.id).eq('epost', email).limit(1);
      if(!ex.error && ex.data && ex.data.length) await window.supabaseClient.from('hand_firma_bruker').update(rad).eq('id', ex.data[0].id);
      else await window.supabaseClient.from('hand_firma_bruker').insert([rad]);
    }catch(e){ console.warn('Eier/admin kunne ikke lagres i hand_firma_bruker:', e); }
  }

  async function createFirmaFallback(){
    forceSysadm();
    const name = ($('nyHandKundeNavn')?.value || '').trim();
    const email = ($('nyHandKundeEpost')?.value || '').trim().toLowerCase();
    const msg = $('nyHandKundeMelding');
    function say(t, bad){ if(msg){ msg.textContent=t; msg.style.color=bad?'#fca5a5':'#86efac'; } }
    if(!name){ say('Skriv firmanavn.', true); return; }
    if(!email){ say('Skriv e-post.', true); return; }
    const s = slug(name);
    if($('nyHandKundeLinknavn')) $('nyHandKundeLinknavn').value = s;
    if($('nyHandKundeLink')) $('nyHandKundeLink').value = kundelink(s);
    try{
      say('Oppretter firma...');
      let payload = { navn:name, epost:email, telefon:$('nyHandKundeTelefon')?.value || null, adresse:$('nyHandKundeAdresse')?.value || null, orgnr:$('nyHandKundeOrgNr')?.value || null, linknavn:s, system_type:'handverker', moduler_konfigurert:false, moduler:{} };
      let r = await window.supabaseClient.from('hand_firma').insert([payload]).select('*').maybeSingle();
      if(r.error){
        payload = { navn:name, epost:email, linknavn:s };
        r = await window.supabaseClient.from('hand_firma').insert([payload]).select('*').maybeSingle();
      }
      if(r.error) throw r.error;
      try { await window.supabaseClient.from('hand_ansatt').insert([{firma_id:r.data.id, navn:name, epost:email, rolle:'admin'}]); } catch(e) {}
      await upsertFirmaBrukerAdmin(r.data, name, email);
      say('Firma opprettet.');
      if(typeof window.handLastKundeliste === 'function') await window.handLastKundeliste(); else await loadFirmaList();
    }catch(e){ say('Feil: '+(e.message || e), true); }
  }

  function bind(){
    document.documentElement.classList.add('ril-role-ready');
    if(isSys(window.innloggetRolle || localStorage.getItem('handInnloggetRolle'))) forceSysadm();
    const sysBtn = $('sysadminModeKnapp');
    if(sysBtn){
      setVisible(sysBtn, window.erSystemadmin === true || isSys(window.innloggetRolle));
      sysBtn.textContent = 'Sysadm';
      sysBtn.onclick = function(ev){ ev.preventDefault(); ev.stopPropagation(); return showSysadmPanel(); };
    }
    const listBtn = $('sysadminKundelisteKnapp'); if(listBtn) listBtn.onclick = function(ev){ ev.preventDefault(); forceSysadm(); if(typeof window.handLastKundeliste === 'function') window.handLastKundeliste(); else loadFirmaList(); return false; };
    const modBtn = $('sysadminModulerKnapp'); if(modBtn) modBtn.onclick = function(ev){ ev.preventDefault(); forceSysadm(); if(typeof window.visModulerSide === 'function') window.visModulerSide(); return false; };
    const nyBtn = $('sysadminNyKundeKnapp'); if(nyBtn) nyBtn.onclick = function(ev){ ev.preventDefault(); forceSysadm(); $('handSystemadminBlokk')?.scrollIntoView({behavior:'smooth', block:'start'}); return false; };
    window.handVisSysadminPanel = showSysadmPanel;
    window.visHandKundeAdminSide = showSysadmPanel;
    if(!window.handOpprettKundeDirekte) window.handOpprettKundeDirekte = createFirmaFallback;
    const origOpprett = window.handOpprettKundeDirekte;
    window.handOpprettKundeDirekte = async function(){ forceSysadm(); return origOpprett ? origOpprett.apply(this, arguments) : createFirmaFallback(); };
    const roleSpan = $('innloggetRolleVisning'); if(roleSpan && window.erSystemadmin) roleSpan.textContent = ' (rolle: sysadm)';
  }

  async function start(){
    if(await isSysadmUser()) forceSysadm();
    bind();
    setTimeout(bind, 200);
    setTimeout(bind, 800);
    setTimeout(function(){ document.documentElement.classList.add('ril-role-ready'); }, 1200);
  }
  document.addEventListener('DOMContentLoaded', start);
  document.addEventListener('handPartialerLastet', start);
  window.addEventListener('load', start);
  start();
})();
