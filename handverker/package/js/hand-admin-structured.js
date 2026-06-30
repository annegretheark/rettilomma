/* RIL 2026-06-23: Strukturert admin-konsoll.
   Deler admin i grupper og rydder dupliserte hurtigknapper i toppmenyen.
   Ingen hardkodet e-post. Tilgang styres av eksisterende rolle/adminmodus. */
(function(){
  'use strict';
  if(window.__rilAdminStructured) return;
  window.__rilAdminStructured = true;

  function injectCss(){
    if(document.getElementById('rilAdminStructuredCss')) return;
    var css = document.createElement('style');
    css.id = 'rilAdminStructuredCss';
    css.textContent = `
      .ril-admin-konsoll{max-width:980px;margin:18px auto;padding:22px;text-align:left;}
      .ril-admin-konsoll h2{text-align:center;margin-top:0;margin-bottom:10px;}
      .ril-admin-konsoll .info{text-align:center;margin:0 0 18px 0;color:#d1d5db;}
      .ril-admin-section-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin-top:18px;}
      .ril-admin-section-card{border:1px solid #2d3748;border-radius:14px;background:#111827;padding:16px;box-shadow:0 1px 0 rgba(255,255,255,.04) inset;}
      .ril-admin-section-card-muted{background:#121212;border-color:#3a3a3a;}
      .ril-admin-section-card h3{margin:0 0 6px 0;font-size:18px;color:#fff;}
      .ril-admin-section-card p{margin:0 0 14px 0;color:#cbd5e1;min-height:38px;line-height:1.35;}
      .ril-admin-actions{display:grid;grid-template-columns:1fr;gap:8px;}
      .ril-admin-actions button{width:100%;min-height:42px;font-weight:700;text-align:left;padding-left:14px;}
      #handTopbarKort .topplinje{gap:8px;align-items:center;}
      #handTopbarKort #visKundeKnapp,
      #handTopbarKort #visTilbudKnapp,
      #handTopbarKort #visFakturaKnapp,
      #handTopbarKort #visBilBestillingerKnapp,
      #handTopbarKort #visLonnKnapp{display:none!important;}
      #handTopbarKort #visAdminKonsollKnapp{font-weight:800;}
    `;
    document.head.appendChild(css);
  }

  function moveAdminIntoDropdown(){
    var panel = document.querySelector('.meny-gruppe.admin-only .meny-panel');
    if(!panel) return;
    [
      ['visKundeKnapp','Kunder'],
      ['visTilbudKnapp','Tilbud'],
      ['visFakturaKnapp','Faktura'],
      ['visBilBestillingerKnapp','Bestillinger'],
      ['visLonnKnapp','Lønn']
    ].forEach(function(pair){
      var b = document.getElementById(pair[0]);
      if(!b) return;
      var cloneId = pair[0] + 'Meny';
      if(document.getElementById(cloneId)) return;
      var c = document.createElement('button');
      c.id = cloneId;
      c.type = 'button';
      c.textContent = pair[1];
      c.addEventListener('click', function(ev){ ev.preventDefault(); b.click(); return false; });
      panel.insertBefore(c, panel.firstChild);
    });
  }

  function init(){ injectCss(); moveAdminIntoDropdown(); }
  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('handPartialerLastet', init);
  window.addEventListener('load', init);
})();
