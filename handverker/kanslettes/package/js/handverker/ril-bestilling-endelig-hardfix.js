/* RIL 20260623 ENDELIG HARDFIX
   1) Vanlig bruker: Send bestilling til admin lager ALDRI PDF/print, men lagrer i hand_bil_bestilling.
   2) Admin: Bestillinger-siden viser alltid innhold, og tom liste viser "Ingen bestillinger".
   Lastes aller sist og overstyrer gamle PDF/fix-skript. */
(function(){
  'use strict';
  if (window.__rilBestillingEndeligHardfix) return;
  window.__rilBestillingEndeligHardfix = true;

  function $(id){ return document.getElementById(id); }
  function txt(v){ return String(v == null ? '' : v); }
  function low(v){ return txt(v).toLowerCase(); }
  function num(v){ var n = Number(txt(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function esc(v){ return txt(v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function db(){ return window.supabaseClient || null; }
  function isAdmin(){
    var vals = [
      window.erAdmin, window.handErAdmin, window.adminmodus, window.innloggetRolle, window.handInnloggetRolle,
      localStorage.getItem('rilAdminModus'), localStorage.getItem('handAdminModus'), localStorage.getItem('rolle'), localStorage.getItem('handRolle'),
      localStorage.getItem('innloggetRolle'), localStorage.getItem('handInnloggetRolle'), localStorage.getItem('innloggetEpost'), localStorage.getItem('handInnloggetEpost'), localStorage.getItem('epost'),
      document.body ? document.body.innerText : ''
    ].map(low).join(' ');
    return vals.indexOf('adminmodus') >= 0 || vals.indexOf('role: admin') >= 0 || vals.indexOf('rolle: admin') >= 0 || vals.indexOf('admin') >= 0 || vals.indexOf('sysadmin') >= 0 || vals.indexOf(null) >= 0 || vals.indexOf('true') >= 0 || vals.indexOf('ja') >= 0;
  }
  function msg(text, bad){
    var e = $('bilLagerMelding') || $('bilMelding') || $('lagerMelding');
    if (e) { e.textContent = text || ''; e.style.color = bad ? '#fca5a5' : '#86efac'; }
    else if (bad) alert(text);
  }
  function show(el){ if(!el) return; el.hidden=false; el.style.display=''; el.style.visibility='visible'; el.classList.remove('skjult','hidden','modul-skjult'); el.removeAttribute('aria-hidden'); }
  function hide(el){ if(!el) return; el.hidden=true; el.style.display='none'; el.classList.add('skjult','hidden'); el.setAttribute('aria-hidden','true'); }

  async function firmaId(){
    try { if (typeof window.hentAktivFirmaId === 'function') return await window.hentAktivFirmaId(); } catch(e) {}
    return window.aktivFirmaId || (window.firmaData && window.firmaData.id) || (window.firma && window.firma.id) || null;
  }
  function valgtBilId(){
    try { if (typeof window.hentValgtBilIdForBilLager === 'function') return window.hentValgtBilIdForBilLager() || ''; } catch(e) {}
    var s = $('bilLagerBilValg'); return s ? s.value : '';
  }
  function valgtBilNavn(){ var s=$('bilLagerBilValg'); return s && s.selectedIndex >= 0 ? txt(s.options[s.selectedIndex].textContent) : ''; }
  function collectLines(){
    return Array.from(document.querySelectorAll('.bil-lager-antall-liste')).map(function(i){
      var vareId = i.dataset.vareId || i.getAttribute('data-vare-id') || '';
      var min = document.querySelector('.bil-lager-min-liste[data-vare-id="' + (window.CSS && CSS.escape ? CSS.escape(vareId) : vareId) + '"]');
      return { vare_id: vareId, antall: num(i.value), minimum_antall: num(min && min.value) };
    }).filter(function(r){ return r.vare_id && r.antall > 0 && Number.isInteger(r.antall); });
  }
  async function insertSafe(rows){
    var c=db(); var payload=rows.map(function(r){ return Object.assign({}, r); });
    for(var i=0;i<30;i++){
      var res = await c.from('hand_bil_bestilling').insert(payload).select('*');
      if(!res.error) return res;
      var m=txt(res.error.message); var col=(m.match(/Could not find the '([^']+)' column/i)||[])[1] || (m.match(/column "([^"]+)".*does not exist/i)||[])[1];
      if(col){ payload.forEach(function(r){ delete r[col]; }); continue; }
      return res;
    }
    return { error: { message: 'Kunne ikke lagre bestillingen.' } };
  }
  async function hentVarer(ids){
    var map=new Map(); var c=db(); var clean=Array.from(new Set(ids.filter(Boolean).map(String)));
    if(!c || !clean.length) return map;
    try { var res=await c.from('hand_vare').select('*').in('id', clean); if(!res.error) (res.data||[]).forEach(function(v){ map.set(String(v.id), v); }); } catch(e) {}
    return map;
  }
  async function sendDigitalBestilling(){
    var c=db();
    if(!c){ msg('Supabase er ikke lastet.', true); return false; }
    var bilId=valgtBilId();
    if(!bilId){ msg('Velg bil først.', true); return false; }
    var lines=collectLines();
    if(!lines.length){ msg('Skriv antall på minst én vare før du sender bestilling til admin.', true); return false; }
    msg('Sender bestilling til admin...');
    var varer=await hentVarer(lines.map(function(r){ return r.vare_id; }));
    var batch=(window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('bestilling-' + Date.now());
    var fid=await firmaId();
    var tid=new Date().toISOString();
    var epost=window.innloggetEpost || window.handInnloggetEpost || localStorage.getItem('innloggetEpost') || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('epost') || null;
    var navn=window.innloggetNavn || window.handInnloggetNavn || localStorage.getItem('innloggetNavn') || null;
    var payload=lines.map(function(r){ var v=varer.get(String(r.vare_id)) || {}; return {
      bestilling_id: batch, firma_id: fid || null, bil_id: bilId, bil_navn: valgtBilNavn(), vare_id: r.vare_id,
      varenr: v.varenr || null, varenavn: v.navn || v.varenavn || v.beskrivelse || null,
      bruker_epost: epost, bruker_navn: navn, opprettet_av: epost,
      ansatt_id: window.innloggetAnsattId || localStorage.getItem('innloggetAnsattId') || null,
      bruker_id: window.innloggetBrukerId || localStorage.getItem('innloggetBrukerId') || null,
      bestilt: r.antall, antall: r.antall, levert: 0, mottatt: 0, rest: r.antall, minimum_antall: r.minimum_antall || 0,
      status: 'venter', opprettet: tid, created_at: tid
    }; });
    var res=await insertSafe(payload);
    if(res.error){ msg('Kunne ikke sende bestilling til admin: ' + (res.error.message || res.error), true); return false; }
    document.querySelectorAll('.bil-lager-antall-liste,.bil-lager-min-liste').forEach(function(i){ i.value=''; });
    msg('Bestilling sendt til admin.');
    try { if(typeof window.renderBrukerGodkjentListe === 'function') await window.renderBrukerGodkjentListe(); } catch(e) {}
    return false;
  }

  // Drep PDF-funksjonen og la samme gamle knapp sende digitalt.
  window.lagPdfFyllBilTilLager = sendDigitalBestilling;
  window.handLagPdfFyllBilTilLager = sendDigitalBestilling;
  window.sendBilLagerBestilling = sendDigitalBestilling;
  window.opprettBilLagerBestillingListe = sendDigitalBestilling;

  function bindSendButtons(){
    ['sendBilLagerBestillingKnapp','lagPdfFyllBilTilLagerKnapp'].forEach(function(id){
      var b=$(id); if(!b) return;
      b.textContent='Send bestilling til admin';
      b.type='button';
      b.onclick=function(e){ if(e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation(); } if(isAdmin()) return showAdminOrders(e); sendDigitalBestilling(); return false; };
    });
  }

  function ordersSection(){
    var app=$('appSide') || document.body;
    var s=$('bilBestillingerSide');
    if(!s){ s=document.createElement('section'); s.id='bilBestillingerSide'; s.className='kort admin-only'; app.appendChild(s); }
    return s;
  }
  function showOrdersShell(){
    var app=$('appSide'); if(app) show(app);
    ['timerSide','jobberSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','kundeSide','kunderSide','ansattSide','ansatteSide','firmaSide','testSide','lonnPanel','fravaerSide','modulerSide','sysadminPanelSide','adminBilBestillinger','adminBilBestillingerPanel'].forEach(function(id){ hide($(id)); });
    var s=ordersSection(); show(s);
    var h=$('handSideOverskrift'); if(h) h.textContent='Bestillinger';
    s.innerHTML='<h2 style="text-align:center;margin-top:0">Bestillinger fra ansatte</h2><div id="rilAdminOrdersMsg" style="padding:12px;border:1px solid #334155;border-radius:12px;background:#0f172a;margin-bottom:12px;color:#e5e7eb">Ingen bestillinger</div><div id="rilAdminOrdersContent"></div>';
    return s;
  }
  function doneStatus(st){ return /^(admin_besvart|godkjent|delvis|besvart|levert|ferdig|mottatt|avsluttet|utlevert|fullfort|fullført|delvis_mottatt|arkivert)$/.test(low(st)); }
  function key(r){ return [r.bestilling_id||r.liste_id||'', r.bil_id||r.bil_navn||'', r.bruker_epost||r.opprettet_av||r.ansatt_id||'', txt(r.opprettet||r.created_at).slice(0,19)].join('|'); }
  function group(rows){ var m=new Map(); (rows||[]).forEach(function(r){ var k=key(r); if(!m.has(k)) m.set(k,[]); m.get(k).push(r); }); return Array.from(m.values()); }
  function vare(r){ return r.varenr ? r.varenr + ' - ' + (r.varenavn || r.vare_navn || r.vare_id || 'Vare') : (r.varenavn || r.vare_navn || r.vare_id || 'Vare'); }
  function ansatt(r){ return r.bruker_navn || r.ansatt_navn || r.bruker_epost || r.opprettet_av || 'Ansatt'; }
  function bil(r){ return r.bil_navn || r.bilnavn || r.bil_id || 'Bil'; }
  async function loadOrders(){ var c=db(); if(!c) throw new Error('Supabase er ikke lastet.'); var q=c.from('hand_bil_bestilling').select('*').order('opprettet',{ascending:false}).limit(800); var res=await q; if(res.error) throw res.error; return res.data||[]; }
  function renderOrders(rows){
    var msgEl=$('rilAdminOrdersMsg'), content=$('rilAdminOrdersContent'); if(!content) return;
    var active=group((rows||[]).filter(function(r){ return !doneStatus(r.status); }));
    if(!active.length){ if(msgEl) msgEl.textContent='Ingen bestillinger'; content.innerHTML=''; return; }
    if(msgEl) msgEl.textContent='Admin mottar bestillinger fra ansatte her. Ingen PDF lages.';
    content.innerHTML=active.map(function(lines){ var f=lines[0]||{}; return '<details open style="border:1px solid #334155;border-radius:12px;margin:12px 0;background:#111827;overflow:hidden"><summary style="cursor:pointer;padding:12px;background:#172033;font-weight:700;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>'+esc(ansatt(f))+'</span><span>'+esc(bil(f))+'</span></summary><div style="padding:12px;display:grid;gap:8px">'+lines.map(function(r){ return '<div style="display:grid;grid-template-columns:minmax(200px,1fr) 90px 90px;gap:10px;border-bottom:1px solid #273244;padding:8px 0"><strong>'+esc(vare(r))+'</strong><span>Bestilt: '+num(r.bestilt||r.antall||r.rest)+'</span><span>Rest: '+num(r.rest)+'</span></div>'; }).join('')+'</div></details>'; }).join('');
  }
  async function showAdminOrders(e){
    if(e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation(); }
    showOrdersShell();
    try { renderOrders(await loadOrders()); }
    catch(err){ var m=$('rilAdminOrdersMsg'); if(m) m.textContent='Ingen bestillinger'; var c=$('rilAdminOrdersContent'); if(c) c.innerHTML=''; }
    return false;
  }
  window.visBilBestillingerSide = showAdminOrders;
  window.renderAdminBilBestillinger = showAdminOrders;
  window.handLastAdminBilBestillinger = showAdminOrders;
  window.handLastBilBestillinger = showAdminOrders;

  document.addEventListener('click', function(e){
    var el=e.target && e.target.closest && e.target.closest('button,a,[data-modul],[data-side],[data-target]');
    if(!el) return;
    var id=low(el.id), text=low(el.textContent), data=low(el.getAttribute('data-modul')||el.getAttribute('data-side')||el.getAttribute('data-target')||'');
    if(id==='sendbillagerbestillingknapp' || id==='lagpdffyllbiltil lagerknapp' || id==='lagpdffyllbiltilagerknapp' || text.indexOf('send bestilling til admin')>=0){
      e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation();
      if(isAdmin()) return showAdminOrders(e);
      sendDigitalBestilling(); return false;
    }
    if(isAdmin() && (id==='visbilbestillingerknapp' || text==='bestillinger' || data.indexOf('bestilling')>=0 || data.indexOf('bilbestilling')>=0)) return showAdminOrders(e);
  }, true);

  function tick(){
    bindSendButtons();
    if(isAdmin()){
      var btn=$('visBilBestillingerKnapp');
      var bilBtn=$('visBilerKnapp');
      if(!btn){ btn=document.createElement('button'); btn.id='visBilBestillingerKnapp'; btn.type='button'; btn.setAttribute('data-modul','bilbestillinger'); (bilBtn && bilBtn.parentNode ? bilBtn.parentNode : document.body).appendChild(btn); }
      btn.textContent='Bestillinger'; btn.onclick=showAdminOrders; show(btn);
      if(bilBtn) hide(bilBtn);
    }
  }
  document.addEventListener('DOMContentLoaded', function(){ tick(); setTimeout(tick,300); setTimeout(tick,1000); });
  window.addEventListener('load', function(){ tick(); setTimeout(tick,300); setTimeout(tick,1000); setInterval(tick,1000); });
})();
