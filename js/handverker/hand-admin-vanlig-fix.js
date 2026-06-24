/* Håndverker - vanlig firma-admin fix
   Firma-admin skal administrere egne kunder/brukere, men IKKE få sysadmin/moduler.
*/
(function(){
  function norm(v){ return String(v || '').trim().toLowerCase(); }
  function erSysadmin(){
    var e = norm(window.innloggetEpost || localStorage.getItem('handInnloggetEpost'));
    var r = norm(window.innloggetRolle || localStorage.getItem('handInnloggetRolle'));
    return (typeof window.handErSysadm === 'function' && window.handErSysadm()) || window.erSystemadmin === true || r === 'sysadm' || r === 'sysadmin' || r === 'systemadmin';
  }
  function erAdmin(){
    var r = norm(window.innloggetRolle || localStorage.getItem('handInnloggetRolle'));
    return (typeof window.handErAdmin === 'function' && window.handErAdmin()) || window.erAdmin === true || localStorage.getItem('rilAdminModus') === 'ja' || r === 'admin' || erSysadmin();
  }
  function settSynlig(el, synlig){
    if(!el) return;
    if(synlig){ el.classList.remove('hidden','skjult','modul-skjult'); el.style.display = ''; el.removeAttribute('aria-hidden'); }
    else { el.classList.add('hidden','skjult'); el.style.display = 'none'; el.setAttribute('aria-hidden','true'); }
  }
  function oppdaterVanligAdmin(){
    var admin = erAdmin();
    var sys = erSysadmin();

    // Vanlig admin: egne brukere/kunder/firma/backup osv.
    document.querySelectorAll('.admin-only').forEach(function(el){ settSynlig(el, admin); });

    // Sysadmin-funksjoner skal aldri vises for vanlig firma-admin.
    document.querySelectorAll('.systemadmin-only, .sysadmin-entry, .systemadmin-only').forEach(function(el){ settSynlig(el, sys); });

    // Ekstra sikkerhet på konkrete knapper som har gitt feil popup.
    ['visModulerKnapp','sysadminModeKnapp','sysadminNyKundeKnapp','sysadminKundelisteKnapp'].forEach(function(id){
      settSynlig(document.getElementById(id), sys);
    });

    if(admin){
      window.erAdmin = true;
      localStorage.setItem('rilAdminModus','ja');
    }
    if(!sys){
      window.erSystemadmin = false;
      localStorage.removeItem('rilSysadminModus');
    } else {
      window.erSystemadmin = true;
      window.erAdmin = true;
      localStorage.setItem('rilSysadminModus','ja');
      localStorage.setItem('rilAdminModus','ja');
    }
  }

  // Overstyr systemadmin-knapper slik at vanlig admin ikke får feilmelding/popup.
  var gammelVisModuler = window.visModulerSide;
  window.visModulerSide = function(){
    if(!erSysadmin()) { oppdaterVanligAdmin(); return false; }
    return gammelVisModuler ? gammelVisModuler.apply(this, arguments) : undefined;
  };

  var gammelOppdater = window.oppdaterAdminVisning;
  window.oppdaterAdminVisning = function(){
    if(gammelOppdater) gammelOppdater.apply(this, arguments);
    oppdaterVanligAdmin();
  };

  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest && e.target.closest('#visModulerKnapp,#sysadminModeKnapp,#sysadminNyKundeKnapp,#sysadminKundelisteKnapp');
    if(t && !erSysadmin()){
      e.preventDefault();
      e.stopPropagation();
      oppdaterVanligAdmin();
      return false;
    }
  }, true);

  document.addEventListener('DOMContentLoaded', function(){ setTimeout(oppdaterVanligAdmin, 0); setTimeout(oppdaterVanligAdmin, 300); });
  window.addEventListener('load', function(){ setTimeout(oppdaterVanligAdmin, 0); setTimeout(oppdaterVanligAdmin, 700); });
  window.handOppdaterVanligAdmin = oppdaterVanligAdmin;
})();
