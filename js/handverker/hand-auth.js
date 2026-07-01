let innloggetEpost = "";
let innloggetAnsattId = "";

let erAdmin = false;
window.erAdmin = false;

window.innloggetAnsattId = "";

window.aktivBilId = window.aktivBilId || "";
window.aktivBilNavn = window.aktivBilNavn || "";

function settAktivBil(bilId, bilNavn) {
  window.aktivBilId = bilId ? String(bilId) : "";
  window.aktivBilNavn = bilNavn || "";

  if (window.aktivBilId) {
    localStorage.setItem("aktivBilId", window.aktivBilId);
    localStorage.setItem("aktivBilNavn", window.aktivBilNavn);
  } else {
    localStorage.removeItem("aktivBilId");
    localStorage.removeItem("aktivBilNavn");
  }

  if (typeof window.oppdaterAktivBilVisning === "function") {
    window.oppdaterAktivBilVisning();
  }
}

async function velgAktivBilVedInnlogging(ansattData) {
  try {
    const { data: biler, error } = await supabaseClient
      .from("hand_bil")
      .select("*")
      .order("navn", { ascending: true });

    if (error || !biler || !biler.length) {
      settAktivBil("", "");
      return;
    }

    const standardBilId = ansattData?.standard_bil_id || ansattData?.bil_id || "";

    if (standardBilId) {
      const bil = biler.find(b => String(b.id) === String(standardBilId));
      if (bil) {
        settAktivBil(bil.id, `${bil.navn || "Bil"}${bil.regnr ? " - " + bil.regnr : ""}`);
        return;
      }
    }

    const lagretBilId = localStorage.getItem("aktivBilId") || "";
    if (lagretBilId) {
      const bil = biler.find(b => String(b.id) === String(lagretBilId));
      if (bil) {
        settAktivBil(bil.id, `${bil.navn || "Bil"}${bil.regnr ? " - " + bil.regnr : ""}`);
        return;
      }
    }

    if (biler.length === 1) {
      const bil = biler[0];
      settAktivBil(bil.id, `${bil.navn || "Bil"}${bil.regnr ? " - " + bil.regnr : ""}`);
      if (ansattData?.id) {
        await supabaseClient.from("hand_ansatt").update({ standard_bil_id: bil.id }).eq("id", ansattData.id);
      }
      return;
    }

    const tekst = biler
      .map((b, i) => `${i + 1}: ${b.navn || "Bil"}${b.regnr ? " - " + b.regnr : ""}`)
      .join("\n");

    const svar = prompt("Velg bil for denne arbeidsøkten:\n\n" + tekst + "\n\nSkriv nummer:");
    const indeks = Number(svar) - 1;

    if (Number.isInteger(indeks) && biler[indeks]) {
      const bil = biler[indeks];
      settAktivBil(bil.id, `${bil.navn || "Bil"}${bil.regnr ? " - " + bil.regnr : ""}`);

      if (ansattData?.id && confirm("Skal denne bilen lagres som standard bil for brukeren?")) {
        await supabaseClient.from("hand_ansatt").update({ standard_bil_id: bil.id }).eq("id", ansattData.id);
      }
    } else {
      settAktivBil("", "");
    }
  } catch (e) {
    console.warn("Kunne ikke velge aktiv bil:", e);
  }
}

function skjulForVanligBruker() {

  const skjulKnapper = [
    "visKundeKnapp",
    "visAnsattKnapp",
    "visFirmaKnapp",
    "visTestKnapp",
    "visModulerKnapp",
    "visBackupKnapp",
    "visFakturaKnapp",
    "varerKnapp",
    "visLonnKnapp",
    "excelKnapp",
    "pdfKnapp",
    "backupKnapp",
    "kreditnotaKnapp",
    "importFil"
  ];

  skjulKnapper.forEach(id => {
    const el = document.getElementById(id);

    if (el) {
      el.style.display = "none";
    }
  });

  const lonnPanel =
    document.getElementById("lonnPanel");

  if (lonnPanel) {
    lonnPanel.style.display = "none";
  }

  const sider = [
    "kundeSide",
    "ansattSide",
    "firmaSide",
    "testSide",
    "modulerSide",
    "backupSide",
    "fakturaSide",
    "varerSide"
  ];

  sider.forEach(id => {
    const el = document.getElementById(id);

    if (el) {
      el.classList.add("skjult");
    }
  });
}

