/* Dyreeiere, dyr/pasienter og grunnjournal
   Utskilt fra vet-app.js 2026-06-11. Lastes i samme rekkefølge som originalfilen. */

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

