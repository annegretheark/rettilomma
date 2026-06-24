/* Rett i Lomma - ren rollefikser
   Sysadm hentes fra Supabase Auth metadata: user.user_metadata.rolle = "sysadm".
   Hvis Auth sier sysadm, skal ingen gammel tabellkode kunne nedgradere til admin/bruker.
*/
(function(){
  if (window.__handRoleClean20260624) return;
  window.__handRoleClean20260624 = true;

  function norm(v){ return String(v || '').trim().toLowerCase(); }
  function isSys(v){ v = norm(v); return v === 'sysadm' || v === 'sysadmin' || v === 'systemadmin'; }

  async function lesAuthRolle(){
    try {
      if (!window.supabaseClient || !window.supabaseClient.auth) return '';
      const r = await window.supabaseClient.auth.getUser();
      return norm(r && r.data && r.data.user && r.data.user.user_metadata && r.data.user.user_metadata.rolle);
    } catch(e) { return ''; }
  }

  function settKnappTekst(){
    const adminBtn = document.getElementById('adminMenyKnapp');
    if (adminBtn && isSys(window.innloggetRolle)) adminBtn.textContent = 'Sysadm ▼';
    const roleSpan = document.getElementById('innloggetRolleVisning');
    if (roleSpan && isSys(window.innloggetRolle)) roleSpan.textContent = ' (sysadm)';
  }

  function visSkjulSysadm(){
    const sys = isSys(window.innloggetRolle) || window.erSystemadmin === true;
    document.querySelectorAll('.systemadmin-only, .sysadmin-entry').forEach(function(el){
      const erSide = el.tagName === 'SECTION' || /Side$|Panel$/.test(el.id || '');
      if (sys && !erSide) { el.style.display = ''; el.classList.remove('skjult','hidden'); el.hidden = false; }
    });
    settKnappTekst();
  }

  async function enforce(){
    const authRolle = await lesAuthRolle();
    if (!isSys(authRolle)) { settKnappTekst(); return false; }

    window.innloggetRolle = 'sysadm';
    window.erSystemadmin = true;
    window.erAdmin = true;
    localStorage.setItem('handInnloggetRolle', 'sysadm');
    localStorage.setItem('rilAdminModus', 'ja');

    visSkjulSysadm();
    return true;
  }

  const gammelOppdater = window.oppdaterAdminVisning;
  window.oppdaterAdminVisning = function(){
    if (typeof gammelOppdater === 'function') {
      try { gammelOppdater.apply(this, arguments); } catch(e) { console.warn('oppdaterAdminVisning feilet:', e); }
    }
    enforce();
  };

  const gammelSett = window.settInnloggetBrukerVisning;
  window.settInnloggetBrukerVisning = function(){
    if (typeof gammelSett === 'function') {
      try { gammelSett.apply(this, arguments); } catch(e) {}
    }
    enforce();
  };

  document.addEventListener('DOMContentLoaded', function(){ enforce(); setTimeout(enforce,100); setTimeout(enforce,500); setTimeout(enforce,1500); });
  window.addEventListener('load', function(){ enforce(); setTimeout(enforce,300); setTimeout(enforce,1000); });
  document.addEventListener('click', function(){ setTimeout(enforce, 0); }, true);
  window.handEnforceSysadmRole = enforce;
})();
