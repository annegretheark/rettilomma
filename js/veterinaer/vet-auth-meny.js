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
    vetAktivKlinikkId = null;
    vetAktivKlinikk = null;
    vetKlinikkRolle = "systemadmin";
    vetInnloggetBrukerNavn = "Systemadmin";
    vetInnloggetKlinikkBrukerId = "";
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
  return;
}


function visVetPasientKnapperAlltid() {
  return;
}

function oppdaterVetMenySynlighet() {
  oppdaterVetToppInfo();

  const adminModus = erKlinikkAdmin();
  const systemAdminModus = vetErSystemAdmin;

  const arbeidKnapp = document.getElementById("vetArbeidKnapp");
  if (arbeidKnapp) arbeidKnapp.style.display = "inline-block";

  document.querySelectorAll(".vet-admin-nav").forEach(el => {
    el.style.display = adminModus ? "inline-block" : "none";
  });

  document.querySelectorAll(".vet-systemadmin-nav").forEach(el => {
    el.style.display = systemAdminModus ? "inline-block" : "none";
  });

  const toggle = document.getElementById("vetVisSomVeterinaerKnapp");
  if (toggle) toggle.style.display = "none";

  const info = document.getElementById("vetVisningInfo");
  if (info) info.style.display = "none";

  ["vetArbeidMeny", "vetOppsettMeny"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("skjult");
      el.style.display = "none";
    }
  });
}

function toggleVetArbeidMeny() {
  const meny = document.getElementById("vetArbeidMeny");
  const adminMeny = document.getElementById("vetOppsettMeny");
  if (!meny) return;

  if (adminMeny) {
    adminMeny.classList.add("skjult");
    adminMeny.style.display = "none";
  }

  const erSkjult = meny.classList.contains("skjult") || meny.style.display === "none";
  if (erSkjult) {
    meny.classList.remove("skjult");
    meny.style.display = "block";
  } else {
    meny.classList.add("skjult");
    meny.style.display = "none";
  }
}

function toggleVetOppsettMeny() {
  const meny = document.getElementById("vetOppsettMeny");
  if (!meny) return;
  const erSkjult = meny.classList.contains("skjult") || meny.style.display === "none";
  if (erSkjult) {
    meny.classList.remove("skjult");
    meny.style.display = "block";
  } else {
    meny.classList.add("skjult");
    meny.style.display = "none";
  }
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
    el.textContent = "Systemadmin: viser alle klinikker.";
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
    lastVetFakturaer(),
    lastVetKlinikkBrukereAlle()
  ]);

  fyllDyreeierValg();
  fyllDyrValg();
  fyllDyreeierDyrValg(vetTekst("dyreeierId"));
  skjulAdminKnapperForVanligVet();
  opprettVetPasientKnapper();
}