function visAltForAdmin() {

  const visKnapper = [
    "visKundeKnapp",
    "visAnsattKnapp",
    "visFirmaKnapp",
    "visTestKnapp",
    "visModulerKnapp",
    "visBackupKnapp",
    "visFakturaKnapp",
    "varerKnapp",
    "visLonnKnapp",
    "excelKnapp",
    "pdfKnapp",
    "backupKnapp",
    "kreditnotaKnapp",
    "importFil"
  ];

  visKnapper.forEach(id => {
    const el = document.getElementById(id);

    if (el) {
      el.style.display = "";
    }
  });

  const lonnPanel =
    document.getElementById("lonnPanel");

  if (lonnPanel) {
    lonnPanel.style.display = "";
  }
}


function gaaTilModulvalg(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  if (typeof window.handAapneSysadmPanel === "function") return window.handAapneSysadmPanel(event);
  localStorage.setItem("rilSysadminModus", "ja");
  const panel = document.getElementById("sysadminPanelSide");
  if (panel) {
    if (typeof window.skjulAlleSider === "function") window.skjulAlleSider();
    panel.classList.remove("skjult", "hidden", "modul-skjult");
    panel.style.display = "";
    return false;
  }
  return false;
}

function erInnloggetSystemadmin() {
  const rolle = String(
    window.innloggetRolle ||
    localStorage.getItem("handInnloggetRolle") ||
    ""
  ).toLowerCase();

  return (
    window.erSystemadmin === true ||
    localStorage.getItem("rilSysadminModus") === "ja" ||
    window.handErGlobalSysadm === true ||
    rolle === "sysadm" ||
    rolle === "sysadmin" ||
    rolle === "systemadmin"
  );
}

function visModulvalgKnappHvisSystemadmin(email) {
  const erSystemadmin = erInnloggetSystemadmin();
  let knapp = document.getElementById("velgModulKnapp");

  if (!knapp) {
    const loggUtKnapp = document.getElementById("loggUtKnapp");
    knapp = document.createElement("button");
    knapp.id = "velgModulKnapp";
    knapp.type = "button";
    knapp.className = "secondary systemadmin-only";
    knapp.textContent = "SysAdm";
    knapp.onclick = function(event){ return gaaTilModulvalg(event); };

    if (loggUtKnapp && loggUtKnapp.parentNode) {
      loggUtKnapp.parentNode.insertBefore(knapp, loggUtKnapp);
    } else if (document.body) {
      document.body.appendChild(knapp);
    }
  }

  if (erSystemadmin) {
    knapp.hidden = false;
    knapp.disabled = false;
    knapp.classList.remove("hidden", "skjult", "modul-skjult");
    knapp.style.display = "";
    knapp.style.visibility = "";
    knapp.removeAttribute("aria-hidden");
  } else {
    knapp.hidden = true;
    knapp.disabled = true;
    knapp.classList.add("hidden", "skjult");
    knapp.style.display = "none";
    knapp.setAttribute("aria-hidden", "true");
  }
}

function oppdaterSysadmKnapp(email) {
  visModulvalgKnappHvisSystemadmin(email);
  if (typeof window.oppdaterAdminVisning === "function") window.oppdaterAdminVisning();
}

