console.log("moduler.js er lastet");

// Modulvalg lagres per kunde i Supabase, i firma-tabellen.
// Krever disse kolonnene:
// alter table firma add column if not exists moduler jsonb default '{}'::jsonb;
// alter table firma add column if not exists moduler_konfigurert boolean default false;

const MODULER = [
  { id: "timer", navn: "Timer", beskrivelse: "Registrere timer og utlegg", alltid: true },
  { id: "faktura", navn: "Faktura", beskrivelse: "Faktura, MVA, kreditnota og økonomioversikt" },
  { id: "varer", navn: "Varer/lager", beskrivelse: "Vareregister, varelinjer og lager" },
  { id: "biler", navn: "Biler", beskrivelse: "Aktiv bil og bil-lager" },
  { id: "lonn", navn: "Lønn", beskrivelse: "Lønnsslipper og lønnsrapporter" },
  { id: "hovslager", navn: "Hovslager", beskrivelse: "Hester, eiere, skoing, kjøring og hovslagerfaktura" },
  { id: "veterinaer", navn: "Veterinær", beskrivelse: "Klinikk, dyreeiere, dyr/pasienter, journal og behandling" }
];

const MODUL_PAKKER = {
  solo: { timer: true, faktura: true, varer: false, biler: false, lonn: false, hovslager: false, veterinaer: false },
  handverker: { timer: true, faktura: true, varer: true, biler: true, lonn: false, hovslager: false, veterinaer: false },
  hovslager: { timer: true, faktura: true, varer: true, biler: true, lonn: false, hovslager: true, veterinaer: false },
  pro: { timer: true, faktura: true, varer: true, biler: true, lonn: true, hovslager: true, veterinaer: true },
  veterinaer: { timer: true, faktura: true, varer: false, biler: false, lonn: false, hovslager: false, veterinaer: true }
};

let aktiveModuler = standardModuler();
let firmaModulRad = null;
let modulerKonfigurert = false;
let harVistForstegangsvalgDenneSesjonen = false;

function standardModuler() {
  return { ...MODUL_PAKKER.pro, timer: true };
}

function normaliserModuler(moduler) {
  return {
    ...standardModuler(),
    ...(moduler || {}),
    timer: true
  };
}

function erInnloggetAdmin() {
  return window.erAdmin === true || (typeof erAdmin !== "undefined" && erAdmin === true);
}

function hentModulMelding() {
  return document.getElementById("modulMelding") || document.getElementById("modulStatus");
}

async function hentFirmaRadForModuler() {
  if (typeof supabaseClient === "undefined") return null;

  const { data, error } = await supabaseClient
    .from("firma")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Kunne ikke hente firma/moduler:", error);
    return null;
  }

  return data || null;
}

async function opprettFirmaRadForModuler() {
  if (typeof supabaseClient === "undefined") return null;

  const { data, error } = await supabaseClient
    .from("firma")
    .insert({
      navn: "",
      moduler: standardModuler(),
      moduler_konfigurert: false
    })
    .select("*")
    .single();

  if (error) {
    console.error("Kunne ikke opprette firma-rad for moduler:", error);
    return null;
  }

  return data || null;
}

