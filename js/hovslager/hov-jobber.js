console.log("hov-jobber.js lastet - PRIS/BILDE FIX 20260616");

let hovJobberSiste = [];
let hovJobbValgt = null;

function jobbMelding(tekst, feil = false) {
  const el = document.getElementById("jobbMelding");
  if (el) {
    el.textContent = tekst || "";
    el.style.color = feil ? "#b42318" : "#116329";
  }
}

function tall(v) {
  const n = Number(String(v || 0).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function hovEsc(v) {
  return String(v ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[c]));
}

function hovDatoNo(v) {
  if (!v) return "";
  const s = String(v).slice(0, 10);
  const d = s.split("-");
  return d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : String(v);
}

function hentValgteHovBildeFiler() {
  const inputIds = [
    "jobbBilder",
    "jobbBilderManuell",
    // gamle id-er beholdes som fallback hvis en gammel index ligger i cache
    "jobbBildeKamera",
    "jobbBildeGalleri",
    "jobbBildeKameraManuell",
    "jobbBildeGalleriManuell"
  ];

  const filer = [];
  const sett = new Set();

  for (const id of inputIds) {
    const input = document.getElementById(id);
    for (const fil of Array.from(input?.files || [])) {
      const key = [fil.name, fil.size, fil.lastModified].join("|");
      if (sett.has(key)) continue;
      sett.add(key);
      filer.push(fil);
    }
  }

  return filer;
}

function hentValgtHovBildeFil() {
  return hentValgteHovBildeFiler()[0] || null;
}

function tomHovBildeFelter() {
  [
    "jobbBilder",
    "jobbBilderManuell",
    "jobbBildeKamera",
    "jobbBildeGalleri",
    "jobbBildeKameraManuell",
    "jobbBildeGalleriManuell"
  ].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });

  ["jobbBildePreview", "jobbBildePreviewManuell"].forEach(id => {
    const div = document.getElementById(id);
    if (div) div.innerHTML = "";
  });
}

