/* FINAL FIX 2026-06-25
   Knappen "Opprett og send invitasjon" skal sende Supabase invite via Edge Function
   opprett-hand-kunde. Den skal IKKE bruke resetPasswordForEmail / glemt passord.
   Lagrer også valgte moduler på nyopprettet firma når firma_id kommer tilbake.
*/
(function(){
  'use strict';
  if (window.__handInviteFinalFix20260625) return;
  window.__handInviteFinalFix20260625 = true;

  function $(id){ return document.getElementById(id); }
  function val(id){ var e=$(id); return String(e && e.value || '').trim(); }
  function setVal(id,v){ var e=$(id); if(e) e.value = v == null ? '' : String(v); }
  function msg(t, feil){
    var e=$('nyHandKundeMelding') || $('firmaMelding') || $('handFirmaModulerStatus') || $('modulStatus');
    if(e){ e.textContent=t||''; e.style.color=feil?'#fca5a5':'#86efac'; }
    else if(feil){ alert(t); }
  }
  function slugify(v){
    return String(v||'').trim().toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').replace(/æ/g,'ae').replace(/ø/g,'o').replace(/å/g,'a')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  }
  function appBase(){ return location.pathname.toLowerCase().indexOf('/rettilomma/')>=0 ? location.origin + '/rettilomma/handverker/' : location.origin + '/handverker/'; }
  function rootBase(){ return location.pathname.toLowerCase().indexOf('/rettilomma/')>=0 ? location.origin + '/rettilomma/' : location.origin + '/'; }
  function kundelink(slug){ return appBase() + '?firma=' + encodeURIComponent(slug || ''); }
  function supa(){ return window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null); }
  function withTimeout(p, ms){
    var timer;
    var timeout = new Promise(function(_, reject){ timer=setTimeout(function(){ reject(new Error('Invitasjonen tok for lang tid.')); }, ms||30000); });
    return Promise.race([p, timeout]).finally(function(){ clearTimeout(timer); });
  }
  function valgteModuler(){
    var arr=[];
    document.querySelectorAll('[data-hand-firma-modul]').forEach(function(cb){
      if(cb.checked) arr.push(cb.getAttribute('data-hand-firma-modul'));
    });
    if(!arr.length){
      document.querySelectorAll('[id^="modul_"]').forEach(function(cb){
        if(cb.checked) arr.push(cb.id.replace(/^modul_/,''));
      });
    }
    return arr.filter(Boolean);
  }
  async function lagreValgteModuler(firmaId){
    if(!firmaId) return;
    var c=supa(); if(!c || !c.from) return;
    var arr=valgteModuler();
    if(!arr.length) return;
    try{
      await c.from('hand_firma').update({moduler:arr, moduler_konfigurert:true}).eq('id', firmaId);
    }catch(e){ console.warn('Kunne ikke lagre moduler på hand_firma:', e); }
    try{
      var rows=arr.map(function(m){ return {firma_id:firmaId, modul:m, aktiv:true}; });
      await c.from('hand_moduler').delete().eq('firma_id', firmaId);
      await c.from('hand_moduler').insert(rows);
    }catch(e){ console.warn('Kunne ikke lagre moduler i hand_moduler:', e); }
    try{
      var rows2=arr.map(function(m){ return {firma_id:firmaId, modul:m, aktiv:true}; });
      await c.from('hand_kunde_moduler').delete().eq('firma_id', firmaId);
      await c.from('hand_kunde_moduler').insert(rows2);
    }catch(e){ console.warn('Kunne ikke lagre moduler i hand_kunde_moduler:', e); }
  }

  async function sendMagicOrReset(epost){
    var c=supa();
    var redirect = rootBase() + 'reset.html';
    var magicOk = false;
    var resetOk = false;
    var errors = [];

    if(c && c.auth && typeof c.auth.signInWithOtp === 'function'){
      try{
        var m = await c.auth.signInWithOtp({
          email: epost,
          options: {
            emailRedirectTo: redirect,
            shouldCreateUser: false
          }
        });
        if(m && m.error) throw m.error;
        magicOk = true;
      }catch(e){
        errors.push('magic link: ' + (e && e.message ? e.message : e));
      }
    }

    if(!magicOk && c && c.auth && typeof c.auth.resetPasswordForEmail === 'function'){
      try{
        var r = await c.auth.resetPasswordForEmail(epost, { redirectTo: redirect });
        if(r && r.error) throw r.error;
        resetOk = true;
      }catch(e){
        errors.push('glemt passord: ' + (e && e.message ? e.message : e));
      }
    }

    if(magicOk) return 'Magic link sendt til ' + epost + '.';
    if(resetOk) return 'Glemt-passord e-post sendt til ' + epost + '.';
    throw new Error(errors.join(' | ') || 'Kunne ikke sende magic link eller glemt passord.');
  }

  function looksLikeExistingUserError(e){
    var t = String((e && (e.message || e.error_description || e.details || e.hint)) || e || '').toLowerCase();
    return t.indexOf('already') >= 0 ||
           t.indexOf('exists') >= 0 ||
           t.indexOf('duplicate') >= 0 ||
           t.indexOf('registered') >= 0 ||
           t.indexOf('non-2xx') >= 0 ||
           t.indexOf('status code') >= 0;
  }

  window.handSendPassordopprettingDirekte = async function(){
    var navn = val('nyHandKundeNavn');
    var epost = val('nyHandKundeEpost').toLowerCase();
    var slug = slugify(val('nyHandKundeLinknavn') || navn || epost);
    if(!navn){ msg('Skriv firmanavn først.', true); return; }
    if(!epost){ msg('Skriv e-post først.', true); return; }

    try{
      var c=supa();
      if(!c || !c.functions) throw new Error('Supabase Functions er ikke tilgjengelig.');
      setVal('nyHandKundeLinknavn', slug);
      setVal('nyHandKundeLink', kundelink(slug));
      msg('Oppretter kunde og sender INVITASJON...');

      var body={
        firmanavn: navn,
        navn: navn,
        kontakt_navn: navn,
        email: epost,
        epost: epost,
        telefon: val('nyHandKundeTelefon'),
        phone: val('nyHandKundeTelefon'),
        adresse: val('nyHandKundeAdresse'),
        orgnr: val('nyHandKundeOrgNr'),
        org_nr: val('nyHandKundeOrgNr'),
        linknavn: slug,
        kundelink: kundelink(slug),
        kunde_link: kundelink(slug),
        rolle: 'admin',
        system_type: 'handverker',
        redirectTo: rootBase() + 'reset.html',
        on_existing_user: 'magic_link',
        fallback: 'magic_link_or_reset'
      };

      var r;
      try{
        r = await withTimeout(c.functions.invoke('opprett-hand-kunde', {body: body}), 30000);
        if(r.error) throw r.error;
        if(r.data && (r.data.error || r.data.success === false || r.data.ok === false)) throw new Error(r.data.error || r.data.message || 'Edge Function feilet.');
      }catch(inviteError){
        console.warn('Invite feilet. Prøver magic link / glemt passord for eksisterende Auth-bruker:', inviteError);
        msg('Invite feilet eller er allerede brukt. Prøver magic link / glemt passord...');
        var fallbackMsg = await sendMagicOrReset(epost);
        msg(fallbackMsg);
        return;
      }

      var firmaId = r.data && r.data.firma && r.data.firma.id;
      if(firmaId){
        setVal('redigerHandKundeId', firmaId);
        await lagreValgteModuler(firmaId);
      }
      msg('Invitasjon sendt til ' + epost + '.');
      if(typeof window.handLastKundeliste === 'function') await window.handLastKundeliste();
      if(firmaId && typeof window.handFirmaLastModulerV21 === 'function') setTimeout(window.handFirmaLastModulerV21, 400);
    }catch(e){
      msg('Feil ved invitasjon/magic link: ' + (e && e.message ? e.message : e), true);
    }
  };

  document.addEventListener('click', function(ev){
    var b = ev.target && ev.target.closest && ev.target.closest('button[onclick*="handSendPassordopprettingDirekte"]');
    if(!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    window.handSendPassordopprettingDirekte();
    return false;
  }, true);
})();
