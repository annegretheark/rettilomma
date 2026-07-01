window.addEventListener("load", function () {
  async function nodLoggInn() {
    const loginMelding = document.getElementById("loginMelding");
    if (loginMelding) loginMelding.textContent = "";

    const email = document.getElementById("loginEpost")?.value?.trim()?.toLowerCase() || "";
    const password = document.getElementById("loginPassord")?.value || "";
    const vilAdmin = document.getElementById("loginSomAdmin")?.checked === true;

    if (!email || !password) {
      if (loginMelding) loginMelding.textContent = "Skriv inn e-post og passord.";
      return;
    }

    if (!window.supabaseClient || !supabaseClient.auth) {
      if (loginMelding) loginMelding.textContent = "Supabase er ikke lastet. Sjekk js/core/config.js.";
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      if (loginMelding) loginMelding.textContent = "Innlogging feilet: " + error.message;
      return;
    }

    window.innloggetEpost = email;
    localStorage.setItem("handInnloggetEpost", email);
    localStorage.removeItem("rilSysadminModus");
    if (typeof window.settInnloggetBrukerVisning === "function") window.settInnloggetBrukerVisning();
    window.erAdmin = false;

    let ansattData = null;

    try {
      const { data, error: ansattError } = await supabaseClient
        .from("hand_ansatt")
        .select("*")
        .eq("epost", email)
        .limit(1);

      if (!ansattError && Array.isArray(data) && data.length) {
        ansattData = data[0];
        window.innloggetAnsattId = ansattData.id || "";
      }
    } catch (e) {
      console.warn("Kunne ikke hente ansattdata i n\u00F8dinnlogging:", e);
    }

    const rolle = String(ansattData?.rolle || "").toLowerCase();
    window.innloggetRolle = rolle;

    // Systembruker skal alltid ha rettighet til både vanlig bruker, admin og systemadmin.
    // Aktiv visning styres fortsatt av vilAdmin/rilSysadminModus.
    const erSystembruker = false;
    const harSystemadminRolle = erSystembruker || ["systemadmin", "sysadmin"].includes(rolle);
    const harAdminRolle = erSystembruker || ["admin", "systemadmin", "sysadmin"].includes(rolle);

    window.erSystemadmin = harSystemadminRolle;
    window.erAdmin = harAdminRolle && vilAdmin;
    localStorage.setItem("rilAdminModus", window.erAdmin ? "ja" : "nei");

    if (typeof window.visApp === "function") {
      await window.visApp();
    } else {
      const loginSide = document.getElementById("loginSide");
      const appSide = document.getElementById("appSide");
      if (loginSide) loginSide.classList.add("skjult");
      if (appSide) appSide.classList.remove("skjult");
    }

    if (window.erAdmin) {
      document.querySelectorAll(".admin-only").forEach(el => {
        el.style.display = "";
        el.classList.remove("skjult", "hidden");
      });
      if (typeof window.skjulAlleSider === "function") window.skjulAlleSider();
      if (typeof window.skjulSystemadminHvisIkkeSystemadmin === "function") window.skjulSystemadminHvisIkkeSystemadmin();
    } else {
      document.querySelectorAll(".admin-only").forEach(el => {
        el.style.display = "none";
        el.classList.add("skjult");
      });
      if (typeof window.visTimerSide === "function") window.visTimerSide();
    }
  }

  async function nodGlemtPassord() {
    const loginMelding = document.getElementById("loginMelding");
    const email = document.getElementById("loginEpost")?.value?.trim()?.toLowerCase() || "";

    if (!email) {
      if (loginMelding) loginMelding.textContent = "Skriv inn e-postadressen f\u00F8rst.";
      return;
    }

    if (!window.supabaseClient || !supabaseClient.auth) {
      if (loginMelding) loginMelding.textContent = "Supabase er ikke lastet. Sjekk js/core/config.js.";
      return;
    }

    const redirectUrl = window.location.origin + "/rettilomma/handverker/reset.html";

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (loginMelding) {
      loginMelding.textContent = error
        ? "Kunne ikke sende e-post: " + error.message
        : "E-post for tilbakestilling av passord er sendt.";
    }
  }

  if (typeof window.loggInn !== "function") {
    window.loggInn = nodLoggInn;
    console.warn("Bruker n\u00F8dinnlogging fordi hand-auth.js ikke registrerte window.loggInn.");
  }

  if (typeof window.glemtPassord !== "function") {
    window.glemtPassord = nodGlemtPassord;
  }

  const loginKnapp = document.getElementById("loginKnapp");
  if (loginKnapp) {
    loginKnapp.onclick = function () {
      window.loggInn();
    };
  }

  const glemtKnapp = document.getElementById("glemtPassordKnapp");
  if (glemtKnapp) {
    glemtKnapp.onclick = function () {
      window.glemtPassord();
    };
  }
});



