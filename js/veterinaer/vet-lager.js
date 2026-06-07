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
  const { data, error } = await supabaseClient
    .from("fakturaer")
    .select("id,fakturanr,dato,eks_mva,mva,inkl_mva,er_kreditnota,kreditnota_for,kunden_id,status,betalingsstatus")
    .order("dato", { ascending: false });

  if (error) {
    console.warn("Feil ved henting av fakturaer for MVA:", error.message);
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
  const vareId = vetTekst("fyllBilVareValg");
  const antall = vetTall("fyllBilAntall");
  if (!klinikkId || !bilId || !vareId) { vetMelding("billagerMelding", "Velg klinikk, bil og vare."); return; }
  if (antall <= 0) { vetMelding("billagerMelding", "Antall må være større enn 0."); return; }

  const hoved = vetHovedlager.find(r => String(r.vare_id) === String(vareId));
  const hovedAntall = Number(hoved?.antall || 0);
  if (hovedAntall < antall) { vetMelding("billagerMelding", `Ikke nok på hovedlager. Tilgjengelig: ${formaterKr(hovedAntall)}.`); return; }
  const bilRad = vetBilLager.find(r => String(r.bil_id) === String(bilId) && String(r.vare_id) === String(vareId));
  const bilNytt = Number(bilRad?.antall || 0) + antall;

  try {
    await settLagerAntall("vet_lager", { klinikk_id: klinikkId, vare_id: vareId }, hovedAntall - antall);
    await settLagerAntall("vet_bil_lager", { klinikk_id: klinikkId, bil_id: bilId, vare_id: vareId }, bilNytt);
    vetSett("fyllBilAntall", "1");
    vetMelding("billagerMelding", "Vare flyttet fra hovedlager til bil.");
    await lastVetLagerAlt();
  } catch (e) {
    vetMelding("billagerMelding", "Feil ved flytting til bil: " + e.message);
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

  liste.innerHTML = rader.map(r => {
    const v = r.vare;
    const navn = htmlEscape(v.navn || "Vare");
    const enhet = htmlEscape(v.enhet || "stk");
    const maks = Math.floor(Number(r.antall || 0));
    return `
      <div class="minbil-varelinje">
        <div>
          <strong>${navn}</strong><br>
          <span class="lite">På hovedlager: ${formaterKr(r.antall)} ${enhet}</span>
        </div>
        <div>
          <label for="minbil_antall_${r.vare_id}">Antall</label>
          <input id="minbil_antall_${r.vare_id}" class="minbil-antall" data-vare-id="${r.vare_id}" type="number" step="1" min="1" max="${maks}" placeholder="Tom" value="">
        </div>
      </div>
    `;
  }).join("");
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
  const linjer = inputs
    .map(input => ({ vareId: input.dataset.vareId, antall: Number(String(input.value || "").replace(",", ".")) }))
    .filter(l => l.vareId && l.antall > 0);

  if (!linjer.length) {
    vetMelding("minBilMelding", "Skriv antall på minst én vare.");
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
