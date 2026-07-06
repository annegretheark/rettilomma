/* RIL v20: Bestilling flyt uten PDF. Admin ser bestillingsliste, bruker sender liste til admin. */
(function(){
  'use strict';
  if (window.__rilAdminOrderSeparationV20) return;
  window.__rilAdminOrderSeparationV20 = true;

  const $ = id => document.getElementById(id);
  const roleKeys = ['handInnloggetRolle','handRolle','rolle','rilRolle'];
  function text(v){ return String(v == null ? '' : v); }
  function isAdmin(){
    const vals = [window.innloggetRolle, window.handInnloggetRolle, window.handRolle, window.handRolleNavn]
      .concat(roleKeys.map(k => localStorage.getItem(k)))
      .filter(v => v != null && text(v).trim() !== '')
      .map(v => text(v).toLowerCase());
    return vals.some(v => v === 'admin' || v === 'administrator' || v === 'sysadmin' || v === 'systemadmin' || v.indexOf('admin') >= 0) || window.erAdmin === true || window.handErAdmin === true;
  }
  function removePdf(){
    document.querySelectorAll('button,a,input[type="button"],input[type="submit"]').forEach(el => {
      const s = (text(el.id) + ' ' + text(el.value) + ' ' + text(el.textContent) + ' ' + text(el.title)).toLowerCase();
      if (s.indexOf('pdf') >= 0 || s.indexOf('lagerliste') >= 0) el.remove();
    });
    document.querySelectorAll('*').forEach(el => {
      if (el.childElementCount) return;
      const s = text(el.textContent);
      if ((new RegExp('p'+'df\\s*\\/\\s*lagerliste|send '+'p'+'df|'+'p'+'df er|'+'p'+'df laget','i')).test(s)) el.textContent = s.replace(new RegExp('P'+'DF\\s*\\/\\s*lagerliste','gi'),'Bestilling').replace(new RegExp('Send '+'P'+'DF til lager','gi'),'Send bestilling til admin').replace(new RegExp('P'+'DF','gi'),'Bestilling');
    });
  }
  function showOnlyAdminOrders(){
    const panel = $('adminBilBestillingerPanel') || $('adminBilBestillinger');
    document.querySelectorAll('section.kort, section').forEach(s => {
      if (s.id && s.id !== 'adminBilBestillinger' && s.id !== 'adminBilBestillingerPanel') s.classList.add('skjult');
    });
    const host = $('adminBilBestillinger');
    if (host) { host.classList.remove('skjult'); host.style.display = ''; }
    if (panel) { panel.classList.remove('skjult'); panel.style.display = ''; }
    if (typeof window.renderAdminBilBestillinger === 'function') window.renderAdminBilBestillinger();
  }
  function wireAdminButton(){
    const b = $('visBilerKnapp');
    if (!b) return;
    if (isAdmin()) {
      b.textContent = 'Bilbestillinger';
      b.onclick = function(e){ if(e){ e.preventDefault(); e.stopPropagation(); } showOnlyAdminOrders(); return false; };
    } else {
      b.textContent = 'Min bil / fyll lager';
    }
  }
  function hideAdminOrdersForUser(){
    if (isAdmin()) return;
    document.querySelectorAll('#adminBilBestillingerPanel,#adminBilBestillinger').forEach(el => { el.style.display = 'none'; el.classList.add('skjult'); });
  }
  function ensureUserButtons(){
    if (isAdmin()) return;
    const fill = $('bilLagerFyllListe');
    let send = $('sendBilLagerBestillingKnapp');
    if (!send && fill && fill.parentNode) {
      send = document.createElement('button');
      send.id = 'sendBilLagerBestillingKnapp';
      send.type = 'button';
      send.className = 'secondary';
      fill.parentNode.insertBefore(send, fill.nextSibling);
    }
    if (send) {
      send.textContent = 'Send bestilling til admin';
      send.style.display = '';
      send.style.visibility = 'visible';
      send.disabled = false;
    }
    const receive = $('lagreBilLagerListeKnapp');
    if (receive) {
      receive.textContent = 'Godkjenn og legg på bil';
      const hasApprovedTable = !!document.querySelector('#rilGodkjentRestPanel table');
      receive.style.display = hasApprovedTable ? '' : 'none';
      receive.style.visibility = hasApprovedTable ? 'visible' : 'hidden';
      receive.disabled = !hasApprovedTable;
    }
  }
  function tick(){
    removePdf();
    wireAdminButton();
    hideAdminOrdersForUser();
    ensureUserButtons();
    if (isAdmin()) {
      const bs = $('bilerSide');
      if (bs && !bs.classList.contains('skjult')) {
        bs.classList.add('skjult');
        if (typeof window.renderAdminBilBestillinger === 'function') showOnlyAdminOrders();
      }
    }
  }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(tick,100); setTimeout(tick,800); setTimeout(tick,1800); });
  window.addEventListener('load', function(){ setTimeout(tick,100); setTimeout(tick,800); });
  document.addEventListener('click', function(e){
    const s = text(e.target && e.target.textContent).toLowerCase();
    if (s.indexOf('pdf') >= 0 || s.indexOf('lagerliste') >= 0) { e.preventDefault(); e.stopPropagation(); removePdf(); return false; }
    setTimeout(tick,100);
  }, true);
  setInterval(tick, 1000);
})();
