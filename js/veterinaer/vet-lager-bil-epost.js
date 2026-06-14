/* Varer, hovedlager, biler, min bil og lageruttak
   Utskilt fra vet-app.js 2026-06-11. Lastes i samme rekkefølge som originalfilen. */

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
  const liste = document.getElementById("fyllBilFlerListe") || document.getElementById("fyllBilFyllListe");
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
    ${vetFyllBilTopBar('admin')}
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
            <span class="lite" style="font-weight:400 !important;font-size:14px !important;">På lager: ${vetFyllBilHeltall(r.antall)} ${enhet}</span>
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

  const valgt = String(el.value || "").trim();
  el.innerHTML = '<option value="">Velg bil</option>' + (vetBiler || []).map(b => {
    const eier = b.veterinaer_navn ? " | " + b.veterinaer_navn : "";
    const label = [b.navn, b.regnr].filter(Boolean).join(" - ") + eier;
    return `<option value="${b.id}">${label}</option>`;
  }).join("");

  if (valgt) el.value = valgt;

  // Velg automatisk innlogget veterinærs bil, eller eneste bil dersom det bare finnes én.
  if (!el.value) {
    const bil = finnStandardBilForInnloggetVeterinaer();
    if (bil?.id) el.value = bil.id;
  }
  if (!el.value && (vetBiler || []).length === 1) {
    el.value = vetBiler[0].id;
  }

  // Viktig: tegn listen etter at bilen faktisk er satt i selecten.
  setTimeout(() => fyllJournalBilVareValg(), 0);
}

function journalHentValgtBilId() {
  const el = document.getElementById("journalBilValg");
  if (!el) return "";

  let id = String(el.value || "").trim();
  if (id) return id;

  // Hvis nettleseren viser en valgt bil, men value ikke er satt, bruk valgt option.
  const opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
  id = String(opt?.value || "").trim();
  if (id) {
    el.value = id;
    return id;
  }

  // Hvis det bare finnes én faktisk bil i nedtrekket, velg den.
  const reelle = Array.from(el.options || []).filter(o => String(o.value || "").trim());
  if (reelle.length === 1) {
    el.value = reelle[0].value;
    return String(reelle[0].value || "").trim();
  }

  return "";
}

function journalPrisForVare(vare, rad) {
  return Number(
    vare?.utsalgspris ?? vare?.utpris ?? vare?.pris ?? vare?.salgspris ??
    rad?.utsalgspris ?? rad?.utpris ?? rad?.pris ?? 0
  ) || 0;
}

function journalVarenavn(vareId, vare) {
  if (vare?.navn) return vare.navn;
  const funnet = (vetVarer || []).find(v => String(v.id) === String(vareId));
  return funnet?.navn || "Vare/medisin";
}

async function journalHentBilvarer(bilId) {
  let rader = (vetBilLager || [])
    .filter(r => String(r.bil_id) === String(bilId) && Number(r.antall || 0) > 0);

  if (rader.length) return rader;

  // Hent direkte fra Supabase hvis lokal cache ikke er klar.
  try {
    let query = supabaseClient
      .from("vet_bil_lager")
      .select("*, vet_varer(*)")
      .eq("bil_id", bilId)
      .gt("antall", 0)
      .order("created_at", { ascending: true });

    query = filtrerKlinikkQuery(query);

    const { data, error } = await query;
    if (error) throw error;

    rader = data || [];

    // Legg i cache så resten av journalen kan bruke samme data.
    if (rader.length) {
      const andre = (vetBilLager || []).filter(r => String(r.bil_id) !== String(bilId));
      vetBilLager = [...andre, ...rader];
    }
  } catch (e) {
    console.warn("Kunne ikke hente bilvarer:", e);
    const liste = document.getElementById("journalBilVareListe");
    if (liste) liste.innerHTML = `<p class="melding">Kunne ikke hente varer fra bilen: ${String(e.message || e)}</p>`;
    return [];
  }

  return rader;
}

async function fyllJournalBilVareValg() {
  const liste = document.getElementById("journalBilVareListe");
  const select = document.getElementById("journalBilVareValg");
  const bilId = journalHentValgtBilId();

  if (!bilId) {
    if (select) select.innerHTML = '<option value="">Velg bil først</option>';
    if (liste) liste.innerHTML = '<p class="lite">Velg bil først.</p>';
    return;
  }

  if (liste) liste.innerHTML = '<p class="lite">Henter varer/medisiner fra valgt bil ...</p>';

  const rader = await journalHentBilvarer(bilId);

  if (!rader.length) {
    if (select) select.innerHTML = '<option value="">Ingen varer i valgt bil</option>';
    if (liste) liste.innerHTML = '<p class="lite">Ingen varer/medisiner funnet på valgt bil. Sjekk at bilen har beholdning i Bil og lager → Min bil.</p>';
    return;
  }

  if (select) {
    select.innerHTML = '<option value="">Velg medisin/vare</option>' + rader.map(r => {
      const v = r.vet_varer || r.vare || (vetVarer || []).find(x => String(x.id) === String(r.vare_id)) || {};
      const navn = journalVarenavn(r.vare_id, v);
      const pris = journalPrisForVare(v, r);
      return `<option value="${r.vare_id}">${navn} - på bil: ${Math.floor(Number(r.antall || 0))} ${v.enhet || "stk"} - ${formaterKr(pris)} kr</option>`;
    }).join("");
  }

  if (liste) {
    liste.innerHTML = `
      <div class="vet-linje-liste" style="display:grid;gap:6px;">
        ${rader.map(r => {
          const v = r.vet_varer || r.vare || (vetVarer || []).find(x => String(x.id) === String(r.vare_id)) || {};
          const vareId = String(r.vare_id || "");
          const maks = Math.floor(Number(r.antall || 0));
          const navn = journalVarenavn(vareId, v);
          const pris = journalPrisForVare(v, r);
          return `
            <label class="vet-linje-kort" style="display:grid;grid-template-columns:34px minmax(160px,1.6fr) minmax(90px,.8fr) minmax(90px,.7fr) 110px;gap:8px;align-items:center;cursor:pointer;border:1px solid #374151;border-radius:8px;padding:8px;background:#22272a;">
              <input class="journal-bilvare-velg" data-vare-id="${vareId}" type="checkbox" style="width:auto;margin:0;">
              <span class="lite">${navn}</span>
              <span class="lite">På bil: ${maks} ${v.enhet || "stk"}</span>
              <span class="lite">${formaterKr(pris)} kr</span>
              <input class="journal-bilvare-antall" data-vare-id="${vareId}" type="number" step="1" min="1" max="${maks}" placeholder="Antall" onclick="event.stopPropagation();" style="margin:0;">
            </label>
          `;
        }).join("")}
      </div>`;
  }
}