function hovVisBildePreview() {
  const filer = hentValgteHovBildeFiler();
  const html = filer.map(f => {
    const url = URL.createObjectURL(f);
    return `<img src="${url}" alt="${hovEsc(f.name)}" title="${hovEsc(f.name)}">`;
  }).join("");

  ["jobbBildePreview", "jobbBildePreviewManuell"].forEach(id => {
    const div = document.getElementById(id);
    if (div) div.innerHTML = html;
  });
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

async function lastOppHovJobbBilde(jobbId, fil, bildetekst = "") {
  if (!jobbId) throw new Error("Mangler jobb-id.");
  if (!fil) throw new Error("Velg et bilde først.");

  const filsti = `hov-jobber/${jobbId}/${Date.now()}_${rentFilnavn(fil.name)}`;

  const { error: uploadError } = await supabaseClient
    .storage
    .from("bilder")
    .upload(filsti, fil, { cacheControl: "3600", upsert: false });

  if (uploadError) throw new Error("Opplasting feilet: " + uploadError.message);

  const bildeUrl = await lagBildeUrlFraSti(filsti);

  const firmaId = await window.hentAktivHovFirmaId();

  const { error: dbError } = await supabaseClient
    .from("hov_jobb_bilder")
    .insert({
      firma_id: firmaId,
      jobb_id: jobbId,
      filnavn: fil.name,
      filsti,
      bilde_url: bildeUrl || null,
      bildetekst: bildetekst || ""
    });

  if (dbError) throw new Error("Bildet ble lastet opp, men ikke koblet til jobben: " + dbError.message);

  return { filsti, bilde_url: bildeUrl };
}

async function hentBilderForHovJobb(jobbId) {
  if (!jobbId || !window.supabaseClient) return [];

  try {
    const { data, error } = await supabaseClient
      .from("hov_jobb_bilder")
      .select("id, filsti, bilde_url, bildetekst, created_at")
      .eq("jobb_id", jobbId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Kunne ikke hente jobb-bilder:", error);
      return [];
    }

    const bilder = [];
    for (const b of data || []) {
      const url = b.filsti ? await lagBildeUrlFraSti(b.filsti) : (b.bilde_url || "");
      if (url) bilder.push({ ...b, url });
    }
    return bilder;
  } catch (e) {
    console.warn("Hoppet over bilder for jobb:", e);
    return [];
  }
}

async function hentBildeAntallForJobber(jobber) {
  if (!Array.isArray(jobber) || !jobber.length || !window.supabaseClient) return;

  const ids = jobber.map(j => j.id).filter(Boolean);
  if (!ids.length) return;

  try {
    const { data, error } = await supabaseClient
      .from("hov_jobb_bilder")
      .select("jobb_id")
      .in("jobb_id", ids);

    if (error) {
      console.warn("Kunne ikke hente bildeantall:", error);
      jobber.forEach(j => j._bilde_antall = 0);
      return;
    }

    const map = new Map();
    (data || []).forEach(b => {
      const key = String(b.jobb_id || "");
      map.set(key, (map.get(key) || 0) + 1);
    });

    jobber.forEach(j => j._bilde_antall = map.get(String(j.id)) || 0);
  } catch (e) {
    console.warn("Hoppet over bildeantall:", e);
    jobber.forEach(j => j._bilde_antall = 0);
  }
}

async function lagreJobb() {
  const kundeId = document.getElementById("jobbKunde")?.value || "";
  const hestId = document.getElementById("jobbHest")?.value || "";

  if (!kundeId) {
    jobbMelding("Velg kunde først", true);
    return;
  }

  if (!hestId) {
    jobbMelding("Velg hest først", true);
    return;
  }

  const sjekkHest = await supabaseClient
    .from("hester")
    .select("id, kunde_id, navn")
    .eq("id", hestId)
    .single();

  if (sjekkHest.error) {
    jobbMelding("Fant ikke valgt hest", true);
    return;
  }

  if (String(sjekkHest.data.kunde_id) !== String(kundeId)) {
    jobbMelding("Feil hest/eier: " + sjekkHest.data.navn + " tilhører ikke valgt kunde.", true);
    return;
  }

  const km = tall(document.getElementById("jobbKm")?.value);
  const kmPris = tall(document.getElementById("jobbKmPris")?.value);
  const arbeid = tall(document.getElementById("arbeidBelop")?.value);
  const varer = tall(document.getElementById("varerBelop")?.value);

  const eksMva = arbeid + varer + (km * kmPris);
  const mva = eksMva * 0.25;
  const total = eksMva + mva;

  const firmaId = await window.hentAktivHovFirmaId();

  const jobb = {
    firma_id: firmaId,
    kunde_id: kundeId,
    hest_id: hestId || null,
    dato: document.getElementById("jobbDato")?.value || new Date().toISOString().slice(0, 10),
    jobbtype: document.getElementById("jobbType")?.value || "",
    beskrivelse: document.getElementById("jobbBeskrivelse")?.value.trim() || "",
    km,
    km_pris: kmPris,
    arbeid_belop: arbeid,
    varer_belop: varer,
    mva,
    total,
    fakturert: false
  };

  const res = await supabaseClient
    .from("hov_jobber")
    .insert([jobb])
    .select("*")
    .single();

  if (res.error) {
    console.error(res.error);
    jobbMelding(res.error.message, true);
    return;
  }

  const nyJobb = res.data;
  window.hovSistLagretJobbId = nyJobb?.id || null;
  window.hovSistLagretJobbTid = Date.now();
  const valgteBilder = hentValgteHovBildeFiler();
  let antallBilderLagret = 0;

  if (valgteBilder.length && nyJobb?.id) {
    try {
      for (const fil of valgteBilder) {
        await lastOppHovJobbBilde(nyJobb.id, fil, "Bilde fra registrering");
        antallBilderLagret += 1;
      }
      tomHovBildeFelter();
    } catch (e) {
      console.error("Bildefeil:", e);
      jobbMelding("Jobb lagret, men ett eller flere bilder feilet: " + (e.message || e), true);
      await hentJobber();
      return;
    }
  }

  if (hestId && jobb.dato) {
    const hestOppdaterRes = await supabaseClient
      .from("hester")
      .update({ sist_skodd: jobb.dato })
      .eq("id", hestId);

    if (hestOppdaterRes.error) {
      console.error(hestOppdaterRes.error);
      jobbMelding("Jobb lagret, men klarte ikke å oppdatere sist skodd: " + hestOppdaterRes.error.message, true);
      return;
    }

    if (typeof window.hentAlleHesterFraBase === "function") await window.hentAlleHesterFraBase();
    if (typeof window.hentHester === "function") await window.hentHester();
  }

  jobbMelding(antallBilderLagret ? `Jobb og ${antallBilderLagret} bilde(r) lagret` : "Jobb lagret");

  const jobbDato = document.getElementById("jobbDato");
  if (jobbDato) jobbDato.value = new Date().toISOString().slice(0, 10);

  const jobbKunde = document.getElementById("jobbKunde");
  if (jobbKunde) jobbKunde.value = "";

  const jobbHest = document.getElementById("jobbHest");
  if (jobbHest) jobbHest.innerHTML = `<option value="">Velg hest</option>`;

  const jobbType = document.getElementById("jobbType");
  if (jobbType) jobbType.value = "";

  const prisFraPrisliste = document.getElementById("prisFraPrisliste");
  if (prisFraPrisliste) prisFraPrisliste.value = "0";

  const jobbBeskrivelse = document.getElementById("jobbBeskrivelse");
  if (jobbBeskrivelse) jobbBeskrivelse.value = "";

  const jobbKm = document.getElementById("jobbKm");
  if (jobbKm) jobbKm.value = "0";

  const jobbKmPris = document.getElementById("jobbKmPris");
  if (jobbKmPris) jobbKmPris.value = "5.30";

  const arbeidBelop = document.getElementById("arbeidBelop");
  if (arbeidBelop) arbeidBelop.value = "0";

  const varerBelop = document.getElementById("varerBelop");
  if (varerBelop) varerBelop.value = "0";

  await hentJobber();
}

function sikreJobbDetalj() {
  let detalj = document.getElementById("hovJobbDetalj");
  const liste = document.getElementById("jobbListe");

  if (!detalj) {
    detalj = document.createElement("div");
    detalj.id = "hovJobbDetalj";
    detalj.className = "listekort";
    detalj.style.display = "none";
    detalj.style.marginBottom = "12px";

    if (liste?.parentNode) {
      liste.parentNode.insertBefore(detalj, liste);
    } else {
      document.getElementById("jobbSide")?.appendChild(detalj);
    }
  }

  return detalj;
}

async function visHovJobbDetalj(jobbId) {
  const jobb = hovJobberSiste.find(j => String(j.id) === String(jobbId));
  if (!jobb) return;

  hovJobbValgt = jobb;
  const detalj = sikreJobbDetalj();
  const bilder = await hentBilderForHovJobb(jobb.id);

  detalj.style.display = "block";
  detalj.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;">
      <h3 style="margin:0;">Jobb #${hovEsc(jobb.id)}</h3>
      <button type="button" class="secondary" id="lukkHovJobbDetaljKnapp">Lukk</button>
    </div>

    <div class="rad" style="margin-top:12px;">
      <div><strong>Dato:</strong><br>${hovEsc(hovDatoNo(jobb.dato))}</div>
      <div><strong>Kunde:</strong><br>${hovEsc(jobb.kunder?.navn || "")}</div>
      <div><strong>Hest:</strong><br>${hovEsc(jobb.hester?.navn || "Uten hest")}</div>
      <div><strong>Jobb:</strong><br>${hovEsc(jobb.jobbtype || "")}</div>
      <div><strong>Kjøring:</strong><br>${hovEsc(jobb.km || 0)} km x ${hovEsc(jobb.km_pris || 0)}</div>
      <div><strong>Total inkl. mva:</strong><br>${Number(jobb.total || 0).toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr</div>
      <div><strong>Status:</strong><br>${jobb.fakturert ? "Fakturert" : "Ikke fakturert"}</div>
    </div>

    ${jobb.beskrivelse ? `<h4>Beskrivelse</h4><div style="white-space:pre-wrap;background:#111827;padding:10px;border-radius:8px;">${hovEsc(jobb.beskrivelse)}</div>` : ""}

    <h4>Bilder (${bilder.length})</h4>
    <div id="hovJobbBildeGalleri" style="display:flex;gap:10px;flex-wrap:wrap;">
      ${bilder.length ? bilder.map(b => `
        <a href="${hovEsc(b.url)}" target="_blank" style="color:inherit;text-decoration:none;">
          <img src="${hovEsc(b.url)}" alt="Bilde" style="width:150px;height:115px;object-fit:cover;border-radius:10px;border:1px solid #374151;display:block;">
          <small>${hovEsc(b.bildetekst || "Åpne bilde")}</small>
        </a>
      `).join("") : `<div class="info">Ingen bilder på denne jobben ennå.</div>`}
    </div>

    <h4>Legg til bilde på denne jobben</h4>
    <div style="display:grid;gap:8px;max-width:440px;">
      <input type="file" id="hovDetaljBildeFil" accept="image/*">
      <input type="text" id="hovDetaljBildeTekst" placeholder="Bildetekst, valgfritt">
      <button type="button" id="lagreHovDetaljBildeKnapp">Lagre bilde på jobben</button>
      <div id="hovDetaljBildeMelding" class="melding"></div>
    </div>
  `;

  const lukk = document.getElementById("lukkHovJobbDetaljKnapp");
  if (lukk) {
    lukk.onclick = () => {
      detalj.style.display = "none";
      detalj.innerHTML = "";
    };
  }

  const lagreKnapp = document.getElementById("lagreHovDetaljBildeKnapp");
  if (lagreKnapp) {
    lagreKnapp.onclick = async () => {
      await lagreBildePaValgtHovJobb(jobb.id);
    };
  }

  detalj.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function lagreBildePaValgtHovJobb(jobbId) {
  const filInput = document.getElementById("hovDetaljBildeFil");
  const tekstInput = document.getElementById("hovDetaljBildeTekst");
  const melding = document.getElementById("hovDetaljBildeMelding");
  const knapp = document.getElementById("lagreHovDetaljBildeKnapp");
  const fil = filInput?.files?.[0];

  if (melding) melding.textContent = "";

  if (!fil) {
    if (melding) melding.textContent = "Velg et bilde først.";
    return;
  }

  try {
    if (knapp) knapp.disabled = true;
    if (melding) melding.textContent = "Lagrer bilde...";

    await lastOppHovJobbBilde(jobbId, fil, tekstInput?.value || "");

    if (filInput) filInput.value = "";
    if (tekstInput) tekstInput.value = "";

    await hentJobber();
    await visHovJobbDetalj(jobbId);

    if (melding) melding.textContent = "Bilde lagret.";
  } catch (e) {
    console.error("Feil ved lagring av bilde:", e);
    if (melding) melding.textContent = "Bildet ble ikke lagret: " + (e.message || e);
  } finally {
    if (knapp) knapp.disabled = false;
  }
}

async function hentJobber() {
  const res = await supabaseClient
    .from("hov_jobber")
    .select("*, kunder(navn), hester(navn)")
    .order("dato", { ascending: false });

  if (res.error) {
    console.error(res.error);
    jobbMelding(res.error.message, true);
    return;
  }

  const liste = document.getElementById("jobbListe");
  if (!liste) return;

  const data = res.data || [];
  await hentBildeAntallForJobber(data);
  hovJobberSiste = data;

  const ikkeFakturert = data.filter(j => !j.fakturert);
  const fakturert = data.filter(j => j.fakturert);
  const omsetning = data.reduce((sum, j) => sum + Number(j.total || 0), 0);

  const antallUfatturerte = document.getElementById("antallUfatturerte");
  if (antallUfatturerte) antallUfatturerte.textContent = ikkeFakturert.length;

  const antallFakturerte = document.getElementById("antallFakturerte");
  if (antallFakturerte) antallFakturerte.textContent = fakturert.length;

  const jobbOmsetning = document.getElementById("jobbOmsetning");
  if (jobbOmsetning) {
    jobbOmsetning.textContent = omsetning.toLocaleString("no-NO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " kr";
  }

  sikreJobbDetalj();
  liste.innerHTML = "";

  if (!data.length) {
    liste.innerHTML = `<div class="info">Ingen jobber registrert.</div>`;
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
        <th style="text-align:left;padding:8px;border-bottom:1px solid #374151;">Jobb</th>
        <th style="text-align:right;padding:8px;border-bottom:1px solid #374151;">Beløp</th>
        <th style="text-align:center;padding:8px;border-bottom:1px solid #374151;">Bilder</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  for (const j of data) {
    const tr = document.createElement("tr");
    tr.dataset.jobbId = j.id;
    tr.style.cursor = "pointer";
    tr.title = "Klikk for detaljer og bilder";

    tr.innerHTML = `
      <td style="padding:8px;border-bottom:1px solid #374151;white-space:nowrap;">${hovEsc(hovDatoNo(j.dato))}</td>
      <td style="padding:8px;border-bottom:1px solid #374151;white-space:nowrap;">${hovEsc(j.hester?.navn || "Uten hest")}</td>
      <td style="padding:8px;border-bottom:1px solid #374151;white-space:nowrap;">${hovEsc(j.kunder?.navn || "")}</td>
      <td style="padding:8px;border-bottom:1px solid #374151;">${hovEsc(j.jobbtype || "")}</td>
      <td style="padding:8px;border-bottom:1px solid #374151;text-align:right;white-space:nowrap;">${Number(j.total || 0).toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr</td>
      <td style="padding:8px;border-bottom:1px solid #374151;text-align:center;white-space:nowrap;">📷 ${Number(j._bilde_antall || 0)}</td>
    `;

    tr.addEventListener("click", function () {
      visHovJobbDetalj(j.id);
    });

    tbody.appendChild(tr);
  }

  liste.appendChild(table);
}

async function lastOppValgteBilderPaSisteHovJobb() {
  const jobbId = window.hovSistLagretJobbId || hovJobbValgt?.id || null;
  if (!jobbId) {
    jobbMelding("Ingen siste jobb funnet. Lagre eller åpne en jobb først.", true);
    return false;
  }

  const filer = hentValgteHovBildeFiler();
  if (!filer.length) {
    jobbMelding("Velg ett eller flere bilder først.", true);
    return false;
  }

  const knapp = document.getElementById("leggBilderPaSisteJobbKnapp");
  const gammelTekst = knapp?.textContent || "Legg bilder på siste jobb";
  if (knapp) {
    knapp.disabled = true;
    knapp.textContent = "Lagrer bilder ...";
  }

  try {
    let antall = 0;
    for (const fil of filer) {
      await lastOppHovJobbBilde(jobbId, fil, "Bilde lagt til etter tale/registrering");
      antall += 1;
    }
    tomHovBildeFelter();
    jobbMelding(`${antall} bilde(r) lagt på siste jobb.`);
    await hentJobber();
    return false;
  } catch (e) {
    console.error(e);
    jobbMelding("Kunne ikke legge bilder på siste jobb: " + (e.message || e), true);
    return false;
  } finally {
    if (knapp) {
      knapp.disabled = false;
      knapp.textContent = gammelTekst;
    }
  }
}

async function hovBildeEndret(ev) {
  hovVisBildePreview();

  // Hvis bildene velges rett etter tale/lagring, legges de automatisk på siste jobb.
  // Velges de før lagring, blir de med når Lagre jobb / tale-lagring kjører.
  const input = ev && ev.target;
  const erTaleBilde = input && input.id === "jobbBilder";
  const sistTid = Number(window.hovSistLagretJobbTid || 0);
  const nyligLagret = window.hovSistLagretJobbId && sistTid && (Date.now() - sistTid < 10 * 60 * 1000);
  const harFiler = hentValgteHovBildeFiler().length > 0;

  if (erTaleBilde && nyligLagret && harFiler) {
    await lastOppValgteBilderPaSisteHovJobb();
  }
}

function bindHovBildeKnapper() {
  [
    "jobbBilder",
    "jobbBilderManuell",
    // gamle id-er beholdes som fallback hvis en gammel index ligger i cache
    "jobbBildeKamera",
    "jobbBildeGalleri",
    "jobbBildeKameraManuell",
    "jobbBildeGalleriManuell"
  ].forEach(id => {
    const input = document.getElementById(id);
    if (input && input.dataset.hovBildeBind !== "1") {
      input.dataset.hovBildeBind = "1";
      input.addEventListener("change", hovBildeEndret);
    }
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindHovBildeKnapper);
} else {
  bindHovBildeKnapper();
}
window.addEventListener("load", bindHovBildeKnapper);


window.lagreJobb = lagreJobb;
window.hentJobber = hentJobber;
window.visHovJobbDetalj = visHovJobbDetalj;
window.lagreBildePaValgtHovJobb = lagreBildePaValgtHovJobb;
window.lastOppValgteBilderPaSisteHovJobb = lastOppValgteBilderPaSisteHovJobb;
window.hovVisBildePreview = hovVisBildePreview;


// Sikker kobling: Oppdater jobber-knappen skal alltid vise jobblista.
function bindHovJobblisteKnapp() {
  const knapp = document.getElementById("oppdaterJobberKnapp");
  if (knapp && knapp.dataset.hovJobberBindet !== "1") {
    knapp.dataset.hovJobberBindet = "1";
    knapp.addEventListener("click", function () {
      hentJobber();
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    bindHovJobblisteKnapp();
    setTimeout(hentJobber, 500);
  });
} else {
  bindHovJobblisteKnapp();
  setTimeout(hentJobber, 500);
}

window.bindHovJobblisteKnapp = bindHovJobblisteKnapp;


// === RETT I LOMMA FIX: jobbtype -> pris fra hov_priser ===
// Viser prisfelt på samme linje som jobbtype og fyller Arbeid eks. mva.
// Robust: bruker Supabase-prisliste først, og lokal fallback hvis RLS/cache gjør at appen ikke får radene.
const HOV_STANDARD_PRISER = {
  "fullbeslag": 1200,
  "forsko": 1100,
  "baksko": 1100,
  "barfot verking": 650,
  "enkeltsko": 350,
  "saler": 300,
  "brodder": 150,
  "vintersko": 1400,
  "annet": 0,
  "kjoring pr km": 5.30
};

function hovNormaliserPrisnavn(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hovSettPrisfelter(pris) {
  const n = Number(String(pris ?? 0).replace(",", "."));
  const verdi = Number.isFinite(n) ? n : 0;
  const prisFelt = document.getElementById("prisFraPrisliste");
  const arbeidFelt = document.getElementById("arbeidBelop");

  if (prisFelt) {
    prisFelt.value = verdi.toFixed(2);
    prisFelt.dispatchEvent(new Event("input", { bubbles: true }));
    prisFelt.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (arbeidFelt) {
    arbeidFelt.value = verdi.toFixed(2);
    arbeidFelt.dispatchEvent(new Event("input", { bubbles: true }));
    arbeidFelt.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return verdi;
}

async function hovHentOgSettPrisFraJobbtype() {
  const typeFelt = document.getElementById("jobbType");
  const melding = document.getElementById("jobbMelding");
  if (!typeFelt) return;

  const valgtType = String(typeFelt.value || "").trim();
  const valgtNorm = hovNormaliserPrisnavn(valgtType);

  if (!valgtType) {
    hovSettPrisfelter(0);
    return;
  }

  let prisrad = null;
  let kilde = "prisliste";

  try {
    if (window.supabaseClient) {
      const { data, error } = await window.supabaseClient
        .from("hov_priser")
        .select("id, navn, pris, aktiv");

      if (error) throw error;

      const priser = (data || []).filter(p => p.aktiv !== false);
      prisrad =
        priser.find(p => hovNormaliserPrisnavn(p.navn) === valgtNorm) ||
        priser.find(p => {
          const n = hovNormaliserPrisnavn(p.navn);
          return n && (n.includes(valgtNorm) || valgtNorm.includes(n));
        }) || null;
    }
  } catch (e) {
    console.warn("Kunne ikke hente hov_priser, bruker standardpriser:", e);
    kilde = "standardpris";
  }

  if (!prisrad && Object.prototype.hasOwnProperty.call(HOV_STANDARD_PRISER, valgtNorm)) {
    prisrad = { navn: valgtType, pris: HOV_STANDARD_PRISER[valgtNorm] };
    kilde = "standardpris";
  }

  if (!prisrad) {
    hovSettPrisfelter(0);
    if (melding) {
      melding.textContent = "Fant ikke pris for " + valgtType + " i prisliste.";
      melding.style.color = "#fca5a5";
    }
    return;
  }

  const pris = hovSettPrisfelter(prisrad.pris);

  if (melding) {
    melding.textContent =
      "Pris hentet: " + (prisrad.navn || valgtType) + " - " +
      pris.toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      " kr eks. mva" + (kilde === "standardpris" ? " (standardpris)" : "");
    melding.style.color = "#86efac";
  }
}

function hovBindPrisvalgRobust() {
  const typeFelt = document.getElementById("jobbType");
  if (!typeFelt) return;

  // Sett både onchange og eventlistener. Dette tåler gammel cache og andre script som tukler med feltet.
  typeFelt.onchange = hovHentOgSettPrisFraJobbtype;
  typeFelt.oninput = hovHentOgSettPrisFraJobbtype;

  if (typeFelt.dataset.hovPrisvalgRobust !== "1") {
    typeFelt.dataset.hovPrisvalgRobust = "1";
    typeFelt.addEventListener("change", hovHentOgSettPrisFraJobbtype);
    typeFelt.addEventListener("input", hovHentOgSettPrisFraJobbtype);
    typeFelt.addEventListener("click", function () {
      setTimeout(hovHentOgSettPrisFraJobbtype, 50);
    });
  }

  // Hvis nettleseren husker valgt jobbtype etter refresh, hent pris med én gang.
  setTimeout(hovHentOgSettPrisFraJobbtype, 100);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", hovBindPrisvalgRobust);
} else {
  hovBindPrisvalgRobust();
}
setTimeout(hovBindPrisvalgRobust, 300);
setTimeout(hovBindPrisvalgRobust, 1000);
setTimeout(hovBindPrisvalgRobust, 2500);

window.hovHentOgSettPrisFraJobbtype = hovHentOgSettPrisFraJobbtype;
window.hovBindPrisvalgRobust = hovBindPrisvalgRobust;
