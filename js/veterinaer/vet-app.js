console.log("vet-app.js er lastet");

let vetKlinikker = [];
let vetDyreeiere = [];
let vetDyr = [];
let vetJournal = [];
let vetPriser = [];
let vetAktivKlinikkId = null;
let vetAktivKlinikk = null;
let vetInnloggetEpost = "";
let vetErSystemAdmin = false;
let vetKlinikkRolle = "";
let vetAdminCache = null;
const VET_BILDE_BUCKET = "vet-bilder";
const VET_LOGO_BUCKET = "vet-logoer";
let vetJournalVarerTemp = [];
let vetJournalBehandlingerTemp = [];

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
  document.querySelectorAll("#klinikkSide,#eierSide,#dyrSide,#prisSide,#journalSide,#fakturaSide,#backupSide").forEach(el => {
    el.classList.add("skjult");
    el.style.display = "none";
  });
  const side = document.getElementById(id);
  if (side) {
    side.classList.remove("skjult");
    side.style.display = "";
  }
  if (id === "dyrSide") fyllDyreeierValg();
  if (id === "journalSide") { fyllDyrValg(); fyllPrisValg(); settStandardKmPrisFraKlinikk(); oppdaterJournalSum(); }
  if (id === "fakturaSide") { fyllFakturaDyreeierValg(); settStandardFakturaDatoer(); tegnFakturaGrunnlag(); }
  if (id === "klinikkSide") { oppdaterAdminKlinikkSynlighet(); fyllKlinikkSkjemaMedAktivKlinikk(); settKlinikkSkjemaLesemodusForVanligVet(); }
}




async function hentVetInnloggetEpost() {
  try {
    const { data } = await supabaseClient.auth.getUser();
    vetInnloggetEpost = String(data?.user?.email || "").toLowerCase();
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
    vetAdminCache = false;
    oppdaterAktivKlinikkInfo();
    return;
  }

  if (vetErSystemAdmin) {
    vetAktivKlinikkId = null;
    vetAktivKlinikk = null;
    vetKlinikkRolle = "systemadmin";
    vetAdminCache = true;
    oppdaterAktivKlinikkInfo();
    return;
  }

  const { data, error } = await supabaseClient
    .from("vet_klinikk_brukere")
    .select("klinikk_id, rolle, vet_klinikker(*)")
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

  vetAktivKlinikkId = data?.klinikk_id || null;
  vetAktivKlinikk = data?.vet_klinikker || null;
  vetKlinikkRolle = data?.rolle || "veterinaer";
  vetAdminCache = String(vetKlinikkRolle).toLowerCase() === "admin";

  oppdaterAktivKlinikkInfo();
}

function erKlinikkAdmin() {
  return vetErSystemAdmin || String(vetKlinikkRolle || "").toLowerCase() === "admin";
}

async function erVetAdmin() {
  if (vetAdminCache === null) await lastVetKlinikkTilgang();
  return vetAdminCache === true || vetErSystemAdmin === true;
}

function erVetAdminSync() {
  return erKlinikkAdmin();
}