async function leggTilJournalVarerFraBilListe() {
  vetMelding("journalMelding", "");
  const bilId = journalHentValgtBilId();
  if (!bilId) {
    vetMelding("journalMelding", "Velg bil først.");
    return;
  }

  const rader = await journalHentBilvarer(bilId);
  if (!rader.length) {
    vetMelding("journalMelding", "Ingen varer/medisiner funnet på valgt bil.");
    return;
  }

  const valgte = new Set(Array.from(document.querySelectorAll(".journal-bilvare-velg:checked")).map(cb => String(cb.dataset.vareId || "")));
  const linjer = Array.from(document.querySelectorAll(".journal-bilvare-antall"))
    .map(input => ({ vareId: String(input.dataset.vareId || ""), antall: Number(String(input.value || "").replace(",", ".")) }))
    .filter(l => l.vareId && (valgte.has(l.vareId) || l.antall > 0));

  if (!linjer.length) {
    vetMelding("journalMelding", "Velg minst én vare fra bilen og skriv antall.");
    return;
  }

  for (const linje of linjer) {
    const rad = rader.find(r => String(r.vare_id) === String(linje.vareId));
    const vare = rad?.vet_varer || rad?.vare || (vetVarer || []).find(v => String(v.id) === String(linje.vareId)) || {};
    const beholdning = Math.floor(Number(rad?.antall || 0));

    if (!Number.isInteger(linje.antall) || linje.antall <= 0) {
      vetMelding("journalMelding", "Antall må være heltall større enn 0.");
      return;
    }
    if (linje.antall > beholdning) {
      vetMelding("journalMelding", `${journalVarenavn(linje.vareId, vare)}: ikke nok på bilen. Tilgjengelig: ${beholdning}.`);
      return;
    }

    vetJournalVarerTemp.push({
      vare_id: linje.vareId,
      bil_id: bilId,
      varenavn: journalVarenavn(linje.vareId, vare),
      antall: linje.antall,
      pris: journalPrisForVare(vare, rad),
      trekk_fra_billager: true
    });
  }

  tegnJournalVareListe();
  oppdaterJournalSum();
  vetMelding("journalMelding", `${linjer.length} varelinje(r) lagt til fra bil.`);

  document.querySelectorAll(".journal-bilvare-velg").forEach(cb => cb.checked = false);
  document.querySelectorAll(".journal-bilvare-antall").forEach(input => input.value = "");
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
          <span class="lite" style="font-size:14px !important;font-weight:400 !important;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Min: ${vetFyllBilHeltall(v.minimum_antall)}</span>
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
    return `<div class="listekort"><strong>${String(v.navn || vareNavn(r.vare_id)).replaceAll("<", "&lt;")}</strong><br><span class="lite">Hovedlager: ${vetFyllBilHeltall(r.antall)} ${v.enhet || "stk"}${lavt ? " ⚠ lav beholdning" : ""}</span></div>`;
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
        return `<li>${String(v.navn || vareNavn(r.vare_id)).replaceAll("<", "&lt;")}: ${vetFyllBilHeltall(r.antall)} ${v.enhet || "stk"}</li>`;
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

let vetLagreBilKjorer = false;
let vetLagreBilSisteSignatur = "";
let vetLagreBilSisteTid = 0;

async function lagreVetBil() {
  if (vetLagreBilKjorer) return false;

  vetMelding("vetBilMelding", "");
  const klinikkId = hentKlinikkIdForLager();
  if (!klinikkId) { vetMelding("vetBilMelding", "Velg/lagre klinikk før du lager bil."); return false; }

  const rad = {
    klinikk_id: klinikkId,
    navn: vetTekst("vetBilNavn"),
    regnr: vetTekst("vetBilRegnr") || null,
    veterinaer_navn: vetTekst("vetBilVeterinaer") || null,
    aktiv: true
  };
  if (!rad.navn) { vetMelding("vetBilMelding", "Skriv navn på bilen."); return false; }

  const id = vetTekst("vetBilId");
  const signatur = JSON.stringify({ id, ...rad });
  const naa = Date.now();
  if (!id && signatur === vetLagreBilSisteSignatur && (naa - vetLagreBilSisteTid) < 2500) {
    vetMelding("vetBilMelding", "Bilen er allerede lagret. Vent et øyeblikk før du lagrer samme bil igjen.");
    return false;
  }

  const knapp = document.getElementById("lagreVetBilKnapp");
  try {
    vetLagreBilKjorer = true;
    if (knapp) {
      knapp.disabled = true;
      knapp.dataset.originalText = knapp.dataset.originalText || knapp.textContent || "Lagre bil";
      knapp.textContent = "Lagrer bil ...";
    }

    const query = id
      ? supabaseClient.from("vet_biler").update(rad).eq("id", id)
      : supabaseClient.from("vet_biler").insert(rad);

    const { error } = await query;
    if (error) {
      vetMelding("vetBilMelding", "Feil ved lagring av bil: " + error.message);
      return false;
    }

    vetLagreBilSisteSignatur = signatur;
    vetLagreBilSisteTid = Date.now();
    nullstillVetBil();
    vetMelding("vetBilMelding", "Bil lagret.");
    await lastVetLagerAlt();
    return true;
  } finally {
    vetLagreBilKjorer = false;
    if (knapp) {
      knapp.disabled = false;
      knapp.textContent = knapp.dataset.originalText || "Lagre bil";
    }
  }
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


/* ===== FYLL BIL: PDF TIL KLINIKKADMIN + LAGRING ETTERPÅ 2026-06-13 =====
   - Lag PDF og send automatisk henter admin-e-post fra vet_klinikk_brukere per klinikk.
   - PDF sendes automatisk til admin via Supabase Edge Function.
   - Lager og lagerlogg oppdateres først når bruker trykker Fyll bil.
   - Hvis noe mangler, fylles det som finnes og manglene vises i melding/PDF.
*/
let vetFyllBilPending = { admin: null, minbil: null };

function vetFyllBilEsc(verdi) {
  return String(verdi ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function vetFyllBilDatoTekst() {
  try { return new Date().toLocaleString('no-NO'); }
  catch(e) { return new Date().toISOString(); }
}

function vetFyllBilDatoFilnavn() {
  return new Date().toISOString().slice(0,19).replace(/[:T]/g, '-');
}

function vetFyllBilHeltall(verdi) {
  const n = Number(verdi || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n);
}

function vetFyllBilVareObj(vareId, hovedRad) {
  return hovedRad?.vet_varer || (vetVarer || []).find(v => String(v.id) === String(vareId)) || {};
}

function vetFyllBilHentValgte(selectorPrefix, bilId) {
  const inputs = Array.from(document.querySelectorAll('.' + selectorPrefix + '-antall'));
  const valgte = new Set(Array.from(document.querySelectorAll('.' + selectorPrefix + '-velg:checked')).map(cb => String(cb.dataset.vareId || '')));
  return inputs
    .map(input => ({
      vareId: String(input.dataset.vareId || ''),
      antall: Number(String(input.value || '').replace(',', '.'))
    }))
    .filter(l => l.vareId && (valgte.has(String(l.vareId)) || l.antall > 0))
    .map(l => {
      const hoved = (vetHovedlager || []).find(r => String(r.vare_id) === String(l.vareId));
      const vare = vetFyllBilVareObj(l.vareId, hoved);
      return {
        ...l,
        bilId,
        varenavn: vare?.navn || vareNavn(l.vareId),
        enhet: vare?.enhet || 'stk',
        hovedAntall: vetFyllBilHeltall(hoved?.antall || 0)
      };
    });
}

function vetFyllBilValider(linjer) {
  if (!linjer.length) return 'Velg minst én vare fra listen og skriv antall.';
  for (const linje of linjer) {
    if (!(linje.antall > 0)) return 'Skriv antall på alle varene du har valgt.';
    if (!Number.isInteger(linje.antall)) return 'Antall må være heltall.';
  }
  return '';
}

function vetFyllBilDelOppLinjer(linjer) {
  const kanFlyttes = [];
  const mangler = [];
  for (const linje of linjer) {
    const tilgjengelig = vetFyllBilHeltall(linje.hovedAntall);
    const ønsket = vetFyllBilHeltall(linje.antall);
    const flyttes = Math.min(ønsket, tilgjengelig);
    if (flyttes > 0) kanFlyttes.push({ ...linje, antallFlyttes: flyttes, manglerAntall: Math.max(0, ønsket - flyttes) });
    if (tilgjengelig < ønsket) mangler.push({ ...linje, antallMangler: ønsket - tilgjengelig, tilgjengelig });
  }
  return { kanFlyttes, mangler };
}

function vetFyllBilLagSignatur(linjer, bilId) {
  return JSON.stringify({ bilId:String(bilId || ''), linjer:linjer.map(l => [String(l.vareId), Number(l.antall)]) });
}

function vetFyllBilNullstillPending(type, knappId) {
  if (vetFyllBilPending) vetFyllBilPending[type] = null;
  const knapp = document.getElementById(knappId);
  if (knapp) {
    knapp.dataset.fyllBilPdfKlar = '0';
    knapp.textContent = type === 'minbil' ? 'Fyll bil' : 'Fyll bil';
  }
}

async function vetFyllBilFinnAdminEposter(klinikkId) {
  if (!klinikkId || !window.supabaseClient) return [];
  try {
    const { data, error } = await supabaseClient
      .from('vet_klinikk_brukere')
      .select('epost, navn, rolle')
      .eq('klinikk_id', klinikkId)
      .eq('aktiv', true)
      .in('rolle', ['admin', 'systemadmin', 'klinikkadmin']);
    if (error) throw error;
    return (data || [])
      .map(r => ({ epost:String(r.epost || '').trim(), navn:String(r.navn || '').trim(), rolle:String(r.rolle || '').trim() }))
      .filter(r => r.epost);
  } catch(e) {
    console.warn('Kunne ikke hente admin-e-post:', e);
    return [];
  }
}

function vetFyllBilPdfFilnavn(type, bilId) {
  const bil = String(bilNavn(bilId) || 'bil').replace(/[^a-zA-Z0-9æøåÆØÅ_-]+/g, '_').slice(0, 40);
  return `${type === 'minbil' ? 'fyll_min_bil' : 'fyll_bil'}_${bil}_${vetFyllBilDatoFilnavn()}.pdf`;
}

function vetFyllBilLastNedBlob(blob, filnavn) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filnavn;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function vetFyllBilBlobTilBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultat = String(reader.result || '');
      resolve(resultat.includes(',') ? resultat.split(',')[1] : resultat);
    };
    reader.onerror = () => reject(reader.error || new Error('Kunne ikke lese PDF.'));
    reader.readAsDataURL(blob);
  });
}

