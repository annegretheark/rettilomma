/* Rett i Lomma - autoritativ auth/rolle 20260706
   Kilde for firma/rolle er KUN public.hand_firma_bruker.
   hand_ansatt brukes bare som ansattprofil, ikke som rolle-kilde.
*/
(function(){
  'use strict';
  if (window.__handAuthAuthorityLoaded) return;
  window.__handAuthAuthorityLoaded = true;

  var TABLE = 'hand_firma_bruker';
  var SYS_ROLES = ['sysadm','sysadmin','systemadmin'];
  var ADMIN_ROLES = ['sysadm','sysadmin','systemadmin','admin','administrator','eier','owner','firmaeier'];

  function s(v){ return String(v == null ? '' : v).trim(); }
  function n(v){ return s(v).toLowerCase(); }
  function isSysRole(v){ return SYS_ROLES.indexOf(n(v)) >= 0; }
  function isAdminRole(v){ return ADMIN_ROLES.indexOf(n(v)) >= 0; }
  function client(){ return window.supabaseClient || window.supabase || null; }

  async function getAuthUser(){
    var c = client();
    if(!c || !c.auth) return null;
    try { var u = await c.auth.getUser(); if(u && u.data && u.data.user) return u.data.user; } catch(e){}
    try { var r = await c.auth.getSession(); if(r && r.data && r.data.session && r.data.session.user) return r.data.session.user; } catch(e){}
    return null;
  }

  async function maybeSingleSafe(q){
    try { var r = await q.maybeSingle(); if(r && !r.error && r.data) return r.data; } catch(e){}
    try { var r2 = await q.limit(1); if(r2 && !r2.error && r2.data && r2.data[0]) return r2.data[0]; } catch(e){}
    return null;
  }

  async function getFirmaBruker(userArg){
    var c = client();
    var user = userArg || await getAuthUser();
    var uid = s(user && user.id);
    var email = n((user && user.email) || window.innloggetEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('rettilommaSistEpost'));
    if(!c) return null;

    var row = null;
    if(uid){
      row = await maybeSingleSafe(c.from(TABLE).select('*').eq('user_id', uid));
      if(row && email && n(row.epost) && n(row.epost) !== email) row = null;
    }
    if(!row && email){
      row = await maybeSingleSafe(c.from(TABLE).select('*').ilike('epost', email));
    }
    if(row){ row.__hand_table = TABLE; return row; }
    return null;
  }

  function storeContext(ctx){
    ctx = ctx || {};
    var authEmail = n(ctx.auth_email || window.innloggetEpost || localStorage.getItem('handInnloggetEpost'));
    var email = n(authEmail || ctx.epost || ctx.email || window.innloggetEpost || localStorage.getItem('handInnloggetEpost'));
    var rolle = n(ctx.rolle || 'bruker');
    var firmaId = s(ctx.firma_id || '');
    var userId = s(ctx.user_id || ctx.auth_user_id || window.innloggetUserId || '');
    var sys = false; // SysAdm avgjøres kun av egen SysAdm-tabell via hand-sysadm-greknuts-lock.js
    if(isSysRole(rolle)) rolle = 'admin';
    var admin = sys || isAdminRole(rolle);

    window.innloggetEpost = email;
    window.handInnloggetEpost = email;
    window.innloggetUserId = userId;
    window.authUserId = userId;
    window.innloggetRolle = sys ? 'sysadm' : rolle;
    window.handInnloggetRolle = window.innloggetRolle;
    window.HAND_ROLE = window.innloggetRolle;
    window.erSystemadmin = !!sys;
    window.handErGlobalSysadm = !!sys;
    window.erAdmin = !!admin;
    window.aktivFirmaId = firmaId || window.aktivFirmaId || '';
    window.handFirmaId = window.aktivFirmaId;
    window.handFirmaTilgang = {
      firma_id: window.aktivFirmaId || '',
      rolle: window.innloggetRolle,
      kilde: TABLE,
      rad: ctx.rad || ctx
    };

    try {
      if(email){
        localStorage.setItem('handInnloggetEpost', email);
        localStorage.setItem('innloggetEpost', email);
        localStorage.setItem('rettilommaSistEpost', email);
      }
      if(userId){
        localStorage.setItem('innloggetUserId', userId);
        localStorage.setItem('authUserId', userId);
      }
      if(window.aktivFirmaId){
        localStorage.setItem('aktivFirmaId', window.aktivFirmaId);
        localStorage.setItem('handFirmaId', window.aktivFirmaId);
        localStorage.setItem('firmaId', window.aktivFirmaId);
        localStorage.setItem('firma_id', window.aktivFirmaId);
      }
      localStorage.setItem('handInnloggetRolle', window.innloggetRolle);
      localStorage.setItem('innloggetRolle', window.innloggetRolle);
      localStorage.setItem('rilAdminModus', admin ? 'ja' : 'nei');
      if(sys) localStorage.setItem('rilSysadminModus','ja');
      else localStorage.removeItem('rilSysadminModus');
      localStorage.setItem('handFirmaTilgangKilde', TABLE);
    } catch(e){}

    document.documentElement.classList.add('ril-auth-ready','ril-role-ready');
    document.documentElement.classList.toggle('ril-admin-ready', !!admin);
    document.documentElement.classList.toggle('ril-sysadm-ready', !!sys);
    document.documentElement.classList.toggle('hand-is-sysadm', !!sys);
    if(document.body){
      document.body.classList.toggle('ril-er-admin', !!admin);
      document.body.classList.toggle('ril-er-sysadm', !!sys);
      document.body.classList.toggle('ril-vanlig-bruker', !admin);
    }
    return { email:email, user_id:userId, firma_id:window.aktivFirmaId || '', rolle:window.innloggetRolle, admin:admin, sysadm:sys, rad:ctx.rad || ctx };
  }

  async function applyAuthoritativeAuth(){
    var user = await getAuthUser();
    var email = n((user && user.email) || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('rettilommaSistEpost'));
    var row = await getFirmaBruker(user);
    if(!row){
      return storeContext({ epost: email, user_id: user && user.id, rolle: 'bruker', firma_id: '' });
    }
    return storeContext({
      epost: row.epost || email,
      auth_email: email,
      user_id: row.user_id || (user && user.id),
      firma_id: row.firma_id || '',
      rolle: row.rolle || 'bruker',
      rad: row
    });
  }

  async function signOutHard(event){
    if(event && event.preventDefault) event.preventDefault();
    if(event && event.stopPropagation) event.stopPropagation();
    try { var c = client(); if(c && c.auth) await Promise.race([c.auth.signOut(), new Promise(function(r){ setTimeout(r, 1200); })]); } catch(e){}
    try {
      var remove = [];
      for(var i=0;i<localStorage.length;i++) remove.push(localStorage.key(i));
      remove.forEach(function(k){
        if(!k) return;
        if(k.indexOf('sb-') === 0 || ['rettilommaValgtModul','rettilommaSistEpost','handInnloggetEpost','innloggetEpost','handInnloggetRolle','innloggetRolle','rilAdminModus','rilSysadminModus','aktivBilId','aktivBilNavn','aktivFirmaId','handFirmaId','firmaId','firma_id','innloggetUserId','authUserId'].indexOf(k) >= 0){
          localStorage.removeItem(k);
        }
      });
      sessionStorage.clear();
    } catch(e){}
    window.location.replace((window.location.pathname.toLowerCase().indexOf('/handverker') >= 0 ? '/handverker/' : './') + 'index.html?logout=1&t=' + Date.now());
    return false;
  }

  function ensureLogoutButton(){
    if(!document.body || document.getElementById('handFastLogoutBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'handFastLogoutBtn';
    btn.type = 'button';
    btn.textContent = 'Logg ut';
    btn.style.cssText = 'position:fixed;right:14px;top:14px;z-index:99999;border:1px solid rgba(255,255,255,.25);border-radius:999px;background:#1f2937;color:#fff;padding:10px 14px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,.25);';
    btn.onclick = signOutHard;
    document.body.appendChild(btn);
  }

  window.HAND_FIRMA_BRUKER_TABLE = TABLE;
  window.handGetAuthUser = window.handGetAuthUser || getAuthUser;
  window.handHentAutoritativFirmaBruker = getFirmaBruker;
  window.handApplyAuthoritativeAuth = applyAuthoritativeAuth;
  window.handAuthStoreContext = storeContext;
  window.handLoggUtSikkert = signOutHard;
  window.handEnsureLogoutButton = ensureLogoutButton;
  window.handErSysRoleAuthority = isSysRole;
  window.handErAdminRoleAuthority = isAdminRole;

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ applyAuthoritativeAuth().then(function(ctx){ if(ctx && ctx.email) ensureLogoutButton(); }).catch(function(){}); }, 400); });
  document.addEventListener('handPartialerLastet', function(){ setTimeout(ensureLogoutButton, 100); });
})();
