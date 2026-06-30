/* RIL FINAL 20260623: Admin skal KUN ha Bestillinger for bilbestillinger. Ingen PDF/print. */
(function(){
  'use strict';
  if (window.__RIL_ADMIN_BESTILLINGER_NO_PDF_FINAL__) return;
  window.__RIL_ADMIN_BESTILLINGER_NO_PDF_FINAL__ = true;

  function $(id){ return document.getElementById(id); }
  function txt(v){ return String(v == null ? '' : v); }
  function low(v){ return txt(v).toLowerCase(); }
  function n(v){ var x = Number(txt(v).replace(',', '.')); return Number.isFinite(x) ? x : 0; }
  function esc(v){ return txt(v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function db(){ return window.supabaseClient || null; }
  function isAdmin(){
    var text = [
      window.erAdmin, window.handErAdmin, window.adminmodus, window.innloggetRolle, window.handInnloggetRolle,
      localStorage.getItem('rilAdminModus'), localStorage.getItem('handAdminModus'), localStorage.getItem('rolle'), localStorage.getItem('handRolle'),
      localStorage.getItem('innloggetRolle'), localStorage.getItem('handInnloggetRolle'), localStorage.getItem('innloggetEpost'), localStorage.getItem('handInnloggetEpost'), localStorage.getItem('epost'),
      document.body ? document.body.innerText : ''
    ].map(low).join(' ');
    return text.indexOf('adminmodus') >= 0 || text.indexOf('admin') >= 0 || text.indexOf('sysadmin') >= 0 || text.indexOf('sysadm') >= 0 || text.indexOf(null) >= 0 || text.indexOf('true') >= 0 || text.indexOf('ja') >= 0;
  }
  function restStatus(st){ return /^(rest_hos_admin|restordre_admin|restordre|delvis_admin)$/.test(low(st)); }
  function doneStatus(st){ return /^(admin_besvart|godkjent|besvart|levert|ferdig|mottatt|avsluttet|utlevert|fullfort|fullført|delvis_mottatt|arkivert)$/.test(low(st)); }
  function doneForAdmin(r){ return doneStatus(r && r.status) && n(r && r.rest) <= 0; }
  function activeForAdmin(r){ return !doneForAdmin(r); }
  function hide(el){ if(!el) return; el.hidden = true; el.style.display = 'none'; el.classList.add('skjult','hidden'); el.setAttribute('aria-hidden','true'); }
  function show(el){ if(!el) return; el.hidden = false; el.style.display = ''; el.style.visibility = 'visible'; el.classList.remove('skjult','hidden','modul-skjult'); el.removeAttribute('aria-hidden'); }
  function sideIds(){ return ['timerSide','jobberSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','kundeSide','kunderSide','ansattSide','firmaSide','testSide','lonnPanel','fravaerSide','modulerSide','sysadminPanelSide','adminBilBestillinger']; }
  function ensureButton(){
    var btn = $('visBilBestillingerKnapp');
    var bil = $('visBilerKnapp');
    var host = bil && bil.parentNode ? bil.parentNode : (document.querySelector('.topplinje') || $('appSide') || document.body);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'visBilBestillingerKnapp';
      btn.type = 'button';
      btn.setAttribute('data-modul','bilbestillinger');
      if (bil && bil.parentNode) bil.parentNode.insertBefore(btn, bil.nextSibling); else host.appendChild(btn);
    }
    btn.textContent = 'Bestillinger';
    btn.title = 'Bestillinger fra ansatte';
    btn.classList.remove('skjult','hidden');
    btn.style.display = 'inline-block';
    btn.onclick = openOrders;
    btn.addEventListener('click', openOrders, true);
    // Biler-knappen skal fortsatt åpne bilsiden. Bestillinger er egen knapp.
    return btn;
  }
  function removeAdminSendStuff(){
    if (!isAdmin()) return;
    ['sendBilLagerBestillingKnapp','lagPdfFyllBilTilLagerKnapp'].forEach(function(id){ hide($(id)); });
    document.querySelectorAll('button,a').forEach(function(el){
      var t = low(el.textContent);
      if (t.indexOf('send bestilling til admin') >= 0 || t.indexOf('pdf') >= 0 && t.indexOf('fyll') >= 0) hide(el);
    });
  }
  function ordersSection(){
    var app = $('appSide') || document.body;
    var s = $('bilBestillingerSide');
    if (!s) {
      s = document.createElement('section');
      s.id = 'bilBestillingerSide';
      s.className = 'kort admin-only';
      app.appendChild(s);
    }
    return s;
  }
  function showOrdersShell(){
    var app = $('appSide'); if (app) show(app);
    sideIds().forEach(function(id){ var el = $(id); if (el) hide(el); });
    removeAdminSendStuff();
    var s = ordersSection(); show(s);
    var h = $('handSideOverskrift'); if (h) h.textContent = 'Bestillinger';
    s.innerHTML = '<h2 style="text-align:center;margin-top:0">Bestillinger fra ansatte</h2>'+
      '<div id="rilAdminOrdersMsg" style="padding:12px;border:1px solid #334155;border-radius:12px;background:#0f172a;margin-bottom:12px">Henter bestillinger fra ansatte...</div>'+
      '<div id="rilAdminOrdersContent"></div>';
    return s;
  }
  async function enrich(rows){
    rows = rows || [];
    var c = db();
    if (!c || !rows.length) return rows;
    try {
      var vareIds = Array.from(new Set(rows.map(function(r){ return r.vare_id; }).filter(Boolean).map(String)));
      if (vareIds.length) {
        var vr = await c.from('hand_vare').select('*').in('id', vareIds);
        if (!vr.error) {
          var vm = new Map((vr.data || []).map(function(v){ return [String(v.id), v]; }));
          rows.forEach(function(r){ r.__vare = vm.get(String(r.vare_id)); });
        }
      }
    } catch(e) {}
    try {
      var bilIds = Array.from(new Set(rows.map(function(r){ return r.bil_id; }).filter(Boolean).map(String)));
      if (bilIds.length) {
        var br = await c.from('hand_bil').select('*').in('id', bilIds);
        if (!br.error) {
          var bm = new Map((br.data || []).map(function(b){ return [String(b.id), b]; }));
          rows.forEach(function(r){ r.__bil = bm.get(String(r.bil_id)); });
        }
      }
    } catch(e) {}
    return rows;
  }
  async function loadRows(){
    var c = db();
    if (!c) throw new Error('Supabase er ikke lastet.');
    var q = c.from('hand_bil_bestilling').select('*').order('opprettet', { ascending: false }).limit(800);
    var res = await q;
    if (res.error) throw res.error;
    return enrich(res.data || []);
  }
  function key(r){ return [r.bestilling_id || r.liste_id || '', r.bil_id || r.bil_navn || '', r.ansatt_id || r.bruker_id || r.bruker_epost || r.opprettet_av || '', txt(r.opprettet || r.created_at).slice(0,19)].join('|'); }
  function groups(rows){ var m = new Map(); (rows||[]).forEach(function(r){ var k=key(r); if(!m.has(k)) m.set(k,[]); m.get(k).push(r); }); return Array.from(m.values()); }
  function ansatt(r){ return r.bruker_navn || r.ansatt_navn || r.hentet_av || r.bruker_epost || r.opprettet_av || r.user_email || 'Ansatt'; }
  function bil(r){ var b=r.__bil||{}; return r.bil_navn || r.bilnavn || b.navn || b.bilnavn || b.regnr || b.registreringsnummer || r.bil_id || 'Bil'; }
  function vare(r){ var v=r.__vare||{}; var nr=r.varenr || v.varenr || ''; var navn=r.varenavn || r.vare_navn || v.navn || v.varenavn || v.beskrivelse || r.vare_id || 'Vare'; return nr && navn.indexOf(nr)<0 ? nr+' - '+navn : navn; }
  function renderRows(rows){
    var content = $('rilAdminOrdersContent');
    var msg = $('rilAdminOrdersMsg');
    if (!content) return;
    var active = groups((rows||[]).filter(activeForAdmin));
    // Lukkede/godkjente bestillinger skal ikke vises i adminlisten.
    var done = [];
    if (msg) msg.textContent = 'Admin mottar bestillinger fra ansatte her. Godkjenn én gang og send bekreftelse/rest tilbake til ansatt. Ingen PDF lages.';
    var html = '';
    if (!active.length) html += '<div class="info" style="padding:12px;border:1px solid #334155;border-radius:10px;margin-bottom:12px">Ingen bestillinger</div>';
    active.forEach(function(lines){
      var f = lines[0] || {};
      html += '<details open class="ril-order" style="border:1px solid #334155;border-radius:12px;margin:12px 0;background:#111827;overflow:hidden">'+
        '<summary style="cursor:pointer;padding:12px;background:#172033;font-weight:700;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>'+esc(ansatt(f))+'</span><span>'+esc(bil(f))+' | '+esc(txt(f.opprettet||f.created_at).slice(0,16).replace('T',' '))+'</span></summary><div style="padding:12px">';
      lines.forEach(function(r){
        var erRest = restStatus(r.status) || (doneStatus(r.status) && n(r.rest) > 0);
        var best = erRest ? Math.max(0, n(r.rest)) : Math.max(0, n(r.bestilt || r.antall || r.rest));
        html += '<div class="ril-line" data-id="'+esc(r.id)+'" data-old-levert="'+n(r.levert)+'" data-bil="'+esc(r.bil_id||'')+'" data-vare="'+esc(r.vare_id||'')+'" data-max="'+best+'" style="display:grid;grid-template-columns:minmax(220px,1fr) 80px 120px 90px;gap:10px;align-items:center;border-bottom:1px solid #273244;padding:8px 0">'+
          '<div style="font-weight:700;overflow-wrap:anywhere">'+esc(vare(r))+'</div><div style="text-align:right">'+best+'</div><input class="ril-approved" type="number" min="0" max="'+best+'" value="'+best+'" style="padding:8px;border-radius:8px"><div class="ril-rest" style="text-align:right;font-weight:700"></div></div>';
      });
      html += '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;align-items:center"><span class="ril-sum"></span><button class="ril-approve" type="button" style="background:#2563eb;color:white;border:0;border-radius:10px;padding:10px 14px">Godkjenn og send rest/bekreftelse</button></div></div></details>';
    });
    // Ikke vis lukkede/godkjente lister her. De skal være borte etter godkjenning/fylling.
    html += '';
    content.innerHTML = html;
    bindOrderActions(content);
  }
  function recalc(order){
    var total=0;
    order.querySelectorAll('.ril-line').forEach(function(line){ var max=n(line.dataset.max); var inp=line.querySelector('.ril-approved'); var god=Math.max(0, Math.min(max, n(inp && inp.value))); if(inp) inp.value=god; var rest=Math.max(0,max-god); total+=rest; var r=line.querySelector('.ril-rest'); if(r){ r.textContent='Rest: '+rest; r.style.color=rest?'#fca5a5':'#86efac'; } });
    var s=order.querySelector('.ril-sum'); if(s) s.textContent = total ? 'Rest: '+total : 'Alt godkjent';
  }
  async function updateLine(id, payload){
    var c=db(); if(!c) throw new Error('Supabase er ikke lastet.');
    var chk = await c.from('hand_bil_bestilling').select('id,status').eq('id', id).maybeSingle();
    if (chk.error) throw chk.error;
    if (!chk.data) throw new Error('Fant ikke bestillingslinjen.');
    if (doneForAdmin(chk.data)) throw new Error('Listen er allerede godkjent og låst.');
    var res = await c.from('hand_bil_bestilling').update(payload).eq('id', id);
    if (res.error) throw res.error;
  }
  function bindOrderActions(root){
    root.querySelectorAll('.ril-order').forEach(function(o){ o.querySelectorAll('.ril-approved').forEach(function(i){ i.addEventListener('input', function(){ recalc(o); }); }); recalc(o); });
    root.querySelectorAll('.ril-approve').forEach(function(btn){ btn.addEventListener('click', async function(e){
      e.preventDefault(); e.stopPropagation();
      if(btn.dataset.busy==='1') return;
      btn.dataset.busy='1'; btn.disabled=true;
      var msg=$('rilAdminOrdersMsg'); if(msg) msg.textContent='Sender bekreftelse/rest til ansatt...';
      try{
        var order=btn.closest('.ril-order');
        var lines=Array.from(order.querySelectorAll('.ril-line'));
        for(var i=0;i<lines.length;i++){
          var line=lines[i]; var max=n(line.dataset.max); var oldLevert=n(line.dataset.oldLevert); var inp=line.querySelector('.ril-approved'); var god=Math.max(0,Math.min(max,n(inp&&inp.value))); var rest=Math.max(0,max-god); var nyLevert=oldLevert+god;
          await updateLine(line.dataset.id, { levert: nyLevert, rest: rest, status: rest > 0 ? 'rest_hos_admin' : 'admin_besvart', admin_svar_sendt: true, admin_svar_tid: new Date().toISOString(), godkjent_dato: new Date().toISOString(), admin_godkjent: true });
        }
        if(msg) msg.textContent='Bekreftelse/rest sendt til ansatt. Listen er låst og flyttet til Godkjente/besvarte lister.';
        await refreshOrders();
      }catch(err){ btn.dataset.busy='0'; btn.disabled=false; if(msg) msg.textContent='Kunne ikke godkjenne: '+(err.message||err); }
    }); });
  }
  async function refreshOrders(){
    showOrdersShell();
    try { renderRows(await loadRows()); }
    catch(e){ var msg=$('rilAdminOrdersMsg'); if(msg) msg.textContent='Kunne ikke hente bestillinger: '+(e.message||e); var c=$('rilAdminOrdersContent'); if(c) c.innerHTML='<div class="info">Sjekk Supabase/tabellen hand_bil_bestilling.</div>'; }
  }
  function openOrders(e){
    if(e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); }
    ensureButton(); removeAdminSendStuff(); refreshOrders(); return false;
  }

  // Ingen PDF/print for Fyll bil-bestillinger.
  window.lagPdfFyllBilTilLager = function(){ return false; };
  window.handLagPdfFyllBilTilLager = function(){ return false; };
  window.visBilBestillingerSide = openOrders;
  window.renderAdminBilBestillinger = refreshOrders;
  window.handLastAdminBilBestillinger = refreshOrders;
  window.handLastBilBestillinger = refreshOrders;

  document.addEventListener('click', function(e){
    var el = e.target && e.target.closest && e.target.closest('button,a,[data-modul],[data-side],[data-target]');
    if(!el) return;
    var id=low(el.id), text=low(el.textContent), data=low(el.getAttribute('data-modul')||el.getAttribute('data-side')||el.getAttribute('data-target')||'');
    // Viktig: Biler / bil-lager skal ikke behandles som Bestillinger.
    if (id === 'visbilerknapp' || data === 'biler' || data === 'bil' || text.indexOf('biler') >= 0 || text.indexOf('bil-lager') >= 0 || text.indexOf('min bil') >= 0 || text.indexOf('fyll lager') >= 0) return;
    if (id==='lagpdffyllbiltil lagerknapp' || id==='lagpdffyllbiltilLagerKnapp'.toLowerCase() || id==='lagpdffyllbiltilagerknapp' || text.indexOf('pdf')>=0 && text.indexOf('fyll')>=0) { e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation(); return false; }
    if (isAdmin() && (id==='visbilbestillingerknapp' || text==='bestillinger' || data.indexOf('bilbestilling')>=0 || data.indexOf('bestilling')>=0)) return openOrders(e);
    if (isAdmin() && (id==='sendbillagerbestillingknapp' || text.indexOf('send bestilling til admin')>=0)) return openOrders(e);
  }, true);
  function tick(){
    if(!isAdmin()) return;
    // Bare sørg for at Bestillinger-knappen finnes. Ikke overstyr Biler-siden.
    ensureButton();
    removeAdminSendStuff();
  }
  document.addEventListener('handPartialerLastet', function(){ setTimeout(tick,0); setTimeout(tick,300); });
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(tick,0); setTimeout(tick,300); setTimeout(tick,1000); });
  window.addEventListener('load', function(){ setTimeout(tick,0); setTimeout(tick,300); setTimeout(tick,1000); setInterval(tick,1000); });
})();

