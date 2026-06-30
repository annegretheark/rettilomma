/* RIL HARD FIX: fyll Kundenr automatisk ved kundevalg */
(function(){
  'use strict';
  function s(v){ return String(v == null ? '' : v).trim(); }
  function el(id){ return document.getElementById(id); }
  function findCustomer(value){
    value = s(value);
    var lists = [window.kunder, window.handAdminKunder, window.lastKunderListe, window.handKunder];
    for (var a=0; a<lists.length; a++){
      var list = lists[a];
      if (!Array.isArray(list)) continue;
      for (var i=0; i<list.length; i++){
        var k = list[i] || {};
        if (s(k.id) === value || s(k.kunde_id) === value || s(k.kundenr) === value || s(k.kunde_nr) === value || s(k.nr) === value) return k;
      }
    }
    return null;
  }
  function nrFromText(text){
    text = s(text);
    var m = text.match(/^\s*([0-9A-Za-zÆØÅæøå._-]+)\s*[-–—:]\s*/);
    return m ? s(m[1]) : '';
  }
  function selectedOption(select){
    if (!select) return null;
    if (select.selectedOptions && select.selectedOptions.length) return select.selectedOptions[0];
    return select.options && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
  }
  function update(){
    var select = el('kundeValg');
    var field = el('kundeNrVisning');
    if (!select || !field) return;
    var opt = selectedOption(select);
    var kunde = findCustomer(select.value);
    var nr = '';
    if (kunde) nr = s(kunde.kundenr || kunde.kunde_nr || kunde.kundeNr || kunde.nr || kunde.id);
    if (!nr && opt && opt.dataset) nr = s(opt.dataset.kundenr || opt.dataset.kundeNr || opt.dataset.nr || opt.dataset.kundeNrVisning);
    if (!nr && opt) nr = nrFromText(opt.textContent || opt.innerText || '');
    field.value = nr;
    field.setAttribute('value', nr);
  }
  function decorate(){
    var select = el('kundeValg');
    if (!select) return;
    for (var i=0; i<select.options.length; i++){
      var opt = select.options[i];
      if (!opt || !opt.value) continue;
      var kunde = findCustomer(opt.value);
      var nr = kunde ? s(kunde.kundenr || kunde.kunde_nr || kunde.kundeNr || kunde.nr || kunde.id) : nrFromText(opt.textContent || '');
      if (nr) opt.dataset.kundenr = nr;
    }
  }
  function run(){ decorate(); update(); }
  window.rilKundeNrHardfix = run;
  document.addEventListener('change', function(e){ if (e.target && e.target.id === 'kundeValg') run(); }, true);
  document.addEventListener('input', function(e){ if (e.target && e.target.id === 'kundeValg') run(); }, true);
  document.addEventListener('click', function(e){ if (e.target && (e.target.id === 'kundeValg' || e.target.id === 'kundeNrVisning')) setTimeout(run, 0); }, true);
  document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('load', run);
  setInterval(run, 300);
})();
