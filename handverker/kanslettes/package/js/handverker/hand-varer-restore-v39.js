/* RIL 20260624 v39: varer/lager reparasjon
   - lastes etter hand-varer.js og hand-lager-patch.js
   - retter layout på varerSide
   - binder Lager/Varer-knapper direkte
   - sørger for at varelisten lastes når siden åpnes
*/
(function(){
  'use strict';
  if (window.__handVarerRestoreV39) return;
  window.__handVarerRestoreV39 = true;

  function $(id){ return document.getElementById(id); }
  function show(el){ if(!el) return; el.hidden=false; el.style.display=''; el.classList && el.classList.remove('skjult','hidden','modul-skjult'); el.removeAttribute && el.removeAttribute('aria-hidden'); }
  function hide(el){ if(!el) return; el.hidden=true; el.style.display='none'; el.classList && el.classList.add('skjult'); }

  function injectCss(){
    if ($('handVarerRestoreV39Css')) return;
    var st = document.createElement('style');
    st.id = 'handVarerRestoreV39Css';
    st.textContent = `
      #varerSide{max-width:1060px;width:100%;}
      #varerSide > input,
      #varerSide > textarea,
      #varerSide > select{width:100%;display:block;}
      #varerSide #varenr,
      #varerSide #varenavn,
      #varerSide #varebeskrivelse{width:100%;max-width:760px;}
      #varerSide .rad{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:8px;align-items:end;}
      #varerSide .rad > div{min-width:0;}
      #varerSide .rad input,
      #varerSide .rad select,
      #varerSide .rad textarea{width:100%;}
      #varerSide #importVarerFil{width:100%;max-width:420px;}
      #vareListe{margin-top:12px;max-height:none;overflow:visible;}
      #vareListe table{width:100%;}
      @media(max-width:800px){#varerSide .rad{grid-template-columns:1fr;} #varerSide #varenr,#varerSide #varenavn,#varerSide #varebeskrivelse{max-width:100%;}}
    `;
    document.head.appendChild(st);
  }

  function allPages(){
    return ['timerSide','jobberSide','fravaerSide','tilbudSide','backupSide','fakturaSide','varerSide','bilerSide','kundeSide','kunderSide','ansattSide','ansatteSide','firmaSide','testSide','testpanelSide','lonnPanel','lonnSide','bilBestillingerSide','adminBilBestillinger','adminBilBestillingerPanel','modulerSide','sysadminPanelSide','adminSide'];
  }
  function showOnlyVarer(){
    var app = $('appSide'); if(app){ show(app); }
    allPages().forEach(function(id){ var el=$(id); if(!el) return; id==='varerSide' ? show(el) : hide(el); });
    var side = $('varerSide'); if(side){ show(side); }
  }

  async function loadVarer(){
    injectCss();
    showOnlyVarer();
    var liste = $('vareListe');
    if(liste && !liste.textContent.trim()) liste.innerHTML = '<p class="info">Laster varer...</p>';
    var fns = ['lastVarer','handLastVarer','visVarer','lastVarelager'];
    for (var i=0;i<fns.length;i++){
      var fn = window[fns[i]];
      if (typeof fn === 'function') {
        try { await fn(); } catch(e){ console.warn('Varer v39 init feilet:', fns[i], e); }
      }
    }
    setTimeout(function(){ injectCss(); showOnlyVarer(); }, 80);
    setTimeout(function(){ injectCss(); showOnlyVarer(); }, 400);
    return false;
  }

  function bindButtons(){
    injectCss();
    ['visAdminVarerKnapp','visVarerKnapp','varerKnapp','adminVarerKnapp'].forEach(function(id){
      var b=$(id); if(!b || b.__varerV39Bound) return;
      b.__varerV39Bound = true;
      b.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation(); loadVarer(); return false; }, true);
    });
    var imp=$('importVarerKnapp');
    if(imp && !imp.__varerV39ImportBound){
      imp.__varerV39ImportBound=true;
      imp.addEventListener('click', function(){ if(typeof window.importerVarer==='function') window.importerVarer('importVarerFil'); }, false);
    }
  }

  var oldVis = window.visVarerSide;
  window.visVarerSide = async function(){ await loadVarer(); return false; };
  window.handOpenVarerSide = loadVarer;

  document.addEventListener('handPartialerLastet', function(){ bindButtons(); setTimeout(bindButtons,200); setTimeout(bindButtons,1000); });
  document.addEventListener('DOMContentLoaded', function(){ bindButtons(); setTimeout(bindButtons,300); });
  window.addEventListener('load', function(){ bindButtons(); injectCss(); setTimeout(bindButtons,800); });
})();
