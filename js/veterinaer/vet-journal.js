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
          <img src="${b.bilde_url || ""}" alt="${String(b.bildetekst || b.filnavn || "Journalbilde").replaceAll("<", "&lt;")}" style="width:140px; height:100px; object-fit:cover; border-radius:0; border:1px solid #ddd;">
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