window.addEventListener("load", function () {
  var backupKnapp = document.getElementById("backupKnapp");
  var importFil = document.getElementById("importFil");

  if (backupKnapp) {
    backupKnapp.onclick = function () {
      if (typeof window.backup === "function") {
        window.backup();
      } else {
        alert("Backup-funksjonen er ikke lastet. Sjekk js/hand-backup.js.");
      }
    };
  }

  if (importFil) {
    importFil.onchange = function (event) {
      if (typeof window.importerBackup === "function") {
        window.importerBackup(event);
      } else {
        alert("Restore-funksjonen er ikke lastet. Sjekk js/hand-backup.js.");
      }
    };
  }
});



window.addEventListener("load", function () {
  const loginKnapp = document.getElementById("loginKnapp");
  const glemtKnapp = document.getElementById("glemtPassordKnapp");

  if (loginKnapp) {
    loginKnapp.onclick = function () {
      if (typeof window.loggInn === "function") {
        window.loggInn();
        return;
      }

      const melding = document.getElementById("loginMelding");
      if (melding) {
        melding.textContent =
          "Innlogging er ikke klar. Sjekk at js/hand-auth.js og js/core/config.js ligger riktig.";
      }
    };
  }

  if (glemtKnapp) {
    glemtKnapp.onclick = function () {
      if (typeof window.glemtPassord === "function") {
        window.glemtPassord();
        return;
      }

      const melding = document.getElementById("loginMelding");
      if (melding) {
        melding.textContent =
          "Glemt passord er ikke klar. Sjekk at js/hand-auth.js er lastet.";
      }
    };
  }
});