async function loggInn() {
  document.documentElement.classList.remove("ril-admin-ready");
  const loginMelding = document.getElementById("loginMelding");
  loginMelding.textContent = "";

  const email = document.getElementById("loginEpost").value.trim().toLowerCase();
  const password = document.getElementById("loginPassord").value;
  const vilAdmin = document.getElementById("loginSomAdmin")?.checked === true;

  if (!email || !password) {
    loginMelding.textContent = "Skriv inn e-post og passord.";
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    loginMelding.textContent =
      "Innlogging feilet: " + error.message;

    return;
  }

  innloggetEpost = email;
  window.innloggetEpost = email;
  window.erSystemadmin = false;
  var handErSystemadminFraTabell = false;
  try {
    const sr = await supabaseClient.from("hand_sysadm").select("id").ilike("epost", email).eq("aktiv", true).limit(1);
    if (!sr.error && sr.data && sr.data.length) handErSystemadminFraTabell = true;
  } catch (_) {}
  if (!handErSystemadminFraTabell && email === "greknuts@online.no") handErSystemadminFraTabell = true;
  if (!handErSystemadminFraTabell) {
    window.erSystemadmin = false;
    localStorage.removeItem("rilSysadminModus");
  }
    localStorage.setItem("handInnloggetEpost", email);
    if (typeof window.settInnloggetBrukerVisning === "function") window.settInnloggetBrukerVisning();
  localStorage.setItem("rettilommaSistEpost", email);
  localStorage.setItem("rettilommaValgtModul", "handverker");

  innloggetAnsattId = "";
  window.innloggetAnsattId = "";

  erAdmin = false;
  window.erAdmin = false;

  // RIL FIX: finn faktisk innlogget hand_ansatt først på Auth user_id, deretter e-post.
  // Dette hindrer at jobber/utlegg lagres på firmaeier/admin-raden når en vanlig ansatt er innlogget.
  const authUserId = String((await supabaseClient.auth.getUser())?.data?.user?.id || "").trim();
  window.innloggetUserId = authUserId;
  try {
    localStorage.setItem("innloggetUserId", authUserId);
    localStorage.setItem("authUserId", authUserId);
    localStorage.setItem("innloggetEpost", email);
  } catch (_) {}

  let ansattRader = [];
  let ansattError = null;

  if (authUserId) {
    const r = await supabaseClient
      .from("hand_ansatt")
      .select("*")
      .eq("user_id", authUserId)
      .neq("aktiv", false)
      .limit(1);
    ansattRader = r.data || [];
    ansattError = r.error || null;
  }

  if ((!ansattRader || !ansattRader.length) && email) {
    const r = await supabaseClient
      .from("hand_ansatt")
      .select("*")
      .ilike("epost", email)
      .neq("aktiv", false)
      .limit(1);
    ansattRader = r.data || [];
    ansattError = r.error || null;
  }

  if (ansattError) {

    console.error(
      "Feil ved henting av innlogget ansatt:",
      ansattError
    );

    loginMelding.textContent =
      "Innlogging ok, men kunne ikke hente ansattdata: " +
      ansattError.message;

    await supabaseClient.auth.signOut();

    return;
  }

  const ansattData =
    Array.isArray(ansattRader) &&
    ansattRader.length
      ? ansattRader[0]
      : null;

  if (ansattData && ansattData.id) {
    innloggetAnsattId = ansattData.id;
    window.innloggetAnsattId = ansattData.id;
  }

  // Aktiv/tildelt bil settes etter at app-HTML er vist, slik at bilValg/dropdown finnes.

  // RIL FIX: hand_firma_bruker er eier/admin-kilden.
  // Admin skal bruke firma_id derfra, men vanlige ansatte beholder sin egen hand_ansatt.id.
  let firmaBrukerData = null;
  try {
    let q = supabaseClient.from("hand_firma_bruker").select("firma_id, rolle, epost, user_id").limit(1);
    if (authUserId) q = q.eq("user_id", authUserId);
    else q = q.ilike("epost", email);
    let r = await q.maybeSingle();
    if ((!r || r.error || !r.data) && email) {
      r = await supabaseClient
        .from("hand_firma_bruker")
        .select("firma_id, rolle, epost, user_id")
        .ilike("epost", email)
        .limit(1)
        .maybeSingle();
    }
    if (!r.error && r.data) {
      firmaBrukerData = r.data;
      if (r.data.firma_id) {
        window.aktivFirmaId = r.data.firma_id;
        try {
          localStorage.setItem("aktivFirmaId", r.data.firma_id);
          localStorage.setItem("firmaId", r.data.firma_id);
          localStorage.setItem("firma_id", r.data.firma_id);
        } catch (_) {}
      }
    }
  } catch (e) {
    console.warn("Kunne ikke sjekke hand_firma_bruker:", e);
  }

  let rolle = String(firmaBrukerData?.rolle || ansattData?.rolle || "").toLowerCase();

  // Hovedregel: E-posten som ligger på håndverkerfirmaet/kunden
  // er firmaets eier og skal automatisk være admin, selv om
  // adminraden i hand_ansatt mangler eller ble stoppet av RLS/kolonner.
  let erFirmaEierAdmin = false;
  let firmaEierRad = null;
  try {
    const firmaTabeller = ["hand_firma", "hand_kunder", "hand_kunde"];
    for (const tabell of firmaTabeller) {
      for (const felt of ["epost", "email"]) {
        try {
          const r = await supabaseClient.from(tabell).select("*").eq(felt, email).limit(1);
          if (!r.error && r.data && r.data.length) {
            erFirmaEierAdmin = true;
            firmaEierRad = r.data[0];
            break;
          }
        } catch (_) {}
      }
      if (erFirmaEierAdmin) break;
    }
  } catch (e) {
    console.warn("Kunne ikke sjekke om innlogget e-post er firmaeier:", e);
  }

  if (!rolle && erFirmaEierAdmin) rolle = "admin";
  if (handErSystemadminFraTabell) rolle = "sysadm";
  window.innloggetRolle = rolle;
  const harAdminRolle =
    rolle === "admin" ||
    rolle === "administrator" ||
    rolle === "eier" ||
    rolle === "owner" ||
    rolle === "sysadm" ||
    rolle === "systemadmin" ||
    rolle === "sysadmin" ||
    erFirmaEierAdmin ||
    false;

  erAdmin = harAdminRolle;
  window.erAdmin = harAdminRolle;
  window.erSystemadmin =
    rolle === "sysadm" ||
    rolle === "sysadm" ||
    rolle === "systemadmin" ||
    rolle === "sysadmin" ||
    handErSystemadminFraTabell;
  document.documentElement.classList.add("ril-auth-ready");
  document.documentElement.classList.toggle("ril-admin-ready", !!harAdminRolle);

  localStorage.setItem("rilAdminModus", harAdminRolle ? "ja" : "nei");
  localStorage.setItem("handInnloggetRolle", rolle || (harAdminRolle ? "admin" : "bruker"));
  if (firmaEierRad && firmaEierRad.id) {
    window.aktivFirmaId = firmaEierRad.id;
    localStorage.setItem("aktivFirmaId", firmaEierRad.id);
    localStorage.setItem("firmaId", firmaEierRad.id);
  }

  if (erFirmaEierAdmin && (!ansattData || !ansattData.id)) {
    try {
      const firmaId = firmaEierRad?.id || null;
      await supabaseClient.from("hand_ansatt").insert([{
        firma_id: firmaId,
        navn: firmaEierRad?.navn || firmaEierRad?.firmanavn || firmaEierRad?.firma_navn || email,
        epost: email,
        rolle: "admin",
        er_admin: true,
        aktiv: true
      }]);
    } catch (e) {
      console.warn("Kunne ikke auto-opprette adminrad for firmaeier:", e);
    }
  }

  if (handErSystemadminFraTabell) {
    window.erAdmin = true;
    window.erSystemadmin = true;
    localStorage.setItem("rilAdminModus", "ja");
    localStorage.setItem("rilSysadminModus", "ja");
    localStorage.setItem("handInnloggetRolle", "sysadm");
  }

  oppdaterSysadmKnapp(email);

  const maaByttePassord =
    ansattData &&
    ansattData.ma_bytte_passord === true;

  if (maaByttePassord) {

    visNyttPassord();

    const melding =
      document.getElementById("nyttPassordMelding");

    if (melding) {
      melding.textContent =
        "Du må lage et nytt passord før du kan bruke systemet.";
    }

    return;
  }

  await visApp();

  // RIL FIX: SysAdm-knappen legges direkte på body etter at appen er vist.
  oppdaterSysadmKnapp(email);

  // RIL FIX: sett tildelt/standard bil ETTER at appen/timersiden er bygget.
  // Beholder riktig innlogget hand_ansatt for jobber, men lar auth styre bilen.
  try {
    await velgAktivBilVedInnlogging(ansattData);
    if (typeof window.oppdaterAktivBilVisning === "function") window.oppdaterAktivBilVisning();
    if (typeof window.fyllAlleBilvalg === "function") await window.fyllAlleBilvalg();
    if (typeof window.fyllVarevalgFraAktivBil === "function") await window.fyllVarevalgFraAktivBil();
  } catch (e) {
    console.warn("Kunne ikke sette tildelt bil etter innlogging:", e);
  }

  if (erAdmin) {
    visAltForAdmin();

    if (typeof window.visModulKnappHvisAdmin === "function") {
      window.visModulKnappHvisAdmin();
    }
    if (typeof skjulAlleSider === "function") {
      skjulAlleSider();
    }
  } else {
    skjulForVanligBruker();
    if (typeof visTimerSide === "function") {
      visTimerSide();
    }
  }

  oppdaterSysadmKnapp(email);
}

