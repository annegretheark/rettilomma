console.log("hov-app.js lastet");

let alleHovHester = [];


function kobleHovMenyOgLogout() {
  const koblinger = [
    ["visJobberKnapp", "jobbSide"],
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
          alert("Programfeil: visSide mangler. Sjekk hov-navigation.js");
        }
      });
    }
  });

  const velgModulKnapp = document.getElementById("velgModulKnapp");
  if (velgModulKnapp) velgModulKnapp.remove();
}



// NØDSTART: Denne skal ikke vente på firma/oppsett/auth.
// Dato og kunder må komme opp uansett, ellers stopper hele arbeidsflyten.
function hovSettDatoHvisTom() {
  const felt = document.getElementById("jobbDato");
  if (!felt) return;
  if (!felt.value) settDagensDato();
}

async function hovTryggLastKunderOgDato() {
  try { hovSettDatoHvisTom(); } catch (e) { console.warn("Dato kunne ikke settes:", e); }

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

function hovStartKunderMedRetry() {
  hovSettDatoHvisTom();
  [100, 400, 1000, 2000, 4000].forEach(ms => {
    setTimeout(() => { hovTryggLastKunderOgDato(); }, ms);
  });
}


document.addEventListener("DOMContentLoaded", () => {

  kobleHovMenyOgLogout();
  hovSettDatoHvisTom();

  kobleKnapp("leggTilKundeKnapp", "lagreKunde");
  kobleKnapp("lagreHestKnapp", "lagreHest");
  kobleKnapp("lagreJobbKnapp", "lagreJobbMedHestSjekk");
  kobleKnapp("lagKreditnotaKnapp", "lagHovKreditnota");
  kobleKnapp("hentFakturaOversiktKnapp", "hentFakturaOversikt");
  kobleKnapp("eksporterFakturaExcelKnapp", "eksporterFakturaOversiktExcel");

  if (typeof kobleHovOppsett === "function") {
    kobleHovOppsett();
  }

  const jobbKunde = document.getElementById("jobbKunde");

  if (jobbKunde) {
    jobbKunde.addEventListener("change", async () => {
      await fyllJobbHesterForValgtKunde();
    });
  }

  const taleKnapp = document.getElementById("taleJobbKnapp");

  if (taleKnapp) {
    taleKnapp.addEventListener("click", startTaleJobb);
  }

  // startHovslager kjøres fra js/auth.js når brukeren er innlogget.
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

let hovslagerStartet = false;

async function startHovslager() {

  if (hovslagerStartet) {
    return;
  }

  hovslagerStartet = true;

  try {

    hovSettDatoHvisTom();

    // Firma/oppsett skal aldri stoppe resten av appen.
    // Hvis firma-tabellen eller logo/Vipps feiler, skal kunder, hester og jobber likevel lastes.
    if (typeof sjekkHovOppsett === "function") {
      try {
        await sjekkHovOppsett();
      } catch (e) {
        console.warn("Firmaoppsett feilet, fortsetter oppstart:", e);
      }
    }

    if (typeof hentKunder === "function") {
      await hentKunder();
    }

    await hentAlleHesterFraBase();
    await fyllJobbHesterForValgtKunde();

    if (typeof hentHester === "function") {
      await hentHester();
    }

    if (typeof hentJobber === "function") {
      await hentJobber();
    }

    if (typeof fyllFakturaKunder === "function") {
      await fyllFakturaKunder();
    }

    if (typeof fyllKreditFakturaer === "function") {
      await fyllKreditFakturaer();
    }

    settDagensDato();

  } catch (e) {

    hovslagerStartet = false;
    console.error(e);
    hovStartKunderMedRetry();
    // Ikke vis stoppende alert her. Appen skal fortsatt kunne brukes delvis.
    const el = document.getElementById("jobbMelding");
    if (el) el.textContent = "Noe feilet ved oppstart, men kunder/dato prøves lastet på nytt.";
  }
}

window.startHovslager = startHovslager;
window.hovTryggLastKunderOgDato = hovTryggLastKunderOgDato;
window.hovStartKunderMedRetry = hovStartKunderMedRetry;

function settDagensDato() {

  const jobbDato = document.getElementById("jobbDato");

  if (!jobbDato) {
    return;
  }

  const idag = new Date();

  const yyyy = idag.getFullYear();
  const mm = String(idag.getMonth() + 1).padStart(2, "0");
  const dd = String(idag.getDate()).padStart(2, "0");

  jobbDato.value = `${yyyy}-${mm}-${dd}`;
}

async function hentAlleHesterFraBase() {

  if (!window.supabaseClient) {
    console.error("Mangler supabaseClient");
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("hester")
    .select("*")
    .order("navn", { ascending: true });

  if (error) {
    console.error("Feil ved henting av hester:", error);
    const m = document.getElementById("jobbMelding") || document.getElementById("hestMelding"); if (m) m.textContent = "Kunne ikke hente hester: " + error.message;
    return;
  }

  alleHovHester = data || [];
}

async function fyllJobbHesterForValgtKunde() {

  const kundeSelect = document.getElementById("jobbKunde");
  const hestSelect = document.getElementById("jobbHest");

  if (!kundeSelect || !hestSelect) {
    return;
  }

  const valgtKundeId = kundeSelect.value;

  hestSelect.innerHTML = `<option value="">Velg hest</option>`;

  if (!valgtKundeId) {
    return;
  }

  if (!alleHovHester || alleHovHester.length === 0) {
    await hentAlleHesterFraBase();
  }

  const hesterForKunde = alleHovHester.filter(h =>
    String(h.kunde_id) === String(valgtKundeId)
  );

  hesterForKunde.forEach(hest => {

    const option = document.createElement("option");

    option.value = hest.id;
    option.textContent = hest.navn;

    hestSelect.appendChild(option);
  });
}

async function lagreJobbMedHestSjekk() {

  const kundeSelect = document.getElementById("jobbKunde");
  const hestSelect = document.getElementById("jobbHest");

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

  if (!alleHovHester || alleHovHester.length === 0) {
    await hentAlleHesterFraBase();
  }

  const valgtHest = alleHovHester.find(h =>
    String(h.id) === String(hestId)
  );

  if (!valgtHest) {
    alert("Fant ikke valgt hest.");
    return;
  }

  if (String(valgtHest.kunde_id) !== String(kundeId)) {
    alert("Denne hesten tilhører ikke valgt kunde/eier.");
    await fyllJobbHesterForValgtKunde();
    return;
  }

  if (typeof window.lagreJobb !== "function") {
    console.error("Mangler original lagreJobb-funksjon");
    alert("Programfeil: mangler lagreJobb.");
    return;
  }

  await window.lagreJobb();
}

async function startTaleJobb() {

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

      await fyllJobbFraTale(tekst);
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

async function fyllJobbFraTale(tekst) {

  const lower =
    String(tekst || "").toLowerCase();

  if (!alleHovHester ||
      alleHovHester.length === 0) {

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
    alleHovHester.find(h => {

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
      alleHovHester
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
    document.getElementById("jobbKunde");

  const hestSelect =
    document.getElementById("jobbHest");

  if (kundeSelect) {

    kundeSelect.value =
      funnetHest.kunde_id;

    await fyllJobbHesterForValgtKunde();
  }

  if (hestSelect) {
    hestSelect.value =
      funnetHest.id;
  }

  settDagensDato();

  settFeltVerdi(
    "jobbType",
    "Fullbeslag"
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

  settFeltVerdi("jobbKm", km);
  settFeltVerdi("km", km);
  settFeltVerdi("kjoringKm", km);
  settFeltVerdi("jobbKmPris", 5.30);

  const kmPrisFelt =
    document.getElementById(
      "jobbKmPris"
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
    "jobbBeskrivelse",
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
      " - Fullbeslag - " +
      km +
      " km";
  }

  await lagreJobbMedHestSjekk();

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

window.lagreJobbMedHestSjekk =
  lagreJobbMedHestSjekk;

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
window.fyllJobbHesterForValgtKunde = fyllJobbHesterForValgtKunde;


function hovBindFakturaKnappDirekte() {
  const knapp = document.getElementById("lagFakturaKnapp");
  if (!knapp) return;

  knapp.onclick = async function () {
    if (typeof window.lagHovFaktura !== "function") {
      alert("Programfeil: lagHovFaktura er ikke lastet. Sjekk at hov-faktura.js ligger i js/hovslager.");
      return;
    }
    await window.lagHovFaktura();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  hovBindFakturaKnappDirekte();
});

window.hovBindFakturaKnappDirekte = hovBindFakturaKnappDirekte;
