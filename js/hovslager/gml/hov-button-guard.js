/* Hovslager knapp-vakt 2026-06-29
   Formål: binder kritiske knapper med event delegation slik at gamle/feilende bindingsscript
   ikke gjør knappene døde. Filen endrer ikke databasen og kan ligge sist i index.html. */
(function(){
  if (window.__hovButtonGuardLoaded) return;
  window.__hovButtonGuardLoaded = true;

  function $(id){ return document.getElementById(id); }
  function log(txt){
    console.log('[hov-button-guard]', txt);
    let el = $('hovButtonGuardStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hovButtonGuardStatus';
      el.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483647;background:#064e3b;color:white;padding:6px 9px;border-radius:8px;font:12px Arial;max-width:360px;opacity:.92';
      document.body && document.body.appendChild(el);
      setTimeout(function(){ if(el && el.parentNode) el.parentNode.removeChild(el); }, 8000);
    }
    el.textContent = txt;
  }
  function warn(txt, err){ console.warn('[hov-button-guard]', txt, err || ''); log(txt); }

  window.addEventListener('error', function(ev){
    warn('JS-feil: ' + (ev.message || 'ukjent feil'));
  });
  window.addEventListener('unhandledrejection', function(ev){
    const msg = ev.reason && (ev.reason.message || String(ev.reason));
    warn('Promise-feil: ' + (msg || 'ukjent feil'));
  });

  function manualVisSide(sideId){
    const sider = ['jobbSide','hesterSide','kundeSide','fakturaSide','firmaSide','prislisteSide'];
    sider.forEach(function(id){
      const s = $(id);
      if (!s) return;
      if (id === sideId) s.classList.remove('skjult');
      else s.classList.add('skjult');
    });
  }

  async function callFn(name){
    const fn = window[name];
    if (typeof fn !== 'function') {
      alert('Programfeil: mangler funksjon ' + name + '. Filene er ikke lastet riktig.');
      warn('Mangler funksjon ' + name);
      return;
    }
    try { return await fn(); }
    catch(e){
      console.error(e);
      alert('Feil i ' + name + ': ' + (e && e.message ? e.message : e));
      throw e;
    }
  }

  function getButtonAction(el){
    if (!el) return null;
    const btn = el.closest && el.closest('button, a.knapp, input[type="button"], input[type="submit"]');
    if (!btn) return null;
    const id = btn.id || '';
    const text = String(btn.textContent || btn.value || '').trim().toLowerCase();

    const byId = {
      loggUtKnapp: async function(){
        if (typeof window.hovLoggUt === 'function') return window.hovLoggUt();
        if (typeof window.loggUt === 'function') return window.loggUt();
        if (window.supabaseClient && window.supabaseClient.auth) await window.supabaseClient.auth.signOut();
        location.reload();
      },
      visJobberKnapp: function(){ (window.visSide || manualVisSide)('jobbSide'); },
      visHesterKnapp: function(){ (window.visSide || manualVisSide)('hesterSide'); },
      visKunderKnapp: function(){ (window.visSide || manualVisSide)('kundeSide'); },
      visFakturaKnapp: function(){ (window.visSide || manualVisSide)('fakturaSide'); },
      visFirmaKnapp: function(){ (window.visSide || manualVisSide)('firmaSide'); },
      taleJobbKnapp: function(){ return callFn('startTaleJobb'); },
      lagreJobbKnapp: function(){ return callFn('lagreJobbMedHestSjekk'); },
      oppdaterJobberKnapp: function(){ return callFn('hentJobber'); },
      lagreHestKnapp: function(){ return callFn('lagreHest'); },
      leggTilKundeKnapp: function(){ return callFn('lagreKunde'); },
      oppdaterFakturaKunderKnapp: function(){ return callFn('fyllFakturaKunder'); },
      lagFakturaKnapp: function(){ return callFn('lagHovFaktura'); },
      lagKreditnotaKnapp: function(){ return callFn('lagHovKreditnota'); },
      hentFakturaOversiktKnapp: function(){ return callFn('hentFakturaOversikt'); },
      eksporterFakturaExcelKnapp: function(){ return callFn('eksporterFakturaOversiktExcel'); },
      lagreHovOppsettKnapp: function(){ return callFn('lagreHovOppsett'); },
      oppdaterPrislisteKnapp: async function(){
        if (typeof window.hentPrislisteTilApp === 'function') return window.hentPrislisteTilApp();
        if (typeof window.hovBindPrisvalgRobust === 'function') window.hovBindPrisvalgRobust();
        const msg = $('prislisteAppMelding');
        if (msg) msg.textContent = 'Prislistefunksjon mangler i denne versjonen, men prisvalg er forsøkt oppdatert.';
      },
      backupKnapp: function(){ return callFn('backup'); },
      glemtPassordKnapp: async function(){
        if (typeof window.hovSendMagicLink === 'function') return window.hovSendMagicLink();
        const email = $('loginEpost') && $('loginEpost').value;
        if (!email) return alert('Skriv e-post først.');
        if (!window.supabaseClient) return alert('Supabase er ikke lastet.');
        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/rettilomma/reset.html' });
        alert(error ? ('Feil: ' + error.message) : 'E-post for nytt passord er sendt.');
      }
    };
    if (byId[id]) return { btn: btn, run: byId[id] };

    if (text === 'prisliste') return { btn: btn, run: function(){ (window.visSide || manualVisSide)('prislisteSide'); } };
    if (text.indexOf('vis/skjul manuell') >= 0) return { btn: btn, run: function(){ const m=$('manuellJobb'); if(m) m.classList.toggle('skjult'); } };
    if (text.indexOf('snakk inn beskrivelse') >= 0) return { btn: btn, run: function(){ return callFn('startBeskrivelseTale'); } };
    if (text.indexOf('vis alle jobbilder') >= 0 && id === 'visAlleJobbBilderValgtHestKnapp') return { btn: btn, run: function(){ return callFn('hovVisJobbBilderForValgtHest'); } };
    return null;
  }

  document.addEventListener('click', function(ev){
    const action = getButtonAction(ev.target);
    if (!action) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    Promise.resolve(action.run()).catch(function(e){ console.error(e); });
  }, true);

  function bindFileInputs(){
    const importFil = $('importFil');
    if (importFil && importFil.dataset.hovButtonGuard !== '1') {
      importFil.dataset.hovButtonGuard = '1';
      importFil.addEventListener('change', function(ev){
        if (typeof window.importerBackup === 'function') window.importerBackup(ev);
        else alert('Programfeil: importerBackup mangler.');
      });
    }
  }

  function init(){
    bindFileInputs();
    log('Knapp-vakt aktiv');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setInterval(bindFileInputs, 1500);
})();
