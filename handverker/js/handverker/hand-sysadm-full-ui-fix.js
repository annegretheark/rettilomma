/* Rett i Lomma - SysAdm full panel fix
   Sikrer at SysAdm ikke bare viser backup/restore, men også bedrift/modul-admin.
*/
(function(){
  'use strict';
  if (window.__HAND_SYSADM_FULL_UI_FIX_V1) return;
  window.__HAND_SYSADM_FULL_UI_FIX_V1 = true;

  function $(id){ return document.getElementById(id); }
  function show(el, display){
    if(!el) return;
    el.hidden = false;
    el.classList.remove('skjult','hidden','modul-skjult');
    el.style.display = display || '';
    el.style.visibility = 'visible';
    el.removeAttribute('aria-hidden');
  }
  function isSysadm(){
    var e = String(window.innloggetEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || '').toLowerCase();
    var r = String(window.innloggetRolle || window.HAND_ROLE || localStorage.getItem('handInnloggetRolle') || localStorage.getItem('innloggetRolle') || '').toLowerCase();
    return r === 'sysadm' || r === 'sysadmin' || r === 'systemadmin' || window.erSystemadmin === true || window.handErGlobalSysadm === true;
  }
  function adminHtml(){
    return ''+
      '<div id="handSysadmAdminTools" class="kort" style="border:2px solid #0f766e; margin:14px 0; padding:14px;">'+
        '<h3>Bedriftadministrasjon</h3>'+
        '<p class="info">Opprett og rediger bedrifter, kundelink og moduler. Data hentes fra <b>hand_firma</b> og roller fra <b>hand_firma_bruker</b>.</p>'+
        '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">'+
          '<button id="sysadminNyKundeKnapp" type="button" style="background:#0f766e;">Ny bedrift</button>'+
          '<button id="sysadminKundelisteKnapp" type="button" class="secondary">Oppdater bedriftsliste</button>'+
        '</div>'+
        '<div id="handSystemadminBlokk" class="kort hand-systemadmin-form" style="border:1px solid #334155; margin-bottom:14px;">'+
          '<h3>Bedrift</h3>'+
          '<input id="redigerHandKundeId" type="hidden">'+
          '<label for="nyHandKundeNavn">Firmanavn</label><input id="nyHandKundeNavn" placeholder="F.eks. Hansen Bygg AS" class="hand-wide-input">'+
          '<label for="nyHandKundeEpost">E-post til bedrift/admin</label><input id="nyHandKundeEpost" type="email" placeholder="kunde@example.no" class="hand-wide-input">'+
          '<label for="nyHandKundeTelefon">Telefon</label><input id="nyHandKundeTelefon" placeholder="Telefon" class="hand-wide-input">'+
          '<label for="nyHandKundeAdresse">Adresse</label><input id="nyHandKundeAdresse" placeholder="Adresse" class="hand-wide-input">'+
          '<label for="nyHandKundeOrgNr">Org.nr</label><input id="nyHandKundeOrgNr" placeholder="Org.nr" class="hand-wide-input">'+
          '<section id="handFirmaModulerPanel" class="systemadmin-only" style="display:block; margin:14px 0; padding:14px; border:1px solid #334155; border-radius:10px; background:#0f172a;">'+
            '<h3 style="margin-top:0;">Moduler</h3>'+
            '<p class="info" style="margin-top:0;">Velg hvilke funksjoner denne bedriften skal ha tilgang til.</p>'+
            '<div id="handFirmaModulerListe" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:8px 18px; margin:10px 0 14px;">'+
              '<label><input type="checkbox" data-hand-firma-modul="timer"> Timer</label>'+
              '<label><input type="checkbox" data-hand-firma-modul="jobber"> Jobber</label>'+
              '<label><input type="checkbox" data-hand-firma-modul="tilbud"> Tilbud</label>'+
              '<label><input type="checkbox" data-hand-firma-modul="faktura"> Faktura</label>'+
              '<label><input type="checkbox" data-hand-firma-modul="kunder"> Kunder</label>'+
              '<label><input type="checkbox" data-hand-firma-modul="ansatte"> Ansatte</label>'+
              '<label><input type="checkbox" data-hand-firma-modul="varer"> Varer/lager</label>'+
              '<label><input type="checkbox" data-hand-firma-modul="biler"> Biler / bil-lager</label>'+
              '<label><input type="checkbox" data-hand-firma-modul="lonn"> Lønn</label>'+
              '<label><input type="checkbox" data-hand-firma-modul="fravaer"> Fravær / Flexi</label>'+
            '</div>'+
            '<button id="handFirmaLagreModulerKnapp" type="button" class="secondary">Lagre moduler</button>'+
            '<div id="handFirmaModulerStatus" class="melding">Velg eller rediger en bedrift først.</div>'+
          '</section>'+
          '<label for="nyHandKundeLinknavn">Linknavn opprettes automatisk fra firmanavn</label><input id="nyHandKundeLinknavn" placeholder="automatisk fra firmanavn" readonly class="hand-wide-input">'+
          '<label for="nyHandKundePassord">Midlertidig passord</label><input id="nyHandKundePassord" type="text" placeholder="Midlertidig passord / brukes ved Auth-epost" class="hand-wide-input">'+
          '<label for="nyHandKundeLink">Kundelink</label><input id="nyHandKundeLink" readonly class="hand-wide-input">'+
          '<button type="button" onclick="handOpprettKundeDirekte&&handOpprettKundeDirekte()">Opprett ny bedrift</button> '+
          '<button type="button" class="secondary" onclick="handLagreRedigertKunde&&handLagreRedigertKunde()">Lagre redigering</button> '+
          '<button type="button" class="secondary" onclick="handNullstillKundeSkjema&&handNullstillKundeSkjema()">Ny/tøm skjema</button> '+
          '<button type="button" class="secondary" onclick="handSendPassordopprettingDirekte&&handSendPassordopprettingDirekte()">Opprett og send invitasjon</button> '+
          '<button type="button" class="secondary" onclick="handKopierKundelinkDirekte&&handKopierKundelinkDirekte()">Kopier kundelink</button>'+
          '<div id="nyHandKundeMelding" class="melding"></div><hr><h3>Bedrifter</h3><div id="handKundeAdminListe" class="info">Ingen bedrifter lastet ennå.</div>'+
        '</div>'+
      '</div>';
  }
  function ensure(){
    var panel = $('sysadminPanelSide');
    if(!panel) return;
    if(!isSysadm()) return;
    show(panel);
    var backup = $('handSysadmBackupRestorePanel');
    var block = $('handSystemadminBlokk');
    if(!block){
      if(backup) backup.insertAdjacentHTML('beforebegin', adminHtml());
      else panel.insertAdjacentHTML('beforeend', adminHtml());
    } else {
      show(block);
      var tools = $('handSysadmAdminTools');
      if(!tools){
        var wrap = document.createElement('div');
        wrap.id = 'handSysadmAdminTools';
        wrap.className = 'kort';
        wrap.style.cssText = 'border:2px solid #0f766e; margin:14px 0; padding:14px;';
        wrap.innerHTML = '<h3>Bedriftadministrasjon</h3><p class="info">Opprett og rediger bedrifter, kundelink og moduler.</p><div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;"><button id="sysadminNyKundeKnapp" type="button" style="background:#0f766e;">Ny bedrift</button><button id="sysadminKundelisteKnapp" type="button" class="secondary">Oppdater bedriftsliste</button></div>';
        block.parentNode.insertBefore(wrap, block);
        wrap.appendChild(block);
      }
      if(backup && backup.parentNode === panel){ panel.appendChild(backup); }
    }
    ['sysadminNyKundeKnapp','sysadminKundelisteKnapp','handFirmaModulerPanel','handSystemadminBlokk'].forEach(function(id){ show($(id)); });
    var ny=$('sysadminNyKundeKnapp');
    if(ny && !ny.dataset.fullUiFix){
      ny.dataset.fullUiFix='1';
      ny.addEventListener('click', function(ev){ ev.preventDefault(); show($('handSystemadminBlokk')); $('nyHandKundeNavn') && $('nyHandKundeNavn').focus(); }, true);
    }
    var liste=$('sysadminKundelisteKnapp');
    if(liste && !liste.dataset.fullUiFix){
      liste.dataset.fullUiFix='1';
      liste.addEventListener('click', function(ev){ ev.preventDefault(); if(typeof window.handLastKundeliste === 'function') window.handLastKundeliste(); }, true);
    }
  }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(ensure,100); setTimeout(ensure,700); });
  document.addEventListener('handPartialerLastet', function(){ setTimeout(ensure,100); setTimeout(ensure,700); });
  window.addEventListener('load', function(){ setTimeout(ensure,100); setTimeout(ensure,1000); });
  window.handSikreFullSysadmPanel = ensure;
})();