function handAppBaseUrl() {
  const path = window.location.pathname || "";
  const lower = path.toLowerCase();
  const marker = "/handverker/";
  const index = lower.lastIndexOf(marker);
  if (index >= 0) {
    return window.location.origin + path.slice(0, index + marker.length);
  }
  return "./";
}

function ryddHandLogoutLagring() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.forEach(function (key) {
      if (
        key === "rettilommaValgtModul" ||
        key === "rettilommaSistEpost" ||
        key === "handInnloggetEpost" ||
        key === "innloggetEpost" ||
        key === "handInnloggetRolle" ||
        key === "rilAdminModus" ||
        key === "rilSysadminModus" ||
        key === "aktivBilId" ||
        key === "aktivBilNavn" ||
        key === "aktivFirmaId" ||
        key === "firmaId" ||
        key === "firma_id" ||
        String(key || "").startsWith("sb-")
      ) {
        localStorage.removeItem(key);
      }
    });
    sessionStorage.clear();
  } catch (e) {}
}

async function handLoggUtHardt(event) {
  document.documentElement.classList.remove("ril-admin-ready");
  if (event && typeof event.preventDefault === "function") event.preventDefault();
  if (event && typeof event.stopPropagation === "function") event.stopPropagation();

  try {
    if (window.supabaseClient && window.supabaseClient.auth) {
      await Promise.race([
        window.supabaseClient.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 1200))
      ]);
    }
  } catch (e) {
    console.warn("signOut feilet, rydder lokalt likevel:", e);
  }

  ryddHandLogoutLagring();
  window.innloggetEpost = "";
  window.innloggetAnsattId = "";
  window.erAdmin = false;
  window.erSystemadmin = false;
  window.location.replace(handAppBaseUrl() + "index.html?logout=1&t=" + Date.now());
  return false;
}