async function vetFyllBilSendPdfAutomatisk({ klinikkId, admins, filnavn, blob, type, bilId, linjer, mangler }) {
  if (!window.supabaseClient?.functions?.invoke) {
    throw new Error('Supabase Functions er ikke tilgjengelig.');
  }
  const pdfBase64 = await vetFyllBilBlobTilBase64(blob);
  const til = admins.map(a => a.epost).filter(Boolean);
  const { data, error } = await supabaseClient.functions.invoke('send-vet-fyllbil-pdf', {
    body: {
      klinikk_id: klinikkId,
      to: til,
      filename: filnavn,
      pdf_base64: pdfBase64,
      subject: `Fyll bil til kontroll - ${bilNavn(bilId)}`,
      metadata: {
        type,
        bil: bilNavn(bilId),
        laget_av: vetInnloggetBrukerNavn || vetInnloggetEpost || '',
        laget_av_epost: vetInnloggetEpost || '',
        dato: vetFyllBilDatoTekst(),
        varelinjer: linjer.map(l => ({
          vare_id: l.vareId,
          varenavn: l.varenavn,
          bestilt: vetFyllBilHeltall(l.antall),
          lager: vetFyllBilHeltall(l.hovedAntall),
          kan_fylles: Math.min(vetFyllBilHeltall(l.antall), vetFyllBilHeltall(l.hovedAntall)),
          enhet: l.enhet || 'stk'
        })),
        mangler: mangler.map(m => ({
          vare_id: m.vareId,
          varenavn: m.varenavn,
          mangler: vetFyllBilHeltall(m.antallMangler),
          tilgjengelig: vetFyllBilHeltall(m.tilgjengelig),
          enhet: m.enhet || 'stk'
        }))
      }
    }
  });
  if (error) throw error;
  if (data && data.ok === false) throw new Error(data.error || 'E-post ble ikke sendt.');
  return data || { ok: true };
}

function vetFyllBilLastScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="' + src + '"]')) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Kunne ikke laste PDF-bibliotek.'));
    document.head.appendChild(s);
  });
}

