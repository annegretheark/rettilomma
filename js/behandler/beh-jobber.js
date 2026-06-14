console.log("beh-behandlinger.js lastet - klikkbar behandlingliste med bilder");

let behBehandlingerSiste = [];
let behBehandlingValgt = null;

function behandlingMelding(tekst, feil = false) {
  const el = document.getElementById("behandlingMelding");
  if (el) {
    el.textContent = tekst || "";
    el.style.color = feil ? "#b42318" : "#116329";
  }
}

function tall(v) {
  const n = Number(String(v || 0).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function behEsc(v) {
  return String(v ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[c]));
}

function behDatoNo(v) {
  if (!v) return "";
  const s = String(v).slice(0, 10);
  const d = s.split("-");
  return d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : String(v);
}

function hentValgtBehBildeFil() {
  const kamera = document.getElementById("behandlingBildeKamera");
  const galleri = document.getElementById("behandlingBildeGalleri");
  const filInput = kamera?.files?.length ? kamera : galleri;
  return filInput?.files?.[0] || null;
}

function tomBehBildeFelter() {
  const kamera = document.getElementById("behandlingBildeKamera");
  const galleri = document.getElementById("behandlingBildeGalleri");
  if (kamera) kamera.value = "";
  if (galleri) galleri.value = "";
}

function rentFilnavn(navn) {
  return String(navn || "bilde.jpg")
    .replaceAll(" ", "_")
    .replace(/[æøåÆØÅ]/g, b => ({ æ: "ae", ø: "o", å: "a", Æ: "Ae", Ø: "O", Å: "A" }[b] || b))
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function lagBildeUrlFraSti(filsti) {
  if (!filsti || !window.supabaseClient) return "";

  try {
    const { data, error } = await supabaseClient
      .storage
      .from("bilder")
      .createSignedUrl(filsti, 60 * 60 * 24 * 7);

    if (!error && data?.signedUrl) return data.signedUrl;
  } catch (e) {
    console.warn("Kunne ikke lage signert bilde-url:", e);
  }

  try {
    const { data } = supabaseClient.storage.from("bilder").getPublicUrl(filsti);
    return data?.publicUrl || "";
  } catch (e) {
    return "";
  }
}

async function lastOppBehBehandlingBilde(behandlingId, fil, bildetekst = "") {
  if (!behandlingId) throw new Error("Mangler behandling-id.");
  if (!fil) throw new Error("Velg et bilde først.");

  const filsti = `beh-behandlinger/${behandlingId}/${Date.now()}_${rentFilnavn(fil.name)}`;

  const { error: uploadError } = await supabaseClient
    .storage
    .from("bilder")
    .upload(filsti, fil, { cacheControl: "3600", upsert: false });

  if (uploadError) throw new Error("Opplasting feilet: " + uploadError.message);

  const bildeUrl = await lagBildeUrlFraSti(filsti);

  const { error: dbError } = await supabaseClient
    .from("beh_behandling_bilder")
    .insert({
      behandling_id: behandlingId,
      filnavn: fil.name,
      filsti,
      bilde_url: bildeUrl || null,
      bildetekst: bildetekst || ""
    });

  if (dbError) throw new Error("Bildet ble lastet opp, men ikke koblet til behandlingen: " + dbError.message);

  return { filsti, bilde_url: bildeUrl };
}

async function hentBilderForBehBehandling(behandlingId) {
  if (!behandlingId || !window.supabaseClient) return [];

  try {
    const { data, error } = await supabaseClient
      .from("beh_behandling_bilder")
      .select("id, filsti, bilde_url, bildetekst, created_at")
      .eq("behandling_id", behandlingId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Kunne ikke hente behandling-bilder:", error);
      return [];
    }

    const bilder = [];
    for (const b of data || []) {
      const url = b.filsti ? await lagBildeUrlFraSti(b.filsti) : (b.bilde_url || "");
      if (url) bilder.push({ ...b, url });
    }
    return bilder;
  } catch (e) {
    console.warn("Hoppet over bilder for behandling:", e);
    return [];
  }
}

async function hentBildeAntallForBehandlinger(behandlinger) {
  if (!Array.isArray(behandlinger) || !behandlinger.length || !window.supabaseClient) return;

  const ids = behandlinger.map(j => j.id).filter(Boolean);
  if (!ids.length) return;

  try {
    const { data, error } = await supabaseClient
      .from("beh_behandling_bilder")
      .select("behandling_id")
      .in("behandling_id", ids);

    if (error) {
      console.warn("Kunne ikke hente bildeantall:", error);
      behandlinger.forEach(j => j._bilde_antall = 0);
      return;
    }

    const map = new Map();
    (data || []).forEach(b => {
      const key = String(b.behandling_id || "");
      map.set(key, (map.get(key) || 0) + 1);
    });

    behandlinger.forEach(j => j._bilde_antall = map.get(String(j.id)) || 0);
  } catch (e) {
    console.warn("Hoppet over bildeantall:", e);
    behandlinger.forEach(j => j._bilde_antall = 0);
  }
}

async function lagreBehandling() {
  const kundeId = document.getElementById("behandlingKunde")?.value || "";
  const hestId = document.getElementById("behandlingHest")?.value || "";

  if (!kundeId) {
    behandlingMelding("Velg kunde først", true);
    return;
  }

  if (!hestId) {
    behandlingMelding("Velg hest først", true);
    return;
  }

  const sjekkHest = await supabaseClient
    .from("beh_hester")
    .select("id, kunde_id, navn")
    .eq("id", hestId)
    .single();

  if (sjekkHest.error) {
    behandlingMelding("Fant ikke valgt hest", true);
    return;
  }

  if (String(sjekkHest.data.kunde_id) !== String(kundeId)) {
    behandlingMelding("Feil hest/eier: " + sjekkHest.data.navn + " tilhører ikke valgt kunde.", true);
    return;
  }

  const km = tall(document.getElementById("behandlingKm")?.value);
  const kmPris = tall(document.getElementById("behandlingKmPris")?.value);
  const arbeid = tall(document.getElementById("arbeidBelop")?.value);
  const varer = tall(document.getElementById("varerBelop")?.value);

  const eksMva = arbeid + varer + (km * kmPris);
  const mva = eksMva * 0.25;
  const total = eksMva + mva;

  const behandling = {
    kunde_id: kundeId,
    hest_id: hestId || null,
    dato: document.getElementById("behandlingDato")?.value || new Date().toISOString().slice(0, 10),
    behandlingtype: document.getElementById("behandlingType")?.value || "",
    beskrivelse: document.getElementById("behandlingBeskrivelse")?.value.trim() || "",
    km,
    km_pris: kmPris,
    arbeid_belop: arbeid,
    varer_belop: varer,
    mva,
    total,
    fakturert: false
  };

  const res = await supabaseClient
    .from("beh_behandlinger")
    .insert([behandling])
    .select("*")
    .single();

  if (res.error) {
    console.error(res.error);
    behandlingMelding(res.error.message, true);
    return;
  }

  const nyBehandling = res.data;
  const valgtBilde = hentValgtBehBildeFil();

  if (valgtBilde && nyBehandling?.id) {
    try {
      await lastOppBehBehandlingBilde(nyBehandling.id, valgtBilde, "Bilde fra behandling");
      tomBehBildeFelter();
    } catch (e) {
      console.error("Bildefeil:", e);
      behandlingMelding("Behandling lagret, men bilde feilet: " + (e.message || e), true);
      await hentBehandlinger();
      return;
    }
  }

  if (hestId && behandling.dato) {
    const hestOppdaterRes = await supabaseClient
      .from("beh_hester")
      .update({ sist_skodd: behandling.dato })
      .eq("id", hestId);

    if (hestOppdaterRes.error) {
      console.error(hestOppdaterRes.error);
      behandlingMelding("Behandling lagret, men klarte ikke å oppdatere sist behandlet: " + hestOppdaterRes.error.message, true);
      return;
    }

    if (typeof window.hentAlleHesterFraBase === "function") await window.hentAlleHesterFraBase();
    if (typeof window.hentHester === "function") await window.hentHester();
  }

  behandlingMelding(valgtBilde ? "Behandling og bilde lagret" : "Behandling lagret");

  const behandlingDato = document.getElementById("behandlingDato");
  if (behandlingDato) behandlingDato.value = new Date().toISOString().slice(0, 10);

  const behandlingKunde = document.getElementById("behandlingKunde");
  if (behandlingKunde) behandlingKunde.value = "";

  const behandlingHest = document.getElementById("behandlingHest");
  if (behandlingHest) behandlingHest.innerHTML = `<option value="">Velg hest</option>`;

  const behandlingType = document.getElementById("behandlingType");
  if (behandlingType) behandlingType.value = "";

  const behandlingBeskrivelse = document.getElementById("behandlingBeskrivelse");
  if (behandlingBeskrivelse) behandlingBeskrivelse.value = "";

  const behandlingKm = document.getElementById("behandlingKm");
  if (behandlingKm) behandlingKm.value = "0";

  const behandlingKmPris = document.getElementById("behandlingKmPris");
  if (behandlingKmPris) behandlingKmPris.value = "5.30";

  const arbeidBelop = document.getElementById("arbeidBelop");
  if (arbeidBelop) arbeidBelop.value = "0";

  const varerBelop = document.getElementById("varerBelop");
  if (varerBelop) varerBelop.value = "0";

  await hentBehandlinger();
}

function sikreBehandlingDetalj() {
  let detalj = document.getElementById("behBehandlingDetalj");
  const liste = document.getElementById("behandlingListe");

  if (!detalj) {
    detalj = document.createElement("div");
    detalj.id = "behBehandlingDetalj";
    detalj.className = "listekort";
    detalj.style.display = "none";
    detalj.style.marginBottom = "12px";

    if (liste?.parentNode) {
      liste.parentNode.insertBefore(detalj, liste);
    } else {
      document.getElementById("behandlingSide")?.appendChild(detalj);
    }
  }

  return detalj;
}

async function visBehBehandlingDetalj(behandlingId) {
  const behandling = behBehandlingerSiste.find(j => String(j.id) === String(behandlingId));
  if (!behandling) return;

  behBehandlingValgt = behandling;
  const detalj = sikreBehandlingDetalj();
  const bilder = await hentBilderForBehBehandling(behandling.id);

  detalj.style.display = "block";
  detalj.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
      <h3 style="margin:0;">Behandling #${behEsc(behandling.id)}</h3>
      <span>
        <button type="button" class="danger" id="slettBehBehandlingKnapp">Slett behandling</button>
        <button type="button" class="secondary" id="lukkBehBehandlingDetaljKnapp">Lukk</button>
      </span>
    </div>

    <div class="rad" style="margin-top:12px;">
      <div><strong>Dato:</strong><br>${behEsc(behDatoNo(behandling.dato))}</div>
      <div><strong>Kunde:</strong><br>${behEsc(behandling.kunder?.navn || "")}</div>
      <div><strong>Hest:</strong><br>${behEsc(behandling.hester?.navn || "Uten hest")}</div>
      <div><strong>Behandling:</strong><br>${behEsc(behandling.behandlingtype || "")}</div>
      <div><strong>Kjøring:</strong><br>${behEsc(behandling.km || 0)} km x ${behEsc(behandling.km_pris || 0)}</div>
      <div><strong>Total inkl. mva:</strong><br>${Number(behandling.total || 0).toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr</div>
      <div><strong>Status:</strong><br>${behandling.fakturert ? "Fakturert" : "Ikke fakturert"}</div>
    </div>

    ${behandling.beskrivelse ? `<h4>Beskrivelse</h4><div style="white-space:pre-wrap;background:#111827;padding:10px;border-radius:8px;">${behEsc(behandling.beskrivelse)}</div>` : ""}

    <h4>Bilder (${bilder.length})</h4>
    <div id="behBehandlingBildeGalleri" style="display:flex;gap:10px;flex-wrap:wrap;">
      ${bilder.length ? bilder.map(b => `
        <a href="${behEsc(b.url)}" target="_blank" style="color:inherit;text-decoration:none;">
          <img src="${behEsc(b.url)}" alt="Bilde" style="width:150px;height:115px;object-fit:cover;border-radius:10px;border:1px solid #374151;display:block;">
          <small>${behEsc(b.bildetekst || "Åpne bilde")}</small>
        </a>
      `).join("") : `<div class="info">Ingen bilder på denne behandlingen ennå.</div>`}
    </div>

    <h4>Legg til bilde på denne behandlingen</h4>
    <div style="display:grid;gap:8px;max-width:440px;">
      <input type="file" id="behDetaljBildeFil" accept="image/*">
      <input type="text" id="behDetaljBildeTekst" placeholder="Bildetekst, valgfritt">
      <button type="button" id="lagreBehDetaljBildeKnapp">Lagre bilde på behandlingen</button>
      <div id="behDetaljBildeMelding" class="melding"></div>
    </div>
  `;

  const lukk = document.getElementById("lukkBehBehandlingDetaljKnapp");
  if (lukk) {
    lukk.onclick = () => {
      detalj.style.display = "none";
      detalj.innerHTML = "";
    };
  }

  const slettKnapp = document.getElementById("slettBehBehandlingKnapp");
  if (slettKnapp) {
    slettKnapp.onclick = async () => {
      await slettBehandling(behandling.id);
    };
  }

  const lagreKnapp = document.getElementById("lagreBehDetaljBildeKnapp");
  if (lagreKnapp) {
    lagreKnapp.onclick = async () => {
      await lagreBildePaValgtBehBehandling(behandling.id);
    };
  }

  detalj.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function lagreBildePaValgtBehBehandling(behandlingId) {
  const filInput = document.getElementById("behDetaljBildeFil");
  const tekstInput = document.getElementById("behDetaljBildeTekst");
  const melding = document.getElementById("behDetaljBildeMelding");
  const knapp = document.getElementById("lagreBehDetaljBildeKnapp");
  const fil = filInput?.files?.[0];

  if (melding) melding.textContent = "";

  if (!fil) {
    if (melding) melding.textContent = "Velg et bilde først.";
    return;
  }

  try {
    if (knapp) knapp.disabled = true;
    if (melding) melding.textContent = "Lagrer bilde...";

    await lastOppBehBehandlingBilde(behandlingId, fil, tekstInput?.value || "");

    if (filInput) filInput.value = "";
    if (tekstInput) tekstInput.value = "";

    await hentBehandlinger();
    await visBehBehandlingDetalj(behandlingId);

    if (melding) melding.textContent = "Bilde lagret.";
  } catch (e) {
    console.error("Feil ved lagring av bilde:", e);
    if (melding) melding.textContent = "Bildet ble ikke lagret: " + (e.message || e);
  } finally {
    if (knapp) knapp.disabled = false;
  }
}

async function hentBehandlinger() {
  const res = await supabaseClient
    .from("beh_behandlinger")
    .select("*, kunder:beh_kunder(navn), hester:beh_hester(navn)")
    .order("dato", { ascending: false });

  if (res.error) {
    console.error(res.error);
    behandlingMelding(res.error.message, true);
    return;
  }

  const liste = document.getElementById("behandlingListe");
  if (!liste) return;

  const data = res.data || [];
  await hentBildeAntallForBehandlinger(data);
  behBehandlingerSiste = data;

  const ikkeFakturert = data.filter(j => !j.fakturert);
  const fakturert = data.filter(j => j.fakturert);
  const omsetning = data.reduce((sum, j) => sum + Number(j.total || 0), 0);

  const antallUfatturerte = document.getElementById("antallUfatturerte");
  if (antallUfatturerte) antallUfatturerte.textContent = ikkeFakturert.length;

  const antallFakturerte = document.getElementById("antallFakturerte");
  if (antallFakturerte) antallFakturerte.textContent = fakturert.length;

  const behandlingOmsetning = document.getElementById("behandlingOmsetning");
  if (behandlingOmsetning) {
    behandlingOmsetning.textContent = omsetning.toLocaleString("no-NO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " kr";
  }

  sikreBehandlingDetalj();
  liste.innerHTML = "";

  if (!data.length) {
    liste.innerHTML = `<div class="info">Ingen behandlinger registrert.</div>`;
    return;
  }

  const table = document.createElement("table");
  table.className = "bil-tabell";
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.innerHTML = `
    <thead>
      <tr>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #374151;">Dato</th>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #374151;">Hest</th>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #374151;">Kunde</th>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #374151;">Behandling</th>
        <th style="text-align:right;padding:8px;border-bottom:1px solid #374151;">Beløp</th>
        <th style="text-align:center;padding:8px;border-bottom:1px solid #374151;">Bilder</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  for (const j of data) {
    const tr = document.createElement("tr");
    tr.dataset.behandlingId = j.id;
    tr.style.cursor = "pointer";
    tr.title = "Klikk for detaljer og bilder";

    tr.innerHTML = `
      <td style="padding:8px;border-bottom:1px solid #374151;white-space:nowrap;">${behEsc(behDatoNo(j.dato))}</td>
      <td style="padding:8px;border-bottom:1px solid #374151;white-space:nowrap;">${behEsc(j.hester?.navn || "Uten hest")}</td>
      <td style="padding:8px;border-bottom:1px solid #374151;white-space:nowrap;">${behEsc(j.kunder?.navn || "")}</td>
      <td style="padding:8px;border-bottom:1px solid #374151;">${behEsc(j.behandlingtype || "")}</td>
      <td style="padding:8px;border-bottom:1px solid #374151;text-align:right;white-space:nowrap;">${Number(j.total || 0).toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr</td>
      <td style="padding:8px;border-bottom:1px solid #374151;text-align:center;white-space:nowrap;">📷 ${Number(j._bilde_antall || 0)}</td>
    `;

    tr.addEventListener("click", function () {
      visBehBehandlingDetalj(j.id);
    });

    tbody.appendChild(tr);
  }

  liste.appendChild(table);
}

async function slettBehandling(behandlingId) {
  if (!behandlingId) return;
  if (!confirm("Slette behandlingen?")) return;

  try {
    const { error } = await supabaseClient
      .from("beh_behandlinger")
      .delete()
      .eq("id", behandlingId);

    if (error) throw error;

    const detalj = document.getElementById("behBehandlingDetalj");
    if (detalj) {
      detalj.style.display = "none";
      detalj.innerHTML = "";
    }

    behandlingMelding("Behandling slettet");
    await hentBehandlinger();
  } catch (e) {
    console.error(e);
    behandlingMelding("Kunne ikke slette behandling: " + (e.message || e), true);
  }
}

function nyBehandling() {
  const manuell = document.getElementById("manuellBehandling");
  if (manuell) manuell.classList.remove("skjult");

  const ids = [
    "behandlingKunde", "behandlingHest", "behandlingType",
    "behandlingBeskrivelse", "arbeidBelop", "varerBelop",
    "behandlingKm", "behandlingKmPris"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "arbeidBelop" || id === "varerBelop" || id === "behandlingKm") el.value = "0";
    else if (id === "behandlingKmPris") el.value = "5.30";
    else if (id === "behandlingHest") el.innerHTML = '<option value="">Velg hest</option>';
    else el.value = "";
  });

  const dato = document.getElementById("behandlingDato");
  if (dato) dato.value = new Date().toISOString().slice(0, 10);

  behandlingMelding("");
  document.getElementById("behandlingDato")?.focus();
}

window.lagreBehandling = lagreBehandling;
window.hentBehandlinger = hentBehandlinger;
window.visBehBehandlingDetalj = visBehBehandlingDetalj;
window.lagreBildePaValgtBehBehandling = lagreBildePaValgtBehBehandling;
window.slettBehandling = slettBehandling;
window.nyBehandling = nyBehandling;


// Sikker kobling: Oppdater behandlinger-knappen skal alltid vise behandlinglista.
function bindBehBehandlinglisteKnapp() {
  const knapp = document.getElementById("oppdaterBehandlingerKnapp");
  if (knapp && knapp.dataset.behBehandlingerBindet !== "1") {
    knapp.dataset.behBehandlingerBindet = "1";
    knapp.addEventListener("click", function () {
      hentBehandlinger();
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    bindBehBehandlinglisteKnapp();
    setTimeout(hentBehandlinger, 500);
  });
} else {
  bindBehBehandlinglisteKnapp();
  setTimeout(hentBehandlinger, 500);
}

window.bindBehBehandlinglisteKnapp = bindBehBehandlinglisteKnapp;

// AUTO-PRIS 2026-06-14: Hent pris fra beh_priser når behandlingstype velges.
// Fyller feltet "Arbeid eks. mva" automatisk, men brukeren kan fortsatt overstyre prisen manuelt.
(function () {
  let behPrisCache = [];
  let behPrisLaster = false;

  function el(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  async function ventBehSupabaseClient() {
    for (let i = 0; i < 80; i++) {
      if (window.supabaseClient) return window.supabaseClient;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error("Supabase-klient ble ikke klar");
  }

  function finnPrisRad(navn) {
    const valgt = String(navn || "").trim().toLowerCase();
    return behPrisCache.find(p => String(p.navn || "").trim().toLowerCase() === valgt) || null;
  }

  function fyllBehandlingTypeFraPrisliste() {
    const select = el("behandlingType");
    if (!select || !behPrisCache.length) return;

    const valgt = select.value || "";
    const html = ['<option value="">Velg behandlingstype</option>']
      .concat(behPrisCache.map(p => `<option value="${esc(p.navn)}">${esc(p.navn)}</option>`))
      .join("");

    if (select.innerHTML !== html) select.innerHTML = html;
    if (valgt && behPrisCache.some(p => String(p.navn) === String(valgt))) select.value = valgt;
  }

  async function lastBehPriserTilBehandling() {
    if (behPrisLaster) return behPrisCache;
    behPrisLaster = true;
    try {
      const c = await ventBehSupabaseClient();
      const res = await c.from("beh_priser")
        .select("id, navn, pris, sortering, aktiv")
        .eq("aktiv", true)
        .order("sortering", { ascending: true })
        .order("navn", { ascending: true });

      if (res.error) throw res.error;
      behPrisCache = res.data || [];
      fyllBehandlingTypeFraPrisliste();
      return behPrisCache;
    } catch (e) {
      console.warn("Kunne ikke hente beh_priser til behandlingstype:", e);
      return behPrisCache;
    } finally {
      behPrisLaster = false;
    }
  }

  async function oppdaterArbeidPrisFraBehandling() {
    const select = el("behandlingType");
    const arbeid = el("arbeidBelop");
    if (!select || !arbeid) return;

    if (!behPrisCache.length) await lastBehPriserTilBehandling();

    const rad = finnPrisRad(select.value);
    if (!rad) return;

    arbeid.value = Number(rad.pris || 0);
    arbeid.dataset.autoPrisFraBehandling = select.value || "";
  }

  function bindAutoPris() {
    const select = el("behandlingType");
    if (!select) return;

    if (select.dataset.behAutoPrisBindet !== "1") {
      select.dataset.behAutoPrisBindet = "1";
      select.addEventListener("focus", lastBehPriserTilBehandling);
      select.addEventListener("click", lastBehPriserTilBehandling);
      select.addEventListener("change", oppdaterArbeidPrisFraBehandling);
    }

    lastBehPriserTilBehandling();
  }

  const gammelNyBehandlingAutoPris = window.nyBehandling;
  window.nyBehandling = function () {
    if (typeof gammelNyBehandlingAutoPris === "function") {
      gammelNyBehandlingAutoPris.apply(this, arguments);
    }
    setTimeout(bindAutoPris, 0);
    setTimeout(lastBehPriserTilBehandling, 150);
    return false;
  };

  window.behLastPriserTilBehandling = lastBehPriserTilBehandling;
  window.behOppdaterArbeidPrisFraBehandling = oppdaterArbeidPrisFraBehandling;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAutoPris);
  } else {
    bindAutoPris();
  }

  window.addEventListener("load", function () {
    setTimeout(bindAutoPris, 100);
    setTimeout(bindAutoPris, 800);
  });
})();


// AUTO-PRIS HARD FIX 2026-06-14: direkte oppslag hver gang behandlingstype endres.
// Denne ligger helt nederst for å vinne over eldre kode.
(function () {
  function el(id) { return document.getElementById(id); }
  function norm(v) { return String(v || "").trim().toLowerCase(); }
  function num(v) {
    const n = Number(String(v ?? 0).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  async function client() {
    for (let i = 0; i < 80; i++) {
      if (window.supabaseClient) return window.supabaseClient;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error("Supabase-klient ble ikke klar");
  }
  function msg(t, feil) {
    const m = el("behandlingMelding");
    if (m && t) {
      m.textContent = t;
      m.style.color = feil ? "#fca5a5" : "#86efac";
    }
  }
  async function hentAllePriser() {
    const c = await client();
    const res = await c.from("beh_priser")
      .select("id, navn, pris, sortering, aktiv")
      .order("sortering", { ascending: true })
      .order("navn", { ascending: true });
    if (res.error) throw res.error;
    return (res.data || []).filter(p => p.aktiv !== false);
  }
  function fyllDropdown(priser) {
    const select = el("behandlingType");
    if (!select || !Array.isArray(priser) || !priser.length) return;
    const valgt = select.value || "";
    select.innerHTML = '<option value="">Velg behandlingstype</option>';
    priser.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.navn || "";
      opt.textContent = p.navn || "Uten navn";
      opt.dataset.pris = String(p.pris ?? 0);
      select.appendChild(opt);
    });
    const match = priser.find(p => norm(p.navn) === norm(valgt));
    if (match) select.value = match.navn || "";
  }
  async function settPrisFraValgtBehandling() {
    const select = el("behandlingType");
    const arbeid = el("arbeidBelop");
    if (!select || !arbeid) return false;

    const valgt = select.value || "";
    if (!valgt) return false;

    const dataPris = select.selectedOptions && select.selectedOptions[0]
      ? select.selectedOptions[0].dataset.pris
      : "";

    if (dataPris !== undefined && dataPris !== "") {
      arbeid.value = num(dataPris);
      arbeid.dispatchEvent(new Event("input", { bubbles: true }));
      arbeid.dispatchEvent(new Event("change", { bubbles: true }));
      msg("Pris hentet: " + arbeid.value + " kr", false);
      return true;
    }

    const priser = await hentAllePriser();
    fyllDropdown(priser);
    const rad = priser.find(p => norm(p.navn) === norm(valgt));
    if (!rad) {
      msg("Fant ikke pris for: " + valgt, true);
      return false;
    }
    arbeid.value = num(rad.pris);
    arbeid.dispatchEvent(new Event("input", { bubbles: true }));
    arbeid.dispatchEvent(new Event("change", { bubbles: true }));
    msg("Pris hentet: " + arbeid.value + " kr", false);
    return true;
  }
  async function lastOgBindAutoPrisHard() {
    const select = el("behandlingType");
    if (!select) return;
    try {
      const priser = await hentAllePriser();
      fyllDropdown(priser);
    } catch (e) {
      console.warn("Auto-pris: kunne ikke fylle behandlingstype fra beh_priser", e);
    }
    if (select.dataset.autoPrisHardBind === "1") return;
    select.dataset.autoPrisHardBind = "1";
    select.addEventListener("change", settPrisFraValgtBehandling, true);
    select.addEventListener("input", settPrisFraValgtBehandling, true);
    select.addEventListener("focus", lastOgBindAutoPrisHard);
    select.addEventListener("click", lastOgBindAutoPrisHard);
  }
  window.behAutoPrisHardLast = lastOgBindAutoPrisHard;
  window.behSettPrisFraValgtBehandlingHard = settPrisFraValgtBehandling;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", lastOgBindAutoPrisHard);
  else lastOgBindAutoPrisHard();
  window.addEventListener("load", function () {
    setTimeout(lastOgBindAutoPrisHard, 100);
    setTimeout(lastOgBindAutoPrisHard, 800);
    setTimeout(lastOgBindAutoPrisHard, 2000);
  });
})();

// ABSOLUTT SISTE AUTO-PRIS 2026-06-14
// Henter behandlingstyper fra beh_priser, viser pris i nedtrekket og fyller Arbeid eks. mva.
// Hvis prisen i databasen er 0, sier den tydelig fra i meldingsfeltet.
(function () {
  let priser = [];
  let laster = false;
  let observerStartet = false;

  function el(id) { return document.getElementById(id); }
  function norm(v) { return String(v || "").trim().toLowerCase(); }
  function kroner(v) {
    const n = Number(String(v ?? 0).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  function visKr(v) {
    return kroner(v).toLocaleString("no-NO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function melding(t, feil) {
    const m = el("behandlingMelding");
    if (m && t) {
      m.textContent = t;
      m.style.color = feil ? "#fca5a5" : "#86efac";
    }
    if (t) console.log("AUTO-PRIS-SISTE:", t);
  }
  async function client() {
    for (let i = 0; i < 100; i++) {
      if (window.supabaseClient) return window.supabaseClient;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error("Supabase-klient ble ikke klar");
  }
  async function hentPriser(force) {
    if (laster) return priser;
    if (!force && priser.length) return priser;
    laster = true;
    try {
      const c = await client();
      const r = await c.from("beh_priser")
        .select("id, navn, pris, sortering, aktiv")
        .order("sortering", { ascending: true })
        .order("navn", { ascending: true });
      if (r.error) throw r.error;
      priser = (r.data || []).filter(p => p.aktiv !== false);
      window.behAutoPrisCacheSiste = priser;
      return priser;
    } finally {
      laster = false;
    }
  }
  function finnPris(valgt) {
    const v = norm(valgt);
    if (!v) return null;
    return priser.find(p => norm(p.navn) === v || String(p.id) === String(valgt)) || null;
  }
  function fyllSelectFraPriser() {
    const s = el("behandlingType");
    if (!s || !priser.length) return;

    const valgtFør = s.value || "";
    const tekstFør = s.selectedOptions && s.selectedOptions[0] ? s.selectedOptions[0].textContent : "";
    const matchFør = finnPris(valgtFør) || priser.find(p => tekstFør && norm(tekstFør).startsWith(norm(p.navn)));

    s.innerHTML = "";
    const tom = document.createElement("option");
    tom.value = "";
    tom.textContent = "Velg behandlingstype";
    tom.dataset.pris = "";
    s.appendChild(tom);

    priser.forEach(p => {
      const pris = kroner(p.pris);
      const o = document.createElement("option");
      o.value = p.navn || "";
      o.textContent = (p.navn || "Uten navn") + " - " + visKr(pris) + " kr";
      o.dataset.pris = String(pris);
      o.dataset.prisId = p.id || "";
      s.appendChild(o);
    });

    const behold = matchFør || finnPris(valgtFør);
    if (behold) s.value = behold.navn || "";
  }
  async function settPrisFraValg() {
    const s = el("behandlingType");
    const a = el("arbeidBelop");
    if (!s || !a) return false;

    if (!priser.length) {
      try { await hentPriser(true); fyllSelectFraPriser(); } catch (e) { melding("Kunne ikke hente priser: " + (e.message || e), true); return false; }
    }

    const rad = finnPris(s.value);
    let pris = null;

    if (rad) pris = kroner(rad.pris);
    else if (s.selectedOptions && s.selectedOptions[0] && s.selectedOptions[0].dataset.pris !== undefined) {
      pris = kroner(s.selectedOptions[0].dataset.pris);
    }

    if (pris === null) {
      if (s.value) melding("Fant ikke pris for " + s.value + " i beh_priser", true);
      return false;
    }

    a.value = String(pris);
    a.dataset.autoPrisSatt = "1";
    a.dispatchEvent(new Event("input", { bubbles: true }));
    a.dispatchEvent(new Event("change", { bubbles: true }));

    if (pris === 0) {
      melding("Pris hentet, men den står som 0 kr i prisliste. Gå til Prisliste og legg inn pris.", true);
    } else {
      melding("Pris hentet automatisk: " + visKr(pris) + " kr", false);
    }
    return false;
  }
  async function startAutoPrisSiste(force) {
    const s = el("behandlingType");
    if (!s) return;
    try {
      await hentPriser(!!force);
      fyllSelectFraPriser();
    } catch (e) {
      console.error("Auto-pris siste feilet:", e);
      melding("Kunne ikke hente prisliste: " + (e.message || e), true);
    }

    if (s.dataset.autoPrisSisteBind !== "1") {
      s.dataset.autoPrisSisteBind = "1";
      s.addEventListener("change", settPrisFraValg, true);
      s.addEventListener("input", settPrisFraValg, true);
      s.addEventListener("focus", () => startAutoPrisSiste(true), true);
      s.addEventListener("click", () => startAutoPrisSiste(false), true);
    }

    if (!observerStartet) {
      observerStartet = true;
      const obs = new MutationObserver(() => {
        const ss = el("behandlingType");
        if (ss && priser.length && !Array.from(ss.options).some(o => o.dataset && o.dataset.prisId)) {
          fyllSelectFraPriser();
        }
      });
      obs.observe(s, { childList: true });
    }
  }

  window.behStartAutoPrisSiste = startAutoPrisSiste;
  window.behSettPrisFraValgSiste = settPrisFraValg;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => startAutoPrisSiste(true));
  else startAutoPrisSiste(true);

  window.addEventListener("load", function () {
    setTimeout(() => startAutoPrisSiste(true), 100);
    setTimeout(() => startAutoPrisSiste(true), 800);
    setTimeout(() => startAutoPrisSiste(true), 2000);
  });
  window.addEventListener("hashchange", function () {
    if (location.hash === "#behandlingSide") setTimeout(() => startAutoPrisSiste(true), 100);
  });
})();


// AUTO-PRIS HARD4 2026-06-14 - ekstern fil.
// Binder direkte på behandlingType og fyller arbeidBelop fra beh_priser.
(function(){
  let priserCache = [];
  let laster = false;
  function el(id){ return document.getElementById(id); }
  function norm(v){ return String(v ?? "").trim().toLowerCase().replace(/\s+/g," "); }
  function num(v){ const n = Number(String(v ?? "0").replace(",",".")); return Number.isFinite(n) ? n : 0; }
  function msg(t, feil){ const m=el("behandlingMelding"); if(m){m.textContent=t||"";m.style.color=feil?"#fca5a5":"#86efac";} if(t) console.log("AUTO-PRIS-HARD4-JS:",t); }
  async function client(){ for(let i=0;i<100;i++){ if(window.supabaseClient) return window.supabaseClient; await new Promise(r=>setTimeout(r,100)); } throw new Error("Supabase-klient ble ikke klar"); }
  async function hentPriser(force){ if(laster) return priserCache; if(!force && priserCache.length) return priserCache; laster=true; try{ const c=await client(); const r=await c.from("beh_priser").select("id,navn,pris,sortering,aktiv").order("sortering",{ascending:true}).order("navn",{ascending:true}); if(r.error) throw r.error; priserCache=(r.data||[]).filter(p=>p.aktiv!==false); window.behPriserHard4=priserCache; return priserCache; } finally { laster=false; } }
  function finn(v){ const n=norm(v); return priserCache.find(p=>norm(p.navn)===n || String(p.id)===String(v)) || null; }
  function fyll(){ const s=el("behandlingType"); if(!s||!priserCache.length) return; const old=s.value; const oldText=s.selectedOptions&&s.selectedOptions[0]?s.selectedOptions[0].textContent:""; const match=finn(old)||priserCache.find(p=>norm(oldText).startsWith(norm(p.navn))); s.innerHTML='<option value="">Velg behandlingstype</option>'; priserCache.forEach(p=>{ const o=document.createElement("option"); o.value=p.navn||""; o.textContent=(p.navn||"Uten navn")+" - "+num(p.pris).toLocaleString("no-NO",{maximumFractionDigits:2})+" kr"; o.dataset.pris=String(num(p.pris)); o.dataset.prisId=p.id||""; s.appendChild(o); }); if(match) s.value=match.navn||""; }
  async function sett(ev){ if(ev&&ev.target&&ev.target.id!=="behandlingType") return false; const s=el("behandlingType"), a=el("arbeidBelop"); if(!s||!a||!s.value) return false; try{ await hentPriser(false); if(!Array.from(s.options).some(o=>o.dataset&&o.dataset.prisId)) fyll(); const rad=finn(s.value); let pris=rad?num(rad.pris):null; if(pris===null && s.selectedOptions&&s.selectedOptions[0]&&s.selectedOptions[0].dataset.pris!==undefined) pris=num(s.selectedOptions[0].dataset.pris); if(pris===null){msg("Fant ikke pris for "+s.value,true);return false;} a.value=String(pris); a.setAttribute("value",String(pris)); a.dataset.autoPrisHard4="1"; a.dispatchEvent(new Event("input",{bubbles:true})); a.dispatchEvent(new Event("change",{bubbles:true})); msg("Pris hentet: "+pris.toLocaleString("no-NO",{maximumFractionDigits:2})+" kr", pris===0); }catch(e){console.error(e); msg("Kunne ikke hente pris: "+(e.message||e),true);} return false; }
  async function start(force){ const s=el("behandlingType"); if(!s) return; try{await hentPriser(!!force); fyll();}catch(e){console.warn(e);} s.onchange=sett; if(s.dataset.hard4JsBind!=="1"){s.dataset.hard4JsBind="1"; s.addEventListener("change",sett,true); s.addEventListener("input",sett,true); s.addEventListener("mouseup",()=>setTimeout(sett,50),true); s.addEventListener("keyup",()=>setTimeout(sett,50),true); s.addEventListener("focus",()=>start(true),true);} }
  document.addEventListener("change", ev=>{ if(ev.target&&ev.target.id==="behandlingType") sett(ev); }, true);
  window.behSettPrisHard4 = window.behSettPrisHard4 || sett;
  window.behStartAutoPrisHard4 = window.behStartAutoPrisHard4 || start;
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>start(true)); else start(true);
  window.addEventListener("load",()=>{setTimeout(()=>start(true),100);setTimeout(()=>start(true),1000);setTimeout(()=>start(true),2500);});
})();