// N\u00D8D-FIX 7063: s\u00F8rger for at Lagre bil alltid er klikkbar selv om en annen fil overskriver onclick.
(function () {
  function $(id) { return document.getElementById(id); }
  function msg(t, feil) {
    var m = $("bilMelding");
    if (m) { m.textContent = t || ""; m.style.color = feil ? "#fca5a5" : "#86efac"; }
    if (feil) console.error(t); else if (t) console.log(t);
  }
  function visBilSkjemaNod() {
    var o = $("bilSkjemaOmrade");
    var r = $("bilSkjemaRad");
    var k = $("lagreBilKnapp");
    if (o) { o.classList.remove("skjult", "hidden", "modul-skjult"); o.style.display = "block"; }
    if (r) { r.classList.remove("skjult", "hidden", "modul-skjult"); r.style.display = "grid"; }
    if (k) { k.style.display = "inline-block"; k.disabled = false; k.textContent = "\uD83D\uDCBE Lagre bil"; }
  }
  async function lagreBilNod() {
    try {
      visBilSkjemaNod();
      msg("Lagrer bil...");
      if (!window.supabaseClient) { msg("Supabase er ikke lastet. Sjekk js/core/config.js.", true); return; }
      var id = ($("bilId") && $("bilId").value || "").trim();
      var navn = ($("bilNavn") && $("bilNavn").value || "").trim();
      var regnr = ($("bilRegnr") && $("bilRegnr").value || "").trim();
      if (!navn && !regnr) { msg("Skriv bilnavn eller regnr.", true); alert("Skriv bilnavn eller regnr."); return; }
      var rad = { navn: navn || regnr, regnr: regnr || null, aktiv: true };
      var q = id
        ? window.supabaseClient.from("hand_bil").update(rad).eq("id", id).select().single()
        : window.supabaseClient.from("hand_bil").insert([rad]).select().single();
      var res = await q;
      if (res.error && String(res.error.message || "").toLowerCase().includes("aktiv")) {
        var rad2 = { navn: navn || regnr, regnr: regnr || null };
        res = id
          ? await window.supabaseClient.from("hand_bil").update(rad2).eq("id", id).select().single()
          : await window.supabaseClient.from("hand_bil").insert([rad2]).select().single();
      }
      if (res.error) { msg("Kunne ikke lagre bil: " + res.error.message, true); alert("Kunne ikke lagre bil: " + res.error.message); return; }
      if (res.data && res.data.id) {
        localStorage.setItem("aktivBilId", String(res.data.id));
        localStorage.setItem("aktivBilNavn", (res.data.navn || "Bil") + (res.data.regnr ? " - " + res.data.regnr : ""));
        window.aktivBilId = String(res.data.id);
      }
      if ($("bilId")) $("bilId").value = "";
      if ($("bilNavn")) $("bilNavn").value = "";
      if ($("bilRegnr")) $("bilRegnr").value = "";
      msg(id ? "Bil oppdatert." : "Ny bil lagret.");
      if (typeof window.lastBilerOgBilLager === "function") await window.lastBilerOgBilLager();
      else if (typeof window.lastBiler === "function") await window.lastBiler();
    } catch (e) {
      var tekst = "Feil ved lagring av bil: " + (e && e.message ? e.message : String(e));
      msg(tekst, true); alert(tekst);
    }
  }
  function koble() {
    visBilSkjemaNod();
    var ny = $("nyBilKnapp");
    var lagre = $("lagreBilKnapp");
    if (ny) ny.onclick = function (e) { if (e) e.preventDefault(); visBilSkjemaNod(); if ($("bilNavn")) $("bilNavn").focus(); };
    if (lagre) lagre.onclick = function (e) { if (e) e.preventDefault(); return lagreBilNod(); };
    window.lagreBilNod = lagreBilNod;
  }
  document.addEventListener("DOMContentLoaded", koble);
  window.addEventListener("load", koble);
  setTimeout(koble, 500);
})();



// FIX 7067: Jobboversikt skal ikke vise rene utlegg/refusjon-rader med 0 kr som egne jobber.
(function () {
  function tekst(e) { return (e && e.textContent ? e.textContent : "").trim(); }
  function erNullKroner(t) {
    var x = String(t || "").replace(/\s+/g, "").toLowerCase();
    return x === "0kr" || x === "0,00kr" || x === "0.00kr" || x === "0";
  }
  function ryddJobbListe() {
    var c = document.getElementById("jobberListe");
    if (!c) return;
    var rader = Array.from(c.querySelectorAll("tbody tr"));
    rader.forEach(function (tr) {
      var celler = Array.from(tr.children);
      if (!celler.length) return;
      var radtekst = tekst(tr).toLowerCase();
      var beskrivelse = celler[4] ? tekst(celler[4]).toLowerCase() : radtekst;
      var belop = celler[5] ? tekst(celler[5]) : "";
      var erRenUtleggRad = beskrivelse.indexOf("utlegg/refusjon") !== -1 || radtekst.indexOf("utlegg/refusjon") !== -1;
      if (erRenUtleggRad && erNullKroner(belop)) {
        tr.style.display = "none";
        tr.setAttribute("data-skjult-utlegg-null", "ja");
      }
    });
  }
  var gammelVisJobberSide = window.visJobberSide;
  if (typeof gammelVisJobberSide === "function") {
    window.visJobberSide = async function () {
      var res = await gammelVisJobberSide.apply(this, arguments);
      setTimeout(ryddJobbListe, 100);
      setTimeout(ryddJobbListe, 600);
      return res;
    };
  }
  document.addEventListener("DOMContentLoaded", function () {
    ryddJobbListe();
    var c = document.getElementById("jobberListe");
    if (c && window.MutationObserver) {
      new MutationObserver(function () { ryddJobbListe(); }).observe(c, { childList: true, subtree: true });
    }
    var k = document.getElementById("oppdaterJobberKnapp");
    if (k) k.addEventListener("click", function () { setTimeout(ryddJobbListe, 400); });
  });
  window.ryddJobbListe = ryddJobbListe;
})();



