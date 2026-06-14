console.log("beh-app.js lastet");

let alleBehHester = [];


function kobleBehMenyOgLogout() {
  const koblinger = [
    ["visBehandlingerKnapp", "behandlingSide"],
    ["visKunderKnapp", "kundeSide"],
    ["visHesterKnapp", "hesterSide"],
    ["visFakturaKnapp", "fakturaSide"],
    ["visFirmaKnapp", "firmaSide"]
  ];

  koblinger.forEach(([knappId, sideId]) => {
    const knapp = document.getElementById(knappId);
    if (knapp) {
      knapp.addEventListener("click", () => {
        if (typeof window.visSide === "function") {
          window.visSide(sideId);
        } else {
          alert("Programfeil: visSide mangler. Sjekk beh-navigation.js");
        }
      });
    }
  });

  const velgModulKnapp = document.getElementById("velgModulKnapp");
  if (velgModulKnapp) velgModulKnapp.remove();
}



// NØDSTART: Denne skal ikke vente på firma/oppsett/auth.
// Dato og kunder må komme opp uansett, ellers stopper hele arbeidsflyten.
function behSettDatoHvisTom() {
  const felt = document.getElementById("behandlingDato");
  if (!felt) return;
  if (!felt.value) settDagensDato();
}

async function behTryggLastKunderOgDato() {
  try { behSettDatoHvisTom(); } catch (e) { console.warn("Dato kunne ikke settes:", e); }

  try {
    if (typeof window.hentKunder === "function") {
      await window.hentKunder();
    }
  } catch (e) {
    console.warn("Kunne ikke hente kunder nå, prøver igjen senere:", e);
  }

  try {
    if (typeof window.fyllFakturaKunder === "function") {
      await window.fyllFakturaKunder();
    }
  } catch (e) {
    console.warn("Kunne ikke fylle fakturakunder nå:", e);
  }
}

function behStartKunderMedRetry() {
  behSettDatoHvisTom();
  [100, 400, 1000, 2000, 4000].forEach(ms => {
    setTimeout(() => { behTryggLastKunderOgDato(); }, ms);
  });
}


document.addEventListener("DOMContentLoaded", () => {

  kobleBehMenyOgLogout();
  behStartKunderMedRetry();

  kobleKnapp("leggTilKundeKnapp", "lagreKunde");
  kobleKnapp("lagreHestKnapp", "lagreHest");
  kobleKnapp("lagreBehandlingKnapp", "lagreBehandlingMedHestSjekk");
  kobleKnapp("lagFakturaKnapp", "lagBehFaktura");
  kobleKnapp("lagKreditnotaKnapp", "lagBehKreditnota");
  kobleKnapp("hentFakturaOversiktKnapp", "hentFakturaOversikt");
  kobleKnapp("eksporterFakturaExcelKnapp", "eksporterFakturaOversiktExcel");

  if (typeof kobleBehOppsett === "function") {
    kobleBehOppsett();
  }

  const behandlingKunde = document.getElementById("behandlingKunde");

  if (behandlingKunde) {
    behandlingKunde.addEventListener("change", async () => {
      await fyllBehandlingHesterForValgtKunde();
    });
  }

  const taleKnapp = document.getElementById("taleBehandlingKnapp");

  if (taleKnapp) {
    taleKnapp.addEventListener("click", startTaleBehandling);
  }

  // startHestebehandler kjøres fra js/auth.js når brukeren er innlogget.
});

function kobleKnapp(id, funksjonsnavn) {

  const knapp = document.getElementById(id);

  if (!knapp) {
    return;
  }

  knapp.addEventListener("click", async () => {

    const fn = window[funksjonsnavn];

    if (typeof fn !== "function") {
      console.error("Mangler funksjon:", funksjonsnavn);
      alert("Programfeil: mangler funksjon " + funksjonsnavn);
      return;
    }

    await fn();
  });
}

let hestebehandlerStartet = false;

