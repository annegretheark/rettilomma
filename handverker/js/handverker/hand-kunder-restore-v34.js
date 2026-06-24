/* Handverker v34 - restore kunder for egen bedrift
   - Rydder opp etter v33 der kundelisten ble tom.
   - Henter firma_id trygt fra hand_ansatt.epost eller URL ?firma=linknavn.
   - Laster hand_kunde for egen bedrift og fyller Kunde/Kundenr i timer.
*/
(function(){
  'use strict';
  if(window.__handKunderRestoreV34) return;
  window.__handKunderRestoreV34 = true;

  function s(v){ return String(v == null ? '' : v).trim(); }
  function low(v){ return s(v).toLowerCase(); }
  function byId(id){ return document.getElementById(id); }
  function client(){ return window.supabaseClient || (window.supabase && window.supabase.from ? window.supabase : null); }
  function esc(v){ return s(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function msg(t){ ['kundeMelding','timerMelding','melding'].forEach(function(id){ var el=byId(id); if(el && t) el.textContent=t; }); }
  function isSys(r){ r=low(r); return r === 'sysadm' || r === 'sysadmin' || r === 'systemadmin'; }
  function isAdmin(r){ r=low(r); return isSys(r) || r === 'admin' || r === 'administrator' || r === 'bedrift_admin'; }
  function kundenr(k){ return s(k && (k.kundenr || k.kunde_nr || k.kundenummer || k.nr)); }
  function numOnly(v){ var m=s(v).match(/\d+/g); return m ? m.join('') : ''; }
  function isAutoKundenrV35(v){ v=low(v); return !v || v.indexOf('automatisk') >= 0 || v === '(lages automatisk)' || v === 'lages automatisk'; }

  async function getEmail(){
    var c = client();
    try{
      if(c && c.auth && c.auth.getUser){
        var r = await c.auth.getUser();
        var e = low(r && r.data && r.data.user && r.data.user.email);
        if(e) return e;
      }
    }catch(e){}
    try{
      if(c && c.auth && c.auth.getSession){
        var r2 = await c.auth.getSession();
        var e2 = low(r2 && r2.data && r2.data.session && r2.data.session.user && r2.data.session.user.email);
        if(e2) return e2;
      }
    }catch(e){}
    return low(window.innloggetEpost || window.innloggetBrukerEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('rettilommaSistEpost'));
  }

  function urlSlug(){
    try{ return low(new URLSearchParams(location.search).get('firma') || ''); }catch(e){ return ''; }
  }

  async function firmaFraUrl(){
    var slug = urlSlug(); var c = client(); if(!c || !slug) return null;
    try{
      var r = await c.from('hand_firma').select('*').eq('linknavn', slug).limit(1);
      if(!r.error && r.data && r.data.length) return r.data[0];
    }catch(e){}
    try{
      var r2 = await c.from('hand_firma').select('*').ilike('linknavn', slug).limit(1);
      if(!r2.error && r2.data && r2.data.length) return r2.data[0];
    }catch(e){}
    return null;
  }

  async function ansattForEmail(email, firmaId){
    var c = client(); if(!c || !email) return null;
    var rows = [];
    try{
      var r = await c.from('hand_ansatt').select('*').ilike('epost', email);
      if(!r.error && Array.isArray(r.data)) rows = rows.concat(r.data);
    }catch(e){}
    try{
      var r2 = await c.from('hand_ansatt').select('*').ilike('email', email);
      if(!r2.error && Array.isArray(r2.data)) rows = rows.concat(r2.data);
    }catch(e){}
    var seen = {}, clean = [];
    rows.forEach(function(a){ var key=s(a.id)+'|'+s(a.firma_id)+'|'+low(a.rolle); if(!seen[key]){ seen[key]=1; clean.push(a); } });
    if(firmaId){
      var same = clean.find(function(a){ return s(a.firma_id) === s(firmaId); });
      if(same) return same;
    }
    return clean.find(function(a){ return isSys(a.rolle); }) || clean.find(function(a){ return isAdmin(a.rolle) || a.er_admin === true; }) || clean[0] || null;
  }

  async function resolveContextV34(){
    var email = await getEmail();
    var firmaUrl = await firmaFraUrl();
    var firmaUrlId = s(firmaUrl && firmaUrl.id);
    var ansatt = await ansattForEmail(email, firmaUrlId);
    var role = low(ansatt && ansatt.rolle);
    if((!role || role === 'bruker') && ansatt && ansatt.er_admin === true) role = 'admin';
    var sys = isSys(role);
    var firmaId = sys ? (firmaUrlId || s(ansatt && ansatt.firma_id)) : (s(ansatt && ansatt.firma_id) || firmaUrlId || s(localStorage.getItem('handFirmaId') || localStorage.getItem('aktivFirmaId') || localStorage.getItem('firma_id')));

    if(email){ window.innloggetEpost = email; try{ localStorage.setItem('handInnloggetEpost', email); }catch(e){} }
    if(role){ window.innloggetRolle = role; try{ localStorage.setItem('handInnloggetRolle', role); localStorage.setItem('innloggetRolle', role); }catch(e){} }
    if(firmaId){
      window.aktivFirmaId = firmaId; window.handFirmaId = firmaId; window.handAnsattFirmaId = firmaId;
      try{ localStorage.setItem('aktivFirmaId', firmaId); localStorage.setItem('handFirmaId', firmaId); localStorage.setItem('firma_id', firmaId); localStorage.setItem('firmaId', firmaId); }catch(e){}
    }
    window.erSystemadmin = !!sys;
    window.erAdmin = !!(sys || isAdmin(role) || (ansatt && ansatt.er_admin === true));
    var rv = byId('innloggetRolleVisning');
    if(rv){
      var parts = [];
      parts.push('rolle: ' + (role || 'bruker'));
      if(sys) parts.push('sysadm'); else if(window.erAdmin) parts.push('adminmodus');
      rv.textContent = ' (' + parts.join(', ') + ')';
    }
    var bv = byId('innloggetBrukerVisning'); if(bv && email) bv.textContent = email;
    return { email:email, role:role || 'bruker', isSysadmin:sys, isAdmin:!!window.erAdmin, firmaId:firmaId, ansatt:ansatt, firma:firmaUrl };
  }

  function nesteKundenr(rows){
    var max = 1000;
    (rows || []).forEach(function(k){ var nr=parseInt(numOnly(kundenr(k)),10); if(Number.isFinite(nr) && nr>max) max=nr; });
    return String(max + 1);
  }



  async function backfillKundenrV35(rows, c, cx){
    rows = Array.isArray(rows) ? rows : [];
    if(!rows.length || !c) return rows;
    if(!cx || (!cx.isAdmin && !cx.isSysadmin)) return rows;
    var next = parseInt(nesteKundenr(rows), 10);
    var changed = false;
    for(var i=0;i<rows.length;i++){
      var k = rows[i];
      if(kundenr(k)) continue;
      var nr = String(next++);
      var ok = false;
      try{
        var r = await c.from('hand_kunde').update({ kundenr: nr }).eq('id', k.id).select('id,kundenr').limit(1);
        if(!r.error){ k.kundenr = nr; ok = true; }
        else if(/column|kolonne|does not exist|schema cache/i.test(String(r.error.message || ''))){
          var r2 = await c.from('hand_kunde').update({ kunde_nr: nr }).eq('id', k.id).select('id,kunde_nr').limit(1);
          if(!r2.error){ k.kunde_nr = nr; ok = true; }
          else console.warn('Kundenr update feilet:', r2.error.message);
        } else {
          console.warn('Kundenr update feilet:', r.error.message);
        }
      }catch(e){ console.warn('Kundenr backfill exception:', e); }
      if(ok) changed = true;
    }
    if(changed) msg('Kundenr ble generert på kunder som manglet nummer.');
    return rows;
  }

  function renderKunderV34(rows){
    window.kunder = rows || [];
    window.handAdminKunder = window.kunder;
    var liste = byId('kundeListe') || byId('handKundeListe');
    if(liste){
      if(!window.kunder.length){ liste.innerHTML = '<p>Ingen kunder funnet.</p>'; }
      else{
        liste.innerHTML = window.kunder.map(function(k){
          return '<div class="card kunde-card" style="padding:14px;margin-bottom:14px;border-bottom:1px solid #444;">' +
            '<strong>' + esc(k.navn || '') + '</strong><br>' +
            'Kundenr: ' + esc(kundenr(k)) + '<br>' +
            esc(k.adresse || '') + '<br>' + esc(k.epost || k.email || '') + '<br>' +
            esc(k.kontaktperson || '') + '<br>' + esc(k.kontonr || '') +
            '<div style="margin-top:10px"><button type="button" class="secondary" onclick="redigerKunde(\'' + esc(k.id) + '\')">Rediger</button></div>' +
            '</div>';
        }).join('');
      }
    }
    ['kundeValg','fakturaKundeValg','modulKundeVelger','okonomiKundeValg'].forEach(function(id){
      var sel = byId(id); if(!sel) return;
      var old = sel.value || ''; sel.innerHTML = '';
      var first = document.createElement('option'); first.value=''; first.textContent = window.kunder.length ? 'Velg kunde' : 'Ingen kunder funnet'; sel.appendChild(first);
      window.kunder.forEach(function(k){
        var opt = document.createElement('option');
        var nr = kundenr(k);
        opt.value = s(k.id || k.kunde_id || nr);
        opt.dataset.kundenr = nr;
        opt.dataset.firmaId = s(k.firma_id);
        opt.textContent = nr ? (nr + ' - ' + s(k.navn || 'Kunde')) : s(k.navn || 'Kunde');
        sel.appendChild(opt);
      });
      if(old && Array.from(sel.options).some(function(o){ return o.value === old; })) sel.value = old;
    });
    fyllKundenrFeltV34();
  }

  async function lastKunderV34(){
    var cx = await resolveContextV34();
    var c = client(); if(!c){ msg('Supabase er ikke lastet.'); renderKunderV34([]); return []; }
    if(!cx.email){ msg('Fant ikke innlogget e-post. Logg ut og inn igjen.'); renderKunderV34([]); return []; }
    if(!cx.isSysadmin && !cx.firmaId){ msg('Fant ikke firma_id for innlogget bruker.'); renderKunderV34([]); return []; }
    var q = c.from('hand_kunde').select('*').order('navn', { ascending:true });
    if(!cx.isSysadmin) q = q.eq('firma_id', cx.firmaId);
    var r = await q;
    if(r.error){ msg('Feil ved henting av kunder: ' + r.error.message); renderKunderV34([]); return []; }
    var rows = Array.isArray(r.data) ? r.data : [];
    if(!cx.isSysadmin) rows = rows.filter(function(k){ return s(k.firma_id) === s(cx.firmaId); });
    rows = await backfillKundenrV35(rows, c, cx);
    renderKunderV34(rows);
    if(!rows.length) msg('Ingen kunder funnet for firma_id=' + cx.firmaId + '.');
    else msg('');
    return rows;
  }

  function finnKunde(verdi){
    var v=s(verdi); var rows=window.kunder || [];
    return rows.find(function(k){ return s(k.id)===v || s(k.kunde_id)===v || s(kundenr(k))===v || low(k.navn)===low(v); }) || null;
  }

  function fyllKundenrFeltV34(){
    var sel = byId('kundeValg');
    var felt = byId('kundeNrVisning');
    if(!sel || !felt) return;
    var opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
    var nr = s(opt && opt.dataset && opt.dataset.kundenr);
    var k = finnKunde(sel.value);
    if(!nr && k) nr = kundenr(k) || s(k.id);
    felt.value = nr;
  }

  async function lagreKundeV34(){
    var c = client(); if(!c){ msg('Supabase er ikke lastet.'); return; }
    var cx = await resolveContextV34();
    if(!cx.isAdmin && !cx.isSysadmin){ msg('Du mangler adminrettighet for å lagre kunde.'); return; }
    if(!cx.firmaId && !cx.isSysadmin){ msg('Fant ikke firma_id for kunde.'); return; }
    var id = s(byId('kundeId') && byId('kundeId').value);
    var nr = s(byId('kundeNr') && byId('kundeNr').value) || s(byId('kundeNrVis') && byId('kundeNrVis').value);
    if(isAutoKundenrV35(nr)) nr = nesteKundenr(window.kunder || []);
    var payload = {
      navn: s(byId('kundeNavn') && byId('kundeNavn').value),
      adresse: s(byId('kundeAdresse') && byId('kundeAdresse').value),
      epost: s(byId('kundeEpost') && byId('kundeEpost').value),
      kontaktperson: s(byId('kundeKontaktperson') && byId('kundeKontaktperson').value),
      kontonr: s(byId('kundeKontonr') && byId('kundeKontonr').value),
      kundenr: nr,
      firma_id: cx.firmaId || null
    };
    if(!payload.navn){ msg('Kundenavn må fylles ut.'); return; }
    var res = id ? await c.from('hand_kunde').update(payload).eq('id', id).select() : await c.from('hand_kunde').insert([payload]).select();
    if(res.error && /column|kolonne|does not exist/i.test(String(res.error.message || ''))){
      delete payload.kundenr; payload.kunde_nr = nr;
      res = id ? await c.from('hand_kunde').update(payload).eq('id', id).select() : await c.from('hand_kunde').insert([payload]).select();
    }
    if(res.error){ msg('Feil ved lagring av kunde: ' + res.error.message); return; }
    ['kundeId','kundeNavn','kundeAdresse','kundeEpost','kundeKontaktperson','kundeKontonr','kundeNr','kundeNrVis'].forEach(function(id){ var el=byId(id); if(el) el.value=''; });
    await lastKunderV34();
    msg(id ? 'Kunde endret.' : 'Kunde lagret med kundenr ' + nr + '.');
  }

  function redigerKundeV34(id){
    var k = (window.kunder || []).find(function(x){ return s(x.id) === s(id); });
    if(!k) return;
    [['kundeId',k.id],['kundeNavn',k.navn],['kundeAdresse',k.adresse],['kundeEpost',k.epost || k.email],['kundeKontaktperson',k.kontaktperson],['kundeKontonr',k.kontonr],['kundeNr',kundenr(k)],['kundeNrVis',kundenr(k)]].forEach(function(p){ var el=byId(p[0]); if(el) el.value=s(p[1]); });
    msg('Redigerer kunde: ' + s(k.navn));
  }

  function installV34(){
    window.handResolveCustomerTenantContext = resolveContextV34;
    window.lastKunder = lastKunderV34;
    window.handLastKunderForFirma = lastKunderV34;
    window.lagreKunde = lagreKundeV34;
    window.redigerKunde = redigerKundeV34;
    window.finnKundeFraValg = finnKunde;
    window.hentKundeNr = kundenr;
    window.visKundeNavn = fyllKundenrFeltV34;
  }

  document.addEventListener('change', function(e){ if(e.target && e.target.id === 'kundeValg') setTimeout(fyllKundenrFeltV34, 0); }, true);
  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('#leggTilKundeKnapp')){
      e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); lagreKundeV34(); return false;
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ installV34(); setTimeout(lastKunderV34, 800); });
  window.addEventListener('load', function(){ installV34(); setTimeout(lastKunderV34, 900); setTimeout(fyllKundenrFeltV34, 1300); });
  setTimeout(installV34, 50);
  setTimeout(function(){ installV34(); lastKunderV34(); }, 1800);
})();
