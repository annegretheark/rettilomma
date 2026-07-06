/* RIL 20260705 stabil admin-bestillinger:
   - Egen siste override for admin Bestillinger.
   - Viser både aktive bestillinger og Tidligere bestillinger.
   - Bruker hand_bil_bestilling direkte, men endrer ikke Min bil / bil-lager / lagerlogg.
   - Admin-godkjenning markerer kun bestillingen som besvart/godkjent; ansatt legger på bil senere. */
(function () {
  'use strict';
  if (window.__rilAdminBestillingerStabilFix) return;
  window.__rilAdminBestillingerStabilFix = true;

  var modus = 'aktive';

  function $(id) { return document.getElementById(id); }
  function str(v) { return String(v == null ? '' : v); }
  function low(v) { return str(v).toLowerCase(); }
  function esc(v) { return str(v).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function num(v) { var n = Number(str(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; }
  function int(v) { return Math.max(0, Math.round(num(v))); }
  function client() { return window.supabaseClient || (window.supabase && window.supabase.from ? window.supabase : null); }

  function erAdmin() {
    var rolle = low(window.innloggetRolle || window.handInnloggetRolle || localStorage.getItem('handInnloggetRolle') || localStorage.getItem('innloggetRolle') || localStorage.getItem('rolle') || localStorage.getItem('handRolle'));
    var adminFlagg = low(localStorage.getItem('rilAdminModus') || localStorage.getItem('handAdminModus'));
    return window.erAdmin === true || window.handErAdmin === true || adminFlagg === 'ja' || adminFlagg === 'true' || ['admin','administrator','eier','owner','sysadm','sysadmin','systemadmin'].indexOf(rolle) !== -1;
  }

  async function firmaId() {
    try { if (typeof window.hentAktivFirmaId === 'function') return await window.hentAktivFirmaId(); } catch (e) {}
    return window.aktivFirmaId || localStorage.getItem('aktivFirmaId') || localStorage.getItem('firmaId') || localStorage.getItem('firma_id') || null;
  }

  function vis(el) {
    if (!el) return;
    el.hidden = false;
    el.classList.remove('skjult', 'hidden', 'modul-skjult');
    el.removeAttribute('aria-hidden');
    el.style.display = '';
    el.style.visibility = 'visible';
  }

  function skjul(el) {
    if (!el) return;
    el.hidden = true;
    el.classList.add('skjult');
    el.setAttribute('aria-hidden', 'true');
    el.style.display = 'none';
  }

  function skjulAndreSider() {
    [
      'timerSide','jobberSide','fravaerSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide',
      'kundeSide','kunderSide','ansattSide','ansatteSide','firmaSide','testSide','testpanelSide','lonnPanel','lonnSide',
      'modulerSide','sysadminPanelSide','adminSide','adminBilBestillinger','adminBilBestillingerPanel'
    ].forEach(function (id) { skjul($(id)); });
  }

  function sikreKnapp() {
    if (!erAdmin()) return null;
    var btn = $('visBilBestillingerKnapp');
    var host = $('handTopbarKort') || $('appSide') || document.body;
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'visBilBestillingerKnapp';
      btn.type = 'button';
      btn.setAttribute('data-modul', 'bilbestillinger');
      host.appendChild(btn);
    }
    btn.textContent = 'Bestillinger';
    btn.hidden = false;
    btn.style.display = 'inline-block';
    btn.style.visibility = 'visible';
    btn.classList.remove('skjult', 'hidden', 'modul-skjult');
    btn.onclick = function (e) { return apneBestillinger(e, 'aktive'); };
    return btn;
  }

  function side() {
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

  function tegnSkall() {
    var app = $('appSide');
    if (app) { app.classList.remove('ril-starter','skjult','hidden'); app.hidden = false; app.style.display = ''; app.style.visibility = 'visible'; }
    skjulAndreSider();
    var s = side();
    vis(s);
    var h = $('handSideOverskrift');
    if (h) h.textContent = 'Bestillinger';
    s.innerHTML = '' +
      '<h2 style="text-align:center;margin-top:0;color:#f8fafc">Bestillinger fra ansatte</h2>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 12px 0">' +
        '<button id="rilAdminBestAktive" type="button" style="background:' + (modus === 'aktive' ? '#1f6feb' : '#374151') + ';color:white;border:0;border-radius:8px;padding:9px 12px;font-weight:700">Aktive bestillinger</button>' +
        '<button id="rilAdminBestTidligere" type="button" style="background:' + (modus === 'tidligere' ? '#1f6feb' : '#374151') + ';color:white;border:0;border-radius:8px;padding:9px 12px;font-weight:700">Tidligere bestillinger</button>' +
      '</div>' +
      '<div id="rilAdminBestMsg" style="padding:12px;border:1px solid #334155;border-radius:12px;background:#0f172a;color:#e5e7eb;font-weight:700;margin-bottom:12px">Henter bestillinger...</div>' +
      '<div id="rilAdminBestContent"></div>';
    $('rilAdminBestAktive').onclick = function () { modus = 'aktive'; lastOgTegn(); };
    $('rilAdminBestTidligere').onclick = function () { modus = 'tidligere'; lastOgTegn(); };
  }

  function statusHistorikk(r) {
    var st = low(r && r.status);
    if (/^(admin_besvart|admin_bekreftet|admin_godkjent|godkjent|bekreftet|besvart|rest_hos_admin|restordre_admin|restordre|delvis_admin|delvis_bekreftet|lagt_pa_bil|ansatt_godkjent|mottatt|ferdig|avsluttet|utlevert|fullfort|fullført|arkivert)$/.test(st)) return true;
    return !!(r && (r.admin_svar_sendt === true || r.admin_godkjent === true || r.godkjent_dato || r.admin_svar_tid || r.lagt_pa_bil_at || r.ansatt_godkjent_at));
  }

  function bestilt(r) { return int(r.bestilt || r.bestilt_antall || r.antall || r.ordre_antall || r.rest); }
  function godkjent(r) {
    var g = int(r.godkjent || r.godkjent_antall || r.admin_godkjent_antall || r.bekreftet_antall || r.levert);
    if (g > 0) return g;
    if (statusHistorikk(r)) return Math.max(0, bestilt(r) - int(r.rest));
    return 0;
  }
  function rest(r) { return Math.max(0, bestilt(r) - godkjent(r)); }

  async function hentMap(tabell, ids) {
    var c = client();
    var clean = Array.from(new Set((ids || []).filter(Boolean).map(String)));
    var map = new Map();
    if (!c || !clean.length) return map;
    try {
      var res = await c.from(tabell).select('*').in('id', clean);
      if (!res.error) (res.data || []).forEach(function (r) { map.set(String(r.id), r); });
    } catch (e) {}
    return map;
  }

  async function hentRows() {
    var c = client();
    if (!c) throw new Error('Supabase er ikke klar.');
    async function q(filterFirma) {
      var sp = c.from('hand_bil_bestilling').select('*').order('opprettet', { ascending: false }).limit(1000);
      if (filterFirma) sp = sp.eq('firma_id', filterFirma);
      var r = await sp;
      if (r.error && String(r.error.message || '').toLowerCase().indexOf('opprettet') >= 0) {
        sp = c.from('hand_bil_bestilling').select('*').order('created_at', { ascending: false }).limit(1000);
        if (filterFirma) sp = sp.eq('firma_id', filterFirma);
        r = await sp;
      }
      if (r.error) throw r.error;
      return r.data || [];
    }
    var fid = null;
    try { fid = await firmaId(); } catch (e) {}
    var rows = fid ? await q(fid) : await q(null);
    if (fid && !rows.length) rows = await q(null); // fallback hvis aktiv firma-id er feil/ikke satt

    var vareMap = await hentMap('hand_vare', rows.map(function (r) { return r.vare_id; }));
    var bilMap = await hentMap('hand_bil', rows.map(function (r) { return r.bil_id; }));
    rows.forEach(function (r) {
      var v = r.vare_id ? vareMap.get(String(r.vare_id)) : null;
      var b = r.bil_id ? bilMap.get(String(r.bil_id)) : null;
      if (v) { r.__varenavn = r.varenavn || r.vare_navn || v.navn || v.varenavn || v.beskrivelse || r.vare_id; r.__varenr = r.varenr || v.varenr || v.nr || ''; }
      if (b) { r.__bilnavn = r.bil_navn || b.navn || b.bilnavn || b.regnr || b.registreringsnummer || r.bil_id; }
    });
    return rows;
  }

  function gruppeKey(r) {
    return [r.bestilling_id || r.batch_id || r.ordre_id || '', r.bil_id || r.bil_navn || '', r.ansatt_id || r.bruker_id || r.bruker_epost || r.opprettet_av || '', str(r.opprettet || r.created_at).slice(0, 16)].join('|');
  }
  function grupper(rows) {
    var m = new Map();
    rows.forEach(function (r) { var k = gruppeKey(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return Array.from(m.values());
  }
  function ansatt(r) { return r.bruker_navn || r.ansatt_navn || r.hentet_av || r.bruker_epost || r.user_email || r.opprettet_av || 'Ansatt'; }
  function bil(r) { return r.bil_navn || r.__bilnavn || r.bilnavn || r.bil_id || 'Bil'; }
  function vare(r) {
    var nr = r.varenr || r.__varenr || '';
    var navn = r.varenavn || r.vare_navn || r.__varenavn || r.vare_id || 'Vare';
    return nr && String(navn).indexOf(nr) < 0 ? nr + ' - ' + navn : navn;
  }

  function tegn(rows) {
    var msg = $('rilAdminBestMsg');
    var content = $('rilAdminBestContent');
    if (!content) return;
    var filtered = (rows || []).filter(function (r) { return modus === 'tidligere' ? statusHistorikk(r) : !statusHistorikk(r); });
    if (msg) msg.textContent = modus === 'tidligere' ? 'Tidligere bestillinger' : 'Aktive bestillinger fra ansatte';
    if (!filtered.length) {
      content.innerHTML = '<div class="info" style="padding:12px;border:1px solid #334155;border-radius:10px;background:#111827;color:#cbd5e1">' + (modus === 'tidligere' ? 'Ingen tidligere bestillinger.' : 'Ingen aktive bestillinger.') + '</div>';
      return;
    }
    content.innerHTML = grupper(filtered).map(function (lines) {
      var f = lines[0] || {};
      var lineHtml = lines.map(function (r) {
        var b = bestilt(r), g = modus === 'tidligere' ? godkjent(r) : b, re = modus === 'tidligere' ? rest(r) : 0;
        if (modus === 'tidligere') {
          return '<div style="display:grid;grid-template-columns:minmax(230px,1fr) 90px 110px 90px;gap:10px;border-bottom:1px solid #273244;padding:8px 0;align-items:center"><strong>'+esc(vare(r))+'</strong><span>Bestilt: '+b+'</span><span>Godkjent: '+g+'</span><span>Rest: '+re+'</span></div>';
        }
        return '<div class="ril-admin-best-line" data-id="'+esc(r.id)+'" data-bestilt="'+b+'" style="display:grid;grid-template-columns:minmax(230px,1fr) 90px 120px 90px;gap:10px;border-bottom:1px solid #273244;padding:8px 0;align-items:center"><strong>'+esc(vare(r))+'</strong><span>Bestilt: '+b+'</span><input class="ril-admin-best-godkjent" type="number" min="0" max="'+b+'" value="'+b+'" style="padding:8px;border-radius:8px;border:1px solid #475569;background:#0b1220;color:#fff"><span class="ril-admin-best-rest">Rest: 0</span></div>';
      }).join('');
      return '<details open class="ril-admin-best-order" style="border:1px solid #334155;border-radius:12px;margin:12px 0;background:#111827;overflow:hidden;color:#e5e7eb"><summary style="cursor:pointer;padding:12px;background:#172033;font-weight:700;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>'+esc(ansatt(f))+'</span><span>'+esc(bil(f))+'</span><span>'+esc(str(f.opprettet || f.created_at).slice(0, 16).replace('T',' '))+'</span></summary><div style="padding:12px">'+lineHtml+(modus === 'aktive' ? '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button type="button" class="ril-admin-best-godkjenn" style="background:#16a34a;color:white;border:0;border-radius:8px;padding:10px 14px;font-weight:800">Godkjenn for bruker</button></div>' : '')+'</div></details>';
    }).join('');
    bind(content);
  }

  function bind(root) {
    root.querySelectorAll('.ril-admin-best-order').forEach(function (order) {
      function recalc() {
        order.querySelectorAll('.ril-admin-best-line').forEach(function (line) {
          var b = int(line.dataset.bestilt);
          var inp = line.querySelector('.ril-admin-best-godkjent');
          var g = Math.max(0, Math.min(b, int(inp && inp.value)));
          if (inp) inp.value = g;
          var r = line.querySelector('.ril-admin-best-rest');
          if (r) r.textContent = 'Rest: ' + Math.max(0, b - g);
        });
      }
      order.querySelectorAll('.ril-admin-best-godkjent').forEach(function (inp) { inp.addEventListener('input', recalc); });
      recalc();
    });
    root.querySelectorAll('.ril-admin-best-godkjenn').forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.preventDefault(); e.stopPropagation();
        var order = btn.closest('.ril-admin-best-order');
        if (!order) return;
        if (!confirm('Godkjenne bestillingen og sende svar/rest til ansatt?')) return;
        btn.disabled = true;
        var msg = $('rilAdminBestMsg');
        if (msg) msg.textContent = 'Godkjenner bestilling...';
        try {
          var lines = Array.from(order.querySelectorAll('.ril-admin-best-line'));
          for (var i = 0; i < lines.length; i++) await oppdaterLinje(lines[i]);
          modus = 'tidligere';
          await lastOgTegn();
        } catch (err) {
          btn.disabled = false;
          if (msg) msg.textContent = 'Kunne ikke godkjenne: ' + (err && err.message ? err.message : err);
        }
      });
    });
  }

  async function oppdaterLinje(line) {
    var c = client();
    if (!c) throw new Error('Supabase er ikke klar.');
    var id = line.dataset.id;
    var b = int(line.dataset.bestilt);
    var inp = line.querySelector('.ril-admin-best-godkjent');
    var g = Math.max(0, Math.min(b, int(inp && inp.value)));
    var payload = {
      levert: g,
      rest: Math.max(0, b - g),
      status: Math.max(0, b - g) > 0 ? 'rest_hos_admin' : 'admin_besvart',
      admin_svar_sendt: true,
      admin_svar_tid: new Date().toISOString(),
      admin_godkjent: true,
      godkjent_dato: new Date().toISOString()
    };
    var r = await c.from('hand_bil_bestilling').update(payload).eq('id', id);
    if (r.error) {
      // Fallback hvis noen kolonner ikke finnes i en eldre database.
      r = await c.from('hand_bil_bestilling').update({ status: payload.status }).eq('id', id);
      if (r.error) throw r.error;
    }
  }

  async function lastOgTegn() {
    tegnSkall();
    try { tegn(await hentRows()); }
    catch (e) {
      var msg = $('rilAdminBestMsg');
      var content = $('rilAdminBestContent');
      if (msg) msg.textContent = 'Kunne ikke hente bestillinger: ' + (e && e.message ? e.message : e);
      if (content) content.innerHTML = '<div class="info">Sjekk tabellen hand_bil_bestilling i Supabase.</div>';
      console.error('Admin bestillinger feilet:', e);
    }
  }

  function apneBestillinger(e, nyModus) {
    if (e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
    if (!erAdmin()) return false;
    modus = nyModus || modus || 'aktive';
    lastOgTegn();
    return false;
  }

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('#visBilBestillingerKnapp,[data-modul="bilbestillinger"]');
    if (!t) return;
    return apneBestillinger(e, 'aktive');
  }, true);

  function start() {
    if (!erAdmin()) return;
    sikreKnapp();
  }
  document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); setTimeout(start, 500); setTimeout(start, 1500); });
  document.addEventListener('handPartialerLastet', function () { setTimeout(start, 100); setTimeout(start, 800); });
  window.addEventListener('load', function () { setTimeout(start, 200); setTimeout(start, 1200); });

  window.rilVisBestillinger = function () { return apneBestillinger(null, 'aktive'); };
  window.handLastBilBestillinger = function () { return apneBestillinger(null, 'aktive'); };
  window.handLastAdminBilBestillinger = function () { return apneBestillinger(null, 'aktive'); };
  window.renderAdminBilBestillinger = function () { return apneBestillinger(null, 'aktive'); };
})();
