/* Kjerne, globale variabler, meny, tilgang og datalasting
   Utskilt fra vet-app.js 2026-06-11. Lastes i samme rekkefølge som originalfilen. */

console.log("vet-app.js er lastet");

let vetKlinikker = [];
let vetDyreeiere = [];
let vetDyr = [];
let vetJournal = [];
let vetPriser = [];
let vetVarer = [];
let vetBiler = [];
let vetHovedlager = [];
let vetBilLager = [];
let vetFakturaer = [];
let vetAktivKlinikkId = null;
let vetAktivKlinikk = null;
let vetInnloggetEpost = "";
let vetInnloggetAuthUserId = "";
let vetInnloggetKlinikkBrukerId = "";
let vetErSystemAdmin = false;
let vetKlinikkRolle = "";
let vetInnloggetBrukerNavn = "";
let vetVisSomVeterinaer = false;
let vetAdminCache = null;
const VET_BILDE_BUCKET = "vet-bilder";
const VET_LOGO_BUCKET = "vet-logoer";
let vetJournalVarerTemp = [];
let vetJournalBehandlingerTemp = [];
let vetAlleKlinikkBrukere = [];

function vetTekst(id) {
  return String(document.getElementById(id)?.value || "").trim();
}

function vetSett(id, verdi) {
  const el = document.getElementById(id);
  if (el) el.value = verdi ?? "";
}

function vetMelding(id, tekst) {
  const el = document.getElementById(id);
  if (el) el.textContent = tekst || "";
}

function visVetSide(id) {
  // Vanlig veterinær skal kunne bruke lager/biler for å legge varer på egen bil.
  // Admin-sider som klinikk, prisliste, økonomi og backup skjules fortsatt.
  if (erVetVisningVanlig() && ["klinikkSide","prisSide","okonomiSide","backupSide"].includes(id)) {
    id = "journalSide";
  }
  if (id === "backupSide" && !vetErSystemAdmin) {
    id = erVetVisningVanlig() ? "journalSide" : "klinikkSide";
  }

  document.querySelectorAll("#klinikkSide,#eierSide,#dyrSide,#prisSide,#lagerSide,#journalSide,#fakturaSide,#okonomiSide,#backupSide,#lagerLoggSide,#journalLoggSide,#vetJournalApningsloggSide").forEach(el => {
    el.classList.add("skjult");
    el.style.display = "none";
  });
  const side = document.getElementById(id);
  if (side) {
    side.classList.remove("skjult");
    side.style.display = "";
  }
  if (id === "eierSide") {
    fyllDyreeierVelgForDyr();
    fyllDyreeierDyrValg(vetTekst("dyreeierId"));
    tegnDyreeiere();
  }
  if (id === "dyrSide") {
    fyllDyreeierValg();
    fyllDyreeierVelgForDyr();
    tegnDyr();
  }
  if (id === "lagerSide") { oppdaterVetLagerTekster(); fyllLagerValg(); tegnAltLager(); oppdaterLagerSideRollevisning(); }
  if (id === "journalSide") { fyllJournalDyreeierValg(); fyllDyrValg(); fyllPrisValg(); fyllJournalBilValg(); fyllJournalBilVareValg(); settStandardKmPrisFraKlinikk(); oppdaterJournalSum(); }
  if (id === "fakturaSide") { fyllFakturaDyreeierValg(); settStandardFakturaDatoer(); fyllKreditnotaFakturaValg(); tegnFakturaGrunnlag(); }
  if (id === "okonomiSide") { tegnAdminOkonomiOversikt(); tegnAdminMvaOversikt(); }
  if (id === "klinikkSide") { oppdaterAdminKlinikkSynlighet(); fyllKlinikkSkjemaMedAktivKlinikk(); settKlinikkSkjemaLesemodusForVanligVet(); }
  if (id === "journalLoggSide" && typeof lastJournalLogg === "function") {
    lastJournalLogg();
  }
}




