
/* Rett i Lomma - rolle-kjerne 7076
   Modell:
   - hand_firma_bruker = firmaeier/hovedkonto
   - hand_ansatt = ansatte og tildelte rettigheter
   - eier eller ansatt-admin gir administrasjon i appen
*/
(function(){
  'use strict';
  const SYS_ROLES = ['sysadm','sysadmin','systemadmin'];
  const ADMIN_ROLES = ['admin','administrator','eier','owner','firmaeier'].concat(SYS_ROLES);
  let lockedSysadm = false;
  let roleValue = '';
  let erAdminValue = false;
  let erSystemadminValue = false;

  function norm(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function raw(v){ return String(v == null ? '' : v).trim(); }
  function isSysRole(r){ return SYS_ROLES.includes(norm(r)); }
  async function isSysEmail(email){
    if(norm(email) === 'greknuts@online.no') return true;
    if(typeof window.handErGlobalSysadmFraTabell === 'function') return await window.handErGlobalSysadmFraTabell(email);
    return false;
  }
  function isAdminRole(r){ return ADMIN_ROLES.includes(norm(r)); }
  function isOwnerRole(r){ return ['eier','owner','firmaeier','firma-eier','hovedbruker','admin'].includes(norm(r)); }

  function rowFirmaId(row){ return raw(row && (row.firma_id || row.firmaId || row.company_id || row.kunde_id || row.kundeId)); }
  function rowRole(row){ return norm(row && (row.rolle || row.role || row.brukerrolle || row.type || row.tilgang)); }
  function rowIsAdmin(row){
    const r = rowRole(row);
    return isAdminRole(r) || !!(row && (row.admin === true || row.er_admin === true || row.is_admin === true || row.kan_admin === true || row.kan_administrere === true));
  }
  function rowIsOwner(row){
    const r = rowRole(row);
    return isOwnerRole(r) || !!(row && (row.eier === true || row.owner === true || row.er_eier === true || row.firmaeier === true));
  }

  function getStoredRole(){
    return norm(localStorage.getItem('handInnloggetRolle') || localStorage.getItem('innloggetRolle') || roleValue || window.HAND_ROLE);
  }

  function lagreFirmaId(id, source){
    id = raw(id);
    if(!id) return '';
    window.aktivFirmaId = id;
    window.handFirmaId = id;
    window.handAnsattFirmaId = id;
    try{
      localStorage.setItem('aktivFirmaId', id);
      localStorage.setItem('handFirmaId', id);
      localStorage.setItem('firmaId', id);
      localStorage.setItem('firma_id', id);
      localStorage.setItem('rilSikkerFirmaId', id);
      if(source) localStorage.setItem('handFirmaTilgangKilde', source);
    }catch(e){}
    return id;
  }

  function applyFlags(role, opts){
    opts = opts || {};
    role = norm(role || getStoredRole() || 'bruker');
    if(lockedSysadm && !isSysRole(role) && opts.force !== true) role = 'sysadm';
    if(isSysRole(role)) { role = 'sysadm'; lockedSysadm = true; }

    const sys = isSysRole(role) || lockedSysadm;
    const admin = sys || isAdminRole(role) || opts.admin === true;

    roleValue = sys ? 'sysadm' : role;
    erSystemadminValue = !!sys;
    erAdminValue = !!admin;

    try{
      localStorage.setItem('handInnloggetRolle', roleValue);
      localStorage.setItem('innloggetRolle', roleValue);
      localStorage.setItem('rilAdminModus', admin ? 'ja' : 'nei');
      if(sys) localStorage.setItem('rilSysadminModus', 'ja');
      else if(opts.clearSysMode === true) localStorage.removeItem('rilSysadminModus');
    }catch(e){}

    window.HAND_ROLE = roleValue;
    document.documentElement.classList.toggle('ril-admin-ready', admin);
    document.documentElement.classList.toggle('ril-sysadm-ready', sys);
    if(document.body){
      document.body.classList.toggle('ril-er-admin', admin);
      document.body.classList.toggle('ril-er-sysadm', sys);
      document.body.classList.toggle('ril-vanlig-bruker', !admin);
    }
    return { rolle: roleValue, sys, admin };
  }

  function installProtectedProps(){
    try{
      const current = norm(window.innloggetRolle || getStoredRole());
      if(isSysRole(current)) { lockedSysadm = true; roleValue = 'sysadm'; }
      else if(current) roleValue = current;
      Object.defineProperty(window, 'innloggetRolle', { configurable:true, get(){ return lockedSysadm ? 'sysadm' : roleValue; }, set(v){ v=norm(v); if(lockedSysadm && !isSysRole(v)){ roleValue='sysadm'; return; } if(isSysRole(v)){ lockedSysadm=true; roleValue='sysadm'; return; } roleValue=v; }});
      Object.defineProperty(window, 'handInnloggetRolle', { configurable:true, get(){ return window.innloggetRolle; }, set(v){ window.innloggetRolle=v; }});
      Object.defineProperty(window, 'erSystemadmin', { configurable:true, get(){ return lockedSysadm || erSystemadminValue === true; }, set(v){ if(lockedSysadm && v === false) return; erSystemadminValue = v === true; }});
      Object.defineProperty(window, 'erAdmin', { configurable:true, get(){ return lockedSysadm || erAdminValue === true; }, set(v){ if(lockedSysadm && v === false) return; erAdminValue = v === true; }});
    }catch(e){ console.warn('Rollebeskyttelse kunne ikke installeres:', e); }
  }

  function userMetaRole(user){
    if(!user) return '';
    return norm(user.user_metadata?.rolle || user.user_metadata?.role || user.app_metadata?.rolle || user.app_metadata?.role || user.raw_user_meta_data?.rolle || user.raw_user_meta_data?.role);
  }

  async function hentAuthUser(){
    try{ const r = await window.supabaseClient?.auth?.getUser(); if(r?.data?.user) return r.data.user; }catch(e){}
    try{ const r = await window.supabaseClient?.auth?.getSession(); if(r?.data?.session?.user) return r.data.session.user; }catch(e){}
    return null;
  }

  async function queryRows(table, col, val){
    if(!window.supabaseClient || !val) return [];
    try{
      let q = window.supabaseClient.from(table).select('*').limit(50);
      q = (String(col).toLowerCase().includes('epost') || String(col).toLowerCase().includes('email')) ? q.ilike(col, val) : q.eq(col, val);
      const r = await q;
      if(!r.error && Array.isArray(r.data)) return r.data;
    }catch(e){}
    return [];
  }

  async function finnFirmaTilgang(ansattData){
    const user = await hentAuthUser();
    const uid = raw(user && user.id);
    const email = norm((user && user.email) || window.innloggetEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('rettilommaSistEpost') || localStorage.getItem('innloggetEpost'));
    if(await isSysEmail(email)){ applyFlags('sysadm', {admin:true}); window.handFirmaTilgang = { firma_id:'', rolle:'sysadm', kilde:'hand_sysadm', rad:null }; return window.handFirmaTilgang; }
    const idForsok = [];
    if(uid) ['user_id','auth_id','auth_user_id','bruker_id','uid','owner_id','eier_id'].forEach(c => idForsok.push([c, uid]));
    if(email) ['epost','email','bruker_epost','user_email','auth_email','eier_epost','owner_email'].forEach(c => idForsok.push([c, email]));

    const firmaBruker = [];
    // 20260706: roller/firma leses kun fra public.hand_firma_bruker.
    for(const table of ['hand_firma_bruker']){
      for(const [c,v] of idForsok){
        for(const row of await queryRows(table, c, v)){
          row.__hand_table = table;
          firmaBruker.push(row);
        }
      }
    }
    const eierRad = firmaBruker.find(r => rowFirmaId(r) && rowIsOwner(r));
    if(eierRad){
      const firmaId = lagreFirmaId(rowFirmaId(eierRad), 'hand_firma_bruker:eier');
      window.handFirmaTilgang = { firma_id:firmaId, rolle:'eier', kilde:(eierRad.__hand_table || 'hand_firma_bruker'), rad:eierRad };
      return window.handFirmaTilgang;
    }
    const adminFirmaRad = firmaBruker.find(r => rowFirmaId(r) && rowIsAdmin(r));
    if(adminFirmaRad){
      const firmaId = lagreFirmaId(rowFirmaId(adminFirmaRad), 'hand_firma_bruker:admin');
      window.handFirmaTilgang = { firma_id:firmaId, rolle:'admin', kilde:(adminFirmaRad.__hand_table || 'hand_firma_bruker'), rad:adminFirmaRad };
      return window.handFirmaTilgang;
    }
    const bareFirmaRad = firmaBruker.find(r => rowFirmaId(r));
    if(bareFirmaRad){
      const firmaId = lagreFirmaId(rowFirmaId(bareFirmaRad), 'hand_firma_bruker');
      window.handFirmaTilgang = { firma_id:firmaId, rolle:rowRole(bareFirmaRad) || 'bruker', kilde:(bareFirmaRad.__hand_table || 'hand_firma_bruker'), rad:bareFirmaRad };
      return window.handFirmaTilgang;
    }

    if(email){
      for(const col of ['admin_epost','epost','email','kontakt_epost','eier_epost','owner_email']){
        const rows = await queryRows('hand_firma', col, email);
        const row = rows && rows[0];
        if(row){
          const firmaId = lagreFirmaId(rowFirmaId(row) || row.id, 'hand_firma:eier');
          window.handFirmaTilgang = { firma_id:firmaId, rolle:'eier', kilde:'hand_firma', rad:row };
          return window.handFirmaTilgang;
        }
      }
    }

    const ansatte = [];
    if(ansattData) ansatte.push(ansattData);
    for(const table of ['hand_ansatt']){
      for(const [c,v] of idForsok){
        for(const row of await queryRows(table, c, v)){
          row.__hand_table = table;
          ansatte.push(row);
        }
      }
    }
    const ansattAdmin = ansatte.find(r => rowFirmaId(r) && rowIsAdmin(r));
    if(ansattAdmin){
      const firmaId = lagreFirmaId(rowFirmaId(ansattAdmin), 'hand_ansatt:admin');
      window.handFirmaTilgang = { firma_id:firmaId, rolle:'admin', kilde:(ansattAdmin.__hand_table || 'hand_ansatt'), rad:ansattAdmin };
      return window.handFirmaTilgang;
    }
    const ansatt = ansatte.find(r => rowFirmaId(r));
    if(ansatt){
      const firmaId = lagreFirmaId(rowFirmaId(ansatt), 'hand_ansatt');
      window.handFirmaTilgang = { firma_id:firmaId, rolle:rowRole(ansatt) || 'ansatt', kilde:(ansatt.__hand_table || 'hand_ansatt'), rad:ansatt };
      return window.handFirmaTilgang;
    }

    window.handFirmaTilgang = null;
    return null;
  }

  async function hentAuthRolle(){ return userMetaRole(await hentAuthUser()); }
  function gjeldendeRolle(){ return norm(window.innloggetRolle || getStoredRole()); }
  function settRolle(rolle, opts){ return applyFlags(rolle, opts || {}); }

  async function bestemRolle(ansattData){
    // 20260706: autoritativ rolle/firma kommer kun fra public.hand_firma_bruker.
    // hand_ansatt skal ikke kunne nedgradere eller overskrive rolle.
    if (typeof window.handApplyAuthoritativeAuth === 'function') {
      try {
        const ctx = await window.handApplyAuthoritativeAuth();
        return applyFlags(ctx && ctx.rolle || 'bruker', { clearSysMode:true, admin: !!(ctx && ctx.admin) });
      } catch(e) { console.warn('Autoritativ rolleoppslag feilet:', e); }
    }
    const authRolle = await hentAuthRolle();
    if(isSysRole(authRolle)) return applyFlags(authRolle, { clearSysMode:true });
    const tilgang = await finnFirmaTilgang(ansattData);
    let valgt = (tilgang && tilgang.rolle) || authRolle || getStoredRole() || 'bruker';
    return applyFlags(valgt, { clearSysMode:true, admin: tilgang && isAdminRole(tilgang.rolle) });
  }

  function erSysadm(){ return lockedSysadm || isSysRole(gjeldendeRolle()); }
  function erAdmin(){ return erSysadm() || erAdminValue === true || isAdminRole(gjeldendeRolle()) || localStorage.getItem('rilAdminModus') === 'ja'; }

  installProtectedProps();
  if(isSysRole(getStoredRole())) applyFlags('sysadm', { force:true });
  setTimeout(function(){ hentAuthRolle().then(function(r){ if(isSysRole(r)) applyFlags('sysadm', { force:true }); }); }, 0);

  window.handNormRole = norm;
  window.handIsSysRole = isSysRole;
  window.handIsAdminRole = isAdminRole;
  window.handGetAuthUser = hentAuthUser;
  window.handGetAuthRole = hentAuthRolle;
  window.handSetRole = settRolle;
  window.handResolveRole = bestemRolle;
  window.handFinnFirmaTilgang = finnFirmaTilgang;
  window.handErSysadm = erSysadm;
  window.handErAdmin = erAdmin;
  window.handLockSysadmRole = function(){ lockedSysadm = true; return applyFlags('sysadm', { force:true }); };
})();
