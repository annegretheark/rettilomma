/* RIL/AGK 2026-07-05: Stabil bestillingsflyt.
   Bruker bestiller -> admin godkjenner/restsetter -> bruker bekrefter -> varer legges på bil -> lagerlogg oppdateres. */
(function(){
  'use strict';
  if (window.__HAND_BESTILLING_FLOW_FINAL_V1__) return;
  window.__HAND_BESTILLING_FLOW_FINAL_V1__ = true;

  var busySend = false;
  var busyAdmin = false;
  var busyUser = false;
  var showHistory = false;

  function $(id){ return document.getElementById(id); }
  function s(v){ return String(v == null ? '' : v); }
  function low(v){ return s(v).toLowerCase(); }
  function esc(v){ return s(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function num(v){ var n = Number(s(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function intNum(v){ return Math.max(0, Math.round(num(v))); }
  function now(){ return new Date().toISOString(); }
  function db(){ return window.supabaseClient || window.supabase || null; }
  function txt(el){ return s(el && (el.innerText || el.textContent || el.value || el.title || (el.getAttribute && el.getAttribute('aria-label')))).trim(); }
  function currentEmail(){ return window.innloggetEpost || window.handInnloggetEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('epost') || ''; }
  function currentName(){ return window.innloggetAnsattNavn || window.innloggetNavn || window.handInnloggetNavn || localStorage.getItem('innloggetAnsattNavn') || localStorage.getItem('handInnloggetNavn') || localStorage.getItem('innloggetNavn') || currentEmail(); }
  function currentAnsattId(){ return window.innloggetAnsattId || localStorage.getItem('innloggetAnsattId') || localStorage.getItem('ansattId') || ''; }
  async function firmaId(){ try{ if(typeof window.hentAktivFirmaId === 'function') return await window.hentAktivFirmaId(); }catch(_){} return window.aktivFirmaId || localStorage.getItem('aktivFirmaId') || localStorage.getItem('firmaId') || localStorage.getItem('firma_id') || null; }
  function isAdmin(){
    var vals=[window.erAdmin,window.handErAdmin,window.adminmodus,window.innloggetRolle,window.handInnloggetRolle,localStorage.getItem('rilAdminModus'),localStorage.getItem('handAdminModus'),localStorage.getItem('rolle'),localStorage.getItem('handRolle'),localStorage.getItem('innloggetRolle'),localStorage.getItem('handInnloggetRolle')].map(low).join(' ');
    return vals.indexOf('admin')>=0 || vals.indexOf('true')>=0 || vals.indexOf('ja')>=0 || document.body && /\(rolle:\s*admin\)/i.test(document.body.innerText||'');
  }
  function valgtBilId(){ try{ if(typeof window.hentValgtBilIdForBilLager === 'function') return window.hentValgtBilIdForBilLager() || ''; }catch(_){} var el=$('bilLagerBilValg')||document.querySelector('select[id*="bil" i],select[name*="bil" i]'); return (el && el.value) || localStorage.getItem('aktivBilId') || ''; }
  function valgtBilNavn(){ var el=$('bilLagerBilValg')||document.querySelector('select[id*="bil" i],select[name*="bil" i]'); if(el && el.selectedIndex>=0 && el.options[el.selectedIndex]) return txt(el.options[el.selectedIndex]); return localStorage.getItem('aktivBilNavn') || ''; }

  async function insertSafe(table, rows){
    var c=db(); if(!c) return {error:{message:'Supabase er ikke lastet'}};
    var data=(Array.isArray(rows)?rows:[rows]).map(function(r){return Object.assign({},r);});
    for(var i=0;i<80;i++){
      var res=await c.from(table).insert(data).select('*');
      if(!res.error) return res;
      var msg=s(res.error.message);
      var col=(msg.match(/Could not find the '([^']+)' column/i)||[])[1] || (msg.match(/column "([^"]+)".*does not exist/i)||[])[1];
      if(col){ data.forEach(function(r){ delete r[col]; }); continue; }
      var bad=(msg.match(/invalid input syntax for type uuid:\s*"([^"]+)"/i)||[])[1];
      if(bad){ data.forEach(function(r){ Object.keys(r).forEach(function(k){ if(s(r[k])===s(bad)) delete r[k]; }); }); continue; }
      return res;
    }
    return {error:{message:'Kunne ikke lagre i '+table}};
  }
  async function updateSafe(table, id, changes){
    var c=db(); if(!c) return {error:{message:'Supabase er ikke lastet'}};
    var data=Object.assign({},changes);
    for(var i=0;i<80;i++){
      var res=await c.from(table).update(data).eq('id', id).select('*');
      if(!res.error) return res;
      var msg=s(res.error.message);
      var col=(msg.match(/Could not find the '([^']+)' column/i)||[])[1] || (msg.match(/column "([^"]+)".*does not exist/i)||[])[1];
      if(col && Object.prototype.hasOwnProperty.call(data,col)){ delete data[col]; continue; }
      return res;
    }
    return {error:{message:'Kunne ikke oppdatere '+table}};
  }
  async function fetchMap(table, ids){
    var c=db(), m=new Map(); ids=Array.from(new Set((ids||[]).filter(Boolean).map(String)));
    if(!c || !ids.length) return m;
    try{ var r=await c.from(table).select('*').in('id', ids); if(!r.error) (r.data||[]).forEach(function(x){m.set(String(x.id),x);}); }catch(_){}
    return m;
  }
  async function hydrate(rows){
    rows=rows||[];
    var vm=await fetchMap('hand_vare', rows.map(function(r){return r.vare_id;}));
    var bm=await fetchMap('hand_bil', rows.map(function(r){return r.bil_id;}));
    rows.forEach(function(r){
      var v=r.vare_id?vm.get(String(r.vare_id)):null;
      if(v){ r.varenr=r.varenr||v.varenr||v.vare_nr||v.nr; r.varenavn=r.varenavn||r.vare_navn||v.navn||v.varenavn||v.beskrivelse; }
      var b=r.bil_id?bm.get(String(r.bil_id)):null;
      if(b){ r.bil_navn=r.bil_navn||b.navn||b.regnr||b.registreringsnummer||b.bilnavn; }
    });
    return rows;
  }

  function orderedAmount(r){ return intNum(r.bestilt || r.bestilt_antall || r.antall || r.rest || 0); }
  function restAmount(r){ return intNum(r.rest || 0); }
  function approvedAmount(r){
    var direct=intNum(r.godkjent || r.levert || r.bekreftet_antall || r.admin_godkjent_antall || r.godkjent_antall || 0);
    if(direct>0) return direct;
    var b=orderedAmount(r), rest=restAmount(r);
    if(isAdminAnswered(r) && b>0) return Math.max(0,b-rest);
    return 0;
  }
  function isOnCar(r){ return /^(lagt_pa_bil|ansatt_godkjent|utlevert|ferdig|avsluttet|fullfort|fullført|arkivert)$/i.test(s(r.status)) || r.lagt_pa_bil===true || r.ansatt_godkjent===true || !!r.lagt_pa_bil_at || !!r.ansatt_godkjent_at; }
  function isAdminAnswered(r){ return /^(admin_bekreftet|admin_besvart|admin_godkjent|bekreftet|godkjent|besvart|rest_hos_admin|restordre_admin|restordre|delvis_admin|delvis_bekreftet)$/i.test(s(r.status)) || r.bekreftet===true || r.admin_godkjent===true || r.admin_svar_sendt===true; }
  function isActiveForAdmin(r){ return !isAdminAnswered(r) && !isOnCar(r); }
  function lineName(r){ return [r.varenr || r.vare_nr, r.varenavn || r.vare_navn || r.navn || r.vare_id || 'Vare'].filter(Boolean).join(' - '); }
  function employeeName(r){ return r.bruker_navn || r.ansatt_navn || r.bruker_epost || r.opprettet_av || r.hentet_av || 'Ansatt'; }
  function groupKey(r){ return [r.bestilling_id||r.batch_id||r.ordre_id||'', r.bil_id||r.bil_navn||'', r.bruker_epost||r.bruker_navn||r.opprettet_av||'', s(r.opprettet||r.created_at).slice(0,16)].join('|'); }
  function groups(rows){ var m=new Map(); (rows||[]).forEach(function(r){ var k=groupKey(r); if(!m.has(k)) m.set(k,[]); m.get(k).push(r); }); return Array.from(m.values()); }
  async function loadOrders(){ var c=db(); if(!c) throw new Error('Supabase er ikke lastet'); var r=await c.from('hand_bil_bestilling').select('*').order('opprettet',{ascending:false}).limit(1000); if(r.error) throw r.error; return hydrate(r.data||[]); }

  function message(el,msg,bad){ if(el){ el.textContent=msg; el.style.color=bad?'#fca5a5':'#dbeafe'; } }
  function sendButton(el){ var b=el&&el.closest&&el.closest('button,a,input[type="button"],input[type="submit"],[role="button"]'); if(!b) return null; var id=low((b.id||'')+' '+(b.name||'')+' '+(b.className||'')); var t=low(txt(b)); if(id.indexOf('sendbillagerbestillingknapp')>=0 || id.indexOf('lagpdffyllbiltilagerknapp')>=0 || t.indexOf('send bestilling til admin')>=0 || t.indexOf('lag bestilling til admin')>=0) return b; return null; }
  function adminButton(el){ var b=el&&el.closest&&el.closest('button,a,[role="button"],[data-modul],[data-side],[data-target]'); if(!b) return null; var t=low(txt(b)).trim(); var id=low(b.id||''); var d=low((b.getAttribute&&((b.getAttribute('data-modul')||'')+' '+(b.getAttribute('data-side')||'')+' '+(b.getAttribute('data-target')||'')))||''); if(t==='bestillinger' || id==='visbilbestillingerknapp' || d.indexOf('bestilling')>=0) return b; return null; }

  function orderInputs(){
    var out=[];
    document.querySelectorAll('.bil-lager-antall-liste,input[data-vare-id][type="number"],input[data-vare-id][inputmode="numeric"]').forEach(function(inp){
      var ant=intNum(inp.value); if(ant<=0) return;
      var vareId=inp.dataset.vareId || inp.getAttribute('data-vare-id') || '';
      var row=inp.closest('tr,.vare-rad,.lager-rad,.rad,li,div');
      var cells=row?Array.from(row.querySelectorAll('td,th')):[];
      var min=null; try{ if(vareId) min=document.querySelector('.bil-lager-min-liste[data-vare-id="'+(window.CSS&&CSS.escape?CSS.escape(vareId):vareId)+'"]'); }catch(_){}
      out.push({vare_id:vareId||null, varenr:cells[0]?txt(cells[0]):null, varenavn:cells[1]?txt(cells[1]):null, antall:ant, minimum_antall:intNum(min&&min.value)});
    });
    return out;
  }
  async function sendOrder(ev){
    if(ev){ ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation(); }
    if(busySend) return false; busySend=true;
    var msg=$('bilMelding')||$('bilLagerMelding')||$('lagerbestillingMelding');
    try{
      var c=db(); if(!c){ message(msg,'Supabase er ikke lastet.',true); return false; }
      var bil=valgtBilId(); if(!bil){ message(msg,'Velg bil først.',true); return false; }
      var rows=orderInputs(); if(!rows.length){ message(msg,'Skriv antall på minst én vare før du sender bestilling til admin.',true); return false; }
      message(msg,'Sender bestilling til admin...');
      var varer=await fetchMap('hand_vare', rows.map(function(x){return x.vare_id;}));
      var batch=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():('bestilling-'+Date.now());
      var fid=await firmaId(), ep=currentEmail(), navn=currentName(), t=now();
      var payload=rows.map(function(r){ var v=r.vare_id?(varer.get(String(r.vare_id))||{}):{}; return {bestilling_id:batch,firma_id:fid,bil_id:bil,bil_navn:valgtBilNavn(),vare_id:r.vare_id,varenr:r.varenr||v.varenr||v.vare_nr||v.nr||null,varenavn:r.varenavn||v.navn||v.varenavn||v.beskrivelse||null,bruker_epost:ep,bruker_navn:navn,opprettet_av:ep,ansatt_id:currentAnsattId()||null,bestilt:r.antall,antall:r.antall,levert:0,mottatt:0,godkjent:0,rest:r.antall,minimum_antall:r.minimum_antall,status:'venter',opprettet:t,created_at:t}; });
      var res=await insertSafe('hand_bil_bestilling',payload);
      if(res.error){ message(msg,'Kunne ikke sende bestilling til admin: '+(res.error.message||res.error),true); return false; }
      rows.forEach(function(){ }); document.querySelectorAll('.bil-lager-antall-liste,input[data-vare-id][type="number"],input[data-vare-id][inputmode="numeric"]').forEach(function(i){ i.value=''; });
      message(msg,'Bestilling sendt til admin.'); setTimeout(showUserApproved,700); return false;
    } finally { setTimeout(function(){ busySend=false; },800); }
  }

  function adminShell(){
    var app=$('appSide')||document.body; if(app){ app.hidden=false; app.style.display=''; }
    ['timerSide','jobberSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','kundeSide','kunderSide','ansattSide','ansatteSide','firmaSide','testSide','lonnPanel','fravaerSide','modulerSide','sysadminPanelSide','adminBilBestillinger','adminBilBestillingerPanel'].forEach(function(id){ var e=$(id); if(e){ e.hidden=true; e.style.display='none'; } });
    var side=$('bilBestillingerSide'); if(!side){ side=document.createElement('section'); side.id='bilBestillingerSide'; side.className='kort'; (app||document.body).appendChild(side); }
    side.hidden=false; side.style.display=''; var h=$('handSideOverskrift'); if(h) h.textContent='Bestillinger';
    side.innerHTML='<h2 style="text-align:center;margin-top:0">Bestillinger fra ansatte</h2><div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px"><button id="handBestAktive" type="button">Aktive bestillinger</button><button id="handBestHistorikk" type="button" class="secondary">Tidligere bestillinger</button></div><div id="handBestMsg" class="info" style="padding:12px;border:1px solid #334155;border-radius:10px;margin-bottom:12px">Henter bestillinger...</div><div id="handBestContent"></div>';
    $('handBestAktive').onclick=function(e){ e.preventDefault(); showHistory=false; showAdminOrders(); };
    $('handBestHistorikk').onclick=function(e){ e.preventDefault(); showHistory=true; showAdminOrders(); };
  }
  async function showAdminOrders(ev){
    if(ev){ ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation(); }
    adminShell();
    var msg=$('handBestMsg'), content=$('handBestContent');
    try{
      var all=await loadOrders();
      var rows=showHistory ? all.filter(function(r){return !isActiveForAdmin(r);}) : all.filter(isActiveForAdmin);
      var gs=groups(rows);
      msg.textContent=showHistory?'Tidligere/godkjente bestillinger.':'Aktive bestillinger som venter på admin.';
      if(!gs.length){ content.innerHTML='<div class="info">Ingen '+(showHistory?'tidligere':'aktive')+' bestillinger.</div>'; return false; }
      content.innerHTML=gs.map(function(lines){ var f=lines[0]||{}; var hist=showHistory; return '<details open class="hand-order" style="border:1px solid #334155;border-radius:12px;margin:12px 0;background:#111827;overflow:hidden"><summary style="cursor:pointer;padding:12px;background:#172033;font-weight:700;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>'+esc(employeeName(f))+'</span><span>'+esc(f.bil_navn||f.bil_id||'Bil')+' | '+esc(s(f.opprettet||f.created_at).slice(0,16).replace('T',' '))+'</span></summary><div style="padding:12px"><div style="display:grid;grid-template-columns:minmax(220px,1fr) 90px '+(hist?'90px 90px':'120px 90px')+';gap:10px;font-weight:700;border-bottom:1px solid #374151;padding-bottom:6px"><div>Vare</div><div style="text-align:right">Bestilt</div><div style="text-align:right">'+(hist?'Godkjent':'Godkjenn')+'</div><div style="text-align:right">Rest</div></div>'+lines.map(function(r){ var b=orderedAmount(r); var g=showHistory?approvedAmount(r):b; var rest=Math.max(0,b-g); return '<div class="hand-order-line" data-id="'+esc(r.id)+'" data-bestilt="'+b+'" style="display:grid;grid-template-columns:minmax(220px,1fr) 90px '+(hist?'90px 90px':'120px 90px')+';gap:10px;align-items:center;border-bottom:1px solid #273244;padding:8px 0"><div>'+esc(lineName(r))+'</div><div style="text-align:right">'+b+'</div>'+(hist?'<div style="text-align:right;color:#86efac">'+approvedAmount(r)+'</div><div style="text-align:right;color:#fca5a5">'+restAmount(r)+'</div>':'<input class="hand-order-approved" type="number" min="0" max="'+b+'" value="'+g+'" style="padding:8px;border-radius:8px"><div class="hand-order-rest" style="text-align:right;font-weight:700">Rest: '+rest+'</div>')+'</div>'; }).join('')+(hist?'':'<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px"><button type="button" class="hand-order-approve-all" style="background:#16a34a;color:white;border:0;border-radius:10px;padding:10px 14px">Godkjenn alt</button><button type="button" class="hand-order-approve-rest" style="background:#2563eb;color:white;border:0;border-radius:10px;padding:10px 14px">Godkjenn med rest</button></div>')+'</div></details>'; }).join('');
      bindAdmin(content); return false;
    }catch(e){ msg.textContent='Kunne ikke hente bestillinger: '+(e.message||e); content.innerHTML='<div class="info">Sjekk tabellen hand_bil_bestilling i Supabase.</div>'; return false; }
  }
  function bindAdmin(root){
    root.querySelectorAll('.hand-order-approved').forEach(function(inp){ inp.addEventListener('input',function(){ var line=inp.closest('.hand-order-line'); var b=intNum(line.dataset.bestilt); var g=Math.max(0,Math.min(b,intNum(inp.value))); inp.value=g; var rest=line.querySelector('.hand-order-rest'); if(rest){ rest.textContent='Rest: '+Math.max(0,b-g); rest.style.color=(b-g)?'#fca5a5':'#86efac'; } }); });
    root.querySelectorAll('.hand-order-approve-all,.hand-order-approve-rest').forEach(function(btn){ btn.addEventListener('click',approveAdmin,true); });
  }
  async function approveAdmin(ev){
    ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    if(busyAdmin) return false; busyAdmin=true; var btn=ev.currentTarget||ev.target; var order=btn.closest('.hand-order'); var msg=$('handBestMsg');
    try{
      if(btn.classList.contains('hand-order-approve-all')) order.querySelectorAll('.hand-order-line').forEach(function(line){ var inp=line.querySelector('.hand-order-approved'); if(inp) inp.value=intNum(line.dataset.bestilt); inp&&inp.dispatchEvent(new Event('input')); });
      var lines=Array.from(order.querySelectorAll('.hand-order-line')); var t=now(), admin=currentEmail();
      for(var i=0;i<lines.length;i++){
        var line=lines[i], id=line.dataset.id, b=intNum(line.dataset.bestilt), inp=line.querySelector('.hand-order-approved'), god=Math.max(0,Math.min(b,intNum(inp&&inp.value))), rest=Math.max(0,b-god);
        var res=await updateSafe('hand_bil_bestilling', id, {godkjent:god,levert:god,mottatt:0,rest:rest,status: rest>0?'rest_hos_admin':'admin_bekreftet',admin_svar_sendt:true,admin_godkjent:true,bekreftet:true,bekreftet_at:t,bekreftet_dato:t,godkjent_dato:t,bekreftet_av:admin,admin_bekreftet_av:admin,ansatt_melding:'Admin har godkjent '+god+' av '+b+'. Rest: '+rest});
        if(res.error) throw new Error(res.error.message||res.error);
      }
      if(msg) msg.textContent='Bestillingen er godkjent og sendt til ansatt.'; await showAdminOrders(); return false;
    }catch(e){ if(msg) msg.textContent='Kunne ikke godkjenne: '+(e.message||e); return false; }
    finally{ busyAdmin=false; }
  }

  function userMatch(r){
    var ep=low(currentEmail()), navn=low(currentName()), bil=valgtBilId();
    var fields=[r.bruker_epost,r.opprettet_av,r.ansatt_epost,r.email,r.epost,r.bruker_navn,r.ansatt_navn,r.navn].map(low).filter(Boolean);
    if(ep && fields.some(function(x){return x===ep || x.indexOf(ep)>=0 || ep.indexOf(x)>=0;})) return true;
    if(navn && fields.some(function(x){return x===navn || x.indexOf(navn)>=0 || navn.indexOf(x)>=0;})) return true;
    if(bil && s(r.bil_id)===s(bil)) return true;
    return false;
  }
  function userHost(){ var old=$('handUserApprovedOrders'); if(old) old.remove(); var candidates=['bilLagerFyllListe','bilLagerInnhold','bilerSide','appSide']; for(var i=0;i<candidates.length;i++){ if($(candidates[i])) return $(candidates[i]); } return document.body; }
  async function showUserApproved(){
    var host=userHost(); if(!host) return;
    try{
      var all=await loadOrders(); var rows=all.filter(isAdminAnswered).filter(function(r){return !isOnCar(r) && approvedAmount(r)>0 && userMatch(r);}); rows=await hydrate(rows); var gs=groups(rows).slice(0,20);
      if(!gs.length) return;
      var box=document.createElement('div'); box.id='handUserApprovedOrders'; box.style.cssText='margin:14px 0;padding:14px;border:1px solid #14532d;border-radius:12px;background:#052e16;color:#dcfce7';
      box.innerHTML='<h3 style="margin:0 0 10px 0;color:#bbf7d0">Godkjent bestilling fra admin</h3>'+gs.map(function(lines){ var f=lines[0]||{}, ids=lines.map(function(r){return s(r.id);}).join(','); return '<details open style="margin:8px 0;padding:10px;border:1px solid #166534;border-radius:10px;background:#064e3b"><summary style="cursor:pointer;font-weight:700">'+esc(f.bil_navn||f.bil_id||'Bil')+'</summary><div style="margin-top:8px;display:grid;gap:6px">'+lines.map(function(r){return '<div>'+esc(lineName(r))+' - godkjent '+approvedAmount(r)+', rest '+restAmount(r)+'</div>';}).join('')+'</div><button type="button" class="hand-user-confirm-order" data-ids="'+esc(ids)+'" style="margin-top:10px;background:#16a34a;color:white;border:0;border-radius:8px;padding:10px 14px;font-weight:700">Bekreft mottatt og legg på bil</button></details>'; }).join('');
      if(host.id==='appSide'||host===document.body) host.prepend(box); else host.parentNode ? host.parentNode.insertBefore(box,host) : host.prepend(box);
      box.querySelectorAll('.hand-user-confirm-order').forEach(function(b){ b.addEventListener('click',userConfirm,true); });
    }catch(e){ console.warn('Kunne ikke vise godkjente bestillinger:',e); }
  }
  async function addToCar(row, antall){
    var c=db(), fid=row.firma_id||await firmaId();
    var existing=await c.from('hand_bil_lager').select('*').eq('bil_id',row.bil_id).eq('vare_id',row.vare_id).limit(1);
    if(existing.error) throw existing.error;
    if(existing.data&&existing.data.length){ var ny=intNum(existing.data[0].antall)+antall; var up=await updateSafe('hand_bil_lager',existing.data[0].id,{antall:ny,minimum_antall:intNum(row.minimum_antall||existing.data[0].minimum_antall||0)}); if(up.error) throw new Error(up.error.message||up.error); }
    else { var ins=await insertSafe('hand_bil_lager',{firma_id:fid,bil_id:row.bil_id,vare_id:row.vare_id,antall:antall,minimum_antall:intNum(row.minimum_antall||0)}); if(ins.error) throw new Error(ins.error.message||ins.error); }
    var log={firma_id:fid,bil_id:row.bil_id,bil_navn:row.bil_navn||valgtBilNavn()||null,vare_id:row.vare_id,varenr:row.varenr||null,varenavn:row.varenavn||null,antall:antall,type:'bestilling',handling:'ansatt_bekreftet_lagt_pa_bil',hentet_av:currentName()||currentEmail(),bruker_epost:currentEmail(),ansatt_id:currentAnsattId()||null,bestilling_id:row.id,kommentar:'Bruker bekreftet admin-godkjent bestilling og la varen på bil',opprettet:now(),created_at:now()};
    var bevegelse=await insertSafe('hand_lager_bevegelse',log); if(bevegelse.error) await insertSafe('hand_lagerlogg',log);
  }
  async function userConfirm(ev){
    ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    if(busyUser) return false; busyUser=true; var btn=ev.currentTarget||ev.target; btn.disabled=true; btn.textContent='Legger på bil...';
    try{
      var ids=s(btn.getAttribute('data-ids')).split(',').filter(Boolean); var all=await loadOrders(); var rows=all.filter(function(r){return ids.indexOf(s(r.id))>=0;}).filter(function(r){return isAdminAnswered(r)&&!isOnCar(r)&&approvedAmount(r)>0;});
      if(!rows.length){ alert('Ingen nye godkjente varer å legge på bil.'); showUserApproved(); return false; }
      rows=await hydrate(rows); var t=now();
      for(var i=0;i<rows.length;i++){ var r=rows[i], ant=approvedAmount(r); await addToCar(r,ant); var up=await updateSafe('hand_bil_bestilling',r.id,{status:'lagt_pa_bil',ansatt_godkjent:true,lagt_pa_bil:true,lagt_pa_bil_at:t,lagt_pa_bil_av:currentName()||currentEmail(),mottatt:ant,levert:ant}); if(up.error) throw new Error(up.error.message||up.error); }
      alert('Godkjente varer er lagt på bil, og lagerlogg er oppdatert.'); try{ if(typeof window.lastBilLager==='function') await window.lastBilLager(); }catch(_){} showUserApproved(); return false;
    }catch(e){ alert('Kunne ikke legge på bil: '+(e.message||e)); btn.disabled=false; btn.textContent='Bekreft mottatt og legg på bil'; return false; }
    finally{ busyUser=false; }
  }

  function patchButtons(){
    document.querySelectorAll('button,a,input[type="button"],input[type="submit"],[role="button"],[data-modul],[data-side],[data-target]').forEach(function(b){
      if(sendButton(b)){ if(b.tagName==='A') b.removeAttribute('href'); if(b.tagName==='BUTTON') b.type='button'; b.onclick=sendOrder; b.dataset.handFinalSend='1'; if(b.tagName!=='INPUT') b.textContent='Send bestilling til admin'; }
      if(adminButton(b)){ b.dataset.handFinalAdmin='1'; b.onclick=showAdminOrders; b.addEventListener('click',showAdminOrders,true); }
    });
  }
  window.opprettBilLagerBestillingListe=sendOrder;
  window.sendBilLagerBestilling=sendOrder;
  window.lagPdfFyllBilTilLager=sendOrder;
  window.handLagPdfFyllBilTilLager=sendOrder;
  window.visBilBestillingerSide=showAdminOrders;
  window.renderAdminBilBestillinger=showAdminOrders;
  window.handLastAdminBilBestillinger=showAdminOrders;
  window.handLastBilBestillinger=showAdminOrders;
  window.handVisGodkjenteBestillingerForBruker=showUserApproved;
  window.addEventListener('click',function(e){ if(sendButton(e.target)) return sendOrder(e); if(adminButton(e.target)) return showAdminOrders(e); },true);
  document.addEventListener('DOMContentLoaded',function(){ patchButtons(); setTimeout(patchButtons,300); setTimeout(showUserApproved,1800); });
  document.addEventListener('handPartialerLastet',function(){ setTimeout(patchButtons,100); setTimeout(showUserApproved,1200); });
})();