async function vetFyllBilLagPdfBlob(type, bilId, linjer) {
  if (!window.jspdf?.jsPDF) {
    await vetFyllBilLastScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const klinikk = vetAktivKlinikk || (vetKlinikker || [])[0] || {};
  const bruker = vetInnloggetBrukerNavn || vetInnloggetEpost || '';
  const tittel = type === 'minbil' ? 'Fyll min bil' : 'Fyll bil fra hovedlager';
  const { mangler } = vetFyllBilDelOppLinjer(linjer);
  let y = 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(tittel, 14, y); y += 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Klinikk: ${klinikk.navn || ''}`, 14, y); y += 5;
  doc.text(`Bil: ${bilNavn(bilId)}`, 14, y); y += 5;
  doc.text(`Laget av: ${bruker}`, 14, y); y += 5;
  doc.text(`Dato: ${vetFyllBilDatoTekst()}`, 14, y); y += 9;

  doc.setFont('helvetica', 'bold');
  doc.text('Vare', 14, y); doc.text('Lager', 112, y, { align:'right' }); doc.text('Bestilt', 140, y, { align:'right' }); doc.text('Kan fylles', 170, y, { align:'right' }); y += 3;
  doc.line(14, y, 196, y); y += 5;
  doc.setFont('helvetica', 'normal');

  linjer.forEach(l => {
    if (y > 275) { doc.addPage(); y = 14; }
    const flyttes = Math.min(vetFyllBilHeltall(l.antall), vetFyllBilHeltall(l.hovedAntall));
    const navn = String(l.varenavn || '').slice(0, 50);
    doc.text(navn, 14, y);
    doc.text(String(vetFyllBilHeltall(l.hovedAntall)), 112, y, { align:'right' });
    doc.text(String(vetFyllBilHeltall(l.antall)), 140, y, { align:'right' });
    doc.text(String(flyttes), 170, y, { align:'right' });
    y += 6;
  });

  if (mangler.length) {
    y += 5;
    if (y > 260) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold');
    doc.text('Mangler / delvis fylt', 14, y); y += 6;
    doc.setFont('helvetica', 'normal');
    mangler.forEach(m => {
      if (y > 275) { doc.addPage(); y = 14; }
      doc.text(`${m.varenavn}: mangler ${m.antallMangler} ${m.enhet}. Tilgjengelig ${m.tilgjengelig}.`, 14, y);
      y += 6;
    });
  }

  y += 8;
  if (y > 260) { doc.addPage(); y = 14; }
  doc.setFontSize(9);
  doc.text('Lager og lagerlogg oppdateres først når bruker trykker Fyll bil i Rett i Lomma.', 14, y);
  y += 18;
  doc.line(14, y, 74, y); doc.line(100, y, 160, y); y += 5;
  doc.text('Signatur', 14, y); doc.text('Kontrollert av', 100, y);

  return doc.output('blob');
}

async function vetFyllBilPdfOgSendAdmin(type) {
  const meldingId = type === 'minbil' ? 'minBilMelding' : 'billagerMelding';
  const bilId = type === 'minbil' ? valgtMinBilId() : vetTekst('fyllBilValg');
  const prefix = type === 'minbil' ? 'minbil' : 'fyllbil';
  const klinikkId = hentKlinikkIdForLager();

  vetMelding(meldingId, '');
  if (!klinikkId || !bilId) { vetMelding(meldingId, 'Velg bil først.'); return false; }

  const linjer = vetFyllBilHentValgte(prefix, bilId);
  const feil = vetFyllBilValider(linjer);
  if (feil) { vetMelding(meldingId, feil); return false; }

  const admins = await vetFyllBilFinnAdminEposter(klinikkId);
  if (!admins.length) {
    vetMelding(meldingId, 'Fant ingen aktiv admin-e-post på denne klinikken i vet_klinikk_brukere.');
    return false;
  }

  try {
    vetMelding(meldingId, 'Lager PDF og sender automatisk til admin ...');
    const blob = await vetFyllBilLagPdfBlob(type, bilId, linjer);
    const filnavn = vetFyllBilPdfFilnavn(type, bilId);
    const { mangler } = vetFyllBilDelOppLinjer(linjer);
    const til = admins.map(a => a.epost).join(', ');

    await vetFyllBilSendPdfAutomatisk({ klinikkId, admins, filnavn, blob, type, bilId, linjer, mangler });

    // Last også ned PDF lokalt som kopi til brukeren.
    try { vetFyllBilLastNedBlob(blob, filnavn); } catch(e) { console.warn('Kunne ikke laste ned lokal PDF-kopi:', e); }

    vetFyllBilPending[type] = { signatur: vetFyllBilLagSignatur(linjer, bilId), bilId, linjer, sendtTil: til, filnavn };
    vetMelding(meldingId, `PDF er sendt automatisk til admin: ${til}, og lastet ned lokalt. Lager/logg oppdateres først når du trykker Fyll bil.`);
    return true;
  } catch(e) {
    console.error(e);
    vetMelding(meldingId, 'Kunne ikke sende PDF automatisk: ' + (e.message || e) + '. Sjekk at Edge Function send-vet-fyllbil-pdf er publisert og at e-postnøkler er satt.');
    return false;
  }
}

function vetFyllBilTopBar(type) {
  return `<div class="lager-ok" style="position:sticky;top:0;z-index:30;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
    <button type="button" class="vet-fyllbil-pdf-knapp" data-fyllbil-type="${type}">Lag PDF og send e-post</button>
    <button type="button" class="secondary vet-fyllbil-lagre-knapp" data-fyllbil-type="${type}">Fyll bil</button>
    <span class="lite">PDF sendes automatisk til klinikkadmin. Lager/logg oppdateres først ved Fyll bil.</span>
  </div>`;
}

async function vetFyllBilLoggRad({ klinikkId, bilId, vareId, antall, beholdningFor, beholdningEtter, kommentar }) {
  if (!window.supabaseClient) return;
  try {
    await supabaseClient.from('vet_lager_logg').insert({
      klinikk_id: klinikkId,
      bil_id: bilId,
      vare_id: vareId,
      antall: vetFyllBilHeltall(antall),
      type: 'fyll_bil',
      retning: 'inn_bil',
      beholdning_for: vetFyllBilHeltall(beholdningFor),
      beholdning_etter: vetFyllBilHeltall(beholdningEtter),
      opprettet_av_epost: vetInnloggetEpost || null,
      opprettet_av_navn: vetInnloggetBrukerNavn || null,
      kommentar: kommentar || null
    });
  } catch(e) {
    console.warn('Kunne ikke skrive lagerlogg:', e);
  }
}

async function vetFyllBilUtførLagring(linjer, bilId, meldingId) {
  const klinikkId = hentKlinikkIdForLager();
  if (!klinikkId || !bilId) throw new Error('Velg bil først.');

  const { kanFlyttes, mangler } = vetFyllBilDelOppLinjer(linjer);
  if (!kanFlyttes.length) {
    const tekst = mangler.length
      ? 'Ingen varer ble flyttet. Mangler på hovedlager: ' + mangler.map(m => `${m.varenavn} mangler ${m.antallMangler}`).join(', ')
      : 'Ingen varer kan flyttes.';
    vetMelding(meldingId, tekst);
    return { flyttet: [], mangler };
  }

  const flyttet = [];
  for (const linje of kanFlyttes) {
    const hoved = (vetHovedlager || []).find(r => String(r.vare_id) === String(linje.vareId));
    const hovedAntall = vetFyllBilHeltall(hoved?.antall || 0);
    const antall = vetFyllBilHeltall(linje.antallFlyttes);
    if (antall <= 0) continue;

    const bilRad = (vetBilLager || []).find(r => String(r.bil_id) === String(bilId) && String(r.vare_id) === String(linje.vareId));
    const bilFor = vetFyllBilHeltall(bilRad?.antall || 0);
    const bilEtter = bilFor + antall;
    const hovedEtter = Math.max(0, hovedAntall - antall);

    await settLagerAntall('vet_lager', { klinikk_id: klinikkId, vare_id: linje.vareId }, hovedEtter);
    await settLagerAntall('vet_bil_lager', { klinikk_id: klinikkId, bil_id: bilId, vare_id: linje.vareId }, bilEtter);
    await vetFyllBilLoggRad({
      klinikkId,
      bilId,
      vareId: linje.vareId,
      antall,
      beholdningFor: bilFor,
      beholdningEtter: bilEtter,
      kommentar: `Fylte ${antall} ${linje.varenavn} på ${bilNavn(bilId)}`
    });
    flyttet.push({ ...linje, antallFlyttet: antall });
  }

  const manglerTekst = mangler.length
    ? ' Mangler/delvis ikke fylt: ' + mangler.map(m => `${m.varenavn} mangler ${m.antallMangler} ${m.enhet}`).join(', ') + '.'
    : '';
  vetMelding(meldingId, `Fyll bil lagret. ${flyttet.length} varelinje(r) er flyttet til bilen.${manglerTekst}`);
  return { flyttet, mangler };
}
/* ===== SLUTT FYLL BIL PDF TIL ADMIN ===== */

async function flyttTilBil() {
  vetMelding("billagerMelding", "");
  const klinikkId = hentKlinikkIdForLager();
  const bilId = vetTekst("fyllBilValg");
  const knapp = document.getElementById("flyttTilBilKnapp");

  if (!klinikkId || !bilId) {
    vetMelding("billagerMelding", "Velg bil først.");
    return;
  }

  const linjer = vetFyllBilHentValgte('fyllbil', bilId);
  const feil = vetFyllBilValider(linjer);
  if (feil) {
    vetMelding("billagerMelding", feil);
    return;
  }

  try {
    if (knapp) { knapp.disabled = true; knapp.textContent = 'Fyller bil ...'; }
    await vetFyllBilUtførLagring(linjer, bilId, 'billagerMelding');
    vetFyllBilNullstillPending('admin', 'flyttTilBilKnapp');
    await lastVetLagerAlt();
    tegnFyllBilFyllListe();
    if (typeof window.tegnLagerLogg === 'function') window.tegnLagerLogg();
  } catch (e) {
    vetMelding("billagerMelding", "Feil ved fylling av bil: " + (e.message || e));
  } finally {
    if (knapp) {
      knapp.disabled = false;
      knapp.textContent = 'Fyll bil';
    }
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
    ${vetFyllBilTopBar('minbil')}
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
            <span class="lite" style="font-weight:400 !important;font-size:14px !important;">På lager: ${vetFyllBilHeltall(r.antall)} ${enhet}</span>
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
    return `<div class="listekort"><strong>${htmlEscape(v.navn || vareNavn(r.vare_id))}</strong><br><span class="lite">${vetFyllBilHeltall(r.antall)} ${htmlEscape(v.enhet || "stk")}</span></div>`;
  }).join("");
}

async function fyllMinBilMedFlereVarer() {
  vetMelding("minBilMelding", "");
  const klinikkId = hentKlinikkIdForLager();
  const bilId = valgtMinBilId();
  const knapp = document.getElementById("fyllMinBilFlereKnapp");

  if (!klinikkId || !bilId) {
    vetMelding("minBilMelding", "Velg bil først.");
    return;
  }

  const linjer = vetFyllBilHentValgte('minbil', bilId);
  const feil = vetFyllBilValider(linjer);
  if (feil) {
    vetMelding("minBilMelding", feil);
    return;
  }

  try {
    if (knapp) { knapp.disabled = true; knapp.textContent = 'Fyller bil ...'; }
    await vetFyllBilUtførLagring(linjer, bilId, 'minBilMelding');
    vetFyllBilNullstillPending('minbil', 'fyllMinBilFlereKnapp');
    await lastVetLagerAlt();
    fyllMinBilSide();
    if (typeof window.tegnLagerLogg === 'function') window.tegnLagerLogg();
  } catch (e) {
    vetMelding("minBilMelding", "Feil ved fylling av bil: " + (e.message || e));
  } finally {
    if (knapp) {
      knapp.disabled = false;
      knapp.textContent = 'Fyll bil';
    }
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
  if (beholdning < antall) { vetMelding("journalMelding", `Ikke nok på bilen. Tilgjengelig: ${vetFyllBilHeltall(beholdning)}.`); return; }
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



// FIX 1106: Fyll bil er eget menypunkt, men skjemaet ligger inne på Bil og lager.
// Denne viser riktig side, åpner admin-lagerområdet og tegner bilvalg + vareliste.
window.visFyllBilSide = async function visFyllBilSide() {
  try {
    visVetSide('lagerSide');
    const adminOmrade = document.getElementById('adminLagerOmrade');
    const minBilOmrade = document.getElementById('minBilOmrade');
    if (adminOmrade) adminOmrade.style.display = '';
    if (minBilOmrade && erKlinikkAdmin && erKlinikkAdmin()) minBilOmrade.style.display = 'none';

    if (typeof lastVetLagerAlt === 'function') await lastVetLagerAlt();
    if (typeof fyllLagerValg === 'function') fyllLagerValg();
    if (typeof tegnFyllBilFyllListe === 'function') tegnFyllBilFyllListe();

    const block = document.getElementById('fyllBilFlerListe');
    if (block) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    console.error('visFyllBilSide feilet', e);
    if (typeof vetMelding === 'function') vetMelding('billagerMelding', 'Kunne ikke åpne Fyll bil: ' + (e.message || e));
  }
};


/* SAFE FIX 2026-06-11: Lagerfaner uten å kreve konsoll.
   Beholder eksisterende HTML og deler bare visningen i faner etter at siden er lastet. */
(function () {
  function safeEl(id) { return document.getElementById(id); }

  function visBare(ids, aktivId) {
    ids.forEach(function (id) {
      var el = safeEl(id);
      if (el) el.style.display = (id === aktivId) ? '' : 'none';
    });
  }

  function byggAdminLagerUnderfaner() {
    var admin = safeEl('adminLagerOmrade');
    if (!admin || safeEl('adminLagerUnderfaner')) return;

    var h3er = Array.from(admin.querySelectorAll('h3'));
    if (!h3er.length) return;

    var grupper = [
      { id: 'adminVarerOmrade', tekst: 'Varer', treff: 'medisin' },
      { id: 'adminHovedlagerOmrade', tekst: 'Hovedlager', treff: 'sentral' },
      { id: 'adminBilerOmrade', tekst: 'Biler', treff: 'biler' },
      { id: 'adminFyllBilOmrade', tekst: 'Fyll bil', treff: 'fyll bil' },
      { id: 'adminLagerLoggOmrade', tekst: 'Lagerlogg', treff: 'siste lagerlogg' }
    ];

    var nav = document.createElement('div');
    nav.id = 'adminLagerUnderfaner';
    nav.className = 'lager-faner';
    nav.style.marginTop = '12px';
    nav.innerHTML = grupper.map(function (g) {
      return '<button type="button" class="secondary" data-admin-lager-fane="' + g.id + '">' + g.tekst + '</button>';
    }).join('');

    var intro = admin.querySelector('p.lite');
    if (intro && intro.parentNode === admin) intro.insertAdjacentElement('afterend', nav);
    else admin.insertBefore(nav, admin.firstChild);

    h3er.forEach(function (h3) {
      var tekst = (h3.textContent || '').trim().toLowerCase();
      var gruppe = grupper.find(function (g) { return tekst.indexOf(g.treff) !== -1; });
      if (!gruppe || safeEl(gruppe.id)) return;

      var wrap = document.createElement('div');
      wrap.id = gruppe.id;
      wrap.className = 'admin-lager-fane';
      h3.parentNode.insertBefore(wrap, h3);

      var node = h3;
      while (node) {
        var neste = node.nextSibling;
        if (neste && neste.nodeType === 1 && neste.tagName === 'H3') {
          wrap.appendChild(node);
          break;
        }
        wrap.appendChild(node);
        node = neste;
        if (node && node.nodeType === 1 && node.tagName === 'H3') break;
      }
    });

    nav.querySelectorAll('[data-admin-lager-fane]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.visAdminLagerFane(btn.getAttribute('data-admin-lager-fane'));
      });
    });
  }

  window.visAdminLagerFane = function (aktivId) {
    byggAdminLagerUnderfaner();
    var ids = ['adminVarerOmrade','adminHovedlagerOmrade','adminBilerOmrade','adminFyllBilOmrade','adminLagerLoggOmrade'];
    visBare(ids, aktivId || 'adminVarerOmrade');
    if ((aktivId || '') === 'adminFyllBilOmrade' && typeof tegnFyllBilFyllListe === 'function') {
      tegnFyllBilFyllListe();
    }
  };

  window.visLagerFane = function (faneId) {
    var ids = ['minBilOmrade','adminLagerOmrade','bestillingOmrade','lagerLoggOmrade'];
    visBare(ids, faneId || 'minBilOmrade');

    if (faneId === 'minBilOmrade' && typeof fyllMinBilSide === 'function') fyllMinBilSide();
    if (faneId === 'adminLagerOmrade') {
      byggAdminLagerUnderfaner();
      window.visAdminLagerFane('adminVarerOmrade');
      if (typeof tegnAltLager === 'function') tegnAltLager();
    }
    if (faneId === 'bestillingOmrade' && typeof tegnBestillingListe === 'function') tegnBestillingListe();
    if (faneId === 'lagerLoggOmrade' && typeof tegnLagerLogg === 'function') tegnLagerLogg();
  };

  window.visFyllBilSide = async function () {
    try {
      if (typeof visVetSide === 'function') visVetSide('lagerSide');
      if (typeof lastVetLagerAlt === 'function') await lastVetLagerAlt();
      window.visLagerFane('adminLagerOmrade');
      window.visAdminLagerFane('adminFyllBilOmrade');
    } catch (e) {
      console.warn('Kunne ikke åpne Fyll bil', e);
      if (typeof vetMelding === 'function') vetMelding('billagerMelding', 'Kunne ikke åpne Fyll bil: ' + (e.message || e));
    }
  };

  function startTrygt() {
    try {
      byggAdminLagerUnderfaner();
      var admin = safeEl('adminLagerOmrade');
      if (admin && admin.style.display !== 'none') window.visAdminLagerFane('adminVarerOmrade');
    } catch (e) {
      console.warn('Trygg lagerfane-start feilet', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTrygt);
  } else {
    startTrygt();
  }
  window.addEventListener('load', startTrygt);
})();


/* Reset PDF-klar status hvis bruker endrer bil/antall etter PDF er laget. */
(function(){
  function bindReset(){
    const adminBil = document.getElementById('fyllBilValg');
    const minBil = document.getElementById('minBilValg');
    if (adminBil && !adminBil.dataset.pdfResetKoblet) {
      adminBil.dataset.pdfResetKoblet = '1';
      adminBil.addEventListener('change', () => vetFyllBilNullstillPending('admin','flyttTilBilKnapp'));
    }
    if (minBil && !minBil.dataset.pdfResetKoblet) {
      minBil.dataset.pdfResetKoblet = '1';
      minBil.addEventListener('change', () => vetFyllBilNullstillPending('minbil','fyllMinBilFlereKnapp'));
    }
    document.querySelectorAll('.fyllbil-antall,.fyllbil-velg').forEach(el => {
      if (el.dataset.pdfResetKoblet) return;
      el.dataset.pdfResetKoblet = '1';
      el.addEventListener('input', () => vetFyllBilNullstillPending('admin','flyttTilBilKnapp'));
      el.addEventListener('change', () => vetFyllBilNullstillPending('admin','flyttTilBilKnapp'));
    });
    document.querySelectorAll('.minbil-antall,.minbil-velg').forEach(el => {
      if (el.dataset.pdfResetKoblet) return;
      el.dataset.pdfResetKoblet = '1';
      el.addEventListener('input', () => vetFyllBilNullstillPending('minbil','fyllMinBilFlereKnapp'));
      el.addEventListener('change', () => vetFyllBilNullstillPending('minbil','fyllMinBilFlereKnapp'));
    });
  }
  document.addEventListener('click', function(e){
    if (e.target?.closest?.('#lagerSide')) setTimeout(bindReset, 0);
  }, true);
  window.addEventListener('load', () => setTimeout(bindReset, 500));
})();


/* ===== FYLL BIL: knappetekst og bunnknapper ===== */
(function(){
  function ryddFyllBilKnapper(){
    const admin = document.getElementById('flyttTilBilKnapp');
    if (admin) admin.textContent = 'Fyll bil';
    const min = document.getElementById('fyllMinBilFlereKnapp');
    if (min) min.textContent = 'Fyll bil';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ryddFyllBilKnapper, { once:true });
  else ryddFyllBilKnapper();
  window.addEventListener('load', ryddFyllBilKnapper);
})();


/* ===== FYLL BIL: robust kobling for Lag PDF-knapp 2026-06-13 =====
   Noen nettlesere/lastrekkefølger mister inline onclick på dynamisk HTML.
   Derfor eksponeres funksjonene på window og knappene kobles også med event delegation.
*/
(function(){
  try { window.vetFyllBilPdfOgSendAdmin = vetFyllBilPdfOgSendAdmin; } catch(e) {}
  try { window.fyllMinBilMedFlereVarer = fyllMinBilMedFlereVarer; } catch(e) {}
  try { window.flyttTilBil = flyttTilBil; } catch(e) {}
  try { window.tegnMinBilFyllListe = tegnMinBilFyllListe; } catch(e) {}
  try { window.tegnFyllBilFyllListe = tegnFyllBilFyllListe; } catch(e) {}

  document.addEventListener('click', function(ev){
    const pdfBtn = ev.target && ev.target.closest ? ev.target.closest('.vet-fyllbil-pdf-knapp') : null;
    if (pdfBtn) {
      ev.preventDefault();
      ev.stopPropagation();
      const type = pdfBtn.getAttribute('data-fyllbil-type') || (pdfBtn.closest('#minBilOmrade') ? 'minbil' : 'admin');
      if (typeof window.vetFyllBilPdfOgSendAdmin === 'function') {
        window.vetFyllBilPdfOgSendAdmin(type);
      } else if (typeof vetMelding === 'function') {
        vetMelding(type === 'minbil' ? 'minBilMelding' : 'billagerMelding', 'PDF-funksjonen er ikke lastet. Trykk Ctrl+F5 og prøv igjen.');
      }
      return false;
    }

    const lagreBtn = ev.target && ev.target.closest ? ev.target.closest('.vet-fyllbil-lagre-knapp') : null;
    if (lagreBtn) {
      ev.preventDefault();
      ev.stopPropagation();
      const type = lagreBtn.getAttribute('data-fyllbil-type') || (lagreBtn.closest('#minBilOmrade') ? 'minbil' : 'admin');
      if (type === 'minbil' && typeof window.fyllMinBilMedFlereVarer === 'function') window.fyllMinBilMedFlereVarer();
      else if (typeof window.flyttTilBil === 'function') window.flyttTilBil();
      return false;
    }
  }, true);
})();
/* ===== SLUTT ROBUST FYLL BIL-KOBLING ===== */


/* ===== FYLL BIL PDF: hard kobling 2026-06-14 =====
   Sikrer at Lag PDF-knappen reagerer også når HTML tegnes på nytt inne i lagerfaner.
*/
(function(){
  function msg(type, tekst) {
    try { vetMelding(type === 'minbil' ? 'minBilMelding' : 'billagerMelding', tekst); } catch(e) {}
  }

  async function startPdf(type, knapp) {
    type = type === 'minbil' ? 'minbil' : 'admin';
    if (knapp) {
      knapp.disabled = true;
      knapp.dataset.originalText = knapp.dataset.originalText || knapp.textContent || 'Lag PDF og send e-post';
      knapp.textContent = 'Sender PDF ...';
    }
    msg(type, 'Lager PDF og sender e-post til klinikkadmin ...');
    try {
      if (typeof vetFyllBilPdfOgSendAdmin !== 'function') {
        throw new Error('PDF-funksjonen er ikke lastet. Trykk Ctrl+F5 og prøv igjen.');
      }
      await vetFyllBilPdfOgSendAdmin(type);
    } catch(e) {
      console.error('Lag PDF feilet:', e);
      msg(type, 'Kunne ikke lage/sende PDF: ' + (e && e.message ? e.message : e));
    } finally {
      if (knapp) {
        knapp.disabled = false;
        knapp.textContent = knapp.dataset.originalText || 'Lag PDF og send e-post';
      }
    }
    return false;
  }

  async function startLagre(type, knapp) {
    type = type === 'minbil' ? 'minbil' : 'admin';
    if (knapp) {
      knapp.disabled = true;
      knapp.dataset.originalText = knapp.dataset.originalText || knapp.textContent || 'Fyll bil';
      knapp.textContent = 'Fyller bil ...';
    }
    try {
      if (type === 'minbil') await fyllMinBilMedFlereVarer();
      else await flyttTilBil();
    } finally {
      if (knapp) {
        knapp.disabled = false;
        knapp.textContent = knapp.dataset.originalText || 'Fyll bil';
      }
    }
    return false;
  }

  window.vetFyllBilStartPdfFraKnapp = function(knapp, ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); try { ev.stopImmediatePropagation(); } catch(e) {} }
    const type = knapp?.dataset?.fyllbilType || (knapp?.closest?.('#minBilOmrade') ? 'minbil' : 'admin');
    return startPdf(type, knapp);
  };

  window.vetFyllBilStartLagreFraKnapp = function(knapp, ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); try { ev.stopImmediatePropagation(); } catch(e) {} }
    const type = knapp?.dataset?.fyllbilType || (knapp?.closest?.('#minBilOmrade') ? 'minbil' : 'admin');
    return startLagre(type, knapp);
  };

  function bindKnapper() {
    document.querySelectorAll('.vet-fyllbil-pdf-knapp').forEach(function(knapp){
      if (knapp.dataset.hardPdfKoblet === '1') return;
      knapp.dataset.hardPdfKoblet = '1';
      knapp.removeAttribute('onclick');
      knapp.addEventListener('click', function(ev){
        return window.vetFyllBilStartPdfFraKnapp(knapp, ev);
      }, true);
    });
    document.querySelectorAll('.vet-fyllbil-lagre-knapp').forEach(function(knapp){
      if (knapp.dataset.hardLagreKoblet === '1') return;
      knapp.dataset.hardLagreKoblet = '1';
      knapp.removeAttribute('onclick');
      knapp.addEventListener('click', function(ev){
        return window.vetFyllBilStartLagreFraKnapp(knapp, ev);
      }, true);
    });
  }

  document.addEventListener('click', function(ev){
    const pdf = ev.target?.closest?.('.vet-fyllbil-pdf-knapp');
    if (pdf) return window.vetFyllBilStartPdfFraKnapp(pdf, ev);
    const lagre = ev.target?.closest?.('.vet-fyllbil-lagre-knapp');
    if (lagre) return window.vetFyllBilStartLagreFraKnapp(lagre, ev);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindKnapper);
  else bindKnapper();
  window.addEventListener('load', function(){ setTimeout(bindKnapper, 200); setTimeout(bindKnapper, 1000); });
  try { new MutationObserver(function(){ bindKnapper(); }).observe(document.documentElement, { childList:true, subtree:true }); } catch(e) {}
})();
/* ===== SLUTT HARD KOBLING ===== */

/* ===== FIX 2026-06-14: Varer i behandlingsbildet beholdes =====
   E-postversjonen av Lag PDF beholdes over.
   Denne delen overstyrer bare henting/visning av varer fra bil i journalen.
*/

// Overstyr direkte henting av bilvarer i journalen. Bruker både cache og Supabase.
async function journalHentBilvarer(bilId) {
  bilId = String(bilId || '').trim();
  if (!bilId) return [];

  let rader = (vetBilLager || [])
    .filter(r => String(r.bil_id) === String(bilId) && Number(r.antall || 0) > 0);

  if (rader.length) return rader;

  try {
    let query = supabaseClient
      .from('vet_bil_lager')
      .select('id,klinikk_id,bil_id,vare_id,antall,minimum_antall,created_at,vet_varer(*)')
      .eq('bil_id', bilId)
      .gt('antall', 0)
      .order('created_at', { ascending: true });

    const klinikkId = hentKlinikkIdForLager();
    if (klinikkId && !vetErSystemAdmin) query = query.eq('klinikk_id', klinikkId);

    const { data, error } = await query;
    if (error) throw error;

    rader = data || [];

    if (rader.length) {
      const andre = (vetBilLager || []).filter(r => String(r.bil_id) !== String(bilId));
      vetBilLager = [...andre, ...rader];
    }
  } catch (e) {
    console.warn('Kunne ikke hente bilvarer til journal:', e);
    const liste = document.getElementById('journalBilVareListe');
    if (liste) liste.innerHTML = `<p class="melding">Kunne ikke hente varer fra bilen: ${String(e.message || e)}</p>`;
    return [];
  }

  return rader;
}

// Overstyr visning i behandlingsbildet: tydeligere og sikker ved bilbytte.
async function fyllJournalBilVareValg() {
  const liste = document.getElementById('journalBilVareListe');
  const select = document.getElementById('journalBilVareValg');
  const bilId = journalHentValgtBilId();

  if (!bilId) {
    if (select) select.innerHTML = '<option value="">Velg bil først</option>';
    if (liste) liste.innerHTML = '<p class="lite">Velg bil først.</p>';
    return;
  }

  if (liste) liste.innerHTML = '<p class="lite">Henter varer/medisiner fra valgt bil ...</p>';

  const rader = await journalHentBilvarer(bilId);

  if (!rader.length) {
    if (select) select.innerHTML = '<option value="">Ingen varer i valgt bil</option>';
    if (liste) liste.innerHTML = '<p class="lite">Ingen varer/medisiner funnet på valgt bil. Sjekk Bil og lager → Min bil / Fyll bil.</p>';
    return;
  }

  if (select) {
    select.innerHTML = '<option value="">Velg medisin/vare</option>' + rader.map(r => {
      const v = r.vet_varer || r.vare || (vetVarer || []).find(x => String(x.id) === String(r.vare_id)) || {};
      const navn = journalVarenavn(r.vare_id, v);
      const pris = journalPrisForVare(v, r);
      return `<option value="${r.vare_id}">${htmlEscape(navn)} - på bil: ${Math.floor(Number(r.antall || 0))} ${htmlEscape(v.enhet || 'stk')} - ${formaterKr(pris)} kr</option>`;
    }).join('');
  }

  if (liste) {
    liste.innerHTML = `
      <div class="vet-linje-liste" style="display:grid;gap:4px;">
        ${rader.map(r => {
          const v = r.vet_varer || r.vare || (vetVarer || []).find(x => String(x.id) === String(r.vare_id)) || {};
          const vareId = String(r.vare_id || '');
          const maks = Math.floor(Number(r.antall || 0));
          const navn = htmlEscape(journalVarenavn(vareId, v));
          const enhet = htmlEscape(v.enhet || 'stk');
          const pris = journalPrisForVare(v, r);
          return `
            <label class="vet-linje-kort" style="display:grid;grid-template-columns:34px minmax(150px,1.6fr) minmax(80px,.8fr) minmax(80px,.7fr) 100px;gap:8px;align-items:center;cursor:pointer;border:1px solid #374151;border-radius:8px;padding:6px 8px;background:#22272a;">
              <input class="journal-bilvare-velg" data-vare-id="${htmlEscape(vareId)}" type="checkbox" style="width:auto;margin:0;">
              <span class="lite">${navn}</span>
              <span class="lite">På bil: ${maks} ${enhet}</span>
              <span class="lite">${formaterKr(pris)} kr</span>
              <input class="journal-bilvare-antall" data-vare-id="${htmlEscape(vareId)}" type="number" step="1" min="1" max="${maks}" placeholder="Antall" onclick="event.stopPropagation();" style="margin:0;">
            </label>
          `;
        }).join('')}
      </div>`;
  }
}

// Sikker knapp- og selectkobling.
try { window.lagreVetBil = lagreVetBil; } catch(e) {}
try { window.nullstillVetBil = nullstillVetBil; } catch(e) {}
(function(){
  function bindVetLagerBilFix() {
    const bilKnapp = document.getElementById('lagreVetBilKnapp');
    if (bilKnapp && bilKnapp.dataset.kobletBilFix !== '1') {
      bilKnapp.dataset.kobletBilFix = '1';
      bilKnapp.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); try { ev.stopImmediatePropagation(); } catch(e) {} return lagreVetBil(); }, true);
    }

    const nyBil = document.getElementById('nyVetBilKnapp');
    if (nyBil && nyBil.dataset.kobletBilFix !== '1') {
      nyBil.dataset.kobletBilFix = '1';
      nyBil.addEventListener('click', function(ev){ ev.preventDefault(); nullstillVetBil(); vetMelding('vetBilMelding',''); });
    }

    const vareKnapp = document.getElementById('lagreVetVareKnapp');
    if (vareKnapp && vareKnapp.dataset.kobletBilFix !== '1') {
      vareKnapp.dataset.kobletBilFix = '1';
      vareKnapp.addEventListener('click', function(ev){ ev.preventDefault(); return lagreVetVare(); });
    }

    const nyVare = document.getElementById('nyVetVareKnapp');
    if (nyVare && nyVare.dataset.kobletBilFix !== '1') {
      nyVare.dataset.kobletBilFix = '1';
      nyVare.addEventListener('click', function(ev){ ev.preventDefault(); nullstillVetVare(); vetMelding('vetVareMelding',''); });
    }

    const hovedKnapp = document.getElementById('oppdaterHovedlagerKnapp');
    if (hovedKnapp && hovedKnapp.dataset.kobletBilFix !== '1') {
      hovedKnapp.dataset.kobletBilFix = '1';
      hovedKnapp.addEventListener('click', function(ev){ ev.preventDefault(); return oppdaterHovedlager(); });
    }

    const journalBil = document.getElementById('journalBilValg');
    if (journalBil && journalBil.dataset.kobletBilFix !== '1') {
      journalBil.dataset.kobletBilFix = '1';
      journalBil.addEventListener('change', function(){ fyllJournalBilVareValg(); });
    }

    const leggBilvarer = document.getElementById('leggTilJournalVarerFraBilListeKnapp');
    if (leggBilvarer && leggBilvarer.dataset.kobletBilFix !== '1') {
      leggBilvarer.dataset.kobletBilFix = '1';
      leggBilvarer.addEventListener('click', function(ev){ ev.preventDefault(); return leggTilJournalVarerFraBilListe(); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindVetLagerBilFix);
  else bindVetLagerBilFix();
  window.addEventListener('load', function(){ setTimeout(bindVetLagerBilFix, 100); setTimeout(bindVetLagerBilFix, 800); });
  try { new MutationObserver(bindVetLagerBilFix).observe(document.documentElement, { childList:true, subtree:true }); } catch(e) {}

  try { window.fyllJournalBilVareValg = fyllJournalBilVareValg; } catch(e) {}
  try { window.journalHentBilvarer = journalHentBilvarer; } catch(e) {}
})();
/* ===== SLUTT FIX 2026-06-14 ===== */
