/* Rett i Lomma - greknuts sysadm-lås 20260706
   Siste sikkerhetsnett: greknuts@online.no skal aldri nedgraderes til bruker/admin.
*/
(function(){
  'use strict';
  if (window.__HAND_GREKNUTS_SYSADM_LOCK__) return;
  window.__HAND_GREKNUTS_SYSADM_LOCK__ = true;
  var SYS_EMAIL = 'greknuts@online.no';
  function n(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function getStoredEmail(){
    try { return n(localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('rettilommaSistEpost') || localStorage.getItem('epost')); }
    catch(e){ return ''; }
  }
  async function getAuthEmail(){
    try { var r = await window.supabaseClient?.auth?.getUser?.(); var e = n(r?.data?.user?.email); if(e) return e; } catch(e){}
    try { var s = await window.supabaseClient?.auth?.getSession?.(); var e2 = n(s?.data?.session?.user?.email); if(e2) return e2; } catch(e){}
    return n(window.innloggetEpost || window.handInnloggetEpost || getStoredEmail());
  }
  function lock(email){
    email = n(email || window.innloggetEpost || window.handInnloggetEpost || getStoredEmail());
    if (email !== SYS_EMAIL) return false;
    try {
      window.innloggetEpost = SYS_EMAIL;
      window.handInnloggetEpost = SYS_EMAIL;
      window.innloggetRolle = 'sysadm';
      window.handInnloggetRolle = 'sysadm';
      window.HAND_ROLE = 'sysadm';
      window.erAdmin = true;
      window.erSystemadmin = true;
      window.handErGlobalSysadm = true;
      localStorage.setItem('handInnloggetEpost', SYS_EMAIL);
      localStorage.setItem('innloggetEpost', SYS_EMAIL);
      localStorage.setItem('rettilommaSistEpost', SYS_EMAIL);
      localStorage.setItem('handInnloggetRolle', 'sysadm');
      localStorage.setItem('innloggetRolle', 'sysadm');
      localStorage.setItem('rilAdminModus', 'ja');
      localStorage.setItem('rilSysadminModus', 'ja');
    } catch(e) {}
    document.documentElement.classList.add('ril-auth-ready','ril-admin-ready','ril-sysadm-ready','hand-is-sysadm');
    if (document.body) {
      document.body.classList.add('ril-er-admin','ril-er-sysadm');
      document.body.classList.remove('ril-vanlig-bruker');
    }
    var rv = document.getElementById('innloggetRolleVisning');
    if (rv) rv.textContent = ' (rolle: sysadm, sysadm, adminmodus)';
    var bv = document.getElementById('innloggetBrukerVisning');
    if (bv) bv.textContent = SYS_EMAIL;
    return true;
  }
  async function refresh(){ var e = await getAuthEmail(); return lock(e); }
  window.handLockGreknutsSysadm = lock;
  window.handRefreshGreknutsSysadm = refresh;
  var oldApply = window.handApplyAuthoritativeAuth;
  if (typeof oldApply === 'function') {
    window.handApplyAuthoritativeAuth = async function(){
      var ctx = await oldApply.apply(this, arguments);
      var e = n(ctx && (ctx.email || ctx.epost || ctx.auth_email) || await getAuthEmail());
      if (e === SYS_EMAIL) {
        lock(SYS_EMAIL);
        ctx = Object.assign({}, ctx || {}, { email:SYS_EMAIL, epost:SYS_EMAIL, rolle:'sysadm', admin:true, sysadm:true });
      }
      return ctx;
    };
  }
  document.addEventListener('DOMContentLoaded', function(){ refresh(); setTimeout(refresh,250); setTimeout(refresh,1000); });
  document.addEventListener('handPartialerLastet', function(){ refresh(); setTimeout(refresh,200); });
  window.addEventListener('load', function(){ refresh(); setTimeout(refresh,500); setTimeout(refresh,1500); });
  setInterval(function(){ refresh(); }, 2000);
})();
