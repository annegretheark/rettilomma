/* Senere journal-, bilvare- og varelistefikser
   Utskilt fra vet-app.js 2026-06-11. Lastes i samme rekkefølge som originalfilen. */

/* =========================================================
   TVUNGEN FIKS: Journal - medisiner/varer fra bil
   Problem: nedtrekket viser bilnavn, men listen blir stående på "Velg bil først".
   Denne overstyrer bare bilvare-listen i journal.
   ========================================================= */
function vetJournalEscape(verdi) {
  return String(verdi || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function vetJournalBilLabel(b) {
  const eier = b?.veterinaer_navn ? " | " + b.veterinaer_navn : "";
  return [b?.navn, b?.regnr].filter(Boolean).join(" - ") + eier;
}

function vetJournalFinnBilIdHardt() {
  const el = document.getElementById("journalBilValg");
  if (!el) return "";

  let id = String(el.value || "").trim();
  if (id) return id;

  const opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
  id = String(opt?.value || "").trim();
  if (id) { el.value = id; return id; }

  const valgtTekst = String(opt?.textContent || opt?.innerText || "").trim().toLowerCase();
  if (valgtTekst && !valgtTekst.includes("velg bil")) {
    const match = (vetBiler || []).find(b => {
      const label = vetJournalBilLabel(b).toLowerCase();
      return label === valgtTekst || label.includes(valgtTekst) || valgtTekst.includes(String(b.navn || "").toLowerCase()) || valgtTekst.includes(String(b.regnr || "").toLowerCase());
    });
    if (match?.id) { el.value = match.id; return String(match.id); }
  }

  const reelleOptions = Array.from(el.options || []).filter(o => String(o.value || "").trim());
  if (reelleOptions.length) {
    el.value = reelleOptions[0].value;
    return String(reelleOptions[0].value || "").trim();
  }

  if ((vetBiler || []).length) {
    const b = (vetBiler || [])[0];
    if (b?.id) {
      if (!Array.from(el.options || []).some(o => String(o.value) === String(b.id))) {
        const option = document.createElement("option");
        option.value = b.id;
        option.textContent = vetJournalBilLabel(b) || "Bil";
        el.appendChild(option);
      }
      el.value = b.id;
      return String(b.id);
    }
  }

  return "";
}

async function vetJournalHentBilvarerHardt(bilId) {
  let rader = [];

  if (bilId) {
    rader = (vetBilLager || []).filter(r => String(r.bil_id) === String(bilId) && Number(r.antall || 0) > 0);
    if (rader.length) return rader;
  }

  if (!window.supabaseClient) return [];

  // Først: prøv valgt bil uten klinikkfilter. RLS i Supabase skal uansett beskytte data.
  if (bilId) {
    try {
      const { data, error } = await supabaseClient
        .from("vet_bil_lager")
        .select("*, vet_varer(*)")
        .eq("bil_id", bilId)
        .gt("antall", 0);
      if (!error && data?.length) return data;
    } catch (e) {}

    // Hvis relasjonen vet_varer(*) feiler, hent rå rader.
    try {
      const { data, error } = await supabaseClient
        .from("vet_bil_lager")
        .select("*")
        .eq("bil_id", bilId)
        .gt("antall", 0);
      if (!error && data?.length) return data;
    } catch (e) {}
  }

  // Siste nødgrep: hent første bil-lager-rader som faktisk har beholdning.
  try {
    const { data, error } = await supabaseClient
      .from("vet_bil_lager")
      .select("*, vet_varer(*)")
      .gt("antall", 0);
    if (!error && data?.length) {
      const førsteBilId = data[0].bil_id;
      const el = document.getElementById("journalBilValg");
      if (el && førsteBilId) {
        if (!Array.from(el.options || []).some(o => String(o.value) === String(førsteBilId))) {
          const bil = (vetBiler || []).find(b => String(b.id) === String(førsteBilId));
          const option = document.createElement("option");
          option.value = førsteBilId;
          option.textContent = bil ? vetJournalBilLabel(bil) : "Bil med varer";
          el.appendChild(option);
        }
        el.value = førsteBilId;
      }
      return data.filter(r => String(r.bil_id) === String(førsteBilId));
    }
  } catch (e) {}

  try {
    const { data, error } = await supabaseClient
      .from("vet_bil_lager")
      .select("*")
      .gt("antall", 0);
    if (!error && data?.length) return data.filter(r => String(r.bil_id) === String(data[0].bil_id));
  } catch (e) {}

  return [];
}

function vetJournalPrisHardt(vare, rad) {
  return Number(vare?.utsalgspris ?? vare?.utpris ?? vare?.pris ?? vare?.salgspris ?? rad?.utsalgspris ?? rad?.utpris ?? rad?.pris ?? 0) || 0;
}

function vetJournalVarenavnHardt(rad) {
  const vare = rad?.vet_varer || (vetVarer || []).find(v => String(v.id) === String(rad?.vare_id)) || {};
  return vare?.navn || rad?.varenavn || rad?.navn || "Vare/medisin";
}

window.fyllJournalBilVareValg = async function fyllJournalBilVareValgHardt() {
  const liste = document.getElementById("journalBilVareListe");
  const select = document.getElementById("journalBilVareValg");
  if (liste) liste.innerHTML = '<p class="lite">Henter varer/medisiner fra bil ...</p>';

  const bilId = vetJournalFinnBilIdHardt();
  const rader = await vetJournalHentBilvarerHardt(bilId);

  if (!rader.length) {
    if (select) select.innerHTML = '<option value="">Ingen varer i valgt bil</option>';
    if (liste) {
      const antBiler = (vetBiler || []).length;
      const antBilLager = (vetBilLager || []).length;
      liste.innerHTML = `<p class="melding">Ingen varer/medisiner funnet på bil. Biler lastet: ${antBiler}. Bil-lager-rader lastet: ${antBilLager}. Sjekk at bilen faktisk har varer med antall over 0.</p>`;
    }
    return;
  }

  // Oppdater cache slik trekk fra bil-lager bruker samme rader.
  const bil = rader[0]?.bil_id;
  if (bil) {
    const andre = (vetBilLager || []).filter(r => String(r.bil_id) !== String(bil));
    vetBilLager = [...andre, ...rader];
  }

  if (select) {
    select.innerHTML = '<option value="">Velg medisin/vare</option>' + rader.map(r => {
      const vare = r.vet_varer || (vetVarer || []).find(v => String(v.id) === String(r.vare_id)) || {};
      return `<option value="${vetJournalEscape(r.vare_id)}">${vetJournalEscape(vetJournalVarenavnHardt(r))} - på bil: ${Math.floor(Number(r.antall || 0))} ${vetJournalEscape(vare.enhet || "stk")} - ${formaterKr(vetJournalPrisHardt(vare, r))} kr</option>`;
    }).join("");
  }

  if (liste) {
    liste.innerHTML = `
      <div class="vet-linje-liste" style="display:grid;gap:6px;">
        ${rader.map(r => {
          const vare = r.vet_varer || (vetVarer || []).find(v => String(v.id) === String(r.vare_id)) || {};
          const vareId = String(r.vare_id || "");
          const maks = Math.floor(Number(r.antall || 0));
          return `
            <label class="vet-linje-kort" style="display:grid;grid-template-columns:34px minmax(160px,1.6fr) minmax(95px,.8fr) minmax(95px,.7fr) 110px;gap:8px;align-items:center;cursor:pointer;border:1px solid #374151;border-radius:8px;padding:8px;background:#22272a;">
              <input class="journal-bilvare-velg" data-vare-id="${vetJournalEscape(vareId)}" type="checkbox" style="width:auto;margin:0;">
              <span class="lite">${vetJournalEscape(vetJournalVarenavnHardt(r))}</span>
              <span class="lite">På bil: ${maks} ${vetJournalEscape(vare.enhet || "stk")}</span>
              <span class="lite">${formaterKr(vetJournalPrisHardt(vare, r))} kr</span>
              <input class="journal-bilvare-antall" data-vare-id="${vetJournalEscape(vareId)}" type="number" step="1" min="1" max="${maks}" placeholder="Antall" onclick="event.stopPropagation();" style="margin:0;">
            </label>
          `;
        }).join("")}
      </div>`;
  }
};

window.leggTilJournalVarerFraBilListe = async function leggTilJournalVarerFraBilListeHardt() {
  vetMelding("journalMelding", "");
  const bilId = vetJournalFinnBilIdHardt();
  const rader = await vetJournalHentBilvarerHardt(bilId);
  if (!rader.length) { vetMelding("journalMelding", "Ingen varer/medisiner funnet på valgt bil."); return; }

  const valgte = new Set(Array.from(document.querySelectorAll(".journal-bilvare-velg:checked")).map(cb => String(cb.dataset.vareId || "")));
  const linjer = Array.from(document.querySelectorAll(".journal-bilvare-antall"))
    .map(input => ({ vareId: String(input.dataset.vareId || ""), antall: Number(String(input.value || "").replace(",", ".")) }))
    .filter(l => l.vareId && (valgte.has(l.vareId) || l.antall > 0));

  if (!linjer.length) { vetMelding("journalMelding", "Huk av vare og skriv antall."); return; }

  for (const linje of linjer) {
    const rad = rader.find(r => String(r.vare_id) === String(linje.vareId));
    const vare = rad?.vet_varer || (vetVarer || []).find(v => String(v.id) === String(linje.vareId)) || {};
    const beholdning = Math.floor(Number(rad?.antall || 0));
    if (!Number.isInteger(linje.antall) || linje.antall <= 0) { vetMelding("journalMelding", "Antall må være heltall større enn 0."); return; }
    if (linje.antall > beholdning) { vetMelding("journalMelding", `${vetJournalVarenavnHardt(rad)}: ikke nok på bilen. Tilgjengelig: ${beholdning}.`); return; }
    vetJournalVarerTemp.push({
      vare_id: linje.vareId,
      bil_id: rad?.bil_id || bilId,
      varenavn: vetJournalVarenavnHardt(rad),
      antall: linje.antall,
      pris: vetJournalPrisHardt(vare, rad),
      trekk_fra_billager: true
    });
  }
  tegnJournalVareListe();
  oppdaterJournalSum();
  vetMelding("journalMelding", `${linjer.length} varelinje(r) lagt til fra bil.`);
  document.querySelectorAll(".journal-bilvare-velg").forEach(cb => cb.checked = false);
  document.querySelectorAll(".journal-bilvare-antall").forEach(input => input.value = "");
};

function vetJournalBindBilvareHardt() {
  const el = document.getElementById("journalBilValg");
  if (el && !el.dataset.tvungenBilvareFiks) {
    el.dataset.tvungenBilvareFiks = "1";
    el.addEventListener("change", () => window.fyllJournalBilVareValg());
    el.addEventListener("click", () => setTimeout(() => window.fyllJournalBilVareValg(), 50));
    el.addEventListener("input", () => window.fyllJournalBilVareValg());
  }
  const knapp = document.getElementById("leggTilJournalVarerFraBilListeKnapp");
  if (knapp && !knapp.dataset.tvungenBilvareFiks) {
    knapp.dataset.tvungenBilvareFiks = "1";
    knapp.onclick = () => window.leggTilJournalVarerFraBilListe();
  }
}

setInterval(() => {
  vetJournalBindBilvareHardt();
  const liste = document.getElementById("journalBilVareListe");
  const el = document.getElementById("journalBilValg");
  if (liste && el && String(liste.textContent || "").toLowerCase().includes("velg bil først")) {
    window.fyllJournalBilVareValg();
  }
}, 700);

setTimeout(() => { vetJournalBindBilvareHardt(); window.fyllJournalBilVareValg?.(); }, 1000);


/* =========================================================
   PASIENTLISTE EIER -> DYR -> BEHANDLINGER - REN STABIL VERSJON
   2026-06-10
   Erstatter eksperimentelle pasientliste-fikser.
   Flyt:
   1) Vis kun dyreeiere som klikkbar liste.
   2) Klikk eier viser kun dyrene til denne eieren.
   3) Klikk dyr viser behandlingene til dyret.
   4) Ny behandling åpner journal ferdig valgt på riktig eier/dyr.
   ========================================================= */
(function () {
  let valgtEierId = "";
  let valgtDyrId = "";
  let sistTegnet = "";

  function qs(id) { return document.getElementById(id); }
  function v(id) { return String(qs(id)?.value || "").trim(); }
  function setv(id, value) { const x = qs(id); if (x) x.value = value || ""; }
  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  function datoNo(d) {
    const s = String(d || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y,m,day] = s.split("-");
      return `${day}.${m}.${y}`;
    }
    return s;
  }
  function sideErPasienter() {
    const side = qs("eierSide");
    if (!side) return false;
    return !side.classList.contains("skjult") && side.style.display !== "none";
  }
  function arrDyreeiere() {
    try { return (vetDyreeiere || []).slice(); } catch(e) { return []; }
  }
  function arrDyr() {
    try { return (vetDyr || []).slice(); } catch(e) { return []; }
  }
  function arrJournal() {
    try { return (vetJournal || []).slice(); } catch(e) { return []; }
  }
  function eierForDyr(dyr) {
    return arrDyreeiere().find(e => String(e.id) === String(dyr?.dyreeier_id));
  }
  function dyrForEier(eierId) {
    return arrDyr()
      .filter(d => String(d.dyreeier_id) === String(eierId))
      .sort((a,b) => String(a.navn || "").localeCompare(String(b.navn || ""), "nb"));
  }
  function journalForDyr(dyrId) {
    return arrJournal()
      .filter(j => String(j.dyr_id) === String(dyrId))
      .sort((a,b) => String(b.dato || "").localeCompare(String(a.dato || "")) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }
  function antallJournal(dyrId) {
    return journalForDyr(dyrId).length;
  }

  function styleOnce() {
    if (qs("vetPasientTreStil")) return;
    const s = document.createElement("style");
    s.id = "vetPasientTreStil";
    s.textContent = `
      #vetPasientTreRoot { margin-top:10px; }
      .vet-tre-toolbar { display:flex; gap:8px; flex-wrap:wrap; margin:8px 0 12px 0; }
      .vet-tre-toolbar button { width:auto !important; min-height:34px !important; display:inline-block !important; border-radius:8px !important; padding:8px 12px !important; }
      .vet-eier-rad { border:1px solid #374151; border-radius:10px; background:#202528; margin:8px 0; overflow:hidden; }
      .vet-eier-knapp { width:100% !important; display:grid !important; grid-template-columns:minmax(160px,1fr) auto !important; gap:10px !important; text-align:left !important; align-items:center !important; background:#202528 !important; border:0 !important; border-radius:0 !important; padding:10px 12px !important; color:#f8fafc !important; }
      .vet-eier-knapp:hover, .vet-dyr-knapp:hover { outline:1px solid #60a5fa !important; background:#26313a !important; }
      .vet-eier-navn { font-size:18px !important; font-weight:700 !important; line-height:1.1 !important; color:#f8fafc !important; }
      .vet-eier-info { font-size:13px !important; color:#cbd5e1 !important; font-weight:400 !important; margin-top:3px !important; }
      .vet-eier-teller { font-size:13px !important; color:#cbd5e1 !important; white-space:nowrap !important; font-weight:400 !important; }
      .vet-dyr-liste { border-top:1px solid #374151; background:#171a1b; }
      .vet-dyr-rad { border-bottom:1px solid #374151; }
      .vet-dyr-rad:last-child { border-bottom:0; }
      .vet-dyr-knapp { width:100% !important; display:grid !important; grid-template-columns:minmax(130px,1fr) minmax(80px,.7fr) minmax(90px,.8fr) auto !important; gap:8px !important; align-items:center !important; text-align:left !important; background:#1f2528 !important; color:#f3f4f6 !important; border:0 !important; border-radius:0 !important; padding:7px 12px !important; min-height:34px !important; }
      .vet-dyr-knapp.valgt { background:#102033 !important; outline:1px solid #60a5fa !important; }
      .vet-dyr-knapp span { white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important; font-size:13px !important; font-weight:400 !important; color:#f3f4f6 !important; }
      .vet-dyr-knapp .dyrnavn { font-weight:700 !important; }
      .vet-behandling-panel { padding:10px 12px 12px 12px; background:#0f172a; border-top:1px solid #1f6feb; }
      .vet-behandling-topp { display:flex; gap:8px; justify-content:space-between; align-items:center; flex-wrap:wrap; margin-bottom:8px; }
      .vet-behandling-topp strong { font-size:16px; }
      .vet-behandling-topp button { width:auto !important; display:inline-block !important; min-height:32px !important; padding:7px 10px !important; border-radius:8px !important; }
      .vet-behandling-linje { display:grid; grid-template-columns:110px minmax(100px,.7fr) minmax(160px,1.4fr) auto; gap:8px; align-items:start; padding:6px 8px; border:1px solid #374151; background:#202528; margin-top:4px; border-radius:6px; font-size:13px; }
      .vet-behandling-linje span { white-space:normal !important; overflow:visible !important; text-overflow:clip !important; }
      .vet-tom { padding:10px 12px; color:#cbd5e1; }
      @media (max-width:700px) {
        .vet-dyr-knapp { grid-template-columns:1fr; gap:2px; }
        .vet-behandling-linje { grid-template-columns:1fr; }
        .vet-eier-knapp { grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(s);
  }

  function byggPasientTreHtml() {
    const eiere = arrDyreeiere().sort((a,b) => String(a.navn || "").localeCompare(String(b.navn || ""), "nb"));
    if (!eiere.length) {
      return `
        <div class="vet-tom">
          Fant ingen dyreeiere på denne klinikken. Legg inn ny dyreeier, eller sjekk at dyreeiere har riktig klinikk_id.
        </div>`;
    }

    return eiere.map(e => {
      const eierId = String(e.id || "");
      const dyr = dyrForEier(eierId);
      const apen = String(valgtEierId) === eierId;
      const dyrHtml = apen ? `
        <div class="vet-dyr-liste">
          ${dyr.length ? dyr.map(d => byggDyrRad(e, d)).join("") : '<div class="vet-tom">Ingen dyr på denne eieren.</div>'}
        </div>` : "";
      return `
        <div class="vet-eier-rad" data-eier-id="${esc(eierId)}">
          <button type="button" class="vet-eier-knapp" onclick="vetTreVelgEier('${esc(eierId)}')">
            <span>
              <span class="vet-eier-navn">${esc(e.navn || "Uten navn")}</span>
              <span class="vet-eier-info">${esc([e.telefon, e.epost].filter(Boolean).join(" | "))}</span>
            </span>
            <span class="vet-eier-teller">${dyr.length} dyr</span>
          </button>
          ${dyrHtml}
        </div>`;
    }).join("");
  }

  function byggDyrRad(eier, d) {
    const dyrId = String(d.id || "");
    const valgt = String(valgtDyrId) === dyrId;
    const beh = antallJournal(dyrId);
    return `
      <div class="vet-dyr-rad" data-dyr-id="${esc(dyrId)}">
        <button type="button" class="vet-dyr-knapp ${valgt ? "valgt" : ""}" onclick="vetTreVelgDyr('${esc(dyrId)}')">
          <span class="dyrnavn">${esc(d.navn || "Uten navn")}</span>
          <span>${esc(d.art || "")}</span>
          <span>${esc(d.rase || "")}</span>
          <span>${beh} beh.</span>
        </button>
        ${valgt ? byggBehandlingPanel(eier, d) : ""}
      </div>`;
  }

  function byggBehandlingPanel(eier, d) {
    const journaler = journalForDyr(d.id);
    const linjer = journaler.length ? journaler.map(j => {
      const tekst = String(j.notat || j.medisin_kladd || "").replace(/\s+/g, " ").trim();
      const kortTekst = tekst.length > 120 ? tekst.slice(0, 120) + "..." : tekst;
      const sum = Number(j.belop_eks_mva || 0);
      const sumTekst = sum > 0 && typeof formaterKr === "function" ? `${formaterKr(sum)} kr` : "";
      return `
        <button type="button" class="vet-behandling-linje" onclick="vetApneEksisterendeBehandling('${esc(j.id)}')" title="Klikk for å åpne behandlingen">
          <span><strong>${esc(datoNo(j.dato))}</strong></span>
          <span>${esc(j.type || "Behandling")}</span>
          <span>${esc(kortTekst || "Ingen notattekst")}</span>
          <span>${esc(sumTekst)}</span>
        </button>`;
    }).join("") : '<div class="vet-tom">Ingen tidligere behandlinger på dette dyret.</div>';

    return `
      <div class="vet-behandling-panel">
        <div class="vet-behandling-topp">
          <strong>${esc(d.navn || "Dyr")} - tidligere behandlinger</strong>
          <span>
            <button type="button" onclick="vetTreNyBehandling('${esc(d.id)}')">Ny behandling</button>
            <button type="button" class="secondary" onclick="redigerDyr('${esc(d.id)}')">Rediger dyr</button>
          </span>
        </div>
        <div class="lite">Eier: ${esc(eier?.navn || "")} ${d.art ? " | " + esc(d.art) : ""} ${d.rase ? " | " + esc(d.rase) : ""}</div>
        ${linjer}
      </div>`;
  }

  function byggPasientSide() {
    styleOnce();
    const side = qs("eierSide");
    if (!side) return;

    side.innerHTML = `
      <h2>Dyreeiere</h2>
      <h3>Pasientliste</h3>
      <p class="lite">Klikk på en eier for å vise dyrene. Klikk på et dyr for å vise tidligere behandlinger.</p>
      <div class="vet-tre-toolbar">
        <button type="button" class="secondary" onclick="vetTreOppdater()">Oppdater</button>
        <button type="button" class="secondary" onclick="vetTreNyDyreeier()">Ny dyreeier</button>
        <button type="button" class="secondary" onclick="vetTreNyttDyr()">Nytt dyr</button>
      </div>
      <div id="vetPasientTreRoot">${byggPasientTreHtml()}</div>
      <div id="dyreeierMelding" class="melding"></div>
      <input id="dyreeierId" type="hidden">
      <input id="dyreeierVelgForDyr" type="hidden">
      <div id="dyreeierListe" style="display:none"></div>
    `;
    sistTegnet = JSON.stringify({
      e: arrDyreeiere().map(x => [x.id, x.navn, x.telefon, x.epost]),
      d: arrDyr().map(x => [x.id, x.dyreeier_id, x.navn, x.art, x.rase]),
      j: arrJournal().map(x => [x.id, x.dyr_id, x.dato, x.type, x.notat, x.belop_eks_mva]),
      valgtEierId,
      valgtDyrId
    });
  }

  function oppdaterBareHvisEndret() {
    if (!sideErPasienter()) return;
    const now = JSON.stringify({
      e: arrDyreeiere().map(x => [x.id, x.navn, x.telefon, x.epost]),
      d: arrDyr().map(x => [x.id, x.dyreeier_id, x.navn, x.art, x.rase]),
      j: arrJournal().map(x => [x.id, x.dyr_id, x.dato, x.type, x.notat, x.belop_eks_mva]),
      valgtEierId,
      valgtDyrId
    });
    if (now !== sistTegnet) byggPasientSide();
  }

  window.vetTreVelgEier = function (eierId) {
    eierId = String(eierId || "");
    valgtEierId = valgtEierId === eierId ? "" : eierId;
    valgtDyrId = "";
    setv("dyreeierId", valgtEierId);
    setv("dyreeierVelgForDyr", valgtEierId);
    byggPasientSide();
  };

  window.vetTreVelgDyr = function (dyrId) {
    dyrId = String(dyrId || "");
    const d = arrDyr().find(x => String(x.id) === dyrId);
    if (!d) return;
    valgtEierId = String(d.dyreeier_id || "");
    valgtDyrId = valgtDyrId === dyrId ? "" : dyrId;
    setv("dyreeierId", valgtEierId);
    setv("dyreeierVelgForDyr", valgtEierId);
    byggPasientSide();
  };

  window.vetTreNyBehandling = function (dyrId) {
    const d = arrDyr().find(x => String(x.id) === String(dyrId));
    if (!d) return;
    valgtEierId = String(d.dyreeier_id || "");
    valgtDyrId = String(d.id || "");

    if (typeof visVetSide === "function") visVetSide("journalSide");

    setTimeout(() => {
      try { if (typeof fyllJournalDyreeierValg === "function") fyllJournalDyreeierValg(); } catch(e) {}
      setv("journalDyreeierValg", valgtEierId);
      try { if (typeof fyllDyrValg === "function") fyllDyrValg(); } catch(e) {}
      setv("journalDyrValg", valgtDyrId);
      setv("journalDato", new Date().toISOString().split("T")[0]);
      setv("journalNotat", "");
      setv("journalMedisin", "");
      const jl = qs("journalListe");
      if (jl) jl.innerHTML = "";
      const notat = qs("journalNotat");
      if (notat) notat.focus();
    }, 80);
  };

  window.vetTreOppdater = async function () {
    try {
      if (typeof lastDyreeiere === "function") await lastDyreeiere();
      if (typeof lastDyr === "function") await lastDyr();
      if (typeof lastJournal === "function") await lastJournal();
    } catch(e) {
      console.warn("Kunne ikke oppdatere pasienttre", e);
    }
    byggPasientSide();
  };

  const gammelVisVetSide = window.visVetSide || (typeof visVetSide === "function" ? visVetSide : null);
  if (gammelVisVetSide && !window.__vetTreOriginalVisVetSide) {
    window.__vetTreOriginalVisVetSide = gammelVisVetSide;
  }
  window.visVetSide = function (sideId) {
    const original = window.__vetTreOriginalVisVetSide || gammelVisVetSide;
    if (original) original(sideId);
    if (sideId === "eierSide") {
      valgtDyrId = "";
      setTimeout(() => {
        if (!arrDyreeiere().length && typeof lastDyreeiere === "function") lastDyreeiere().then(() => {
          if (typeof lastDyr === "function") return lastDyr();
        }).then(() => {
          if (typeof lastJournal === "function") return lastJournal();
        }).finally(byggPasientSide);
        else byggPasientSide();
      }, 30);
    }
  };

  const gammelTegnDyreeiere = window.tegnDyreeiere || (typeof tegnDyreeiere === "function" ? tegnDyreeiere : null);
  window.tegnDyreeiere = function () {
    if (sideErPasienter()) byggPasientSide();
    else if (gammelTegnDyreeiere) gammelTegnDyreeiere();
  };

  const gammelTegnDyr = window.tegnDyr || (typeof tegnDyr === "function" ? tegnDyr : null);
  window.tegnDyr = function () {
    if (sideErPasienter()) byggPasientSide();
    else if (gammelTegnDyr) gammelTegnDyr();
  };

  const gammelTegnJournal = window.tegnJournal || (typeof tegnJournal === "function" ? tegnJournal : null);
  window.tegnJournal = function () {
    if (sideErPasienter()) {
      oppdaterBareHvisEndret();
      return;
    }
    if (gammelTegnJournal) gammelTegnJournal();
  };

  // Start på Pasienter når alt er lastet.
  window.addEventListener("load", function () {
    setTimeout(() => {
      try { window.visVetSide("eierSide"); } catch(e) { byggPasientSide(); }
    }, 800);
  });
})();



/* ===== RYDDET VETERINÆRPAKKE 2026-06-10 =====
   Hindrer doble hurtigknapper og doble pasient-toolbarer etter opprydding.
*/
(function(){
  function fjernHurtigKnapper(){
    const wrap=document.getElementById('vetPasientHurtigKnapper');
    if(wrap) wrap.remove();
  }
  function ryddPasientToolbarer(){
    const side=document.getElementById('eierSide');
    if(!side) return;
    const toolbars=Array.from(side.querySelectorAll('.vet-tre-toolbar'));
    if(toolbars.length>1){
      toolbars.slice(1).forEach(x=>x.remove());
    }
    // Hvis en gammel patch har lagt identiske knapper ved siden av hverandre, behold første gruppe.
    const root=document.getElementById('vetPasientTreRoot');
    if(root){
      const knappetekst=['oppdater','ny dyreeier','nytt dyr','ny pasient'];
      const sett=new Set();
      Array.from(root.parentElement?.querySelectorAll('button') || []).forEach(btn=>{
        const t=String(btn.textContent||'').trim().toLowerCase();
        if(!knappetekst.includes(t)) return;
        const key=t+'|'+(btn.getAttribute('onclick')||'');
        if(sett.has(key)) btn.remove();
        else sett.add(key);
      });
    }
  }
  window.vetRyddDobbelKnapper=function(){ fjernHurtigKnapper(); ryddPasientToolbarer(); };
  window.addEventListener('load',()=>{
    window.vetRyddDobbelKnapper();
    setTimeout(window.vetRyddDobbelKnapper,500);
    setTimeout(window.vetRyddDobbelKnapper,1500);
  });
  document.addEventListener('click',()=>setTimeout(window.vetRyddDobbelKnapper,100),true);
  const obs=new MutationObserver(()=>window.vetRyddDobbelKnapper());
  window.addEventListener('load',()=>{ if(document.body) obs.observe(document.body,{childList:true,subtree:true}); });
})();


/* ===== VARELISTE SKJULT TIL BRUKER BER OM DEN 2026-06-10 =====
   Varelisten fra bil skal oppføre seg som behandlingslisten:
   - skjult først
   - vises bare når bruker trykker "Velg vare/medisin"
   - skjules igjen når bil endres
   - rører ikke pasientliste, behandlinger, journal eller lager ellers
*/
(function(){
  let vetVarelisteSynlig = false;
  let vetVarelisteLaster = false;

  function qs(id){ return document.getElementById(id); }

  function finnListe(){ return qs('journalBilVareListe'); }

  function skjulListe(tekst){
    const liste = finnListe();
    if (!liste) return;
    liste.style.display = 'none';
    liste.innerHTML = tekst || '';
  }

  function visListe(){
    const liste = finnListe();
    if (!liste) return;
    liste.style.display = '';
  }

  function oppdaterKnapp(){
    const knapp = qs('journalVisVarelisteKnapp');
    if (!knapp) return;
    knapp.textContent = vetVarelisteSynlig ? 'Skjul vareliste' : 'Velg vare/medisin';
  }

  function sørgVarelisteKnapp(){
    const liste = finnListe();
    if (!liste) return null;

    let knapp = qs('journalVisVarelisteKnapp');
    if (!knapp) {
      knapp = document.createElement('button');
      knapp.id = 'journalVisVarelisteKnapp';
      knapp.type = 'button';
      knapp.className = 'secondary';
      knapp.style.margin = '8px 0';
      liste.parentNode.insertBefore(knapp, liste);
    }

    if (knapp.dataset.varelisteKoblet !== '1') {
      knapp.dataset.varelisteKoblet = '1';
      knapp.addEventListener('click', async function(e){
        e.preventDefault();
        e.stopPropagation();

        vetVarelisteSynlig = !vetVarelisteSynlig;
        oppdaterKnapp();

        if (!vetVarelisteSynlig) {
          skjulListe('');
          return false;
        }

        visListe();
        if (typeof vetOriginalFyllJournalBilVareValg === 'function') {
          await vetOriginalFyllJournalBilVareValg();
        }
        visListe();
        return false;
      });
    }

    oppdaterKnapp();
    return knapp;
  }

  const vetOriginalFyllJournalBilVareValg = window.fyllJournalBilVareValg || (typeof fyllJournalBilVareValg === 'function' ? fyllJournalBilVareValg : null);

  window.fyllJournalBilVareValg = async function fyllJournalBilVareValgSkjultTilValg(){
    sørgVarelisteKnapp();

    // Ikke la auto-kall, intervaller eller bilvalg vise hele varelisten.
    if (!vetVarelisteSynlig) {
      skjulListe('');
      return;
    }

    if (vetVarelisteLaster) return;
    vetVarelisteLaster = true;
    try {
      if (typeof vetOriginalFyllJournalBilVareValg === 'function') {
        await vetOriginalFyllJournalBilVareValg();
      }
      visListe();
    } finally {
      vetVarelisteLaster = false;
    }
  };

  function resetVedBilbytte(){
    const bil = qs('journalBilValg');
    if (!bil || bil.dataset.varelisteSkjulKoblet === '1') return;
    bil.dataset.varelisteSkjulKoblet = '1';
    bil.addEventListener('change', function(){
      vetVarelisteSynlig = false;
      oppdaterKnapp();
      skjulListe('');
    }, true);
  }

  function init(){
    sørgVarelisteKnapp();
    resetVedBilbytte();
    if (!vetVarelisteSynlig) skjulListe('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

  window.addEventListener('load', function(){
    init();
    setTimeout(init, 500);
    setTimeout(init, 1500);
  });

  const gammelVisVetSideVareliste = window.visVetSide || (typeof visVetSide === 'function' ? visVetSide : null);
  if (gammelVisVetSideVareliste) {
    window.visVetSide = function(id){
      const r = gammelVisVetSideVareliste.apply(this, arguments);
      if (id === 'journalSide') {
        vetVarelisteSynlig = false;
        setTimeout(init, 0);
      }
      return r;
    };
    try { visVetSide = window.visVetSide; } catch(e) {}
  }
})();
/* ===== SLUTT VARELISTE SKJULT ===== */