function oppdaterAktivKlinikkInfo(tekst = "") {
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

function skjulAdminKnapperForVanligVet() {
  // Vanlig veterinær skal fortsatt kunne se prisliste/behandlinger,
  // fordi behandlinger må kunne velges i journalen.
  // Kun backup/import skjules for andre enn systemadmin.
  document.querySelectorAll("button").forEach(knapp => {
    const tekst = String(knapp.textContent || "").toLowerCase();

    if (!vetErSystemAdmin && (tekst.includes("backup") || tekst.includes("import"))) {
      knapp.style.display = "none";
    }
  });
}


async function lastVetData() {
  await lastVetKlinikkTilgang();

  await Promise.all([
    lastKlinikker(),
    lastDyreeiere(),
    lastDyr(),
    lastJournal(),
    lastPriser()
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
  const synlig = erKlinikkAdmin();

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
  const erAdmin = erKlinikkAdmin();
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
      lagringssti: sti,
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
    vetMelding("journalMelding", "Velg behandling/pris før du legger den til.");
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

  if (!vetTekst("journalType")) vetSett("journalType", p.navn || "");
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
        <span class="lite">${formaterKr(v.antall)} x ${formaterKr(v.pris)} kr = ${formaterKr(sum)} kr eks. mva</span><br>
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

  if (antall <= 0) {
    vetMelding("journalMelding", "Antall må være større enn 0.");
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
    varenavn: v.varenavn,
    antall: Number(v.antall || 0),
    pris: Number(v.pris || 0),
    sum_eks_mva: Number(v.antall || 0) * Number(v.pris || 0)
  }));

  const { error } = await supabaseClient
    .from("vet_journal_varer")
    .insert(rader);

  if (error) {
    vetMelding("journalMelding", "Journal lagret, men varer kunne ikke lagres: " + error.message);
    return false;
  }

  return true;
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

function fyllPrisValg() {
  const valg = document.getElementById("journalPrisValg");
  if (!valg) return;

  const aktivePriser = vetPriser.filter(p => p.aktiv !== false);

  if (!aktivePriser.length) {
    valg.innerHTML = '<option value="">Ingen behandlinger/priser funnet</option>';
    return;
  }

  valg.innerHTML = '<option value="">Velg pris / behandling</option>' + aktivePriser
    .map(p => `<option value="${p.id}">${p.navn || ""} - ${p.type || "fastpris"} - ${formaterKr(p.pris)} kr</option>`)
    .join("");
}

function brukValgtPrisIJournal() {
  const id = vetTekst("journalPrisValg");
  const p = vetPriser.find(x => String(x.id) === String(id));
  if (!p) return;
  if (!vetTekst("journalType")) vetSett("journalType", p.navn || "");
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

function brukValgtDyrFraDyreeier() {
  const dyrId = vetTekst("dyreeierDyrValg");
  if (!dyrId) return;
  redigerDyr(dyrId);
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

function fyllDyrValg() {
  const valg = document.getElementById("journalDyrValg");
  if (!valg) return;
  valg.innerHTML = '<option value="">Velg dyr</option>' + vetDyr.map(d => `<option value="${d.id}">${d.navn || ""} - ${d.vet_dyreeiere?.navn || ""}</option>`).join("");
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
    dato: vetTekst("journalDato") || new Date().toISOString().split("T")[0],
    type: vetTekst("journalType") || behandlingsNavn || null,
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
  if (!rad.dyr_id || !rad.notat) { vetMelding("journalMelding", "Velg dyr og skriv journalnotat eller legg til behandling."); return; }
  const { data, error } = await supabaseClient.from("vet_journal").insert(rad).select("id").single();
  if (error) { vetMelding("journalMelding", "Feil ved lagring av journal: " + error.message); return; }

  const bilderOk = await lagreJournalBilder(data?.id);
  const varerOk = await lagreJournalVarer(data?.id);

  ["journalType","journalNotat","journalMedisin","journalFastpris","journalTimepris","journalTimer","journalKm","journalKmPris"].forEach(id => vetSett(id,""));
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

function hentFakturaJournaler() {
  const eier = hentFakturaEier();
  if (!eier) return [];

  const dyreIds = vetDyr
    .filter(d => String(d.dyreeier_id) === String(eier.id))
    .map(d => String(d.id));

  return vetJournal
    .filter(j => dyreIds.includes(String(j.dyr_id)))
    .sort((a, b) => String(a.dato || "").localeCompare(String(b.dato || "")));
}

function lagFakturaLinjerFraJournaler(journaler) {
  const linjer = [];

  journaler.forEach(j => {
    const dyr = vetDyr.find(d => String(d.id) === String(j.dyr_id));
    const dyrNavn = dyr?.navn || j.vet_dyr?.navn || "Dyr";
    const dato = j.dato || "";
    const type = j.type || "Behandling";

    const fastpris = Number(j.fastpris || 0);
    if (fastpris > 0) {
      linjer.push({
        tekst: `${dato} - ${dyrNavn}: ${type}`,
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
        antall,
        pris,
        sum
      });
    });

    if (Number(j.belop_eks_mva || 0) > 0 && fastpris <= 0 && !(timepris > 0 && timer > 0) && !(km > 0 && kmPris > 0)) {
      linjer.push({
        tekst: `${dato} - ${dyrNavn}: ${type}`,
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
            <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px;">Antall</th>
            <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px;">Pris</th>
            <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px;">Sum</th>
          </tr>
        </thead>
        <tbody>
          ${linjer.map(l => `
            <tr>
              <td style="padding:6px; border-bottom:1px solid #eee;">${htmlEscape(l.tekst)}</td>
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

function skrivUtVetFaktura() {
  vetMelding("fakturaMelding", "");
  settStandardFakturaDatoer();

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

  const klinikk = hentFakturaKlinikk();
  const fakturaDato = vetTekst("fakturaDato") || new Date().toISOString().slice(0, 10);
  const forfallsdato = vetTekst("fakturaForfallsdato") || fakturaDato;
  const fakturanr = `VET-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12)}`;
  const sumEks = linjer.reduce((sum, l) => sum + Number(l.sum || 0), 0);
  const mva = sumEks * 0.25;
  const sumInk = sumEks + mva;

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
      Veterinærbehandling, kjøring og varer/medisiner fra journal.
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Beskrivelse</th>
        <th class="right">Antall</th>
        <th class="right">Pris eks. mva</th>
        <th class="right">Sum eks. mva</th>
      </tr>
    </thead>
    <tbody>
      ${linjer.map(l => `
        <tr>
          <td>${htmlEscape(l.tekst)}</td>
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

  const vindu = window.open("", "_blank");
  if (!vindu) {
    vetMelding("fakturaMelding", "Kunne ikke åpne utskrift. Tillat popup-vindu for siden.");
    return;
  }
  vindu.document.open();
  vindu.document.write(printHtml);
  vindu.document.close();
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
  document.getElementById("vetBackupKnapp")?.addEventListener("click", vetLagBackup);
  document.getElementById("vetRestoreKnapp")?.addEventListener("click", vetRestoreBackup);
  document.getElementById("vetImportPriserKnapp")?.addEventListener("click", vetImporterPriserCsv);
  document.getElementById("hentFakturaGrunnlagKnapp")?.addEventListener("click", tegnFakturaGrunnlag);
  document.getElementById("skrivUtVetFakturaKnapp")?.addEventListener("click", skrivUtVetFaktura);
  document.getElementById("fakturaDyreeierValg")?.addEventListener("change", tegnFakturaGrunnlag);
  document.getElementById("klinikkLogoFil")?.addEventListener("change", forhåndsvisKlinikkLogo);
  document.getElementById("opprettKlinikkBrukerKnapp")?.addEventListener("click", opprettKlinikkBruker);
  document.getElementById("lagreKlinikkBrukerKnapp")?.addEventListener("click", lagreKlinikkBruker);
  document.getElementById("lagreKlinikkKnapp")?.addEventListener("click", lagreKlinikk);
  document.getElementById("lagreDyreeierKnapp")?.addEventListener("click", lagreDyreeier);
  document.getElementById("dyreeierDyrValg")?.addEventListener("change", brukValgtDyrFraDyreeier);
  document.getElementById("dyreeierVelgForDyr")?.addEventListener("change", brukValgtDyreeierForDyr);
  document.getElementById("lagreDyrKnapp")?.addEventListener("click", lagreDyr);
  document.getElementById("lagreJournalKnapp")?.addEventListener("click", lagreJournal);
  document.getElementById("lagrePrisKnapp")?.addEventListener("click", lagrePris);
  document.getElementById("nyPrisKnapp")?.addEventListener("click", nullstillPris);
  document.getElementById("journalPrisValg")?.addEventListener("change", brukValgtPrisIJournal);
  document.getElementById("leggTilJournalBehandlingKnapp")?.addEventListener("click", leggTilJournalBehandling);
  document.getElementById("leggTilJournalVareKnapp")?.addEventListener("click", leggTilJournalVare);
  document.getElementById("journalBildeGalleri")?.addEventListener("change", oppdaterJournalBildeInfo);
  document.getElementById("journalBildeKamera")?.addEventListener("change", oppdaterJournalBildeInfo);
  ["journalFastpris","journalTimepris","journalTimer","journalKm","journalKmPris","journalBehandlingAntall","journalVareAntall","journalVarePris"].forEach(id => document.getElementById(id)?.addEventListener("input", oppdaterJournalSum));
  vetSett("journalDato", new Date().toISOString().split("T")[0]);
  if (!vetTekst("journalKmPris")) vetSett("journalKmPris", "5.30");
  settStandardFakturaDatoer();
  fyllFakturaDyreeierValg();
  oppdaterAdminKlinikkSynlighet();
  tegnJournalBehandlingListe();
  tegnJournalVareListe();
}

document.addEventListener("DOMContentLoaded", async () => {
  kobleVet();
  await lastVetData();
  visVetSide("klinikkSide");
});

window.visVetSide = visVetSide;
window.redigerKlinikk = redigerKlinikk;
window.redigerDyreeier = redigerDyreeier;
window.redigerDyr = redigerDyr;
window.fyllDyreeierDyrValg = fyllDyreeierDyrValg;
window.brukValgtDyreeierForDyr = brukValgtDyreeierForDyr;

window.redigerPris = redigerPris;
window.fjernJournalBehandling = fjernJournalBehandling;
window.fjernJournalVare = fjernJournalVare;

window.vetLagBackup = vetLagBackup;
window.vetRestoreBackup = vetRestoreBackup;
window.vetImporterPriserCsv = vetImporterPriserCsv;


window.opprettKlinikkBruker = opprettKlinikkBruker;
window.erVetAdmin = erVetAdmin;
window.skrivUtVetFaktura = skrivUtVetFaktura;
window.tegnFakturaGrunnlag = tegnFakturaGrunnlag;
