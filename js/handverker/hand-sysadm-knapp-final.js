// Håndverker - endelig Sysadm-knapp, rollebasert og uten hardkodet bruker
(function(){
  function norm(v){ return String(v || '').trim().toLowerCase(); }
  function rolleTekst(){
    var deler = [
      window.innloggetRolle,
      window.handInnloggetRolle,
      localStorage.getItem('handInnloggetRolle'),
      localStorage.getItem('rolle'),
      document.getElementById('innloggetRolleVisning')?.textContent,
      document.getElementById('innloggetBrukerBoks')?.textContent
    ];
    return norm(deler.filter(Boolean).join(' '));
  }
  function erSysadm(){
    var r = rolleTekst();
    return window.erSystemadmin === true || /(^|[^a-z])(sysadm|sysadmin|systemadmin)([^a-z]|$)/.test(r);
  }
  function settSynlig(el, synlig){
    if(!el) return;
    if(synlig){
      el.classList.remove('skjult','hidden','modul-skjult','systemadmin-only');
      el.style.removeProperty('display');
      el.removeAttribute('aria-hidden');
    } else {
      el.classList.add('skjult');
      el.style.display = 'none';
      el.setAttribute('aria-hidden','true');
    }
  }
  function lagKnapp(){
    var btn = document.getElementById('sysadminModeKnapp');
    if(btn) return btn;
    var topplinje = document.querySelector('.topplinje');
    if(!topplinje) return null;
    btn = document.createElement('button');
    btn.id = 'sysadminModeKnapp';
    btn.type = 'button';
    btn.className = 'sysadmin-entry';
    btn.textContent = 'Sysadm';
    btn.style.background = '#7c3aed';
    var adminMeny = document.getElementById('adminMenyKnapp')?.closest('.meny-gruppe');
    topplinje.insertBefore(btn, adminMeny || document.getElementById('loggUtKnapp') || null);
    return btn;
  }
  function visSysadmPanel(){
    window.erSystemadmin = true;
    window.erAdmin = true;
    localStorage.setItem('rilSysadminModus','ja');
    localStorage.setItem('rilAdminModus','ja');
    if(typeof window.skjulAlleSider === 'function') window.skjulAlleSider();
    var app = document.getElementById('appSide');
    var panel = document.getElementById('sysadminPanelSide');
    if(app){ app.classList.remove('skjult','hidden'); app.style.removeProperty('display'); }
    if(panel){ panel.classList.remove('skjult','hidden'); panel.style.removeProperty('display'); }
    if(typeof window.handLastKundeliste === 'function') setTimeout(window.handLastKundeliste, 100);
  }
  function oppdater(){
    var sys = erSysadm();
    if(sys) window.erSystemadmin = true;
    var btn = lagKnapp();
    settSynlig(btn, sys && localStorage.getItem('rilSysadminModus') !== 'ja');
    if(btn && btn.dataset.sysadmFinal !== '1'){
      btn.dataset.sysadmFinal = '1';
      btn.onclick = function(e){ e.preventDefault(); visSysadmPanel(); return false; };
    }
  }
  window.handOppdaterSysadmKnapp = oppdater;
  document.addEventListener('handPartialerLastet', oppdater);
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(oppdater,0); setTimeout(oppdater,300); setTimeout(oppdater,1000); });
  window.addEventListener('load', function(){ setTimeout(oppdater,0); setTimeout(oppdater,500); setTimeout(oppdater,1500); });
  document.addEventListener('click', function(e){
    if(e.target && e.target.closest && e.target.closest('#sysadminModeKnapp')){
      if(!erSysadm()) return;
      e.preventDefault(); e.stopPropagation(); visSysadmPanel();
    }
  }, true);
  setInterval(oppdater, 1000);
})();
