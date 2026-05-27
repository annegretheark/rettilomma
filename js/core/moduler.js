console.log("moduler.js er lastet");

const MODUL_LAGRING_KEY = "rettilomma_moduler";

const MODULER = [
  { id: "timer", navn: "Timer", beskrivelse: "Registrere timer og utlegg", alltid: true },
  { id: "faktura", navn: "Faktura", beskrivelse: "Faktura, MVA, kreditnota og økonomioversikt" },
  { id: "varer", navn: "Varer/lager", beskrivelse: "Vareregister, varelinjer og lager" },
  { id: "biler", navn: "Biler", beskrivelse: "Aktiv bil og bil-lager" },
  { id: "lonn", navn: "Lønn", beskrivelse: "Lønnsslipper og lønnsrapporter" },
  { id: "hovslager", navn: "Hovslager", beskrivelse: "Hester, eiere, skoing, kjøring og hovslagerfaktura" }
];

const MODUL_PAKKER = {
  solo: { timer: true, faktura: true, varer: false, biler: false, lonn: false, hovslager: false },
  handverker: { timer: true, faktura: true, varer: true, biler: true, lonn: false, hovslager: false },
  hovslager: { timer: true, faktura: true, varer: true, biler: true, lonn: false, hovslager: true },
  pro: { timer: true, faktura: true, varer: true, biler: true, lonn: true, hovslager: true }
};

let aktiveModuler = hentModulerFraLocalStorage();

function standardModuler() {
  return { ...MODUL_PAKKER.pro };
}

function hentModulerFraLocalStorage() {
  try {
    const lagret = localStorage.getItem(MODUL_LAGRING_KEY);
    if (!lagret) return standardModuler();

    return {
      ...standardModuler(),
      ...JSON.parse(lagret),
      timer: true
    };
  } catch (feil) {
    console.warn("Klarte ikke lese moduler fra localStorage", feil);
    return standardModuler();
  }
}

function lagreModulerTilLocalStorage() {
  localStorage.setItem(MODUL_LAGRING_KEY, JSON.stringify(aktiveModuler));
}

async function lastModulerFraDatabase() {
  // Foreløpig lokal modulstyring. Senere kan denne kobles mot Supabase per kunde.
  aktiveModuler = hentModulerFraLocalStorage();
  return aktiveModuler;
}

function modulErAktiv(modulId) {
  if (modulId === "timer") return true;
  return aktiveModuler[modulId] !== false;
}

function oppdaterModulVisning() {
  document.querySelectorAll("[data-modul]").forEach(element => {
    const modulId = element.getAttribute("data-modul");

    if (modulErAktiv(modulId)) {
      element.classList.remove("modul-skjult");
      element.style.display = "";
    } else {
      element.classList.add("modul-skjult");
      element.style.display = "none";
    }
  });

  const status = document.getElementById("modulStatus");
  if (status) {
    const aktive = MODULER
      .filter(modul => modulErAktiv(modul.id))
      .map(modul => modul.navn)
      .join(", ");

    status.textContent = "Aktive moduler: " + aktive;
  }
}

function tegnModulGui() {
  const liste = document.getElementById("modulListe");
  if (!liste) return;

  liste.innerHTML = MODULER.map(modul => {
    const checked = modulErAktiv(modul.id) ? "checked" : "";
    const disabled = modul.alltid ? "disabled" : "";

    return `
      <div class="modul-rad">
        <label>
          <input type="checkbox" id="modul_${modul.id}" ${checked} ${disabled}>
          <strong>${modul.navn}</strong><br>
          <span style="font-size:0.9em; color:#555;">${modul.beskrivelse}</span>
        </label>
      </div>
    `;
  }).join("");

  oppdaterModulVisning();
}

function lagreModuler() {
  MODULER.forEach(modul => {
    if (modul.alltid) {
      aktiveModuler[modul.id] = true;
      return;
    }

    const checkbox = document.getElementById("modul_" + modul.id);
    if (checkbox) {
      aktiveModuler[modul.id] = checkbox.checked;
    }
  });

  lagreModulerTilLocalStorage();
  oppdaterModulVisning();

  const melding = document.getElementById("modulMelding");
  if (melding) {
    melding.textContent = "Moduler lagret.";
  }
}

function brukModulPakke(pakkeNavn) {
  const pakke = MODUL_PAKKER[pakkeNavn];
  if (!pakke) return;

  aktiveModuler = {
    ...standardModuler(),
    ...pakke,
    timer: true
  };

  MODULER.forEach(modul => {
    const checkbox = document.getElementById("modul_" + modul.id);
    if (checkbox) checkbox.checked = modulErAktiv(modul.id);
  });

  lagreModulerTilLocalStorage();
  oppdaterModulVisning();

  const melding = document.getElementById("modulMelding");
  if (melding) {
    melding.textContent = "Pakke valgt: " + pakkeNavn;
  }
}

function visModulerSide() {
  if (typeof erAdmin !== "undefined" && !erAdmin) {
    alert("Du har ikke tilgang til moduler.");
    return;
  }

  if (typeof skjulAlleSider === "function") {
    skjulAlleSider();
  }

  const side = document.getElementById("modulerSide");
  if (side) {
    side.classList.remove("hidden");
    side.classList.remove("skjult");
    side.style.display = "";
  }

  tegnModulGui();
}

window.lastModulerFraDatabase = lastModulerFraDatabase;
window.oppdaterModulVisning = oppdaterModulVisning;
window.tegnModulGui = tegnModulGui;
window.lagreModuler = lagreModuler;
window.brukModulPakke = brukModulPakke;
window.visModulerSide = visModulerSide;
window.modulErAktiv = modulErAktiv;
window.aktiveModuler = aktiveModuler;

document.addEventListener("DOMContentLoaded", () => {
  tegnModulGui();
  oppdaterModulVisning();
});
