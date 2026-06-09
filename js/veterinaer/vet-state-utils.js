/* Split from vet-app.js lines 1-80. Keep load order. */
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




