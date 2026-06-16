console.log("hester.js lastet - kunde_id + sist_skodd/redigering");

let sisteHester = [];

function hestMelding(tekst, feil = false) {
  const el = document.getElementById("hestMelding");
  if (!el) return;
  el.textContent = tekst || "";
  el.style.color = feil ? "#b42318" : "#116329";
}

function hentValgtKundeId() {
  return String(document.getElementById("jobbKunde")?.value || "");
}

function datoVerdi(v) {
  if (!v) return "";
  return String(v).slice(0, 10);
}


function hovHestRentFilnavn(navn) {
  return String(navn || "hest.jpg")
    .replaceAll(" ", "_")
    .replace(/[æøåÆØÅ]/g, b => ({ æ: "ae", ø: "o", å: "a", Æ: "Ae", Ø: "O", Å: "A" }[b] || b))
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function hentValgteHestBildeFiler() {
  const input = document.getElementById("hestBildeFil");
  return Array.from(input?.files || []);
}

async function lagHestBildeUrlFraSti(filsti) {
  if (!filsti || !window.supabaseClient) return "";

  try {
    const { data, error } = await window.supabaseClient
      .storage
      .from("bilder")
      .createSignedUrl(filsti, 60 * 60 * 24 * 7);

    if (!error && data?.signedUrl) return data.signedUrl;
  } catch (e) {
    console.warn("Kunne ikke lage signert hestebilde-url:", e);
  }

  try {
    const { data } = window.supabaseClient.storage.from("bilder").getPublicUrl(filsti);
    return data?.publicUrl || "";
  } catch (e) {
    return "";
  }
}

async function lastOppOgKobleHestBilde(hestId, firmaId, fil, bildetekst = "") {
  if (!hestId) throw new Error("Mangler hest-id.");
  if (!fil) throw new Error("Velg et bilde først.");

  const filsti = `hov-hester/${firmaId || "ukjent"}/${hestId}/${Date.now()}_${hovHestRentFilnavn(fil.name)}`;

  const { error: uploadError } = await window.supabaseClient
    .storage
    .from("bilder")
    .upload(filsti, fil, { cacheControl: "3600", upsert: false });

  if (uploadError) throw new Error("Hestebilde ble ikke lastet opp: " + uploadError.message);

  const bildeUrl = await lagHestBildeUrlFraSti(filsti);

  const { error: dbError } = await window.supabaseClient
    .from("hov_hest_bilder")
    .insert({
      firma_id: firmaId || null,
      hest_id: hestId,
      filnavn: fil.name,
      filsti,
      bilde_url: bildeUrl || null,
      bildetekst: bildetekst || ""
    });

  if (dbError) {
    throw new Error("Bildet ble lastet opp, men ikke koblet til hesten. Har du laget tabellen hov_hest_bilder? " + dbError.message);
  }

  return { filsti, bilde_url: bildeUrl };
}

async function lastOppValgteHestBilder(hestId, firmaId, hestNavn) {
  const filer = hentValgteHestBildeFiler();
  const lagret = [];

  for (let i = 0; i < filer.length; i += 1) {
    const fil = filer[i];
    const res = await lastOppOgKobleHestBilde(
      hestId,
      firmaId,
      fil,
      `Bilde av ${hestNavn || "hest"}`
    );
    lagret.push(res);
  }

  return lagret;
}

async function lastOppHestBildeHvisValgt(hestNavn) {
  // Beholdes for bakoverkompatibilitet. Ny lagring skjer i lastOppValgteHestBilder()
  // etter at hesten har fått id, slik at alle bilder kan kobles kronologisk til hesten.
  const fil = hentValgteHestBildeFiler()[0];
  if (!fil || !window.supabaseClient) return "";
  return "";
}

function visHestBildePreview(url) {
  const div = document.getElementById("hestBildePreview");
  if (!div) return;

  if (!url || (Array.isArray(url) && url.length === 0)) {
    div.innerHTML = "";
    return;
  }

  const urls = Array.isArray(url) ? url : [url];
  div.innerHTML = urls.map(u => `<img src="${u}" alt="Hestebilde">`).join("");
}

function bindHestBildePreview() {
  const input = document.getElementById("hestBildeFil");
  if (!input || input.dataset.hestBildeBind === "1") return;

  input.dataset.hestBildeBind = "1";
  input.addEventListener("change", () => {
    const filer = hentValgteHestBildeFiler();
    if (!filer.length) {
      const valgt = finnValgtHestFraSkjema();
      visHestBildePreview(valgt?.bilde_url || "");
      return;
    }
    visHestBildePreview(filer.map(f => URL.createObjectURL(f)));
  });
}

function nullstillHestBildeInput() {
  const input = document.getElementById("hestBildeFil");
  if (input) input.value = "";
  visHestBildePreview("");
}

function finnValgtHestFraSkjema() {
  const id = document.getElementById("hestVelg")?.value || "";
  if (!id) return null;
  return sisteHester.find(h => String(h.id) === String(id)) || null;
}

async function lagreHest() {
  const kundeId = document.getElementById("hestKunde")?.value || "";
  const navn = document.getElementById("hestNavn")?.value.trim() || "";
  const valgtHestId = document.getElementById("hestVelg")?.value || "";

  if (!kundeId) {
    hestMelding("Velg kunde/eier først", true);
    return;
  }

  if (!navn) {
    hestMelding("Mangler hestenavn", true);
    return;
  }

  const firmaId = await window.hentAktivHovFirmaId();
  const valgteBilder = hentValgteHestBildeFiler();

  const hest = {
    firma_id: firmaId,
    kunde_id: kundeId,
    navn,
    rase: document.getElementById("hestRase")?.value.trim() || "",
    notater: document.getElementById("hestNotater")?.value.trim() || "",
    sist_skodd: document.getElementById("sistSkodd")?.value || null,
    neste_besok: document.getElementById("nesteBesok")?.value || null
  };

  let res;

  if (valgtHestId) {
    res = await window.supabaseClient
      .from("hester")
      .update(hest)
      .eq("id", valgtHestId)
      .select("*")
      .single();
  } else {
    res = await window.supabaseClient
      .from("hester")
      .insert([hest])
      .select("*")
      .single();
  }

  if (res.error) {
    console.error(res.error);
    hestMelding(res.error.message, true);
    return;
  }

  const lagretHest = res.data;
  let antallBilderLagret = 0;

  if (valgteBilder.length && lagretHest?.id) {
    try {
      const lagredeBilder = await lastOppValgteHestBilder(lagretHest.id, firmaId, navn);
      antallBilderLagret = lagredeBilder.length;

      // Første nye bilde blir hovedbilde på hestekortet.
      const hovedbilde = lagredeBilder[0]?.bilde_url || "";
      if (hovedbilde) {
        await window.supabaseClient
          .from("hester")
          .update({ bilde_url: hovedbilde })
          .eq("id", lagretHest.id);
      }
    } catch (e) {
      console.error(e);
      hestMelding((valgtHestId ? "Hest oppdatert" : "Hest lagret") + ", men bildehistorikk feilet: " + (e.message || e), true);
      await hentHester();
      return;
    }
  }

  hestMelding(
    antallBilderLagret
      ? (valgtHestId ? `Hest oppdatert og ${antallBilderLagret} bilde(r) lagret` : `Hest lagret med ${antallBilderLagret} bilde(r)`)
      : (valgtHestId ? "Hest oppdatert" : "Hest lagret")
  );
  nullstillHestBildeInput();

  await hentHester();

  if (typeof window.hentAlleHesterFraBase === "function") {
    await window.hentAlleHesterFraBase();
  }

  if (typeof window.fyllJobbHesterForValgtKunde === "function") {
    await window.fyllJobbHesterForValgtKunde();
  }
}

async function hentHester() {
  const hestRes = await supabaseClient
    .from("hester")
    .select("*")
    .order("navn");

  if (hestRes.error) {
    console.error(hestRes.error);
    hestMelding(hestRes.error.message, true);
    return;
  }

  const kundeRes = await supabaseClient
    .from("kunder")
    .select("id, navn")
    .order("navn");

  if (kundeRes.error) {
    console.error(kundeRes.error);
    hestMelding(kundeRes.error.message, true);
    return;
  }

  const kunder = kundeRes.data || [];
  const kundeNavn = new Map(kunder.map(k => [String(k.id), k.navn || ""]));
  const hester = hestRes.data || [];
  sisteHester = hester;

  const liste = document.getElementById("hesteListe");
  if (liste) {
    liste.innerHTML = "";

    if (hester.length === 0) {
      liste.innerHTML = `<div class="info">Ingen hester er registrert ennå.</div>`;
    }

    for (const h of hester) {
      const div = document.createElement("div");
      div.className = "listekort";
      const bilde = h.bilde_url
        ? `<img src="${h.bilde_url}" alt="${h.navn || "Hest"}">`
        : `<div style="width:96px;height:76px;border-radius:10px;border:1px solid #475569;background:#111827;display:grid;place-items:center;font-size:28px;">🐴</div>`;

      div.innerHTML = `
        <div class="hov-hestkort">
          ${bilde}
          <div>
            <b>${h.navn || ""}</b><br>
            Eier: ${kundeNavn.get(String(h.kunde_id)) || ""}<br>
            ${h.rase || ""}<br>
            Sist skodd: ${datoVerdi(h.sist_skodd)}<br>
            Neste besøk: ${datoVerdi(h.neste_besok)}<br>
            ${h.notater || ""}<br>
            <button type="button" class="secondary" onclick="window.visAlleHovBilderForHest && window.visAlleHovBilderForHest('${String(h.id).replace(/'/g, "\\'")}')">📷 Vis alle bilder</button>
            <button type="button" class="secondary" onclick="window.visAlleHovBilderForKunde && window.visAlleHovBilderForKunde('${String(h.kunde_id).replace(/'/g, "\\'")}')">📷 Vis alle bilder for eier</button>
          </div>
        </div>
      `;
      liste.appendChild(div);
    }
  }

  fyllHestSelect(hester);
  fyllHestVelgForValgtKunde(hester);
}

function fyllHestSelect(hester) {
  const select = document.getElementById("jobbHest");
  if (!select) return;

  const valgtKunde = hentValgtKundeId();

  select.innerHTML = `<option value="">Velg hest</option>`;

  if (!valgtKunde) {
    return;
  }

  const filtrerte = (hester || []).filter(h =>
    String(h.kunde_id) === String(valgtKunde)
  );

  for (const h of filtrerte) {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = h.navn;
    select.appendChild(opt);
  }
}

function fyllHestVelgForValgtKunde(hester = sisteHester) {
  const kundeSelect = document.getElementById("hestKunde");
  const hestVelg = document.getElementById("hestVelg");

  if (!kundeSelect || !hestVelg) return;

  const valgtKunde = String(kundeSelect.value || "");
  const valgtHest = String(hestVelg.value || "");

  hestVelg.innerHTML = `<option value="">Ny hest</option>`;

  if (!valgtKunde) return;

  const filtrerte = (hester || []).filter(h =>
    String(h.kunde_id) === valgtKunde
  );

  for (const h of filtrerte) {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = h.navn;
    hestVelg.appendChild(opt);
  }

  if (valgtHest && filtrerte.some(h => String(h.id) === valgtHest)) {
    hestVelg.value = valgtHest;
  }
}

function fyllHestSkjemaFraValg() {
  const h = finnValgtHestFraSkjema();

  if (!h) {
    document.getElementById("hestNavn").value = "";
    document.getElementById("hestRase").value = "";
    document.getElementById("hestNotater").value = "";
    document.getElementById("sistSkodd").value = "";
    document.getElementById("nesteBesok").value = "";
    nullstillHestBildeInput();
    return;
  }

  document.getElementById("hestNavn").value = h.navn || "";
  document.getElementById("hestRase").value = h.rase || "";
  document.getElementById("hestNotater").value = h.notater || "";
  document.getElementById("sistSkodd").value = datoVerdi(h.sist_skodd);
  document.getElementById("nesteBesok").value = datoVerdi(h.neste_besok);
  const input = document.getElementById("hestBildeFil");
  if (input) input.value = "";
  visHestBildePreview(h.bilde_url || "");
}

document.addEventListener("DOMContentLoaded", () => {
  bindHestBildePreview();
  const jobbKunde = document.getElementById("jobbKunde");
  if (jobbKunde) {
    jobbKunde.addEventListener("change", async () => {
      await hentHester();
    });
  }

  const hestKunde = document.getElementById("hestKunde");
  if (hestKunde) {
    hestKunde.addEventListener("change", () => {
      const hestVelg = document.getElementById("hestVelg");
      if (hestVelg) hestVelg.value = "";
      fyllHestVelgForValgtKunde();
      fyllHestSkjemaFraValg();
    });
  }

  const hestVelg = document.getElementById("hestVelg");
  if (hestVelg) {
    hestVelg.addEventListener("change", fyllHestSkjemaFraValg);
  }
});

window.lagreHest = lagreHest;
window.hentHester = hentHester;
window.fyllHestSelect = fyllHestSelect;
window.fyllHestVelgForValgtKunde = fyllHestVelgForValgtKunde;
window.fyllHestSkjemaFraValg = fyllHestSkjemaFraValg;

window.lastOppHestBildeHvisValgt = lastOppHestBildeHvisValgt;
window.visHestBildePreview = visHestBildePreview;
window.bindHestBildePreview = bindHestBildePreview;
window.hentValgteHestBildeFiler = hentValgteHestBildeFiler;
window.lastOppOgKobleHestBilde = lastOppOgKobleHestBilde;
window.lastOppValgteHestBilder = lastOppValgteHestBilder;