async function loggUt(event) {
  return handLoggUtHardt(event);
}

async function glemtPassord() {

  const loginMelding =
    document.getElementById("loginMelding");

  loginMelding.textContent = "";

  const email =
    document.getElementById("loginEpost")
      .value
      .trim()
      .toLowerCase();

  if (!email) {

    loginMelding.textContent =
      "Skriv inn e-postadressen først.";

    return;
  }

  const redirectUrl = window.location.origin + "/rettilomma/handverker/reset.html";

  const { error } =
    await supabaseClient.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: redirectUrl
      }
    );

  if (error) {

    loginMelding.textContent =
      "Kunne ikke sende e-post: " +
      error.message;

    return;
  }

  loginMelding.textContent =
    "E-post for tilbakestilling av passord er sendt.";
}

async function lagreNyttPassord() {

  const melding =
    document.getElementById("nyttPassordMelding");

  const passord1 =
    document.getElementById("nyttPassord").value;

  const passord2 =
    document.getElementById("gjentaNyttPassord").value;

  melding.textContent = "";

  if (!passord1 || !passord2) {

    melding.textContent =
      "Skriv inn nytt passord to ganger.";

    return;
  }

  if (passord1 !== passord2) {

    melding.textContent =
      "Passordene er ikke like.";

    return;
  }

  const { error } =
    await supabaseClient.auth.updateUser({
      password: passord1
    });

  if (error) {

    melding.textContent =
      "Kunne ikke oppdatere passord: " +
      error.message;

    return;
  }

  if (innloggetEpost) {

    const { error: ansattError } =
      await supabaseClient
        .from("hand_ansatt")
        .update({
          ma_bytte_passord: false
        })
        .eq("epost", innloggetEpost);

    if (ansattError) {

      console.error(
        "Passord ble endret, men flagg ble ikke oppdatert:",
        ansattError
      );

      melding.textContent =
        "Passordet ble endret, men appen fikk ikke oppdatert ansattregisteret: " +
        ansattError.message;

      return;
    }
  }

  melding.textContent =
    "Passordet er endret. Logg inn på nytt.";

  await supabaseClient.auth.signOut();

  innloggetEpost = "";
  innloggetAnsattId = "";

  window.innloggetEpost = "";
  window.innloggetAnsattId = "";
  settAktivBil("", "");

  visLogin();
}



async function sendMagicLink() {
  const loginMelding = document.getElementById("loginMelding");
  if (loginMelding) loginMelding.textContent = "";

  const email = document
    .getElementById("loginEpost")
    .value
    .trim()
    .toLowerCase();

  if (!email) {
    if (loginMelding) loginMelding.textContent = "Skriv inn e-postadressen først.";
    return;
  }

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + "/rettilomma/handverker/"
    }
  });

  if (error) {
    if (loginMelding) loginMelding.textContent = "Kunne ikke sende Magic Link: " + error.message;
    return;
  }

  if (loginMelding) loginMelding.textContent = "Magic Link er sendt.";
}

