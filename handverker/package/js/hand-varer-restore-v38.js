/* Rett i Lomma - v38: gjenopprett varer/lager layout og innlasting.
   Skal ikke endre roller eller sysadm. Kun varer/lager/import. */
(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }
  function msg(t,err){
    var m=$('vareMelding')||$('varerMelding');
    if(!m){ var side=$('varerSide')||document.body; m=document.createElement('div'); m.id='vareMelding'; m.className='melding'; side.insertBefore(m, side.firstChild); }
    m.textContent=t||''; m.style.color=err?'#fca5a5':'#86efac';
    if(err) console.error(t); else if(t) console.log(t);
  }
  function addStyle(){
    if($('varerRestoreStyle38')) return;
    var s=document.createElement('style'); s.id='varerRestoreStyle38';
    s.textContent = `
      #varerSide{max-width:1060px !important;width:100% !important;margin-left:auto !important;margin-right:auto !important;}
      #varerSide label{display:block !important;}
      #varerSide input:not([type=file]), #varerSide textarea, #varerSide select{width:100% !important;max-width:100% !important;box-sizing:border-box !important;}
      #varerSide textarea{min-height:76px !important;}
      #varerSide .rad{display:grid !important;grid-template-columns:repeat(3,minmax(0,1fr)) !important;gap:8px !important;align-items:end !important;}
      #varerSide .rad > div{min-width:0 !important;width:100% !important;}
      #varerSide #importVarerFil{width:260px !important;max-width:100% !important;}
      #vareListe{width:100% !important;overflow-x:auto !important;}
      @media(max-width:800px){#varerSide .rad{grid-template-columns:1fr !important;} #varerSide #importVarerFil{width:100% !important;}}
    `;
    document.head.appendChild(s);
  }
  function normalizeVarer(rows){
    return (rows||[]).sort(function(a,b){ return String(a.navn||a.varenavn||a.varenr||'').localeCompare(String(b.navn||b.varenavn||b.varenr||''),'no'); });
  }
  async function safeLastVarer(){
    if(!window.supabaseClient){ msg('Supabase er ikke lastet.', true); return []; }
    var liste=$('vareListe'); if(liste) liste.innerHTML='<p class="info">Laster varer...</p>';
    var q=window.supabaseClient.from('hand_vare').select('*').limit(3000);
    var res=await q;
    if(res.error){
      msg('Kunne ikke hente varer: '+res.error.message, true);
      if(liste) liste.innerHTML='<p class="melding">Kunne ikke hente varer: '+String(res.error.message||'').replace(/[<>&]/g,'')+'</p>';
      return [];
    }
    var rows=normalizeVarer(res.data||[]);
    window.varer=rows;
    if(typeof window.tegnVarer==='function'){
      try{ window.tegnVarer(); }catch(e){ console.warn('Original tegnVarer feilet:',e); }
    }
    if(liste && !liste.innerHTML.trim() && !rows.length) liste.innerHTML='<p class="info">Ingen varer registrert.</p>';
    if(rows.length) msg('Lastet '+rows.length+' varer.'); else msg('Ingen varer registrert.');
    return rows;
  }
  function bind(){
    addStyle();
    var b=$('importVarerKnapp');
    if(b && b.dataset.restore38!=='1'){
      b.dataset.restore38='1';
      b.addEventListener('click', function(){
        setTimeout(function(){ if(typeof window.lastVarer==='function') window.lastVarer(); }, 800);
      });
    }
    var l=$('lastInnLasLagerKnapp');
    if(l && l.dataset.restore38!=='1'){
      l.dataset.restore38='1';
      l.onclick=function(e){
        e.preventDefault();
        msg('Bruk Velg fil + Importer varer for å laste inn låsesmedvarer. Knappen er beholdt for gammel layout, men ingen fast varefil ligger i pakken.', false);
        var f=$('importVarerFil'); if(f) f.click();
      };
    }
  }
  var oldVis=window.visVarerSide;
  window.visVarerSide=async function(){
    addStyle();
    if(typeof oldVis==='function'){
      try{ await oldVis.apply(this, arguments); }catch(e){ console.warn('Original visVarerSide feilet:',e); }
    }
    bind();
    if(typeof window.lastVarer==='function'){
      try{ await window.lastVarer(); }catch(e){ console.warn('lastVarer feilet:',e); await safeLastVarer(); }
    } else {
      await safeLastVarer();
    }
  };
  window.lastInnLasesmedLager = window.lastInnLasesmedLager || function(){
    bind();
    msg('Velg Excel/CSV-fil med låsesmedvarer. Deretter trykker du Importer varer.', false);
    var f=$('importVarerFil'); if(f) f.click();
  };
  document.addEventListener('DOMContentLoaded', bind);
  window.addEventListener('load', function(){ bind(); setTimeout(bind,300); setTimeout(bind,1000); });
})();