async function startHestebehandler() {

  if (hestebehandlerStartet) {
    return;
  }

  hestebehandlerStartet = true;

  try {

    behSettDatoHvisTom();

    if (typeof hentKunder === "function") {
      try { await hentKunder(); } catch (e) { console.warn("Tidlig henting av kunder feilet, fortsetter:", e); }
    }

    // Firma/oppsett skal aldri stoppe resten av appen.
    // Hvis firma-tabellen eller logo/Vipps feiler, skal kunder, hester og behandlinger likevel lastes.
    if (typeof sjekkBehOppsett === "function") {
      try {
        await sjekkBehOppsett();
      } catch (e) {
        console.warn("Firmaoppsett feilet, fortsetter oppstart:", e);
      }
    }

    if (typeof hentKunder === "function") {
      await hentKunder();
    }

    await hentAlleHesterFraBase();
    await fyllBehandlingHesterForValgtKunde();

    if (typeof hentHester === "function") {
      await hentHester();
    }

    if (typeof hentBehandlinger === "function") {
      await hentBehandlinger();
    }

    if (typeof fyllFakturaKunder === "function") {
      await fyllFakturaKunder();
    }

    if (typeof fyllKreditFakturaer === "function") {
      await fyllKreditFakturaer();
    }

    settDagensDato();

  } catch (e) {

    hestebehandlerStartet = false;
    console.error(e);
    behStartKunderMedRetry();
    // Ikke vis stoppende alert her. Appen skal fortsatt kunne brukes delvis.
    const el = document.getElementById("behandlingMelding");
    if (el) el.textContent = "Noe feilet ved oppstart, men kunder/dato prøves lastet på nytt.";
  }
}

window.startHestebehandler = startHestebehandler;
window.behTryggLastKunderOgDato = behTryggLastKunderOgDato;
window.behStartKunderMedRetry = behStartKunderMedRetry;

function settDagensDato() {

  const behandlingDato = document.getElementById("behandlingDato");

  if (!behandlingDato) {
    return;
  }

  const idag = new Date();

  const yyyy = idag.getFullYear();
  const mm = String(idag.getMonth() + 1).padStart(2, "0");
  const dd = String(idag.getDate()).padStart(2, "0");

  behandlingDato.value = `${yyyy}-${mm}-${dd}`;
}

