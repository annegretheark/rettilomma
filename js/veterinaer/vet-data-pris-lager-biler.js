/* Split from vet-app.js lines 424-1782. Keep load order. */
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

