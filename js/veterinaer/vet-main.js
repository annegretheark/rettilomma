function kobleVet() {
  vetInstallerToppLayoutFiks();
  flyttVetBackupKnappTilBunn();
  document.getElementById("vetOppsettKnapp")?.addEventListener("click", toggleVetOppsettMeny);
  // Ren menykobling
  document.getElementById("vetArbeidKnapp")?.addEventListener("click", toggleVetArbeidMeny);
  document.getElementById("vetMenyPasienterKnapp")?.addEventListener("click", () => visVetSide("eierSide"));
  document.getElementById("vetMenyNyDyreeierKnapp")?.addEventListener("click", () => nyDyreeier());
  document.getElementById("vetMenyNyPasientKnapp")?.addEventListener("click", () => nyPasient());
  document.getElementById("vetMenyJournalKnapp")?.addEventListener("click", () => visVetSide("journalSide"));
  document.getElementById("vetMenyMinBilKnapp")?.addEventListener("click", () => visVetSide("lagerSide"));
  document.getElementById("vetMenyFakturaKnapp")?.addEventListener("click", () => visVetSide("fakturaSide"));

  document.getElementById("vetAdminKlinikkKnapp")?.addEventListener("click", () => visVetSide("klinikkSide"));
  document.getElementById("vetAdminPrisKnapp")?.addEventListener("click", () => visVetSide("prisSide"));
  document.getElementById("vetAdminOversiktKnapp")?.addEventListener("click", () => visVetSide("okonomiSide"));
  document.getElementById("vetAdminLagerKnapp")?.addEventListener("click", () => visVetSide("lagerSide"));
  document.getElementById("vetAdminBackupKnapp")?.addEventListener("click", () => visVetSide("backupSide"));

  document.getElementById("nyDyreeierFastKnapp")?.addEventListener("click", () => nyDyreeier());
  document.getElementById("nyPasientFastKnapp")?.addEventListener("click", () => nyPasient());

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

async function startVetApp() {

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
}

window.startVetApp = startVetApp;


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