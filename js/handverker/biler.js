console.log("biler.js bilskjema synlig fix lastet 7063");

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

function vareHovedlager(v) {
  return Number(v?.lager_antall ?? v?.antall ?? v?.beholdning ?? 0);
}

function vareMinimum(v) {
  return Number(v?.minimum_antall ?? v?.min_antall ?? 0);
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


function hentAnsattForBil(bilId) {
  try {
    const liste = Array.isArray(window.ansatte) ? window.ansatte : [];
    const treff = liste
      .filter(a => String(a.standard_bil_id || "") === String(bilId || ""))
      .map(a => a.navn || a.epost || "Uten navn");

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

async function visBilerSide() {
  skjulAlleSiderForBiler();

  const side = bilEl("bilerSide");
  if (!side) {
    alert("Fant ikke bilerSide i index.html");
    return;
  }

  side.classList.remove("skjult", "hidden", "modul-skjult");
  side.style.display = "";
  visBilSkjema();

  await lastBilerOgBilLager();
}

function tilbakeFraBiler() {
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

  const { data, error } = await supabaseClient
    .from("biler")
    .select("*")
    .order("navn", { ascending: true });

  if (error) {
    bilMelding("Kunne ikke hente biler: " + error.message, true);
    biler = [];
    fyllAlleBilvalg();
    return [];
  }

  biler = data || [];
  window.biler = biler;

  fyllAlleBilvalg();
  tegnBiler();

  return biler;
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

    const rad = {
      navn: navn || regnr,
      regnr: regnr || null,
      aktiv: true
    };

    let res = id
      ? await supabaseClient.from("biler").update(rad).eq("id", id).select().single()
      : await supabaseClient.from("biler").insert([rad]).select().single();

    if (res.error && String(res.error.message || "").toLowerCase().includes("aktiv")) {
      const rad2 = {
        navn: navn || regnr,
        regnr: regnr || null
      };

      res = id
        ? await supabaseClient.from("biler").update(rad2).eq("id", id).select().single()
        : await supabaseClient.from("biler").insert([rad2]).select().single();
    }

    if (res.error) {
      bilMelding("Kunne ikke lagre bil: " + res.error.message, true);
      alert("Kunne ikke lagre bil: " + res.error.message);
      return;
    }

    if (res.data?.id) {
      localStorage.setItem("aktivBilId", String(res.data.id));
      localStorage.setItem("aktivBilNavn", bilNavn(res.data));
      window.aktivBilId = String(res.data.id);
    }

    nyBilSkjema();

    bilMelding(id ? "Bil oppdatert." : "Ny bil lagret.");
    await lastBilerOgBilLager();
    await fyllVarevalgFraAktivBil();
  } catch (e) {
    const msg = "Feil ved lagring av bil: " + (e.message || String(e));
    bilMelding(msg, true);
    alert(msg);
  }
}

async function slettBil(id) {
  if (!id) return;
  if (!confirm("Vil du slette bilen?")) return;

  const { error } = await supabaseClient
    .from("biler")
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

  // Hold oss p\u00E5 Biler-siden. Ingen navigation.js, ingen kundevisning.
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
    e.innerHTML = "<p>Ingen biler registrert.</p>";
    return;
  }

  e.innerHTML = `
    <table class="bil-tabell">
      <thead>
        <tr><th>Bil</th><th>Regnr</th><th>Ansatt / bruker</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        ${biler.map(bil => `
          <tr class="klikkbar-bilrad" onclick="window.apneBilForFylling('${bil.id}')">
            <td>${bil.navn || bil.name || bil.bilnavn || ""}</td>
            <td>${bil.regnr || bil.registreringsnummer || ""}</td>
            <td>${hentAnsattForBil(bil.id)}</td>
            <td>${bil.aktiv === false ? "Inaktiv" : "Aktiv"}</td>
            <td>
              <button type="button" class="secondary" onclick="event.stopPropagation(); redigerBil('${bil.id}')">Endre</button>
              <button type="button" class="secondary" onclick="event.stopPropagation(); slettBil('${bil.id}')">Slett</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
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
    .from("varer")
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

  const bilId = hentValgtBilIdForBilLager();
  const biltekst = valgtBilOverskrift();

  if (!varerTilBilLager.length) {
    c.innerHTML = "<p>Ingen varer i vareregisteret enn\u00E5.</p>";
    return;
  }

  c.innerHTML = `
    <div class="info" style="margin:8px 0 6px 0; font-weight:bold;">
      Fyller bil: ${biltekst}
    </div>
    ${!bilId ? '<p class="melding">Velg bil f\u00F8rst. Listen er klar, men lagring krever valgt bil.</p>' : ''}
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
              <td style="width:78px;">
                <input class="bil-lager-antall-liste" data-vare-id="${v.id}" type="number" step="1" min="0" value="" placeholder="0" style="width:70px; max-width:70px; height:24px; padding:2px 4px; margin:0;">
              </td>
              <td style="width:78px;">
                <input class="bil-lager-min-liste" data-vare-id="${v.id}" type="number" step="1" min="0" value="" placeholder="0" style="width:70px; max-width:70px; height:24px; padding:2px 4px; margin:0;">
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
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
    let { error } = await supabaseClient.from("lagerlogg").insert([rad]);

    // Hvis hentet_av-kolonnen ikke er lagt inn enn\u00E5, skriver vi resten av loggen
    // slik at lagerflytting ikke stopper. Kj\u00F8r SQL-filen i zippen for \u00E5 lagre hentet_av.
    if (error && String(error.message || "").toLowerCase().includes("hentet_av")) {
      const radUtenHentetAv = { ...rad };
      delete radUtenHentetAv.hentet_av;
      const fallback = await supabaseClient.from("lagerlogg").insert([radUtenHentetAv]);
      error = fallback.error;
    }

    if (error) {
      console.warn("Lagerlogg ble ikke skrevet. Kj\u00F8r lagerlogg.sql hvis tabellen mangler:", error.message);
    }
  } catch (e) {
    console.warn("Lagerlogg feilet:", e);
  }
}

async function lagreBilLagerListe() {
  const bilId = hentValgtBilIdForBilLager();

  if (!bilId) {
    bilMelding("Velg bil f\u00F8rst.", true);
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
    bilMelding("Skriv antall p\u00E5 minst \u00E9n vare i listen.", true);
    return;
  }

  bilMelding("Sjekker hovedlager...");

  const vareIds = rader.map(r => r.vareId);
  const { data: varerFraDb, error: vareError } = await supabaseClient
    .from("varer")
    .select("*")
    .in("id", vareIds);

  if (vareError) {
    bilMelding("Kunne ikke hente hovedlager: " + vareError.message, true);
    return;
  }

  const varerMap = new Map((varerFraDb || []).map(v => [String(v.id), v]));

  for (const r of rader) {
    const vare = varerMap.get(String(r.vareId));
    const beholdning = vareHovedlager(vare);
    if (!vare) {
      bilMelding("Fant ikke en av varene i hovedlager.", true);
      return;
    }
    if (beholdning < r.antall) {
      bilMelding(`Ikke nok p\u00E5 hovedlager for ${vareNavn(vare)}. P\u00E5 lager: ${beholdning}, fors\u00F8ker: ${r.antall}.`, true);
      return;
    }
  }

  bilMelding("Fyller bil og trekker fra hovedlager...");

  const bruker = await hentInnloggetBrukerTilLogg();
  const hentetAv = bilVerdi("bilLagerHentetAv") || bruker.bruker_navn || bruker.bruker_epost || "";
  const bil = hentBilFraId(bilId);
  let lagret = 0;

  for (const r of rader) {
    const vare = varerMap.get(String(r.vareId));
    const hovedlagerFor = vareHovedlager(vare);
    const hovedlagerEtter = hovedlagerFor - r.antall;

    const { data: eksisterende, error: sjekkError } = await supabaseClient
      .from("bil_lager")
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
      const nyAntall = Number(eksisterende[0].antall || 0) + r.antall;
      const nyMinimum = r.minimum || Number(eksisterende[0].minimum_antall || 0);
      res = await supabaseClient
        .from("bil_lager")
        .update({ antall: nyAntall, minimum_antall: nyMinimum })
        .eq("id", eksisterende[0].id);
    } else {
      res = await supabaseClient
        .from("bil_lager")
        .insert([{ bil_id: bilId, vare_id: r.vareId, antall: r.antall, minimum_antall: r.minimum || 0 }]);
    }

    if (res.error) {
      bilMelding("Kunne ikke lagre vare p\u00E5 bil: " + res.error.message, true);
      return;
    }

    const oppdater = await supabaseClient
      .from("varer")
      .update({ lager_antall: hovedlagerEtter })
      .eq("id", r.vareId);

    if (oppdater.error) {
      bilMelding("Varen ble lagt p\u00E5 bil, men hovedlager kunne ikke trekkes: " + oppdater.error.message, true);
      return;
    }

    await skrivLagerlogg({
      type: "flytting",
      handling: "hovedlager_til_bil",
      bil_id: bilId,
      bil_navn: bilNavn(bil),
      vare_id: r.vareId,
      varenr: vareNr(vare) || null,
      varenavn: vareNavn(vare),
      antall: r.antall,
      hovedlager_for: hovedlagerFor,
      hovedlager_etter: hovedlagerEtter,
      hentet_av: hentetAv || null,
      ...bruker
    });

    lagret++;
  }

  document.querySelectorAll(".bil-lager-antall-liste, .bil-lager-min-liste").forEach(input => input.value = "");
  bilMelding(`La ${lagret} varer p\u00E5 bilen og trakk fra hovedlager${hentetAv ? " \u2013 hentet av " + hentetAv : ""}.`);

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
    .from("bil_lager")
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
    res = await supabaseClient.from("bil_lager").update(rad).eq("id", eksisterende[0].id);
  } else {
    res = await supabaseClient.from("bil_lager").insert([rad]);
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
    .from("bil_lager")
    .select("id, bil_id, vare_id, antall, minimum_antall, created_at, biler(*), varer(*)")
    .order("created_at", { ascending: false });

  if (error) {
    bilLager = [];
    if (liste) liste.innerHTML = "Kunne ikke hente bil-lager: " + error.message;
    console.warn("Kunne ikke hente bil-lager:", error);
    return [];
  }

  bilLager = data || [];
  window.bilLager = bilLager;

  // Hent siste lagerlogg per bil/vare, s\u00E5 vi kan vise hvem som faktisk hentet varene.
  bilLagerHentetMap = new Map();
  try {
    const { data: loggData, error: loggError } = await supabaseClient
      .from("lagerlogg")
      .select("bil_id, vare_id, hentet_av, bruker_navn, bruker_epost, created_at")
      .eq("handling", "hovedlager_til_bil")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (!loggError && Array.isArray(loggData)) {
      loggData.forEach(rad => {
        const key = `${rad.bil_id || ""}|${rad.vare_id || ""}`;
        if (!bilLagerHentetMap.has(key)) {
          bilLagerHentetMap.set(key, {
            navn: rad.hentet_av || rad.bruker_navn || rad.bruker_epost || "",
            dato: rad.created_at || ""
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
    .from("bil_lager")
    .select("id, bil_id, vare_id, antall, varer(*)")
    .eq("bil_id", bilId)
    .gt("antall", 0)
    .order("created_at", { ascending: false });

  if (error) {
    select.innerHTML = '<option value="">Feil ved henting av bil-lager</option>';
    console.error("Feil ved henting av varer fra bil_lager:", error);
    return;
  }

  select.innerHTML = '<option value="">Velg vare fra valgt bil</option>';

  (data || []).forEach(rad => {
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

async function lastBilerOgBilLager() {
  await lastBiler();
  await fyllBilLagerVareValg();
  await lastBilLager();
  await fyllVarevalgFraAktivBil();
}

function kobleBilKnapper() {
  const nyBilKnapp = bilEl("nyBilKnapp");
  if (nyBilKnapp) nyBilKnapp.onclick = nyBilSkjema;

  const lagreBilKnapp = bilEl("lagreBilKnapp");
  if (lagreBilKnapp) lagreBilKnapp.onclick = lagreBil;

  const lagreBilLagerKnapp = bilEl("lagreBilLagerKnapp");
  if (lagreBilLagerKnapp) lagreBilLagerKnapp.onclick = lagreBilLager;

  const lagreBilLagerListeKnapp = bilEl("lagreBilLagerListeKnapp");
  if (lagreBilLagerListeKnapp) lagreBilLagerListeKnapp.onclick = lagreBilLagerListe;

  const byttBilKnapp = bilEl("byttBilKnapp");
  if (byttBilKnapp) byttBilKnapp.onclick = byttBil;

  const bilLagerBilValg = bilEl("bilLagerBilValg");
  if (bilLagerBilValg && !bilLagerBilValg.dataset.bilerListeKoblet) {
    bilLagerBilValg.dataset.bilerListeKoblet = "1";
    bilLagerBilValg.addEventListener("change", function () {
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
window.tegnFyllBilListe = tegnFyllBilListe;
window.fyllVarevalgFraAktivBil = fyllVarevalgFraAktivBil;
window.oppdaterAktivBilVisning = oppdaterAktivBilVisning;
window.lastBilerOgBilLager = lastBilerOgBilLager;

window.hentAnsattForBil = hentAnsattForBil;

window.nyBilSkjema = nyBilSkjema;
window.visBilSkjema = visBilSkjema;
window.redigerBil = redigerBil;