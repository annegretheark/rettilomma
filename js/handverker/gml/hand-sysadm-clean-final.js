/* FINAL SYSADM CLEANUP - no hardcoded email
   Uses Auth metadata user_metadata.rolle = sysadm.
   Prevents old scripts from downgrading sysadm to admin and hides duplicate Sysadm buttons.
*/
(function(){
  'use strict';
  const OK = ['sysadm','sysadmin','systemadmin'];
  const norm = v => String(v == null ? '' : v).trim().toLowerCase();
  const isSys = r => OK.includes(norm(r));

  async function getAuthUser(){
    try {
      if (!window.supabaseClient || !window.supabaseClient.auth) return null;
      const r = await window.supabaseClient.auth.getUser();
      return r && r.data && r.data.user ? r.data.user : null;
    } catch(e){ return null; }
  }

  function applySysadm(role){
    if (!isSys(role)) return false;
    window.innloggetRolle = 'sysadm';
    window.erAdmin = true;
    window.erSystemadmin = true;
    localStorage.setItem('handInnloggetRolle','sysadm');
    localStorage.setItem('rilAdminModus','ja');
    // Ikke tvangsåpne panel hver gang, men behold sysadm-tilgang.
    document.documentElement.classList.add('ril-admin-ready','ril-systemadmin-ready');
    return true;
  }

  function cleanupButtons(){
    const buttons = Array.from(document.querySelectorAll('button'));
    const sysButtons = buttons.filter(b => /^sysadm/i.test((b.textContent||'').trim()));
    const keep = document.getElementById('sysadminModeKnapp') || sysButtons[0];
    sysButtons.forEach(b => {
      if (b !== keep) b.style.display = 'none';
    });
    if (keep) {
      keep.style.display = '';
      keep.classList.remove('skjult');
      keep.textContent = 'Sysadm';
    }
  }

  async function run(){
    const user = await getAuthUser();
    const metaRole = norm(user && user.user_metadata && user.user_metadata.rolle);
    const storedRole = norm(localStorage.getItem('handInnloggetRolle') || window.innloggetRolle);
    if (applySysadm(metaRole || storedRole)) cleanupButtons();
  }

  const oldSetTimeout = window.setTimeout;
  function schedule(){ [0,100,300,800,1500,3000].forEach(ms => oldSetTimeout(run, ms)); }
  document.addEventListener('DOMContentLoaded', schedule);
  document.addEventListener('handPartialerLastet', schedule);
  window.addEventListener('load', schedule);
  schedule();
})();
