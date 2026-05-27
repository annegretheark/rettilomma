console.log("hov-app.js lastet");

let alleHovHester = [];

document.addEventListener("DOMContentLoaded", () => {

  kobleKnapp("leggTilKundeKnapp", "lagreKunde");
  kobleKnapp("lagreHestKnapp", "lagreHest");
  kobleKnapp("lagreJobbKnapp", "lagreJobbMedHestSjekk");
  kobleKnapp("lagFakturaKnapp", "lagHovFaktura");
  kobleKnapp("lagKreditnotaKnapp", "lagHovKreditnota");
  kobleKnapp("hentFakturaOversiktKnapp", "hentFakturaOversikt");
  kobleKnapp("eksporterFakturaExcelKnapp", "eksporterFakturaOversiktExcel");

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

  startHovslager();
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

async function startHovslager() {

  try {

    if (typeof hentKunder === "function") {
      await hentKunder();
    }

    await hentAlleHesterFraBase();
    await fyllJobbHesterForValgtKunde();

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

    console.error(e);
    alert("Feil ved oppstart av hovslager-systemet.");
  }
}

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
    alert("Feil ved henting av hester.");
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

  const funnetHest =
    alleHovHester.find(h => {

      const navn =
        String(h.navn || "")
          .toLowerCase();

      return (
        lower.includes(navn) ||
        lower.includes(
          navn.replace("x", "ks")
        ) ||
        lower.includes(
          navn.replace("z", "s")
        ) ||
        lower.includes(
          navn.replace("z", "x")
        ) ||
        lower.includes(
          navn.replace("y", "i")
        )
      );
    });

  if (!funnetHest) {

    alert(
      "Fant ikke hesten i basen."
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
