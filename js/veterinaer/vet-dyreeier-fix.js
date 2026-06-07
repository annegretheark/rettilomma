
console.log("vet-dyreeier-fix.js er lastet");

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

  const eksisterendeId = vetTekst("dyreeierId");
  let lagretId = eksisterendeId;

  const query = eksisterendeId
    ? supabaseClient.from("vet_dyreeiere").update(rad).eq("id", eksisterendeId).select("id").single()
    : supabaseClient.from("vet_dyreeiere").insert(rad).select("id").single();

  const { data, error } = await query;

  if (error) {
    vetMelding("dyreeierMelding", "Feil ved lagring av dyreeier: " + error.message);
    return;
  }

  lagretId = data?.id || lagretId;

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

function brukValgtDyreeierForDyr() {
  const dyreeierId = vetTekst("dyreeierVelgForDyr");

  if (!dyreeierId) {
    ["dyreeierId","dyreeierNavn","dyreeierTelefon","dyreeierEpost","dyreeierAdresse"].forEach(id => vetSett(id, ""));
    fyllDyreeierDyrValg("");
    return;
  }

  const e = (vetDyreeiere || []).find(x => String(x.id) === String(dyreeierId));
  if (!e) {
    fyllDyreeierDyrValg("");
    return;
  }

  vetSett("dyreeierId", e.id);
  vetSett("dyreeierNavn", e.navn || "");
  vetSett("dyreeierTelefon", e.telefon || "");
  vetSett("dyreeierEpost", e.epost || "");
  vetSett("dyreeierAdresse", e.adresse || "");
  fyllDyreeierDyrValg(e.id);
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

  if (typeof nullstillDyrSkjemaBeholdEier === "function") {
    nullstillDyrSkjemaBeholdEier();
    vetSett("dyrEierValg", eierId);
  }
}

window.lagreDyreeier = lagreDyreeier;
window.brukValgtDyreeierForDyr = brukValgtDyreeierForDyr;
window.leggTilNyttDyrForValgtDyreeier = leggTilNyttDyrForValgtDyreeier;