async function hentVetInnloggetEpost() {
  try {
    const { data } = await supabaseClient.auth.getUser();
    vetInnloggetEpost = String(data?.user?.email || "").toLowerCase();
    vetInnloggetAuthUserId = data?.user?.id || "";
    return vetInnloggetEpost;
  } catch (e) {
    console.warn("Kunne ikke hente innlogget bruker:", e);
    return "";
  }
}

async function lastVetKlinikkTilgang() {
  const epost = await hentVetInnloggetEpost();
  vetErSystemAdmin = epost === "greknuts@online.no";

  if (!epost) {
    vetAktivKlinikkId = null;
    vetAktivKlinikk = null;
    vetKlinikkRolle = "";
    vetInnloggetBrukerNavn = "";
    vetInnloggetKlinikkBrukerId = "";
    vetAdminCache = false;
    oppdaterAktivKlinikkInfo();
    return;
  }

  if (vetErSystemAdmin) {
    // Systemadmin skal fortsatt se alle klinikker, men må ha en aktiv klinikk_id
    // når det lagres bil/lager. Hent brukerens egen klinikkkobling hvis den finnes.
    try {
      const { data: sysBruker, error: sysErr } = await supabaseClient
        .from("vet_klinikk_brukere")
        .select("id, klinikk_id, rolle, navn, epost, auth_user_id, vet_klinikker(*)")
        .eq("epost", epost)
        .eq("aktiv", true)
        .maybeSingle();

      if (!sysErr && sysBruker) {
        vetAktivKlinikkId = sysBruker.klinikk_id || null;
        vetAktivKlinikk = sysBruker.vet_klinikker || null;
        vetInnloggetKlinikkBrukerId = sysBruker.id || "";
        vetInnloggetBrukerNavn = String(sysBruker.navn || sysBruker.epost || epost || "Systemadmin").trim();
      } else {
        vetAktivKlinikkId = null;
        vetAktivKlinikk = null;
        vetInnloggetKlinikkBrukerId = "";
        vetInnloggetBrukerNavn = "Systemadmin";
      }
    } catch (e) {
      console.warn("Kunne ikke hente klinikkkobling for systemadmin:", e);
      vetAktivKlinikkId = null;
      vetAktivKlinikk = null;
      vetInnloggetKlinikkBrukerId = "";
      vetInnloggetBrukerNavn = "Systemadmin";
    }

    vetKlinikkRolle = "systemadmin";
    vetAdminCache = true;
    oppdaterAktivKlinikkInfo();
    return;
  }

  const { data, error } = await supabaseClient
    .from("vet_klinikk_brukere")
    .select("id, klinikk_id, rolle, navn, epost, auth_user_id, vet_klinikker(*)")
    .eq("epost", epost)
    .eq("aktiv", true)
    .maybeSingle();

  if (error) {
    console.warn("Feil ved henting av klinikktilgang:", error.message);
    vetAktivKlinikkId = null;
    vetAktivKlinikk = null;
    vetKlinikkRolle = "";
    vetAdminCache = false;
    oppdaterAktivKlinikkInfo("Fant ikke klinikktilgang for innlogget bruker.");
    return;
  }

  vetInnloggetKlinikkBrukerId = data?.id || "";
  vetAktivKlinikkId = data?.klinikk_id || null;
  vetAktivKlinikk = data?.vet_klinikker || null;
  vetKlinikkRolle = data?.rolle || "veterinaer";
  vetInnloggetBrukerNavn = String(data?.navn || data?.epost || epost || "").trim();

  const rolle = String(vetKlinikkRolle || "").toLowerCase();
  vetErSystemAdmin =
    vetErSystemAdmin ||
    rolle === "systemadmin" ||
    epost === "greknuts@online.no";

  vetAdminCache =
    vetErSystemAdmin ||
    rolle === "admin" ||
    rolle === "systemadmin";

  oppdaterAktivKlinikkInfo();
}

function erKlinikkAdmin() {
  const rolle = String(vetKlinikkRolle || "").toLowerCase();

  return vetErSystemAdmin ||
         rolle === "admin" ||
         rolle === "systemadmin";
}

