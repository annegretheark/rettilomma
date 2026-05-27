let innloggetEpost = "";
let innloggetAnsattId = "";
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
      .from("biler")
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
        await supabaseClient.from("ansatte").update({ standard_bil_id: bil.id }).eq("id", ansattData.id);
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
        await supabaseClient.from("ansatte").update({ standard_bil_id: bil.id }).eq("id", ansattData.id);
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

async function loggInn() {
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

  innloggetAnsattId = "";
  window.innloggetAnsattId = "";

  erAdmin = false;
  window.erAdmin = false;
const {
    data: ansattRader,
    error: ansattError
  } = await supabaseClient
    .from("ansatte")
    .select("*")
    .eq("epost", email)
    .limit(1);

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

  await velgAktivBilVedInnlogging(ansattData);

  if (vilAdmin) {
    if (
      (ansattData && String(ansattData.rolle || "").toLowerCase() === "admin") ||
      email === "greknuts@online.no"
    ) {
      erAdmin = true;
      window.erAdmin = true;
    } else {
      erAdmin = false;
      window.erAdmin = false;
    }
  }

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
}

async function loggUt() {

  await supabaseClient.auth.signOut();

  document.getElementById("loginPassord").value = "";

  erAdmin = false;
  window.erAdmin = false;

  innloggetEpost = "";
  innloggetAnsattId = "";

  window.innloggetEpost = "";
  window.innloggetAnsattId = "";
  settAktivBil("", "");

  visLogin();
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

  const redirectUrl =
  window.location.origin +
  "/NyTimerdelt/reset.html";

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
        .from("ansatte")
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

window.loggInn = loggInn;
window.loggUt = loggUt;
window.glemtPassord = glemtPassord;
window.lagreNyttPassord = lagreNyttPassord;

document.addEventListener("DOMContentLoaded", () => {

  document
    .getElementById("loginKnapp")
    ?.addEventListener("click", loggInn);

  document
    .getElementById("glemtPassordKnapp")
    ?.addEventListener("click", glemtPassord);

  document
    .getElementById("loggUtKnapp")
    ?.addEventListener("click", loggUt);

  document
    .getElementById("lagreNyttPassordKnapp")
    ?.addEventListener("click", lagreNyttPassord);
});
window.settAktivBil = settAktivBil;
window.velgAktivBilVedInnlogging = velgAktivBilVedInnlogging;
