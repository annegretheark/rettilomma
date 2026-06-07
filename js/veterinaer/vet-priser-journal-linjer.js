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