async function hentAlleHesterFraBase() {

  if (!window.supabaseClient) {
    console.error("Mangler supabaseClient");
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("beh_hester")
    .select("*")
    .order("navn", { ascending: true });

  if (error) {
    console.error("Feil ved henting av hester:", error);
    alert("Feil ved henting av hester.");
    return;
  }

  alleBehHester = data || [];
}

async function fyllBehandlingHesterForValgtKunde() {

  const kundeSelect = document.getElementById("behandlingKunde");
  const hestSelect = document.getElementById("behandlingHest");

  if (!kundeSelect || !hestSelect) {
    return;
  }

  const valgtKundeId = kundeSelect.value;

  hestSelect.innerHTML = `<option value="">Velg hest</option>`;

  if (!valgtKundeId) {
    return;
  }

  if (!alleBehHester || alleBehHester.length === 0) {
    await hentAlleHesterFraBase();
  }

  const hesterForKunde = alleBehHester.filter(h =>
    String(h.kunde_id) === String(valgtKundeId)
  );

  hesterForKunde.forEach(hest => {

    const option = document.createElement("option");

    option.value = hest.id;
    option.textContent = hest.navn;

    hestSelect.appendChild(option);
  });
}

async function lagreBehandlingMedHestSjekk() {

  const kundeSelect = document.getElementById("behandlingKunde");
  const hestSelect = document.getElementById("behandlingHest");

  const kundeId = kundeSelect ? kundeSelect.value : "";
  const hestId = hestSelect ? hestSelect.value : "";

  if (!kundeId) {
    alert("Velg kunde/eier først.");
    return;
  }

  if (!hestId) {
    alert("Velg hest.");
    return;
  }

  if (!alleBehHester || alleBehHester.length === 0) {
    await hentAlleHesterFraBase();
  }

  const valgtHest = alleBehHester.find(h =>
    String(h.id) === String(hestId)
  );

  if (!valgtHest) {
    alert("Fant ikke valgt hest.");
    return;
  }

  if (String(valgtHest.kunde_id) !== String(kundeId)) {
    alert("Denne hesten tilhører ikke valgt kunde/eier.");
    await fyllBehandlingHesterForValgtKunde();
    return;
  }

  if (typeof window.lagreBehandling !== "function") {
    console.error("Mangler original lagreBehandling-funksjon");
    alert("Programfeil: mangler lagreBehandling.");
    return;
  }

  await window.lagreBehandling();
}

async function startTaleBehandling() {

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Tale fungerer ikke i denne nettleseren.");
    return;
  }

  const resultat =
    document.getElementById("taleResultat");

  try {

    const recognition =
      new SpeechRecognition();

    recognition.lang = "no-NO";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    if (resultat) {
      resultat.textContent = "Lytter...";
    }

    recognition.onstart = () => {
      console.log("Tale startet");
    };

    recognition.onresult =
      async (event) => {

      const tekst =
        event.results[0][0].transcript;

      if (resultat) {
        resultat.textContent =
          "Hørte: " + tekst;
      }

      await fyllBehandlingFraTale(tekst);
    };

    recognition.onerror = (event) => {

      console.error(event.error);

      if (!resultat) {
        return;
      }

      if (event.error === "aborted") {

        resultat.textContent =
          "Tale avbrutt. Trykk igjen.";

        return;
      }

      resultat.textContent =
        "Tale feilet: " +
        event.error;
    };

    recognition.onend = () => {
      console.log("Tale avsluttet");
    };

    recognition.start();

  } catch (e) {

    console.error(e);

    if (resultat) {
      resultat.textContent =
        "Feil ved talegjenkjenning.";
    }
  }
}

