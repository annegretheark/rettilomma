/* RIL v17: stabil bilbestilling-flyt uten PDF-knapp og uten løkker.
   Bruker sender bestilling til admin. Admin godkjenner/rest. Bruker legger kun admin-godkjente varer på bil. */
(function(){
  'use strict';
  if (window.__rilBilbestillingFlowV17) return;
  window.__rilBilbestillingFlowV17 = true;

  const $ = id => document.getElementById(id);
  const num = v => { const n = Number(String(v ?? 0).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const db = () => window.supabaseClient || window.supabase || null;

  function msg(text, error){
    const e = $('bilLagerMelding') || $('bilMelding') || $('lagerMelding');
    if (e) { e.textContent = text || ''; e.style.color = error ? '#fca5a5' : '#86efac'; }
    else if (error) alert(text);
  }

  function valgtBil(){
    try { if (typeof window.hentValgtBilIdForBilLager === 'function') return window.hentValgtBilIdForBilLager() || ''; } catch(e) {}
    return ($('bilLagerBilValg') && $('bilLagerBilValg').value) || '';
  }

  function valgtBilTekst(){
    const s = $('bilLagerBilValg');
    return s && s.selectedIndex >= 0 ? (s.options[s.selectedIndex].text || '') : '';
  }

  function firmaId(){
    try { if (typeof window.hentAktivFirmaId === 'function') return window.hentAktivFirmaId() || null; } catch(e) {}
    return window.aktivFirmaId || (window.firmaData && window.firmaData.id) || (window.firma && window.firma.id) || null;
  }

  function collectOrderLines(){
    return Array.from(document.querySelectorAll('.bil-lager-antall-liste')).map(input => {
      const vareId = input.dataset.vareId;
      const antall = num(input.value);
      const min = document.querySelector('.bil-lager-min-liste[data-vare-id="' + CSS.escape(String(vareId || '')) + '"]');
      return { vareId, antall, minimum: num(min && min.value) };
    }).filter(r => r.vareId && r.antall > 0 && Number.isInteger(r.antall));
  }

  async function safeInsert(table, rows){
    const cli = db();
    let payload = Array.isArray(rows) ? rows.map(r => ({...r})) : [{...rows}];
    for (let i=0; i<25; i++) {
      const res = await cli.from(table).insert(payload).select('*');
      if (!res.error) return res;
      const m = String(res.error.message || '');
      const col = (m.match(/Could not find the '([^']+)' column/i)||[])[1] || (m.match(/column "([^"]+)".*does not exist/i)||[])[1];
      if (col) { payload.forEach(r => delete r[col]); continue; }
      return res;
    }
    return { error: { message: 'Kunne ikke lagre i ' + table } };
  }

  async function safeUpdate(table, id, values){
    const cli = db();
    let payload = {...values};
    for (let i=0; i<25; i++) {
      const res = await cli.from(table).update(payload).eq('id', id).select('*');
      if (!res.error) return res;
      const m = String(res.error.message || '');
      const col = (m.match(/Could not find the '([^']+)' column/i)||[])[1] || (m.match(/column "([^"]+)".*does not exist/i)||[])[1];
      if (col && Object.prototype.hasOwnProperty.call(payload, col)) { delete payload[col]; continue; }
      return res;
    }
    return { error: null };
  }

  async function sendBestillingTilAdmin(){
    const cli = db();
    if (!cli) { msg('Supabase er ikke lastet.', true); return false; }
    const bilId = valgtBil();
    if (!bilId) { msg('Velg bil først.', true); return false; }
    const lines = collectOrderLines();
    if (!lines.length) { msg('Skriv antall på minst én vare før du sender bestilling til admin.', true); return false; }

    const now = new Date().toISOString();
    const payload = lines.map(r => ({
      firma_id: firmaId(),
      ansatt_id: window.innloggetAnsattId || localStorage.getItem('innloggetAnsattId') || null,
      bil_id: bilId,
      vare_id: r.vareId,
      bestilt: r.antall,
      antall: r.antall,
      levert: 0,
      mottatt: 0,
      rest: r.antall,
      minimum_antall: r.minimum || 0,
      status: 'venter',
      opprettet: now,
      opprettet_av: window.innloggetEpost || localStorage.getItem('innloggetEpost') || null
    }));

    msg('Sender bestilling til admin...');
    const res = await safeInsert('hand_bil_bestilling', payload);
    if (res.error) { msg('Kunne ikke sende bestilling til admin: ' + (res.error.message || res.error), true); return false; }
    document.querySelectorAll('.bil-lager-antall-liste, .bil-lager-min-liste').forEach(i => i.value = '');
    msg('Bestilling sendt til admin. Admin må godkjenne og sette rest.');
    hideStockList();
    await renderApprovedRestList();
    return true;
  }

  async function loadApprovedRows(){
    const cli = db();
    const bilId = valgtBil();
    if (!cli || !bilId) return [];
    const res = await cli.from('hand_bil_bestilling').select('*').eq('bil_id', bilId).order('opprettet', { ascending: false });
    if (res.error) throw res.error;
    return (res.data || []).filter(r => {
      const st = String(r.status || '').toLowerCase();
      if (['venter','ny','sendt','ferdig','mottatt','avsluttet','arkivert'].includes(st)) return false;
      const approvedLeft = Math.max(0, num(r.levert) - num(r.mottatt));
      return approvedLeft > 0 || num(r.rest) > 0 || ['godkjent','delvis','delvis_levert','rest','restordre'].includes(st);
    });
  }

  async function loadVarer(ids){
    const cli = db();
    const clean = [...new Set(ids.filter(Boolean).map(String))];
    const map = new Map();
    if (!cli || !clean.length) return map;
    const res = await cli.from('hand_vare').select('id,varenr,navn,varenavn').in('id', clean);
    (res.data || []).forEach(v => map.set(String(v.id), v));
    return map;
  }

  function panel(){
    let host = $('rilGodkjentRestPanel');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'rilGodkjentRestPanel';
    host.style.margin = '12px 0';
    const fyll = $('bilLagerFyllListe');
    (fyll && fyll.parentNode ? fyll.parentNode : ($('bilerSide') || document.body)).insertBefore(host, fyll ? fyll.nextSibling : null);
    return host;
  }

  async function renderApprovedRestList(){
    const host = panel();
    const bilId = valgtBil();
    if (!bilId) { host.innerHTML = '<div class="info">Velg bil for å se godkjente varer og rest.</div>'; setReceiveEnabled(false); return; }
    try {
      const rows = await loadApprovedRows();
      const varer = await loadVarer(rows.map(r => r.vare_id));
      const active = rows.filter(r => Math.max(0, num(r.levert) - num(r.mottatt)) > 0 || num(r.rest) > 0);
      const canReceive = active.some(r => Math.max(0, num(r.levert) - num(r.mottatt)) > 0);
      if (!active.length) {
        host.innerHTML = '<div class="info">Ingen godkjent liste fra admin for ' + esc(valgtBilTekst()) + '.</div>';
        setReceiveEnabled(false);
        return;
      }
      host.innerHTML = '<div class="kort" style="border:1px solid #334155;background:#111827;padding:12px;border-radius:10px">' +
        '<h4>Godkjent bestilling fra admin</h4>' +
        '<p class="info">Listen viser hva admin har godkjent og hva som står i rest. Trykk knappen for å legge godkjente varer på bil.</p>' +
        '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>' +
        '<th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Vare</th>' +
        '<th style="text-align:right;padding:6px;border-bottom:1px solid #374151">Bestilt</th>' +
        '<th style="text-align:right;padding:6px;border-bottom:1px solid #374151">Godkjent</th>' +
        '<th style="text-align:right;padding:6px;border-bottom:1px solid #374151">Rest</th>' +
        '<th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Status</th></tr></thead><tbody>' +
        active.map(r => {
          const v = varer.get(String(r.vare_id)) || {};
          const godkjent = Math.max(0, num(r.levert) - num(r.mottatt));
          const rest = num(r.rest);
          const navn = v.navn || v.varenavn || v.varenr || r.vare_id || '';
          return '<tr><td style="padding:6px;border-bottom:1px solid #273244">' + esc(navn) + '</td>' +
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #273244">' + num(r.bestilt || r.antall) + '</td>' +
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #273244;color:#86efac;font-weight:bold">' + godkjent + '</td>' +
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #273244;color:' + (rest > 0 ? '#fca5a5' : '#86efac') + ';font-weight:bold">' + rest + '</td>' +
            '<td style="padding:6px;border-bottom:1px solid #273244">' + (rest > 0 ? 'Rest' : 'Godkjent') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
      setReceiveEnabled(canReceive);
    } catch(e) {
      host.innerHTML = '<div class="feil">Kunne ikke hente godkjent/rest: ' + esc(e.message || e) + '</div>';
      setReceiveEnabled(false);
    }
  }

  async function addApprovedToCar(){
    const cli = db();
    const bilId = valgtBil();
    if (!cli || !bilId) { msg('Velg bil først.', true); return false; }
    const rows = (await loadApprovedRows()).filter(r => Math.max(0, num(r.levert) - num(r.mottatt)) > 0);
    if (!rows.length) { msg('Kan ikke legge på bil før admin har godkjent listen.', true); await renderApprovedRestList(); return false; }

    for (const r of rows) {
      const vareId = String(r.vare_id || '');
      const antall = Math.max(0, num(r.levert) - num(r.mottatt));
      if (!vareId || antall <= 0) continue;
      const eks = await cli.from('hand_bil_lager').select('id,antall,minimum_antall').eq('bil_id', bilId).eq('vare_id', vareId).limit(1);
      if (eks.error) throw eks.error;
      if (eks.data && eks.data.length) {
        const upd = await cli.from('hand_bil_lager').update({ antall: num(eks.data[0].antall) + antall }).eq('id', eks.data[0].id);
        if (upd.error) throw upd.error;
      } else {
        const ins = await safeInsert('hand_bil_lager', [{ bil_id: bilId, vare_id: vareId, antall: antall, minimum_antall: num(r.minimum_antall) }]);
        if (ins.error) throw ins.error;
      }
      await safeInsert('hand_lagerlogg', [{ bil_id: bilId, vare_id: vareId, antall: antall, handling: 'mottatt_admin_godkjent_pa_bil', kommentar: 'Bruker la admin-godkjent vare på bil', opprettet: new Date().toISOString() }]);
      await safeUpdate('hand_bil_bestilling', r.id, { mottatt: num(r.levert), status: num(r.rest) > 0 ? 'delvis_mottatt' : 'ferdig', mottatt_dato: new Date().toISOString() });
    }
    msg('Godkjente varer er lagt på bil. Rest står igjen.');
    if (typeof window.lastBilerOgBilLager === 'function') { try { await window.lastBilerOgBilLager(); } catch(e){} }
    if (typeof window.fyllVarevalgFraAktivBil === 'function') { try { await window.fyllVarevalgFraAktivBil(); } catch(e){} }
    await renderApprovedRestList();
    hideStockList();
    return true;
  }

  function setReceiveEnabled(enabled){
    const b = $('lagreBilLagerListeKnapp');
    if (!b) return;
    b.textContent = 'Godkjenn og legg på bil';
    b.disabled = !enabled;
    b.style.opacity = enabled ? '1' : '0.55';
    b.title = enabled ? 'Legg admin-godkjente varer på bil' : 'Venter på godkjent liste fra admin';
  }

  function hideStockList(){ const el = $('bilLagerFyllListe'); if (el) el.style.display = 'none'; }
  function showStockList(){ const el = $('bilLagerFyllListe'); if (el) el.style.display = 'block'; }

  function removePdfButtons(){
    document.querySelectorAll('button,a').forEach(b => {
      const id = String(b.id || '').toLowerCase();
      const t = String(b.textContent || '').toLowerCase();
      if (id.indexOf('pdf') >= 0 || t.indexOf('pdf') >= 0 || t.indexOf('lagerliste') >= 0) b.remove();
    });
  }

  function setupToggle(){
    const fyll = $('bilLagerFyllListe');
    if (!fyll || $('rilToggleFyllBil')) return;
    const btn = document.createElement('button');
    btn.id = 'rilToggleFyllBil';
    btn.type = 'button';
    btn.className = 'secondary';
    btn.textContent = 'Fyll bil';
    fyll.parentNode.insertBefore(btn, fyll);
    btn.onclick = function(){
      if (fyll.style.display === 'none' || !fyll.style.display) { showStockList(); btn.textContent = 'Skjul lagerliste'; }
      else { hideStockList(); btn.textContent = 'Fyll bil'; }
    };
    hideStockList();
  }

  function wire(){
    window.sikrePdfKnappTilLager = function(){};
    window.lagPdfFyllBilTilLager = function(){};
    window.sikrePdfKnappHvisMangler = function(){};
    removePdfButtons();
    const send = $('sendBilLagerBestillingKnapp');
    if (send) {
      send.style.display = '';
      send.disabled = false;
      send.textContent = 'Send bestilling til admin';
      send.onclick = e => { if(e){e.preventDefault();e.stopPropagation();} sendBestillingTilAdmin().catch(err => msg('Kunne ikke sende bestilling: ' + (err.message || err), true)); return false; };
    }
    const receive = $('lagreBilLagerListeKnapp');
    if (receive) {
      receive.onclick = e => { if(e){e.preventDefault();e.stopPropagation();} addApprovedToCar().catch(err => msg('Kunne ikke legge på bil: ' + (err.message || err), true)); return false; };
    }
    setupToggle();
    renderApprovedRestList();
  }

  window.sendBilLagerBestilling = sendBestillingTilAdmin;
  window.opprettBilLagerBestillingListe = sendBestillingTilAdmin;
  window.lagreBilLagerListe = addApprovedToCar;
  window.rilRenderGodkjentRestListe = renderApprovedRestList;

  document.addEventListener('click', function(e){
    const t = e.target;
    if (!t) return;
    if (t.id === 'sendBilLagerBestillingKnapp') { e.preventDefault(); e.stopPropagation(); sendBestillingTilAdmin().catch(err => msg('Kunne ikke sende bestilling: ' + (err.message || err), true)); }
    if (t.id === 'lagreBilLagerListeKnapp') { e.preventDefault(); e.stopPropagation(); addApprovedToCar().catch(err => msg('Kunne ikke legge på bil: ' + (err.message || err), true)); }
  }, true);
  document.addEventListener('change', e => { if (e.target && e.target.id === 'bilLagerBilValg') setTimeout(renderApprovedRestList, 100); });
  document.addEventListener('DOMContentLoaded', () => { setTimeout(wire, 300); setTimeout(wire, 1200); });
  window.addEventListener('load', () => { setTimeout(wire, 300); setTimeout(wire, 1500); setTimeout(removePdfButtons, 3000); });
})();

/* RIL v19: HARD FIX - ingen PDF til lager, send bestilling til admin skal alltid være synlig når bruker fyller bil. */
(function(){
  'use strict';
  if (window.__rilNoPdfSendAdminV19) return;
  window.__rilNoPdfSendAdminV19 = true;
  const $ = id => document.getElementById(id);
  function isPdfThing(el){
    if (!el) return false;
    const id = String(el.id || '').toLowerCase();
    const txt = String(el.textContent || '').toLowerCase();
    const title = String(el.title || '').toLowerCase();
    return id.indexOf('pdf') >= 0 || txt.indexOf('pdf') >= 0 || title.indexOf('pdf') >= 0 || txt.indexOf('lagerliste') >= 0;
  }
  function removePdfHard(){
    document.querySelectorAll('button,a,input[type="button"],input[type="submit"]').forEach(el => {
      if (isPdfThing(el)) el.remove();
    });
    document.querySelectorAll('*').forEach(el => {
      if (el.childElementCount === 0) {
        const t = String(el.textContent || '').toLowerCase();
        if (t.indexOf('pdf/lagerliste') >= 0 || t.indexOf('pdf er') >= 0 || t.indexOf('pdf laget') >= 0) el.textContent = '';
      }
    });
  }
  function placeSendButton(){
    removePdfHard();
    let send = $('sendBilLagerBestillingKnapp');
    const fill = $('bilLagerFyllListe');
    const receive = $('lagreBilLagerListeKnapp');
    if (!send) {
      send = document.createElement('button');
      send.id = 'sendBilLagerBestillingKnapp';
      send.type = 'button';
      send.className = 'secondary';
      send.textContent = 'Send bestilling til admin';
    }
    send.style.display = 'inline-block';
    send.style.visibility = 'visible';
    send.disabled = false;
    send.textContent = 'Send bestilling til admin';
    send.onclick = function(e){
      if(e){e.preventDefault();e.stopPropagation();}
      if (typeof window.sendBilLagerBestilling === 'function') window.sendBilLagerBestilling();
      else if (typeof window.opprettBilLagerBestillingListe === 'function') window.opprettBilLagerBestillingListe();
      return false;
    };
    let bar = $('rilSendAdminBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'rilSendAdminBar';
      bar.style.margin = '10px 0';
      bar.style.display = 'flex';
      bar.style.gap = '10px';
      bar.style.justifyContent = 'flex-end';
      bar.style.alignItems = 'center';
    }
    if (fill && fill.parentNode && bar.parentNode !== fill.parentNode) fill.parentNode.insertBefore(bar, fill.nextSibling);
    if (send.parentNode !== bar) bar.appendChild(send);
    if (receive) {
      receive.textContent = 'Bekreft mottatt og legg på bil';
      // Knappen skal bare vises/aktiveres av godkjent-listen fra admin.
      if (!document.querySelector('#rilGodkjentRestPanel table')) {
        receive.style.display = 'none';
        receive.style.visibility = 'hidden';
      } else {
        receive.style.display = 'inline-block';
        receive.style.visibility = 'visible';
        if (receive.parentNode !== bar) bar.appendChild(receive);
      }
    }
  }
  const oldSet = window.setInterval(placeSendButton, 700);
  document.addEventListener('DOMContentLoaded', () => setTimeout(placeSendButton, 100));
  window.addEventListener('load', () => setTimeout(placeSendButton, 100));
})();
