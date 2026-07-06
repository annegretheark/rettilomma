console.log("biler.js PROD firma_id fix 20260613 lastet");
window.BILER_JS_VERSION = "PROD fyll-bil skrivbare tekstfelt 20260613";

let biler = [];
let bilLager = [];
let bilLagerHentetMap = new Map();
let varerTilBilLager = [];

function bilErSynlig(el) {
  return !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function bilEl(id) {
  const alle = Array.from(document.querySelectorAll('[id="' + id + '"]'));
  if (!alle.length) return null;
  return alle.find(bilErSynlig) || alle[0];
}

function bilVerdi(id) {
  const e = bilEl(id);
  return e ? String(e.value || "").trim() : "";
}

function bilSettVerdi(id, verdi) {
  const e = bilEl(id);
  if (e) e.value = verdi ?? "";
}

function visBilSkjema() {
  const omrade = bilEl("bilSkjemaOmrade");
  if (omrade) {
    omrade.classList.remove("skjult", "hidden", "modul-skjult");
    omrade.style.display = "block";
  }
  const rad = bilEl("bilSkjemaRad");
  if (rad) {
    rad.classList.remove("skjult", "hidden", "modul-skjult");
    rad.style.display = "grid";
  }
}

function nyBilSkjema() {
  visBilSkjema();
  bilSettVerdi("bilId", "");
  bilSettVerdi("bilNavn", "");
  bilSettVerdi("bilRegnr", "");
  const tittel = bilEl("nyBilTittel");
  if (tittel) tittel.textContent = "Registrer ny bil";
  const knapp = bilEl("lagreBilKnapp");
  if (knapp) knapp.textContent = "Lagre ny bil";
  const navn = bilEl("bilNavn");
  if (navn) {
    navn.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => navn.focus(), 50);
  }
}

function redigerBil(id) {
  visBilSkjema();
  const bil = (biler || []).find(b => String(b.id) === String(id));
  if (!bil) {
    bilMelding("Fant ikke bilen.", true);
    return;
  }

  bilSettVerdi("bilId", bil.id || "");
  bilSettVerdi("bilNavn", bil.navn || bil.name || bil.bilnavn || "");
  bilSettVerdi("bilRegnr", bil.regnr || bil.registreringsnummer || "");

  const tittel = bilEl("nyBilTittel");
  if (tittel) tittel.textContent = "Rediger bil";

  const knapp = bilEl("lagreBilKnapp");
  if (knapp) knapp.textContent = "Lagre endring";

  const navn = bilEl("bilNavn");
  if (navn) {
    navn.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => navn.focus(), 100);
  }
}

function bilMelding(tekst, erFeil = false) {
  const e = bilEl("bilMelding");
  if (e) {
    e.textContent = tekst || "";
    e.style.color = erFeil ? "#fca5a5" : "#86efac";
  }
  if (erFeil) console.error(tekst);
  else if (tekst) console.log(tekst);
}

function bilNavn(bil) {
  if (!bil) return "Bil";
  return `${bil.navn || bil.name || bil.bilnavn || "Bil"}${bil.regnr ? " - " + bil.regnr : ""}`;
}

function vareNavn(v) {
  if (!v) return "Vare";
  return `${v.varenr ? v.varenr + " - " : ""}${v.navn || v.varenavn || v.beskrivelse || "Vare"}`;
}

function vareNr(v) {
  return (
    v?.varenr ??
    v?.vare_nr ??
    v?.vareNr ??
    v?.Varenr ??
    v?.artikkel ??
    v?.artikkelnr ??
    v?.artikkelnummer ??
    v?.produktnr ??
    v?.produktnummer ??
    v?.sku ??
    ""
  );
}

function varePris(v) {
  return Number(v?.pris ?? v?.utpris ?? v?.utsalgspris ?? v?.salgspris ?? 0);
}

