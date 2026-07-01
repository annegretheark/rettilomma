/* RIL 20260623 ABSOLUTT SISTE FIX
   - Blokkerer den gamle about:blank / Fyll bil - lagerliste popupen.
   - Brukerknappen sender digital bestilling til hand_bil_bestilling.
   - Admin Bestillinger viser alltid innhold eller teksten Ingen bestillinger.
*/
(function(){
  'use strict';
  if (window.__rilAbsoluttSisteBestillingFix) return;
  window.__rilAbsoluttSisteBestillingFix = true;

  function $(id){ return document.getElementById(id); }
  function txt(v){ return String(v == null ? '' : v); }
  function low(v){ return txt(v).toLowerCase(); }
  function num(v){ var n=Number(txt(v).replace(',', '.')); return Number.isFinite(n)?n:0; }
  function esc(v){ return txt(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function db(){ return window.supabaseClient || null; }
  function show(el){ if(!el) return; el.hidden=false; el.style.display=''; el.style.visibility='visible'; el.classList.remove('skjult','hidden','modul-skjult'); el.removeAttribute('aria-hidden'); }
  function hide(el){ if(!el) return; el.hidden=true; el.style.display='none'; el.style.visibility='hidden'; el.classList.add('skjult','hidden'); }
  function isAdmin(){
    var s=[window.erAdmin,window.handErAdmin,window.adminmodus,window.innloggetRolle,window.handInnloggetRolle,localStorage.getItem('rolle'),localStorage.getItem('handRolle'),localStorage.getItem('innloggetRolle'),document.body&&document.body.innerText].map(low).join(' ');
    return /admin|sysadmin/.test(s);
  }
  function melding(t,bad){ var e=$('bilLagerMelding')||$('bilMelding')||$('lagerMelding'); if(e){ e.textContent=t; e.style.color=bad?'#fca5a5':'#86efac'; } else if(bad){ alert(t); } }

  // Ikke la gammel kode åpne about:blank-lagerliste i det hele tatt.
  var realOpen = window.open;
  window.open = function(url, name, specs){
    var u = txt(url);
    if (!u || u === 'about:blank' || u.indexOf('about:blank') >= 0) {
      console.warn('Blokkert gammel lagerliste/PDF-popup. Bestilling sendes digitalt i stedet.');
      return { document:{ open:function(){}, write:function(){}, close:function(){} }, focus:function(){}, print:function(){}, close:function(){} };
    }
    return realOpen ? realOpen.apply(window, arguments) : null;
  };

  async function firmaId(){ try{ if(typeof window.hentAktivFirmaId==='function') return await window.hentAktivFirmaId(); }catch(e){} return window.aktivFirmaId || (window.firmaData&&window.firmaData.id) || null; }
  function bilId(){ try{ if(typeof window.hentValgtBilIdForBilLager==='function') return window.hentValgtBilIdForBilLager()||''; }catch(e){} var s=$('bilLagerBilValg'); return s?s.value:''; }
  function bilNavn(){ var s=$('bilLagerBilValg'); return s&&s.selectedIndex>=0?txt(s.options[s.selectedIndex].textContent):''; }
  function rowsFromScreen(){
    return Array.from(document.querySelectorAll('.bil-lager-antall-liste')).map(function(i){
      var id=i.dataset.vareId||i.getAttribute('data-vare-id')||'';
      var min=document.querySelector('.bil-lager-min-liste[data-vare-id="'+(window.CSS&&CSS.escape?CSS.escape(id):id)+'"]');
      return { vare_id:id, antall:num(i.value), minimum_antall:num(min&&min.value) };
    }).filter(function(r){ return r.vare_id && r.antall>0; });
  }
  async function varer(ids){ var m=new Map(), c=db(); if(!c) return m; ids=Array.from(new Set(ids.filter(Boolean).map(String))); if(!ids.length) return m; try{ var r=await c.from('hand_vare').select('*').in('id',ids); if(!r.error)(r.data||[]).forEach(function(v){m.set(String(v.id),v);}); }catch(e){} return m; }
  async function insertSafe(payload){
    var c=db(), data=payload.map(function(x){return Object.assign({},x);});
    for(var i=0;i<40;i++){
      var res=await c.from('hand_bil_bestilling').insert(data).select('*');
      if(!res.error) return res;
      var msg=txt(res.error.message); var col=(msg.match(/Could not find the '([^']+)' column/i)||[])[1]||(msg.match(/column "([^"]+)".*does not exist/i)||[])[1];
      if(col){ data.forEach(function(r){ delete r[col]; }); continue; }
      return res;
    }
    return {error:{message:'Kunne ikke lagre bestilling'}};
  }
  async function sendDigital(){
    var c=db(); if(!c){ melding('Supabase er ikke lastet.', true); return false; }
    var bid=bilId(); if(!bid){ melding('Velg bil først.', true); return false; }
    var lines=rowsFromScreen(); if(!lines.length){ melding('Skriv antall på minst én vare før du sender bestilling til admin.', true); return false; }
    melding('Sender bestilling til admin...');
    var vm=await varer(lines.map(function(r){return r.vare_id;}));
    var tid=new Date().toISOString(); var batch=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():('bestilling-'+Date.now()); var fid=await firmaId();
    var epost=window.innloggetEpost||window.handInnloggetEpost||localStorage.getItem('innloggetEpost')||localStorage.getItem('handInnloggetEpost')||localStorage.getItem('epost')||null;
    var payload=lines.map(function(r){ var v=vm.get(String(r.vare_id))||{}; return {
      bestilling_id:batch, firma_id:fid||null, bil_id:bid, bil_navn:bilNavn(), vare_id:r.vare_id,
      varenr:v.varenr||null, varenavn:v.navn||v.varenavn||v.beskrivelse||null,
      bruker_epost:epost, opprettet_av:epost, bestilt:r.antall, antall:r.antall, levert:0, mottatt:0, rest:r.antall, minimum_antall:r.minimum_antall||0,
      status:'venter', opprettet:tid, created_at:tid
    }; });
    var res=await insertSafe(payload);
    if(res.error){ melding('Kunne ikke sende bestilling til admin: '+(res.error.message||res.error), true); return false; }
    document.querySelectorAll('.bil-lager-antall-liste,.bil-lager-min-liste').forEach(function(i){ i.value=''; });
    melding('Bestilling sendt til admin.');
    return false;
  }

  window.lagPdfFyllBilTilLager = sendDigital;
  window.handLagPdfFyllBilTilLager = sendDigital;
  window.sendBilLagerBestilling = sendDigital;
  window.opprettBilLagerBestillingListe = sendDigital;

  function side(){ var app=$('appSide')||document.querySelector('main')||document.body; var s=$('bilBestillingerSide')||$('adminBilBestillinger')||$('adminBilBestillingerPanel'); if(!s){ s=document.createElement('section'); s.id='bilBestillingerSide'; s.className='kort'; app.appendChild(s); } return s; }
  function shell(){
    var app=$('appSide'); if(app) show(app);
    ['timerSide','jobberSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','kundeSide','kunderSide','ansattSide','ansatteSide','firmaSide','testSide','lonnPanel','fravaerSide','modulerSide','sysadminPanelSide'].forEach(function(id){ hide($(id)); });
    var s=side(); show(s); var h=$('handSideOverskrift'); if(h) h.textContent='Bestillinger';
    s.innerHTML='<h2 style="text-align:center;margin-top:0;color:#f8fafc">Bestillinger fra ansatte</h2><div id="rilOrdersMsg" style="padding:14px;border:1px solid #334155;border-radius:12px;background:#0f172a;color:#e5e7eb;font-weight:700">Ingen bestillinger</div><div id="rilOrdersContent"></div>';
    return s;
  }
  function done(st){ return /^(admin_besvart|godkjent|besvart|levert|ferdig|mottatt|avsluttet|utlevert|fullfort|fullført|arkivert)$/.test(low(st)); }
  function group(rows){ var m=new Map(); rows.forEach(function(r){ var k=[r.bestilling_id||'',r.bil_id||r.bil_navn||'',r.bruker_epost||r.opprettet_av||'',txt(r.opprettet||r.created_at).slice(0,19)].join('|'); if(!m.has(k))m.set(k,[]); m.get(k).push(r); }); return Array.from(m.values()); }
  async function load(){ var c=db(); if(!c) throw new Error('Supabase er ikke lastet.'); var r=await c.from('hand_bil_bestilling').select('*').order('opprettet',{ascending:false}).limit(800); if(r.error) throw r.error; return r.data||[]; }
  function render(rows){ var m=$('rilOrdersMsg'), c=$('rilOrdersContent'); if(!c) return; var g=group((rows||[]).filter(function(r){ return !done(r.status); })); if(!g.length){ if(m)m.textContent='Ingen bestillinger'; c.innerHTML=''; return; } if(m)m.textContent='Nye bestillinger fra ansatte'; c.innerHTML=g.map(function(lines){ var f=lines[0]||{}; return '<details open style="border:1px solid #334155;border-radius:12px;margin:12px 0;background:#111827;overflow:hidden;color:#e5e7eb"><summary style="cursor:pointer;padding:12px;background:#172033;font-weight:700;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>'+esc(f.bruker_navn||f.bruker_epost||f.opprettet_av||'Ansatt')+'</span><span>'+esc(f.bil_navn||f.bil_id||'Bil')+'</span></summary><div style="padding:12px;display:grid;gap:8px">'+lines.map(function(r){ return '<div style="display:grid;grid-template-columns:minmax(220px,1fr) 90px 90px;gap:10px;border-bottom:1px solid #273244;padding:8px 0"><strong>'+esc((r.varenr?r.varenr+' - ':'')+(r.varenavn||r.vare_navn||r.vare_id||'Vare'))+'</strong><span>Bestilt: '+num(r.bestilt||r.antall||r.rest)+'</span><span>Rest: '+num(r.rest)+'</span></div>'; }).join('')+'</div></details>'; }).join(''); }
  async function showOrders(e){ if(e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation(); } shell(); try{ render(await load()); }catch(err){ var m=$('rilOrdersMsg'); if(m)m.textContent='Ingen bestillinger'; var c=$('rilOrdersContent'); if(c)c.innerHTML=''; } return false; }
  window.visBilBestillingerSide=showOrders; window.renderAdminBilBestillinger=showOrders; window.handLastAdminBilBestillinger=showOrders; window.handLastBilBestillinger=showOrders;

  function bind(){
    Array.from(document.querySelectorAll('button,a')).forEach(function(b){ var id=low(b.id), t=low(b.textContent); var send=id==='lagpdffyllbiltilagerknapp'||id==='sendbillagerbestillingknapp'||t.indexOf('send bestilling til admin')>=0||t.indexOf('lag bestilling til admin')>=0; var adm=t.trim()==='bestillinger'||id==='visbilbestillingerknapp';
      if(send && b.dataset.rilAbsSend!=='1'){
        b.dataset.rilAbsSend='1'; b.textContent='Send bestilling til admin'; b.type='button'; b.removeAttribute('onclick'); b.onclick=function(e){ if(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();} return sendDigital(); };
        ['pointerdown','mousedown','touchstart'].forEach(function(ev){ b.addEventListener(ev,function(e){ if(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();} sendDigital(); return false; }, true); });
      }
      if(adm && b.dataset.rilAbsAdmin!=='1'){
        b.dataset.rilAbsAdmin='1'; b.textContent='Bestillinger'; b.type='button'; b.onclick=showOrders;
        ['pointerdown','mousedown','touchstart'].forEach(function(ev){ b.addEventListener(ev,function(e){ return showOrders(e); }, true); });
      }
    });
  }
  document.addEventListener('click',function(e){ var el=e.target&&e.target.closest&&e.target.closest('button,a,[data-modul],[data-side],[data-target]'); if(!el)return; var id=low(el.id), t=low(el.textContent), d=low(el.getAttribute('data-modul')||el.getAttribute('data-side')||el.getAttribute('data-target')||''); if(id==='lagpdffyllbiltilagerknapp'||id==='sendbillagerbestillingknapp'||t.indexOf('send bestilling til admin')>=0||t.indexOf('lag bestilling til admin')>=0){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation(); sendDigital(); return false; } if(t.trim()==='bestillinger'||id==='visbilbestillingerknapp'||d.indexOf('bestilling')>=0){ return showOrders(e); } }, true);
  function tick(){ bind(); }
  document.addEventListener('DOMContentLoaded',function(){ tick(); setTimeout(tick,100); setTimeout(tick,500); setTimeout(tick,1500); });
  window.addEventListener('load',function(){ tick(); setTimeout(tick,300); setInterval(tick,1000); });
})();
