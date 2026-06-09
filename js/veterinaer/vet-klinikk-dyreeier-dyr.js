/* Split from vet-app.js lines 1783-2142. Keep load order. */
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