window.loggInn = loggInn;
window.loggUt = loggUt;
window.handLoggUtHardt = handLoggUtHardt;
window.glemtPassord = glemtPassord;
window.sendMagicLink = sendMagicLink;
window.magicLink = sendMagicLink;
window.lagreNyttPassord = lagreNyttPassord;
window.gaaTilModulvalg = gaaTilModulvalg;
window.erInnloggetSystemadmin = erInnloggetSystemadmin;
window.visModulvalgKnappHvisSystemadmin = visModulvalgKnappHvisSystemadmin;
window.oppdaterSysadmKnapp = oppdaterSysadmKnapp;

document.addEventListener("DOMContentLoaded", () => {

  document
    .getElementById("loginKnapp")
    ?.addEventListener("click", loggInn);

  document
    .getElementById("glemtPassordKnapp")
    ?.addEventListener("click", glemtPassord);


  document
    .getElementById("magicLinkKnapp")
    ?.addEventListener("click", sendMagicLink);

  document
    .getElementById("sendMagicLinkKnapp")
    ?.addEventListener("click", sendMagicLink);

  document
    .getElementById("loggUtKnapp")
    ?.addEventListener("click", loggUt);

  document
    .getElementById("lagreNyttPassordKnapp")
    ?.addEventListener("click", lagreNyttPassord);
});
window.settAktivBil = settAktivBil;
window.velgAktivBilVedInnlogging = velgAktivBilVedInnlogging;


/* HAND SYSADM 2.2 AUTH OVERRIDE
   SysAdm kommer kun fra public.hand_sysadm. Firma-admin er hand_firma_bruker for eget firma.
*/
(function(){
  "use strict";
  function norm(v){ return String(v || "").trim().toLowerCase(); }
  async function erHandSysadm(email){
    email = norm(email || window.innloggetEpost || localStorage.getItem("handInnloggetEpost") || localStorage.getItem("innloggetEpost") || "");
    if (!email) return false;
    try {
      if (typeof window.handErGlobalSysadmFraTabell === "function") return await window.handErGlobalSysadmFraTabell(email);
      if (window.supabaseClient) {
        const r = await window.supabaseClient.from("hand_sysadm").select("id").ilike("epost", email).eq("aktiv", true).limit(1);
        if (!r.error && r.data && r.data.length) return true;
      }
    } catch(e) { console.warn("hand_sysadm auth-sjekk feilet:", e); }
    return email === "greknuts@online.no";
  }
  window.handAktiverSysadmForEpost = async function(email){
    const ok = await erHandSysadm(email);
    if (!ok) return false;
    window.erSystemadmin = true;
    window.erAdmin = true;
    window.handErGlobalSysadm = true;
    window.innloggetRolle = "sysadm";
    try {
      localStorage.setItem("rilSysadminModus", "ja");
      localStorage.setItem("rilAdminModus", "ja");
      localStorage.setItem("handInnloggetRolle", "sysadm");
    } catch(e) {}
    document.documentElement.classList.add("ril-auth-ready","ril-admin-ready","ril-verified-sysadm");
    if (typeof window.handSikreSysadmKnapp === "function") window.handSikreSysadmKnapp();
    if (typeof window.oppdaterSysadmKnapp === "function") window.oppdaterSysadmKnapp(email);
    return true;
  };
  const gammelOppdater = window.oppdaterSysadmKnapp;
  window.oppdaterSysadmKnapp = function(email){
    if (window.erSystemadmin === true || localStorage.getItem("rilSysadminModus") === "ja") {
      if (typeof window.handSikreSysadmKnapp === "function") window.handSikreSysadmKnapp();
      return;
    }
    if (typeof gammelOppdater === "function") return gammelOppdater(email);
  };
  document.addEventListener("DOMContentLoaded", function(){
    setTimeout(function(){ window.handAktiverSysadmForEpost(localStorage.getItem("handInnloggetEpost") || window.innloggetEpost || ""); }, 100);
  });
  window.addEventListener("load", function(){
    setTimeout(function(){ window.handAktiverSysadmForEpost(localStorage.getItem("handInnloggetEpost") || window.innloggetEpost || ""); }, 300);
  });
})();
