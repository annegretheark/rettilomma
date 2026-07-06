(function(){
  'use strict';

  var CSS_ID = 'hand-timereg-clean-reference-layout-20260630-final';
  var css = `
/* RIL TIMEREG - kompakt layout lik riktig skjermbilde. Kun CSS/lett normalisering, ingen flytting av felter. */
html,body{overflow-x:hidden!important;background:#0f1115!important;}
#appSide{box-sizing:border-box!important;width:min(980px,calc(100vw - 28px))!important;margin:0 auto!important;padding-bottom:42px!important;}
#timerSide,#timerSide.timer-compact{box-sizing:border-box!important;width:min(760px,calc(100vw - 28px))!important;max-width:760px!important;margin:16px auto 28px!important;padding:18px!important;border-radius:10px!important;background:#171a1f!important;border:0!important;box-shadow:none!important;overflow:visible!important;}
#timerSide h2{margin:0 0 24px!important;text-align:center!important;font-size:26px!important;line-height:1.15!important;font-weight:800!important;color:#fff!important;}
#timerSide .rad,#timerSide .timer-grid{display:grid!important;width:100%!important;box-sizing:border-box!important;gap:12px!important;align-items:end!important;margin:0 0 14px!important;}
#timerSide .rad>div,#timerSide .timer-grid>div{box-sizing:border-box!important;min-width:0!important;width:auto!important;max-width:none!important;margin:0!important;}
#timerSide label{display:block!important;margin:0 0 6px!important;font-size:15px!important;line-height:1.1!important;font-weight:800!important;color:#f3f4f6!important;white-space:nowrap!important;}
#timerSide input,#timerSide select,#timerSide textarea{display:block!important;box-sizing:border-box!important;width:100%!important;max-width:100%!important;min-width:0!important;height:42px!important;min-height:42px!important;margin:0!important;padding:0 12px!important;border-radius:7px!important;border:1px solid #59636f!important;background:#15191f!important;color:#fff!important;font-size:15px!important;line-height:1.2!important;box-shadow:none!important;}
#timerSide textarea{height:76px!important;min-height:76px!important;padding:10px 12px!important;resize:vertical!important;}
#timerSide input[type=file]{padding:8px 10px!important;font-size:14px!important;background:#10151b!important;}
#timerSide button{box-sizing:border-box!important;border-radius:7px!important;font-weight:700!important;min-height:38px!important;padding:0 14px!important;font-size:14px!important;white-space:nowrap!important;}

/* Rader slik som riktig bilde */
#timerSide .timer-grid-main{grid-template-columns:1fr 1fr 1fr!important;}
#timerSide .timer-grid-main .timer-project{grid-column:1 / span 2!important;}
#timerSide .timer-grid-main .timer-customer-no{grid-column:auto!important;}
#timerSide .timer-grid-timebil{grid-template-columns:1fr 1fr 1fr!important;}
#timerSide #adminAnsattRad,#timerSide .admin-only,#timerSide .skjult{display:none!important;}
#timerSide .timer-bil-inline{grid-column:1 / -1!important;}
#timerSide .timer-bil-control{display:block!important;width:100%!important;}
#timerSide #bilValg{width:100%!important;}
#timerSide #byttBilKnapp{display:inline-block!important;width:auto!important;height:36px!important;min-height:36px!important;margin:8px 0 0!important;background:#4b4b4b!important;color:#fff!important;}
#timerSide #aktivBilInfo{display:block!important;margin:6px 0 0!important;color:#40e985!important;font-size:14px!important;line-height:1.25!important;}
#timerSide .timer-grid-vare{grid-template-columns:2fr .8fr 1fr!important;}
#timerSide #leggTilVarelinjeKnapp{display:block!important;margin:0 0 18px 4px!important;width:auto!important;min-width:180px!important;max-width:max-content!important;background:#1269d3!important;color:#fff!important;}
#timerSide .timer-grid-utgift{grid-template-columns:1fr .7fr .8fr!important;}
#timerSide .timer-grid-utgift>div:nth-child(3),#timerSide .timer-grid-utgift>div:nth-child(4){display:none!important;}
#timerSide .timer-grid-bilag,#timerSide .timer-grid-bilder{grid-template-columns:1fr 1fr!important;}
#timerSide #leggTilUtleggKnapp{display:block!important;margin:0 0 12px 4px!important;width:auto!important;min-width:180px!important;max-width:max-content!important;background:#1269d3!important;color:#fff!important;}
#timerSide #utleggListe{margin:0 0 12px!important;color:#cfd6df!important;font-size:14px!important;}
#timerSide #beskrivelse,#timerSide #timerBildeTekst{width:100%!important;max-width:100%!important;margin-bottom:14px!important;}
#timerSide #lagreTimerKnapp{display:block!important;width:170px!important;height:42px!important;margin:10px 0 0!important;background:#11823b!important;color:#fff!important;}
#timerSide #timerMelding{margin-top:10px!important;}

@media(max-width:820px){
  #appSide{width:calc(100vw - 20px)!important;}
  #timerSide,#timerSide.timer-compact{width:100%!important;max-width:none!important;margin:10px auto 22px!important;padding:14px!important;}
}
@media(max-width:620px){
  #timerSide h2{font-size:22px!important;margin-bottom:16px!important;}
  #timerSide .timer-grid-main,#timerSide .timer-grid-timebil,#timerSide .timer-grid-vare,#timerSide .timer-grid-utgift,#timerSide .timer-grid-bilag,#timerSide .timer-grid-bilder{grid-template-columns:1fr!important;gap:10px!important;}
  #timerSide .timer-grid-main .timer-project,#timerSide .timer-bil-inline{grid-column:1/-1!important;}
  #timerSide #leggTilVarelinjeKnapp,#timerSide #leggTilUtleggKnapp,#timerSide #lagreTimerKnapp{width:100%!important;max-width:none!important;margin-left:0!important;}
}
`;

  function byId(id){ return document.getElementById(id); }
  function addClass(id, cls){ var el=byId(id); var d=el && el.closest ? el.closest('div') : null; if(d) d.classList.add(cls); }
  function setLabel(id, text){ var el=byId(id); if(!el) return; var label=document.querySelector('label[for="'+id+'"]'); if(label) label.textContent=text; }
  function injectCss(){
    Array.prototype.slice.call(document.querySelectorAll('style[id^="hand-timereg-"]')).forEach(function(s){ s.remove(); });
    var s=document.createElement('style'); s.id=CSS_ID; s.textContent=css; document.head.appendChild(s);
  }
  function normalize(){
    var timer=byId('timerSide'); if(!timer) return;
    timer.classList.add('timer-compact');
    addClass('dato','timer-date'); addClass('kundeValg','timer-customer'); addClass('prosjektValg','timer-project'); addClass('kundeNrVisning','timer-customer-no');
    addClass('timepris','timer-price'); addClass('bilValg','timer-bil-inline');
    setLabel('kundeNrVisning','K.nr'); setLabel('timepris','Timepris'); setLabel('bilValg','Standard/aktiv bil'); setLabel('varePris','Pris');
    var admin=byId('adminAnsattRad'); if(admin) admin.style.setProperty('display','none','important');
    var info=byId('aktivBilInfo'); if(info && !info.textContent.trim()) info.textContent='Aktiv bil: Velg bil';
    timer.querySelectorAll('[style]').forEach(function(el){
      var id=el.id||'';
      if(/dato|kunde|prosjekt|startTid|sluttTid|timepris|bilValg|vareValg|vareAntall|varePris|utgift|fakturerbar|beskrivelse|timerBilde/i.test(id)){
        el.style.removeProperty('width'); el.style.removeProperty('max-width'); el.style.removeProperty('min-width');
      }
    });
  }
  function run(){ injectCss(); normalize(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  document.addEventListener('handPartialerLastet',run);
  window.addEventListener('load',run);
  [50,150,300,700,1200,2500].forEach(function(ms){ setTimeout(run,ms); });
})();

/* RIL FIX 20260630: Sysadm skal aldri vises for vanlig bruker.
   Denne ligger sist i lastrekkefolgen og rydder opp etter eldre scripts som kan vise Sysadm-knappen via stale localStorage. */
(function(){
  'use strict';
  if (window.__RIL_SYSADM_NORMAL_USER_GUARD__) return;
  window.__RIL_SYSADM_NORMAL_USER_GUARD__ = true;

  var verified = false;
  var allowed = false;
  var SYS_IDS = ['sysadminModeKnapp','sysadminNyKundeKnapp','sysadminKundelisteKnapp','sysadminModulerKnapp','visModulerKnapp','velgModulKnapp'];
  var SYS_SIDES = ['sysadminPanelSide','modulerSide'];
  var SYS_ROLES = ['sysadm','sysadmin','systemadmin'];

  function n(v){ return String(v == null ? '' : v).trim().toLowerCase(); }
  function $(id){ return document.getElementById(id); }
  function isSysRole(v){ return SYS_ROLES.indexOf(n(v)) >= 0; }
  function hide(el){
    if(!el) return;
    el.hidden = true;
    if(el.classList) el.classList.add('skjult','hidden');
    if(el.style){
      el.style.setProperty('display','none','important');
      el.style.setProperty('visibility','hidden','important');
    }
    el.setAttribute && el.setAttribute('aria-hidden','true');
  }
  function show(el){
    if(!el) return;
    el.hidden = false;
    if(el.classList) el.classList.remove('skjult','hidden','modul-skjult');
    if(el.style){ el.style.removeProperty('display'); el.style.removeProperty('visibility'); }
    el.removeAttribute && el.removeAttribute('aria-hidden');
  }
  function installCss(){
    if($('rilSysadmNormalUserGuardCss')) return;
    var st = document.createElement('style');
    st.id = 'rilSysadmNormalUserGuardCss';
    st.textContent = 'html:not(.ril-verified-sysadm) #sysadminModeKnapp,html:not(.ril-verified-sysadm) #sysadminNyKundeKnapp,html:not(.ril-verified-sysadm) #sysadminKundelisteKnapp,html:not(.ril-verified-sysadm) #sysadminModulerKnapp,html:not(.ril-verified-sysadm) #visModulerKnapp,html:not(.ril-verified-sysadm) #velgModulKnapp,html:not(.ril-verified-sysadm) #sysadminPanelSide,html:not(.ril-verified-sysadm) #modulerSide{display:none!important;visibility:hidden!important}';
    (document.head || document.documentElement).appendChild(st);
  }
  function currentEmail(){
    return n(window.innloggetEpost || window.handInnloggetEpost || window.innloggetBrukerEpost || localStorage.getItem('handInnloggetEpost') || localStorage.getItem('innloggetEpost') || localStorage.getItem('rettilommaSistEpost'));
  }
  async function authUser(){
    try { var r = await window.supabaseClient?.auth?.getUser(); if(r && r.data && r.data.user) return r.data.user; } catch(e) {}
    try { var s = await window.supabaseClient?.auth?.getSession(); if(s && s.data && s.data.session && s.data.session.user) return s.data.session.user; } catch(e) {}
    return null;
  }
  async function hasSysRow(table, email, uid){
    if(!window.supabaseClient) return false;
    var cols = ['rolle','role','brukerrolle','type','tilgang','epost','email','user_id','auth_id','auth_user_id','aktiv'];
    try{
      var q = window.supabaseClient.from(table).select(cols.join(',')).limit(30);
      if(uid) q = q.eq('user_id', uid); else q = q.ilike('epost', email);
      var r = await q;
      if(!r.error && Array.isArray(r.data) && r.data.some(function(row){ return row && row.aktiv !== false && isSysRole(row.rolle || row.role || row.brukerrolle || row.type || row.tilgang); })) return true;
    }catch(e){}
    try{
      var q2 = window.supabaseClient.from(table).select('*').ilike('epost', email).limit(30);
      var r2 = await q2;
      if(!r2.error && Array.isArray(r2.data) && r2.data.some(function(row){ return row && row.aktiv !== false && isSysRole(row.rolle || row.role || row.brukerrolle || row.type || row.tilgang); })) return true;
    }catch(e){}
    try{
      var q3 = window.supabaseClient.from(table).select('*').ilike('email', email).limit(30);
      var r3 = await q3;
      if(!r3.error && Array.isArray(r3.data) && r3.data.some(function(row){ return row && row.aktiv !== false && isSysRole(row.rolle || row.role || row.brukerrolle || row.type || row.tilgang); })) return true;
    }catch(e){}
    return false;
  }
  async function verifySysadm(){
    installCss();
    forceHideUntilVerified();
    var user = await authUser();
    var email = n((user && user.email) || currentEmail());
    var uid = String(user && user.id || '').trim();
    var meta = n(user && (user.user_metadata?.rolle || user.user_metadata?.role || user.app_metadata?.rolle || user.app_metadata?.role));
    var ok = isSysRole(meta);
    if(!ok && email && window.supabaseClient){
      try{
        var sr = await window.supabaseClient.from('hand_sysadm').select('id,aktiv,epost').ilike('epost', email).limit(1);
        ok = !!(!sr.error && Array.isArray(sr.data) && sr.data.some(function(x){ return x && x.aktiv !== false; }));
      }catch(e){}
      if(!ok) ok = await hasSysRow('hand_firma_bruker', email, uid);
      if(!ok) ok = await hasSysRow('hand_ansatt', email, uid);
    }
    verified = true;
    allowed = !!ok;
    apply();
  }
  function stripSysState(){
    window.erSystemadmin = false;
    if(isSysRole(window.innloggetRolle)) window.innloggetRolle = window.erAdmin ? 'admin' : 'bruker';
    if(isSysRole(window.handInnloggetRolle)) window.handInnloggetRolle = window.innloggetRolle;
    try{
      if(isSysRole(localStorage.getItem('handInnloggetRolle'))) localStorage.setItem('handInnloggetRolle', window.innloggetRolle || 'bruker');
      if(isSysRole(localStorage.getItem('innloggetRolle'))) localStorage.setItem('innloggetRolle', window.innloggetRolle || 'bruker');
      localStorage.removeItem('rilSysadminModus');
      localStorage.removeItem('sysadminModus');
      localStorage.removeItem('handSysadminModus');
    }catch(e){}
    document.documentElement.classList.remove('hand-is-sysadm','ril-sysadm-ready','ril-verified-sysadm');
    if(document.body) document.body.classList.remove('ril-er-sysadm');
  }
  function forceHideUntilVerified(){
    document.documentElement.classList.remove('ril-verified-sysadm');
    SYS_IDS.forEach(function(id){ hide($(id)); });
    SYS_SIDES.forEach(function(id){ hide($(id)); });
  }
  function apply(){
    installCss();
    if(!verified || !allowed){
      stripSysState();
      forceHideUntilVerified();
      return;
    }
    document.documentElement.classList.add('ril-verified-sysadm','hand-is-sysadm','ril-sysadm-ready');
    SYS_IDS.forEach(function(id){ show($(id)); });
  }
  function start(){
    installCss();
    forceHideUntilVerified();
    verifySysadm();
    [50,150,350,800,1500,3000].forEach(function(ms){ setTimeout(apply, ms); });
  }
  document.addEventListener('click', function(ev){
    var t = ev.target && ev.target.closest && ev.target.closest('#sysadminModeKnapp,#sysadminNyKundeKnapp,#sysadminKundelisteKnapp,#sysadminModulerKnapp,#visModulerKnapp,#velgModulKnapp');
    if(t && (!verified || !allowed)){
      ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      forceHideUntilVerified();
      return false;
    }
  }, true);
  var mo = new MutationObserver(apply);
  function observe(){ try{ mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden']}); }catch(e){} }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ start(); observe(); }, {once:true}); else { start(); observe(); }
  document.addEventListener('handPartialerLastet', start);
  window.addEventListener('load', start);
})();