async function erVetAdmin() {
  if (vetAdminCache === null) await lastVetKlinikkTilgang();
  return vetAdminCache === true || vetErSystemAdmin === true;
}

function erVetAdminSync() {
  return erKlinikkAdmin();
}

function erVetVisningVanlig() {
  return !erKlinikkAdmin() || vetVisSomVeterinaer === true;
}


function vetRolleVisningsnavn() {
  if (vetErSystemAdmin) return "Systemadministrator";
  const rolle = String(vetKlinikkRolle || "veterinaer").toLowerCase();
  if (rolle === "admin") return "Klinikkadministrator";
  return "Veterinær";
}

function oppdaterVetToppInfo() {
  const navnEl = document.getElementById("vetToppNavn");
  const rolleEl = document.getElementById("vetToppRolle");

  const navn = String(vetInnloggetBrukerNavn || vetInnloggetEpost || "Veterinær").trim();
  if (navnEl) navnEl.textContent = navn || "Veterinær";
  if (rolleEl) rolleEl.textContent = vetRolleVisningsnavn();
}


function opprettVetPasientKnapper() {
  // Ryddet versjon: ingen ekstra hurtigknapper legges i toppmenyen.
  // Toppmenyen har allerede Pasienter / Journal / Bil og lager / Fyll bil / Lagerlogg.
  const wrap = document.getElementById("vetPasientHurtigKnapper");
  if (wrap) wrap.remove();
}



function visVetPasientKnapperAlltid() {
  const wrap = document.getElementById("vetPasientHurtigKnapper");
  if (!wrap) return;
  wrap.style.display = "flex";
  wrap.querySelectorAll("button").forEach(knapp => {
    knapp.style.display = "inline-block";
  });
}

function oppdaterVetMenySynlighet() {
  oppdaterVetToppInfo();

  const admin = erKlinikkAdmin();
  const vanlig = erVetVisningVanlig();

  const visInfo = document.getElementById("vetVisningInfo");
  if (visInfo) visInfo.style.display = "none";

  // Standard brukerknapper skal alltid være synlige for innlogget veterinær/admin.
  document.querySelectorAll(".vet-bruker-nav").forEach(el => {
    el.style.display = "inline-block";
  });

  // Admin og systemadmin skal se adminvalg. Vanlig veterinær skal ikke.
  document.querySelectorAll(".vet-admin-nav").forEach(el => {
    el.style.display = admin && !vanlig ? "inline-block" : "none";
  });

  document.querySelectorAll(".vet-systemadmin-nav").forEach(el => {
    el.style.display = vetErSystemAdmin && !vanlig ? "inline-block" : "none";
  });

  document.querySelectorAll(".vet-faktura-nav").forEach(el => {
    el.style.display = admin && !vanlig ? "inline-block" : "none";
  });

  const oppsettKnapp = document.getElementById("vetOppsettKnapp");
  if (oppsettKnapp) {
    oppsettKnapp.style.display = admin && !vanlig ? "inline-block" : "none";
  }

  const visSomVetKnapp = document.getElementById("vetVisSomVeterinaerKnapp");
  if (visSomVetKnapp) {
    visSomVetKnapp.style.display = admin ? "inline-block" : "none";
    visSomVetKnapp.textContent = vetVisSomVeterinaer ? "Vis som admin" : "Vis som vanlig veterinær";
  }

  ["vetArbeidMeny", "vetAdminMeny"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("skjult");
      el.style.display = "none";
    }
  });
}

function toggleVetArbeidMeny() {
  const meny = document.getElementById("vetArbeidMeny");
  const adminMeny = document.getElementById("vetAdminMeny");
  if (!meny) return;

  if (adminMeny) {
    adminMeny.classList.add("skjult");
    adminMeny.style.display = "none";
  }

  const skalVises = meny.classList.contains("skjult") || meny.style.display === "none";
  meny.classList.toggle("skjult", !skalVises);
  meny.style.display = skalVises ? "block" : "none";
}

