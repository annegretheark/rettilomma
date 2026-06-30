/* Handverker v33 - kundenr for timer og kunder
   - Gir nye kunder kundenr automatisk ved lagring.
   - Backfiller gamle kunder uten kundenr i egen bedrift hvis admin har UPDATE-rettighet.
   - Fyller Kundenr-feltet i timeregistrering ved kundevalg.
*/
(function(){
  'use strict';
  if(window.__handKundenrV33Fix) return;
  window.__handKundenrV33Fix = true;

  function s(v){ return String(v == null ? '' : v).trim(); }
  function n(v){ return s(v).toLowerCase(); }
  function byId(id){ return document.getElementById(id); }
  function c(){ return window.supabaseClient || (window.supabase && window.supabase.from ? window.supabase : null); }
  function msg(t){ var el = byId('kundeMelding') || byId('timerMelding') || byId('melding'); if(el && t) el.textContent = t; }
  function isSys(r){ r=n(r); return r === 'sysadm' || r === 'sysadmin' || r === 'systemadmin'; }
  function isAdmin(r){ r=n(r); return isSys(r) || r === 'admin' || r === 'administrator' || r === 'bedrift_admin'; }
  function kundenr(k){ return s(k && (k.kundenr || k.kunde_nr || k.kundenummer || k.nr)); }
  function numOnly(v){ var m=s(v).match(/\d+/g); return m ? m.join('') : ''; }

  async function ctx(){
    if(typeof window.handResolveCustomerTenantContext === 'function'){
      try{ return await window.handResolveCustomerTenantContext(); }catch(e){}
    }
    var role = n(window.innloggetRolle || localStorage.getItem('handInnloggetRolle') || localStorage.getItem('innloggetRolle'));
    return {
      role: role,
      isSysadmin: isSys(role),
      isAdmin: isAdmin(role) || window.erAdmin === true,
      firmaId: s(window.aktivFirmaId || window.handFirmaId || localStorage.getItem('handFirmaId') || localStorage.getItem('aktivFirmaId') || localStorage.getItem('firma_id'))
    };
  }

  function nesteKundenr(rows){
    var max = 1000;
    (rows || window.kunder || []).forEach(function(k){
      var nr = parseInt(numOnly(kundenr(k)), 10);
      if(Number.isFinite(nr) && nr > max) max = nr;
    });
    return String(max + 1);
  }

  function finnKundeFraValgLokal(verdi){
    var v = s(verdi);
    var rows = window.kunder || [];
    var hit = rows.find(function(k){
      return s(k.id) === v || s(k.kunde_id) === v || s(kundenr(k)) === v || n(k.navn) === n(v);
    });
    if(hit) return hit;
    var sel = byId('kundeValg');
    if(sel && sel.options && sel.selectedIndex >= 0){
      var opt = sel.options[sel.selectedIndex];
      var txt = s(opt && opt.textContent);
      hit = rows.find(function(k){ return txt.indexOf(s(k.navn || '___')) >= 0; });
      if(hit) return hit;
    }
    return null;
  }

  function fyllKundenrFelt(){
    var sel = byId('kundeValg');
    var felt = byId('kundeNrVisning');
    if(!sel || !felt) return;
    var opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
    var nr = s(opt && opt.dataset && (opt.dataset.kundenr || opt.dataset.kundeNr || opt.dataset.kunde_nr));
    var kunde = finnKundeFraValgLokal(sel.value);
    if(!nr && kunde) nr = kundenr(kunde);
    if(!nr && kunde && kunde.id) nr = s(kunde.id); // sikker fallback slik at feltet aldri blir blankt
    felt.value = nr;
  }

  function fyllSelecter(rows){
    rows = rows || window.kunder || [];
    ['kundeValg','fakturaKundeValg','modulKundeVelger','okonomiKundeValg'].forEach(function(id){
      var sel = byId(id); if(!sel) return;
      var old = sel.value || '';
      sel.innerHTML = '';
      var first = document.createElement('option');
      first.value = '';
      first.textContent = rows.length ? (id === 'okonomiKundeValg' ? 'Velg kunde' : 'Velg kunde') : 'Ingen kunder funnet';
      sel.appendChild(first);
      rows.forEach(function(k){
        var opt = document.createElement('option');
        var nr = kundenr(k) || s(k.id);
        opt.value = s(k.id || k.kunde_id || nr);
        opt.dataset.kundenr = nr;
        opt.dataset.firmaId = s(k.firma_id);
        opt.textContent = nr ? (nr + ' - ' + s(k.navn || 'Kunde')) : s(k.navn || 'Kunde');
        sel.appendChild(opt);
      });
      if(old && Array.from(sel.options).some(function(o){ return o.value === old; })) sel.value = old;
    });
    fyllKundenrFelt();
  }

  async function backfillKundenr(rows){
    var client = c();
    if(!client || !Array.isArray(rows) || !rows.length) return rows || [];
    var cx = await ctx();
    if(!cx.isAdmin && !cx.isSysadmin) return rows;
    var next = parseInt(nesteKundenr(rows), 10);
    var changed = false;
    for(var i=0;i<rows.length;i++){
      var k = rows[i];
      if(kundenr(k)) continue;
      var nr = String(next++);
      k.kundenr = nr;
      changed = true;
      try{
        var r = await client.from('hand_kunde').update({ kundenr: nr }).eq('id', k.id).select('id,kundenr').limit(1);
        if(r && r.error && /column|kolonne|does not exist/i.test(String(r.error.message || ''))){
          await client.from('hand_kunde').update({ kunde_nr: nr }).eq('id', k.id).select('id,kunde_nr').limit(1);
        }
      }catch(e){ console.warn('Kundenr backfill feilet for kunde', k.id, e); }
    }
    if(changed) console.log('Kundenr lagt på kunder uten kundenr.');
    return rows;
  }

  async function lastKunderMedKundenr(){
    var old = window.__handKundenrV33OriginalLastKunder;
    var rows = [];
    if(typeof old === 'function'){
      try{ rows = await old(); }catch(e){ console.warn('Original lastKunder feilet:', e); }
    }
    rows = Array.isArray(rows) ? rows : (window.kunder || []);
    rows = await backfillKundenr(rows);
    window.kunder = rows;
    fyllSelecter(rows);
    return rows;
  }

  async function lagreKundeMedKundenr(){
    var client = c(); if(!client){ msg('Supabase er ikke lastet.'); return; }
    var cx = await ctx();
    if(!cx.isAdmin && !cx.isSysadmin){ msg('Du mangler adminrettighet for å lagre kunde.'); return; }
    if(!cx.firmaId && !cx.isSysadmin){ msg('Fant ikke firma_id for kunde.'); return; }
    var id = s(byId('kundeId') && byId('kundeId').value);
    var rows = window.kunder || [];
    var nr = s(byId('kundeNr') && byId('kundeNr').value) || s(byId('kundeNrVis') && byId('kundeNrVis').value);
    if(!id && (!nr || nr === '(lages automatisk)')) nr = nesteKundenr(rows);
    if(id && (!nr || nr === '(lages automatisk)')){
      var old = rows.find(function(k){ return s(k.id) === id; });
      nr = kundenr(old) || nesteKundenr(rows);
    }
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
    var res = id ? await client.from('hand_kunde').update(payload).eq('id', id).select() : await client.from('hand_kunde').insert([payload]).select();
    if(res.error && /column|kolonne|does not exist/i.test(String(res.error.message || ''))){
      delete payload.kundenr; payload.kunde_nr = nr;
      res = id ? await client.from('hand_kunde').update(payload).eq('id', id).select() : await client.from('hand_kunde').insert([payload]).select();
    }
    if(res.error){ msg('Feil ved lagring av kunde: ' + res.error.message); return; }
    ['kundeId','kundeNavn','kundeAdresse','kundeEpost','kundeKontaktperson','kundeKontonr'].forEach(function(x){ var el=byId(x); if(el) el.value=''; });
    if(byId('kundeNrVis')) byId('kundeNrVis').value='(lages automatisk)';
    await lastKunderMedKundenr();
    msg(id ? 'Kunde endret.' : 'Kunde lagret med kundenr ' + nr + '.');
  }

  function install(){
    if(typeof window.lastKunder === 'function' && !window.__handKundenrV33OriginalLastKunder){
      window.__handKundenrV33OriginalLastKunder = window.lastKunder;
    }
    window.lastKunder = lastKunderMedKundenr;
    window.handLastKunderForFirma = lastKunderMedKundenr;
    window.lagreKunde = lagreKundeMedKundenr;
    window.visKundeNavn = fyllKundenrFelt;
    window.finnKundeFraValg = finnKundeFraValgLokal;
    window.hentKundeNr = kundenr;
    fyllSelecter(window.kunder || []);
  }

  document.addEventListener('change', function(e){ if(e.target && e.target.id === 'kundeValg') setTimeout(fyllKundenrFelt, 0); }, true);
  document.addEventListener('input', function(e){ if(e.target && e.target.id === 'kundeValg') setTimeout(fyllKundenrFelt, 0); }, true);
  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('#leggTilKundeKnapp')){
      e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      lagreKundeMedKundenr(); return false;
    }
    if(e.target && e.target.id === 'kundeValg') setTimeout(fyllKundenrFelt, 50);
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ install(); setTimeout(lastKunderMedKundenr, 600); });
  window.addEventListener('load', function(){ install(); setTimeout(lastKunderMedKundenr, 700); setTimeout(fyllKundenrFelt, 1200); });
  setTimeout(install, 100);
  setTimeout(function(){ install(); lastKunderMedKundenr(); }, 1500);
})();
