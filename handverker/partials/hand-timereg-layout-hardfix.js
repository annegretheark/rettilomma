(function(){
  'use strict';

  var CSS_ID = 'hand-timereg-mobile-clean-20260630-1605';
  var css = `
/* Ryddig mobiltilpasset timeregistrering, samme uttrykk som ønsket forhåndsvisning */
html,body{margin:0!important;background:#07101c!important;overflow-x:hidden!important;max-width:100%!important;}
body{font-family:Inter,Arial,Helvetica,sans-serif!important;color:#f8fafc!important;}
#appSide{width:min(100%,980px)!important;max-width:980px!important;margin:0 auto!important;padding:12px 14px 34px!important;background:transparent!important;box-sizing:border-box!important;overflow:visible!important;}
#handTopbarKort.hand-hov-header{width:100%!important;max-width:100%!important;margin:0 0 14px!important;padding:22px 22px 16px!important;border:0!important;border-bottom:1px solid rgba(120,150,190,.22)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;box-sizing:border-box!important;}
.hand-hov-header-main{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;flex-wrap:wrap!important;}
.hand-hov-brand{display:flex!important;align-items:center!important;gap:16px!important;min-width:0!important;}
.hand-hov-logo{width:64px!important;height:64px!important;border-radius:12px!important;object-fit:contain!important;background:#fff!important;padding:4px!important;box-sizing:border-box!important;}
#handSideOverskrift{margin:0!important;font-size:36px!important;line-height:1.05!important;font-weight:900!important;letter-spacing:-.04em!important;color:#fff!important;text-align:left!important;text-transform:none!important;}
.hand-hov-subtitle{margin-top:6px!important;color:#e5e7eb!important;font-size:18px!important;font-weight:600!important;}
.hand-hov-actions{display:flex!important;gap:12px!important;align-items:center!important;flex-wrap:wrap!important;margin-left:auto!important;}
#innloggetBrukerBoks,#handOppdaterKnapp{display:none!important;}
.hand-hov-actions button,.hand-hov-actions a{height:64px!important;min-height:64px!important;border-radius:10px!important;padding:0 24px!important;font-size:20px!important;font-weight:800!important;text-decoration:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;}
.hand-help-btn{background:#173050!important;color:#fff!important;}
.hand-logout-btn{background:#dc1818!important;color:#fff!important;}
.hand-hov-nav{display:flex!important;gap:12px!important;align-items:center!important;flex-wrap:wrap!important;margin:22px 0 0!important;padding:18px 0 0!important;border-top:1px solid rgba(120,150,190,.20)!important;}
.hand-hov-nav button{height:52px!important;min-height:52px!important;border-radius:9px!important;padding:0 20px!important;font-size:18px!important;font-weight:800!important;margin:0!important;background:#0f6dde!important;color:#fff!important;border:0!important;}
#sysadminModeKnapp{background:#7c3aed!important;}
#timerSide,#timerSide.timer-compact,section#timerSide.timer-compact{width:100%!important;max-width:100%!important;margin:0 0 24px!important;padding:28px 30px!important;box-sizing:border-box!important;border:1px solid #334962!important;border-radius:18px!important;background:linear-gradient(135deg,#101d2d 0%,#0d1725 55%,#08111d 100%)!important;box-shadow:0 18px 42px rgba(0,0,0,.30)!important;overflow:hidden!important;}
#timerSide h2,#timerSide.timer-compact h2{text-align:left!important;margin:0 0 24px!important;font-size:34px!important;line-height:1.1!important;color:#fff!important;font-weight:900!important;letter-spacing:-.03em!important;}
#timerSide .rad,#timerSide.timer-compact .rad,#timerSide .timer-grid,#timerSide.timer-compact .timer-grid{display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr))!important;gap:18px 30px!important;align-items:end!important;margin:0 0 18px!important;width:100%!important;box-sizing:border-box!important;}
#timerSide .timer-layout-field,#timerSide .rad>div,#timerSide.timer-compact .timer-layout-field,#timerSide.timer-compact .rad>div{min-width:0!important;max-width:none!important;width:100%!important;box-sizing:border-box!important;}
#timerSide .timer-date,#timerSide .timer-customer,#timerSide .timer-customer-no,#timerSide .timer-project,#timerSide .timer-bil-inline,#timerSide .timer-vare,#timerSide .timer-fakturerbar{grid-column:1/-1!important;}
#timerSide .timer-start,#timerSide .timer-end,#timerSide .timer-price{grid-column:span 4!important;}
#timerSide .timer-antall,#timerSide .timer-varepris,#timerSide .timer-camera,#timerSide .timer-gallery,#timerSide .timer-bilag-camera,#timerSide .timer-bilag-gallery,#timerSide .timer-utgift-type,#timerSide .timer-utgift-belop{grid-column:span 6!important;}
#timerSide .timer-image-text,#timerSide .timer-description{grid-column:1/-1!important;}
#timerSide .timer-grid-utgift>.timer-utgift-km,#timerSide .timer-grid-utgift>.timer-utgift-kmpris{display:none!important;}
#timerSide label,#timerSide.timer-compact label{display:block!important;white-space:normal!important;margin:0 0 8px!important;font-size:20px!important;font-weight:850!important;color:#f1f5f9!important;line-height:1.15!important;}
#timerSide input,#timerSide select,#timerSide textarea,#timerSide.timer-compact input,#timerSide.timer-compact select,#timerSide.timer-compact textarea{display:block!important;width:100%!important;min-width:0!important;max-width:none!important;box-sizing:border-box!important;height:52px!important;min-height:52px!important;border-radius:8px!important;background:rgba(13,24,36,.86)!important;border:1px solid #405a75!important;color:#f8fafc!important;padding:0 16px!important;font-size:20px!important;line-height:1.2!important;box-shadow:none!important;text-align:left!important;}
#timerSide input[type=time],#timerSide.timer-compact input[type=time]{text-align:left!important;}
#timerSide textarea,#timerSide.timer-compact textarea{height:68px!important;min-height:68px!important;padding:14px 16px!important;resize:vertical!important;}
#timerSide input[type=file],#timerSide.timer-compact input[type=file]{height:52px!important;min-height:52px!important;padding:10px!important;font-size:17px!important;}
#timerSide .timer-bil-control,#timerSide.timer-compact .timer-bil-control{display:block!important;width:100%!important;}
#timerSide #aktivBilInfo,#timerSide.timer-compact #aktivBilInfo{display:inline-block!important;margin:10px 22px 0 0!important;color:#22e879!important;font-size:20px!important;font-weight:600!important;vertical-align:middle!important;}
#timerSide #byttBilKnapp,#timerSide.timer-compact #byttBilKnapp{display:inline-flex!important;width:auto!important;min-width:0!important;height:44px!important;min-height:44px!important;padding:0 18px!important;margin:10px 0 0!important;font-size:17px!important;border-radius:8px!important;background:#3a3d42!important;color:#fff!important;vertical-align:middle!important;}
#timerSide button,#timerSide.timer-compact button{border-radius:8px!important;font-weight:850!important;min-height:46px!important;padding:0 18px!important;font-size:17px!important;border:0!important;color:#fff!important;}
#timerSide #leggTilVarelinjeKnapp,#timerSide.timer-compact #leggTilVarelinjeKnapp{display:none!important;}
#timerSide #leggTilUtleggKnapp,#timerSide.timer-compact #leggTilUtleggKnapp{width:100%!important;height:52px!important;margin:0!important;background:#0f6dde!important;}
#timerSide #timerUtleggKnappRad{grid-column:span 6!important;align-self:end!important;margin:0!important;}
#timerSide #timerLayoutActionRow,#timerSide.timer-compact #timerLayoutActionRow{display:block!important;width:100%!important;margin:18px 0 18px!important;}
#timerSide #lagreTimerKnapp,#timerSide.timer-compact #lagreTimerKnapp{width:100%!important;height:58px!important;min-height:58px!important;margin:0!important;background:#10933e!important;font-size:20px!important;}
#timerSide #utleggListe,#timerSide.timer-compact #utleggListe{margin:0 0 14px!important;color:#d7dee9!important;}
#timerSide #bilSeksjon,#timerSide .bil-seksjon{border-top:1px solid rgba(120,150,190,.22)!important;margin-top:22px!important;padding-top:22px!important;}
@media(max-width:760px){
 #appSide{width:100vw!important;max-width:100vw!important;margin:0!important;padding:10px 12px 28px!important;}
 #handTopbarKort.hand-hov-header{padding:16px 8px 14px!important;margin-bottom:12px!important;}
 .hand-hov-header-main{align-items:flex-start!important;}
 .hand-hov-logo{width:58px!important;height:58px!important;}
 #handSideOverskrift{font-size:32px!important;}
 .hand-hov-subtitle{font-size:16px!important;}
 .hand-hov-actions{gap:10px!important;margin-left:0!important;}
 .hand-hov-actions button,.hand-hov-actions a{height:56px!important;min-height:56px!important;padding:0 18px!important;font-size:18px!important;}
 .hand-hov-nav{gap:10px!important;margin-top:18px!important;}
 .hand-hov-nav button{height:48px!important;min-height:48px!important;padding:0 16px!important;font-size:17px!important;}
 #timerSide,#timerSide.timer-compact,section#timerSide.timer-compact{padding:24px 28px!important;border-radius:16px!important;}
 #timerSide h2,#timerSide.timer-compact h2{font-size:32px!important;margin-bottom:24px!important;}
 #timerSide .rad,#timerSide.timer-compact .rad,#timerSide .timer-grid,#timerSide.timer-compact .timer-grid{gap:16px 28px!important;}
}
@media(max-width:540px){
 #appSide{padding:8px 8px 24px!important;}
 .hand-hov-brand{gap:12px!important;}
 .hand-hov-logo{width:48px!important;height:48px!important;}
 #handSideOverskrift{font-size:26px!important;}
 .hand-hov-actions{width:100%!important;justify-content:space-between!important;}
 .hand-hov-actions button,.hand-hov-actions a{height:48px!important;min-height:48px!important;font-size:16px!important;padding:0 14px!important;}
 .hand-hov-nav{gap:8px!important;}
 .hand-hov-nav button{height:42px!important;min-height:42px!important;padding:0 12px!important;font-size:15px!important;}
 #timerSide,#timerSide.timer-compact,section#timerSide.timer-compact{padding:20px 18px!important;}
 #timerSide h2,#timerSide.timer-compact h2{font-size:28px!important;}
 #timerSide .rad,#timerSide.timer-compact .rad,#timerSide .timer-grid,#timerSide.timer-compact .timer-grid{grid-template-columns:1fr!important;gap:14px!important;}
 #timerSide .timer-start,#timerSide .timer-end,#timerSide .timer-price,#timerSide .timer-antall,#timerSide .timer-varepris,#timerSide .timer-camera,#timerSide .timer-gallery,#timerSide .timer-bilag-camera,#timerSide .timer-bilag-gallery,#timerSide .timer-utgift-type,#timerSide .timer-utgift-belop,#timerSide #timerUtleggKnappRad{grid-column:1/-1!important;}
 #timerSide label,#timerSide.timer-compact label{font-size:18px!important;}
 #timerSide input,#timerSide select,#timerSide textarea,#timerSide.timer-compact input,#timerSide.timer-compact select,#timerSide.timer-compact textarea{height:50px!important;min-height:50px!important;font-size:18px!important;}
}
`;

  function byId(id){ return document.getElementById(id); }
  function closestField(el){
    if(!el) return null;
    var p = el.parentElement;
    while(p && p !== document.body){
      if(p.id === 'timerSide') return el;
      if(p.classList && (p.classList.contains('timer-layout-field') || p.classList.contains('felt') || p.classList.contains('form-felt') || p.classList.contains('field'))) return p;
      if(p.children && p.children.length <= 5 && p.querySelector && p.querySelector('input,select,textarea,button')) return p;
      p = p.parentElement;
    }
    return el;
  }
  function ensureCss(){
    var old=document.getElementById(CSS_ID); if(old) old.remove();
    var s=document.createElement('style'); s.id=CSS_ID; s.textContent=css; document.head.appendChild(s);
  }
  function label(id,text){
    var el=byId(id), c=closestField(el); if(!el||!c) return c;
    var l=c.querySelector(':scope > label') || document.querySelector('label[for="'+id+'"]');
    if(!l){ l=document.createElement('label'); l.setAttribute('for',id); c.insertBefore(l,c.firstChild); }
    l.textContent=text;
    return c;
  }
  function addClass(id,cls,text){ var c=label(id,text); if(c) c.classList.add('timer-layout-field',cls); return c; }
  function row(id,cls,parent,before){
    var r=byId(id)||document.createElement('div'); r.id=id; r.className='rad timer-grid '+cls;
    if(parent && r.parentElement!==parent) parent.insertBefore(r,before||null);
    return r;
  }
  function append(r,c){ if(r&&c&&c.parentElement!==r) r.appendChild(c); }
  function makeBil(){
    var c=addClass('bilValg','timer-bil-inline','Standard/aktiv bil'); if(!c) return null;
    var bil=byId('bilValg');
    var control=c.querySelector(':scope > .timer-bil-control')||document.createElement('div'); control.className='timer-bil-control';
    if(control.parentElement!==c) c.appendChild(control);
    if(bil && bil.parentElement!==control) control.appendChild(bil);
    var info=byId('aktivBilInfo'); if(info && info.parentElement!==c) c.appendChild(info);
    var btn=byId('byttBilKnapp'); if(btn){ btn.textContent='Bytt bil denne gangen'; if(btn.parentElement!==c) c.appendChild(btn); }
    return c;
  }
  function apply(){
    ensureCss();
    var side=byId('timerSide'); if(!side) return;
    side.classList.add('timer-compact','timer-layout-active','timer-mobile-clean');
    var first=closestField(byId('dato')||byId('kundeValg')||side.querySelector('input,select,textarea,button'));
    var parent=(first&&first.parentElement)||side;
    var main=row('timerLayoutMainRow','timer-grid-main',parent,first);
    var time=row('timerLayoutTimeBilRow','timer-grid-timebil',parent,main.nextSibling);
    var vare=row('timerLayoutVareRow','timer-grid-vare',parent,time.nextSibling);
    var bilder=row('timerLayoutBilderRow','timer-grid-bilder',parent,vare.nextSibling);
    var utgift=row('timerLayoutUtgiftRow','timer-grid-utgift',parent,bilder.nextSibling);
    append(main,addClass('dato','timer-date','Dato'));
    append(main,addClass('kundeValg','timer-customer','Kunde'));
    append(main,addClass('kundeNrVisning','timer-customer-no','Kundenr'));
    append(main,addClass('prosjektValg','timer-project','Prosjekt'));
    append(time,addClass('startTid','timer-start','Start'));
    append(time,addClass('sluttTid','timer-end','Slutt'));
    append(time,addClass('timepris','timer-price','Timepris'));
    append(time,makeBil());
    append(vare,addClass('vareValg','timer-vare','Vare'));
    append(vare,addClass('vareAntall','timer-antall','Antall'));
    append(vare,addClass('varePris','timer-varepris','Varepris'));
    append(bilder,addClass('timerBildeKamera','timer-camera','Kamera'));
    append(bilder,addClass('timerBildeGalleri','timer-gallery','Galleri'));
    append(bilder,addClass('utleggBilagKamera','timer-bilag-camera','Bilag kamera'));
    append(bilder,addClass('utleggBilagBilde','timer-bilag-gallery','Bilag'));
    append(utgift,addClass('utgiftType','timer-utgift-type','Utgift'));
    append(utgift,addClass('utgiftBelop','timer-utgift-belop','Beløp'));
    var btn=byId('leggTilUtleggKnapp');
    if(btn){ var br=byId('timerUtleggKnappRad')||document.createElement('div'); br.id='timerUtleggKnappRad'; br.className='timer-layout-field'; if(br.parentElement!==utgift) utgift.appendChild(br); if(btn.parentElement!==br) br.appendChild(btn); }
    append(utgift,addClass('fakturerbar','timer-fakturerbar','Fakt.'));
    var desc=addClass('beskrivelse','timer-description',''); if(desc&&desc.parentElement!==parent) parent.insertBefore(desc,utgift.nextSibling);
    var lagre=byId('lagreTimerKnapp'); if(lagre){ var ar=byId('timerLayoutActionRow')||document.createElement('div'); ar.id='timerLayoutActionRow'; if(ar.parentElement!==parent) parent.insertBefore(ar,desc?desc.nextSibling:utgift.nextSibling); if(lagre.parentElement!==ar) ar.appendChild(lagre); }
    var vk=byId('leggTilVarelinjeKnapp'); if(vk) vk.style.display='none';
  }
  function start(){ apply(); [80,250,700,1400,2600,5000].forEach(function(ms){setTimeout(apply,ms);}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
  document.addEventListener('handPartialerLastet',start); window.addEventListener('load',start); window.handApplyTimerLayout=apply;
})();
