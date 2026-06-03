function visElement(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("hidden");
  el.classList.remove("skjult");
  el.classList.remove("modul-skjult");
  el.style.display = "";
}

function skjulElement(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("hidden");
  el.classList.add("skjult");
  el.style.display = "none";
}

function visLogin() {
  visElement("loginSide");
  skjulElement("nyttPassordSide");
  skjulElement("appSide");
}

function visNyttPassord() {
  skjulElement("loginSide");
  visElement("nyttPassordSide");
  skjulElement("appSide");
}

async function visApp() {
  skjulElement("loginSide");
  skjulElement("nyttPassordSide");
  visElement("appSide");

  oppdaterAdminVisning();

  if (typeof lastModulerFraDatabase === "function") {
    await lastModulerFraDatabase();
  }

  if (typeof oppdaterModulVisning === "function") {
    oppdaterModulVisning();
  }

  if (typeof lastKunder === "function") await lastKunder();
  if (typeof lastProsjekter === "function") await lastProsjekter();
  if (typeof lastAnsatte === "function") await lastAnsatte();

  if (typeof settDagensDato === "function") settDagensDato();

  if (typeof lastTimer === "function") {
    await lastTimer();
  } else if (typeof tegnTimer === "function") {
    tegnTimer();
  }

  if (typeof fyllFirmaSkjema === "function") fyllFirmaSkjema();
  if (typeof tegnFirmaInfo === "function") tegnFirmaInfo();

  if (window.erAdmin === true) {
    visAdminKonsollSide();
  } else {
    visTimerSide();
  }
}

function oppdaterAdminVisning() {
  document.querySelectorAll(".admin-only").forEach(element => {
    if (window.erAdmin === true) {
      element.classList.remove("hidden", "skjult");
      element.style.display = "";
    } else {
      element.classList.add("hidden", "skjult");
      element.style.display = "none";
    }
  });

  // Denne raden skal bare vises når admin velger "Registrer timer for ansatt".
  skjulElement("adminAnsattRad");
}

function skjulArbeidssider() {
  skjulElement("timerSide");
  skjulElement("backupSide");
  skjulElement("fakturaSide");
  skjulElement("varerSide");
  skjulElement("kundeSide");
  skjulElement("ansattSide");
  skjulElement("firmaSide");
  skjulElement("testSide");
  skjulElement("lonnPanel");
  skjulElement("modulerSide");
  skjulElement("adminAnsattRad");
}

function skjulAlleSider() {
  skjulArbeidssider();
  skjulElement("adminKonsollSide");
}

function visAdminKonsollHvisAdmin() {
  if (window.erAdmin === true) {
    visElement("adminKonsollSide");
  }
}

function krevAdmin(melding) {
  if (window.erAdmin === true) return true;
  alert(melding);
  return false;
}

function visTimerSide() {
  // Når admin registrerer egne timer, skal admin-konsollen skjules.
  skjulAlleSider();
  visElement("timerSide");
}

function visTimerForAnsattSide() {
  if (!krevAdmin("Du har ikke tilgang til å registrere timer for ansatt.")) return;

  // Når admin registrerer timer for ansatt, beholdes admin-konsollen synlig.
  skjulArbeidssider();
  visElement("adminKonsollSide");
  visElement("timerSide");
  visElement("adminAnsattRad");
}

function visAdminKonsollSide() {
  if (!krevAdmin("Du har ikke tilgang til admin-konsoll.")) return;

  skjulArbeidssider();
  visElement("adminKonsollSide");
}

function visFakturaSide() {
  if (!krevAdmin("Du har ikke tilgang til faktura.")) return;

  skjulArbeidssider();
  visAdminKonsollHvisAdmin();
  visElement("fakturaSide");

  if (typeof fyllOkonomiKundeValg === "function") fyllOkonomiKundeValg();
}

function visBackupSide() {
  if (!krevAdmin("Du har ikke tilgang til backup.")) return;

  skjulArbeidssider();
  visAdminKonsollHvisAdmin();
  visElement("backupSide");
}

function visVarerSide() {
  if (!krevAdmin("Du har ikke tilgang til varer.")) return;

  skjulArbeidssider();
  visAdminKonsollHvisAdmin();

  if (typeof window.visVarer === "function") {
    window.visVarer();
    visAdminKonsollHvisAdmin();
    return;
  }

  visElement("varerSide");
}

async function visKundeSide() {
  if (!krevAdmin("Du har ikke tilgang til kunderegister.")) return;

  skjulArbeidssider();
  visAdminKonsollHvisAdmin();
  visElement("kundeSide");

  if (typeof lastKunder === "function") await lastKunder();
}

async function visAnsattSide() {
  if (!krevAdmin("Du har ikke tilgang til ansattregister.")) return;

  skjulArbeidssider();
  visAdminKonsollHvisAdmin();
  visElement("ansattSide");

  if (typeof tegnTrekkListe === "function") tegnTrekkListe();
  if (typeof lastAnsatte === "function") await lastAnsatte();
}

function visFirmaSide() {
  if (!krevAdmin("Du har ikke tilgang til firma.")) return;

  skjulArbeidssider();
  visAdminKonsollHvisAdmin();
  visElement("firmaSide");

  if (typeof fyllFirmaSkjema === "function") fyllFirmaSkjema();
  if (typeof tegnFirmaInfo === "function") tegnFirmaInfo();
}

async function visLonnSide() {
  if (!krevAdmin("Du har ikke tilgang til lønn.")) return;

  skjulArbeidssider();
  visAdminKonsollHvisAdmin();
  visElement("lonnPanel");

  if (typeof lastAnsatte === "function") {
    await lastAnsatte();
  } else if (typeof fyllLonnAnsattValg === "function") {
    fyllLonnAnsattValg(window.ansatte || []);
  }
}

function visTestSide() {
  if (!krevAdmin("Du har ikke tilgang til testpanel.")) return;

  skjulArbeidssider();
  visAdminKonsollHvisAdmin();
  visElement("testSide");
}

function visModulerSide() {
  if (!krevAdmin("Du har ikke tilgang til moduler.")) return;

  skjulArbeidssider();
  visAdminKonsollHvisAdmin();
  visElement("modulerSide");

  if (typeof tegnModulGui === "function") tegnModulGui();
}

window.visLogin = visLogin;
window.visNyttPassord = visNyttPassord;
window.visApp = visApp;
window.visTimerSide = visTimerSide;
window.rilVisTimerSide = visTimerSide;
window.visAdminKonsollSide = visAdminKonsollSide;
window.rilVisAdminKonsollSide = visAdminKonsollSide;
window.visTimerForAnsattSide = visTimerForAnsattSide;
window.rilVisTimerForAnsattSide = visTimerForAnsattSide;
window.visFakturaSide = visFakturaSide;
window.visBackupSide = visBackupSide;
window.visVarerSide = visVarerSide;
window.visKundeSide = visKundeSide;
window.visAnsattSide = visAnsattSide;
window.visFirmaSide = visFirmaSide;
window.visTestSide = visTestSide;
window.visLonnSide = visLonnSide;
window.visModulerSide = visModulerSide;
window.skjulAlleSider = skjulAlleSider;
window.skjulArbeidssider = skjulArbeidssider;
window.visAdminKonsollHvisAdmin = visAdminKonsollHvisAdmin;
