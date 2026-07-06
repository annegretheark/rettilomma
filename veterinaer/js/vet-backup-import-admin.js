/* Backup, restore, CSV-import, klinikkbrukere og init
   Utskilt fra vet-app.js 2026-06-11. Lastes i samme rekkefølge som originalfilen. */

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

async function ventPaSupabaseClient(maxMs = 5000) {
  const start = Date.now();
  while (!window.supabaseClient && Date.now() - start < maxMs) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return !!window.supabaseClient;
}

function vetVisInitFeil(melding, error) {
  console.error("Veterinaer init-feil:", melding, error || "");
  try { document.body.classList.remove("vet-loading"); } catch(e) {}

  const rolleEl = document.getElementById("vetToppRolle");
  if (rolleEl) rolleEl.textContent = "Kunne ikke laste rolle";

  const infoEl = document.getElementById("aktivKlinikkInfo");
  if (infoEl) {
    infoEl.textContent = melding || "Ukjent feil ved oppstart.";
    infoEl.classList.remove("skjult");
    infoEl.style.display = "";
  }

  try { oppdaterVetMenySynlighet(); } catch(e) {}
  try { visVetSide("eierSide"); } catch(e) {}
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (!(await ventPaSupabaseClient())) {
      vetVisInitFeil("Supabase/config.js ble ikke lastet. Sjekk at ../core/config.js finnes fra mappen rettilomma/veterinaer/.");
      return;
    }

    const sessionResult = await supabaseClient.auth.getSession();
    const session = sessionResult?.data?.session;

    if (!session) {
      window.location.replace("veterinaer-login.html");
      return;
    }

    await lastVetKlinikkTilgang();
    try { vetSettToppInfoFallback(); } catch(e) {}
    try { oppdaterVetMenySynlighet(); } catch(e) {}

    if (!vetErSystemAdmin && !vetAktivKlinikkId) {
      // Ikke la skjermen henge på "Laster rolle". Vis årsaken tydelig før eventuell innlogging på nytt.
      vetVisInitFeil("Ingen aktiv klinikk er koblet til denne brukeren. Be admin koble brukeren til klinikk eller bil.");
      return;
    }

    try { kobleVet(); } catch(e) { console.warn("Kobling av knapper feilet, fortsetter:", e); }

    try {
      await lastVetData();
    } catch(e) {
      console.error("Feil ved lasting av veterinærdata:", e);
      vetVisInitFeil("Rolle er lastet, men noen data kunne ikke hentes: " + (e?.message || e));
      return;
    }

    try { vetSettToppInfoFallback(); } catch(e) {}
    try { oppdaterVetMenySynlighet(); } catch(e) {}

    if (erVetVisningVanlig()) {
      visVetSide("eierSide");
    } else {
      visVetSide("okonomiSide");
    }
  } catch(e) {
    vetVisInitFeil("Oppstart stoppet: " + (e?.message || e), e);
  } finally {
    try { document.body.classList.remove("vet-loading"); } catch(e) {}
    try { vetSettToppInfoFallback(); } catch(e) {}
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