// HAND: vis innlogget bruker tydelig på første side
(function () {
  function finnSupabaseEpostFraLocalStorage() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf("sb-") !== 0) continue;
        var raw = localStorage.getItem(key);
        if (!raw) continue;
        var data = JSON.parse(raw);
        if (data && data.user && data.user.email) return data.user.email;
      }
    } catch (e) {}
    return "";
  }

  function settInnloggetBrukerVisning() {
    var epost =
      window.innloggetEpost ||
      window.innloggetBrukerEpost ||
      localStorage.getItem("handInnloggetEpost") ||
      localStorage.getItem("innloggetEpost") ||
      finnSupabaseEpostFraLocalStorage() ||
      "";

    var erSystembruker = false;
    if (erSystembruker) {
      window.erSystemadmin = true;
      window.erAdmin = true;
      if (!window.innloggetRolle || window.innloggetRolle === "admin") window.innloggetRolle = "sysadmin";
    }
    var rolle = erSystembruker ? "sysadmin" : (window.innloggetRolle || "");
    var erAdmin = window.erAdmin ? "adminmodus" : "";
    var erSys = window.erSystemadmin ? "sysadm" : "";
    var visning = document.getElementById("innloggetBrukerVisning");
    var rolleVisning = document.getElementById("innloggetRolleVisning");

    if (visning) {
      visning.textContent = epost || "Ikke innlogget / ukjent bruker";
    }

    if (rolleVisning) {
      var deler = [];
      if (rolle) deler.push("rolle: " + rolle);
      if (erSys) deler.push(erSys);
      if (erAdmin) deler.push(erAdmin);
      rolleVisning.textContent = deler.length ? " (" + deler.join(", ") + ")" : "";
    }
  }

  window.settInnloggetBrukerVisning = settInnloggetBrukerVisning;

  document.addEventListener("DOMContentLoaded", settInnloggetBrukerVisning);
  window.addEventListener("load", function () {
    settInnloggetBrukerVisning();
    setTimeout(settInnloggetBrukerVisning, 500);
    setTimeout(settInnloggetBrukerVisning, 1500);
  });
})();