/* RIL 20260626: Synlig trygg knapp for vanlig bruker: Send til administrator.
   Viktig: Bruker eget id/tekst så admin-scriptet ikke skjuler knappen.
   Endrer ikke hand-biler.js og skal ikke kunne stoppe siden ved lasting. */
(function () {
  'use strict';
  if (window.__RIL_SEND_TIL_ADMINISTRATOR_TRYGG_FIX__) return;
  window.__RIL_SEND_TIL_ADMINISTRATOR_TRYGG_FIX__ = true;

  function el(id) { return document.getElementById(id); }

  function visMelding(tekst, erFeil) {
    var m = el('bilMelding') || el('lagerbestillingMelding');
    if (m) {
      m.textContent = tekst || '';
      m.style.color = erFeil ? '#fecaca' : '';
    } else if (erFeil) {
      alert(tekst);
    }
  }

  function harAntallTilBestilling() {
    var inputs = document.querySelectorAll('#bilLagerFyllListe input.bil-lager-antall-liste, #bilLagerFyllListe input[data-vare-id]');
    for (var i = 0; i < inputs.length; i++) {
      var n = Number(String(inputs[i].value || '0').replace(',', '.'));
      if (Number.isFinite(n) && n > 0) return true;
    }
    return false;
  }

  async function sendTilAdministrator(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (typeof window.opprettBilLagerBestillingListe !== 'function') {
      visMelding('Bestillingsfunksjonen er ikke ferdig lastet. Trykk Ctrl+F5 og prøv igjen.', true);
      return false;
    }

    if (!harAntallTilBestilling()) {
      visMelding('Skriv antall på minst én vare før du sender bestilling til administrator.', true);
      return false;
    }

    var knapp = el('rilSendTilAdministratorKnapp');
    try {
      if (knapp) knapp.disabled = true;
      visMelding('Sender bestilling til administrator...');
      await window.opprettBilLagerBestillingListe();
      visMelding('Bestilling sendt til administrator.');
    } catch (e) {
      console.error('Send til administrator feilet:', e);
      visMelding('Kunne ikke sende bestilling til administrator: ' + (e && e.message ? e.message : e), true);
    } finally {
      if (knapp) knapp.disabled = false;
    }
    return false;
  }

  function lagKnapp() {
    var liste = el('bilLagerFyllListe');
    if (!liste || !liste.parentNode) return;

    var knapp = el('rilSendTilAdministratorKnapp');
    if (!knapp) {
      knapp = document.createElement('button');
      knapp.id = 'rilSendTilAdministratorKnapp';
      knapp.type = 'button';
      knapp.textContent = 'Send til administrator';
      knapp.title = 'Send lagerbestillingen til administrator';
      knapp.style.margin = '10px 0 12px 0';
      knapp.style.display = 'inline-block';
      knapp.style.background = '#16a34a';
      knapp.style.color = '#fff';
      knapp.style.border = '0';
      knapp.style.borderRadius = '8px';
      knapp.style.padding = '10px 14px';
      knapp.style.fontWeight = '700';
      knapp.style.cursor = 'pointer';
      liste.parentNode.insertBefore(knapp, liste);
    }

    knapp.hidden = false;
    knapp.style.display = 'inline-block';
    knapp.classList.remove('skjult', 'hidden', 'modul-skjult');
    knapp.onclick = sendTilAdministrator;
  }

  function start() {
    lagKnapp();
    setTimeout(lagKnapp, 300);
    setTimeout(lagKnapp, 1000);
    setTimeout(lagKnapp, 2000);
  }

  document.addEventListener('DOMContentLoaded', start);
  document.addEventListener('handPartialerLastet', start);
  window.addEventListener('load', start);

  // Siden tegner om Fyll bil-delen flere ganger. Observer kun body, men throttle lett.
  var vent = null;
  try {
    var obs = new MutationObserver(function () {
      if (vent) return;
      vent = setTimeout(function () {
        vent = null;
        lagKnapp();
      }, 250);
    });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  window.rilSendTilAdministrator = sendTilAdministrator;
  window.rilSikreSendTilAdministratorKnapp = lagKnapp;
})();