async function lastModulerFraDatabase() {
  const rad = await hentFirmaRadForModuler();

  firmaModulRad = rad;

  if (!rad) {
    aktiveModuler = standardModuler();
    modulerKonfigurert = false;
    window.aktiveModuler = aktiveModuler;
    window.modulerKonfigurert = modulerKonfigurert;
    oppdaterModulVisning();
    return aktiveModuler;
  }

  aktiveModuler = normaliserModuler(rad.moduler || {});
  modulerKonfigurert = rad.moduler_konfigurert === true;

  window.aktiveModuler = aktiveModuler;
  window.modulerKonfigurert = modulerKonfigurert;

  oppdaterModulVisning();
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

async function lagreModuler() {
  MODULER.forEach(modul => {
    if (modul.alltid) {
      aktiveModuler[modul.id] = true;
      return;
    }

    const checkbox = document.getElementById("modul_" + modul.id);
    if (checkbox) aktiveModuler[modul.id] = checkbox.checked;
  });

  aktiveModuler = normaliserModuler(aktiveModuler);

  let rad = firmaModulRad || await hentFirmaRadForModuler();
  if (!rad) rad = await opprettFirmaRadForModuler();

  if (!rad || !rad.id) {
    const melding = hentModulMelding();
    if (melding) melding.textContent = "Fant ingen firma-rad. Opprett firma først, eller sjekk SQL for firma-tabellen.";
    return;
  }

  const { data, error } = await supabaseClient
    .from("firma")
    .update({
      moduler: aktiveModuler,
      moduler_konfigurert: true
    })
    .eq("id", rad.id)
    .select("*")
    .single();

  if (error) {
    console.error("Feil ved lagring av moduler:", error);
    const melding = hentModulMelding();
    if (melding) melding.textContent = "Feil ved lagring av moduler: " + error.message;
    return;
  }

  firmaModulRad = data || rad;
  modulerKonfigurert = true;
  window.aktiveModuler = aktiveModuler;
  window.modulerKonfigurert = true;

  oppdaterModulVisning();

  const melding = hentModulMelding();
  if (melding) melding.textContent = "Moduler lagret for kunden.";

  if (typeof visTimerSide === "function") {
    setTimeout(() => visTimerSide(), 600);
  }
}

function brukModulPakke(pakkeNavn) {
  const pakke = MODUL_PAKKER[pakkeNavn];
  if (!pakke) return;

  aktiveModuler = normaliserModuler(pakke);
  window.aktiveModuler = aktiveModuler;

  MODULER.forEach(modul => {
    const checkbox = document.getElementById("modul_" + modul.id);
    if (checkbox) checkbox.checked = modulErAktiv(modul.id);
  });

  oppdaterModulVisning();

  const melding = document.getElementById("modulMelding");
  if (melding) melding.textContent = "Pakke valgt: " + pakkeNavn + ". Trykk Lagre moduler for å lagre i Supabase.";
}

function visModulerSide() {
  if (!erInnloggetAdmin()) {
    alert("Du har ikke tilgang til moduler.");
    return;
  }

  if (typeof skjulAlleSider === "function") skjulAlleSider();

  const side = document.getElementById("modulerSide");
  if (side) {
    side.classList.remove("hidden", "skjult", "modul-skjult");
    side.style.display = "";
  }

  tegnModulGui();
}

async function sjekkForstegangsModulvalg() {
  if (!erInnloggetAdmin()) return;

  await lastModulerFraDatabase();

  // Viktig: automatisk modulvalg skal bare vises én gang per innlogging,
  // og bare hvis kunden ikke er konfigurert i Supabase.
  if (!modulerKonfigurert && !harVistForstegangsvalgDenneSesjonen) {
    harVistForstegangsvalgDenneSesjonen = true;
    visModulerSide();
  }
}

function skjulModulerVedOppstart() {
  const side = document.getElementById("modulerSide");
  if (side) {
    side.classList.add("skjult");
    side.style.display = "none";
  }
}

window.lastModulerFraDatabase = lastModulerFraDatabase;
window.oppdaterModulVisning = oppdaterModulVisning;
window.tegnModulGui = tegnModulGui;
window.lagreModuler = lagreModuler;
window.brukModulPakke = brukModulPakke;
window.visModulerSide = visModulerSide;
window.modulErAktiv = modulErAktiv;
window.sjekkForstegangsModulvalg = sjekkForstegangsModulvalg;
window.aktiveModuler = aktiveModuler;
window.modulerKonfigurert = modulerKonfigurert;

document.addEventListener("DOMContentLoaded", () => {
  skjulModulerVedOppstart();
  tegnModulGui();
  oppdaterModulVisning();
});

window.addEventListener("load", () => {
  skjulModulerVedOppstart();

  // Etter innlogging rekker auth.js vanligvis å sette erAdmin.
  // Vi prøver et par ganger, men viser bare modulvalg hvis Supabase sier at kunden ikke er konfigurert.
  setTimeout(sjekkForstegangsModulvalg, 900);
  setTimeout(sjekkForstegangsModulvalg, 2200);
});

if (typeof supabaseClient !== "undefined" && supabaseClient.auth) {
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      harVistForstegangsvalgDenneSesjonen = false;
      setTimeout(sjekkForstegangsModulvalg, 1000);
    }

    if (event === "SIGNED_OUT") {
      harVistForstegangsvalgDenneSesjonen = false;
      skjulModulerVedOppstart();
    }
  });
}