// HAND SPLIT: enkel systemadmin- og visningskontroll
(function(){
  function harAktivSession(){
    // Ikke bruk gammel e-post i localStorage som bevis på innlogging.
    // Ved kundelink uten aktiv Supabase-session skal login-siden vises, ikke skjules.
    return !!String(window.innloggetEpost || "").toLowerCase();
  }
  function email(){ return String(window.innloggetEpost || "").toLowerCase(); }
  function erSystembruker(){ return window.erSystemadmin === true || rolle() === "sysadmin" || rolle() === "systemadmin"; }
  function sysAktiv(){ return erSystembruker() && localStorage.getItem("rilSysadminModus") === "ja"; }
  function vis(id, ja){
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("skjult", !ja);
    el.classList.toggle("hidden", !ja);
    el.style.display = ja ? "" : "none";
  }
  function oppdater(){
    var sys = sysAktiv();
    if (erSystembruker()) {
      // Systembruker skal aldri nedgraderes til vanlig admin av en ansatt-rad.
      window.erAdmin = true;
      window.erSystemadmin = true;
      window.innloggetRolle = "sysadmin";
      localStorage.setItem("rilAdminModus", "ja");
    } else {
      window.erSystemadmin = sys;
    }

    // Skjul aldri login-siden her hvis brukeren ikke faktisk er innlogget.
    // startApp()/visLogin() bestemmer login-visning.
    if (harAktivSession()) vis("loginSide", false);

    document.querySelectorAll(".systemadmin-only, .sysadmin-entry").forEach(function(el){
      var show = erSystembruker() && !sys;
      el.classList.toggle("skjult", !show);
      el.classList.toggle("hidden", !show);
      el.style.display = show ? "" : "none";
    });

    document.querySelectorAll(".systemadmin-only").forEach(function(el){
      var show = sys;
      el.classList.toggle("skjult", !show);
      el.classList.toggle("hidden", !show);
      el.style.display = show ? "" : "none";
    });

    if (sys && typeof window.skjulAlleSider === "function") {
      window.skjulAlleSider();
      vis("appSide", true);
      vis("sysadminPanelSide", true);
      if (typeof window.handLastKundeliste === "function") setTimeout(window.handLastKundeliste, 200);
    }
  }
  function bind(){
    var b = document.getElementById("sysadminModeKnapp");
    if (b && b.dataset.handSplitSys !== "1") {
      b.dataset.handSplitSys = "1";
      b.onclick = function(e){
        if (e) e.preventDefault();
        if (typeof window.handVisSysadminPanel === "function") {
          window.handVisSysadminPanel();
          return false;
        }
        localStorage.setItem("rilSysadminModus","ja");
        oppdater();
        return false;
      };
    }
    var t = document.getElementById("sysadminTilAdminKnapp");
    if (t && t.dataset.handSplitBack !== "1") {
      t.dataset.handSplitBack = "1";
      t.onclick = function(){ localStorage.removeItem("rilSysadminModus"); oppdater(); if (typeof window.visTimerSide === "function") window.visTimerSide(); };
    }
    var ny = document.getElementById("sysadminNyKundeKnapp");
    if (ny && ny.dataset.handSplitNy !== "1") {
      ny.dataset.handSplitNy = "1";
      ny.onclick = function(){ if (typeof window.handNullstillKundeSkjema === "function") window.handNullstillKundeSkjema(); document.getElementById("nyHandKundeNavn")?.focus(); };
    }
    var liste = document.getElementById("sysadminKundelisteKnapp");
    if (liste && liste.dataset.handSplitListe !== "1") {
      liste.dataset.handSplitListe = "1";
      liste.onclick = function(){ if (typeof window.handLastKundeliste === "function") window.handLastKundeliste(); };
    }
    var mod = document.getElementById("sysadminModulerKnapp");
    if (mod && mod.dataset.handSplitMod !== "1") {
      mod.dataset.handSplitMod = "1";
      mod.onclick = function(){ if (typeof window.visModulerSide === "function") window.visModulerSide(); };
    }
  }
  window.handOppdaterSplitUi = oppdater;
  document.addEventListener("DOMContentLoaded", function(){ bind(); setTimeout(oppdater, 300); });
  window.addEventListener("load", function(){ bind(); setTimeout(oppdater, 300); });
  document.addEventListener("click", function(ev){
    if (ev.target && ev.target.id === "loginKnapp") {
      setTimeout(function(){ bind(); oppdater(); }, 1000);
    }
  });
})();/*
  Handverker final fix 2026-06-20
  - Systembruker skal aldri nedgraderes fra sysadmin
  - Firma/kundeliste skal lastes for sysadmin
  - Ny kunde får firma-rad + adminrad; Auth må opprettes av Edge Function/opprett-hand-kunde
*/
(function () {
  
  function $(id) { return document.getElementById(id); }
  function norm(v) { return String(v || '').trim().toLowerCase(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function slugify(v) {
    return String(v || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function appBase() {
    const p = location.pathname.toLowerCase();
    if (p.includes('/rettilomma/')) return location.origin + '/rettilomma/handverker/';
    if (p.includes('/handverker/')) return location.origin + '/handverker/';
    return location.origin + '/handverker/';
  }
  function kundelink(slug) { return appBase() + '?firma=' + encodeURIComponent(slug || ''); }

  async function sessionEmail() {
    try {
      const r = await window.supabaseClient?.auth?.getSession();
      const e = norm(r?.data?.session?.user?.email);
      if (e) return e;
    } catch (e) {}
    return norm(window.innloggetEpost || localStorage.getItem('handInnloggetEpost'));
  }

  function erRolleSystemadmin() {
    const r = norm(window.innloggetRolle || localStorage.getItem('handInnloggetRolle') || localStorage.getItem('innloggetRolle'));
    return window.erSystemadmin === true || r === 'sysadmin' || r === 'systemadmin';
  }

  function forceSystembruker(email) {
    if (!erRolleSystemadmin()) return false;
    window.erSystemadmin = true;
    window.erAdmin = true;
    localStorage.setItem('rilAdminModus', 'ja');
    return true;
  }

  async function ensureSystembrukerAnsattRow() {
    // Ingen hardkodet systemadmin-e-post. Tilgang styres av rolle/RPC i databasen.
    return;
  }

  async function hentAlleFirmaRobust() {
    await ensureSystembrukerAnsattRow();
    const forsok = [
      ['hand_firma', '*', 'navn'],
      ['hand_firma', '*', 'firmanavn'],
      ['hand_firma', '*', null],
      ['hand_kunder', '*', 'navn'],
      ['hand_kunder', '*', 'firmanavn'],
      ['hand_kunder', '*', null]
    ];
    let sisteFeil = null;
    for (const [tabell, felt, order] of forsok) {
      try {
        let q = supabaseClient.from(tabell).select(felt);
        if (order) q = q.order(order, { ascending: true });
        const r = await q;
        if (!r.error && Array.isArray(r.data)) return { data: r.data, error: null, tabell };
        if (r.error) sisteFeil = r.error;
      } catch (e) { sisteFeil = e; }
    }
    return { data: [], error: sisteFeil, tabell: '' };
  }

  async function visKundeliste() {
    const liste = $('handKundeAdminListe');
    if (!liste || !window.supabaseClient) return;
    const email = await sessionEmail();
    if (!forceSystembruker(email)) {
      liste.innerHTML = '<div class="melding">Bare sysadmin kan se alle firma.</div>';
      return;
    }
    liste.innerHTML = '<div class="info">Henter firma/kunder...</div>';
    const r = await hentAlleFirmaRobust();
    window.handAdminKunder = r.data || [];
    if (!window.handAdminKunder.length) {
      liste.innerHTML = '<div class="melding">Ingen firma vises. Du er sysadmin i appen, men databasen returnerte ingen rader. Hvis det finnes firma i Supabase, sjekk RLS/select-policy for hand_firma mot systemadmin-rolle eller rolle=sysadmin i hand_ansatt.</div>';
      return;
    }
    liste.innerHTML = '<div class="info">Fant ' + window.handAdminKunder.length + ' firma/kunder.</div>' +
      '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>' +
      '<th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Firma</th>' +
      '<th style="text-align:left;padding:6px;border-bottom:1px solid #374151">E-post</th>' +
      '<th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Kundelink</th>' +
      '<th style="text-align:left;padding:6px;border-bottom:1px solid #374151">Handling</th>' +
      '</tr></thead><tbody>' + window.handAdminKunder.map(k => {
        const navn = k.navn || k.firmanavn || k.firma_navn || k.company || k.epost || k.email || k.id;
        const slug = k.linknavn || k.slug || slugify(navn);
        const lnk = k.kundelink || k.kunde_link || kundelink(slug);
        return '<tr><td style="padding:6px;border-bottom:1px solid #374151">' + esc(navn) + '</td>' +
          '<td style="padding:6px;border-bottom:1px solid #374151">' + esc(k.epost || k.email || '') + '</td>' +
          '<td style="padding:6px;border-bottom:1px solid #374151"><a href="' + esc(lnk) + '" target="_blank" style="color:#93c5fd">' + esc(slug) + '</a></td>' +
          '<td style="padding:6px;border-bottom:1px solid #374151;white-space:nowrap"><button type="button" class="secondary" onclick="handRedigerKunde(\'' + esc(k.id) + '\')">Rediger</button> <button type="button" class="secondary" onclick="handKopierTekst(\'' + esc(lnk) + '\')">Kopier</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function visSysadminPanel() {
    const current = norm(window.innloggetEpost || localStorage.getItem('handInnloggetEpost'));
    if (erRolleSystemadmin()) forceSystembruker(current);
    window.erSystemadmin = true;
    window.erAdmin = true;
    localStorage.setItem('rilSysadminModus', 'ja');
    localStorage.setItem('rilAdminModus', 'ja');
    if (typeof window.skjulAlleSider === 'function') window.skjulAlleSider();
    const app = $('appSide');
    const panel = $('sysadminPanelSide');
    if (app) { app.classList.remove('skjult','hidden'); app.style.display = ''; }
    if (panel) { panel.classList.remove('skjult','hidden'); panel.style.display = ''; }
    setTimeout(visKundeliste, 100);
  }

  function tilbakeTilAdmin() {
    localStorage.removeItem('rilSysadminModus');
    forceSystembruker();
    if (typeof window.visTimerSide === 'function') window.visTimerSide();
  }

  function bind() {
    forceSystembruker();
    const sysBtn = $('sysadminModeKnapp');
    if (sysBtn) {
      const visKnapp = erRolleSystemadmin() &&
        localStorage.getItem('rilSysadminModus') !== 'ja';
      sysBtn.classList.toggle('skjult', !visKnapp);
      sysBtn.classList.toggle('hidden', !visKnapp);
      sysBtn.style.display = visKnapp ? '' : 'none';
      sysBtn.onclick = function (e) { e.preventDefault(); visSysadminPanel(); return false; };
    }
    const listeBtn = $('sysadminKundelisteKnapp');
    if (listeBtn) listeBtn.onclick = function (e) { e.preventDefault(); visKundeliste(); return false; };
    const tilbake = $('sysadminTilAdminKnapp');
    if (tilbake) tilbake.onclick = function (e) { e.preventDefault(); tilbakeTilAdmin(); return false; };
  }

  window.handForceSystembrukerSysadmin = async function () {
    const email = await sessionEmail();
    forceSystembruker(email);
    await ensureSystembrukerAnsattRow();
    bind();
    return false;
  };
  window.handLastKundeliste = visKundeliste;
  window.handVisSysadminPanel = visSysadminPanel;

  const gammelSett = window.settInnloggetBrukerVisning;
  window.settInnloggetBrukerVisning = function () {
    if (typeof gammelSett === 'function') gammelSett.apply(this, arguments);
    forceSystembruker();
  };

  document.addEventListener('DOMContentLoaded', function () { bind(); setTimeout(bind, 500); setTimeout(ensureSystembrukerAnsattRow, 1200); });
  document.addEventListener('handPartialerLastet', function () { bind(); setTimeout(bind, 300); });
  window.addEventListener('load', function () { bind(); setTimeout(bind, 500); setTimeout(ensureSystembrukerAnsattRow, 1000); });
  // removed prod blink loop
})();


// PROD logout binding
(function(){
  function bindLogout(){
    const btn = document.getElementById("loggUtKnapp");
    if (!btn || btn.dataset.logoutBound === "1") return;
    btn.dataset.logoutBound = "1";
    btn.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.handLoggUtHardt === "function") {
        window.handLoggUtHardt(e);
      } else if (typeof window.loggUt === "function") {
        window.loggUt(e);
      } else {
        window.location.href = btn.getAttribute("href") || "./logout.html";
      }
    });
  }
  document.addEventListener("handPartialerLastet", bindLogout);
  document.addEventListener("DOMContentLoaded", bindLogout);
  window.addEventListener("load", bindLogout);
  setTimeout(bindLogout, 1000);
})();
