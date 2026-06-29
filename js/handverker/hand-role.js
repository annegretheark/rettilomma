/* HAND ROLE - single source of truth
   - sysadm is global system admin from Supabase Auth metadata: user.user_metadata.rolle
   - admin remains ordinary company admin.
   - Do not hardcode e-mail addresses.
*/
(function(){
  'use strict';
  function norm(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function isSys(r){ r = norm(r); return r === 'sysadm' || r === 'sysadmin' || r === 'systemadmin'; }
  function isAdmin(r){ r = norm(r); return r === 'admin' || isSys(r); }
  window.handNormRole = norm;
  window.handIsSysadmRole = isSys;
  window.handIsAdminRole = isAdmin;

  async function authRole(){
    try{
      if(!window.supabaseClient || !window.supabaseClient.auth) return '';
      const res = await window.supabaseClient.auth.getUser();
      const user = res && res.data && res.data.user;
      const meta = (user && (user.user_metadata || user.raw_user_meta_data)) || {};
      return norm(meta.rolle || meta.role || meta.user_role || '');
    }catch(e){ return ''; }
  }

  async function resolveRole(ansattData){
    const metaRole = await authRole();
    const dbRole = norm(ansattData && ansattData.rolle);
    const oldRole = norm(window.innloggetRolle || localStorage.getItem('handInnloggetRolle'));
    const role = isSys(metaRole) ? 'sysadm' : (dbRole || oldRole || 'bruker');
    window.innloggetRolle = role;
    localStorage.setItem('handInnloggetRolle', role);
    window.erSystemadmin = isSys(role);
    window.erAdmin = isAdmin(role);
    if(window.erAdmin) localStorage.setItem('rilAdminModus','ja');
    if(window.erSystemadmin) localStorage.setItem('rilSysadminRettighet','ja');
    else localStorage.removeItem('rilSysadminRettighet');
    document.documentElement.classList.add('ril-auth-ready');
    document.documentElement.classList.toggle('ril-admin-ready', !!window.erAdmin);
    document.documentElement.classList.toggle('ril-sysadm-ready', !!window.erSystemadmin);
    return role;
  }
  window.handGetAuthMetadataRole = authRole;
  window.handResolveRole = resolveRole;
  window.handApplyRole = function(role){
    role = isSys(role) ? 'sysadm' : norm(role || 'bruker');
    window.innloggetRolle = role;
    localStorage.setItem('handInnloggetRolle', role);
    window.erSystemadmin = isSys(role);
    window.erAdmin = isAdmin(role);
    if(window.erAdmin) localStorage.setItem('rilAdminModus','ja');
    document.documentElement.classList.toggle('ril-admin-ready', !!window.erAdmin);
    document.documentElement.classList.toggle('ril-sysadm-ready', !!window.erSystemadmin);
    return role;
  };
})();