function formatKr(verdi) {
  const n = Number(verdi || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function vareInnpris(v) {
  return Number(v?.innpris ?? v?.vareinnpris ?? 0);
}

function rilTall(verdi) {
  if (verdi === null || verdi === undefined || verdi === "") return 0;
  if (typeof verdi === "number") return Number.isFinite(verdi) ? verdi : 0;
  const s = String(verdi).trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function rilForstePositive(...verdier) {
  const tall = verdier.map(rilTall);
  const positiv = tall.find(n => n > 0);
  return positiv !== undefined ? positiv : (tall.find(n => Number.isFinite(n)) ?? 0);
}

function vareHovedlager(v) {
  // VIKTIG: lager_antall kan være 0 etter feil import, mens antall fortsatt inneholder faktisk hovedlager.
  // Derfor velger vi første positive verdi, ikke bare første felt som finnes.
  return rilForstePositive(v?.lager_antall, v?.antall, v?.lager, v?.beholdning, v?.hovedlager, v?.stock, v?.quantity, v?.qty);
}

function vareMinimum(v) {
  return rilForstePositive(v?.minimum_antall, v?.min_antall, v?.minimum, v?.min, v?.min_hovedlager);
}

function vareMva(v) {
  return Number(v?.mva_prosent ?? v?.mva ?? 25);
}

function hentValgtBilIdForBilLager() {
  return bilVerdi("bilLagerBilValg") || bilVerdi("lagerBilValg") || bilVerdi("bilValg") || localStorage.getItem("aktivBilId") || "";
}

function hentBilFraId(id) {
  return (biler || []).find(b => String(b.id) === String(id));
}

function ansattVisningsnavn(a) {
  if (!a) return "Uten navn";
  return a.navn || a.fullt_navn || a.name || a.epost || a.email || "Uten navn";
}

async function lastAnsatteForBiler(firmaId) {
  if (!window.supabaseClient || !firmaId) return [];

  try {
    const { data, error } = await supabaseClient
      .from("hand_ansatt")
      .select("id, navn, fullt_navn, name, epost, email, standard_bil_id, firma_id")
      .eq("firma_id", firmaId);

    if (error) {
      console.warn("Kunne ikke hente ansatte til billiste:", error.message || error);
      return Array.isArray(window.ansatte) ? window.ansatte : [];
    }

    window.ansatte = data || [];
    return window.ansatte;
  } catch (e) {
    console.warn("Feil ved henting av ansatte til billiste:", e);
    return Array.isArray(window.ansatte) ? window.ansatte : [];
  }
}


function hentAnsattForBil(bilId) {
  try {
    const liste = Array.isArray(window.ansatte) ? window.ansatte : [];
    const treff = liste
      .filter(a => String(a.standard_bil_id || "") === String(bilId || ""))
      .map(ansattVisningsnavn);

    return treff.length ? treff.join(", ") : "Ikke tildelt";
  } catch (e) {
    console.warn("Kunne ikke finne ansatt for bil:", e);
    return "Ikke tildelt";
  }
}


function valgtBilOverskrift() {
  const bilId = hentValgtBilIdForBilLager();
  const bil = hentBilFraId(bilId);
  return bilId ? bilNavn(bil) : "Ingen bil valgt";
}

function skjulAlleSiderForBiler() {
  if (typeof window.skjulAlleSider === "function") {
    window.skjulAlleSider();
    return;
  }

  document.querySelectorAll("section.kort").forEach(sec => {
    if (!["loginSide", "nyttPassordSide"].includes(sec.id)) {
      sec.classList.add("skjult");
      sec.style.display = "none";
    }
  });
}

function settHandSideOverskrift(tekst) {
  const h = document.getElementById("handSideOverskrift") || document.querySelector("#appSide h1");
  if (h) h.textContent = tekst || "Håndverker";
}

async function visBilerSide() {
  settHandSideOverskrift("Min bil / fyll lager");
  skjulAlleSiderForBiler();

  const side = bilEl("bilerSide");
  if (!side) {
    alert("Fant ikke bilerSide i index.html");
    return;
  }

  side.classList.remove("skjult", "hidden", "modul-skjult");
  side.style.display = "";
  visBilSkjema();
  sikreImportTilHovedlagerIBunn();

  await lastBilerOgBilLager();
}

function tilbakeFraBiler() {
  settHandSideOverskrift("Timeregistrering");
  if (typeof window.visVarerSide === "function") {
    window.visVarerSide();
    return;
  }
  if (typeof window.visTimerSide === "function") {
    window.visTimerSide();
  }
}

function fyllSelectMedBiler(selectId, tomTekst) {
  const select = bilEl(selectId);
  if (!select) return;

  const valgt = select.value || (selectId === "bilValg" ? localStorage.getItem("aktivBilId") || "" : "");

  select.innerHTML = `<option value="">${tomTekst || "Velg bil"}</option>`;

  biler
    .filter(b => b.aktiv !== false)
    .forEach(bil => {
      const opt = document.createElement("option");
      opt.value = bil.id;
      opt.textContent = bilNavn(bil);
      select.appendChild(opt);
    });

  if (valgt && Array.from(select.options).some(o => String(o.value) === String(valgt))) {
    select.value = valgt;
  }
}

function fyllAlleBilvalg() {
  fyllSelectMedBiler("ansattStandardBil", "Ingen fast bil");
  fyllSelectMedBiler("bilValg", "Velg bil");
  fyllSelectMedBiler("lagerBilValg", "Velg bil");
  fyllSelectMedBiler("bilLagerBilValg", "Velg bil");
  oppdaterAktivBilVisning();
}

async function lastBiler() {
  if (!window.supabaseClient) {
    bilMelding("Supabase er ikke lastet enn\u00E5.", true);
    return [];
  }

  let firmaId = null;
  try {
    firmaId = await hentInnloggetFirmaIdForBiler();
  } catch (e) {
    bilMelding("Kunne ikke finne firma for innlogget bruker: " + (e.message || e), true);
    biler = [];
    fyllAlleBilvalg();
    return [];
  }

  const { data, error } = await supabaseClient
    .from("hand_bil")
    .select("*")
    .eq("firma_id", firmaId)
    .order("navn", { ascending: true });

  if (error) {
    bilMelding("Kunne ikke hente biler: " + error.message, true);
    biler = [];
    fyllAlleBilvalg();
    return [];
  }

  biler = data || [];
  window.biler = biler;

  await lastAnsatteForBiler(firmaId);

  fyllAlleBilvalg();
  tegnBiler();

  return biler;
}


async function hentInnloggetFirmaIdForBiler() {
  if (!window.supabaseClient || !supabaseClient.auth) {
    throw new Error("Supabase er ikke lastet.");
  }

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();

  if (userError || !userData || !userData.user) {
    throw new Error("Du er ikke innlogget i Supabase. Logg ut og inn igjen.");
  }

  const user = userData.user;
  const userId = user.id || "";
  const epost = String(user.email || "").trim().toLowerCase();

  function settAktivFirmaId(firmaId) {
    firmaId = String(firmaId || "").trim();
    if (!firmaId) return "";
    window.aktivFirmaId = firmaId;
    window.handFirmaId = firmaId;
    try {
      localStorage.setItem("aktivFirmaId", firmaId);
      localStorage.setItem("handFirmaId", firmaId);
      localStorage.setItem("firma_id", firmaId);
      localStorage.setItem("firmaId", firmaId);
    } catch (e) {}
    return firmaId;
  }

  async function finnIFirmaBruker(tabell) {
    try {
      if (userId) {
        let r = await supabaseClient.from(tabell).select("firma_id").eq("user_id", userId).limit(1).maybeSingle();
        if (!r.error && r.data && r.data.firma_id) return r.data.firma_id;

        r = await supabaseClient.from(tabell).select("firma_id").eq("bruker_id", userId).limit(1).maybeSingle();
        if (!r.error && r.data && r.data.firma_id) return r.data.firma_id;
      }

      if (epost) {
        let r = await supabaseClient.from(tabell).select("firma_id").ilike("epost", epost).limit(1).maybeSingle();
        if (!r.error && r.data && r.data.firma_id) return r.data.firma_id;

        r = await supabaseClient.from(tabell).select("firma_id").ilike("email", epost).limit(1).maybeSingle();
        if (!r.error && r.data && r.data.firma_id) return r.data.firma_id;
      }
    } catch (e) {}
    return "";
  }

  async function finnIAnsatt(tabell) {
    try {
      if (userId) {
        let r = await supabaseClient.from(tabell).select("firma_id").eq("user_id", userId).limit(1).maybeSingle();
        if (!r.error && r.data && r.data.firma_id) return r.data.firma_id;

        r = await supabaseClient.from(tabell).select("firma_id").eq("bruker_id", userId).limit(1).maybeSingle();
        if (!r.error && r.data && r.data.firma_id) return r.data.firma_id;
      }

      if (epost) {
        let r = await supabaseClient.from(tabell).select("firma_id").ilike("epost", epost).limit(1).maybeSingle();
        if (!r.error && r.data && r.data.firma_id) return r.data.firma_id;

        r = await supabaseClient.from(tabell).select("firma_id").ilike("email", epost).limit(1).maybeSingle();
        if (!r.error && r.data && r.data.firma_id) return r.data.firma_id;
      }
    } catch (e) {}
    return "";
  }

  // 20260706: firma/rolle skal bare hentes fra public.hand_firma_bruker.
  const firmaId =
    await finnIFirmaBruker("hand_firma_bruker") ||
    window.aktivFirmaId ||
    window.handFirmaId ||
    localStorage.getItem("aktivFirmaId") ||
    localStorage.getItem("handFirmaId") ||
    localStorage.getItem("firma_id") ||
    localStorage.getItem("firmaId") ||
    "";

  const aktivFirmaId = settAktivFirmaId(firmaId);

  if (!aktivFirmaId) {
    throw new Error("Bruker er ikke koblet til firma i hand_firma_bruker.");
  }

  return aktivFirmaId;
}

async function lagreBil() {
  try {
    bilMelding("Lagrer bil...");

    if (!window.supabaseClient) {
      bilMelding("Supabase er ikke lastet. Sjekk config.js.", true);
      return;
    }

    const id = bilVerdi("bilId");
    const navn = bilVerdi("bilNavn");
    const regnr = bilVerdi("bilRegnr");

    if (!navn && !regnr) {
      bilMelding("Skriv bilnavn eller regnr.", true);
      alert("Skriv bilnavn eller regnr.");
      return;
    }

    const firmaId = await hentInnloggetFirmaIdForBiler();

    const rad = {
      firma_id: firmaId,
      navn: navn || regnr,
      regnr: regnr || null,
      aktiv: true
    };

    let res;

    if (id) {
      res = await supabaseClient
        .from("hand_bil")
        .update(rad)
        .eq("id", id)
        .select()
        .single();
    } else {
      res = await supabaseClient
        .from("hand_bil")
        .insert([rad])
        .select()
        .single();
    }

    if (res.error && String(res.error.message || "").toLowerCase().includes("aktiv")) {
      const radUtenAktiv = {
        firma_id: firmaId,
        navn: navn || regnr,
        regnr: regnr || null
      };

      if (id) {
        res = await supabaseClient
          .from("hand_bil")
          .update(radUtenAktiv)
          .eq("id", id)
          .select()
          .single();
      } else {
        res = await supabaseClient
          .from("hand_bil")
          .insert([radUtenAktiv])
          .select()
          .single();
      }
    }

    if (res.error) {
      bilMelding("Kunne ikke lagre bil: " + res.error.message, true);
      alert("Kunne ikke lagre bil: " + res.error.message);
      return;
    }

    if (res.data && res.data.id) {
      localStorage.setItem("aktivBilId", String(res.data.id));
      localStorage.setItem("aktivBilNavn", bilNavn(res.data));
      window.aktivBilId = String(res.data.id);
    }

    nyBilSkjema();

    bilMelding(id ? "Bil oppdatert." : "Ny bil lagret.");
    await lastBilerOgBilLager();
    await fyllVarevalgFraAktivBil();
  } catch (e) {
    const msg = "Feil ved lagring av bil: " + (e && e.message ? e.message : String(e));
    bilMelding(msg, true);
    alert(msg);
  }
}

async function slettBil(id) {
  if (!id) return;
  if (!confirm("Vil du slette bilen?")) return;

  const { error } = await supabaseClient
    .from("hand_bil")
    .delete()
    .eq("id", id);

  if (error) {
    bilMelding("Kunne ikke slette bil: " + error.message, true);
    return;
  }

  const aktiv = localStorage.getItem("aktivBilId");
  if (String(aktiv) === String(id)) {
    localStorage.removeItem("aktivBilId");
    localStorage.removeItem("aktivBilNavn");
    window.aktivBilId = "";
  }

  bilMelding("Bil slettet.");
  await lastBilerOgBilLager();
  await fyllVarevalgFraAktivBil();
}


async function apneBilForFylling(id) {
  if (!id) return;

  // Hold oss p\u00E5 Biler-siden. Ingen hand-navigation.js, ingen kundevisning.
  const appSide = bilEl("appSide");
  if (appSide) {
    appSide.classList.remove("skjult", "hidden");
    appSide.style.display = "";
  }

  [
    "backupSide", "timerSide", "fakturaSide", "varerSide",
    "lonnPanel", "kundeSide", "ansattSide", "firmaSide",
    "modulerSide", "testSide"
  ].forEach(sideId => {
    const s = bilEl(sideId);
    if (s) {
      s.classList.add("skjult");
      s.style.display = "none";
    }
  });

  const bilerSide = bilEl("bilerSide");
  if (bilerSide) {
    bilerSide.classList.remove("skjult", "hidden", "modul-skjult");
    bilerSide.style.display = "";
  }

  const select = bilEl("bilLagerBilValg");
  if (select) {
    const finnes = Array.from(select.options).some(o => String(o.value) === String(id));
    if (finnes) select.value = id;
  }

  const bilValg = bilEl("bilValg");
  if (bilValg) {
    const finnesAktiv = Array.from(bilValg.options).some(o => String(o.value) === String(id));
    if (finnesAktiv) {
      bilValg.value = id;
      localStorage.setItem("aktivBilId", String(id));
      localStorage.setItem("aktivBilNavn", bilValg.selectedOptions?.[0]?.textContent || "");
      window.aktivBilId = String(id);
    }
  }

  // Bygg listen direkte. Ikke kall funksjoner som kan trigge andre sider.
  tegnFyllBilListe();

  const m\u00E5l = bilEl("bilLagerFyllListe") || bilEl("bilLagerBilValg");
  if (m\u00E5l) {
    m\u00E5l.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  bilMelding("Valgt bil for fylling.");
}


function tegnBiler() {
  const e = bilEl("bilListe");
  if (!e) return;

  if (!biler.length) {
    e.innerHTML = `
      <div style="margin:16px 0 18px 0; padding:12px; border:1px solid rgba(255,255,255,.18); border-radius:8px;">
        <h3 style="margin-top:0;">Eksisterende biler og tilkoblede brukere</h3>
        <p>Ingen biler registrert.</p>
      </div>
    `;
    return;
  }

  e.innerHTML = `
    <div style="margin:16px 0 18px 0; padding:12px; border:1px solid rgba(255,255,255,.18); border-radius:8px; overflow-x:auto;">
      <h3 style="margin-top:0;">Eksisterende biler og tilkoblede brukere</h3>
      <table class="bil-tabell" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr><th style="text-align:left; padding:6px;">Bil</th><th style="text-align:left; padding:6px;">Regnr</th><th style="text-align:left; padding:6px;">Tilkoblet bruker</th><th style="text-align:left; padding:6px;">Status</th><th style="padding:6px;"></th></tr>
        </thead>
        <tbody>
          ${biler.map(bil => `
            <tr class="klikkbar-bilrad" onclick="window.apneBilForFylling('${bil.id}')">
              <td style="padding:6px; border-top:1px solid rgba(255,255,255,.12);">${bil.navn || bil.name || bil.bilnavn || ""}</td>
              <td style="padding:6px; border-top:1px solid rgba(255,255,255,.12);">${bil.regnr || bil.registreringsnummer || ""}</td>
              <td style="padding:6px; border-top:1px solid rgba(255,255,255,.12);">${hentAnsattForBil(bil.id)}</td>
              <td style="padding:6px; border-top:1px solid rgba(255,255,255,.12);">${bil.aktiv === false ? "Inaktiv" : "Aktiv"}</td>
              <td style="padding:6px; border-top:1px solid rgba(255,255,255,.12); white-space:nowrap;">
                <button type="button" class="secondary" onclick="event.stopPropagation(); redigerBil('${bil.id}')">Endre</button>
                <button type="button" class="secondary" onclick="event.stopPropagation(); slettBil('${bil.id}')">Slett</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function fyllBilLagerVareValg() {
  if (!window.supabaseClient) {
    bilMelding("Supabase er ikke lastet. Kan ikke hente varer.", true);
    return;
  }

  const liste = bilEl("bilLagerFyllListe");
  if (liste) liste.innerHTML = "Laster varer fra vareregister...";

  // Viktig: vi henter varer selv om gamle enkelt-selecter ikke finnes i HTML.
  // Etter at vi gjorde fylling fra liste, ble bilLagerVareValg fjernet.
  // Tidligere returnerte funksjonen for tidlig, og derfor ble varelisten borte.
  let res = await supabaseClient
    .from("hand_vare")
    .select("*")
    .limit(1000);

  if (res.error) {
    varerTilBilLager = [];
    window.varerTilBilLager = varerTilBilLager;
    tegnFyllBilListe();
    bilMelding("Kunne ikke hente varer til bil-lager: " + res.error.message, true);
    return;
  }

  varerTilBilLager = (res.data || []).sort((a, b) =>
    String(vareNavn(a)).localeCompare(String(vareNavn(b)), "no")
  );
  window.varerTilBilLager = varerTilBilLager;
  tegnFyllBilListe();

  // Fyll gamle dropdowns bare hvis de finnes. De er valgfrie n\u00E5.
  const selects = ["bilLagerVareValg", "lagerVareValg"]
    .map(id => bilEl(id))
    .filter(Boolean);

  selects.forEach(select => {
    const valgt = select.value;
    select.innerHTML = '<option value="">Velg vare</option>';

    varerTilBilLager.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.dataset.pris = varePris(v);
      opt.textContent = `${vareNavn(v)} - ${varePris(v).toFixed(2)} kr`;
      select.appendChild(opt);
    });

    if (valgt && Array.from(select.options).some(o => String(o.value) === String(valgt))) {
      select.value = valgt;
    }
  });
}


function tegnFyllBilListe() {
  const c = bilEl("bilLagerFyllListe");
  if (!c) return;

  // Ikke bygg listen på nytt mens bruker skriver. Det var årsaken til blinking.
  const aktiv = document.activeElement;
  if (aktiv && c.contains(aktiv) && aktiv.matches && aktiv.matches("input.bil-lager-antall-liste, input.bil-lager-min-liste")) {
    return;
  }

  // Ta vare på verdier hvis listen likevel må tegnes på nytt.
  const gamleAntall = new Map();
  c.querySelectorAll("input.bil-lager-antall-liste").forEach(i => gamleAntall.set(String(i.dataset.vareId || ""), i.value || ""));
  const gamleMin = new Map();
  c.querySelectorAll("input.bil-lager-min-liste").forEach(i => gamleMin.set(String(i.dataset.vareId || ""), i.value || ""));

  const bilId = hentValgtBilIdForBilLager();
  const biltekst = valgtBilOverskrift();
  const erMobil = window.matchMedia && window.matchMedia("(max-width: 700px)").matches;

  if (!varerTilBilLager.length) {
    c.innerHTML = "<p>Ingen varer i vareregisteret enn\u00E5.</p>";
    return;
  }

  const topp = `
    <div class="info" style="margin:8px 0 6px 0; font-weight:bold;">
      Fyller bil: ${biltekst}
    </div>
    ${!bilId ? '<p class="melding">Velg bil f\u00F8rst. Listen er klar, men lagring krever valgt bil.</p>' : ''}
  `;

  if (erMobil) {
    c.innerHTML = `
      ${topp}
      <div style="display:grid; gap:8px; margin-top:8px;">
        ${varerTilBilLager.map(v => `
          <div class="ril-fyllbil-mobilkort" style="border:1px solid #374151; border-radius:10px; padding:8px; background:#22272a; box-sizing:border-box; overflow:hidden;">
            <div style="font-weight:bold; font-size:15px; line-height:1.2; margin-bottom:4px;">${vareNavn(v)}</div>
            <div class="info" style="font-size:13px; line-height:1.2; margin-bottom:6px;">P\u00E5 hovedlager: ${vareHovedlager(v)}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; align-items:end;">
              <label style="margin:0; font-size:13px; line-height:1.2; display:block;">
                Antall til bil
                <input class="bil-lager-antall-liste" data-vare-id="${v.id}" type="text" inputmode="numeric" pattern="[0-9]*" value="${gamleAntall.get(String(v.id)) || ''}" placeholder="0" autocomplete="off" style="width:100%; min-width:0; height:38px; min-height:38px; max-height:38px; padding:7px 8px; margin-top:4px; pointer-events:auto; background:#f8fafc; color:#111827; border:1px solid #cbd5e1; border-radius:8px; font-size:16px; line-height:20px; box-sizing:border-box; appearance:none; -webkit-appearance:none; transform:none;">
              </label>
              <label style="margin:0; font-size:13px; line-height:1.2; display:block;">
                Min. p\u00E5 bil
                <input class="bil-lager-min-liste" data-vare-id="${v.id}" type="text" inputmode="numeric" pattern="[0-9]*" value="${gamleMin.get(String(v.id)) || ''}" placeholder="0" autocomplete="off" style="width:100%; min-width:0; height:38px; min-height:38px; max-height:38px; padding:7px 8px; margin-top:4px; pointer-events:auto; background:#f8fafc; color:#111827; border:1px solid #cbd5e1; border-radius:8px; font-size:16px; line-height:20px; box-sizing:border-box; appearance:none; -webkit-appearance:none; transform:none;">
              </label>
            </div>
          </div>
        `).join("")}
      </div>
    `;
    aktiverBilLagerListeFelter();
    return;
  }

  c.innerHTML = `
    ${topp}
    <div style="overflow:auto; max-height:460px; border:1px solid #374151; border-radius:10px; margin-top:8px;">
      <table class="bil-tabell">
        <thead>
          <tr>
            <th>Varenr</th>
            <th>Vare</th>
            <th>Innpris</th>
            <th>Utpris</th>
            <th>Hovedlager</th>
            <th>Min. hovedlager</th>
            <th>MVA</th>
            <th>Antall til bil</th>
            <th>Min. p\u00E5 bil</th>
          </tr>
        </thead>
        <tbody>
          ${varerTilBilLager.map(v => `
            <tr>
              <td>${vareNr(v)}</td>
              <td>${vareNavn(v)}</td>
              <td>${formatKr(vareInnpris(v))}</td>
              <td>${formatKr(varePris(v))}</td>
              <td>${vareHovedlager(v)}</td>
              <td>${vareMinimum(v)}</td>
              <td>${vareMva(v)}%</td>
              <td style="width:92px;">
                <input class="bil-lager-antall-liste" data-vare-id="${v.id}" type="text" inputmode="numeric" pattern="[0-9]*" value="${gamleAntall.get(String(v.id)) || ''}" placeholder="0" autocomplete="off" style="width:86px; max-width:86px; height:30px; padding:4px 6px; margin:0; pointer-events:auto; background:#f8fafc; color:#111827; border:1px solid #cbd5e1;">
              </td>
              <td style="width:92px;">
                <input class="bil-lager-min-liste" data-vare-id="${v.id}" type="text" inputmode="numeric" pattern="[0-9]*" value="${gamleMin.get(String(v.id)) || ''}" placeholder="0" autocomplete="off" style="width:86px; max-width:86px; height:30px; padding:4px 6px; margin:0; pointer-events:auto; background:#f8fafc; color:#111827; border:1px solid #cbd5e1;">
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  aktiverBilLagerListeFelter();
}

function aktiverBilLagerListeFelter() {
  document.querySelectorAll("#bilLagerFyllListe input.bil-lager-antall-liste, #bilLagerFyllListe input.bil-lager-min-liste").forEach(input => {
    input.disabled = false;
    input.readOnly = false;
    input.removeAttribute("disabled");
    input.removeAttribute("readonly");
    input.style.pointerEvents = "auto";
    input.style.userSelect = "text";
    input.style.webkitUserSelect = "text";
    input.style.position = "relative";
    input.style.zIndex = "5";
    input.style.opacity = "1";
    input.style.fontSize = "16px";
    input.style.boxSizing = "border-box";
    input.style.transform = "none";
    input.style.webkitTransform = "none";
    input.style.zoom = "1";
    input.tabIndex = 0;
    if (input.dataset.rilFocusFix === "1") return;
    input.dataset.rilFocusFix = "1";
    input.addEventListener("focusin", function (e) {
      window.rilSkriverBilLager = true;
      this.style.fontSize = "16px";
      this.style.transform = "none";
      this.style.webkitTransform = "none";
      const kort = this.closest(".ril-fyllbil-mobilkort");
      if (kort) {
        kort.style.padding = "8px";
        kort.style.transform = "none";
        kort.style.webkitTransform = "none";
      }
      e.stopPropagation();
    }, true);
    input.addEventListener("focusout", function () {
      setTimeout(() => { window.rilSkriverBilLager = false; }, 250);
    }, true);
    input.addEventListener("touchstart", function (e) {
      window.rilSkriverBilLager = true;
      e.stopPropagation();
    }, true);
    input.addEventListener("mousedown", function (e) {
      window.rilSkriverBilLager = true;
      e.stopPropagation();
    }, true);
    input.addEventListener("click", function (e) {
      window.rilSkriverBilLager = true;
      e.stopPropagation();
      this.focus();
    }, true);
    input.addEventListener("keydown", function (e) {
      e.stopPropagation();
    }, true);
    input.addEventListener("input", function () {
      // Tillat bare hele tall. Tomt felt er lov helt til lagring.
      this.value = String(this.value || "").replace(/[^0-9]/g, "");
    });
  });
}

async function hentInnloggetBrukerTilLogg() {
  try {
    if (!window.supabaseClient || !supabaseClient.auth) return {};
    const { data } = await supabaseClient.auth.getUser();
    const user = data && data.user ? data.user : null;
    return {
      bruker_id: user && user.id ? user.id : null,
      bruker_epost: user && user.email ? user.email : null,
      bruker_navn: user && user.user_metadata ? (user.user_metadata.full_name || user.user_metadata.name || null) : null
    };
  } catch (e) {
    console.warn("Kunne ikke hente innlogget bruker til lagerlogg:", e);
    return {};
  }
}

async function skrivLagerlogg(rad) {
  try {
    let { error } = await supabaseClient.from("hand_lagerlogg").insert([rad]);

    // Hvis hentet_av-kolonnen ikke er lagt inn enn\u00E5, skriver vi resten av loggen
    // slik at lagerflytting ikke stopper. Kj\u00F8r SQL-filen i zippen for \u00E5 lagre hentet_av.
    if (error && String(error.message || "").toLowerCase().includes("hentet_av")) {
      const radUtenHentetAv = { ...rad };
      delete radUtenHentetAv.hentet_av;
      const fallback = await supabaseClient.from("hand_lagerlogg").insert([radUtenHentetAv]);
      error = fallback.error;
    }

    if (error) {
      console.warn("Lagerlogg ble ikke skrevet. Kj\u00F8r lagerlogg.sql hvis tabellen mangler:", error.message);
    }
  } catch (e) {
    console.warn("Lagerlogg feilet:", e);
  }
}


function handErUuidVerdi(v) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(v);
}

function handRenBestillingRad(rad) {
  const out = {};
  const copy = [
    "firma_id", "ansatt_id", "bruker_id", "bil_id", "vare_id",
    "bil_navn", "bilnavn", "varenr", "varenavn", "vare_navn",
    "bruker_epost", "bruker_navn", "user_email", "opprettet_av",
    "minimum_antall", "kommentar"
  ];
  copy.forEach(k => {
    if (rad[k] !== undefined && rad[k] !== null && String(rad[k]) !== "") out[k] = rad[k];
  });
  out.bestilt = Number(rad.bestilt || rad.antall || 0);
  out.antall = Number(rad.antall || rad.bestilt || 0);
  out.levert = Number(rad.levert || 0);
  out.godkjent = Number(rad.godkjent || 0);
  out.rest = Number(rad.rest || out.bestilt || 0);
  out.mottatt = Number(rad.mottatt || 0);
  out.status = rad.status || "venter";
  out.admin_godkjent = false;
  out.admin_svar_sendt = false;
  out.ansatt_godkjent = false;
  out.lagt_pa_bil = false;
  out.arkivert = false;
  out.lukket = false;
  out.opprettet = new Date().toISOString();
  return out;
}

async function handInsertBestillingTrygt(payload) {
  let rader = (Array.isArray(payload) ? payload : [payload]).map(handRenBestillingRad);
  const uuidFelter = ["firma_id", "ansatt_id", "bil_id", "vare_id"];
  for (let i = 0; i < 20; i++) {
    const res = await supabaseClient.from("hand_bil_bestilling").insert(rader);
    if (!res.error) return res;

    const msg = String(res.error.message || "");
    const kol =
      (msg.match(/Could not find the '([^']+)' column of 'hand_bil_bestilling'/i) || [])[1] ||
      (msg.match(/column "([^"]+)".*does not exist/i) || [])[1];

    if (kol) {
      rader.forEach(r => delete r[kol]);
      continue;
    }

    const bad =
      (msg.match(/invalid input syntax for type uuid:\s*"([^"]+)"/i) || [])[1];

    if (bad) {
      let endret = false;
      rader.forEach(r => {
        uuidFelter.forEach(k => {
          if (String(r[k] ?? "") === String(bad)) {
            delete r[k];
            endret = true;
          }
        });
      });
      if (endret) continue;
    }

    return res;
  }
  return { error: { message: "Kunne ikke lagre bestilling etter flere forsøk." } };
}

function handHydrerBilLagerRad(rad) {
  const vareliste = Array.isArray(window.varerTilBilLager) ? window.varerTilBilLager : (Array.isArray(varerTilBilLager) ? varerTilBilLager : []);
  return {
    ...rad,
    varer: rad.varer || vareliste.find(v => String(v.id) === String(rad.vare_id)) || {},
    biler: rad.biler || (typeof hentBilFraId === "function" ? hentBilFraId(rad.bil_id) : null) || {}
  };
}

async function opprettBilLagerBestillingListe() {
  bilMelding("Sender bestilling til admin...");
  const bilId = hentValgtBilIdForBilLager();

  if (!bilId) {
    bilMelding("Velg bil først.", true);
    return;
  }

  const rader = Array.from(document.querySelectorAll(".bil-lager-antall-liste"))
    .map(input => {
      const vareId = input.dataset.vareId;
      const antall = Number(String(input.value || "0").replace(",", "."));
      const minInput = document.querySelector(`.bil-lager-min-liste[data-vare-id="${vareId}"]`);
      const minimum = Number(String(minInput?.value || "0").replace(",", "."));
      return { vareId, antall, minimum };
    })
    .filter(r => r.vareId && Number.isFinite(r.antall) && r.antall > 0 && Number.isInteger(r.antall));

  if (!rader.length) {
    bilMelding("Skriv antall på minst én vare i listen.", true);
    return;
  }

  const vareIds = rader.map(r => r.vareId);
  const { data: varerFraDb, error: vareError } = await supabaseClient
    .from("hand_vare")
    .select("*")
    .in("id", vareIds);

  if (vareError) {
    bilMelding("Kunne ikke hente varer: " + vareError.message, true);
    return;
  }

  const varerMap = new Map((varerFraDb || []).map(v => [String(v.id), v]));
  const firmaId = (typeof window.hentAktivFirmaId === "function" ? window.hentAktivFirmaId() : null) || window.aktivFirmaId || window.firmaData?.id || window.firma?.id || null;
  const payload = [];

  for (const r of rader) {
    const vare = varerMap.get(String(r.vareId));
    if (!vare) continue;
    payload.push({
      firma_id: firmaId || null,
      bil_id: bilId,
      vare_id: r.vareId,
      varenr: vare.varenr || vare.vare_nr || null,
      varenavn: vare.navn || vare.varenavn || vare.beskrivelse || null,
      bil_navn: (typeof hentBilFraId === "function" && hentBilFraId(bilId) ? (hentBilFraId(bilId).navn || hentBilFraId(bilId).bilnavn || hentBilFraId(bilId).regnr) : null),
      bruker_epost: window.innloggetEpost || window.handInnloggetEpost || localStorage.getItem("handInnloggetEpost") || localStorage.getItem("innloggetEpost") || null,
      bruker_navn: window.innloggetNavn || window.innloggetAnsattNavn || localStorage.getItem("handInnloggetNavn") || localStorage.getItem("innloggetNavn") || null,
      opprettet_av: window.innloggetEpost || window.handInnloggetEpost || localStorage.getItem("handInnloggetEpost") || localStorage.getItem("innloggetEpost") || null,
      minimum_antall: r.minimum || 0,
      bestilt: r.antall,
      levert: 0,
      rest: r.antall,
      status: "venter"
    });
  }

  if (!payload.length) {
    bilMelding("Fant ingen gyldige varer å bestille.", true);
    return;
  }

  const { error } = await handInsertBestillingTrygt(payload);
  if (error) {
    bilMelding("Kunne ikke sende bestilling til admin: " + error.message, true);
    return;
  }

  document.querySelectorAll(".bil-lager-antall-liste, .bil-lager-min-liste").forEach(input => input.value = "");
  bilMelding("Bestilling sendt til admin.");
  if (typeof window.handLastBilBestillinger === "function") {
    try { await window.handLastBilBestillinger(); } catch (e) {}
  }
}

async function lagreBilLagerListe() {
  bilMelding("Bekrefter mottatte varer og legger på bil...");
  const bilId = hentValgtBilIdForBilLager();

  if (!bilId) {
    bilMelding("Velg bil først.", true);
    return;
  }

  const rader = Array.from(document.querySelectorAll(".bil-lager-antall-liste"))
    .map(input => {
      const vareId = input.dataset.vareId;
      const antall = Number(String(input.value || "0").replace(",", "."));
      const minInput = document.querySelector(`.bil-lager-min-liste[data-vare-id="${vareId}"]`);
      const minimum = Number(String(minInput?.value || "0").replace(",", "."));
      return { vareId, antall, minimum };
    })
    .filter(r => r.vareId && Number.isFinite(r.antall) && r.antall > 0 && Number.isInteger(r.antall));

  if (!rader.length) {
    bilMelding("Skriv antall på minst én vare i listen.", true);
    return;
  }

  bilMelding("Sjekker hovedlager og legger mottatte varer på bil...");

  const vareIds = rader.map(r => r.vareId);
  const { data: varerFraDb, error: vareError } = await supabaseClient
    .from("hand_vare")
    .select("*")
    .in("id", vareIds);

  if (vareError) {
    bilMelding("Kunne ikke hente hovedlager: " + vareError.message, true);
    return;
  }

  const varerMap = new Map((varerFraDb || []).map(v => [String(v.id), v]));
  const bruker = await hentInnloggetBrukerTilLogg();
  const hentetAv = bruker.bruker_navn || bruker.bruker_epost || window.innloggetEpost || "";
  const bil = hentBilFraId(bilId);
  const firmaId = (typeof window.hentAktivFirmaId === "function" ? window.hentAktivFirmaId() : null) || window.aktivFirmaId || window.firmaData?.id || window.firma?.id || null;

  let lagret = 0;
  let bestillingLagret = 0;
  let restTotalt = 0;
  const kvittering = [];

  for (const r of rader) {
    const vare = varerMap.get(String(r.vareId));
    if (!vare) {
      bilMelding("Fant ikke en av varene i hovedlager.", true);
      return;
    }

    const hovedlagerFor = vareHovedlager(vare);
    const levert = Math.max(0, Math.min(hovedlagerFor, r.antall));
    const rest = Math.max(0, r.antall - levert);
    const hovedlagerEtter = Math.max(0, hovedlagerFor - levert);
    const status = rest > 0 ? (levert > 0 ? "delvis_levert" : "restordre") : "levert";

    if (levert > 0) {
      const { data: eksisterende, error: sjekkError } = await supabaseClient
        .from("hand_bil_lager")
        .select("id, antall, minimum_antall")
        .eq("bil_id", bilId)
        .eq("vare_id", r.vareId)
        .limit(1);

      if (sjekkError) {
        bilMelding("Kunne ikke sjekke bil-lager: " + sjekkError.message, true);
        return;
      }

      let res;
      if (eksisterende && eksisterende.length) {
        const nyAntall = Number(eksisterende[0].antall || 0) + levert;
        const nyMinimum = r.minimum || Number(eksisterende[0].minimum_antall || 0);
        res = await supabaseClient
          .from("hand_bil_lager")
          .update({ antall: nyAntall, minimum_antall: nyMinimum })
          .eq("id", eksisterende[0].id);
      } else {
        res = await supabaseClient
          .from("hand_bil_lager")
          .insert([{ bil_id: bilId, vare_id: r.vareId, antall: levert, minimum_antall: r.minimum || 0 }]);
      }

      if (res.error) {
        bilMelding("Kunne ikke lagre vare på bil: " + res.error.message, true);
        return;
      }

      const oppdater = await supabaseClient
        .from("hand_vare")
        .update({ lager_antall: hovedlagerEtter })
        .eq("id", r.vareId);

      if (oppdater.error) {
        bilMelding("Varen ble lagt på bil, men hovedlager kunne ikke trekkes: " + oppdater.error.message, true);
        return;
      }

      await skrivLagerlogg({
        type: "flytting",
        handling: rest > 0 ? "hovedlager_til_bil_delvis_med_restordre" : "hovedlager_til_bil",
        bil_id: bilId,
        bil_navn: bilNavn(bil),
        vare_id: r.vareId,
        varenr: vareNr(vare) || null,
        varenavn: vareNavn(vare),
        antall: levert,
        hovedlager_for: hovedlagerFor,
        hovedlager_etter: hovedlagerEtter,
        hentet_av: hentetAv || null,
        ...bruker
      });

      lagret++;
    }

    try {
      if (typeof window.handLagreBilBestilling === "function") {
        await window.handLagreBilBestilling({
          firma_id: firmaId,
          bil_id: bilId,
          bil_navn: bilNavn(bil),
          vare_id: r.vareId,
          varenr: vareNr(vare) || null,
          varenavn: vareNavn(vare),
          bestilt: r.antall,
          levert,
          rest,
          status,
          hentet_av: hentetAv || null,
          bruker_id: bruker.bruker_id || null,
          bruker_epost: bruker.bruker_epost || window.innloggetEpost || null,
          bruker_navn: bruker.bruker_navn || null,
          hovedlager_for: hovedlagerFor,
          hovedlager_etter: hovedlagerEtter
        });
        bestillingLagret++;
      }
    } catch (e) {
      console.warn("Bestillingen ble ikke logget i bil_bestillinger:", e);
    }

    if (rest > 0) restTotalt += rest;
    kvittering.push({ vare, bestilt: r.antall, levert, rest, status, hovedlagerFor, hovedlagerEtter });
  }

  document.querySelectorAll(".bil-lager-antall-liste, .bil-lager-min-liste").forEach(input => input.value = "");

  if (typeof window.handVisBilBestillingKvittering === "function") {
    window.handVisBilBestillingKvittering({ bil: bilNavn(bil), hentetAv, rader: kvittering });
  }

  const restTekst = restTotalt > 0 ? ` Restordre: ${restTotalt}.` : " Ingen restordre.";
  const bestillingTekst = bestillingLagret ? " Bestilling sendt til admin." : " Kjør SQL-scriptet for bil_bestillinger hvis admin ikke ser bestillingen.";
  bilMelding(`Bestilling lagret. ${lagret} varelinje(r) lagt på bil.${restTekst}${bestillingTekst}`);

  await lastBilerOgBilLager();
  await fyllVarevalgFraAktivBil();
}

async function lagreBilLager() {
  const bilId = bilVerdi("bilLagerBilValg") || bilVerdi("lagerBilValg") || bilVerdi("bilValg");
  const vareId = bilVerdi("bilLagerVareValg") || bilVerdi("lagerVareValg");
  const antall = Number(String(bilVerdi("bilLagerAntall") || bilVerdi("lagerFlyttAntall") || "0").replace(",", "."));
  const minimum = Number(String(bilVerdi("bilLagerMinimum") || "0").replace(",", "."));

  if (!bilId || !vareId) {
    bilMelding("Velg bil og vare f\u00F8rst.", true);
    return;
  }

  if (!Number.isFinite(antall) || antall < 0 || !Number.isInteger(antall)) {
    bilMelding("Antall m\u00E5 v\u00E6re heltall 0 eller h\u00F8yere.", true);
    return;
  }

  const { data: eksisterende, error: sjekkError } = await supabaseClient
    .from("hand_bil_lager")
    .select("id")
    .eq("bil_id", bilId)
    .eq("vare_id", vareId)
    .limit(1);

  if (sjekkError) {
    bilMelding("Kunne ikke sjekke bil-lager: " + sjekkError.message, true);
    return;
  }

  const rad = {
    bil_id: bilId,
    vare_id: vareId,
    antall,
    minimum_antall: minimum || 0
  };

  let res;
  if (eksisterende && eksisterende.length) {
    res = await supabaseClient.from("hand_bil_lager").update(rad).eq("id", eksisterende[0].id);
  } else {
    res = await supabaseClient.from("hand_bil_lager").insert([rad]);
  }

  if (res.error) {
    bilMelding("Kunne ikke lagre bil-lager: " + res.error.message, true);
    return;
  }

  bilMelding("Bil-lager lagret.");
  await lastBilerOgBilLager();
  await fyllVarevalgFraAktivBil();
}

async function lastBilLager() {
  const liste = bilEl("bilLagerListe");
  if (!window.supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from("hand_bil_lager")
    .select("id, bil_id, vare_id, antall, minimum_antall");

  if (error) {
    bilLager = [];
    if (liste) liste.innerHTML = "Kunne ikke hente bil-lager: " + error.message;
    console.warn("Kunne ikke hente bil-lager:", error);
    return [];
  }

  bilLager = (data || []).map(handHydrerBilLagerRad);
  window.bilLager = bilLager;

  // Hent siste lagerlogg per bil/vare, s\u00E5 vi kan vise hvem som faktisk hentet varene.
  bilLagerHentetMap = new Map();
  try {
    const { data: loggData, error: loggError } = await supabaseClient
      .from("hand_lagerlogg")
      .select("bil_id, vare_id, hentet_av, bruker_navn, bruker_epost, opprettet")
      .eq("handling", "hovedlager_til_bil")
      .limit(1000);

    if (!loggError && Array.isArray(loggData)) {
      loggData.forEach(rad => {
        const key = `${rad.bil_id || ""}|${rad.vare_id || ""}`;
        if (!bilLagerHentetMap.has(key)) {
          bilLagerHentetMap.set(key, {
            navn: rad.hentet_av || rad.bruker_navn || rad.bruker_epost || "",
            dato: rad.opprettet || ""
          });
        }
      });
    } else if (loggError) {
      console.warn("Kunne ikke hente hvem som hentet varer fra lagerlogg:", loggError.message);
    }
  } catch (e) {
    console.warn("Henting av henter-navn feilet:", e);
  }

  tegnBilLager();
  if (typeof window.tegnLagerloggForBil === "function") {
    try { await window.tegnLagerloggForBil(); } catch (e) { console.warn("Kunne ikke vise lagerlogg:", e); }
  }
  return bilLager;
}

function henterTekstForBilLagerRad(rad) {
  const key = `${rad?.bil_id || ""}|${rad?.vare_id || ""}`;
  const logg = bilLagerHentetMap.get(key);
  if (!logg || !logg.navn) return "";
  let dato = "";
  try {
    if (logg.dato) dato = new Date(logg.dato).toLocaleDateString("no-NO");
  } catch (_) {}
  return dato ? `${logg.navn} (${dato})` : logg.navn;
}

function tegnBilLager() {
  const e = bilEl("bilLagerListe");
  if (!e) return;

  const valgtBilId = hentValgtBilIdForBilLager();
  const rader = valgtBilId
    ? bilLager.filter(rad => String(rad.bil_id) === String(valgtBilId))
    : bilLager;

  if (!rader.length) {
    e.innerHTML = valgtBilId
      ? `<p>Ingen varer ligger p\u00E5 ${valgtBilOverskrift()} enn\u00E5.</p>`
      : "<p>Ingen varer p\u00E5 bil-lager.</p>";
    return;
  }

  e.innerHTML = `
    <div class="info" style="margin:8px 0 6px 0; font-weight:bold;">
      ${valgtBilId ? 'Varer p\u00E5 bil: ' + valgtBilOverskrift() : 'Varer p\u00E5 bil-lager'}
    </div>
    <table class="bil-tabell">
      <thead>
        <tr>
          ${valgtBilId ? '' : '<th>Bil</th>'}
          ${valgtBilId ? '' : '<th>Ansatt / bruker</th>'}
          <th>Varenr</th>
          <th>Vare</th>
          <th>Utpris</th>
          <th>Antall p\u00E5 bil</th>
          <th>Minimum p\u00E5 bil</th>
          <th>Sist hentet av</th>
        </tr>
      </thead>
      <tbody>
        ${rader.map(rad => `
          <tr>
            ${valgtBilId ? '' : `<td>${bilNavn(rad.biler)}</td>`}
            ${valgtBilId ? '' : `<td>${hentAnsattForBil(rad.bil_id)}</td>`}
            <td>${rad.varer?.varenr || ""}</td>
            <td>${vareNavn(rad.varer)}</td>
            <td>${formatKr(varePris(rad.varer))}</td>
            <td>${Number(rad.antall || 0)}</td>
            <td>${Number(rad.minimum_antall || 0)}</td>
            <td>${henterTekstForBilLagerRad(rad) || ""}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function fyllVarevalgFraAktivBil() {
  const select = bilEl("vareValg");
  if (!select || !window.supabaseClient) return;

  const bilId = bilVerdi("bilValg") || localStorage.getItem("aktivBilId") || window.aktivBilId || "";

  const gammel = select.value;
  select.innerHTML = "";

  if (!bilId) {
    select.innerHTML = '<option value="">Velg aktiv bil f\u00F8rst</option>';
    if (bilEl("varePris")) bilEl("varePris").value = "0";
    return;
  }

  const { data, error } = await supabaseClient
    .from("hand_bil_lager")
    .select("id, bil_id, vare_id, antall")
    .eq("bil_id", bilId)
    .gt("antall", 0);

  if (error) {
    select.innerHTML = '<option value="">Feil ved henting av bil-lager</option>';
    console.error("Feil ved henting av varer fra bil_lager:", error);
    return;
  }

  select.innerHTML = '<option value="">Velg vare fra valgt bil</option>';

  (data || []).map(handHydrerBilLagerRad).forEach(rad => {
    const v = rad.varer || {};
    const opt = document.createElement("option");
    opt.value = rad.vare_id;
    opt.dataset.bilLagerId = rad.id;
    opt.dataset.antallIBil = Number(rad.antall || 0);
    opt.dataset.pris = varePris(v);
    opt.textContent = `${vareNavn(v)} - ${varePris(v).toFixed(2)} kr (${Number(rad.antall || 0)} i bil)`;
    select.appendChild(opt);
  });

  if (gammel && Array.from(select.options).some(o => String(o.value) === String(gammel))) {
    select.value = gammel;
  }

  oppdaterVarePrisFraValg();
}

function oppdaterVarePrisFraValg() {
  const select = bilEl("vareValg");
  const pris = bilEl("varePris");
  if (!select || !pris) return;

  const opt = select.selectedOptions && select.selectedOptions[0];
  pris.value = opt?.dataset?.pris || "0";
}

function oppdaterAktivBilVisning() {
  const select = bilEl("bilValg");
  const info = bilEl("aktivBilInfo");

  const bilId = select?.value || localStorage.getItem("aktivBilId") || "";
  if (select && bilId && select.value !== bilId) {
    const finnes = Array.from(select.options).some(o => String(o.value) === String(bilId));
    if (finnes) select.value = bilId;
  }

  const navn = select?.selectedOptions?.[0]?.textContent || localStorage.getItem("aktivBilNavn") || "";
  if (info) {
    info.textContent = bilId ? "Aktiv bil: " + navn : "Ingen bil valgt.";
    info.style.color = bilId ? "#86efac" : "#fca5a5";
  }
}

async function byttBil() {
  const select = bilEl("bilValg");
  if (!select) return;

  const bilId = select.value || "";
  if (!bilId) {
    localStorage.removeItem("aktivBilId");
    localStorage.removeItem("aktivBilNavn");
    window.aktivBilId = "";
  } else {
    localStorage.setItem("aktivBilId", String(bilId));
    localStorage.setItem("aktivBilNavn", select.selectedOptions?.[0]?.textContent || "");
    window.aktivBilId = String(bilId);
  }

  oppdaterAktivBilVisning();
  await fyllVarevalgFraAktivBil();
}



/* RIL PROD 20260613: Importer varer til hovedlager nederst på bil-siden.
   Dette erstatter hand-lager-patch.js for import/fylleliste.
*/
function bilImportMelding(tekst, erFeil = false) {
  const e = bilEl("importBilLagerMelding") || bilEl("bilMelding");
  if (e) {
    e.textContent = tekst || "";
    e.style.color = erFeil ? "#fca5a5" : "#86efac";
  }
  if (erFeil) console.error(tekst);
  else if (tekst) console.log(tekst);
}

function bilEscapeHtml(verdi) {
  return String(verdi ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bilNormaliserKolonne(verdi) {
  return String(verdi || "")
    .toLowerCase()
    .replaceAll(" ", "")
    .replaceAll("_", "")
    .replaceAll("-", "")
    .replaceAll(".", "")
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a");
}

function bilHentKolonne(rad, navnListe) {
  const oppslag = {};
  Object.keys(rad || {}).forEach(k => {
    oppslag[bilNormaliserKolonne(k)] = rad[k];
  });

  for (const navn of navnListe) {
    const verdi = oppslag[bilNormaliserKolonne(navn)];
    if (verdi !== undefined && verdi !== null && String(verdi).trim() !== "") {
      return verdi;
    }
  }

  return "";
}

function bilTilTall(verdi, standard = 0) {
  if (verdi === undefined || verdi === null || String(verdi).trim() === "") return standard;

  const s = String(verdi)
    .replaceAll(" ", "")
    .replaceAll("\u00a0", "")
    .replaceAll("kr", "")
    .replaceAll("NOK", "")
    .replace(",", ".");

  const n = Number(s);
  return Number.isFinite(n) ? n : standard;
}

function bilRyddTekst(verdi) {
  let s = String(verdi ?? "").replace(/^\uFEFF/, "");
  const map = {
    "Ã¦": "æ", "Ã†": "Æ",
    "Ã¸": "ø", "Ã˜": "Ø",
    "Ã¥": "å", "Ã…": "Å",
    "Ã©": "é", "Ã¨": "è", "Ã¼": "ü", "Ã¶": "ö", "Ã¤": "ä",
    "Â": ""
  };

  Object.keys(map).forEach(k => {
    s = s.split(k).join(map[k]);
  });

  return s.trim();
}

function bilLagUuid() {
  try {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function sikreImportTilHovedlagerIBunn() {
  const bilListe = bilEl("bilLagerListe");
  const fylleListe = bilEl("bilLagerFyllListe");
  if (!bilListe && !fylleListe) return;

  // Hvis gammel patch allerede har laget importboksen, flytt den nederst og bruk samme innhold.
  let wrap = bilEl("importBilLagerBunnOmrade") || bilEl("patchImportLagerWrap");

  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "importBilLagerBunnOmrade";
    wrap.innerHTML = `
      <hr>
      <h3>Importer varer til hovedlager</h3>
      <p class="info">Dette brukes bare når du skal laste inn eller oppdatere hovedlageret.</p>

      <label for="importBilLagerFil">Velg CSV/Excel-fil</label>
      <input id="importBilLagerFil" type="file" accept=".csv,.xlsx,.xls">

      <button id="importBilLagerKnapp" type="button">Importer varer til hovedlager</button>
      <button id="hentFyllelisteFraDbKnapp" type="button" class="secondary">Oppdater fylleliste</button>

      <div id="importBilLagerMelding" class="melding"></div>
    `;
  } else {
    wrap.id = "importBilLagerBunnOmrade";
  }

  // Nederst: etter listen over varer som ligger på bil.
  if (bilListe && bilListe.parentNode && bilListe.nextSibling !== wrap) {
    bilListe.after(wrap);
  } else if (fylleListe && fylleListe.parentNode && fylleListe.nextSibling !== wrap) {
    fylleListe.after(wrap);
  }

  const importKnapp = bilEl("importBilLagerKnapp");
  if (importKnapp) {
    importKnapp.onclick = importerVarerTilHovedlagerFraBilside;
  }

  const hentKnapp = bilEl("hentFyllelisteFraDbKnapp");
  if (hentKnapp) {
    hentKnapp.onclick = async function () {
      await fyllBilLagerVareValg();
      bilImportMelding("Fyllelisten er oppdatert fra hovedlager.");
    };
  }
}

async function lesImportRaderFraBilside(fil) {
  if (typeof XLSX === "undefined") {
    throw new Error("XLSX-biblioteket er ikke lastet.");
  }

  const buffer = await fil.arrayBuffer();
  const navn = String(fil.name || "").toLowerCase();

  let workbook;
  if (navn.endsWith(".csv")) {
    let tekst = new TextDecoder("utf-8").decode(buffer);
    if (tekst.includes("�")) tekst = new TextDecoder("windows-1252").decode(buffer);
    workbook = XLSX.read(tekst, { type: "string", raw: false });
  } else {
    workbook = XLSX.read(buffer, { type: "array", raw: false });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
}

function mapImportVareFraBilside(rad) {
  const varenr = bilRyddTekst(bilHentKolonne(rad, [
    "varenr", "vare nr", "vare_nr", "Varenr", "VareNr",
    "artikkel", "artikkelnr", "artikkelnummer", "produktnr", "produktnummer", "sku"
  ]));

  const navn = bilRyddTekst(bilHentKolonne(rad, [
    "navn", "varenavn", "vare navn", "Varenavn", "vare",
    "produkt", "beskrivelse", "tekst", "description"
  ]));

  if (!varenr && !navn) return null;

  const lager = Math.round(bilTilTall(bilHentKolonne(rad, [
    "lager_antall", "lager antall", "antall", "lager", "beholdning", "qty", "quantity"
  ]), 0));

  const minimum = Math.round(bilTilTall(bilHentKolonne(rad, [
    "minimum_antall", "minimum", "min", "min antall"
  ]), 0));

  const mva = bilTilTall(bilHentKolonne(rad, [
    "mva_prosent", "mva_sats", "mva", "MVA", "vat"
  ]), 25) || 25;

  const innpris = bilTilTall(bilHentKolonne(rad, [
    "innpris", "inn pris", "kostpris", "nettopris", "pris inn"
  ]), 0);

  const pris = bilTilTall(bilHentKolonne(rad, [
    "pris", "utpris", "ut pris", "utsalgspris", "salgspris", "pris ut"
  ]), 0);

  return {
    varenr: varenr || null,
    navn: navn || varenr,
    beskrivelse: bilRyddTekst(bilHentKolonne(rad, ["beskrivelse", "tekst", "description"])) || null,
    innpris,
    pris,
    utpris: pris,
    lager_antall: lager,
    antall: lager,
    minimum_antall: minimum,
    mva_prosent: mva,
    mva,
    mva_sats: mva,
    aktiv: true
  };
}

async function importerVarerTilHovedlagerFraBilside() {
  try {
    const input = bilEl("importBilLagerFil");
    const fil = input && input.files && input.files[0];

    if (!fil) {
      bilImportMelding("Velg CSV- eller Excel-fil først.", true);
      return;
    }

    if (!window.supabaseClient) {
      bilImportMelding("Supabase er ikke lastet. Sjekk config.js.", true);
      return;
    }

    bilImportMelding("Leser importfil...");
    const raderFraFil = await lesImportRaderFraBilside(fil);
    const rader = raderFraFil.map(mapImportVareFraBilside).filter(Boolean);

    if (!rader.length) {
      bilImportMelding("Fant ingen varer i importfilen.", true);
      return;
    }

    bilImportMelding("Lagrer " + rader.length + " varer til hovedlager...");

    let lagret = 0;

    for (const rad of rader) {
      let eksisterende = null;

      if (rad.varenr) {
        const sjekk = await supabaseClient
          .from("hand_vare")
          .select("id")
          .eq("varenr", rad.varenr)
          .limit(1);

        if (sjekk.error) {
          bilImportMelding("Kunne ikke sjekke varenr " + rad.varenr + ": " + sjekk.error.message, true);
          return;
        }

        eksisterende = sjekk.data && sjekk.data.length ? sjekk.data[0] : null;
      }

      let res;
      if (eksisterende && eksisterende.id) {
        res = await supabaseClient
          .from("hand_vare")
          .update(rad)
          .eq("id", eksisterende.id)
          .select("id")
          .single();
      } else {
        res = await supabaseClient
          .from("hand_vare")
          .insert([{ id: bilLagUuid(), ...rad }])
          .select("id")
          .single();
      }

      if (res.error) {
        bilImportMelding("Import stoppet ved " + (rad.varenr || rad.navn) + ": " + res.error.message, true);
        return;
      }

      lagret++;
    }

    if (input) input.value = "";

    bilImportMelding("Importerte " + lagret + " varer til hovedlager.");
    await fyllBilLagerVareValg();
    await lastBilLager();
  } catch (e) {
    bilImportMelding("Import feilet: " + (e && e.message ? e.message : String(e)), true);
  }
}


async function lastBilerOgBilLager() {
  sikreImportTilHovedlagerIBunn();
  await lastBiler();
  await fyllBilLagerVareValg();
  await lastBilLager();
  await fyllVarevalgFraAktivBil();
  sikreImportTilHovedlagerIBunn();
}

function kobleBilKnapper() {
  const nyBilKnapp = bilEl("nyBilKnapp");
  if (nyBilKnapp) nyBilKnapp.onclick = nyBilSkjema;

  const lagreBilKnapp = bilEl("lagreBilKnapp");
  if (lagreBilKnapp) lagreBilKnapp.onclick = lagreBil;

  const lagreBilLagerKnapp = bilEl("lagreBilLagerKnapp");
  if (lagreBilLagerKnapp) lagreBilLagerKnapp.onclick = lagreBilLager;

  const sendBilLagerBestillingKnapp = bilEl("sendBilLagerBestillingKnapp");
  if (sendBilLagerBestillingKnapp) sendBilLagerBestillingKnapp.onclick = opprettBilLagerBestillingListe;

  const lagreBilLagerListeKnapp = bilEl("lagreBilLagerListeKnapp");
  if (lagreBilLagerListeKnapp) lagreBilLagerListeKnapp.onclick = lagreBilLagerListe;

  const byttBilKnapp = bilEl("byttBilKnapp");
  if (byttBilKnapp) byttBilKnapp.onclick = byttBil;

  const bilLagerBilValg = bilEl("bilLagerBilValg");
  if (bilLagerBilValg && !bilLagerBilValg.dataset.bilerListeKoblet) {
    bilLagerBilValg.dataset.bilerListeKoblet = "1";
    bilLagerBilValg.addEventListener("change", function () {
      if (window.rilSkriverBilLager) return;
      tegnFyllBilListe();
      tegnBilLager();
    });
  }

  const bilValg = bilEl("bilValg");
  if (bilValg && !bilValg.dataset.bilerPermanent) {
    bilValg.dataset.bilerPermanent = "1";
    bilValg.addEventListener("change", byttBil);
  }

  const vareValg = bilEl("vareValg");
  if (vareValg && !vareValg.dataset.bilerPermanent) {
    vareValg.dataset.bilerPermanent = "1";
    vareValg.addEventListener("change", oppdaterVarePrisFraValg);
  }

  kobleBilLagerBestillingKnappRobust();
  kobleBilLagerListeKnappRobust();
}



function kobleBilLagerBestillingKnappRobust() {
  const knapp = bilEl("sendBilLagerBestillingKnapp");
  if (knapp) {
    knapp.disabled = false;
    knapp.classList.remove("skjult", "hidden", "modul-skjult");
    knapp.style.display = "";
    knapp.textContent = "Send bestilling til admin";
    knapp.onclick = function (event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      return opprettBilLagerBestillingListe();
    };
  }
}

function kobleBilLagerListeKnappRobust() {
  const knapp = bilEl("lagreBilLagerListeKnapp");
  if (knapp) {
    knapp.disabled = false;
    knapp.classList.remove("skjult", "hidden", "modul-skjult");
    knapp.style.display = "";
    knapp.onclick = function (event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      return lagreBilLagerListe();
    };
  }

  if (!window.__rilBilLagerDelegertKlikk) {
    window.__rilBilLagerDelegertKlikk = true;
    document.addEventListener("click", function (event) {
      const target = event.target;
      if (target && target.id === "lagreBilLagerListeKnapp") {
        event.preventDefault();
        event.stopPropagation();
        return lagreBilLagerListe();
      }
    }, true);
  }
}


document.addEventListener("DOMContentLoaded", async function () {
  kobleBilKnapper();
  if (window.supabaseClient) {
    await lastBilerOgBilLager();
  }
});

window.addEventListener("load", async function () {
  kobleBilKnapper();
  if (window.supabaseClient) {
    await lastBilerOgBilLager();
  }
});

window.settHandSideOverskrift = settHandSideOverskrift;
window.visBilerSide = visBilerSide;
window.tilbakeFraBiler = tilbakeFraBiler;
window.lastBiler = lastBiler;
window.lagreBil = lagreBil;
window.slettBil = slettBil;
window.apneBilForFylling = apneBilForFylling;
window.fyllAlleBilvalg = fyllAlleBilvalg;
window.fyllBilvalg = fyllAlleBilvalg;
window.lastBilLager = lastBilLager;
window.hentBilLager = lastBilLager;
window.lagreBilLager = lagreBilLager;
window.lagreBilLagerListe = lagreBilLagerListe;
window.opprettBilLagerBestillingListe = opprettBilLagerBestillingListe;
window.tegnFyllBilListe = tegnFyllBilListe;
window.fyllVarevalgFraAktivBil = fyllVarevalgFraAktivBil;
window.oppdaterAktivBilVisning = oppdaterAktivBilVisning;
window.lastBilerOgBilLager = lastBilerOgBilLager;
window.sikreImportTilHovedlagerIBunn = sikreImportTilHovedlagerIBunn;
window.importerVarerTilHovedlagerFraBilside = importerVarerTilHovedlagerFraBilside;

window.hentAnsattForBil = hentAnsattForBil;
window.lastAnsatteForBiler = lastAnsatteForBiler;

window.nyBilSkjema = nyBilSkjema;
window.visBilSkjema = visBilSkjema;
window.redigerBil = redigerBil;
window.kobleBilLagerBestillingKnappRobust = kobleBilLagerBestillingKnappRobust;
window.kobleBilLagerListeKnappRobust = kobleBilLagerListeKnappRobust;


/* RIL HARD FIX 20260613: lås knappen "Bekreft mottatt og legg på bil"
   Denne ligger helt sist i hand-biler.js og overtar klikk selv om andre filer roter med onclick.
*/
(function () {
  function hentKnapp() {
    return document.getElementById("lagreBilLagerListeKnapp");
  }

  function hardKobleBilLagerKnapp() {
    const knapp = hentKnapp();
    if (!knapp) return;

    knapp.disabled = false;
    knapp.classList.remove("skjult", "hidden", "modul-skjult");
    knapp.style.display = "inline-block";

    knapp.onclick = async function (event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      const melding = document.getElementById("bilMelding");
      if (melding) {
        melding.textContent = "Knappen virker - lagrer varer på bil...";
        melding.style.color = "#86efac";
      }

      if (typeof window.lagreBilLagerListe === "function") {
        return await window.lagreBilLagerListe();
      }

      alert("Fant ikke funksjonen lagreBilLagerListe i hand-biler.js");
    };
  }

  document.addEventListener("click", async function (event) {
    const target = event.target;
    if (!target || target.id !== "lagreBilLagerListeKnapp") return;

    event.preventDefault();
    event.stopPropagation();

    const melding = document.getElementById("bilMelding");
    if (melding) {
      melding.textContent = "Knappen virker - lagrer varer på bil...";
      melding.style.color = "#86efac";
    }

    if (typeof window.lagreBilLagerListe === "function") {
      return await window.lagreBilLagerListe();
    }

    alert("Fant ikke funksjonen lagreBilLagerListe i hand-biler.js");
  }, true);

  hardKobleBilLagerKnapp();
  document.addEventListener("DOMContentLoaded", hardKobleBilLagerKnapp);
  window.addEventListener("load", function () {
    hardKobleBilLagerKnapp();
    setTimeout(hardKobleBilLagerKnapp, 250);
    setTimeout(hardKobleBilLagerKnapp, 1000);
    setTimeout(hardKobleBilLagerKnapp, 2500);
  });

  window.hardKobleBilLagerKnapp = hardKobleBilLagerKnapp;
})();


/* RIL FIX 20260613: PDF-liste til lager + registrering av mangler ved fyll bil */
(function () {
  function $(id) { return document.getElementById(id); }

  function tekst(v) { return String(v ?? "").trim(); }
  function escPdf(v) { return tekst(v).replace(/[\r\n]+/g, " "); }
  function tall(v) {
    const n = Number(String(v ?? "0").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function finnVare(vareId) {
    const id = String(vareId || "");
    const liste = Array.isArray(window.varerTilBilLager) ? window.varerTilBilLager : [];
    return liste.find(v => String(v.id) === id) || null;
  }

  function hentValgteFyllBilRader() {
    const rader = [];
    document.querySelectorAll(".bil-lager-antall-liste").forEach(input => {
      const vareId = input.dataset.vareId || "";
      const antall = tall(input.value);
      if (!vareId || !antall || antall <= 0) return;

      const vare = finnVare(vareId);
      const minInput = document.querySelector('.bil-lager-min-liste[data-vare-id="' + CSS.escape(vareId) + '"]');
      const hovedlager = typeof window.vareHovedlager === "function" ? window.vareHovedlager(vare) : tall(vare?.lager_antall ?? vare?.antall ?? vare?.beholdning);
      const varenavn = typeof window.vareNavn === "function" ? window.vareNavn(vare) : (vare?.navn || vare?.varenavn || vare?.beskrivelse || "Vare");
      const varenr = typeof window.vareNr === "function" ? window.vareNr(vare) : (vare?.varenr || "");

      rader.push({
        vareId,
        varenr,
        varenavn,
        antall,
        minimum: tall(minInput?.value),
        hovedlager,
        mangler: Math.max(0, antall - hovedlager)
      });
    });
    return rader;
  }

  async function registrerLagermangler(rader) {
    const mangler = (rader || []).filter(r => r.mangler > 0);
    if (!mangler.length) return;

    const bilId = typeof window.hentValgtBilIdForBilLager === "function"
      ? window.hentValgtBilIdForBilLager()
      : ($("bilLagerBilValg")?.value || localStorage.getItem("aktivBilId") || "");

    const bilNavnTekst = $("bilLagerBilValg")?.selectedOptions?.[0]?.textContent || localStorage.getItem("aktivBilNavn") || "";
    const opprettetAv = window.innloggetEpost || "";
    const tidspunkt = new Date().toISOString();

    const lokale = JSON.parse(localStorage.getItem("ril_lager_mangler") || "[]");
    mangler.forEach(r => lokale.push({
      tidspunkt,
      bil_id: bilId || null,
      bil_navn: bilNavnTekst || null,
      vare_id: r.vareId,
      varenr: r.varenr || null,
      varenavn: r.varenavn,
      antall_onsket: r.antall,
      hovedlager: r.hovedlager,
      mangler: r.mangler,
      opprettet_av: opprettetAv || null,
      status: "mangler"
    }));
    localStorage.setItem("ril_lager_mangler", JSON.stringify(lokale.slice(-300)));

    // Prøv å registrere i database hvis tabellen finnes. Feiler stille hvis den ikke er opprettet ennå.
    if (window.supabaseClient) {
      try {
        const dbRader = mangler.map(r => ({
          bil_id: bilId || null,
          bil_navn: bilNavnTekst || null,
          vare_id: r.vareId,
          varenr: r.varenr || null,
          varenavn: r.varenavn,
          antall_onsket: r.antall,
          hovedlager: r.hovedlager,
          mangler: r.mangler,
          opprettet_av: opprettetAv || null,
          status: "mangler"
        }));
        await supabaseClient.from("lager_mangler").insert(dbRader);
      } catch (e) {
        console.warn("lager_mangler-tabellen finnes kanskje ikke. Mangler er lagret lokalt på enheten.", e);
      }
    }
  }

  function lagPdfFyllBilTilLager() {
    const rader = hentValgteFyllBilRader();
    if (!rader.length) {
      alert("Skriv antall på minst én vare før du lager Bestilling til admin.");
      return;
    }

    const bilTekst = $("bilLagerBilValg")?.selectedOptions?.[0]?.textContent || localStorage.getItem("aktivBilNavn") || "Valgt bil";
    const dato = new Date();
    const datoTekst = dato.toLocaleString("no-NO");
    const hentetAv = window.innloggetEpost || "Innlogget bruker";
    const mangler = rader.filter(r => r.mangler > 0);

    if (!window.jspdf || !window.jspdf.jsPDF) {
      const html = `
        <html><head><title>Fyll bil - lagerliste</title></head><body>
        <h2>Fyll bil - lagerliste</h2>
        <p><strong>Bil:</strong> ${bilTekst}</p>
        <p><strong>Dato:</strong> ${datoTekst}</p>
        <p><strong>Hentet av:</strong> ${hentetAv}</p>
        <table border="1" cellpadding="5" cellspacing="0"><thead><tr><th>Varenr</th><th>Vare</th><th>Antall</th><th>På lager</th><th>Mangler</th></tr></thead><tbody>
        ${rader.map(r => `<tr><td>${r.varenr || ""}</td><td>${r.varenavn}</td><td>${r.antall}</td><td>${r.hovedlager}</td><td>${r.mangler || ""}</td></tr>`).join("")}
        </tbody></table>
        ${mangler.length ? "<h3>Mangler må bestilles/registreres</h3>" : ""}
        </body></html>`;
      /* PDF/print deaktivert: bestilling sendes digitalt. */ return false;
      registrerLagermangler(rader);
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = 14;
    const venstre = 12;

    function nySideHvisNodvendig(hoyde) {
      if (y + hoyde > 285) {
        doc.addPage();
        y = 14;
      }
    }

    doc.setFontSize(16);
    doc.text("Fyll bil - lagerliste", venstre, y); y += 8;
    doc.setFontSize(10);
    doc.text("Bil: " + escPdf(bilTekst), venstre, y); y += 5;
    doc.text("Dato: " + escPdf(datoTekst), venstre, y); y += 5;
    doc.text("Hentet av: " + escPdf(hentetAv), venstre, y); y += 8;

    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.text("Varenr", venstre, y);
    doc.text("Vare", 35, y);
    doc.text("Antall", 128, y);
    doc.text("På lager", 150, y);
    doc.text("Mangler", 174, y);
    doc.setFont(undefined, "normal");
    y += 4;
    doc.line(venstre, y, 198, y); y += 4;

    rader.forEach(r => {
      nySideHvisNodvendig(8);
      const navnLinjer = doc.splitTextToSize(escPdf(r.varenavn), 88);
      doc.text(escPdf(r.varenr || ""), venstre, y);
      doc.text(navnLinjer, 35, y);
      doc.text(String(r.antall), 132, y, { align: "right" });
      doc.text(String(r.hovedlager), 164, y, { align: "right" });
      doc.text(r.mangler > 0 ? String(r.mangler) : "", 188, y, { align: "right" });
      y += Math.max(6, navnLinjer.length * 4);
    });

    if (mangler.length) {
      y += 6;
      nySideHvisNodvendig(20);
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.text("Mangler som må registreres/bestilles", venstre, y); y += 6;
      doc.setFontSize(9);
      doc.setFont(undefined, "normal");
      mangler.forEach(r => {
        nySideHvisNodvendig(7);
        doc.text(`${escPdf(r.varenr || "")} ${escPdf(r.varenavn)} - mangler ${r.mangler}`, venstre, y);
        y += 5;
      });
    }

    /* PDF deaktivert: bestilling sendes digitalt. */ return false;
    registrerLagermangler(rader);

    const melding = $("bilMelding");
    if (melding) {
      melding.textContent = mangler.length
        ? "PDF laget. Mangler er registrert lokalt og forsøkt lagret i lager_mangler."
        : "PDF laget. Ingen mangler registrert.";
      melding.style.color = "#86efac";
    }
  }

  function sikrePdfKnappTilLager() {
    const lagre = $("lagreBilLagerListeKnapp");
    if (!lagre || $("lagPdfFyllBilTilLagerKnapp")) return;

    const knapp = document.createElement("button");
    knapp.id = "lagPdfFyllBilTilLagerKnapp";
    knapp.type = "button";
    knapp.className = "secondary";
    knapp.textContent = "Lag Bestilling til admin";
    knapp.style.marginLeft = "6px";
    knapp.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    };
    lagre.after(knapp);
  }

  document.addEventListener("DOMContentLoaded", sikrePdfKnappTilLager);
  window.addEventListener("load", function () {
    sikrePdfKnappTilLager();
    setTimeout(sikrePdfKnappTilLager, 500);
    setTimeout(sikrePdfKnappTilLager, 1500);
  });

  window.lagPdfFyllBilTilLager = lagPdfFyllBilTilLager;
  window.registrerLagermangler = registrerLagermangler;
  window.sikrePdfKnappTilLager = sikrePdfKnappTilLager;
})();

/* RIL FIX 20260613: PDF sendt til lager, liste blir stående til ansatt bekrefter med Lagre på bil */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function tekst(v) { return String(v ?? "").trim(); }
  function tall(v) {
    const n = Number(String(v ?? "0").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  function safeCss(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value));
    return String(value).replace(/'/g, "\\'").replace(/"/g, "\\\"");
  }
  function bilId() {
    try {
      if (typeof window.hentValgtBilIdForBilLager === "function") return window.hentValgtBilIdForBilLager() || "";
    } catch (e) {}
    return $("bilLagerBilValg")?.value || localStorage.getItem("aktivBilId") || "";
  }
  function pendingKey() {
    return "ril_fyll_bil_pending_" + (bilId() || "ingen_bil");
  }
  function finnVare(vareId) {
    const liste = Array.isArray(window.varerTilBilLager) ? window.varerTilBilLager : [];
    return liste.find(v => String(v.id) === String(vareId)) || null;
  }
  function vareNavnTrygt(v) {
    try { if (typeof window.vareNavn === "function") return window.vareNavn(v); } catch (e) {}
    return v?.navn || v?.varenavn || v?.beskrivelse || "Vare";
  }
  function vareNrTrygt(v) {
    try { if (typeof window.vareNr === "function") return window.vareNr(v); } catch (e) {}
    return v?.varenr || "";
  }
  function hovedlagerTrygt(v) {
    try { if (typeof window.vareHovedlager === "function") return window.vareHovedlager(v); } catch (e) {}
    return tall(v?.lager_antall ?? v?.antall ?? v?.beholdning ?? 0);
  }

  function hentValgteRader() {
    const rader = [];
    document.querySelectorAll(".bil-lager-antall-liste").forEach(input => {
      const vareId = input.dataset.vareId || "";
      const antall = tall(input.value);
      if (!vareId || antall <= 0) return;
      const minInput = document.querySelector(".bil-lager-min-liste[data-vare-id='" + safeCss(vareId) + "']");
      const vare = finnVare(vareId);
      const hovedlager = hovedlagerTrygt(vare);
      rader.push({
        vareId,
        varenr: vareNrTrygt(vare),
        varenavn: vareNavnTrygt(vare),
        antall,
        minimum: tall(minInput?.value),
        hovedlager,
        mangler: Math.max(0, antall - hovedlager)
      });
    });
    return rader;
  }

  function lagrePendingListe(rader) {
    const payload = {
      id: Date.now(),
      status: "sendt_til_lager",
      opprettet: new Date().toISOString(),
      bil_id: bilId() || null,
      bil_navn: $("bilLagerBilValg")?.selectedOptions?.[0]?.textContent || localStorage.getItem("aktivBilNavn") || "",
      ansatt: window.innloggetEpost || "",
      rader
    };
    localStorage.setItem(pendingKey(), JSON.stringify(payload));
    localStorage.setItem("ril_fyll_bil_siste_pending", JSON.stringify(payload));
    visPendingMelding(payload);
  }

  function hentPendingListe() {
    try { return JSON.parse(localStorage.getItem(pendingKey()) || "null"); }
    catch (e) { return null; }
  }

  function visPendingMelding(payload) {
    const melding = $("bilMelding");
    if (!melding || !payload || !Array.isArray(payload.rader) || !payload.rader.length) return;
    const mangler = payload.rader.reduce((sum, r) => sum + tall(r.mangler), 0);
    melding.textContent = mangler > 0
      ? "Bestilling er sendt. Listen blir stående til varene er hentet. Mangler er registrert: " + mangler + " stk. Når varene kommer, trykk Bekreft mottatt og legg på bil. Lagerlogg oppdateres først da."
      : "Bestilling er sendt. Listen blir stående til varene er hentet. Når varene kommer, trykk Bekreft mottatt og legg på bil. Lagerlogg oppdateres først da.";
    melding.style.color = "#86efac";
  }

  function gjenopprettPendingTilFelter() {
    const payload = hentPendingListe();
    if (!payload || !Array.isArray(payload.rader) || !payload.rader.length) return;
    payload.rader.forEach(r => {
      const input = document.querySelector(".bil-lager-antall-liste[data-vare-id='" + safeCss(r.vareId) + "']");
      const minInput = document.querySelector(".bil-lager-min-liste[data-vare-id='" + safeCss(r.vareId) + "']");
      if (input && !input.value) input.value = String(r.antall || "");
      if (minInput && !minInput.value && r.minimum) minInput.value = String(r.minimum || "");
    });
    visPendingMelding(payload);
  }

  async function registrerManglerLokaltOgDb(rader) {
    const mangler = (rader || []).filter(r => tall(r.mangler) > 0);
    if (!mangler.length) return;
    const tidspunkt = new Date().toISOString();
    const bil_navn = $("bilLagerBilValg")?.selectedOptions?.[0]?.textContent || localStorage.getItem("aktivBilNavn") || "";
    const lokale = JSON.parse(localStorage.getItem("ril_lager_mangler") || "[]");
    const nye = mangler.map(r => ({
      tidspunkt,
      bil_id: bilId() || null,
      bil_navn: bil_navn || null,
      vare_id: r.vareId,
      varenr: r.varenr || null,
      varenavn: r.varenavn,
      antall_onsket: r.antall,
      hovedlager: r.hovedlager,
      mangler: r.mangler,
      opprettet_av: window.innloggetEpost || null,
      status: "mangler"
    }));
    lokale.push(...nye);
    localStorage.setItem("ril_lager_mangler", JSON.stringify(lokale.slice(-500)));
    if (window.supabaseClient) {
      try { await supabaseClient.from("lager_mangler").insert(nye); }
      catch (e) { console.warn("Kunne ikke skrive lager_mangler. Lagret lokalt.", e); }
    }
  }

  function lagPdfSomBestilling(rader) {
    const bilTekst = $("bilLagerBilValg")?.selectedOptions?.[0]?.textContent || localStorage.getItem("aktivBilNavn") || "Valgt bil";
    const datoTekst = new Date().toLocaleString("no-NO");
    const hentetAv = window.innloggetEpost || "Innlogget bruker";
    const mangler = rader.filter(r => tall(r.mangler) > 0);

    if (!window.jspdf || !window.jspdf.jsPDF) {
      const html = '<html><head><title>Fyll bil - lagerliste</title></head><body>' +
        '<h2>Fyll bil - lagerliste</h2>' +
        '<p><strong>Bil:</strong> ' + bilTekst + '</p>' +
        '<p><strong>Dato:</strong> ' + datoTekst + '</p>' +
        '<p><strong>Hentet av:</strong> ' + hentetAv + '</p>' +
        '<p><strong>Status:</strong> Sendt til lager. Ikke lagt på bil ennå.</p>' +
        '<table border="1" cellpadding="5" cellspacing="0"><thead><tr><th>Varenr</th><th>Vare</th><th>Antall</th><th>På lager</th><th>Mangler</th></tr></thead><tbody>' +
        rader.map(r => '<tr><td>' + (r.varenr || '') + '</td><td>' + r.varenavn + '</td><td>' + r.antall + '</td><td>' + r.hovedlager + '</td><td>' + (r.mangler || '') + '</td></tr>').join('') +
        '</tbody></table>' +
        (mangler.length ? '<h3>Mangler må bestilles/registreres</h3>' : '') +
        '</body></html>';
      /* PDF/print deaktivert: bestilling sendes digitalt. */ return false;
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = 14;
    const venstre = 12;
    function nySide(h) { if (y + h > 285) { doc.addPage(); y = 14; } }
    function esc(v) { return tekst(v).replace(/[\r\n]+/g, " "); }

    doc.setFontSize(16);
    doc.text("Fyll bil - lagerliste", venstre, y); y += 8;
    doc.setFontSize(10);
    doc.text("Bil: " + esc(bilTekst), venstre, y); y += 5;
    doc.text("Dato: " + esc(datoTekst), venstre, y); y += 5;
    doc.text("Hentet av: " + esc(hentetAv), venstre, y); y += 5;
    doc.text("Status: Sendt til lager. Ikke lagt på bil ennå.", venstre, y); y += 8;

    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.text("Varenr", venstre, y);
    doc.text("Vare", 35, y);
    doc.text("Antall", 128, y);
    doc.text("På lager", 150, y);
    doc.text("Mangler", 174, y);
    doc.setFont(undefined, "normal");
    y += 4;
    doc.line(venstre, y, 198, y); y += 4;

    rader.forEach(r => {
      nySide(8);
      const navnLinjer = doc.splitTextToSize(esc(r.varenavn), 88);
      doc.text(esc(r.varenr || ""), venstre, y);
      doc.text(navnLinjer, 35, y);
      doc.text(String(r.antall), 132, y, { align: "right" });
      doc.text(String(r.hovedlager), 164, y, { align: "right" });
      doc.text(r.mangler > 0 ? String(r.mangler) : "", 188, y, { align: "right" });
      y += Math.max(6, navnLinjer.length * 4);
    });

    if (mangler.length) {
      y += 6;
      nySide(20);
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.text("Mangler som må bestilles/registreres", venstre, y); y += 6;
      doc.setFontSize(9);
      doc.setFont(undefined, "normal");
      mangler.forEach(r => {
        nySide(7);
        doc.text(`${esc(r.varenr || "")} ${esc(r.varenavn)} - mangler ${r.mangler}`, venstre, y);
        y += 5;
      });
    }
    /* PDF deaktivert: bestilling sendes digitalt. */ return false;
  }

  async function sendPdfTilLagerOgBeholdListe(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation(); }
    const rader = hentValgteRader();
    if (!rader.length) {
      alert("Skriv antall på minst én vare før du lager Bestilling til admin.");
      return;
    }
    lagrePendingListe(rader);
    /* PDF deaktivert: bestilling sendes digitalt. */
    await registrerManglerLokaltOgDb(rader);
    visPendingMelding(hentPendingListe());
  }

  function bindPdfKnappHardt() {
    const knapp = $("lagPdfFyllBilTilLagerKnapp");
    if (!knapp) return;
    knapp.textContent = "Send bestilling til admin";
    knapp.onclick = sendPdfTilLagerOgBeholdListe;
  }

  document.addEventListener("click", function (event) {
    if (event.target && event.target.id === "lagPdfFyllBilTilLagerKnapp") {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      return false;
    }
  }, true);

  const originalTegn = window.tegnFyllBilListe;
  if (typeof originalTegn === "function" && !originalTegn.rilPendingWrapped) {
    const wrapped = function () {
      const res = originalTegn.apply(this, arguments);
      setTimeout(gjenopprettPendingTilFelter, 50);
      setTimeout(bindPdfKnappHardt, 60);
      return res;
    };
    wrapped.rilPendingWrapped = true;
    window.tegnFyllBilListe = wrapped;
  }

  const originalLagre = window.lagreBilLagerListe;
  if (typeof originalLagre === "function" && !originalLagre.rilPendingWrapped) {
    const wrappedLagre = async function () {
      const res = await originalLagre.apply(this, arguments);
      const melding = $("bilMelding")?.textContent || "";
      if (/^La \d+ varer på bilen/.test(melding)) {
        localStorage.removeItem(pendingKey());
      }
      return res;
    };
    wrappedLagre.rilPendingWrapped = true;
    window.lagreBilLagerListe = wrappedLagre;
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(gjenopprettPendingTilFelter, 300);
    setTimeout(bindPdfKnappHardt, 400);
  });
  window.addEventListener("load", function () {
    setTimeout(gjenopprettPendingTilFelter, 700);
    setTimeout(bindPdfKnappHardt, 800);
    setTimeout(gjenopprettPendingTilFelter, 1600);
    setTimeout(bindPdfKnappHardt, 1700);
  });
})();


/* RIL FIX 20260613: Lagerlogg skrives kun når ansatt trykker Bekreft mottatt og legg på bil.
   Bestilling er bare en bestilling og skal ikke oppdatere lagerlogg eller bil-lager. */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }

  function bindPdfUtenLagerlogg() {
    const knapp = $("lagPdfFyllBilTilLagerKnapp");
    if (!knapp || knapp.dataset.rilPdfUtenLagerlogg === "1") return;
    knapp.dataset.rilPdfUtenLagerlogg = "1";
    knapp.textContent = "Send bestilling til admin";
    knapp.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      if (typeof window.lagPdfFyllBilTilLager === "function") {
        // Bruk PDF-funksjonen kun som utskrift/bestilling. Den legger ikke varer på bil.
        // Lagerlogg skrives av lagreBilLagerListe når ansatt bekrefter mottak.
        const foerLogg = window.skrivLagerlogg;
        try {
          window.skrivLagerlogg = async function () {
            console.warn("Bestilling til admin forsøkte å skrive lagerlogg. Blokkert. Lagerlogg skrives først ved Bekreft mottatt og legg på bil.");
          };
          return false;
        } finally {
          window.skrivLagerlogg = foerLogg;
        }
      }
      const melding = $("bilMelding");
      if (melding) {
        melding.textContent = "Bestilling er sendt. Lagerlogg oppdateres ikke før ansatt trykker Bekreft mottatt og legg på bil.";
        melding.style.color = "#86efac";
      }
    }, true);
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(bindPdfUtenLagerlogg, 300);
    setTimeout(bindPdfUtenLagerlogg, 1200);
  });
  window.addEventListener("load", function () {
    setTimeout(bindPdfUtenLagerlogg, 500);
    setTimeout(bindPdfUtenLagerlogg, 1800);
  });
})();


/* RIL FIX 20260613: Vis lagerlogg igjen, men skriv den kun ved Bekreft mottatt og legg på bil. */
(function () {
  "use strict";

  function el(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function valgtBilId() {
    try {
      if (typeof window.hentValgtBilIdForBilLager === "function") return window.hentValgtBilIdForBilLager() || "";
    } catch (_) {}
    return el("bilLagerBilValg")?.value || el("bilValg")?.value || localStorage.getItem("aktivBilId") || window.aktivBilId || "";
  }
  function valgtBilTekst() {
    const select = el("bilLagerBilValg");
    if (select && select.value) return select.selectedOptions?.[0]?.textContent || "valgt bil";
    return localStorage.getItem("aktivBilNavn") || window.aktivBilNavn || "valgt bil";
  }
  function finnVareNavnFraRad(rad) {
    const v = rad?.varer || {};
    const varenr = v.varenr || rad.varenr || "";
    const navn = v.navn || v.varenavn || rad.vare_navn || rad.navn || "Vare";
    return (varenr ? varenr + " - " : "") + navn;
  }
  function loggNavn(rad) {
    return rad.hentet_av || rad.bruker_navn || rad.bruker_epost || rad.opprettet_av_navn || rad.opprettet_av || "";
  }
  function datoNo(v) {
    if (!v) return "";
    try { return new Date(v).toLocaleString("no-NO"); } catch (_) { return String(v); }
  }

  function sikreLagerloggBoks() {
    const bilLagerListe = el("bilLagerListe");
    if (!bilLagerListe) return null;

    let boks = el("bilLagerLoggListe");
    if (boks) return boks;

    const wrap = document.createElement("div");
    wrap.id = "bilLagerLoggWrap";
    wrap.style.marginTop = "18px";
    wrap.innerHTML = `
      <h4>Lagerlogg</h4>
      <p class="info">Loggen viser først mottatte varer etter at brukeren har trykket <strong>Bekreft mottatt og legg på bil</strong>.</p>
      <div id="bilLagerLoggListe"><p class="info">Laster lagerlogg...</p></div>
    `;
    bilLagerListe.after(wrap);
    return el("bilLagerLoggListe");
  }

  async function tegnLagerloggForBil() {
    const boks = sikreLagerloggBoks();
    if (!boks) return;
    if (!window.supabaseClient) {
      boks.innerHTML = '<p class="info">Supabase er ikke lastet.</p>';
      return;
    }

    const bilId = valgtBilId();
    if (!bilId) {
      boks.innerHTML = '<p class="info">Velg bil for å se lagerlogg.</p>';
      return;
    }

    boks.innerHTML = '<p class="info">Laster lagerlogg...</p>';

    let res;
    try {
      res = await supabaseClient
        .from("hand_lagerlogg")
        .select("id,bil_id,vare_id,antall,handling,kommentar,hentet_av,bruker_navn,bruker_epost,opprettet_av,opprettet_av_navn,opprettet")
        .eq("bil_id", bilId)
        .limit(100);
    } catch (e) {
      boks.innerHTML = '<p class="info">Lagerlogg kunne ikke hentes, men varelisten og billisten fungerer.</p>';
      return;
    }

    if (res.error) {
      boks.innerHTML = '<p class="info">Lagerlogg kunne ikke hentes, men varelisten og billisten fungerer.</p>';
      return;
    }

    const data = res.data || [];
    if (!data.length) {
      boks.innerHTML = '<p class="info">Ingen lagerlogg for ' + esc(valgtBilTekst()) + ' ennå.</p>';
      return;
    }

    boks.innerHTML = `
      <div class="info" style="margin:8px 0 6px 0; font-weight:bold;">Lagerlogg for ${esc(valgtBilTekst())}</div>
      <table class="bil-tabell">
        <thead>
          <tr>
            <th>Dato</th>
            <th>Vare</th>
            <th>Antall</th>
            <th>Handling</th>
            <th>Bruker</th>
            <th>Kommentar</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(rad => `
            <tr>
              <td>${esc(datoNo(rad.opprettet))}</td>
              <td>${esc(finnVareNavnFraRad(rad))}</td>
              <td>${esc(rad.antall ?? "")}</td>
              <td>${esc(rad.handling || "")}</td>
              <td>${esc(loggNavn(rad))}</td>
              <td>${esc(rad.kommentar || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  window.tegnLagerloggForBil = tegnLagerloggForBil;

  document.addEventListener("change", function (event) {
    if (event.target && event.target.id === "bilLagerBilValg") {
      setTimeout(tegnLagerloggForBil, 50);
    }
  }, true);

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(tegnLagerloggForBil, 800);
  });
  window.addEventListener("load", function () {
    setTimeout(tegnLagerloggForBil, 800);
    setTimeout(tegnLagerloggForBil, 2000);
  });
})();

/* RIL FIX 20260613: faste handlingsknapper for Fyll bil
   Flytter Lagre-knapp og PDF-knapp til en sticky toppbar, slik at de alltid er lett tilgjengelige på mobil.
   Endrer ikke lagringslogikk. PDF er fortsatt bare bestilling, lagerlogg oppdateres først ved lagring. */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function finnBilerSide() {
    return $("bilerSide") || document.body;
  }

  function sikreCss() {
    if ($("rilFyllBilStickyCss")) return;
    const style = document.createElement("style");
    style.id = "rilFyllBilStickyCss";
    style.textContent = `
      #rilFyllBilStickyActions {
        position: sticky;
        top: 0;
        z-index: 9000;
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-start;
        flex-wrap: wrap;
        padding: 10px;
        margin: 10px 0;
        background: #111827;
        border: 1px solid #374151;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      }
      #rilFyllBilStickyActions .ril-sticky-title {
        width: 100%;
        color: #cbd5e1;
        font-size: 13px;
        font-weight: bold;
        margin-bottom: 2px;
      }
      #rilFyllBilStickyActions button {
        margin: 0 !important;
        flex: 1 1 180px;
        min-height: 42px;
        font-weight: bold;
      }
      #rilFyllBilStickyActions #lagreBilLagerListeKnapp {
        background: #16a34a !important;
      }
      #rilFyllBilStickyActions #sendBilLagerBestillingKnapp {
        background: #1f6feb !important;
      }
      #rilFyllBilStickyActions #lagPdfFyllBilTilLagerKnapp {
        background: #1f6feb !important;
      }
      @media (min-width: 900px) {
        #rilFyllBilStickyActions {
          top: 8px;
          justify-content: flex-end;
        }
        #rilFyllBilStickyActions .ril-sticky-title {
          width: auto;
          margin-right: auto;
          margin-bottom: 0;
        }
        #rilFyllBilStickyActions button {
          flex: 0 0 auto;
        }
      }
      @media (max-width: 700px) {
        #rilFyllBilStickyActions {
          top: 0;
          border-radius: 0 0 12px 12px;
          margin-left: -8px;
          margin-right: -8px;
        }
        #rilFyllBilStickyActions button {
          width: 100%;
          flex-basis: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function sikrePdfKnappHvisMangler() {
    let pdf = $("lagPdfFyllBilTilLagerKnapp");
    if (pdf) return pdf;

    const lagre = $("lagreBilLagerListeKnapp");
    if (!lagre || !lagre.parentNode) return null;

    pdf = document.createElement("button");
    pdf.id = "lagPdfFyllBilTilLagerKnapp";
    pdf.type = "button";
    pdf.className = "secondary";
    pdf.textContent = "Send bestilling til admin";
    pdf.onclick = function (event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (typeof window.lagPdfFyllBilTilLager === "function") {
        return false;
      }
      alert("PDF-funksjonen er ikke klar ennå. Prøv Oppdater/Hent fylleliste først.");
    };
    lagre.after(pdf);
    return pdf;
  }

  function flyttKnapperTilStickyBar() {
    const side = finnBilerSide();
    const liste = $("bilLagerFyllListe");
    const lagre = $("lagreBilLagerListeKnapp");
    const pdf = sikrePdfKnappHvisMangler();

    if (!side || !liste || !lagre) return;
    sikreCss();

    let bar = $("rilFyllBilStickyActions");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "rilFyllBilStickyActions";
      bar.innerHTML = '<div class="ril-sticky-title">Fyll bil</div>';
      liste.parentNode.insertBefore(bar, liste);
    }

    const title = bar.querySelector(".ril-sticky-title") || document.createElement("div");
    if (!title.parentNode) {
      title.className = "ril-sticky-title";
      title.textContent = "Fyll bil";
      bar.appendChild(title);
    }

    if (pdf && pdf.parentNode !== bar) bar.appendChild(pdf);
    if (lagre.parentNode !== bar) bar.appendChild(lagre);

    if (pdf) pdf.textContent = "Send bestilling til admin";
    lagre.textContent = "Bekreft mottatt og legg på bil";
  }

  window.rilFlyttFyllBilKnapperTilTopp = flyttKnapperTilStickyBar;

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(flyttKnapperTilStickyBar, 200);
    setTimeout(flyttKnapperTilStickyBar, 1000);
  });

  window.addEventListener("load", function () {
    setTimeout(flyttKnapperTilStickyBar, 200);
    setTimeout(flyttKnapperTilStickyBar, 1000);
    setTimeout(flyttKnapperTilStickyBar, 2500);
  });

  document.addEventListener("click", function (event) {
    if (event.target && (event.target.id === "visBilerKnapp" || event.target.id === "nyBilKnapp")) {
      setTimeout(flyttKnapperTilStickyBar, 300);
      setTimeout(flyttKnapperTilStickyBar, 1000);
    }
  }, true);

  document.addEventListener("change", function (event) {
    if (event.target && event.target.id === "bilLagerBilValg") {
      setTimeout(flyttKnapperTilStickyBar, 100);
    }
  }, true);
})();

/* RIL 20260623: Fyll-bil skal aldri lage/åpne PDF. Bestilling sendes digitalt. */
(function(){
  window.lagPdfFyllBilTilLager = function(){ return false; };
  window.handLagPdfFyllBilTilLager = function(){ return false; };
  document.addEventListener('click', function(e){
    var el = e.target && e.target.closest && e.target.closest('#lagPdfFyllBilTilLagerKnapp');
    if (el) { e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation)e.stopImmediatePropagation(); return false; }
  }, true);
})();


/* RIL 20260705: Fjernet gammel ENDELIG BILLISTE FIX som overstyrte tegnBilLager og ga blinking/manglende lagerlogg. */


