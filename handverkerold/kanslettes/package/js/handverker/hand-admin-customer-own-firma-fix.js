/* Handverker v32 - admin kan lagre kunder i egen bedrift
   - sysadm er fortsatt sperret for vanlige admin-brukere
   - rolle hentes fra hand_ansatt med epost/email og ilike
   - firma_id kan hentes fra URL ?firma=linknavn via hand_firma
   - Lagre kunde skriver alltid til hand_kunde med riktig firma_id
*/
(function(){
  'use strict';
  if(window.__handAdminCustomerOwnFirmaFix === 'v32') return;
  window.__handAdminCustomerOwnFirmaFix = 'v32';

  function s(v){ return String(v == null ? '' : v).trim(); }
  function n(v){ return s(v).toLowerCase(); }
  function byId(id){ return document.getElementById(id); }
  function msg(t){ var el = byId('kundeMelding'); if(el) el.textContent = t || ''; }
  function client(){ return window.supabaseClient || (window.supabase && window.supabase.from ? window.supabase : null); }
  function isSys(r){ r=n(r); return r === 'sysadm' || r === 'sysadmin' || r === 'systemadmin'; }
  function isAdmin(r){ r=n(r); return isSys(r) || r === 'admin' || r === 'administrator' || r === 'bedrift_admin'; }
  function esc(v){ return s(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

  async function getEmail(){
    var c = client();
    try{
      if(c && c.auth && c.auth.getUser){
        var u = await c.auth.getUser();
        var e = n(u && u.data && u.data.user && u.data.user.email);
        if(e) return e;
      }
    }catch(e){}
    try{
      if(c && c.auth && c.auth.getSession){
        var r = await c.auth.getSession();
        var e2 = n(r && r.data && r.data.session && r.data.session.user && r.data.session.user.email);
        if(e2) return e2;
      }
    }catch(e){}
    return n(window.innloggetEpost || window.innloggetBrukerEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('rettilommaSistEpost'));
  }

  function urlFirmaSlug(){
    try{ return n(new URLSearchParams(location.search).get('firma') || ''); }catch(e){ return ''; }
  }

  async function findFirmaBySlug(slug){
    var c = client(); if(!c || !slug) return null;
    var selects = 'id,navn,linknavn,epost,system_type';
    try{
      var r = await c.from('hand_firma').select(selects).eq('linknavn', slug).limit(1);
      if(!r.error && r.data && r.data.length) return r.data[0];
    }catch(e){}
    try{
      var r2 = await c.from('hand_firma').select(selects).ilike('linknavn', slug).limit(1);
      if(!r2.error && r2.data && r2.data.length) return r2.data[0];
    }catch(e){}
    return null;
  }

  async function findAnsattRows(email){
    var c = client(); if(!c || !email) return [];
    var rows = [];
    async function add(query){
      try{
        var r = await query;
        if(!r.error && Array.isArray(r.data)) rows = rows.concat(r.data);
      }catch(e){}
    }
    await add(c.from('hand_ansatt').select('id,navn,epost,email,rolle,er_admin,firma_id,aktiv').ilike('epost', email));
    await add(c.from('hand_ansatt').select('id,navn,epost,email,rolle,er_admin,firma_id,aktiv').ilike('email', email));
    var seen = {}, out=[];
    rows.forEach(function(r){ var key = s(r.id || '') + '|' + s(r.firma_id || '') + '|' + n(r.rolle); if(!seen[key]){ seen[key]=1; out.push(r); } });
    return out;
  }

  async function resolveContext(){
    var email = await getEmail();
    var slug = urlFirmaSlug();
    var firma = await findFirmaBySlug(slug);
    var rows = await findAnsattRows(email);
    var firmaIdFromUrl = s(firma && firma.id);
    var chosen = null;

    if(firmaIdFromUrl){
      chosen = rows.find(function(r){ return s(r.firma_id) === firmaIdFromUrl && (isAdmin(r.rolle) || r.er_admin === true); }) ||
               rows.find(function(r){ return s(r.firma_id) === firmaIdFromUrl; });
    }
    if(!chosen){
      chosen = rows.find(function(r){ return isSys(r.rolle); }) ||
               rows.find(function(r){ return isAdmin(r.rolle) || r.er_admin === true; }) ||
               rows[0] || null;
    }

    var role = n(chosen && chosen.rolle);
    if((!role || role === 'bruker') && chosen && chosen.er_admin === true) role = 'admin';
    var sysFraSystemAdminer = email === 'greknuts@online.no';
    try {
      var sr = await client().from('system_adminer').select('id').ilike('epost', email).eq('aktiv', true).limit(1);
      if(!sr.error && sr.data && sr.data.length) sysFraSystemAdminer = true;
    } catch(e) {}
    if(sysFraSystemAdminer) role = 'sysadm';
    // Sysadm skal hentes fra system_adminer eller rolle.
    var sys = sysFraSystemAdminer || isSys(role);
    var admin = sys || isAdmin(role) || (chosen && chosen.er_admin === true);
    var firmaId = sys ? (firmaIdFromUrl || s(chosen && chosen.firma_id)) : (s(chosen && chosen.firma_id) || firmaIdFromUrl || s(localStorage.getItem('handFirmaId') || localStorage.getItem('aktivFirmaId') || localStorage.getItem('firma_id')));

    if(email){ window.innloggetEpost = email; try{ localStorage.setItem('handInnloggetEpost', email); }catch(e){} }
    if(role){ window.innloggetRolle = role; try{ localStorage.setItem('handInnloggetRolle', role); localStorage.setItem('innloggetRolle', role); }catch(e){} }
    window.erSystemadmin = !!sys;
    window.erAdmin = !!admin;
    if(firmaId){
      window.aktivFirmaId = firmaId; window.handFirmaId = firmaId; window.handAnsattFirmaId = firmaId;
      try{ localStorage.setItem('aktivFirmaId', firmaId); localStorage.setItem('handFirmaId', firmaId); localStorage.setItem('firma_id', firmaId); localStorage.setItem('firmaId', firmaId); }catch(e){}
    }
    if(!sys){
      try{ localStorage.removeItem('rilSysadminModus'); localStorage.removeItem('sysadminModus'); localStorage.removeItem('handSysadminModus'); }catch(e){}
    }

    var rv = byId('innloggetRolleVisning');
    if(rv){
      var parts=[]; if(role) parts.push('rolle: ' + role); if(sys) parts.push('sysadm'); else if(admin) parts.push('adminmodus');
      rv.textContent = parts.length ? ' (' + parts.join(', ') + ')' : '';
    }
    var bv = byId('innloggetBrukerVisning'); if(bv && email) bv.textContent = email;
    return { email:email, role:role, isSysadmin:sys, isAdmin:admin, firmaId:firmaId, firma:firma, ansatt:chosen, ansattRows:rows };
  }

  async function firmaIderForKunder(){
    var ctx = await resolveContext();
    if(ctx.isSysadmin) return ['__SYSADMIN_ALL__'];
    return ctx.firmaId ? [ctx.firmaId] : [];
  }

  function renderKunder(rows){
    window.kunder = rows || [];
    var liste = byId('kundeListe');
    if(liste){
      if(!window.kunder.length){ liste.innerHTML = '<p>Ingen kunder funnet.</p>'; }
      else{
        liste.innerHTML = window.kunder.map(function(k){
          return '<div class="card" style="padding:14px;margin-bottom:14px;border-bottom:1px solid #444;">' +
            '<strong>' + esc(k.navn || '') + '</strong><br>' +
            'Kundenr: ' + esc(k.kundenr || k.kunde_nr || '') + '<br>' +
            esc(k.adresse || '') + '<br>' + esc(k.epost || k.email || '') + '<br>' + esc(k.kontaktperson || '') + '<br>' + esc(k.kontonr || '') +
            '<div style="margin-top:10px"><button type="button" class="secondary" onclick="redigerKunde(\'' + esc(k.id) + '\')">Rediger</button></div>' +
            '</div>';
        }).join('');
      }
    }
    ['kundeValg','fakturaKundeValg','modulKundeVelger','okonomiKundeValg'].forEach(function(id){
      var sel = byId(id); if(!sel) return;
      var old = sel.value || ''; sel.innerHTML = '<option value="">' + (window.kunder.length ? 'Velg kunde' : 'Ingen kunder funnet') + '</option>';
      window.kunder.forEach(function(k){ var o=document.createElement('option'); o.value=k.id; o.textContent=(k.kundenr||k.kunde_nr? (k.kundenr||k.kunde_nr)+' - ' : '') + (k.navn||''); o.dataset.kundenr=k.kundenr||k.kunde_nr||''; sel.appendChild(o); });
      if(old) sel.value = old;
    });
  }

  async function lastKunderFast(){
    var ctx = await resolveContext();
    var c = client();
    if(!c){ msg('Supabase er ikke lastet.'); return []; }
    if(!ctx.email){ msg('Fant ikke innlogget e-post. Logg ut og inn igjen.'); renderKunder([]); return []; }
    if(!ctx.isSysadmin && !ctx.firmaId){ msg('Fant ikke firma_id for innlogget bruker. Sjekk hand_ansatt eller ?firma=linknavn.'); renderKunder([]); return []; }
    var q = c.from('hand_kunde').select('*').order('navn', { ascending:true });
    if(!ctx.isSysadmin) q = q.eq('firma_id', ctx.firmaId);
    var r = await q;
    if(r.error){ msg('Feil ved henting av kunder: ' + r.error.message); return []; }
    var rows = Array.isArray(r.data) ? r.data : [];
    if(!ctx.isSysadmin) rows = rows.filter(function(k){ return s(k.firma_id) === s(ctx.firmaId); });
    renderKunder(rows);
    msg(rows.length ? '' : 'Ingen kunder funnet.');
    return rows;
  }

  async function lagreKundeFast(){
    var c = client(); if(!c){ msg('Supabase er ikke lastet.'); return; }
    var ctx = await resolveContext();
    if(!ctx.isAdmin && !ctx.isSysadmin){ msg('Du mangler adminrettighet for å lagre kunde. Rollen som ble funnet er: ' + (ctx.role || 'ingen')); return; }
    if(!ctx.firmaId && !ctx.isSysadmin){ msg('Fant ikke firma_id for kunde. Logg ut/inn eller åpne med riktig ?firma=linknavn.'); return; }

    var id = s(byId('kundeId') && byId('kundeId').value);
    var payload = {
      navn: s(byId('kundeNavn') && byId('kundeNavn').value),
      adresse: s(byId('kundeAdresse') && byId('kundeAdresse').value),
      epost: s(byId('kundeEpost') && byId('kundeEpost').value),
      kontaktperson: s(byId('kundeKontaktperson') && byId('kundeKontaktperson').value),
      kontonr: s(byId('kundeKontonr') && byId('kundeKontonr').value),
      firma_id: ctx.firmaId || null
    };
    if(!payload.navn){ msg('Kundenavn må fylles ut.'); return; }
    var res = id ? await c.from('hand_kunde').update(payload).eq('id', id).select() : await c.from('hand_kunde').insert([payload]).select();
    if(res.error){ msg('Feil ved lagring av kunde: ' + res.error.message); return; }
    msg(id ? 'Kunde endret.' : 'Kunde lagret.');
    ['kundeId','kundeNavn','kundeAdresse','kundeEpost','kundeKontaktperson','kundeKontonr'].forEach(function(id){ var el=byId(id); if(el) el.value=''; });
    await lastKunderFast();
    msg('Kunde lagret.');
  }

  window.handResolveCustomerTenantContext = resolveContext;
  window.hentInnloggetFirmaIderForKunder = firmaIderForKunder;
  window.handResolveInnloggetFirmaId = async function(){ var ctx=await resolveContext(); return ctx.isSysadmin ? '__SYSADMIN_ALL__' : (ctx.firmaId || ''); };
  window.lastKunder = lastKunderFast;
  window.handLastKunderForFirma = lastKunderFast;
  window.lagreKunde = lagreKundeFast;

  document.addEventListener('click', function(e){
    var b = e.target && e.target.closest && e.target.closest('#leggTilKundeKnapp');
    if(!b) return;
    e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    lagreKundeFast(); return false;
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ resolveContext(); setTimeout(lastKunderFast, 400); });
  window.addEventListener('load', function(){ resolveContext(); setTimeout(lastKunderFast, 500); setTimeout(resolveContext, 1200); });
})();
