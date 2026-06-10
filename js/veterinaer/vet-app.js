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
  document.querySelectorAll("#klinikkSide,#eierSide,#dyrSide,#prisSide,#lagerSide,#journalSide,#fakturaSide,#okonomiSide,#backupSide").forEach(el => {
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
  if (document.getElementById("vetPasientHurtigKnapper")) return;

  const nav =
    document.getElementById("vetMeny") ||
    document.querySelector(".vet-meny") ||
    document.querySelector("nav") ||
    document.querySelector("header") ||
    document.body;

  if (!nav) return;

  const wrap = document.createElement("div");
  wrap.id = "vetPasientHurtigKnapper";
  wrap.style.display = "flex";
  wrap.style.flexWrap = "wrap";
  wrap.style.gap = "8px";
  wrap.style.margin = "8px 0";

  const lagKnapp = (tekst, sideId) => {
    const knapp = document.createElement("button");
    knapp.type = "button";
    knapp.textContent = tekst;
    knapp.className = "vet-bruker-nav secondary";
    knapp.onclick = () => sideId === "eierSide" ? nyDyreeier() : nyPasient();
    knapp.style.display = "inline-block";
    return knapp;
  };

  wrap.appendChild(lagKnapp("Ny dyreeier", "eierSide"));
  wrap.appendChild(lagKnapp("Ny pasient", "dyrSide"));

  if (nav === document.body) {
    document.body.insertBefore(wrap, document.body.firstChild);
  } else {
    nav.appendChild(wrap);
  }
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

  const arbeidKnapp = document.getElementById("vetArbeidKnapp");
  const adminKnapp = document.getElementById("vetAdminKnapp");
  const visInfo = document.getElementById("vetVisningInfo");

  if (arbeidKnapp) arbeidKnapp.style.display = "inline-block";
  if (adminKnapp) adminKnapp.style.display = admin ? "inline-block" : "none";
  if (visInfo) visInfo.style.display = "none";

  document.querySelectorAll(".vet-admin-nav,.vet-systemadmin-nav,.vet-oppsett-nav,.vet-admin-toggle").forEach(el => {
    el.style.display = "none";
  });

  ["vetArbeidMeny", "vetAdminMeny", "vetOppsettMeny"].forEach(id => {
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
    lastVetKlinikkBrukereAlle()
  ]);

  // Må kjøres etter lastDyreeiere(), ellers kan felles faktura-tabell gi tall fra andre moduler.
  await lastVetFakturaer();

  fyllDyreeierValg();
  fyllDyrValg();
  fyllDyreeierDyrValg(vetTekst("dyreeierId"));
  skjulAdminKnapperForVanligVet();
  opprettVetPasientKnapper();
}

async function lastKlinikker() {
  let query = supabaseClient
    .from("vet_klinikker")
    .select("*")
    .order("navn", { ascending: true });

  query = filtrerKlinikkQuery(query, "id");

  const { data, error } = await query;
  if (error) {
    vetMelding("klinikkMelding", "Feil ved henting av klinikker: " + error.message);
    return;
  }
  vetKlinikker = data || [];
  tegnKlinikker();
}



function oppdaterAdminKlinikkSynlighet() {
  const logoEl = document.getElementById("adminKlinikkLogo");
  const brukerEl = document.getElementById("adminKlinikkBrukere");
  const synlig = erKlinikkAdmin() && !erVetVisningVanlig();

  [logoEl, brukerEl].forEach(el => {
    if (!el) return;
    if (synlig) {
      el.classList.remove("skjult");
      el.style.display = "";
    } else {
      el.classList.add("skjult");
      el.style.display = "none";
    }
  });
  oppdaterVetMenySynlighet();
}

function visKlinikkLogoPreview(url) {
  const preview = document.getElementById("klinikkLogoPreview");
  if (!preview) return;

  if (url) {
    preview.src = url;
    preview.classList.remove("skjult");
    preview.style.display = "";
  } else {
    preview.removeAttribute("src");
    preview.classList.add("skjult");
    preview.style.display = "none";
  }
}

function forhåndsvisKlinikkLogo() {
  const fil = document.getElementById("klinikkLogoFil")?.files?.[0];
  if (!fil) return;

  const reader = new FileReader();
  reader.onload = e => visKlinikkLogoPreview(e.target.result);
  reader.readAsDataURL(fil);
}

async function lastOppKlinikkLogo(klinikkId) {
  const fil = document.getElementById("klinikkLogoFil")?.files?.[0];

  if (!fil || !klinikkId) {
    return null;
  }

  const filtype = (fil.name || "").split(".").pop() || "png";
  const tryggExt = String(filtype).toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const sti = `${klinikkId}/logo.${tryggExt}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(VET_LOGO_BUCKET)
    .upload(sti, fil, {
      cacheControl: "3600",
      upsert: true,
      contentType: fil.type || "image/png"
    });

  if (uploadError) {
    vetMelding("klinikkMelding", "Klinikk lagret, men logo kunne ikke lastes opp: " + uploadError.message);
    return null;
  }

  const { data } = supabaseClient.storage
    .from(VET_LOGO_BUCKET)
    .getPublicUrl(sti);

  return data?.publicUrl || null;
}

function hentValgtKlinikk() {
  const id = vetTekst("klinikkId");
  if (!id && vetKlinikker.length === 1) return vetKlinikker[0];
  return vetKlinikker.find(k => String(k.id) === String(id)) || null;
}

function settStandardKmPrisFraKlinikk() {
  const k = hentValgtKlinikk();
  const kmPris = Number(k?.km_pris || 5.30);
  if (!vetTekst("journalKmPris")) {
    vetSett("journalKmPris", kmPris.toFixed(2));
  }
}



function settKlinikkSkjemaLesemodusForVanligVet() {
  const erAdmin = erKlinikkAdmin() && !erVetVisningVanlig();
  const ids = ["klinikkNavn","konsernNavn","klinikkTelefon","klinikkEpost","klinikkAdresse","klinikkKmPris","klinikkLogoFil"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !erAdmin;
  });

  const lagre = document.getElementById("lagreKlinikkKnapp");
  if (lagre) lagre.style.display = erAdmin ? "" : "none";
}

function fyllKlinikkSkjemaMedAktivKlinikk() {
  if (vetErSystemAdmin === true || !vetAktivKlinikk) return;

  vetSett("klinikkId", vetAktivKlinikk.id);
  vetSett("klinikkNavn", vetAktivKlinikk.navn);
  vetSett("konsernNavn", vetAktivKlinikk.konsern_navn);
  vetSett("klinikkTelefon", vetAktivKlinikk.telefon);
  vetSett("klinikkEpost", vetAktivKlinikk.epost);
  vetSett("klinikkAdresse", vetAktivKlinikk.adresse);
  vetSett("klinikkKmPris", vetAktivKlinikk.km_pris || "5.30");
  visKlinikkLogoPreview(vetAktivKlinikk.logo_url || "");
}

async function lastPriser() {
  const { data, error } = await supabaseClient
    .from("vet_priser")
    .select("*")
    .order("navn", { ascending: true });
  if (error) {
    vetMelding("prisMelding", "Feil ved henting av priser: " + error.message);
    return;
  }
  vetPriser = data || [];
  tegnPriser();
  fyllPrisValg();
}

function vetTall(id) {
  const verdi = String(document.getElementById(id)?.value || "").replace(",", ".").trim();
  const tall = Number(verdi);
  return Number.isFinite(tall) ? tall : 0;
}

function formaterKr(tall) {
  return Number(tall || 0).toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


function vetTryggFilnavn(navn) {
  return String(navn || "bilde")
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[å]/g, "a")
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

function hentValgteJournalBilder() {
  const filer = [];
  const galleri = document.getElementById("journalBildeGalleri");
  const kamera = document.getElementById("journalBildeKamera");

  if (galleri?.files?.length) filer.push(...Array.from(galleri.files));
  if (kamera?.files?.length) filer.push(...Array.from(kamera.files));

  return filer;
}

function oppdaterJournalBildeInfo() {
  const el = document.getElementById("journalBildeInfo");
  if (!el) return;
  const antall = hentValgteJournalBilder().length;
  el.textContent = antall ? `${antall} bilde(r) valgt.` : "Ingen bilder valgt.";
}

function nullstillJournalBilder() {
  const galleri = document.getElementById("journalBildeGalleri");
  const kamera = document.getElementById("journalBildeKamera");
  if (galleri) galleri.value = "";
  if (kamera) kamera.value = "";
  vetSett("journalBildeTekst", "");
  oppdaterJournalBildeInfo();
}

async function lagreJournalBilder(journalId) {
  const filer = hentValgteJournalBilder();
  if (!journalId || !filer.length) return true;

  const bildetekst = vetTekst("journalBildeTekst") || null;
  const rader = [];

  for (const fil of filer) {
    const filnavn = vetTryggFilnavn(fil.name || "journalbilde.jpg");
    const sti = `${journalId}/${Date.now()}_${Math.random().toString(16).slice(2)}_${filnavn}`;

    const { error: uploadError } = await supabaseClient.storage
      .from(VET_BILDE_BUCKET)
      .upload(sti, fil, {
        cacheControl: "3600",
        upsert: false,
        contentType: fil.type || "image/jpeg"
      });

    if (uploadError) {
      vetMelding("journalMelding", "Journal lagret, men bilde kunne ikke lastes opp: " + uploadError.message);
      return false;
    }

    const { data: publicData } = supabaseClient.storage
      .from(VET_BILDE_BUCKET)
      .getPublicUrl(sti);

    rader.push({
      journal_id: journalId,
      filnavn: fil.name || filnavn,
      bilde_url: publicData?.publicUrl || null,
      bildetekst
    });
  }

  if (!rader.length) return true;

  const { error } = await supabaseClient
    .from("vet_journal_bilder")
    .insert(rader);

  if (error) {
    vetMelding("journalMelding", "Journal lagret, men bildedata kunne ikke lagres: " + error.message);
    return false;
  }

  return true;
}



function journalBehandlingerSum() {
  return vetJournalBehandlingerTemp.reduce((sum, b) => {
    return sum + (Number(b.antall || 0) * Number(b.pris || 0));
  }, 0);
}

function journalBehandlingerTekst() {
  if (!vetJournalBehandlingerTemp.length) return "";
  const linjer = vetJournalBehandlingerTemp.map(b => {
    const sum = Number(b.antall || 0) * Number(b.pris || 0);
    return `- ${b.navn || "Behandling"} (${b.type || "fastpris"}): ${formaterKr(b.antall)} x ${formaterKr(b.pris)} kr = ${formaterKr(sum)} kr eks. mva`;
  });
  return "Behandlinger:\n" + linjer.join("\n");
}

function tegnJournalBehandlingListe() {
  const liste = document.getElementById("journalBehandlingListe");
  if (!liste) return;

  if (!vetJournalBehandlingerTemp.length) {
    liste.innerHTML = "Ingen behandlinger lagt til.";
    return;
  }

  liste.innerHTML = vetJournalBehandlingerTemp.map((b, index) => {
    const sum = Number(b.antall || 0) * Number(b.pris || 0);
    return `
      <div class="listekort">
        <strong>${String(b.navn || "").replaceAll("<", "&lt;")}</strong><br>
        <span class="lite">${b.type || "fastpris"}: ${formaterKr(b.antall)} x ${formaterKr(b.pris)} kr = ${formaterKr(sum)} kr eks. mva</span><br>
        <button type="button" class="danger" onclick="fjernJournalBehandling(${index})">Fjern</button>
      </div>
    `;
  }).join("");
}

function leggTilJournalBehandling() {
  vetMelding("journalMelding", "");

  const id = vetTekst("journalPrisValg");
  const p = vetPriser.find(x => String(x.id) === String(id));

  if (!p) {
    vetMelding("journalMelding", "Velg behandling før du legger den til.");
    return;
  }

  if (!erPrisEnBehandling(p)) {
    vetMelding("journalMelding", "Dette er ikke en behandling. Bruk eget felt for kjøring eller varer/medisiner fra bil.");
    vetSett("journalPrisValg", "");
    return;
  }

  const antall = vetTall("journalBehandlingAntall") || 1;

  if (antall <= 0) {
    vetMelding("journalMelding", "Antall/timer må være større enn 0.");
    return;
  }

  vetJournalBehandlingerTemp.push({
    pris_id: p.id,
    navn: p.navn || "Behandling",
    type: p.type || "fastpris",
    antall,
    pris: Number(p.pris || 0)
  });

  vetSett("journalPrisValg", "");
  vetSett("journalBehandlingAntall", "1");

  tegnJournalBehandlingListe();
  oppdaterJournalSum();
}

function fjernJournalBehandling(index) {
  vetJournalBehandlingerTemp.splice(index, 1);
  tegnJournalBehandlingListe();
  oppdaterJournalSum();
}

function nullstillJournalBehandlinger() {
  vetJournalBehandlingerTemp = [];
  vetSett("journalPrisValg", "");
  vetSett("journalBehandlingAntall", "1");
  tegnJournalBehandlingListe();
  oppdaterJournalSum();
}

function journalVarerSum() {
  return vetJournalVarerTemp.reduce((sum, v) => {
    return sum + (Number(v.antall || 0) * Number(v.pris || 0));
  }, 0);
}

function tegnJournalVareListe() {
  const liste = document.getElementById("journalVareListe");
  if (!liste) return;

  if (!vetJournalVarerTemp.length) {
    liste.innerHTML = "Ingen varer lagt til.";
    return;
  }

  liste.innerHTML = vetJournalVarerTemp.map((v, index) => {
    const sum = Number(v.antall || 0) * Number(v.pris || 0);
    return `
      <div class="listekort">
        <span>${String(v.varenavn || "").replaceAll("<", "&lt;")}<span><br>
        <span class="lite">${formaterKr(v.antall)} x ${formaterKr(v.pris)} kr = ${formaterKr(sum)} kr eks. mva${v.bil_id ? " | Fra bil: " + bilNavn(v.bil_id) : ""}</span><br>
        <button type="button" class="danger" onclick="fjernJournalVare(${index})">Fjern</button>
      </div>
    `;
  }).join("");
}

function leggTilJournalVare() {
  vetMelding("journalMelding", "");

  const varenavn = vetTekst("journalVareNavn");
  const antall = vetTall("journalVareAntall");
  const pris = vetTall("journalVarePris");

  if (!varenavn) {
    vetMelding("journalMelding", "Skriv varenavn/medisin før du legger til vare.");
    return;
  }

  if (antall <= 0 || !Number.isInteger(antall)) {
    vetMelding("journalMelding", "Antall må være et heltall større enn 0.");
    return;
  }

  if (pris < 0) {
    vetMelding("journalMelding", "Pris kan ikke være negativ.");
    return;
  }

  vetJournalVarerTemp.push({
    varenavn,
    antall,
    pris
  });

  vetSett("journalVareNavn", "");
  vetSett("journalVareAntall", "1");
  vetSett("journalVarePris", "");

  tegnJournalBehandlingListe();
  tegnJournalVareListe();
  oppdaterJournalSum();
}

function fjernJournalVare(index) {
  vetJournalVarerTemp.splice(index, 1);
  tegnJournalBehandlingListe();
  tegnJournalVareListe();
  oppdaterJournalSum();
}

function nullstillJournalVarer() {
  vetJournalVarerTemp = [];
  vetSett("journalVareNavn", "");
  vetSett("journalVareAntall", "1");
  vetSett("journalVarePris", "");
  tegnJournalBehandlingListe();
  tegnJournalVareListe();
  oppdaterJournalSum();
}

async function lagreJournalVarer(journalId) {
  if (!journalId || !vetJournalVarerTemp.length) return true;

  const rader = vetJournalVarerTemp.map(v => ({
    journal_id: journalId,
    vare_id: v.vare_id || null,
    bil_id: v.bil_id || null,
    varenavn: v.varenavn,
    antall: Number(v.antall || 0),
    pris: Number(v.pris || 0)
  }));

  const { error } = await supabaseClient
    .from("vet_journal_varer")
    .insert(rader);

  if (error) {
    vetMelding("journalMelding", "Journal lagret, men varer kunne ikke lagres: " + error.message);
    return false;
  }

  const lagerOk = await trekkBilLagerEtterJournal();
  if (lagerOk) await lastVetLagerAlt();
  return lagerOk;
}


async function lagrePris() {
  vetMelding("prisMelding", "");
  const rad = {
    navn: vetTekst("prisNavn"),
    type: vetTekst("prisType") || "fastpris",
    pris: vetTall("prisBelop"),
    beskrivelse: vetTekst("prisBeskrivelse") || null,
    aktiv: true
  };
  if (!rad.navn) { vetMelding("prisMelding", "Skriv navn på prisen."); return; }
  if (rad.pris < 0) { vetMelding("prisMelding", "Pris kan ikke være negativ."); return; }
  const id = vetTekst("prisId");
  const query = id ? supabaseClient.from("vet_priser").update(rad).eq("id", id) : supabaseClient.from("vet_priser").insert(rad);
  const { error } = await query;
  if (error) { vetMelding("prisMelding", "Feil ved lagring av pris: " + error.message); return; }
  nullstillPris();
  vetMelding("prisMelding", "Pris lagret.");
  await lastPriser();
}

function nullstillPris() {
  ["prisId","prisNavn","prisBelop","prisBeskrivelse"].forEach(id => vetSett(id,""));
  vetSett("prisType", "fastpris");
}

function tegnPriser() {
  const liste = document.getElementById("prisListe");
  if (!liste) return;

  if (!vetPriser.length) {
    liste.innerHTML = '<p class="lite">Ingen priser registrert ennå.</p>';
    return;
  }

  const esc = txt => String(txt || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  liste.innerHTML = `
    <div class="vet-pris-linjeliste" style="display:grid;gap:1px;margin-top:8px;font-size:14px;font-weight:400;">
      ${vetPriser.map(p => `
        <button
          type="button"
          class="vet-pris-linje"
          onclick="redigerPris('${esc(p.id)}')"
          title="Klikk for detaljer/redigering"
          style="
            width:100%;
            display:grid;
            grid-template-columns:minmax(220px,2fr) minmax(100px,.8fr) minmax(150px,1fr) minmax(160px,1.2fr);
            gap:10px;
            align-items:center;
            text-align:left;
            padding:3px 8px;
            border:1px solid rgba(255,255,255,.08);
            border-radius:0;
            background:rgba(255,255,255,.02);
            color:inherit;
            cursor:pointer;
            font-family:inherit;
            font-size:14px !important;
            font-weight:400 !important;
            line-height:1.15;
            margin:0;
          "
        >
          <span class="lite" style="font-size:14px !important;font-weight:400 !important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.navn)}</span>
          <span class="lite" style="font-size:14px !important;font-weight:400 !important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.type || "fastpris")}</span>
          <span class="lite" style="font-size:14px !important;font-weight:400 !important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${formaterKr(p.pris)} kr eks. mva</span>
          <span class="lite" style="font-size:14px !important;font-weight:400 !important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.beskrivelse || "")}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function redigerPris(id) {
  const p = vetPriser.find(x => String(x.id) === String(id));
  if (!p) return;
  vetSett("prisId", p.id);
  vetSett("prisNavn", p.navn);
  vetSett("prisType", p.type || "fastpris");
  vetSett("prisBelop", p.pris);
  vetSett("prisBeskrivelse", p.beskrivelse);
  visVetSide("prisSide");
}

function erPrisEnBehandling(pris) {
  const type = String(pris?.type || "fastpris").toLowerCase().trim();
  const navn = String(pris?.navn || "").toLowerCase().trim();

  // Varer/medisiner skal legges inn fra bil-lager eller manuell varelinje,
  // og kjøring skal ligge i eget km-felt. De skal ikke blandes inn i behandlinger.
  const ikkeBehandlingTyper = ["vare", "varer", "medisin", "medisiner", "kmpris", "km", "kjoring", "kjøring"];
  if (ikkeBehandlingTyper.includes(type)) return false;

  if (navn.includes("kjøring") || navn.includes("kjoring") || navn.includes("km")) return false;

  return true;
}

function fyllPrisValg() {
  const valg = document.getElementById("journalPrisValg");
  if (!valg) return;

  const behandlinger = vetPriser
    .filter(p => p.aktiv !== false)
    .filter(erPrisEnBehandling);

  if (!behandlinger.length) {
    valg.innerHTML = '<option value="">Ingen behandlinger funnet</option>';
    return;
  }

  valg.innerHTML = '<option value="">Velg behandling</option>' + behandlinger
    .map(p => `<option value="${p.id}">${p.navn || ""} - ${formaterKr(p.pris)} kr</option>`)
    .join("");
}


function hentKlinikkIdForLager() {
  if (vetAktivKlinikkId) return vetAktivKlinikkId;
  const valgt = vetTekst("klinikkId");
  if (valgt) return valgt;
  if (vetKlinikker.length === 1) return vetKlinikker[0].id;
  return null;
}

async function lastVetLagerAlt() {
  await Promise.all([
    lastVetVarer(),
    lastVetBiler(),
    lastVetHovedlager(),
    lastVetBilLager()
  ]);
  fyllLagerValg();
  fyllJournalBilValg();
  fyllJournalBilVareValg();
  tegnAltLager();
}

async function lastVetVarer() {
  let query = supabaseClient.from("vet_varer").select("*").eq("aktiv", true).order("navn", { ascending: true });
  query = filtrerKlinikkQuery(query);
  const { data, error } = await query;
  if (error) { vetMelding("vetVareMelding", "Feil ved henting av varer/medisiner: " + error.message); return; }
  vetVarer = data || [];
}

async function lastVetBiler() {
  let query = supabaseClient.from("vet_biler").select("*").eq("aktiv", true).order("navn", { ascending: true });
  query = filtrerKlinikkQuery(query);
  const { data, error } = await query;
  if (error) { vetMelding("vetBilMelding", "Feil ved henting av biler: " + error.message); return; }
  vetBiler = data || [];
}

async function lastVetHovedlager() {
  let query = supabaseClient.from("vet_lager").select("*, vet_varer(*)").order("created_at", { ascending: true });
  query = filtrerKlinikkQuery(query);
  const { data, error } = await query;
  if (error) { vetMelding("hovedlagerMelding", "Feil ved henting av hovedlager: " + error.message); return; }
  vetHovedlager = data || [];
}

async function lastVetBilLager() {
  let query = supabaseClient.from("vet_bil_lager").select("*, vet_varer(*), vet_biler(*)").order("created_at", { ascending: true });
  query = filtrerKlinikkQuery(query);
  const { data, error } = await query;
  if (error) { vetMelding("billagerMelding", "Feil ved henting av bil-lager: " + error.message); return; }
  vetBilLager = data || [];
}

async function lastVetFakturaer() {
  // VIKTIG: fakturaer er en felles tabell som også kan inneholde håndverker/hovslager/testdata.
  // Veterinærmodulen skal derfor bare ta med fakturaer der kunden_id finnes blant vet_dyreeiere
  // som allerede er filtrert på aktiv klinikk/systemadmin. Hvis dyreeiere ikke er lastet ennå,
  // viser vi heller 0 enn å risikere å blande inn tall fra andre moduler.
  const vetKundeIder = new Set((vetDyreeiere || []).map(e => String(e.id)).filter(Boolean));
  if (!vetKundeIder.size) {
    vetFakturaer = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("fakturaer")
    .select("id,fakturanr,dato,eks_mva,mva,inkl_mva,er_kreditnota,kreditnota_for,kunden_id,status,betalingsstatus")
    .in("kunden_id", Array.from(vetKundeIder))
    .order("dato", { ascending: false });

  if (error) {
    console.warn("Feil ved henting av veterinærfakturaer for MVA:", error.message);
    vetFakturaer = [];
    return;
  }

  vetFakturaer = data || [];
}

function vareNavn(vareId) {
  const v = vetVarer.find(x => String(x.id) === String(vareId));
  return v?.navn || "Ukjent vare";
}

function bilNavn(bilId) {
  const b = vetBiler.find(x => String(x.id) === String(bilId));
  return [b?.navn, b?.regnr].filter(Boolean).join(" - ") || "Ukjent bil";
}

function fyllLagerValg() {
  const vareOptions = '<option value="">Velg vare</option>' + vetVarer.map(v => `<option value="${v.id}">${v.navn || ""} (${v.enhet || "stk"})</option>`).join("");
  ["hovedlagerVareValg", "fyllBilVareValg"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = vareOptions;
  });

  const bilOptions = '<option value="">Velg bil</option>' + vetBiler.map(b => { const eier = b.veterinaer_navn ? " | " + b.veterinaer_navn : ""; return `<option value="${b.id}">${[b.navn, b.regnr].filter(Boolean).join(" - ")}${eier}</option>`; }).join("");
  ["fyllBilValg", "journalBilValg"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = bilOptions;
  });

  tegnFyllBilFyllListe();
}

function tegnFyllBilFyllListe() {
  const liste = document.getElementById("fyllBilFyllListe");
  if (!liste) return;

  const rader = vetHovedlager
    .filter(r => Number(r.antall || 0) > 0)
    .map(r => {
      const v = r.vet_varer || vetVarer.find(x => String(x.id) === String(r.vare_id)) || {};
      return { ...r, vare: v };
    })
    .filter(r => r.vare?.navn);

  if (!rader.length) {
    liste.innerHTML = '<p class="lite">Ingen varer på hovedlager.</p>';
    return;
  }

  liste.innerHTML = `
    <div class="vet-linje-liste">
      ${rader.map(r => {
        const v = r.vare;
        const navn = htmlEscape(v.navn || "Vare");
        const enhet = htmlEscape(v.enhet || "stk");
        const maks = Math.floor(Number(r.antall || 0));
        const id = htmlEscape(r.vare_id);
        return `
          <label class="vet-linje-kort" for="fyllbil_velg_${id}" style="grid-template-columns:36px minmax(180px,1.5fr) minmax(110px,.8fr) 120px; cursor:pointer;">
            <input id="fyllbil_velg_${id}" class="fyllbil-velg" data-vare-id="${id}" type="checkbox" style="width:auto;margin:0;">
            <span class="lite" style="font-weight:400 !important;font-size:14px !important;">${navn}</span>
            <span class="lite" style="font-weight:400 !important;font-size:14px !important;">På lager: ${formaterKr(r.antall)} ${enhet}</span>
            <input id="fyllbil_antall_${id}" class="fyllbil-antall" data-vare-id="${id}" type="number" step="1" min="1" max="${maks}" placeholder="Antall" value="" onclick="event.stopPropagation();" style="margin:0;font-weight:400 !important;">
          </label>
        `;
      }).join("")}
    </div>
  `;
}


function normaliserVetTekst(verdi) {
  return String(verdi || "").trim().toLowerCase();
}

function finnStandardBilForInnloggetVeterinaer() {
  const navn = normaliserVetTekst(vetInnloggetBrukerNavn);
  const epost = normaliserVetTekst(vetInnloggetEpost);
  const kortEpost = normaliserVetTekst((vetInnloggetEpost || "").split("@")[0]);

  if (!navn && !epost && !kortEpost) return null;

  return vetBiler.find(b => {
    const vnavn = normaliserVetTekst(b.veterinaer_navn);
    if (!vnavn) return false;
    return vnavn === navn || vnavn === epost || vnavn === kortEpost ||
           (navn && vnavn.includes(navn)) ||
           (kortEpost && vnavn.includes(kortEpost));
  }) || null;
}

function settStandardBilHvisMulig() {
  const el = document.getElementById("journalBilValg");
  if (!el || el.value) return;

  const bil = finnStandardBilForInnloggetVeterinaer();
  if (bil?.id) {
    el.value = bil.id;
    fyllJournalBilVareValg();
  }
}

function fyllJournalBilValg() {
  const el = document.getElementById("journalBilValg");
  if (!el) return;

  const valgt = String(el.value || "").trim();
  el.innerHTML = '<option value="">Velg bil</option>' + (vetBiler || []).map(b => {
    const eier = b.veterinaer_navn ? " | " + b.veterinaer_navn : "";
    const label = [b.navn, b.regnr].filter(Boolean).join(" - ") + eier;
    return `<option value="${b.id}">${label}</option>`;
  }).join("");

  if (valgt) el.value = valgt;

  // Velg automatisk innlogget veterinærs bil, eller eneste bil dersom det bare finnes én.
  if (!el.value) {
    const bil = finnStandardBilForInnloggetVeterinaer();
    if (bil?.id) el.value = bil.id;
  }
  if (!el.value && (vetBiler || []).length === 1) {
    el.value = vetBiler[0].id;
  }

  // Viktig: tegn listen etter at bilen faktisk er satt i selecten.
  setTimeout(() => fyllJournalBilVareValg(), 0);
}

function journalHentValgtBilId() {
  const el = document.getElementById("journalBilValg");
  if (!el) return "";

  let id = String(el.value || "").trim();
  if (id) return id;

  // Hvis nettleseren viser en valgt bil, men value ikke er satt, bruk valgt option.
  const opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
  id = String(opt?.value || "").trim();
  if (id) {
    el.value = id;
    return id;
  }

  // Hvis det bare finnes én faktisk bil i nedtrekket, velg den.
  const reelle = Array.from(el.options || []).filter(o => String(o.value || "").trim());
  if (reelle.length === 1) {
    el.value = reelle[0].value;
    return String(reelle[0].value || "").trim();
  }

  return "";
}

function journalPrisForVare(vare, rad) {
  return Number(
    vare?.utsalgspris ?? vare?.utpris ?? vare?.pris ?? vare?.salgspris ??
    rad?.utsalgspris ?? rad?.utpris ?? rad?.pris ?? 0
  ) || 0;
}

function journalVarenavn(vareId, vare) {
  if (vare?.navn) return vare.navn;
  const funnet = (vetVarer || []).find(v => String(v.id) === String(vareId));
  return funnet?.navn || "Vare/medisin";
}

async function journalHentBilvarer(bilId) {
  let rader = (vetBilLager || [])
    .filter(r => String(r.bil_id) === String(bilId) && Number(r.antall || 0) > 0);

  if (rader.length) return rader;

  // Hent direkte fra Supabase hvis lokal cache ikke er klar.
  try {
    let query = supabaseClient
      .from("vet_bil_lager")
      .select("*, vet_varer(*)")
      .eq("bil_id", bilId)
      .gt("antall", 0)
      .order("created_at", { ascending: true });

    query = filtrerKlinikkQuery(query);

    const { data, error } = await query;
    if (error) throw error;

    rader = data || [];

    // Legg i cache så resten av journalen kan bruke samme data.
    if (rader.length) {
      const andre = (vetBilLager || []).filter(r => String(r.bil_id) !== String(bilId));
      vetBilLager = [...andre, ...rader];
    }
  } catch (e) {
    console.warn("Kunne ikke hente bilvarer:", e);
    const liste = document.getElementById("journalBilVareListe");
    if (liste) liste.innerHTML = `<p class="melding">Kunne ikke hente varer fra bilen: ${String(e.message || e)}</p>`;
    return [];
  }

  return rader;
}

async function fyllJournalBilVareValg() {
  const liste = document.getElementById("journalBilVareListe");
  const select = document.getElementById("journalBilVareValg");
  const bilId = journalHentValgtBilId();

  if (!bilId) {
    if (select) select.innerHTML = '<option value="">Velg bil først</option>';
    if (liste) liste.innerHTML = '<p class="lite">Velg bil først.</p>';
    return;
  }

  if (liste) liste.innerHTML = '<p class="lite">Henter varer/medisiner fra valgt bil ...</p>';

  const rader = await journalHentBilvarer(bilId);

  if (!rader.length) {
    if (select) select.innerHTML = '<option value="">Ingen varer i valgt bil</option>';
    if (liste) liste.innerHTML = '<p class="lite">Ingen varer/medisiner funnet på valgt bil. Sjekk at bilen har beholdning i Bil og lager → Min bil.</p>';
    return;
  }

  if (select) {
    select.innerHTML = '<option value="">Velg medisin/vare</option>' + rader.map(r => {
      const v = r.vet_varer || r.vare || (vetVarer || []).find(x => String(x.id) === String(r.vare_id)) || {};
      const navn = journalVarenavn(r.vare_id, v);
      const pris = journalPrisForVare(v, r);
      return `<option value="${r.vare_id}">${navn} - på bil: ${Math.floor(Number(r.antall || 0))} ${v.enhet || "stk"} - ${formaterKr(pris)} kr</option>`;
    }).join("");
  }

  if (liste) {
    liste.innerHTML = `
      <div class="vet-linje-liste" style="display:grid;gap:6px;">
        ${rader.map(r => {
          const v = r.vet_varer || r.vare || (vetVarer || []).find(x => String(x.id) === String(r.vare_id)) || {};
          const vareId = String(r.vare_id || "");
          const maks = Math.floor(Number(r.antall || 0));
          const navn = journalVarenavn(vareId, v);
          const pris = journalPrisForVare(v, r);
          return `
            <label class="vet-linje-kort" style="display:grid;grid-template-columns:34px minmax(160px,1.6fr) minmax(90px,.8fr) minmax(90px,.7fr) 110px;gap:8px;align-items:center;cursor:pointer;border:1px solid #374151;border-radius:8px;padding:8px;background:#22272a;">
              <input class="journal-bilvare-velg" data-vare-id="${vareId}" type="checkbox" style="width:auto;margin:0;">
              <span class="lite">${navn}</span>
              <span class="lite">På bil: ${maks} ${v.enhet || "stk"}</span>
              <span class="lite">${formaterKr(pris)} kr</span>
              <input class="journal-bilvare-antall" data-vare-id="${vareId}" type="number" step="1" min="1" max="${maks}" placeholder="Antall" onclick="event.stopPropagation();" style="margin:0;">
            </label>
          `;
        }).join("")}
      </div>`;
  }
}

async function leggTilJournalVarerFraBilListe() {
  vetMelding("journalMelding", "");
  const bilId = journalHentValgtBilId();
  if (!bilId) {
    vetMelding("journalMelding", "Velg bil først.");
    return;
  }

  const rader = await journalHentBilvarer(bilId);
  if (!rader.length) {
    vetMelding("journalMelding", "Ingen varer/medisiner funnet på valgt bil.");
    return;
  }

  const valgte = new Set(Array.from(document.querySelectorAll(".journal-bilvare-velg:checked")).map(cb => String(cb.dataset.vareId || "")));
  const linjer = Array.from(document.querySelectorAll(".journal-bilvare-antall"))
    .map(input => ({ vareId: String(input.dataset.vareId || ""), antall: Number(String(input.value || "").replace(",", ".")) }))
    .filter(l => l.vareId && (valgte.has(l.vareId) || l.antall > 0));

  if (!linjer.length) {
    vetMelding("journalMelding", "Velg minst én vare fra bilen og skriv antall.");
    return;
  }

  for (const linje of linjer) {
    const rad = rader.find(r => String(r.vare_id) === String(linje.vareId));
    const vare = rad?.vet_varer || rad?.vare || (vetVarer || []).find(v => String(v.id) === String(linje.vareId)) || {};
    const beholdning = Math.floor(Number(rad?.antall || 0));

    if (!Number.isInteger(linje.antall) || linje.antall <= 0) {
      vetMelding("journalMelding", "Antall må være heltall større enn 0.");
      return;
    }
    if (linje.antall > beholdning) {
      vetMelding("journalMelding", `${journalVarenavn(linje.vareId, vare)}: ikke nok på bilen. Tilgjengelig: ${beholdning}.`);
      return;
    }

    vetJournalVarerTemp.push({
      vare_id: linje.vareId,
      bil_id: bilId,
      varenavn: journalVarenavn(linje.vareId, vare),
      antall: linje.antall,
      pris: journalPrisForVare(vare, rad),
      trekk_fra_billager: true
    });
  }

  tegnJournalVareListe();
  oppdaterJournalSum();
  vetMelding("journalMelding", `${linjer.length} varelinje(r) lagt til fra bil.`);

  document.querySelectorAll(".journal-bilvare-velg").forEach(cb => cb.checked = false);
  document.querySelectorAll(".journal-bilvare-antall").forEach(input => input.value = "");
}


function oppdaterVetLagerTekster() {
  const prisInput = document.getElementById("vetVarePris");
  const label = prisInput ? document.querySelector('label[for="vetVarePris"]') : null;
  if (label) label.textContent = "Utpris eks. mva";
}

function tegnAltLager() {
  tegnVetVarer();
  tegnVetBiler();
  tegnHovedlager();
  tegnBilLager();
}

function tegnVetVarer() {
  const liste = document.getElementById("vetVareListe");
  if (!liste) return;

  if (!vetVarer.length) {
    liste.innerHTML = '<p class="lite">Ingen medisiner/varer registrert.</p>';
    return;
  }

  const esc = verdi => String(verdi || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  liste.innerHTML = `
    <div class="vet-vare-linjeliste" style="display:grid;gap:1px;margin-top:8px;font-size:14px;font-weight:400;">
      ${vetVarer.map(v => `
        <button
          type="button"
          class="vet-vare-linje"
          onclick="redigerVetVare('${esc(v.id)}')"
          title="Klikk for detaljer/redigering"
          style="
            width:100%;
            display:grid;
            grid-template-columns:minmax(220px,2fr) minmax(90px,.9fr) minmax(70px,.7fr) minmax(150px,1fr) minmax(100px,.8fr);
            gap:10px;
            align-items:center;
            text-align:left;
            padding:3px 8px;
            border:1px solid rgba(255,255,255,.08);
            border-radius:0;
            background:rgba(255,255,255,.02);
            color:inherit;
            cursor:pointer;
            font-family:inherit;
            font-size:14px !important;
            font-weight:400 !important;
            line-height:1.15;
            margin:0;
          "
        >
          <span class="lite" style="font-size:14px !important;font-weight:400 !important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(v.navn)}</span>
          <span class="lite" style="font-size:14px !important;font-weight:400 !important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(v.kategori || "medisin")}</span>
          <span class="lite" style="font-size:14px !important;font-weight:400 !important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(v.enhet || "stk")}</span>
          <span class="lite" style="font-size:14px !important;font-weight:400 !important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${formaterKr(v.utsalgspris)} kr eks. mva</span>
          <span class="lite" style="font-size:14px !important;font-weight:400 !important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Min: ${formaterKr(v.minimum_antall)}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function tegnVetBiler() {
  const liste = document.getElementById("vetBilListe");
  if (!liste) return;
  if (!vetBiler.length) { liste.innerHTML = '<p class="lite">Ingen biler registrert.</p>'; return; }
  liste.innerHTML = vetBiler.map(b => `
    <div class="listekort">
      <span>${String(b.navn || "").replaceAll("<", "&lt;")}</span><br>
      <span class="lite">Regnr: ${b.regnr || ""}${b.veterinaer_navn ? " | Veterinær: " + b.veterinaer_navn : ""}</span><br>
      <button type="button" class="secondary" onclick="redigerVetBil('${b.id}')">Rediger</button>
    </div>
  `).join("");
}

function tegnHovedlager() {
  const liste = document.getElementById("hovedlagerListe");
  if (!liste) return;
  if (!vetHovedlager.length) { liste.innerHTML = '<p class="lite">Hovedlager er tomt.</p>'; return; }
  liste.innerHTML = vetHovedlager.map(r => {
    const v = r.vet_varer || {};
    const lavt = Number(v.minimum_antall || 0) > 0 && Number(r.antall || 0) <= Number(v.minimum_antall || 0);
    return `<div class="listekort"><strong>${String(v.navn || vareNavn(r.vare_id)).replaceAll("<", "&lt;")}</strong><br><span class="lite">Hovedlager: ${formaterKr(r.antall)} ${v.enhet || "stk"}${lavt ? " ⚠ lav beholdning" : ""}</span></div>`;
  }).join("");
}

function tegnBilLager() {
  const liste = document.getElementById("billagerListe");
  if (!liste) return;
  if (!vetBilLager.length) { liste.innerHTML = '<p class="lite">Ingen varer i biler.</p>'; return; }
  const grupper = {};
  vetBilLager.forEach(r => {
    const key = r.bil_id || "uten-bil";
    if (!grupper[key]) grupper[key] = [];
    grupper[key].push(r);
  });
  liste.innerHTML = Object.entries(grupper).map(([bilId, rader]) => `
    <div class="listekort">
      <strong>${bilNavn(bilId)}</strong>
      <ul>${rader.map(r => {
        const v = r.vet_varer || {};
        return `<li>${String(v.navn || vareNavn(r.vare_id)).replaceAll("<", "&lt;")}: ${formaterKr(r.antall)} ${v.enhet || "stk"}</li>`;
      }).join("")}</ul>
    </div>
  `).join("");
}

function nullstillVetVare() {
  ["vetVareId", "vetVareNavn"].forEach(id => vetSett(id, ""));
  vetSett("vetVareKategori", "medisin");
  vetSett("vetVareEnhet", "stk");
  vetSett("vetVarePris", "0");
  vetSett("vetVareMinimum", "0");
}

async function lagreVetVare() {
  vetMelding("vetVareMelding", "");
  const klinikkId = hentKlinikkIdForLager();
  if (!klinikkId) { vetMelding("vetVareMelding", "Velg/lagre klinikk før du lager lager."); return; }
  const rad = {
    klinikk_id: klinikkId,
    navn: vetTekst("vetVareNavn"),
    kategori: vetTekst("vetVareKategori") || "medisin",
    enhet: vetTekst("vetVareEnhet") || "stk",
    utsalgspris: vetTall("vetVarePris"),
    minimum_antall: vetTall("vetVareMinimum"),
    aktiv: true
  };
  if (!rad.navn) { vetMelding("vetVareMelding", "Skriv navn på medisin/vare."); return; }
  const id = vetTekst("vetVareId");
  const query = id ? supabaseClient.from("vet_varer").update(rad).eq("id", id) : supabaseClient.from("vet_varer").insert(rad);
  const { error } = await query;
  if (error) { vetMelding("vetVareMelding", "Feil ved lagring av vare: " + error.message); return; }
  nullstillVetVare();
  vetMelding("vetVareMelding", "Medisin/vare lagret.");
  await lastVetLagerAlt();
}

function redigerVetVare(id) {
  const v = vetVarer.find(x => String(x.id) === String(id));
  if (!v) return;
  vetSett("vetVareId", v.id);
  vetSett("vetVareNavn", v.navn);
  vetSett("vetVareKategori", v.kategori || "medisin");
  vetSett("vetVareEnhet", v.enhet || "stk");
  vetSett("vetVarePris", v.utsalgspris || 0);
  vetSett("vetVareMinimum", v.minimum_antall || 0);
  visVetSide("lagerSide");
}

function nullstillVetBil() {
  ["vetBilId", "vetBilNavn", "vetBilRegnr", "vetBilVeterinaer"].forEach(id => vetSett(id, ""));
}

async function lagreVetBil() {
  vetMelding("vetBilMelding", "");
  const klinikkId = hentKlinikkIdForLager();
  if (!klinikkId) { vetMelding("vetBilMelding", "Velg/lagre klinikk før du lager bil."); return; }
  const rad = {
    klinikk_id: klinikkId,
    navn: vetTekst("vetBilNavn"),
    regnr: vetTekst("vetBilRegnr") || null,
    veterinaer_navn: vetTekst("vetBilVeterinaer") || null,
    aktiv: true
  };
  if (!rad.navn) { vetMelding("vetBilMelding", "Skriv navn på bilen."); return; }
  const id = vetTekst("vetBilId");
  const query = id ? supabaseClient.from("vet_biler").update(rad).eq("id", id) : supabaseClient.from("vet_biler").insert(rad);
  const { error } = await query;
  if (error) { vetMelding("vetBilMelding", "Feil ved lagring av bil: " + error.message); return; }
  nullstillVetBil();
  vetMelding("vetBilMelding", "Bil lagret.");
  await lastVetLagerAlt();
}

function redigerVetBil(id) {
  const b = vetBiler.find(x => String(x.id) === String(id));
  if (!b) return;
  vetSett("vetBilId", b.id);
  vetSett("vetBilNavn", b.navn);
  vetSett("vetBilRegnr", b.regnr);
  vetSett("vetBilVeterinaer", b.veterinaer_navn);
  visVetSide("lagerSide");
}

async function settLagerAntall(tabell, filter, nyttAntall, ekstraInsert = {}) {
  const { data, error } = await supabaseClient.from(tabell).select("id, antall").match(filter).maybeSingle();
  if (error) throw error;
  if (data?.id) {
    const { error: updErr } = await supabaseClient.from(tabell).update({ antall: nyttAntall }).eq("id", data.id);
    if (updErr) throw updErr;
  } else {
    const { error: insErr } = await supabaseClient.from(tabell).insert({ ...filter, ...ekstraInsert, antall: nyttAntall });
    if (insErr) throw insErr;
  }
}

async function oppdaterHovedlager() {
  vetMelding("hovedlagerMelding", "");
  const klinikkId = hentKlinikkIdForLager();
  const vareId = vetTekst("hovedlagerVareValg");
  const antallEndring = vetTall("hovedlagerAntall");
  if (!klinikkId || !vareId) { vetMelding("hovedlagerMelding", "Velg klinikk og vare."); return; }
  if (!antallEndring) { vetMelding("hovedlagerMelding", "Skriv antall som skal legges inn eller trekkes ut."); return; }
  const eksisterende = vetHovedlager.find(r => String(r.vare_id) === String(vareId));
  const nytt = Number(eksisterende?.antall || 0) + antallEndring;
  if (nytt < 0) { vetMelding("hovedlagerMelding", "Hovedlager kan ikke bli negativt."); return; }
  try {
    await settLagerAntall("vet_lager", { klinikk_id: klinikkId, vare_id: vareId }, nytt);
    vetSett("hovedlagerAntall", "1");
    vetMelding("hovedlagerMelding", "Hovedlager oppdatert.");
    await lastVetLagerAlt();
  } catch (e) {
    vetMelding("hovedlagerMelding", "Feil ved oppdatering av hovedlager: " + e.message);
  }
}

async function flyttTilBil() {
  vetMelding("billagerMelding", "");
  const klinikkId = hentKlinikkIdForLager();
  const bilId = vetTekst("fyllBilValg");

  if (!klinikkId || !bilId) {
    vetMelding("billagerMelding", "Velg bil først.");
    return;
  }

  const inputs = Array.from(document.querySelectorAll(".fyllbil-antall"));
  const valgte = new Set(Array.from(document.querySelectorAll(".fyllbil-velg:checked")).map(cb => String(cb.dataset.vareId || "")));
  const linjer = inputs
    .map(input => ({ vareId: input.dataset.vareId, antall: Number(String(input.value || "").replace(",", ".")) }))
    .filter(l => l.vareId && (valgte.has(String(l.vareId)) || l.antall > 0));

  if (!linjer.length) {
    vetMelding("billagerMelding", "Velg minst én vare fra listen og skriv antall.");
    return;
  }

  if (linjer.some(l => !(l.antall > 0))) {
    vetMelding("billagerMelding", "Skriv antall på alle varene du har valgt.");
    return;
  }

  for (const linje of linjer) {
    if (!Number.isInteger(linje.antall)) {
      vetMelding("billagerMelding", "Antall må være heltall.");
      return;
    }

    const hoved = vetHovedlager.find(r => String(r.vare_id) === String(linje.vareId));
    const hovedAntall = Number(hoved?.antall || 0);
    if (hovedAntall < linje.antall) {
      vetMelding("billagerMelding", `${vareNavn(linje.vareId)}: ikke nok på hovedlager. Tilgjengelig: ${formaterKr(hovedAntall)}.`);
      return;
    }
  }

  try {
    for (const linje of linjer) {
      const hoved = vetHovedlager.find(r => String(r.vare_id) === String(linje.vareId));
      const hovedAntall = Number(hoved?.antall || 0);
      const bilRad = vetBilLager.find(r => String(r.bil_id) === String(bilId) && String(r.vare_id) === String(linje.vareId));
      const bilNytt = Number(bilRad?.antall || 0) + linje.antall;

      await settLagerAntall("vet_lager", { klinikk_id: klinikkId, vare_id: linje.vareId }, hovedAntall - linje.antall);
      await settLagerAntall("vet_bil_lager", { klinikk_id: klinikkId, bil_id: bilId, vare_id: linje.vareId }, bilNytt);
    }

    vetMelding("billagerMelding", `La ${linjer.length} varelinje(r) på bilen.`);
    await lastVetLagerAlt();
    tegnFyllBilFyllListe();
  } catch (e) {
    vetMelding("billagerMelding", "Feil ved flytting til bil: " + (e.message || e));
  }
}

function oppdaterLagerSideRollevisning() {
  const adminOmrade = document.getElementById("adminLagerOmrade");
  const minBilOmrade = document.getElementById("minBilOmrade");
  const adminModus = erKlinikkAdmin() && !erVetVisningVanlig();

  if (adminOmrade) adminOmrade.style.display = adminModus ? "" : "none";
  if (minBilOmrade) minBilOmrade.style.display = adminModus ? "none" : "";

  if (adminModus) {
    tegnAltLager();
  } else {
    fyllMinBilSide();
  }
}

function valgtMinBilId() {
  const valgt = vetTekst("minBilValg");
  if (valgt) return valgt;
  const bil = finnStandardBilForInnloggetVeterinaer();
  return bil?.id || "";
}

function fyllMinBilValg() {
  const valg = document.getElementById("minBilValg");
  if (!valg) return;

  const standardBil = finnStandardBilForInnloggetVeterinaer();
  const aktiv = valg.value || standardBil?.id || "";

  valg.innerHTML = '<option value="">Velg bil</option>' + vetBiler.map(b => {
    const eier = b.veterinaer_navn ? " | " + b.veterinaer_navn : "";
    return `<option value="${b.id}">${[b.navn, b.regnr].filter(Boolean).join(" - ")}${eier}</option>`;
  }).join("");

  if (aktiv) valg.value = aktiv;
}

function fyllMinBilSide() {
  fyllMinBilValg();
  tegnMinBilFyllListe();
  tegnMinBilInnhold();
}

function tegnMinBilFyllListe() {
  const liste = document.getElementById("minBilFyllListe");
  const info = document.getElementById("minBilInfo");
  if (!liste) return;

  const bilId = valgtMinBilId();
  if (!bilId) {
    liste.innerHTML = "";
    if (info) info.textContent = "Ingen bil er koblet til deg. Be admin koble bilen til navnet eller e-posten din, eller velg bil manuelt.";
    return;
  }

  if (info) {
    const bil = vetBiler.find(b => String(b.id) === String(bilId));
    info.textContent = bil ? `Valgt bil: ${bilNavn(bilId)}` : "";
  }

  const rader = vetHovedlager
    .filter(r => Number(r.antall || 0) > 0)
    .map(r => {
      const v = r.vet_varer || vetVarer.find(x => String(x.id) === String(r.vare_id)) || {};
      return { ...r, vare: v };
    })
    .filter(r => r.vare?.navn);

  if (!rader.length) {
    liste.innerHTML = '<p class="lite">Ingen varer på hovedlager.</p>';
    return;
  }

  liste.innerHTML = `
    <div class="vet-linje-liste">
      ${rader.map(r => {
        const v = r.vare;
        const navn = htmlEscape(v.navn || "Vare");
        const enhet = htmlEscape(v.enhet || "stk");
        const maks = Math.floor(Number(r.antall || 0));
        const id = htmlEscape(r.vare_id);
        return `
          <label class="vet-linje-kort" for="minbil_velg_${id}" style="grid-template-columns:36px minmax(180px,1.5fr) minmax(110px,.8fr) 120px; cursor:pointer;">
            <input id="minbil_velg_${id}" class="minbil-velg" data-vare-id="${id}" type="checkbox" style="width:auto;margin:0;">
            <span class="lite" style="font-weight:400 !important;font-size:14px !important;">${navn}</span>
            <span class="lite" style="font-weight:400 !important;font-size:14px !important;">På lager: ${formaterKr(r.antall)} ${enhet}</span>
            <input id="minbil_antall_${id}" class="minbil-antall" data-vare-id="${id}" type="number" step="1" min="1" max="${maks}" placeholder="Antall" value="" onclick="event.stopPropagation();" style="margin:0;font-weight:400 !important;">
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function tegnMinBilInnhold() {
  const liste = document.getElementById("minBilInnholdListe");
  if (!liste) return;

  const bilId = valgtMinBilId();
  if (!bilId) {
    liste.innerHTML = '<p class="lite">Ingen bil valgt.</p>';
    return;
  }

  const rader = vetBilLager.filter(r => String(r.bil_id) === String(bilId) && Number(r.antall || 0) > 0);
  if (!rader.length) {
    liste.innerHTML = '<p class="lite">Bilen er tom.</p>';
    return;
  }

  liste.innerHTML = rader.map(r => {
    const v = r.vet_varer || vetVarer.find(x => String(x.id) === String(r.vare_id)) || {};
    return `<div class="listekort"><strong>${htmlEscape(v.navn || vareNavn(r.vare_id))}</strong><br><span class="lite">${formaterKr(r.antall)} ${htmlEscape(v.enhet || "stk")}</span></div>`;
  }).join("");
}

async function fyllMinBilMedFlereVarer() {
  vetMelding("minBilMelding", "");
  const klinikkId = hentKlinikkIdForLager();
  const bilId = valgtMinBilId();

  if (!klinikkId || !bilId) {
    vetMelding("minBilMelding", "Velg bil først.");
    return;
  }

  const inputs = Array.from(document.querySelectorAll(".minbil-antall"));
  const valgte = new Set(Array.from(document.querySelectorAll(".minbil-velg:checked")).map(cb => String(cb.dataset.vareId || "")));
  const linjer = inputs
    .map(input => ({ vareId: input.dataset.vareId, antall: Number(String(input.value || "").replace(",", ".")) }))
    .filter(l => l.vareId && (valgte.has(String(l.vareId)) || l.antall > 0));

  if (!linjer.length) {
    vetMelding("minBilMelding", "Velg minst én vare fra listen og skriv antall.");
    return;
  }

  if (linjer.some(l => !(l.antall > 0))) {
    vetMelding("minBilMelding", "Skriv antall på alle varene du har valgt.");
    return;
  }

  for (const linje of linjer) {
    if (!Number.isInteger(linje.antall)) {
      vetMelding("minBilMelding", "Antall må være heltall.");
      return;
    }
    const hoved = vetHovedlager.find(r => String(r.vare_id) === String(linje.vareId));
    if (Number(hoved?.antall || 0) < linje.antall) {
      vetMelding("minBilMelding", `${vareNavn(linje.vareId)}: ikke nok på hovedlager.`);
      return;
    }
  }

  try {
    for (const linje of linjer) {
      const hoved = vetHovedlager.find(r => String(r.vare_id) === String(linje.vareId));
      const hovedNytt = Number(hoved?.antall || 0) - linje.antall;
      const bilRad = vetBilLager.find(r => String(r.bil_id) === String(bilId) && String(r.vare_id) === String(linje.vareId));
      const bilNytt = Number(bilRad?.antall || 0) + linje.antall;

      await settLagerAntall("vet_lager", { klinikk_id: klinikkId, vare_id: linje.vareId }, hovedNytt);
      await settLagerAntall("vet_bil_lager", { klinikk_id: klinikkId, bil_id: bilId, vare_id: linje.vareId }, bilNytt);
    }

    vetMelding("minBilMelding", `La ${linjer.length} varelinje(r) på bilen.`);
    await lastVetLagerAlt();
    fyllMinBilSide();
  } catch (e) {
    vetMelding("minBilMelding", "Feil ved fylling av bil: " + (e.message || e));
  }
}

function leggTilJournalVareFraBil() {
  vetMelding("journalMelding", "");
  const bilId = vetTekst("journalBilValg");
  const vareId = vetTekst("journalBilVareValg");
  const antall = vetTall("journalBilVareAntall");
  if (!bilId || !vareId) { vetMelding("journalMelding", "Velg bil og vare fra bil-lager."); return; }
  if (antall <= 0 || !Number.isInteger(antall)) { vetMelding("journalMelding", "Antall må være et heltall større enn 0."); return; }
  const lagerRad = vetBilLager.find(r => String(r.bil_id) === String(bilId) && String(r.vare_id) === String(vareId));
  const beholdning = Number(lagerRad?.antall || 0);
  if (beholdning < antall) { vetMelding("journalMelding", `Ikke nok på bilen. Tilgjengelig: ${formaterKr(beholdning)}.`); return; }
  const vare = vetVarer.find(v => String(v.id) === String(vareId)) || lagerRad?.vet_varer || {};
  vetJournalVarerTemp.push({
    vare_id: vareId,
    bil_id: bilId,
    varenavn: vare.navn || "Vare/medisin",
    antall,
    pris: Number(vare.utsalgspris || 0),
    trekk_fra_billager: true
  });
  vetSett("journalBilVareAntall", "1");
  tegnJournalVareListe();
  oppdaterJournalSum();
}

async function trekkBilLagerEtterJournal() {
  const linjer = vetJournalVarerTemp.filter(v => v.trekk_fra_billager && v.bil_id && v.vare_id);
  if (!linjer.length) return true;
  try {
    for (const linje of linjer) {
      const lagerRad = vetBilLager.find(r => String(r.bil_id) === String(linje.bil_id) && String(r.vare_id) === String(linje.vare_id));
      const nytt = Number(lagerRad?.antall || 0) - Number(linje.antall || 0);
      if (nytt < 0) throw new Error(`${linje.varenavn}: ikke nok på bil-lager.`);
      await settLagerAntall("vet_bil_lager", { klinikk_id: hentKlinikkIdForLager(), bil_id: linje.bil_id, vare_id: linje.vare_id }, nytt);
    }
    return true;
  } catch (e) {
    vetMelding("journalMelding", "Journal lagret, men bil-lager kunne ikke trekkes: " + e.message);
    return false;
  }
}

function brukValgtPrisIJournal() {
  const id = vetTekst("journalPrisValg");
  const p = vetPriser.find(x => String(x.id) === String(id));
  if (!p) return;
  if (!vetTekst("journalBehandlingAntall")) vetSett("journalBehandlingAntall", "1");
}

function oppdaterJournalSum() {
  const sum = vetTall("journalFastpris") +
    (vetTall("journalTimepris") * vetTall("journalTimer")) +
    (vetTall("journalKm") * vetTall("journalKmPris")) +
    journalBehandlingerSum() +
    journalVarerSum();

  const el = document.getElementById("journalSumVisning");
  if (el) el.textContent = formaterKr(sum);
}


function tegnJournalKjoring() {
  const el = document.getElementById("journalKjoringListe");
  if (!el) return;

  const km = vetTall("journalKm");
  const kmPris = vetTall("journalKmPris");

  if (km > 0 && kmPris > 0) {
    el.textContent = `Kjøring lagt til: ${formaterKr(km)} km x ${formaterKr(kmPris)} kr = ${formaterKr(km * kmPris)} kr eks. mva`;
  } else {
    el.textContent = "Ingen kjøring lagt til.";
  }
}

function leggTilJournalKjoring() {
  vetMelding("journalMelding", "");

  const km = vetTall("journalKm");
  let kmPris = vetTall("journalKmPris");

  if (km <= 0) {
    vetMelding("journalMelding", "Skriv antall kilometer før du legger til kjøring.");
    return;
  }

  if (kmPris <= 0) {
    settStandardKmPrisFraKlinikk();
    kmPris = vetTall("journalKmPris");
  }

  if (kmPris <= 0) {
    vetMelding("journalMelding", "Skriv pris per km før du legger til kjøring.");
    return;
  }

  tegnJournalKjoring();
  oppdaterJournalSum();
}

function nullstillJournalKjoring() {
  vetSett("journalKm", "");
  settStandardKmPrisFraKlinikk();
  tegnJournalKjoring();
  oppdaterJournalSum();
}

async function lagreKlinikk() {
  vetMelding("klinikkMelding", "");
  const rad = {
    navn: vetTekst("klinikkNavn"),
    konsern_navn: vetTekst("konsernNavn") || null,
    telefon: vetTekst("klinikkTelefon") || null,
    epost: vetTekst("klinikkEpost") || null,
    adresse: vetTekst("klinikkAdresse") || null
  };

  if (await erVetAdmin()) {
    rad.km_pris = vetTall("klinikkKmPris") || 5.30;
  }
  if (!rad.navn) {
    vetMelding("klinikkMelding", "Skriv klinikknavn.");
    return;
  }
  let id = vetTekst("klinikkId");
  if (!vetErSystemAdmin && vetAktivKlinikkId) id = vetAktivKlinikkId;
  let lagretKlinikkId = id;

  if (id) {
    const { error } = await supabaseClient
      .from("vet_klinikker")
      .update(rad)
      .eq("id", id);

    if (error) {
      vetMelding("klinikkMelding", "Feil ved lagring av klinikk: " + error.message);
      return;
    }
  } else {
    if (!vetErSystemAdmin) {
      vetMelding("klinikkMelding", "Du er ikke koblet til en klinikk. Kontakt systemadmin.");
      return;
    }

    const { data, error } = await supabaseClient
      .from("vet_klinikker")
      .insert(rad)
      .select("id")
      .single();

    if (error) {
      vetMelding("klinikkMelding", "Feil ved lagring av klinikk: " + error.message);
      return;
    }

    lagretKlinikkId = data?.id;
  }

  if (await erVetAdmin()) {
    const logoUrl = await lastOppKlinikkLogo(lagretKlinikkId);

    if (logoUrl) {
      const { error: logoError } = await supabaseClient
        .from("vet_klinikker")
        .update({ logo_url: logoUrl })
        .eq("id", lagretKlinikkId);

      if (logoError) {
        vetMelding("klinikkMelding", "Klinikk lagret, men logo-url kunne ikke lagres: " + logoError.message);
        return;
      }
    }
  }

  ["klinikkId","klinikkNavn","konsernNavn","klinikkTelefon","klinikkEpost","klinikkAdresse"].forEach(id => vetSett(id,""));
  vetSett("klinikkKmPris", "5.30");
  const logoFil = document.getElementById("klinikkLogoFil");
  if (logoFil) logoFil.value = "";
  visKlinikkLogoPreview("");
  vetMelding("klinikkMelding", "Klinikk lagret.");
  await lastKlinikker();
}

function tegnKlinikker() {
  const liste = document.getElementById("klinikkListe");
  if (!liste) return;
  if (!vetKlinikker.length) {
    liste.innerHTML = '<p class="lite">Ingen klinikker registrert ennå.</p>';
    return;
  }
  liste.innerHTML = vetKlinikker.map(k => `
    <div class="listekort">
      <strong>${k.navn || ""}</strong><br>
      <span class="lite">${k.konsern_navn ? "Konsern: " + k.konsern_navn + "<br>" : ""}${k.telefon || ""} ${k.epost || ""}${k.km_pris ? "<br>Km-pris: " + formaterKr(k.km_pris) + " kr" : ""}</span><br>${erVetAdminSync() && k.logo_url ? `<img src="${k.logo_url}" alt="Logo" style="max-height:50px; margin-top:6px;"><br>` : ""}
      <button type="button" class="secondary" onclick="redigerKlinikk('${k.id}')">Rediger</button>
    </div>
  `).join("");
}

function redigerKlinikk(id) {
  const k = vetKlinikker.find(x => String(x.id) === String(id));
  if (!k) return;
  vetSett("klinikkId", k.id);
  vetSett("klinikkNavn", k.navn);
  vetSett("konsernNavn", k.konsern_navn);
  vetSett("klinikkTelefon", k.telefon);
  vetSett("klinikkEpost", k.epost);
  vetSett("klinikkAdresse", k.adresse);
  vetSett("klinikkKmPris", k.km_pris || "5.30");
  visKlinikkLogoPreview(k.logo_url || "");
  visVetSide("klinikkSide");
  lastKlinikkBrukere();
}

async function lastDyreeiere() {
  let query = supabaseClient.from("vet_dyreeiere").select("*").order("navn", { ascending: true });
  query = filtrerKlinikkQuery(query);
  const { data, error } = await query;
  if (error) { vetMelding("dyreeierMelding", "Feil ved henting av dyreeiere: " + error.message); return; }
  vetDyreeiere = data || [];
  tegnDyreeiere();
  fyllDyreeierValg();
  fyllDyreeierVelgForDyr();
  fyllJournalDyreeierValg();
}

function nyDyreeier() {
  ["dyreeierId","dyreeierNavn","dyreeierTelefon","dyreeierEpost","dyreeierAdresse"].forEach(id => vetSett(id, ""));
  vetSett("dyreeierVelgForDyr", "");
  fyllDyreeierDyrValg("");
  visVetSide("eierSide");
}

function nyPasient() {
  ["dyrId","dyrNavn","dyrArt","dyrRase","dyrFodselsdato","dyrKjonn","dyrChip","dyrNotater"].forEach(id => vetSett(id, ""));
  fyllDyreeierValg();
  visVetSide("dyrSide");
}

async function lagreDyreeier() {
  vetMelding("dyreeierMelding", "");

  const rad = leggTilKlinikkHvisVanligBruker({
    navn: vetTekst("dyreeierNavn"),
    telefon: vetTekst("dyreeierTelefon") || null,
    epost: vetTekst("dyreeierEpost") || null,
    adresse: vetTekst("dyreeierAdresse") || null
  });

  if (!rad.navn) {
    vetMelding("dyreeierMelding", "Skriv navn på dyreeier.");
    return;
  }

  const id = vetTekst("dyreeierId");
  const query = id
    ? supabaseClient.from("vet_dyreeiere").update(rad).eq("id", id).select("id").single()
    : supabaseClient.from("vet_dyreeiere").insert(rad).select("id").single();

  const { data, error } = await query;

  if (error) {
    vetMelding("dyreeierMelding", "Feil ved lagring av dyreeier: " + error.message);
    return;
  }

  const lagretId = data?.id || id;

  vetMelding("dyreeierMelding", "Dyreeier lagret.");
  await lastDyreeiere();

  vetSett("dyreeierId", lagretId || "");
  fyllDyreeierVelgForDyr();
  vetSett("dyreeierVelgForDyr", lagretId || "");
  fyllDyreeierDyrValg(lagretId || "");

  const eier = (vetDyreeiere || []).find(e => String(e.id) === String(lagretId));
  if (eier) {
    vetSett("dyreeierNavn", eier.navn || "");
    vetSett("dyreeierTelefon", eier.telefon || "");
    vetSett("dyreeierEpost", eier.epost || "");
    vetSett("dyreeierAdresse", eier.adresse || "");
  }
}

function tegnDyreeiere() {
  const liste = document.getElementById("dyreeierListe");
  if (!liste) return;
  liste.innerHTML = vetDyreeiere.map(e => `<div class="listekort"><strong>${e.navn || ""}</strong><br><span class="lite">${e.telefon || ""} ${e.epost || ""}</span><br><button type="button" class="secondary" onclick="redigerDyreeier('${e.id}')">Rediger</button></div>`).join("") || '<p class="lite">Ingen dyreeiere registrert ennå.</p>';
}

function redigerDyreeier(id) {
  const e = vetDyreeiere.find(x => String(x.id) === String(id));
  if (!e) return;
  vetSett("dyreeierId", e.id); vetSett("dyreeierVelgForDyr", e.id); vetSett("dyreeierNavn", e.navn); vetSett("dyreeierTelefon", e.telefon); vetSett("dyreeierEpost", e.epost); vetSett("dyreeierAdresse", e.adresse);
  fyllDyreeierDyrValg(e.id);
  visVetSide("eierSide");
}

function fyllDyreeierValg(valgtId = "") {
  const valg = document.getElementById("dyrEierValg");
  if (!valg) return;

  const aktivId = valgtId || valg.value || vetTekst("dyrEierValg");

  valg.innerHTML = '<option value="">Velg eier</option>' + vetDyreeiere
    .map(e => `<option value="${e.id}">${e.navn || ""}</option>`)
    .join("");

  if (aktivId) valg.value = aktivId;
}

function fyllDyreeierVelgForDyr() {
  const valg = document.getElementById("dyreeierVelgForDyr");
  if (!valg) return;

  const aktivId = vetTekst("dyreeierId");
  valg.innerHTML = '<option value="">Velg dyreeier</option>' + vetDyreeiere
    .map(e => `<option value="${e.id}">${e.navn || ""}</option>`)
    .join("");

  if (aktivId) valg.value = aktivId;
}

function brukValgtDyreeierForDyr() {
  const dyreeierId = vetTekst("dyreeierVelgForDyr");

  if (!dyreeierId) {
    ["dyreeierId","dyreeierNavn","dyreeierTelefon","dyreeierEpost","dyreeierAdresse"].forEach(id => vetSett(id, ""));
    fyllDyreeierDyrValg("");
    return;
  }

  redigerDyreeier(dyreeierId);
}

function fyllDyreeierDyrValg(dyreeierId = "", valgtDyrId = "") {
  const valg = document.getElementById("dyreeierDyrValg");
  const info = document.getElementById("dyreeierDyrInfo");
  if (!valg) return;

  if (!dyreeierId) {
    valg.innerHTML = '<option value="">Velg dyreeier først</option>';
    if (info) info.textContent = "";
    return;
  }

  const dyrHosEier = vetDyr.filter(d => String(d.dyreeier_id) === String(dyreeierId));

  if (!dyrHosEier.length) {
    valg.innerHTML = '<option value="">Ingen dyr registrert på denne dyreeieren</option>';
    if (info) info.textContent = "Ingen dyr funnet på valgt dyreeier.";
    return;
  }

  valg.innerHTML = '<option value="">Velg dyr</option>' + dyrHosEier.map(d => {
    const art = d.art ? ` (${d.art})` : "";
    return `<option value="${d.id}">${d.navn || "Uten navn"}${art}</option>`;
  }).join("");

  if (valgtDyrId) valg.value = valgtDyrId;
  if (info) info.textContent = `${dyrHosEier.length} dyr registrert på valgt dyreeier.`;
}


function leggTilNyttDyrForValgtDyreeier() {
  const eierId = vetTekst("dyreeierId") || vetTekst("dyreeierVelgForDyr");
  if (!eierId) {
    vetMelding("dyreeierMelding", "Velg eller lagre dyreeier først.");
    return;
  }
  visVetSide("dyrSide");
  fyllDyreeierValg(eierId);
  vetSett("dyrEierValg", eierId);
  nullstillDyrSkjemaBeholdEier();
  fyllDyrSideDyrForEier("");
}

function redigerValgtDyrForDyreeier() {
  const dyrId = vetTekst("dyreeierDyrValg");
  if (!dyrId) {
    vetMelding("dyreeierMelding", "Velg dyr i listen først.");
    return;
  }
  redigerDyr(dyrId);
}

function brukValgtDyrFraDyreeier() {
  const dyrId = vetTekst("dyreeierDyrValg");
  if (!dyrId) return;
  redigerDyr(dyrId);
}

function nullstillDyrSkjemaBeholdEier() {
  const eierId = vetTekst("dyrEierValg");
  ["dyrId","dyrNavn","dyrArt","dyrRase","dyrFodselsdato","dyrKjonn","dyrIdmerking"].forEach(id => vetSett(id, ""));
  if (eierId) vetSett("dyrEierValg", eierId);
}

function fyllDyrSideDyrForEier(valgtDyrId = "") {
  const eierId = vetTekst("dyrEierValg");
  // Dyr-siden har foreløpig listekort, ikke eget rullefelt. Denne funksjonen er
  // en trygg no-op som hindrer at knapper stopper hvis den kalles.
  if (eierId && typeof fyllDyreeierDyrValg === "function") {
    fyllDyreeierDyrValg(eierId, valgtDyrId);
  }
}

async function lastDyr() {
  let query = supabaseClient.from("vet_dyr").select("*, vet_dyreeiere(navn)").order("navn", { ascending: true });
  query = filtrerKlinikkQuery(query);
  const { data, error } = await query;
  if (error) { vetMelding("dyrMelding", "Feil ved henting av dyr: " + error.message); return; }
  vetDyr = data || [];
  tegnDyr();
  fyllDyrValg();
  const aktivDyreeierId = vetTekst("dyreeierId");
  if (aktivDyreeierId) fyllDyreeierDyrValg(aktivDyreeierId);
}

async function lagreDyr() {
  vetMelding("dyrMelding", "");
  const rad = leggTilKlinikkHvisVanligBruker({
    dyreeier_id: vetTekst("dyrEierValg") || null,
    navn: vetTekst("dyrNavn"), art: vetTekst("dyrArt") || null, rase: vetTekst("dyrRase") || null,
    fodselsdato: vetTekst("dyrFodselsdato") || null, kjonn: vetTekst("dyrKjonn") || null, idmerking: vetTekst("dyrIdmerking") || null
  });
  if (!rad.dyreeier_id || !rad.navn) { vetMelding("dyrMelding", "Velg eier og skriv navn på dyret."); return; }
  const id = vetTekst("dyrId");
  const query = id ? supabaseClient.from("vet_dyr").update(rad).eq("id", id) : supabaseClient.from("vet_dyr").insert(rad);
  const { error } = await query;
  if (error) { vetMelding("dyrMelding", "Feil ved lagring av dyr: " + error.message); return; }
  ["dyrId","dyrNavn","dyrArt","dyrRase","dyrFodselsdato","dyrKjonn","dyrIdmerking"].forEach(id => vetSett(id,"")); vetSett("dyrEierValg", "");
  vetMelding("dyrMelding", "Dyr lagret.");
  await lastDyr();
  fyllDyreeierValg(rad.dyreeier_id);
  if (vetTekst("dyreeierId") === String(rad.dyreeier_id)) {
    fyllDyreeierDyrValg(rad.dyreeier_id, id || "");
  }
}

function tegnDyr() {
  const liste = document.getElementById("dyrListe");
  if (!liste) return;
  liste.innerHTML = vetDyr.map(d => `<div class="listekort"><strong>${d.navn || ""}</strong> (${d.art || "ukjent art"})<br><span class="lite">Eier: ${d.vet_dyreeiere?.navn || ""}${d.idmerking ? " | ID: " + d.idmerking : ""}</span><br><button type="button" class="secondary" onclick="redigerDyr('${d.id}')">Rediger</button></div>`).join("") || '<p class="lite">Ingen dyr registrert ennå.</p>';
}

function redigerDyr(id) {
  const d = vetDyr.find(x => String(x.id) === String(id));
  if (!d) return;

  // Vis dyr-siden først. visVetSide("dyrSide") fyller eier-rullefeltet på nytt,
  // så eier må settes etterpå for at dyr og eier faktisk henger sammen i skjemaet.
  visVetSide("dyrSide");

  vetSett("dyrId", d.id);
  fyllDyreeierValg(d.dyreeier_id || "");
  vetSett("dyrEierValg", d.dyreeier_id || "");
  vetSett("dyrNavn", d.navn);
  vetSett("dyrArt", d.art);
  vetSett("dyrRase", d.rase);
  vetSett("dyrFodselsdato", d.fodselsdato);
  vetSett("dyrKjonn", d.kjonn);
  vetSett("dyrIdmerking", d.idmerking);
}


function fyllJournalDyreeierValg() {
  const valg = document.getElementById("journalDyreeierValg");
  if (!valg) return;

  const aktivId = valg.value || "";
  valg.innerHTML = '<option value="">Velg dyreeier</option>' + vetDyreeiere
    .map(e => `<option value="${e.id}">${htmlEscape(e.navn || "")}</option>`)
    .join("");

  if (aktivId && vetDyreeiere.some(e => String(e.id) === String(aktivId))) {
    valg.value = aktivId;
  }
}

function brukValgtJournalDyreeier() {
  vetSett("journalDyrValg", "");
  fyllDyrValg();
}

function fyllDyrValg() {
  const valg = document.getElementById("journalDyrValg");
  if (!valg) return;

  const eierId = vetTekst("journalDyreeierValg");
  const valgtDyr = valg.value || "";

  if (!eierId) {
    valg.innerHTML = '<option value="">Velg dyreeier først</option>';
    return;
  }

  const dyrHosEier = vetDyr.filter(d => String(d.dyreeier_id) === String(eierId));

  if (!dyrHosEier.length) {
    valg.innerHTML = '<option value="">Ingen dyr på valgt dyreeier</option>';
    return;
  }

  valg.innerHTML = '<option value="">Velg dyr</option>' + dyrHosEier
    .map(d => `<option value="${d.id}">${htmlEscape(d.navn || "Uten navn")}${d.art ? " (" + htmlEscape(d.art) + ")" : ""}</option>`)
    .join("");

  if (valgtDyr && dyrHosEier.some(d => String(d.id) === String(valgtDyr))) {
    valg.value = valgtDyr;
  }
}

async function lastJournal() {
  let query = supabaseClient.from("vet_journal").select("*, vet_dyr(navn, vet_dyreeiere(navn)), vet_journal_bilder(*), vet_journal_varer(*)").order("dato", { ascending: false });
  query = filtrerKlinikkQuery(query);
  const { data, error } = await query;
  if (error) { vetMelding("journalMelding", "Feil ved henting av journal: " + error.message); return; }
  vetJournal = data || [];
  tegnJournal();
}

async function lagreJournal() {
  vetMelding("journalMelding", "");
  const fastpris = vetTall("journalFastpris");
  const timepris = vetTall("journalTimepris");
  const timer = vetTall("journalTimer");
  const km = vetTall("journalKm");
  const kmPris = vetTall("journalKmPris");
  const vareSum = journalVarerSum();
  const behandlingSum = journalBehandlingerSum();
  const belopEksMva = fastpris + (timepris * timer) + (km * kmPris) + behandlingSum + vareSum;
  const behandlingsTekst = journalBehandlingerTekst();
  const behandlingsNavn = vetJournalBehandlingerTemp.map(b => b.navn).filter(Boolean).join(", ");
  const rad = {
    dyr_id: vetTekst("journalDyrValg") || null,
    opprettet_av: vetInnloggetKlinikkBrukerId || vetInnloggetAuthUserId || null,
    dato: vetTekst("journalDato") || new Date().toISOString().split("T")[0],
    type: behandlingsNavn || (km > 0 ? "Kjøring" : null),
    notat: [vetTekst("journalNotat"), behandlingsTekst].filter(Boolean).join("\n\n"),
    medisin_kladd: vetTekst("journalMedisin") || null,
    pris_id: vetJournalBehandlingerTemp[0]?.pris_id || vetTekst("journalPrisValg") || null,
    fastpris: fastpris + behandlingSum,
    timepris: timepris,
    timer: timer,
    km: km,
    km_pris: kmPris,
    belop_eks_mva: belopEksMva
  };
  leggTilKlinikkHvisVanligBruker(rad);
  const harBelopEllerLinjer = belopEksMva > 0 || vetJournalVarerTemp.length > 0 || vetJournalBehandlingerTemp.length > 0;
  if (!rad.dyr_id) { vetMelding("journalMelding", "Velg dyreeier og dyr før du lagrer journal."); return; }
  if (!rad.notat && !harBelopEllerLinjer) { vetMelding("journalMelding", "Skriv journalnotat, velg behandling, legg til vare eller fyll inn kjøring/timer/fastpris."); return; }
  if (!rad.notat && harBelopEllerLinjer) { rad.notat = rad.type || "Registrert beløp/kjøring"; }
  const { data, error } = await supabaseClient.from("vet_journal").insert(rad).select("id").single();
  if (error) { vetMelding("journalMelding", "Feil ved lagring av journal: " + error.message); return; }

  const bilderOk = await lagreJournalBilder(data?.id);
  const varerOk = await lagreJournalVarer(data?.id);

  ["journalNotat","journalMedisin","journalFastpris","journalTimepris","journalTimer","journalKm"].forEach(id => vetSett(id,""));
  settStandardKmPrisFraKlinikk();
  tegnJournalKjoring();
  nullstillJournalBehandlinger();
  nullstillJournalBilder();
  nullstillJournalVarer();
  oppdaterJournalSum();
  vetMelding("journalMelding", (bilderOk && varerOk) ? "Journal lagret." : "Journal lagret, men ett eller flere vedlegg/varer feilet.");
  await lastJournal();
}

function tegnJournal() {
  const liste = document.getElementById("journalListe");
  if (!liste) return;

  const esc = verdi => String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  liste.innerHTML = vetJournal.map(j => {
    const sum = Number(j.belop_eks_mva || 0);
    const prislinje = sum > 0 ? `<p><strong>Pris:</strong> ${formaterKr(sum)} kr eks. mva<br><span class="lite">Fastpris: ${formaterKr(j.fastpris)} | Time: ${formaterKr(j.timepris)} x ${j.timer || 0} | Km: ${j.km || 0} x ${formaterKr(j.km_pris)}</span></p>` : "";
    const bilder = (j.vet_journal_bilder || []).map(b => `
      <div style="display:inline-block; margin:6px 8px 6px 0; vertical-align:top; max-width:150px;">
        <a href="${b.bilde_url || "#"}" target="_blank">
          <img src="${b.bilde_url || ""}" alt="${esc(b.bildetekst || b.filnavn || "Journalbilde")}" style="width:140px; height:100px; object-fit:cover; border-radius:0; border:1px solid #ddd;">
        </a>
        <div class="lite">${esc(b.bildetekst || b.filnavn || "")}</div>
      </div>
    `).join("");
    const bildeblokk = bilder ? `<p><strong>Bilder:</strong></p><div>${bilder}</div>` : "";
    const varer = (j.vet_journal_varer || []).map(v => {
      const vareSum = Number(v.sum_eks_mva || (Number(v.antall || 0) * Number(v.pris || 0)));
      return `<li>${esc(v.varenavn || "")} - ${formaterKr(v.antall)} x ${formaterKr(v.pris)} kr = ${formaterKr(vareSum)} kr</li>`;
    }).join("");
    const vareblokk = varer ? `<p><strong>Varer/medisiner:</strong></p><ul>${varer}</ul>` : "";
    const bildeTekst = (j.vet_journal_bilder || []).length ? ` | ${(j.vet_journal_bilder || []).length} bilde(r)` : "";
    const vareTekst = (j.vet_journal_varer || []).length ? ` | ${(j.vet_journal_varer || []).length} vare(r)` : "";
    const id = esc(j.id || "");
    return `
      <div class="listekort vet-journal-kort" id="journalKort_${id}">
        <button type="button" class="vet-journal-linje" onclick="toggleJournalDetaljer('${id}')" title="Klikk for detaljer">
          <strong>${esc(j.dato || "")} - ${esc(j.vet_dyr?.navn || "")}</strong><br>
          <span class="lite">Eier: ${esc(j.vet_dyr?.vet_dyreeiere?.navn || "")}${j.type ? " | " + esc(j.type) : ""}${vareTekst}${bildeTekst}</span>
        </button>
        <div class="vet-journal-detaljer">
          <p>${esc(j.notat || "")}</p>
          ${prislinje}
          ${j.medisin_kladd ? `<p><strong>Medisin/reseptkladd:</strong><br>${esc(j.medisin_kladd)}</p>` : ""}
          ${vareblokk}
          ${bildeblokk}
        </div>
      </div>`;
  }).join("") || '<p class="lite">Ingen journalnotater ennå.</p>';
}

function toggleJournalDetaljer(id) {
  const kort = document.getElementById("journalKort_" + id);
  if (kort) kort.classList.toggle("apen");
}

window.toggleJournalDetaljer = toggleJournalDetaljer;




function journalErFakturert(j) {
  return j?.fakturert === true || String(j?.fakturanr || "").trim() !== "";
}

function hentJournalEierNavn(j) {
  return j?.vet_dyr?.vet_dyreeiere?.navn || "";
}

function hentJournalDyrNavn(j) {
  return j?.vet_dyr?.navn || "";
}

function hentAdminOkonomiJournaler() {
  const filter = vetTekst("adminOkonomiFilter") || "alle";
  const fra = vetTekst("adminOkonomiFraDato");
  const til = vetTekst("adminOkonomiTilDato");

  return (vetJournal || []).filter(j => {
    const fakturert = journalErFakturert(j);
    const dato = String(j.dato || "");

    if (filter === "fakturert" && !fakturert) return false;
    if (filter === "ikke_fakturert" && fakturert) return false;
    if (fra && dato && dato < fra) return false;
    if (til && dato && dato > til) return false;

    return true;
  });
}

function tegnAdminOkonomiOversikt() {
  const liste = document.getElementById("adminOkonomiListe");
  const summer = document.getElementById("adminOkonomiSummer");
  if (!liste || !summer) return;

  const journaler = hentAdminOkonomiJournaler();
  const alle = vetJournal || [];
  const fakturertAlle = alle.filter(journalErFakturert);
  const ikkeFakturertAlle = alle.filter(j => !journalErFakturert(j));

  const sum = rader => rader.reduce((s, j) => s + Number(j.belop_eks_mva || 0), 0);
  const sumValgt = sum(journaler);
  const sumFakturert = sum(fakturertAlle);
  const sumIkkeFakturert = sum(ikkeFakturertAlle);

  summer.innerHTML = `
    <div class="okonomi-boks">Valgt visning<strong>${formaterKr(sumValgt)} kr</strong><span class="lite">${journaler.length} journal(er)</span></div>
    <div class="okonomi-boks">Ikke fakturert<strong class="okonomi-advarsel">${formaterKr(sumIkkeFakturert)} kr</strong><span class="lite">${ikkeFakturertAlle.length} journal(er)</span></div>
    <div class="okonomi-boks">Fakturert<strong>${formaterKr(sumFakturert)} kr</strong><span class="lite">${fakturertAlle.length} journal(er)</span></div>
  `;

  if (!journaler.length) {
    liste.innerHTML = '<p class="lite">Ingen journaler funnet for valgt filter.</p>';
    return;
  }

  liste.innerHTML = `
    <table class="okonomi-tabell">
      <thead>
        <tr>
          <th>Dato</th>
          <th>Dyreeier</th>
          <th>Dyr</th>
          <th>Type</th>
          <th>Status</th>
          <th style="text-align:right;">Beløp eks. mva</th>
          <th>Fakturanr</th>
        </tr>
      </thead>
      <tbody>
        ${journaler.map(j => {
          const fakturert = journalErFakturert(j);
          return `
            <tr>
              <td>${htmlEscape(j.dato || "")}</td>
              <td>${htmlEscape(hentJournalEierNavn(j))}</td>
              <td>${htmlEscape(hentJournalDyrNavn(j))}</td>
              <td>${htmlEscape(j.type || "")}</td>
              <td>${fakturert ? "Fakturert" : '<span class="okonomi-advarsel">Ikke fakturert</span>'}</td>
              <td style="text-align:right;">${formaterKr(j.belop_eks_mva || 0)} kr</td>
              <td>${htmlEscape(j.fakturanr || "")}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}


function fakturaDatoKort(f) {
  const verdi = f?.dato;
  if (!verdi) return "";
  const tekst = String(verdi);
  if (/^\d{4}-\d{2}-\d{2}/.test(tekst)) return tekst.slice(0, 10);
  const d = new Date(verdi);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function erKreditnotaFaktura(f) {
  const verdi = f?.er_kreditnota;
  return verdi === true || String(verdi).toLowerCase() === "true" || String(verdi) === "1";
}

function mvaBelopMedFortegn(f, felt) {
  const tall = Number(f?.[felt] || 0);
  if (!Number.isFinite(tall)) return 0;

  // Faktura = positivt salg / utgående MVA.
  // Kreditnota skal trekkes fra salget.
  // Hvis kreditnota allerede er lagret med negative tall, beholdes negativt fortegn.
  if (erKreditnotaFaktura(f)) return tall > 0 ? -tall : tall;
  return tall;
}

function hentMvaFakturaer() {
  const fra = vetTekst("adminOkonomiFraDato");
  const til = vetTekst("adminOkonomiTilDato");

  return (vetFakturaer || []).filter(f => {
    const dato = fakturaDatoKort(f);
    if (fra && dato && dato < fra) return false;
    if (til && dato && dato > til) return false;
    return true;
  });
}

function tegnAdminMvaOversikt() {
  const summer = document.getElementById("adminMvaSummer");
  const liste = document.getElementById("adminMvaListe");
  if (!summer || !liste) return;

  const fakturaer = hentMvaFakturaer();
  const fakturaAntall = fakturaer.filter(f => !erKreditnotaFaktura(f)).length;
  const kreditnotaAntall = fakturaer.filter(erKreditnotaFaktura).length;

  const sumEks = fakturaer.reduce((s, f) => s + mvaBelopMedFortegn(f, "eks_mva"), 0);
  const sumMva = fakturaer.reduce((s, f) => s + mvaBelopMedFortegn(f, "mva"), 0);
  const sumInkl = fakturaer.reduce((s, f) => s + mvaBelopMedFortegn(f, "inkl_mva"), 0);

  const inngaaendeMva = 0;
  const mvaAaBetale = sumMva - inngaaendeMva;

  summer.innerHTML = `
    <div class="okonomi-boks">Salg eks. mva<strong>${formaterKr(sumEks)} kr</strong><span class="lite">${fakturaAntall} faktura(er), ${kreditnotaAntall} kreditnota(er) trukket fra</span></div>
    <div class="okonomi-boks">Utgående MVA<strong>${formaterKr(sumMva)} kr</strong><span class="lite">Fra fakturaer og kreditnotaer</span></div>
    <div class="okonomi-boks">Inngående MVA<strong>${formaterKr(inngaaendeMva)} kr</strong><span class="lite">Kommer fra innkjøp senere</span></div>
    <div class="okonomi-boks">MVA å betale<strong>${formaterKr(mvaAaBetale)} kr</strong><span class="lite">Utgående minus inngående</span></div>
    <div class="okonomi-boks">Salg inkl. mva<strong>${formaterKr(sumInkl)} kr</strong><span class="lite">Kreditnota trekkes fra automatisk</span></div>
  `;

  if (!fakturaer.length) {
    liste.innerHTML = '<p class="lite">Ingen fakturaer funnet for valgt periode.</p>';
    return;
  }

  const grupper = {};
  fakturaer.forEach(f => {
    const dato = fakturaDatoKort(f);
    const key = dato ? dato.slice(0, 7) : "Uten dato";
    if (!grupper[key]) grupper[key] = { antall: 0, kreditnota: 0, eks: 0, mva: 0, inkl: 0 };
    if (erKreditnotaFaktura(f)) grupper[key].kreditnota += 1;
    else grupper[key].antall += 1;
    grupper[key].eks += mvaBelopMedFortegn(f, "eks_mva");
    grupper[key].mva += mvaBelopMedFortegn(f, "mva");
    grupper[key].inkl += mvaBelopMedFortegn(f, "inkl_mva");
  });

  const rader = Object.entries(grupper)
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])));

  liste.innerHTML = `
    <table class="okonomi-tabell">
      <thead>
        <tr>
          <th>Periode</th>
          <th style="text-align:right;">Faktura</th>
          <th style="text-align:right;">Kreditnota</th>
          <th style="text-align:right;">Eks. mva</th>
          <th style="text-align:right;">Utgående MVA</th>
          <th style="text-align:right;">Inngående MVA</th>
          <th style="text-align:right;">MVA å betale</th>
          <th style="text-align:right;">Inkl. mva</th>
        </tr>
      </thead>
      <tbody>
        ${rader.map(([periode, r]) => `
          <tr>
            <td>${htmlEscape(periode)}</td>
            <td style="text-align:right;">${r.antall}</td>
            <td style="text-align:right;">${r.kreditnota}</td>
            <td style="text-align:right;">${formaterKr(r.eks)} kr</td>
            <td style="text-align:right;">${formaterKr(r.mva)} kr</td>
            <td style="text-align:right;">${formaterKr(0)} kr</td>
            <td style="text-align:right;">${formaterKr(r.mva)} kr</td>
            <td style="text-align:right;">${formaterKr(r.inkl)} kr</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function htmlEscape(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fyllFakturaDyreeierValg() {
  const valg = document.getElementById("fakturaDyreeierValg");
  if (!valg) return;

  const valgt = valg.value;
  valg.innerHTML = '<option value="">Velg dyreeier</option>' + vetDyreeiere
    .map(e => `<option value="${e.id}">${htmlEscape(e.navn || "")}</option>`)
    .join("");

  if (valgt) valg.value = valgt;
}

function settStandardFakturaDatoer() {
  const datoEl = document.getElementById("fakturaDato");
  const forfallEl = document.getElementById("fakturaForfallsdato");
  const iDag = new Date();
  const forfall = new Date();
  forfall.setDate(forfall.getDate() + 14);

  if (datoEl && !datoEl.value) datoEl.value = iDag.toISOString().slice(0, 10);
  if (forfallEl && !forfallEl.value) forfallEl.value = forfall.toISOString().slice(0, 10);
}

function hentFakturaEier() {
  const eierId = vetTekst("fakturaDyreeierValg");
  return vetDyreeiere.find(e => String(e.id) === String(eierId)) || null;
}

function hentFakturaJournaler(inkluderFakturerte = false) {
  const eier = hentFakturaEier();
  if (!eier) return [];

  const dyreIds = vetDyr
    .filter(d => String(d.dyreeier_id) === String(eier.id))
    .map(d => String(d.id));

  return vetJournal
    .filter(j => dyreIds.includes(String(j.dyr_id)))
    .filter(j => inkluderFakturerte || !journalErFakturert(j))
    .sort((a, b) => String(a.dato || "").localeCompare(String(b.dato || "")));
}

function lagFakturaLinjerFraJournaler(journaler) {
  const linjer = [];

  journaler.forEach(j => {
    const dyr = vetDyr.find(d => String(d.id) === String(j.dyr_id));
    const dyrNavn = dyr?.navn || j.vet_dyr?.navn || "Dyr";
    const dato = j.dato || "";
    const type = j.type || "Behandling";
    const behandler = finnBehandlerNavnForJournal(j);

    const fastpris = Number(j.fastpris || 0);
    if (fastpris > 0) {
      linjer.push({
        tekst: `${dato} - ${dyrNavn}: ${type}`,
        behandler,
        antall: 1,
        pris: fastpris,
        sum: fastpris
      });
    }

    const timepris = Number(j.timepris || 0);
    const timer = Number(j.timer || 0);
    if (timepris > 0 && timer > 0) {
      linjer.push({
        tekst: `${dato} - ${dyrNavn}: Timearbeid`,
        behandler,
        antall: timer,
        pris: timepris,
        sum: timer * timepris
      });
    }

    const km = Number(j.km || 0);
    const kmPris = Number(j.km_pris || 0);
    if (km > 0 && kmPris > 0) {
      linjer.push({
        tekst: `${dato} - ${dyrNavn}: Kjøring`,
        behandler,
        antall: km,
        pris: kmPris,
        sum: km * kmPris
      });
    }

    (j.vet_journal_varer || []).forEach(v => {
      const antall = Number(v.antall || 0);
      const pris = Number(v.pris || 0);
      const sum = Number(v.sum_eks_mva || (antall * pris));
      linjer.push({
        tekst: `${dato} - ${dyrNavn}: ${v.varenavn || "Vare/medisin"}`,
        behandler,
        antall,
        pris,
        sum
      });
    });

    if (Number(j.belop_eks_mva || 0) > 0 && fastpris <= 0 && !(timepris > 0 && timer > 0) && !(km > 0 && kmPris > 0)) {
      linjer.push({
        tekst: `${dato} - ${dyrNavn}: ${type}`,
        behandler,
        antall: 1,
        pris: Number(j.belop_eks_mva || 0),
        sum: Number(j.belop_eks_mva || 0)
      });
    }
  });

  return linjer;
}

function tegnFakturaGrunnlag() {
  const liste = document.getElementById("fakturaGrunnlagListe");
  if (!liste) return;

  const eier = hentFakturaEier();
  if (!eier) {
    liste.innerHTML = '<p class="lite">Velg dyreeier for å se fakturagrunnlag.</p>';
    return;
  }

  const journaler = hentFakturaJournaler();
  const linjer = lagFakturaLinjerFraJournaler(journaler);

  if (!journaler.length || !linjer.length) {
    liste.innerHTML = '<p class="lite">Fant ingen journaler med beløp for valgt dyreeier.</p>';
    return;
  }

  const sumEks = linjer.reduce((sum, l) => sum + Number(l.sum || 0), 0);
  const behandlere = [...new Set(linjer.map(l => l.behandler).filter(Boolean))].join(", ");
  const mva = sumEks * 0.25;
  const sumInk = sumEks + mva;

  liste.innerHTML = `
    <div class="listekort">
      <strong>Fakturagrunnlag for ${htmlEscape(eier.navn || "")}</strong><br>
      <span class="lite">${journaler.length} journal(er), ${linjer.length} fakturalinje(r)</span>
      <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:14px;">
        <thead>
          <tr>
            <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px;">Tekst</th>
            <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px;">Behandler</th>
            <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px;">Antall</th>
            <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px;">Pris</th>
            <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px;">Sum</th>
          </tr>
        </thead>
        <tbody>
          ${linjer.map(l => `
            <tr>
              <td style="padding:6px; border-bottom:1px solid #eee;">${htmlEscape(l.tekst)}</td>
              <td style="padding:6px; border-bottom:1px solid #eee;">${htmlEscape(l.behandler || "")}</td>
              <td style="padding:6px; border-bottom:1px solid #eee; text-align:right;">${formaterKr(l.antall)}</td>
              <td style="padding:6px; border-bottom:1px solid #eee; text-align:right;">${formaterKr(l.pris)}</td>
              <td style="padding:6px; border-bottom:1px solid #eee; text-align:right;">${formaterKr(l.sum)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p style="text-align:right;"><strong>Eks. mva:</strong> ${formaterKr(sumEks)} kr<br>
      <strong>Mva 25%:</strong> ${formaterKr(mva)} kr<br>
      <strong>Å betale:</strong> ${formaterKr(sumInk)} kr</p>
    </div>
  `;
}

function hentFakturaKlinikk() {
  if (vetAktivKlinikk) return vetAktivKlinikk;
  const valgt = hentValgtKlinikk();
  if (valgt) return valgt;
  const journaler = hentFakturaJournaler();
  const klinikkId = journaler.find(j => j.klinikk_id)?.klinikk_id || vetAktivKlinikkId;
  return vetKlinikker.find(k => String(k.id) === String(klinikkId)) || vetKlinikker[0] || {};
}


function fyllKreditnotaFakturaValg() {
  const valg = document.getElementById("kreditnotaFakturaValg");
  if (!valg) return;

  const valgt = valg.value;
  const fakturaer = (vetFakturaer || [])
    .filter(f => !erKreditnotaFaktura(f))
    .sort((a, b) => String(fakturaDatoKort(b)).localeCompare(String(fakturaDatoKort(a))));

  if (!fakturaer.length) {
    valg.innerHTML = '<option value="">Ingen fakturaer funnet</option>';
    return;
  }

  valg.innerHTML = '<option value="">Velg faktura</option>' + fakturaer.map(f => {
    const nr = f.fakturanr || f.id;
    const dato = fakturaDatoKort(f);
    const sum = formaterKr(f.inkl_mva || 0);
    return `<option value="${f.id}">${htmlEscape(nr)}${dato ? " - " + htmlEscape(dato) : ""} - ${sum} kr</option>`;
  }).join("");

  if (valgt && fakturaer.some(f => String(f.id) === String(valgt))) valg.value = valgt;
}

function hentValgtKreditnotaFaktura() {
  const id = vetTekst("kreditnotaFakturaValg");
  if (!id) return null;
  return (vetFakturaer || []).find(f => String(f.id) === String(id)) || null;
}

async function lagVetKreditnota() {
  vetMelding("fakturaMelding", "");
  const original = hentValgtKreditnotaFaktura();
  if (!original) {
    vetMelding("fakturaMelding", "Velg faktura som skal krediteres.");
    return;
  }

  const allerede = (vetFakturaer || []).find(f => String(f.kreditnota_for || "") === String(original.id));
  if (allerede) {
    vetMelding("fakturaMelding", "Denne fakturaen har allerede kreditnota: " + (allerede.fakturanr || ""));
    skrivUtVetKreditnota(original, allerede.fakturanr || "KREDITNOTA");
    return;
  }

  const kreditnr = `K-${original.fakturanr || new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12)}`;
  const rad = {
    fakturanr: kreditnr,
    kunden_id: original.kunden_id || null,
    dato: new Date().toISOString(),
    eks_mva: Number(original.eks_mva || 0),
    mva: Number(original.mva || 0),
    inkl_mva: Number(original.inkl_mva || 0),
    er_kreditnota: true,
    kreditnota_for: original.id,
    status: "kreditnota",
    betalingsstatus: "kreditert"
  };

  const { error } = await supabaseClient.from("fakturaer").insert(rad);
  if (error) {
    vetMelding("fakturaMelding", "Kunne ikke lagre kreditnota: " + error.message);
    return;
  }

  vetMelding("fakturaMelding", "Kreditnota laget: " + kreditnr);
  await lastVetFakturaer();
  fyllKreditnotaFakturaValg();
  tegnAdminMvaOversikt();
  skrivUtVetKreditnota(original, kreditnr);
}

function skrivUtVetKreditnota(original, kreditnr) {
  const klinikk = hentFakturaKlinikk();
  const dato = new Date().toISOString().slice(0, 10);
  const eks = Number(original.eks_mva || 0);
  const mva = Number(original.mva || 0);
  const inkl = Number(original.inkl_mva || 0);
  const logoHtml = klinikk.logo_url
    ? `<img src="${htmlEscape(klinikk.logo_url)}" alt="Logo" style="max-height:90px; max-width:260px; object-fit:contain;">`
    : "";

  const printHtml = `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<title>Kreditnota ${htmlEscape(kreditnr)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #222; }
  .topp { display:flex; justify-content:space-between; gap:30px; align-items:flex-start; border-bottom:2px solid #222; padding-bottom:18px; }
  h1 { margin:0; font-size:30px; letter-spacing:1px; }
  table { width:100%; border-collapse:collapse; margin-top:24px; font-size:14px; }
  th, td { padding:8px; border-bottom:1px solid #ddd; vertical-align:top; }
  th { text-align:left; background:#f4f6f8; }
  .right { text-align:right; }
  .summer { margin-left:auto; margin-top:20px; width:340px; }
  .summer td { border-bottom:0; padding:5px 0; }
  .total { font-size:18px; font-weight:bold; border-top:2px solid #222; padding-top:8px; }
  @media print { button { display:none; } body { margin:18mm; } }
</style>
</head>
<body>
  <div class="topp">
    <div>
      ${logoHtml}<br>
      <strong>${htmlEscape(klinikk.navn || "Klinikk")}</strong><br>
      ${htmlEscape(klinikk.adresse || "")}<br>
      ${htmlEscape(klinikk.telefon || "")} ${htmlEscape(klinikk.epost || "")}
    </div>
    <div class="right">
      <h1>KREDITNOTA</h1>
      <p><strong>Kreditnotanr:</strong> ${htmlEscape(kreditnr)}<br>
      <strong>Dato:</strong> ${htmlEscape(dato)}<br>
      <strong>Krediterer faktura:</strong> ${htmlEscape(original.fakturanr || original.id)}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Beskrivelse</th><th class="right">Eks. mva</th><th class="right">MVA</th><th class="right">Inkl. mva</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Kreditering av faktura ${htmlEscape(original.fakturanr || original.id)}</td>
        <td class="right">-${formaterKr(eks)} kr</td>
        <td class="right">-${formaterKr(mva)} kr</td>
        <td class="right">-${formaterKr(inkl)} kr</td>
      </tr>
    </tbody>
  </table>

  <table class="summer">
    <tr><td>Sum eks. mva</td><td class="right">-${formaterKr(eks)} kr</td></tr>
    <tr><td>MVA</td><td class="right">-${formaterKr(mva)} kr</td></tr>
    <tr><td class="total">Sum kreditert</td><td class="right total">-${formaterKr(inkl)} kr</td></tr>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const vindu = window.open("", "_blank");
  if (!vindu) {
    vetMelding("fakturaMelding", "Kunne ikke åpne kreditnota. Tillat popup-vindu for siden.");
    return;
  }
  vindu.document.open();
  vindu.document.write(printHtml);
  vindu.document.close();
}

async function skrivUtVetFaktura() {
  vetMelding("fakturaMelding", "");
  settStandardFakturaDatoer();

  // Sørg for at behandlerlisten er lastet før fakturalinjer bygges.
  // Uten dette kan Behandler-kolonnen bli tom selv om opprettet_av finnes.
  if (!vetAlleKlinikkBrukere.length) {
    await lastVetKlinikkBrukereAlle();
  }

  const eier = hentFakturaEier();
  if (!eier) {
    vetMelding("fakturaMelding", "Velg dyreeier først.");
    return;
  }

  const journaler = hentFakturaJournaler();
  const linjer = lagFakturaLinjerFraJournaler(journaler);
  if (!linjer.length) {
    vetMelding("fakturaMelding", "Fant ingen fakturalinjer for valgt dyreeier.");
    return;
  }

  const vindu = window.open("", "_blank");
  if (!vindu) {
    vetMelding("fakturaMelding", "Kunne ikke åpne utskrift. Tillat popup-vindu for siden.");
    return;
  }
  vindu.document.open();
  vindu.document.write("<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Lager faktura</title></head><body><p>Lager og lagrer faktura...</p></body></html>");
  vindu.document.close();

  const klinikk = hentFakturaKlinikk();
  const fakturaDato = vetTekst("fakturaDato") || new Date().toISOString().slice(0, 10);
  const forfallsdato = vetTekst("fakturaForfallsdato") || fakturaDato;
  const fakturanr = `VET-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12)}`;
  const sumEks = linjer.reduce((sum, l) => sum + Number(l.sum || 0), 0);
  const behandlere = [...new Set(linjer.map(l => l.behandler).filter(Boolean))].join(", ");
  const mva = sumEks * 0.25;
  const sumInk = sumEks + mva;

  const journalIds = journaler.map(j => j.id).filter(Boolean);
  if (!journalIds.length) {
    vetMelding("fakturaMelding", "Fant ingen journaler som kan merkes som fakturert.");
    return;
  }

  const fakturaRad = {
    fakturanr,
    kunden_id: String(eier.id),
    dato: fakturaDato,
    forfallsdato,
    eks_mva: sumEks,
    mva,
    inkl_mva: sumInk,
    er_kreditnota: false,
    status: "fakturert",
    betalingsstatus: "ubetalt"
  };

  const { error: fakturaError } = await supabaseClient
    .from("fakturaer")
    .insert(fakturaRad);

  if (fakturaError) {
    vetMelding("fakturaMelding", "Faktura ble ikke lagret: " + fakturaError.message);
    return;
  }

  const { error: journalUpdateError } = await supabaseClient
    .from("vet_journal")
    .update({ fakturert: true, fakturanr })
    .in("id", journalIds);

  if (journalUpdateError) {
    vetMelding("fakturaMelding", "Faktura ble lagret, men journalene ble ikke merket som fakturert: " + journalUpdateError.message);
    return;
  }

  const logoHtml = klinikk.logo_url
    ? `<img src="${htmlEscape(klinikk.logo_url)}" alt="Logo" style="max-height:90px; max-width:260px; object-fit:contain;">`
    : "";

  const printHtml = `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<title>Faktura ${htmlEscape(fakturanr)}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #222; }
  .topp { display:flex; justify-content:space-between; gap:30px; align-items:flex-start; border-bottom:2px solid #222; padding-bottom:18px; }
  .logo { margin-bottom:10px; }
  h1 { margin:0; font-size:30px; letter-spacing:1px; }
  .boks { margin-top:22px; display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  .kort-print { border:1px solid #ddd; border-radius:0; padding:14px; }
  table { width:100%; border-collapse:collapse; margin-top:24px; font-size:14px; }
  th, td { padding:8px; border-bottom:1px solid #ddd; vertical-align:top; }
  th { text-align:left; background:#f4f6f8; }
  .right { text-align:right; }
  .summer { margin-left:auto; margin-top:20px; width:320px; }
  .summer td { border-bottom:0; padding:5px 0; }
  .total { font-size:18px; font-weight:bold; border-top:2px solid #222; padding-top:8px; }
  @media print { button { display:none; } body { margin:18mm; } }
</style>
</head>
<body>
  <div class="topp">
    <div>
      <div class="logo">${logoHtml}</div>
      <strong>${htmlEscape(klinikk.navn || "Klinikk")}</strong><br>
      ${htmlEscape(klinikk.adresse || "")}<br>
      ${htmlEscape(klinikk.telefon || "")} ${htmlEscape(klinikk.epost || "")}
    </div>
    <div class="right">
      <h1>FAKTURA</h1>
      <p><strong>Fakturanr:</strong> ${htmlEscape(fakturanr)}<br>
      <strong>Dato:</strong> ${htmlEscape(fakturaDato)}<br>
      <strong>Forfall:</strong> ${htmlEscape(forfallsdato)}</p>
    </div>
  </div>

  <div class="boks">
    <div class="kort-print">
      <strong>Kunde</strong><br>
      ${htmlEscape(eier.navn || "")}<br>
      ${htmlEscape(eier.adresse || "")}<br>
      ${htmlEscape(eier.epost || "")} ${htmlEscape(eier.telefon || "")}
    </div>
    <div class="kort-print">
      <strong>Gjelder</strong><br>
      Veterinærbehandling, kjøring og varer/medisiner fra journal.<br>
      <strong>Behandler:</strong> ${htmlEscape(behandlere || "Ukjent")}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Beskrivelse</th>
        <th>Behandler</th>
        <th class="right">Antall</th>
        <th class="right">Pris eks. mva</th>
        <th class="right">Sum eks. mva</th>
      </tr>
    </thead>
    <tbody>
      ${linjer.map(l => `
        <tr>
          <td>${htmlEscape(l.tekst)}</td>
          <td>${htmlEscape(l.behandler || "")}</td>
          <td class="right">${formaterKr(l.antall)}</td>
          <td class="right">${formaterKr(l.pris)}</td>
          <td class="right">${formaterKr(l.sum)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <table class="summer">
    <tr><td>Sum eks. mva</td><td class="right">${formaterKr(sumEks)} kr</td></tr>
    <tr><td>Mva 25%</td><td class="right">${formaterKr(mva)} kr</td></tr>
    <tr><td class="total">Å betale</td><td class="right total">${formaterKr(sumInk)} kr</td></tr>
  </table>

  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  vindu.document.open();
  vindu.document.write(printHtml);
  vindu.document.close();

  vetMelding("fakturaMelding", "Faktura lagret og journalene er merket som fakturert: " + fakturanr);
  await lastJournal();
  await lastVetFakturaer();
  fyllKreditnotaFakturaValg();
  tegnFakturaGrunnlag();
  if (typeof tegnAdminOversikt === "function") tegnAdminOversikt();
  if (typeof tegnAdminMvaOversikt === "function") tegnAdminMvaOversikt();
}

function vetBackupMelding(tekst, erFeil = false) {
  const el = document.getElementById("backupMelding");
  if (!el) return;
  el.textContent = tekst || "";
  el.style.color = erFeil ? "#b42318" : "#116329";
}

function vetLastNedFil(filnavn, innhold, mime = "application/json") {
  const blob = new Blob([innhold], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filnavn;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function vetHentTabell(tabell) {
  const { data, error } = await supabaseClient
    .from(tabell)
    .select("*");

  if (error) {
    console.warn("Kunne ikke hente tabell", tabell, error.message);
    return { data: [], error: error.message };
  }

  return { data: data || [], error: null };
}

async function vetLagBackup() {
  vetBackupMelding("");

  const tabeller = [
    "vet_klinikker",
    "vet_klinikk_brukere",
    "vet_dyreeiere",
    "vet_dyr",
    "vet_priser",
    "vet_journal",
    "vet_journal_varer",
    "vet_journal_bilder"
  ];

  const backup = {
    type: "rett-i-lomma-veterinaer-backup",
    versjon: 1,
    laget: new Date().toISOString(),
    tabeller: {}
  };

  for (const tabell of tabeller) {
    const res = await vetHentTabell(tabell);
    backup.tabeller[tabell] = res.data;
    if (res.error) {
      backup.tabeller[tabell + "_error"] = res.error;
    }
  }

  const dato = new Date().toISOString().slice(0, 10);
  vetLastNedFil(
    `veterinaer_backup_${dato}.json`,
    JSON.stringify(backup, null, 2),
    "application/json"
  );

  vetBackupMelding("Backup laget og lastet ned.");
}

function vetLesFilSomTekst(fil) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(String(e.target.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Kunne ikke lese fil."));
    reader.readAsText(fil, "utf-8");
  });
}

function vetRensRadForRestore(tabell, rad) {
  const kopi = { ...rad };

  // created_at kan beholdes, men tomme verdier fjernes.
  Object.keys(kopi).forEach(k => {
    if (kopi[k] === "") delete kopi[k];
  });

  return kopi;
}

async function vetRestoreBackup() {
  vetBackupMelding("");

  const input = document.getElementById("vetRestoreFil");
  const fil = input?.files?.[0];

  if (!fil) {
    vetBackupMelding("Velg en backupfil først.", true);
    return;
  }

  let backup;
  try {
    backup = JSON.parse(await vetLesFilSomTekst(fil));
  } catch (e) {
    vetBackupMelding("Kunne ikke lese backupfil: " + (e.message || e), true);
    return;
  }

  if (!backup || backup.type !== "rett-i-lomma-veterinaer-backup" || !backup.tabeller) {
    vetBackupMelding("Dette ser ikke ut som en gyldig veterinær-backup.", true);
    return;
  }

  const rekkefolge = [
    "vet_klinikker",
    "vet_klinikk_brukere",
    "vet_dyreeiere",
    "vet_dyr",
    "vet_priser",
    "vet_journal",
    "vet_journal_varer",
    "vet_journal_bilder"
  ];

  let antall = 0;

  for (const tabell of rekkefolge) {
    const rader = backup.tabeller[tabell] || [];
    if (!rader.length) continue;

    const renset = rader.map(rad => vetRensRadForRestore(tabell, rad));

    const { error } = await supabaseClient
      .from(tabell)
      .upsert(renset, { onConflict: "id" });

    if (error) {
      vetBackupMelding(`Restore stoppet på ${tabell}: ${error.message}`, true);
      return;
    }

    antall += renset.length;
  }

  vetBackupMelding(`Restore ferdig. ${antall} rader lest inn.`);
  await lastVetData();
}

function vetParseCsvLinje(linje) {
  const resultat = [];
  let felt = "";
  let inneISitat = false;

  for (let i = 0; i < linje.length; i++) {
    const tegn = linje[i];
    const neste = linje[i + 1];

    if (tegn === '"' && inneISitat && neste === '"') {
      felt += '"';
      i++;
    } else if (tegn === '"') {
      inneISitat = !inneISitat;
    } else if (tegn === "," && !inneISitat) {
      resultat.push(felt.trim());
      felt = "";
    } else if (tegn === ";" && !inneISitat) {
      resultat.push(felt.trim());
      felt = "";
    } else {
      felt += tegn;
    }
  }

  resultat.push(felt.trim());
  return resultat;
}

function vetParseCsv(tekst) {
  const linjer = tekst
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (!linjer.length) return [];

  const headers = vetParseCsvLinje(linjer[0]).map(h => h.toLowerCase().trim());

  return linjer.slice(1).map(linje => {
    const verdier = vetParseCsvLinje(linje);
    const rad = {};
    headers.forEach((h, i) => {
      rad[h] = verdier[i] ?? "";
    });
    return rad;
  });
}

function vetNormaliserPrisType(type) {
  const t = String(type || "fastpris").trim().toLowerCase();

  if (["time", "timer", "timepris"].includes(t)) return "timepris";
  if (["km", "kjøring", "kjoring", "kmpris"].includes(t)) return "kmpris";
  if (["vare", "varer", "medisin", "medisiner"].includes(t)) return "vare";
  if (["annet"].includes(t)) return "annet";

  return "fastpris";
}

async function vetImporterPriserCsv() {
  console.log("Importerer veterinærpriser fra CSV");
  vetBackupMelding("");

  const input = document.getElementById("vetImportPriserFil");
  const fil = input?.files?.[0];

  if (!fil) {
    vetBackupMelding("Velg CSV-fil først.", true);
    return;
  }

  let rader;
  try {
    rader = vetParseCsv(await vetLesFilSomTekst(fil));
  } catch (e) {
    vetBackupMelding("Kunne ikke lese CSV: " + (e.message || e), true);
    return;
  }

  const importRader = rader
    .map(r => ({
      navn: String(r.navn || r.behandling || r.vare || r.varenavn || "").trim(),
      type: vetNormaliserPrisType(r.type || r.pristype),
      pris: Number(String(r.pris || r.belop || r.beløp || 0).replace(",", ".")) || 0,
      beskrivelse: String(r.beskrivelse || r.tekst || "").trim() || null,
      aktiv: true
    }))
    .filter(r => r.navn);

  if (!importRader.length) {
    vetBackupMelding("Fant ingen gyldige rader. CSV må ha minst navn og pris.", true);
    return;
  }

  const { error } = await supabaseClient
    .from("vet_priser")
    .insert(importRader);

  if (error) {
    vetBackupMelding("Feil ved import: " + error.message, true);
    return;
  }

  vetBackupMelding(`Import ferdig. ${importRader.length} behandlinger/varer lest inn.`);
  await lastPriser();
}


function vetTallFraCsv(verdi, standard = 0) {
  if (verdi === undefined || verdi === null || String(verdi).trim() === "") return standard;
  const n = Number(String(verdi).replace(" ", "").replace(",", "."));
  return Number.isFinite(n) ? n : standard;
}

async function vetImporterVarerCsv() {
  console.log("Importerer veterinærvarer fra CSV");
  vetBackupMelding("");

  const klinikkId = hentKlinikkIdForLager();
  if (!klinikkId) {
    vetBackupMelding("Velg/lagre klinikk før du importerer varer.", true);
    return;
  }

  const input = document.getElementById("vetImportVarerFil");
  const fil = input?.files?.[0];

  if (!fil) {
    vetBackupMelding("Velg CSV-fil med medisiner/varer først.", true);
    return;
  }

  let rader;
  try {
    rader = vetParseCsv(await vetLesFilSomTekst(fil));
  } catch (e) {
    vetBackupMelding("Kunne ikke lese CSV: " + (e.message || e), true);
    return;
  }

  const importRader = rader
    .map(r => ({
      navn: String(r.navn || r.vare || r.varenavn || r.medisin || "").trim(),
      kategori: String(r.kategori || r.type || "medisin").trim() || "medisin",
      enhet: String(r.enhet || "stk").trim() || "stk",
      utsalgspris: vetTallFraCsv(r.utsalgspris ?? r.pris ?? r.salgspris ?? r.belop ?? r.beløp, 0),
      minimum_antall: vetTallFraCsv(r.minimum_antall ?? r.minimum ?? r.min ?? r.varsling, 0),
      hovedlager_antall: vetTallFraCsv(r.hovedlager_antall ?? r.antall ?? r.lager ?? r.beholdning, 0)
    }))
    .filter(r => r.navn);

  if (!importRader.length) {
    vetBackupMelding("Fant ingen gyldige rader. CSV må ha minst kolonnen navn.", true);
    return;
  }

  let opprettet = 0;
  let oppdatert = 0;
  let lagerOppdatert = 0;

  try {
    await lastVetVarer();

    for (const rad of importRader) {
      const eksisterende = vetVarer.find(v =>
        String(v.klinikk_id || "") === String(klinikkId) &&
        String(v.navn || "").trim().toLowerCase() === rad.navn.toLowerCase()
      );

      const vareRad = {
        klinikk_id: klinikkId,
        navn: rad.navn,
        kategori: rad.kategori,
        enhet: rad.enhet,
        utsalgspris: rad.utsalgspris,
        minimum_antall: rad.minimum_antall,
        aktiv: true
      };

      let vareId = eksisterende?.id;

      if (vareId) {
        const { error } = await supabaseClient
          .from("vet_varer")
          .update(vareRad)
          .eq("id", vareId);
        if (error) throw error;
        oppdatert++;
      } else {
        const { data, error } = await supabaseClient
          .from("vet_varer")
          .insert(vareRad)
          .select("id")
          .single();
        if (error) throw error;
        vareId = data.id;
        opprettet++;
      }

      if (rad.hovedlager_antall > 0 && vareId) {
        await settLagerAntall("vet_lager", { klinikk_id: klinikkId, vare_id: vareId }, rad.hovedlager_antall);
        lagerOppdatert++;
      }
    }

    if (input) input.value = "";
    await lastVetLagerAlt();
    vetBackupMelding(`Vareimport ferdig. Opprettet: ${opprettet}. Oppdatert: ${oppdatert}. Hovedlager satt på ${lagerOppdatert} varer.`);
  } catch (e) {
    vetBackupMelding("Feil ved vareimport: " + (e.message || e), true);
  }
}



let vetKlinikkBrukere = [];

async function lastKlinikkBrukere() {
  if (!erKlinikkAdmin()) return;

  const klinikkId = vetTekst("klinikkId");
  if (!klinikkId) {
    tegnKlinikkBrukere([]);
    return;
  }

  const { data, error } = await supabaseClient
    .from("vet_klinikk_brukere")
    .select("*")
    .eq("klinikk_id", klinikkId)
    .order("epost", { ascending: true });

  if (error) {
    vetMelding("klinikkBrukerMelding", "Feil ved henting av brukere: " + error.message);
    return;
  }

  vetKlinikkBrukere = data || [];
  tegnKlinikkBrukere(vetKlinikkBrukere);
}

function tegnKlinikkBrukere(liste = []) {
  const el = document.getElementById("klinikkBrukerListe");
  if (!el) return;

  if (!erKlinikkAdmin()) {
    el.innerHTML = "";
    return;
  }

  if (!liste.length) {
    el.innerHTML = '<p class="lite">Ingen brukere koblet til valgt klinikk ennå.</p>';
    return;
  }

  el.innerHTML = liste.map(b => `
    <div class="listekort">
      <strong>${b.epost || ""}</strong><br>
      <span class="lite">Rolle: ${b.rolle || "veterinaer"}</span>
    </div>
  `).join("");
}

async function lagreKlinikkBruker() {
  vetMelding("klinikkBrukerMelding", "");

  if (!erKlinikkAdmin()) {
    vetMelding("klinikkBrukerMelding", "Kun admin kan koble brukere til klinikk.");
    return;
  }

  let klinikkId = vetTekst("klinikkId");
  if (!vetErSystemAdmin && vetAktivKlinikkId) klinikkId = vetAktivKlinikkId;
  const epost = vetTekst("klinikkBrukerEpost").toLowerCase();
  const rolle = vetTekst("klinikkBrukerRolle") || "veterinaer";

  if (!klinikkId) {
    vetMelding("klinikkBrukerMelding", "Velg/rediger klinikk først.");
    return;
  }

  if (!epost) {
    vetMelding("klinikkBrukerMelding", "Skriv e-post.");
    return;
  }

  const { error } = await supabaseClient
    .from("vet_klinikk_brukere")
    .upsert({
      epost,
      klinikk_id: klinikkId,
      rolle,
      aktiv: true
    }, { onConflict: "epost" });

  if (error) {
    vetMelding("klinikkBrukerMelding", "Feil ved lagring av bruker: " + error.message);
    return;
  }

  vetSett("klinikkBrukerEpost", "");
  vetSett("klinikkBrukerRolle", "veterinaer");
  vetMelding("klinikkBrukerMelding", "Bruker koblet til klinikk.");
  await lastKlinikkBrukere();
}

function oppdaterAdminBrukerSynlighet() {
  const el = document.getElementById("adminKlinikkBrukere");
  if (!el) return;
  el.style.display = erKlinikkAdmin() ? "" : "none";
  if (erKlinikkAdmin()) el.classList.remove("skjult");
  else el.classList.add("skjult");
}


async function hentKlinikkIdForNyBruker() {
  let klinikkId = vetTekst("klinikkId");

  if (!vetErSystemAdmin && vetAktivKlinikkId) {
    klinikkId = vetAktivKlinikkId;
  }

  if (!klinikkId && vetAktivKlinikkId) {
    klinikkId = vetAktivKlinikkId;
  }

  return klinikkId;
}

async function opprettKlinikkBruker() {
  vetMelding("klinikkBrukerMelding", "");

  if (!erKlinikkAdmin()) {
    vetMelding("klinikkBrukerMelding", "Kun klinikkadmin kan opprette brukere.");
    return;
  }

  const klinikkId = await hentKlinikkIdForNyBruker();
  const navn = vetTekst("nyBrukerNavn");
  const epost = vetTekst("nyBrukerEpost").toLowerCase();
  const passord = vetTekst("nyBrukerPassord");
  const rolle = vetTekst("nyBrukerRolle") || "veterinaer";

  if (!klinikkId) {
    vetMelding("klinikkBrukerMelding", "Velg/rediger klinikk først.");
    return;
  }

  if (!epost || !passord) {
    vetMelding("klinikkBrukerMelding", "Skriv e-post og passord.");
    return;
  }

  if (passord.length < 6) {
    vetMelding("klinikkBrukerMelding", "Passord må være minst 6 tegn.");
    return;
  }

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    vetMelding("klinikkBrukerMelding", "Du er ikke innlogget.");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/opprett-vet-bruker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      navn,
      epost,
      passord,
      rolle,
      klinikk_id: klinikkId
    })
  });

  const svar = await res.json().catch(() => ({}));

  if (!res.ok) {
    vetMelding("klinikkBrukerMelding", svar.error || "Kunne ikke opprette bruker.");
    return;
  }

  vetSett("nyBrukerNavn", "");
  vetSett("nyBrukerEpost", "");
  vetSett("nyBrukerPassord", "");
  vetSett("nyBrukerRolle", "veterinaer");

  vetMelding("klinikkBrukerMelding", "Bruker opprettet og koblet til klinikken.");
  await lastKlinikkBrukere();
}

function kobleVet() {
  document.getElementById("vetArbeidKnapp")?.addEventListener("click", toggleVetArbeidMeny);
  document.getElementById("vetAdminKnapp")?.addEventListener("click", toggleVetAdminMeny);

  document.getElementById("vetMenyDyreeiereKnapp")?.addEventListener("click", () => visVetSide("eierSide"));
  document.getElementById("vetMenyNyDyreeierKnapp")?.addEventListener("click", nyDyreeier);
  document.getElementById("vetMenyNyPasientKnapp")?.addEventListener("click", nyPasient);
  document.getElementById("vetMenyJournalKnapp")?.addEventListener("click", () => visVetSide("journalSide"));
  document.getElementById("vetMenyMinBilKnapp")?.addEventListener("click", () => visVetSide("lagerSide"));
  document.getElementById("vetMenyFakturaKnapp")?.addEventListener("click", () => visVetSide("fakturaSide"));

  document.getElementById("vetAdminKlinikkKnapp")?.addEventListener("click", () => visVetSide("klinikkSide"));
  document.getElementById("vetAdminPrislisteKnapp")?.addEventListener("click", () => visVetSide("prisSide"));
  document.getElementById("vetAdminOversiktKnapp")?.addEventListener("click", () => visVetSide("okonomiSide"));
  document.getElementById("vetAdminLagerKnapp")?.addEventListener("click", () => visVetSide("lagerSide"));
  document.getElementById("vetAdminBackupKnapp")?.addEventListener("click", () => visVetSide("backupSide"));

  document.getElementById("nyDyreeierFastKnapp")?.addEventListener("click", nyDyreeier);
  document.getElementById("nyPasientFastKnapp")?.addEventListener("click", nyPasient);

  document.getElementById("vetOppsettKnapp")?.addEventListener("click", toggleVetOppsettMeny);
  document.getElementById("vetVisSomVeterinaerKnapp")?.addEventListener("click", byttVetRollevisning);
  document.getElementById("vetBackupKnapp")?.addEventListener("click", vetLagBackup);
  document.getElementById("vetRestoreKnapp")?.addEventListener("click", vetRestoreBackup);
  document.getElementById("vetImportPriserKnapp")?.addEventListener("click", vetImporterPriserCsv);
  document.getElementById("vetImportVarerKnapp")?.addEventListener("click", vetImporterVarerCsv);
  document.getElementById("hentFakturaGrunnlagKnapp")?.addEventListener("click", tegnFakturaGrunnlag);
  document.getElementById("skrivUtVetFakturaKnapp")?.addEventListener("click", skrivUtVetFaktura);
  document.getElementById("lagVetKreditnotaKnapp")?.addEventListener("click", lagVetKreditnota);
  document.getElementById("fakturaDyreeierValg")?.addEventListener("change", tegnFakturaGrunnlag);
  document.getElementById("oppdaterAdminOkonomiKnapp")?.addEventListener("click", () => { tegnAdminOkonomiOversikt(); tegnAdminMvaOversikt(); });
  document.getElementById("adminOkonomiFilter")?.addEventListener("change", tegnAdminOkonomiOversikt);
  document.getElementById("adminOkonomiFraDato")?.addEventListener("change", () => { tegnAdminOkonomiOversikt(); tegnAdminMvaOversikt(); });
  document.getElementById("adminOkonomiTilDato")?.addEventListener("change", () => { tegnAdminOkonomiOversikt(); tegnAdminMvaOversikt(); });
  document.getElementById("klinikkLogoFil")?.addEventListener("change", forhåndsvisKlinikkLogo);
  document.getElementById("opprettKlinikkBrukerKnapp")?.addEventListener("click", opprettKlinikkBruker);
  document.getElementById("lagreKlinikkBrukerKnapp")?.addEventListener("click", lagreKlinikkBruker);
  document.getElementById("lagreKlinikkKnapp")?.addEventListener("click", lagreKlinikk);
  document.getElementById("lagreDyreeierKnapp")?.addEventListener("click", lagreDyreeier);
  document.getElementById("dyreeierDyrValg")?.addEventListener("change", brukValgtDyrFraDyreeier);
  document.getElementById("nyttDyrForEierKnapp")?.addEventListener("click", leggTilNyttDyrForValgtDyreeier);
  document.getElementById("redigerValgtDyrKnapp")?.addEventListener("click", redigerValgtDyrForDyreeier);
  document.getElementById("dyreeierVelgForDyr")?.addEventListener("change", brukValgtDyreeierForDyr);
  document.getElementById("lagreDyrKnapp")?.addEventListener("click", lagreDyr);
  document.getElementById("lagreJournalKnapp")?.addEventListener("click", lagreJournal);
  document.getElementById("lagrePrisKnapp")?.addEventListener("click", lagrePris);
  document.getElementById("nyPrisKnapp")?.addEventListener("click", nullstillPris);
  document.getElementById("journalDyreeierValg")?.addEventListener("change", brukValgtJournalDyreeier);
  document.getElementById("journalPrisValg")?.addEventListener("change", brukValgtPrisIJournal);
  document.getElementById("leggTilJournalBehandlingKnapp")?.addEventListener("click", leggTilJournalBehandling);
  document.getElementById("leggTilJournalKjoringKnapp")?.addEventListener("click", leggTilJournalKjoring);
  document.getElementById("leggTilJournalVareKnapp")?.addEventListener("click", leggTilJournalVare);
  document.getElementById("lagreVetVareKnapp")?.addEventListener("click", lagreVetVare);
  document.getElementById("nyVetVareKnapp")?.addEventListener("click", nullstillVetVare);
  document.getElementById("oppdaterHovedlagerKnapp")?.addEventListener("click", oppdaterHovedlager);
  document.getElementById("lagreVetBilKnapp")?.addEventListener("click", lagreVetBil);
  document.getElementById("nyVetBilKnapp")?.addEventListener("click", nullstillVetBil);
  document.getElementById("flyttTilBilKnapp")?.addEventListener("click", flyttTilBil);
  document.getElementById("minBilValg")?.addEventListener("change", fyllMinBilSide);
  document.getElementById("fyllMinBilFlereKnapp")?.addEventListener("click", fyllMinBilMedFlereVarer);
  document.getElementById("journalBilValg")?.addEventListener("change", fyllJournalBilVareValg);
  document.getElementById("journalBilValg")?.addEventListener("click", () => setTimeout(fyllJournalBilVareValg, 20));
  document.getElementById("leggTilJournalVarerFraBilListeKnapp")?.addEventListener("click", leggTilJournalVarerFraBilListe);
  document.getElementById("leggTilJournalVareFraBilKnapp")?.addEventListener("click", leggTilJournalVareFraBil);
  document.getElementById("journalBildeGalleri")?.addEventListener("change", oppdaterJournalBildeInfo);
  document.getElementById("journalBildeKamera")?.addEventListener("change", oppdaterJournalBildeInfo);
  ["journalFastpris","journalTimepris","journalTimer","journalBehandlingAntall","journalVareAntall","journalVarePris","journalBilVareAntall"].forEach(id => document.getElementById(id)?.addEventListener("input", oppdaterJournalSum));
  ["journalKm","journalKmPris"].forEach(id => document.getElementById(id)?.addEventListener("input", () => { tegnJournalKjoring(); oppdaterJournalSum(); }));
  vetSett("journalDato", new Date().toISOString().split("T")[0]);
  if (!vetTekst("journalKmPris")) vetSett("journalKmPris", "5.30");
  settStandardFakturaDatoer();
  fyllFakturaDyreeierValg();
  fyllKreditnotaFakturaValg();
  oppdaterAdminKlinikkSynlighet();
  tegnJournalBehandlingListe();
  tegnJournalKjoring();
  tegnJournalVareListe();
}

document.addEventListener("DOMContentLoaded", async () => {

  const { data: { session } } =
    await supabaseClient.auth.getSession();

  if (!session) {
    window.location.replace("../veterinaer-login.html");
    return;
  }

  await lastVetKlinikkTilgang();

  if (!vetErSystemAdmin && !vetAktivKlinikkId) {
    await supabaseClient.auth.signOut();
    window.location.replace("../veterinaer-login.html");
    return;
  }

  kobleVet();
  await lastVetData();
  oppdaterVetMenySynlighet();

  if (erVetVisningVanlig()) {
    visVetSide("journalSide");
  } else {
    visVetSide("okonomiSide");
  }
});

window.visVetSide = visVetSide;
window.redigerKlinikk = redigerKlinikk;
window.redigerDyreeier = redigerDyreeier;
window.redigerDyr = redigerDyr;
window.fyllDyreeierDyrValg = fyllDyreeierDyrValg;
window.brukValgtDyreeierForDyr = brukValgtDyreeierForDyr;

window.redigerPris = redigerPris;
window.redigerVetVare = redigerVetVare;
window.redigerVetBil = redigerVetBil;
window.fjernJournalBehandling = fjernJournalBehandling;
window.fjernJournalVare = fjernJournalVare;

window.vetLagBackup = vetLagBackup;
window.vetRestoreBackup = vetRestoreBackup;
window.vetImporterPriserCsv = vetImporterPriserCsv;
window.vetImporterVarerCsv = vetImporterVarerCsv;


window.opprettKlinikkBruker = opprettKlinikkBruker;
window.erVetAdmin = erVetAdmin;
window.skrivUtVetFaktura = skrivUtVetFaktura;
window.tegnFakturaGrunnlag = tegnFakturaGrunnlag;

window.byttVetRollevisning = byttVetRollevisning;
window.oppdaterVetMenySynlighet = oppdaterVetMenySynlighet;

window.leggTilNyttDyrForValgtDyreeier = leggTilNyttDyrForValgtDyreeier;
window.redigerValgtDyrForDyreeier = redigerValgtDyrForDyreeier;

window.fyllJournalDyreeierValg = fyllJournalDyreeierValg;
window.brukValgtJournalDyreeier = brukValgtJournalDyreeier;

window.nullstillDyrSkjemaBeholdEier = nullstillDyrSkjemaBeholdEier;
window.fyllDyrSideDyrForEier = fyllDyrSideDyrForEier;

window.toggleVetOppsettMeny = toggleVetOppsettMeny;
window.fyllMinBilMedFlereVarer = fyllMinBilMedFlereVarer;
window.fyllMinBilSide = fyllMinBilSide;

window.tegnAdminOkonomiOversikt = tegnAdminOkonomiOversikt;
window.tegnAdminMvaOversikt = tegnAdminMvaOversikt;
window.lagVetKreditnota = lagVetKreditnota;
window.fyllKreditnotaFakturaValg = fyllKreditnotaFakturaValg;

window.leggTilJournalKjoring = leggTilJournalKjoring;

window.nyDyreeier = nyDyreeier;
window.nyPasient = nyPasient;
window.toggleVetArbeidMeny = toggleVetArbeidMeny;
window.toggleVetAdminMeny = toggleVetAdminMeny;

/* ===== FINAL MENY/DYREEIER FIX ===== */
function vetSkjulGamleHurtigknapper() {
  const wrap = document.getElementById("vetPasientHurtigKnapper");
  if (wrap) {
    wrap.remove();
  }
}

function nyDyreeier() {
  ["dyreeierId","dyreeierNavn","dyreeierTelefon","dyreeierEpost","dyreeierAdresse"].forEach(id => vetSett(id, ""));
  vetSett("dyreeierVelgForDyr", "");
  fyllDyreeierDyrValg("");
  visVetSide("eierSide");
  const navn = document.getElementById("dyreeierNavn");
  if (navn) navn.focus();
}

function nyPasient() {
  ["dyrId","dyrNavn","dyrArt","dyrRase","dyrFodselsdato","dyrKjonn","dyrIdmerking"].forEach(id => vetSett(id, ""));
  fyllDyreeierValg();
  visVetSide("dyrSide");
  const navn = document.getElementById("dyrNavn");
  if (navn) navn.focus();
}

async function lagreDyreeier() {
  vetMelding("dyreeierMelding", "");

  const rad = leggTilKlinikkHvisVanligBruker({
    navn: vetTekst("dyreeierNavn"),
    telefon: vetTekst("dyreeierTelefon") || null,
    epost: vetTekst("dyreeierEpost") || null,
    adresse: vetTekst("dyreeierAdresse") || null
  });

  if (!rad.navn) {
    vetMelding("dyreeierMelding", "Skriv navn på dyreeier.");
    return;
  }

  const id = vetTekst("dyreeierId");
  const query = id
    ? supabaseClient.from("vet_dyreeiere").update(rad).eq("id", id).select("id").single()
    : supabaseClient.from("vet_dyreeiere").insert(rad).select("id").single();

  const { data, error } = await query;

  if (error) {
    vetMelding("dyreeierMelding", "Feil ved lagring av dyreeier: " + error.message);
    return;
  }

  const lagretId = data?.id || id;

  await lastDyreeiere();

  vetSett("dyreeierId", lagretId || "");
  fyllDyreeierVelgForDyr();
  vetSett("dyreeierVelgForDyr", lagretId || "");
  fyllDyreeierDyrValg(lagretId || "");

  const eier = (vetDyreeiere || []).find(e => String(e.id) === String(lagretId));
  if (eier) {
    vetSett("dyreeierNavn", eier.navn || "");
    vetSett("dyreeierTelefon", eier.telefon || "");
    vetSett("dyreeierEpost", eier.epost || "");
    vetSett("dyreeierAdresse", eier.adresse || "");
  }

  vetMelding("dyreeierMelding", "Dyreeier lagret.");
}

function toggleVetArbeidMeny() {
  vetSkjulGamleHurtigknapper();
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
  vetSkjulGamleHurtigknapper();
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

function oppdaterVetMenySynlighet() {
  oppdaterVetToppInfo();
  vetSkjulGamleHurtigknapper();

  const admin = erKlinikkAdmin();
  const adminKnapp = document.getElementById("vetAdminKnapp");

  if (adminKnapp) adminKnapp.style.display = admin ? "inline-block" : "none";

  ["vetArbeidMeny","vetAdminMeny"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("skjult");
      el.style.display = "none";
    }
  });
}

function vetKobleFinaleKnapper() {
  vetSkjulGamleHurtigknapper();

  const koble = (id, fn) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.finalKoblet === "1") return;
    el.dataset.finalKoblet = "1";
    el.addEventListener("click", fn);
  };

  koble("vetArbeidKnapp", toggleVetArbeidMeny);
  koble("vetAdminKnapp", toggleVetAdminMeny);

  koble("vetMenyDyreeiereKnapp", () => visVetSide("eierSide"));
  koble("vetMenyNyDyreeierKnapp", nyDyreeier);
  koble("vetMenyNyPasientKnapp", nyPasient);
  koble("vetMenyJournalKnapp", () => visVetSide("journalSide"));
  koble("vetMenyMinBilKnapp", () => visVetSide("lagerSide"));
  koble("vetMenyFakturaKnapp", () => visVetSide("fakturaSide"));

  koble("vetAdminKlinikkKnapp", () => visVetSide("klinikkSide"));
  koble("vetAdminPrislisteKnapp", () => visVetSide("prisSide"));
  koble("vetAdminOversiktKnapp", () => visVetSide("okonomiSide"));
  koble("vetAdminLagerKnapp", () => visVetSide("lagerSide"));
  koble("vetAdminBackupKnapp", () => visVetSide("backupSide"));

  koble("nyDyreeierFastKnapp", nyDyreeier);
  koble("nyPasientFastKnapp", nyPasient);
}

const gammelKobleVet = kobleVet;
kobleVet = function() {
  gammelKobleVet();
  vetKobleFinaleKnapper();
};

window.nyDyreeier = nyDyreeier;
window.nyPasient = nyPasient;
window.lagreDyreeier = lagreDyreeier;
window.toggleVetArbeidMeny = toggleVetArbeidMeny;
window.toggleVetAdminMeny = toggleVetAdminMeny;
/* ===== SLUTT FINAL FIX ===== */


/* ===== FINAL DYR/PASIENT FIX ===== */
function finnValgtDyreeierIdTilDyr() {
  return vetTekst("dyreeierId") ||
         vetTekst("dyreeierVelgForDyr") ||
         vetTekst("dyrEierValg") ||
         vetTekst("journalDyreeierValg") ||
         "";
}

function nyPasient() {
  const eierId = finnValgtDyreeierIdTilDyr();

  ["dyrId","dyrNavn","dyrArt","dyrRase","dyrFodselsdato","dyrKjonn","dyrIdmerking"].forEach(id => vetSett(id, ""));

  fyllDyreeierValg(eierId || "");
  if (eierId) vetSett("dyrEierValg", eierId);

  visVetSide("dyrSide");

  const navn = document.getElementById("dyrNavn");
  if (navn) navn.focus();
}

function leggTilNyttDyrForValgtDyreeier() {
  const eierId = finnValgtDyreeierIdTilDyr();

  if (!eierId) {
    vetMelding("dyreeierMelding", "Velg eller lagre dyreeier først.");
    visVetSide("eierSide");
    return;
  }

  ["dyrId","dyrNavn","dyrArt","dyrRase","dyrFodselsdato","dyrKjonn","dyrIdmerking"].forEach(id => vetSett(id, ""));

  fyllDyreeierValg(eierId);
  vetSett("dyrEierValg", eierId);

  visVetSide("dyrSide");

  const navn = document.getElementById("dyrNavn");
  if (navn) navn.focus();
}

async function lagreDyr() {
  vetMelding("dyrMelding", "");

  const rad = leggTilKlinikkHvisVanligBruker({
    dyreeier_id: vetTekst("dyrEierValg"),
    navn: vetTekst("dyrNavn"),
    art: vetTekst("dyrArt") || null,
    rase: vetTekst("dyrRase") || null,
    fodselsdato: vetTekst("dyrFodselsdato") || null,
    kjonn: vetTekst("dyrKjonn") || null,
    idmerking: vetTekst("dyrIdmerking") || null
  });

  if (!rad.dyreeier_id) {
    vetMelding("dyrMelding", "Velg dyreeier først.");
    return;
  }

  if (!rad.navn) {
    vetMelding("dyrMelding", "Skriv navn på dyr/pasient.");
    return;
  }

  const id = vetTekst("dyrId");
  const query = id
    ? supabaseClient.from("vet_dyr").update(rad).eq("id", id).select("id").single()
    : supabaseClient.from("vet_dyr").insert(rad).select("id").single();

  const { data, error } = await query;

  if (error) {
    vetMelding("dyrMelding", "Feil ved lagring av dyr: " + error.message);
    return;
  }

  const lagretDyrId = data?.id || id;

  await lastDyr();

  vetMelding("dyrMelding", "Dyr/pasient lagret.");
  vetSett("dyrId", lagretDyrId || "");
  vetSett("dyrEierValg", rad.dyreeier_id);

  // Oppdater dyreeier-siden og journalvalg også
  vetSett("dyreeierId", rad.dyreeier_id);
  vetSett("dyreeierVelgForDyr", rad.dyreeier_id);
  fyllDyreeierDyrValg(rad.dyreeier_id);

  fyllDyrValg();
  fyllJournalDyreeierValg();
}

(function kobleDyrFix() {
  const koble = (id, fn) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.dyrFixKoblet === "1") return;
    el.dataset.dyrFixKoblet = "1";
    el.addEventListener("click", fn);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kobleDyrFix, { once: true });
    return;
  }

  koble("vetMenyNyPasientKnapp", nyPasient);
  koble("nyPasientFastKnapp", nyPasient);
  koble("nyttDyrForEierFastKnapp", leggTilNyttDyrForValgtDyreeier);
  koble("lagreDyrKnapp", lagreDyr);
})();

window.nyPasient = nyPasient;
window.leggTilNyttDyrForValgtDyreeier = leggTilNyttDyrForValgtDyreeier;
window.lagreDyr = lagreDyr;
/* ===== SLUTT FINAL DYR/PASIENT FIX ===== */


/* ===== LEGG TIL DYR FIX ===== */
function vetFinnValgtDyreeierForDyr() {
  const kandidater = [
    vetTekst("dyreeierId"),
    vetTekst("dyreeierVelgForDyr"),
    vetTekst("dyrEierValg"),
    vetTekst("journalDyreeierValg")
  ].filter(Boolean);

  if (kandidater.length) return kandidater[0];

  const valgt = document.getElementById("dyreeierVelgForDyr");
  if (valgt && valgt.value) return valgt.value;

  return "";
}

function vetAapneNyttDyrForEier() {
  const eierId = vetFinnValgtDyreeierForDyr();

  if (!eierId) {
    vetMelding("dyreeierMelding", "Velg eller lagre dyreeier først.");
    visVetSide("eierSide");
    return;
  }

  // Gå til pasientskjema og nullstill bare dyrefeltene.
  visVetSide("dyrSide");

  vetSett("dyrId", "");
  vetSett("dyrNavn", "");
  vetSett("dyrArt", "");
  vetSett("dyrRase", "");
  vetSett("dyrFodselsdato", "");
  vetSett("dyrKjonn", "");
  vetSett("dyrIdmerking", "");

  fyllDyreeierValg(eierId);
  vetSett("dyrEierValg", eierId);

  const navn = document.getElementById("dyrNavn");
  if (navn) navn.focus();
}

function nyPasient() {
  vetAapneNyttDyrForEier();
}

function vetKobleLeggTilDyrKnapp() {
  const ids = [
    "nyttDyrForEierFastKnapp",
    "nyttDyrForEierKnapp",
    "vetMenyNyPasientKnapp",
    "nyPasientFastKnapp"
  ];

  ids.forEach(id => {
    const knapp = document.getElementById(id);
    if (!knapp || knapp.dataset.leggTilDyrFix === "1") return;

    knapp.dataset.leggTilDyrFix = "1";
    knapp.onclick = function(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      vetAapneNyttDyrForEier();
      return false;
    };
  });
}

// Koble etter at appen har startet og hver gang menyen/siden kan ha blitt tegnet.
const gammelVisVetSideForDyrFix = typeof visVetSide === "function" ? visVetSide : null;
if (gammelVisVetSideForDyrFix) {
  visVetSide = function(sideId) {
    const r = gammelVisVetSideForDyrFix(sideId);
    setTimeout(vetKobleLeggTilDyrKnapp, 0);
    return r;
  };
}

const gammelKobleVetForDyrFix = typeof kobleVet === "function" ? kobleVet : null;
if (gammelKobleVetForDyrFix) {
  kobleVet = function() {
    const r = gammelKobleVetForDyrFix();
    vetKobleLeggTilDyrKnapp();
    setTimeout(vetKobleLeggTilDyrKnapp, 100);
    return r;
  };
}

window.nyPasient = nyPasient;
window.leggTilNyttDyrForValgtDyreeier = vetAapneNyttDyrForEier;
window.vetAapneNyttDyrForEier = vetAapneNyttDyrForEier;
/* ===== SLUTT LEGG TIL DYR FIX ===== */


/* ===== EN LINJE LISTE FIX ===== */
function vetEsc(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tegnDyreeiere() {
  const el = document.getElementById("dyreeierListe");
  if (!el) return;

  if (!vetDyreeiere || vetDyreeiere.length === 0) {
    el.innerHTML = '<p class="lite">Ingen dyreeiere registrert.</p>';
    return;
  }

  el.innerHTML = '<div class="vet-linje-liste">' + vetDyreeiere.map(e => {
    const id = vetEsc(e.id);
    const navn = vetEsc(e.navn || "Uten navn");
    const telefon = vetEsc(e.telefon || "");
    const epost = vetEsc(e.epost || "");
    return `
      <div class="vet-linje-kort">
        <strong title="${navn}">${navn}</strong>
        <span class="vet-skjul-mobil">${telefon || "&nbsp;"}</span>
        <span class="vet-skjul-mobil">${epost || "&nbsp;"}</span>
        <button type="button" class="secondary" onclick="redigerDyreeier('${id}')">Åpne</button>
      </div>
    `;
  }).join("") + '</div>';
}

function tegnDyr() {
  const el = document.getElementById("dyrListe");
  if (!el) return;

  if (!vetDyr || vetDyr.length === 0) {
    el.innerHTML = '<p class="lite">Ingen dyr/pasienter registrert.</p>';
    return;
  }

  el.innerHTML = '<div class="vet-linje-liste">' + vetDyr.map(d => {
    const id = vetEsc(d.id);
    const navn = vetEsc(d.navn || "Uten navn");
    const art = vetEsc(d.art || "");
    const rase = vetEsc(d.rase || "");
    const eier = (vetDyreeiere || []).find(e => String(e.id) === String(d.dyreeier_id));
    const eierNavn = vetEsc(eier?.navn || "");
    return `
      <div class="vet-linje-kort">
        <strong title="${navn}">${navn}</strong>
        <span class="vet-skjul-mobil">${art || "&nbsp;"}${rase ? " / " + rase : ""}</span>
        <span class="vet-skjul-mobil">${eierNavn || "&nbsp;"}</span>
        <button type="button" class="secondary" onclick="redigerDyr('${id}')">Åpne</button>
      </div>
    `;
  }).join("") + '</div>';
}

window.tegnDyreeiere = tegnDyreeiere;
window.tegnDyr = tegnDyr;
/* ===== SLUTT EN LINJE LISTE FIX ===== */

/* ===== KOMPAKT LINJEVISNING 07.06 - KUN LISTER ===== */
function vetLinjeEsc(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function vetLinjeWrap(inner) {
  return `<div style="display:grid;gap:1px;margin-top:8px;font-size:14px;font-weight:400;">${inner}</div>`;
}

function vetLinjeKnapp(onClick, cols, inner, title = "Klikk for detaljer/redigering") {
  return `
    <button
      type="button"
      onclick="${onClick}"
      title="${vetLinjeEsc(title)}"
      style="
        width:100%;
        display:grid;
        grid-template-columns:${cols};
        gap:10px;
        align-items:center;
        text-align:left;
        padding:4px 8px;
        border:1px solid rgba(255,255,255,.08);
        border-radius:0;
        background:rgba(255,255,255,.02);
        color:inherit;
        cursor:pointer;
        font-family:inherit;
        font-size:14px !important;
        font-weight:400 !important;
        line-height:1.15;
        margin:0;
      "
    >${inner}</button>`;
}

function vetLinjeSpan(verdi) {
  return `<span class="lite" style="font-size:14px !important;font-weight:400 !important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${verdi || "&nbsp;"}</span>`;
}

function tegnVetBiler() {
  const liste = document.getElementById("vetBilListe");
  if (!liste) return;

  if (!vetBiler || !vetBiler.length) {
    liste.innerHTML = '<p class="lite">Ingen biler registrert.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(vetBiler.map(b => {
    const id = vetLinjeEsc(b.id);
    const navn = vetLinjeEsc(b.navn || "Uten navn");
    const regnr = vetLinjeEsc(b.regnr || "");
    const vet = vetLinjeEsc(b.veterinaer_navn || "");
    return vetLinjeKnapp(
      `redigerVetBil('${id}')`,
      "minmax(180px,1.5fr) minmax(110px,.8fr) minmax(180px,1.3fr)",
      `${vetLinjeSpan(navn)}${vetLinjeSpan(regnr)}${vetLinjeSpan(vet)}`
    );
  }).join(""));
}

function tegnDyreeiere() {
  const liste = document.getElementById("dyreeierListe");
  if (!liste) return;

  if (!vetDyreeiere || !vetDyreeiere.length) {
    liste.innerHTML = '<p class="lite">Ingen dyreeiere registrert ennå.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(vetDyreeiere.map(e => {
    const id = vetLinjeEsc(e.id);
    const navn = vetLinjeEsc(e.navn || "Uten navn");
    const telefon = vetLinjeEsc(e.telefon || "");
    const epost = vetLinjeEsc(e.epost || "");
    return vetLinjeKnapp(
      `redigerDyreeier('${id}')`,
      "minmax(180px,1.4fr) minmax(120px,.8fr) minmax(200px,1.4fr)",
      `${vetLinjeSpan(navn)}${vetLinjeSpan(telefon)}${vetLinjeSpan(epost)}`
    );
  }).join(""));
}

function tegnDyr() {
  const liste = document.getElementById("dyrListe");
  if (!liste) return;

  if (!vetDyr || !vetDyr.length) {
    liste.innerHTML = '<p class="lite">Ingen dyr registrert ennå.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(vetDyr.map(d => {
    const id = vetLinjeEsc(d.id);
    const navn = vetLinjeEsc(d.navn || "Uten navn");
    const artRase = vetLinjeEsc([d.art, d.rase].filter(Boolean).join(" / "));
    const eierNavn = vetLinjeEsc(d.vet_dyreeiere?.navn || (vetDyreeiere || []).find(e => String(e.id) === String(d.dyreeier_id))?.navn || "");
    const idmerking = vetLinjeEsc(d.idmerking || "");
    return vetLinjeKnapp(
      `redigerDyr('${id}')`,
      "minmax(160px,1.3fr) minmax(160px,1.2fr) minmax(180px,1.3fr) minmax(120px,.8fr)",
      `${vetLinjeSpan(navn)}${vetLinjeSpan(artRase)}${vetLinjeSpan(eierNavn)}${vetLinjeSpan(idmerking)}`
    );
  }).join(""));
}

function tegnHovedlager() {
  const liste = document.getElementById("hovedlagerListe");
  if (!liste) return;

  if (!vetHovedlager || !vetHovedlager.length) {
    liste.innerHTML = '<p class="lite">Hovedlager er tomt.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(vetHovedlager.map(r => {
    const v = r.vet_varer || {};
    const navn = vetLinjeEsc(v.navn || vareNavn(r.vare_id));
    const antall = `${formaterKr(r.antall)} ${vetLinjeEsc(v.enhet || "stk")}`;
    const lavt = Number(v.minimum_antall || 0) > 0 && Number(r.antall || 0) <= Number(v.minimum_antall || 0);
    const varsel = lavt ? "⚠ lav beholdning" : "";
    return vetLinjeKnapp(
      `redigerVetVare('${vetLinjeEsc(r.vare_id || v.id || "")}')`,
      "minmax(220px,2fr) minmax(120px,.9fr) minmax(150px,1fr)",
      `${vetLinjeSpan(navn)}${vetLinjeSpan(antall)}${vetLinjeSpan(varsel)}`
    );
  }).join(""));
}

function tegnBilLager() {
  const liste = document.getElementById("billagerListe");
  if (!liste) return;

  if (!vetBilLager || !vetBilLager.length) {
    liste.innerHTML = '<p class="lite">Ingen varer i biler.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(vetBilLager.map(r => {
    const v = r.vet_varer || {};
    const bil = vetLinjeEsc(r.vet_biler ? [r.vet_biler.navn, r.vet_biler.regnr].filter(Boolean).join(" - ") : bilNavn(r.bil_id));
    const vare = vetLinjeEsc(v.navn || vareNavn(r.vare_id));
    const antall = `${formaterKr(r.antall)} ${vetLinjeEsc(v.enhet || "stk")}`;
    return vetLinjeKnapp(
      `redigerVetBil('${vetLinjeEsc(r.bil_id || "")}')`,
      "minmax(180px,1.4fr) minmax(220px,1.6fr) minmax(120px,.8fr)",
      `${vetLinjeSpan(bil)}${vetLinjeSpan(vare)}${vetLinjeSpan(antall)}`,
      "Klikk for bil-detaljer"
    );
  }).join(""));
}

function tegnMinBilInnhold() {
  const liste = document.getElementById("minBilInnholdListe");
  if (!liste) return;

  const bilId = valgtMinBilId();
  if (!bilId) {
    liste.innerHTML = '<p class="lite">Ingen bil valgt.</p>';
    return;
  }

  const rader = vetBilLager.filter(r => String(r.bil_id) === String(bilId) && Number(r.antall || 0) > 0);
  if (!rader.length) {
    liste.innerHTML = '<p class="lite">Bilen er tom.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(rader.map(r => {
    const v = r.vet_varer || vetVarer.find(x => String(x.id) === String(r.vare_id)) || {};
    const navn = vetLinjeEsc(v.navn || vareNavn(r.vare_id));
    const antall = `${formaterKr(r.antall)} ${vetLinjeEsc(v.enhet || "stk")}`;
    return vetLinjeKnapp(
      `fyllJournalBilVareValg()`,
      "minmax(220px,2fr) minmax(120px,.8fr)",
      `${vetLinjeSpan(navn)}${vetLinjeSpan(antall)}`,
      "Vare i bilen"
    );
  }).join(""));
}

window.tegnVetBiler = tegnVetBiler;
window.tegnDyreeiere = tegnDyreeiere;
window.tegnDyr = tegnDyr;
window.tegnHovedlager = tegnHovedlager;
window.tegnBilLager = tegnBilLager;
window.tegnMinBilInnhold = tegnMinBilInnhold;
/* ===== SLUTT KOMPAKT LINJEVISNING 07.06 ===== */

/* ===== DYREBILDE / PROFILBILDE 07.06 ===== */
function vetDyrBildeEsc(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function vetSettDyrBildePreview(url) {
  const img = document.getElementById("dyrBildePreview");
  if (!img) return;

  if (url) {
    img.src = url;
    img.style.display = "block";
    img.classList.remove("skjult");
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
    img.classList.add("skjult");
  }
}

function vetNullstillDyrBildeInput() {
  const fil = document.getElementById("dyrBildeFil");
  if (fil) fil.value = "";
  vetSettDyrBildePreview("");
}

function vetInitDyrBildeUI() {
  const dyrSide = document.getElementById("dyrSide");
  if (!dyrSide || document.getElementById("dyrBildeOmrade")) return;

  const lagreKnapp = document.getElementById("lagreDyrKnapp");
  const omrade = document.createElement("div");
  omrade.id = "dyrBildeOmrade";
  omrade.innerHTML = `
    <h3 style="margin-top:14px;margin-bottom:6px;">Bilde av dyret</h3>
    <div class="rad" style="align-items:end;">
      <div>
        <label for="dyrBildeFil">Velg bilde / ta bilde</label>
        <input id="dyrBildeFil" type="file" accept="image/*" capture="environment">
        <button id="taBildeDyrKnapp" type="button" class="secondary" style="margin-top:8px;">Ta bilde</button>
      </div>
      <div>
        <img id="dyrBildePreview" alt="Bilde av dyr" class="skjult" style="display:none;width:90px;height:70px;object-fit:cover;border:1px solid #ddd;border-radius:8px;background:#fafafa;">
      </div>
    </div>
    <p class="lite" style="margin-top:4px;">Bildet lagres på dyret/pasienten og vises i pasientlisten.</p>
  `;

  if (lagreKnapp && lagreKnapp.parentNode) {
    lagreKnapp.parentNode.insertBefore(omrade, lagreKnapp);
  } else {
    dyrSide.appendChild(omrade);
  }

  const fil = document.getElementById("dyrBildeFil");
  if (fil && !fil.dataset.previewKoblet) {
    fil.dataset.previewKoblet = "1";
    fil.addEventListener("change", () => {
      const valgt = fil.files && fil.files[0];
      if (!valgt) {
        const dyr = (vetDyr || []).find(d => String(d.id) === String(vetTekst("dyrId")));
        vetSettDyrBildePreview(dyr?.bilde_url || "");
        return;
      }
      const reader = new FileReader();
      reader.onload = e => vetSettDyrBildePreview(e.target.result);
      reader.readAsDataURL(valgt);
    });
  }

  const taBilde = document.getElementById("taBildeDyrKnapp");
  if (taBilde && fil && !taBilde.dataset.koblet) {
    taBilde.dataset.koblet = "1";
    taBilde.addEventListener("click", (e) => {
      e.preventDefault();
      fil.click();
    });
  }
}

async function vetLastOppDyrBilde(dyrId) {
  const fil = document.getElementById("dyrBildeFil")?.files?.[0];
  if (!dyrId || !fil) return null;

  const ext = String((fil.name || "dyr.jpg").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const filnavn = vetTryggFilnavn(fil.name || `dyr.${ext}`);
  const sti = `dyr/${dyrId}/${Date.now()}_${filnavn}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(VET_BILDE_BUCKET)
    .upload(sti, fil, {
      cacheControl: "3600",
      upsert: false,
      contentType: fil.type || "image/jpeg"
    });

  if (uploadError) {
    vetMelding("dyrMelding", "Dyr lagret, men bilde kunne ikke lastes opp: " + uploadError.message);
    return null;
  }

  const { data } = supabaseClient.storage
    .from(VET_BILDE_BUCKET)
    .getPublicUrl(sti);

  const url = data?.publicUrl || null;
  if (!url) return null;

  const { error: updateError } = await supabaseClient
    .from("vet_dyr")
    .update({ bilde_url: url })
    .eq("id", dyrId);

  if (updateError) {
    vetMelding("dyrMelding", "Dyr lagret, men bilde-url kunne ikke lagres: " + updateError.message);
    return null;
  }

  return url;
}

const vetGammelVisVetSideDyrBilde = typeof visVetSide === "function" ? visVetSide : null;
if (vetGammelVisVetSideDyrBilde) {
  visVetSide = function(id) {
    const r = vetGammelVisVetSideDyrBilde(id);
    if (id === "dyrSide") setTimeout(vetInitDyrBildeUI, 0);
    return r;
  };
}

const vetGammelRedigerDyrDyrBilde = typeof redigerDyr === "function" ? redigerDyr : null;
function redigerDyr(id) {
  if (vetGammelRedigerDyrDyrBilde) vetGammelRedigerDyrDyrBilde(id);
  vetInitDyrBildeUI();
  const d = (vetDyr || []).find(x => String(x.id) === String(id));
  vetSettDyrBildePreview(d?.bilde_url || "");
  const fil = document.getElementById("dyrBildeFil");
  if (fil) fil.value = "";
}

const vetGammelNyPasientDyrBilde = typeof nyPasient === "function" ? nyPasient : null;
function nyPasient() {
  if (vetGammelNyPasientDyrBilde) vetGammelNyPasientDyrBilde();
  vetInitDyrBildeUI();
  vetNullstillDyrBildeInput();
}

async function lagreDyr() {
  vetMelding("dyrMelding", "");
  vetInitDyrBildeUI();

  const rad = leggTilKlinikkHvisVanligBruker({
    dyreeier_id: vetTekst("dyrEierValg") || null,
    navn: vetTekst("dyrNavn"),
    art: vetTekst("dyrArt") || null,
    rase: vetTekst("dyrRase") || null,
    fodselsdato: vetTekst("dyrFodselsdato") || null,
    kjonn: vetTekst("dyrKjonn") || null,
    idmerking: vetTekst("dyrIdmerking") || null
  });

  if (!rad.dyreeier_id) {
    vetMelding("dyrMelding", "Velg dyreeier først.");
    return;
  }

  if (!rad.navn) {
    vetMelding("dyrMelding", "Skriv navn på dyr/pasient.");
    return;
  }

  const id = vetTekst("dyrId");
  const query = id
    ? supabaseClient.from("vet_dyr").update(rad).eq("id", id).select("id").single()
    : supabaseClient.from("vet_dyr").insert(rad).select("id").single();

  const { data, error } = await query;

  if (error) {
    vetMelding("dyrMelding", "Feil ved lagring av dyr: " + error.message);
    return;
  }

  const lagretDyrId = data?.id || id;
  const bildeUrl = await vetLastOppDyrBilde(lagretDyrId);

  await lastDyr();

  vetMelding("dyrMelding", bildeUrl ? "Dyr/pasient og bilde lagret." : "Dyr/pasient lagret.");
  vetSett("dyrId", lagretDyrId || "");
  vetSett("dyrEierValg", rad.dyreeier_id);
  if (bildeUrl) vetSettDyrBildePreview(bildeUrl);
  else {
    const dyr = (vetDyr || []).find(d => String(d.id) === String(lagretDyrId));
    vetSettDyrBildePreview(dyr?.bilde_url || "");
  }
  const fil = document.getElementById("dyrBildeFil");
  if (fil) fil.value = "";

  vetSett("dyreeierId", rad.dyreeier_id);
  vetSett("dyreeierVelgForDyr", rad.dyreeier_id);
  fyllDyreeierDyrValg(rad.dyreeier_id, lagretDyrId || "");
  fyllDyrValg();
  fyllJournalDyreeierValg();

  // Etter lagring skal brukeren tilbake til eierkortet med oppdatert dyreliste.
  if (typeof window.vetStackSafeOpenEier === "function") {
    window.vetStackSafeOpenEier(rad.dyreeier_id);
  } else {
    visVetSide("eierSide");
    vetSett("dyreeierId", rad.dyreeier_id);
    vetSett("dyreeierVelgForDyr", rad.dyreeier_id);
    fyllDyreeierDyrValg(rad.dyreeier_id, lagretDyrId || "");
  }
  vetMelding("dyreeierMelding", bildeUrl ? "Dyr/pasient og bilde lagret." : "Dyr/pasient lagret.");
}

function tegnDyr() {
  const liste = document.getElementById("dyrListe");
  if (!liste) return;

  if (!vetDyr || !vetDyr.length) {
    liste.innerHTML = '<p class="lite">Ingen dyr registrert ennå.</p>';
    return;
  }

  liste.innerHTML = vetLinjeWrap(vetDyr.map(d => {
    const id = vetLinjeEsc(d.id);
    const navn = vetLinjeEsc(d.navn || "Uten navn");
    const artRase = vetLinjeEsc([d.art, d.rase].filter(Boolean).join(" / "));
    const eierNavn = vetLinjeEsc(d.vet_dyreeiere?.navn || (vetDyreeiere || []).find(e => String(e.id) === String(d.dyreeier_id))?.navn || "");
    const idmerking = vetLinjeEsc(d.idmerking || "");
    const bilde = d.bilde_url
      ? `<img src="${vetLinjeEsc(d.bilde_url)}" alt="${navn}" style="width:34px;height:28px;object-fit:cover;border-radius:4px;border:1px solid #ddd;">`
      : `<span class="lite" style="font-size:12px !important;font-weight:400 !important;line-height:1;">📷</span>`;
    return vetLinjeKnapp(
      `redigerDyr('${id}')`,
      "42px minmax(140px,1.3fr) minmax(150px,1.2fr) minmax(160px,1.3fr) minmax(110px,.8fr)",
      `${bilde}${vetLinjeSpan(navn)}${vetLinjeSpan(artRase)}${vetLinjeSpan(eierNavn)}${vetLinjeSpan(idmerking)}`
    );
  }).join(""));
}

(function vetKobleDyrBilde() {
  const start = () => {
    vetInitDyrBildeUI();
    const lagre = document.getElementById("lagreDyrKnapp");
    if (lagre) lagre.onclick = lagreDyr;
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();

window.redigerDyr = redigerDyr;
window.nyPasient = nyPasient;
window.lagreDyr = lagreDyr;
window.tegnDyr = tegnDyr;
/* ===== SLUTT DYREBILDE / PROFILBILDE 07.06 ===== */


/* ===== KLIKKBAR DYREEIERLISTE + DYRELISTE UNDER EIER 07.06 FINAL ===== */
function vetKlikkEsc(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function vetSørgForDyreListeUnderEier() {
  const gammelSelect = document.getElementById("dyreeierDyrValg");
  if (gammelSelect && gammelSelect.tagName === "SELECT") {
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.id = "dyreeierDyrValg";
    gammelSelect.parentNode.replaceChild(hidden, gammelSelect);
  }

  let liste = document.getElementById("dyreeierDyrListe");
  if (!liste) {
    liste = document.createElement("div");
    liste.id = "dyreeierDyrListe";
    const info = document.getElementById("dyreeierDyrInfo");
    const hidden = document.getElementById("dyreeierDyrValg");
    if (hidden && hidden.parentNode) hidden.parentNode.insertBefore(liste, hidden.nextSibling);
    else if (info && info.parentNode) info.parentNode.insertBefore(liste, info);
  }
  return liste;
}

function vetMiniDyrBilde(dyr) {
  if (dyr && dyr.bilde_url) {
    return `<img src="${vetKlikkEsc(dyr.bilde_url)}" alt="${vetKlikkEsc(dyr.navn || "Dyr")}" class="vet-dyr-mini-bilde">`;
  }
  return `<span style="font-size:13px !important;font-weight:400 !important;line-height:1.1;">📷</span>`;
}

function tegnDyreeiere() {
  const liste = document.getElementById("dyreeierListe");
  if (!liste) return;

  if (!vetDyreeiere || !vetDyreeiere.length) {
    liste.innerHTML = '<p class="lite">Ingen dyreeiere registrert ennå.</p>';
    return;
  }

  liste.innerHTML = `
    <div class="vet-klikk-liste">
      ${vetDyreeiere.map(e => {
        const id = vetKlikkEsc(e.id);
        const navn = vetKlikkEsc(e.navn || "Uten navn");
        const telefon = vetKlikkEsc(e.telefon || "");
        const epost = vetKlikkEsc(e.epost || "");
        return `
          <button type="button"
            class="vet-klikk-rad"
            onclick="redigerDyreeier('${id}')"
            title="Klikk for detaljer og dyreliste"
            style="grid-template-columns:minmax(170px,1.4fr) minmax(100px,.8fr) minmax(190px,1.4fr) 70px;">
            <span>${navn}</span>
            <span>${telefon}</span>
            <span>${epost}</span>
            <span>Åpne</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function redigerDyreeier(id) {
  const e = (vetDyreeiere || []).find(x => String(x.id) === String(id));
  if (!e) return;

  vetSett("dyreeierId", e.id);
  vetSett("dyreeierVelgForDyr", e.id);
  vetSett("dyreeierNavn", e.navn || "");
  vetSett("dyreeierTelefon", e.telefon || "");
  vetSett("dyreeierEpost", e.epost || "");
  vetSett("dyreeierAdresse", e.adresse || "");

  visVetSide("eierSide");
  setTimeout(() => fyllDyreeierDyrValg(e.id), 0);
}

function fyllDyreeierDyrValg(dyreeierId = "", valgtDyrId = "") {
  const liste = vetSørgForDyreListeUnderEier();
  const info = document.getElementById("dyreeierDyrInfo");
  const hidden = document.getElementById("dyreeierDyrValg");
  if (hidden) hidden.value = valgtDyrId || "";
  if (!liste) return;

  if (!dyreeierId) {
    liste.innerHTML = '<p class="lite">Velg eller klikk en dyreeier først.</p>';
    if (info) info.textContent = "";
    return;
  }

  const dyrHosEier = (vetDyr || [])
    .filter(d => String(d.dyreeier_id || d.eier_id || "") === String(dyreeierId))
    .sort((a, b) => String(a.navn || "").localeCompare(String(b.navn || ""), "nb"));

  if (!dyrHosEier.length) {
    liste.innerHTML = '<p class="lite">Ingen dyr registrert på denne dyreeieren ennå.</p>';
    if (info) info.textContent = "Ingen dyr funnet på valgt dyreeier.";
    return;
  }

  liste.innerHTML = `
    <div class="vet-klikk-liste">
      ${dyrHosEier.map(d => {
        const id = vetKlikkEsc(d.id);
        const valgt = valgtDyrId && String(valgtDyrId) === String(d.id);
        const navn = vetKlikkEsc(d.navn || "Uten navn");
        const artRase = vetKlikkEsc([d.art, d.rase].filter(Boolean).join(" / "));
        const idmerking = vetKlikkEsc(d.idmerking || "");
        return `
          <button type="button"
            class="vet-klikk-rad"
            onclick="vetVelgDyrFraEierListe('${id}')"
            title="Klikk for detaljer på dyret"
            style="grid-template-columns:42px minmax(140px,1.3fr) minmax(150px,1.2fr) minmax(110px,.8fr) 70px;${valgt ? 'outline:1px solid #1f6feb;' : ''}">
            ${vetMiniDyrBilde(d)}
            <span>${navn}</span>
            <span>${artRase}</span>
            <span>${idmerking}</span>
            <span>Åpne</span>
          </button>
        `;
      }).join("")}
    </div>
  `;

  if (info) info.textContent = `${dyrHosEier.length} dyr registrert på valgt dyreeier.`;
}

function vetVelgDyrFraEierListe(dyrId) {
  const hidden = document.getElementById("dyreeierDyrValg");
  if (hidden) hidden.value = dyrId || "";
  if (dyrId) redigerDyr(dyrId);
}

function brukValgtDyreeierForDyr() {
  const dyreeierId = vetTekst("dyreeierVelgForDyr");
  if (!dyreeierId) {
    ["dyreeierId", "dyreeierNavn", "dyreeierTelefon", "dyreeierEpost", "dyreeierAdresse"].forEach(id => vetSett(id, ""));
    fyllDyreeierDyrValg("");
    return;
  }
  redigerDyreeier(dyreeierId);
}

function brukValgtDyrFraDyreeier() {
  const dyrId = vetTekst("dyreeierDyrValg");
  if (dyrId) redigerDyr(dyrId);
}

(function vetStartKlikkbarDyreeierDyreliste() {
  const start = () => {
    vetSørgForDyreListeUnderEier();
    const velg = document.getElementById("dyreeierVelgForDyr");
    if (velg) velg.onchange = brukValgtDyreeierForDyr;
    tegnDyreeiere();
    fyllDyreeierDyrValg(vetTekst("dyreeierId"));
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();

window.tegnDyreeiere = tegnDyreeiere;
window.redigerDyreeier = redigerDyreeier;
window.fyllDyreeierDyrValg = fyllDyreeierDyrValg;
window.vetVelgDyrFraEierListe = vetVelgDyrFraEierListe;
window.brukValgtDyreeierForDyr = brukValgtDyreeierForDyr;
window.brukValgtDyrFraDyreeier = brukValgtDyrFraDyreeier;
/* ===== SLUTT KLIKKBAR DYREEIERLISTE + DYRELISTE UNDER EIER ===== */

/* ===== ENDELIG FIX: DYREEIER/DYR-KLIKK + BILDE 07.06 ===== */
(function(){
  function esc(v){
    return String(v ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  function safeCall(fn, arg){
    try {
      if (typeof window[fn] === "function") return window[fn](arg);
      if (typeof globalThis[fn] === "function") return globalThis[fn](arg);
    } catch(e) {
      console.error(fn + " feilet:", e);
      alert("Knappen feilet: " + (e && e.message ? e.message : e));
    }
  }

  function sørgForDyrBildeUI(){
    if (typeof vetInitDyrBildeUI === "function") vetInitDyrBildeUI();
    const dyrSide = document.getElementById("dyrSide");
    const lagre = document.getElementById("lagreDyrKnapp");
    if (dyrSide && lagre && !document.getElementById("dyrBildeOmrade")) {
      const div = document.createElement("div");
      div.id = "dyrBildeOmrade";
      div.innerHTML = `
        <h3 style="margin-top:14px;margin-bottom:6px;">Bilde av dyret</h3>
        <div class="rad">
          <div>
            <label for="dyrBildeFil">Velg bilde</label>
            <input id="dyrBildeFil" type="file" accept="image/*" capture="environment">
          </div>
          <div>
            <img id="dyrBildePreview" alt="Bilde av dyr" class="skjult" style="display:none;width:90px;height:70px;object-fit:cover;border:1px solid #ddd;border-radius:8px;background:#fafafa;">
          </div>
        </div>
        <p class="lite" style="margin-top:4px;">Velg bilde og trykk Lagre dyr / bilde.</p>
      `;
      lagre.parentNode.insertBefore(div, lagre);
    }
  }

  window.vetFIXAapneEier = function(id){
    if (!id) return false;
    safeCall("redigerDyreeier", id);
    return false;
  };

  window.vetFIXAapneDyr = function(id){
    if (!id) return false;
    safeCall("redigerDyr", id);
    setTimeout(() => {
      sørgForDyrBildeUI();
      const side = document.getElementById("dyrSide");
      if (side) side.scrollIntoView({behavior:"smooth", block:"start"});
    }, 20);
    return false;
  };

  window.vetFIXBildeDyr = function(id){
    if (!id) return false;
    window.vetFIXAapneDyr(id);
    setTimeout(() => {
      sørgForDyrBildeUI();
      const fil = document.getElementById("dyrBildeFil");
      const omr = document.getElementById("dyrBildeOmrade");
      if (omr) omr.scrollIntoView({behavior:"smooth", block:"center"});
      if (fil) {
        try { fil.focus(); fil.click(); } catch(e) { console.warn(e); }
      }
    }, 80);
    return false;
  };

  function miniBilde(d){
    if (d && d.bilde_url) return `<img src="${esc(d.bilde_url)}" alt="${esc(d.navn || 'Dyr')}" class="vet-dyr-mini-bilde">`;
    return `<span style="font-size:13px;font-weight:400;line-height:1.1;">📷</span>`;
  }

  window.tegnDyreeiere = function(){
    const liste = document.getElementById("dyreeierListe");
    if (!liste) return;
    if (!vetDyreeiere || !vetDyreeiere.length) {
      liste.innerHTML = '<p class="lite">Ingen dyreeiere registrert ennå.</p>';
      return;
    }
    liste.innerHTML = `<div class="vet-klikk-liste">${vetDyreeiere.map(e => {
      const id = esc(e.id);
      return `
        <div class="vet-klikk-rad" onclick="return window.vetFIXAapneEier('${id}')" style="grid-template-columns:minmax(170px,1.4fr) minmax(100px,.8fr) minmax(190px,1.4fr) 90px;">
          <span>${esc(e.navn || "Uten navn")}</span>
          <span>${esc(e.telefon || "")}</span>
          <span>${esc(e.epost || "")}</span>
          <a href="#" onclick="event.preventDefault(); event.stopPropagation(); return window.vetFIXAapneEier('${id}')" class="secondary" style="display:inline-block;text-align:center;text-decoration:none;color:white;background:#555;border-radius:8px;padding:5px 10px;font-size:13px;">Åpne</a>
        </div>`;
    }).join("")}</div>`;
  };

  window.fyllDyreeierDyrValg = function(dyreeierId = "", valgtDyrId = ""){
    const gammelSelect = document.getElementById("dyreeierDyrValg");
    if (gammelSelect && gammelSelect.tagName === "SELECT") {
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.id = "dyreeierDyrValg";
      gammelSelect.parentNode.replaceChild(hidden, gammelSelect);
    }
    let liste = document.getElementById("dyreeierDyrListe");
    if (!liste) {
      liste = document.createElement("div");
      liste.id = "dyreeierDyrListe";
      const info = document.getElementById("dyreeierDyrInfo");
      if (info && info.parentNode) info.parentNode.insertBefore(liste, info);
    }
    const info = document.getElementById("dyreeierDyrInfo");
    const hidden = document.getElementById("dyreeierDyrValg");
    if (hidden) hidden.value = valgtDyrId || "";
    if (!liste) return;
    if (!dyreeierId) {
      liste.innerHTML = '<p class="lite">Velg eller klikk en dyreeier først.</p>';
      if (info) info.textContent = "";
      return;
    }
    const dyrHosEier = (vetDyr || [])
      .filter(d => String(d.dyreeier_id || d.eier_id || "") === String(dyreeierId))
      .sort((a,b) => String(a.navn || "").localeCompare(String(b.navn || ""), "nb"));
    if (!dyrHosEier.length) {
      liste.innerHTML = '<p class="lite">Ingen dyr registrert på denne dyreeieren ennå.</p>';
      if (info) info.textContent = "Ingen dyr funnet på valgt dyreeier.";
      return;
    }
    liste.innerHTML = `<div class="vet-klikk-liste">${dyrHosEier.map(d => {
      const id = esc(d.id);
      const valgt = valgtDyrId && String(valgtDyrId) === String(d.id);
      return `
        <div class="vet-klikk-rad" onclick="return window.vetFIXAapneDyr('${id}')" style="grid-template-columns:42px minmax(140px,1.3fr) minmax(150px,1.2fr) minmax(110px,.8fr) 90px 90px;${valgt ? 'outline:1px solid #1f6feb;' : ''}">
          ${miniBilde(d)}
          <span>${esc(d.navn || "Uten navn")}</span>
          <span>${esc([d.art, d.rase].filter(Boolean).join(" / "))}</span>
          <span>${esc(d.idmerking || "")}</span>
          <a href="#" onclick="event.preventDefault(); event.stopPropagation(); return window.vetFIXAapneDyr('${id}')" class="secondary" style="display:inline-block;text-align:center;text-decoration:none;color:white;background:#555;border-radius:8px;padding:5px 10px;font-size:13px;">Åpne</a>
          <a href="#" onclick="event.preventDefault(); event.stopPropagation(); return window.vetFIXBildeDyr('${id}')" class="secondary" style="display:inline-block;text-align:center;text-decoration:none;color:white;background:#555;border-radius:8px;padding:5px 10px;font-size:13px;">Bilde</a>
        </div>`;
    }).join("")}</div>`;
    if (info) info.textContent = `${dyrHosEier.length} dyr registrert på valgt dyreeier.`;
  };

  document.addEventListener("click", function(e){
    const openDyr = e.target.closest("[data-open-dyr-fix]");
    if (openDyr) { e.preventDefault(); e.stopPropagation(); return window.vetFIXAapneDyr(openDyr.dataset.openDyrFix); }
  }, true);

  const start = () => {
    sørgForDyrBildeUI();
    try { window.tegnDyreeiere(); } catch(e) { console.warn(e); }
    try { window.fyllDyreeierDyrValg(vetTekst("dyreeierId")); } catch(e) { console.warn(e); }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 100), {once:true});
  else setTimeout(start, 100);
})();
/* ===== SLUTT ENDELIG FIX ===== */


/* ===== STACKSAFE FIX: ÅPNE/BILDE UTEN REKURSJON 07.06 ===== */
(function(){
  function esc(v){
    return String(v ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }

  function sett(id, verdi){
    const el = document.getElementById(id);
    if (el) el.value = verdi ?? '';
  }

  function visSideTrygt(sideId){
    if (typeof visVetSide === 'function') {
      try { visVetSide(sideId); return; } catch(e) { console.warn('visVetSide feilet, bruker fallback', e); }
    }
    document.querySelectorAll('#klinikkSide,#eierSide,#dyrSide,#prisSide,#lagerSide,#journalSide,#fakturaSide,#okonomiSide,#backupSide').forEach(el => {
      el.classList.add('skjult');
      el.style.display = 'none';
    });
    const side = document.getElementById(sideId);
    if (side) {
      side.classList.remove('skjult');
      side.style.display = '';
    }
  }

  function sørgForDyrBildeUI(){
    if (typeof vetInitDyrBildeUI === 'function') {
      try { vetInitDyrBildeUI(); } catch(e) { console.warn(e); }
    }
    const dyrSide = document.getElementById('dyrSide');
    const lagre = document.getElementById('lagreDyrKnapp');
    if (!dyrSide || !lagre || document.getElementById('dyrBildeOmrade')) return;
    const div = document.createElement('div');
    div.id = 'dyrBildeOmrade';
    div.innerHTML = `
      <h3 style="margin-top:14px;margin-bottom:6px;">Bilde av dyret</h3>
      <div class="rad" style="align-items:end;">
        <div>
          <label for="dyrBildeFil">Velg bilde / ta bilde</label>
          <input id="dyrBildeFil" type="file" accept="image/*" capture="environment">
          <button id="taBildeDyrKnapp" type="button" class="secondary" style="margin-top:8px;">Ta bilde</button>
        </div>
        <div>
          <img id="dyrBildePreview" alt="Bilde av dyr" class="skjult" style="display:none;width:90px;height:70px;object-fit:cover;border:1px solid #ddd;border-radius:8px;background:#fafafa;">
        </div>
      </div>
      <p class="lite" style="margin-top:4px;">Velg bilde og trykk Lagre dyr / bilde.</p>
    `;
    lagre.parentNode.insertBefore(div, lagre);
    const fil = document.getElementById('dyrBildeFil');
    if (fil && !fil.dataset.previewKoblet) {
      fil.dataset.previewKoblet = '1';
      fil.addEventListener('change', () => {
        const valgt = fil.files && fil.files[0];
        if (!valgt) return;
        const reader = new FileReader();
        reader.onload = e => {
          const img = document.getElementById('dyrBildePreview');
          if (img) {
            img.src = e.target.result;
            img.classList.remove('skjult');
            img.style.display = '';
          }
        };
        reader.readAsDataURL(valgt);
      });
    }
    const taBilde = document.getElementById('taBildeDyrKnapp');
    if (taBilde && fil && !taBilde.dataset.koblet) {
      taBilde.dataset.koblet = '1';
      taBilde.addEventListener('click', (e) => {
        e.preventDefault();
        fil.click();
      });
    }
  }

  window.vetStackSafeOpenEier = function(id){
    const e = (window.vetDyreeiere || vetDyreeiere || []).find(x => String(x.id) === String(id));
    if (!e) return false;
    sett('dyreeierId', e.id);
    sett('dyreeierVelgForDyr', e.id);
    sett('dyreeierNavn', e.navn || '');
    sett('dyreeierTelefon', e.telefon || '');
    sett('dyreeierEpost', e.epost || '');
    sett('dyreeierAdresse', e.adresse || '');
    visSideTrygt('eierSide');
    sett('dyreeierId', e.id);
    sett('dyreeierVelgForDyr', e.id);
    setTimeout(() => window.vetStackSafeTegnDyrHosEier(e.id), 0);
    return false;
  };

  window.vetStackSafeOpenDyr = function(id){
    const d = (window.vetDyr || vetDyr || []).find(x => String(x.id) === String(id));
    if (!d) return false;
    visSideTrygt('dyrSide');
    if (typeof fyllDyreeierValg === 'function') {
      try { fyllDyreeierValg(d.dyreeier_id || ''); } catch(e) { console.warn(e); }
    }
    sett('dyrId', d.id);
    sett('dyrEierValg', d.dyreeier_id || '');
    sett('dyrNavn', d.navn || '');
    sett('dyrArt', d.art || '');
    sett('dyrRase', d.rase || '');
    sett('dyrFodselsdato', d.fodselsdato || '');
    sett('dyrKjonn', d.kjonn || '');
    sett('dyrIdmerking', d.idmerking || '');
    sørgForDyrBildeUI();
    const fil = document.getElementById('dyrBildeFil');
    if (fil) fil.value = '';
    const img = document.getElementById('dyrBildePreview');
    if (img) {
      if (d.bilde_url) {
        img.src = d.bilde_url;
        img.classList.remove('skjult');
        img.style.display = '';
      } else {
        img.removeAttribute('src');
        img.classList.add('skjult');
        img.style.display = 'none';
      }
    }
    const side = document.getElementById('dyrSide');
    if (side) side.scrollIntoView({ behavior:'smooth', block:'start' });
    return false;
  };

  window.vetStackSafeBildeDyr = function(id){
    window.vetStackSafeOpenDyr(id);
    const omr = document.getElementById('dyrBildeOmrade');
    const fil = document.getElementById('dyrBildeFil');
    if (omr) omr.scrollIntoView({ behavior:'smooth', block:'center' });
    if (fil) {
      try { fil.focus(); fil.click(); } catch(e) { console.warn(e); }
    }
    setTimeout(() => {
      const fil2 = document.getElementById('dyrBildeFil');
      if (fil2 && !fil2.files.length) {
        try { fil2.focus(); } catch(e) { console.warn(e); }
      }
    }, 80);
    return false;
  };

  function miniBilde(d){
    if (d && d.bilde_url) return `<img src="${esc(d.bilde_url)}" alt="${esc(d.navn || 'Dyr')}" class="vet-dyr-mini-bilde">`;
    return `<span style="font-size:13px;font-weight:400;line-height:1.1;">📷</span>`;
  }

  window.vetStackSafeTegnDyrHosEier = function(dyreeierId){
    const gammel = document.getElementById('dyreeierDyrValg');
    if (gammel && gammel.tagName === 'SELECT') {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.id = 'dyreeierDyrValg';
      gammel.parentNode.replaceChild(hidden, gammel);
    }
    let liste = document.getElementById('dyreeierDyrListe');
    if (!liste) {
      liste = document.createElement('div');
      liste.id = 'dyreeierDyrListe';
      const info = document.getElementById('dyreeierDyrInfo');
      if (info && info.parentNode) info.parentNode.insertBefore(liste, info);
    }
    const info = document.getElementById('dyreeierDyrInfo');
    if (!dyreeierId) {
      if (liste) liste.innerHTML = '<p class="lite">Velg eller klikk en dyreeier først.</p>';
      if (info) info.textContent = '';
      return;
    }
    const dyrHosEier = (window.vetDyr || vetDyr || [])
      .filter(d => String(d.dyreeier_id || d.eier_id || '') === String(dyreeierId))
      .sort((a,b) => String(a.navn || '').localeCompare(String(b.navn || ''), 'nb'));
    if (!dyrHosEier.length) {
      liste.innerHTML = '<p class="lite">Ingen dyr registrert på denne dyreeieren ennå.</p>';
      if (info) info.textContent = 'Ingen dyr funnet på valgt dyreeier.';
      return;
    }
    liste.innerHTML = `<div class="vet-klikk-liste">${dyrHosEier.map(d => {
      const id = esc(d.id);
      return `
        <div class="vet-klikk-rad" style="grid-template-columns:42px minmax(140px,1.3fr) minmax(150px,1.2fr) minmax(110px,.8fr) 90px 90px;">
          ${miniBilde(d)}
          <span>${esc(d.navn || 'Uten navn')}</span>
          <span>${esc([d.art, d.rase].filter(Boolean).join(' / '))}</span>
          <span>${esc(d.idmerking || '')}</span>
          <button type="button" class="secondary" data-vet-stacksafe-open-dyr="${id}" style="margin:0;padding:5px 10px;font-size:13px;">Åpne</button>
          <button type="button" class="secondary" data-vet-stacksafe-bilde-dyr="${id}" style="margin:0;padding:5px 10px;font-size:13px;">Bilde</button>
        </div>`;
    }).join('')}</div>`;
    if (info) info.textContent = `${dyrHosEier.length} dyr registrert på valgt dyreeier.`;
  };

  window.fyllDyreeierDyrValg = function(dyreeierId = '', valgtDyrId = ''){
    const hidden = document.getElementById('dyreeierDyrValg');
    if (hidden) hidden.value = valgtDyrId || '';
    window.vetStackSafeTegnDyrHosEier(dyreeierId);
  };

  window.tegnDyreeiere = function(){
    const liste = document.getElementById('dyreeierListe');
    if (!liste) return;
    if (!(window.vetDyreeiere || vetDyreeiere || []).length) {
      liste.innerHTML = '<p class="lite">Ingen dyreeiere registrert ennå.</p>';
      return;
    }
    liste.innerHTML = `<div class="vet-klikk-liste">${(window.vetDyreeiere || vetDyreeiere || []).map(e => {
      const id = esc(e.id);
      return `
        <button type="button" class="vet-klikk-rad" data-vet-stacksafe-open-eier="${id}" style="grid-template-columns:minmax(170px,1.4fr) minmax(100px,.8fr) minmax(190px,1.4fr) 90px;">
          <span>${esc(e.navn || 'Uten navn')}</span>
          <span>${esc(e.telefon || '')}</span>
          <span>${esc(e.epost || '')}</span>
          <span>Åpne</span>
        </button>`;
    }).join('')}</div>`;
  };

  document.addEventListener('click', function(e){
    const bilde = e.target.closest('[data-vet-stacksafe-bilde-dyr]');
    if (bilde) {
      e.preventDefault();
      e.stopPropagation();
      return window.vetStackSafeBildeDyr(bilde.dataset.vetStacksafeBildeDyr);
    }
    const dyr = e.target.closest('[data-vet-stacksafe-open-dyr]');
    if (dyr) {
      e.preventDefault();
      e.stopPropagation();
      return window.vetStackSafeOpenDyr(dyr.dataset.vetStacksafeOpenDyr);
    }
    const eier = e.target.closest('[data-vet-stacksafe-open-eier]');
    if (eier) {
      e.preventDefault();
      e.stopPropagation();
      return window.vetStackSafeOpenEier(eier.dataset.vetStacksafeOpenEier);
    }
  }, true);

  const start = () => {
    try { window.tegnDyreeiere(); } catch(e) { console.warn(e); }
    try { window.vetStackSafeTegnDyrHosEier(vetTekst('dyreeierId')); } catch(e) { console.warn(e); }
    sørgForDyrBildeUI();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 350), { once:true });
  else setTimeout(start, 350);
})();
/* ===== SLUTT STACKSAFE FIX ===== */


/* === FIX: klikk klinikk -> vis brukere og endre rolle === */
function vetEsc(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function tegnKlinikker() {
  const liste = document.getElementById("klinikkListe");
  if (!liste) return;

  if (!vetKlinikker.length) {
    liste.innerHTML = '<p class="lite">Ingen klinikker registrert ennå.</p>';
    return;
  }

  liste.innerHTML = vetKlinikker.map(k => `
    <button
      type="button"
      class="listekort vet-klinikk-kort"
      onclick="redigerKlinikk('${vetEsc(k.id)}')"
      style="
        width:100%;
        display:block;
        text-align:left;
        cursor:pointer;
        margin-bottom:10px;
      "
      title="Klikk for å åpne klinikk og vise brukere"
    >
      <strong>${vetEsc(k.navn || "")}</strong><br>
      <span class="lite">
        ${k.konsern_navn ? "Konsern: " + vetEsc(k.konsern_navn) + "<br>" : ""}
        ${vetEsc(k.telefon || "")} ${vetEsc(k.epost || "")}
        ${k.km_pris ? "<br>Km-pris: " + formaterKr(k.km_pris) + " kr" : ""}
      </span><br>
      ${erVetAdminSync() && k.logo_url ? `<img src="${vetEsc(k.logo_url)}" alt="Logo" style="max-height:50px; margin-top:6px;"><br>` : ""}
      <span class="lite">Klikk for brukere og roller</span>
    </button>
  `).join("");
}

function redigerKlinikk(id) {
  const k = vetKlinikker.find(x => String(x.id) === String(id));
  if (!k) return;

  vetSett("klinikkId", k.id);
  vetSett("klinikkNavn", k.navn);
  vetSett("konsernNavn", k.konsern_navn);
  vetSett("klinikkTelefon", k.telefon);
  vetSett("klinikkEpost", k.epost);
  vetSett("klinikkAdresse", k.adresse);
  vetSett("klinikkKmPris", k.km_pris || "5.30");
  visKlinikkLogoPreview(k.logo_url || "");

  visVetSide("klinikkSide");

  const brukerEl = document.getElementById("adminKlinikkBrukere");
  if (brukerEl) {
    brukerEl.classList.remove("skjult");
    brukerEl.style.display = "";
  }

  const msg = document.getElementById("klinikkBrukerMelding");
  if (msg) msg.textContent = "Valgt klinikk: " + (k.navn || "");

  lastKlinikkBrukere();
}

function tegnKlinikkBrukere(liste = []) {
  const el = document.getElementById("klinikkBrukerListe");
  if (!el) return;

  if (!erKlinikkAdmin()) {
    el.innerHTML = "";
    return;
  }

  if (!liste.length) {
    el.innerHTML = '<p class="lite">Ingen brukere koblet til valgt klinikk ennå.</p>';
    return;
  }

  el.innerHTML = `
    <div class="vet-linje-liste" style="display:grid;gap:6px;margin-top:8px;">
      ${liste.map(b => {
        const id = vetEsc(b.id);
        const rolle = String(b.rolle || "veterinaer").toLowerCase();
        const navn = vetEsc(b.navn || "");
        const epost = vetEsc(b.epost || "");
        const aktiv = b.aktiv !== false;

        return `
          <div class="listekort" style="display:grid;grid-template-columns:minmax(180px,1.4fr) minmax(220px,1.6fr) minmax(140px,.9fr) 120px;gap:10px;align-items:center;">
            <div>
              <strong>${navn || "Uten navn"}</strong><br>
              <span class="lite">${epost}</span>
            </div>

            <select id="rolle_${id}" style="margin:0;">
              <option value="veterinaer" ${rolle === "veterinaer" ? "selected" : ""}>Veterinær</option>
              <option value="admin" ${rolle === "admin" ? "selected" : ""}>Klinikkadmin</option>
              <option value="systemadmin" ${rolle === "systemadmin" ? "selected" : ""}>Systemadmin</option>
            </select>

            <span class="lite">${aktiv ? "Aktiv" : "Inaktiv"}</span>

            <button type="button" class="secondary" onclick="endreKlinikkBrukerRolle('${id}')">
              Lagre rolle
            </button>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

async function endreKlinikkBrukerRolle(brukerId) {
  vetMelding("klinikkBrukerMelding", "");

  if (!erKlinikkAdmin()) {
    vetMelding("klinikkBrukerMelding", "Kun admin kan endre roller.");
    return;
  }

  const rolle = String(document.getElementById("rolle_" + brukerId)?.value || "veterinaer").trim();

  const { error } = await supabaseClient
    .from("vet_klinikk_brukere")
    .update({ rolle })
    .eq("id", brukerId);

  if (error) {
    vetMelding("klinikkBrukerMelding", "Feil ved endring av rolle: " + error.message);
    return;
  }

  vetMelding("klinikkBrukerMelding", "Rolle oppdatert.");
  await lastKlinikkBrukere();
}



/* ===== ROBUST SYSADMIN + OPPSETT + MVA FILTER FIX 2026-06-09 =====
   Denne ligger helt nederst og overstyrer eldre menyfixer som skjulte knapper igjen. */
(function () {
  function vetErAdminNaa() {
    try { return (typeof erKlinikkAdmin === "function" && erKlinikkAdmin()) || vetErSystemAdmin === true; }
    catch (e) { return vetErSystemAdmin === true; }
  }

  function visEl(el, synlig, display = "inline-block") {
    if (!el) return;
    el.style.display = synlig ? display : "none";
    if (synlig) el.classList.remove("skjult");
    else el.classList.add("skjult");
  }

  window.toggleVetOppsettMeny = function () {
    const meny = document.getElementById("vetOppsettMeny");
    if (!meny) return false;
    const erSkjult = meny.classList.contains("skjult") || meny.style.display === "none" || !meny.style.display;
    if (erSkjult) {
      meny.classList.remove("skjult");
      meny.style.display = "block";
    } else {
      meny.classList.add("skjult");
      meny.style.display = "none";
    }
    return false;
  };

  window.oppdaterVetMenySynlighet = function () {
    if (typeof oppdaterVetToppInfo === "function") oppdaterVetToppInfo();

    const admin = vetErAdminNaa();
    const systemadmin = vetErSystemAdmin === true || String(vetKlinikkRolle || "").toLowerCase() === "systemadmin";

    document.querySelectorAll(".vet-bruker-nav,.vet-lagerlogg-nav").forEach(el => visEl(el, true));
    document.querySelectorAll(".vet-admin-nav,.vet-faktura-nav,.vet-oppsett-nav").forEach(el => visEl(el, admin));
    document.querySelectorAll(".vet-systemadmin-nav").forEach(el => visEl(el, systemadmin));

    const oppsettKnapp = document.getElementById("vetOppsettKnapp");
    if (oppsettKnapp) {
      visEl(oppsettKnapp, admin);
      oppsettKnapp.onclick = window.toggleVetOppsettMeny;
    }

    const modulKnapp = document.getElementById("velgModulKnapp");
    if (modulKnapp && vetInnloggetEpost === "greknuts@online.no") {
      modulKnapp.style.display = "inline-block";
    }

    const visInfo = document.getElementById("vetVisningInfo");
    if (visInfo) visInfo.style.display = "none";

    const undermeny = document.getElementById("vetOppsettMeny");
    if (undermeny && !admin) {
      undermeny.classList.add("skjult");
      undermeny.style.display = "none";
    }
  };

  function kobleRobustMeny() {
    const oppsettKnapp = document.getElementById("vetOppsettKnapp");
    if (oppsettKnapp) {
      oppsettKnapp.onclick = window.toggleVetOppsettMeny;
      if (vetErAdminNaa()) oppsettKnapp.style.display = "inline-block";
    }
    if (typeof window.oppdaterVetMenySynlighet === "function") window.oppdaterVetMenySynlighet();
  }

  document.addEventListener("DOMContentLoaded", kobleRobustMeny);
  window.addEventListener("load", kobleRobustMeny);
  setTimeout(kobleRobustMeny, 500);
  setTimeout(kobleRobustMeny, 1500);
})();

/* ===== REDIGER KLINIKKBRUKERE FIX 2026-06-09 =====
   Admin kan redigere navn, e-post, rolle og aktiv/inaktiv på klinikkbrukere.
   Dette endrer vet_klinikk_brukere. Auth-bruker/passord håndteres fortsatt av Supabase/edge function. */
(function () {
  function esc(verdi) {
    if (typeof vetEsc === "function") return vetEsc(verdi);
    return String(verdi ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.tegnKlinikkBrukere = function (liste = []) {
    const el = document.getElementById("klinikkBrukerListe");
    if (!el) return;

    if (typeof erKlinikkAdmin === "function" && !erKlinikkAdmin()) {
      el.innerHTML = "";
      return;
    }

    if (!liste.length) {
      el.innerHTML = '<p class="lite">Ingen brukere koblet til valgt klinikk ennå.</p>';
      return;
    }

    el.innerHTML = `
      <div style="display:grid; gap:8px; margin-top:10px;">
        ${liste.map(b => {
          const id = esc(b.id);
          const navn = esc(b.navn || "");
          const epost = esc(b.epost || "");
          const rolle = String(b.rolle || "veterinaer").toLowerCase();
          const aktiv = b.aktiv !== false;

          return `
            <div class="listekort" style="display:grid; grid-template-columns:minmax(150px,1fr) minmax(210px,1.3fr) minmax(140px,.8fr) minmax(110px,.6fr) 120px; gap:10px; align-items:end;">
              <div>
                <label for="bruker_navn_${id}" style="margin-top:0;">Navn</label>
                <input id="bruker_navn_${id}" value="${navn}" style="margin:0;">
              </div>

              <div>
                <label for="bruker_epost_${id}" style="margin-top:0;">E-post</label>
                <input id="bruker_epost_${id}" type="email" value="${epost}" style="margin:0;">
              </div>

              <div>
                <label for="bruker_rolle_${id}" style="margin-top:0;">Rolle</label>
                <select id="bruker_rolle_${id}" style="margin:0;">
                  <option value="veterinaer" ${rolle === "veterinaer" ? "selected" : ""}>Veterinær</option>
                  <option value="admin" ${rolle === "admin" ? "selected" : ""}>Klinikkadmin</option>
                  <option value="systemadmin" ${rolle === "systemadmin" ? "selected" : ""}>Systemadmin</option>
                </select>
              </div>

              <div>
                <label for="bruker_aktiv_${id}" style="margin-top:0;">Status</label>
                <select id="bruker_aktiv_${id}" style="margin:0;">
                  <option value="true" ${aktiv ? "selected" : ""}>Aktiv</option>
                  <option value="false" ${!aktiv ? "selected" : ""}>Inaktiv</option>
                </select>
              </div>

              <button type="button" class="secondary" onclick="lagreEndretKlinikkBruker('${id}')">Lagre</button>
            </div>
          `;
        }).join("")}
      </div>
      <p class="lite">Merk: Endring av e-post her endrer koblingen i klinikktabellen. Innlogging/passord styres av Supabase Auth.</p>
    `;
  };

  window.lagreEndretKlinikkBruker = async function (brukerId) {
    vetMelding("klinikkBrukerMelding", "");

    if (typeof erKlinikkAdmin === "function" && !erKlinikkAdmin()) {
      vetMelding("klinikkBrukerMelding", "Kun admin kan redigere brukere.");
      return;
    }

    const navn = String(document.getElementById("bruker_navn_" + brukerId)?.value || "").trim();
    const epost = String(document.getElementById("bruker_epost_" + brukerId)?.value || "").trim().toLowerCase();
    const rolle = String(document.getElementById("bruker_rolle_" + brukerId)?.value || "veterinaer").trim();
    const aktiv = String(document.getElementById("bruker_aktiv_" + brukerId)?.value || "true") === "true";

    if (!epost) {
      vetMelding("klinikkBrukerMelding", "E-post kan ikke være tom.");
      return;
    }

    const { error } = await supabaseClient
      .from("vet_klinikk_brukere")
      .update({ navn: navn || null, epost, rolle, aktiv })
      .eq("id", brukerId);

    if (error) {
      vetMelding("klinikkBrukerMelding", "Feil ved lagring av bruker: " + error.message);
      return;
    }

    vetMelding("klinikkBrukerMelding", "Bruker oppdatert.");
    if (typeof lastKlinikkBrukere === "function") await lastKlinikkBrukere();
    if (typeof lastVetKlinikkBrukereAlle === "function") await lastVetKlinikkBrukereAlle();
  };
})();

/* ===== FIX: HINDRE DOBBELTLAGRING AV DYR/PASIENT 2026-06-09 =====
   Flere tidligere patcher hadde koblet Lagre dyr med både addEventListener og onclick.
   Denne ligger nederst, stopper gamle click-listeners i capture-fasen, og kjører én trygg lagring. */
(function () {
  let vetLagrerDyrNaa = false;
  let vetSisteDyrKlikkTid = 0;

  function v(id) { return String(document.getElementById(id)?.value || '').trim(); }
  function sett(id, verdi) { const el = document.getElementById(id); if (el) el.value = verdi ?? ''; }

  function sameText(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  async function lastOppBildeTrygt(dyrId) {
    if (!dyrId) return null;
    try {
      if (typeof vetLastOppDyrBilde === 'function') return await vetLastOppDyrBilde(dyrId);
    } catch (e) {
      console.warn('Bildeopplasting feilet:', e);
      if (typeof vetMelding === 'function') vetMelding('dyrMelding', 'Dyr lagret, men bilde kunne ikke lagres: ' + (e.message || e));
    }
    return null;
  }

  async function lagreDyrBareEnGang(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }

    const naa = Date.now();
    if (vetLagrerDyrNaa || (naa - vetSisteDyrKlikkTid < 1200)) return false;
    vetLagrerDyrNaa = true;
    vetSisteDyrKlikkTid = naa;

    const knapp = document.getElementById('lagreDyrKnapp');
    const gammelTekst = knapp ? knapp.textContent : '';
    if (knapp) { knapp.disabled = true; knapp.textContent = 'Lagrer ...'; }

    try {
      if (typeof vetMelding === 'function') vetMelding('dyrMelding', '');
      if (typeof vetInitDyrBildeUI === 'function') vetInitDyrBildeUI();

      const eierId = v('dyrEierValg');
      const navn = v('dyrNavn');
      if (!eierId) { if (typeof vetMelding === 'function') vetMelding('dyrMelding', 'Velg dyreeier først.'); return false; }
      if (!navn) { if (typeof vetMelding === 'function') vetMelding('dyrMelding', 'Skriv navn på dyr/pasient.'); return false; }

      let rad = {
        dyreeier_id: eierId,
        navn,
        art: v('dyrArt') || null,
        rase: v('dyrRase') || null,
        fodselsdato: v('dyrFodselsdato') || null,
        kjonn: v('dyrKjonn') || null,
        idmerking: v('dyrIdmerking') || null
      };
      if (typeof leggTilKlinikkHvisVanligBruker === 'function') rad = leggTilKlinikkHvisVanligBruker(rad);

      let id = v('dyrId');

      // Hvis skjemaet ikke har id, men samme dyr allerede finnes på samme dyreeier,
      // oppdater eksisterende i stedet for å lage tvilling-dyr.
      if (!id && Array.isArray(vetDyr)) {
        const eksisterende = vetDyr.find(d =>
          String(d.dyreeier_id || d.eier_id || '') === String(eierId) &&
          sameText(d.navn, navn) &&
          sameText(d.art, rad.art) &&
          sameText(d.rase, rad.rase)
        );
        if (eksisterende?.id) id = eksisterende.id;
      }

      const query = id
        ? supabaseClient.from('vet_dyr').update(rad).eq('id', id).select('id').single()
        : supabaseClient.from('vet_dyr').insert(rad).select('id').single();

      const { data, error } = await query;
      if (error) {
        if (typeof vetMelding === 'function') vetMelding('dyrMelding', 'Feil ved lagring av dyr: ' + error.message);
        return false;
      }

      const lagretDyrId = data?.id || id;
      const bildeUrl = await lastOppBildeTrygt(lagretDyrId);

      if (typeof lastDyr === 'function') await lastDyr();

      sett('dyrId', lagretDyrId || '');
      sett('dyrEierValg', eierId);
      sett('dyreeierId', eierId);
      sett('dyreeierVelgForDyr', eierId);

      if (bildeUrl && typeof vetSettDyrBildePreview === 'function') vetSettDyrBildePreview(bildeUrl);
      const fil = document.getElementById('dyrBildeFil');
      if (fil) fil.value = '';

      if (typeof fyllDyreeierDyrValg === 'function') fyllDyreeierDyrValg(eierId, lagretDyrId || '');
      if (typeof fyllDyrValg === 'function') fyllDyrValg();
      if (typeof fyllJournalDyreeierValg === 'function') fyllJournalDyreeierValg();

      const tekst = bildeUrl ? 'Dyr/pasient og bilde lagret.' : 'Dyr/pasient lagret.';
      if (typeof vetMelding === 'function') vetMelding('dyrMelding', tekst);

      // Vis eierkortet igjen, uten å lagre på nytt.
      if (typeof window.vetStackSafeOpenEier === 'function') window.vetStackSafeOpenEier(eierId);
      else if (typeof visVetSide === 'function') visVetSide('eierSide');
      if (typeof vetMelding === 'function') vetMelding('dyreeierMelding', tekst);
      if (typeof fyllDyreeierDyrValg === 'function') fyllDyreeierDyrValg(eierId, lagretDyrId || '');

      return false;
    } finally {
      setTimeout(() => { vetLagrerDyrNaa = false; }, 900);
      if (knapp) { knapp.disabled = false; knapp.textContent = gammelTekst || 'Lagre dyr'; }
    }
  }

  window.lagreDyr = lagreDyrBareEnGang;

  function kobleLagreDyrEksklusivt() {
    const knapp = document.getElementById('lagreDyrKnapp');
    if (!knapp || knapp.dataset.vetEksklusivLagreDyr === '1') return;
    knapp.dataset.vetEksklusivLagreDyr = '1';
    knapp.onclick = lagreDyrBareEnGang;
    // Capture + stopImmediatePropagation stopper gamle addEventListener-koblinger.
    knapp.addEventListener('click', lagreDyrBareEnGang, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kobleLagreDyrEksklusivt, { once: true });
  else kobleLagreDyrEksklusivt();
  window.addEventListener('load', kobleLagreDyrEksklusivt);
  setTimeout(kobleLagreDyrEksklusivt, 500);
  setTimeout(kobleLagreDyrEksklusivt, 1500);
})();
/* ===== SLUTT FIX: HINDRE DOBBELTLAGRING AV DYR/PASIENT ===== */

/* ===== ABSOLUTT SISTE FIX 09.06: DYR SKAL IKKE DOBBELTLAGRES ELLER DOBBELTVISES =====
   Ligger helt nederst og overstyrer alle tidligere patcher. */
(function () {
  let lagrerDyr = false;
  let sistStartet = 0;

  function txt(id) { return String(document.getElementById(id)?.value || '').trim(); }
  function setv(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }
  function norm(v) { return String(v || '').trim().toLowerCase(); }
  function dyrKey(d) {
    return [d.dyreeier_id || d.eier_id || '', norm(d.navn), norm(d.art), norm(d.rase), norm(d.idmerking)].join('|');
  }
  function unikeDyr(liste) {
    const sett = new Set();
    const ut = [];
    (liste || []).forEach(d => {
      const key = dyrKey(d);
      if (sett.has(key)) return;
      sett.add(key);
      ut.push(d);
    });
    return ut;
  }

  const originalLastDyr = typeof lastDyr === 'function' ? lastDyr : null;
  if (originalLastDyr) {
    window.lastDyr = lastDyr = async function () {
      await originalLastDyr();
      vetDyr = unikeDyr(vetDyr);
      if (typeof tegnDyr === 'function') tegnDyr();
      const aktivDyreeierId = txt('dyreeierId');
      if (aktivDyreeierId && typeof fyllDyreeierDyrValg === 'function') fyllDyreeierDyrValg(aktivDyreeierId);
    };
  }

  window.fyllDyreeierDyrValg = fyllDyreeierDyrValg = function (dyreeierId = '', valgtDyrId = '') {
    const liste = typeof vetSørgForDyreListeUnderEier === 'function'
      ? vetSørgForDyreListeUnderEier()
      : document.getElementById('dyreeierDyrListe');
    const info = document.getElementById('dyreeierDyrInfo');
    const hidden = document.getElementById('dyreeierDyrValg');
    if (hidden) hidden.value = valgtDyrId || '';
    if (!liste) return;

    if (!dyreeierId) {
      liste.innerHTML = '<p class="lite">Velg eller klikk en dyreeier først.</p>';
      if (info) info.textContent = '';
      return;
    }

    const dyrHosEier = unikeDyr((vetDyr || [])
      .filter(d => String(d.dyreeier_id || d.eier_id || '') === String(dyreeierId)))
      .sort((a, b) => String(a.navn || '').localeCompare(String(b.navn || ''), 'nb'));

    if (!dyrHosEier.length) {
      liste.innerHTML = '<p class="lite">Ingen dyr registrert på denne dyreeieren ennå.</p>';
      if (info) info.textContent = 'Ingen dyr funnet på valgt dyreeier.';
      return;
    }

    const esc = typeof vetKlikkEsc === 'function' ? vetKlikkEsc : (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
    const mini = typeof vetMiniDyrBilde === 'function' ? vetMiniDyrBilde : () => '<span>📷</span>';

    liste.innerHTML = `
      <div class="vet-klikk-liste">
        ${dyrHosEier.map(d => {
          const id = esc(d.id);
          const valgt = valgtDyrId && String(valgtDyrId) === String(d.id);
          const navn = esc(d.navn || 'Uten navn');
          const artRase = esc([d.art, d.rase].filter(Boolean).join(' / '));
          const idmerking = esc(d.idmerking || '');
          return `
            <button type="button"
              class="vet-klikk-rad"
              onclick="vetVelgDyrFraEierListe('${id}')"
              title="Klikk for detaljer på dyret"
              style="grid-template-columns:42px minmax(140px,1.3fr) minmax(150px,1.2fr) minmax(110px,.8fr) 70px;${valgt ? 'outline:1px solid #1f6feb;' : ''}">
              ${mini(d)}
              <span>${navn}</span>
              <span>${artRase}</span>
              <span>${idmerking}</span>
              <span>Åpne</span>
            </button>`;
        }).join('')}
      </div>`;

    if (info) info.textContent = `${dyrHosEier.length} dyr registrert på valgt dyreeier.`;
  };

  window.tegnDyr = tegnDyr = function () {
    const liste = document.getElementById('dyrListe');
    if (!liste) return;
    const unike = unikeDyr(vetDyr || []);
    vetDyr = unike;

    if (!unike.length) {
      liste.innerHTML = '<p class="lite">Ingen dyr registrert ennå.</p>';
      return;
    }

    const esc = typeof vetLinjeEsc === 'function' ? vetLinjeEsc : (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
    const wrap = typeof vetLinjeWrap === 'function' ? vetLinjeWrap : (inner) => `<div>${inner}</div>`;
    const span = typeof vetLinjeSpan === 'function' ? vetLinjeSpan : (v) => `<span>${v || '&nbsp;'}</span>`;
    const knapp = typeof vetLinjeKnapp === 'function' ? vetLinjeKnapp : (onClick, cols, inner) => `<button type="button" onclick="${onClick}">${inner}</button>`;

    liste.innerHTML = wrap(unike.map(d => {
      const id = esc(d.id);
      const navn = esc(d.navn || 'Uten navn');
      const artRase = esc([d.art, d.rase].filter(Boolean).join(' / '));
      const eierNavn = esc(d.vet_dyreeiere?.navn || (vetDyreeiere || []).find(e => String(e.id) === String(d.dyreeier_id))?.navn || '');
      const idmerking = esc(d.idmerking || '');
      const bilde = d.bilde_url
        ? `<img src="${esc(d.bilde_url)}" alt="${navn}" style="width:34px;height:28px;object-fit:cover;border-radius:4px;border:1px solid #ddd;">`
        : `<span class="lite" style="font-size:12px !important;font-weight:400 !important;line-height:1;">📷</span>`;
      return knapp(
        `redigerDyr('${id}')`,
        '42px minmax(140px,1.3fr) minmax(150px,1.2fr) minmax(160px,1.3fr) minmax(110px,.8fr)',
        `${bilde}${span(navn)}${span(artRase)}${span(eierNavn)}${span(idmerking)}`
      );
    }).join(''));
  };

  async function lagreDyrTrygt(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }
    const naa = Date.now();
    if (lagrerDyr || (naa - sistStartet < 1500)) return false;
    lagrerDyr = true;
    sistStartet = naa;

    const knapp = document.getElementById('lagreDyrKnapp');
    const gammelTekst = knapp?.textContent || 'Lagre dyr';
    if (knapp) { knapp.disabled = true; knapp.textContent = 'Lagrer ...'; }

    try {
      if (typeof vetMelding === 'function') vetMelding('dyrMelding', '');
      if (typeof vetInitDyrBildeUI === 'function') vetInitDyrBildeUI();

      const eierId = txt('dyrEierValg');
      const navn = txt('dyrNavn');
      if (!eierId) { vetMelding('dyrMelding', 'Velg dyreeier først.'); return false; }
      if (!navn) { vetMelding('dyrMelding', 'Skriv navn på dyr/pasient.'); return false; }

      let rad = {
        dyreeier_id: eierId,
        navn,
        art: txt('dyrArt') || null,
        rase: txt('dyrRase') || null,
        fodselsdato: txt('dyrFodselsdato') || null,
        kjonn: txt('dyrKjonn') || null,
        idmerking: txt('dyrIdmerking') || null
      };
      if (typeof leggTilKlinikkHvisVanligBruker === 'function') rad = leggTilKlinikkHvisVanligBruker(rad);

      let id = txt('dyrId');
      if (!id && Array.isArray(vetDyr)) {
        const eksisterende = vetDyr.find(d => dyrKey(d) === dyrKey(rad));
        if (eksisterende?.id) id = eksisterende.id;
      }

      const query = id
        ? supabaseClient.from('vet_dyr').update(rad).eq('id', id).select('id').single()
        : supabaseClient.from('vet_dyr').insert(rad).select('id').single();
      const { data, error } = await query;
      if (error) { vetMelding('dyrMelding', 'Feil ved lagring av dyr: ' + error.message); return false; }

      const lagretDyrId = data?.id || id;
      let bildeUrl = null;
      try {
        if (typeof vetLastOppDyrBilde === 'function') bildeUrl = await vetLastOppDyrBilde(lagretDyrId);
      } catch (bildeFeil) {
        console.warn('Bilde kunne ikke lagres:', bildeFeil);
      }

      if (typeof lastDyr === 'function') await lastDyr();
      vetDyr = unikeDyr(vetDyr);

      setv('dyrId', lagretDyrId || '');
      setv('dyrEierValg', eierId);
      setv('dyreeierId', eierId);
      setv('dyreeierVelgForDyr', eierId);
      const fil = document.getElementById('dyrBildeFil');
      if (fil) fil.value = '';
      if (bildeUrl && typeof vetSettDyrBildePreview === 'function') vetSettDyrBildePreview(bildeUrl);

      if (typeof fyllDyreeierDyrValg === 'function') fyllDyreeierDyrValg(eierId, lagretDyrId || '');
      if (typeof fyllDyrValg === 'function') fyllDyrValg();
      if (typeof fyllJournalDyreeierValg === 'function') fyllJournalDyreeierValg();

      const msg = bildeUrl ? 'Dyr/pasient og bilde lagret.' : 'Dyr/pasient lagret.';
      vetMelding('dyrMelding', msg);
      if (typeof window.vetStackSafeOpenEier === 'function') window.vetStackSafeOpenEier(eierId);
      else if (typeof visVetSide === 'function') visVetSide('eierSide');
      vetMelding('dyreeierMelding', msg);
      if (typeof fyllDyreeierDyrValg === 'function') fyllDyreeierDyrValg(eierId, lagretDyrId || '');
      return false;
    } finally {
      setTimeout(() => { lagrerDyr = false; }, 1000);
      if (knapp) { knapp.disabled = false; knapp.textContent = gammelTekst; }
    }
  }

  window.lagreDyr = lagreDyr = lagreDyrTrygt;

  function kobleEksklusivt() {
    const gammel = document.getElementById('lagreDyrKnapp');
    if (!gammel) return;

    // Klon knappen hver gang. Det fjerner ALLE gamle addEventListener-koblinger.
    const ny = gammel.cloneNode(true);
    ny.dataset.vetAbsoluttSisteLagreDyr = '1';
    ny.disabled = false;
    ny.onclick = lagreDyrTrygt;
    ny.addEventListener('click', lagreDyrTrygt, true);
    gammel.replaceWith(ny);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', kobleEksklusivt, { once: true });
  else kobleEksklusivt();
  window.addEventListener('load', kobleEksklusivt);
  [100, 500, 1500, 3000].forEach(ms => setTimeout(kobleEksklusivt, ms));
})();
/* ===== SLUTT ABSOLUTT SISTE FIX ===== */

/* ===== DYR DETALJVISNING VED ÅPNE 09.06 FINAL ===== */
function vetDetaljEsc(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function vetFinnDyreeierForDyr(dyr) {
  if (!dyr) return null;
  return (vetDyreeiere || []).find(e => String(e.id) === String(dyr.dyreeier_id)) || dyr.vet_dyreeiere || null;
}

function vetFormatDato(dato) {
  if (!dato) return "";
  const tekst = String(dato).slice(0, 10);
  const deler = tekst.split("-");
  if (deler.length === 3) return `${deler[2]}.${deler[1]}.${deler[0]}`;
  return tekst;
}

function vetSørgForDyrDetaljOmrade() {
  const dyrSide = document.getElementById("dyrSide");
  if (!dyrSide) return null;

  let detalj = document.getElementById("dyrDetaljOmrade");
  if (detalj) return detalj;

  detalj = document.createElement("div");
  detalj.id = "dyrDetaljOmrade";
  detalj.className = "listekort";
  detalj.style.margin = "12px 0";
  detalj.style.display = "none";

  const liste = document.getElementById("dyrListe");
  if (liste && liste.parentNode) {
    liste.parentNode.insertBefore(detalj, liste);
  } else {
    dyrSide.insertBefore(detalj, dyrSide.firstChild);
  }

  return detalj;
}

function vetVisDyrDetaljer(dyrId) {
  const detalj = vetSørgForDyrDetaljOmrade();
  if (!detalj) return;

  const d = (vetDyr || []).find(x => String(x.id) === String(dyrId));
  if (!d) {
    detalj.style.display = "none";
    return;
  }

  const eier = vetFinnDyreeierForDyr(d);
  const journaler = (vetJournal || [])
    .filter(j => String(j.dyr_id || "") === String(d.id))
    .sort((a, b) => String(b.dato || "").localeCompare(String(a.dato || "")));

  const bildeHtml = d.bilde_url
    ? `<img src="${vetDetaljEsc(d.bilde_url)}" alt="${vetDetaljEsc(d.navn || "Dyr")}" style="width:130px;height:105px;object-fit:cover;border:1px solid #ddd;border-radius:8px;background:#fafafa;">`
    : `<div style="width:130px;height:105px;border:1px solid #ddd;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#fafafa;color:#777;">Ikke bilde</div>`;

  const linje = (label, verdi) => `
    <div style="display:grid;grid-template-columns:130px 1fr;gap:8px;padding:3px 0;border-bottom:1px solid rgba(0,0,0,.06);">
      <span class="lite"><strong>${vetDetaljEsc(label)}</strong></span>
      <span>${vetDetaljEsc(verdi || "Ikke registrert")}</span>
    </div>`;

  const journalHtml = journaler.length
    ? `<div style="margin-top:12px;">
        <strong>Journal</strong>
        <div style="display:grid;gap:4px;margin-top:6px;">
          ${journaler.slice(0, 6).map(j => `
            <button type="button" class="secondary" onclick="visVetSide('journalSide'); vetSett('journalDyreeierValg','${vetDetaljEsc(d.dyreeier_id || "")}'); fyllDyrValg(); vetSett('journalDyrValg','${vetDetaljEsc(d.id || "")}');" style="text-align:left;">
              ${vetDetaljEsc(vetFormatDato(j.dato))} - ${vetDetaljEsc(j.type || "Journalnotat")} ${Number(j.belop_eks_mva || 0) > 0 ? " - " + formaterKr(j.belop_eks_mva) + " kr eks. mva" : ""}
            </button>
          `).join("")}
        </div>
        <p class="lite">${journaler.length} journalnotat(er) totalt.</p>
      </div>`
    : `<p class="lite" style="margin-top:12px;">Ingen journalnotater registrert på dyret ennå.</p>`;

  detalj.innerHTML = `
    <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;">
      <div>${bildeHtml}</div>
      <div style="flex:1;min-width:240px;">
        <h3 style="margin:0 0 8px 0;">${vetDetaljEsc(d.navn || "Dyr/pasient")}</h3>
        ${linje("Eier", eier?.navn || "")}
        ${linje("Telefon", eier?.telefon || "")}
        ${linje("E-post", eier?.epost || "")}
        ${linje("Art", d.art || "")}
        ${linje("Rase", d.rase || "")}
        ${linje("Kjønn", d.kjonn || "")}
        ${linje("Fødselsdato", vetFormatDato(d.fodselsdato))}
        ${linje("ID-merking", d.idmerking || d.chip || "")}
        ${d.notater ? linje("Notater", d.notater) : ""}
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="secondary" onclick="vetFyllDyrSkjemaForRedigering('${vetDetaljEsc(d.id)}')">Rediger detaljer</button>
          <button type="button" class="secondary" onclick="visVetSide('journalSide'); vetSett('journalDyreeierValg','${vetDetaljEsc(d.dyreeier_id || "")}'); fyllDyrValg(); vetSett('journalDyrValg','${vetDetaljEsc(d.id || "")}');">Ny journal</button>
        </div>
      </div>
    </div>
    ${journalHtml}
  `;
  detalj.style.display = "block";
}

function vetFyllDyrSkjemaForRedigering(id) {
  const d = (vetDyr || []).find(x => String(x.id) === String(id));
  if (!d) return;

  fyllDyreeierValg(d.dyreeier_id || "");
  vetSett("dyrId", d.id || "");
  vetSett("dyrEierValg", d.dyreeier_id || "");
  vetSett("dyrNavn", d.navn || "");
  vetSett("dyrArt", d.art || "");
  vetSett("dyrRase", d.rase || "");
  vetSett("dyrFodselsdato", d.fodselsdato || "");
  vetSett("dyrKjonn", d.kjonn || "");
  vetSett("dyrIdmerking", d.idmerking || d.chip || "");
  vetSett("dyrNotater", d.notater || "");

  if (typeof vetInitDyrBildeUI === "function") vetInitDyrBildeUI();
  if (typeof vetSettDyrBildePreview === "function") vetSettDyrBildePreview(d.bilde_url || "");

  const navn = document.getElementById("dyrNavn");
  if (navn) navn.focus();
}

function redigerDyr(id) {
  visVetSide("dyrSide");
  vetFyllDyrSkjemaForRedigering(id);
  vetVisDyrDetaljer(id);
}

window.redigerDyr = redigerDyr;
window.vetVisDyrDetaljer = vetVisDyrDetaljer;
window.vetFyllDyrSkjemaForRedigering = vetFyllDyrSkjemaForRedigering;
/* ===== SLUTT DYR DETALJVISNING VED ÅPNE 09.06 FINAL ===== */

/* ===== LAGERLOGG FINAL FIX - NAVN + KOMMENTAR-FALLBACK =====
   Viser lagerlogg med lave linjer.
   Henter bilnavn fra vet_biler og varenavn fra vet_varer.
   Hvis en gammel vare_id peker til slettet vare, brukes varenavnet fra kommentar.
*/
(function () {
  const LOGG_TABELL = 'vet_lager_logg';

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function globalArray(navn) {
    try {
      return Function('return (typeof ' + navn + ' !== "undefined" ? ' + navn + ' : [])')() || [];
    } catch (e) {
      return [];
    }
  }

  function globalValue(navn, fallback = null) {
    try {
      const v = Function('return (typeof ' + navn + ' !== "undefined" ? ' + navn + ' : undefined)')();
      return v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function antall0(v) {
    const n = Number(v || 0);
    return Number.isFinite(n) ? String(Math.round(n)) : '0';
  }

  function steder() {
    return ['lagerLoggListe', 'lagerLoggListeFane', 'lagerLoggListeStor', 'minBilLoggListe']
      .map($)
      .filter(Boolean);
  }

  function hentVareFraKommentar(kommentar) {
    const tekst = String(kommentar || '').trim();
    const m = tekst.match(/Fylte\s+[\d.,]+\s+(.+?)\s+p[åa]\s+/i);
    return m?.[1]?.trim() || '';
  }

  function hentBilFraKommentar(kommentar) {
    const tekst = String(kommentar || '').trim();
    const m = tekst.match(/\sp[åa]\s+(.+)$/i);
    return m?.[1]?.trim() || '';
  }

  function navnFraCache(id, cache, felt = 'navn') {
    if (!id) return '';
    const rad = cache.get(String(id));
    return String(rad?.[felt] || '').trim();
  }

  async function hentMap(tabell, ids, select) {
    const map = new Map();
    const unike = [...new Set((ids || []).map(String).filter(Boolean))];
    if (!unike.length || !window.supabaseClient) return map;

    const { data, error } = await supabaseClient
      .from(tabell)
      .select(select)
      .in('id', unike);

    if (error) {
      console.warn('Kunne ikke hente ' + tabell + ' til lagerlogg:', error.message);
      return map;
    }

    (data || []).forEach(rad => map.set(String(rad.id), rad));
    return map;
  }

  async function hentLagerloggRader() {
    if (!window.supabaseClient) return [];

    let query = supabaseClient
      .from(LOGG_TABELL)
      .select('id,created_at,klinikk_id,bil_id,vare_id,antall,type,retning,beholdning_for,beholdning_etter,opprettet_av_epost,opprettet_av_navn,kommentar')
      .order('created_at', { ascending: false })
      .limit(120);

    const aktivKlinikkId = globalValue('vetAktivKlinikkId', null);
    const erSystemAdmin = globalValue('vetErSystemAdmin', false);
    if (aktivKlinikkId && erSystemAdmin !== true) {
      query = query.eq('klinikk_id', aktivKlinikkId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rader = data || [];

    const bilCache = await hentMap('vet_biler', rader.map(r => r.bil_id), 'id,navn,regnr');
    const vareCache = await hentMap('vet_varer', rader.map(r => r.vare_id), 'id,navn,enhet');

    // Ta også med allerede lastede globale arrays hvis de finnes.
    globalArray('vetBiler').forEach(b => bilCache.set(String(b.id), b));
    globalArray('vetVarer').forEach(v => vareCache.set(String(v.id), v));

    return rader.map(r => {
      const bilRad = bilCache.get(String(r.bil_id));
      const vareRad = vareCache.get(String(r.vare_id));
      const bilNavn = [bilRad?.navn, bilRad?.regnr].filter(Boolean).join(' - ') || hentBilFraKommentar(r.kommentar) || 'Ukjent bil';
      const vareNavn = navnFraCache(r.vare_id, vareCache) || hentVareFraKommentar(r.kommentar) || 'Ukjent vare';
      const enhet = vareRad?.enhet || 'stk';
      return { ...r, bilNavn, vareNavn, enhet };
    });
  }

  function renderLagerlogg(rader) {
    const els = steder();
    if (!els.length) return;

    if (!rader || !rader.length) {
      els.forEach(el => el.innerHTML = '<p class="lite">Ingen lagerbevegelser logget ennå.</p>');
      return;
    }

    const html = `
      <div style="display:grid;gap:1px;margin-top:6px;font-size:12px;line-height:1.05;">
        <div style="display:grid;grid-template-columns:88px minmax(105px,1fr) minmax(150px,1.6fr) 54px minmax(95px,1fr);gap:5px;align-items:center;padding:2px 6px;background:#111827;border:1px solid #374151;font-weight:bold;color:#f8fafc;min-height:22px;">
          <span>Tid</span><span>Bil</span><span>Vare</span><span>Ant.</span><span>Bruker</span>
        </div>
        ${rader.map(r => {
          const dato = r.created_at
            ? new Date(r.created_at).toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            : '';
          const bruker = r.opprettet_av_navn || r.opprettet_av_epost || 'Ukjent';
          return `
            <div title="${esc(r.kommentar || '')}" style="display:grid;grid-template-columns:88px minmax(105px,1fr) minmax(150px,1.6fr) 54px minmax(95px,1fr);gap:5px;align-items:center;padding:1px 6px;border:1px solid #374151;background:#1f2427;min-height:22px;">
              <span class="lite" style="white-space:nowrap;font-size:12px;">${esc(dato)}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${esc(r.bilNavn)}</span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${esc(r.vareNavn)}</span>
              <span style="text-align:right;font-size:12px;white-space:nowrap;">${esc(antall0(r.antall))}</span>
              <span class="lite" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${esc(bruker)}</span>
            </div>`;
        }).join('')}
      </div>`;

    els.forEach(el => el.innerHTML = html);
  }

  async function lastVetLagerLogg() {
    const els = steder();
    if (!els.length || !window.supabaseClient) return;

    try {
      const rader = await hentLagerloggRader();
      renderLagerlogg(rader);
    } catch (e) {
      console.warn('Kunne ikke lese lagerlogg:', e);
      els.forEach(el => el.innerHTML = '<p class="lite">Kunne ikke lese lagerlogg: ' + esc(e.message || e) + '</p>');
    }
  }

  function visLagerLoggSide() {
    if (typeof window.visVetSide === 'function') window.visVetSide('lagerLoggSide');
    setTimeout(lastVetLagerLogg, 50);
  }

  window.lastVetLagerLogg = lastVetLagerLogg;
  window.tegnVetLagerLogg = renderLagerlogg;
  window.visLagerLoggSide = visLagerLoggSide;

  const gammelVisVetSide = window.visVetSide;
  if (typeof gammelVisVetSide === 'function' && !gammelVisVetSide.__lagerloggNavnFinal) {
    const nyVisVetSide = function (id) {
      const res = gammelVisVetSide.apply(this, arguments);
      if (String(id) === 'lagerSide' || String(id) === 'lagerLoggSide') {
        setTimeout(lastVetLagerLogg, 100);
      }
      return res;
    };
    nyVisVetSide.__lagerloggNavnFinal = true;
    window.visVetSide = nyVisVetSide;
  }

  document.addEventListener('click', function (e) {
    const knapp = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!knapp) return;
    const tekst = String(knapp.textContent || '').toLowerCase();
    const onclick = String(knapp.getAttribute('onclick') || '').toLowerCase();
    if (tekst.includes('lagerlogg') || onclick.includes('lagerlogg')) {
      setTimeout(lastVetLagerLogg, 100);
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => setTimeout(lastVetLagerLogg, 1500));
  window.addEventListener('load', () => setTimeout(lastVetLagerLogg, 1700));
})();
/* ===== SLUTT LAGERLOGG FINAL FIX ===== */


/* =========================================================
   TVUNGEN FIKS: Journal - medisiner/varer fra bil
   Problem: nedtrekket viser bilnavn, men listen blir stående på "Velg bil først".
   Denne overstyrer bare bilvare-listen i journal.
   ========================================================= */
function vetJournalEscape(verdi) {
  return String(verdi || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function vetJournalBilLabel(b) {
  const eier = b?.veterinaer_navn ? " | " + b.veterinaer_navn : "";
  return [b?.navn, b?.regnr].filter(Boolean).join(" - ") + eier;
}

function vetJournalFinnBilIdHardt() {
  const el = document.getElementById("journalBilValg");
  if (!el) return "";

  let id = String(el.value || "").trim();
  if (id) return id;

  const opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
  id = String(opt?.value || "").trim();
  if (id) { el.value = id; return id; }

  const valgtTekst = String(opt?.textContent || opt?.innerText || "").trim().toLowerCase();
  if (valgtTekst && !valgtTekst.includes("velg bil")) {
    const match = (vetBiler || []).find(b => {
      const label = vetJournalBilLabel(b).toLowerCase();
      return label === valgtTekst || label.includes(valgtTekst) || valgtTekst.includes(String(b.navn || "").toLowerCase()) || valgtTekst.includes(String(b.regnr || "").toLowerCase());
    });
    if (match?.id) { el.value = match.id; return String(match.id); }
  }

  const reelleOptions = Array.from(el.options || []).filter(o => String(o.value || "").trim());
  if (reelleOptions.length) {
    el.value = reelleOptions[0].value;
    return String(reelleOptions[0].value || "").trim();
  }

  if ((vetBiler || []).length) {
    const b = (vetBiler || [])[0];
    if (b?.id) {
      if (!Array.from(el.options || []).some(o => String(o.value) === String(b.id))) {
        const option = document.createElement("option");
        option.value = b.id;
        option.textContent = vetJournalBilLabel(b) || "Bil";
        el.appendChild(option);
      }
      el.value = b.id;
      return String(b.id);
    }
  }

  return "";
}

async function vetJournalHentBilvarerHardt(bilId) {
  let rader = [];

  if (bilId) {
    rader = (vetBilLager || []).filter(r => String(r.bil_id) === String(bilId) && Number(r.antall || 0) > 0);
    if (rader.length) return rader;
  }

  if (!window.supabaseClient) return [];

  // Først: prøv valgt bil uten klinikkfilter. RLS i Supabase skal uansett beskytte data.
  if (bilId) {
    try {
      const { data, error } = await supabaseClient
        .from("vet_bil_lager")
        .select("*, vet_varer(*)")
        .eq("bil_id", bilId)
        .gt("antall", 0);
      if (!error && data?.length) return data;
    } catch (e) {}

    // Hvis relasjonen vet_varer(*) feiler, hent rå rader.
    try {
      const { data, error } = await supabaseClient
        .from("vet_bil_lager")
        .select("*")
        .eq("bil_id", bilId)
        .gt("antall", 0);
      if (!error && data?.length) return data;
    } catch (e) {}
  }

  // Siste nødgrep: hent første bil-lager-rader som faktisk har beholdning.
  try {
    const { data, error } = await supabaseClient
      .from("vet_bil_lager")
      .select("*, vet_varer(*)")
      .gt("antall", 0);
    if (!error && data?.length) {
      const førsteBilId = data[0].bil_id;
      const el = document.getElementById("journalBilValg");
      if (el && førsteBilId) {
        if (!Array.from(el.options || []).some(o => String(o.value) === String(førsteBilId))) {
          const bil = (vetBiler || []).find(b => String(b.id) === String(førsteBilId));
          const option = document.createElement("option");
          option.value = førsteBilId;
          option.textContent = bil ? vetJournalBilLabel(bil) : "Bil med varer";
          el.appendChild(option);
        }
        el.value = førsteBilId;
      }
      return data.filter(r => String(r.bil_id) === String(førsteBilId));
    }
  } catch (e) {}

  try {
    const { data, error } = await supabaseClient
      .from("vet_bil_lager")
      .select("*")
      .gt("antall", 0);
    if (!error && data?.length) return data.filter(r => String(r.bil_id) === String(data[0].bil_id));
  } catch (e) {}

  return [];
}

function vetJournalPrisHardt(vare, rad) {
  return Number(vare?.utsalgspris ?? vare?.utpris ?? vare?.pris ?? vare?.salgspris ?? rad?.utsalgspris ?? rad?.utpris ?? rad?.pris ?? 0) || 0;
}

function vetJournalVarenavnHardt(rad) {
  const vare = rad?.vet_varer || (vetVarer || []).find(v => String(v.id) === String(rad?.vare_id)) || {};
  return vare?.navn || rad?.varenavn || rad?.navn || "Vare/medisin";
}

window.fyllJournalBilVareValg = async function fyllJournalBilVareValgHardt() {
  const liste = document.getElementById("journalBilVareListe");
  const select = document.getElementById("journalBilVareValg");
  if (liste) liste.innerHTML = '<p class="lite">Henter varer/medisiner fra bil ...</p>';

  const bilId = vetJournalFinnBilIdHardt();
  const rader = await vetJournalHentBilvarerHardt(bilId);

  if (!rader.length) {
    if (select) select.innerHTML = '<option value="">Ingen varer i valgt bil</option>';
    if (liste) {
      const antBiler = (vetBiler || []).length;
      const antBilLager = (vetBilLager || []).length;
      liste.innerHTML = `<p class="melding">Ingen varer/medisiner funnet på bil. Biler lastet: ${antBiler}. Bil-lager-rader lastet: ${antBilLager}. Sjekk at bilen faktisk har varer med antall over 0.</p>`;
    }
    return;
  }

  // Oppdater cache slik trekk fra bil-lager bruker samme rader.
  const bil = rader[0]?.bil_id;
  if (bil) {
    const andre = (vetBilLager || []).filter(r => String(r.bil_id) !== String(bil));
    vetBilLager = [...andre, ...rader];
  }

  if (select) {
    select.innerHTML = '<option value="">Velg medisin/vare</option>' + rader.map(r => {
      const vare = r.vet_varer || (vetVarer || []).find(v => String(v.id) === String(r.vare_id)) || {};
      return `<option value="${vetJournalEscape(r.vare_id)}">${vetJournalEscape(vetJournalVarenavnHardt(r))} - på bil: ${Math.floor(Number(r.antall || 0))} ${vetJournalEscape(vare.enhet || "stk")} - ${formaterKr(vetJournalPrisHardt(vare, r))} kr</option>`;
    }).join("");
  }

  if (liste) {
    liste.innerHTML = `
      <div class="vet-linje-liste" style="display:grid;gap:6px;">
        ${rader.map(r => {
          const vare = r.vet_varer || (vetVarer || []).find(v => String(v.id) === String(r.vare_id)) || {};
          const vareId = String(r.vare_id || "");
          const maks = Math.floor(Number(r.antall || 0));
          return `
            <label class="vet-linje-kort" style="display:grid;grid-template-columns:34px minmax(160px,1.6fr) minmax(95px,.8fr) minmax(95px,.7fr) 110px;gap:8px;align-items:center;cursor:pointer;border:1px solid #374151;border-radius:8px;padding:8px;background:#22272a;">
              <input class="journal-bilvare-velg" data-vare-id="${vetJournalEscape(vareId)}" type="checkbox" style="width:auto;margin:0;">
              <span class="lite">${vetJournalEscape(vetJournalVarenavnHardt(r))}</span>
              <span class="lite">På bil: ${maks} ${vetJournalEscape(vare.enhet || "stk")}</span>
              <span class="lite">${formaterKr(vetJournalPrisHardt(vare, r))} kr</span>
              <input class="journal-bilvare-antall" data-vare-id="${vetJournalEscape(vareId)}" type="number" step="1" min="1" max="${maks}" placeholder="Antall" onclick="event.stopPropagation();" style="margin:0;">
            </label>
          `;
        }).join("")}
      </div>`;
  }
};

window.leggTilJournalVarerFraBilListe = async function leggTilJournalVarerFraBilListeHardt() {
  vetMelding("journalMelding", "");
  const bilId = vetJournalFinnBilIdHardt();
  const rader = await vetJournalHentBilvarerHardt(bilId);
  if (!rader.length) { vetMelding("journalMelding", "Ingen varer/medisiner funnet på valgt bil."); return; }

  const valgte = new Set(Array.from(document.querySelectorAll(".journal-bilvare-velg:checked")).map(cb => String(cb.dataset.vareId || "")));
  const linjer = Array.from(document.querySelectorAll(".journal-bilvare-antall"))
    .map(input => ({ vareId: String(input.dataset.vareId || ""), antall: Number(String(input.value || "").replace(",", ".")) }))
    .filter(l => l.vareId && (valgte.has(l.vareId) || l.antall > 0));

  if (!linjer.length) { vetMelding("journalMelding", "Huk av vare og skriv antall."); return; }

  for (const linje of linjer) {
    const rad = rader.find(r => String(r.vare_id) === String(linje.vareId));
    const vare = rad?.vet_varer || (vetVarer || []).find(v => String(v.id) === String(linje.vareId)) || {};
    const beholdning = Math.floor(Number(rad?.antall || 0));
    if (!Number.isInteger(linje.antall) || linje.antall <= 0) { vetMelding("journalMelding", "Antall må være heltall større enn 0."); return; }
    if (linje.antall > beholdning) { vetMelding("journalMelding", `${vetJournalVarenavnHardt(rad)}: ikke nok på bilen. Tilgjengelig: ${beholdning}.`); return; }
    vetJournalVarerTemp.push({
      vare_id: linje.vareId,
      bil_id: rad?.bil_id || bilId,
      varenavn: vetJournalVarenavnHardt(rad),
      antall: linje.antall,
      pris: vetJournalPrisHardt(vare, rad),
      trekk_fra_billager: true
    });
  }
  tegnJournalVareListe();
  oppdaterJournalSum();
  vetMelding("journalMelding", `${linjer.length} varelinje(r) lagt til fra bil.`);
  document.querySelectorAll(".journal-bilvare-velg").forEach(cb => cb.checked = false);
  document.querySelectorAll(".journal-bilvare-antall").forEach(input => input.value = "");
};

function vetJournalBindBilvareHardt() {
  const el = document.getElementById("journalBilValg");
  if (el && !el.dataset.tvungenBilvareFiks) {
    el.dataset.tvungenBilvareFiks = "1";
    el.addEventListener("change", () => window.fyllJournalBilVareValg());
    el.addEventListener("click", () => setTimeout(() => window.fyllJournalBilVareValg(), 50));
    el.addEventListener("input", () => window.fyllJournalBilVareValg());
  }
  const knapp = document.getElementById("leggTilJournalVarerFraBilListeKnapp");
  if (knapp && !knapp.dataset.tvungenBilvareFiks) {
    knapp.dataset.tvungenBilvareFiks = "1";
    knapp.onclick = () => window.leggTilJournalVarerFraBilListe();
  }
}

setInterval(() => {
  vetJournalBindBilvareHardt();
  const liste = document.getElementById("journalBilVareListe");
  const el = document.getElementById("journalBilValg");
  if (liste && el && String(liste.textContent || "").toLowerCase().includes("velg bil først")) {
    window.fyllJournalBilVareValg();
  }
}, 700);

setTimeout(() => { vetJournalBindBilvareHardt(); window.fyllJournalBilVareValg?.(); }, 1000);


/* =========================================================
   PASIENTLISTE EIER -> DYR -> BEHANDLINGER - REN STABIL VERSJON
   2026-06-10
   Erstatter eksperimentelle pasientliste-fikser.
   Flyt:
   1) Vis kun dyreeiere som klikkbar liste.
   2) Klikk eier viser kun dyrene til denne eieren.
   3) Klikk dyr viser behandlingene til dyret.
   4) Ny behandling åpner journal ferdig valgt på riktig eier/dyr.
   ========================================================= */
(function () {
  let valgtEierId = "";
  let valgtDyrId = "";
  let sistTegnet = "";

  function qs(id) { return document.getElementById(id); }
  function v(id) { return String(qs(id)?.value || "").trim(); }
  function setv(id, value) { const x = qs(id); if (x) x.value = value || ""; }
  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  function datoNo(d) {
    const s = String(d || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y,m,day] = s.split("-");
      return `${day}.${m}.${y}`;
    }
    return s;
  }
  function sideErPasienter() {
    const side = qs("eierSide");
    if (!side) return false;
    return !side.classList.contains("skjult") && side.style.display !== "none";
  }
  function arrDyreeiere() {
    try { return (vetDyreeiere || []).slice(); } catch(e) { return []; }
  }
  function arrDyr() {
    try { return (vetDyr || []).slice(); } catch(e) { return []; }
  }
  function arrJournal() {
    try { return (vetJournal || []).slice(); } catch(e) { return []; }
  }
  function eierForDyr(dyr) {
    return arrDyreeiere().find(e => String(e.id) === String(dyr?.dyreeier_id));
  }
  function dyrForEier(eierId) {
    return arrDyr()
      .filter(d => String(d.dyreeier_id) === String(eierId))
      .sort((a,b) => String(a.navn || "").localeCompare(String(b.navn || ""), "nb"));
  }
  function journalForDyr(dyrId) {
    return arrJournal()
      .filter(j => String(j.dyr_id) === String(dyrId))
      .sort((a,b) => String(b.dato || "").localeCompare(String(a.dato || "")) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }
  function antallJournal(dyrId) {
    return journalForDyr(dyrId).length;
  }

  function styleOnce() {
    if (qs("vetPasientTreStil")) return;
    const s = document.createElement("style");
    s.id = "vetPasientTreStil";
    s.textContent = `
      #vetPasientTreRoot { margin-top:10px; }
      .vet-tre-toolbar { display:flex; gap:8px; flex-wrap:wrap; margin:8px 0 12px 0; }
      .vet-tre-toolbar button { width:auto !important; min-height:34px !important; display:inline-block !important; border-radius:8px !important; padding:8px 12px !important; }
      .vet-eier-rad { border:1px solid #374151; border-radius:10px; background:#202528; margin:8px 0; overflow:hidden; }
      .vet-eier-knapp { width:100% !important; display:grid !important; grid-template-columns:minmax(160px,1fr) auto !important; gap:10px !important; text-align:left !important; align-items:center !important; background:#202528 !important; border:0 !important; border-radius:0 !important; padding:10px 12px !important; color:#f8fafc !important; }
      .vet-eier-knapp:hover, .vet-dyr-knapp:hover { outline:1px solid #60a5fa !important; background:#26313a !important; }
      .vet-eier-navn { font-size:18px !important; font-weight:700 !important; line-height:1.1 !important; color:#f8fafc !important; }
      .vet-eier-info { font-size:13px !important; color:#cbd5e1 !important; font-weight:400 !important; margin-top:3px !important; }
      .vet-eier-teller { font-size:13px !important; color:#cbd5e1 !important; white-space:nowrap !important; font-weight:400 !important; }
      .vet-dyr-liste { border-top:1px solid #374151; background:#171a1b; }
      .vet-dyr-rad { border-bottom:1px solid #374151; }
      .vet-dyr-rad:last-child { border-bottom:0; }
      .vet-dyr-knapp { width:100% !important; display:grid !important; grid-template-columns:minmax(130px,1fr) minmax(80px,.7fr) minmax(90px,.8fr) auto !important; gap:8px !important; align-items:center !important; text-align:left !important; background:#1f2528 !important; color:#f3f4f6 !important; border:0 !important; border-radius:0 !important; padding:7px 12px !important; min-height:34px !important; }
      .vet-dyr-knapp.valgt { background:#102033 !important; outline:1px solid #60a5fa !important; }
      .vet-dyr-knapp span { white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important; font-size:13px !important; font-weight:400 !important; color:#f3f4f6 !important; }
      .vet-dyr-knapp .dyrnavn { font-weight:700 !important; }
      .vet-behandling-panel { padding:10px 12px 12px 12px; background:#0f172a; border-top:1px solid #1f6feb; }
      .vet-behandling-topp { display:flex; gap:8px; justify-content:space-between; align-items:center; flex-wrap:wrap; margin-bottom:8px; }
      .vet-behandling-topp strong { font-size:16px; }
      .vet-behandling-topp button { width:auto !important; display:inline-block !important; min-height:32px !important; padding:7px 10px !important; border-radius:8px !important; }
      .vet-behandling-linje { display:grid; grid-template-columns:110px minmax(100px,.7fr) minmax(160px,1.4fr) auto; gap:8px; align-items:start; padding:6px 8px; border:1px solid #374151; background:#202528; margin-top:4px; border-radius:6px; font-size:13px; }
      .vet-behandling-linje span { white-space:normal !important; overflow:visible !important; text-overflow:clip !important; }
      .vet-tom { padding:10px 12px; color:#cbd5e1; }
      @media (max-width:700px) {
        .vet-dyr-knapp { grid-template-columns:1fr; gap:2px; }
        .vet-behandling-linje { grid-template-columns:1fr; }
        .vet-eier-knapp { grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(s);
  }

  function byggPasientTreHtml() {
    const eiere = arrDyreeiere().sort((a,b) => String(a.navn || "").localeCompare(String(b.navn || ""), "nb"));
    if (!eiere.length) {
      return `
        <div class="vet-tom">
          Fant ingen dyreeiere på denne klinikken. Legg inn ny dyreeier, eller sjekk at dyreeiere har riktig klinikk_id.
        </div>`;
    }

    return eiere.map(e => {
      const eierId = String(e.id || "");
      const dyr = dyrForEier(eierId);
      const apen = String(valgtEierId) === eierId;
      const dyrHtml = apen ? `
        <div class="vet-dyr-liste">
          ${dyr.length ? dyr.map(d => byggDyrRad(e, d)).join("") : '<div class="vet-tom">Ingen dyr på denne eieren.</div>'}
        </div>` : "";
      return `
        <div class="vet-eier-rad" data-eier-id="${esc(eierId)}">
          <button type="button" class="vet-eier-knapp" onclick="vetTreVelgEier('${esc(eierId)}')">
            <span>
              <span class="vet-eier-navn">${esc(e.navn || "Uten navn")}</span>
              <span class="vet-eier-info">${esc([e.telefon, e.epost].filter(Boolean).join(" | "))}</span>
            </span>
            <span class="vet-eier-teller">${dyr.length} dyr</span>
          </button>
          ${dyrHtml}
        </div>`;
    }).join("");
  }

  function byggDyrRad(eier, d) {
    const dyrId = String(d.id || "");
    const valgt = String(valgtDyrId) === dyrId;
    const beh = antallJournal(dyrId);
    return `
      <div class="vet-dyr-rad" data-dyr-id="${esc(dyrId)}">
        <button type="button" class="vet-dyr-knapp ${valgt ? "valgt" : ""}" onclick="vetTreVelgDyr('${esc(dyrId)}')">
          <span class="dyrnavn">${esc(d.navn || "Uten navn")}</span>
          <span>${esc(d.art || "")}</span>
          <span>${esc(d.rase || "")}</span>
          <span>${beh} beh.</span>
        </button>
        ${valgt ? byggBehandlingPanel(eier, d) : ""}
      </div>`;
  }

  function byggBehandlingPanel(eier, d) {
    const journaler = journalForDyr(d.id);
    const linjer = journaler.length ? journaler.map(j => {
      const tekst = String(j.notat || j.medisin_kladd || "").replace(/\s+/g, " ").trim();
      const kortTekst = tekst.length > 120 ? tekst.slice(0, 120) + "..." : tekst;
      const sum = Number(j.belop_eks_mva || 0);
      const sumTekst = sum > 0 && typeof formaterKr === "function" ? `${formaterKr(sum)} kr` : "";
      return `
        <div class="vet-behandling-linje">
          <span><strong>${esc(datoNo(j.dato))}</strong></span>
          <span>${esc(j.type || "Behandling")}</span>
          <span>${esc(kortTekst || "Ingen notattekst")}</span>
          <span>${esc(sumTekst)}</span>
        </div>`;
    }).join("") : '<div class="vet-tom">Ingen tidligere behandlinger på dette dyret.</div>';

    return `
      <div class="vet-behandling-panel">
        <div class="vet-behandling-topp">
          <strong>${esc(d.navn || "Dyr")} - tidligere behandlinger</strong>
          <span>
            <button type="button" onclick="vetTreNyBehandling('${esc(d.id)}')">Ny behandling</button>
            <button type="button" class="secondary" onclick="redigerDyr('${esc(d.id)}')">Rediger dyr</button>
          </span>
        </div>
        <div class="lite">Eier: ${esc(eier?.navn || "")} ${d.art ? " | " + esc(d.art) : ""} ${d.rase ? " | " + esc(d.rase) : ""}</div>
        ${linjer}
      </div>`;
  }

  function byggPasientSide() {
    styleOnce();
    const side = qs("eierSide");
    if (!side) return;

    side.innerHTML = `
      <h2>Dyreeiere</h2>
      <h3>Pasientliste</h3>
      <p class="lite">Klikk på en eier for å vise dyrene. Klikk på et dyr for å vise tidligere behandlinger.</p>
      <div class="vet-tre-toolbar">
        <button type="button" class="secondary" onclick="vetTreOppdater()">Oppdater</button>
        <button type="button" class="secondary" onclick="nyDyreeier()">Ny dyreeier</button>
        <button type="button" class="secondary" onclick="nyPasient()">Nytt dyr</button>
      </div>
      <div id="vetPasientTreRoot">${byggPasientTreHtml()}</div>
      <div id="dyreeierMelding" class="melding"></div>
      <input id="dyreeierId" type="hidden">
      <input id="dyreeierVelgForDyr" type="hidden">
      <div id="dyreeierListe" style="display:none"></div>
    `;
    sistTegnet = JSON.stringify({
      e: arrDyreeiere().map(x => [x.id, x.navn, x.telefon, x.epost]),
      d: arrDyr().map(x => [x.id, x.dyreeier_id, x.navn, x.art, x.rase]),
      j: arrJournal().map(x => [x.id, x.dyr_id, x.dato, x.type, x.notat, x.belop_eks_mva]),
      valgtEierId,
      valgtDyrId
    });
  }

  function oppdaterBareHvisEndret() {
    if (!sideErPasienter()) return;
    const now = JSON.stringify({
      e: arrDyreeiere().map(x => [x.id, x.navn, x.telefon, x.epost]),
      d: arrDyr().map(x => [x.id, x.dyreeier_id, x.navn, x.art, x.rase]),
      j: arrJournal().map(x => [x.id, x.dyr_id, x.dato, x.type, x.notat, x.belop_eks_mva]),
      valgtEierId,
      valgtDyrId
    });
    if (now !== sistTegnet) byggPasientSide();
  }

  window.vetTreVelgEier = function (eierId) {
    eierId = String(eierId || "");
    valgtEierId = valgtEierId === eierId ? "" : eierId;
    valgtDyrId = "";
    setv("dyreeierId", valgtEierId);
    setv("dyreeierVelgForDyr", valgtEierId);
    byggPasientSide();
  };

  window.vetTreVelgDyr = function (dyrId) {
    dyrId = String(dyrId || "");
    const d = arrDyr().find(x => String(x.id) === dyrId);
    if (!d) return;
    valgtEierId = String(d.dyreeier_id || "");
    valgtDyrId = valgtDyrId === dyrId ? "" : dyrId;
    setv("dyreeierId", valgtEierId);
    setv("dyreeierVelgForDyr", valgtEierId);
    byggPasientSide();
  };

  window.vetTreNyBehandling = function (dyrId) {
    const d = arrDyr().find(x => String(x.id) === String(dyrId));
    if (!d) return;
    valgtEierId = String(d.dyreeier_id || "");
    valgtDyrId = String(d.id || "");

    if (typeof visVetSide === "function") visVetSide("journalSide");

    setTimeout(() => {
      try { if (typeof fyllJournalDyreeierValg === "function") fyllJournalDyreeierValg(); } catch(e) {}
      setv("journalDyreeierValg", valgtEierId);
      try { if (typeof fyllDyrValg === "function") fyllDyrValg(); } catch(e) {}
      setv("journalDyrValg", valgtDyrId);
      setv("journalDato", new Date().toISOString().split("T")[0]);
      setv("journalNotat", "");
      setv("journalMedisin", "");
      const jl = qs("journalListe");
      if (jl) jl.innerHTML = "";
      const notat = qs("journalNotat");
      if (notat) notat.focus();
    }, 80);
  };

  window.vetTreOppdater = async function () {
    try {
      if (typeof lastDyreeiere === "function") await lastDyreeiere();
      if (typeof lastDyr === "function") await lastDyr();
      if (typeof lastJournal === "function") await lastJournal();
    } catch(e) {
      console.warn("Kunne ikke oppdatere pasienttre", e);
    }
    byggPasientSide();
  };

  const gammelVisVetSide = window.visVetSide || (typeof visVetSide === "function" ? visVetSide : null);
  if (gammelVisVetSide && !window.__vetTreOriginalVisVetSide) {
    window.__vetTreOriginalVisVetSide = gammelVisVetSide;
  }
  window.visVetSide = function (sideId) {
    const original = window.__vetTreOriginalVisVetSide || gammelVisVetSide;
    if (original) original(sideId);
    if (sideId === "eierSide") {
      valgtDyrId = "";
      setTimeout(() => {
        if (!arrDyreeiere().length && typeof lastDyreeiere === "function") lastDyreeiere().then(() => {
          if (typeof lastDyr === "function") return lastDyr();
        }).then(() => {
          if (typeof lastJournal === "function") return lastJournal();
        }).finally(byggPasientSide);
        else byggPasientSide();
      }, 30);
    }
  };

  const gammelTegnDyreeiere = window.tegnDyreeiere || (typeof tegnDyreeiere === "function" ? tegnDyreeiere : null);
  window.tegnDyreeiere = function () {
    if (sideErPasienter()) byggPasientSide();
    else if (gammelTegnDyreeiere) gammelTegnDyreeiere();
  };

  const gammelTegnDyr = window.tegnDyr || (typeof tegnDyr === "function" ? tegnDyr : null);
  window.tegnDyr = function () {
    if (sideErPasienter()) byggPasientSide();
    else if (gammelTegnDyr) gammelTegnDyr();
  };

  const gammelTegnJournal = window.tegnJournal || (typeof tegnJournal === "function" ? tegnJournal : null);
  window.tegnJournal = function () {
    if (sideErPasienter()) {
      oppdaterBareHvisEndret();
      return;
    }
    if (gammelTegnJournal) gammelTegnJournal();
  };

  // Start på Pasienter når alt er lastet.
  window.addEventListener("load", function () {
    setTimeout(() => {
      try { window.visVetSide("eierSide"); } catch(e) { byggPasientSide(); }
    }, 800);
  });
})();