function toggleVetAdminMeny() {
  const meny = document.getElementById("vetAdminMeny");
  const arbeidMeny = document.getElementById("vetArbeidMeny");
  if (!meny) return;

  if (arbeidMeny) {
    arbeidMeny.classList.add("skjult");
    arbeidMeny.style.display = "none";
  }

  const skalVises = meny.classList.contains("skjult") || meny.style.display === "none";
  meny.classList.toggle("skjult", !skalVises);
  meny.style.display = skalVises ? "block" : "none";
}

function toggleVetOppsettMeny(ev) {
  if (ev) {
    try { ev.preventDefault(); ev.stopPropagation(); } catch(e) {}
  }
  const meny = document.getElementById("vetOppsettMeny");
  if (!meny) return false;
  const erSkjult = meny.classList.contains("skjult") || meny.style.display === "none" || getComputedStyle(meny).display === "none";
  if (erSkjult) {
    meny.classList.remove("skjult");
    meny.style.display = "block";
  } else {
    meny.classList.add("skjult");
    meny.style.display = "none";
  }
  return false;
}

function byttVetRollevisning() {
  if (!erKlinikkAdmin()) return;
  vetVisSomVeterinaer = !vetVisSomVeterinaer;
  oppdaterVetMenySynlighet();
  if (typeof oppdaterAdminKlinikkSynlighet === "function") oppdaterAdminKlinikkSynlighet();
  visVetSide(vetVisSomVeterinaer ? "journalSide" : "klinikkSide");
}


function oppdaterAktivKlinikkInfo(tekst = "") {
  oppdaterVetToppInfo();
  const el = document.getElementById("aktivKlinikkInfo");
  if (!el) return;

  if (tekst) {
    el.textContent = tekst;
    return;
  }

  if (vetErSystemAdmin) {
    el.textContent = "Systemadmin: viser alle klinikker" + (vetAktivKlinikk?.navn ? " | aktiv klinikk for lagring: " + vetAktivKlinikk.navn : "");
  } else if (vetAktivKlinikk?.navn) {
    el.textContent = "Innlogget på klinikk: " + vetAktivKlinikk.navn +
      (vetKlinikkRolle ? " (" + vetKlinikkRolle + ")" : "");
  } else {
    el.textContent = "Ingen klinikk er koblet til brukeren.";
  }
}

function filtrerKlinikkQuery(query, kolonne = "klinikk_id") {
  if (vetErSystemAdmin === true) return query;
  if (!vetAktivKlinikkId) return query.eq(kolonne, "__ingen_klinikk__");
  return query.eq(kolonne, vetAktivKlinikkId);
}

function leggTilKlinikkHvisVanligBruker(rad) {
  if (!vetErSystemAdmin && vetAktivKlinikkId) {
    rad.klinikk_id = vetAktivKlinikkId;
  }
  return rad;
}


async function lastVetKlinikkBrukereAlle() {
  let query = supabaseClient
    .from("vet_klinikk_brukere")
    .select("id, navn, epost, rolle, aktiv, klinikk_id, auth_user_id")
    .eq("aktiv", true)
    .order("navn", { ascending: true });

  query = filtrerKlinikkQuery(query);

  const { data, error } = await query;
  if (error) {
    console.warn("Kunne ikke hente veterinærer/brukere:", error.message);
    vetAlleKlinikkBrukere = [];
    return;
  }

  vetAlleKlinikkBrukere = data || [];
}

