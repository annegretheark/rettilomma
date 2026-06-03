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
  if (id === "dyrSide") fyllDyreeierValg();
  if (id === "lagerSide") { fyllLagerValg(); tegnAltLager(); oppdaterLagerSideRollevisning(); }
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

function oppdaterVetMenySynlighet() {
  oppdaterVetToppInfo();

  const vanligVisning = erVetVisningVanlig();
  const systemAdminModus = vetErSystemAdmin && !vanligVisning;
  const adminModus = erKlinikkAdmin() && !vanligVisning;

  // Admin/systemadmin skal ikke ha daglige veterinærknapper i admin-modus.
  // Når admin trykker "Vis som vanlig veterinær" vises veterinærknappene igjen.
  document.querySelectorAll(".vet-bruker-nav").forEach(el => {
    el.style.display = vanligVisning ? "inline-block" : "none";
  });

  document.querySelectorAll(".vet-oppsett-nav").forEach(el => {
    el.style.display = adminModus ? "inline-block" : "none";
  });

  document.querySelectorAll(".vet-admin-nav").forEach(el => {
    el.style.display = adminModus ? "inline-block" : "none";
  });

  document.querySelectorAll(".vet-systemadmin-nav").forEach(el => {
    el.style.display = systemAdminModus ? "inline-block" : "none";
  });

  document.querySelectorAll(".vet-faktura-nav").forEach(el => {
    el.style.display = "inline-block";
  });

  const toggle = document.getElementById("vetVisSomVeterinaerKnapp");
  if (toggle) {
    toggle.style.display = erKlinikkAdmin() ? "inline-block" : "none";
    toggle.textContent = vetVisSomVeterinaer ? "Vis som admin" : "Vis som vanlig veterinær";
  }

  const info = document.getElementById("vetVisningInfo");
  if (info) info.style.display = (erKlinikkAdmin() && vetVisSomVeterinaer) ? "" : "none";

  const undermeny = document.getElementById("vetOppsettMeny");
  if (undermeny && !adminModus) {
    undermeny.classList.add("skjult");
    undermeny.style.display = "none";
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
        <strong>${String(v.varenavn || "").replaceAll("<", "&lt;")}</strong><br>
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
  liste.innerHTML = vetPriser.map(p => `
    <div class="listekort">
      <strong>${p.navn || ""}</strong><br>
      <span class="lite">${p.type || "fastpris"}: ${formaterKr(p.pris)} kr eks. mva${p.beskrivelse ? " | " + p.beskrivelse : ""}</span><br>
      <button type="button" class="secondary" onclick="redigerPris('${p.id}')">Rediger</button>
    </div>
  `).join("");
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
  const { data, error } = await supabaseClient
    .from("fakturaer")
    .select("id,fakturanr,dato,eks_mva,mva,inkl_mva,er_kreditnota,kreditnota_for,kunden_id,status,betalingsstatus")
    .order("dato", { ascending: false });

  if (error) {
    console.warn("Feil ved henting av fakturaer for MVA:", error.message);
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
  const valgt = el.value;
  el.innerHTML = '<option value="">Velg bil</option>' + vetBiler.map(b => {
    const eier = b.veterinaer_navn ? " | " + b.veterinaer_navn : "";
    return `<option value="${b.id}">${[b.navn, b.regnr].filter(Boolean).join(" - ")}${eier}</option>`;
  }).join("");
  if (valgt) el.value = valgt;
  else settStandardBilHvisMulig();
}

function fyllJournalBilVareValg() {
  const el = document.getElementById("journalBilVareValg");
  if (!el) return;
  const bilId = vetTekst("journalBilValg");
  const rader = vetBilLager.filter(r => String(r.bil_id) === String(bilId) && Number(r.antall || 0) > 0);
  if (!bilId) {
    el.innerHTML = '<option value="">Velg bil først</option>';
    return;
  }
  if (!rader.length) {
    el.innerHTML = '<option value="">Ingen varer i valgt bil</option>';
    return;
  }
  el.innerHTML = '<option value="">Velg medisin/vare</option>' + rader.map(r => {
    const v = r.vet_varer || vetVarer.find(x => String(x.id) === String(r.vare_id)) || {};
    return `<option value="${r.vare_id}">${v.navn || "Vare"} - på bil: ${formaterKr(r.antall)} ${v.enhet || "stk"} - ${formaterKr(v.utsalgspris)} kr</option>`;
  }).join("");
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
  if (!vetVarer.length) { liste.innerHTML = '<p class="lite">Ingen medisiner/varer registrert.</p>'; return; }
  liste.innerHTML = vetVarer.map(v => `
    <div class="listekort">
      <strong>${String(v.navn || "").replaceAll("<", "&lt;")}</strong><br>
      <span class="lite">${v.kategori || "medisin"} | ${v.enhet || "stk"} | Pris: ${formaterKr(v.utsalgspris)} kr eks. mva | Minimum: ${formaterKr(v.minimum_antall)}</span><br>
      <button type="button" class="secondary" onclick="redigerVetVare('${v.id}')">Rediger</button>
    </div>
  `).join("");
}

function tegnVetBiler() {
  const liste = document.getElementById("vetBilListe");
  if (!liste) return;
  if (!vetBiler.length) { liste.innerHTML = '<p class="lite">Ingen biler registrert.</p>'; return; }
  liste.innerHTML = vetBiler.map(b => `
    <div class="listekort">
      <strong>${String(b.navn || "").replaceAll("<", "&lt;")}</strong><br>
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
  const vareId = vetTekst("fyllBilVareValg");
  const antall = vetTall("fyllBilAntall");
  if (!klinikkId || !bilId || !vareId) { vetMelding("billagerMelding", "Velg klinikk, bil og vare."); return; }
  if (antall <= 0) { vetMelding("billagerMelding", "Antall må være større enn 0."); return; }

  const hoved = vetHovedlager.find(r => String(r.vare_id) === String(vareId));
  const hovedAntall = Number(hoved?.antall || 0);
  if (hovedAntall < antall) { vetMelding("billagerMelding", `Ikke nok på hovedlager. Tilgjengelig: ${formaterKr(hovedAntall)}.`); return; }
  const bilRad = vetBilLager.find(r => String(r.bil_id) === String(bilId) && String(r.vare_id) === String(vareId));
  const bilNytt = Number(bilRad?.antall || 0) + antall;

  try {
    await settLagerAntall("vet_lager", { klinikk_id: klinikkId, vare_id: vareId }, hovedAntall - antall);
    await settLagerAntall("vet_bil_lager", { klinikk_id: klinikkId, bil_id: bilId, vare_id: vareId }, bilNytt);
    vetSett("fyllBilAntall", "1");
    vetMelding("billagerMelding", "Vare flyttet fra hovedlager til bil.");
    await lastVetLagerAlt();
  } catch (e) {
    vetMelding("billagerMelding", "Feil ved flytting til bil: " + e.message);
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

  liste.innerHTML = rader.map(r => {
    const v = r.vare;
    const navn = htmlEscape(v.navn || "Vare");
    const enhet = htmlEscape(v.enhet || "stk");
    const maks = Math.floor(Number(r.antall || 0));
    return `
      <div class="minbil-varelinje">
        <div>
          <strong>${navn}</strong><br>
          <span class="lite">På hovedlager: ${formaterKr(r.antall)} ${enhet}</span>
        </div>
        <div>
          <label for="minbil_antall_${r.vare_id}">Antall</label>
          <input id="minbil_antall_${r.vare_id}" class="minbil-antall" data-vare-id="${r.vare_id}" type="number" step="1" min="1" max="${maks}" placeholder="Tom" value="">
        </div>
      </div>
    `;
  }).join("");
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
  const linjer = inputs
    .map(input => ({ vareId: input.dataset.vareId, antall: Number(String(input.value || "").replace(",", ".")) }))
    .filter(l => l.vareId && l.antall > 0);

  if (!linjer.length) {
    vetMelding("minBilMelding", "Skriv antall på minst én vare.");
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

async function lagreDyreeier() {
  vetMelding("dyreeierMelding", "");
  const rad = leggTilKlinikkHvisVanligBruker({ navn: vetTekst("dyreeierNavn"), telefon: vetTekst("dyreeierTelefon") || null, epost: vetTekst("dyreeierEpost") || null, adresse: vetTekst("dyreeierAdresse") || null });
  if (!rad.navn) { vetMelding("dyreeierMelding", "Skriv navn på dyreeier."); return; }
  const id = vetTekst("dyreeierId");
  const query = id ? supabaseClient.from("vet_dyreeiere").update(rad).eq("id", id) : supabaseClient.from("vet_dyreeiere").insert(rad);
  const { error } = await query;
  if (error) { vetMelding("dyreeierMelding", "Feil ved lagring av dyreeier: " + error.message); return; }
  ["dyreeierId","dyreeierNavn","dyreeierTelefon","dyreeierEpost","dyreeierAdresse"].forEach(id => vetSett(id,""));
  vetSett("dyreeierVelgForDyr", "");
  fyllDyreeierDyrValg("");
  vetMelding("dyreeierMelding", "Dyreeier lagret.");
  await lastDyreeiere();
  fyllDyreeierValg();
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
  liste.innerHTML = vetJournal.map(j => {
    const sum = Number(j.belop_eks_mva || 0);
    const prislinje = sum > 0 ? `<p><strong>Pris:</strong> ${formaterKr(sum)} kr eks. mva<br><span class="lite">Fastpris: ${formaterKr(j.fastpris)} | Time: ${formaterKr(j.timepris)} x ${j.timer || 0} | Km: ${j.km || 0} x ${formaterKr(j.km_pris)}</span></p>` : "";
    const bilder = (j.vet_journal_bilder || []).map(b => `
      <div style="display:inline-block; margin:6px 8px 6px 0; vertical-align:top; max-width:150px;">
        <a href="${b.bilde_url || "#"}" target="_blank">
          <img src="${b.bilde_url || ""}" alt="${String(b.bildetekst || b.filnavn || "Journalbilde").replaceAll("<", "&lt;")}" style="width:140px; height:100px; object-fit:cover; border-radius:8px; border:1px solid #ddd;">
        </a>
        <div class="lite">${String(b.bildetekst || b.filnavn || "").replaceAll("<", "&lt;")}</div>
      </div>
    `).join("");
    const bildeblokk = bilder ? `<p><strong>Bilder:</strong></p><div>${bilder}</div>` : "";
    const varer = (j.vet_journal_varer || []).map(v => {
      const vareSum = Number(v.sum_eks_mva || (Number(v.antall || 0) * Number(v.pris || 0)));
      return `<li>${String(v.varenavn || "").replaceAll("<", "&lt;")} - ${formaterKr(v.antall)} x ${formaterKr(v.pris)} kr = ${formaterKr(vareSum)} kr</li>`;
    }).join("");
    const vareblokk = varer ? `<p><strong>Varer/medisiner:</strong></p><ul>${varer}</ul>` : "";
    return `<div class="listekort"><strong>${j.dato || ""} - ${j.vet_dyr?.navn || ""}</strong><br><span class="lite">Eier: ${j.vet_dyr?.vet_dyreeiere?.navn || ""} ${j.type ? " | " + j.type : ""}</span><p>${String(j.notat || "").replaceAll("<", "&lt;")}</p>${prislinje}${j.medisin_kladd ? `<p><strong>Medisin/reseptkladd:</strong><br>${String(j.medisin_kladd).replaceAll("<", "&lt;")}</p>` : ""}${vareblokk}${bildeblokk}</div>`;
  }).join("") || '<p class="lite">Ingen journalnotater ennå.</p>';
}




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
  .kort-print { border:1px solid #ddd; border-radius:8px; padding:14px; }
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
