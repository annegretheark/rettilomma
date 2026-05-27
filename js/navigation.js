function visElement(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("hidden");
  el.classList.remove("skjult");
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

  if (typeof settDagensDato === "function") {
    settDagensDato();
  }

  if (typeof lastTimer === "function") {
    await lastTimer();
  } else if (typeof tegnTimer === "function") {
    tegnTimer();
  }

  if (typeof fyllFirmaSkjema === "function") {
    fyllFirmaSkjema();
  }

  if (typeof tegnFirmaInfo === "function") {
    tegnFirmaInfo();
  }

  // Vanlig bruker skal rett til timer. Admin skal lande på menyen.
  if (erAdmin) {
    skjulAlleSider();
  } else {
    visTimerSide();
  }
}

function oppdaterAdminVisning() {
  document.querySelectorAll(".admin-only").forEach(element => {
    if (erAdmin) {
      element.classList.remove("hidden");
      element.classList.remove("skjult");
      element.style.display = "";
    } else {
      element.classList.add("hidden");
      element.classList.add("skjult");
      element.style.display = "none";
    }
  });
}

function skjulAlleSider() {
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
}

function visTimerSide() {
  skjulAlleSider();
  visElement("timerSide");
}

function visFakturaSide() {
  if (!erAdmin) {
    alert("Du har ikke tilgang til faktura.");
    return;
  }

  skjulAlleSider();
  visElement("fakturaSide");

  if (typeof fyllOkonomiKundeValg === "function") {
    fyllOkonomiKundeValg();
  }
}

function visBackupSide() {
  if (!erAdmin) {
    alert("Du har ikke tilgang til backup.");
    return;
  }

  skjulAlleSider();
  visElement("backupSide");
}

function visVarerSide() {
  if (!erAdmin) {
    alert("Du har ikke tilgang til varer.");
    return;
  }

  if (typeof window.visVarer === "function") {
    window.visVarer();
    return;
  }

  skjulAlleSider();
  visElement("varerSide");
}

async function visKundeSide() {
  if (!erAdmin) {
    alert("Du har ikke tilgang til kunderegister.");
    return;
  }

  skjulAlleSider();
  visElement("kundeSide");

  if (typeof lastKunder === "function") {
    await lastKunder();
  }
}

async function visAnsattSide() {
  if (!erAdmin) {
    alert("Du har ikke tilgang til ansattregister.");
    return;
  }

  skjulAlleSider();
  visElement("ansattSide");

  if (typeof tegnTrekkListe === "function") {
    tegnTrekkListe();
  }

  if (typeof lastAnsatte === "function") {
    await lastAnsatte();
  }
}

function visFirmaSide() {
  if (!erAdmin) {
    alert("Du har ikke tilgang til firma.");
    return;
  }

  skjulAlleSider();
  visElement("firmaSide");

  if (typeof fyllFirmaSkjema === "function") {
    fyllFirmaSkjema();
  }

  if (typeof tegnFirmaInfo === "function") {
    tegnFirmaInfo();
  }
}

async function visLonnSide() {
  if (!erAdmin) {
    alert("Du har ikke tilgang til lønn.");
    return;
  }

  skjulAlleSider();
  visElement("lonnPanel");

  if (typeof lastAnsatte === "function") {
    await lastAnsatte();
  } else if (typeof fyllLonnAnsattValg === "function") {
    fyllLonnAnsattValg(window.ansatte || []);
  }
}

function visTestSide() {
  if (!erAdmin) {
    alert("Du har ikke tilgang til testpanel.");
    return;
  }

  skjulAlleSider();
  visElement("testSide");
}

window.visLogin = visLogin;
window.visNyttPassord = visNyttPassord;
window.visApp = visApp;
window.visTimerSide = visTimerSide;
window.visFakturaSide = visFakturaSide;
window.visBackupSide = visBackupSide;
window.visVarerSide = visVarerSide;
window.visKundeSide = visKundeSide;
window.visAnsattSide = visAnsattSide;
window.visFirmaSide = visFirmaSide;
window.visTestSide = visTestSide;
window.visLonnSide = visLonnSide;
window.skjulAlleSider = skjulAlleSider;
window.visModulerSide = function () {

  skjulAlleSider();

  visElement("modulerSide");

  if (typeof tegnModulGui === "function") {
    tegnModulGui();
  }

};

/* oppdaterModulVisning ligger nå i js/core/moduler.js */