function finnBehandlerNavnForJournal(journal) {
  const opprettetAv = String(journal?.opprettet_av || "");
  const epost = String(journal?.opprettet_av_epost || journal?.epost || "").toLowerCase();

  // 1) Direkte navn hvis vi senere lagrer det på journalen.
  if (journal?.behandler_navn) return String(journal.behandler_navn);

  // 2) Finn behandler via auth_user_id, intern bruker-id eller e-post.
  // Nye journaler lagrer helst vet_klinikk_brukere.id fordi auth_user_id ofte mangler på gamle testbrukere.
  const bruker = vetAlleKlinikkBrukere.find(b =>
    (opprettetAv && String(b.id || "") === opprettetAv) ||
    (opprettetAv && String(b.auth_user_id || "") === opprettetAv) ||
    (epost && String(b.epost || "").toLowerCase() === epost)
  );

  if (bruker?.navn) return bruker.navn;
  if (bruker?.epost) return bruker.epost;

  // 3) Journal laget av innlogget bruker i denne sesjonen.
  if (opprettetAv && (
      opprettetAv === String(vetInnloggetKlinikkBrukerId || "") ||
      opprettetAv === String(vetInnloggetAuthUserId || "")
    )) {
    return vetInnloggetBrukerNavn || vetInnloggetEpost || "";
  }

  // 4) Gamle testjournaler kan mangle opprettet_av. Da er det bedre å vise
  // innlogget veterinær enn "Ukjent" når en vanlig veterinær skriver ut.
  if (!vetErSystemAdmin && (vetInnloggetBrukerNavn || vetInnloggetEpost)) {
    return vetInnloggetBrukerNavn || vetInnloggetEpost;
  }

  // 5) Hvis klinikken bare har én aktiv veterinærbruker, bruk den som fallback.
  const aktiveVeterinaerer = vetAlleKlinikkBrukere.filter(b => String(b.rolle || "").toLowerCase() !== "admin");
  if (aktiveVeterinaerer.length === 1) {
    return aktiveVeterinaerer[0].navn || aktiveVeterinaerer[0].epost || "Ukjent";
  }

  return "Ukjent";
}

function skjulAdminKnapperForVanligVet() {
  // Menyen styres med klasser i HTML.
  // Vanlig veterinær ser bare Pasienter, Min bil, Journal, Faktura og Logg ut.
  // Admin/systemadmin kan veksle til "Vis som vanlig veterinær".
  oppdaterVetMenySynlighet();
}


async function lastVetData() {
  await lastVetKlinikkTilgang();

  await Promise.all([
    lastKlinikker(),
    lastDyreeiere(),
    lastDyr(),
    lastJournal(),
    lastPriser(),
    lastVetLagerAlt(),
    lastVetKlinikkBrukereAlle()
  ]);

  // Må kjøres etter lastDyreeiere(), ellers kan felles faktura-tabell gi tall fra andre moduler.
  await lastVetFakturaer();

  fyllDyreeierValg();
  fyllDyrValg();
  fyllDyreeierDyrValg(vetTekst("dyreeierId"));
  skjulAdminKnapperForVanligVet();
  opprettVetPasientKnapper();

  // Produksjon: vis først når rolle og meny er ferdig filtrert.
  try { document.body.classList.remove("vet-loading"); } catch(e) {}
}



/* ===== JOURNALTILGANG: ikke vis blank side ===== */
(function(){
  const gammelLastJournalLogg = typeof window.lastJournalLogg === "function" ? window.lastJournalLogg : (typeof lastJournalLogg === "function" ? lastJournalLogg : null);

  window.lastJournalLogg = async function() {
    const liste = document.getElementById("journalLoggListe");
    if (liste && (!liste.innerHTML || !liste.innerHTML.trim())) {
      liste.innerHTML = '<p class="lite">Laster journaltilgang ...</p>';
    }

    try {
      if (gammelLastJournalLogg) {
        const r = await gammelLastJournalLogg();
        if (liste && !String(liste.innerHTML || "").trim()) {
          liste.innerHTML = '<p class="lite">Ingen journaltilgang er logget ennå.</p>';
        }
        return r;
      }

      if (liste) {
        liste.innerHTML = '<p class="lite">Journaltilgang-logg er ikke koblet ennå.</p>';
      }
    } catch (e) {
      if (liste) {
        liste.innerHTML =
          '<div class="melding">Kunne ikke hente journaltilgang: ' +
          String(e && e.message ? e.message : e)
            .replaceAll("&","&amp;")
            .replaceAll("<","&lt;")
            .replaceAll(">","&gt;") +
          '</div>';
      }
    }
  };
})();




