/* HAND SYSADM AUTHORITY - final role guard
   Source of truth for global sysadm: Supabase Auth user_metadata.rolle = sysadm/sysadmin/systemadmin.
   Keeps ordinary admin intact, but prevents later scripts from downgrading sysadm to admin/bruker.
*/
(function () {
  'use strict';
  if (window.__HAND_SYSADM_AUTHORITY_INSTALLED) return;
  window.__HAND_SYSADM_AUTHORITY_INSTALLED = true;

  const SYS_ROLES = new Set(['sysadm', 'sysadmin', 'systemadmin']);
  const norm = v => String(v == null ? '' : v).trim().toLowerCase();
  const isSys = v => SYS_ROLES.has(norm(v));

  let confirmedSysadm = false;
  let realLocalStorageSetItem = null;

  function safeSetStorage(k, v) {
    try {
      if (realLocalStorageSetItem) realLocalStorageSetItem.call(localStorage, k, v);
      else localStorage.setItem(k, v);
    } catch (_) {}
  }

  function lockProp(name, getterValue) {
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get: function () { return getterValue; },
        set: function (v) {
          // Once Auth says sysadm, old scripts may try to set false/admin.
          // Ignore downgrades. Sysadm remains admin-capable too.
          if (confirmedSysadm) return;
        }
      });
    } catch (_) {}
  }

  function patchLocalStorage() {
    if (realLocalStorageSetItem || !window.localStorage) return;
    try {
      realLocalStorageSetItem = localStorage.setItem;
      localStorage.setItem = function (key, value) {
        if (confirmedSysadm) {
          const k = String(key || '');
          const v = String(value == null ? '' : value);
          if (k === 'handInnloggetRolle' && !isSys(v)) return realLocalStorageSetItem.call(this, k, 'sysadm');
          if (k === 'rilSysadminRettighet' && v !== 'ja') return realLocalStorageSetItem.call(this, k, 'ja');
          if (k === 'rilAdminModus' && v !== 'ja') return realLocalStorageSetItem.call(this, k, 'ja');
        }
        return realLocalStorageSetItem.call(this, key, value);
      };
    } catch (_) {}
  }

  function applySysadm() {
    confirmedSysadm = true;
    window.__HAND_AUTH_SYSADM = true;

    safeSetStorage('handInnloggetRolle', 'sysadm');
    safeSetStorage('rilSysadminRettighet', 'ja');
    safeSetStorage('rilAdminModus', 'ja');

    lockProp('erSystemadmin', true);
    lockProp('erAdmin', true);
    lockProp('innloggetRolle', 'sysadm');

    document.documentElement.classList.add('ril-auth-ready', 'ril-admin-ready', 'ril-sysadm-ready');

    try {
      const b = document.getElementById('innloggetBruker');
      if (b && b.textContent && !/sysadm/i.test(b.textContent)) b.textContent = b.textContent + ' (sysadm)';
    } catch (_) {}

    try {
      document.querySelectorAll('.admin-only').forEach(el => {
        el.classList.remove('skjult', 'hidden', 'modul-skjult');
        el.style.display = '';
      });
      document.querySelectorAll('.sysadmin-entry, .systemadmin-only').forEach(el => {
        el.classList.remove('skjult', 'hidden', 'modul-skjult');
        el.style.display = '';
      });
    } catch (_) {}
  }

  async function getAuthUser() {
    try {
      if (window.supabaseClient?.auth?.getUser) {
        const r = await window.supabaseClient.auth.getUser();
        if (r?.data?.user) return r.data.user;
      }
    } catch (_) {}
    try {
      if (window.supabaseClient?.auth?.getSession) {
        const r = await window.supabaseClient.auth.getSession();
        if (r?.data?.session?.user) return r.data.session.user;
      }
    } catch (_) {}
    return null;
  }

  async function checkAuthRole() {
    const user = await getAuthUser();
    const meta = user?.user_metadata || user?.raw_user_meta_data || {};
    const role = norm(meta.rolle || meta.role || meta.user_role || '');
    if (isSys(role)) applySysadm();
    return role;
  }

  window.handCheckSysadmAuthority = checkAuthRole;
  window.handIsAuthSysadm = function () { return confirmedSysadm === true; };

  patchLocalStorage();

  // Run early and also after older delayed scripts have finished.
  checkAuthRole();
  document.addEventListener('DOMContentLoaded', checkAuthRole);
  window.addEventListener('load', checkAuthRole);
  [100, 300, 700, 1200, 2500, 5000, 9000].forEach(ms => setTimeout(checkAuthRole, ms));
})();