async function fyllBehandlingFraTale(tekst) {

  const lower =
    String(tekst || "").toLowerCase();

  if (!alleBehHester ||
      alleBehHester.length === 0) {

    await hentAlleHesterFraBase();
  }

  function normaliserHesteNavn(verdi) {
    return String(verdi || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .replace(/æ/g, "ae")
      .replace(/ø/g, "o")
      .replace(/å/g, "a")
      .replace(/[^a-z0-9æøå\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const normalTekst =
    normaliserHesteNavn(tekst);

  const kompaktTekst =
    normalTekst.replace(/\s+/g, "");

  const funnetHest =
    alleBehHester.find(h => {

      const navn =
        normaliserHesteNavn(h.navn);

      const kompaktNavn =
        navn.replace(/\s+/g, "");

      if (!kompaktNavn) {
        return false;
      }

      return (
        normalTekst.includes(navn) ||
        kompaktTekst.includes(kompaktNavn)
      );
    });

  if (!funnetHest) {

    const forslag =
      alleBehHester
        .filter(h => {
          const navn =
            normaliserHesteNavn(h.navn)
              .replace(/\s+/g, "");

          const ord =
            normalTekst
              .split(/\s+/)
              .filter(o => o.length >= 4);

          return ord.some(o =>
            navn.includes(o) ||
            o.includes(navn)
          );
        })
        .slice(0, 3)
        .map(h => h.navn);

    alert(
      "Fant ikke hesten i basen." +
      (
        forslag.length
          ? "\n\nMente du: " + forslag.join(", ") + "?"
          : ""
      )
    );

    return;
  }

  const kundeSelect =
    document.getElementById("behandlingKunde");

  const hestSelect =
    document.getElementById("behandlingHest");

  if (kundeSelect) {

    kundeSelect.value =
      funnetHest.kunde_id;

    await fyllBehandlingHesterForValgtKunde();
  }

  if (hestSelect) {
    hestSelect.value =
      funnetHest.id;
  }

  settDagensDato();

  settFeltVerdi(
    "behandlingType",
    "Behandling"
  );

  settFeltVerdi(
    "arbeidBelop",
    1500
  );

  let km =
    finnKmFraTekst(lower);

  if (!km || isNaN(km)) {

    const svar =
      prompt(
        "Hvor mange km kjørte du?",
        "20"
      );

    km = Number(svar || 0);
  }

  settFeltVerdi("behandlingKm", km);
  settFeltVerdi("km", km);
  settFeltVerdi("kjoringKm", km);
  settFeltVerdi("behandlingKmPris", 5.30);

  const kmPrisFelt =
    document.getElementById(
      "behandlingKmPris"
    );

  let kmPris = 5.3;

  if (kmPrisFelt &&
      kmPrisFelt.value) {

    kmPris =
      Number(kmPrisFelt.value);
  }

  const kjoringBelop =
    km * kmPris;

  settFeltVerdi(
    "behandlingBeskrivelse",
    tekst +
    " | Kjøring: " +
    km +
    " km (" +
    kjoringBelop.toFixed(2) +
    " kr)"
  );

  const resultat =
    document.getElementById(
      "taleResultat"
    );

  if (resultat) {

    resultat.textContent =
      "Lagrer: " +
      funnetHest.navn +
      " - Behandling - " +
      km +
      " km";
  }

  await lagreBehandlingMedHestSjekk();

  if (resultat) {

    resultat.textContent =
      "Lagret: " +
      funnetHest.navn +
      " - " +
      km +
      " km";
  }
}

function finnKmFraTekst(tekst) {

  const tall =
    tekst.match(/\d+/g);

  if (tall &&
      tall.length > 0) {

    return Number(
      tall[tall.length - 1]
    );
  }

  const ordTall = {

    "en": 1,
    "ett": 1,
    "to": 2,
    "tre": 3,
    "fire": 4,
    "fem": 5,
    "seks": 6,
    "sju": 7,
    "syv": 7,
    "åtte": 8,
    "ni": 9,
    "ti": 10,
    "elleve": 11,
    "tolv": 12,
    "tretten": 13,
    "fjorten": 14,
    "femten": 15,
    "seksten": 16,
    "sytten": 17,
    "atten": 18,
    "nitten": 19,
    "tjue": 20,
    "tretti": 30,
    "førti": 40,
    "femti": 50,
    "seksti": 60,
    "sytti": 70,
    "åtti": 80,
    "nitti": 90
  };

  for (const ord in ordTall) {

    if (tekst.includes(ord)) {
      return ordTall[ord];
    }
  }

  return 0;
}

function settFeltVerdi(id, verdi) {

  const felt =
    document.getElementById(id);

  if (felt) {
    felt.value = verdi;
  }
}

window.lagreBehandlingMedHestSjekk =
  lagreBehandlingMedHestSjekk;

const backupKnapp =
  document.getElementById("backupKnapp");

if (
  backupKnapp &&
  typeof backup === "function"
) {
  backupKnapp.addEventListener(
    "click",
    backup
  );
}

const importFil =
  document.getElementById("importFil");

if (
  importFil &&
  typeof importerBackup === "function"
) {
  importFil.addEventListener(
    "change",
    importerBackup
  );
}


window.hentAlleHesterFraBase = hentAlleHesterFraBase;
window.fyllBehandlingHesterForValgtKunde = fyllBehandlingHesterForValgtKunde;


function behBindFakturaKnappDirekte() {
  const knapp = document.getElementById("lagFakturaKnapp");
  if (!knapp) return;

  knapp.onclick = async function () {
    if (typeof window.lagBehFaktura !== "function") {
      alert("Programfeil: faktura er ikke lastet. Sjekk at beh-faktura.js ligger sammen med appfilene.");
      return;
    }
    await window.lagBehFaktura();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(behBindFakturaKnappDirekte, 100);
  setTimeout(behBindFakturaKnappDirekte, 800);
  setTimeout(behBindFakturaKnappDirekte, 1800);
});

window.behBindFakturaKnappDirekte = behBindFakturaKnappDirekte;
